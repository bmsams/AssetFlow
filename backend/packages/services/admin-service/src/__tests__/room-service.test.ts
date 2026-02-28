/**
 * Room Service Unit Tests
 *
 * Tests for the Room Service business logic layer.
 * Requirements:
 * - Requirement 3.1: Create room with floor reference, room number, name, and type
 * - Requirement 3.2: Return all rooms for a floor ordered by room number
 * - Requirement 3.3: Update specified fields and maintain floor relationship
 * - Requirement 3.4: Mark room as inactive and prevent new rack/asset assignments
 * - Requirement 3.5: Reject creation for non-existent floor
 */

// Mock the dependencies before importing service
jest.mock('../location/location-repository');
jest.mock('@ams/cache');
jest.mock('@ams/events');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import type { Room, CreateRoomRequest, UpdateRoomRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../location/location-repository';
import {
  createRoom,
  getRoom,
  getRoomOrThrow,
  getRoomsByFloor,
  updateRoom,
  deactivateRoom,
  deleteRoom,
  listRooms,
  getActiveRoomsByFloor,
  isRoomNumberUnique,
  RoomNotFoundError,
  RoomNumberExistsError,
  RoomHasDependenciesError,
  FloorNotFoundError,
} from '../location/room-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockRoom: Room = {
  roomId: '789e4567-e89b-12d3-a456-426614174000',
  floorId: '456e4567-e89b-12d3-a456-426614174000',
  roomNumber: 'R101',
  name: 'Conference Room A',
  roomType: 'CONFERENCE',
  capacity: 20,
  description: 'Main conference room',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateRoomRequest = {
  floorId: '456e4567-e89b-12d3-a456-426614174000',
  roomNumber: 'R101',
  name: 'Conference Room A',
  roomType: 'CONFERENCE',
  capacity: 20,
  description: 'Main conference room',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'ROOM_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Room Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.roomKey.mockImplementation((id: string) => `room:${id}`);
    mockCache.roomsByFloorKey.mockImplementation((id: string) => `room:floor:${id}`);
    mockCache.roomInvalidationPatterns.mockReturnValue([
      'room:789e4567-e89b-12d3-a456-426614174000*',
      'room:list*',
    ]);
  });


  // ============================================================================
  // createRoom Tests (Requirement 3.1, 3.5)
  // ============================================================================

  describe('createRoom', () => {
    it('should create a room successfully', async () => {
      mockRepository.floorExists.mockResolvedValue(true);
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);
      mockRepository.createRoom.mockResolvedValue(mockRoom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createRoom(validCreateRequest);

      expect(result).toEqual(mockRoom);
      expect(mockRepository.floorExists).toHaveBeenCalledWith(validCreateRequest.floorId);
      expect(mockRepository.roomNumberExistsInFloor).toHaveBeenCalledWith(
        validCreateRequest.floorId,
        validCreateRequest.roomNumber
      );
      expect(mockRepository.createRoom).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create a room with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.floorExists.mockResolvedValue(true);
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);
      mockRepository.createRoom.mockResolvedValue(mockRoom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRoom(validCreateRequest, userId);

      expect(mockRepository.createRoom).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw FloorNotFoundError when floor does not exist (Requirement 3.5)', async () => {
      mockRepository.floorExists.mockResolvedValue(false);

      await expect(createRoom(validCreateRequest)).rejects.toThrow(FloorNotFoundError);
      await expect(createRoom(validCreateRequest)).rejects.toThrow(
        `Floor not found: ${validCreateRequest.floorId}`
      );
      expect(mockRepository.createRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomNumberExistsError when room number already exists in floor', async () => {
      mockRepository.floorExists.mockResolvedValue(true);
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(true);

      await expect(createRoom(validCreateRequest)).rejects.toThrow(RoomNumberExistsError);
      await expect(createRoom(validCreateRequest)).rejects.toThrow(
        `Room number ${validCreateRequest.roomNumber} already exists in floor ${validCreateRequest.floorId}`
      );
      expect(mockRepository.createRoom).not.toHaveBeenCalled();
    });

    it('should invalidate floor rooms cache after creation', async () => {
      mockRepository.floorExists.mockResolvedValue(true);
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);
      mockRepository.createRoom.mockResolvedValue(mockRoom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRoom(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith(`room:floor:${validCreateRequest.floorId}`);
    });

    it('should publish ROOM_CREATED event after creation', async () => {
      mockRepository.floorExists.mockResolvedValue(true);
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);
      mockRepository.createRoom.mockResolvedValue(mockRoom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRoom(validCreateRequest, 'user-123');

      expect(mockPublishEvent).toHaveBeenCalledWith('ROOM_CREATED', {
        roomId: mockRoom.roomId,
        floorId: mockRoom.floorId,
        roomNumber: mockRoom.roomNumber,
        name: mockRoom.name,
        roomType: mockRoom.roomType,
        createdBy: 'user-123',
      });
    });
  });


  // ============================================================================
  // getRoom Tests
  // ============================================================================

  describe('getRoom', () => {
    it('should return room from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockRoom);

      const result = await getRoom(mockRoom.roomId);

      expect(result).toEqual(mockRoom);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `room:${mockRoom.roomId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRoomById.mockResolvedValue(mockRoom);

      const result = await getRoom(mockRoom.roomId);

      expect(result).toEqual(mockRoom);
      expect(mockRepository.getRoomById).toHaveBeenCalledWith(mockRoom.roomId);
    });

    it('should return null when room not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRoomById.mockResolvedValue(null);

      const result = await getRoom('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getRoomOrThrow Tests
  // ============================================================================

  describe('getRoomOrThrow', () => {
    it('should return room when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockRoom);

      const result = await getRoomOrThrow(mockRoom.roomId);

      expect(result).toEqual(mockRoom);
    });

    it('should throw RoomNotFoundError when room not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getRoomOrThrow('nonexistent-id')).rejects.toThrow(RoomNotFoundError);
      await expect(getRoomOrThrow('nonexistent-id')).rejects.toThrow(
        'Room not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getRoomsByFloor Tests (Requirement 3.2)
  // ============================================================================

  describe('getRoomsByFloor', () => {
    const roomsInFloor: Room[] = [
      mockRoom,
      { ...mockRoom, roomId: '889e4567-e89b-12d3-a456-426614174001', roomNumber: 'R102', name: 'Server Room' },
      { ...mockRoom, roomId: '889e4567-e89b-12d3-a456-426614174002', roomNumber: 'R103', name: 'Storage Room' },
    ];

    it('should return rooms for a floor from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(roomsInFloor);

      const result = await getRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual(roomsInFloor);
      expect(result).toHaveLength(3);
    });

    it('should use cache with floor-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(roomsInFloor);

      await getRoomsByFloor(mockRoom.floorId);

      expect(mockCache.roomsByFloorKey).toHaveBeenCalledWith(mockRoom.floorId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `room:floor:${mockRoom.floorId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRoomsByFloorId.mockResolvedValue(roomsInFloor);

      const result = await getRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual(roomsInFloor);
      expect(mockRepository.getRoomsByFloorId).toHaveBeenCalledWith(mockRoom.floorId);
    });

    it('should return empty array when floor has no rooms', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // updateRoom Tests (Requirement 3.3)
  // ============================================================================

  describe('updateRoom', () => {
    const updateRequest: UpdateRoomRequest = {
      name: 'Updated Room Name',
      roomType: 'LAB',
      capacity: 30,
    };

    const updatedRoom: Room = {
      ...mockRoom,
      name: 'Updated Room Name',
      roomType: 'LAB',
      capacity: 30,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update room successfully', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.updateRoom.mockResolvedValue(updatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateRoom(mockRoom.roomId, updateRequest);

      expect(result).toEqual(updatedRoom);
      expect(mockRepository.getRoomById).toHaveBeenCalledWith(mockRoom.roomId);
      expect(mockRepository.updateRoom).toHaveBeenCalledWith(
        mockRoom.roomId,
        updateRequest,
        undefined
      );
    });

    it('should update room with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.updateRoom.mockResolvedValue(updatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRoom(mockRoom.roomId, updateRequest, userId);

      expect(mockRepository.updateRoom).toHaveBeenCalledWith(
        mockRoom.roomId,
        updateRequest,
        userId
      );
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRepository.getRoomById.mockResolvedValue(null);

      await expect(
        updateRoom('nonexistent-id', updateRequest)
      ).rejects.toThrow(RoomNotFoundError);
      expect(mockRepository.updateRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomNotFoundError when update returns null', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.updateRoom.mockResolvedValue(null);

      await expect(
        updateRoom(mockRoom.roomId, updateRequest)
      ).rejects.toThrow(RoomNotFoundError);
    });

    it('should invalidate room cache after update', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.updateRoom.mockResolvedValue(updatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRoom(mockRoom.roomId, updateRequest);

      expect(mockCache.roomInvalidationPatterns).toHaveBeenCalledWith(
        mockRoom.roomId,
        mockRoom.floorId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`room:${mockRoom.roomId}`);
      expect(mockCache.del).toHaveBeenCalledWith(`room:floor:${mockRoom.floorId}`);
    });

    it('should publish ROOM_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.updateRoom.mockResolvedValue(updatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRoom(mockRoom.roomId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('ROOM_UPDATED', {
        roomId: updatedRoom.roomId,
        floorId: updatedRoom.floorId,
        roomNumber: updatedRoom.roomNumber,
        name: updatedRoom.name,
        roomType: updatedRoom.roomType,
        updatedBy: userId,
        changes: ['name', 'roomType', 'capacity'],
      });
    });
  });


  // ============================================================================
  // deactivateRoom Tests (Requirement 3.4)
  // ============================================================================

  describe('deactivateRoom', () => {
    const deactivatedRoom: Room = {
      ...mockRoom,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate room successfully', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.deactivateRoom.mockResolvedValue(deactivatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateRoom(mockRoom.roomId);

      expect(result).toEqual(deactivatedRoom);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateRoom).toHaveBeenCalledWith(
        mockRoom.roomId,
        undefined
      );
    });

    it('should deactivate room with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.deactivateRoom.mockResolvedValue(deactivatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRoom(mockRoom.roomId, userId);

      expect(mockRepository.deactivateRoom).toHaveBeenCalledWith(
        mockRoom.roomId,
        userId
      );
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRepository.getRoomById.mockResolvedValue(null);

      await expect(deactivateRoom('nonexistent-id')).rejects.toThrow(RoomNotFoundError);
      expect(mockRepository.deactivateRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomNotFoundError when deactivate returns null', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.deactivateRoom.mockResolvedValue(null);

      await expect(deactivateRoom(mockRoom.roomId)).rejects.toThrow(
        RoomNotFoundError
      );
    });

    it('should invalidate room cache after deactivation', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.deactivateRoom.mockResolvedValue(deactivatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRoom(mockRoom.roomId);

      expect(mockCache.roomInvalidationPatterns).toHaveBeenCalledWith(
        mockRoom.roomId,
        mockRoom.floorId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`room:${mockRoom.roomId}`);
    });

    it('should publish ROOM_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.deactivateRoom.mockResolvedValue(deactivatedRoom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRoom(mockRoom.roomId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('ROOM_DEACTIVATED', {
        roomId: deactivatedRoom.roomId,
        floorId: deactivatedRoom.floorId,
        roomNumber: deactivatedRoom.roomNumber,
        name: deactivatedRoom.name,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteRoom Tests
  // ============================================================================

  describe('deleteRoom', () => {
    it('should delete room successfully when no dependencies', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 0, assetCount: 0 });
      mockRepository.deleteRoom.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteRoom(mockRoom.roomId);

      expect(result).toBe(true);
      expect(mockRepository.deleteRoom).toHaveBeenCalledWith(mockRoom.roomId);
    });

    it('should throw RoomNotFoundError when room does not exist', async () => {
      mockRepository.getRoomById.mockResolvedValue(null);

      await expect(deleteRoom('nonexistent-id')).rejects.toThrow(RoomNotFoundError);
      expect(mockRepository.getRoomDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomHasDependenciesError when room has racks', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 3, assetCount: 0 });

      await expect(deleteRoom(mockRoom.roomId)).rejects.toThrow(
        RoomHasDependenciesError
      );
      await expect(deleteRoom(mockRoom.roomId)).rejects.toThrow(
        /has 3 rack\(s\) and 0 asset\(s\)/
      );
      expect(mockRepository.deleteRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomHasDependenciesError when room has assets', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 0, assetCount: 10 });

      await expect(deleteRoom(mockRoom.roomId)).rejects.toThrow(
        RoomHasDependenciesError
      );
      await expect(deleteRoom(mockRoom.roomId)).rejects.toThrow(
        /has 0 rack\(s\) and 10 asset\(s\)/
      );
      expect(mockRepository.deleteRoom).not.toHaveBeenCalled();
    });

    it('should throw RoomHasDependenciesError when room has both racks and assets', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 5, assetCount: 25 });

      const error = await deleteRoom(mockRoom.roomId).catch((e) => e);

      expect(error).toBeInstanceOf(RoomHasDependenciesError);
      expect(error.rackCount).toBe(5);
      expect(error.assetCount).toBe(25);
    });

    it('should invalidate room cache after deletion', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 0, assetCount: 0 });
      mockRepository.deleteRoom.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteRoom(mockRoom.roomId);

      expect(mockCache.roomInvalidationPatterns).toHaveBeenCalledWith(
        mockRoom.roomId,
        mockRoom.floorId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getRoomById.mockResolvedValue(mockRoom);
      mockRepository.getRoomDependencies.mockResolvedValue({ rackCount: 0, assetCount: 0 });
      mockRepository.deleteRoom.mockResolvedValue(false);

      const result = await deleteRoom(mockRoom.roomId);

      expect(result).toBe(false);
      expect(mockCache.roomInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listRooms Tests
  // ============================================================================

  describe('listRooms', () => {
    const mockPaginatedResult = {
      items: [mockRoom],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated list of rooms', async () => {
      mockRepository.listRooms.mockResolvedValue(mockPaginatedResult);

      const result = await listRooms();

      expect(result).toEqual(mockPaginatedResult);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const filters = {
        floorId: mockRoom.floorId,
        roomType: 'CONFERENCE' as const,
        isActive: true,
      };
      mockRepository.listRooms.mockResolvedValue(mockPaginatedResult);

      await listRooms(filters);

      expect(mockRepository.listRooms).toHaveBeenCalledWith(filters, {});
    });

    it('should pass pagination params to repository', async () => {
      const pagination = { page: 3, limit: 10 };
      mockRepository.listRooms.mockResolvedValue({
        ...mockPaginatedResult,
        page: 3,
        limit: 10,
      });

      await listRooms({}, pagination);

      expect(mockRepository.listRooms).toHaveBeenCalledWith({}, pagination);
    });
  });


  // ============================================================================
  // getActiveRoomsByFloor Tests
  // ============================================================================

  describe('getActiveRoomsByFloor', () => {
    const activeRooms: Room[] = [
      mockRoom,
      { ...mockRoom, roomId: '889e4567-e89b-12d3-a456-426614174001', roomNumber: 'R102', name: 'Server Room' },
    ];

    it('should return list of active rooms for a floor', async () => {
      mockCache.getOrSet.mockResolvedValue(activeRooms);

      const result = await getActiveRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual(activeRooms);
      expect(result).toHaveLength(2);
    });

    it('should use cache with active filter key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeRooms);

      await getActiveRoomsByFloor(mockRoom.floorId);

      expect(mockCache.roomsByFloorKey).toHaveBeenCalledWith(mockRoom.floorId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `room:floor:${mockRoom.floorId}:active`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getActiveRoomsByFloorId.mockResolvedValue(activeRooms);

      const result = await getActiveRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual(activeRooms);
      expect(mockRepository.getActiveRoomsByFloorId).toHaveBeenCalledWith(mockRoom.floorId);
    });

    it('should return empty array when no active rooms', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveRoomsByFloor(mockRoom.floorId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // isRoomNumberUnique Tests
  // ============================================================================

  describe('isRoomNumberUnique', () => {
    it('should return true when room number does not exist in floor', async () => {
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);

      const result = await isRoomNumberUnique(mockRoom.floorId, 'R999');

      expect(result).toBe(true);
      expect(mockRepository.roomNumberExistsInFloor).toHaveBeenCalledWith(
        mockRoom.floorId,
        'R999',
        undefined
      );
    });

    it('should return false when room number exists in floor', async () => {
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(true);

      const result = await isRoomNumberUnique(mockRoom.floorId, 'R101');

      expect(result).toBe(false);
    });

    it('should exclude specific room ID when checking uniqueness', async () => {
      const excludeRoomId = '789e4567-e89b-12d3-a456-426614174000';
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);

      const result = await isRoomNumberUnique(mockRoom.floorId, 'R101', excludeRoomId);

      expect(result).toBe(true);
      expect(mockRepository.roomNumberExistsInFloor).toHaveBeenCalledWith(
        mockRoom.floorId,
        'R101',
        excludeRoomId
      );
    });

    it('should return true when room number exists but belongs to excluded room', async () => {
      const excludeRoomId = '789e4567-e89b-12d3-a456-426614174000';
      mockRepository.roomNumberExistsInFloor.mockResolvedValue(false);

      const result = await isRoomNumberUnique(mockRoom.floorId, 'R101', excludeRoomId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('RoomNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new RoomNotFoundError('789e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('RoomNotFoundError');
        expect(error.message).toBe('Room not found: 789e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('RoomNumberExistsError', () => {
      it('should have correct name and message', () => {
        const error = new RoomNumberExistsError(
          '456e4567-e89b-12d3-a456-426614174000',
          'R101'
        );

        expect(error.name).toBe('RoomNumberExistsError');
        expect(error.message).toBe(
          'Room number R101 already exists in floor 456e4567-e89b-12d3-a456-426614174000'
        );
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('RoomHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new RoomHasDependenciesError(
          '789e4567-e89b-12d3-a456-426614174000',
          5,
          25
        );

        expect(error.name).toBe('RoomHasDependenciesError');
        expect(error.message).toContain('has 5 rack(s) and 25 asset(s)');
        expect(error.rackCount).toBe(5);
        expect(error.assetCount).toBe(25);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('FloorNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new FloorNotFoundError('456e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('FloorNotFoundError');
        expect(error.message).toBe('Floor not found: 456e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
