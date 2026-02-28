/**
 * Integration Retry and Error Handling Types
 *
 * Type definitions for retry logic, circuit breaker pattern, and incident creation
 * for integration services.
 *
 * Requirements:
 * - 7.7: Implement retry logic with exponential backoff for failed integration attempts
 * - 7.8: Maintain integration audit logs for troubleshooting and compliance
 * - 7.9: Create incident ticket and alert administrators after max retries
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Integration types that can be retried
 */
export type IntegrationType = 
  | 'DISCOVERY_SCCM'
  | 'DISCOVERY_JAMF'
  | 'DISCOVERY_TANIUM'
  | 'ERP_SAP'
  | 'ERP_ORACLE'
  | 'ERP_WORKDAY'
  | 'VENDOR_CDW'
  | 'VENDOR_INSIGHT';

/**
 * Circuit breaker states
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failures exceeded threshold, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Integration error severity levels
 */
export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Integration error categories
 */
export type ErrorCategory = 
  | 'CONNECTION'      // Network/connection issues
  | 'AUTHENTICATION'  // Auth failures
  | 'AUTHORIZATION'   // Permission issues
  | 'VALIDATION'      // Data validation errors
  | 'TIMEOUT'         // Request timeouts
  | 'RATE_LIMIT'      // Rate limiting
  | 'SERVICE_ERROR'   // External service errors
  | 'DATA_ERROR'      // Data processing errors
  | 'UNKNOWN';        // Unknown errors

/**
 * Integration error with detailed information
 */
export interface IntegrationError {
  readonly errorId: UUID;
  readonly integrationType: IntegrationType;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly errorCategory: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly retryable: boolean;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly timestamp: ISODateString;
  readonly stackTrace?: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Retry configuration for integration operations
 */
export interface IntegrationRetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitterFactor: number;
  readonly retryableErrorCategories: readonly ErrorCategory[];
  readonly createIncidentOnMaxRetries: boolean;
  readonly incidentSeverity: ErrorSeverity;
}

/**
 * Default retry configuration
 */
export const DEFAULT_INTEGRATION_RETRY_CONFIG: IntegrationRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.3,
  retryableErrorCategories: [
    'CONNECTION',
    'TIMEOUT',
    'RATE_LIMIT',
    'SERVICE_ERROR',
  ],
  createIncidentOnMaxRetries: true,
  incidentSeverity: 'HIGH',
};

/**
 * Circuit breaker configuration
 */
export interface IntegrationCircuitBreakerConfig {
  readonly failureThreshold: number;
  readonly successThreshold: number;
  readonly timeoutMs: number;
  readonly halfOpenMaxRequests: number;
  readonly monitoringWindowMs: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: IntegrationCircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeoutMs: 30000,
  halfOpenMaxRequests: 1,
  monitoringWindowMs: 60000,
};

/**
 * Circuit breaker status information
 */
export interface CircuitBreakerStatus {
  readonly integrationType: IntegrationType;
  readonly state: CircuitBreakerState;
  readonly failureCount: number;
  readonly successCount: number;
  readonly lastFailureTime?: ISODateString;
  readonly lastSuccessTime?: ISODateString;
  readonly nextRetryTime?: ISODateString;
  readonly totalRequests: number;
  readonly totalFailures: number;
  readonly totalSuccesses: number;
}

/**
 * Retry attempt result
 */
export interface RetryAttemptResult<T> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: IntegrationError;
  readonly attempt: number;
  readonly totalAttempts: number;
  readonly totalDurationMs: number;
  readonly incidentCreated: boolean;
  readonly incidentId?: UUID;
}

/**
 * Integration audit log entry
 */
export interface IntegrationAuditLog {
  readonly auditLogId: UUID;
  readonly integrationType: IntegrationType;
  readonly operation: string;
  readonly status: 'SUCCESS' | 'FAILURE' | 'PARTIAL' | 'RETRYING';
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly startedAt: ISODateString;
  readonly completedAt?: ISODateString;
  readonly durationMs?: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly requestPayload?: Record<string, unknown>;
  readonly responsePayload?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Incident ticket for failed integrations
 */
export interface IntegrationIncident {
  readonly incidentId: UUID;
  readonly incidentNumber: string;
  readonly integrationType: IntegrationType;
  readonly title: string;
  readonly description: string;
  readonly severity: ErrorSeverity;
  readonly status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  readonly assignedTo?: string;
  readonly errors: readonly IntegrationError[];
  readonly auditLogs: readonly IntegrationAuditLog[];
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly resolvedAt?: ISODateString;
}

/**
 * Create incident request
 */
export interface CreateIncidentRequest {
  readonly integrationType: IntegrationType;
  readonly title: string;
  readonly description: string;
  readonly severity: ErrorSeverity;
  readonly errors: readonly IntegrationError[];
  readonly auditLogs?: readonly IntegrationAuditLog[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Integration health status
 */
export interface IntegrationHealthStatus {
  readonly integrationType: IntegrationType;
  readonly healthy: boolean;
  readonly circuitBreakerState: CircuitBreakerState;
  readonly lastSuccessfulCall?: ISODateString;
  readonly lastFailedCall?: ISODateString;
  readonly successRate: number;
  readonly averageResponseTimeMs: number;
  readonly activeIncidents: number;
}

/**
 * Retry event for monitoring
 */
export interface RetryEvent {
  readonly eventId: UUID;
  readonly integrationType: IntegrationType;
  readonly operation: string;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly timestamp: ISODateString;
}

/**
 * Circuit breaker event for monitoring
 */
export interface CircuitBreakerEvent {
  readonly eventId: UUID;
  readonly integrationType: IntegrationType;
  readonly previousState: CircuitBreakerState;
  readonly newState: CircuitBreakerState;
  readonly reason: string;
  readonly failureCount: number;
  readonly timestamp: ISODateString;
}
