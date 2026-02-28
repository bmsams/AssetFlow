/**
 * Request module exports
 */

// Export types from repository
export type {
  RequestStatus,
  RequestPriority,
  RequestLineStatus,
  Request,
  RequestLine,
  CreateRequestInput,
  CreateRequestLineInput,
} from './request-repository';

// Export repository functions (low-level data access)
export {
  getRequestById,
  getRequestLines,
  getRequestLineById,
  createRequest,
  updateRequestStatus,
  updateRequestLineStatus,
  getRequestsByRequester,
  getPendingApprovalRequests,
} from './request-repository';

// Export service functions (business logic)
export {
  submitRequest,
  getRequestStatus,
  getRequest,
  getRequestByNumber,
  getRequesterRequests,
  cancelRequest,
  getPendingApprovals,
  VALID_STATUS_TRANSITIONS,
} from './request-service';

// Export service types
export type {
  RequestResult,
  SubmitRequestInput,
  SubmitRequestItemInput,
  RequestStatusResult,
  RequestStatusHistoryEntry,
} from './request-service';
