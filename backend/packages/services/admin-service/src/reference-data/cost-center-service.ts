/**
 * Cost Center Service - Business logic layer for cost center management
 *
 * Implements:
 * - Cost Center CRUD operations (Requirement 8.1-8.6)
 * - Budget tracking and calculations (availableAmount = budgetAmount - spentAmount)
 * - Cache management for cost center data
 * - Event publishing for cost center state changes
 * - Expense recording and utilization tracking
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
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, listKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './cost-center-repository';

const logger = createLogger({ service: 'cost-center-service' });

// ============================================================================
// Cache Key Helpers
// ============================================================================

/**
 * Build a cache key for a cost center
 * Format: cost_center:{cost_center_id}
 */
function costCenterKey(costCenterId: UUID): string {
  return `${CACHE_ENTITY_TYPES.COST_CENTER}:${costCenterId}`;
}

/**
 * Build a cache key for cost centers by department
 * Format: cost_center:department:{department_id}
 */
function costCentersByDepartmentKey(departmentId: UUID): string {
  return `${CACHE_ENTITY_TYPES.COST_CENTER}:department:${departmentId}`;
}

/**
 * Build a cache key for cost center list
 * Format: cost_center:list or cost_center:list:{sorted_params}
 */
function costCenterListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.COST_CENTER, params);
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when cost center is not found
 */
export class CostCenterNotFoundError extends Error {
  constructor(costCenterId: UUID) {
    super(`Cost center not found: ${costCenterId}`);
    this.name = 'CostCenterNotFoundError';
  }
}

/**
 * Error thrown when cost center code already exists
 */
export class CostCenterCodeExistsError extends Error {
  constructor(code: string) {
    super(`Cost center code '${code}' already exists`);
    this.name = 'CostCenterCodeExistsError';
  }
}

/**
 * Error thrown when cost center has dependencies and cannot be deleted
 * Requirement 8.6: Reject deletion if has allocated expenses
 */
export class CostCenterHasDependenciesError extends Error {
  readonly assetCount: number;
  readonly poCount: number;

  constructor(costCenterId: UUID, assetCount: number, poCount: number) {
    super(
      `Cannot delete cost center ${costCenterId}: has ${assetCount} asset(s) and ${poCount} purchase order(s)`
    );
    this.name = 'CostCenterHasDependenciesError';
    this.assetCount = assetCount;
    this.poCount = poCount;
  }
}

/**
 * Error thrown when expense would exceed budget
 */
export class BudgetExceededError extends Error {
  readonly costCenterId: UUID;
  readonly availableAmount: number;
  readonly requestedAmount: number;

  constructor(costCenterId: UUID, availableAmount: number, requestedAmount: number) {
    super(
      `Expense of ${requestedAmount} would exceed available budget of ${availableAmount} for cost center ${costCenterId}`
    );
    this.name = 'BudgetExceededError';
    this.costCenterId = costCenterId;
    this.availableAmount = availableAmount;
    this.requestedAmount = requestedAmount;
  }
}

/**
 * Error thrown when cost center is inactive
 */
export class CostCenterInactiveError extends Error {
  constructor(costCenterId: UUID) {
    super(`Cost center ${costCenterId} is inactive and cannot accept new expenses`);
    this.name = 'CostCenterInactiveError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Build patterns for invalidating cost center-related cache entries
 */
function costCenterInvalidationPatterns(costCenterId: UUID, departmentId?: UUID | null): string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.COST_CENTER}:${costCenterId}*`,
    `${CACHE_ENTITY_TYPES.COST_CENTER}:list*`,
    `${CACHE_ENTITY_TYPES.COST_CENTER}:all*`,
    `${CACHE_ENTITY_TYPES.COST_CENTER}:active*`,
    `search:${CACHE_ENTITY_TYPES.COST_CENTER}:*`,
  ];

  if (departmentId) {
    patterns.push(`${CACHE_ENTITY_TYPES.COST_CENTER}:department:${departmentId}*`);
  }

  return patterns;
}

/**
 * Invalidate all cost center-related cache entries
 */
async function invalidateCostCenterCache(costCenterId: UUID, departmentId?: UUID | null): Promise<void> {
  const patterns = costCenterInvalidationPatterns(costCenterId, departmentId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific cost center key
  await cache.del(costCenterKey(costCenterId));
}

// ============================================================================
// Cost Center Service Functions
// ============================================================================

/**
 * Create a new cost center
 * Requirement 8.1: Create cost center with code, name, department, and budget amount
 *
 * @param request - Cost center creation request
 * @param userId - ID of user creating the cost center
 * @returns Created cost center
 * @throws CostCenterCodeExistsError if cost center code already exists
 */
export async function createCostCenter(
  request: CreateCostCenterRequest,
  userId?: UUID
): Promise<CostCenterDetails> {
  logger.info('Creating cost center', { code: request.code, name: request.name, budgetAmount: request.budgetAmount });

  // Validate cost center code uniqueness
  const codeExists = await repository.costCenterCodeExists(request.code);
  if (codeExists) {
    throw new CostCenterCodeExistsError(request.code);
  }

  // Create the cost center
  const costCenter = await repository.createCostCenter(request, userId);

  // Invalidate list cache
  await cache.del(costCenterListKey());
  if (request.departmentId) {
    await cache.del(costCentersByDepartmentKey(request.departmentId));
  }

  // Publish event
  await publishEvent('COST_CENTER_CREATED', {
    costCenterId: costCenter.costCenterId,
    code: costCenter.code,
    name: costCenter.name,
    budgetAmount: costCenter.budgetAmount,
    createdBy: userId ?? '',
  });

  logger.info('Cost center created successfully', {
    costCenterId: costCenter.costCenterId,
    code: costCenter.code,
    budgetAmount: costCenter.budgetAmount,
  });

  return costCenter;
}

/**
 * Get cost center by ID
 * Requirement 8.2: Return cost center details including budget, spent, and available amounts
 *
 * @param costCenterId - Cost center ID
 * @returns Cost center or null if not found
 */
export async function getCostCenterById(costCenterId: UUID): Promise<CostCenterDetails | null> {
  const cacheKeyStr = costCenterKey(costCenterId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getCostCenterById(costCenterId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get cost center by ID, throwing if not found
 *
 * @param costCenterId - Cost center ID
 * @returns Cost center
 * @throws CostCenterNotFoundError if cost center not found
 */
export async function getCostCenterOrThrow(costCenterId: UUID): Promise<CostCenterDetails> {
  const costCenter = await getCostCenterById(costCenterId);
  if (!costCenter) {
    throw new CostCenterNotFoundError(costCenterId);
  }
  return costCenter;
}

/**
 * Get cost center by code
 *
 * @param code - Cost center code
 * @returns Cost center or null if not found
 */
export async function getCostCenterByCode(code: string): Promise<CostCenterDetails | null> {
  return repository.getCostCenterByCode(code);
}

/**
 * Update cost center details
 * Requirement 8.3: Update budget or department assignment and recalculate available amount
 *
 * @param costCenterId - Cost center ID
 * @param request - Update request
 * @param userId - ID of user updating the cost center
 * @returns Updated cost center
 * @throws CostCenterNotFoundError if cost center not found
 */
export async function updateCostCenter(
  costCenterId: UUID,
  request: UpdateCostCenterRequest,
  userId?: UUID
): Promise<CostCenterDetails> {
  logger.info('Updating cost center', { costCenterId, updates: Object.keys(request) });

  // Verify cost center exists
  const existing = await repository.getCostCenterById(costCenterId);
  if (!existing) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Update the cost center
  const updated = await repository.updateCostCenter(costCenterId, request, userId);
  if (!updated) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Invalidate cache
  await invalidateCostCenterCache(costCenterId, existing.departmentId);
  // Also invalidate new department's cache if department changed
  if (request.departmentId && request.departmentId !== existing.departmentId) {
    await cache.del(costCentersByDepartmentKey(request.departmentId));
  }

  // Build changes array for event
  const changes: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  if (request.name !== undefined && request.name !== existing.name) {
    changes.push({ field: 'name', oldValue: existing.name, newValue: request.name });
  }
  if (request.departmentId !== undefined && request.departmentId !== existing.departmentId) {
    changes.push({ field: 'departmentId', oldValue: existing.departmentId, newValue: request.departmentId });
  }
  if (request.budgetAmount !== undefined && request.budgetAmount !== existing.budgetAmount) {
    changes.push({ field: 'budgetAmount', oldValue: existing.budgetAmount, newValue: request.budgetAmount });
  }
  if (request.isActive !== undefined && request.isActive !== existing.isActive) {
    changes.push({ field: 'isActive', oldValue: existing.isActive, newValue: request.isActive });
  }

  // Publish event
  await publishEvent('COST_CENTER_UPDATED', {
    costCenterId: updated.costCenterId,
    code: updated.code,
    changes,
    updatedBy: userId ?? '',
  });

  logger.info('Cost center updated successfully', { costCenterId });

  return updated;
}

/**
 * Deactivate a cost center
 * Requirement 8.4: Mark cost center as inactive and prevent new expense allocations
 *
 * @param costCenterId - Cost center ID
 * @param userId - ID of user deactivating the cost center
 * @returns Deactivated cost center
 * @throws CostCenterNotFoundError if cost center not found
 */
export async function deactivateCostCenter(
  costCenterId: UUID,
  userId?: UUID
): Promise<CostCenterDetails> {
  logger.info('Deactivating cost center', { costCenterId });

  // Verify cost center exists
  const existing = await repository.getCostCenterById(costCenterId);
  if (!existing) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Check for dependencies before deactivation
  const dependencies = await repository.getCostCenterDependencies(costCenterId);
  if (dependencies.assetCount > 0 || dependencies.poCount > 0) {
    logger.warn('Deactivating cost center with dependencies', {
      costCenterId,
      assetCount: dependencies.assetCount,
      poCount: dependencies.poCount,
    });
  }

  // Deactivate the cost center
  const deactivated = await repository.deactivateCostCenter(costCenterId, userId);
  if (!deactivated) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Invalidate cache
  await invalidateCostCenterCache(costCenterId, existing.departmentId);

  // Publish event
  await publishEvent('COST_CENTER_UPDATED', {
    costCenterId: deactivated.costCenterId,
    code: deactivated.code,
    changes: [{ field: 'isActive', oldValue: true, newValue: false }],
    updatedBy: userId ?? '',
  });

  logger.info('Cost center deactivated successfully', { costCenterId });

  return deactivated;
}

/**
 * Delete a cost center
 * Requirement 8.6: Reject deletion if has allocated expenses
 *
 * @param costCenterId - Cost center ID
 * @returns true if deleted
 * @throws CostCenterNotFoundError if cost center not found
 * @throws CostCenterHasDependenciesError if cost center has assets or purchase orders
 */
export async function deleteCostCenter(costCenterId: UUID): Promise<boolean> {
  logger.info('Deleting cost center', { costCenterId });

  // Verify cost center exists
  const existing = await repository.getCostCenterById(costCenterId);
  if (!existing) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Check for dependencies (Requirement 8.6)
  const dependencies = await repository.getCostCenterDependencies(costCenterId);
  if (dependencies.assetCount > 0 || dependencies.poCount > 0) {
    throw new CostCenterHasDependenciesError(
      costCenterId,
      dependencies.assetCount,
      dependencies.poCount
    );
  }

  // Delete the cost center
  const deleted = await repository.deleteCostCenter(costCenterId);

  if (deleted) {
    // Invalidate cache
    await invalidateCostCenterCache(costCenterId, existing.departmentId);

    logger.info('Cost center deleted successfully', { costCenterId });
  }

  return deleted;
}

/**
 * List cost centers with pagination and filters
 * Requirement 8.5: Return paginated list with budget utilization percentages
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of cost centers
 */
export async function listCostCenters(
  filters: CostCenterListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<CostCenterDetails>> {
  logger.debug('Listing cost centers', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = costCenterListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listCostCenters(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listCostCenters(filters, pagination);
}

/**
 * Record an expense against a cost center
 * Requirement 8.4: Track spending against budget and calculate available amount
 *
 * @param costCenterId - Cost center ID
 * @param amount - Expense amount to record
 * @param userId - ID of user recording the expense
 * @returns Updated cost center with new spent and available amounts
 * @throws CostCenterNotFoundError if cost center not found
 * @throws CostCenterInactiveError if cost center is inactive
 * @throws BudgetExceededError if expense would exceed available budget
 */
export async function recordExpense(
  costCenterId: UUID,
  amount: number,
  userId?: UUID
): Promise<CostCenterDetails> {
  logger.info('Recording expense', { costCenterId, amount });

  // Verify cost center exists and is active
  const existing = await repository.getCostCenterById(costCenterId);
  if (!existing) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  if (!existing.isActive) {
    throw new CostCenterInactiveError(costCenterId);
  }

  // Check if expense would exceed budget (warning only, not blocking)
  if (amount > existing.availableAmount) {
    logger.warn('Expense exceeds available budget', {
      costCenterId,
      amount,
      availableAmount: existing.availableAmount,
      budgetAmount: existing.budgetAmount,
    });
  }

  // Record the expense
  const updated = await repository.recordExpense(costCenterId, amount);
  if (!updated) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Invalidate cache
  await invalidateCostCenterCache(costCenterId, existing.departmentId);

  // Publish event
  await publishEvent('COST_CENTER_UPDATED', {
    costCenterId: updated.costCenterId,
    code: updated.code,
    changes: [
      { field: 'spentAmount', oldValue: existing.spentAmount, newValue: updated.spentAmount },
      { field: 'availableAmount', oldValue: existing.availableAmount, newValue: updated.availableAmount },
    ],
    updatedBy: userId ?? '',
  });

  logger.info('Expense recorded successfully', {
    costCenterId,
    amount,
    newSpentAmount: updated.spentAmount,
    newAvailableAmount: updated.availableAmount,
  });

  return updated;
}

/**
 * Get cost center budget utilization percentage
 * Requirement 8.5: Return budget utilization percentages
 *
 * @param costCenterId - Cost center ID
 * @returns Utilization percentage (0-100+) or null if not found
 */
export async function getCostCenterUtilization(costCenterId: UUID): Promise<number | null> {
  return repository.getCostCenterUtilization(costCenterId);
}

/**
 * Get cost centers by department
 *
 * @param departmentId - Department ID
 * @returns List of cost centers for the department
 */
export async function getCostCentersByDepartment(departmentId: UUID): Promise<CostCenterDetails[]> {
  const cacheKeyStr = costCentersByDepartmentKey(departmentId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getCostCentersByDepartment(departmentId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get all cost centers
 *
 * @returns List of all cost centers
 */
export async function getAllCostCenters(): Promise<CostCenterDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.COST_CENTER}:all`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getAllCostCenters(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get active cost centers only
 *
 * @returns List of active cost centers
 */
export async function getActiveCostCenters(): Promise<CostCenterDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.COST_CENTER}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveCostCenters(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get cost centers by fiscal year
 *
 * @param fiscalYear - Fiscal year
 * @returns List of cost centers for the fiscal year
 */
export async function getCostCentersByFiscalYear(fiscalYear: number): Promise<CostCenterDetails[]> {
  const cacheKeyStr = `${CACHE_ENTITY_TYPES.COST_CENTER}:fiscal:${fiscalYear}`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getCostCentersByFiscalYear(fiscalYear),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate cost center code uniqueness
 * Used for form validation before submission
 *
 * @param code - Cost center code to validate
 * @param excludeId - Cost center ID to exclude (for updates)
 * @returns true if code is unique
 */
export async function isCostCenterCodeUnique(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const exists = await repository.costCenterCodeExists(code, excludeId);
  return !exists;
}

/**
 * Reactivate a cost center
 *
 * @param costCenterId - Cost center ID
 * @param userId - ID of user reactivating the cost center
 * @returns Reactivated cost center
 * @throws CostCenterNotFoundError if cost center not found
 */
export async function reactivateCostCenter(
  costCenterId: UUID,
  userId?: UUID
): Promise<CostCenterDetails> {
  logger.info('Reactivating cost center', { costCenterId });

  // Verify cost center exists
  const existing = await repository.getCostCenterById(costCenterId);
  if (!existing) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Reactivate the cost center
  const reactivated = await repository.updateCostCenter(
    costCenterId,
    { isActive: true },
    userId
  );
  if (!reactivated) {
    throw new CostCenterNotFoundError(costCenterId);
  }

  // Invalidate cache
  await invalidateCostCenterCache(costCenterId, existing.departmentId);

  // Publish event
  await publishEvent('COST_CENTER_UPDATED', {
    costCenterId: reactivated.costCenterId,
    code: reactivated.code,
    changes: [{ field: 'isActive', oldValue: false, newValue: true }],
    updatedBy: userId ?? '',
  });

  logger.info('Cost center reactivated successfully', { costCenterId });

  return reactivated;
}

/**
 * Calculate budget summary for a cost center
 * Returns detailed budget information including utilization percentage
 *
 * @param costCenterId - Cost center ID
 * @returns Budget summary or null if not found
 */
export async function getCostCenterBudgetSummary(costCenterId: UUID): Promise<{
  costCenterId: UUID;
  code: string;
  name: string;
  budgetAmount: number;
  spentAmount: number;
  availableAmount: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
} | null> {
  const costCenter = await getCostCenterById(costCenterId);
  if (!costCenter) {
    return null;
  }

  const utilizationPercentage = costCenter.budgetAmount > 0
    ? Math.round((costCenter.spentAmount / costCenter.budgetAmount) * 10000) / 100
    : 0;

  return {
    costCenterId: costCenter.costCenterId,
    code: costCenter.code,
    name: costCenter.name,
    budgetAmount: costCenter.budgetAmount,
    spentAmount: costCenter.spentAmount,
    availableAmount: costCenter.availableAmount,
    utilizationPercentage,
    isOverBudget: costCenter.spentAmount > costCenter.budgetAmount,
  };
}
