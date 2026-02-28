/**
 * Procurement Repository - Data access layer for procurement operations
 *
 * Implements database operations for:
 * - Stock availability checking (Requirement 6.2)
 * - Inventory reservation (Requirement 6.2)
 * - Purchase order creation (Requirement 6.2, 6.3)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

import { resolveEffectiveVendor } from './vendor-resolution';
import { resolveEffectiveCostCenter } from './cost-center-resolution';

const logger = createLogger({ service: 'procurement-repository' });

/**
 * Purchase order status
 */
export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUBMITTED'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'INVOICED'
  | 'PAID'
  | 'ON_HOLD'
  | 'CANCELLED'
  | 'CLOSED';

/**
 * Purchase order line status
 */
export type PurchaseOrderLineStatus =
  | 'PENDING'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'BACKORDERED'
  | 'CANCELLED';

/**
 * Stock availability result
 */
export interface StockAvailability {
  readonly productId: UUID;
  readonly productType: string;
  readonly productName: string | null;
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly unitCost: number | null;
}

/**
 * Inventory reservation
 */
export interface InventoryReservation {
  readonly reservationId: UUID;
  readonly inventoryId: UUID;
  readonly stockroomId: UUID;
  readonly productId: UUID | null;
  readonly productType: string;
  readonly requestId: UUID | null;
  readonly requestLineId: UUID | null;
  readonly quantityReserved: number;
  readonly reservedBy: UUID;
  readonly reservedAt: string;
  readonly expiresAt: string | null;
  readonly status: 'ACTIVE' | 'FULFILLED' | 'RELEASED' | 'EXPIRED';
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Purchase order entity
 */
export interface PurchaseOrder {
  readonly poId: UUID;
  readonly poNumber: string;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly requesterId: UUID;
  readonly requesterName: string | null;
  readonly approverId: UUID | null;
  readonly approverName: string | null;
  readonly status: PurchaseOrderStatus;
  readonly orderDate: string | null;
  readonly expectedDeliveryDate: string | null;
  readonly actualDeliveryDate: string | null;
  readonly shippingAddress: string | null;
  readonly shippingMethod: string | null;
  readonly paymentTerms: string | null;
  readonly currency: string;
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly shippingCost: number;
  readonly totalAmount: number;
  readonly notes: string | null;
  readonly internalNotes: string | null;
  readonly sourceRequestId: UUID | null;
  readonly erpReferenceId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Purchase order line entity
 */
export interface PurchaseOrderLine {
  readonly lineId: UUID;
  readonly poId: UUID;
  readonly lineNumber: number;
  readonly productId: UUID | null;
  readonly productType: string | null;
  readonly productName: string | null;
  readonly productDescription: string | null;
  readonly productSku: string | null;
  readonly quantity: number;
  readonly receivedQuantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
  readonly status: PurchaseOrderLineStatus;
  readonly costCenterId: UUID | null;
  readonly costCenterCode: string | null;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly effectiveVendorId: UUID | null;
  readonly effectiveVendorName: string | null;
  readonly effectiveCostCenterId: UUID | null;
  readonly effectiveCostCenterCode: string | null;
  readonly requestLineId: UUID | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create purchase order input
 */
export interface CreatePurchaseOrderInput {
  readonly vendorId?: UUID;
  readonly vendorName?: string;
  readonly requesterId: UUID;
  readonly requesterName?: string;
  readonly expectedDeliveryDate?: string;
  readonly shippingAddress?: string;
  readonly shippingMethod?: string;
  readonly paymentTerms?: string;
  readonly currency?: string;
  readonly notes?: string;
  readonly internalNotes?: string;
  readonly sourceRequestId?: UUID;
  readonly lines: CreatePurchaseOrderLineInput[];
}

/**
 * Create purchase order line input
 */
export interface CreatePurchaseOrderLineInput {
  readonly productId?: UUID;
  readonly productType?: string;
  readonly productName: string;
  readonly productDescription?: string;
  readonly productSku?: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly vendorId?: UUID;
  readonly vendorName?: string;
  readonly costCenterId?: UUID;
  readonly requestLineId?: UUID;
  readonly notes?: string;
}

/**
 * Create reservation input
 */
export interface CreateReservationInput {
  readonly inventoryId: UUID;
  readonly stockroomId: UUID;
  readonly productId?: UUID;
  readonly productType: string;
  readonly requestId?: UUID;
  readonly requestLineId?: UUID;
  readonly quantityReserved: number;
  readonly reservedBy: UUID;
  readonly expiresAt?: string;
  readonly notes?: string;
}

/**
 * Database row types
 */
interface StockAvailabilityRow {
  product_id: string;
  product_type: string;
  product_name: string | null;
  stockroom_id: string;
  stockroom_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  unit_cost: string | null;
}

interface ReservationRow {
  reservation_id: string;
  inventory_id: string;
  stockroom_id: string;
  product_id: string | null;
  product_type: string;
  request_id: string | null;
  request_line_id: string | null;
  quantity_reserved: number;
  reserved_by: string;
  reserved_at: string;
  expires_at: string | null;
  status: 'ACTIVE' | 'FULFILLED' | 'RELEASED' | 'EXPIRED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrderRow {
  po_id: string;
  po_number: string;
  vendor_id: string | null;
  vendor_name: string | null;
  cost_center_id: string | null;
  requester_id: string;
  requester_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  status: PurchaseOrderStatus;
  order_date: string | null;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  shipping_address: string | null;
  shipping_method: string | null;
  payment_terms: string | null;
  currency: string;
  subtotal: string;
  tax_amount: string;
  shipping_cost: string;
  total_amount: string;
  notes: string | null;
  internal_notes: string | null;
  source_request_id: string | null;
  erp_reference_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface PurchaseOrderLineRow {
  line_id: string;
  po_id: string;
  line_number: number;
  product_id: string | null;
  product_type: string | null;
  product_name: string | null;
  product_description: string | null;
  product_sku: string | null;
  quantity: number;
  received_quantity: number;
  unit_price: string;
  total_price: string;
  status: PurchaseOrderLineStatus;
  cost_center_id: string | null;
  cost_center_code: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  request_line_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Header-level fields joined for effective resolution
  header_vendor_id?: string | null;
  header_vendor_name?: string | null;
  header_cost_center_id?: string | null;
  header_cost_center_code?: string | null;
}

/**
 * Map database row to StockAvailability
 */
function mapRowToStockAvailability(row: StockAvailabilityRow): StockAvailability {
  return {
    productId: row.product_id,
    productType: row.product_type,
    productName: row.product_name,
    stockroomId: row.stockroom_id,
    stockroomName: row.stockroom_name,
    quantityOnHand: row.quantity_on_hand,
    quantityReserved: row.quantity_reserved,
    quantityAvailable: row.quantity_available,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
  };
}

/**
 * Map database row to InventoryReservation
 */
function mapRowToReservation(row: ReservationRow): InventoryReservation {
  return {
    reservationId: row.reservation_id,
    inventoryId: row.inventory_id,
    stockroomId: row.stockroom_id,
    productId: row.product_id,
    productType: row.product_type,
    requestId: row.request_id,
    requestLineId: row.request_line_id,
    quantityReserved: row.quantity_reserved,
    reservedBy: row.reserved_by,
    reservedAt: row.reserved_at,
    expiresAt: row.expires_at,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to PurchaseOrder
 */
function mapRowToPurchaseOrder(row: PurchaseOrderRow): PurchaseOrder {
  return {
    poId: row.po_id,
    poNumber: row.po_number,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    approverId: row.approver_id,
    approverName: row.approver_name,
    status: row.status,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    shippingAddress: row.shipping_address,
    shippingMethod: row.shipping_method,
    paymentTerms: row.payment_terms,
    currency: row.currency,
    subtotal: parseFloat(row.subtotal),
    taxAmount: parseFloat(row.tax_amount),
    shippingCost: parseFloat(row.shipping_cost),
    totalAmount: parseFloat(row.total_amount),
    notes: row.notes,
    internalNotes: row.internal_notes,
    sourceRequestId: row.source_request_id,
    erpReferenceId: row.erp_reference_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Map database row to PurchaseOrderLine
 */
function mapRowToPurchaseOrderLine(row: PurchaseOrderLineRow): PurchaseOrderLine {
  const effectiveVendor = resolveEffectiveVendor(
    row.vendor_id ?? null,
    row.vendor_name ?? null,
    row.header_vendor_id ?? null,
    row.header_vendor_name ?? null
  );
  const effectiveCostCenter = resolveEffectiveCostCenter(
    row.cost_center_id ?? null,
    row.cost_center_code ?? null,
    row.header_cost_center_id ?? null,
    row.header_cost_center_code ?? null
  );

  return {
    lineId: row.line_id,
    poId: row.po_id,
    lineNumber: row.line_number,
    productId: row.product_id,
    productType: row.product_type,
    productName: row.product_name,
    productDescription: row.product_description,
    productSku: row.product_sku,
    quantity: row.quantity,
    receivedQuantity: row.received_quantity,
    unitPrice: parseFloat(row.unit_price),
    totalPrice: parseFloat(row.total_price),
    status: row.status,
    costCenterId: row.cost_center_id ?? null,
    costCenterCode: row.cost_center_code ?? null,
    vendorId: row.vendor_id ?? null,
    vendorName: row.vendor_name ?? null,
    effectiveVendorId: effectiveVendor.vendorId,
    effectiveVendorName: effectiveVendor.vendorName,
    effectiveCostCenterId: effectiveCostCenter.costCenterId,
    effectiveCostCenterCode: effectiveCostCenter.costCenterCode,
    requestLineId: row.request_line_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Generate a unique purchase order number
 */
function generatePONumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${timestamp}-${random}`;
}

const PURCHASE_ORDER_SELECT_SQL = `
  po.po_id,
  po.po_number,
  po.vendor_id,
  v.vendor_name,
  po.cost_center_id,
  po.requested_by AS requester_id,
  COALESCE(req.first_name || ' ' || req.last_name, req.email) AS requester_name,
  po.approved_by AS approver_id,
  COALESCE(app.first_name || ' ' || app.last_name, app.email) AS approver_name,
  po.status,
  po.order_date,
  po.expected_delivery_date,
  po.actual_delivery_date,
  po.ship_to_address AS shipping_address,
  po.shipping_method,
  po.payment_terms,
  po.currency,
  COALESCE(po.subtotal, po.subtotal_amount, 0)::text AS subtotal,
  COALESCE(po.tax_amount, 0)::text AS tax_amount,
  COALESCE(po.shipping_amount, 0)::text AS shipping_cost,
  COALESCE(po.total_amount, 0)::text AS total_amount,
  po.notes,
  NULL::text AS internal_notes,
  (
    SELECT MIN(rl.request_id)
    FROM request_lines rl
    WHERE rl.purchase_order_id = po.po_id
  ) AS source_request_id,
  po.tracking_number AS erp_reference_id,
  po.created_at,
  po.updated_at,
  po.created_by,
  po.updated_by
`;

const PURCHASE_ORDER_FROM_SQL = `
  FROM purchase_orders po
  LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
  LEFT JOIN users req ON po.requested_by = req.user_id
  LEFT JOIN users app ON po.approved_by = app.user_id
`;

const PURCHASE_ORDER_LINE_SELECT_SQL = `
  pol.line_id,
  pol.po_id,
  pol.line_number,
  pol.product_id,
  pol.product_type,
  pol.product_description AS product_name,
  pol.product_description,
  pol.product_sku,
  pol.quantity,
  pol.received_quantity,
  pol.unit_price::text AS unit_price,
  pol.total_price::text AS total_price,
  pol.status,
  pol.cost_center_id,
  cc.code AS cost_center_code,
  NULL::uuid AS vendor_id,
  NULL::text AS vendor_name,
  (
    SELECT rl.line_id
    FROM request_lines rl
    WHERE rl.purchase_order_line_id = pol.line_id
    ORDER BY rl.created_at DESC
    LIMIT 1
  ) AS request_line_id,
  pol.notes,
  pol.created_at,
  pol.updated_at,
  po.vendor_id AS header_vendor_id,
  v.vendor_name AS header_vendor_name,
  po.cost_center_id AS header_cost_center_id,
  hcc.code AS header_cost_center_code
`;

let procurementSchemaChecked = false;
let procurementSchemaCheckPromise: Promise<void> | null = null;

async function ensureProcurementSchemaCompatibility(): Promise<void> {
  if (procurementSchemaChecked) {
    return;
  }
  if (procurementSchemaCheckPromise) {
    return procurementSchemaCheckPromise;
  }

  procurementSchemaCheckPromise = (async () => {
    const rows = await queryMany<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('purchase_orders', 'purchase_order_lines', 'request_lines')`
    );

    const byTable = new Map();
    for (const row of rows) {
      const cols = byTable.get(row.table_name) ?? new Set();
      cols.add(row.column_name);
      byTable.set(row.table_name, cols);
    }

    const required = {
      purchase_orders: [
        'po_id',
        'po_number',
        'vendor_id',
        'requested_by',
        'approved_by',
        'status',
        'expected_delivery_date',
        'ship_to_address',
        'shipping_method',
        'payment_terms',
        'currency',
        'subtotal',
        'tax_amount',
        'shipping_amount',
        'total_amount',
      ],
      purchase_order_lines: [
        'line_id',
        'po_id',
        'line_number',
        'product_description',
        'quantity',
        'received_quantity',
        'unit_price',
        'total_price',
        'status',
        'cost_center_id',
      ],
      request_lines: ['line_id', 'request_id', 'purchase_order_id', 'purchase_order_line_id', 'updated_at'],
    };

    const missing = [];
    for (const [table, columns] of Object.entries(required)) {
      const actual = byTable.get(table) ?? new Set();
      for (const column of columns) {
        if (!actual.has(column)) {
          missing.push(`${table}.${column}`);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(`procurement schema mismatch: missing columns ${missing.join(', ')}`);
    }

    procurementSchemaChecked = true;
  })();

  try {
    await procurementSchemaCheckPromise;
  } finally {
    procurementSchemaCheckPromise = null;
  }
}

/**
 * Check stock availability for a product across all stockrooms
 * Requirement 6.2: Check stock availability
 */
export async function checkStockAvailability(
  productId: UUID,
  productType: string,
  stockroomId?: UUID
): Promise<StockAvailability[]> {
  const stockroomCondition = stockroomId ? 'AND si.stockroom_id = $3' : '';
  const params = stockroomId ? [productId, productType, stockroomId] : [productId, productType];

  const rows = await queryMany<StockAvailabilityRow>(
    `SELECT 
      si.product_id,
      si.product_type,
      si.product_description as product_name,
      si.stockroom_id,
      s.name as stockroom_name,
      si.quantity_on_hand,
      si.quantity_reserved,
      (si.quantity_on_hand - si.quantity_reserved) as quantity_available,
      si.unit_cost
     FROM stockroom_inventory si
     JOIN stockrooms s ON si.stockroom_id = s.stockroom_id
     WHERE si.product_id = $1 
       AND si.product_type = $2
       AND si.is_active = TRUE
       AND s.is_active = TRUE
       ${stockroomCondition}
     ORDER BY (si.quantity_on_hand - si.quantity_reserved) DESC`,
    params
  );

  return rows.map(mapRowToStockAvailability);
}

/**
 * Check stock availability for multiple products
 */
export async function checkBulkStockAvailability(
  items: Array<{ productId: UUID; productType: string; quantityNeeded: number }>
): Promise<Map<string, { available: boolean; totalAvailable: number; stockrooms: StockAvailability[] }>> {
  const results = new Map<string, { available: boolean; totalAvailable: number; stockrooms: StockAvailability[] }>();

  for (const item of items) {
    const key = `${item.productId}:${item.productType}`;
    const stockrooms = await checkStockAvailability(item.productId, item.productType);
    const totalAvailable = stockrooms.reduce((sum, s) => sum + s.quantityAvailable, 0);

    results.set(key, {
      available: totalAvailable >= item.quantityNeeded,
      totalAvailable,
      stockrooms,
    });
  }

  return results;
}

/**
 * Create inventory reservation
 * Requirement 6.2: Reserve inventory
 */
export async function createReservation(
  input: CreateReservationInput
): Promise<InventoryReservation> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // First, verify inventory exists and has sufficient available quantity
    const inventoryRow = await ctx.queryOne<{
      quantity_on_hand: number;
      quantity_reserved: number;
    }>(
      'SELECT quantity_on_hand, quantity_reserved FROM stockroom_inventory WHERE inventory_id = $1 FOR UPDATE',
      [input.inventoryId]
    );

    if (!inventoryRow) {
      throw new Error(`Inventory item not found: ${input.inventoryId}`);
    }

    const availableQuantity = inventoryRow.quantity_on_hand - inventoryRow.quantity_reserved;
    if (input.quantityReserved > availableQuantity) {
      throw new Error(
        `Insufficient available inventory: available=${availableQuantity}, requested=${input.quantityReserved}`
      );
    }

    // Update inventory reserved quantity
    await ctx.queryOne(
      `UPDATE stockroom_inventory 
       SET quantity_reserved = quantity_reserved + $1, updated_at = $2 
       WHERE inventory_id = $3`,
      [input.quantityReserved, timestamp, input.inventoryId]
    );

    // Create reservation record
    const result = await ctx.queryOne<ReservationRow>(
      `INSERT INTO inventory_reservations (
        inventory_id, stockroom_id, product_id, product_type,
        request_id, request_line_id, quantity_reserved,
        reserved_by, reserved_at, expires_at, status, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $9, $9)
      RETURNING *`,
      [
        input.inventoryId,
        input.stockroomId,
        input.productId ?? null,
        input.productType,
        input.requestId ?? null,
        input.requestLineId ?? null,
        input.quantityReserved,
        input.reservedBy,
        timestamp,
        input.expiresAt ?? null,
        input.notes ?? null,
      ]
    );

    if (!result) {
      throw new Error('Failed to create reservation');
    }

    logger.info('Inventory reservation created', {
      reservationId: result.reservation_id,
      inventoryId: input.inventoryId,
      quantityReserved: input.quantityReserved,
    });

    return mapRowToReservation(result);
  });
}

/**
 * Get reservation by ID
 */
export async function getReservationById(reservationId: UUID): Promise<InventoryReservation | null> {
  const result = await queryOne<ReservationRow>(
    'SELECT * FROM inventory_reservations WHERE reservation_id = $1',
    [reservationId]
  );

  return result ? mapRowToReservation(result) : null;
}

/**
 * Get reservations by request
 */
export async function getReservationsByRequest(requestId: UUID): Promise<InventoryReservation[]> {
  const rows = await queryMany<ReservationRow>(
    'SELECT * FROM inventory_reservations WHERE request_id = $1 ORDER BY created_at ASC',
    [requestId]
  );

  return rows.map(mapRowToReservation);
}

/**
 * Release reservation
 */
export async function releaseReservation(reservationId: UUID): Promise<InventoryReservation | null> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get reservation with lock
    const reservation = await ctx.queryOne<ReservationRow>(
      'SELECT * FROM inventory_reservations WHERE reservation_id = $1 FOR UPDATE',
      [reservationId]
    );

    if (!reservation) {
      return null;
    }

    if (reservation.status !== 'ACTIVE') {
      throw new Error(`Cannot release reservation in status: ${reservation.status}`);
    }

    // Update inventory reserved quantity
    await ctx.queryOne(
      `UPDATE stockroom_inventory 
       SET quantity_reserved = quantity_reserved - $1, updated_at = $2 
       WHERE inventory_id = $3`,
      [reservation.quantity_reserved, timestamp, reservation.inventory_id]
    );

    // Update reservation status
    const result = await ctx.queryOne<ReservationRow>(
      `UPDATE inventory_reservations 
       SET status = 'RELEASED', updated_at = $1 
       WHERE reservation_id = $2 
       RETURNING *`,
      [timestamp, reservationId]
    );

    if (result) {
      logger.info('Reservation released', {
        reservationId,
        quantityReleased: reservation.quantity_reserved,
      });
    }

    return result ? mapRowToReservation(result) : null;
  });
}

/**
 * Fulfill reservation (convert to actual inventory reduction)
 */
export async function fulfillReservation(reservationId: UUID): Promise<InventoryReservation | null> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get reservation with lock
    const reservation = await ctx.queryOne<ReservationRow>(
      'SELECT * FROM inventory_reservations WHERE reservation_id = $1 FOR UPDATE',
      [reservationId]
    );

    if (!reservation) {
      return null;
    }

    if (reservation.status !== 'ACTIVE') {
      throw new Error(`Cannot fulfill reservation in status: ${reservation.status}`);
    }

    // Update inventory: reduce both on_hand and reserved
    await ctx.queryOne(
      `UPDATE stockroom_inventory 
       SET quantity_on_hand = quantity_on_hand - $1,
           quantity_reserved = quantity_reserved - $1,
           last_issued_date = $2,
           updated_at = $2 
       WHERE inventory_id = $3`,
      [reservation.quantity_reserved, timestamp, reservation.inventory_id]
    );

    // Update reservation status
    const result = await ctx.queryOne<ReservationRow>(
      `UPDATE inventory_reservations 
       SET status = 'FULFILLED', updated_at = $1 
       WHERE reservation_id = $2 
       RETURNING *`,
      [timestamp, reservationId]
    );

    if (result) {
      logger.info('Reservation fulfilled', {
        reservationId,
        quantityFulfilled: reservation.quantity_reserved,
      });
    }

    return result ? mapRowToReservation(result) : null;
  });
}

/**
 * Create purchase order with lines
 * Requirement 6.2, 6.3: Generate purchase orders when stock insufficient
 */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<{ purchaseOrder: PurchaseOrder; lines: PurchaseOrderLine[] }> {
  await ensureProcurementSchemaCompatibility();

  return withTransaction(async (ctx) => {
    const timestamp = now();
    const poNumber = generatePONumber();

    // Calculate totals
    const subtotal = input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const taxAmount = 0; // Tax calculation would be more complex in real system
    const shippingCost = 0;
    const totalAmount = subtotal + taxAmount + shippingCost;

    // Create purchase order
    const poInsertResult = await ctx.queryOne<{ po_id: string }>(
      `INSERT INTO purchase_orders (
        po_number, vendor_id, requested_by,
        status, expected_delivery_date, ship_to_address, shipping_method,
        payment_terms, currency, subtotal, subtotal_amount, tax_amount, shipping_amount, total_amount,
        notes, requested_date,
        created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $9, $10, $11, $12, $13, CURRENT_DATE, $14, $14, $3)
      RETURNING po_id`,
      [
        poNumber,
        input.vendorId ?? null,
        input.requesterId,
        input.expectedDeliveryDate ?? null,
        input.shippingAddress ?? null,
        input.shippingMethod ?? null,
        input.paymentTerms ?? null,
        input.currency ?? 'USD',
        subtotal,
        taxAmount, // $10
        shippingCost, // $11
        totalAmount, // $12
        input.notes ?? null, // $13
        timestamp,
      ]
    );

    if (!poInsertResult) {
      throw new Error('Failed to create purchase order');
    }

    const poResult = await ctx.queryOne<PurchaseOrderRow>(
      `SELECT ${PURCHASE_ORDER_SELECT_SQL}
       ${PURCHASE_ORDER_FROM_SQL}
       WHERE po.po_id = $1`,
      [poInsertResult.po_id]
    );
    if (!poResult) {
      throw new Error('Failed to load created purchase order');
    }

    const purchaseOrder = mapRowToPurchaseOrder(poResult);

    // Create purchase order lines
    const lines: PurchaseOrderLine[] = [];
    for (let i = 0; i < input.lines.length; i++) {
      const lineInput = input.lines[i]!;
      const lineNumber = i + 1;
      const totalPrice = lineInput.unitPrice * lineInput.quantity;

      const lineInsertResult = await ctx.queryOne<{ line_id: string }>(
        `INSERT INTO purchase_order_lines (
          po_id, line_number, product_id, product_type,
          product_description, product_sku, quantity, received_quantity,
          unit_price, total_price, status, cost_center_id,
          notes,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, 'PENDING', $10, $11, $12, $12)
        RETURNING line_id`,
        [
          purchaseOrder.poId,
          lineNumber,
          lineInput.productId ?? null,
          lineInput.productType ?? null,
          lineInput.productDescription ?? lineInput.productName,
          lineInput.productSku ?? null,
          lineInput.quantity,
          lineInput.unitPrice,
          totalPrice,
          lineInput.costCenterId ?? null,
          lineInput.notes ?? null,
          timestamp,
        ]
      );

      if (lineInsertResult && lineInput.requestLineId) {
        await ctx.queryOne(
          `UPDATE request_lines
           SET purchase_order_id = $1,
               purchase_order_line_id = $2,
               updated_at = $3
           WHERE line_id = $4`,
          [purchaseOrder.poId, lineInsertResult.line_id, timestamp, lineInput.requestLineId]
        );
      }

      if (lineInsertResult) {
        const lineRow = await ctx.queryOne<PurchaseOrderLineRow>(
          `SELECT ${PURCHASE_ORDER_LINE_SELECT_SQL}
           FROM purchase_order_lines pol
           JOIN purchase_orders po ON pol.po_id = po.po_id
           LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
           LEFT JOIN cost_centers cc ON pol.cost_center_id = cc.cost_center_id
           LEFT JOIN cost_centers hcc ON po.cost_center_id = hcc.cost_center_id
           WHERE pol.line_id = $1`,
          [lineInsertResult.line_id]
        );
        if (lineRow) {
          lines.push(mapRowToPurchaseOrderLine(lineRow));
        }
      }
    }

    logger.info('Purchase order created', {
      poId: purchaseOrder.poId,
      poNumber,
      requesterId: input.requesterId,
      lineCount: lines.length,
      totalAmount,
    });

    return { purchaseOrder, lines };
  });
}

/**
 * Get purchase order by ID
 */
export async function getPurchaseOrderById(poId: UUID): Promise<PurchaseOrder | null> {
  await ensureProcurementSchemaCompatibility();

  const result = await queryOne<PurchaseOrderRow>(
    `SELECT ${PURCHASE_ORDER_SELECT_SQL}
     ${PURCHASE_ORDER_FROM_SQL}
     WHERE po.po_id = $1`,
    [poId]
  );

  return result ? mapRowToPurchaseOrder(result) : null;
}

/**
 * Get purchase order by PO number
 */
export async function getPurchaseOrderByNumber(poNumber: string): Promise<PurchaseOrder | null> {
  await ensureProcurementSchemaCompatibility();

  const result = await queryOne<PurchaseOrderRow>(
    `SELECT ${PURCHASE_ORDER_SELECT_SQL}
     ${PURCHASE_ORDER_FROM_SQL}
     WHERE po.po_number = $1`,
    [poNumber]
  );

  return result ? mapRowToPurchaseOrder(result) : null;
}

/**
 * Get purchase order lines
 */
export async function getPurchaseOrderLines(poId: UUID): Promise<PurchaseOrderLine[]> {
  await ensureProcurementSchemaCompatibility();

  const rows = await queryMany<PurchaseOrderLineRow>(
    `SELECT ${PURCHASE_ORDER_LINE_SELECT_SQL}
     FROM purchase_order_lines pol
      JOIN purchase_orders po ON pol.po_id = po.po_id
      LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN cost_centers cc ON pol.cost_center_id = cc.cost_center_id
      LEFT JOIN cost_centers hcc ON po.cost_center_id = hcc.cost_center_id
      WHERE pol.po_id = $1
     ORDER BY pol.line_number ASC`,
    [poId]
  );

  return rows.map(mapRowToPurchaseOrderLine);
}

/**
 * Update purchase order status
 */
export async function updatePurchaseOrderStatus(
  poId: UUID,
  status: PurchaseOrderStatus,
  additionalFields?: Partial<{
    approverId: UUID;
    approverName: string;
    orderDate: string;
    actualDeliveryDate: string;
    erpReferenceId: string;
    updatedBy: UUID;
  }>
): Promise<PurchaseOrder | null> {
  await ensureProcurementSchemaCompatibility();

  const timestamp = now();

  const updatedPo = await queryOne<{ po_id: string }>(
    `UPDATE purchase_orders SET
      status = $1,
      approved_by = COALESCE($2, approved_by),
      approved_date = CASE
        WHEN $1 = 'APPROVED' AND approved_date IS NULL THEN $7
        ELSE approved_date
      END,
      order_date = COALESCE($3, order_date),
      actual_delivery_date = COALESCE($4, actual_delivery_date),
      tracking_number = COALESCE($5, tracking_number),
      updated_by = COALESCE($6, updated_by),
      updated_at = $7
     WHERE po_id = $8
     RETURNING po_id`,
    [
      status,
      additionalFields?.approverId ?? null,
      additionalFields?.orderDate ?? null,
      additionalFields?.actualDeliveryDate ?? null,
      additionalFields?.erpReferenceId ?? null,
      additionalFields?.updatedBy ?? null,
      timestamp,
      poId,
    ]
  );

  if (updatedPo) {
    logger.info('Purchase order status updated', { poId, status });
  }

  if (!updatedPo) {
    return null;
  }

  const result = await queryOne<PurchaseOrderRow>(
    `SELECT ${PURCHASE_ORDER_SELECT_SQL}
     ${PURCHASE_ORDER_FROM_SQL}
     WHERE po.po_id = $1`,
    [updatedPo.po_id]
  );

  return result ? mapRowToPurchaseOrder(result) : null;
}

/**
 * Get purchase orders by source request
 */
export async function getPurchaseOrdersByRequest(requestId: UUID): Promise<PurchaseOrder[]> {
  await ensureProcurementSchemaCompatibility();

  const rows = await queryMany<PurchaseOrderRow>(
    `SELECT DISTINCT ${PURCHASE_ORDER_SELECT_SQL}
     ${PURCHASE_ORDER_FROM_SQL}
     JOIN request_lines rl ON rl.purchase_order_id = po.po_id
     WHERE rl.request_id = $1
     ORDER BY po.created_at DESC`,
    [requestId]
  );

  return rows.map(mapRowToPurchaseOrder);
}

/**
 * Get purchase orders with pagination
 */
export async function getPurchaseOrders(
  pagination: PaginationParams = {},
  statusFilter?: PurchaseOrderStatus[]
): Promise<PaginatedResult<PurchaseOrder>> {
  await ensureProcurementSchemaCompatibility();

  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    const statusPlaceholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND po.status IN (${statusPlaceholders})`;
    params.push(...statusFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM purchase_orders po ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<PurchaseOrderRow>(
    `SELECT ${PURCHASE_ORDER_SELECT_SQL}
     ${PURCHASE_ORDER_FROM_SQL}
     ${whereClause}
     ORDER BY po.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToPurchaseOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
