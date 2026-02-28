/**
 * Manufacturer Service Unit Tests
 *
 * Tests for the Manufacturer Service business logic layer.
 * Requirements:
 * - Requirement 10.1: Create manufacturer with name and optional website
 * - Requirement 10.2: Return manufacturer details including associated model count
 * - Requirement 10.3: Update manufacturer details
 * - Requirement 10.4: Return paginated list with optional search filter
 * - Requirement 10.5: Reject deletion if has associated models
 */

// Mock the dependencies before importing service
jest.mock('../reference-data/manufacturer-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    MANUFACTURER: 'manufacturer',
  },
  listKey: jest.fn(),
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

import type { CreateManufacturerRequest, UpdateManufacturerRequest, ManufacturerDetails } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../reference-data/manufacturer-repository';
import {
  createManufacturer,
  getManufacturerById,
  getManufacturerOrThrow,
  getManufacturerByCode,
  updateManufacturer,
  deactivateManufacturer,
  deleteManufacturer,
  listManufacturers,
  searchManufacturers,
  getAllManufacturers,
  getActiveManufacturers,
  getManufacturersWithModels,
  isManufacturerNameUnique,
  reactivateManufacturer,
  getManufacturerSummary,
  ManufacturerNotFoundError,
  ManufacturerNameExistsError,
  ManufacturerHasDependenciesError,
} from '../reference-data/manufacturer-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockManufacturer: ManufacturerDetails = {
  manufacturerId: '111e4567-e89b-12d3-a456-426614174000',
  name: 'Dell Technologies',
  website: 'https://www.dell.com',
  modelCount: 5,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockManufacturerNoWebsite: ManufacturerDetails = {
  manufacturerId: '222e4567-e89b-12d3-a456-426614174000',
  name: 'HP Inc',
  website: null,
  modelCount: 3,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockInactiveManufacturer: ManufacturerDetails = {
  ...mockManufacturer,
  manufacturerId: '333e4567-e89b-12d3-a456-426614174000',
  name: 'Inactive Manufacturer',
  isActive: false,
};


const validCreateRequest: CreateManufacturerRequest = {
  name: 'Dell Technologies',
  website: 'https://www.dell.com',
};

const validCreateRequestNoWebsite: CreateManufacturerRequest = {
  name: 'HP Inc',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'MANUFACTURER_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Manufacturer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });

  // ============================================================================
  // createManufacturer Tests (Requirement 10.1)
  // ============================================================================

  describe('createManufacturer', () => {
    it('should create manufacturer and publish event (Requirement 10.1)', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.createManufacturer.mockResolvedValue(mockManufacturer);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createManufacturer(validCreateRequest);

      expect(result).toEqual(mockManufacturer);
      expect(mockRepository.manufacturerNameExists).toHaveBeenCalledWith('Dell Technologies');
      expect(mockRepository.createManufacturer).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create manufacturer with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.createManufacturer.mockResolvedValue(mockManufacturer);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createManufacturer(validCreateRequest, userId);

      expect(mockRepository.createManufacturer).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw ManufacturerNameExistsError for duplicate name', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(true);

      await expect(createManufacturer(validCreateRequest)).rejects.toThrow(ManufacturerNameExistsError);
      await expect(createManufacturer(validCreateRequest)).rejects.toThrow(
        "Manufacturer name 'Dell Technologies' already exists"
      );
      expect(mockRepository.createManufacturer).not.toHaveBeenCalled();
    });

    it('should create manufacturer without website', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.createManufacturer.mockResolvedValue(mockManufacturerNoWebsite);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createManufacturer(validCreateRequestNoWebsite);

      expect(result.website).toBeNull();
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.createManufacturer.mockResolvedValue(mockManufacturer);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createManufacturer(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('manufacturer:list');
    });

    it('should publish MANUFACTURER_CREATED event after creation', async () => {
      const userId = 'user-123';
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.createManufacturer.mockResolvedValue(mockManufacturer);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createManufacturer(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MANUFACTURER_CREATED', {
        manufacturerId: mockManufacturer.manufacturerId,
        name: mockManufacturer.name,
        createdBy: userId,
      });
    });
  });


  // ============================================================================
  // getManufacturerById Tests (Requirement 10.2)
  // ============================================================================

  describe('getManufacturerById', () => {
    it('should return manufacturer from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockManufacturer);

      const result = await getManufacturerById(mockManufacturer.manufacturerId);

      expect(result).toEqual(mockManufacturer);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `manufacturer:${mockManufacturer.manufacturerId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);

      const result = await getManufacturerById(mockManufacturer.manufacturerId);

      expect(result).toEqual(mockManufacturer);
      expect(mockRepository.getManufacturerById).toHaveBeenCalledWith(mockManufacturer.manufacturerId);
    });

    it('should return null for non-existent manufacturer', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getManufacturerById.mockResolvedValue(null);

      const result = await getManufacturerById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getManufacturerOrThrow Tests
  // ============================================================================

  describe('getManufacturerOrThrow', () => {
    it('should return manufacturer when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockManufacturer);

      const result = await getManufacturerOrThrow(mockManufacturer.manufacturerId);

      expect(result).toEqual(mockManufacturer);
    });

    it('should throw ManufacturerNotFoundError when manufacturer not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getManufacturerOrThrow('nonexistent-id')).rejects.toThrow(ManufacturerNotFoundError);
      await expect(getManufacturerOrThrow('nonexistent-id')).rejects.toThrow(
        'Manufacturer not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getManufacturerByCode Tests
  // ============================================================================

  describe('getManufacturerByCode', () => {
    it('should return manufacturer by code from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(mockManufacturer);

      const result = await getManufacturerByCode('DELL');

      expect(result).toEqual(mockManufacturer);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'manufacturer:code:DELL',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getManufacturerByCode.mockResolvedValue(mockManufacturer);

      const result = await getManufacturerByCode('DELL');

      expect(result).toEqual(mockManufacturer);
      expect(mockRepository.getManufacturerByCode).toHaveBeenCalledWith('DELL');
    });

    it('should return null for non-existent code', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getManufacturerByCode.mockResolvedValue(null);

      const result = await getManufacturerByCode('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // updateManufacturer Tests (Requirement 10.3)
  // ============================================================================

  describe('updateManufacturer', () => {
    const updateRequest: UpdateManufacturerRequest = {
      name: 'Dell Inc',
      website: 'https://www.dell.com/updated',
    };

    const updatedManufacturer: ManufacturerDetails = {
      ...mockManufacturer,
      name: 'Dell Inc',
      website: 'https://www.dell.com/updated',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update manufacturer and invalidate cache (Requirement 10.3)', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.updateManufacturer.mockResolvedValue(updatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateManufacturer(mockManufacturer.manufacturerId, updateRequest);

      expect(result).toEqual(updatedManufacturer);
      expect(mockRepository.getManufacturerById).toHaveBeenCalledWith(mockManufacturer.manufacturerId);
      expect(mockRepository.updateManufacturer).toHaveBeenCalledWith(
        mockManufacturer.manufacturerId,
        updateRequest,
        undefined
      );
    });

    it('should update manufacturer with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.updateManufacturer.mockResolvedValue(updatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateManufacturer(mockManufacturer.manufacturerId, updateRequest, userId);

      expect(mockRepository.updateManufacturer).toHaveBeenCalledWith(
        mockManufacturer.manufacturerId,
        updateRequest,
        userId
      );
    });

    it('should throw ManufacturerNotFoundError for non-existent manufacturer', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(null);

      await expect(updateManufacturer('nonexistent-id', updateRequest)).rejects.toThrow(ManufacturerNotFoundError);
      expect(mockRepository.updateManufacturer).not.toHaveBeenCalled();
    });

    it('should throw ManufacturerNotFoundError when update returns null', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.updateManufacturer.mockResolvedValue(null);

      await expect(updateManufacturer(mockManufacturer.manufacturerId, updateRequest)).rejects.toThrow(ManufacturerNotFoundError);
    });

    it('should throw ManufacturerNameExistsError when new name already exists', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(true);

      await expect(updateManufacturer(mockManufacturer.manufacturerId, { name: 'HP Inc' })).rejects.toThrow(ManufacturerNameExistsError);
      expect(mockRepository.updateManufacturer).not.toHaveBeenCalled();
    });

    it('should publish MANUFACTURER_UPDATED event with changes', async () => {
      const userId = 'user-123';
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.updateManufacturer.mockResolvedValue(updatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateManufacturer(mockManufacturer.manufacturerId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MANUFACTURER_UPDATED', expect.objectContaining({
        manufacturerId: updatedManufacturer.manufacturerId,
        name: updatedManufacturer.name,
        updatedBy: userId,
      }));
    });

    it('should not publish event when no changes', async () => {
      const noChangeRequest: UpdateManufacturerRequest = {};
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.updateManufacturer.mockResolvedValue(mockManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await updateManufacturer(mockManufacturer.manufacturerId, noChangeRequest);

      expect(mockPublishEvent).not.toHaveBeenCalled();
    });

    it('should invalidate cache patterns after update', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.manufacturerNameExists.mockResolvedValue(false);
      mockRepository.updateManufacturer.mockResolvedValue(updatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateManufacturer(mockManufacturer.manufacturerId, updateRequest);

      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`manufacturer:${mockManufacturer.manufacturerId}`);
    });
  });

  // ============================================================================
  // deactivateManufacturer Tests
  // ============================================================================

  describe('deactivateManufacturer', () => {
    const deactivatedManufacturer: ManufacturerDetails = {
      ...mockManufacturer,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate manufacturer successfully', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deactivateManufacturer.mockResolvedValue(deactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateManufacturer(mockManufacturer.manufacturerId);

      expect(result).toEqual(deactivatedManufacturer);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateManufacturer).toHaveBeenCalledWith(mockManufacturer.manufacturerId, undefined);
    });

    it('should deactivate manufacturer with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deactivateManufacturer.mockResolvedValue(deactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateManufacturer(mockManufacturer.manufacturerId, userId);

      expect(mockRepository.deactivateManufacturer).toHaveBeenCalledWith(mockManufacturer.manufacturerId, userId);
    });

    it('should throw ManufacturerNotFoundError when manufacturer does not exist', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(null);

      await expect(deactivateManufacturer('nonexistent-id')).rejects.toThrow(ManufacturerNotFoundError);
      expect(mockRepository.deactivateManufacturer).not.toHaveBeenCalled();
    });

    it('should throw ManufacturerNotFoundError when deactivate returns null', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deactivateManufacturer.mockResolvedValue(null);

      await expect(deactivateManufacturer(mockManufacturer.manufacturerId)).rejects.toThrow(ManufacturerNotFoundError);
    });

    it('should still deactivate manufacturer with dependencies (warning only)', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 5, assetCount: 3 });
      mockRepository.deactivateManufacturer.mockResolvedValue(deactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateManufacturer(mockManufacturer.manufacturerId);

      expect(result.isActive).toBe(false);
    });

    it('should publish MANUFACTURER_UPDATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deactivateManufacturer.mockResolvedValue(deactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateManufacturer(mockManufacturer.manufacturerId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MANUFACTURER_UPDATED', expect.objectContaining({
        manufacturerId: deactivatedManufacturer.manufacturerId,
        name: deactivatedManufacturer.name,
        updatedBy: userId,
      }));
    });
  });


  // ============================================================================
  // deleteManufacturer Tests (Requirement 10.5)
  // ============================================================================

  describe('deleteManufacturer', () => {
    it('should delete manufacturer when no dependencies', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deleteManufacturer.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteManufacturer(mockManufacturer.manufacturerId);

      expect(result).toBe(true);
      expect(mockRepository.deleteManufacturer).toHaveBeenCalledWith(mockManufacturer.manufacturerId);
    });

    it('should throw ManufacturerNotFoundError when manufacturer does not exist', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(null);

      await expect(deleteManufacturer('nonexistent-id')).rejects.toThrow(ManufacturerNotFoundError);
      expect(mockRepository.getManufacturerDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteManufacturer).not.toHaveBeenCalled();
    });

    it('should throw ManufacturerHasDependenciesError when has models (Requirement 10.5)', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 5, assetCount: 0 });

      await expect(deleteManufacturer(mockManufacturer.manufacturerId)).rejects.toThrow(ManufacturerHasDependenciesError);
      await expect(deleteManufacturer(mockManufacturer.manufacturerId)).rejects.toThrow(/has 5 model\(s\) and 0 asset\(s\)/);
      expect(mockRepository.deleteManufacturer).not.toHaveBeenCalled();
    });

    it('should throw ManufacturerHasDependenciesError when has assets', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 10 });

      await expect(deleteManufacturer(mockManufacturer.manufacturerId)).rejects.toThrow(ManufacturerHasDependenciesError);
      await expect(deleteManufacturer(mockManufacturer.manufacturerId)).rejects.toThrow(/has 0 model\(s\) and 10 asset\(s\)/);
      expect(mockRepository.deleteManufacturer).not.toHaveBeenCalled();
    });

    it('should throw ManufacturerHasDependenciesError when has both models and assets', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 3, assetCount: 7 });

      const error = await deleteManufacturer(mockManufacturer.manufacturerId).catch((e) => e);

      expect(error).toBeInstanceOf(ManufacturerHasDependenciesError);
      expect(error.modelCount).toBe(3);
      expect(error.assetCount).toBe(7);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deleteManufacturer.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteManufacturer(mockManufacturer.manufacturerId);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });
      mockRepository.deleteManufacturer.mockResolvedValue(false);

      const result = await deleteManufacturer(mockManufacturer.manufacturerId);

      expect(result).toBe(false);
      expect(mockCache.delPattern).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // listManufacturers Tests (Requirement 10.4)
  // ============================================================================

  describe('listManufacturers', () => {
    const paginatedResult = {
      items: [mockManufacturer, mockManufacturerNoWebsite],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated results (Requirement 10.4)', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await listManufacturers();

      expect(result).toEqual(paginatedResult);
      expect(result.items).toHaveLength(2);
    });

    it('should use cache for default pagination without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      await listManufacturers({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'manufacturer:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listManufacturers.mockResolvedValue(paginatedResult);

      await listManufacturers({ isActive: true });

      expect(mockRepository.listManufacturers).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should bypass cache for non-default pagination', async () => {
      mockRepository.listManufacturers.mockResolvedValue({ ...paginatedResult, page: 2 });

      await listManufacturers({}, { page: 2, limit: 20 });

      expect(mockRepository.listManufacturers).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const filters = { isActive: true, search: 'Dell' };
      mockRepository.listManufacturers.mockResolvedValue(paginatedResult);

      await listManufacturers(filters);

      expect(mockRepository.listManufacturers).toHaveBeenCalledWith(filters, {});
    });
  });

  // ============================================================================
  // searchManufacturers Tests (Requirement 10.4)
  // ============================================================================

  describe('searchManufacturers', () => {
    const searchResults: ManufacturerDetails[] = [mockManufacturer, mockManufacturerNoWebsite];

    it('should return matching manufacturers (Requirement 10.4)', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      const result = await searchManufacturers('Dell');

      expect(result).toEqual(searchResults);
      expect(result).toHaveLength(2);
    });

    it('should use cache for search results', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      await searchManufacturers('Dell');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'search:manufacturer:dell',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.searchManufacturers.mockResolvedValue(searchResults);

      const result = await searchManufacturers('Dell');

      expect(result).toEqual(searchResults);
      expect(mockRepository.searchManufacturers).toHaveBeenCalledWith('Dell');
    });

    it('should return empty array when no matches', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await searchManufacturers('NonExistent');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // getAllManufacturers Tests
  // ============================================================================

  describe('getAllManufacturers', () => {
    const allManufacturers: ManufacturerDetails[] = [mockManufacturer, mockManufacturerNoWebsite, mockInactiveManufacturer];

    it('should return all manufacturers from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(allManufacturers);

      const result = await getAllManufacturers();

      expect(result).toEqual(allManufacturers);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'manufacturer:all',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getAllManufacturers.mockResolvedValue(allManufacturers);

      const result = await getAllManufacturers();

      expect(result).toEqual(allManufacturers);
      expect(mockRepository.getAllManufacturers).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getActiveManufacturers Tests
  // ============================================================================

  describe('getActiveManufacturers', () => {
    const activeManufacturers: ManufacturerDetails[] = [mockManufacturer, mockManufacturerNoWebsite];

    it('should return active manufacturers from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(activeManufacturers);

      const result = await getActiveManufacturers();

      expect(result).toEqual(activeManufacturers);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'manufacturer:active',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getActiveManufacturers.mockResolvedValue(activeManufacturers);

      const result = await getActiveManufacturers();

      expect(result).toEqual(activeManufacturers);
      expect(mockRepository.getActiveManufacturers).toHaveBeenCalled();
    });
  });


  // ============================================================================
  // getManufacturersWithModels Tests
  // ============================================================================

  describe('getManufacturersWithModels', () => {
    const manufacturersWithModels: ManufacturerDetails[] = [mockManufacturer];

    it('should return manufacturers with models from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(manufacturersWithModels);

      const result = await getManufacturersWithModels();

      expect(result).toEqual(manufacturersWithModels);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'manufacturer:with-models',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getManufacturersWithModels.mockResolvedValue(manufacturersWithModels);

      const result = await getManufacturersWithModels();

      expect(result).toEqual(manufacturersWithModels);
      expect(mockRepository.getManufacturersWithModels).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // isManufacturerNameUnique Tests
  // ============================================================================

  describe('isManufacturerNameUnique', () => {
    it('should return true when name does not exist', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(false);

      const result = await isManufacturerNameUnique('New Manufacturer');

      expect(result).toBe(true);
      expect(mockRepository.manufacturerNameExists).toHaveBeenCalledWith('New Manufacturer', undefined);
    });

    it('should return false when name exists', async () => {
      mockRepository.manufacturerNameExists.mockResolvedValue(true);

      const result = await isManufacturerNameUnique('Dell Technologies');

      expect(result).toBe(false);
    });

    it('should exclude specified ID when checking uniqueness', async () => {
      const excludeId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.manufacturerNameExists.mockResolvedValue(false);

      await isManufacturerNameUnique('Dell Technologies', excludeId);

      expect(mockRepository.manufacturerNameExists).toHaveBeenCalledWith('Dell Technologies', excludeId);
    });
  });


  // ============================================================================
  // reactivateManufacturer Tests
  // ============================================================================

  describe('reactivateManufacturer', () => {
    const reactivatedManufacturer: ManufacturerDetails = {
      ...mockInactiveManufacturer,
      isActive: true,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should reactivate manufacturer successfully', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(mockInactiveManufacturer);
      mockRepository.updateManufacturer.mockResolvedValue(reactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reactivateManufacturer(mockInactiveManufacturer.manufacturerId);

      expect(result.isActive).toBe(true);
      expect(mockRepository.updateManufacturer).toHaveBeenCalledWith(
        mockInactiveManufacturer.manufacturerId,
        { isActive: true },
        undefined
      );
    });

    it('should reactivate manufacturer with userId', async () => {
      const userId = 'user-123';
      mockRepository.getManufacturerById.mockResolvedValue(mockInactiveManufacturer);
      mockRepository.updateManufacturer.mockResolvedValue(reactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateManufacturer(mockInactiveManufacturer.manufacturerId, userId);

      expect(mockRepository.updateManufacturer).toHaveBeenCalledWith(
        mockInactiveManufacturer.manufacturerId,
        { isActive: true },
        userId
      );
    });

    it('should throw ManufacturerNotFoundError when manufacturer does not exist', async () => {
      mockRepository.getManufacturerById.mockResolvedValue(null);

      await expect(reactivateManufacturer('nonexistent-id')).rejects.toThrow(ManufacturerNotFoundError);
    });

    it('should publish MANUFACTURER_UPDATED event after reactivation', async () => {
      const userId = 'user-123';
      mockRepository.getManufacturerById.mockResolvedValue(mockInactiveManufacturer);
      mockRepository.updateManufacturer.mockResolvedValue(reactivatedManufacturer);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateManufacturer(mockInactiveManufacturer.manufacturerId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('MANUFACTURER_UPDATED', expect.objectContaining({
        manufacturerId: reactivatedManufacturer.manufacturerId,
        changes: [{ field: 'isActive', oldValue: false, newValue: true }],
        updatedBy: userId,
      }));
    });
  });


  // ============================================================================
  // getManufacturerSummary Tests
  // ============================================================================

  describe('getManufacturerSummary', () => {
    it('should return manufacturer summary with dependency counts', async () => {
      mockCache.getOrSet.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 5, assetCount: 10 });

      const result = await getManufacturerSummary(mockManufacturer.manufacturerId);

      expect(result).toEqual({
        manufacturer: mockManufacturer,
        modelCount: 5,
        assetCount: 10,
        canDelete: false,
      });
    });

    it('should return canDelete true when no dependencies', async () => {
      mockCache.getOrSet.mockResolvedValue(mockManufacturer);
      mockRepository.getManufacturerDependencies.mockResolvedValue({ modelCount: 0, assetCount: 0 });

      const result = await getManufacturerSummary(mockManufacturer.manufacturerId);

      expect(result?.canDelete).toBe(true);
    });

    it('should return null when manufacturer not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      const result = await getManufacturerSummary('nonexistent-id');

      expect(result).toBeNull();
      expect(mockRepository.getManufacturerDependencies).not.toHaveBeenCalled();
    });
  });
});
