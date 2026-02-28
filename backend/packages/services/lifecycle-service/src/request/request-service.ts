/**
 * Request Service - Business logic layer for request management
 *
 * Implements:
 * - Request submission (Requirement 6.1)
 * - Capture requester, items, quantities, justification (Requirement 6B.3)
 * - Request status tracking and notifications (Requirement 6B.8)
 * - Initiate approval workflow on submission (Requirement 6.1)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  CreateRequestInput,
  CreateRequestLineInput,
  Request,
  RequestLine,
  RequestPriority,
  RequestStatus,
} from './request-repository';
import * as repository from './request-repository';

const logger = createLogger({ service: 'request-service' });

/**
 * Request result with lines
 */
export interface RequestResult {
  readonly request: Request;
  readonly lines: RequestLine[];
}

/**
 * Submit request input
 */
export interface SubmitRequestInput {
  readonly requesterId: UUID;
  readonly requesterName?: string;
  readonly requesterEmail?: string;
  readonly requesterDepartment?: string;
  readonly requestType?: string;
  readonly priority?: RequestPriority;
  readonly justification: string;
  readonly businessNeed?: string;
  readonly deliveryLocation: string;
  readonly deliveryAddress?: string;
  readonly deliveryInstructions?: string;
  readonly requestedDeliveryDate?: string;
  readonly costCenterId?: UUID;
  readonly projectCode?: string;
  readonly notes?: string;
  readonly items: SubmitRequestItemInput[];
}

/**
 * Submit request item input
 */
export interface SubmitRequestItemInput {
  readonly catalogItemId?: UUID;
  readonly productId?: UUID;
  readonly productType?: string;
  readonly productName: string;
  readonly productDescription?: string;
  readonly quantity: number;
  readonly unitPrice?: number;
  readonly justification?: string;
  readonly specifications?: string;
  readonly notes?: string;
}

/**
 * Request status result
 */
export interface RequestStatusResult {
  readonly request: Request;
  readonly lines: RequestLine[];
  readonly statusHistory: RequestStatusHistoryEntry[];
  readonly canCancel: boolean;
  readonly canModify: boolean;
}

/**
 * Request status history entry
 */
export interface RequestStatusHistoryEntry {
  readonly status: RequestStatus;
  readonly timestamp: string;
  readonly changedBy: UUID | null;
  readonly notes: string | null;
}

/**
 * Cache key for request
 */
function requestCacheKey(requestId: UUID): string {
  return `request:${requestId}`;
}

/**
 * Cache key for requester requests
 */
function requesterRequestsCacheKey(requesterId: UUID): string {
  return `requester:${requesterId}:requests`;
}

/**
 * Valid status transitions (exported for use in approval workflow service)
 */
export const VALID_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED', 'ON_HOLD'],
  APPROVED: ['PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED'],
  REJECTED: [], // Terminal state
  PARTIALLY_FULFILLED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [], // Terminal state
  CANCELLED: [], // Terminal state
  ON_HOLD: ['PENDING_APPROVAL', 'CANCELLED'],
};

/**
 * Statuses that allow cancellation
 */
const CANCELLABLE_STATUSES: RequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'ON_HOLD',
];

/**
 * Statuses that allow modification
 */
const MODIFIABLE_STATUSES: RequestStatus[] = ['DRAFT'];

/**
 * Submit a new request
 * Requirement 6.1: Create a request record and initiate approval workflow
 * Requirement 6B.3: Capture requester, items, quantities, justification
 */
export async function submitRequest(input: SubmitRequestInput): Promise<RequestResult> {
  logger.info('Submitting request', {
    requesterId: input.requesterId,
    itemCount: input.items.length,
    priority: input.priority,
  });

  // Validate input
  if (!input.items || input.items.length === 0) {
    throw new Error('Request must have at least one item');
  }

  if (!input.justification || input.justification.trim().length === 0) {
    throw new Error('Justification is required');
  }

  if (!input.deliveryLocation || input.deliveryLocation.trim().length === 0) {
    throw new Error('Delivery location is required');
  }

  // Validate each item
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i]!;
    if (!item.productName || item.productName.trim().length === 0) {
      throw new Error(`Item ${i + 1}: Product name is required`);
    }
    if (item.quantity <= 0) {
      throw new Error(`Item ${i + 1}: Quantity must be greater than 0`);
    }
    if (!Number.isInteger(item.quantity)) {
      throw new Error(`Item ${i + 1}: Quantity must be an integer`);
    }
  }

  // Convert items to request lines
  const lines: CreateRequestLineInput[] = input.items.map((item) => ({
    catalogItemId: item.catalogItemId,
    productId: item.productId,
    productType: item.productType,
    productName: item.productName,
    productDescription: item.productDescription,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    justification: item.justification,
    specifications: item.specifications,
    notes: item.notes,
  }));

  // Create the request
  const createInput: CreateRequestInput = {
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    requesterEmail: input.requesterEmail,
    requesterDepartment: input.requesterDepartment,
    requestType: input.requestType,
    priority: input.priority,
    justification: input.justification,
    businessNeed: input.businessNeed,
    deliveryLocation: input.deliveryLocation,
    deliveryAddress: input.deliveryAddress,
    deliveryInstructions: input.deliveryInstructions,
    requestedDeliveryDate: input.requestedDeliveryDate,
    costCenterId: input.costCenterId,
    projectCode: input.projectCode,
    notes: input.notes,
    lines,
  };

  const result = await repository.createRequest(createInput);

  const timestamp = now();

  // Update status to SUBMITTED
  const submittedRequest = await repository.updateRequestStatus(
    result.request.requestId,
    'SUBMITTED',
    {
      submittedDate: timestamp,
      updatedBy: input.requesterId,
    }
  );

  if (!submittedRequest) {
    throw new Error('Failed to submit request');
  }

  // Initiate approval workflow
  // Requirement 6.1: Initiate approval workflow on submission
  const workflowResult = await initiateApprovalWorkflow(submittedRequest);

  // Invalidate cache
  await cache.del(requesterRequestsCacheKey(input.requesterId));

  // Publish request submitted event
  await publishEvent('REQUEST_SUBMITTED', {
    requestId: workflowResult.requestId,
    requestNumber: workflowResult.requestNumber,
    requesterId: workflowResult.requesterId,
    requesterName: workflowResult.requesterName,
    status: workflowResult.status,
    priority: workflowResult.priority,
    totalQuantity: workflowResult.totalQuantity,
    estimatedCost: workflowResult.estimatedCost,
    itemCount: result.lines.length,
    deliveryLocation: workflowResult.deliveryLocation,
    approvalWorkflowId: workflowResult.approvalWorkflowId,
    currentApproverId: workflowResult.currentApproverId,
  });

  logger.info('Request submitted', {
    requestId: workflowResult.requestId,
    requestNumber: workflowResult.requestNumber,
    status: workflowResult.status,
    approvalWorkflowId: workflowResult.approvalWorkflowId,
  });

  return { request: workflowResult, lines: result.lines };
}

/**
 * Initiate approval workflow for a request
 * Requirement 6.1: Initiate approval workflow on submission
 */
async function initiateApprovalWorkflow(request: Request): Promise<Request> {
  logger.info('Initiating approval workflow', {
    requestId: request.requestId,
    requestNumber: request.requestNumber,
    estimatedCost: request.estimatedCost,
  });

  // Generate a workflow ID (in a real system, this would create a workflow record)
  const workflowId = `WF-${Date.now().toString(36).toUpperCase()}`;

  // Determine initial approver based on request attributes
  // In a real system, this would use configurable routing rules
  // For now, we'll set the status to PENDING_APPROVAL

  const updatedRequest = await repository.updateRequestStatus(
    request.requestId,
    'PENDING_APPROVAL',
    {
      approvalWorkflowId: workflowId,
      approvalLevel: 1,
      updatedBy: request.requesterId,
    }
  );

  if (!updatedRequest) {
    throw new Error('Failed to initiate approval workflow');
  }

  // Publish workflow initiated event
  await publishEvent('APPROVAL_WORKFLOW_INITIATED', {
    requestId: updatedRequest.requestId,
    requestNumber: updatedRequest.requestNumber,
    workflowId,
    requesterId: updatedRequest.requesterId,
    estimatedCost: updatedRequest.estimatedCost,
    priority: updatedRequest.priority,
  });

  logger.info('Approval workflow initiated', {
    requestId: updatedRequest.requestId,
    workflowId,
    approvalLevel: updatedRequest.approvalLevel,
  });

  return updatedRequest;
}

/**
 * Get request status with full details
 * Requirement 6B.8: Request status tracking and notifications
 */
export async function getRequestStatus(requestId: UUID): Promise<RequestStatusResult | null> {
  logger.info('Getting request status', { requestId });

  // Get request
  const request = await repository.getRequestById(requestId);
  if (!request) {
    return null;
  }

  // Get request lines
  const lines = await repository.getRequestLines(requestId);

  // Build status history from request timestamps
  const statusHistory = buildStatusHistory(request);

  // Determine if request can be cancelled or modified
  const canCancel = CANCELLABLE_STATUSES.includes(request.status);
  const canModify = MODIFIABLE_STATUSES.includes(request.status);

  return {
    request,
    lines,
    statusHistory,
    canCancel,
    canModify,
  };
}

/**
 * Build status history from request timestamps
 */
function buildStatusHistory(request: Request): RequestStatusHistoryEntry[] {
  const history: RequestStatusHistoryEntry[] = [];

  // Created (DRAFT)
  history.push({
    status: 'DRAFT',
    timestamp: request.createdAt,
    changedBy: request.createdBy,
    notes: 'Request created',
  });

  // Submitted
  if (request.submittedDate) {
    history.push({
      status: 'SUBMITTED',
      timestamp: request.submittedDate,
      changedBy: request.requesterId,
      notes: 'Request submitted for approval',
    });
  }

  // Pending Approval (if workflow initiated)
  if (request.approvalWorkflowId && request.submittedDate) {
    history.push({
      status: 'PENDING_APPROVAL',
      timestamp: request.submittedDate,
      changedBy: null,
      notes: 'Approval workflow initiated',
    });
  }

  // Approved
  if (request.approvedDate) {
    history.push({
      status: 'APPROVED',
      timestamp: request.approvedDate,
      changedBy: request.approvedBy,
      notes: 'Request approved',
    });
  }

  // Rejected
  if (request.rejectedDate) {
    history.push({
      status: 'REJECTED',
      timestamp: request.rejectedDate,
      changedBy: request.rejectedBy,
      notes: request.rejectionReason ?? 'Request rejected',
    });
  }

  // Fulfilled
  if (request.fulfilledDate) {
    history.push({
      status: 'FULFILLED',
      timestamp: request.fulfilledDate,
      changedBy: null,
      notes: 'Request fulfilled',
    });
  }

  // Cancelled
  if (request.cancelledDate) {
    history.push({
      status: 'CANCELLED',
      timestamp: request.cancelledDate,
      changedBy: null,
      notes: request.cancellationReason ?? 'Request cancelled',
    });
  }

  // Sort by timestamp
  history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return history;
}

/**
 * Get request by ID with lines
 */
export async function getRequest(requestId: UUID): Promise<RequestResult | null> {
  const request = await repository.getRequestById(requestId);
  if (!request) {
    return null;
  }

  const lines = await repository.getRequestLines(requestId);
  return { request, lines };
}

/**
 * Get request by request number
 */
export async function getRequestByNumber(requestNumber: string): Promise<RequestResult | null> {
  const request = await repository.getRequestByNumber(requestNumber);
  if (!request) {
    return null;
  }

  const lines = await repository.getRequestLines(request.requestId);
  return { request, lines };
}

/**
 * Get requests for a requester
 * Requirement 6B.8: Request status tracking
 */
export async function getRequesterRequests(
  requesterId: UUID,
  pagination: PaginationParams = {},
  statusFilter?: RequestStatus[]
): Promise<PaginatedResult<Request>> {
  return repository.getRequestsByRequester(requesterId, pagination, statusFilter);
}

/**
 * Cancel a request
 */
export async function cancelRequest(
  requestId: UUID,
  cancelledBy: UUID,
  reason?: string
): Promise<Request> {
  logger.info('Cancelling request', { requestId, cancelledBy });

  // Get the request
  const request = await repository.getRequestById(requestId);
  if (!request) {
    throw new Error(`Request not found: ${requestId}`);
  }

  // Validate status allows cancellation
  if (!CANCELLABLE_STATUSES.includes(request.status)) {
    throw new Error(`Cannot cancel request in status: ${request.status}`);
  }

  const timestamp = now();

  // Update request status to cancelled
  const updatedRequest = await repository.updateRequestStatus(requestId, 'CANCELLED', {
    cancelledDate: timestamp,
    cancellationReason: reason,
    updatedBy: cancelledBy,
  });

  if (!updatedRequest) {
    throw new Error(`Failed to cancel request: ${requestId}`);
  }

  // Update all pending lines to cancelled
  const lines = await repository.getRequestLines(requestId);
  for (const line of lines) {
    if (line.status === 'PENDING' || line.status === 'APPROVED') {
      await repository.updateRequestLineStatus(line.lineId, {
        status: 'CANCELLED',
      });
    }
  }

  // Invalidate cache
  await cache.del(requestCacheKey(requestId));
  await cache.del(requesterRequestsCacheKey(request.requesterId));

  // Publish cancellation event
  await publishEvent('REQUEST_CANCELLED', {
    requestId: updatedRequest.requestId,
    requestNumber: updatedRequest.requestNumber,
    requesterId: updatedRequest.requesterId,
    cancelledBy,
    cancellationReason: reason,
    previousStatus: request.status,
  });

  logger.info('Request cancelled', {
    requestId: updatedRequest.requestId,
    requestNumber: updatedRequest.requestNumber,
    cancelledBy,
    reason,
  });

  return updatedRequest;
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovals(
  approverId?: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Request>> {
  return repository.getPendingApprovalRequests(approverId, pagination);
}

// Re-export types
export type {
  CreateRequestInput,
  CreateRequestLineInput,
  Request,
  RequestLine,
  RequestLineStatus,
  RequestPriority,
  RequestStatus,
} from './request-repository';
