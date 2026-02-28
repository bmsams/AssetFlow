/**
 * Loaner Module - Exports for loaner asset management
 *
 * Implements:
 * - Loaner checkout and return operations (Requirement 3.8)
 * - Due date tracking and overdue detection (Requirement 3.8)
 * - Escalating notification triggers for overdue items (Requirement 3.9)
 */

// Export service functions
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
} from './loaner-service';

// Export types
export type {
  AssetCondition,
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
} from './loaner-service';
