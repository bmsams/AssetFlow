/**
 * Department Service - Business logic layer for hierarchical department management
 *
 * Implements:
 * - Department CRUD operations (Requirement 7.1-7.5)
 * - Cache management for department data
 * - Event publishing for department state changes
 * - Cascade deactivation for child departments
 * - Circular reference detection for parent relationships
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
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './department-repository';

const logger = createLogger({ service: 'department-service' });

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a department
 * Format: department:{department_id}
 */
function departmentKey(departmentId: UUID): string {
  return `${CACHE_ENTITY_TYPES.DEPARTMENT}:${departmentId}`;
}

/**
 * Build a cache key for departments by parent
 * Format: department:parent:{parent_id}
 */
function departmentsByParentKey(parentId: UUID): string {
  return `${CACHE_ENTITY_TYPES.DEPARTMENT}:parent:${parentId}`;
}

/**
 * Build a cache key for department list
 * Format: department:list or department:list:{sorted_params}
 */
function departmentListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.DEPARTMENT, params);
}

/**
 * Build a cache key for department hierarchy
 * Format: department:hierarchy:{department_id}
 */
function departmentHierarchyKey(departmentId: UUID): string {
  return `${CACHE_ENTITY_TYPES.DEPARTMENT}:hierarchy:${departmentId}`;
}

// ============================================================================
// Error Types
// ============================================================================

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
 * Error thrown when department code already exists
 */
export class DepartmentCodeExistsError extends Error {
  constructor(code: string) {
    super(`Department code '${code}' already exists`);
    this.name = 'DepartmentCodeExistsError';
  }
}

/**
 * Error thrown when department has dependencies and cannot be deleted
 * Requirement 7.5: Reject deletion if has children or users
 */
export class DepartmentHasDependenciesError extends Error {
  readonly childCount: number;
  readonly userCount: number;

  constructor(departmentId: UUID, childCount: number, userCount: number) {
    super(
      `Cannot delete department ${departmentId}: has ${childCount} child department(s) and ${userCount} user(s)`
    );
    this.name = 'DepartmentHasDependenciesError';
    this.childCount = childCount;
    this.userCount = userCount;
  }
}

/**
 * Error thrown when parent department does not exist
 * Requirement 7.5: Reject creation for non-existent parent
 */
export class ParentDepartmentNotFoundError extends Error {
  constructor(parentDepartmentId: UUID) {
    super(`Parent department not found: ${parentDepartmentId}`);
    this.name = 'ParentDepartmentNotFoundError';
  }
}

/**
 * Error thrown when setting a parent would create a circular reference
 */
export class CircularReferenceError extends Error {
  constructor(departmentId: UUID, parentDepartmentId: UUID) {
    super(
      `Cannot set department ${parentDepartmentId} as parent of ${departmentId}: would create circular reference`
    );
    this.name = 'CircularReferenceError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating department-related cache entries
 */
function departmentInvalidationPatterns(departmentId: UUID, parentId?: UUID | null): string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.DEPARTMENT}:${departmentId}*`,
    `${CACHE_ENTITY_TYPES.DEPARTMENT}:list*`,
    `${CACHE_ENTITY_TYPES.DEPARTMENT}:hierarchy:*`,
    `search:${CACHE_ENTITY_TYPES.DEPARTMENT}:*`,
  ];

  if (parentId) {
    patterns.push(`${CACHE_ENTITY_TYPES.DEPARTMENT}:parent:${parentId}*`);
  }

  // Also invalidate root departments cache
  patterns.push(`${CACHE_ENTITY_TYPES.DEPARTMENT}:root*`);
  patterns.push(`${CACHE_ENTITY_TYPES.DEPARTMENT}:active*`);

  return patterns;
}

/**
 * Invalidate all department-related cache entries
 */
async function invalidateDepartmentCache(departmentId: UUID, parentId?: UUID | null): Promise<void> {
  const patterns = departmentInvalidationPatterns(departmentId, parentId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific department key
  await cache.del(departmentKey(departmentId));
}

// ============================================================================
// Department Service Functions
// ============================================================================

/**
 * Create a new department
 * Requirement 7.1: Create department with name, code, parent reference, and manager
 *
 * @param request - Department creation request
 * @param userId - ID of user creating the department
 * @returns Created department
 * @throws DepartmentCodeExistsError if department code already exists
 * @throws ParentDepartmentNotFoundError if parent department does not exist
 */
export async function createDepartment(
  request: CreateDepartmentRequest,
  userId?: UUID
): Promise<DepartmentDetails> {
  logger.info('Creating department', { code: request.code, name: request.name });

  // Validate department code uniqueness
  const codeExists = await repository.departmentCodeExists(request.code);
  if (codeExists) {
    throw new DepartmentCodeExistsError(request.code);
  }

  // Validate parent department exists if specified (Requirement 7.5)
  if (request.parentDepartmentId) {
    const parentExists = await repository.parentDepartmentExists(request.parentDepartmentId);
    if (!parentExists) {
      throw new ParentDepartmentNotFoundError(request.parentDepartmentId);
    }
  }

  // Create the department
  const department = await repository.createDepartment(request, userId);

  // Invalidate list cache
  await cache.del(departmentListKey());
  if (request.parentDepartmentId) {
    await cache.del(departmentsByParentKey(request.parentDepartmentId));
  }

  // Publish event
  await publishEvent('DEPARTMENT_CREATED', {
    departmentId: department.departmentId,
    code: department.code,
    name: department.name,
    parentDepartmentId: department.parentDepartmentId,
    createdBy: userId ?? '',
  });

  logger.info('Department created successfully', {
    departmentId: department.departmentId,
    code: department.code,
  });

  return department;
}

/**
 * Get department by ID
 * Requirement 7.2: Return department details including parent and child departments
 *
 * @param departmentId - Department ID
 * @returns Department or null if not found
 */
export async function getDepartment(departmentId: UUID): Promise<DepartmentDetails | null> {
  const cacheKeyStr = departmentKey(departmentId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getDepartmentById(departmentId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get department by ID, throwing if not found
 *
 * @param departmentId - Department ID
 * @returns Department
 * @throws DepartmentNotFoundError if department not found
 */
export async function getDepartmentOrThrow(departmentId: UUID): Promise<DepartmentDetails> {
  const department = await getDepartment(departmentId);
  if (!department) {
    throw new DepartmentNotFoundError(departmentId);
  }
  return department;
}

/**
 * Get department by code
 *
 * @param code - Department code
 * @returns Department or null if not found
 */
export async function getDepartmentByCode(code: string): Promise<DepartmentDetails | null> {
  return repository.getDepartmentByCode(code);
}

/**
 * Get child departments for a parent
 *
 * @param parentId - Parent department ID
 * @returns List of child departments
 */
export async function getDepartmentsByParent(parentId: UUID): Promise<DepartmentDetails[]> {
  const cacheKeyStr = departmentsByParentKey(parentId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getDepartmentsByParent(parentId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get all departments with hierarchy information
 * Requirement 7.2: Return all departments with their hierarchy level and child count
 *
 * @returns List of all departments with hierarchy info
 */
export async function getAllDepartments(): Promise<DepartmentDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.DEPARTMENT}:all`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getAllDepartments(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active departments only
 *
 * @returns List of active departments
 */
export async function getActiveDepartments(): Promise<DepartmentDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.DEPARTMENT}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveDepartments(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update department details
 * Requirement 7.3: Update specified fields and maintain parent relationship
 *
 * @param departmentId - Department ID
 * @param request - Update request
 * @param userId - ID of user updating the department
 * @returns Updated department
 * @throws DepartmentNotFoundError if department not found
 * @throws ParentDepartmentNotFoundError if new parent department does not exist
 * @throws CircularReferenceError if setting parent would create circular reference
 */
export async function updateDepartment(
  departmentId: UUID,
  request: UpdateDepartmentRequest,
  userId?: UUID
): Promise<DepartmentDetails> {
  logger.info('Updating department', { departmentId, updates: Object.keys(request) });

  // Verify department exists
  const existing = await repository.getDepartmentById(departmentId);
  if (!existing) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Validate new parent department if specified
  if (request.parentDepartmentId !== undefined && request.parentDepartmentId !== null) {
    // Check if parent exists
    const parentExists = await repository.parentDepartmentExists(request.parentDepartmentId);
    if (!parentExists) {
      throw new ParentDepartmentNotFoundError(request.parentDepartmentId);
    }

    // Check for circular reference
    const wouldCreateCircular = await repository.wouldCreateCircularReference(
      departmentId,
      request.parentDepartmentId
    );
    if (wouldCreateCircular) {
      throw new CircularReferenceError(departmentId, request.parentDepartmentId);
    }
  }

  // Update the department
  const updated = await repository.updateDepartment(departmentId, request, userId);
  if (!updated) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Invalidate cache
  await invalidateDepartmentCache(departmentId, existing.parentDepartmentId);
  // Also invalidate new parent's cache if parent changed
  if (request.parentDepartmentId && request.parentDepartmentId !== existing.parentDepartmentId) {
    await cache.del(departmentsByParentKey(request.parentDepartmentId));
  }

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.name !== undefined && request.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: request.name });
  }
  if (request.parentDepartmentId !== undefined && request.parentDepartmentId !== existing.parentDepartmentId) {
    changes.push({ field: 'parentDepartmentId', oldValue: existing.parentDepartmentId, newValue: request.parentDepartmentId });
  }
  if (request.isActive !== undefined && request.isActive !== existing.isActive) {
    changes.push({ field: 'isActive', oldValue: existing.isActive, newValue: request.isActive });
  }

  // Publish event
  await publishEvent('DEPARTMENT_UPDATED', {
    departmentId: updated.departmentId,
    code: updated.code,
    changes,
    updatedBy: userId ?? '',
  });

  logger.info('Department updated successfully', { departmentId });

  return updated;
}

/**
 * Deactivate a department with cascade to all children
 * Requirement 7.4: Cascade deactivation to all child departments
 *
 * @param departmentId - Department ID
 * @param userId - ID of user deactivating the department
 * @returns Deactivated department
 * @throws DepartmentNotFoundError if department not found
 */
export async function deactivateDepartment(
  departmentId: UUID,
  userId?: UUID
): Promise<DepartmentDetails> {
  logger.info('Deactivating department with cascade', { departmentId });

  // Verify department exists
  const existing = await repository.getDepartmentById(departmentId);
  if (!existing) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Get count of children that will be cascaded
  const childIds = await repository.getChildDepartmentIds(departmentId);
  const cascadedCount = childIds.length;

  // Deactivate the department and all children
  const deactivated = await repository.deactivateDepartment(departmentId, userId);
  if (!deactivated) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Invalidate cache for this department and all children
  await invalidateDepartmentCache(departmentId, existing.parentDepartmentId);
  for (const childId of childIds) {
    await cache.del(departmentKey(childId));
  }

  // Publish event
  await publishEvent('DEPARTMENT_DEACTIVATED', {
    departmentId: deactivated.departmentId,
    code: deactivated.code,
    cascadedChildren: cascadedCount,
    deactivatedBy: userId ?? '',
  });

  logger.info('Department deactivated successfully with cascade', {
    departmentId,
    cascadedChildren: cascadedCount,
  });

  return deactivated;
}

/**
 * Delete a department
 * Requirement 7.5: Reject deletion if has children or users
 *
 * @param departmentId - Department ID
 * @returns true if deleted
 * @throws DepartmentNotFoundError if department not found
 * @throws DepartmentHasDependenciesError if department has children or users
 */
export async function deleteDepartment(departmentId: UUID): Promise<boolean> {
  logger.info('Deleting department', { departmentId });

  // Verify department exists
  const existing = await repository.getDepartmentById(departmentId);
  if (!existing) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Check for dependencies (Requirement 7.5)
  const dependencies = await repository.getDepartmentDependencies(departmentId);
  if (dependencies.childCount > 0 || dependencies.userCount > 0) {
    throw new DepartmentHasDependenciesError(
      departmentId,
      dependencies.childCount,
      dependencies.userCount
    );
  }

  // Delete the department
  const deleted = await repository.deleteDepartment(departmentId);

  if (deleted) {
    // Invalidate cache
    await invalidateDepartmentCache(departmentId, existing.parentDepartmentId);

    logger.info('Department deleted successfully', { departmentId });
  }

  return deleted;
}

/**
 * Validate department code uniqueness
 * Used for form validation before submission
 *
 * @param code - Department code to validate
 * @param excludeId - Department ID to exclude (for updates)
 * @returns true if code is unique
 */
export async function isDepartmentCodeUnique(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.departmentCodeExists(code, excludeId);
  return !exists;
}

/**
 * Get full hierarchy path for a department
 * Returns the path from root to the specified department
 *
 * @param departmentId - Department ID
 * @returns Array of departments from root to target
 */
export async function getDepartmentHierarchy(
  departmentId: UUID
): Promise<{ departmentId: UUID; code: string; name: string; hierarchyLevel: number }[]> {
  const cacheKeyStr = departmentHierarchyKey(departmentId);

  return cache.getOrSet(
    cacheKeyStr,
    async () => {
      const hierarchy = await repository.getDepartmentHierarchy(departmentId);
      return hierarchy.map(row => ({
        departmentId: row.department_id,
        code: row.code,
        name: row.name,
        hierarchyLevel: parseInt(row.hierarchy_level, 10),
      }));
    },
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * List departments with pagination and filters
 * Requirement 7.5: Return departments in hierarchical order
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of departments
 */
export async function listDepartments(
  filters: DepartmentListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<DepartmentDetails>> {
  logger.debug('Listing departments', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = departmentListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listDepartments(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listDepartments(filters, pagination);
}

/**
 * Get root departments (departments with no parent)
 *
 * @returns List of root departments
 */
export async function getRootDepartments(): Promise<DepartmentDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.DEPARTMENT}:root`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getRootDepartments(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get department subtree (department and all descendants)
 *
 * @param departmentId - Department ID
 * @returns List of departments in the subtree
 */
export async function getDepartmentSubtree(departmentId: UUID): Promise<DepartmentDetails[]> {
  return repository.getDepartmentSubtree(departmentId);
}

/**
 * Check if a department can be set as parent of another
 * Returns false if it would create a circular reference
 *
 * @param departmentId - Department that would get a new parent
 * @param newParentId - Proposed new parent department
 * @returns true if the parent relationship is valid
 */
export async function canSetParent(
  departmentId: UUID,
  newParentId: UUID
): Promise<boolean> {
  const wouldCreateCircular = await repository.wouldCreateCircularReference(
    departmentId,
    newParentId
  );
  return !wouldCreateCircular;
}

/**
 * Reactivate a department
 * Note: This does NOT cascade to children - each child must be reactivated individually
 *
 * @param departmentId - Department ID
 * @param userId - ID of user reactivating the department
 * @returns Reactivated department
 * @throws DepartmentNotFoundError if department not found
 */
export async function reactivateDepartment(
  departmentId: UUID,
  userId?: UUID
): Promise<DepartmentDetails> {
  logger.info('Reactivating department', { departmentId });

  // Verify department exists
  const existing = await repository.getDepartmentById(departmentId);
  if (!existing) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Reactivate the department
  const reactivated = await repository.updateDepartment(
    departmentId,
    { isActive: true },
    userId
  );
  if (!reactivated) {
    throw new DepartmentNotFoundError(departmentId);
  }

  // Invalidate cache
  await invalidateDepartmentCache(departmentId, existing.parentDepartmentId);

  // Publish event
  await publishEvent('DEPARTMENT_UPDATED', {
    departmentId: reactivated.departmentId,
    code: reactivated.code,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Department reactivated successfully', { departmentId });

  return reactivated;
}
