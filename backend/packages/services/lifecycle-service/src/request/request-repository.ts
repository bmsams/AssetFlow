/**
 * Request Repository - Data access layer for request operations
 *
 * Implements database operations for:
 * - Request creation and management (Requirement 6.1)
 * - Request line items (Requirement 6B.3)
 * - Request status tracking (Requirement 6B.8)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'request-repository' });

/**
 * Request status
 */
export type RequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PARTIALLY_FULFILLED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'ON_HOLD';

/**
 * Request priority
 */
export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

/**
 * Request line status
 */
export type RequestLineStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ORDERED'
  | 'RESERVED'
  | 'FULFILLED'
  | 'CANCELLED';

/**
 * Request entity
 */
export interface Request {
  readonly requestId: UUID;
  readonly requestNumber: string;
  readonly requesterId: UUID;
  readonly requesterName: string | null;
  readonly requesterEmail: string | null;
  readonly requesterDepartment: string | null;
  readonly status: RequestStatus;
  readonly priority: RequestPriority;
  readonly requestType: string;
  readonly justification: string | null;
  readonly businessNeed: string | null;
  readonly deliveryLocation: string | null;
  readonly deliveryAddress: string | null;
  readonly deliveryInstructions: string | null;
  readonly requestedDeliveryDate: string | null;
  readonly costCenterId: UUID | null;
  readonly projectCode: string | null;
  readonly approvalWorkflowId: UUID | null;
  readonly currentApproverId: UUID | null;
  readonly approvalLevel: number;
  readonly submittedDate: string | null;
  readonly approvedDate: string | null;
  readonly approvedBy: UUID | null;
  readonly rejectedDate: string | null;
  readonly rejectedBy: UUID | null;
  readonly rejectionReason: string | null;
  readonly fulfilledDate: string | null;
  readonly cancelledDate: string | null;
  readonly cancellationReason: string | null;
  readonly totalLineCount: number;
  readonly totalQuantity: number;
  readonly fulfilledQuantity: number;
  readonly estimatedCost: number | null;
  readonly actualCost: number | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Request line entity
 */
export interface RequestLine {
  readonly lineId: UUID;
  readonly requestId: UUID;
  readonly lineNumber: number;
  readonly catalogItemId: UUID | null;
  readonly productId: UUID | null;
  readonly productType: string | null;
  readonly productName: string | null;
  readonly productDescription: string | null;
  readonly quantity: number;
  readonly fulfilledQuantity: number;
  readonly unitPrice: number | null;
  readonly totalPrice: number | null;
  readonly status: RequestLineStatus;
  readonly justification: string | null;
  readonly specifications: string | null;
  readonly assetIdsAssigned: string[] | null;
  readonly purchaseOrderId: UUID | null;
  readonly purchaseOrderLineId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create request input
 */
export interface CreateRequestInput {
  readonly requesterId: UUID;
  readonly requesterName?: string;
  readonly requesterEmail?: string;
  readonly requesterDepartment?: string;
  readonly requestType?: string;
  readonly priority?: RequestPriority;
  readonly justification?: string;
  readonly businessNeed?: string;
  readonly deliveryLocation?: string;
  readonly deliveryAddress?: string;
  readonly deliveryInstructions?: string;
  readonly requestedDeliveryDate?: string;
  readonly costCenterId?: UUID;
  readonly projectCode?: string;
  readonly notes?: string;
  readonly lines: CreateRequestLineInput[];
}

/**
 * Create request line input
 */
export interface CreateRequestLineInput {
  readonly catalogItemId?: UUID;
  readonly productId?: UUID;
  readonly productType?: string;
  readonly productName?: string;
  readonly productDescription?: string;
  readonly quantity: number;
  readonly unitPrice?: number;
  readonly justification?: string;
  readonly specifications?: string;
  readonly notes?: string;
}

/**
 * Database row types
 */
interface RequestRow {
  request_id: string;
  request_number: string;
  requester_id: string;
  requester_name: string | null;
  requester_email: string | null;
  requester_department: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  request_type: string;
  justification: string | null;
  business_need: string | null;
  delivery_location: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  requested_delivery_date: string | null;
  cost_center_id: string | null;
  project_code: string | null;
  approval_workflow_id: string | null;
  current_approver_id: string | null;
  approval_level: number;
  submitted_date: string | null;
  approved_date: string | null;
  approved_by: string | null;
  rejected_date: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  fulfilled_date: string | null;
  cancelled_date: string | null;
  cancellation_reason: string | null;
  total_line_count: number;
  total_quantity: number;
  fulfilled_quantity: number;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface RequestLineRow {
  line_id: string;
  request_id: string;
  line_number: number;
  catalog_item_id: string | null;
  product_id: string | null;
  product_type: string | null;
  product_name: string | null;
  product_description: string | null;
  quantity: number;
  fulfilled_quantity: number;
  unit_price: number | null;
  total_price: number | null;
  status: RequestLineStatus;
  justification: string | null;
  specifications: string | null;
  asset_ids_assigned: string[] | null;
  purchase_order_id: string | null;
  purchase_order_line_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to Request entity
 */
function mapRowToRequest(row: RequestRow): Request {
  return {
    requestId: row.request_id,
    requestNumber: row.request_number,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    requesterDepartment: row.requester_department,
    status: row.status,
    priority: row.priority,
    requestType: row.request_type,
    justification: row.justification,
    businessNeed: row.business_need,
    deliveryLocation: row.delivery_location,
    deliveryAddress: row.delivery_address,
    deliveryInstructions: row.delivery_instructions,
    requestedDeliveryDate: row.requested_delivery_date,
    costCenterId: row.cost_center_id,
    projectCode: row.project_code,
    approvalWorkflowId: row.approval_workflow_id,
    currentApproverId: row.current_approver_id,
    approvalLevel: row.approval_level,
    submittedDate: row.submitted_date,
    approvedDate: row.approved_date,
    approvedBy: row.approved_by,
    rejectedDate: row.rejected_date,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    fulfilledDate: row.fulfilled_date,
    cancelledDate: row.cancelled_date,
    cancellationReason: row.cancellation_reason,
    totalLineCount: row.total_line_count,
    totalQuantity: row.total_quantity,
    fulfilledQuantity: row.fulfilled_quantity,
    estimatedCost: row.estimated_cost,
    actualCost: row.actual_cost,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Map database row to RequestLine entity
 */
function mapRowToRequestLine(row: RequestLineRow): RequestLine {
  return {
    lineId: row.line_id,
    requestId: row.request_id,
    lineNumber: row.line_number,
    catalogItemId: row.catalog_item_id,
    productId: row.product_id,
    productType: row.product_type,
    productName: row.product_name,
    productDescription: row.product_description,
    quantity: row.quantity,
    fulfilledQuantity: row.fulfilled_quantity,
    unitPrice: row.unit_price,
    totalPrice: row.total_price,
    status: row.status,
    justification: row.justification,
    specifications: row.specifications,
    assetIdsAssigned: row.asset_ids_assigned,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderLineId: row.purchase_order_line_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Generate a unique request number
 */
function generateRequestNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REQ-${timestamp}-${random}`;
}

/**
 * Get request by ID
 */
export async function getRequestById(requestId: UUID): Promise<Request | null> {
  const result = await queryOne<RequestRow>(
    'SELECT * FROM requests WHERE request_id = $1',
    [requestId]
  );

  return result ? mapRowToRequest(result) : null;
}

/**
 * Get request by request number
 */
export async function getRequestByNumber(requestNumber: string): Promise<Request | null> {
  const result = await queryOne<RequestRow>(
    'SELECT * FROM requests WHERE request_number = $1',
    [requestNumber]
  );

  return result ? mapRowToRequest(result) : null;
}

/**
 * Get request lines
 */
export async function getRequestLines(requestId: UUID): Promise<RequestLine[]> {
  const rows = await queryMany<RequestLineRow>(
    'SELECT * FROM request_lines WHERE request_id = $1 ORDER BY line_number ASC',
    [requestId]
  );

  return rows.map(mapRowToRequestLine);
}

/**
 * Get request line by ID
 */
export async function getRequestLineById(lineId: UUID): Promise<RequestLine | null> {
  const result = await queryOne<RequestLineRow>(
    'SELECT * FROM request_lines WHERE line_id = $1',
    [lineId]
  );

  return result ? mapRowToRequestLine(result) : null;
}

/**
 * Create a new request with lines
 * Requirement 6.1: Create a request record
 * Requirement 6B.3: Capture requester, items, quantities, justification
 */
export async function createRequest(
  input: CreateRequestInput
): Promise<{ request: Request; lines: RequestLine[] }> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const requestNumber = generateRequestNumber();

    // Calculate totals
    const totalLineCount = input.lines.length;
    const totalQuantity = input.lines.reduce((sum, line) => sum + line.quantity, 0);
    const estimatedCost = input.lines.reduce((sum, line) => {
      const lineTotal = (line.unitPrice ?? 0) * line.quantity;
      return sum + lineTotal;
    }, 0);

    // Create request
    const requestResult = await ctx.queryOne<RequestRow>(
      `INSERT INTO requests (
        request_number, requester_id, requester_name, requester_email, requester_department,
        status, priority, request_type, justification, business_need,
        delivery_location, delivery_address, delivery_instructions, requested_delivery_date,
        cost_center_id, project_code, approval_level,
        total_line_count, total_quantity, fulfilled_quantity, estimated_cost,
        notes, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0, $16, $17, 0, $18, $19, $20, $20, $2)
      RETURNING *`,
      [
        requestNumber,
        input.requesterId,
        input.requesterName ?? null,
        input.requesterEmail ?? null,
        input.requesterDepartment ?? null,
        input.priority ?? 'NORMAL',
        input.requestType ?? 'STANDARD',
        input.justification ?? null,
        input.businessNeed ?? null,
        input.deliveryLocation ?? null,
        input.deliveryAddress ?? null,
        input.deliveryInstructions ?? null,
        input.requestedDeliveryDate ?? null,
        input.costCenterId ?? null,
        input.projectCode ?? null,
        totalLineCount,
        totalQuantity,
        estimatedCost > 0 ? estimatedCost : null,
        input.notes ?? null,
        timestamp,
      ]
    );

    if (!requestResult) {
      throw new Error('Failed to create request');
    }

    const request = mapRowToRequest(requestResult);

    // Create request lines
    const lines: RequestLine[] = [];
    for (let i = 0; i < input.lines.length; i++) {
      const lineInput = input.lines[i]!;
      const lineNumber = i + 1;
      const totalPrice = lineInput.unitPrice ? lineInput.unitPrice * lineInput.quantity : null;

      const lineResult = await ctx.queryOne<RequestLineRow>(
        `INSERT INTO request_lines (
          request_id, line_number, catalog_item_id, product_id, product_type,
          product_name, product_description, quantity, fulfilled_quantity,
          unit_price, total_price, status, justification, specifications, notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, 'PENDING', $11, $12, $13, $14, $14)
        RETURNING *`,
        [
          request.requestId,
          lineNumber,
          lineInput.catalogItemId ?? null,
          lineInput.productId ?? null,
          lineInput.productType ?? null,
          lineInput.productName ?? null,
          lineInput.productDescription ?? null,
          lineInput.quantity,
          lineInput.unitPrice ?? null,
          totalPrice,
          lineInput.justification ?? null,
          lineInput.specifications ?? null,
          lineInput.notes ?? null,
          timestamp,
        ]
      );

      if (lineResult) {
        lines.push(mapRowToRequestLine(lineResult));
      }
    }

    logger.info('Request created', {
      requestId: request.requestId,
      requestNumber,
      requesterId: input.requesterId,
      lineCount: lines.length,
    });

    return { request, lines };
  });
}

/**
 * Update request status
 */
export async function updateRequestStatus(
  requestId: UUID,
  status: RequestStatus,
  additionalFields?: Partial<{
    approvalWorkflowId: UUID;
    currentApproverId: UUID;
    approvalLevel: number;
    submittedDate: string;
    approvedDate: string;
    approvedBy: UUID;
    rejectedDate: string;
    rejectedBy: UUID;
    rejectionReason: string;
    fulfilledDate: string;
    fulfilledQuantity: number;
    cancelledDate: string;
    cancellationReason: string;
    actualCost: number;
    updatedBy: UUID;
    notes: string;
  }>
): Promise<Request | null> {
  const timestamp = now();

  const result = await queryOne<RequestRow>(
    `UPDATE requests SET
      status = $1,
      approval_workflow_id = COALESCE($2, approval_workflow_id),
      current_approver_id = COALESCE($3, current_approver_id),
      approval_level = COALESCE($4, approval_level),
      submitted_date = COALESCE($5, submitted_date),
      approved_date = COALESCE($6, approved_date),
      approved_by = COALESCE($7, approved_by),
      rejected_date = COALESCE($8, rejected_date),
      rejected_by = COALESCE($9, rejected_by),
      rejection_reason = COALESCE($10, rejection_reason),
      fulfilled_date = COALESCE($11, fulfilled_date),
      fulfilled_quantity = COALESCE($12, fulfilled_quantity),
      cancelled_date = COALESCE($13, cancelled_date),
      cancellation_reason = COALESCE($14, cancellation_reason),
      actual_cost = COALESCE($15, actual_cost),
      updated_by = COALESCE($16, updated_by),
      notes = COALESCE($17, notes),
      updated_at = $18
     WHERE request_id = $19
     RETURNING *`,
    [
      status,
      additionalFields?.approvalWorkflowId ?? null,
      additionalFields?.currentApproverId ?? null,
      additionalFields?.approvalLevel ?? null,
      additionalFields?.submittedDate ?? null,
      additionalFields?.approvedDate ?? null,
      additionalFields?.approvedBy ?? null,
      additionalFields?.rejectedDate ?? null,
      additionalFields?.rejectedBy ?? null,
      additionalFields?.rejectionReason ?? null,
      additionalFields?.fulfilledDate ?? null,
      additionalFields?.fulfilledQuantity ?? null,
      additionalFields?.cancelledDate ?? null,
      additionalFields?.cancellationReason ?? null,
      additionalFields?.actualCost ?? null,
      additionalFields?.updatedBy ?? null,
      additionalFields?.notes ?? null,
      timestamp,
      requestId,
    ]
  );

  if (result) {
    logger.info('Request status updated', {
      requestId,
      status,
    });
  }

  return result ? mapRowToRequest(result) : null;
}

/**
 * Update request line status
 */
export async function updateRequestLineStatus(
  lineId: UUID,
  updates: Partial<{
    status: RequestLineStatus;
    fulfilledQuantity: number;
    assetIdsAssigned: string[];
    purchaseOrderId: UUID;
    purchaseOrderLineId: UUID;
    notes: string;
  }>
): Promise<RequestLine | null> {
  const timestamp = now();

  const result = await queryOne<RequestLineRow>(
    `UPDATE request_lines SET
      status = COALESCE($1, status),
      fulfilled_quantity = COALESCE($2, fulfilled_quantity),
      asset_ids_assigned = COALESCE($3, asset_ids_assigned),
      purchase_order_id = COALESCE($4, purchase_order_id),
      purchase_order_line_id = COALESCE($5, purchase_order_line_id),
      notes = COALESCE($6, notes),
      updated_at = $7
     WHERE line_id = $8
     RETURNING *`,
    [
      updates.status ?? null,
      updates.fulfilledQuantity ?? null,
      updates.assetIdsAssigned ?? null,
      updates.purchaseOrderId ?? null,
      updates.purchaseOrderLineId ?? null,
      updates.notes ?? null,
      timestamp,
      lineId,
    ]
  );

  return result ? mapRowToRequestLine(result) : null;
}

/**
 * Get requests by requester
 * Requirement 6B.8: Request status tracking
 */
export async function getRequestsByRequester(
  requesterId: UUID,
  pagination: PaginationParams = {},
  statusFilter?: RequestStatus[]
): Promise<PaginatedResult<Request>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE requester_id = $1';
  const params: (string | number)[] = [requesterId];
  let paramIndex = 2;

  if (statusFilter && statusFilter.length > 0) {
    const statusPlaceholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND status IN (${statusPlaceholders})`;
    params.push(...statusFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM requests ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<RequestRow>(
    `SELECT * FROM requests ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToRequest),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get pending approval requests
 */
export async function getPendingApprovalRequests(
  approverId?: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Request>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = `WHERE status = 'PENDING_APPROVAL'`;
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (approverId) {
    whereClause += ` AND current_approver_id = $${paramIndex++}`;
    params.push(approverId);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM requests ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<RequestRow>(
    `SELECT * FROM requests ${whereClause}
     ORDER BY 
       CASE priority 
         WHEN 'CRITICAL' THEN 1 
         WHEN 'URGENT' THEN 2 
         WHEN 'HIGH' THEN 3 
         WHEN 'NORMAL' THEN 4 
         WHEN 'LOW' THEN 5 
       END,
       submitted_date ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToRequest),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
