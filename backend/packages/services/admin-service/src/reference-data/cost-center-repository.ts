/**
 * Cost Center Repository - Data access layer for cost center management
 *
 * Implements database operations for:
 * - Cost Center CRUD operations (Requirement 8.1-8.5)
 * - Budget tracking and utilization calculations
 * - Expense recording and spent amount updates
 */

import type {
  CostCenterDetails,
  CostCenterListFilters,
  CreateCostCenterRequest,
  PaginatedResult,
  PaginationParams,
  UpdateCostCenterRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'cost-center-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for cost_centers table
 */
interface CostCenterRow {
  cost_center_id: string;
  code: string;
  name: string;
  description: string | null;
  department_id: string | null;
  budget_amount: string | null;
  spent_amount: string | null;
  available_amount: string | null;
  fiscal_year: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cost center dependencies row
 */
interface CostCenterDependenciesRow {
  asset_count: string;
  po_count: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to CostCenterDetails entity
 * Requirement 8.2: Return cost center details including current budget utilization
 */
function mapRowToCostCenter(row: CostCenterRow): CostCenterDetails {
  const budgetAmount = row.budget_amount ? parseFloat(row.budget_amount) : 0;
  const spentAmount = row.spent_amount ? parseFloat(row.spent_amount) : 0;
  const availableAmount = budgetAmount - spentAmount;

  return {
    costCenterId: row.cost_center_id,
    code: row.code,
    name: row.name,
    departmentId: row.department_id,
    budgetAmount,
    spentAmount,
    availableAmount,
    fiscalYear: row.fiscal_year ?? new Date().getFullYear(),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Cost Center Repository Functions
// ============================================================================

/**
 * Create a new cost center
 * Requirement 8.1: Create cost center with code, name, budget amount, and fiscal year
 */
export async function createCostCenter(
  request: CreateCostCenterRequest,
  userId?: UUID
): Promise<CostCenterDetails> {
  const timestamp = now();
  const availableAmount = request.budgetAmount;

  const result = await queryOne<CostCenterRow>(
    `INSERT INTO cost_centers (
      code, name, department_id, budget_amount, spent_amount, 
      available_amount, fiscal_year, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 0, $5, $6, TRUE, $7, $7)
    RETURNING *`,
    [
      request.code,
      request.name,
      request.departmentId ?? null,
      request.budgetAmount,
      availableAmount,
      request.fiscalYear,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create cost center');
  }

  logger.info('Cost center created', {
    costCenterId: result.cost_center_id,
    code: result.code,
    budgetAmount: request.budgetAmount,
    fiscalYear: request.fiscalYear,
    userId,
  });

  return mapRowToCostCenter(result);
}

/**
 * Get cost center by ID
 * Requirement 8.2: Return cost center details including current budget utilization
 */
export async function getCostCenterById(costCenterId: UUID): Promise<CostCenterDetails | null> {
  const result = await queryOne<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount, 
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     WHERE cost_center_id = $1`,
    [costCenterId]
  );

  return result ? mapRowToCostCenter(result) : null;
}

/**
 * Get cost center by code
 */
export async function getCostCenterByCode(code: string): Promise<CostCenterDetails | null> {
  const result = await queryOne<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     WHERE code = $1`,
    [code]
  );

  return result ? mapRowToCostCenter(result) : null;
}

/**
 * Get all cost centers
 */
export async function getAllCostCenters(): Promise<CostCenterDetails[]> {
  const rows = await queryMany<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     ORDER BY code ASC`
  );

  return rows.map(mapRowToCostCenter);
}

/**
 * Get active cost centers only
 */
export async function getActiveCostCenters(): Promise<CostCenterDetails[]> {
  const rows = await queryMany<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     WHERE is_active = TRUE
     ORDER BY code ASC`
  );

  return rows.map(mapRowToCostCenter);
}

/**
 * Get cost centers by fiscal year
 */
export async function getCostCentersByFiscalYear(fiscalYear: number): Promise<CostCenterDetails[]> {
  const rows = await queryMany<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     WHERE fiscal_year = $1
     ORDER BY code ASC`,
    [fiscalYear]
  );

  return rows.map(mapRowToCostCenter);
}

/**
 * Update cost center details
 * Requirement 8.3: Update specified fields including budget adjustments
 */
export async function updateCostCenter(
  costCenterId: UUID,
  request: UpdateCostCenterRequest,
  userId?: UUID
): Promise<CostCenterDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.departmentId !== undefined) {
    updates.push(`department_id = $${paramIndex++}`);
    values.push(request.departmentId);
  }

  if (request.budgetAmount !== undefined) {
    updates.push(`budget_amount = $${paramIndex++}`);
    values.push(request.budgetAmount);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getCostCenterById(costCenterId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(costCenterId);

  const sql = `UPDATE cost_centers 
               SET ${updates.join(', ')} 
               WHERE cost_center_id = $${paramIndex} 
               RETURNING cost_center_id, code, name, description, department_id,
                         budget_amount, spent_amount,
                         (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
                         fiscal_year, is_active, created_at, updated_at`;
  
  const result = await queryOne<CostCenterRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Cost center updated', { costCenterId, userId });

  return mapRowToCostCenter(result);
}

/**
 * Deactivate a cost center
 */
export async function deactivateCostCenter(
  costCenterId: UUID,
  userId?: UUID
): Promise<CostCenterDetails | null> {
  const timestamp = now();

  const result = await queryOne<CostCenterRow>(
    `UPDATE cost_centers 
     SET is_active = FALSE, updated_at = $1 
     WHERE cost_center_id = $2
     RETURNING cost_center_id, code, name, description, department_id,
               budget_amount, spent_amount,
               (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
               fiscal_year, is_active, created_at, updated_at`,
    [timestamp, costCenterId]
  );

  if (!result) {
    return null;
  }

  logger.info('Cost center deactivated', { costCenterId, userId });

  return mapRowToCostCenter(result);
}

/**
 * Delete a cost center (only if no dependencies)
 * Requirement 8.5: Reject deletion if cost center has associated assets or purchase orders
 */
export async function deleteCostCenter(costCenterId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM cost_centers WHERE cost_center_id = $1', [costCenterId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Cost center deleted', { costCenterId });
  }

  return deleted;
}

/**
 * Check if a cost center code already exists
 * Used for uniqueness validation
 */
export async function costCenterCodeExists(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE code = $1 AND cost_center_id != $2'
    : 'WHERE code = $1';
  const params = excludeId ? [code, excludeId] : [code];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM cost_centers ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Get cost center dependencies (asset count and PO count)
 * Requirement 8.5: Reject deletion if cost center has associated assets or purchase orders
 */
export async function getCostCenterDependencies(costCenterId: UUID): Promise<{
  assetCount: number;
  poCount: number;
}> {
  const result = await queryOne<CostCenterDependenciesRow>(
    `SELECT 
       COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE cost_center_id = $1), 0)::text as asset_count,
       COALESCE((SELECT COUNT(*) FROM purchase_orders WHERE cost_center_id = $1), 0)::text as po_count`,
    [costCenterId]
  );

  return {
    assetCount: parseInt(result?.asset_count ?? '0', 10),
    poCount: parseInt(result?.po_count ?? '0', 10),
  };
}

/**
 * List cost centers with pagination and filters
 */
export async function listCostCenters(
  filters: CostCenterListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CostCenterDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.departmentId !== undefined) {
    conditions.push(`department_id = $${paramIndex++}`);
    values.push(filters.departmentId);
  }

  if (filters.fiscalYear !== undefined) {
    conditions.push(`fiscal_year = $${paramIndex++}`);
    values.push(filters.fiscalYear);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM cost_centers ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const rows = await queryMany<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     ${whereClause}
     ORDER BY code ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.map(mapRowToCostCenter),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Update spent amount for a cost center
 * Requirement 8.4: Track spending against budget and calculate available amount
 */
export async function updateSpentAmount(
  costCenterId: UUID,
  amount: number
): Promise<CostCenterDetails | null> {
  const timestamp = now();

  const result = await queryOne<CostCenterRow>(
    `UPDATE cost_centers 
     SET spent_amount = $1, 
         available_amount = COALESCE(budget_amount, 0) - $1,
         updated_at = $2 
     WHERE cost_center_id = $3
     RETURNING cost_center_id, code, name, description, department_id,
               budget_amount, spent_amount,
               (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
               fiscal_year, is_active, created_at, updated_at`,
    [amount, timestamp, costCenterId]
  );

  if (!result) {
    return null;
  }

  logger.info('Cost center spent amount updated', { costCenterId, spentAmount: amount });

  return mapRowToCostCenter(result);
}

/**
 * Record an expense against a cost center
 * Requirement 8.4: Track spending against budget and calculate available amount
 */
export async function recordExpense(
  costCenterId: UUID,
  amount: number
): Promise<CostCenterDetails | null> {
  const timestamp = now();

  const result = await queryOne<CostCenterRow>(
    `UPDATE cost_centers 
     SET spent_amount = COALESCE(spent_amount, 0) + $1,
         available_amount = COALESCE(budget_amount, 0) - (COALESCE(spent_amount, 0) + $1),
         updated_at = $2 
     WHERE cost_center_id = $3
     RETURNING cost_center_id, code, name, description, department_id,
               budget_amount, spent_amount,
               (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
               fiscal_year, is_active, created_at, updated_at`,
    [amount, timestamp, costCenterId]
  );

  if (!result) {
    return null;
  }

  logger.info('Expense recorded for cost center', { costCenterId, expenseAmount: amount });

  return mapRowToCostCenter(result);
}

/**
 * Get cost center budget utilization percentage
 * Requirement 8.4: Track spending against budget and calculate available amount
 */
export async function getCostCenterUtilization(costCenterId: UUID): Promise<number | null> {
  const result = await queryOne<{ utilization: string }>(
    `SELECT 
       CASE 
         WHEN COALESCE(budget_amount, 0) = 0 THEN 0
         ELSE ROUND((COALESCE(spent_amount, 0) / budget_amount) * 100, 2)
       END as utilization
     FROM cost_centers
     WHERE cost_center_id = $1`,
    [costCenterId]
  );

  if (!result) {
    return null;
  }

  return parseFloat(result.utilization);
}

/**
 * Get cost centers by department
 */
export async function getCostCentersByDepartment(departmentId: UUID): Promise<CostCenterDetails[]> {
  const rows = await queryMany<CostCenterRow>(
    `SELECT cost_center_id, code, name, description, department_id,
            budget_amount, spent_amount,
            (COALESCE(budget_amount, 0) - COALESCE(spent_amount, 0)) as available_amount,
            fiscal_year, is_active, created_at, updated_at
     FROM cost_centers
     WHERE department_id = $1
     ORDER BY code ASC`,
    [departmentId]
  );

  return rows.map(mapRowToCostCenter);
}
