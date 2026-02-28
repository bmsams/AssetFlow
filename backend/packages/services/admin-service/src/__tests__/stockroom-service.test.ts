/**
 * Stockroom Service Unit Tests (admin-service)
 *
 * Tests for the admin Stockroom Service business logic layer.
 * Requirements:
 * - Requirement 5.1: Create stockroom
 * - Requirement 5.2: Get stockroom by ID (with caching)
 * - Requirement 5.3: Update stockroom fields
 * - Requirement 5.4: Deactivate stockroom (soft delete)
 * - Requirement 5.5: Reject deactivation when dependencies exist
 * - Requirement 5.6: List stockrooms with filters and pagination
 */

jest.mock('../stockroom/stockroom-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  CACHE_ENTITY_TYPES: { STOCKROOM: 'stockroom' },
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
}));

import type { Stockroom, CreateStockroomRequest, UpdateStockroomRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../stockroom/stockroom-repository';
import {
  createStockroom,
  getStockroom,
  updateStockroom,
  deactivateStockroom,
  listStockrooms,
  getActiveStockrooms,
  StockroomNotFoundError,
  StockroomHasDependenciesError,
} from '../stockroom/stockroom-service';

const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockStockroom: Stockroom = {
  stockroomId: '111e4567-e89b-12d3-a456-426614174000',
  name: 'Main Stockroom',
  location: 'Building A, Floor 1',
  stockroomType: 'STANDARD',
  managerId: '999e4567-e89b-12d3-a456-426614174999',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateStockroomRequest = {
  name: 'Main Stockroom',
  stockroomType: 'STANDARD',
  location: 'Building A, Floor 1',
  managerId: '999e4567-e89b-12d3-a456-426614174999',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'STOCKROOM_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Stockroom Service (admin-service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.entityKey.mockImplementation((type: string, id: string) => `${type}:${id}`);
  });

  // ==========================================================================
  // createStockroom
  // ==========================================================================

  describe('createStockroom', () => {
    it('should create a stockroom and publish event', async () => {
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createStockroom(validCreateRequest);

      expect(result).toEqual(mockStockroom);
      expect(mockRepository.createStockroom).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should pass userId to repository', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest, userId);

      expect(mockRepository.createStockroom).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should invalidate active stockrooms cache', async () => {
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('stockrooms:active');
    });

    it('should publish STOCKROOM_CREATED event', async () => {
      const userId = 'user-123';
      mockRepository.createStockroom.mockResolvedValue(mockStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createStockroom(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_CREATED', {
        stockroomId: mockStockroom.stockroomId,
        stockroomCode: '',
        name: mockStockroom.name,
        stockroomType: 'STANDARD',
        createdBy: userId,
      });
    });
  });

  // ==========================================================================
  // getStockroom
  // ==========================================================================

  describe('getStockroom', () => {
    it('should return stockroom from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockStockroom);

      const result = await getStockroom(mockStockroom.stockroomId);

      expect(result).toEqual(mockStockroom);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { ttl: 300 }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);

      const result = await getStockroom(mockStockroom.stockroomId);

      expect(result).toEqual(mockStockroom);
      expect(mockRepository.getStockroomById).toHaveBeenCalledWith(mockStockroom.stockroomId);
    });

    it('should return null for non-existent stockroom', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getStockroomById.mockResolvedValue(null);

      const result = await getStockroom('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // updateStockroom
  // ==========================================================================

  describe('updateStockroom', () => {
    const updateRequest: UpdateStockroomRequest = {
      name: 'Updated Stockroom',
      location: 'Building B',
    };

    const updatedStockroom: Stockroom = {
      ...mockStockroom,
      name: 'Updated Stockroom',
      location: 'Building B',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update stockroom successfully', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateStockroom(mockStockroom.stockroomId, updateRequest);

      expect(result).toEqual(updatedStockroom);
      expect(mockRepository.updateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        updateRequest,
        undefined
      );
    });

    it('should pass userId to repository', async () => {
      const userId = 'user-456';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest, userId);

      expect(mockRepository.updateStockroom).toHaveBeenCalledWith(
        mockStockroom.stockroomId,
        updateRequest,
        userId
      );
    });

    it('should throw StockroomNotFoundError when stockroom does not exist', async () => {
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

    it('should invalidate both entity and active caches', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest);

      expect(mockCache.del).toHaveBeenCalledWith(
        `stockroom:${mockStockroom.stockroomId}`
      );
      expect(mockCache.del).toHaveBeenCalledWith('stockrooms:active');
    });

    it('should publish STOCKROOM_UPDATED event', async () => {
      const userId = 'user-789';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.updateStockroom.mockResolvedValue(updatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateStockroom(mockStockroom.stockroomId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_UPDATED', {
        stockroomId: updatedStockroom.stockroomId,
        stockroomCode: '',
        changes: [
          { field: 'name', oldValue: mockStockroom.name, newValue: updateRequest.name },
          { field: 'location', oldValue: mockStockroom.location, newValue: updateRequest.location },
        ],
        updatedBy: userId,
      });
    });
  });

  // ==========================================================================
  // deactivateStockroom
  // ==========================================================================

  describe('deactivateStockroom', () => {
    const deactivatedStockroom: Stockroom = {
      ...mockStockroom,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate stockroom when no dependencies', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateStockroom(mockStockroom.stockroomId);

      expect(result.isActive).toBe(false);
    });

    it('should throw StockroomNotFoundError when stockroom does not exist', async () => {
      mockRepository.getStockroomById.mockResolvedValue(null);

      await expect(deactivateStockroom('nonexistent-id')).rejects.toThrow(
        StockroomNotFoundError
      );
      expect(mockRepository.getStockroomDependencies).not.toHaveBeenCalled();
    });

    it('should throw StockroomHasDependenciesError when has assets', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 5,
        inventoryCount: 0,
      });

      await expect(
        deactivateStockroom(mockStockroom.stockroomId)
      ).rejects.toThrow(StockroomHasDependenciesError);
    });

    it('should throw StockroomHasDependenciesError when has inventory', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 0,
        inventoryCount: 10,
      });

      await expect(
        deactivateStockroom(mockStockroom.stockroomId)
      ).rejects.toThrow(StockroomHasDependenciesError);
    });

    it('should include dependency counts in error', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 3,
        inventoryCount: 7,
      });

      const error = await deactivateStockroom(mockStockroom.stockroomId).catch(
        (e) => e
      );

      expect(error).toBeInstanceOf(StockroomHasDependenciesError);
      expect(error.assetCount).toBe(3);
      expect(error.inventoryCount).toBe(7);
    });

    it('should throw StockroomNotFoundError when deactivate returns null', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deactivateStockroom.mockResolvedValue(null);

      await expect(
        deactivateStockroom(mockStockroom.stockroomId)
      ).rejects.toThrow(StockroomNotFoundError);
    });

    it('should invalidate cache after deactivation', async () => {
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateStockroom(mockStockroom.stockroomId);

      expect(mockCache.del).toHaveBeenCalledWith(
        `stockroom:${mockStockroom.stockroomId}`
      );
      expect(mockCache.del).toHaveBeenCalledWith('stockrooms:active');
    });

    it('should publish STOCKROOM_DEACTIVATED event', async () => {
      const userId = 'user-deactivate';
      mockRepository.getStockroomById.mockResolvedValue(mockStockroom);
      mockRepository.getStockroomDependencies.mockResolvedValue({
        assetCount: 0,
        inventoryCount: 0,
      });
      mockRepository.deactivateStockroom.mockResolvedValue(deactivatedStockroom);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateStockroom(mockStockroom.stockroomId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('STOCKROOM_DEACTIVATED', {
        stockroomId: deactivatedStockroom.stockroomId,
        stockroomCode: '',
        deactivatedBy: userId,
      });
    });
  });

  // ==========================================================================
  // listStockrooms
  // ==========================================================================

  describe('listStockrooms', () => {
    const paginatedResult = {
      items: [mockStockroom],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('should return paginated results', async () => {
      mockRepository.listStockrooms.mockResolvedValue(paginatedResult);

      const result = await listStockrooms({}, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should set hasMore correctly when more pages exist', async () => {
      mockRepository.listStockrooms.mockResolvedValue({
        ...paginatedResult,
        total: 50,
      });

      const result = await listStockrooms({}, { page: 1, limit: 20 });

      expect(result.hasMore).toBe(true);
    });

    it('should default page to 1 and limit to 20', async () => {
      mockRepository.listStockrooms.mockResolvedValue(paginatedResult);

      await listStockrooms({}, {});

      expect(mockRepository.listStockrooms).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20 }
      );
    });

    it('should pass filters to repository', async () => {
      const filters = { stockroomType: 'REPAIR' as const, isActive: true };
      mockRepository.listStockrooms.mockResolvedValue(paginatedResult);

      await listStockrooms(filters, { page: 1, limit: 10 });

      expect(mockRepository.listStockrooms).toHaveBeenCalledWith(
        filters,
        { page: 1, limit: 10 }
      );
    });
  });

  // ==========================================================================
  // getActiveStockrooms
  // ==========================================================================

  describe('getActiveStockrooms', () => {
    it('should return active stockrooms from cache', async () => {
      mockCache.getOrSet.mockResolvedValue([mockStockroom]);

      const result = await getActiveStockrooms();

      expect(result).toEqual([mockStockroom]);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'stockrooms:active',
        expect.any(Function),
        { ttl: 300 }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getActiveStockrooms.mockResolvedValue([mockStockroom]);

      const result = await getActiveStockrooms();

      expect(result).toEqual([mockStockroom]);
      expect(mockRepository.getActiveStockrooms).toHaveBeenCalled();
    });

    it('should return empty array when no active stockrooms', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveStockrooms();

      expect(result).toEqual([]);
    });
  });
});
