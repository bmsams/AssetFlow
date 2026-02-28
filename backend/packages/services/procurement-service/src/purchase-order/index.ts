/**
 * Purchase Order Module
 *
 * Exports for purchase order CRUD and lifecycle management.
 */

// Export helper functions from repository
export { calculateLineTotal, calculatePOTotals } from './po-repository';

// Export service functions (preferred API)
export {
  canEditPO,
  canSubmitPO,
  canApprovePO,
  canSendPO,
  canClosePO,
  createPurchaseOrder,
  getPurchaseOrder,
  updatePurchaseOrder,
  listPurchaseOrders,
  addLineItem,
  updateLineItem,
  removeLineItem,
  submitForApproval,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  sendToVendor,
  postReceiptAccounting,
  postInvoiceAccounting,
  getCloseGuard,
  closePurchaseOrder,
} from './po-service';

// Export repository functions with 'Repo' suffix for direct data access
export {
  createPurchaseOrder as createPurchaseOrderRepo,
  getPurchaseOrderById,
  getPurchaseOrderWithLines,
  updatePurchaseOrder as updatePurchaseOrderRepo,
  recalculatePOTotals,
  updatePOStatus,
  approvePurchaseOrder as approvePurchaseOrderRepo,
  rejectPurchaseOrder as rejectPurchaseOrderRepo,
  closePurchaseOrder as closePurchaseOrderRepo,
  listPurchaseOrders as listPurchaseOrdersRepo,
  getPOLines,
  addPOLine,
  updatePOLine,
  removePOLine,
  updateLineQuantityReceived,
} from './po-repository';
