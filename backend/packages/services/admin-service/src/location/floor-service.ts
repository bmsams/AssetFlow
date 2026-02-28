/**
 * Floor Service - Business logic layer for floor management
 *
 * Implements:
 * - Floor CRUD operations (Requirement 2)
 * - Cache management for floor data
 * - Event publishing for floor state changes
 */

import type {
  CreateFloorRequest,
  Floor,
  FloorListFilters,
  PaginatedResult,
  PaginationParams,
  UpdateFloorRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { floorKey, floorsByBuildingKey, floorInvalidationPatterns } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './location-repository';

const logger = createLogger({ service: 'floor-service' });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when floor is not found
 */
export class FloorNotFoundError extends Error {
  constructor(floorId: UUID) {
    super(`Floor not found: ${floorId}`);
    this.name = 'FloorNotFoundError';
  }
}

/**
 * Error thrown when floor number already exists in a building
 */
export class FloorNumberExistsError extends Error {
  constructor(buildingId: UUID, floorNumber: number) {
    super(`Floor number ${floorNumber} already exists in building ${buildingId}`);
    this.name = 'FloorNumberExistsError';
  }
}

/**
 * Error thrown when floor has dependencies and cannot be deleted
 */
export class FloorHasDependenciesError extends Error {
  readonly roomCount: number;
  readonly assetCount: number;

  constructor(floorId: UUID, roomCount: number, assetCount: number) {
    super(
      `Cannot delete floor ${floorId}: has ${roomCount} room(s) and ${assetCount} asset(s)`
    );
    this.name = 'FloorHasDependenciesError';
    this.roomCount = roomCount;
    this.assetCount = assetCount;
  }
}

/**
 * Error thrown when building is not found (for floor creation)
 */
export class BuildingNotFoundError extends Error {
  constructor(buildingId: UUID) {
    super(`Building not found: ${buildingId}`);
    this.name = 'BuildingNotFoundError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all floor-related cache entries
 */
async function invalidateFloorCache(floorId: UUID, buildingId?: UUID): Promise<void> {
  const patterns = floorInvalidationPatterns(floorId, buildingId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific floor key and building floors key
  await cache.del(floorKey(floorId));
  if (buildingId) {
    await cache.del(floorsByBuildingKey(buildingId));
  }
}

// ============================================================================
// Floor Service Functions
// ============================================================================

/**
 * Create a new floor
 * Requirement 2.1: Create floor with building reference, floor number, and name
 * Requirement 2.5: Reject creation for non-existent building
 *
 * @param request - Floor creation request
 * @param userId - ID of user creating the floor
 * @returns Created floor
 * @throws BuildingNotFoundError if building does not exist
 * @throws FloorNumberExistsError if floor number already exists in building
 */
export async function createFloor(
  request: CreateFloorRequest,
  userId?: UUID
): Promise<Floor> {
  logger.info('Creating floor', {
    buildingId: request.buildingId,
    floorNumber: request.floorNumber,
    name: request.name,
  });

  // Validate building exists (Requirement 2.5)
  const buildingExists = await repository.buildingExists(request.buildingId);
  if (!buildingExists) {
    throw new BuildingNotFoundError(request.buildingId);
  }

  // Validate floor number uniqueness within building
  const floorNumberExists = await repository.floorNumberExistsInBuilding(
    request.buildingId,
    request.floorNumber
  );
  if (floorNumberExists) {
    throw new FloorNumberExistsError(request.buildingId, request.floorNumber);
  }

  // Create the floor
  const floor = await repository.createFloor(request, userId);

  // Invalidate building floors cache
  await cache.del(floorsByBuildingKey(request.buildingId));

  // Publish event
  await publishEvent('FLOOR_CREATED', {
    floorId: floor.floorId,
    buildingId: floor.buildingId,
    floorNumber: floor.floorNumber,
    name: floor.name,
    createdBy: userId,
  });

  logger.info('Floor created successfully', {
    floorId: floor.floorId,
    buildingId: floor.buildingId,
    floorNumber: floor.floorNumber,
  });

  return floor;
}

/**
 * Get floor by ID
 *
 * @param floorId - Floor ID
 * @returns Floor or null if not found
 */
export async function getFloor(floorId: UUID): Promise<Floor | null> {
  const cacheKeyStr = floorKey(floorId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getFloorById(floorId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get floor by ID, throwing if not found
 *
 * @param floorId - Floor ID
 * @returns Floor
 * @throws FloorNotFoundError if floor not found
 */
export async function getFloorOrThrow(floorId: UUID): Promise<Floor> {
  const floor = await getFloor(floorId);
  if (!floor) {
    throw new FloorNotFoundError(floorId);
  }
  return floor;
}

/**
 * Get floors for a building ordered by floor number
 * Requirement 2.2: Return all floors for a building ordered by floor number
 *
 * @param buildingId - Building ID
 * @returns List of floors ordered by floor number
 */
export async function getFloorsByBuilding(buildingId: UUID): Promise<Floor[]> {
  const cacheKeyStr = floorsByBuildingKey(buildingId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getFloorsByBuildingId(buildingId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update floor details
 * Requirement 2.3: Update specified fields and maintain building relationship
 *
 * @param floorId - Floor ID
 * @param request - Update request
 * @param userId - ID of user updating the floor
 * @returns Updated floor
 * @throws FloorNotFoundError if floor not found
 */
export async function updateFloor(
  floorId: UUID,
  request: UpdateFloorRequest,
  userId?: UUID
): Promise<Floor> {
  logger.info('Updating floor', { floorId, updates: Object.keys(request) });

  // Verify floor exists and get building ID for cache invalidation
  const existing = await repository.getFloorById(floorId);
  if (!existing) {
    throw new FloorNotFoundError(floorId);
  }

  // Update the floor
  const updated = await repository.updateFloor(floorId, request, userId);
  if (!updated) {
    throw new FloorNotFoundError(floorId);
  }

  // Invalidate cache
  await invalidateFloorCache(floorId, existing.buildingId);

  // Publish event
  await publishEvent('FLOOR_UPDATED', {
    floorId: updated.floorId,
    buildingId: updated.buildingId,
    floorNumber: updated.floorNumber,
    name: updated.name,
    updatedBy: userId,
    changes: Object.keys(request),
  });

  logger.info('Floor updated successfully', { floorId });

  return updated;
}

/**
 * Deactivate a floor
 * Requirement 2.4: Mark floor as inactive and prevent new room assignments
 *
 * @param floorId - Floor ID
 * @param userId - ID of user deactivating the floor
 * @returns Deactivated floor
 * @throws FloorNotFoundError if floor not found
 */
export async function deactivateFloor(floorId: UUID, userId?: UUID): Promise<Floor> {
  logger.info('Deactivating floor', { floorId });

  // Verify floor exists and get building ID for cache invalidation
  const existing = await repository.getFloorById(floorId);
  if (!existing) {
    throw new FloorNotFoundError(floorId);
  }

  // Deactivate the floor
  const deactivated = await repository.deactivateFloor(floorId, userId);
  if (!deactivated) {
    throw new FloorNotFoundError(floorId);
  }

  // Invalidate cache
  await invalidateFloorCache(floorId, existing.buildingId);

  // Publish event
  await publishEvent('FLOOR_DEACTIVATED', {
    floorId: deactivated.floorId,
    buildingId: deactivated.buildingId,
    floorNumber: deactivated.floorNumber,
    name: deactivated.name,
    deactivatedBy: userId,
  });

  logger.info('Floor deactivated successfully', { floorId });

  return deactivated;
}

/**
 * Delete a floor
 * Reject deletion if floor has rooms or assets
 *
 * @param floorId - Floor ID
 * @returns true if deleted
 * @throws FloorNotFoundError if floor not found
 * @throws FloorHasDependenciesError if floor has rooms or assets
 */
export async function deleteFloor(floorId: UUID): Promise<boolean> {
  logger.info('Deleting floor', { floorId });

  // Verify floor exists and get building ID for cache invalidation
  const existing = await repository.getFloorById(floorId);
  if (!existing) {
    throw new FloorNotFoundError(floorId);
  }

  // Check for dependencies
  const dependencies = await repository.getFloorDependencies(floorId);
  if (dependencies.roomCount > 0 || dependencies.assetCount > 0) {
    throw new FloorHasDependenciesError(
      floorId,
      dependencies.roomCount,
      dependencies.assetCount
    );
  }

  // Delete the floor
  const deleted = await repository.deleteFloor(floorId);

  if (deleted) {
    // Invalidate cache
    await invalidateFloorCache(floorId, existing.buildingId);

    logger.info('Floor deleted successfully', { floorId });
  }

  return deleted;
}

/**
 * List floors with pagination and filters
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of floors
 */
export async function listFloors(
  filters: FloorListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Floor>> {
  logger.debug('Listing floors', { filters, pagination });

  return repository.listFloors(filters, pagination);
}

/**
 * Get all active floors for a building (for dropdowns/selectors)
 *
 * @param buildingId - Building ID
 * @returns List of active floors
 */
export async function getActiveFloorsByBuilding(buildingId: UUID): Promise<Floor[]> {
  const cacheKeyStr = `${floorsByBuildingKey(buildingId)}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveFloorsByBuildingId(buildingId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate floor number uniqueness within a building
 * Used for form validation before submission
 *
 * @param buildingId - Building ID
 * @param floorNumber - Floor number to validate
 * @param excludeFloorId - Floor ID to exclude (for updates)
 * @returns true if floor number is unique within the building
 */
export async function isFloorNumberUnique(
  buildingId: UUID,
  floorNumber: number,
  excludeFloorId?: UUID
): Promise<boolean> {
  const exists = await repository.floorNumberExistsInBuilding(
    buildingId,
    floorNumber,
    excludeFloorId
  );
  return !exists;
}
