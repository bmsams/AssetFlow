/**
 * Building Service Unit Tests
 *
 * Tests for the Building Service business logic layer.
 * Requirements:
 * - Requirement 1.1: Create building with name, address, and contact information
 * - Requirement 1.2: Return complete building details including floors count
 * - Requirement 1.3: Update specified fields and preserve unchanged fields
 * - Requirement 1.4: Mark building as inactive and prevent new asset assignments
 * - Requirement 1.5: Return paginated list of buildings matching filter criteria
 * - Requirement 1.6: Reject deletion if building has active assets or floors
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

import type { Building, CreateBuildingRequest, UpdateBuildingRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../location/location-repository';
import {
  createBuilding,
  getBuilding,
  getBuildingOrThrow,
  getBuildingByCode,
  updateBuilding,
  deactivateBuilding,
  deleteBuilding,
  listBuildings,
  getActiveBuildings,
  isBuildingCodeUnique,
  BuildingCodeExistsError,
  BuildingNotFoundError,
  BuildingHasDependenciesError,
} from '../location/building-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockBuilding: Building = {
  buildingId: '123e4567-e89b-12d3-a456-426614174000',
  buildingCode: 'BLDG-001',
  name: 'Main Office Building',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'Seattle',
  stateProvince: 'WA',
  postalCode: '98101',
  country: 'USA',
  contactName: 'John Doe',
  contactEmail: 'john.doe@example.com',
  contactPhone: '555-123-4567',
  totalFloors: 5,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateBuildingRequest = {
  buildingCode: 'BLDG-001',
  name: 'Main Office Building',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'Seattle',
  stateProvince: 'WA',
  postalCode: '98101',
  country: 'USA',
  contactName: 'John Doe',
  contactEmail: 'john.doe@example.com',
  contactPhone: '555-123-4567',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'BUILDING_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Building Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.buildingKey.mockImplementation((id: string) => `building:${id}`);
    mockCache.buildingListKey.mockImplementation((params?: Record<string, unknown>) => 
      params ? `building:list:${JSON.stringify(params)}` : 'building:list'
    );
    mockCache.buildingInvalidationPatterns.mockReturnValue([
      'building:123e4567-e89b-12d3-a456-426614174000*',
      'building:list*',
    ]);
  });


  // ============================================================================
  // createBuilding Tests (Requirement 1.1)
  // ============================================================================

  describe('createBuilding', () => {
    it('should create a building successfully', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(false);
      mockRepository.createBuilding.mockResolvedValue(mockBuilding);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createBuilding(validCreateRequest);

      expect(result).toEqual(mockBuilding);
      expect(mockRepository.buildingCodeExists).toHaveBeenCalledWith('BLDG-001');
      expect(mockRepository.createBuilding).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create a building with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.buildingCodeExists.mockResolvedValue(false);
      mockRepository.createBuilding.mockResolvedValue(mockBuilding);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBuilding(validCreateRequest, userId);

      expect(mockRepository.createBuilding).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw BuildingCodeExistsError when code already exists', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(true);

      await expect(createBuilding(validCreateRequest)).rejects.toThrow(BuildingCodeExistsError);
      await expect(createBuilding(validCreateRequest)).rejects.toThrow(
        "Building code 'BLDG-001' already exists"
      );
      expect(mockRepository.createBuilding).not.toHaveBeenCalled();
    });

    it('should invalidate building list cache after creation', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(false);
      mockRepository.createBuilding.mockResolvedValue(mockBuilding);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBuilding(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('building:list');
    });

    it('should publish BUILDING_CREATED event after creation', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(false);
      mockRepository.createBuilding.mockResolvedValue(mockBuilding);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createBuilding(validCreateRequest, 'user-123');

      expect(mockPublishEvent).toHaveBeenCalledWith('BUILDING_CREATED', {
        buildingId: mockBuilding.buildingId,
        buildingCode: mockBuilding.buildingCode,
        name: mockBuilding.name,
        createdBy: 'user-123',
      });
    });
  });


  // ============================================================================
  // getBuilding Tests (Requirement 1.2)
  // ============================================================================

  describe('getBuilding', () => {
    it('should return building from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockBuilding);

      const result = await getBuilding(mockBuilding.buildingId);

      expect(result).toEqual(mockBuilding);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `building:${mockBuilding.buildingId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when not in cache', async () => {
      // Simulate cache miss by calling the fetch function
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);

      const result = await getBuilding(mockBuilding.buildingId);

      expect(result).toEqual(mockBuilding);
      expect(mockRepository.getBuildingById).toHaveBeenCalledWith(mockBuilding.buildingId);
    });

    it('should return null when building not found', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getBuildingById.mockResolvedValue(null);

      const result = await getBuilding('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getBuildingOrThrow Tests
  // ============================================================================

  describe('getBuildingOrThrow', () => {
    it('should return building when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockBuilding);

      const result = await getBuildingOrThrow(mockBuilding.buildingId);

      expect(result).toEqual(mockBuilding);
    });

    it('should throw BuildingNotFoundError when building not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getBuildingOrThrow('nonexistent-id')).rejects.toThrow(BuildingNotFoundError);
      await expect(getBuildingOrThrow('nonexistent-id')).rejects.toThrow(
        'Building not found: nonexistent-id'
      );
    });
  });

  // ============================================================================
  // getBuildingByCode Tests
  // ============================================================================

  describe('getBuildingByCode', () => {
    it('should return building by code', async () => {
      mockRepository.getBuildingByCode.mockResolvedValue(mockBuilding);

      const result = await getBuildingByCode('BLDG-001');

      expect(result).toEqual(mockBuilding);
      expect(mockRepository.getBuildingByCode).toHaveBeenCalledWith('BLDG-001');
    });

    it('should return null when building code not found', async () => {
      mockRepository.getBuildingByCode.mockResolvedValue(null);

      const result = await getBuildingByCode('NONEXISTENT');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // updateBuilding Tests (Requirement 1.3)
  // ============================================================================

  describe('updateBuilding', () => {
    const updateRequest: UpdateBuildingRequest = {
      name: 'Updated Building Name',
      city: 'Portland',
    };

    const updatedBuilding: Building = {
      ...mockBuilding,
      name: 'Updated Building Name',
      city: 'Portland',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update building successfully', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.updateBuilding.mockResolvedValue(updatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateBuilding(mockBuilding.buildingId, updateRequest);

      expect(result).toEqual(updatedBuilding);
      expect(mockRepository.getBuildingById).toHaveBeenCalledWith(mockBuilding.buildingId);
      expect(mockRepository.updateBuilding).toHaveBeenCalledWith(
        mockBuilding.buildingId,
        updateRequest,
        undefined
      );
    });

    it('should update building with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.updateBuilding.mockResolvedValue(updatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBuilding(mockBuilding.buildingId, updateRequest, userId);

      expect(mockRepository.updateBuilding).toHaveBeenCalledWith(
        mockBuilding.buildingId,
        updateRequest,
        userId
      );
    });

    it('should throw BuildingNotFoundError when building does not exist', async () => {
      mockRepository.getBuildingById.mockResolvedValue(null);

      await expect(
        updateBuilding('nonexistent-id', updateRequest)
      ).rejects.toThrow(BuildingNotFoundError);
      expect(mockRepository.updateBuilding).not.toHaveBeenCalled();
    });

    it('should throw BuildingNotFoundError when update returns null', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.updateBuilding.mockResolvedValue(null);

      await expect(
        updateBuilding(mockBuilding.buildingId, updateRequest)
      ).rejects.toThrow(BuildingNotFoundError);
    });

    it('should invalidate building cache after update', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.updateBuilding.mockResolvedValue(updatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBuilding(mockBuilding.buildingId, updateRequest);

      expect(mockCache.buildingInvalidationPatterns).toHaveBeenCalledWith(mockBuilding.buildingId);
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`building:${mockBuilding.buildingId}`);
      expect(mockCache.del).toHaveBeenCalledWith('building:list');
    });

    it('should publish BUILDING_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.updateBuilding.mockResolvedValue(updatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateBuilding(mockBuilding.buildingId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('BUILDING_UPDATED', {
        buildingId: updatedBuilding.buildingId,
        buildingCode: updatedBuilding.buildingCode,
        name: updatedBuilding.name,
        updatedBy: userId,
        changes: ['name', 'city'],
      });
    });
  });


  // ============================================================================
  // deactivateBuilding Tests (Requirement 1.4)
  // ============================================================================

  describe('deactivateBuilding', () => {
    const deactivatedBuilding: Building = {
      ...mockBuilding,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate building successfully', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.deactivateBuilding.mockResolvedValue(deactivatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateBuilding(mockBuilding.buildingId);

      expect(result).toEqual(deactivatedBuilding);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateBuilding).toHaveBeenCalledWith(
        mockBuilding.buildingId,
        undefined
      );
    });

    it('should deactivate building with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.deactivateBuilding.mockResolvedValue(deactivatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBuilding(mockBuilding.buildingId, userId);

      expect(mockRepository.deactivateBuilding).toHaveBeenCalledWith(
        mockBuilding.buildingId,
        userId
      );
    });

    it('should throw BuildingNotFoundError when building does not exist', async () => {
      mockRepository.getBuildingById.mockResolvedValue(null);

      await expect(deactivateBuilding('nonexistent-id')).rejects.toThrow(BuildingNotFoundError);
      expect(mockRepository.deactivateBuilding).not.toHaveBeenCalled();
    });

    it('should throw BuildingNotFoundError when deactivate returns null', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.deactivateBuilding.mockResolvedValue(null);

      await expect(deactivateBuilding(mockBuilding.buildingId)).rejects.toThrow(
        BuildingNotFoundError
      );
    });

    it('should invalidate building cache after deactivation', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.deactivateBuilding.mockResolvedValue(deactivatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBuilding(mockBuilding.buildingId);

      expect(mockCache.buildingInvalidationPatterns).toHaveBeenCalledWith(mockBuilding.buildingId);
      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`building:${mockBuilding.buildingId}`);
    });

    it('should publish BUILDING_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.deactivateBuilding.mockResolvedValue(deactivatedBuilding);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateBuilding(mockBuilding.buildingId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('BUILDING_DEACTIVATED', {
        buildingId: deactivatedBuilding.buildingId,
        buildingCode: deactivatedBuilding.buildingCode,
        name: deactivatedBuilding.name,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteBuilding Tests (Requirement 1.6)
  // ============================================================================

  describe('deleteBuilding', () => {
    it('should delete building successfully when no dependencies', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 0, assetCount: 0 });
      mockRepository.deleteBuilding.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteBuilding(mockBuilding.buildingId);

      expect(result).toBe(true);
      expect(mockRepository.deleteBuilding).toHaveBeenCalledWith(mockBuilding.buildingId);
    });

    it('should throw BuildingNotFoundError when building does not exist', async () => {
      mockRepository.getBuildingById.mockResolvedValue(null);

      await expect(deleteBuilding('nonexistent-id')).rejects.toThrow(BuildingNotFoundError);
      expect(mockRepository.getBuildingDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteBuilding).not.toHaveBeenCalled();
    });

    it('should throw BuildingHasDependenciesError when building has floors', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 3, assetCount: 0 });

      await expect(deleteBuilding(mockBuilding.buildingId)).rejects.toThrow(
        BuildingHasDependenciesError
      );
      await expect(deleteBuilding(mockBuilding.buildingId)).rejects.toThrow(
        /has 3 floor\(s\) and 0 asset\(s\)/
      );
      expect(mockRepository.deleteBuilding).not.toHaveBeenCalled();
    });

    it('should throw BuildingHasDependenciesError when building has assets', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 0, assetCount: 10 });

      await expect(deleteBuilding(mockBuilding.buildingId)).rejects.toThrow(
        BuildingHasDependenciesError
      );
      await expect(deleteBuilding(mockBuilding.buildingId)).rejects.toThrow(
        /has 0 floor\(s\) and 10 asset\(s\)/
      );
      expect(mockRepository.deleteBuilding).not.toHaveBeenCalled();
    });

    it('should throw BuildingHasDependenciesError when building has both floors and assets', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 5, assetCount: 25 });

      const error = await deleteBuilding(mockBuilding.buildingId).catch((e) => e);

      expect(error).toBeInstanceOf(BuildingHasDependenciesError);
      expect(error.floorCount).toBe(5);
      expect(error.assetCount).toBe(25);
    });

    it('should invalidate building cache after deletion', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 0, assetCount: 0 });
      mockRepository.deleteBuilding.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteBuilding(mockBuilding.buildingId);

      expect(mockCache.buildingInvalidationPatterns).toHaveBeenCalledWith(mockBuilding.buildingId);
      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getBuildingById.mockResolvedValue(mockBuilding);
      mockRepository.getBuildingDependencies.mockResolvedValue({ floorCount: 0, assetCount: 0 });
      mockRepository.deleteBuilding.mockResolvedValue(false);

      const result = await deleteBuilding(mockBuilding.buildingId);

      expect(result).toBe(false);
      expect(mockCache.buildingInvalidationPatterns).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listBuildings Tests (Requirement 1.5)
  // ============================================================================

  describe('listBuildings', () => {
    const mockPaginatedResult = {
      items: [mockBuilding],
      total: 1,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated list of buildings', async () => {
      mockCache.getOrSet.mockResolvedValue(mockPaginatedResult);

      const result = await listBuildings();

      expect(result).toEqual(mockPaginatedResult);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should use cache for default query without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(mockPaginatedResult);

      await listBuildings({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'building:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listBuildings.mockResolvedValue(mockPaginatedResult);

      await listBuildings({ city: 'Seattle' });

      expect(mockCache.getOrSet).not.toHaveBeenCalled();
      expect(mockRepository.listBuildings).toHaveBeenCalledWith(
        { city: 'Seattle' },
        {}
      );
    });

    it('should bypass cache when not on first page', async () => {
      mockRepository.listBuildings.mockResolvedValue({
        ...mockPaginatedResult,
        page: 2,
      });

      await listBuildings({}, { page: 2, limit: 20 });

      expect(mockCache.getOrSet).not.toHaveBeenCalled();
      expect(mockRepository.listBuildings).toHaveBeenCalledWith({}, { page: 2, limit: 20 });
    });

    it('should bypass cache when limit is not default', async () => {
      mockRepository.listBuildings.mockResolvedValue({
        ...mockPaginatedResult,
        limit: 50,
      });

      await listBuildings({}, { page: 1, limit: 50 });

      expect(mockCache.getOrSet).not.toHaveBeenCalled();
      expect(mockRepository.listBuildings).toHaveBeenCalledWith({}, { page: 1, limit: 50 });
    });

    it('should pass filters to repository', async () => {
      const filters = {
        isActive: true,
        city: 'Seattle',
        stateProvince: 'WA',
        search: 'Main',
      };
      mockRepository.listBuildings.mockResolvedValue(mockPaginatedResult);

      await listBuildings(filters);

      expect(mockRepository.listBuildings).toHaveBeenCalledWith(filters, {});
    });

    it('should pass pagination params to repository', async () => {
      const pagination = { page: 3, limit: 10 };
      mockRepository.listBuildings.mockResolvedValue({
        ...mockPaginatedResult,
        page: 3,
        limit: 10,
      });

      await listBuildings({ city: 'Seattle' }, pagination);

      expect(mockRepository.listBuildings).toHaveBeenCalledWith(
        { city: 'Seattle' },
        pagination
      );
    });
  });


  // ============================================================================
  // getActiveBuildings Tests
  // ============================================================================

  describe('getActiveBuildings', () => {
    const activeBuildings: Building[] = [
      mockBuilding,
      { ...mockBuilding, buildingId: '223e4567-e89b-12d3-a456-426614174001', buildingCode: 'BLDG-002' },
    ];

    it('should return list of active buildings', async () => {
      mockCache.getOrSet.mockResolvedValue(activeBuildings);

      const result = await getActiveBuildings();

      expect(result).toEqual(activeBuildings);
      expect(result).toHaveLength(2);
    });

    it('should use cache with isActive filter key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeBuildings);

      await getActiveBuildings();

      expect(mockCache.buildingListKey).toHaveBeenCalledWith({ isActive: true });
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getActiveBuildings.mockResolvedValue(activeBuildings);

      const result = await getActiveBuildings();

      expect(result).toEqual(activeBuildings);
      expect(mockRepository.getActiveBuildings).toHaveBeenCalled();
    });

    it('should return empty array when no active buildings', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveBuildings();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // isBuildingCodeUnique Tests
  // ============================================================================

  describe('isBuildingCodeUnique', () => {
    it('should return true when building code does not exist', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(false);

      const result = await isBuildingCodeUnique('NEW-CODE');

      expect(result).toBe(true);
      expect(mockRepository.buildingCodeExists).toHaveBeenCalledWith('NEW-CODE', undefined);
    });

    it('should return false when building code exists', async () => {
      mockRepository.buildingCodeExists.mockResolvedValue(true);

      const result = await isBuildingCodeUnique('EXISTING-CODE');

      expect(result).toBe(false);
    });

    it('should exclude specific building ID when checking uniqueness', async () => {
      const excludeBuildingId = '123e4567-e89b-12d3-a456-426614174000';
      mockRepository.buildingCodeExists.mockResolvedValue(false);

      const result = await isBuildingCodeUnique('BLDG-001', excludeBuildingId);

      expect(result).toBe(true);
      expect(mockRepository.buildingCodeExists).toHaveBeenCalledWith('BLDG-001', excludeBuildingId);
    });

    it('should return true when code exists but belongs to excluded building', async () => {
      const excludeBuildingId = '123e4567-e89b-12d3-a456-426614174000';
      mockRepository.buildingCodeExists.mockResolvedValue(false);

      const result = await isBuildingCodeUnique('BLDG-001', excludeBuildingId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('BuildingCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new BuildingCodeExistsError('BLDG-001');

        expect(error.name).toBe('BuildingCodeExistsError');
        expect(error.message).toBe("Building code 'BLDG-001' already exists");
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

    describe('BuildingHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new BuildingHasDependenciesError(
          '123e4567-e89b-12d3-a456-426614174000',
          5,
          25
        );

        expect(error.name).toBe('BuildingHasDependenciesError');
        expect(error.message).toContain('Cannot delete building');
        expect(error.message).toContain('5 floor(s)');
        expect(error.message).toContain('25 asset(s)');
        expect(error.floorCount).toBe(5);
        expect(error.assetCount).toBe(25);
        expect(error).toBeInstanceOf(Error);
      });

      it('should handle zero counts', () => {
        const error = new BuildingHasDependenciesError(
          '123e4567-e89b-12d3-a456-426614174000',
          0,
          0
        );

        expect(error.floorCount).toBe(0);
        expect(error.assetCount).toBe(0);
        expect(error.message).toContain('0 floor(s)');
        expect(error.message).toContain('0 asset(s)');
      });
    });
  });
});
