/**
 * Transfer Repository - Data access layer for transfer order operations
 *
 * Implements database operations for:
 * - Transfer order creation and management (Requirement 3.10)
 * - Transfer order line items
 * - Approval workflow tracking
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'transfer-repository' });

/**
 * Transfer order status
 */
export type TransferOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

/**
 * Transfer order priority
 */
export type TransferPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | 'CRITICAL';

/**
 * Transfer order line status
 */
export type TransferLineStatus =
  | 'PENDING'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'PARTIALLY_RECEIVED'
  | 'DAMAGED'
  | 'CANCELLED';

/**
 * Asset condition
 */
export type AssetCondition =
  | 'NEW'
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'DAMAGED'
  | 'UNKNOWN';

/**
 * Transfer order entity
 */
export interface TransferOrder {
  readonly transferId: UUID;
  readonly transferNumber: string;
  readonly fromStockroomId: UUID;
  readonly toStockroomId: UUID;
  readonly status: TransferOrderStatus;
  readonly priority: TransferPriority;
  readonly requestedBy: UUID;
  readonly requestedDate: string;
  readonly reason: string | null;
  readonly approvedBy: UUID | null;
  readonly approvedDate: string | null;
  readonly rejectionReason: string | null;
  readonly shippedBy: UUID | null;
  readonly shippedDate: string | null;
  readonly shippingMethod: string | null;
  readonly trackingNumber: string | null;
  readonly carrier: string | null;
  readonly receivedBy: UUID | null;
  readonly receivedDate: string | null;
  readonly receivingNotes: string | null;
  readonly completedDate: string | null;
  readonly cancelledDate: string | null;
  readonly cancellationReason: string | null;
  readonly totalLineCount: number;
  readonly totalQuantity: number;
  readonly shippedQuantity: number;
  readonly receivedQuantity: number;
  readonly fromBuildingId: string | null;
  readonly fromBuildingName: string | null;
  readonly fromBuildingCode: string | null;
  readonly toBuildingId: string | null;
  readonly toBuildingName: string | null;
  readonly toBuildingCode: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Transfer order line entity
 */
export interface TransferOrderLine {
  readonly lineId: UUID;
  readonly transferId: UUID;
  readonly lineNumber: number;
  readonly assetId: UUID | null;
  readonly productId: UUID | null;
  readonly productType: string | null;
  readonly productDescription: string | null;
  readonly serialNumber: string | null;
  readonly assetTag: string | null;
  readonly quantity: number;
  readonly shippedQuantity: number;
  readonly receivedQuantity: number;
  readonly damagedQuantity: number;
  readonly shippedDate: string | null;
  readonly receivedDate: string | null;
  readonly status: TransferLineStatus;
  readonly conditionShipped: AssetCondition | null;
  readonly conditionReceived: AssetCondition | null;
  readonly conditionNotes: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create transfer order request
 */
export interface CreateTransferOrderRequest {
  readonly fromStockroomId: UUID;
  readonly toStockroomId: UUID;
  readonly requestedBy: UUID;
  readonly priority?: TransferPriority;
  readonly reason?: string;
  readonly notes?: string;
  readonly lines: CreateTransferLineRequest[];
}

/**
 * Create transfer line request
 */
export interface CreateTransferLineRequest {
  readonly assetId?: UUID;
  readonly productId?: UUID;
  readonly productType?: string;
  readonly productDescription?: string;
  readonly serialNumber?: string;
  readonly assetTag?: string;
  readonly quantity: number;
  readonly notes?: string;
}

/**
 * Approve transfer request
 */
export interface ApproveTransferRequest {
  readonly approvedBy: UUID;
  readonly notes?: string;
}

/**
 * Reject transfer request
 */
export interface RejectTransferRequest {
  readonly rejectedBy: UUID;
  readonly rejectionReason: string;
}

/**
 * Ship transfer request
 */
export interface ShipTransferRequest {
  readonly shippedBy: UUID;
  readonly shippingMethod?: string;
  readonly trackingNumber?: string;
  readonly carrier?: string;
  readonly notes?: string;
}

/**
 * Complete transfer request
 */
export interface CompleteTransferRequest {
  readonly receivedBy: UUID;
  readonly receivingNotes?: string;
  readonly lineReceipts: LineReceiptRequest[];
}

/**
 * Line receipt request
 */
export interface LineReceiptRequest {
  readonly lineId: UUID;
  readonly receivedQuantity: number;
  readonly damagedQuantity?: number;
  readonly conditionReceived?: AssetCondition;
  readonly conditionNotes?: string;
}

/**
 * Database row types
 */
interface TransferOrderRow {
  transfer_id: string;
  transfer_number: string;
  from_stockroom_id: string;
  to_stockroom_id: string;
  status: TransferOrderStatus;
  priority: TransferPriority;
  requested_by: string;
  requested_date: string;
  reason: string | null;
  approved_by: string | null;
  approved_date: string | null;
  rejection_reason: string | null;
  shipped_by: string | null;
  shipped_date: string | null;
  shipping_method: string | null;
  tracking_number: string | null;
  carrier: string | null;
  received_by: string | null;
  received_date: string | null;
  receiving_notes: string | null;
  completed_date: string | null;
  cancelled_date: string | null;
  cancellation_reason: string | null;
  total_line_count: number;
  total_quantity: number;
  shipped_quantity: number;
  received_quantity: number;
  from_building_id: string | null;
  from_building_name: string | null;
  from_building_code: string | null;
  to_building_id: string | null;
  to_building_name: string | null;
  to_building_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface TransferOrderLineRow {
  line_id: string;
  transfer_id: string;
  line_number: number;
  asset_id: string | null;
  product_id: string | null;
  product_type: string | null;
  product_description: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  quantity: number;
  shipped_quantity: number;
  received_quantity: number;
  damaged_quantity: number;
  shipped_date: string | null;
  received_date: string | null;
  status: TransferLineStatus;
  condition_shipped: AssetCondition | null;
  condition_received: AssetCondition | null;
  condition_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to TransferOrder entity
 */
function mapRowToTransferOrder(row: TransferOrderRow): TransferOrder {
  return {
    transferId: row.transfer_id,
    transferNumber: row.transfer_number,
    fromStockroomId: row.from_stockroom_id,
    toStockroomId: row.to_stockroom_id,
    status: row.status,
    priority: row.priority,
    requestedBy: row.requested_by,
    requestedDate: row.requested_date,
    reason: row.reason,
    approvedBy: row.approved_by,
    approvedDate: row.approved_date,
    rejectionReason: row.rejection_reason,
    shippedBy: row.shipped_by,
    shippedDate: row.shipped_date,
    shippingMethod: row.shipping_method,
    trackingNumber: row.tracking_number,
    carrier: row.carrier,
    receivedBy: row.received_by,
    receivedDate: row.received_date,
    receivingNotes: row.receiving_notes,
    completedDate: row.completed_date,
    cancelledDate: row.cancelled_date,
    cancellationReason: row.cancellation_reason,
    totalLineCount: row.total_line_count,
    totalQuantity: row.total_quantity,
    shippedQuantity: row.shipped_quantity,
    receivedQuantity: row.received_quantity,
    fromBuildingId: row.from_building_id ?? null,
    fromBuildingName: row.from_building_name ?? null,
    fromBuildingCode: row.from_building_code ?? null,
    toBuildingId: row.to_building_id ?? null,
    toBuildingName: row.to_building_name ?? null,
    toBuildingCode: row.to_building_code ?? null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Map database row to TransferOrderLine entity
 */
function mapRowToTransferOrderLine(row: TransferOrderLineRow): TransferOrderLine {
  return {
    lineId: row.line_id,
    transferId: row.transfer_id,
    lineNumber: row.line_number,
    assetId: row.asset_id,
    productId: row.product_id,
    productType: row.product_type,
    productDescription: row.product_description,
    serialNumber: row.serial_number,
    assetTag: row.asset_tag,
    quantity: row.quantity,
    shippedQuantity: row.shipped_quantity,
    receivedQuantity: row.received_quantity,
    damagedQuantity: row.damaged_quantity,
    shippedDate: row.shipped_date,
    receivedDate: row.received_date,
    status: row.status,
    conditionShipped: row.condition_shipped,
    conditionReceived: row.condition_received,
    conditionNotes: row.condition_notes,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function generateTransferNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TRF-${dateStr}-${random}`;
}

export async function listTransfers(
  pagination: PaginationParams = {},
  statusFilter?: TransferOrderStatus[]
): Promise<PaginatedResult<TransferOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => {
      const p = `$${paramIndex}`;
      paramIndex++;
      return p;
    }).join(', ');
    whereClause = `WHERE t.status IN (${placeholders})`;
    params.push(...statusFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM transfer_orders t ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const limitIdx = paramIndex++;
  const offsetIdx = paramIndex++;

  const rows = await queryMany<TransferOrderRow>(
    `SELECT t.*,
       sb.building_id AS from_building_id,
       sb.name AS from_building_name,
       sb.building_code AS from_building_code,
       db.building_id AS to_building_id,
       db.name AS to_building_name,
       db.building_code AS to_building_code
     FROM transfer_orders t
     LEFT JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
     LEFT JOIN buildings sb ON fs.building_id = sb.building_id
     LEFT JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
     LEFT JOIN buildings db ON ts.building_id = db.building_id
     ${whereClause}
     ORDER BY t.requested_date DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToTransferOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

export async function getTransferById(transferId: UUID): Promise<TransferOrder | null> {
  const result = await queryOne<TransferOrderRow>(
    `SELECT t.*,
       sb.building_id AS from_building_id,
       sb.name AS from_building_name,
       sb.building_code AS from_building_code,
       db.building_id AS to_building_id,
       db.name AS to_building_name,
       db.building_code AS to_building_code
     FROM transfer_orders t
     LEFT JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
     LEFT JOIN buildings sb ON fs.building_id = sb.building_id
     LEFT JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
     LEFT JOIN buildings db ON ts.building_id = db.building_id
     WHERE t.transfer_id = $1`,
    [transferId]
  );
  return result ? mapRowToTransferOrder(result) : null;
}

export async function getTransferByNumber(transferNumber: string): Promise<TransferOrder | null> {
  const result = await queryOne<TransferOrderRow>(
    `SELECT t.*,
       sb.building_id AS from_building_id,
       sb.name AS from_building_name,
       sb.building_code AS from_building_code,
       db.building_id AS to_building_id,
       db.name AS to_building_name,
       db.building_code AS to_building_code
     FROM transfer_orders t
     LEFT JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
     LEFT JOIN buildings sb ON fs.building_id = sb.building_id
     LEFT JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
     LEFT JOIN buildings db ON ts.building_id = db.building_id
     WHERE t.transfer_number = $1`,
    [transferNumber]
  );
  return result ? mapRowToTransferOrder(result) : null;
}

export async function getTransferLines(transferId: UUID): Promise<TransferOrderLine[]> {
  const rows = await queryMany<TransferOrderLineRow>(
    'SELECT * FROM transfer_order_lines WHERE transfer_id = $1 ORDER BY line_number ASC',
    [transferId]
  );
  return rows.map(mapRowToTransferOrderLine);
}

export async function getTransferLineById(lineId: UUID): Promise<TransferOrderLine | null> {
  const result = await queryOne<TransferOrderLineRow>(
    'SELECT * FROM transfer_order_lines WHERE line_id = $1',
    [lineId]
  );
  return result ? mapRowToTransferOrderLine(result) : null;
}
export async function createTransfer(
  request: CreateTransferOrderRequest
): Promise<{ transfer: TransferOrder; lines: TransferOrderLine[] }> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const transferNumber = generateTransferNumber();
    const totalLineCount = request.lines.length;
    const totalQuantity = request.lines.reduce(
      (sum: number, line: CreateTransferLineRequest) => sum + line.quantity, 0
    );

    const transferResult = await ctx.queryOne<TransferOrderRow>(
      `INSERT INTO transfer_orders (
        transfer_number, from_stockroom_id, to_stockroom_id, status, priority,
        requested_by, requested_date, reason, notes,
        total_line_count, total_quantity, shipped_quantity, received_quantity,
        created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, 'PENDING_APPROVAL', $4, $5, $6, $7, $8, $9, $10, 0, 0, $6, $6, $5)
      RETURNING *`,
      [
        transferNumber, request.fromStockroomId, request.toStockroomId,
        request.priority ?? 'NORMAL', request.requestedBy, timestamp,
        request.reason ?? null, request.notes ?? null,
        totalLineCount, totalQuantity,
      ]
    );

    if (!transferResult) {
      throw new Error('Failed to create transfer order');
    }

    const transfer = mapRowToTransferOrder(transferResult);
    const lines: TransferOrderLine[] = [];

    for (let i = 0; i < request.lines.length; i++) {
      const lineRequest = request.lines[i]!;
      const lineNumber = i + 1;

      const lineResult = await ctx.queryOne<TransferOrderLineRow>(
        `INSERT INTO transfer_order_lines (
          transfer_id, line_number, asset_id, product_id, product_type,
          product_description, serial_number, asset_tag, quantity,
          shipped_quantity, received_quantity, damaged_quantity, status, notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, 0, 'PENDING', $10, $11, $11)
        RETURNING *`,
        [
          transfer.transferId, lineNumber,
          lineRequest.assetId ?? null, lineRequest.productId ?? null,
          lineRequest.productType ?? null, lineRequest.productDescription ?? null,
          lineRequest.serialNumber ?? null, lineRequest.assetTag ?? null,
          lineRequest.quantity, lineRequest.notes ?? null, timestamp,
        ]
      );

      if (lineResult) {
        lines.push(mapRowToTransferOrderLine(lineResult));
      }
    }

    logger.info('Transfer order created', {
      transferId: transfer.transferId, transferNumber,
      fromStockroomId: request.fromStockroomId,
      toStockroomId: request.toStockroomId,
      lineCount: lines.length,
    });

    return { transfer, lines };
  });
}
export async function updateTransferStatus(
  transferId: UUID,
  status: TransferOrderStatus,
  additionalFields?: Partial<{
    approvedBy: UUID; approvedDate: string; rejectionReason: string;
    shippedBy: UUID; shippedDate: string; shippingMethod: string;
    trackingNumber: string; carrier: string;
    receivedBy: UUID; receivedDate: string; receivingNotes: string;
    completedDate: string; cancelledDate: string; cancellationReason: string;
    shippedQuantity: number; receivedQuantity: number;
    updatedBy: UUID; notes: string;
  }>
): Promise<TransferOrder | null> {
  const timestamp = now();
  const result = await queryOne<TransferOrderRow>(
    `UPDATE transfer_orders SET
      status = $1,
      approved_by = COALESCE($2, approved_by),
      approved_date = COALESCE($3, approved_date),
      rejection_reason = COALESCE($4, rejection_reason),
      shipped_by = COALESCE($5, shipped_by),
      shipped_date = COALESCE($6, shipped_date),
      shipping_method = COALESCE($7, shipping_method),
      tracking_number = COALESCE($8, tracking_number),
      carrier = COALESCE($9, carrier),
      received_by = COALESCE($10, received_by),
      received_date = COALESCE($11, received_date),
      receiving_notes = COALESCE($12, receiving_notes),
      completed_date = COALESCE($13, completed_date),
      cancelled_date = COALESCE($14, cancelled_date),
      cancellation_reason = COALESCE($15, cancellation_reason),
      shipped_quantity = COALESCE($16, shipped_quantity),
      received_quantity = COALESCE($17, received_quantity),
      updated_by = COALESCE($18, updated_by),
      notes = COALESCE($19, notes),
      updated_at = $20
     WHERE transfer_id = $21
     RETURNING *`,
    [
      status,
      additionalFields?.approvedBy ?? null, additionalFields?.approvedDate ?? null,
      additionalFields?.rejectionReason ?? null,
      additionalFields?.shippedBy ?? null, additionalFields?.shippedDate ?? null,
      additionalFields?.shippingMethod ?? null,
      additionalFields?.trackingNumber ?? null, additionalFields?.carrier ?? null,
      additionalFields?.receivedBy ?? null, additionalFields?.receivedDate ?? null,
      additionalFields?.receivingNotes ?? null,
      additionalFields?.completedDate ?? null, additionalFields?.cancelledDate ?? null,
      additionalFields?.cancellationReason ?? null,
      additionalFields?.shippedQuantity ?? null, additionalFields?.receivedQuantity ?? null,
      additionalFields?.updatedBy ?? null, additionalFields?.notes ?? null,
      timestamp, transferId,
    ]
  );

  if (result) {
    logger.info('Transfer order status updated', { transferId, status });
  }
  return result ? mapRowToTransferOrder(result) : null;
}

export async function updateTransferLine(
  lineId: UUID,
  updates: Partial<{
    shippedQuantity: number; receivedQuantity: number; damagedQuantity: number;
    shippedDate: string; receivedDate: string; status: TransferLineStatus;
    conditionShipped: AssetCondition; conditionReceived: AssetCondition;
    conditionNotes: string; notes: string;
  }>
): Promise<TransferOrderLine | null> {
  const timestamp = now();
  const result = await queryOne<TransferOrderLineRow>(
    `UPDATE transfer_order_lines SET
      shipped_quantity = COALESCE($1, shipped_quantity),
      received_quantity = COALESCE($2, received_quantity),
      damaged_quantity = COALESCE($3, damaged_quantity),
      shipped_date = COALESCE($4, shipped_date),
      received_date = COALESCE($5, received_date),
      status = COALESCE($6, status),
      condition_shipped = COALESCE($7, condition_shipped),
      condition_received = COALESCE($8, condition_received),
      condition_notes = COALESCE($9, condition_notes),
      notes = COALESCE($10, notes),
      updated_at = $11
     WHERE line_id = $12
     RETURNING *`,
    [
      updates.shippedQuantity ?? null, updates.receivedQuantity ?? null,
      updates.damagedQuantity ?? null, updates.shippedDate ?? null,
      updates.receivedDate ?? null, updates.status ?? null,
      updates.conditionShipped ?? null, updates.conditionReceived ?? null,
      updates.conditionNotes ?? null, updates.notes ?? null,
      timestamp, lineId,
    ]
  );
  return result ? mapRowToTransferOrderLine(result) : null;
}
export async function getTransfersByStockroom(
  stockroomId: UUID,
  direction: 'from' | 'to' | 'both',
  pagination: PaginationParams = {},
  statusFilter?: TransferOrderStatus[],
  buildingFilter?: { fromBuildingId?: UUID; toBuildingId?: UUID }
): Promise<PaginatedResult<TransferOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause: string;
  const params: (string | number)[] = [stockroomId];
  let paramIndex = 2;

  if (direction === 'from') {
    whereClause = 'WHERE t.from_stockroom_id = $1';
  } else if (direction === 'to') {
    whereClause = 'WHERE t.to_stockroom_id = $1';
  } else {
    whereClause = 'WHERE (t.from_stockroom_id = $1 OR t.to_stockroom_id = $1)';
  }

  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => {
      const p = `$${paramIndex}`;
      paramIndex++;
      return p;
    }).join(', ');
    whereClause += ` AND t.status IN (${placeholders})`;
    params.push(...statusFilter);
  }

  if (buildingFilter?.fromBuildingId) {
    whereClause += ` AND sb.building_id = $${paramIndex}`;
    paramIndex++;
    params.push(buildingFilter.fromBuildingId);
  }

  if (buildingFilter?.toBuildingId) {
    whereClause += ` AND db.building_id = $${paramIndex}`;
    paramIndex++;
    params.push(buildingFilter.toBuildingId);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM transfer_orders t
     LEFT JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
     LEFT JOIN buildings sb ON fs.building_id = sb.building_id
     LEFT JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
     LEFT JOIN buildings db ON ts.building_id = db.building_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const limitIdx = paramIndex++;
  const offsetIdx = paramIndex++;

  const rows = await queryMany<TransferOrderRow>(
    `SELECT t.*,
       sb.building_id AS from_building_id,
       sb.name AS from_building_name,
       sb.building_code AS from_building_code,
       db.building_id AS to_building_id,
       db.name AS to_building_name,
       db.building_code AS to_building_code
     FROM transfer_orders t
     LEFT JOIN stockrooms fs ON t.from_stockroom_id = fs.stockroom_id
     LEFT JOIN buildings sb ON fs.building_id = sb.building_id
     LEFT JOIN stockrooms ts ON t.to_stockroom_id = ts.stockroom_id
     LEFT JOIN buildings db ON ts.building_id = db.building_id
     ${whereClause}
     ORDER BY t.requested_date DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToTransferOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

export async function getPendingApprovalTransfers(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<TransferOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM transfer_orders WHERE status = 'PENDING_APPROVAL'`
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<TransferOrderRow>(
    `SELECT * FROM transfer_orders
     WHERE status = 'PENDING_APPROVAL'
     ORDER BY
       CASE priority
         WHEN 'CRITICAL' THEN 1
         WHEN 'URGENT' THEN 2
         WHEN 'HIGH' THEN 3
         WHEN 'NORMAL' THEN 4
         WHEN 'LOW' THEN 5
       END,
       requested_date ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    items: rows.map(mapRowToTransferOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

export async function checkInventoryAvailability(
  stockroomId: UUID,
  productId: UUID,
  productType: string,
  requiredQuantity: number
): Promise<{ available: boolean; currentQuantity: number; availableQuantity: number }> {
  const result = await queryOne<{
    quantity_on_hand: number;
    quantity_reserved: number;
    quantity_available: number;
  }>(
    `SELECT quantity_on_hand, quantity_reserved, quantity_available
     FROM stockroom_inventory
     WHERE stockroom_id = $1 AND product_id = $2 AND product_type = $3`,
    [stockroomId, productId, productType]
  );

  if (!result) {
    return { available: false, currentQuantity: 0, availableQuantity: 0 };
  }

  return {
    available: result.quantity_available >= requiredQuantity,
    currentQuantity: result.quantity_on_hand,
    availableQuantity: result.quantity_available,
  };
}
