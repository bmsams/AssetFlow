/**
 * Integration Retry Service
 *
 * Provides retry logic with exponential backoff for integration operations.
 * Integrates with circuit breaker pattern and incident creation.
 *
 * Requirements:
 * - 7.7: Implement retry logic with exponential backoff for failed integration attempts
 * - 7.8: Maintain integration audit logs for troubleshooting and compliance
 * - 7.9: Create incident ticket and alert administrators after max retries
 */

import { createLogger } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import { circuitBreakerRegistry } from './circuit-breaker';
import { createIncidentFromRetryExhaustion } from './incident-service';
import type {
  ErrorCategory,
  ErrorSeverity,
  IntegrationAuditLog,
  IntegrationError,
  IntegrationRetryConfig,
  IntegrationType,
  RetryAttemptResult,
  RetryEvent,
} from './retry-types';
import { DEFAULT_INTEGRATION_RETRY_CONFIG } from './retry-types';

const logger = createLogger({ service: 'retry-service' });

/**
 * In-memory audit log store (would be replaced with database in production)
 */
const auditLogStore: IntegrationAuditLog[] = [];

/**
 * Retry event listeners for monitoring
 */
const retryEventListeners: ((event: RetryEvent) => void)[] = [];

/**
 * Calculate exponential backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: IntegrationRetryConfig
): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * config.jitterFactor * exponentialDelay;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Categorize an error based on its properties
 */
export function categorizeError(error: Error): ErrorCategory {
  const errorCode = (error as Error & { code?: string }).code;
  const message = error.message.toLowerCase();

  // Check error code first
  if (errorCode) {
    if (['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'].includes(errorCode)) {
      return 'CONNECTION';
    }
    if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(errorCode)) {
      return 'TIMEOUT';
    }
    if (errorCode === 'CIRCUIT_BREAKER_OPEN' || errorCode === 'CIRCUIT_BREAKER_HALF_OPEN') {
      return 'SERVICE_ERROR';
    }
  }

  // Check message patterns
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'TIMEOUT';
  }
  if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
    return 'RATE_LIMIT';
  }
  if (message.includes('unauthorized') || message.includes('401') || message.includes('authentication')) {
    return 'AUTHENTICATION';
  }
  if (message.includes('forbidden') || message.includes('403') || message.includes('permission')) {
    return 'AUTHORIZATION';
  }
  if (message.includes('validation') || message.includes('invalid')) {
    return 'VALIDATION';
  }
  if (message.includes('connection') || message.includes('network')) {
    return 'CONNECTION';
  }
  if (message.includes('service') || message.includes('500') || message.includes('503')) {
    return 'SERVICE_ERROR';
  }

  return 'UNKNOWN';
}

/**
 * Determine error severity based on category and context
 */
export function determineErrorSeverity(
  category: ErrorCategory,
  attempt: number,
  maxAttempts: number
): ErrorSeverity {
  // Last attempt failures are more severe
  if (attempt >= maxAttempts) {
    if (category === 'AUTHENTICATION' || category === 'AUTHORIZATION') {
      return 'CRITICAL';
    }
    return 'HIGH';
  }

  // Severity by category
  switch (category) {
    case 'AUTHENTICATION':
    case 'AUTHORIZATION':
      return 'HIGH';
    case 'CONNECTION':
    case 'TIMEOUT':
    case 'SERVICE_ERROR':
      return 'MEDIUM';
    case 'RATE_LIMIT':
      return 'LOW';
    case 'VALIDATION':
    case 'DATA_ERROR':
      return 'MEDIUM';
    default:
      return 'MEDIUM';
  }
}

/**
 * Check if an error is retryable based on its category
 */
export function isRetryableError(
  error: Error,
  config: IntegrationRetryConfig
): boolean {
  const category = categorizeError(error);
  return config.retryableErrorCategories.includes(category);
}

/**
 * Create an IntegrationError from a caught error
 */
export function createIntegrationError(
  error: Error,
  integrationType: IntegrationType,
  attempt: number,
  maxAttempts: number
): IntegrationError {
  const category = categorizeError(error);
  const errorCode = (error as Error & { code?: string }).code || 'UNKNOWN_ERROR';

  return {
    errorId: uuidv4(),
    integrationType,
    errorCode,
    errorMessage: error.message,
    errorCategory: category,
    severity: determineErrorSeverity(category, attempt, maxAttempts),
    retryable: isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG),
    attempt,
    maxAttempts,
    timestamp: new Date().toISOString(),
    stackTrace: error.stack,
  };
}

/**
 * Create an audit log entry
 */
export function createAuditLog(
  integrationType: IntegrationType,
  operation: string,
  status: IntegrationAuditLog['status'],
  attempt: number,
  maxAttempts: number,
  startedAt: string,
  completedAt?: string,
  error?: IntegrationError,
  requestPayload?: Record<string, unknown>,
  responsePayload?: Record<string, unknown>
): IntegrationAuditLog {
  const auditLog: IntegrationAuditLog = {
    auditLogId: uuidv4(),
    integrationType,
    operation,
    status,
    attempt,
    maxAttempts,
    startedAt,
    completedAt,
    durationMs: completedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : undefined,
    errorCode: error?.errorCode,
    errorMessage: error?.errorMessage,
    requestPayload,
    responsePayload,
  };

  // Store audit log
  auditLogStore.push(auditLog);

  // Keep only last 1000 entries in memory
  if (auditLogStore.length > 1000) {
    auditLogStore.shift();
  }

  return auditLog;
}

/**
 * Emit a retry event for monitoring
 */
function emitRetryEvent(event: RetryEvent): void {
  for (const listener of retryEventListeners) {
    try {
      listener(event);
    } catch (error) {
      logger.error('Error in retry event listener', error as Error);
    }
  }
}

/**
 * Add a retry event listener
 */
export function onRetryEvent(listener: (event: RetryEvent) => void): void {
  retryEventListeners.push(listener);
}

/**
 * Remove a retry event listener
 */
export function removeRetryEventListener(listener: (event: RetryEvent) => void): void {
  const index = retryEventListeners.indexOf(listener);
  if (index > -1) {
    retryEventListeners.splice(index, 1);
  }
}

/**
 * Execute an integration operation with retry logic
 *
 * @param integrationType - The type of integration being executed
 * @param operation - A description of the operation
 * @param fn - The async function to execute
 * @param config - Optional retry configuration
 * @returns The result of the operation with retry metadata
 */
export async function executeWithRetry<T>(
  integrationType: IntegrationType,
  operation: string,
  fn: () => Promise<T>,
  config: Partial<IntegrationRetryConfig> = {}
): Promise<RetryAttemptResult<T>> {
  const fullConfig: IntegrationRetryConfig = {
    ...DEFAULT_INTEGRATION_RETRY_CONFIG,
    ...config,
  };

  const startTime = Date.now();
  const errors: IntegrationError[] = [];
  const auditLogs: IntegrationAuditLog[] = [];
  let lastError: Error | undefined;

  logger.info('Starting integration operation with retry', {
    integrationType,
    operation,
    maxRetries: fullConfig.maxRetries,
  });

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    const attemptStartTime = new Date().toISOString();

    try {
      const result = await fn();

      // Success - create audit log
      const auditLog = createAuditLog(
        integrationType,
        operation,
        'SUCCESS',
        attempt + 1,
        fullConfig.maxRetries + 1,
        attemptStartTime,
        new Date().toISOString()
      );
      auditLogs.push(auditLog);

      logger.info('Integration operation succeeded', {
        integrationType,
        operation,
        attempt: attempt + 1,
        totalDurationMs: Date.now() - startTime,
      });

      return {
        success: true,
        result,
        attempt: attempt + 1,
        totalAttempts: attempt + 1,
        totalDurationMs: Date.now() - startTime,
        incidentCreated: false,
      };
    } catch (error) {
      lastError = error as Error;
      const integrationError = createIntegrationError(
        lastError,
        integrationType,
        attempt + 1,
        fullConfig.maxRetries + 1
      );
      errors.push(integrationError);

      // Create audit log for failure
      const auditLog = createAuditLog(
        integrationType,
        operation,
        attempt === fullConfig.maxRetries ? 'FAILURE' : 'RETRYING',
        attempt + 1,
        fullConfig.maxRetries + 1,
        attemptStartTime,
        new Date().toISOString(),
        integrationError
      );
      auditLogs.push(auditLog);

      // Check if this is the last attempt
      if (attempt === fullConfig.maxRetries) {
        logger.error('Integration operation failed after all retries', lastError, {
          integrationType,
          operation,
          totalAttempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
        });

        // Create incident if configured
        let incidentId: string | undefined;
        if (fullConfig.createIncidentOnMaxRetries) {
          try {
            const incident = await createIncidentFromRetryExhaustion(
              integrationType,
              operation,
              errors,
              fullConfig.incidentSeverity
            );
            incidentId = incident.incidentId;
          } catch (incidentError) {
            logger.error('Failed to create incident', incidentError as Error);
          }
        }

        return {
          success: false,
          error: integrationError,
          attempt: attempt + 1,
          totalAttempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
          incidentCreated: !!incidentId,
          incidentId,
        };
      }

      // Check if error is retryable
      if (!isRetryableError(lastError, fullConfig)) {
        logger.warn('Non-retryable error encountered, stopping retries', {
          integrationType,
          operation,
          errorCategory: integrationError.errorCategory,
          attempt: attempt + 1,
        });

        return {
          success: false,
          error: integrationError,
          attempt: attempt + 1,
          totalAttempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
          incidentCreated: false,
        };
      }

      // Calculate delay and wait
      const delay = calculateBackoffDelay(attempt, fullConfig);

      // Emit retry event
      emitRetryEvent({
        eventId: uuidv4(),
        integrationType,
        operation,
        attempt: attempt + 1,
        maxAttempts: fullConfig.maxRetries + 1,
        delayMs: delay,
        errorCode: integrationError.errorCode,
        errorMessage: integrationError.errorMessage,
        timestamp: new Date().toISOString(),
      });

      logger.warn('Integration operation failed, retrying', {
        integrationType,
        operation,
        attempt: attempt + 1,
        nextAttemptIn: delay,
        errorCategory: integrationError.errorCategory,
        errorMessage: integrationError.errorMessage,
      });

      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  return {
    success: false,
    error: errors[errors.length - 1],
    attempt: fullConfig.maxRetries + 1,
    totalAttempts: fullConfig.maxRetries + 1,
    totalDurationMs: Date.now() - startTime,
    incidentCreated: false,
  };
}

/**
 * Execute an integration operation with retry logic and circuit breaker
 *
 * @param integrationType - The type of integration being executed
 * @param operation - A description of the operation
 * @param fn - The async function to execute
 * @param config - Optional retry configuration
 * @returns The result of the operation with retry metadata
 */
export async function executeWithRetryAndCircuitBreaker<T>(
  integrationType: IntegrationType,
  operation: string,
  fn: () => Promise<T>,
  config: Partial<IntegrationRetryConfig> = {}
): Promise<RetryAttemptResult<T>> {
  const circuitBreaker = circuitBreakerRegistry.getBreaker(integrationType);

  // Check if circuit breaker allows the request
  if (!circuitBreaker.isRequestAllowed()) {
    const status = circuitBreaker.getStatus();
    logger.warn('Circuit breaker preventing request', {
      integrationType,
      operation,
      circuitState: status.state,
      nextRetryTime: status.nextRetryTime,
    });

    const error: IntegrationError = {
      errorId: uuidv4(),
      integrationType,
      errorCode: 'CIRCUIT_BREAKER_OPEN',
      errorMessage: `Circuit breaker is ${status.state} for ${integrationType}`,
      errorCategory: 'SERVICE_ERROR',
      severity: 'HIGH',
      retryable: false,
      attempt: 0,
      maxAttempts: 0,
      timestamp: new Date().toISOString(),
    };

    return {
      success: false,
      error,
      attempt: 0,
      totalAttempts: 0,
      totalDurationMs: 0,
      incidentCreated: false,
    };
  }

  // Execute with retry, wrapping in circuit breaker
  const result = await executeWithRetry(
    integrationType,
    operation,
    async () => {
      return circuitBreaker.execute(fn);
    },
    config
  );

  return result;
}

/**
 * Get audit logs for an integration type
 */
export function getAuditLogs(
  integrationType?: IntegrationType,
  limit = 100
): IntegrationAuditLog[] {
  let logs = [...auditLogStore];

  if (integrationType) {
    logs = logs.filter((log) => log.integrationType === integrationType);
  }

  return logs
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

/**
 * Get audit log statistics
 */
export function getAuditLogStatistics(integrationType?: IntegrationType): {
  total: number;
  success: number;
  failure: number;
  retrying: number;
  averageDurationMs: number;
  averageAttempts: number;
} {
  let logs = [...auditLogStore];

  if (integrationType) {
    logs = logs.filter((log) => log.integrationType === integrationType);
  }

  const stats = {
    total: logs.length,
    success: 0,
    failure: 0,
    retrying: 0,
    averageDurationMs: 0,
    averageAttempts: 0,
  };

  if (logs.length === 0) {
    return stats;
  }

  let totalDuration = 0;
  let totalAttempts = 0;
  let durationCount = 0;

  for (const log of logs) {
    switch (log.status) {
      case 'SUCCESS':
        stats.success++;
        break;
      case 'FAILURE':
        stats.failure++;
        break;
      case 'RETRYING':
        stats.retrying++;
        break;
    }

    if (log.durationMs !== undefined) {
      totalDuration += log.durationMs;
      durationCount++;
    }
    totalAttempts += log.attempt;
  }

  stats.averageDurationMs = durationCount > 0 ? totalDuration / durationCount : 0;
  stats.averageAttempts = logs.length > 0 ? totalAttempts / logs.length : 0;

  return stats;
}

/**
 * Clear audit logs (for testing)
 */
export function clearAuditLogs(): void {
  auditLogStore.length = 0;
}
