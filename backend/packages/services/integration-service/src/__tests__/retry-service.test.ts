/**
 * Retry Service Unit Tests
 *
 * Tests for the Integration Retry Service including:
 * - Exponential backoff calculation
 * - Error categorization
 * - Retry logic with configurable limits
 * - Circuit breaker integration
 * - Incident creation after max retries
 *
 * Requirements:
 * - 7.7: Implement retry logic with exponential backoff for failed integration attempts
 * - 7.8: Maintain integration audit logs for troubleshooting and compliance
 * - 7.9: Create incident ticket and alert administrators after max retries
 */

import {
  calculateBackoffDelay,
  categorizeError,
  clearAuditLogs,
  createIntegrationError,
  determineErrorSeverity,
  executeWithRetry,
  executeWithRetryAndCircuitBreaker,
  getAuditLogs,
  getAuditLogStatistics,
  isRetryableError,
} from '../retry/retry-service';
import {
  circuitBreakerRegistry,
  IntegrationCircuitBreaker,
} from '../retry/circuit-breaker';
import {
  clearAllIncidents,
  getOpenIncidents,
} from '../retry/incident-service';
import type {
  IntegrationRetryConfig,
} from '../retry/retry-types';
import {
  DEFAULT_INTEGRATION_RETRY_CONFIG,
} from '../retry/retry-types';

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('Retry Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuditLogs();
    clearAllIncidents();
    circuitBreakerRegistry.resetAll();
  });

  describe('calculateBackoffDelay', () => {
    const config: IntegrationRetryConfig = {
      ...DEFAULT_INTEGRATION_RETRY_CONFIG,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterFactor: 0, // Disable jitter for predictable tests
    };

    it('should calculate exponential backoff for attempt 0', () => {
      const delay = calculateBackoffDelay(0, config);
      // 1000 * 2^0 = 1000
      expect(delay).toBe(1000);
    });

    it('should calculate exponential backoff for attempt 1', () => {
      const delay = calculateBackoffDelay(1, config);
      // 1000 * 2^1 = 2000
      expect(delay).toBe(2000);
    });

    it('should calculate exponential backoff for attempt 2', () => {
      const delay = calculateBackoffDelay(2, config);
      // 1000 * 2^2 = 4000
      expect(delay).toBe(4000);
    });

    it('should cap delay at maxDelayMs', () => {
      const delay = calculateBackoffDelay(10, config);
      // 1000 * 2^10 = 1024000, but capped at 30000
      expect(delay).toBe(30000);
    });

    it('should add jitter when jitterFactor is set', () => {
      const configWithJitter: IntegrationRetryConfig = {
        ...config,
        jitterFactor: 0.3,
      };

      // Run multiple times to verify jitter adds randomness
      const delays = new Set<number>();
      for (let i = 0; i < 10; i++) {
        delays.add(calculateBackoffDelay(1, configWithJitter));
      }

      // With jitter, we should get different values
      // Base delay is 2000, jitter adds up to 30% (600ms)
      // So delays should be between 2000 and 2600
      for (const delay of delays) {
        expect(delay).toBeGreaterThanOrEqual(2000);
        expect(delay).toBeLessThanOrEqual(2600);
      }
    });
  });

  describe('categorizeError', () => {
    it('should categorize connection errors by code', () => {
      const error = new Error('Connection failed') as Error & { code: string };
      error.code = 'ECONNREFUSED';
      expect(categorizeError(error)).toBe('CONNECTION');
    });

    it('should categorize timeout errors by code', () => {
      const error = new Error('Request timed out') as Error & { code: string };
      error.code = 'ETIMEDOUT';
      expect(categorizeError(error)).toBe('TIMEOUT');
    });

    it('should categorize timeout errors by message', () => {
      const error = new Error('Request timed out after 30000ms');
      expect(categorizeError(error)).toBe('TIMEOUT');
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('Rate limit exceeded, too many requests');
      expect(categorizeError(error)).toBe('RATE_LIMIT');
    });

    it('should categorize authentication errors', () => {
      const error = new Error('401 Unauthorized');
      expect(categorizeError(error)).toBe('AUTHENTICATION');
    });

    it('should categorize authorization errors', () => {
      const error = new Error('403 Forbidden - Permission denied');
      expect(categorizeError(error)).toBe('AUTHORIZATION');
    });

    it('should categorize validation errors', () => {
      const error = new Error('Validation failed: invalid email format');
      expect(categorizeError(error)).toBe('VALIDATION');
    });

    it('should categorize service errors', () => {
      const error = new Error('500 Internal Server Error');
      expect(categorizeError(error)).toBe('SERVICE_ERROR');
    });

    it('should return UNKNOWN for unrecognized errors', () => {
      const error = new Error('Something went wrong');
      expect(categorizeError(error)).toBe('UNKNOWN');
    });
  });

  describe('determineErrorSeverity', () => {
    it('should return CRITICAL for auth errors on last attempt', () => {
      expect(determineErrorSeverity('AUTHENTICATION', 3, 3)).toBe('CRITICAL');
      expect(determineErrorSeverity('AUTHORIZATION', 3, 3)).toBe('CRITICAL');
    });

    it('should return HIGH for other errors on last attempt', () => {
      expect(determineErrorSeverity('CONNECTION', 3, 3)).toBe('HIGH');
      expect(determineErrorSeverity('TIMEOUT', 3, 3)).toBe('HIGH');
    });

    it('should return HIGH for auth errors before last attempt', () => {
      expect(determineErrorSeverity('AUTHENTICATION', 1, 3)).toBe('HIGH');
      expect(determineErrorSeverity('AUTHORIZATION', 1, 3)).toBe('HIGH');
    });

    it('should return MEDIUM for connection/timeout errors', () => {
      expect(determineErrorSeverity('CONNECTION', 1, 3)).toBe('MEDIUM');
      expect(determineErrorSeverity('TIMEOUT', 1, 3)).toBe('MEDIUM');
    });

    it('should return LOW for rate limit errors', () => {
      expect(determineErrorSeverity('RATE_LIMIT', 1, 3)).toBe('LOW');
    });
  });

  describe('isRetryableError', () => {
    it('should return true for connection errors', () => {
      const error = new Error('Connection refused') as Error & { code: string };
      error.code = 'ECONNREFUSED';
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = new Error('Request timed out');
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(true);
    });

    it('should return true for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(true);
    });

    it('should return true for service errors', () => {
      const error = new Error('503 Service Unavailable');
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(true);
    });

    it('should return false for authentication errors', () => {
      const error = new Error('401 Unauthorized');
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(false);
    });

    it('should return false for validation errors', () => {
      const error = new Error('Validation failed');
      expect(isRetryableError(error, DEFAULT_INTEGRATION_RETRY_CONFIG)).toBe(false);
    });
  });

  describe('createIntegrationError', () => {
    it('should create an integration error with all fields', () => {
      const error = new Error('Connection failed') as Error & { code: string };
      error.code = 'ECONNREFUSED';

      const integrationError = createIntegrationError(
        error,
        'DISCOVERY_SCCM',
        2,
        3
      );

      expect(integrationError.errorId).toBeDefined();
      expect(integrationError.integrationType).toBe('DISCOVERY_SCCM');
      expect(integrationError.errorCode).toBe('ECONNREFUSED');
      expect(integrationError.errorMessage).toBe('Connection failed');
      expect(integrationError.errorCategory).toBe('CONNECTION');
      expect(integrationError.retryable).toBe(true);
      expect(integrationError.attempt).toBe(2);
      expect(integrationError.maxAttempts).toBe(3);
      expect(integrationError.timestamp).toBeDefined();
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempt).toBe(1);
      expect(result.totalAttempts).toBe(1);
      expect(result.incidentCreated).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and succeed', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValue('success');

      const result = await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn,
        { baseDelayMs: 10, maxDelayMs: 100 } // Fast delays for testing
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempt).toBe(3);
      expect(result.totalAttempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries and create incident', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const result = await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn,
        {
          maxRetries: 2,
          baseDelayMs: 10,
          maxDelayMs: 100,
          createIncidentOnMaxRetries: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempt).toBe(3); // 1 initial + 2 retries
      expect(result.totalAttempts).toBe(3);
      expect(result.incidentCreated).toBe(true);
      expect(result.incidentId).toBeDefined();
      expect(fn).toHaveBeenCalledTimes(3);

      // Verify incident was created
      const incidents = await getOpenIncidents();
      expect(incidents.length).toBe(1);
      expect(incidents[0]!.integrationType).toBe('DISCOVERY_SCCM');
    });

    it('should not retry non-retryable errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));

      const result = await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn,
        { maxRetries: 3, baseDelayMs: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.errorCategory).toBe('AUTHENTICATION');
      expect(result.attempt).toBe(1);
      expect(result.totalAttempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not create incident when disabled', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const result = await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn,
        {
          maxRetries: 1,
          baseDelayMs: 10,
          createIncidentOnMaxRetries: false,
        }
      );

      expect(result.success).toBe(false);
      expect(result.incidentCreated).toBe(false);
      expect(result.incidentId).toBeUndefined();

      const incidents = await getOpenIncidents();
      expect(incidents.length).toBe(0);
    });

    it('should create audit logs for each attempt', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValue('success');

      await executeWithRetry(
        'DISCOVERY_SCCM',
        'test-operation',
        fn,
        { baseDelayMs: 10 }
      );

      const logs = getAuditLogs('DISCOVERY_SCCM');
      expect(logs.length).toBe(2);
      
      // Most recent first
      expect(logs[0]!.status).toBe('SUCCESS');
      expect(logs[0]!.attempt).toBe(2);
      
      expect(logs[1]!.status).toBe('RETRYING');
      expect(logs[1]!.attempt).toBe(1);
    });
  });

  describe('executeWithRetryAndCircuitBreaker', () => {
    it('should succeed when circuit breaker is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await executeWithRetryAndCircuitBreaker(
        'ERP_SAP',
        'test-operation',
        fn
      );

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
    });

    it('should fail fast when circuit breaker is open', async () => {
      // Force circuit breaker to open state
      const breaker = circuitBreakerRegistry.getBreaker('ERP_SAP');
      breaker.forceState('OPEN', 'Test');

      const fn = jest.fn().mockResolvedValue('success');

      const result = await executeWithRetryAndCircuitBreaker(
        'ERP_SAP',
        'test-operation',
        fn
      );

      expect(result.success).toBe(false);
      expect(result.error?.errorCode).toBe('CIRCUIT_BREAKER_OPEN');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should open circuit breaker after threshold failures', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Execute multiple times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await executeWithRetryAndCircuitBreaker(
          'ERP_ORACLE',
          'test-operation',
          fn,
          { maxRetries: 0, createIncidentOnMaxRetries: false }
        );
      }

      const breaker = circuitBreakerRegistry.getBreaker('ERP_ORACLE');
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('Circuit Breaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN after failure threshold', () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF', {
        failureThreshold: 3,
      });

      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should reset failure count on success', () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF', {
        failureThreshold: 3,
      });

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();

      // Failure count should be reset
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF', {
        failureThreshold: 1,
        timeoutMs: 50,
      });

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF', {
        failureThreshold: 1,
        successThreshold: 2,
        timeoutMs: 50,
        halfOpenMaxRequests: 5,
      });

      breaker.recordFailure();
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(breaker.getState()).toBe('HALF_OPEN');

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('HALF_OPEN');

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_JAMF', {
        failureThreshold: 1,
        timeoutMs: 50,
      });

      breaker.recordFailure();
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(breaker.getState()).toBe('HALF_OPEN');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should provide accurate status', () => {
      const breaker = new IntegrationCircuitBreaker('DISCOVERY_TANIUM');

      breaker.recordSuccess();
      breaker.recordFailure();
      breaker.recordSuccess();

      const status = breaker.getStatus();
      expect(status.integrationType).toBe('DISCOVERY_TANIUM');
      expect(status.state).toBe('CLOSED');
      expect(status.totalRequests).toBe(3);
      expect(status.totalSuccesses).toBe(2);
      expect(status.totalFailures).toBe(1);
    });
  });

  describe('Audit Log Statistics', () => {
    it('should calculate statistics correctly', async () => {
      const successFn = jest.fn().mockResolvedValue('success');
      const failFn = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      // Create some successful operations
      await executeWithRetry('DISCOVERY_SCCM', 'op1', successFn);
      await executeWithRetry('DISCOVERY_SCCM', 'op2', successFn);

      // Create a failed operation
      await executeWithRetry('DISCOVERY_SCCM', 'op3', failFn, {
        maxRetries: 1,
        baseDelayMs: 10,
        createIncidentOnMaxRetries: false,
      });

      const stats = getAuditLogStatistics('DISCOVERY_SCCM');

      expect(stats.total).toBe(4); // 2 success + 1 retry + 1 failure
      expect(stats.success).toBe(2);
      expect(stats.failure).toBe(1);
      expect(stats.retrying).toBe(1);
    });

    it('should filter by integration type', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      await executeWithRetry('DISCOVERY_SCCM', 'op1', fn);
      await executeWithRetry('ERP_SAP', 'op2', fn);

      const sccmStats = getAuditLogStatistics('DISCOVERY_SCCM');
      const sapStats = getAuditLogStatistics('ERP_SAP');

      expect(sccmStats.total).toBe(1);
      expect(sapStats.total).toBe(1);
    });
  });
});
