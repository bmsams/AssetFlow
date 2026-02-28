/**
 * Purchase Order Repository
 *
 * Data access layer for purchase order management.
 * Handles CRUD operations for purchase orders and line items.
 *
 * Requirements: 16.1-16.12
 */

import type {
  CreatePOLineRequest,
  CreatePurchaseOrderRequest,
  PaginatedResult,
  PaginationParams,
  POLine,
  POListFilters,
  POStatus,
  PurchaseOrder,
  PurchaseOrderWithLines,
  UpdatePOLineRequest,
  UpdatePurchaseOrderRequest,
  UUID,
} from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import type { QueryResultRow } from 'pg';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'po-repository' });
let poLineVendorColumnsSupported: boolean | null = null;
let poRejectedStatusSupported: boolean | null = null;
let poClosedStatusSupported: boolean | null = null;

type QueryOneExecutor = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  values?: unknown[]
) => Promise<T | null>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve an authenticated identity value to users.user_id.
 * Accepts either an internal user_id or a Cognito sub.
 */
async function resolveDbUserId(
  userRef?: UUID,
  queryOneFn: QueryOneExecutor = queryOne
): Promise<UUID | null> {
  if (!userRef) {
    return null;
  }

  const result = await queryOneFn<{ userId: UUID }>(
    `SELECT user_id as "userId"
     FROM users
     WHERE user_id::text = $1 OR cognito_sub = $1
     LIMIT 1`,
    [userRef]
  );

  return result?.userId ?? null;
}

/**
 * Generate a unique PO number from database sequence-backed function.
 */
async function generatePONumber(queryOneFn: QueryOneExecutor = queryOne): Promise<string> {
  const result = await queryOneFn<{ poNumber: string }>(
    `SELECT generate_po_number() as "poNumber"`
  );

  if (!result?.poNumber) {
    throw new Error('Failed to generate purchase order number');
  }

  return result.poNumber;
}

/**
 * Calculate line total
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

/**
 * Calculate PO totals from lines
 */
export function calculatePOTotals(
  lines: Array<{ quantity: number; unitPrice: number }>,
  taxAmount: number = 0,
  shippingAmount: number = 0
): { subtotal: number; totalAmount: number } {
  const subtotal = lines.reduce((sum, line) => {
    return sum + calculateLineTotal(line.quantity, line.unitPrice);
  }, 0);

  const totalAmount = Math.round((subtotal + taxAmount + shippingAmount) * 100) / 100;

  return { subtotal: Math.round(subtotal * 100) / 100, totalAmount };
}

/**
 * Determine whether line-level vendor columns are available on purchase_order_lines.
 */
async function hasPOLineVendorColumns(): Promise<boolean> {
  if (poLineVendorColumnsSupported !== null) {
    return poLineVendorColumnsSupported;
  }

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'purchase_order_lines'
       AND column_name IN ('vendor_id', 'vendor_name')`
  );

  poLineVendorColumnsSupported = Number(result?.count ?? '0') === 2;
  return poLineVendorColumnsSupported;
}

/**
 * Determine whether purchase_orders.valid_po_status allows REJECTED.
 * Some environments still run an older constraint that only allows CANCELLED.
 */
async function getRejectedPOStatus(): Promise<'REJECTED' | 'CANCELLED'> {
  // Re-check when unknown or previously unsupported so live migrations
  // are picked up without waiting for a full Lambda cold-start cycle.
  if (poRejectedStatusSupported !== true) {
    const constraint = await queryOne<{ definition: string }>(
      `SELECT pg_get_constraintdef(c.oid) as definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'purchase_orders'
         AND c.conname = 'valid_po_status'
       LIMIT 1`
    );

    // If the check constraint is missing, assume REJECTED is supported.
    poRejectedStatusSupported = constraint?.definition
      ? constraint.definition.includes(`'REJECTED'`)
      : true;
  }

  return poRejectedStatusSupported ? 'REJECTED' : 'CANCELLED';
}

async function isClosedPOStatusSupported(): Promise<boolean> {
  // Re-check when unknown or previously unsupported so live migrations
  // are picked up without waiting for a full Lambda cold-start cycle.
  if (poClosedStatusSupported !== true) {
    const constraint = await queryOne<{ definition: string }>(
      `SELECT pg_get_constraintdef(c.oid) as definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'purchase_orders'
         AND c.conname = 'valid_po_status'
       LIMIT 1`
    );

    // If the check constraint is missing, assume CLOSED is supported.
    poClosedStatusSupported = constraint?.definition
      ? constraint.definition.includes(`'CLOSED'`)
      : true;
  }

  return poClosedStatusSupported;
}

function poLineSelectSql(withLineVendorColumns: boolean): string {
  const vendorColumns = withLineVendorColumns
    ? `
      pol.vendor_id as "vendorId",
      COALESCE(line_vendor.vendor_name, pol.vendor_name) as "vendorName",
      COALESCE(pol.vendor_id, po.vendor_id) as "effectiveVendorId",
      COALESCE(line_vendor.vendor_name, pol.vendor_name, header_vendor.vendor_name, '') as "effectiveVendorName",`
    : `
      NULL::uuid as "vendorId",
      NULL::text as "vendorName",
      po.vendor_id as "effectiveVendorId",
      COALESCE(header_vendor.vendor_name, '') as "effectiveVendorName",`;

  return `SELECT
      pol.line_id as "lineId",
      pol.po_id as "poId",
      pol.line_number as "lineNumber",
      pol.product_type as "productType",
      pol.product_id as "productId",
      pol.product_description as "productDescription",
      pol.product_sku as "sku",
      pol.quantity,
      pol.unit_price as "unitPrice",
      pol.total_price as "lineTotal",
      pol.received_quantity as "quantityReceived",
      ${vendorColumns}
      pol.cost_center_id as "costCenterId",
      line_cc.code as "costCenterCode",
      COALESCE(pol.cost_center_id, po.cost_center_id) as "effectiveCostCenterId",
      COALESCE(line_cc.code, header_cc.code, '') as "effectiveCostCenterCode",
      pol.notes,
      pol.created_at::text as "createdAt",
      pol.updated_at::text as "updatedAt"
    FROM purchase_order_lines pol
    JOIN purchase_orders po ON po.po_id = pol.po_id
    LEFT JOIN vendors header_vendor ON po.vendor_id = header_vendor.vendor_id
    LEFT JOIN cost_centers line_cc ON pol.cost_center_id = line_cc.cost_center_id
    LEFT JOIN cost_centers header_cc ON po.cost_center_id = header_cc.cost_center_id
    ${withLineVendorColumns ? 'LEFT JOIN vendors line_vendor ON pol.vendor_id = line_vendor.vendor_id' : ''}`;
}

async function getPOLineById(lineId: UUID): Promise<POLine | null> {
  const withLineVendorColumns = await hasPOLineVendorColumns();
  return queryOne<POLine>(
    `${poLineSelectSql(withLineVendorColumns)}
     WHERE pol.line_id = $1`,
    [lineId]
  );
}

// ============================================================================
// Purchase Order CRUD
// ============================================================================

/**
 * Create a new purchase order
 */
async function insertPurchaseOrder(
  request: CreatePurchaseOrderRequest,
  queryOneFn: QueryOneExecutor
): Promise<PurchaseOrder> {
  const poNumber = await generatePONumber(queryOneFn);
  const dbRequestedBy = await resolveDbUserId(request.createdBy, queryOneFn);

  const result = await queryOneFn<PurchaseOrder>(
    `INSERT INTO purchase_orders (
      po_number, vendor_id, cost_center_id, status,
      requested_by, requested_date, currency, expected_delivery_date,
      subtotal, tax_amount, shipping_amount, total_amount,
      notes, created_by
    ) VALUES (
      $1, $2, $3, 'DRAFT',
      $4, CURRENT_DATE, $5, $6,
      0, 0, 0, 0,
      $7, $4
    )
    RETURNING 
      po_id as "poId",
      po_number as "poNumber",
      vendor_id as "vendorId",
      (SELECT vendor_name FROM vendors WHERE vendor_id = $2) as "vendorName",
      cost_center_id as "costCenterId",
      (SELECT code FROM cost_centers WHERE cost_center_id = $3) as "costCenterCode",
      status,
      currency,
      requested_by as "requestedBy",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = $4) as "requestedByName",
      requested_date::text as "requestedDate",
      approved_by as "approvedBy",
      NULL as "approvedByName",
      approved_date::text as "approvedDate",
      rejected_by as "rejectedBy",
      NULL as "rejectedByName",
      rejected_date::text as "rejectedDate",
      rejection_reason as "rejectionReason",
      sent_date::text as "sentDate",
      expected_delivery_date::text as "expectedDeliveryDate",
      subtotal,
      tax_amount as "taxAmount",
      shipping_amount as "shippingAmount",
      total_amount as "totalAmount",
      notes,
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"`,
    [
      poNumber,
      request.vendorId,
      request.costCenterId,
      dbRequestedBy,
      (request.currency ?? 'USD').toUpperCase(),
      request.expectedDeliveryDate ?? null,
      request.notes ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create purchase order');
  }

  return result;
}

export async function createPurchaseOrder(
  request: CreatePurchaseOrderRequest
): Promise<PurchaseOrder> {
  logger.info('Creating purchase order', {
    vendorId: request.vendorId,
    costCenterId: request.costCenterId,
  });

  return insertPurchaseOrder(request, queryOne);
}

export async function createPurchaseOrderWithLines(
  request: CreatePurchaseOrderRequest,
  lines: CreatePOLineRequest[] = []
): Promise<PurchaseOrderWithLines> {
  logger.info('Creating purchase order with line items', {
    vendorId: request.vendorId,
    costCenterId: request.costCenterId,
    lineCount: lines.length,
  });

  const withLineVendorColumns = await hasPOLineVendorColumns();
  if (lines.some((line) => Boolean(line.vendorId)) && !withLineVendorColumns) {
    throw new Error('Line-level vendor overrides require V025__po_line_vendor migration');
  }

  const poId = await withTransaction(async (ctx) => {
    const createdPO = await insertPurchaseOrder(request, ctx.queryOne);
    let lineNumber = 1;

    for (const line of lines) {
      await insertPOLineRow(
        createdPO.poId,
        lineNumber++,
        line,
        withLineVendorColumns,
        ctx.queryOne
      );
    }

    if (lines.length > 0) {
      await recalculatePOTotalsWithQuery(createdPO.poId, ctx.queryOne);
    }

    return createdPO.poId;
  });

  const created = await getPurchaseOrderWithLines(poId);
  if (!created) {
    throw new Error('Failed to retrieve created purchase order');
  }

  return created;
}


/**
 * Get purchase order by ID
 */
export async function getPurchaseOrderById(poId: UUID): Promise<PurchaseOrder | null> {
  return queryOne<PurchaseOrder>(
    `SELECT 
      po.po_id as "poId",
      po.po_number as "poNumber",
      po.vendor_id as "vendorId",
      v.vendor_name as "vendorName",
      po.cost_center_id as "costCenterId",
      cc.code as "costCenterCode",
      po.status,
      po.currency,
      po.requested_by as "requestedBy",
      COALESCE(req.first_name || ' ' || req.last_name, req.email) as "requestedByName",
      po.requested_date::text as "requestedDate",
      po.approved_by as "approvedBy",
      COALESCE(app.first_name || ' ' || app.last_name, app.email) as "approvedByName",
      po.approved_date::text as "approvedDate",
      po.rejected_by as "rejectedBy",
      COALESCE(rej.first_name || ' ' || rej.last_name, rej.email) as "rejectedByName",
      po.rejected_date::text as "rejectedDate",
      po.rejection_reason as "rejectionReason",
      po.sent_date::text as "sentDate",
      po.expected_delivery_date::text as "expectedDeliveryDate",
      po.subtotal,
      po.tax_amount as "taxAmount",
      po.shipping_amount as "shippingAmount",
      po.total_amount as "totalAmount",
      po.notes,
      po.created_at::text as "createdAt",
      po.updated_at::text as "updatedAt"
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
    LEFT JOIN cost_centers cc ON po.cost_center_id = cc.cost_center_id
    LEFT JOIN users req ON po.requested_by = req.user_id
    LEFT JOIN users app ON po.approved_by = app.user_id
    LEFT JOIN users rej ON po.rejected_by = rej.user_id
    WHERE po.po_id = $1`,
    [poId]
  );
}

/**
 * Get purchase order with lines
 */
export async function getPurchaseOrderWithLines(poId: UUID): Promise<PurchaseOrderWithLines | null> {
  const po = await getPurchaseOrderById(poId);
  if (!po) return null;

  const lines = await getPOLines(poId);
  return { ...po, lines };
}

/**
 * Update purchase order
 */
export async function updatePurchaseOrder(
  poId: UUID,
  request: UpdatePurchaseOrderRequest
): Promise<PurchaseOrder | null> {
  logger.info('Updating purchase order', { poId });

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.vendorId !== undefined) {
    updates.push('vendor_id = $' + paramIndex++);
    values.push(request.vendorId);
  }

  if (request.costCenterId !== undefined) {
    updates.push('cost_center_id = $' + paramIndex++);
    values.push(request.costCenterId);
  }

  if (request.expectedDeliveryDate !== undefined) {
    updates.push('expected_delivery_date = $' + paramIndex++);
    values.push(request.expectedDeliveryDate);
  }

  if (request.currency !== undefined) {
    updates.push('currency = $' + paramIndex++);
    values.push(request.currency.toUpperCase());
  }

  if (request.taxAmount !== undefined) {
    updates.push('tax_amount = $' + paramIndex++);
    values.push(request.taxAmount);
  }

  if (request.shippingAmount !== undefined) {
    updates.push('shipping_amount = $' + paramIndex++);
    values.push(request.shippingAmount);
  }

  if (request.notes !== undefined) {
    updates.push('notes = $' + paramIndex++);
    values.push(request.notes);
  }

  if (request.updatedBy !== undefined) {
    const dbUpdatedBy = await resolveDbUserId(request.updatedBy);
    updates.push('updated_by = $' + paramIndex++);
    values.push(dbUpdatedBy);
  }

  updates.push('updated_at = NOW()');

  if (updates.length === 1) {
    return getPurchaseOrderById(poId);
  }

  values.push(poId);

  await queryOne(
    'UPDATE purchase_orders SET ' + updates.join(', ') + ' WHERE po_id = $' + paramIndex,
    values
  );

  // Recalculate totals if tax or shipping changed
  if (request.taxAmount !== undefined || request.shippingAmount !== undefined) {
    await recalculatePOTotals(poId);
  }

  return getPurchaseOrderById(poId);
}

/**
 * Recalculate PO totals from lines
 */
async function recalculatePOTotalsWithQuery(
  poId: UUID,
  queryOneFn: QueryOneExecutor
): Promise<void> {
  await queryOneFn(
    `UPDATE purchase_orders 
     SET subtotal = COALESCE((SELECT SUM(total_price) FROM purchase_order_lines WHERE po_id = $1), 0),
         total_amount = COALESCE((SELECT SUM(total_price) FROM purchase_order_lines WHERE po_id = $1), 0) + tax_amount + shipping_amount,
         updated_at = NOW()
     WHERE po_id = $1`,
    [poId]
  );
}

export async function recalculatePOTotals(poId: UUID): Promise<void> {
  await recalculatePOTotalsWithQuery(poId, queryOne);
}


/**
 * Update purchase order status
 */
export async function updatePOStatus(
  poId: UUID,
  status: POStatus,
  userId?: UUID
): Promise<PurchaseOrder | null> {
  logger.info('Updating PO status', { poId, status });

  if (status === 'APPROVED' && userId) {
    const dbUserId = await resolveDbUserId(userId);
    await queryOne(
      `UPDATE purchase_orders 
       SET status = $1, approved_by = $2, approved_date = NOW(), updated_at = NOW()
       WHERE po_id = $3`,
      [status, dbUserId, poId]
    );
  } else if (status === 'SENT') {
    await queryOne(
      `UPDATE purchase_orders 
       SET status = $1, sent_date = NOW(), updated_at = NOW()
       WHERE po_id = $2`,
      [status, poId]
    );
  } else {
    await queryOne(
      `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE po_id = $2`,
      [status, poId]
    );
  }

  return getPurchaseOrderById(poId);
}

/**
 * Approve purchase order
 */
export async function approvePurchaseOrder(
  poId: UUID,
  approvedBy: UUID,
  approvalNotes?: string
): Promise<PurchaseOrder | null> {
  logger.info('Approving purchase order', { poId, approvedBy });
  const dbApprovedBy = await resolveDbUserId(approvedBy);

  await queryOne(
    `UPDATE purchase_orders 
     SET status = 'APPROVED',
         approved_by = $2,
         approved_date = NOW(),
         notes = CASE
           WHEN $3::text IS NOT NULL
             THEN COALESCE(notes || E'\n', '') || 'Approval: ' || $3::text
           ELSE notes
         END,
         updated_at = NOW()
     WHERE po_id = $1 AND status = 'PENDING_APPROVAL'`,
    [poId, dbApprovedBy, approvalNotes ?? null]
  );

  return getPurchaseOrderById(poId);
}

/**
 * Reject purchase order
 */
export async function rejectPurchaseOrder(
  poId: UUID,
  rejectedBy: UUID,
  rejectionReason: string
): Promise<PurchaseOrder | null> {
  logger.info('Rejecting purchase order', { poId, rejectedBy });
  const dbRejectedBy = await resolveDbUserId(rejectedBy);
  const rejectedStatus = await getRejectedPOStatus();

  if (rejectedStatus !== 'REJECTED') {
    logger.warn('Falling back to CANCELLED status because valid_po_status does not include REJECTED', {
      poId,
    });
  }

  await queryOne(
    `UPDATE purchase_orders 
     SET status = $2,
         rejected_by = $3,
         rejected_date = NOW(),
         rejection_reason = $4,
         updated_at = NOW()
     WHERE po_id = $1 AND status = 'PENDING_APPROVAL'`,
    [poId, rejectedStatus, dbRejectedBy, rejectionReason]
  );

  return getPurchaseOrderById(poId);
}

export async function closePurchaseOrder(
  poId: UUID,
  closedBy?: UUID,
  closeNotes?: string
): Promise<PurchaseOrder | null> {
  logger.info('Closing purchase order', { poId, closedBy });

  const supportsClosedStatus = await isClosedPOStatusSupported();
  if (!supportsClosedStatus) {
    throw new Error(
      'Cannot close purchase order: valid_po_status constraint does not include CLOSED'
    );
  }

  const dbClosedBy = await resolveDbUserId(closedBy);

  await queryOne(
    `UPDATE purchase_orders
     SET status = 'CLOSED',
         updated_by = $2,
         notes = CASE
           WHEN $3::text IS NOT NULL
             THEN COALESCE(notes || E'\n', '') || 'Close: ' || $3::text
           ELSE notes
         END,
         updated_at = NOW()
     WHERE po_id = $1`,
    [poId, dbClosedBy, closeNotes ?? null]
  );

  return getPurchaseOrderById(poId);
}

/**
 * List purchase orders with filters and pagination
 */
export async function listPurchaseOrders(
  filters: POListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<PurchaseOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push('po.status = $' + paramIndex++);
    values.push(filters.status);
  }

  if (filters.vendorId) {
    conditions.push('po.vendor_id = $' + paramIndex++);
    values.push(filters.vendorId);
  }

  if (filters.costCenterId) {
    conditions.push('po.cost_center_id = $' + paramIndex++);
    values.push(filters.costCenterId);
  }

  if (filters.requestedBy) {
    conditions.push('po.requested_by = $' + paramIndex++);
    values.push(filters.requestedBy);
  }

  if (filters.fromDate) {
    conditions.push('po.requested_date >= $' + paramIndex++);
    values.push(filters.fromDate);
  }

  if (filters.toDate) {
    conditions.push('po.requested_date <= $' + paramIndex++);
    values.push(filters.toDate);
  }

  if (filters.search) {
    conditions.push('(po.po_number ILIKE $' + paramIndex + ' OR v.vendor_name ILIKE $' + paramIndex + ')');
    values.push('%' + filters.search + '%');
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM purchase_orders po
     LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
     ${whereClause}`,
    values
  );

  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const items = await queryMany<PurchaseOrder>(
    `SELECT 
      po.po_id as "poId",
      po.po_number as "poNumber",
      po.vendor_id as "vendorId",
      v.vendor_name as "vendorName",
      po.cost_center_id as "costCenterId",
      cc.code as "costCenterCode",
      po.status,
      po.currency,
      po.requested_by as "requestedBy",
      COALESCE(req.first_name || ' ' || req.last_name, req.email) as "requestedByName",
      po.requested_date::text as "requestedDate",
      po.approved_by as "approvedBy",
      COALESCE(app.first_name || ' ' || app.last_name, app.email) as "approvedByName",
      po.approved_date::text as "approvedDate",
      po.rejected_by as "rejectedBy",
      COALESCE(rej.first_name || ' ' || rej.last_name, rej.email) as "rejectedByName",
      po.rejected_date::text as "rejectedDate",
      po.rejection_reason as "rejectionReason",
      po.sent_date::text as "sentDate",
      po.expected_delivery_date::text as "expectedDeliveryDate",
      po.subtotal,
      po.tax_amount as "taxAmount",
      po.shipping_amount as "shippingAmount",
      po.total_amount as "totalAmount",
      po.notes,
      po.created_at::text as "createdAt",
      po.updated_at::text as "updatedAt"
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
    LEFT JOIN cost_centers cc ON po.cost_center_id = cc.cost_center_id
    LEFT JOIN users req ON po.requested_by = req.user_id
    LEFT JOIN users app ON po.approved_by = app.user_id
    LEFT JOIN users rej ON po.rejected_by = rej.user_id
    ${whereClause}
    ORDER BY po.created_at DESC
    LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items,
    total,
    page,
    limit,
    hasMore: offset + items.length < total,
  };
}


// ============================================================================
// PO Line CRUD
// ============================================================================

async function insertPOLineRow(
  poId: UUID,
  lineNumber: number,
  request: CreatePOLineRequest,
  withLineVendorColumns: boolean,
  queryOneFn: QueryOneExecutor
): Promise<UUID> {
  const lineTotal = calculateLineTotal(request.quantity, request.unitPrice);

  const inserted = withLineVendorColumns
    ? await queryOneFn<{ lineId: UUID }>(
        `INSERT INTO purchase_order_lines (
          po_id, line_number, product_type, product_id,
          product_description, product_sku, quantity, unit_price,
          total_price, received_quantity, vendor_id, vendor_name, cost_center_id, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10,
          CASE WHEN $10::uuid IS NULL THEN NULL ELSE (SELECT vendor_name FROM vendors WHERE vendor_id = $10) END,
          $11, $12
        )
        RETURNING line_id as "lineId"`,
        [
          poId,
          lineNumber,
          request.productType,
          request.productId ?? null,
          request.productDescription,
          request.sku ?? null,
          request.quantity,
          request.unitPrice,
          lineTotal,
          request.vendorId ?? null,
          request.costCenterId ?? null,
          request.notes ?? null,
        ]
      )
    : await queryOneFn<{ lineId: UUID }>(
        `INSERT INTO purchase_order_lines (
          po_id, line_number, product_type, product_id,
          product_description, product_sku, quantity, unit_price,
          total_price, received_quantity, cost_center_id, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11
        )
        RETURNING line_id as "lineId"`,
        [
          poId,
          lineNumber,
          request.productType,
          request.productId ?? null,
          request.productDescription,
          request.sku ?? null,
          request.quantity,
          request.unitPrice,
          lineTotal,
          request.costCenterId ?? null,
          request.notes ?? null,
        ]
      );

  if (!inserted?.lineId) {
    throw new Error('Failed to add PO line');
  }

  return inserted.lineId;
}

/**
 * Get PO lines for a purchase order
 */
export async function getPOLines(poId: UUID): Promise<POLine[]> {
  const withLineVendorColumns = await hasPOLineVendorColumns();
  return queryMany<POLine>(
    `${poLineSelectSql(withLineVendorColumns)}
     WHERE pol.po_id = $1
     ORDER BY pol.line_number`,
    [poId]
  );
}

/**
 * Add a line to a purchase order
 */
export async function addPOLine(
  poId: UUID,
  request: CreatePOLineRequest
): Promise<POLine> {
  logger.info('Adding PO line', { poId, productDescription: request.productDescription });
  const withLineVendorColumns = await hasPOLineVendorColumns();

  if (request.vendorId && !withLineVendorColumns) {
    throw new Error('Line-level vendor overrides require V025__po_line_vendor migration');
  }

  // Get next line number
  const maxLine = await queryOne<{ max: number }>(
    `SELECT COALESCE(MAX(line_number), 0) as max FROM purchase_order_lines WHERE po_id = $1`,
    [poId]
  );

  const lineNumber = (maxLine?.max ?? 0) + 1;
  const lineId = await insertPOLineRow(poId, lineNumber, request, withLineVendorColumns, queryOne);

  // Recalculate PO totals
  await recalculatePOTotalsWithQuery(poId, queryOne);

  const line = await getPOLineById(lineId);
  if (!line) {
    throw new Error('Failed to load created PO line');
  }

  return line;
}

/**
 * Update a PO line
 */
export async function updatePOLine(
  lineId: UUID,
  request: UpdatePOLineRequest
): Promise<POLine | null> {
  logger.info('Updating PO line', { lineId });
  const withLineVendorColumns = await hasPOLineVendorColumns();

  if (request.vendorId && !withLineVendorColumns) {
    throw new Error('Line-level vendor overrides require V025__po_line_vendor migration');
  }

  // Get current line to get poId
  const currentLine = await queryOne<{
    poId: UUID;
    quantity: number;
    unitPrice: number;
  }>(
    `SELECT
       po_id as "poId",
       quantity,
       unit_price as "unitPrice"
     FROM purchase_order_lines
     WHERE line_id = $1`,
    [lineId]
  );

  if (!currentLine) {
    return null;
  }

  const quantity = request.quantity ?? currentLine.quantity;
  const unitPrice = request.unitPrice ?? currentLine.unitPrice;
  const lineTotal = calculateLineTotal(quantity, unitPrice);

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.quantity !== undefined) {
    updates.push('quantity = $' + paramIndex++);
    values.push(request.quantity);
  }

  if (request.unitPrice !== undefined) {
    updates.push('unit_price = $' + paramIndex++);
    values.push(request.unitPrice);
  }

  if (request.vendorId !== undefined && withLineVendorColumns) {
    updates.push('vendor_id = $' + paramIndex);
    updates.push(
      `vendor_name = CASE WHEN $${paramIndex}::uuid IS NULL THEN NULL ELSE (SELECT vendor_name FROM vendors WHERE vendor_id = $${paramIndex}) END`
    );
    values.push(request.vendorId);
    paramIndex++;
  }

  if (request.costCenterId !== undefined) {
    updates.push('cost_center_id = $' + paramIndex++);
    values.push(request.costCenterId);
  }

  if (request.notes !== undefined) {
    updates.push('notes = $' + paramIndex++);
    values.push(request.notes);
  }

  updates.push('total_price = $' + paramIndex++);
  values.push(lineTotal);

  updates.push('updated_at = NOW()');
  values.push(lineId);

  await queryOne(
    'UPDATE purchase_order_lines SET ' + updates.join(', ') + ' WHERE line_id = $' + paramIndex,
    values
  );

  // Recalculate PO totals
  await recalculatePOTotals(currentLine.poId);

  return getPOLineById(lineId);
}

/**
 * Remove a PO line
 */
export async function removePOLine(lineId: UUID): Promise<boolean> {
  logger.info('Removing PO line', { lineId });

  // Get poId before deleting
  const line = await queryOne<{ poId: UUID }>(
    `SELECT po_id as "poId" FROM purchase_order_lines WHERE line_id = $1`,
    [lineId]
  );

  if (!line) {
    return false;
  }

  await queryOne(`DELETE FROM purchase_order_lines WHERE line_id = $1`, [lineId]);

  // Recalculate PO totals
  await recalculatePOTotals(line.poId);

  // Renumber remaining lines
  await queryOne(
    `WITH numbered AS (
      SELECT line_id, ROW_NUMBER() OVER (ORDER BY line_number) as new_number
      FROM purchase_order_lines WHERE po_id = $1
    )
    UPDATE purchase_order_lines SET line_number = numbered.new_number
    FROM numbered WHERE purchase_order_lines.line_id = numbered.line_id`,
    [line.poId]
  );

  return true;
}

/**
 * Update quantity received for a PO line
 */
export async function updateLineQuantityReceived(
  lineId: UUID,
  quantityReceived: number
): Promise<POLine | null> {
  logger.info('Updating line quantity received', { lineId, quantityReceived });

  await queryOne(
    `UPDATE purchase_order_lines SET received_quantity = $2, updated_at = NOW() WHERE line_id = $1`,
    [lineId, quantityReceived]
  );

  return getPOLineById(lineId);
}
