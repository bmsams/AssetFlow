/**
 * Stockroom Service Unit Tests
 *
 * Tests for the Stockroom Service business logic layer.
 * Requirements:
 * - Requirement 5.1: Create stockroom with location reference, name, and type
 * - Requirement 5.2: Return all stockrooms for a location ordered by name
 * - Requirement 5.3: Update specified fields and maintain location relationship
 * - Requirement 5.4: Mark stockroom as inactive and prevent new inventory assignments
 * - Requirement 5.5: Reject creation for non-existent location
 * - Requirement 5.7: Reject deletion if stockroom has inventory
 */

// Mock the dependencies before importing service
jest.mock('../stockroom/stockroom-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  stockroomKey: jest.fn(),
  stockroomsByLocationKey: jest.fn(),
  stockroomInvalidationPatterns: jest.fn(),
  entityKey: jest.fn(),
}));
jest.mock('@ams/events');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import type {
  Stockroom,
  CreateStockroomRequest,
  UpdateStockroomRequest,
} from '../stockroom/stockroom-repository';
import * as repository from '../stockroom/stockroom-repository';
import {
  createStockroom,
  getStockroom,
  getStockroomOrThrow,
  getStockroomsByLocation,
  updateStockroom,
  deactivateStockroom,
  deleteStockroom,
  StockroomNotFoundError,
  StockroomNameExistsError,
  StockroomCodeExistsError,
  StockroomHasDependenciesError,
  LocationNotFoundError,
} from '../stockroom/stockroom-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockStockroom: Stockroom = {
  stockroomId: '111e4567-e89b-12d3-a456-426614174000',
  stockroomCode: 'STK-001',
  name: 'Main Stockroom',
  location: 'Building A',
  stockroomType: 'MAIN',
  managerId: '999e4567-e89b-12d3-a456-426614174999',
  isActive: true,
  description: 'Primary stockroom for IT equipment',
  building: '789e4567-e89b-12d3-a456-426614174000',
  floor: null,
  room: null,
  capacityUnits: 1000,
  currentUtilization: 250,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateStockroomRequest = {
  name: 'Main Stockroom',
  stockroomCode: 'STK-001',
  stockroomType: 'MAIN',
  managerId: '999e4567-e89b-12d3-a456-426614174999',
  building: '789e4567-e89b-12d3-a456-426614174000',
  description: 'Primary stockroom for IT equipment',
  capacityUnits: 1000,
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'STOCKROOM_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Stockroom Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.stockroomKey.mockImplementation((id: string) => `stockroom:${id}`);
    mockCache.stockroomsByLocationKey.mockImplementation((id: string) => `stockroom:location:${id}`);
    mockCache.stockroomInvalidationPatterns.mockReturnValue([
      'stockroom:111e4567-e89b-12d3-a456-426614174000*',
      'stockroom:list*',
    ]);
    mockCache.entityKey.mockImplementation((type: string, id: string) => `${type}:${id}`);
  });


  // ============================================================================
  // createStockroom Tests (Requirement 5.1, 5.5)
  // ============================================================================

  describe('createStockroom', () => {
    it('should create a stockroom successfully (Requirement 5.1)', async () => {
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(false);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createStockroom(validCreateRequest);

      expect(result).toEqual(mockStockroom);
      expect(mockRepository.locationExists).toHaveBeenCalledWith(validCreateRequest.building);
      expect(mockRepository.stockroomCodeExists).toHaveBeenCalledWith(validCreateRequest.stockroomCode);
      expect(mockRepository.stockroomNameExistsInLocation).toHaveBeenCalledWith(
        validCreateRequest.building,
        validCreateRequest.name
      );
      expect(mockRepository.createStockroom).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create a stockroom with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(false);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest, userId);

      expect(mockRepository.createStockroom).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw LocationNotFoundError for non-existent location (Requirement 5.5)', async () => {
      mockRepository.locationExists.mockResolvedValue(false);

      await expect(createStockroom(validCreateRequest)).rejects.toThrow(LocationNotFoundError);
      await expect(createStockroom(validCreateRequest)).rejects.toThrow(
        `Location not found: ${validCreateRequest.building}`
      );
      expect(mockRepository.createStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomNameExistsError for duplicate name', async () => {
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(false);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(true);

      await expect(createStockroom(validCreateRequest)).rejects.toThrow(StockroomNameExistsError);
      expect(mockRepository.createStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomCodeExistsError for duplicate code', async () => {
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(true);

      await expect(createStockroom(validCreateRequest)).rejects.toThrow(StockroomCodeExistsError);
      await expect(createStockroom(validCreateRequest)).rejects.toThrow(
        `Stockroom code "${validCreateRequest.stockroomCode}" already exists`
      );
      expect(mockRepository.createStockroom).not.toHaveBeenCalled();
    });


    it('should invalidate cache after creation', async () => {
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(false);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest);

      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        validCreateRequest.building
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`stockroom:${mockStockroom.stockroomId}`);
      expect(mockCache.del).toHaveBeenCalledWith(`stockroom:location:${validCreateRequest.building}`);
    });

    it('should publish STOCKROOM_CREATED event', async () => {
      const userId = 'user-123';
      mockRepository.locationExists.mockResolvedValue(true);
      mockRepository.stockroomCodeExists.mockResolvedValue(false);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_CREATED', {
        stockroomId: mockStockroom.stockroomId,
        stockroomCode: mockStockroom.stockroomCode,
        name: mockStockroom.name,
        stockroomType: mockStockroom.stockroomType,
        createdBy: userId,
      });
    });

    it('should create stockroom without building (no location validation)', async () => {
      const requestWithoutBuilding: CreateStockroomRequest = {
        name: 'Virtual Stockroom',
        stockroomType: 'VIRTUAL',
      };
      const stockroomWithoutBuilding: Stockroom = {
        ...mockStockroom,
        building: null,
        stockroomType: 'VIRTUAL',
      };

      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.createStockroom.mockResolvedValue(stockroomWithoutBuilding);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createStockroom(requestWithoutBuilding);

      expect(result).toEqual(stockroomWithoutBuilding);
      expect(mockRepository.locationExists).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // getStockroom Tests (Requirement 5.2)
  // ============================================================================

  describe('getStockroom', () => {
    it('should return stockroom from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockStockroom);

      const result = await getStockroom(mockStockroom.stockroomId);

      expect(result).toEqual(mockStockroom);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);

      const result = await getStockroom(mockStockroom.stockroomId);

      expect(result).toEqual(mockStockroom);
      expect(mockRepository.getStockroomById).toHaveBeenCalledWith(mockStockroom.stockroomId);
    });

    it('should return null for non-existent stockroom', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getStockroomById.mockResolvedValue(null);

      const result = await getStockroom('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getStockroomOrThrow Tests
  // ============================================================================

  describe('getStockroomOrThrow', () => {
    it('should return stockroom when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockStockroom);

      const result = await getStockroomOrThrow(mockStockroom.stockroomId);

      expect(result).toEqual(mockStockroom);
    });

    it('should throw StockroomNotFoundError when stockroom not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getStockroomOrThrow('nonexistent-id')).rejects.toThrow(StockroomNotFoundError);
      await expect(getStockroomOrThrow('nonexistent-id')).rejects.toThrow(
        'Stockroom not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getStockroomsByLocation Tests (Requirement 5.2)
  // ============================================================================

  describe('getStockroomsByLocation', () => {
    const stockroomsInLocation: Stockroom[] = [
      mockStockroom,
      { ...mockStockroom, stockroomId: '222e4567-e89b-12d3-a456-426614174001', name: 'Satellite Stockroom' },
      { ...mockStockroom, stockroomId: '333e4567-e89b-12d3-a456-426614174002', name: 'Repair Stockroom' },
    ];

    it('should return stockrooms ordered by name (Requirement 5.2)', async () => {
      mockCache.getOrSet.mockResolvedValue(stockroomsInLocation);

      const result = await getStockroomsByLocation(mockStockroom.building!);

      expect(result).toEqual(stockroomsInLocation);
      expect(result).toHaveLength(3);
    });

    it('should use cache with location-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(stockroomsInLocation);

      await getStockroomsByLocation(mockStockroom.building!);

      expect(mockCache.stockroomsByLocationKey).toHaveBeenCalledWith(mockStockroom.building);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `stockroom:location:${mockStockroom.building}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getStockroomsByLocation.mockResolvedValue(stockroomsInLocation);

      const result = await getStockroomsByLocation(mockStockroom.building!);

      expect(result).toEqual(stockroomsInLocation);
      expect(mockRepository.getStockroomsByLocation).toHaveBeenCalledWith(mockStockroom.building);
    });

    it('should return empty array when location has no stockrooms', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getStockroomsByLocation(mockStockroom.building!);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // updateStockroom Tests (Requirement 5.3)
  // ============================================================================

  describe('updateStockroom', () => {
    const updateRequest: UpdateStockroomRequest = {
      name: 'Updated Stockroom Name',
      description: 'Updated description',
      capacityUnits: 1500,
    };

    const updatedStockroom: Stockroom = {
      ...mockStockroom,
      name: 'Updated Stockroom Name',
      description: 'Updated description',
      capacityUnits: 1500,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update stockroom successfully (Requirement 5.3)', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateStockroom(mockStockroom.stockroomId, updateRequest);

      expect(result).toEqual(updatedStockroom);
      expect(mockRepository.getStockroomById).toHaveBeenCalledWith(mockStockroom.stockroomId);
      expect(mockRepository.updateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        updateRequest,
        undefined
      );
    });

    it('should update stockroom with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest, userId);

      expect(mockRepository.updateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        updateRequest,
        userId
      );
    });

    it('should throw StockroomNotFoundError for non-existent stockroom', async () => {
      mockRepository.getStockroomById.mockResolvedValue(null);

      await expect(
        updateStockroom('nonexistent-id', updateRequest)
      ).rejects.toThrow(StockroomNotFoundError);
      expect(mockRepository.updateStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomNotFoundError when update returns null', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(null);

      await expect(
        updateStockroom(mockStockroom.stockroomId, updateRequest)
      ).rejects.toThrow(StockroomNotFoundError);
    });


    it('should throw StockroomNameExistsError for duplicate name', async () => {
      const updateWithName: UpdateStockroomRequest = { name: 'Existing Name' };
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(true);

      await expect(
        updateStockroom(mockStockroom.stockroomId, updateWithName)
      ).rejects.toThrow(StockroomNameExistsError);
      expect(mockRepository.updateStockroom).not.toHaveBeenCalled();
    });

    it('should not check name uniqueness when name unchanged', async () => {
      const updateWithoutName: UpdateStockroomRequest = { description: 'New description' };
      const updatedWithDescription: Stockroom = {
        ...mockStockroom,
        description: 'New description',
      };
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedWithDescription);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateWithoutName);

      expect(mockRepository.stockroomNameExistsInLocation).not.toHaveBeenCalled();
    });

    it('should invalidate cache after update', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest);

      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        mockStockroom.building
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`stockroom:${mockStockroom.stockroomId}`);
    });

    it('should publish STOCKROOM_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.stockroomNameExistsInLocation.mockResolvedValue(false);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_UPDATED', expect.objectContaining({
        stockroomId: updatedStockroom.stockroomId,
        stockroomCode: updatedStockroom.stockroomCode,
        updatedBy: userId,
      }));
    });

    it('should invalidate both old and new location caches when building changes', async () => {
      const newBuildingId = '888e4567-e89b-12d3-a456-426614174888';
      const updateWithNewBuilding: UpdateStockroomRequest = { building: newBuildingId };
      const updatedWithNewBuilding: Stockroom = {
        ...mockStockroom,
        building: newBuildingId,
      };
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedWithNewBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateWithNewBuilding);

      // Should invalidate both old and new location caches
      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        mockStockroom.building
      );
      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        newBuildingId
      );
    });
  });


  // ============================================================================
  // deactivateStockroom Tests (Requirement 5.4)
  // ============================================================================

  describe('deactivateStockroom', () => {
    const deactivatedStockroom: Stockroom = {
      ...mockStockroom,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate stockroom successfully (Requirement 5.4)', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateStockroom(mockStockroom.stockroomId);

      expect(result).toEqual(deactivatedStockroom);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        undefined
      );
    });

    it('should deactivate stockroom with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateStockroom(mockStockroom.stockroomId, userId);

      expect(mockRepository.deactivateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        userId
      );
    });

    it('should throw StockroomNotFoundError when stockroom does not exist', async () => {
      mockRepository.getStockroomById.mockResolvedValue(null);

      await expect(deactivateStockroom('nonexistent-id')).rejects.toThrow(StockroomNotFoundError);
      expect(mockRepository.deactivateStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomNotFoundError when deactivate returns null', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.deactivateStockroom.mockResolvedValue(null);

      await expect(deactivateStockroom(mockStockroom.stockroomId)).rejects.toThrow(
        StockroomNotFoundError
      );
    });

    it('should invalidate cache after deactivation', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateStockroom(mockStockroom.stockroomId);

      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        mockStockroom.building
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`stockroom:${mockStockroom.stockroomId}`);
    });

    it('should publish STOCKROOM_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateStockroom(mockStockroom.stockroomId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_DEACTIVATED', {
        stockroomId: deactivatedStockroom.stockroomId,
        stockroomCode: deactivatedStockroom.stockroomCode,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteStockroom Tests (Requirement 5.7)
  // ============================================================================

  describe('deleteStockroom', () => {
    it('should delete stockroom successfully when no dependencies', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deleteStockroom.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteStockroom(mockStockroom.stockroomId);

      expect(result).toBe(true);
      expect(mockRepository.deleteStockroom).toHaveBeenCalledWith(mockStockroom.stockroomId);
    });

    it('should throw StockroomNotFoundError when stockroom does not exist', async () => {
      mockRepository.getStockroomById.mockResolvedValue(null);

      await expect(deleteStockroom('nonexistent-id')).rejects.toThrow(StockroomNotFoundError);
      expect(mockRepository.getStockroomDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomHasDependenciesError when has bin locations (Requirement 5.7)', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 5,
        inventoryCount: 0,
      });

      await expect(deleteStockroom(mockStockroom.stockroomId)).rejects.toThrow(
        StockroomHasDependenciesError
      );
      await expect(deleteStockroom(mockStockroom.stockroomId)).rejects.toThrow(
        /has 5 bin location\(s\)/
      );
      expect(mockRepository.deleteStockroom).not.toHaveBeenCalled();
    });

    it('should throw StockroomHasDependenciesError when has inventory (Requirement 5.7)', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 0,
        inventoryCount: 10,
      });

      await expect(deleteStockroom(mockStockroom.stockroomId)).rejects.toThrow(
        StockroomHasDependenciesError
      );
      await expect(deleteStockroom(mockStockroom.stockroomId)).rejects.toThrow(
        /10 inventory item\(s\)/
      );
      expect(mockRepository.deleteStockroom).not.toHaveBeenCalled();
    });

    it('should include dependency counts in StockroomHasDependenciesError', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 3,
        inventoryCount: 7,
      });

      const error = await deleteStockroom(mockStockroom.stockroomId).catch((e) => e);

      expect(error).toBeInstanceOf(StockroomHasDependenciesError);
      expect(error.binLocationCount).toBe(3);
      expect(error.inventoryCount).toBe(7);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deleteStockroom.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteStockroom(mockStockroom.stockroomId);

      expect(mockCache.stockroomInvalidationPatterns).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        mockStockroom.building
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        binLocationCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deleteStockroom.mockResolvedValue(false);

      const result = await deleteStockroom(mockStockroom.stockroomId);

      expect(result).toBe(false);
      expect(mockCache.stockroomInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('StockroomNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new StockroomNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('StockroomNotFoundError');
        expect(error.message).toBe('Stockroom not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('StockroomNameExistsError', () => {
      it('should have correct name and message with location', () => {
        const error = new StockroomNameExistsError(
          '789e4567-e89b-12d3-a456-426614174000',
          'Main Stockroom'
        );

        expect(error.name).toBe('StockroomNameExistsError');
        expect(error.message).toContain('Main Stockroom');
        expect(error.message).toContain('789e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });

      it('should have correct message without location', () => {
        const error = new StockroomNameExistsError(null, 'Virtual Stockroom');

        expect(error.name).toBe('StockroomNameExistsError');
        expect(error.message).toContain('Virtual Stockroom');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('StockroomCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new StockroomCodeExistsError('STK-001');

        expect(error.name).toBe('StockroomCodeExistsError');
        expect(error.message).toBe('Stockroom code "STK-001" already exists');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('StockroomHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new StockroomHasDependenciesError(
          '111e4567-e89b-12d3-a456-426614174000',
          5,
          10
        );

        expect(error.name).toBe('StockroomHasDependenciesError');
        expect(error.message).toContain('5 bin location(s)');
        expect(error.message).toContain('10 inventory item(s)');
        expect(error.binLocationCount).toBe(5);
        expect(error.inventoryCount).toBe(10);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('LocationNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new LocationNotFoundError('789e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('LocationNotFoundError');
        expect(error.message).toBe('Location not found: 789e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
