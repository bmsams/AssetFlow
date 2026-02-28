/**
 * Approval Module
 *
 * Exports for purchase order approval workflow.
 */

// Export types from repository
export type {
  ApprovalThreshold,
  ApprovalDelegation,
  PendingApproval,
  ApprovalRecord,
  CreateDelegationRequest,
} from './approval-repository';

// Export service functions (preferred API)
export {
  getApprovalThresholdForAmount,
  getApprovalThresholds,
  getApproversForThreshold,
  getApproversForAmount,
  createDelegation,
  getActiveDelegation,
  getDelegationsForDelegate,
  deactivateDelegation,
  canApproveOnBehalf,
  getPendingApprovalsForUser,
  sendApprovalReminders,
  recordApproval,
  getApprovalHistory,
} from './approval-service';

// Export repository functions with 'Repo' suffix for direct data access
export {
  getApprovalThresholdForAmount as getApprovalThresholdForAmountRepo,
  getApprovalThresholds as getApprovalThresholdsRepo,
  getApproversForThreshold as getApproversForThresholdRepo,
  createDelegation as createDelegationRepo,
  getActiveDelegation as getActiveDelegationRepo,
  getDelegationsForDelegate as getDelegationsForDelegateRepo,
  deactivateDelegation as deactivateDelegationRepo,
  getPendingApprovalsForUser as getPendingApprovalsForUserRepo,
  getPendingApprovalsForReminder,
  recordApproval as recordApprovalRepo,
  getApprovalHistory as getApprovalHistoryRepo,
} from './approval-repository';
