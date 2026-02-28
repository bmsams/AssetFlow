/**
 * Shadow IT module exports
 *
 * Provides shadow IT detection functionality:
 * - Analyze network traffic logs to identify unauthorized SaaS application usage (Requirement 4.8)
 * - Create alerts with application details and user information (Requirement 4.9)
 */

// Export types from repository
export type {
  ShadowITStatus,
  RiskLevel,
  KnownApplication,
  ShadowITDetection,
  ShadowITAlert,
  CreateShadowITDetectionRequest,
  CreateShadowITAlertRequest,
} from './shadow-it-repository';

// Export repository functions (low-level data access)
export {
  findApplicationByDomain,
  upsertDetection,
  getDetectionById,
  getDetectionByDomain,
  createAlert,
  getAlertById,
  getAlertsByDetectionId,
  getAlertsByUserId,
  updateAlertStatus,
  hasExistingAlert,
} from './shadow-it-repository';

// Export service functions (business logic)
export {
  analyzeShadowIT,
  getDetection,
  getDetections,
  updateDetectionStatus,
  getAlert,
  getAlertsByDetection,
  getAlertsByUser,
  getAlertsByStatus,
  acknowledgeAlert,
  resolveAlert,
  ignoreAlert,
  getKnownApplications,
  getApprovedApplications,
  getBlockedApplications,
  getShadowITSummary,
} from './shadow-it-service';

// Export service types
export type {
  TrafficLogEntry,
  AnalyzeShadowITResult,
} from './shadow-it-service';
