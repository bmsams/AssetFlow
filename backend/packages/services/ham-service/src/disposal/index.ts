/**
 * Disposal Module - Exports for disposal workflow management
 *
 * Implements:
 * - Disposal workflow initiation and management (Requirement 3.6)
 * - Data sanitization verification (Requirement 3.6)
 * - Environmental compliance tracking (Requirement 3.6)
 * - Destruction certificate generation (Requirement 3.7)
 * - Disposal method and date recording (Requirement 3.7)
 */

// Export service functions
export {
  cancelWorkflow,
  completeDataWipe,
  completeEnvironmentalCheck,
  getCertificate,
  getCertificateByAssetId,
  getActiveWorkflowForAsset,
  getDisposalWorkflow,
  getWorkflow,
  getWorkflowByNumber,
  hasActiveWorkflow,
  initiateDisposal,
  recordDestruction,
  schedulePickup,
  updateTask,
  validateDisposalRequirements,
} from './disposal-service';

// Export types
export type {
  CreateDisposalWorkflowRequest,
  DestructionCertificate,
  DisposalMethod,
  DisposalTask,
  DisposalTaskStatus,
  DisposalTaskType,
  DisposalWorkflow,
  DisposalWorkflowResult,
  DisposalWorkflowStatus,
  InitiateDisposalResult,
  RecordDestructionRequest,
  RecordDestructionResult,
  UpdateTaskRequest,
  ValidationResult,
} from './disposal-service';

