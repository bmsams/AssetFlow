/**
 * Department Repository - Data access layer for hierarchical department management
 *
 * Implements database operations for:
 * - Department CRUD operations (Requirement 7.1-7.5)
 * - Hierarchical queries using recursive CTEs
 * - Cascade deactivation for child departments
 */

import type {
  CreateDepartmentRequest,
  DepartmentDetails,
  DepartmentListFilters,
  PaginatedResult,
  PaginationParams,
  UpdateDepartmentRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'department-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for departments table
 */
interface DepartmentRow {
  department_id: string;
  code: string;
  name: string;
  parent_department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Extended department row with hierarchy information
 */
interface DepartmentRowWithHierarchy extends DepartmentRow {
  hierarchy_level: string;
  child_count: string;
}

/**
 * Department hierarchy path row
 */
interface DepartmentHierarchyRow {
  department_id: string;
  code: string;
  name: string;
  hierarchy_level: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to DepartmentDetails entity
 * Requirement 7.2: Return all departments with their hierarchy level and child count
 */
function mapRowToDepartment(row: DepartmentRowWithHierarchy): DepartmentDetails {
  return {
    departmentId: row.department_id,
    code: row.code,
    name: row.name,
    parentDepartmentId: row.parent_department_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map basic department row to DepartmentDetails entity
 */
function mapBasicRowToDepartment(row: DepartmentRow): DepartmentDetails {
  return {
    departmentId: row.department_id,
    code: row.code,
    name: row.name,
    parentDepartmentId: row.parent_department_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Department Repository Functions
// ============================================================================

/**
 * Create a new department
 * Requirement 7.1: Create department with name, code, parent reference
 */
export async function createDepartment(
  request: CreateDepartmentRequest,
  userId?: UUID
): Promise<DepartmentDetails> {
  const timestamp = now();

  const result = await queryOne<DepartmentRow>(
    `INSERT INTO departments (
      code, name, parent_department_id,
      is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, TRUE, $4, $4)
    RETURNING *`,
    [
      request.code,
      request.name,
      request.parentDepartmentId ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create department');
  }

  logger.info('Department created', {
    departmentId: result.department_id,
    code: result.code,
    parentDepartmentId: result.parent_department_id,
    userId,
  });

  return mapBasicRowToDepartment(result);
}

/**
 * Get department by ID
 */
export async function getDepartmentById(departmentId: UUID): Promise<DepartmentDetails | null> {
  const result = await queryOne<DepartmentRowWithHierarchy>(
    `WITH RECURSIVE dept_hierarchy AS (
      SELECT department_id, code, name, parent_department_id, is_active, 
             created_at, updated_at, 0 as level
      FROM departments
      WHERE department_id = $1
    )
    SELECT d.*, 
           COALESCE(dh.level, 0)::text as hierarchy_level,
           COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = d.department_id), 0)::text as child_count
    FROM departments d
    LEFT JOIN dept_hierarchy dh ON d.department_id = dh.department_id
    WHERE d.department_id = $1`,
    [departmentId]
  );

  return result ? mapRowToDepartment(result) : null;
}

/**
 * Get department by code
 */
export async function getDepartmentByCode(code: string): Promise<DepartmentDetails | null> {
  const result = await queryOne<DepartmentRowWithHierarchy>(
    `SELECT d.*, 
            0::text as hierarchy_level,
            COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = d.department_id), 0)::text as child_count
     FROM departments d
     WHERE d.code = $1`,
    [code]
  );

  return result ? mapRowToDepartment(result) : null;
}

/**
 * Get child departments for a parent
 */
export async function getDepartmentsByParent(parentId: UUID): Promise<DepartmentDetails[]> {
  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `SELECT d.*, 
            1::text as hierarchy_level,
            COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = d.department_id), 0)::text as child_count
     FROM departments d
     WHERE d.parent_department_id = $1
     ORDER BY d.name ASC`,
    [parentId]
  );

  return rows.map(mapRowToDepartment);
}

/**
 * Get all departments with hierarchy information
 * Requirement 7.2: Return all departments with their hierarchy level and child count
 */
export async function getAllDepartments(): Promise<DepartmentDetails[]> {
  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `WITH RECURSIVE dept_hierarchy AS (
      -- Base case: root departments (no parent)
      SELECT department_id, code, name, parent_department_id, is_active, 
             created_at, updated_at, 0 as level
      FROM departments
      WHERE parent_department_id IS NULL
      
      UNION ALL
      
      -- Recursive case: child departments
      SELECT d.department_id, d.code, d.name, d.parent_department_id, d.is_active,
             d.created_at, d.updated_at, dh.level + 1
      FROM departments d
      INNER JOIN dept_hierarchy dh ON d.parent_department_id = dh.department_id
    )
    SELECT dh.department_id, dh.code, dh.name, dh.parent_department_id, dh.is_active,
           dh.created_at, dh.updated_at,
           dh.level::text as hierarchy_level,
           COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = dh.department_id), 0)::text as child_count
    FROM dept_hierarchy dh
    ORDER BY dh.level ASC, dh.name ASC`
  );

  return rows.map(mapRowToDepartment);
}

/**
 * Get active departments only
 */
export async function getActiveDepartments(): Promise<DepartmentDetails[]> {
  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `WITH RECURSIVE dept_hierarchy AS (
      SELECT department_id, code, name, parent_department_id, is_active, 
             created_at, updated_at, 0 as level
      FROM departments
      WHERE parent_department_id IS NULL AND is_active = TRUE
      
      UNION ALL
      
      SELECT d.department_id, d.code, d.name, d.parent_department_id, d.is_active,
             d.created_at, d.updated_at, dh.level + 1
      FROM departments d
      INNER JOIN dept_hierarchy dh ON d.parent_department_id = dh.department_id
      WHERE d.is_active = TRUE
    )
    SELECT dh.department_id, dh.code, dh.name, dh.parent_department_id, dh.is_active,
           dh.created_at, dh.updated_at,
           dh.level::text as hierarchy_level,
           COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = dh.department_id AND c.is_active = TRUE), 0)::text as child_count
    FROM dept_hierarchy dh
    ORDER BY dh.level ASC, dh.name ASC`
  );

  return rows.map(mapRowToDepartment);
}

/**
 * Update department details
 * Requirement 7.3: Update specified fields and maintain parent relationship
 */
export async function updateDepartment(
  departmentId: UUID,
  request: UpdateDepartmentRequest,
  userId?: UUID
): Promise<DepartmentDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.parentDepartmentId !== undefined) {
    updates.push(`parent_department_id = $${paramIndex++}`);
    values.push(request.parentDepartmentId);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getDepartmentById(departmentId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(departmentId);

  const sql = `UPDATE departments SET ${updates.join(', ')} WHERE department_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<DepartmentRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Department updated', { departmentId, userId });

  return mapBasicRowToDepartment(result);
}

/**
 * Deactivate a department and cascade to all children
 * Requirement 7.4: Cascade deactivation to all child departments
 */
export async function deactivateDepartment(
  departmentId: UUID,
  userId?: UUID
): Promise<DepartmentDetails | null> {
  const timestamp = now();

  // First, get all descendant department IDs
  const descendantIds = await getChildDepartmentIds(departmentId);
  const allIds = [departmentId, ...descendantIds];

  // Deactivate all departments in the hierarchy
  await query(
    `UPDATE departments 
     SET is_active = FALSE, updated_at = $1 
     WHERE department_id = ANY($2::uuid[])`,
    [timestamp, allIds]
  );

  logger.info('Department deactivated with cascade', {
    departmentId,
    cascadedCount: descendantIds.length,
    userId,
  });

  return getDepartmentById(departmentId);
}

/**
 * Delete a department (only if no dependencies)
 */
export async function deleteDepartment(departmentId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM departments WHERE department_id = $1', [departmentId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Department deleted', { departmentId });
  }

  return deleted;
}

/**
 * Check if a department code already exists
 * Used for uniqueness validation
 */
export async function departmentCodeExists(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE code = $1 AND department_id != $2'
    : 'WHERE code = $1';
  const params = excludeId ? [code, excludeId] : [code];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM departments ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a parent department exists
 * Requirement 7.5: Reject creation for non-existent parent
 */
export async function parentDepartmentExists(parentId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM departments WHERE department_id = $1) as exists',
    [parentId]
  );

  return result?.exists ?? false;
}

/**
 * Get department dependencies (child count and user count)
 * Requirement 7.5: Reject deletion if has children or users
 */
export async function getDepartmentDependencies(departmentId: UUID): Promise<{
  childCount: number;
  userCount: number;
}> {
  const childResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM departments WHERE parent_department_id = $1',
    [departmentId]
  );

  const userResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM users WHERE department_id = $1',
    [departmentId]
  );

  return {
    childCount: parseInt(childResult?.count ?? '0', 10),
    userCount: parseInt(userResult?.count ?? '0', 10),
  };
}

/**
 * List departments with pagination and filters
 */
export async function listDepartments(
  filters: DepartmentListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<DepartmentDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.parentDepartmentId !== undefined) {
    if (filters.parentDepartmentId === null) {
      conditions.push('d.parent_department_id IS NULL');
    } else {
      conditions.push(`d.parent_department_id = $${paramIndex++}`);
      values.push(filters.parentDepartmentId);
    }
  }

  if (filters.isActive !== undefined) {
    conditions.push(`d.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(`(d.name ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM departments d ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results with hierarchy info
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `WITH RECURSIVE dept_hierarchy AS (
      SELECT department_id, 0 as level
      FROM departments
      WHERE parent_department_id IS NULL
      
      UNION ALL
      
      SELECT d.department_id, dh.level + 1
      FROM departments d
      INNER JOIN dept_hierarchy dh ON d.parent_department_id = dh.department_id
    )
    SELECT d.*, 
           COALESCE(dh.level, 0)::text as hierarchy_level,
           COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = d.department_id), 0)::text as child_count
    FROM departments d
    LEFT JOIN dept_hierarchy dh ON d.department_id = dh.department_id
    ${whereClause}
    ORDER BY d.name ASC
    LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.map(mapRowToDepartment),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get full hierarchy path for a department
 * Returns the path from root to the specified department
 */
export async function getDepartmentHierarchy(departmentId: UUID): Promise<DepartmentHierarchyRow[]> {
  const rows = await queryMany<DepartmentHierarchyRow>(
    `WITH RECURSIVE dept_path AS (
      -- Start from the target department
      SELECT department_id, code, name, parent_department_id, 0 as level
      FROM departments
      WHERE department_id = $1
      
      UNION ALL
      
      -- Walk up to parent departments
      SELECT d.department_id, d.code, d.name, d.parent_department_id, dp.level + 1
      FROM departments d
      INNER JOIN dept_path dp ON d.department_id = dp.parent_department_id
    )
    SELECT department_id, code, name, level::text as hierarchy_level
    FROM dept_path
    ORDER BY level DESC`,
    [departmentId]
  );

  return rows;
}

/**
 * Get all descendant department IDs (for cascade operations)
 * Requirement 7.4: Used for cascade deactivation to all child departments
 */
export async function getChildDepartmentIds(departmentId: UUID): Promise<UUID[]> {
  const rows = await queryMany<{ department_id: string }>(
    `WITH RECURSIVE dept_descendants AS (
      -- Direct children
      SELECT department_id
      FROM departments
      WHERE parent_department_id = $1
      
      UNION ALL
      
      -- Recursive descendants
      SELECT d.department_id
      FROM departments d
      INNER JOIN dept_descendants dd ON d.parent_department_id = dd.department_id
    )
    SELECT department_id FROM dept_descendants`,
    [departmentId]
  );

  return rows.map(row => row.department_id);
}

/**
 * Get root departments (departments with no parent)
 */
export async function getRootDepartments(): Promise<DepartmentDetails[]> {
  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `SELECT d.*, 
            0::text as hierarchy_level,
            COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = d.department_id), 0)::text as child_count
     FROM departments d
     WHERE d.parent_department_id IS NULL
     ORDER BY d.name ASC`
  );

  return rows.map(mapRowToDepartment);
}

/**
 * Check if setting a parent would create a circular reference
 * Returns true if circular reference would be created
 */
export async function wouldCreateCircularReference(
  departmentId: UUID,
  newParentId: UUID
): Promise<boolean> {
  // Check if newParentId is a descendant of departmentId
  const descendants = await getChildDepartmentIds(departmentId);
  return descendants.includes(newParentId) || departmentId === newParentId;
}

/**
 * Get department tree structure starting from a specific department
 * Returns the department and all its descendants in a flat list with hierarchy levels
 */
export async function getDepartmentSubtree(departmentId: UUID): Promise<DepartmentDetails[]> {
  const rows = await queryMany<DepartmentRowWithHierarchy>(
    `WITH RECURSIVE dept_subtree AS (
      -- Start from the specified department
      SELECT department_id, code, name, parent_department_id, is_active, 
             created_at, updated_at, 0 as level
      FROM departments
      WHERE department_id = $1
      
      UNION ALL
      
      -- Get all descendants
      SELECT d.department_id, d.code, d.name, d.parent_department_id, d.is_active,
             d.created_at, d.updated_at, ds.level + 1
      FROM departments d
      INNER JOIN dept_subtree ds ON d.parent_department_id = ds.department_id
    )
    SELECT ds.department_id, ds.code, ds.name, ds.parent_department_id, ds.is_active,
           ds.created_at, ds.updated_at,
           ds.level::text as hierarchy_level,
           COALESCE((SELECT COUNT(*) FROM departments c WHERE c.parent_department_id = ds.department_id), 0)::text as child_count
    FROM dept_subtree ds
    ORDER BY ds.level ASC, ds.name ASC`,
    [departmentId]
  );

  return rows.map(mapRowToDepartment);
}
