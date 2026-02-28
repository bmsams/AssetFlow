/**
 * Rack Service Unit Tests
 *
 * Tests for the Rack Service business logic layer.
 * Requirements:
 * - Requirement 4.1: Create rack with room reference, name, and unit capacity
 * - Requirement 4.2: Return all racks for a room ordered by name
 * - Requirement 4.3: Update specified fields including unit capacity
 * - Requirement 4.4: Mark rack as inactive and prevent new asset assignments
 * - Requirement 4.5: Reject creation for non-existent room, reject deletion if rack has mounted equipment
 * - Requirement 4.6: Calculate available units as totalUnits - usedUnits
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

import type { Rack, CreateRackRequest, UpdateRackRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../location/location-repository';
import {
  createRack,
  getRack,
  getRackOrThrow,
  getRacksByRoom,
  updateRack,
  deactivateRack,
  deleteRack,
  listRacks,
  getActiveRacksByRoom,
  isRackNameUnique,
  updateUsedUnits,
  RackNotFoundError,
  RackNameExistsError,
  RackHasDependenciesError,
  RoomNotFoundError,
  InsufficientRackUnitsError,
} from '../location/rack-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockRack: Rack = {
  rackId: '111e4567-e89b-12d3-a456-426614174000',
  roomId: '789e4567-e89b-12d3-a456-426614174000',
  rackName: 'Rack-A1',
  totalUnits: 42,
  usedUnits: 10,
  availableUnits: 32,
  description: 'Main server rack',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateRackRequest = {
  roomId: '789e4567-e89b-12d3-a456-426614174000',
  rackName: 'Rack-A1',
  totalUnits: 42,
  description: 'Main server rack',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'RACK_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Rack Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.rackKey.mockImplementation((id: string) => `rack:${id}`);
    mockCache.racksByRoomKey.mockImplementation((id: string) => `rack:room:${id}`);
    mockCache.rackInvalidationPatterns.mockReturnValue([
      'rack:111e4567-e89b-12d3-a456-426614174000*',
      'rack:list*',
    ]);
  });


  // ============================================================================
  // createRack Tests (Requirement 4.1, 4.5)
  // ============================================================================

  describe('createRack', () => {
    it('should create a rack successfully (Requirement 4.1)', async () => {
      mockRepository.roomExists.mockResolvedValue(true);
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);
      mockRepository.createRack.mockResolvedValue(mockRack);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createRack(validCreateRequest);

      expect(result).toEqual(mockRack);
      expect(mockRepository.roomExists).toHaveBeenCalledWith(validCreateRequest.roomId);
      expect(mockRepository.rackNameExistsInRoom).toHaveBeenCalledWith(
        validCreateRequest.roomId,
        validCreateRequest.rackName
      );
      expect(mockRepository.createRack).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create a rack with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.roomExists.mockResolvedValue(true);
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);
      mockRepository.createRack.mockResolvedValue(mockRack);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRack(validCreateRequest, userId);

      expect(mockRepository.createRack).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw RoomNotFoundError when room does not exist (Requirement 4.5)', async () => {
      mockRepository.roomExists.mockResolvedValue(false);

      await expect(createRack(validCreateRequest)).rejects.toThrow(RoomNotFoundError);
      await expect(createRack(validCreateRequest)).rejects.toThrow(
        `Room not found: ${validCreateRequest.roomId}`
      );
      expect(mockRepository.createRack).not.toHaveBeenCalled();
    });

    it('should throw RackNameExistsError when rack name already exists in room', async () => {
      mockRepository.roomExists.mockResolvedValue(true);
      mockRepository.rackNameExistsInRoom.mockResolvedValue(true);

      await expect(createRack(validCreateRequest)).rejects.toThrow(RackNameExistsError);
      await expect(createRack(validCreateRequest)).rejects.toThrow(
        `Rack name ${validCreateRequest.rackName} already exists in room ${validCreateRequest.roomId}`
      );
      expect(mockRepository.createRack).not.toHaveBeenCalled();
    });


    it('should invalidate room racks cache after creation', async () => {
      mockRepository.roomExists.mockResolvedValue(true);
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);
      mockRepository.createRack.mockResolvedValue(mockRack);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRack(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith(`rack:room:${validCreateRequest.roomId}`);
    });

    it('should publish RACK_CREATED event after creation', async () => {
      mockRepository.roomExists.mockResolvedValue(true);
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);
      mockRepository.createRack.mockResolvedValue(mockRack);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createRack(validCreateRequest, 'user-123');

      expect(mockPublishEvent).toHaveBeenCalledWith('RACK_CREATED', {
        rackId: mockRack.rackId,
        roomId: mockRack.roomId,
        rackName: mockRack.rackName,
        totalUnits: mockRack.totalUnits,
        createdBy: 'user-123',
      });
    });
  });


  // ============================================================================
  // getRack Tests (Requirement 4.2)
  // ============================================================================

  describe('getRack', () => {
    it('should return rack from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockRack);

      const result = await getRack(mockRack.rackId);

      expect(result).toEqual(mockRack);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `rack:${mockRack.rackId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRackById.mockResolvedValue(mockRack);

      const result = await getRack(mockRack.rackId);

      expect(result).toEqual(mockRack);
      expect(mockRepository.getRackById).toHaveBeenCalledWith(mockRack.rackId);
    });

    it('should return null when rack not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRackById.mockResolvedValue(null);

      const result = await getRack('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return rack with calculated availableUnits (Requirement 4.6)', async () => {
      const rackWithUnits: Rack = {
        ...mockRack,
        totalUnits: 42,
        usedUnits: 10,
        availableUnits: 32, // 42 - 10 = 32
      };
      mockCache.getOrSet.mockResolvedValue(rackWithUnits);

      const result = await getRack(mockRack.rackId);

      expect(result?.availableUnits).toBe(32);
      expect(result?.availableUnits).toBe(result!.totalUnits - result!.usedUnits);
    });
  });


  // ============================================================================
  // getRackOrThrow Tests
  // ============================================================================

  describe('getRackOrThrow', () => {
    it('should return rack when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockRack);

      const result = await getRackOrThrow(mockRack.rackId);

      expect(result).toEqual(mockRack);
    });

    it('should throw RackNotFoundError when rack not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getRackOrThrow('nonexistent-id')).rejects.toThrow(RackNotFoundError);
      await expect(getRackOrThrow('nonexistent-id')).rejects.toThrow(
        'Rack not found: nonexistent-id'
      );
    });
  });

  // ============================================================================
  // getRacksByRoom Tests (Requirement 4.2)
  // ============================================================================

  describe('getRacksByRoom', () => {
    const racksInRoom: Rack[] = [
      mockRack,
      { ...mockRack, rackId: '222e4567-e89b-12d3-a456-426614174001', rackName: 'Rack-A2' },
      { ...mockRack, rackId: '333e4567-e89b-12d3-a456-426614174002', rackName: 'Rack-B1' },
    ];

    it('should return racks for a room from cache (Requirement 4.2)', async () => {
      mockCache.getOrSet.mockResolvedValue(racksInRoom);

      const result = await getRacksByRoom(mockRack.roomId);

      expect(result).toEqual(racksInRoom);
      expect(result).toHaveLength(3);
    });

    it('should use cache with room-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(racksInRoom);

      await getRacksByRoom(mockRack.roomId);

      expect(mockCache.racksByRoomKey).toHaveBeenCalledWith(mockRack.roomId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `rack:room:${mockRack.roomId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getRacksByRoomId.mockResolvedValue(racksInRoom);

      const result = await getRacksByRoom(mockRack.roomId);

      expect(result).toEqual(racksInRoom);
      expect(mockRepository.getRacksByRoomId).toHaveBeenCalledWith(mockRack.roomId);
    });

    it('should return empty array when room has no racks', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getRacksByRoom(mockRack.roomId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // updateRack Tests (Requirement 4.3)
  // ============================================================================

  describe('updateRack', () => {
    const updateRequest: UpdateRackRequest = {
      rackName: 'Updated Rack Name',
      totalUnits: 48,
      description: 'Updated description',
    };

    const updatedRack: Rack = {
      ...mockRack,
      rackName: 'Updated Rack Name',
      totalUnits: 48,
      availableUnits: 38, // 48 - 10 = 38
      description: 'Updated description',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update rack successfully (Requirement 4.3)', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRack.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateRack(mockRack.rackId, updateRequest);

      expect(result).toEqual(updatedRack);
      expect(mockRepository.getRackById).toHaveBeenCalledWith(mockRack.rackId);
      expect(mockRepository.updateRack).toHaveBeenCalledWith(
        mockRack.rackId,
        updateRequest,
        undefined
      );
    });

    it('should update rack with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRack.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRack(mockRack.rackId, updateRequest, userId);

      expect(mockRepository.updateRack).toHaveBeenCalledWith(
        mockRack.rackId,
        updateRequest,
        userId
      );
    });

    it('should throw RackNotFoundError when rack does not exist', async () => {
      mockRepository.getRackById.mockResolvedValue(null);

      await expect(
        updateRack('nonexistent-id', updateRequest)
      ).rejects.toThrow(RackNotFoundError);
      expect(mockRepository.updateRack).not.toHaveBeenCalled();
    });

    it('should throw RackNotFoundError when update returns null', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRack.mockResolvedValue(null);

      await expect(
        updateRack(mockRack.rackId, updateRequest)
      ).rejects.toThrow(RackNotFoundError);
    });


    it('should throw InsufficientRackUnitsError when reducing totalUnits below usedUnits (Requirement 4.6)', async () => {
      const rackWithUsedUnits: Rack = {
        ...mockRack,
        totalUnits: 42,
        usedUnits: 20,
        availableUnits: 22,
      };
      mockRepository.getRackById.mockResolvedValue(rackWithUsedUnits);

      // Try to reduce totalUnits to 15, but 20 units are already used
      const invalidUpdate: UpdateRackRequest = { totalUnits: 15 };

      await expect(
        updateRack(mockRack.rackId, invalidUpdate)
      ).rejects.toThrow(InsufficientRackUnitsError);
      expect(mockRepository.updateRack).not.toHaveBeenCalled();
    });

    it('should allow updating totalUnits when above usedUnits', async () => {
      const rackWithUsedUnits: Rack = {
        ...mockRack,
        totalUnits: 42,
        usedUnits: 10,
        availableUnits: 32,
      };
      const updatedRackWithNewUnits: Rack = {
        ...rackWithUsedUnits,
        totalUnits: 20,
        availableUnits: 10, // 20 - 10 = 10
      };
      mockRepository.getRackById.mockResolvedValue(rackWithUsedUnits);
      mockRepository.updateRack.mockResolvedValue(updatedRackWithNewUnits);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      // Reduce totalUnits to 20, which is still above usedUnits (10)
      const validUpdate: UpdateRackRequest = { totalUnits: 20 };

      const result = await updateRack(mockRack.rackId, validUpdate);

      expect(result.totalUnits).toBe(20);
      expect(result.availableUnits).toBe(10);
    });

    it('should invalidate rack cache after update', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRack.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRack(mockRack.rackId, updateRequest);

      expect(mockCache.rackInvalidationPatterns).toHaveBeenCalledWith(
        mockRack.rackId,
        mockRack.roomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`rack:${mockRack.rackId}`);
      expect(mockCache.del).toHaveBeenCalledWith(`rack:room:${mockRack.roomId}`);
    });

    it('should publish RACK_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRack.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateRack(mockRack.rackId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('RACK_UPDATED', {
        rackId: updatedRack.rackId,
        roomId: updatedRack.roomId,
        rackName: updatedRack.rackName,
        totalUnits: updatedRack.totalUnits,
        usedUnits: updatedRack.usedUnits,
        availableUnits: updatedRack.availableUnits,
        updatedBy: userId,
        changes: ['rackName', 'totalUnits', 'description'],
      });
    });
  });


  // ============================================================================
  // deactivateRack Tests (Requirement 4.4)
  // ============================================================================

  describe('deactivateRack', () => {
    const deactivatedRack: Rack = {
      ...mockRack,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate rack successfully (Requirement 4.4)', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.deactivateRack.mockResolvedValue(deactivatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateRack(mockRack.rackId);

      expect(result).toEqual(deactivatedRack);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateRack).toHaveBeenCalledWith(
        mockRack.rackId,
        undefined
      );
    });

    it('should deactivate rack with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.deactivateRack.mockResolvedValue(deactivatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRack(mockRack.rackId, userId);

      expect(mockRepository.deactivateRack).toHaveBeenCalledWith(
        mockRack.rackId,
        userId
      );
    });

    it('should throw RackNotFoundError when rack does not exist', async () => {
      mockRepository.getRackById.mockResolvedValue(null);

      await expect(deactivateRack('nonexistent-id')).rejects.toThrow(RackNotFoundError);
      expect(mockRepository.deactivateRack).not.toHaveBeenCalled();
    });

    it('should throw RackNotFoundError when deactivate returns null', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.deactivateRack.mockResolvedValue(null);

      await expect(deactivateRack(mockRack.rackId)).rejects.toThrow(
        RackNotFoundError
      );
    });

    it('should invalidate rack cache after deactivation', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.deactivateRack.mockResolvedValue(deactivatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRack(mockRack.rackId);

      expect(mockCache.rackInvalidationPatterns).toHaveBeenCalledWith(
        mockRack.rackId,
        mockRack.roomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`rack:${mockRack.rackId}`);
    });

    it('should publish RACK_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.deactivateRack.mockResolvedValue(deactivatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateRack(mockRack.rackId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('RACK_DEACTIVATED', {
        rackId: deactivatedRack.rackId,
        roomId: deactivatedRack.roomId,
        rackName: deactivatedRack.rackName,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteRack Tests (Requirement 4.5)
  // ============================================================================

  describe('deleteRack', () => {
    it('should delete rack successfully when no dependencies', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.getRackDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deleteRack.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteRack(mockRack.rackId);

      expect(result).toBe(true);
      expect(mockRepository.deleteRack).toHaveBeenCalledWith(mockRack.rackId);
    });

    it('should throw RackNotFoundError when rack does not exist', async () => {
      mockRepository.getRackById.mockResolvedValue(null);

      await expect(deleteRack('nonexistent-id')).rejects.toThrow(RackNotFoundError);
      expect(mockRepository.getRackDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteRack).not.toHaveBeenCalled();
    });

    it('should throw RackHasDependenciesError when rack has mounted equipment (Requirement 4.5)', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.getRackDependencies.mockResolvedValue({ assetCount: 5 });

      await expect(deleteRack(mockRack.rackId)).rejects.toThrow(
        RackHasDependenciesError
      );
      await expect(deleteRack(mockRack.rackId)).rejects.toThrow(
        /has 5 mounted asset\(s\)/
      );
      expect(mockRepository.deleteRack).not.toHaveBeenCalled();
    });

    it('should include assetCount in RackHasDependenciesError', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.getRackDependencies.mockResolvedValue({ assetCount: 10 });

      const error = await deleteRack(mockRack.rackId).catch((e) => e);

      expect(error).toBeInstanceOf(RackHasDependenciesError);
      expect(error.assetCount).toBe(10);
    });

    it('should invalidate rack cache after deletion', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.getRackDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deleteRack.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteRack(mockRack.rackId);

      expect(mockCache.rackInvalidationPatterns).toHaveBeenCalledWith(
        mockRack.rackId,
        mockRack.roomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.getRackDependencies.mockResolvedValue({ assetCount: 0 });
      mockRepository.deleteRack.mockResolvedValue(false);

      const result = await deleteRack(mockRack.rackId);

      expect(result).toBe(false);
      expect(mockCache.rackInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listRacks Tests (Requirement 4.4)
  // ============================================================================

  describe('listRacks', () => {
    const mockPaginatedResult = {
      items: [mockRack],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated list of racks with utilization status (Requirement 4.4)', async () => {
      mockRepository.listRacks.mockResolvedValue(mockPaginatedResult);

      const result = await listRacks();

      expect(result).toEqual(mockPaginatedResult);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      // Verify utilization data is present
      const firstItem = result.items[0];
      expect(firstItem).toBeDefined();
      expect(firstItem!.totalUnits).toBeDefined();
      expect(firstItem!.usedUnits).toBeDefined();
      expect(firstItem!.availableUnits).toBeDefined();
    });

    it('should pass filters to repository', async () => {
      const filters = {
        roomId: mockRack.roomId,
        isActive: true,
        hasAvailableUnits: true,
      };
      mockRepository.listRacks.mockResolvedValue(mockPaginatedResult);

      await listRacks(filters);

      expect(mockRepository.listRacks).toHaveBeenCalledWith(filters, {});
    });

    it('should pass pagination params to repository', async () => {
      const pagination = { page: 3, limit: 10 };
      mockRepository.listRacks.mockResolvedValue({
        ...mockPaginatedResult,
        page: 3,
        limit: 10,
      });

      await listRacks({}, pagination);

      expect(mockRepository.listRacks).toHaveBeenCalledWith({}, pagination);
    });
  });


  // ============================================================================
  // getActiveRacksByRoom Tests
  // ============================================================================

  describe('getActiveRacksByRoom', () => {
    const activeRacks: Rack[] = [
      mockRack,
      { ...mockRack, rackId: '222e4567-e89b-12d3-a456-426614174001', rackName: 'Rack-A2' },
    ];

    it('should return list of active racks for a room', async () => {
      mockCache.getOrSet.mockResolvedValue(activeRacks);

      const result = await getActiveRacksByRoom(mockRack.roomId);

      expect(result).toEqual(activeRacks);
      expect(result).toHaveLength(2);
    });

    it('should use cache with active filter key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeRacks);

      await getActiveRacksByRoom(mockRack.roomId);

      expect(mockCache.racksByRoomKey).toHaveBeenCalledWith(mockRack.roomId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `rack:room:${mockRack.roomId}:active`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getActiveRacksByRoomId.mockResolvedValue(activeRacks);

      const result = await getActiveRacksByRoom(mockRack.roomId);

      expect(result).toEqual(activeRacks);
      expect(mockRepository.getActiveRacksByRoomId).toHaveBeenCalledWith(mockRack.roomId);
    });

    it('should return empty array when no active racks', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveRacksByRoom(mockRack.roomId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // isRackNameUnique Tests
  // ============================================================================

  describe('isRackNameUnique', () => {
    it('should return true when rack name does not exist in room', async () => {
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);

      const result = await isRackNameUnique(mockRack.roomId, 'Rack-Z99');

      expect(result).toBe(true);
      expect(mockRepository.rackNameExistsInRoom).toHaveBeenCalledWith(
        mockRack.roomId,
        'Rack-Z99',
        undefined
      );
    });

    it('should return false when rack name exists in room', async () => {
      mockRepository.rackNameExistsInRoom.mockResolvedValue(true);

      const result = await isRackNameUnique(mockRack.roomId, 'Rack-A1');

      expect(result).toBe(false);
    });

    it('should exclude specific rack ID when checking uniqueness', async () => {
      const excludeRackId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);

      const result = await isRackNameUnique(mockRack.roomId, 'Rack-A1', excludeRackId);

      expect(result).toBe(true);
      expect(mockRepository.rackNameExistsInRoom).toHaveBeenCalledWith(
        mockRack.roomId,
        'Rack-A1',
        excludeRackId
      );
    });

    it('should return true when rack name exists but belongs to excluded rack', async () => {
      const excludeRackId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.rackNameExistsInRoom.mockResolvedValue(false);

      const result = await isRackNameUnique(mockRack.roomId, 'Rack-A1', excludeRackId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // updateUsedUnits Tests (Requirement 4.6)
  // ============================================================================

  describe('updateUsedUnits', () => {
    it('should update used units successfully (Requirement 4.6)', async () => {
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 20,
        availableUnits: 22, // 42 - 20 = 22
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUsedUnits(mockRack.rackId, 20);

      expect(result.usedUnits).toBe(20);
      expect(result.availableUnits).toBe(22);
      expect(mockRepository.updateRackUsedUnits).toHaveBeenCalledWith(
        mockRack.rackId,
        20,
        undefined
      );
    });

    it('should update used units with userId', async () => {
      const userId = 'user-123';
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 15,
        availableUnits: 27,
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUsedUnits(mockRack.rackId, 15, userId);

      expect(mockRepository.updateRackUsedUnits).toHaveBeenCalledWith(
        mockRack.rackId,
        15,
        userId
      );
    });

    it('should throw RackNotFoundError when rack does not exist', async () => {
      mockRepository.getRackById.mockResolvedValue(null);

      await expect(updateUsedUnits('nonexistent-id', 10)).rejects.toThrow(
        RackNotFoundError
      );
      expect(mockRepository.updateRackUsedUnits).not.toHaveBeenCalled();
    });

    it('should throw InsufficientRackUnitsError when usedUnits exceeds totalUnits (Requirement 4.6)', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack); // totalUnits = 42

      await expect(updateUsedUnits(mockRack.rackId, 50)).rejects.toThrow(
        InsufficientRackUnitsError
      );
      expect(mockRepository.updateRackUsedUnits).not.toHaveBeenCalled();
    });

    it('should throw error when usedUnits is negative', async () => {
      mockRepository.getRackById.mockResolvedValue(mockRack);

      await expect(updateUsedUnits(mockRack.rackId, -5)).rejects.toThrow(
        /Used units cannot be negative/
      );
      expect(mockRepository.updateRackUsedUnits).not.toHaveBeenCalled();
    });


    it('should allow setting usedUnits to zero', async () => {
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 0,
        availableUnits: 42, // 42 - 0 = 42
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUsedUnits(mockRack.rackId, 0);

      expect(result.usedUnits).toBe(0);
      expect(result.availableUnits).toBe(42);
    });

    it('should allow setting usedUnits equal to totalUnits', async () => {
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 42,
        availableUnits: 0, // 42 - 42 = 0
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUsedUnits(mockRack.rackId, 42);

      expect(result.usedUnits).toBe(42);
      expect(result.availableUnits).toBe(0);
    });

    it('should invalidate cache after updating used units', async () => {
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 20,
        availableUnits: 22,
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUsedUnits(mockRack.rackId, 20);

      expect(mockCache.rackInvalidationPatterns).toHaveBeenCalledWith(
        mockRack.rackId,
        mockRack.roomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should publish RACK_UPDATED event after updating used units', async () => {
      const userId = 'user-123';
      const updatedRack: Rack = {
        ...mockRack,
        usedUnits: 20,
        availableUnits: 22,
      };
      mockRepository.getRackById.mockResolvedValue(mockRack);
      mockRepository.updateRackUsedUnits.mockResolvedValue(updatedRack);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUsedUnits(mockRack.rackId, 20, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('RACK_UPDATED', {
        rackId: updatedRack.rackId,
        roomId: updatedRack.roomId,
        rackName: updatedRack.rackName,
        totalUnits: updatedRack.totalUnits,
        usedUnits: updatedRack.usedUnits,
        availableUnits: updatedRack.availableUnits,
        updatedBy: userId,
        changes: ['usedUnits'],
      });
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('RackNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new RackNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('RackNotFoundError');
        expect(error.message).toBe('Rack not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('RackNameExistsError', () => {
      it('should have correct name and message', () => {
        const error = new RackNameExistsError(
          '789e4567-e89b-12d3-a456-426614174000',
          'Rack-A1'
        );

        expect(error.name).toBe('RackNameExistsError');
        expect(error.message).toBe(
          'Rack name Rack-A1 already exists in room 789e4567-e89b-12d3-a456-426614174000'
        );
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('RackHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new RackHasDependenciesError(
          '111e4567-e89b-12d3-a456-426614174000',
          15
        );

        expect(error.name).toBe('RackHasDependenciesError');
        expect(error.message).toContain('has 15 mounted asset(s)');
        expect(error.assetCount).toBe(15);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('RoomNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new RoomNotFoundError('789e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('RoomNotFoundError');
        expect(error.message).toBe('Room not found: 789e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('InsufficientRackUnitsError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new InsufficientRackUnitsError(
          '111e4567-e89b-12d3-a456-426614174000',
          42,
          30,
          50
        );

        expect(error.name).toBe('InsufficientRackUnitsError');
        expect(error.message).toContain('insufficient units');
        expect(error.message).toContain('12 available'); // 42 - 30 = 12
        expect(error.message).toContain('50 requested');
        expect(error.totalUnits).toBe(42);
        expect(error.usedUnits).toBe(30);
        expect(error.requestedUnits).toBe(50);
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
