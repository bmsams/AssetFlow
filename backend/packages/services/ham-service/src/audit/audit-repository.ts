/**
 * Audit Repository - Data access layer for mobile audit operations
 *
 * Implements database operations for:
 * - Audit record management (Requirement 2E.9)
 * - Audit scan recording (Requirement 3.4)
 * - Discrepancy tracking (Requirement 3.5)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'audit-repository' });

/**
 * Audit types
 */
export type AuditType =
  | 'FULL'
  | 'CYCLE'
  | 'SPOT'
  | 'BLIND'
  | 'RECONCILIATION'
  | 'ANNUAL'
  | 'TRANSFER'
  | 'RECEIVING'
  | 'OTHER';

/**
 * Audit status
 */
export type AuditStatus =
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'UNDER_REVIEW'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ON_HOLD';

/**
 * Discrepancy types
 */
export type DiscrepancyType =
  | 'MISSING'
  | 'EXTRA'
  | 'WRONG_LOCATION'
  | 'WRONG_CONDITION'
  | 'QUANTITY_MISMATCH'
  | 'DATA_MISMATCH'
  | 'DAMAGED'
  | 'OTHER';

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
  | 'MISSING'
  | 'UNKNOWN';

/**
 * Audit record entity
 */
export interface AuditRecord {
  readonly auditId: UUID;
  readonly auditNumber: string;
  readonly stockroomId: UUID;
  readonly auditType: AuditType;
  readonly auditorId: UUID;
  readonly secondaryAuditorId: UUID | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly scheduledDate: string | null;
  readonly status: AuditStatus;
  readonly scopeDescription: string | null;
  readonly productTypes: readonly string[] | null;
  readonly binLocations: readonly string[] | null;
  readonly categories: readonly string[] | null;
  readonly discrepancyCount: number;
  readonly itemsExpected: number;
  readonly itemsFound: number;
  readonly itemsMissing: number;
  readonly itemsExtra: number;
  readonly itemsDamaged: number;
  readonly accuracyPercentage: number | null;
  readonly valueVariance: number | null;
  readonly completedBy: UUID | null;
  readonly completedDate: string | null;
  readonly approvedBy: UUID | null;
  readonly approvedDate: string | null;
  readonly requiresRecount: boolean;
  readonly recountAuditId: UUID | null;
  readonly correctiveActions: string | null;
  readonly notes: string | null;
  readonly findingsSummary: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Audit scan entity
 */
export interface AuditScan {
  readonly scanId: UUID;
  readonly auditId: UUID;
  readonly assetId: UUID | null;
  readonly assetTag: string | null;
  readonly serialNumber: string | null;
  readonly barcodeScanned: string | null;
  readonly scannedAt: string;
  readonly scannedBy: UUID;
  readonly expected: boolean;
  readonly found: boolean;
  readonly expectedLocation: string | null;
  readonly foundLocation: string | null;
  readonly binLocation: string | null;
  readonly expectedCondition: AssetCondition | null;
  readonly foundCondition: AssetCondition | null;
  readonly expectedQuantity: number;
  readonly foundQuantity: number;
  readonly isDiscrepancy: boolean;
  readonly discrepancyType: DiscrepancyType | null;
  readonly discrepancyNotes: string | null;
  readonly resolved: boolean;
  readonly resolvedBy: UUID | null;
  readonly resolvedAt: string | null;
  readonly resolutionNotes: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Create audit scan request
 */
export interface CreateAuditScanRequest {
  readonly auditId: UUID;
  readonly assetId?: UUID;
  readonly assetTag?: string;
  readonly serialNumber?: string;
  readonly barcodeScanned: string;
  readonly scannedBy: UUID;
  readonly expected?: boolean;
  readonly found?: boolean;
  readonly expectedLocation?: string;
  readonly foundLocation?: string;
  readonly binLocation?: string;
  readonly expectedCondition?: AssetCondition;
  readonly foundCondition?: AssetCondition;
  readonly expectedQuantity?: number;
  readonly foundQuantity?: number;
  readonly isDiscrepancy?: boolean;
  readonly discrepancyType?: DiscrepancyType;
  readonly discrepancyNotes?: string;
  readonly notes?: string;
}

/**
 * Discrepancy summary
 */
export interface DiscrepancySummary {
  readonly scanId: UUID;
  readonly auditId: UUID;
  readonly assetId: UUID | null;
  readonly assetTag: string | null;
  readonly serialNumber: string | null;
  readonly barcodeScanned: string | null;
  readonly discrepancyType: DiscrepancyType;
  readonly expectedLocation: string | null;
  readonly foundLocation: string | null;
  readonly expectedCondition: AssetCondition | null;
  readonly foundCondition: AssetCondition | null;
  readonly expectedQuantity: number;
  readonly foundQuantity: number;
  readonly discrepancyNotes: string | null;
  readonly resolved: boolean;
  readonly scannedAt: string;
  readonly scannedBy: UUID;
}

/**
 * Expected inventory item for audit
 */
export interface ExpectedInventoryItem {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly serialNumber: string | null;
  readonly expectedLocation: string | null;
  readonly expectedCondition: AssetCondition | null;
}

/**
 * Database row types
 */
interface AuditRecordRow {
  audit_id: string;
  audit_number: string;
  stockroom_id: string;
  audit_type: AuditType;
  auditor_id: string;
  secondary_auditor_id: string | null;
  start_date: string;
  end_date: string | null;
  scheduled_date: string | null;
  status: AuditStatus;
  scope_description: string | null;
  product_types: string[] | null;
  bin_locations: string[] | null;
  categories: string[] | null;
  discrepancy_count: number;
  items_expected: number;
  items_found: number;
  items_missing: number;
  items_extra: number;
  items_damaged: number;
  accuracy_percentage: string | null;
  value_variance: string | null;
  completed_by: string | null;
  completed_date: string | null;
  approved_by: string | null;
  approved_date: string | null;
  requires_recount: boolean;
  recount_audit_id: string | null;
  corrective_actions: string | null;
  notes: string | null;
  findings_summary: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface AuditScanRow {
  scan_id: string;
  audit_id: string;
  asset_id: string | null;
  asset_tag: string | null;
  serial_number: string | null;
  barcode_scanned: string | null;
  scanned_at: string;
  scanned_by: string;
  expected: boolean;
  found: boolean;
  expected_location: string | null;
  found_location: string | null;
  bin_location: string | null;
  expected_condition: AssetCondition | null;
  found_condition: AssetCondition | null;
  expected_quantity: number;
  found_quantity: number;
  is_discrepancy: boolean;
  discrepancy_type: DiscrepancyType | null;
  discrepancy_notes: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to AuditRecord entity
 */
function mapRowToAuditRecord(row: AuditRecordRow): AuditRecord {
  return {
    auditId: row.audit_id,
    auditNumber: row.audit_number,
    stockroomId: row.stockroom_id,
    auditType: row.audit_type,
    auditorId: row.auditor_id,
    secondaryAuditorId: row.secondary_auditor_id,
    startDate: row.start_date,
    endDate: row.end_date,
    scheduledDate: row.scheduled_date,
    status: row.status,
    scopeDescription: row.scope_description,
    productTypes: row.product_types,
    binLocations: row.bin_locations,
    categories: row.categories,
    discrepancyCount: row.discrepancy_count,
    itemsExpected: row.items_expected,
    itemsFound: row.items_found,
    itemsMissing: row.items_missing,
    itemsExtra: row.items_extra,
    itemsDamaged: row.items_damaged,
    accuracyPercentage: row.accuracy_percentage ? parseFloat(row.accuracy_percentage) : null,
    valueVariance: row.value_variance ? parseFloat(row.value_variance) : null,
    completedBy: row.completed_by,
    completedDate: row.completed_date,
    approvedBy: row.approved_by,
    approvedDate: row.approved_date,
    requiresRecount: row.requires_recount,
    recountAuditId: row.recount_audit_id,
    correctiveActions: row.corrective_actions,
    notes: row.notes,
    findingsSummary: row.findings_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Map database row to AuditScan entity
 */
function mapRowToAuditScan(row: AuditScanRow): AuditScan {
  return {
    scanId: row.scan_id,
    auditId: row.audit_id,
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    barcodeScanned: row.barcode_scanned,
    scannedAt: row.scanned_at,
    scannedBy: row.scanned_by,
    expected: row.expected,
    found: row.found,
    expectedLocation: row.expected_location,
    foundLocation: row.found_location,
    binLocation: row.bin_location,
    expectedCondition: row.expected_condition,
    foundCondition: row.found_condition,
    expectedQuantity: row.expected_quantity,
    foundQuantity: row.found_quantity,
    isDiscrepancy: row.is_discrepancy,
    discrepancyType: row.discrepancy_type,
    discrepancyNotes: row.discrepancy_notes,
    resolved: row.resolved,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get audit record by ID
 */
export async function getAuditById(auditId: UUID): Promise<AuditRecord | null> {
  const result = await queryOne<AuditRecordRow>(
    'SELECT * FROM audit_records WHERE audit_id = $1',
    [auditId]
  );

  return result ? mapRowToAuditRecord(result) : null;
}

/**
 * Get audit scans for an audit with pagination
 */
export async function getAuditScans(
  auditId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AuditScan>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM audit_scans WHERE audit_id = $1',
    [auditId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<AuditScanRow>(
    `SELECT * FROM audit_scans 
     WHERE audit_id = $1 
     ORDER BY scanned_at DESC 
     LIMIT $2 OFFSET $3`,
    [auditId, limit, offset]
  );

  return {
    items: rows.map(mapRowToAuditScan),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Create audit scan record
 * Requirement 3.4: Support barcode and QR code scanning
 */
export async function createAuditScan(
  request: CreateAuditScanRequest
): Promise<AuditScan> {
  const timestamp = now();

  const result = await queryOne<AuditScanRow>(
    `INSERT INTO audit_scans (
      audit_id, asset_id, asset_tag, serial_number, barcode_scanned,
      scanned_at, scanned_by, expected, found,
      expected_location, found_location, bin_location,
      expected_condition, found_condition,
      expected_quantity, found_quantity,
      is_discrepancy, discrepancy_type, discrepancy_notes, notes,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)
    RETURNING *`,
    [
      request.auditId,
      request.assetId ?? null,
      request.assetTag ?? null,
      request.serialNumber ?? null,
      request.barcodeScanned,
      timestamp,
      request.scannedBy,
      request.expected ?? true,
      request.found ?? true,
      request.expectedLocation ?? null,
      request.foundLocation ?? null,
      request.binLocation ?? null,
      request.expectedCondition ?? null,
      request.foundCondition ?? null,
      request.expectedQuantity ?? 1,
      request.foundQuantity ?? 1,
      request.isDiscrepancy ?? false,
      request.discrepancyType ?? null,
      request.discrepancyNotes ?? null,
      request.notes ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create audit scan');
  }

  logger.info('Audit scan created', {
    scanId: result.scan_id,
    auditId: request.auditId,
    barcodeScanned: request.barcodeScanned,
    isDiscrepancy: request.isDiscrepancy,
  });

  return mapRowToAuditScan(result);
}

/**
 * Update audit record counts after scan
 */
export async function updateAuditCounts(auditId: UUID): Promise<AuditRecord | null> {
  return withTransaction(async (ctx) => {
    // Calculate counts from scans
    const counts = await ctx.queryOne<{
      items_found: string;
      items_missing: string;
      items_extra: string;
      items_damaged: string;
      discrepancy_count: string;
    }>(
      `SELECT 
        COUNT(*) FILTER (WHERE found = TRUE) as items_found,
        COUNT(*) FILTER (WHERE expected = TRUE AND found = FALSE) as items_missing,
        COUNT(*) FILTER (WHERE expected = FALSE AND found = TRUE) as items_extra,
        COUNT(*) FILTER (WHERE found_condition = 'DAMAGED') as items_damaged,
        COUNT(*) FILTER (WHERE is_discrepancy = TRUE) as discrepancy_count
       FROM audit_scans WHERE audit_id = $1`,
      [auditId]
    );

    if (!counts) {
      return null;
    }

    const itemsFound = parseInt(counts.items_found, 10);
    const itemsMissing = parseInt(counts.items_missing, 10);
    const itemsExtra = parseInt(counts.items_extra, 10);
    const itemsDamaged = parseInt(counts.items_damaged, 10);
    const discrepancyCount = parseInt(counts.discrepancy_count, 10);

    // Get current audit to calculate accuracy
    const currentAudit = await ctx.queryOne<AuditRecordRow>(
      'SELECT * FROM audit_records WHERE audit_id = $1 FOR UPDATE',
      [auditId]
    );

    if (!currentAudit) {
      return null;
    }

    // Calculate accuracy percentage
    const itemsExpected = currentAudit.items_expected;
    let accuracyPercentage: number | null = null;
    if (itemsExpected > 0) {
      const matchedItems = itemsFound - itemsExtra;
      accuracyPercentage = Math.round((matchedItems / itemsExpected) * 10000) / 100;
    }

    const timestamp = now();

    const result = await ctx.queryOne<AuditRecordRow>(
      `UPDATE audit_records SET
        items_found = $1,
        items_missing = $2,
        items_extra = $3,
        items_damaged = $4,
        discrepancy_count = $5,
        accuracy_percentage = $6,
        updated_at = $7
       WHERE audit_id = $8
       RETURNING *`,
      [
        itemsFound,
        itemsMissing,
        itemsExtra,
        itemsDamaged,
        discrepancyCount,
        accuracyPercentage,
        timestamp,
        auditId,
      ]
    );

    return result ? mapRowToAuditRecord(result) : null;
  });
}

/**
 * Get discrepancies for an audit
 * Requirement 3.5: Compare scanned assets against expected inventory
 */
export async function getAuditDiscrepancies(
  auditId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<DiscrepancySummary>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM audit_scans WHERE audit_id = $1 AND is_discrepancy = TRUE',
    [auditId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<AuditScanRow>(
    `SELECT * FROM audit_scans 
     WHERE audit_id = $1 AND is_discrepancy = TRUE
     ORDER BY scanned_at DESC 
     LIMIT $2 OFFSET $3`,
    [auditId, limit, offset]
  );

  const discrepancies: DiscrepancySummary[] = rows.map((row) => ({
    scanId: row.scan_id,
    auditId: row.audit_id,
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    barcodeScanned: row.barcode_scanned,
    discrepancyType: row.discrepancy_type!,
    expectedLocation: row.expected_location,
    foundLocation: row.found_location,
    expectedCondition: row.expected_condition,
    foundCondition: row.found_condition,
    expectedQuantity: row.expected_quantity,
    foundQuantity: row.found_quantity,
    discrepancyNotes: row.discrepancy_notes,
    resolved: row.resolved,
    scannedAt: row.scanned_at,
    scannedBy: row.scanned_by,
  }));

  return {
    items: discrepancies,
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get expected inventory for a stockroom audit
 */
export async function getExpectedInventory(
  stockroomId: UUID
): Promise<ExpectedInventoryItem[]> {
  const rows = await queryMany<{
    asset_id: string;
    asset_tag: string;
    serial_number: string | null;
    bin_location: string | null;
    condition: string | null;
  }>(
    `SELECT 
      a.asset_id,
      a.asset_tag,
      ha.serial_number,
      ha.rack as bin_location,
      a.status as condition
     FROM assets a
     LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id
     WHERE ha.stockroom_id = $1 AND a.status NOT IN ('DISPOSED', 'RETIRED')
     ORDER BY a.asset_tag`,
    [stockroomId]
  );

  return rows.map((row) => ({
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    serialNumber: row.serial_number,
    expectedLocation: row.bin_location,
    expectedCondition: row.condition as AssetCondition | null,
  }));
}

/**
 * Check if asset was already scanned in this audit
 */
export async function isAssetAlreadyScanned(
  auditId: UUID,
  assetTag: string
): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM audit_scans WHERE audit_id = $1 AND asset_tag = $2',
    [auditId, assetTag]
  );

  return parseInt(result?.count ?? '0', 10) > 0;
}

/**
 * Find asset by barcode (asset tag or serial number)
 */
export async function findAssetByBarcode(
  barcode: string
): Promise<{ assetId: UUID; assetTag: string; serialNumber: string | null; stockroomId: UUID | null } | null> {
  // Try to find by asset tag first
  let result = await queryOne<{
    asset_id: string;
    asset_tag: string;
    serial_number: string | null;
    stockroom_id: string | null;
  }>(
    `SELECT a.asset_id, a.asset_tag, ha.serial_number, ha.stockroom_id
     FROM assets a
     LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id
     WHERE a.asset_tag = $1`,
    [barcode]
  );

  // If not found, try by serial number
  if (!result) {
    result = await queryOne<{
      asset_id: string;
      asset_tag: string;
      serial_number: string | null;
      stockroom_id: string | null;
    }>(
      `SELECT a.asset_id, a.asset_tag, ha.serial_number, ha.stockroom_id
       FROM assets a
       JOIN hardware_assets ha ON a.asset_id = ha.asset_id
       WHERE ha.serial_number = $1`,
      [barcode]
    );
  }

  if (!result) {
    return null;
  }

  return {
    assetId: result.asset_id,
    assetTag: result.asset_tag,
    serialNumber: result.serial_number,
    stockroomId: result.stockroom_id,
  };
}
