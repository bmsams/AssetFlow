/**
 * Building Service - Business logic layer for building management
 *
 * Implements:
 * - Building CRUD operations (Requirement 1)
 * - Cache management for building data
 * - Event publishing for building state changes
 */

import type {
  Building,
  BuildingListFilters,
  CreateBuildingRequest,
  PaginatedResult,
  PaginationParams,
  UUID,
  UpdateBuildingRequest,
} from '@ams/types';
import * as cache from '@ams/cache';
import { buildingKey, buildingListKey, buildingInvalidationPatterns } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './location-repository';

const logger = createLogger({ service: 'building-service' });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when building code already exists
 */
export class BuildingCodeExistsError extends Error {
  constructor(buildingCode: string) {
    super(`Building code '${buildingCode}' already exists`);
    this.name = 'BuildingCodeExistsError';
  }
}

/**
 * Error thrown when building is not found
 */
export class BuildingNotFoundError extends Error {
  constructor(buildingId: UUID) {
    super(`Building not found: ${buildingId}`);
    this.name = 'BuildingNotFoundError';
  }
}

/**
 * Error thrown when building has dependencies and cannot be deleted
 */
export class BuildingHasDependenciesError extends Error {
  readonly floorCount: number;
  readonly assetCount: number;

  constructor(buildingId: UUID, floorCount: number, assetCount: number) {
    super(
      `Cannot delete building ${buildingId}: has ${floorCount} floor(s) and ${assetCount} asset(s)`
    );
    this.name = 'BuildingHasDependenciesError';
    this.floorCount = floorCount;
    this.assetCount = assetCount;
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all building-related cache entries
 */
async function invalidateBuildingCache(buildingId: UUID): Promise<void> {
  const patterns = buildingInvalidationPatterns(buildingId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific building key and list keys
  await cache.del(buildingKey(buildingId));
  await cache.del(buildingListKey());
}

// ============================================================================
// Building Service Functions
// ============================================================================

/**
 * Create a new building
 * Requirement 1.1: Create building with name, address, and contact information
 *
 * @param request - Building creation request
 * @param userId - ID of user creating the building
 * @returns Created building
 * @throws BuildingCodeExistsError if building code already exists
 */
export async function createBuilding(
  request: CreateBuildingRequest,
  userId?: UUID
): Promise<Building> {
  logger.info('Creating building', { buildingCode: request.buildingCode, name: request.name });

  // Validate building code uniqueness
  const codeExists = await repository.buildingCodeExists(request.buildingCode);
  if (codeExists) {
    throw new BuildingCodeExistsError(request.buildingCode);
  }

  // Create the building
  const building = await repository.createBuilding(request, userId);

  // Invalidate list cache
  await cache.del(buildingListKey());

  // Publish event
  await publishEvent('BUILDING_CREATED', {
    buildingId: building.buildingId,
    buildingCode: building.buildingCode,
    name: building.name,
    createdBy: userId,
  });

  logger.info('Building created successfully', {
    buildingId: building.buildingId,
    buildingCode: building.buildingCode,
  });

  return building;
}

/**
 * Get building by ID
 * Requirement 1.2: Return complete building details including floors count
 *
 * @param buildingId - Building ID
 * @returns Building or null if not found
 */
export async function getBuilding(buildingId: UUID): Promise<Building | null> {
  const cacheKeyStr = buildingKey(buildingId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getBuildingById(buildingId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get building by ID, throwing if not found
 *
 * @param buildingId - Building ID
 * @returns Building
 * @throws BuildingNotFoundError if building not found
 */
export async function getBuildingOrThrow(buildingId: UUID): Promise<Building> {
  const building = await getBuilding(buildingId);
  if (!building) {
    throw new BuildingNotFoundError(buildingId);
  }
  return building;
}

/**
 * Get building by code
 *
 * @param buildingCode - Building code
 * @returns Building or null if not found
 */
export async function getBuildingByCode(buildingCode: string): Promise<Building | null> {
  return repository.getBuildingByCode(buildingCode);
}

/**
 * Update building details
 * Requirement 1.3: Update specified fields and preserve unchanged fields
 *
 * @param buildingId - Building ID
 * @param request - Update request
 * @param userId - ID of user updating the building
 * @returns Updated building
 * @throws BuildingNotFoundError if building not found
 */
export async function updateBuilding(
  buildingId: UUID,
  request: UpdateBuildingRequest,
  userId?: UUID
): Promise<Building> {
  logger.info('Updating building', { buildingId, updates: Object.keys(request) });

  // Verify building exists
  const existing = await repository.getBuildingById(buildingId);
  if (!existing) {
    throw new BuildingNotFoundError(buildingId);
  }

  // Update the building
  const updated = await repository.updateBuilding(buildingId, request, userId);
  if (!updated) {
    throw new BuildingNotFoundError(buildingId);
  }

  // Invalidate cache
  await invalidateBuildingCache(buildingId);

  // Publish event
  await publishEvent('BUILDING_UPDATED', {
    buildingId: updated.buildingId,
    buildingCode: updated.buildingCode,
    name: updated.name,
    updatedBy: userId,
    changes: Object.keys(request),
  });

  logger.info('Building updated successfully', { buildingId });

  return updated;
}

/**
 * Deactivate a building
 * Requirement 1.4: Mark building as inactive and prevent new asset assignments
 *
 * @param buildingId - Building ID
 * @param userId - ID of user deactivating the building
 * @returns Deactivated building
 * @throws BuildingNotFoundError if building not found
 */
export async function deactivateBuilding(buildingId: UUID, userId?: UUID): Promise<Building> {
  logger.info('Deactivating building', { buildingId });

  // Verify building exists
  const existing = await repository.getBuildingById(buildingId);
  if (!existing) {
    throw new BuildingNotFoundError(buildingId);
  }

  // Deactivate the building
  const deactivated = await repository.deactivateBuilding(buildingId, userId);
  if (!deactivated) {
    throw new BuildingNotFoundError(buildingId);
  }

  // Invalidate cache
  await invalidateBuildingCache(buildingId);

  // Publish event
  await publishEvent('BUILDING_DEACTIVATED', {
    buildingId: deactivated.buildingId,
    buildingCode: deactivated.buildingCode,
    name: deactivated.name,
    deactivatedBy: userId,
  });

  logger.info('Building deactivated successfully', { buildingId });

  return deactivated;
}

/**
 * Delete a building
 * Requirement 1.6: Reject deletion if building has active assets or floors
 *
 * @param buildingId - Building ID
 * @returns true if deleted
 * @throws BuildingNotFoundError if building not found
 * @throws BuildingHasDependenciesError if building has floors or assets
 */
export async function deleteBuilding(buildingId: UUID): Promise<boolean> {
  logger.info('Deleting building', { buildingId });

  // Verify building exists
  const existing = await repository.getBuildingById(buildingId);
  if (!existing) {
    throw new BuildingNotFoundError(buildingId);
  }

  // Check for dependencies
  const dependencies = await repository.getBuildingDependencies(buildingId);
  if (dependencies.floorCount > 0 || dependencies.assetCount > 0) {
    throw new BuildingHasDependenciesError(
      buildingId,
      dependencies.floorCount,
      dependencies.assetCount
    );
  }

  // Delete the building
  const deleted = await repository.deleteBuilding(buildingId);

  if (deleted) {
    // Invalidate cache
    await invalidateBuildingCache(buildingId);

    logger.info('Building deleted successfully', { buildingId });
  }

  return deleted;
}

/**
 * List buildings with pagination and filters
 * Requirement 1.5: Return paginated list of buildings matching filter criteria
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of buildings
 */
export async function listBuildings(
  filters: BuildingListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Building>> {
  logger.debug('Listing buildings', { filters, pagination });

  // For simple list queries without filters, use cache
  const hasFilters = Object.keys(filters).length > 0;
  const isFirstPage = (pagination.page ?? 1) === 1;
  const isDefaultLimit = (pagination.limit ?? 20) === 20;

  if (!hasFilters && isFirstPage && isDefaultLimit) {
    const cacheKeyStr = buildingListKey();
    return cache.getOrSet(
      cacheKeyStr,
      () => repository.listBuildings(filters, pagination),
      { ttl: cache.DEFAULT_TTL.SHORT }
    );
  }

  return repository.listBuildings(filters, pagination);
}

/**
 * Get all active buildings (for dropdowns/selectors)
 *
 * @returns List of active buildings
 */
export async function getActiveBuildings(): Promise<Building[]> {
  const cacheKeyStr = buildingListKey({ isActive: true });

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveBuildings(),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate building code uniqueness
 * Used for form validation before submission
 *
 * @param buildingCode - Building code to validate
 * @param excludeBuildingId - Building ID to exclude (for updates)
 * @returns true if code is unique
 */
export async function isBuildingCodeUnique(
  buildingCode: string,
  excludeBuildingId?: UUID
): Promise<boolean> {
  const exists = await repository.buildingCodeExists(buildingCode, excludeBuildingId);
  return !exists;
}


