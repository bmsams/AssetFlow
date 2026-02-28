/**
 * Integration Retry and Error Handling Module
 *
 * Provides retry logic with exponential backoff, circuit breaker pattern,
 * and incident creation for integration services.
 *
 * Requirements:
 * - 7.7: Implement retry logic with exponential backoff for failed integration attempts
 * - 7.8: Maintain integration audit logs for troubleshooting and compliance
 * - 7.9: Create incident ticket and alert administrators after max retries
 */

// Export types
export * from './retry-types';

// Export circuit breaker
export {
  IntegrationCircuitBreaker,
  CircuitBreakerRegistry,
  circuitBreakerRegistry,
} from './circuit-breaker';

// Export incident service
export {
  createIncident,
  createIncidentFromRetryExhaustion,
  getIncident,
  getIncidentByNumber,
  getIncidentsByIntegrationType,
  getOpenIncidents,
  updateIncidentStatus,
  resolveIncident,
  getIncidentStatistics,
  clearAllIncidents,
} from './incident-service';

// Export retry service
export {
  calculateBackoffDelay,
  sleep,
  categorizeError,
  determineErrorSeverity,
  isRetryableError,
  createIntegrationError,
  createAuditLog,
  onRetryEvent,
  removeRetryEventListener,
  executeWithRetry,
  executeWithRetryAndCircuitBreaker,
  getAuditLogs,
  getAuditLogStatistics,
  clearAuditLogs,
} from './retry-service';
