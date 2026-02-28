/**
 * Loaner Repository - Data access layer for loaner asset operations
 *
 * Implements database operations for:
 * - Loaner checkout tracking (Requirement 2E.8)
 * - Due date tracking and overdue detection (Requirement 3.8)
 * - Escalation level tracking for notifications (Requirement 3.9)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'loaner-repository' });

/**
 * Loaner checkout status
 */
export type LoanerStatus =
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'RETURNED_LATE'
  | 'RETURNED_DAMAGED'
  | 'OVERDUE'
  | 'LOST'
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
  | 'LOST';

/**
 * Loaner checkout entity
 */
export interface LoanerCheckout {
  readonly checkoutId: UUID;
  readonly checkoutNumber: string;
  readonly assetId: UUID;
  readonly checkedOutTo: UUID;
  readonly checkedOutBy: UUID;
  readonly checkoutDate: string;
  readonly dueDate: string;
  readonly returnDate: string | null;
  readonly returnedBy: UUID | null;
  readonly conditionOut: AssetCondition;
  readonly conditionIn: AssetCondition | null;
  readonly conditionOutNotes: string | null;
  readonly conditionInNotes: string | null;
  readonly purpose: string | null;
  readonly departmentId: UUID | null;
  readonly costCenterId: UUID | null;
  readonly projectCode: string | null;
  readonly status: LoanerStatus;
  readonly originalDueDate: string | null;
  readonly extensionCount: number;
  readonly lastExtensionDate: string | null;
  readonly extensionApprovedBy: UUID | null;
  readonly isOverdue: boolean;
  readonly overdueNotificationCount: number;
  readonly lastOverdueNotification: string | null;
  readonly escalationLevel: number;
  readonly dailyRate: number | null;
  readonly totalCharges: number | null;
  readonly damageCharges: number | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Create loaner checkout request
 */
export interface CreateLoanerCheckoutRequest {
  readonly assetId: UUID;
  readonly checkedOutTo: UUID;
  readonly checkedOutBy: UUID;
  readonly dueDate: string;
  readonly conditionOut: AssetCondition;
  readonly conditionOutNotes?: string;
  readonly purpose?: string;
  readonly departmentId?: UUID;
  readonly costCenterId?: UUID;
  readonly projectCode?: string;
  readonly dailyRate?: number;
  readonly notes?: string;
}

/**
 * Return loaner request
 */
export interface ReturnLoanerRequest {
  readonly returnedBy: UUID;
  readonly conditionIn: AssetCondition;
  readonly conditionInNotes?: string;
  readonly damageCharges?: number;
  readonly notes?: string;
}

/**
 * Overdue loaner with additional info
 */
export interface OverdueLoanerInfo {
  readonly checkout: LoanerCheckout;
  readonly daysOverdue: number;
  readonly borrowerEmail: string | null;
  readonly borrowerName: string | null;
  readonly managerEmail: string | null;
  readonly managerName: string | null;
  readonly assetTag: string;
  readonly assetName: string | null;
}

/**
 * Database row type
 */
interface LoanerCheckoutRow {
  checkout_id: string;
  checkout_number: string;
  asset_id: string;
  checked_out_to: string;
  checked_out_by: string;
  checkout_date: string;
  due_date: string;
  return_date: string | null;
  returned_by: string | null;
  condition_out: AssetCondition;
  condition_in: AssetCondition | null;
  condition_out_notes: string | null;
  condition_in_notes: string | null;
  purpose: string | null;
  department_id: string | null;
  cost_center_id: string | null;
  project_code: string | null;
  status: LoanerStatus;
  original_due_date: string | null;
  extension_count: number;
  last_extension_date: string | null;
  extension_approved_by: string | null;
  is_overdue: boolean;
  overdue_notification_count: number;
  last_overdue_notification: string | null;
  escalation_level: number;
  daily_rate: string | null;
  total_charges: string | null;
  damage_charges: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Map database row to LoanerCheckout entity
 */
function mapRowToLoanerCheckout(row: LoanerCheckoutRow): LoanerCheckout {
  return {
    checkoutId: row.checkout_id,
    checkoutNumber: row.checkout_number,
    assetId: row.asset_id,
    checkedOutTo: row.checked_out_to,
    checkedOutBy: row.checked_out_by,
    checkoutDate: row.checkout_date,
    dueDate: row.due_date,
    returnDate: row.return_date,
    returnedBy: row.returned_by,
    conditionOut: row.condition_out,
    conditionIn: row.condition_in,
    conditionOutNotes: row.condition_out_notes,
    conditionInNotes: row.condition_in_notes,
    purpose: row.purpose,
    departmentId: row.department_id,
    costCenterId: row.cost_center_id,
    projectCode: row.project_code,
    status: row.status,
    originalDueDate: row.original_due_date,
    extensionCount: row.extension_count,
    lastExtensionDate: row.last_extension_date,
    extensionApprovedBy: row.extension_approved_by,
    isOverdue: row.is_overdue,
    overdueNotificationCount: row.overdue_notification_count,
    lastOverdueNotification: row.last_overdue_notification,
    escalationLevel: row.escalation_level,
    dailyRate: row.daily_rate ? parseFloat(row.daily_rate) : null,
    totalCharges: row.total_charges ? parseFloat(row.total_charges) : null,
    damageCharges: row.damage_charges ? parseFloat(row.damage_charges) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Generate a unique checkout number
 */
function generateCheckoutNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LN-${timestamp}-${random}`;
}

/**
 * List all loaner checkouts with optional status filter and pagination
 */
export async function listCheckouts(
  pagination: PaginationParams = {},
  statusFilter?: LoanerStatus[]
): Promise<PaginatedResult<LoanerCheckout>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = '';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    const placeholders = statusFilter.map(() => `$${paramIndex++}`).join(', ');
    whereClause = `WHERE status IN (${placeholders})`;
    params.push(...statusFilter);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM loaner_checkouts ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LoanerCheckoutRow>(
    `SELECT * FROM loaner_checkouts ${whereClause}
     ORDER BY checkout_date DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToLoanerCheckout),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get loaner checkout by ID
 */
export async function getCheckoutById(checkoutId: UUID): Promise<LoanerCheckout | null> {
  const result = await queryOne<LoanerCheckoutRow>(
    'SELECT * FROM loaner_checkouts WHERE checkout_id = $1',
    [checkoutId]
  );

  return result ? mapRowToLoanerCheckout(result) : null;
}

/**
 * Get loaner checkout by checkout number
 */
export async function getCheckoutByNumber(checkoutNumber: string): Promise<LoanerCheckout | null> {
  const result = await queryOne<LoanerCheckoutRow>(
    'SELECT * FROM loaner_checkouts WHERE checkout_number = $1',
    [checkoutNumber]
  );

  return result ? mapRowToLoanerCheckout(result) : null;
}

/**
 * Get active checkout for an asset
 */
export async function getActiveCheckoutForAsset(assetId: UUID): Promise<LoanerCheckout | null> {
  const result = await queryOne<LoanerCheckoutRow>(
    `SELECT * FROM loaner_checkouts 
     WHERE asset_id = $1 AND status IN ('CHECKED_OUT', 'OVERDUE')
     ORDER BY checkout_date DESC
     LIMIT 1`,
    [assetId]
  );

  return result ? mapRowToLoanerCheckout(result) : null;
}

/**
 * Create a new loaner checkout
 * Requirement 3.8: Track loaner checkouts with due dates
 */
export async function createCheckout(
  request: CreateLoanerCheckoutRequest
): Promise<LoanerCheckout> {
  const timestamp = now();
  const checkoutNumber = generateCheckoutNumber();

  const result = await queryOne<LoanerCheckoutRow>(
    `INSERT INTO loaner_checkouts (
      checkout_number, asset_id, checked_out_to, checked_out_by,
      checkout_date, due_date, condition_out, condition_out_notes,
      purpose, department_id, cost_center_id, project_code,
      daily_rate, notes, status, is_overdue, escalation_level,
      created_at, updated_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'CHECKED_OUT', FALSE, 0, $5, $5, $4)
    RETURNING *`,
    [
      checkoutNumber,
      request.assetId,
      request.checkedOutTo,
      request.checkedOutBy,
      timestamp,
      request.dueDate,
      request.conditionOut,
      request.conditionOutNotes ?? null,
      request.purpose ?? null,
      request.departmentId ?? null,
      request.costCenterId ?? null,
      request.projectCode ?? null,
      request.dailyRate ?? null,
      request.notes ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create loaner checkout');
  }

  logger.info('Loaner checkout created', {
    checkoutId: result.checkout_id,
    checkoutNumber,
    assetId: request.assetId,
    checkedOutTo: request.checkedOutTo,
    dueDate: request.dueDate,
  });

  return mapRowToLoanerCheckout(result);
}

/**
 * Return a loaner asset
 * Requirement 3.8: Track loaner returns
 */
export async function returnLoaner(
  checkoutId: UUID,
  request: ReturnLoanerRequest
): Promise<LoanerCheckout | null> {
  return withTransaction(async (ctx) => {
    // Get current checkout with lock
    const current = await ctx.queryOne<LoanerCheckoutRow>(
      'SELECT * FROM loaner_checkouts WHERE checkout_id = $1 FOR UPDATE',
      [checkoutId]
    );

    if (!current) {
      return null;
    }

    if (current.status !== 'CHECKED_OUT' && current.status !== 'OVERDUE') {
      throw new Error(`Cannot return loaner with status: ${current.status}`);
    }

    const timestamp = now();
    const returnDateObj = new Date(timestamp);
    const dueDateObj = new Date(current.due_date);
    
    // Determine return status
    let status: LoanerStatus = 'RETURNED';
    if (request.conditionIn === 'DAMAGED' || request.conditionIn === 'LOST') {
      status = 'RETURNED_DAMAGED';
    } else if (returnDateObj > dueDateObj) {
      status = 'RETURNED_LATE';
    }

    // Calculate total charges if daily rate is set
    let totalCharges: number | null = null;
    if (current.daily_rate) {
      const checkoutDateObj = new Date(current.checkout_date);
      const daysOut = Math.ceil((returnDateObj.getTime() - checkoutDateObj.getTime()) / (1000 * 60 * 60 * 24));
      totalCharges = daysOut * parseFloat(current.daily_rate);
      if (request.damageCharges) {
        totalCharges += request.damageCharges;
      }
    }

    const result = await ctx.queryOne<LoanerCheckoutRow>(
      `UPDATE loaner_checkouts SET
        return_date = $1,
        returned_by = $2,
        condition_in = $3,
        condition_in_notes = $4,
        damage_charges = $5,
        total_charges = $6,
        status = $7,
        is_overdue = FALSE,
        notes = CASE WHEN $8 IS NOT NULL THEN COALESCE(notes || E'\n', '') || $8 ELSE notes END,
        updated_at = $1,
        updated_by = $2
       WHERE checkout_id = $9
       RETURNING *`,
      [
        timestamp,
        request.returnedBy,
        request.conditionIn,
        request.conditionInNotes ?? null,
        request.damageCharges ?? null,
        totalCharges,
        status,
        request.notes ?? null,
        checkoutId,
      ]
    );

    if (result) {
      logger.info('Loaner returned', {
        checkoutId,
        status,
        conditionIn: request.conditionIn,
        totalCharges,
      });
    }

    return result ? mapRowToLoanerCheckout(result) : null;
  });
}

/**
 * Get all overdue loaner checkouts
 * Requirement 3.8: Track overdue items
 * Requirement 3.9: Support escalating notifications
 */
export async function getOverdueCheckouts(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<OverdueLoanerInfo>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  // Count total overdue
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM loaner_checkouts 
     WHERE status IN ('CHECKED_OUT', 'OVERDUE') 
     AND due_date < CURRENT_DATE`,
    []
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get overdue checkouts with user and asset info
  const rows = await queryMany<LoanerCheckoutRow & {
    days_overdue: number;
    borrower_email: string | null;
    borrower_name: string | null;
    manager_email: string | null;
    manager_name: string | null;
    asset_tag: string;
    asset_name: string | null;
  }>(
    `SELECT 
      lc.*,
      (CURRENT_DATE - lc.due_date) as days_overdue,
      u.email as borrower_email,
      u.display_name as borrower_name,
      m.email as manager_email,
      m.display_name as manager_name,
      a.asset_tag,
      a.display_name as asset_name
     FROM loaner_checkouts lc
     LEFT JOIN users u ON lc.checked_out_to = u.user_id
     LEFT JOIN users m ON u.manager_id = m.user_id
     LEFT JOIN assets a ON lc.asset_id = a.asset_id
     WHERE lc.status IN ('CHECKED_OUT', 'OVERDUE')
     AND lc.due_date < CURRENT_DATE
     ORDER BY (CURRENT_DATE - lc.due_date) DESC, lc.due_date ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const items: OverdueLoanerInfo[] = rows.map(row => ({
    checkout: mapRowToLoanerCheckout(row),
    daysOverdue: row.days_overdue,
    borrowerEmail: row.borrower_email,
    borrowerName: row.borrower_name,
    managerEmail: row.manager_email,
    managerName: row.manager_name,
    assetTag: row.asset_tag,
    assetName: row.asset_name,
  }));

  return {
    items,
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Update overdue status and escalation level
 * Requirement 3.9: Track escalation levels for notifications
 */
export async function updateOverdueStatus(
  checkoutId: UUID,
  escalationLevel: number,
  notificationSent: boolean
): Promise<LoanerCheckout | null> {
  const timestamp = now();

  const result = await queryOne<LoanerCheckoutRow>(
    `UPDATE loaner_checkouts SET
      is_overdue = TRUE,
      status = 'OVERDUE',
      escalation_level = $1,
      overdue_notification_count = overdue_notification_count + CASE WHEN $2 THEN 1 ELSE 0 END,
      last_overdue_notification = CASE WHEN $2 THEN $3 ELSE last_overdue_notification END,
      updated_at = $3
     WHERE checkout_id = $4
     RETURNING *`,
    [escalationLevel, notificationSent, timestamp, checkoutId]
  );

  if (result) {
    logger.info('Overdue status updated', {
      checkoutId,
      escalationLevel,
      notificationSent,
    });
  }

  return result ? mapRowToLoanerCheckout(result) : null;
}

/**
 * Get checkouts for a user
 */
export async function getCheckoutsByUser(
  userId: UUID,
  includeReturned = false,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LoanerCheckout>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const statusCondition = includeReturned ? '' : "AND status IN ('CHECKED_OUT', 'OVERDUE')";

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM loaner_checkouts 
     WHERE checked_out_to = $1 ${statusCondition}`,
    [userId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LoanerCheckoutRow>(
    `SELECT * FROM loaner_checkouts 
     WHERE checked_out_to = $1 ${statusCondition}
     ORDER BY checkout_date DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    items: rows.map(mapRowToLoanerCheckout),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get checkout history for an asset
 */
export async function getCheckoutHistoryForAsset(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LoanerCheckout>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM loaner_checkouts WHERE asset_id = $1',
    [assetId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LoanerCheckoutRow>(
    `SELECT * FROM loaner_checkouts 
     WHERE asset_id = $1
     ORDER BY checkout_date DESC
     LIMIT $2 OFFSET $3`,
    [assetId, limit, offset]
  );

  return {
    items: rows.map(mapRowToLoanerCheckout),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Check if asset is available for checkout
 */
export async function isAssetAvailableForCheckout(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM loaner_checkouts 
     WHERE asset_id = $1 AND status IN ('CHECKED_OUT', 'OVERDUE')`,
    [assetId]
  );

  return parseInt(result?.count ?? '0', 10) === 0;
}

/**
 * Extend due date for a checkout
 */
export async function extendDueDate(
  checkoutId: UUID,
  newDueDate: string,
  approvedBy: UUID
): Promise<LoanerCheckout | null> {
  const timestamp = now();

  const result = await queryOne<LoanerCheckoutRow>(
    `UPDATE loaner_checkouts SET
      original_due_date = COALESCE(original_due_date, due_date),
      due_date = $1,
      extension_count = extension_count + 1,
      last_extension_date = CURRENT_DATE,
      extension_approved_by = $2,
      is_overdue = CASE WHEN $1 >= CURRENT_DATE THEN FALSE ELSE is_overdue END,
      status = CASE WHEN $1 >= CURRENT_DATE AND status = 'OVERDUE' THEN 'CHECKED_OUT' ELSE status END,
      updated_at = $3,
      updated_by = $2
     WHERE checkout_id = $4 AND status IN ('CHECKED_OUT', 'OVERDUE')
     RETURNING *`,
    [newDueDate, approvedBy, timestamp, checkoutId]
  );

  if (result) {
    logger.info('Due date extended', {
      checkoutId,
      newDueDate,
      approvedBy,
    });
  }

  return result ? mapRowToLoanerCheckout(result) : null;
}
