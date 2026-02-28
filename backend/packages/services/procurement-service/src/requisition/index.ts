/**
 * Requisition Module
 *
 * Exports for requisition lifecycle and requisition-to-PO conversion.
 */

// Export repository types
export type {
  CreateRequisitionInput,
  CreateRequisitionLineInput,
  Requisition,
  RequisitionLine,
  RequisitionLineStatus,
  RequisitionListFilters,
  RequisitionPoLink,
  RequisitionProductType,
  RequisitionStatus,
  RequisitionWithLines,
} from './requisition-repository';

// Export service API
export {
  createRequisition,
  getRequisition,
  listRequisitions,
  submitRequisition,
  approveRequisition,
  rejectRequisition,
  convertRequisitionToPOs,
  getRequisitionLinks,
} from './requisition-service';

// Export repository with explicit suffix where direct access is needed
export {
  createRequisition as createRequisitionRepo,
  getRequisitionById,
  getRequisitionLines,
  getRequisitionWithLines,
  listRequisitions as listRequisitionsRepo,
  updateRequisitionStatus,
  updateRequisitionLineStatus,
  createRequisitionApprovalRecord,
  createRequisitionPoLinks,
  getRequisitionPoLinks,
} from './requisition-repository';
