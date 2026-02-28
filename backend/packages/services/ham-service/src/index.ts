/**
 * @ams/ham-service - Hardware Asset Management Service
 *
 * Provides hardware-specific asset management operations including:
 * - Normalization Engine for standardizing discovery data (Requirement 3.1)
 * - Stockroom management (Requirement 3.2, 3.3)
 * - Mobile auditing (Requirement 3.4, 3.5)
 * - Loaner management (Requirement 3.8, 3.9)
 * - Disposal workflows (Requirement 3.6, 3.7)
 * - Transfer orders (Requirement 3.10)
 */

// Export normalization module
export * from './normalization';

// Export stockroom module
export * from './stockroom';

// Export audit module (AssetCondition comes from here)
export * from './audit';

// Export loaner module (excluding AssetCondition to avoid conflict)
export {
  calculateOverdueDays,
  checkoutLoaner,
  extendDueDate,
  getActiveCheckoutForAsset,
  getCheckout,
  getCheckoutByNumber,
  getCheckoutHistoryForAsset,
  getCheckoutsByUser,
  getEscalationLevel,
  getOverdueLoans,
  isAssetAvailable,
  processOverdueNotifications,
  returnLoaner,
  shouldSendEscalationNotification,
  ESCALATION_THRESHOLDS,
} from './loaner';

export type {
  CheckoutResult,
  CreateLoanerCheckoutRequest,
  EscalationLevel,
  LoanerCheckout,
  LoanerStatus,
  OverdueLoanerInfo,
  OverdueLoansResult,
  OverdueNotification,
  ReturnLoanerRequest,
  ReturnResult,
} from './loaner';

// Export disposal module (excluding AssetCondition to avoid conflict)
export {
  initiateDisposal,
  recordDestruction,
  completeDataWipe,
  completeEnvironmentalCheck,
  schedulePickup,
  updateTask as updateDisposalTask,
  cancelWorkflow as cancelDisposalWorkflow,
  getDisposalWorkflow,
  getWorkflowByNumber as getDisposalWorkflowByNumber,
  getWorkflow,
  getCertificate,
  getCertificateByAssetId,
  hasActiveWorkflow,
  validateDisposalRequirements,
  getActiveWorkflowForAsset,
} from './disposal';

export type {
  DisposalWorkflow,
  DisposalTask,
  DisposalMethod,
  DisposalTaskType,
  DisposalTaskStatus,
  DisposalWorkflowStatus,
  CreateDisposalWorkflowRequest,
  DestructionCertificate,
} from './disposal';

// Export transfer module (excluding AssetCondition to avoid conflict)
export {
  createTransfer,
  approveTransfer,
  rejectTransfer,
  shipTransfer,
  completeTransfer,
  cancelTransfer,
  getTransfer,
  getTransferByNumber,
  getStockroomTransfers,
  getPendingApprovals as getPendingTransferApprovals,
} from './transfer';

export type {
  TransferOrder,
  TransferOrderLine,
  TransferLineStatus,
  CreateTransferOrderRequest,
  CreateTransferLineRequest,
} from './transfer';
