/**
 * Work Order module exports
 *
 * Provides enhanced work order management for EAM
 * Requirements: 14.1-14.7
 */

// Export types from repository
export type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  WorkOrderPart,
  WorkOrderWithParts,
  AddPartToWorkOrderRequest,
  RecordPartUsageRequest,
  WorkOrderListFilters,
} from './work-order-repository';

// Export service functions (preferred API)
export {
  isValidStateTransition,
  canAssign,
  canComplete,
  getWorkOrder,
  listWorkOrders,
  createWorkOrder,
  assignWorkOrder,
  updateWorkOrderStatus,
  completeWorkOrder,
  getWorkOrderParts,
  addPartToWorkOrder,
  recordPartUsage,
  removePartFromWorkOrder,
} from './work-order-service';

// Export repository functions with 'Repo' suffix for direct data access
export {
  getWorkOrderParts as getWorkOrderPartsRepo,
  addPartToWorkOrder as addPartToWorkOrderRepo,
  recordPartUsage as recordPartUsageRepo,
  removePartFromWorkOrder as removePartFromWorkOrderRepo,
  calculateWorkOrderPartsCost,
  getWorkOrderWithParts,
  listWorkOrders as listWorkOrdersRepo,
} from './work-order-repository';
