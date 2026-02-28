/**
 * Retirement module exports
 *
 * Provides retirement operations including:
 * - Initiating retirement workflows (Requirement 6.8)
 * - Creating disposal workflows with required tasks (Requirement 6.8)
 * - Completing disposal with destruction certificates (Requirement 6.9)
 * - Updating asset status to Disposed (Requirement 6.9)
 */

// Export types from repository
export type {
  RetirementStatus,
  DisposalMethod,
  RetirementTaskType,
  RetirementTaskStatus,
  AssetStatus,
  RetirementWorkflow,
  RetirementTask,
  DestructionCertificate,
  CreateRetirementWorkflowRequest,
  CompleteDisposalRequest,
  UpdateTaskRequest,
} from './retirement-repository';

// Export repository functions (low-level data access)
export {
  getAssetById,
  getWorkflowById,
  hasActiveRetirementWorkflow,
  createWorkflow,
  createDefaultTasks,
  getTasksByWorkflowId,
  getTaskById,
  updateWorkflowStatus,
  createDestructionCertificate,
  getCertificateById,
  getWorkflows,
  areAllRequiredTasksComplete,
  getPendingTasksCount,
} from './retirement-repository';

// Export service functions (business logic) - these wrap repository functions
export {
  initiateRetirement,
  completeDisposal,
  getRetirementWorkflow,
  getActiveWorkflowForAsset,
  validateRetirementRequirements,
  completeDataWipe,
  updateTask,
  cancelWorkflow,
  getWorkflow,
  getWorkflowByNumber,
  getCertificate,
  getCertificateByAssetId,
  hasActiveWorkflow,
} from './retirement-service';

// Export service types
export type {
  RetirementWorkflowResult,
  InitiateRetirementResult,
  CompleteDisposalResult,
  ValidationResult,
} from './retirement-service';
