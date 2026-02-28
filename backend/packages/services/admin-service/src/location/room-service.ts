/**
 * Room Service - Business logic layer for room management
 *
 * Implements:
 * - Room CRUD operations (Requirement 3)
 * - Cache management for room data
 * - Event publishing for room state changes
 */

import type {
  CreateRoomRequest,
  PaginatedResult,
  PaginationParams,
  Room,
  RoomListFilters,
  UpdateRoomRequest,
  UUID,
} from '@ams/types';
import * as cache from '@ams/cache';
import { roomKey, roomsByFloorKey, roomInvalidationPatterns } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import * as repository from './location-repository';

const logger = createLogger({ service: 'room-service' });

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown when room is not found
 */
export class RoomNotFoundError extends Error {
  constructor(roomId: UUID) {
    super(`Room not found: ${roomId}`);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * Error thrown when room number already exists in a floor
 */
export class RoomNumberExistsError extends Error {
  constructor(floorId: UUID, roomNumber: string) {
    super(`Room number ${roomNumber} already exists in floor ${floorId}`);
    this.name = 'RoomNumberExistsError';
  }
}

/**
 * Error thrown when room has dependencies and cannot be deleted
 */
export class RoomHasDependenciesError extends Error {
  readonly rackCount: number;
  readonly assetCount: number;

  constructor(roomId: UUID, rackCount: number, assetCount: number) {
    super(
      `Cannot delete room ${roomId}: has ${rackCount} rack(s) and ${assetCount} asset(s)`
    );
    this.name = 'RoomHasDependenciesError';
    this.rackCount = rackCount;
    this.assetCount = assetCount;
  }
}

/**
 * Error thrown when floor is not found (for room creation)
 */
export class FloorNotFoundError extends Error {
  constructor(floorId: UUID) {
    super(`Floor not found: ${floorId}`);
    this.name = 'FloorNotFoundError';
  }
}

// ============================================================================
// Cache Helpers
// ============================================================================

/**
 * Invalidate all room-related cache entries
 */
async function invalidateRoomCache(roomId: UUID, floorId?: UUID): Promise<void> {
  const patterns = roomInvalidationPatterns(roomId, floorId);
  for (const pattern of patterns) {
    await cache.delPattern(pattern);
  }
  // Also invalidate the specific room key and floor rooms key
  await cache.del(roomKey(roomId));
  if (floorId) {
    await cache.del(roomsByFloorKey(floorId));
  }
}

// ============================================================================
// Room Service Functions
// ============================================================================

/**
 * Create a new room
 * Requirement 3.1: Create room with floor reference, room number, name, and type
 * Requirement 3.5: Reject creation for non-existent floor
 *
 * @param request - Room creation request
 * @param userId - ID of user creating the room
 * @returns Created room
 * @throws FloorNotFoundError if floor does not exist
 * @throws RoomNumberExistsError if room number already exists in floor
 */
export async function createRoom(
  request: CreateRoomRequest,
  userId?: UUID
): Promise<Room> {
  logger.info('Creating room', {
    floorId: request.floorId,
    roomNumber: request.roomNumber,
    name: request.name,
    roomType: request.roomType,
  });

  // Validate floor exists (Requirement 3.5)
  const floorExists = await repository.floorExists(request.floorId);
  if (!floorExists) {
    throw new FloorNotFoundError(request.floorId);
  }

  // Validate room number uniqueness within floor
  const roomNumberExists = await repository.roomNumberExistsInFloor(
    request.floorId,
    request.roomNumber
  );
  if (roomNumberExists) {
    throw new RoomNumberExistsError(request.floorId, request.roomNumber);
  }

  // Create the room
  const room = await repository.createRoom(request, userId);

  // Invalidate floor rooms cache
  await cache.del(roomsByFloorKey(request.floorId));

  // Publish event
  await publishEvent('ROOM_CREATED', {
    roomId: room.roomId,
    floorId: room.floorId,
    roomNumber: room.roomNumber,
    name: room.name,
    roomType: room.roomType,
    createdBy: userId,
  });

  logger.info('Room created successfully', {
    roomId: room.roomId,
    floorId: room.floorId,
    roomNumber: room.roomNumber,
  });

  return room;
}

/**
 * Get room by ID
 *
 * @param roomId - Room ID
 * @returns Room or null if not found
 */
export async function getRoom(roomId: UUID): Promise<Room | null> {
  const cacheKeyStr = roomKey(roomId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getRoomById(roomId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get room by ID, throwing if not found
 *
 * @param roomId - Room ID
 * @returns Room
 * @throws RoomNotFoundError if room not found
 */
export async function getRoomOrThrow(roomId: UUID): Promise<Room> {
  const room = await getRoom(roomId);
  if (!room) {
    throw new RoomNotFoundError(roomId);
  }
  return room;
}

/**
 * Get rooms for a floor ordered by room number
 * Requirement 3.2: Return all rooms for a floor ordered by room number
 *
 * @param floorId - Floor ID
 * @returns List of rooms ordered by room number
 */
export async function getRoomsByFloor(floorId: UUID): Promise<Room[]> {
  const cacheKeyStr = roomsByFloorKey(floorId);

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getRoomsByFloorId(floorId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Update room details
 * Requirement 3.3: Update specified fields and maintain floor relationship
 *
 * @param roomId - Room ID
 * @param request - Update request
 * @param userId - ID of user updating the room
 * @returns Updated room
 * @throws RoomNotFoundError if room not found
 */
export async function updateRoom(
  roomId: UUID,
  request: UpdateRoomRequest,
  userId?: UUID
): Promise<Room> {
  logger.info('Updating room', { roomId, updates: Object.keys(request) });

  // Verify room exists and get floor ID for cache invalidation
  const existing = await repository.getRoomById(roomId);
  if (!existing) {
    throw new RoomNotFoundError(roomId);
  }

  // Update the room
  const updated = await repository.updateRoom(roomId, request, userId);
  if (!updated) {
    throw new RoomNotFoundError(roomId);
  }

  // Invalidate cache
  await invalidateRoomCache(roomId, existing.floorId);

  // Publish event
  await publishEvent('ROOM_UPDATED', {
    roomId: updated.roomId,
    floorId: updated.floorId,
    roomNumber: updated.roomNumber,
    name: updated.name,
    roomType: updated.roomType,
    updatedBy: userId,
    changes: Object.keys(request),
  });

  logger.info('Room updated successfully', { roomId });

  return updated;
}

/**
 * Deactivate a room
 * Requirement 3.4: Mark room as inactive and prevent new rack/asset assignments
 *
 * @param roomId - Room ID
 * @param userId - ID of user deactivating the room
 * @returns Deactivated room
 * @throws RoomNotFoundError if room not found
 */
export async function deactivateRoom(roomId: UUID, userId?: UUID): Promise<Room> {
  logger.info('Deactivating room', { roomId });

  // Verify room exists and get floor ID for cache invalidation
  const existing = await repository.getRoomById(roomId);
  if (!existing) {
    throw new RoomNotFoundError(roomId);
  }

  // Deactivate the room
  const deactivated = await repository.deactivateRoom(roomId, userId);
  if (!deactivated) {
    throw new RoomNotFoundError(roomId);
  }

  // Invalidate cache
  await invalidateRoomCache(roomId, existing.floorId);

  // Publish event
  await publishEvent('ROOM_DEACTIVATED', {
    roomId: deactivated.roomId,
    floorId: deactivated.floorId,
    roomNumber: deactivated.roomNumber,
    name: deactivated.name,
    deactivatedBy: userId,
  });

  logger.info('Room deactivated successfully', { roomId });

  return deactivated;
}

/**
 * Delete a room
 * Reject deletion if room has racks or assets
 *
 * @param roomId - Room ID
 * @returns true if deleted
 * @throws RoomNotFoundError if room not found
 * @throws RoomHasDependenciesError if room has racks or assets
 */
export async function deleteRoom(roomId: UUID): Promise<boolean> {
  logger.info('Deleting room', { roomId });

  // Verify room exists and get floor ID for cache invalidation
  const existing = await repository.getRoomById(roomId);
  if (!existing) {
    throw new RoomNotFoundError(roomId);
  }

  // Check for dependencies
  const dependencies = await repository.getRoomDependencies(roomId);
  if (dependencies.rackCount > 0 || dependencies.assetCount > 0) {
    throw new RoomHasDependenciesError(
      roomId,
      dependencies.rackCount,
      dependencies.assetCount
    );
  }

  // Delete the room
  const deleted = await repository.deleteRoom(roomId);

  if (deleted) {
    // Invalidate cache
    await invalidateRoomCache(roomId, existing.floorId);

    logger.info('Room deleted successfully', { roomId });
  }

  return deleted;
}

/**
 * List rooms with pagination and filters
 *
 * @param filters - Filter criteria
 * @param pagination - Pagination parameters
 * @returns Paginated list of rooms
 */
export async function listRooms(
  filters: RoomListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Room>> {
  logger.debug('Listing rooms', { filters, pagination });

  return repository.listRooms(filters, pagination);
}

/**
 * Get all active rooms for a floor (for dropdowns/selectors)
 *
 * @param floorId - Floor ID
 * @returns List of active rooms
 */
export async function getActiveRoomsByFloor(floorId: UUID): Promise<Room[]> {
  const cacheKeyStr = `${roomsByFloorKey(floorId)}:active`;

  return cache.getOrSet(
    cacheKeyStr,
    () => repository.getActiveRoomsByFloorId(floorId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Validate room number uniqueness within a floor
 * Used for form validation before submission
 *
 * @param floorId - Floor ID
 * @param roomNumber - Room number to validate
 * @param excludeRoomId - Room ID to exclude (for updates)
 * @returns true if room number is unique within the floor
 */
export async function isRoomNumberUnique(
  floorId: UUID,
  roomNumber: string,
  excludeRoomId?: UUID
): Promise<boolean> {
  const exists = await repository.roomNumberExistsInFloor(
    floorId,
    roomNumber,
    excludeRoomId
  );
  return !exists;
}
