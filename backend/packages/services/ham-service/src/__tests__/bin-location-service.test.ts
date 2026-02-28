/**
 * Bin Location Service Unit Tests
 *
 * Tests for the Bin Location Service business logic layer.
 * Requirements:
 * - Requirement 6.1: Create bin location with stockroom reference, code, and capacity
 * - Requirement 6.2: Return all bin locations for a stockroom ordered by code
 * - Requirement 6.3: Update specified fields and maintain stockroom relationship
 * - Requirement 6.4: Mark bin location as inactive and prevent new inventory assignments
 * - Requirement 6.5: Reject creation for non-existent stockroom, reject deletion if bin has items
 */

// Mock the dependencies before importing service
jest.mock('../stockroom/bin-location-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  binLocationKey: jest.fn(),
  binLocationsByStockroomKey: jest.fn(),
  binLocationInvalidationPatterns: jest.fn(),
  entityKey: jest.fn(),
  DEFAULT_TTL: {
    SHORT: 60,
    MEDIUM: 300,
    LONG: 3600,
  },
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

import type {
  BinLocation,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
} from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../stockroom/bin-location-repository';
import {
  createBinLocation,
  getBinLocation,
  getBinLocationOrThrow,
  getBinLocationsByStockroom,
  updateBinLocation,
  deactivateBinLocation,
  deleteBinLocation,
  BinLocationNotFoundError,
  BinCodeExistsError,
  BinLocationHasDependenciesError,
  StockroomNotFoundError,
} from '../stockroom/bin-location-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockBinLocation: BinLocation = {
  binId: '111e4567-e89b-12d3-a456-426614174000',
  stockroomId: '222e4567-e89b-12d3-a456-426614174000',
  binCode: 'BIN-A01',
  shelfLocation: 'Shelf 1, Row A',
  capacity: 100,
  currentCount: 25,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateBinLocationRequest = {
  stockroomId: '222e4567-e89b-12d3-a456-426614174000',
  binCode: 'BIN-A01',
  shelfLocation: 'Shelf 1, Row A',
  capacity: 100,
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'BIN_LOCATION_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};


describe('Bin Location Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.binLocationKey.mockImplementation((id: string) => `bin-location:${id}`);
    mockCache.binLocationsByStockroomKey.mockImplementation((id: string) => `bin-location:stockroom:${id}`);
    mockCache.binLocationInvalidationPatterns.mockReturnValue([
      'bin-location:111e4567-e89b-12d3-a456-426614174000*',
      'bin-location:list*',
    ]);
    mockCache.entityKey.mockImplementation((type: string, id: string) => `${type}:${id}`);
  });


  // ============================================================================
  // createBinLocation Tests (Requirement 6.1, 6.5)
  // ============================================================================

  describe('createBinLocation', () => {
    it('should create bin location and publish event (Requirement 6.1)', async () => {
      mockRepository.stockroomExists.mockResolvedValue(true);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createBinLocation(validCreateRequest);

      expect(result).toEqual(mockBinLocation);
      expect(mockRepository.stockroomExists).toHaveBeenCalledWith(validCreateRequest.stockroomId);
      expect(mockRepository.binCodeExistsInStockroom).toHaveBeenCalledWith(
        validCreateRequest.stockroomId,
        validCreateRequest.binCode
      );
      expect(mockRepository.createBinLocation).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create bin location with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.stockroomExists.mockResolvedValue(true);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBinLocation(validCreateRequest, userId);

      expect(mockRepository.createBinLocation).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw StockroomNotFoundError for non-existent stockroom (Requirement 6.5)', async () => {
      mockRepository.stockroomExists.mockResolvedValue(false);

      await expect(createBinLocation(validCreateRequest)).rejects.toThrow(StockroomNotFoundError);
      await expect(createBinLocation(validCreateRequest)).rejects.toThrow(
        `Stockroom not found: ${validCreateRequest.stockroomId}`
      );
      expect(mockRepository.createBinLocation).not.toHaveBeenCalled();
    });

    it('should throw BinCodeExistsError for duplicate bin code', async () => {
      mockRepository.stockroomExists.mockResolvedValue(true);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(true);

      await expect(createBinLocation(validCreateRequest)).rejects.toThrow(BinCodeExistsError);
      expect(mockRepository.createBinLocation).not.toHaveBeenCalled();
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.stockroomExists.mockResolvedValue(true);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBinLocation(validCreateRequest);

      expect(mockCache.binLocationsByStockroomKey).toHaveBeenCalledWith(validCreateRequest.stockroomId);
      expect(mockCache.del).toHaveBeenCalledWith(`bin-location:stockroom:${validCreateRequest.stockroomId}`);
    });

    it('should publish BIN_LOCATION_CREATED event', async () => {
      const userId = 'user-123';
      mockRepository.stockroomExists.mockResolvedValue(true);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBinLocation(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('BIN_LOCATION_CREATED', {
        binId: mockBinLocation.binId,
        stockroomId: mockBinLocation.stockroomId,
        binCode: mockBinLocation.binCode,
        createdBy: userId,
      });
    });
  });



  // ============================================================================
  // getBinLocation Tests
  // ============================================================================

  describe('getBinLocation', () => {
    it('should return bin location from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockBinLocation);

      const result = await getBinLocation(mockBinLocation.binId);

      expect(result).toEqual(mockBinLocation);
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
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);

      const result = await getBinLocation(mockBinLocation.binId);

      expect(result).toEqual(mockBinLocation);
      expect(mockRepository.getBinLocationById).toHaveBeenCalledWith(mockBinLocation.binId);
    });

    it('should return null for non-existent bin location', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getBinLocationById.mockResolvedValue(null);

      const result = await getBinLocation('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getBinLocationOrThrow Tests
  // ============================================================================

  describe('getBinLocationOrThrow', () => {
    it('should return bin location when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockBinLocation);

      const result = await getBinLocationOrThrow(mockBinLocation.binId);

      expect(result).toEqual(mockBinLocation);
    });

    it('should throw BinLocationNotFoundError when bin location not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getBinLocationOrThrow('nonexistent-id')).rejects.toThrow(BinLocationNotFoundError);
      await expect(getBinLocationOrThrow('nonexistent-id')).rejects.toThrow(
        'Bin location not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getBinLocationsByStockroom Tests (Requirement 6.2)
  // ============================================================================

  describe('getBinLocationsByStockroom', () => {
    const binLocationsInStockroom: BinLocation[] = [
      mockBinLocation,
      { ...mockBinLocation, binId: '111e4567-e89b-12d3-a456-426614174001', binCode: 'BIN-A02' },
      { ...mockBinLocation, binId: '111e4567-e89b-12d3-a456-426614174002', binCode: 'BIN-A03' },
    ];

    it('should return bin locations ordered by code (Requirement 6.2)', async () => {
      mockCache.getOrSet.mockResolvedValue(binLocationsInStockroom);

      const result = await getBinLocationsByStockroom(mockBinLocation.stockroomId);

      expect(result).toEqual(binLocationsInStockroom);
      expect(result).toHaveLength(3);
    });

    it('should use cache with stockroom-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(binLocationsInStockroom);

      await getBinLocationsByStockroom(mockBinLocation.stockroomId);

      expect(mockCache.binLocationsByStockroomKey).toHaveBeenCalledWith(mockBinLocation.stockroomId);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `bin-location:stockroom:${mockBinLocation.stockroomId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getBinLocationsByStockroom.mockResolvedValue(binLocationsInStockroom);

      const result = await getBinLocationsByStockroom(mockBinLocation.stockroomId);

      expect(result).toEqual(binLocationsInStockroom);
      expect(mockRepository.getBinLocationsByStockroom).toHaveBeenCalledWith(mockBinLocation.stockroomId);
    });

    it('should return empty array when stockroom has no bin locations', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getBinLocationsByStockroom(mockBinLocation.stockroomId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });



  // ============================================================================
  // updateBinLocation Tests (Requirement 6.3)
  // ============================================================================

  describe('updateBinLocation', () => {
    const updateRequest: UpdateBinLocationRequest = {
      binCode: 'BIN-A01-UPDATED',
      shelfLocation: 'Shelf 2, Row A',
      capacity: 150,
    };

    const updatedBinLocation: BinLocation = {
      ...mockBinLocation,
      binCode: 'BIN-A01-UPDATED',
      shelfLocation: 'Shelf 2, Row A',
      capacity: 150,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update bin location successfully (Requirement 6.3)', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateBinLocation(mockBinLocation.binId, updateRequest);

      expect(result).toEqual(updatedBinLocation);
      expect(mockRepository.getBinLocationById).toHaveBeenCalledWith(mockBinLocation.binId);
      expect(mockRepository.updateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        updateRequest,
        undefined
      );
    });

    it('should update bin location with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBinLocation(mockBinLocation.binId, updateRequest, userId);

      expect(mockRepository.updateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        updateRequest,
        userId
      );
    });

    it('should throw BinLocationNotFoundError for non-existent bin location', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      await expect(
        updateBinLocation('nonexistent-id', updateRequest)
      ).rejects.toThrow(BinLocationNotFoundError);
      expect(mockRepository.updateBinLocation).not.toHaveBeenCalled();
    });

    it('should throw BinLocationNotFoundError when update returns null', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.updateBinLocation.mockResolvedValue(null);

      await expect(
        updateBinLocation(mockBinLocation.binId, updateRequest)
      ).rejects.toThrow(BinLocationNotFoundError);
    });

    it('should throw BinCodeExistsError for duplicate bin code', async () => {
      const updateWithCode: UpdateBinLocationRequest = { binCode: 'EXISTING-CODE' };
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(true);

      await expect(
        updateBinLocation(mockBinLocation.binId, updateWithCode)
      ).rejects.toThrow(BinCodeExistsError);
      expect(mockRepository.updateBinLocation).not.toHaveBeenCalled();
    });

    it('should not check bin code uniqueness when code unchanged', async () => {
      const updateWithoutCode: UpdateBinLocationRequest = { capacity: 200 };
      const updatedWithCapacity: BinLocation = {
        ...mockBinLocation,
        capacity: 200,
      };
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.updateBinLocation.mockResolvedValue(updatedWithCapacity);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBinLocation(mockBinLocation.binId, updateWithoutCode);

      expect(mockRepository.binCodeExistsInStockroom).not.toHaveBeenCalled();
    });

    it('should invalidate cache after update', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBinLocation(mockBinLocation.binId, updateRequest);

      expect(mockCache.binLocationInvalidationPatterns).toHaveBeenCalledWith(
        mockBinLocation.binId,
        mockBinLocation.stockroomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`bin-location:${mockBinLocation.binId}`);
    });

    it('should publish BIN_LOCATION_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.binCodeExistsInStockroom.mockResolvedValue(false);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBinLocation(mockBinLocation.binId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('BIN_LOCATION_UPDATED', expect.objectContaining({
        binId: updatedBinLocation.binId,
        stockroomId: updatedBinLocation.stockroomId,
        updatedBy: userId,
      }));
    });
  });



  // ============================================================================
  // deactivateBinLocation Tests (Requirement 6.4)
  // ============================================================================

  describe('deactivateBinLocation', () => {
    const deactivatedBinLocation: BinLocation = {
      ...mockBinLocation,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate bin location successfully (Requirement 6.4)', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateBinLocation(mockBinLocation.binId);

      expect(result).toEqual(deactivatedBinLocation);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        undefined
      );
    });

    it('should deactivate bin location with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBinLocation(mockBinLocation.binId, userId);

      expect(mockRepository.deactivateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        userId
      );
    });

    it('should throw BinLocationNotFoundError when bin location does not exist', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      await expect(deactivateBinLocation('nonexistent-id')).rejects.toThrow(BinLocationNotFoundError);
      expect(mockRepository.deactivateBinLocation).not.toHaveBeenCalled();
    });

    it('should throw BinLocationNotFoundError when deactivate returns null', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(null);

      await expect(deactivateBinLocation(mockBinLocation.binId)).rejects.toThrow(
        BinLocationNotFoundError
      );
    });

    it('should invalidate cache after deactivation', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBinLocation(mockBinLocation.binId);

      expect(mockCache.binLocationInvalidationPatterns).toHaveBeenCalledWith(
        mockBinLocation.binId,
        mockBinLocation.stockroomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`bin-location:${mockBinLocation.binId}`);
    });

    it('should publish BIN_LOCATION_UPDATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBinLocation);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBinLocation(mockBinLocation.binId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('BIN_LOCATION_UPDATED', {
        binId: deactivatedBinLocation.binId,
        stockroomId: deactivatedBinLocation.stockroomId,
        changes: [{ field: 'isActive', oldValue: true, newValue: false }],
        updatedBy: userId,
      });
    });
  });



  // ============================================================================
  // deleteBinLocation Tests (Requirement 6.5)
  // ============================================================================

  describe('deleteBinLocation', () => {
    it('should delete bin location successfully when no dependencies', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.getBinLocationDependencies.mockResolvedValue({
        inventoryCount: 0,
      });
      mockRepository.deleteBinLocation.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteBinLocation(mockBinLocation.binId);

      expect(result).toBe(true);
      expect(mockRepository.deleteBinLocation).toHaveBeenCalledWith(mockBinLocation.binId);
    });

    it('should throw BinLocationNotFoundError when bin location does not exist', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      await expect(deleteBinLocation('nonexistent-id')).rejects.toThrow(BinLocationNotFoundError);
      expect(mockRepository.getBinLocationDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteBinLocation).not.toHaveBeenCalled();
    });

    it('should throw BinLocationHasDependenciesError when has inventory (Requirement 6.5)', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.getBinLocationDependencies.mockResolvedValue({
        inventoryCount: 5,
      });

      await expect(deleteBinLocation(mockBinLocation.binId)).rejects.toThrow(
        BinLocationHasDependenciesError
      );
      await expect(deleteBinLocation(mockBinLocation.binId)).rejects.toThrow(
        /has 5 inventory item\(s\)/
      );
      expect(mockRepository.deleteBinLocation).not.toHaveBeenCalled();
    });

    it('should include inventory count in BinLocationHasDependenciesError', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.getBinLocationDependencies.mockResolvedValue({
        inventoryCount: 10,
      });

      const error = await deleteBinLocation(mockBinLocation.binId).catch((e) => e);

      expect(error).toBeInstanceOf(BinLocationHasDependenciesError);
      expect(error.inventoryCount).toBe(10);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.getBinLocationDependencies.mockResolvedValue({
        inventoryCount: 0,
      });
      mockRepository.deleteBinLocation.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteBinLocation(mockBinLocation.binId);

      expect(mockCache.binLocationInvalidationPatterns).toHaveBeenCalledWith(
        mockBinLocation.binId,
        mockBinLocation.stockroomId
      );
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.getBinLocationDependencies.mockResolvedValue({
        inventoryCount: 0,
      });
      mockRepository.deleteBinLocation.mockResolvedValue(false);

      const result = await deleteBinLocation(mockBinLocation.binId);

      expect(result).toBe(false);
      expect(mockCache.binLocationInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('BinLocationNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new BinLocationNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('BinLocationNotFoundError');
        expect(error.message).toBe('Bin location not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('BinCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new BinCodeExistsError(
          '222e4567-e89b-12d3-a456-426614174000',
          'BIN-A01'
        );

        expect(error.name).toBe('BinCodeExistsError');
        expect(error.message).toBe(
          'Bin code "BIN-A01" already exists in stockroom 222e4567-e89b-12d3-a456-426614174000'
        );
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('BinLocationHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new BinLocationHasDependenciesError(
          '111e4567-e89b-12d3-a456-426614174000',
          5
        );

        expect(error.name).toBe('BinLocationHasDependenciesError');
        expect(error.message).toContain('has 5 inventory item(s)');
        expect(error.inventoryCount).toBe(5);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('StockroomNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new StockroomNotFoundError('222e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('StockroomNotFoundError');
        expect(error.message).toBe('Stockroom not found: 222e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
