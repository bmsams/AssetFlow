/**
 * Receiving Repository - Data access layer for receiving operations
 *
 * Implements database operations for:
 * - Recording receiving of assets (Requirement 6.4, 6.5)
 * - Barcode scanning for asset creation (Requirement 6.4)
 * - Linking assets to purchase orders (Requirement 6.5)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';
import { resolveEffectiveVendor } from '../procurement/vendor-resolution';

const logger = createLogger({ service: 'receiving-repository' });

/**
 * Receiving record status
 */
export type ReceivingStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Receiving line condition
 */
export type ReceivingCondition =
  | 'NEW'
  | 'GOOD'
  | 'DAMAGED'
  | 'DEFECTIVE';

/**
 * Asset status for newly received assets
 */
export type AssetStatus =
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'DEPLOYED'
  | 'IN_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED';

/**
 * Inspection status for quality inspection workflow
 * Requirement 13: Enhanced Receiving Workflow
 */
export type InspectionStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PASSED'
  | 'FAILED';

/**
 * Inspection result for recording inspection outcomes
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 */
export type InspectionResult = 'PASSED' | 'FAILED';

/**
 * Inspection record entity
 * Requirement 13.1, 13.4: Track inspection history per asset
 */
export interface InspectionRecord {
  readonly inspectionId: UUID;
  readonly receivingLineId: UUID;
  readonly assetId: UUID | null;
  readonly serialNumber: string | null;
  readonly inspectionStatus: InspectionStatus;
  readonly inspectedBy: UUID | null;
  readonly inspectedByName: string | null;
  readonly inspectedDate: string | null;
  readonly result: InspectionResult | null;
  readonly notes: string | null;
  readonly failureReason: string | null;
  readonly routedToReturn: boolean;
  readonly returnOrderId: UUID | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create inspection record input
 * Requirement 13.1: Mark received items for quality inspection
 */
export interface CreateInspectionRecordInput {
  readonly receivingLineId: UUID;
  readonly assetId?: UUID;
  readonly serialNumber?: string;
  readonly notes?: string;
}

/**
 * Record inspection result input
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 */
export interface RecordInspectionResultInput {
  readonly inspectionId: UUID;
  readonly inspectedBy: UUID;
  readonly inspectedByName?: string;
  readonly result: InspectionResult;
  readonly notes?: string;
  readonly failureReason?: string;
}

/**
 * Inspection history filter
 * Requirement 13.4: Track inspection history per asset
 */
export interface InspectionHistoryFilter {
  readonly assetId?: UUID;
  readonly receivingLineId?: UUID;
  readonly receivingId?: UUID;
  readonly status?: InspectionStatus;
  readonly result?: InspectionResult;
}

/**
 * Receiving record entity
 */
export interface ReceivingRecord {
  readonly receivingId: UUID;
  readonly poId: UUID | null;
  readonly poNumber: string | null;
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
  readonly receivedBy: UUID;
  readonly receivedByName: string | null;
  readonly receivedDate: string;
  readonly stockroomId: UUID | null;
  readonly stockroomName: string | null;
  readonly status: ReceivingStatus;
  readonly notes: string | null;
  readonly totalLinesExpected: number;
  readonly totalLinesReceived: number;
  readonly totalQuantityExpected: number;
  readonly totalQuantityReceived: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Receiving line entity
 */
export interface ReceivingLine {
  readonly lineId: UUID;
  readonly receivingId: UUID;
  readonly poLineId: UUID | null;
  readonly lineNumber: number;
  readonly productId: UUID | null;
  readonly productType: string | null;
  readonly productName: string | null;
  readonly quantityExpected: number;
  readonly quantityReceived: number;
  readonly condition: ReceivingCondition;
  readonly assetIdsCreated: UUID[];
  readonly serialNumbersScanned: string[];
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Scanned asset result
 */
export interface ScannedAsset {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly serialNumber: string | null;
  readonly productName: string | null;
  readonly status: AssetStatus;
  readonly receivingLineId: UUID;
  readonly receivingId: UUID;
  readonly poId: UUID | null;
  readonly createdAt: string;
}

/**
 * Create receiving record input
 */
export interface CreateReceivingRecordInput {
  readonly poId?: UUID;
  readonly receivedBy: UUID;
  readonly receivedByName?: string;
  readonly stockroomId?: UUID;
  readonly notes?: string;
}

/**
 * Create receiving line input
 */
export interface CreateReceivingLineInput {
  readonly receivingId: UUID;
  readonly poLineId?: UUID;
  readonly productId?: UUID;
  readonly productType?: string;
  readonly productName: string;
  readonly quantityExpected: number;
  readonly notes?: string;
}

/**
 * Record asset scan input
 */
export interface RecordAssetScanInput {
  readonly receivingLineId: UUID;
  readonly serialNumber?: string;
  readonly barcode?: string;
  readonly condition?: ReceivingCondition;
  readonly productName?: string;
  readonly productType?: string;
  readonly notes?: string;
}

/**
 * Database row types
 */
interface ReceivingRecordRow {
  receiving_id: string;
  po_id: string | null;
  po_number: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  received_by: string;
  received_by_name: string | null;
  received_date: string;
  stockroom_id: string | null;
  stockroom_name: string | null;
  status: ReceivingStatus;
  notes: string | null;
  total_lines_expected: number;
  total_lines_received: number;
  total_line_count?: number;
  total_quantity_expected: number;
  total_quantity_received: number;
  created_at: string;
  updated_at: string;
}

interface ReceivingLineRow {
  line_id: string;
  receiving_id: string;
  po_line_id: string | null;
  line_number: number;
  product_id: string | null;
  product_type: string | null;
  product_name: string | null;
  product_description?: string | null;
  quantity_expected: number;
  quantity_received: number;
  condition: ReceivingCondition;
  asset_ids_created: string[] | null;
  serial_numbers_scanned: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AssetRow {
  asset_id: string;
  asset_tag: string;
  serial_number: string | null;
  display_name: string | null;
  status: AssetStatus;
  created_at: string;
}

interface PurchaseOrderLineRow {
  line_id: string;
  po_id: string;
  product_id: string | null;
  product_type: string | null;
  product_name: string | null;
  quantity: number;
  received_quantity: number;
  vendor_id: string | null;
  vendor_name: string | null;
  header_vendor_id: string | null;
  header_vendor_name: string | null;
}

/**
 * Inspection record database row
 */
interface InspectionRecordRow {
  inspection_id: string;
  receiving_line_id: string;
  asset_id: string | null;
  serial_number: string | null;
  inspection_status: InspectionStatus;
  inspected_by: string | null;
  inspected_by_name: string | null;
  inspected_date: string | null;
  result: InspectionResult | null;
  notes: string | null;
  failure_reason: string | null;
  routed_to_return: boolean;
  return_order_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to ReceivingRecord
 */
function mapRowToReceivingRecord(row: ReceivingRecordRow): ReceivingRecord {
  const totalLinesExpected =
    row.total_lines_expected ?? row.total_line_count ?? 0;
  const totalLinesReceived = row.total_lines_received ?? 0;

  return {
    receivingId: row.receiving_id,
    poId: row.po_id,
    poNumber: row.po_number,
    vendorId: row.vendor_id ?? null,
    vendorName: row.vendor_name ?? null,
    receivedBy: row.received_by,
    receivedByName: row.received_by_name,
    receivedDate: row.received_date,
    stockroomId: row.stockroom_id,
    stockroomName: row.stockroom_name,
    status: row.status,
    notes: row.notes,
    totalLinesExpected,
    totalLinesReceived,
    totalQuantityExpected: row.total_quantity_expected,
    totalQuantityReceived: row.total_quantity_received,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ReceivingLine
 */
function mapRowToReceivingLine(row: ReceivingLineRow): ReceivingLine {
  const productName = row.product_name ?? row.product_description ?? null;

  return {
    lineId: row.line_id,
    receivingId: row.receiving_id,
    poLineId: row.po_line_id,
    lineNumber: row.line_number,
    productId: row.product_id,
    productType: row.product_type,
    productName,
    quantityExpected: row.quantity_expected,
    quantityReceived: row.quantity_received,
    condition: row.condition,
    assetIdsCreated: row.asset_ids_created ?? [],
    serialNumbersScanned: row.serial_numbers_scanned ?? [],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Generate a unique asset tag
 */
function generateAssetTag(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AST-${timestamp}-${random}`;
}

let receivingSchemaChecked = false;
let receivingSchemaCheckPromise: Promise<void> | null = null;

async function ensureReceivingSchemaCompatibility(): Promise<void> {
  if (receivingSchemaChecked) {
    return;
  }
  if (receivingSchemaCheckPromise) {
    return receivingSchemaCheckPromise;
  }

  receivingSchemaCheckPromise = (async () => {
    const rows = await queryMany<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN ('receiving_records', 'receiving_lines', 'purchase_orders', 'purchase_order_lines')`
    );

    const byTable = new Map();
    for (const row of rows) {
      const cols = byTable.get(row.table_name) ?? new Set();
      cols.add(row.column_name);
      byTable.set(row.table_name, cols);
    }

    const required = {
      receiving_records: [
        'receiving_id',
        'receiving_number',
        'po_id',
        'received_by',
        'received_date',
        'stockroom_id',
        'status',
      ],
      receiving_lines: [
        'line_id',
        'receiving_id',
        'po_line_id',
        'line_number',
        'product_description',
        'quantity_expected',
        'quantity_received',
      ],
      purchase_orders: ['po_id', 'po_number', 'vendor_id'],
      purchase_order_lines: [
        'line_id',
        'po_id',
        'product_id',
        'product_type',
        'product_description',
        'quantity',
        'received_quantity',
      ],
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
      throw new Error(`receiving schema mismatch: missing columns ${missing.join(', ')}`);
    }

    receivingSchemaChecked = true;
  })();

  try {
    await receivingSchemaCheckPromise;
  } finally {
    receivingSchemaCheckPromise = null;
  }
}

/**
 * Create a receiving record
 * Requirement 6.4, 6.5: Record receiving of assets
 */
export async function createReceivingRecord(
  input: CreateReceivingRecordInput
): Promise<ReceivingRecord> {
  await ensureReceivingSchemaCompatibility();

  const timestamp = now();

  // Get PO number if poId provided
  let poNumber: string | null = null;
  let vendorId: string | null = null;
  let vendorName: string | null = null;
  let stockroomName: string | null = null;
  let effectiveStockroomId: string | null = input.stockroomId ?? null;

  if (input.poId) {
    const poRow = await queryOne<{ po_number: string; vendor_id: string | null; vendor_name: string | null }>(
      `SELECT
        po.po_number,
        po.vendor_id,
        v.vendor_name
       FROM purchase_orders po
       LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
       WHERE po.po_id = $1`,
      [input.poId]
    );
    poNumber = poRow?.po_number ?? null;
    vendorId = poRow?.vendor_id ?? null;
    vendorName = poRow?.vendor_name ?? null;
  }

  if (effectiveStockroomId) {
    const stockroomRow = await queryOne<{ name: string }>(
      'SELECT name FROM stockrooms WHERE stockroom_id = $1',
      [effectiveStockroomId]
    );
    stockroomName = stockroomRow?.name ?? null;
  } else {
    // receiving_records.stockroom_id is NOT NULL in current schema, so pick a deterministic active stockroom
    const defaultStockroom = await queryOne<{ stockroom_id: string; name: string }>(
      `SELECT stockroom_id, name
       FROM stockrooms
       WHERE is_active = TRUE
       ORDER BY name ASC
       LIMIT 1`
    );
    effectiveStockroomId = defaultStockroom?.stockroom_id ?? null;
    stockroomName = defaultStockroom?.name ?? null;
  }

  if (!effectiveStockroomId) {
    throw new Error('No active stockroom is available for receiving');
  }

  const result = await queryOne<ReceivingRecordRow>(
    `INSERT INTO receiving_records (
      receiving_number, po_id, received_by, received_date,
      stockroom_id, status, notes,
      total_line_count,
      total_quantity_expected, total_quantity_received,
      created_at, updated_at
    ) VALUES (generate_receiving_number(), $1, $2, $3, $4, 'IN_PROGRESS', $5, 0, 0, 0, $3, $3)
    RETURNING *,
      NULL::text as received_by_name,
      total_line_count as total_lines_expected,
      0::integer as total_lines_received,
      $6::text as po_number,
      $7::text as stockroom_name,
      $8::uuid as vendor_id,
      $9::text as vendor_name`,
    [
      input.poId ?? null,
      input.receivedBy,
      timestamp,
      effectiveStockroomId,
      input.notes ?? null,
      poNumber,
      stockroomName,
      vendorId,
      vendorName,
    ]
  );

  if (!result) {
    throw new Error('Failed to create receiving record');
  }

  logger.info('Receiving record created', {
    receivingId: result.receiving_id,
    poId: input.poId,
    receivedBy: input.receivedBy,
  });

  return mapRowToReceivingRecord(result);
}

/**
 * Get receiving record by ID
 */
export async function getReceivingRecordById(receivingId: UUID): Promise<ReceivingRecord | null> {
  await ensureReceivingSchemaCompatibility();

  const result = await queryOne<ReceivingRecordRow>(
    `SELECT rr.*,
      po.po_number,
      po.vendor_id,
      v.vendor_name,
      s.name as stockroom_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as received_by_name,
      rr.total_line_count as total_lines_expected,
      0::integer as total_lines_received
     FROM receiving_records rr
     LEFT JOIN purchase_orders po ON rr.po_id = po.po_id
     LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
     LEFT JOIN stockrooms s ON rr.stockroom_id = s.stockroom_id
     LEFT JOIN users u ON rr.received_by = u.user_id
     WHERE rr.receiving_id = $1`,
    [receivingId]
  );

  return result ? mapRowToReceivingRecord(result) : null;
}

/**
 * Get receiving records by purchase order
 */
export async function getReceivingRecordsByPO(poId: UUID): Promise<ReceivingRecord[]> {
  await ensureReceivingSchemaCompatibility();

  const rows = await queryMany<ReceivingRecordRow>(
    `SELECT rr.*,
      po.po_number,
      po.vendor_id,
      v.vendor_name,
      s.name as stockroom_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as received_by_name,
      rr.total_line_count as total_lines_expected,
      0::integer as total_lines_received
     FROM receiving_records rr
     LEFT JOIN purchase_orders po ON rr.po_id = po.po_id
     LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
     LEFT JOIN stockrooms s ON rr.stockroom_id = s.stockroom_id
     LEFT JOIN users u ON rr.received_by = u.user_id
     WHERE rr.po_id = $1
     ORDER BY rr.created_at DESC`,
    [poId]
  );

  return rows.map(mapRowToReceivingRecord);
}

/**
 * Create receiving line from PO line
 *
 * Uses the effective vendor for the receiving record by resolving
 * line-level vendor (if set) with fallback to header-level vendor.
 * Requirements: 6.1, 6.2
 */
export async function createReceivingLineFromPO(
  receivingId: UUID,
  poLineId: UUID
): Promise<ReceivingLine> {
  await ensureReceivingSchemaCompatibility();

  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get PO line details with vendor info from both line and header
    const poLine = await ctx.queryOne<PurchaseOrderLineRow>(
      `SELECT
         pol.line_id,
         pol.po_id,
         pol.product_id,
         pol.product_type,
         pol.product_description as product_name,
         pol.quantity,
         pol.received_quantity,
         NULL::uuid AS vendor_id,
         NULL::text AS vendor_name,
         po.vendor_id AS header_vendor_id,
         v.vendor_name AS header_vendor_name
       FROM purchase_order_lines pol
        JOIN purchase_orders po ON pol.po_id = po.po_id
        LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
        WHERE pol.line_id = $1`,
      [poLineId]
    );

    if (!poLine) {
      throw new Error(`Purchase order line not found: ${poLineId}`);
    }

    // Resolve effective vendor: line-level overrides header-level
    const effectiveVendor = resolveEffectiveVendor(
      poLine.vendor_id,
      poLine.vendor_name,
      poLine.header_vendor_id,
      poLine.header_vendor_name
    );

    // Get current line count for this receiving record
    const countResult = await ctx.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM receiving_lines WHERE receiving_id = $1',
      [receivingId]
    );
    const lineNumber = parseInt(countResult?.count ?? '0', 10) + 1;

    // Create receiving line
    const result = await ctx.queryOne<ReceivingLineRow>(
      `INSERT INTO receiving_lines (
        receiving_id, po_line_id, line_number,
        product_id, product_type, product_description,
        quantity_expected, quantity_received, condition,
        asset_ids_created, serial_numbers_scanned, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'NEW', '{}', '{}', NULL, $8, $8)
      RETURNING *`,
      [
        receivingId,
        poLineId,
        lineNumber,
        poLine.product_id,
        poLine.product_type,
        poLine.product_name,
        poLine.quantity - poLine.received_quantity, // Remaining quantity to receive
        timestamp,
      ]
    );

    if (!result) {
      throw new Error('Failed to create receiving line');
    }

    // Update receiving record totals
    await ctx.queryOne(
      `UPDATE receiving_records SET
        total_line_count = total_line_count + 1,
        total_quantity_expected = total_quantity_expected + $1,
        updated_at = $2
       WHERE receiving_id = $3`,
      [poLine.quantity - poLine.received_quantity, timestamp, receivingId]
    );

    // Publish event with effective vendor info for downstream consumers
    logger.info('Receiving line created from PO', {
      lineId: result.line_id,
      receivingId,
      poLineId,
      quantityExpected: poLine.quantity - poLine.received_quantity,
      effectiveVendorId: effectiveVendor.vendorId,
      effectiveVendorName: effectiveVendor.vendorName,
    });

    return mapRowToReceivingLine(result);
  });
}

/**
 * Create receiving line manually (without PO)
 */
export async function createReceivingLine(
  input: CreateReceivingLineInput
): Promise<ReceivingLine> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get current line count for this receiving record
    const countResult = await ctx.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM receiving_lines WHERE receiving_id = $1',
      [input.receivingId]
    );
    const lineNumber = parseInt(countResult?.count ?? '0', 10) + 1;

    // Create receiving line
    const result = await ctx.queryOne<ReceivingLineRow>(
      `INSERT INTO receiving_lines (
        receiving_id, po_line_id, line_number,
        product_id, product_type, product_description,
        quantity_expected, quantity_received, condition,
        asset_ids_created, serial_numbers_scanned, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'NEW', '{}', '{}', $8, $9, $9)
      RETURNING *`,
      [
        input.receivingId,
        input.poLineId ?? null,
        lineNumber,
        input.productId ?? null,
        input.productType ?? null,
        input.productName,
        input.quantityExpected,
        input.notes ?? null,
        timestamp,
      ]
    );

    if (!result) {
      throw new Error('Failed to create receiving line');
    }

    // Update receiving record totals
    await ctx.queryOne(
      `UPDATE receiving_records SET
        total_line_count = total_line_count + 1,
        total_quantity_expected = total_quantity_expected + $1,
        updated_at = $2
       WHERE receiving_id = $3`,
      [input.quantityExpected, timestamp, input.receivingId]
    );

    logger.info('Receiving line created', {
      lineId: result.line_id,
      receivingId: input.receivingId,
      productName: input.productName,
      quantityExpected: input.quantityExpected,
    });

    return mapRowToReceivingLine(result);
  });
}

/**
 * Get receiving lines for a receiving record
 */
export async function getReceivingLines(receivingId: UUID): Promise<ReceivingLine[]> {
  const rows = await queryMany<ReceivingLineRow>(
    'SELECT * FROM receiving_lines WHERE receiving_id = $1 ORDER BY line_number ASC',
    [receivingId]
  );

  return rows.map(mapRowToReceivingLine);
}

/**
 * Get receiving line by ID
 */
export async function getReceivingLineById(lineId: UUID): Promise<ReceivingLine | null> {
  const result = await queryOne<ReceivingLineRow>(
    'SELECT * FROM receiving_lines WHERE line_id = $1',
    [lineId]
  );

  return result ? mapRowToReceivingLine(result) : null;
}

/**
 * Record asset scan and create asset
 * Requirement 6.4: Support barcode scanning to create asset records automatically
 * Requirement 6.5: Update status to In_Stock and associate with purchase order
 */
export async function recordAssetScan(
  input: RecordAssetScanInput
): Promise<ScannedAsset> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const assetTag = generateAssetTag();

    // Get receiving line details
    const receivingLine = await ctx.queryOne<ReceivingLineRow>(
      'SELECT * FROM receiving_lines WHERE line_id = $1 FOR UPDATE',
      [input.receivingLineId]
    );

    if (!receivingLine) {
      throw new Error(`Receiving line not found: ${input.receivingLineId}`);
    }

    // Check if we've already received all expected items
    if (receivingLine.quantity_received >= receivingLine.quantity_expected) {
      throw new Error(
        `All items already received for this line: expected=${receivingLine.quantity_expected}, received=${receivingLine.quantity_received}`
      );
    }

    // Get receiving record for PO association
    const receivingRecord = await ctx.queryOne<{ po_id: string | null; stockroom_id: string | null }>(
      'SELECT po_id, stockroom_id FROM receiving_records WHERE receiving_id = $1',
      [receivingLine.receiving_id]
    );

    // Create the asset record with status IN_STOCK
    const assetResult = await ctx.queryOne<AssetRow>(
      `INSERT INTO assets (
        asset_tag, asset_type, display_name, description,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'IN_STOCK', $5, $5)
      RETURNING asset_id, asset_tag, NULL as serial_number, display_name, status, created_at`,
      [
        assetTag,
        input.productType ?? receivingLine.product_type ?? 'HARDWARE',
        input.productName ?? receivingLine.product_name ?? receivingLine.product_description ?? 'Unknown Product',
        input.notes ?? null,
        timestamp,
      ]
    );

    if (!assetResult) {
      throw new Error('Failed to create asset');
    }

    // If this is a hardware asset, create hardware_assets record with serial number and PO link
    if ((input.productType ?? receivingLine.product_type ?? 'HARDWARE') === 'HARDWARE') {
      await ctx.queryOne(
        `INSERT INTO hardware_assets (
          asset_id, serial_number, purchase_order_id, received_date, stockroom_id
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          assetResult.asset_id,
          input.serialNumber ?? null,
          receivingRecord?.po_id ?? null,
          timestamp,
          receivingRecord?.stockroom_id ?? null,
        ]
      );
    }

    // Update receiving line with new asset
    const updatedSerialNumbers = [...(receivingLine.serial_numbers_scanned ?? [])];
    if (input.serialNumber) {
      updatedSerialNumbers.push(input.serialNumber);
    }

    const updatedAssetIds = [...(receivingLine.asset_ids_created ?? []), assetResult.asset_id];

    await ctx.queryOne(
      `UPDATE receiving_lines SET
        quantity_received = quantity_received + 1,
        condition = COALESCE($1, condition),
        asset_ids_created = $2,
        serial_numbers_scanned = $3,
        updated_at = $4
       WHERE line_id = $5`,
      [
        input.condition ?? null,
        updatedAssetIds,
        updatedSerialNumbers,
        timestamp,
        input.receivingLineId,
      ]
    );

    // Update receiving record totals
    await ctx.queryOne(
      `UPDATE receiving_records SET
        total_quantity_received = total_quantity_received + 1,
        status = CASE 
          WHEN total_quantity_received + 1 >= total_quantity_expected THEN 'COMPLETED'
          ELSE 'IN_PROGRESS'
        END,
        updated_at = $1
       WHERE receiving_id = $2`,
      [timestamp, receivingLine.receiving_id]
    );

    // Update PO line received quantity if linked to PO
    if (receivingLine.po_line_id) {
      await ctx.queryOne(
        `UPDATE purchase_order_lines SET
          quantity_received = quantity_received + 1,
          updated_at = $1
         WHERE line_id = $2`,
        [timestamp, receivingLine.po_line_id]
      );

      // Check if all PO lines are received and update PO status
      const poLineStatus = await ctx.queryOne<{ all_received: boolean }>(
        `SELECT NOT EXISTS (
          SELECT 1 FROM purchase_order_lines
          WHERE po_id = (SELECT po_id FROM purchase_order_lines WHERE line_id = $1)
          AND quantity_received < quantity
        ) as all_received`,
        [receivingLine.po_line_id]
      );

      if (poLineStatus?.all_received) {
        await ctx.queryOne(
          `UPDATE purchase_orders SET
            status = 'RECEIVED',
            actual_delivery_date = $1,
            updated_at = $1
           WHERE po_id = (SELECT po_id FROM purchase_order_lines WHERE line_id = $2)`,
          [timestamp, receivingLine.po_line_id]
        );
      } else {
        await ctx.queryOne(
          `UPDATE purchase_orders SET
            status = 'PARTIALLY_RECEIVED',
            updated_at = $1
           WHERE po_id = (SELECT po_id FROM purchase_order_lines WHERE line_id = $2)
           AND status NOT IN ('PARTIALLY_RECEIVED', 'RECEIVED')`,
          [timestamp, receivingLine.po_line_id]
        );
      }
    }

    logger.info('Asset scanned and created', {
      assetId: assetResult.asset_id,
      assetTag,
      serialNumber: input.serialNumber,
      receivingLineId: input.receivingLineId,
      poId: receivingRecord?.po_id,
    });

    return {
      assetId: assetResult.asset_id,
      assetTag: assetResult.asset_tag,
      serialNumber: input.serialNumber ?? null,
      productName: (input.productName ?? receivingLine.product_name ?? receivingLine.product_description) ?? null,
      status: 'IN_STOCK',
      receivingLineId: input.receivingLineId,
      receivingId: receivingLine.receiving_id,
      poId: receivingRecord?.po_id ?? null,
      createdAt: assetResult.created_at,
    };
  });
}

/**
 * Update receiving record status
 */
export async function updateReceivingRecordStatus(
  receivingId: UUID,
  status: ReceivingStatus
): Promise<ReceivingRecord | null> {
  const timestamp = now();

  const result = await queryOne<ReceivingRecordRow>(
    `UPDATE receiving_records SET
      status = $1,
      updated_at = $2
     WHERE receiving_id = $3
     RETURNING *`,
    [status, timestamp, receivingId]
  );

  if (result) {
    logger.info('Receiving record status updated', { receivingId, status });
  }

  return result ? mapRowToReceivingRecord(result) : null;
}

/**
 * Get receiving records with pagination
 */
export async function getReceivingRecords(
  pagination: PaginationParams = {},
  statusFilter?: ReceivingStatus[]
): Promise<PaginatedResult<ReceivingRecord>> {
  await ensureReceivingSchemaCompatibility();

  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    const statusPlaceholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause += ` AND rr.status IN (${statusPlaceholders})`;
    params.push(...statusFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM receiving_records rr ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<ReceivingRecordRow>(
    `SELECT rr.*,
      po.po_number,
      po.vendor_id,
      v.vendor_name,
      s.name as stockroom_name,
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as received_by_name,
      rr.total_line_count as total_lines_expected,
      0::integer as total_lines_received
     FROM receiving_records rr
     LEFT JOIN purchase_orders po ON rr.po_id = po.po_id
     LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
     LEFT JOIN stockrooms s ON rr.stockroom_id = s.stockroom_id
     LEFT JOIN users u ON rr.received_by = u.user_id
     ${whereClause}
     ORDER BY rr.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToReceivingRecord),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get assets created from a receiving record
 */
export async function getAssetsFromReceiving(receivingId: UUID): Promise<ScannedAsset[]> {
  const rows = await queryMany<{
    asset_id: string;
    asset_tag: string;
    serial_number: string | null;
    display_name: string | null;
    status: AssetStatus;
    receiving_line_id: string;
    receiving_id: string;
    po_id: string | null;
    created_at: string;
  }>(
    `SELECT 
      a.asset_id,
      a.asset_tag,
      ha.serial_number,
      a.display_name,
      a.status,
      rl.line_id as receiving_line_id,
      rl.receiving_id,
      rr.po_id,
      a.created_at
     FROM assets a
     LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id
     JOIN receiving_lines rl ON a.asset_id = ANY(rl.asset_ids_created)
     JOIN receiving_records rr ON rl.receiving_id = rr.receiving_id
     WHERE rl.receiving_id = $1
     ORDER BY a.created_at ASC`,
    [receivingId]
  );

  return rows.map((row) => ({
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    productName: row.display_name,
    status: row.status,
    receivingLineId: row.receiving_line_id,
    receivingId: row.receiving_id,
    poId: row.po_id,
    createdAt: row.created_at,
  }));
}

/**
 * Map database row to InspectionRecord
 */
function mapRowToInspectionRecord(row: InspectionRecordRow): InspectionRecord {
  return {
    inspectionId: row.inspection_id,
    receivingLineId: row.receiving_line_id,
    assetId: row.asset_id,
    serialNumber: row.serial_number,
    inspectionStatus: row.inspection_status,
    inspectedBy: row.inspected_by,
    inspectedByName: row.inspected_by_name,
    inspectedDate: row.inspected_date,
    result: row.result,
    notes: row.notes,
    failureReason: row.failure_reason,
    routedToReturn: row.routed_to_return,
    returnOrderId: row.return_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create an inspection record for a received item
 * Requirement 13.1: Mark received items for quality inspection
 */
export async function createInspectionRecord(
  input: CreateInspectionRecordInput
): Promise<InspectionRecord> {
  const timestamp = now();

  // Verify receiving line exists
  const receivingLine = await queryOne<ReceivingLineRow>(
    'SELECT * FROM receiving_lines WHERE line_id = $1',
    [input.receivingLineId]
  );

  if (!receivingLine) {
    throw new Error(`Receiving line not found: ${input.receivingLineId}`);
  }

  const result = await queryOne<InspectionRecordRow>(
    `INSERT INTO inspection_records (
      receiving_line_id, asset_id, serial_number,
      inspection_status, notes,
      routed_to_return, created_at, updated_at
    ) VALUES ($1, $2, $3, 'PENDING', $4, FALSE, $5, $5)
    RETURNING *`,
    [
      input.receivingLineId,
      input.assetId ?? null,
      input.serialNumber ?? null,
      input.notes ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create inspection record');
  }

  logger.info('Inspection record created', {
    inspectionId: result.inspection_id,
    receivingLineId: input.receivingLineId,
    assetId: input.assetId,
    serialNumber: input.serialNumber,
  });

  return mapRowToInspectionRecord(result);
}

/**
 * Get inspection record by ID
 */
export async function getInspectionRecordById(inspectionId: UUID): Promise<InspectionRecord | null> {
  const result = await queryOne<InspectionRecordRow>(
    'SELECT * FROM inspection_records WHERE inspection_id = $1',
    [inspectionId]
  );

  return result ? mapRowToInspectionRecord(result) : null;
}

/**
 * Get inspection records for a receiving line
 */
export async function getInspectionRecordsByReceivingLine(
  receivingLineId: UUID
): Promise<InspectionRecord[]> {
  const rows = await queryMany<InspectionRecordRow>(
    'SELECT * FROM inspection_records WHERE receiving_line_id = $1 ORDER BY created_at ASC',
    [receivingLineId]
  );

  return rows.map(mapRowToInspectionRecord);
}

/**
 * Get inspection records for a receiving record
 */
export async function getInspectionRecordsByReceiving(
  receivingId: UUID
): Promise<InspectionRecord[]> {
  const rows = await queryMany<InspectionRecordRow>(
    `SELECT ir.* FROM inspection_records ir
     JOIN receiving_lines rl ON ir.receiving_line_id = rl.line_id
     WHERE rl.receiving_id = $1
     ORDER BY ir.created_at ASC`,
    [receivingId]
  );

  return rows.map(mapRowToInspectionRecord);
}

/**
 * Get inspection history for an asset
 * Requirement 13.4: Track inspection history per asset
 */
export async function getInspectionHistoryByAsset(assetId: UUID): Promise<InspectionRecord[]> {
  const rows = await queryMany<InspectionRecordRow>(
    'SELECT * FROM inspection_records WHERE asset_id = $1 ORDER BY created_at DESC',
    [assetId]
  );

  return rows.map(mapRowToInspectionRecord);
}

/**
 * Get inspection records with filters
 * Requirement 13.4: Track inspection history per asset
 */
export async function getInspectionRecords(
  filter: InspectionHistoryFilter,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<InspectionRecord>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (filter.assetId) {
    whereClause += ` AND ir.asset_id = $${paramIndex++}`;
    params.push(filter.assetId);
  }

  if (filter.receivingLineId) {
    whereClause += ` AND ir.receiving_line_id = $${paramIndex++}`;
    params.push(filter.receivingLineId);
  }

  if (filter.receivingId) {
    whereClause += ` AND rl.receiving_id = $${paramIndex++}`;
    params.push(filter.receivingId);
  }

  if (filter.status) {
    whereClause += ` AND ir.inspection_status = $${paramIndex++}`;
    params.push(filter.status);
  }

  if (filter.result) {
    whereClause += ` AND ir.result = $${paramIndex++}`;
    params.push(filter.result);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM inspection_records ir
     LEFT JOIN receiving_lines rl ON ir.receiving_line_id = rl.line_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<InspectionRecordRow>(
    `SELECT ir.* FROM inspection_records ir
     LEFT JOIN receiving_lines rl ON ir.receiving_line_id = rl.line_id
     ${whereClause}
     ORDER BY ir.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToInspectionRecord),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Update inspection status
 */
export async function updateInspectionStatus(
  inspectionId: UUID,
  status: InspectionStatus
): Promise<InspectionRecord | null> {
  const timestamp = now();

  const result = await queryOne<InspectionRecordRow>(
    `UPDATE inspection_records SET
      inspection_status = $1,
      updated_at = $2
     WHERE inspection_id = $3
     RETURNING *`,
    [status, timestamp, inspectionId]
  );

  if (result) {
    logger.info('Inspection status updated', { inspectionId, status });
  }

  return result ? mapRowToInspectionRecord(result) : null;
}

/**
 * Record inspection result
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 */
export async function recordInspectionResult(
  input: RecordInspectionResultInput
): Promise<InspectionRecord> {
  const timestamp = now();

  // Get current inspection record
  const currentRecord = await queryOne<InspectionRecordRow>(
    'SELECT * FROM inspection_records WHERE inspection_id = $1',
    [input.inspectionId]
  );

  if (!currentRecord) {
    throw new Error(`Inspection record not found: ${input.inspectionId}`);
  }

  // Determine new status based on result
  const newStatus: InspectionStatus = input.result === 'PASSED' ? 'PASSED' : 'FAILED';

  const result = await queryOne<InspectionRecordRow>(
    `UPDATE inspection_records SET
      inspection_status = $1,
      inspected_by = $2,
      inspected_by_name = $3,
      inspected_date = $4,
      result = $5,
      notes = COALESCE($6, notes),
      failure_reason = $7,
      updated_at = $4
     WHERE inspection_id = $8
     RETURNING *`,
    [
      newStatus,
      input.inspectedBy,
      input.inspectedByName ?? null,
      timestamp,
      input.result,
      input.notes ?? null,
      input.result === 'FAILED' ? (input.failureReason ?? null) : null,
      input.inspectionId,
    ]
  );

  if (!result) {
    throw new Error(`Failed to record inspection result: ${input.inspectionId}`);
  }

  logger.info('Inspection result recorded', {
    inspectionId: input.inspectionId,
    result: input.result,
    inspectedBy: input.inspectedBy,
  });

  return mapRowToInspectionRecord(result);
}

/**
 * Route failed inspection to return workflow
 * Requirement 13.3: Route failed inspections to return workflow
 */
export async function routeInspectionToReturn(
  inspectionId: UUID,
  returnOrderId: UUID
): Promise<InspectionRecord> {
  const timestamp = now();

  // Verify inspection exists and is failed
  const currentRecord = await queryOne<InspectionRecordRow>(
    'SELECT * FROM inspection_records WHERE inspection_id = $1',
    [inspectionId]
  );

  if (!currentRecord) {
    throw new Error(`Inspection record not found: ${inspectionId}`);
  }

  if (currentRecord.result !== 'FAILED') {
    throw new Error(`Cannot route non-failed inspection to return: ${inspectionId}`);
  }

  if (currentRecord.routed_to_return) {
    throw new Error(`Inspection already routed to return: ${inspectionId}`);
  }

  const result = await queryOne<InspectionRecordRow>(
    `UPDATE inspection_records SET
      routed_to_return = TRUE,
      return_order_id = $1,
      updated_at = $2
     WHERE inspection_id = $3
     RETURNING *`,
    [returnOrderId, timestamp, inspectionId]
  );

  if (!result) {
    throw new Error(`Failed to route inspection to return: ${inspectionId}`);
  }

  logger.info('Inspection routed to return', {
    inspectionId,
    returnOrderId,
  });

  return mapRowToInspectionRecord(result);
}

/**
 * Get pending inspections count for a receiving record
 */
export async function getPendingInspectionsCount(receivingId: UUID): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM inspection_records ir
     JOIN receiving_lines rl ON ir.receiving_line_id = rl.line_id
     WHERE rl.receiving_id = $1 AND ir.inspection_status IN ('PENDING', 'IN_PROGRESS')`,
    [receivingId]
  );

  return parseInt(result?.count ?? '0', 10);
}

/**
 * Get failed inspections for a receiving record
 */
export async function getFailedInspections(receivingId: UUID): Promise<InspectionRecord[]> {
  const rows = await queryMany<InspectionRecordRow>(
    `SELECT ir.* FROM inspection_records ir
     JOIN receiving_lines rl ON ir.receiving_line_id = rl.line_id
     WHERE rl.receiving_id = $1 AND ir.result = 'FAILED'
     ORDER BY ir.created_at ASC`,
    [receivingId]
  );

  return rows.map(mapRowToInspectionRecord);
}
