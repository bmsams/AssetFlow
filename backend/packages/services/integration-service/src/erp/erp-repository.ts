/**
 * ERP Integration Repository - Data access layer
 *
 * Implements database operations for:
 * - Purchase order storage and retrieval
 * - Cost center storage and retrieval
 * - ERP sync audit logging
 *
 * Requirements:
 * - 7.3: Sync purchase orders from ERP systems (SAP, Oracle, Workday)
 * - 7.4: Sync cost centers from ERP systems
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

import type {
  CostCenterStatus,
  ERPConnectionConfig,
  ERPCostCenter,
  ERPPurchaseOrder,
  ERPPurchaseOrderStatus,
  ERPSyncAuditLog,
  ERPSyncDirection,
  ERPSyncOperation,
  ERPSyncStatus,
  ERPSystemType,
} from './erp-types';

const logger = createLogger({ service: 'erp-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

interface ERPConnectionConfigRow {
  connection_id: string;
  erp_system: ERPSystemType;
  connection_name: string;
  base_url: string;
  auth_type: 'BASIC' | 'OAUTH2' | 'API_KEY' | 'CERTIFICATE';
  is_active: boolean;
  sync_direction: ERPSyncDirection;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ERPPurchaseOrderRow {
  erp_purchase_order_id: string;
  erp_system: ERPSystemType;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  status: ERPPurchaseOrderStatus;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  currency: string;
  requester_id: string | null;
  requester_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  company_code: string | null;
  plant_code: string | null;
  lines_json: string;
  notes: string | null;
  local_po_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ERPCostCenterRow {
  erp_cost_center_id: string;
  erp_system: ERPSystemType;
  cost_center_code: string;
  name: string;
  description: string | null;
  status: CostCenterStatus;
  parent_cost_center_id: string | null;
  manager_id: string | null;
  manager_name: string | null;
  company_code: string | null;
  department_id: string | null;
  department_name: string | null;
  budget_amount: number | null;
  spent_amount: number | null;
  currency: string | null;
  fiscal_year: number | null;
  valid_from: string | null;
  valid_to: string | null;
  local_cost_center_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ERPSyncAuditLogRow {
  audit_log_id: string;
  erp_system: ERPSystemType;
  operation: ERPSyncOperation;
  direction: ERPSyncDirection;
  status: ERPSyncStatus;
  total_records: number;
  success_count: number;
  failure_count: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  created_by: string | null;
}

interface LocalPurchaseOrderRow {
  po_id: string;
  po_number: string;
  vendor_id: string;
  status: string;
  order_date: string;
  total_amount: number;
}

interface LocalCostCenterRow {
  cost_center_id: string;
  code: string;
  name: string;
  department_id: string | null;
  budget_amount: number | null;
  spent_amount: number | null;
  fiscal_year: number | null;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapRowToConnectionConfig(row: ERPConnectionConfigRow): ERPConnectionConfig {
  return {
    connectionId: row.connection_id,
    erpSystem: row.erp_system,
    connectionName: row.connection_name,
    baseUrl: row.base_url,
    authType: row.auth_type,
    isActive: row.is_active,
    syncDirection: row.sync_direction,
    syncIntervalMinutes: row.sync_interval_minutes,
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToPurchaseOrder(row: ERPPurchaseOrderRow): ERPPurchaseOrder {
  return {
    erpPurchaseOrderId: row.erp_purchase_order_id,
    erpSystem: row.erp_system,
    poNumber: row.po_number,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    status: row.status,
    orderDate: row.order_date,
    expectedDeliveryDate: row.expected_delivery_date ?? undefined,
    totalAmount: row.total_amount,
    currency: row.currency,
    requesterId: row.requester_id ?? undefined,
    requesterName: row.requester_name ?? undefined,
    approverId: row.approver_id ?? undefined,
    approverName: row.approver_name ?? undefined,
    costCenterId: row.cost_center_id ?? undefined,
    costCenterName: row.cost_center_name ?? undefined,
    companyCode: row.company_code ?? undefined,
    plantCode: row.plant_code ?? undefined,
    lines: JSON.parse(row.lines_json),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToCostCenter(row: ERPCostCenterRow): ERPCostCenter {
  return {
    erpCostCenterId: row.erp_cost_center_id,
    erpSystem: row.erp_system,
    costCenterCode: row.cost_center_code,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    parentCostCenterId: row.parent_cost_center_id ?? undefined,
    managerId: row.manager_id ?? undefined,
    managerName: row.manager_name ?? undefined,
    companyCode: row.company_code ?? undefined,
    departmentId: row.department_id ?? undefined,
    departmentName: row.department_name ?? undefined,
    budgetAmount: row.budget_amount ?? undefined,
    spentAmount: row.spent_amount ?? undefined,
    currency: row.currency ?? undefined,
    fiscalYear: row.fiscal_year ?? undefined,
    validFrom: row.valid_from ?? undefined,
    validTo: row.valid_to ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToAuditLog(row: ERPSyncAuditLogRow): ERPSyncAuditLog {
  return {
    auditLogId: row.audit_log_id,
    erpSystem: row.erp_system,
    operation: row.operation,
    direction: row.direction,
    status: row.status,
    totalRecords: row.total_records,
    successCount: row.success_count,
    failureCount: row.failure_count,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdBy: row.created_by ?? undefined,
  };
}

// ============================================================================
// Connection Configuration Operations
// ============================================================================

/**
 * Get ERP connection configuration by system type
 */
export async function getERPConnectionConfig(
  erpSystem: ERPSystemType
): Promise<ERPConnectionConfig | null> {
  const result = await queryOne<ERPConnectionConfigRow>(
    `SELECT * FROM erp_connection_configs
     WHERE erp_system = $1 AND is_active = true`,
    [erpSystem]
  );

  return result ? mapRowToConnectionConfig(result) : null;
}

/**
 * Get ERP connection configuration by ID
 */
export async function getERPConnectionConfigById(
  connectionId: UUID
): Promise<ERPConnectionConfig | null> {
  const result = await queryOne<ERPConnectionConfigRow>(
    `SELECT * FROM erp_connection_configs WHERE connection_id = $1`,
    [connectionId]
  );

  return result ? mapRowToConnectionConfig(result) : null;
}

/**
 * Update last sync timestamp for ERP connection
 */
export async function updateERPConnectionLastSync(
  connectionId: UUID
): Promise<void> {
  await queryOne(
    `UPDATE erp_connection_configs
     SET last_sync_at = NOW(), updated_at = NOW()
     WHERE connection_id = $1`,
    [connectionId]
  );
}

// ============================================================================
// Purchase Order Operations
// ============================================================================

/**
 * Find ERP purchase order by ERP ID
 */
export async function findERPPurchaseOrderByErpId(
  erpSystem: ERPSystemType,
  erpPurchaseOrderId: string
): Promise<ERPPurchaseOrder | null> {
  const result = await queryOne<ERPPurchaseOrderRow>(
    `SELECT * FROM erp_purchase_orders
     WHERE erp_system = $1 AND erp_purchase_order_id = $2`,
    [erpSystem, erpPurchaseOrderId]
  );

  return result ? mapRowToPurchaseOrder(result) : null;
}

/**
 * Find ERP purchase order by PO number
 */
export async function findERPPurchaseOrderByPoNumber(
  erpSystem: ERPSystemType,
  poNumber: string
): Promise<ERPPurchaseOrder | null> {
  const result = await queryOne<ERPPurchaseOrderRow>(
    `SELECT * FROM erp_purchase_orders
     WHERE erp_system = $1 AND po_number = $2`,
    [erpSystem, poNumber]
  );

  return result ? mapRowToPurchaseOrder(result) : null;
}

/**
 * Create or update ERP purchase order
 * Requirement 7.3: Sync purchase orders from ERP systems
 */
export async function upsertERPPurchaseOrder(
  purchaseOrder: ERPPurchaseOrder
): Promise<{ created: boolean; localPoId?: UUID }> {
  logger.info('Upserting ERP purchase order', {
    erpSystem: purchaseOrder.erpSystem,
    poNumber: purchaseOrder.poNumber,
    erpPurchaseOrderId: purchaseOrder.erpPurchaseOrderId,
  });

  // Check if record exists
  const existing = await findERPPurchaseOrderByErpId(
    purchaseOrder.erpSystem,
    purchaseOrder.erpPurchaseOrderId
  );

  if (existing) {
    // Update existing record
    await queryOne(
      `UPDATE erp_purchase_orders SET
        po_number = $3, vendor_id = $4, vendor_name = $5, status = $6,
        order_date = $7, expected_delivery_date = $8, total_amount = $9,
        currency = $10, requester_id = $11, requester_name = $12,
        approver_id = $13, approver_name = $14, cost_center_id = $15,
        cost_center_name = $16, company_code = $17, plant_code = $18,
        lines_json = $19, notes = $20, updated_at = NOW()
       WHERE erp_system = $1 AND erp_purchase_order_id = $2`,
      [
        purchaseOrder.erpSystem,
        purchaseOrder.erpPurchaseOrderId,
        purchaseOrder.poNumber,
        purchaseOrder.vendorId,
        purchaseOrder.vendorName,
        purchaseOrder.status,
        purchaseOrder.orderDate,
        purchaseOrder.expectedDeliveryDate ?? null,
        purchaseOrder.totalAmount,
        purchaseOrder.currency,
        purchaseOrder.requesterId ?? null,
        purchaseOrder.requesterName ?? null,
        purchaseOrder.approverId ?? null,
        purchaseOrder.approverName ?? null,
        purchaseOrder.costCenterId ?? null,
        purchaseOrder.costCenterName ?? null,
        purchaseOrder.companyCode ?? null,
        purchaseOrder.plantCode ?? null,
        JSON.stringify(purchaseOrder.lines),
        purchaseOrder.notes ?? null,
      ]
    );

    return { created: false };
  }

  // Insert new record
  await queryOne(
    `INSERT INTO erp_purchase_orders (
      erp_purchase_order_id, erp_system, po_number, vendor_id, vendor_name,
      status, order_date, expected_delivery_date, total_amount, currency,
      requester_id, requester_name, approver_id, approver_name,
      cost_center_id, cost_center_name, company_code, plant_code,
      lines_json, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
    [
      purchaseOrder.erpPurchaseOrderId,
      purchaseOrder.erpSystem,
      purchaseOrder.poNumber,
      purchaseOrder.vendorId,
      purchaseOrder.vendorName,
      purchaseOrder.status,
      purchaseOrder.orderDate,
      purchaseOrder.expectedDeliveryDate ?? null,
      purchaseOrder.totalAmount,
      purchaseOrder.currency,
      purchaseOrder.requesterId ?? null,
      purchaseOrder.requesterName ?? null,
      purchaseOrder.approverId ?? null,
      purchaseOrder.approverName ?? null,
      purchaseOrder.costCenterId ?? null,
      purchaseOrder.costCenterName ?? null,
      purchaseOrder.companyCode ?? null,
      purchaseOrder.plantCode ?? null,
      JSON.stringify(purchaseOrder.lines),
      purchaseOrder.notes ?? null,
    ]
  );

  // Try to link to local purchase order by PO number
  const localPo = await queryOne<LocalPurchaseOrderRow>(
    `SELECT po_id FROM purchase_orders WHERE po_number = $1`,
    [purchaseOrder.poNumber]
  );

  if (localPo) {
    await queryOne(
      `UPDATE erp_purchase_orders SET local_po_id = $3
       WHERE erp_system = $1 AND erp_purchase_order_id = $2`,
      [purchaseOrder.erpSystem, purchaseOrder.erpPurchaseOrderId, localPo.po_id]
    );
    return { created: true, localPoId: localPo.po_id };
  }

  return { created: true };
}

/**
 * Get ERP purchase orders by system
 */
export async function getERPPurchaseOrdersBySystem(
  erpSystem: ERPSystemType,
  limit = 100
): Promise<ERPPurchaseOrder[]> {
  const rows = await queryMany<ERPPurchaseOrderRow>(
    `SELECT * FROM erp_purchase_orders
     WHERE erp_system = $1
     ORDER BY order_date DESC
     LIMIT $2`,
    [erpSystem, limit]
  );

  return rows.map(mapRowToPurchaseOrder);
}

/**
 * Get local purchase orders for outbound sync
 */
export async function getLocalPurchaseOrdersForSync(
  fromDate?: string,
  toDate?: string
): Promise<LocalPurchaseOrderRow[]> {
  let query = `SELECT po_id, po_number, vendor_id, status, order_date, total_amount
               FROM purchase_orders WHERE 1=1`;
  const params: (string | undefined)[] = [];
  let paramIndex = 1;

  if (fromDate) {
    query += ` AND order_date >= $${paramIndex}`;
    params.push(fromDate);
    paramIndex++;
  }

  if (toDate) {
    query += ` AND order_date <= $${paramIndex}`;
    params.push(toDate);
  }

  query += ' ORDER BY order_date DESC LIMIT 1000';

  return queryMany<LocalPurchaseOrderRow>(query, params);
}

// ============================================================================
// Cost Center Operations
// ============================================================================

/**
 * Find ERP cost center by ERP ID
 */
export async function findERPCostCenterByErpId(
  erpSystem: ERPSystemType,
  erpCostCenterId: string
): Promise<ERPCostCenter | null> {
  const result = await queryOne<ERPCostCenterRow>(
    `SELECT * FROM erp_cost_centers
     WHERE erp_system = $1 AND erp_cost_center_id = $2`,
    [erpSystem, erpCostCenterId]
  );

  return result ? mapRowToCostCenter(result) : null;
}

/**
 * Find ERP cost center by code
 */
export async function findERPCostCenterByCode(
  erpSystem: ERPSystemType,
  costCenterCode: string
): Promise<ERPCostCenter | null> {
  const result = await queryOne<ERPCostCenterRow>(
    `SELECT * FROM erp_cost_centers
     WHERE erp_system = $1 AND cost_center_code = $2`,
    [erpSystem, costCenterCode]
  );

  return result ? mapRowToCostCenter(result) : null;
}

/**
 * Create or update ERP cost center
 * Requirement 7.4: Sync cost centers from ERP systems
 */
export async function upsertERPCostCenter(
  costCenter: ERPCostCenter
): Promise<{ created: boolean; localCostCenterId?: UUID }> {
  logger.info('Upserting ERP cost center', {
    erpSystem: costCenter.erpSystem,
    costCenterCode: costCenter.costCenterCode,
    erpCostCenterId: costCenter.erpCostCenterId,
  });

  // Check if record exists
  const existing = await findERPCostCenterByErpId(
    costCenter.erpSystem,
    costCenter.erpCostCenterId
  );

  if (existing) {
    // Update existing record
    await queryOne(
      `UPDATE erp_cost_centers SET
        cost_center_code = $3, name = $4, description = $5, status = $6,
        parent_cost_center_id = $7, manager_id = $8, manager_name = $9,
        company_code = $10, department_id = $11, department_name = $12,
        budget_amount = $13, spent_amount = $14, currency = $15,
        fiscal_year = $16, valid_from = $17, valid_to = $18, updated_at = NOW()
       WHERE erp_system = $1 AND erp_cost_center_id = $2`,
      [
        costCenter.erpSystem,
        costCenter.erpCostCenterId,
        costCenter.costCenterCode,
        costCenter.name,
        costCenter.description ?? null,
        costCenter.status,
        costCenter.parentCostCenterId ?? null,
        costCenter.managerId ?? null,
        costCenter.managerName ?? null,
        costCenter.companyCode ?? null,
        costCenter.departmentId ?? null,
        costCenter.departmentName ?? null,
        costCenter.budgetAmount ?? null,
        costCenter.spentAmount ?? null,
        costCenter.currency ?? null,
        costCenter.fiscalYear ?? null,
        costCenter.validFrom ?? null,
        costCenter.validTo ?? null,
      ]
    );

    return { created: false };
  }

  // Insert new record
  await queryOne(
    `INSERT INTO erp_cost_centers (
      erp_cost_center_id, erp_system, cost_center_code, name, description,
      status, parent_cost_center_id, manager_id, manager_name, company_code,
      department_id, department_name, budget_amount, spent_amount, currency,
      fiscal_year, valid_from, valid_to
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      costCenter.erpCostCenterId,
      costCenter.erpSystem,
      costCenter.costCenterCode,
      costCenter.name,
      costCenter.description ?? null,
      costCenter.status,
      costCenter.parentCostCenterId ?? null,
      costCenter.managerId ?? null,
      costCenter.managerName ?? null,
      costCenter.companyCode ?? null,
      costCenter.departmentId ?? null,
      costCenter.departmentName ?? null,
      costCenter.budgetAmount ?? null,
      costCenter.spentAmount ?? null,
      costCenter.currency ?? null,
      costCenter.fiscalYear ?? null,
      costCenter.validFrom ?? null,
      costCenter.validTo ?? null,
    ]
  );

  // Try to link to local cost center by code
  const localCostCenter = await queryOne<LocalCostCenterRow>(
    `SELECT cost_center_id FROM cost_centers WHERE code = $1`,
    [costCenter.costCenterCode]
  );

  if (localCostCenter) {
    await queryOne(
      `UPDATE erp_cost_centers SET local_cost_center_id = $3
       WHERE erp_system = $1 AND erp_cost_center_id = $2`,
      [costCenter.erpSystem, costCenter.erpCostCenterId, localCostCenter.cost_center_id]
    );
    return { created: true, localCostCenterId: localCostCenter.cost_center_id };
  }

  return { created: true };
}

/**
 * Get ERP cost centers by system
 */
export async function getERPCostCentersBySystem(
  erpSystem: ERPSystemType,
  includeInactive = false,
  limit = 500
): Promise<ERPCostCenter[]> {
  let query = `SELECT * FROM erp_cost_centers WHERE erp_system = $1`;
  const params: (ERPSystemType | number)[] = [erpSystem];

  if (!includeInactive) {
    query += ` AND status = 'ACTIVE'`;
  }

  query += ` ORDER BY cost_center_code LIMIT $2`;
  params.push(limit);

  const rows = await queryMany<ERPCostCenterRow>(query, params);
  return rows.map(mapRowToCostCenter);
}

/**
 * Get local cost centers for outbound sync
 */
export async function getLocalCostCentersForSync(): Promise<LocalCostCenterRow[]> {
  return queryMany<LocalCostCenterRow>(
    `SELECT cost_center_id, code, name, department_id, budget_amount, spent_amount, fiscal_year
     FROM cost_centers
     ORDER BY code
     LIMIT 1000`
  );
}

/**
 * Create or update local cost center from ERP data
 */
export async function upsertLocalCostCenter(
  costCenter: ERPCostCenter
): Promise<UUID> {
  // Check if local cost center exists
  const existing = await queryOne<LocalCostCenterRow>(
    `SELECT cost_center_id FROM cost_centers WHERE code = $1`,
    [costCenter.costCenterCode]
  );

  if (existing) {
    // Update existing
    await queryOne(
      `UPDATE cost_centers SET
        name = $2, budget_amount = $3, spent_amount = $4,
        fiscal_year = $5, updated_at = NOW()
       WHERE cost_center_id = $1`,
      [
        existing.cost_center_id,
        costCenter.name,
        costCenter.budgetAmount ?? null,
        costCenter.spentAmount ?? null,
        costCenter.fiscalYear ?? null,
      ]
    );
    return existing.cost_center_id;
  }

  // Create new local cost center
  const result = await queryOne<{ cost_center_id: string }>(
    `INSERT INTO cost_centers (code, name, budget_amount, spent_amount, fiscal_year)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING cost_center_id`,
    [
      costCenter.costCenterCode,
      costCenter.name,
      costCenter.budgetAmount ?? null,
      costCenter.spentAmount ?? null,
      costCenter.fiscalYear ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create local cost center');
  }

  return result.cost_center_id;
}

// ============================================================================
// Audit Log Operations
// ============================================================================

/**
 * Create ERP sync audit log entry
 */
export async function createERPSyncAuditLog(
  erpSystem: ERPSystemType,
  operation: ERPSyncOperation,
  direction: ERPSyncDirection,
  createdBy?: UUID
): Promise<UUID> {
  const result = await queryOne<{ audit_log_id: string }>(
    `INSERT INTO erp_sync_audit_logs (
      erp_system, operation, direction, status, total_records,
      success_count, failure_count, started_at, created_by
    ) VALUES ($1, $2, $3, 'IN_PROGRESS', 0, 0, 0, NOW(), $4)
    RETURNING audit_log_id`,
    [erpSystem, operation, direction, createdBy ?? null]
  );

  if (!result) {
    throw new Error('Failed to create ERP sync audit log');
  }

  return result.audit_log_id;
}

/**
 * Update ERP sync audit log with results
 */
export async function updateERPSyncAuditLog(
  auditLogId: UUID,
  status: ERPSyncStatus,
  totalRecords: number,
  successCount: number,
  failureCount: number,
  errorMessage?: string
): Promise<void> {
  await queryOne(
    `UPDATE erp_sync_audit_logs SET
      status = $2, total_records = $3, success_count = $4,
      failure_count = $5, completed_at = NOW(), error_message = $6
     WHERE audit_log_id = $1`,
    [auditLogId, status, totalRecords, successCount, failureCount, errorMessage ?? null]
  );
}

/**
 * Get ERP sync audit logs
 */
export async function getERPSyncAuditLogs(
  erpSystem?: ERPSystemType,
  operation?: ERPSyncOperation,
  limit = 50
): Promise<ERPSyncAuditLog[]> {
  let query = `SELECT * FROM erp_sync_audit_logs WHERE 1=1`;
  const params: (ERPSystemType | ERPSyncOperation | number)[] = [];
  let paramIndex = 1;

  if (erpSystem) {
    query += ` AND erp_system = $${paramIndex}`;
    params.push(erpSystem);
    paramIndex++;
  }

  if (operation) {
    query += ` AND operation = $${paramIndex}`;
    params.push(operation);
    paramIndex++;
  }

  query += ` ORDER BY started_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const rows = await queryMany<ERPSyncAuditLogRow>(query, params);
  return rows.map(mapRowToAuditLog);
}

/**
 * Get latest sync audit log for a system and operation
 */
export async function getLatestERPSyncAuditLog(
  erpSystem: ERPSystemType,
  operation: ERPSyncOperation
): Promise<ERPSyncAuditLog | null> {
  const result = await queryOne<ERPSyncAuditLogRow>(
    `SELECT * FROM erp_sync_audit_logs
     WHERE erp_system = $1 AND operation = $2
     ORDER BY started_at DESC
     LIMIT 1`,
    [erpSystem, operation]
  );

  return result ? mapRowToAuditLog(result) : null;
}
