/**
 * User Admin Service - Business logic layer for user administration
 *
 * Implements:
 * - User listing with filters (Requirement 12.1)
 * - User details retrieval (Requirement 12.2)
 * - User department/manager updates (Requirement 12.3)
 * - User activation/deactivation (Requirement 12.4, 12.5)
 * - Role assignment management (Requirement 12.6, 12.7)
 * - Cache management for user data
 * - Event publishing for user state changes
 */

import type {
  PaginatedResult,
  PaginationParams,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  RoleAssignment,
  UpdateUserRequest,
  UserDetails,
  UserListFilters,
} from './user-admin-repository';
import * as repository from './user-admin-repository';

const logger = createLogger({ service: 'user-admin-service' });

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  RoleAssignment,
  UpdateUserRequest,
  UserDetails,
  UserListFilters,
} from './user-admin-repository';

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a user
 * Format: user:{user_id}
 */
function userKey(userId: UUID): string {
  return `${CACHE_ENTITY_TYPES.USER}:${userId}`;
}

/**
 * Build a cache key for user list
 * Format: user:list or user:list:{sorted_params}
 */
function userListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.USER, params);
}

/**
 * Build a cache key for users by department
 * Format: user:department:{department_id}
 */
function usersByDepartmentKey(departmentId: UUID): string {
  return `${CACHE_ENTITY_TYPES.USER}:department:${departmentId}`;
}

/**
 * Build a cache key for users by manager
 * Format: user:manager:{manager_id}
 */
function usersByManagerKey(managerId: UUID): string {
  return `${CACHE_ENTITY_TYPES.USER}:manager:${managerId}`;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when user is not found
 */
export class UserNotFoundError extends Error {
  constructor(userId: UUID) {
    super(`User not found: ${userId}`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when role is not found
 */
export class RoleNotFoundError extends Error {
  constructor(roleId: UUID) {
    super(`Role not found: ${roleId}`);
    this.name = 'RoleNotFoundError';
  }
}

/**
 * Error thrown when department is not found
 */
export class DepartmentNotFoundError extends Error {
  constructor(departmentId: UUID) {
    super(`Department not found: ${departmentId}`);
    this.name = 'DepartmentNotFoundError';
  }
}

/**
 * Error thrown when manager is not found or inactive
 */
export class ManagerNotFoundError extends Error {
  constructor(managerId: UUID) {
    super(`Manager not found or inactive: ${managerId}`);
    this.name = 'ManagerNotFoundError';
  }
}

/**
 * Error thrown when user already has the role
 */
export class RoleAlreadyAssignedError extends Error {
  constructor(userId: UUID, roleId: UUID) {
    super(`User ${userId} already has role ${roleId}`);
    this.name = 'RoleAlreadyAssignedError';
  }
}

/**
 * Error thrown when user does not have the role
 */
export class RoleNotAssignedError extends Error {
  constructor(userId: UUID, roleId: UUID) {
    super(`User ${userId} does not have role ${roleId}`);
    this.name = 'RoleNotAssignedError';
  }
}

/**
 * Error thrown when trying to set self as manager
 */
export class SelfManagerError extends Error {
  constructor(userId: UUID) {
    super(`User ${userId} cannot be their own manager`);
    this.name = 'SelfManagerError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating user-related cache entries
 */
function userInvalidationPatterns(userId: UUID, departmentId?: UUID | null, managerId?: UUID | null): string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.USER}:${userId}*`,
    `${CACHE_ENTITY_TYPES.USER}:list*`,
    `${CACHE_ENTITY_TYPES.USER}:active*`,
    `search:${CACHE_ENTITY_TYPES.USER}:*`,
  ];

  if (departmentId) {
    patterns.push(`${CACHE_ENTITY_TYPES.USER}:department:${departmentId}*`);
  }

  if (managerId) {
    patterns.push(`${CACHE_ENTITY_TYPES.USER}:manager:${managerId}*`);
  }

  return patterns;
}

/**
 * Invalidate all user-related cache entries
 */
async function invalidateUserCache(userId: UUID, departmentId?: UUID | null, managerId?: UUID | null): Promise<void> {
  const patterns = userInvalidationPatterns(userId, departmentId, managerId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific user key
  await cache.del(userKey(userId));
}

// ============================================================================
// User Service Functions
// ============================================================================

/**
 * Get user by ID
 * Requirement 12.2: Return user details including department, manager, and assigned roles
 *
 * @param userId - User ID
 * @returns User details or null if not found
 */
export async function getUser(userId: UUID): Promise<UserDetails | null> {
  const cacheKeyStr = userKey(userId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getUserById(userId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get user by ID, throwing if not found
 *
 * @param userId - User ID
 * @returns User details
 * @throws UserNotFoundError if user not found
 */
export async function getUserOrThrow(userId: UUID): Promise<UserDetails> {
  const user = await getUser(userId);
  if (!user) {
    throw new UserNotFoundError(userId);
  }
  return user;
}

/**
 * Get user by email
 *
 * @param email - User email
 * @returns User details or null if not found
 */
export async function getUserByEmail(email: string): Promise<UserDetails | null> {
  return repository.getUserByEmail(email);
}

/**
 * Get user by Cognito sub
 *
 * @param cognitoSub - Cognito subject identifier
 * @returns User details or null if not found
 */
export async function getUserByCognitoSub(cognitoSub: string): Promise<UserDetails | null> {
  return repository.getUserByCognitoSub(cognitoSub);
}

/**
 * Update user details
 * Requirement 12.3: Update user department or manager assignment and log the change
 *
 * @param userId - User ID
 * @param request - Update request
 * @param updatedBy - ID of user making the update
 * @returns Updated user details
 * @throws UserNotFoundError if user not found
 * @throws DepartmentNotFoundError if department not found
 * @throws ManagerNotFoundError if manager not found or inactive
 * @throws SelfManagerError if trying to set self as manager
 */
export async function updateUser(
  userId: UUID,
  request: UpdateUserRequest,
  updatedBy?: UUID
): Promise<UserDetails> {
  logger.info('Updating user', { userId, updates: Object.keys(request) });

  // Verify user exists
  const existing = await repository.getUserById(userId);
  if (!existing) {
    throw new UserNotFoundError(userId);
  }

  // Validate department if specified
  if (request.departmentId !== undefined && request.departmentId !== null) {
    const deptExists = await repository.departmentExists(request.departmentId);
    if (!deptExists) {
      throw new DepartmentNotFoundError(request.departmentId);
    }
  }

  // Validate manager if specified
  if (request.managerId !== undefined && request.managerId !== null) {
    // Cannot be own manager
    if (request.managerId === userId) {
      throw new SelfManagerError(userId);
    }

    const mgrExists = await repository.managerExists(request.managerId);
    if (!mgrExists) {
      throw new ManagerNotFoundError(request.managerId);
    }
  }

  // Update the user
  const updated = await repository.updateUser(userId, request, updatedBy);
  if (!updated) {
    throw new UserNotFoundError(userId);
  }

  // Invalidate cache
  await invalidateUserCache(userId, existing.departmentId, existing.managerId);
  // Also invalidate new department/manager caches if changed
  if (request.departmentId && request.departmentId !== existing.departmentId) {
    await cache.del(usersByDepartmentKey(request.departmentId));
  }
  if (request.managerId && request.managerId !== existing.managerId) {
    await cache.del(usersByManagerKey(request.managerId));
  }

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.firstName !== undefined && request.firstName !== existing.firstName) {
    changes.push({ field: 'firstName', oldValue: existing.firstName, newValue: request.firstName });
  }
  if (request.lastName !== undefined && request.lastName !== existing.lastName) {
    changes.push({ field: 'lastName', oldValue: existing.lastName, newValue: request.lastName });
  }
  if (request.departmentId !== undefined && request.departmentId !== existing.departmentId) {
    changes.push({ field: 'departmentId', oldValue: existing.departmentId, newValue: request.departmentId });
  }
  if (request.managerId !== undefined && request.managerId !== existing.managerId) {
    changes.push({ field: 'managerId', oldValue: existing.managerId, newValue: request.managerId });
  }

  // Publish event
  await publishEvent('USER_UPDATED', {
    userId: updated.userId,
    email: updated.email,
    changes,
    updatedBy: updatedBy ?? '',
  });

  logger.info('User updated successfully', { userId });

  return updated;
}

/**
 * Deactivate a user
 * Requirement 12.4: Mark user as inactive and revoke active sessions
 *
 * @param userId - User ID
 * @param deactivatedBy - ID of user performing deactivation
 * @returns Deactivated user details
 * @throws UserNotFoundError if user not found
 */
export async function deactivateUser(
  userId: UUID,
  deactivatedBy?: UUID
): Promise<UserDetails> {
  logger.info('Deactivating user', { userId });

  // Verify user exists
  const existing = await repository.getUserById(userId);
  if (!existing) {
    throw new UserNotFoundError(userId);
  }

  // Deactivate the user
  const deactivated = await repository.deactivateUser(userId, deactivatedBy);
  if (!deactivated) {
    throw new UserNotFoundError(userId);
  }

  // Invalidate cache
  await invalidateUserCache(userId, existing.departmentId, existing.managerId);

  // Publish event
  await publishEvent('USER_DEACTIVATED', {
    userId: deactivated.userId,
    email: deactivated.email,
    deactivatedBy: deactivatedBy ?? '',
  });

  logger.info('User deactivated successfully', { userId });

  return deactivated;
}

/**
 * Reactivate a user
 * Requirement 12.5: Mark user as active and restore previous role assignments
 *
 * @param userId - User ID
 * @param reactivatedBy - ID of user performing reactivation
 * @returns Reactivated user details
 * @throws UserNotFoundError if user not found
 */
export async function reactivateUser(
  userId: UUID,
  reactivatedBy?: UUID
): Promise<UserDetails> {
  logger.info('Reactivating user', { userId });

  // Verify user exists
  const existing = await repository.getUserById(userId);
  if (!existing) {
    throw new UserNotFoundError(userId);
  }

  // Reactivate the user
  const reactivated = await repository.reactivateUser(userId, reactivatedBy);
  if (!reactivated) {
    throw new UserNotFoundError(userId);
  }

  // Invalidate cache
  await invalidateUserCache(userId, existing.departmentId, existing.managerId);

  // Publish event
  await publishEvent('USER_REACTIVATED', {
    userId: reactivated.userId,
    email: reactivated.email,
    reactivatedBy: reactivatedBy ?? '',
  });

  logger.info('User reactivated successfully', { userId });

  return reactivated;
}

/**
 * Assign a role to a user
 * Requirement 12.6: Create role assignment and log the change
 *
 * @param userId - User ID
 * @param roleId - Role ID
 * @param assignedBy - ID of user assigning the role
 * @returns Role assignment details
 * @throws UserNotFoundError if user not found
 * @throws RoleNotFoundError if role not found
 */
export async function assignRole(
  userId: UUID,
  roleId: UUID,
  assignedBy?: UUID
): Promise<RoleAssignment> {
  logger.info('Assigning role to user', { userId, roleId });

  // Verify user exists
  const userExistsResult = await repository.userExists(userId);
  if (!userExistsResult) {
    throw new UserNotFoundError(userId);
  }

  // Verify role exists
  const roleExistsResult = await repository.roleExists(roleId);
  if (!roleExistsResult) {
    throw new RoleNotFoundError(roleId);
  }

  // Assign the role
  const assignment = await repository.assignRole(userId, roleId, assignedBy);
  if (!assignment) {
    throw new RoleNotFoundError(roleId);
  }

  // Invalidate user cache
  await cache.del(userKey(userId));
  await cache.delPattern(`${CACHE_ENTITY_TYPES.USER}:list*`);

  // Publish event
  await publishEvent('USER_ROLE_ASSIGNED', {
    userId,
    roleId,
    roleName: assignment.roleName,
    assignedBy: assignedBy ?? '',
  });

  logger.info('Role assigned successfully', { userId, roleId, roleName: assignment.roleName });

  return assignment;
}

/**
 * Remove a role from a user
 * Requirement 12.7: Delete role assignment and log the change
 *
 * @param userId - User ID
 * @param roleId - Role ID
 * @param removedBy - ID of user removing the role
 * @returns true if role was removed
 * @throws UserNotFoundError if user not found
 * @throws RoleNotFoundError if role not found
 * @throws RoleNotAssignedError if user doesn't have the role
 */
export async function removeRole(
  userId: UUID,
  roleId: UUID,
  removedBy?: UUID
): Promise<boolean> {
  logger.info('Removing role from user', { userId, roleId });

  // Verify user exists
  const userExistsResult = await repository.userExists(userId);
  if (!userExistsResult) {
    throw new UserNotFoundError(userId);
  }

  // Verify role exists
  const role = await repository.getRoleById(roleId);
  if (!role) {
    throw new RoleNotFoundError(roleId);
  }

  // Check if user has the role
  const hasRole = await repository.userHasRole(userId, roleId);
  if (!hasRole) {
    throw new RoleNotAssignedError(userId, roleId);
  }

  // Remove the role
  const removed = await repository.removeRole(userId, roleId, removedBy);

  if (removed) {
    // Invalidate user cache
    await cache.del(userKey(userId));
    await cache.delPattern(`${CACHE_ENTITY_TYPES.USER}:list*`);

    // Publish event
    await publishEvent('USER_ROLE_REMOVED', {
      userId,
      roleId,
      roleName: role.role_name,
      removedBy: removedBy ?? '',
    });

    logger.info('Role removed successfully', { userId, roleId, roleName: role.role_name });
  }

  return removed;
}

/**
 * Get role assignments for a user
 *
 * @param userId - User ID
 * @returns List of role assignments
 * @throws UserNotFoundError if user not found
 */
export async function getUserRoleAssignments(userId: UUID): Promise<readonly RoleAssignment[]> {
  // Verify user exists
  const userExistsResult = await repository.userExists(userId);
  if (!userExistsResult) {
    throw new UserNotFoundError(userId);
  }

  return repository.getUserRoleAssignments(userId);
}

/**
 * List users with pagination and filters
 * Requirement 12.1: Return paginated list of users matching filter criteria
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of users
 */
export async function listUsers(
  filters: UserListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<UserDetails>> {
  logger.debug('Listing users', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = userListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listUsers(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listUsers(filters, pagination);
}

/**
 * Get users by department
 *
 * @param departmentId - Department ID
 * @returns List of users in the department
 */
export async function getUsersByDepartment(departmentId: UUID): Promise<readonly UserDetails[]> {
  const cacheKeyStr = usersByDepartmentKey(departmentId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getUsersByDepartment(departmentId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get users managed by a specific user
 *
 * @param managerId - Manager's user ID
 * @returns List of users managed by the specified user
 */
export async function getUsersByManager(managerId: UUID): Promise<readonly UserDetails[]> {
  const cacheKeyStr = usersByManagerKey(managerId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getUsersByManager(managerId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active users only
 *
 * @returns List of active users
 */
export async function getActiveUsers(): Promise<readonly UserDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.USER}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveUsers(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Search users by name or email
 *
 * @param searchTerm - Search term
 * @returns List of matching users
 */
export async function searchUsers(searchTerm: string): Promise<readonly UserDetails[]> {
  // Don't cache search results as they're highly variable
  return repository.searchUsers(searchTerm);
}

/**
 * Get all available roles
 *
 * @returns List of all roles
 */
export async function getAllRoles(): Promise<readonly { roleId: UUID; roleName: string; description: string | null; isSystemRole: boolean }[]> {
  const cacheKeyStr = 'roles:all';

  return cache.getOrSet(
    cacheKeyStr,
    async () => {
      const roles = await repository.getAllRoles();
      return roles.map(r => ({
        roleId: r.role_id,
        roleName: r.role_name,
        description: r.description,
        isSystemRole: r.is_system_role,
      }));
    },
    { ttl: cache.DEFAULT_TTL.LONG }
  );
}

/**
 * Check if user has a specific role
 *
 * @param userId - User ID
 * @param roleId - Role ID
 * @returns true if user has the role
 */
export async function userHasRole(userId: UUID, roleId: UUID): Promise<boolean> {
  return repository.userHasRole(userId, roleId);
}

/**
 * Check if user has a specific role by name
 *
 * @param userId - User ID
 * @param roleName - Role name
 * @returns true if user has the role
 */
export async function userHasRoleByName(userId: UUID, roleName: string): Promise<boolean> {
  return repository.userHasRoleByName(userId, roleName);
}
