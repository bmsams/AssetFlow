/**
 * User Admin Repository - Data access layer for user administration
 *
 * Implements database operations for:
 * - User listing with filters (Requirement 12.1)
 * - User details retrieval (Requirement 12.2)
 * - User department/manager updates (Requirement 12.3)
 * - User activation/deactivation (Requirement 12.4, 12.5)
 * - Role assignment management (Requirement 12.6, 12.7)
 */

import type {
  PaginatedResult,
  PaginationParams,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'user-admin-repository' });

// ============================================================================
// Types
// ============================================================================

/**
 * User details with department, manager, and roles
 */
export interface UserDetails {
  readonly userId: UUID;
  readonly cognitoSub: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly departmentId: UUID | null;
  readonly departmentName: string | null;
  readonly managerId: UUID | null;
  readonly managerName: string | null;
  readonly roles: readonly string[];
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Request payload for updating a user
 */
export interface UpdateUserRequest {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly departmentId?: UUID | null;
  readonly managerId?: UUID | null;
}

/**
 * Filters for listing users
 */
export interface UserListFilters {
  readonly departmentId?: UUID;
  readonly managerId?: UUID;
  readonly isActive?: boolean;
  readonly search?: string;
}

/**
 * Role assignment details
 */
export interface RoleAssignment {
  readonly userId: UUID;
  readonly roleId: UUID;
  readonly roleName: string;
  readonly assignedAt: string;
  readonly assignedBy: UUID | null;
}

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for users table with joins
 */
interface UserRow {
  user_id: string;
  cognito_sub: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  department_id: string | null;
  department_name: string | null;
  manager_id: string | null;
  manager_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Database row type for role assignments
 */
interface RoleAssignmentRow {
  user_id: string;
  role_id: string;
  role_name: string;
  assigned_at: string;
  assigned_by: string | null;
}

/**
 * Database row type for roles
 */
interface RoleRow {
  role_id: string;
  role_name: string;
  description: string | null;
  is_system_role: boolean;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to UserDetails entity
 */
function mapRowToUser(row: UserRow, roles: readonly string[] = []): UserDetails {
  return {
    userId: row.user_id,
    cognitoSub: row.cognito_sub,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    managerId: row.manager_id,
    managerName: row.manager_name,
    roles,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to RoleAssignment entity
 */
function mapRowToRoleAssignment(row: RoleAssignmentRow): RoleAssignment {
  return {
    userId: row.user_id,
    roleId: row.role_id,
    roleName: row.role_name,
    assignedAt: row.assigned_at,
    assignedBy: row.assigned_by,
  };
}

// ============================================================================
// User Repository Functions
// ============================================================================

/**
 * Get user by ID with department, manager, and roles
 * Requirement 12.2: Return user details including department, manager, and assigned roles
 */
export async function getUserById(userId: UUID): Promise<UserDetails | null> {
  const userRow = await queryOne<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.user_id = $1`,
    [userId]
  );

  if (!userRow) {
    return null;
  }

  // Get user roles
  const roles = await getUserRoles(userId);

  return mapRowToUser(userRow, roles);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserDetails | null> {
  const userRow = await queryOne<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.email = $1`,
    [email]
  );

  if (!userRow) {
    return null;
  }

  const roles = await getUserRoles(userRow.user_id);
  return mapRowToUser(userRow, roles);
}

/**
 * Get user by Cognito sub
 */
export async function getUserByCognitoSub(cognitoSub: string): Promise<UserDetails | null> {
  const userRow = await queryOne<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.cognito_sub = $1`,
    [cognitoSub]
  );

  if (!userRow) {
    return null;
  }

  const roles = await getUserRoles(userRow.user_id);
  return mapRowToUser(userRow, roles);
}

/**
 * Get roles for a user
 */
export async function getUserRoles(userId: UUID): Promise<readonly string[]> {
  const rows = await queryMany<{ role_name: string }>(
    `SELECT r.role_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.role_id
    WHERE ur.user_id = $1
    ORDER BY r.role_name`,
    [userId]
  );

  return rows.map(row => row.role_name);
}

/**
 * Get role assignments for a user with full details
 */
export async function getUserRoleAssignments(userId: UUID): Promise<readonly RoleAssignment[]> {
  const rows = await queryMany<RoleAssignmentRow>(
    `SELECT 
      ur.user_id,
      ur.role_id,
      r.role_name,
      ur.assigned_at,
      ur.assigned_by
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.role_id
    WHERE ur.user_id = $1
    ORDER BY ur.assigned_at DESC`,
    [userId]
  );

  return rows.map(mapRowToRoleAssignment);
}

/**
 * Update user details
 * Requirement 12.3: Update user department or manager assignment
 */
export async function updateUser(
  userId: UUID,
  request: UpdateUserRequest,
  updatedBy?: UUID
): Promise<UserDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.firstName !== undefined) {
    updates.push(`first_name = $${paramIndex++}`);
    values.push(request.firstName);
  }

  if (request.lastName !== undefined) {
    updates.push(`last_name = $${paramIndex++}`);
    values.push(request.lastName);
  }

  if (request.departmentId !== undefined) {
    updates.push(`department_id = $${paramIndex++}`);
    values.push(request.departmentId);
  }

  if (request.managerId !== undefined) {
    updates.push(`manager_id = $${paramIndex++}`);
    values.push(request.managerId);
  }

  if (updates.length === 0) {
    return getUserById(userId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(userId);

  const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING user_id`;
  const result = await queryOne<{ user_id: string }>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('User updated', { userId, updatedBy });

  return getUserById(userId);
}

/**
 * Deactivate a user
 * Requirement 12.4: Mark user as inactive
 */
export async function deactivateUser(
  userId: UUID,
  deactivatedBy?: UUID
): Promise<UserDetails | null> {
  const timestamp = now();

  const result = await queryOne<{ user_id: string }>(
    `UPDATE users 
     SET is_active = FALSE, updated_at = $1 
     WHERE user_id = $2 
     RETURNING user_id`,
    [timestamp, userId]
  );

  if (!result) {
    return null;
  }

  logger.info('User deactivated', { userId, deactivatedBy });

  return getUserById(userId);
}

/**
 * Reactivate a user
 * Requirement 12.5: Mark user as active and restore previous role assignments
 */
export async function reactivateUser(
  userId: UUID,
  reactivatedBy?: UUID
): Promise<UserDetails | null> {
  const timestamp = now();

  const result = await queryOne<{ user_id: string }>(
    `UPDATE users 
     SET is_active = TRUE, updated_at = $1 
     WHERE user_id = $2 
     RETURNING user_id`,
    [timestamp, userId]
  );

  if (!result) {
    return null;
  }

  logger.info('User reactivated', { userId, reactivatedBy });

  return getUserById(userId);
}

/**
 * Assign a role to a user
 * Requirement 12.6: Create role assignment and log the change
 */
export async function assignRole(
  userId: UUID,
  roleId: UUID,
  assignedBy?: UUID
): Promise<RoleAssignment | null> {
  const timestamp = now();

  // Check if assignment already exists
  const existing = await queryOne<{ user_id: string }>(
    'SELECT user_id FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [userId, roleId]
  );

  if (existing) {
    // Already assigned, return existing assignment
    const assignments = await getUserRoleAssignments(userId);
    return assignments.find(a => a.roleId === roleId) ?? null;
  }

  // Create new assignment
  await query(
    `INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by)
     VALUES ($1, $2, $3, $4)`,
    [userId, roleId, timestamp, assignedBy ?? null]
  );

  logger.info('Role assigned to user', { userId, roleId, assignedBy });

  // Get the role name for the response
  const role = await queryOne<RoleRow>(
    'SELECT role_id, role_name, description, is_system_role FROM roles WHERE role_id = $1',
    [roleId]
  );

  if (!role) {
    return null;
  }

  return {
    userId,
    roleId,
    roleName: role.role_name,
    assignedAt: timestamp,
    assignedBy: assignedBy ?? null,
  };
}

/**
 * Remove a role from a user
 * Requirement 12.7: Delete role assignment and log the change
 */
export async function removeRole(
  userId: UUID,
  roleId: UUID,
  removedBy?: UUID
): Promise<boolean> {
  const result = await query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [userId, roleId]
  );

  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted) {
    logger.info('Role removed from user', { userId, roleId, removedBy });
  }

  return deleted;
}

/**
 * Check if a user exists
 */
export async function userExists(userId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1) as exists',
    [userId]
  );

  return result?.exists ?? false;
}

/**
 * Check if a role exists
 */
export async function roleExists(roleId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM roles WHERE role_id = $1) as exists',
    [roleId]
  );

  return result?.exists ?? false;
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: UUID): Promise<RoleRow | null> {
  return queryOne<RoleRow>(
    'SELECT role_id, role_name, description, is_system_role FROM roles WHERE role_id = $1',
    [roleId]
  );
}

/**
 * Get role by name
 */
export async function getRoleByName(roleName: string): Promise<RoleRow | null> {
  return queryOne<RoleRow>(
    'SELECT role_id, role_name, description, is_system_role FROM roles WHERE role_name = $1',
    [roleName]
  );
}

/**
 * Get all available roles
 */
export async function getAllRoles(): Promise<readonly RoleRow[]> {
  return queryMany<RoleRow>(
    'SELECT role_id, role_name, description, is_system_role FROM roles ORDER BY role_name'
  );
}

/**
 * Check if a department exists
 */
export async function departmentExists(departmentId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM departments WHERE department_id = $1) as exists',
    [departmentId]
  );

  return result?.exists ?? false;
}

/**
 * Check if a manager (user) exists and is active
 */
export async function managerExists(managerId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM users WHERE user_id = $1 AND is_active = TRUE) as exists',
    [managerId]
  );

  return result?.exists ?? false;
}

/**
 * List users with pagination and filters
 * Requirement 12.1: Return paginated list of users matching filter criteria
 */
export async function listUsers(
  filters: UserListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<UserDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.departmentId !== undefined) {
    conditions.push(`u.department_id = $${paramIndex++}`);
    values.push(filters.departmentId);
  }

  if (filters.managerId !== undefined) {
    conditions.push(`u.manager_id = $${paramIndex++}`);
    values.push(filters.managerId);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`u.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(
      `(u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM users u ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const rows = await queryMany<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    ${whereClause}
    ORDER BY u.email ASC
    LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  // Get roles for each user
  const usersWithRoles = await Promise.all(
    rows.map(async (row) => {
      const roles = await getUserRoles(row.user_id);
      return mapRowToUser(row, roles);
    })
  );

  return {
    items: usersWithRoles,
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get users by department
 */
export async function getUsersByDepartment(departmentId: UUID): Promise<readonly UserDetails[]> {
  const rows = await queryMany<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.department_id = $1
    ORDER BY u.email ASC`,
    [departmentId]
  );

  return Promise.all(
    rows.map(async (row) => {
      const roles = await getUserRoles(row.user_id);
      return mapRowToUser(row, roles);
    })
  );
}

/**
 * Get users managed by a specific user
 */
export async function getUsersByManager(managerId: UUID): Promise<readonly UserDetails[]> {
  const rows = await queryMany<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.manager_id = $1
    ORDER BY u.email ASC`,
    [managerId]
  );

  return Promise.all(
    rows.map(async (row) => {
      const roles = await getUserRoles(row.user_id);
      return mapRowToUser(row, roles);
    })
  );
}

/**
 * Get active users only
 */
export async function getActiveUsers(): Promise<readonly UserDetails[]> {
  const rows = await queryMany<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.is_active = TRUE
    ORDER BY u.email ASC`
  );

  return Promise.all(
    rows.map(async (row) => {
      const roles = await getUserRoles(row.user_id);
      return mapRowToUser(row, roles);
    })
  );
}

/**
 * Search users by name or email
 */
export async function searchUsers(searchTerm: string): Promise<readonly UserDetails[]> {
  const rows = await queryMany<UserRow>(
    `SELECT 
      u.user_id,
      u.cognito_sub,
      u.email,
      u.first_name,
      u.last_name,
      u.department_id,
      d.name as department_name,
      u.manager_id,
      CONCAT(m.first_name, ' ', m.last_name) as manager_name,
      u.is_active,
      u.created_at,
      u.updated_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN users m ON u.manager_id = m.user_id
    WHERE u.email ILIKE $1 
       OR u.first_name ILIKE $1 
       OR u.last_name ILIKE $1
       OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
    ORDER BY u.email ASC
    LIMIT 50`,
    [`%${searchTerm}%`]
  );

  return Promise.all(
    rows.map(async (row) => {
      const roles = await getUserRoles(row.user_id);
      return mapRowToUser(row, roles);
    })
  );
}

/**
 * Check if user has a specific role
 */
export async function userHasRole(userId: UUID, roleId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role_id = $2) as exists',
    [userId, roleId]
  );

  return result?.exists ?? false;
}

/**
 * Check if user has a specific role by name
 */
export async function userHasRoleByName(userId: UUID, roleName: string): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.role_id
      WHERE ur.user_id = $1 AND r.role_name = $2
    ) as exists`,
    [userId, roleName]
  );

  return result?.exists ?? false;
}
