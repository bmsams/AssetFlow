/**
 * Floor Service Unit Tests
 *
 * Tests for the Floor Service business logic layer.
 * Requirements:
 * - Requirement 2.1: Create floor with building reference, floor number, and name
 * - Requirement 2.2: Return all floors for a building ordered by floor number
 * - Requirement 2.3: Update specified fields and maintain building relationship
 * - Requirement 2.4: Mark floor as inactive and prevent new room assignments
 * - Requirement 2.5: Reject creation for non-existent building
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

import type { Floor, CreateFloorRequest, UpdateFloorRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../location/location-repository';
import {
  createFloor,
  getFloor,
  getFloorOrThrow,
  getFloorsByBuilding,
  updateFloor,
  deactivateFloor,
  deleteFloor,
  listFloors,
  getActiveFloorsByBuilding,
  isFloorNumberUnique,
  FloorNotFoundError,
  FloorNumberExistsError,
  FloorHasDependenciesError,
  BuildingNotFoundError,
} from '../location/floor-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockFloor: Floor = {
  floorId: '456e4567-e89b-12d3-a456-426614174000',
  buildingId: '123e4567-e89b-12d3-a456-426614174000',
  floorNumber: 1,
  name: 'First Floor',
  description: 'Main lobby and reception',
  totalRooms: 5,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateFloorRequest = {
  buildingId: '123e4567-e89b-12d3-a456-426614174000',
  floorNumber: 1,
  name: 'First Floor',
  description: 'Main lobby and reception',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'FLOOR_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Floor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.floorKey.mockImplementation((id: string) => `floor:${id}`);
    mockCache.floorsByBuildingKey.mockImplementation((id: string) => `floor:building:${id}`);
    mockCache.floorInvalidationPatterns.mockReturnValue([
      'floor:456e4567-e89b-12d3-a456-426614174000*',
      'floor:list*',
    ]);
  });


  // ============================================================================
  // createFloor Tests (Requirement 2.1, 2.5)
  // ============================================================================

  describe('createFloor', () => {
    it('should create a floor successfully', async () => {
      mockRepository.buildingExists.mockResolvedValue(true);
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);
      mockRepository.createFloor.mockResolvedValue(mockFloor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createFloor(validCreateRequest);

      expect(result).toEqual(mockFloor);
      expect(mockRepository.buildingExists).toHaveBeenCalledWith(validCreateRequest.buildingId);
      expect(mockRepository.floorNumberExistsInBuilding).toHaveBeenCalledWith(
        validCreateRequest.buildingId,
        validCreateRequest.floorNumber
      );
      expect(mockRepository.createFloor).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create a floor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.buildingExists.mockResolvedValue(true);
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);
      mockRepository.createFloor.mockResolvedValue(mockFloor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createFloor(validCreateRequest, userId);

      expect(mockRepository.createFloor).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw BuildingNotFoundError when building does not exist (Requirement 2.5)', async () => {
      mockRepository.buildingExists.mockResolvedValue(false);

      await expect(createFloor(validCreateRequest)).rejects.toThrow(BuildingNotFoundError);
      await expect(createFloor(validCreateRequest)).rejects.toThrow(
        `Building not found: ${validCreateRequest.buildingId}`
      );
      expect(mockRepository.createFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorNumberExistsError when floor number already exists in building', async () => {
      mockRepository.buildingExists.mockResolvedValue(true);
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(true);

      await expect(createFloor(validCreateRequest)).rejects.toThrow(FloorNumberExistsError);
      await expect(createFloor(validCreateRequest)).rejects.toThrow(
        `Floor number ${validCreateRequest.floorNumber} already exists in building ${validCreateRequest.buildingId}`
      );
      expect(mockRepository.createFloor).not.toHaveBeenCalled();
    });

    it('should invalidate building floors cache after creation', async () => {
      mockRepository.buildingExists.mockResolvedValue(true);
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);
      mockRepository.createFloor.mockResolvedValue(mockFloor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createFloor(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith(`floor:building:${validCreateRequest.buildingId}`);
    });

    it('should publish FLOOR_CREATED event after creation', async () => {
      mockRepository.buildingExists.mockResolvedValue(true);
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);
      mockRepository.createFloor.mockResolvedValue(mockFloor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createFloor(validCreateRequest, 'user-123');

      expect(mockPublishEvent).toHaveBeenCalledWith('FLOOR_CREATED', {
        floorId: mockFloor.floorId,
        buildingId: mockFloor.buildingId,
        floorNumber: mockFloor.floorNumber,
        name: mockFloor.name,
        createdBy: 'user-123',
      });
    });
  });


  // ============================================================================
  // getFloor Tests
  // ============================================================================

  describe('getFloor', () => {
    it('should return floor from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockFloor);

      const result = await getFloor(mockFloor.floorId);

      expect(result).toEqual(mockFloor);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `floor:${mockFloor.floorId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when not in cache', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getFloorById.mockResolvedValue(mockFloor);

      const result = await getFloor(mockFloor.floorId);

      expect(result).toEqual(mockFloor);
      expect(mockRepository.getFloorById).toHaveBeenCalledWith(mockFloor.floorId);
    });

    it('should return null when floor not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getFloorById.mockResolvedValue(null);

      const result = await getFloor('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getFloorOrThrow Tests
  // ============================================================================

  describe('getFloorOrThrow', () => {
    it('should return floor when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockFloor);

      const result = await getFloorOrThrow(mockFloor.floorId);

      expect(result).toEqual(mockFloor);
    });

    it('should throw FloorNotFoundError when floor not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getFloorOrThrow('nonexistent-id')).rejects.toThrow(FloorNotFoundError);
      await expect(getFloorOrThrow('nonexistent-id')).rejects.toThrow(
        'Floor not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getFloorsByBuilding Tests (Requirement 2.2)
  // ============================================================================

  describe('getFloorsByBuilding', () => {
    const floorsInBuilding: Floor[] = [
      mockFloor,
      { ...mockFloor, floorId: '556e4567-e89b-12d3-a456-426614174001', floorNumber: 2, name: 'Second Floor' },
      { ...mockFloor, floorId: '556e4567-e89b-12d3-a456-426614174002', floorNumber: 3, name: 'Third Floor' },
    ];

    it('should return floors for a building from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(floorsInBuilding);

      const result = await getFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual(floorsInBuilding);
      expect(result).toHaveLength(3);
    });

    it('should use cache with building-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(floorsInBuilding);

      await getFloorsByBuilding(mockFloor.buildingId);

      expect(mockCache.floorsByBuildingKey).toHaveBeenCalledWith(mockFloor.buildingId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `floor:building:${mockFloor.buildingId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getFloorsByBuildingId.mockResolvedValue(floorsInBuilding);

      const result = await getFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual(floorsInBuilding);
      expect(mockRepository.getFloorsByBuildingId).toHaveBeenCalledWith(mockFloor.buildingId);
    });

    it('should return empty array when building has no floors', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // updateFloor Tests (Requirement 2.3)
  // ============================================================================

  describe('updateFloor', () => {
    const updateRequest: UpdateFloorRequest = {
      name: 'Updated Floor Name',
      description: 'Updated description',
    };

    const updatedFloor: Floor = {
      ...mockFloor,
      name: 'Updated Floor Name',
      description: 'Updated description',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update floor successfully', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.updateFloor.mockResolvedValue(updatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateFloor(mockFloor.floorId, updateRequest);

      expect(result).toEqual(updatedFloor);
      expect(mockRepository.getFloorById).toHaveBeenCalledWith(mockFloor.floorId);
      expect(mockRepository.updateFloor).toHaveBeenCalledWith(
        mockFloor.floorId,
        updateRequest,
        undefined
      );
    });

    it('should update floor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.updateFloor.mockResolvedValue(updatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateFloor(mockFloor.floorId, updateRequest, userId);

      expect(mockRepository.updateFloor).toHaveBeenCalledWith(
        mockFloor.floorId,
        updateRequest,
        userId
      );
    });

    it('should throw FloorNotFoundError when floor does not exist', async () => {
      mockRepository.getFloorById.mockResolvedValue(null);

      await expect(
        updateFloor('nonexistent-id', updateRequest)
      ).rejects.toThrow(FloorNotFoundError);
      expect(mockRepository.updateFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorNotFoundError when update returns null', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.updateFloor.mockResolvedValue(null);

      await expect(
        updateFloor(mockFloor.floorId, updateRequest)
      ).rejects.toThrow(FloorNotFoundError);
    });

    it('should invalidate floor cache after update', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.updateFloor.mockResolvedValue(updatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateFloor(mockFloor.floorId, updateRequest);

      expect(mockCache.floorInvalidationPatterns).toHaveBeenCalledWith(
        mockFloor.floorId,
        mockFloor.buildingId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`floor:${mockFloor.floorId}`);
      expect(mockCache.del).toHaveBeenCalledWith(`floor:building:${mockFloor.buildingId}`);
    });

    it('should publish FLOOR_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.updateFloor.mockResolvedValue(updatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateFloor(mockFloor.floorId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('FLOOR_UPDATED', {
        floorId: updatedFloor.floorId,
        buildingId: updatedFloor.buildingId,
        floorNumber: updatedFloor.floorNumber,
        name: updatedFloor.name,
        updatedBy: userId,
        changes: ['name', 'description'],
      });
    });
  });


  // ============================================================================
  // deactivateFloor Tests (Requirement 2.4)
  // ============================================================================

  describe('deactivateFloor', () => {
    const deactivatedFloor: Floor = {
      ...mockFloor,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate floor successfully', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.deactivateFloor.mockResolvedValue(deactivatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateFloor(mockFloor.floorId);

      expect(result).toEqual(deactivatedFloor);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateFloor).toHaveBeenCalledWith(
        mockFloor.floorId,
        undefined
      );
    });

    it('should deactivate floor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.deactivateFloor.mockResolvedValue(deactivatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateFloor(mockFloor.floorId, userId);

      expect(mockRepository.deactivateFloor).toHaveBeenCalledWith(
        mockFloor.floorId,
        userId
      );
    });

    it('should throw FloorNotFoundError when floor does not exist', async () => {
      mockRepository.getFloorById.mockResolvedValue(null);

      await expect(deactivateFloor('nonexistent-id')).rejects.toThrow(FloorNotFoundError);
      expect(mockRepository.deactivateFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorNotFoundError when deactivate returns null', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.deactivateFloor.mockResolvedValue(null);

      await expect(deactivateFloor(mockFloor.floorId)).rejects.toThrow(
        FloorNotFoundError
      );
    });

    it('should invalidate floor cache after deactivation', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.deactivateFloor.mockResolvedValue(deactivatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateFloor(mockFloor.floorId);

      expect(mockCache.floorInvalidationPatterns).toHaveBeenCalledWith(
        mockFloor.floorId,
        mockFloor.buildingId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`floor:${mockFloor.floorId}`);
    });

    it('should publish FLOOR_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.deactivateFloor.mockResolvedValue(deactivatedFloor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateFloor(mockFloor.floorId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('FLOOR_DEACTIVATED', {
        floorId: deactivatedFloor.floorId,
        buildingId: deactivatedFloor.buildingId,
        floorNumber: deactivatedFloor.floorNumber,
        name: deactivatedFloor.name,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteFloor Tests
  // ============================================================================

  describe('deleteFloor', () => {
    it('should delete floor successfully when no dependencies', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 0, assetCount: 0 });
      mockRepository.deleteFloor.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteFloor(mockFloor.floorId);

      expect(result).toBe(true);
      expect(mockRepository.deleteFloor).toHaveBeenCalledWith(mockFloor.floorId);
    });

    it('should throw FloorNotFoundError when floor does not exist', async () => {
      mockRepository.getFloorById.mockResolvedValue(null);

      await expect(deleteFloor('nonexistent-id')).rejects.toThrow(FloorNotFoundError);
      expect(mockRepository.getFloorDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorHasDependenciesError when floor has rooms', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 3, assetCount: 0 });

      await expect(deleteFloor(mockFloor.floorId)).rejects.toThrow(
        FloorHasDependenciesError
      );
      await expect(deleteFloor(mockFloor.floorId)).rejects.toThrow(
        /has 3 room\(s\) and 0 asset\(s\)/
      );
      expect(mockRepository.deleteFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorHasDependenciesError when floor has assets', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 0, assetCount: 10 });

      await expect(deleteFloor(mockFloor.floorId)).rejects.toThrow(
        FloorHasDependenciesError
      );
      await expect(deleteFloor(mockFloor.floorId)).rejects.toThrow(
        /has 0 room\(s\) and 10 asset\(s\)/
      );
      expect(mockRepository.deleteFloor).not.toHaveBeenCalled();
    });

    it('should throw FloorHasDependenciesError when floor has both rooms and assets', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 5, assetCount: 25 });

      const error = await deleteFloor(mockFloor.floorId).catch((e) => e);

      expect(error).toBeInstanceOf(FloorHasDependenciesError);
      expect(error.roomCount).toBe(5);
      expect(error.assetCount).toBe(25);
    });

    it('should invalidate floor cache after deletion', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 0, assetCount: 0 });
      mockRepository.deleteFloor.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteFloor(mockFloor.floorId);

      expect(mockCache.floorInvalidationPatterns).toHaveBeenCalledWith(
        mockFloor.floorId,
        mockFloor.buildingId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getFloorById.mockResolvedValue(mockFloor);
      mockRepository.getFloorDependencies.mockResolvedValue({ roomCount: 0, assetCount: 0 });
      mockRepository.deleteFloor.mockResolvedValue(false);

      const result = await deleteFloor(mockFloor.floorId);

      expect(result).toBe(false);
      expect(mockCache.floorInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listFloors Tests
  // ============================================================================

  describe('listFloors', () => {
    const mockPaginatedResult = {
      items: [mockFloor],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated list of floors', async () => {
      mockRepository.listFloors.mockResolvedValue(mockPaginatedResult);

      const result = await listFloors();

      expect(result).toEqual(mockPaginatedResult);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const filters = {
        buildingId: mockFloor.buildingId,
        isActive: true,
      };
      mockRepository.listFloors.mockResolvedValue(mockPaginatedResult);

      await listFloors(filters);

      expect(mockRepository.listFloors).toHaveBeenCalledWith(filters, {});
    });

    it('should pass pagination params to repository', async () => {
      const pagination = { page: 3, limit: 10 };
      mockRepository.listFloors.mockResolvedValue({
        ...mockPaginatedResult,
        page: 3,
        limit: 10,
      });

      await listFloors({}, pagination);

      expect(mockRepository.listFloors).toHaveBeenCalledWith({}, pagination);
    });
  });


  // ============================================================================
  // getActiveFloorsByBuilding Tests
  // ============================================================================

  describe('getActiveFloorsByBuilding', () => {
    const activeFloors: Floor[] = [
      mockFloor,
      { ...mockFloor, floorId: '556e4567-e89b-12d3-a456-426614174001', floorNumber: 2, name: 'Second Floor' },
    ];

    it('should return list of active floors for a building', async () => {
      mockCache.getOrSet.mockResolvedValue(activeFloors);

      const result = await getActiveFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual(activeFloors);
      expect(result).toHaveLength(2);
    });

    it('should use cache with active filter key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeFloors);

      await getActiveFloorsByBuilding(mockFloor.buildingId);

      expect(mockCache.floorsByBuildingKey).toHaveBeenCalledWith(mockFloor.buildingId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `floor:building:${mockFloor.buildingId}:active`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getActiveFloorsByBuildingId.mockResolvedValue(activeFloors);

      const result = await getActiveFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual(activeFloors);
      expect(mockRepository.getActiveFloorsByBuildingId).toHaveBeenCalledWith(mockFloor.buildingId);
    });

    it('should return empty array when no active floors', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveFloorsByBuilding(mockFloor.buildingId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // isFloorNumberUnique Tests
  // ============================================================================

  describe('isFloorNumberUnique', () => {
    it('should return true when floor number does not exist in building', async () => {
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);

      const result = await isFloorNumberUnique(mockFloor.buildingId, 99);

      expect(result).toBe(true);
      expect(mockRepository.floorNumberExistsInBuilding).toHaveBeenCalledWith(
        mockFloor.buildingId,
        99,
        undefined
      );
    });

    it('should return false when floor number exists in building', async () => {
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(true);

      const result = await isFloorNumberUnique(mockFloor.buildingId, 1);

      expect(result).toBe(false);
    });

    it('should exclude specific floor ID when checking uniqueness', async () => {
      const excludeFloorId = '456e4567-e89b-12d3-a456-426614174000';
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);

      const result = await isFloorNumberUnique(mockFloor.buildingId, 1, excludeFloorId);

      expect(result).toBe(true);
      expect(mockRepository.floorNumberExistsInBuilding).toHaveBeenCalledWith(
        mockFloor.buildingId,
        1,
        excludeFloorId
      );
    });

    it('should return true when floor number exists but belongs to excluded floor', async () => {
      const excludeFloorId = '456e4567-e89b-12d3-a456-426614174000';
      mockRepository.floorNumberExistsInBuilding.mockResolvedValue(false);

      const result = await isFloorNumberUnique(mockFloor.buildingId, 1, excludeFloorId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('FloorNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new FloorNotFoundError('456e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('FloorNotFoundError');
        expect(error.message).toBe('Floor not found: 456e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('FloorNumberExistsError', () => {
      it('should have correct name and message', () => {
        const error = new FloorNumberExistsError(
          '123e4567-e89b-12d3-a456-426614174000',
          5
        );

        expect(error.name).toBe('FloorNumberExistsError');
        expect(error.message).toBe(
          'Floor number 5 already exists in building 123e4567-e89b-12d3-a456-426614174000'
        );
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('FloorHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new FloorHasDependenciesError(
          '456e4567-e89b-12d3-a456-426614174000',
          3,
          10
        );

        expect(error.name).toBe('FloorHasDependenciesError');
        expect(error.message).toContain('has 3 room(s) and 10 asset(s)');
        expect(error.roomCount).toBe(3);
        expect(error.assetCount).toBe(10);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('BuildingNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new BuildingNotFoundError('123e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('BuildingNotFoundError');
        expect(error.message).toBe('Building not found: 123e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
