/**
 * Rack Service - Business logic layer for rack management
 *
 * Implements:
 * - Rack CRUD operations (Requirement 4)
 * - Cache management for rack data
 * - Event publishing for rack state changes
 * - Unit calculations (Requirement 4.6): availableUnits = totalUnits - usedUnits
 */

import type {
  CreateRackRequest,
  PaginatedResult,
  PaginationParams,
  Rack,
  RackListFilters,
  UpdateRackRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { rackKey, racksByRoomKey, rackInvalidationPatterns } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './location-repository';

const logger = createLogger({ service: 'rack-service' });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when rack is not found
 */
export class RackNotFoundError extends Error {
  constructor(rackId: UUID) {
    super(`Rack not found: ${rackId}`);
    this.name = 'RackNotFoundError';
  }
}

/**
 * Error thrown when rack name already exists in a room
 */
export class RackNameExistsError extends Error {
  constructor(roomId: UUID, rackName: string) {
    super(`Rack name ${rackName} already exists in room ${roomId}`);
    this.name = 'RackNameExistsError';
  }
}

/**
 * Error thrown when rack has dependencies and cannot be deleted
 */
export class RackHasDependenciesError extends Error {
  readonly assetCount: number;

  constructor(rackId: UUID, assetCount: number) {
    super(`Cannot delete rack ${rackId}: has ${assetCount} mounted asset(s)`);
    this.name = 'RackHasDependenciesError';
    this.assetCount = assetCount;
  }
}

/**
 * Error thrown when room is not found (for rack creation)
 */
export class RoomNotFoundError extends Error {
  constructor(roomId: UUID) {
    super(`Room not found: ${roomId}`);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Error thrown when rack has insufficient units for an operation
 * Requirement 4.6: Validate unit calculations
 */
export class InsufficientRackUnitsError extends Error {
  readonly totalUnits: number;
  readonly usedUnits: number;
  readonly requestedUnits: number;

  constructor(rackId: UUID, totalUnits: number, usedUnits: number, requestedUnits: number) {
    super(
      `Rack ${rackId} has insufficient units: ${totalUnits - usedUnits} available, ${requestedUnits} requested`
    );
    this.name = 'InsufficientRackUnitsError';
    this.totalUnits = totalUnits;
    this.usedUnits = usedUnits;
    this.requestedUnits = requestedUnits;
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all rack-related cache entries
 */
async function invalidateRackCache(rackId: UUID, roomId?: UUID): Promise<void> {
  const patterns = rackInvalidationPatterns(rackId, roomId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific rack key and room racks key
  await cache.del(rackKey(rackId));
  if (roomId) {
    await cache.del(racksByRoomKey(roomId));
  }
}

// ============================================================================
// Rack Service Functions
// ============================================================================

/**
 * Create a new rack
 * Requirement 4.1: Create rack with room reference, name, and unit capacity
 * Requirement 4.5: Reject creation for non-existent room
 *
 * @param request - Rack creation request
 * @param userId - ID of user creating the rack
 * @returns Created rack
 * @throws RoomNotFoundError if room does not exist
 * @throws RackNameExistsError if rack name already exists in room
 */
export async function createRack(
  request: CreateRackRequest,
  userId?: UUID
): Promise<Rack> {
  logger.info('Creating rack', {
    roomId: request.roomId,
    rackName: request.rackName,
    totalUnits: request.totalUnits,
  });

  // Validate room exists (Requirement 4.5)
  const roomExists = await repository.roomExists(request.roomId);
  if (!roomExists) {
    throw new RoomNotFoundError(request.roomId);
  }

  // Validate rack name uniqueness within room
  const rackNameExists = await repository.rackNameExistsInRoom(
    request.roomId,
    request.rackName
  );
  if (rackNameExists) {
    throw new RackNameExistsError(request.roomId, request.rackName);
  }

  // Create the rack
  const rack = await repository.createRack(request, userId);

  // Invalidate room racks cache
  await cache.del(racksByRoomKey(request.roomId));

  // Publish event
  await publishEvent('RACK_CREATED', {
    rackId: rack.rackId,
    roomId: rack.roomId,
    rackName: rack.rackName,
    totalUnits: rack.totalUnits,
    createdBy: userId,
  });

  logger.info('Rack created successfully', {
    rackId: rack.rackId,
    roomId: rack.roomId,
    rackName: rack.rackName,
  });

  return rack;
}

/**
 * Get rack by ID
 * Requirement 4.2: Return rack information including total units, used units, and available units
 *
 * @param rackId - Rack ID
 * @returns Rack or null if not found
 */
export async function getRack(rackId: UUID): Promise<Rack | null> {
  const cacheKeyStr = rackKey(rackId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getRackById(rackId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get rack by ID, throwing if not found
 *
 * @param rackId - Rack ID
 * @returns Rack
 * @throws RackNotFoundError if rack not found
 */
export async function getRackOrThrow(rackId: UUID): Promise<Rack> {
  const rack = await getRack(rackId);
  if (!rack) {
    throw new RackNotFoundError(rackId);
  }
  return rack;
}

/**
 * Get racks for a room ordered by name
 * Requirement 4.2: Return all racks for a room ordered by name
 *
 * @param roomId - Room ID
 * @returns List of racks ordered by name
 */
export async function getRacksByRoom(roomId: UUID): Promise<Rack[]> {
  const cacheKeyStr = racksByRoomKey(roomId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getRacksByRoomId(roomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update rack details
 * Requirement 4.3: Update specified fields including unit capacity
 *
 * @param rackId - Rack ID
 * @param request - Update request
 * @param userId - ID of user updating the rack
 * @returns Updated rack
 * @throws RackNotFoundError if rack not found
 * @throws InsufficientRackUnitsError if totalUnits is reduced below usedUnits
 */
export async function updateRack(
  rackId: UUID,
  request: UpdateRackRequest,
  userId?: UUID
): Promise<Rack> {
  logger.info('Updating rack', { rackId, updates: Object.keys(request) });

  // Verify rack exists and get room ID for cache invalidation
  const existing = await repository.getRackById(rackId);
  if (!existing) {
    throw new RackNotFoundError(rackId);
  }

  // Validate totalUnits cannot be reduced below usedUnits (Requirement 4.6)
  if (request.totalUnits !== undefined && request.totalUnits < existing.usedUnits) {
    throw new InsufficientRackUnitsError(
      rackId,
      request.totalUnits,
      existing.usedUnits,
      existing.usedUnits - request.totalUnits
    );
  }

  // Update the rack
  const updated = await repository.updateRack(rackId, request, userId);
  if (!updated) {
    throw new RackNotFoundError(rackId);
  }

  // Invalidate cache
  await invalidateRackCache(rackId, existing.roomId);

  // Publish event
  await publishEvent('RACK_UPDATED', {
    rackId: updated.rackId,
    roomId: updated.roomId,
    rackName: updated.rackName,
    totalUnits: updated.totalUnits,
    usedUnits: updated.usedUnits,
    availableUnits: updated.availableUnits,
    updatedBy: userId,
    changes: Object.keys(request),
  });

  logger.info('Rack updated successfully', { rackId });

  return updated;
}

/**
 * Deactivate a rack
 * Requirement 4.4: Mark rack as inactive and prevent new asset assignments
 *
 * @param rackId - Rack ID
 * @param userId - ID of user deactivating the rack
 * @returns Deactivated rack
 * @throws RackNotFoundError if rack not found
 */
export async function deactivateRack(rackId: UUID, userId?: UUID): Promise<Rack> {
  logger.info('Deactivating rack', { rackId });

  // Verify rack exists and get room ID for cache invalidation
  const existing = await repository.getRackById(rackId);
  if (!existing) {
    throw new RackNotFoundError(rackId);
  }

  // Deactivate the rack
  const deactivated = await repository.deactivateRack(rackId, userId);
  if (!deactivated) {
    throw new RackNotFoundError(rackId);
  }

  // Invalidate cache
  await invalidateRackCache(rackId, existing.roomId);

  // Publish event
  await publishEvent('RACK_DEACTIVATED', {
    rackId: deactivated.rackId,
    roomId: deactivated.roomId,
    rackName: deactivated.rackName,
    deactivatedBy: userId,
  });

  logger.info('Rack deactivated successfully', { rackId });

  return deactivated;
}

/**
 * Delete a rack
 * Requirement 4.5: Reject deletion if rack has mounted equipment
 *
 * @param rackId - Rack ID
 * @returns true if deleted
 * @throws RackNotFoundError if rack not found
 * @throws RackHasDependenciesError if rack has mounted assets
 */
export async function deleteRack(rackId: UUID): Promise<boolean> {
  logger.info('Deleting rack', { rackId });

  // Verify rack exists and get room ID for cache invalidation
  const existing = await repository.getRackById(rackId);
  if (!existing) {
    throw new RackNotFoundError(rackId);
  }

  // Check for dependencies
  const dependencies = await repository.getRackDependencies(rackId);
  if (dependencies.assetCount > 0) {
    throw new RackHasDependenciesError(rackId, dependencies.assetCount);
  }

  // Delete the rack
  const deleted = await repository.deleteRack(rackId);

  if (deleted) {
    // Invalidate cache
    await invalidateRackCache(rackId, existing.roomId);

    logger.info('Rack deleted successfully', { rackId });
  }

  return deleted;
}

/**
 * List racks with pagination and filters
 * Requirement 4.4: Return all racks with their utilization status
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of racks
 */
export async function listRacks(
  filters: RackListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Rack>> {
  logger.debug('Listing racks', { filters, pagination });

  return repository.listRacks(filters, pagination);
}

/**
 * Get all active racks for a room (for dropdowns/selectors)
 *
 * @param roomId - Room ID
 * @returns List of active racks
 */
export async function getActiveRacksByRoom(roomId: UUID): Promise<Rack[]> {
  const cacheKeyStr = `${racksByRoomKey(roomId)}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveRacksByRoomId(roomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate rack name uniqueness within a room
 * Used for form validation before submission
 *
 * @param roomId - Room ID
 * @param rackName - Rack name to validate
 * @param excludeRackId - Rack ID to exclude (for updates)
 * @returns true if rack name is unique within the room
 */
export async function isRackNameUnique(
  roomId: UUID,
  rackName: string,
  excludeRackId?: UUID
): Promise<boolean> {
  const exists = await repository.rackNameExistsInRoom(
    roomId,
    rackName,
    excludeRackId
  );
  return !exists;
}

/**
 * Update used units for a rack
 * Requirement 4.6: Calculate available units as totalUnits - usedUnits
 *
 * Used when assets are mounted/unmounted from a rack.
 * Validates that usedUnits cannot exceed totalUnits.
 *
 * @param rackId - Rack ID
 * @param usedUnits - New used units value
 * @param userId - ID of user updating the rack
 * @returns Updated rack
 * @throws RackNotFoundError if rack not found
 * @throws InsufficientRackUnitsError if usedUnits exceeds totalUnits
 */
export async function updateUsedUnits(
  rackId: UUID,
  usedUnits: number,
  userId?: UUID
): Promise<Rack> {
  logger.info('Updating rack used units', { rackId, usedUnits });

  // Verify rack exists and get current state
  const existing = await repository.getRackById(rackId);
  if (!existing) {
    throw new RackNotFoundError(rackId);
  }

  // Validate usedUnits cannot exceed totalUnits (Requirement 4.6)
  if (usedUnits > existing.totalUnits) {
    throw new InsufficientRackUnitsError(
      rackId,
      existing.totalUnits,
      existing.usedUnits,
      usedUnits - existing.totalUnits
    );
  }

  // Validate usedUnits cannot be negative
  if (usedUnits < 0) {
    throw new Error(`Used units cannot be negative: ${usedUnits}`);
  }

  // Update the rack used units
  const updated = await repository.updateRackUsedUnits(rackId, usedUnits, userId);
  if (!updated) {
    throw new RackNotFoundError(rackId);
  }

  // Invalidate cache
  await invalidateRackCache(rackId, existing.roomId);

  // Publish event
  await publishEvent('RACK_UPDATED', {
    rackId: updated.rackId,
    roomId: updated.roomId,
    rackName: updated.rackName,
    totalUnits: updated.totalUnits,
    usedUnits: updated.usedUnits,
    availableUnits: updated.availableUnits,
    updatedBy: userId,
    changes: ['usedUnits'],
  });

  logger.info('Rack used units updated successfully', {
    rackId,
    usedUnits,
    availableUnits: updated.availableUnits,
  });

  return updated;
}
