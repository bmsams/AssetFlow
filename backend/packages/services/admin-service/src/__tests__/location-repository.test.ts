/**
 * Location Repository Unit Tests - Building CRUD Operations
 *
 * Tests for the Building Repository data access layer.
 * Requirements:
 * - Requirement 1.1: Create building with name, address, and contact information
 * - Requirement 1.2: Return complete building details including floors count
 * - Requirement 1.3: Update specified fields and preserve unchanged fields
 * - Requirement 1.4: Mark building as inactive
 * - Requirement 1.5: Return paginated list of buildings matching filter criteria
 * - Requirement 1.6: Reject deletion if building has active assets or floors
 */

// Mock the dependencies before importing repository
jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import { query, queryOne, queryMany } from '@ams/database';
import type {
  CreateBuildingRequest,
  UpdateBuildingRequest,
  CreateFloorRequest,
  UpdateFloorRequest,
} from '@ams/types';

// Import repository functions after mocks are set up
import * as locationRepository from '../location/location-repository';

// Use jest.mocked for proper typing
const mockQuery = jest.mocked(query);
const mockQueryOne = jest.mocked(queryOne);
const mockQueryMany = jest.mocked(queryMany);

describe('Location Repository - Building CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Building Code Uniqueness Tests
  // ============================================================================

  describe('buildingCodeExists', () => {
    it('should return true when building code exists', async () => {
      mockQueryOne.mockResolvedValue({ exists: true });

      const result = await locationRepository.buildingCodeExists('BLDG-001');

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        ['BLDG-001']
      );
    });

    it('should return false when building code does not exist', async () => {
      mockQueryOne.mockResolvedValue({ exists: false });

      const result = await locationRepository.buildingCodeExists('BLDG-NEW');

      expect(result).toBe(false);
    });

    it('should exclude specific building ID when checking for duplicates', async () => {
      const excludeBuildingId = '123e4567-e89b-12d3-a456-426614174000';
      mockQueryOne.mockResolvedValue({ exists: false });

      await locationRepository.buildingCodeExists('BLDG-001', excludeBuildingId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('building_id != $2'),
        ['BLDG-001', excludeBuildingId]
      );
    });

    it('should return false when query returns null', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.buildingCodeExists('BLDG-001');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Create Building Tests (Requirement 1.1)
  // ============================================================================

  describe('createBuilding', () => {
    const validRequest: CreateBuildingRequest = {
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

    const mockBuildingRow = {
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      building_code: 'BLDG-001',
      name: 'Main Office Building',
      address_line1: '123 Main Street',
      address_line2: 'Suite 100',
      city: 'Seattle',
      state_province: 'WA',
      postal_code: '98101',
      country: 'USA',
      contact_name: 'John Doe',
      contact_email: 'john.doe@example.com',
      contact_phone: '555-123-4567',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should create a building with all fields', async () => {
      mockQueryOne.mockResolvedValue(mockBuildingRow);

      const result = await locationRepository.createBuilding(validRequest);

      expect(result).toEqual({
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
        totalFloors: 0,
        isActive: true,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should create a building with minimal required fields', async () => {
      const minimalRequest: CreateBuildingRequest = {
        buildingCode: 'BLDG-002',
        name: 'Warehouse',
      };

      const minimalRow = {
        ...mockBuildingRow,
        building_id: '223e4567-e89b-12d3-a456-426614174001',
        building_code: 'BLDG-002',
        name: 'Warehouse',
        address_line1: null,
        address_line2: null,
        city: null,
        state_province: null,
        postal_code: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
      };

      mockQueryOne.mockResolvedValue(minimalRow);

      const result = await locationRepository.createBuilding(minimalRequest);

      expect(result.buildingCode).toBe('BLDG-002');
      expect(result.name).toBe('Warehouse');
      expect(result.addressLine1).toBeNull();
      expect(result.totalFloors).toBe(0);
    });

    it('should set userId as created_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockQueryOne.mockResolvedValue(mockBuildingRow);

      await locationRepository.createBuilding(validRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO buildings'),
        expect.arrayContaining([userId])
      );
    });

    it('should throw error when database insert fails', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(locationRepository.createBuilding(validRequest)).rejects.toThrow(
        'Failed to create building'
      );
    });

    it('should default country to USA when not provided', async () => {
      const requestWithoutCountry: CreateBuildingRequest = {
        buildingCode: 'BLDG-003',
        name: 'Test Building',
      };

      mockQueryOne.mockResolvedValue({
        ...mockBuildingRow,
        building_code: 'BLDG-003',
        name: 'Test Building',
        country: 'USA',
      });

      await locationRepository.createBuilding(requestWithoutCountry);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO buildings'),
        expect.arrayContaining(['USA'])
      );
    });
  });


  // ============================================================================
  // Get Building By ID Tests (Requirement 1.2)
  // ============================================================================

  describe('getBuildingById', () => {
    const mockBuildingRowWithFloors = {
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      building_code: 'BLDG-001',
      name: 'Main Office Building',
      address_line1: '123 Main Street',
      address_line2: 'Suite 100',
      city: 'Seattle',
      state_province: 'WA',
      postal_code: '98101',
      country: 'USA',
      contact_name: 'John Doe',
      contact_email: 'john.doe@example.com',
      contact_phone: '555-123-4567',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
      total_floors: '5',
    };

    it('should return building with floor count', async () => {
      mockQueryOne.mockResolvedValue(mockBuildingRowWithFloors);

      const result = await locationRepository.getBuildingById(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).not.toBeNull();
      expect(result?.buildingId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result?.totalFloors).toBe(5);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT b.*'),
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return null when building not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.getBuildingById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should include floor count subquery', async () => {
      mockQueryOne.mockResolvedValue(mockBuildingRowWithFloors);

      await locationRepository.getBuildingById('123e4567-e89b-12d3-a456-426614174000');

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM floors'),
        expect.any(Array)
      );
    });

    it('should handle building with zero floors', async () => {
      mockQueryOne.mockResolvedValue({
        ...mockBuildingRowWithFloors,
        total_floors: '0',
      });

      const result = await locationRepository.getBuildingById(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result?.totalFloors).toBe(0);
    });
  });

  // ============================================================================
  // Get Building By Code Tests
  // ============================================================================

  describe('getBuildingByCode', () => {
    const mockBuildingRowWithFloors = {
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      building_code: 'BLDG-001',
      name: 'Main Office Building',
      address_line1: '123 Main Street',
      address_line2: null,
      city: 'Seattle',
      state_province: 'WA',
      postal_code: '98101',
      country: 'USA',
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
      total_floors: '3',
    };

    it('should return building by code', async () => {
      mockQueryOne.mockResolvedValue(mockBuildingRowWithFloors);

      const result = await locationRepository.getBuildingByCode('BLDG-001');

      expect(result).not.toBeNull();
      expect(result?.buildingCode).toBe('BLDG-001');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('WHERE b.building_code = $1'),
        ['BLDG-001']
      );
    });

    it('should return null when building code not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.getBuildingByCode('NONEXISTENT');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // Update Building Tests (Requirement 1.3)
  // ============================================================================

  describe('updateBuilding', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';

    const mockUpdatedRow = {
      building_id: buildingId,
      building_code: 'BLDG-001',
      name: 'Updated Building Name',
      address_line1: '456 New Street',
      address_line2: null,
      city: 'Portland',
      state_province: 'OR',
      postal_code: '97201',
      country: 'USA',
      contact_name: 'Jane Smith',
      contact_email: 'jane.smith@example.com',
      contact_phone: '555-987-6543',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T12:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should update building name', async () => {
      const updateRequest: UpdateBuildingRequest = {
        name: 'Updated Building Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateBuilding(buildingId, updateRequest);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Building Name');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE buildings SET'),
        expect.arrayContaining(['Updated Building Name'])
      );
    });

    it('should update multiple fields at once', async () => {
      const updateRequest: UpdateBuildingRequest = {
        name: 'Updated Building Name',
        city: 'Portland',
        stateProvince: 'OR',
        contactName: 'Jane Smith',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateBuilding(buildingId, updateRequest);

      expect(result).not.toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE buildings SET'),
        expect.arrayContaining(['Updated Building Name', 'Portland', 'OR', 'Jane Smith'])
      );
    });

    it('should preserve unchanged fields when updating', async () => {
      const updateRequest: UpdateBuildingRequest = {
        contactEmail: 'new.email@example.com',
      };

      mockQueryOne
        .mockResolvedValueOnce({
          ...mockUpdatedRow,
          contact_email: 'new.email@example.com',
        })
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateBuilding(buildingId, updateRequest);

      expect(result).not.toBeNull();
      // Original name should be preserved
      expect(result?.name).toBe('Updated Building Name');
    });

    it('should return existing building when no updates provided', async () => {
      const emptyUpdate: UpdateBuildingRequest = {};

      // Mock getBuildingById call
      mockQueryOne.mockResolvedValue({
        ...mockUpdatedRow,
        total_floors: '3',
      });

      const result = await locationRepository.updateBuilding(buildingId, emptyUpdate);

      expect(result).not.toBeNull();
      // Should call getBuildingById instead of UPDATE
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT b.*'),
        [buildingId]
      );
    });

    it('should return null when building not found', async () => {
      const updateRequest: UpdateBuildingRequest = {
        name: 'New Name',
      };

      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.updateBuilding(buildingId, updateRequest);

      expect(result).toBeNull();
    });

    it('should set userId as updated_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      const updateRequest: UpdateBuildingRequest = {
        name: 'Updated Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.updateBuilding(buildingId, updateRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE buildings SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should update isActive status', async () => {
      const updateRequest: UpdateBuildingRequest = {
        isActive: false,
      };

      mockQueryOne
        .mockResolvedValueOnce({ ...mockUpdatedRow, is_active: false })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.updateBuilding(buildingId, updateRequest);

      expect(result?.isActive).toBe(false);
    });
  });


  // ============================================================================
  // Deactivate Building Tests (Requirement 1.4)
  // ============================================================================

  describe('deactivateBuilding', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';

    it('should deactivate a building', async () => {
      const mockDeactivatedRow = {
        building_id: buildingId,
        building_code: 'BLDG-001',
        name: 'Main Office Building',
        address_line1: '123 Main Street',
        address_line2: null,
        city: 'Seattle',
        state_province: 'WA',
        postal_code: '98101',
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: false,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T12:00:00.000Z',
        created_by: null,
        updated_by: null,
      };

      mockQueryOne
        .mockResolvedValueOnce(mockDeactivatedRow)
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.deactivateBuilding(buildingId);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(false);
    });

    it('should pass userId to updateBuilding', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';

      mockQueryOne
        .mockResolvedValueOnce({
          building_id: buildingId,
          building_code: 'BLDG-001',
          name: 'Test',
          address_line1: null,
          address_line2: null,
          city: null,
          state_province: null,
          postal_code: null,
          country: 'USA',
          contact_name: null,
          contact_email: null,
          contact_phone: null,
          is_active: false,
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T12:00:00.000Z',
          created_by: null,
          updated_by: userId,
        })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.deactivateBuilding(buildingId, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE buildings SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should return null when building not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.deactivateBuilding('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Get Building Dependencies Tests (Requirement 1.6)
  // ============================================================================

  describe('getBuildingDependencies', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return floor and asset counts', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '5' })  // floor count
        .mockResolvedValueOnce({ count: '25' }); // asset count

      const result = await locationRepository.getBuildingDependencies(buildingId);

      expect(result.floorCount).toBe(5);
      expect(result.assetCount).toBe(25);
    });

    it('should return zero counts when no dependencies', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.getBuildingDependencies(buildingId);

      expect(result.floorCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should handle null query results', async () => {
      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await locationRepository.getBuildingDependencies(buildingId);

      expect(result.floorCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should query floors table for floor count', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '3' })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.getBuildingDependencies(buildingId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM floors WHERE building_id'),
        [buildingId]
      );
    });

    it('should query hardware_assets through room/floor hierarchy', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '10' });

      await locationRepository.getBuildingDependencies(buildingId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('hardware_assets'),
        [buildingId]
      );
    });
  });


  // ============================================================================
  // Delete Building Tests (Requirement 1.6)
  // ============================================================================

  describe('deleteBuilding', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';

    it('should delete building and return true', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteBuilding(buildingId);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM buildings WHERE building_id'),
        [buildingId]
      );
    });

    it('should return false when building not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteBuilding('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: null,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteBuilding(buildingId);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // List Buildings Tests (Requirement 1.5)
  // ============================================================================

  describe('listBuildings', () => {
    const mockBuildingRows = [
      {
        building_id: '123e4567-e89b-12d3-a456-426614174001',
        building_code: 'BLDG-001',
        name: 'Alpha Building',
        address_line1: '123 Main St',
        address_line2: null,
        city: 'Seattle',
        state_province: 'WA',
        postal_code: '98101',
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_floors: '3',
      },
      {
        building_id: '123e4567-e89b-12d3-a456-426614174002',
        building_code: 'BLDG-002',
        name: 'Beta Building',
        address_line1: '456 Oak Ave',
        address_line2: null,
        city: 'Portland',
        state_province: 'OR',
        postal_code: '97201',
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_floors: '5',
      },
    ];

    it('should return paginated list of buildings', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockBuildingRows);

      const result = await locationRepository.listBuildings();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(false);
    });

    it('should apply pagination parameters', async () => {
      mockQueryOne.mockResolvedValue({ count: '50' });
      mockQueryMany.mockResolvedValue(mockBuildingRows);

      const result = await locationRepository.listBuildings({}, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10]) // limit and offset
      );
    });

    it('should filter by isActive status', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockBuildingRows[0]!]);

      await locationRepository.listBuildings({ isActive: true });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([true])
      );
    });

    it('should filter by city', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockBuildingRows[0]!]);

      await locationRepository.listBuildings({ city: 'Seattle' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('city ILIKE'),
        expect.arrayContaining(['%Seattle%'])
      );
    });

    it('should filter by stateProvince', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockBuildingRows[1]!]);

      await locationRepository.listBuildings({ stateProvince: 'OR' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('state_province ILIKE'),
        expect.arrayContaining(['%OR%'])
      );
    });

    it('should filter by country', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockBuildingRows);

      await locationRepository.listBuildings({ country: 'USA' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('country ILIKE'),
        expect.arrayContaining(['%USA%'])
      );
    });

    it('should search by name or building code', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockBuildingRows[0]!]);

      await locationRepository.listBuildings({ search: 'Alpha' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('name ILIKE'),
        expect.arrayContaining(['%Alpha%'])
      );
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('building_code ILIKE'),
        expect.any(Array)
      );
    });

    it('should combine multiple filters', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockBuildingRows[0]!]);

      await locationRepository.listBuildings({
        isActive: true,
        city: 'Seattle',
        stateProvince: 'WA',
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('AND'),
        expect.arrayContaining([true, '%Seattle%', '%WA%'])
      );
    });

    it('should return empty list when no buildings match', async () => {
      mockQueryOne.mockResolvedValue({ count: '0' });
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listBuildings({ city: 'Nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should order results by name ascending', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockBuildingRows);

      await locationRepository.listBuildings();

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY b.name ASC'),
        expect.any(Array)
      );
    });

    it('should handle null count result', async () => {
      mockQueryOne.mockResolvedValue(null);
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listBuildings();

      expect(result.total).toBe(0);
    });
  });


  // ============================================================================
  // Get Active Buildings Tests
  // ============================================================================

  describe('getActiveBuildings', () => {
    const mockActiveBuildingRows = [
      {
        building_id: '123e4567-e89b-12d3-a456-426614174001',
        building_code: 'BLDG-001',
        name: 'Alpha Building',
        address_line1: '123 Main St',
        address_line2: null,
        city: 'Seattle',
        state_province: 'WA',
        postal_code: '98101',
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_floors: '3',
      },
      {
        building_id: '123e4567-e89b-12d3-a456-426614174002',
        building_code: 'BLDG-002',
        name: 'Beta Building',
        address_line1: '456 Oak Ave',
        address_line2: null,
        city: 'Portland',
        state_province: 'OR',
        postal_code: '97201',
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_floors: '5',
      },
    ];

    it('should return all active buildings', async () => {
      mockQueryMany.mockResolvedValue(mockActiveBuildingRows);

      const result = await locationRepository.getActiveBuildings();

      expect(result).toHaveLength(2);
      expect(result[0]!.isActive).toBe(true);
      expect(result[1]!.isActive).toBe(true);
    });

    it('should filter by is_active = TRUE', async () => {
      mockQueryMany.mockResolvedValue(mockActiveBuildingRows);

      await locationRepository.getActiveBuildings();

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE b.is_active = TRUE')
      );
    });

    it('should order by name ascending', async () => {
      mockQueryMany.mockResolvedValue(mockActiveBuildingRows);

      await locationRepository.getActiveBuildings();

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY b.name ASC')
      );
    });

    it('should return empty array when no active buildings', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.getActiveBuildings();

      expect(result).toHaveLength(0);
    });

    it('should include floor count for each building', async () => {
      mockQueryMany.mockResolvedValue(mockActiveBuildingRows);

      const result = await locationRepository.getActiveBuildings();

      expect(result[0]!.totalFloors).toBe(3);
      expect(result[1]!.totalFloors).toBe(5);
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling Tests
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle special characters in building name', async () => {
      const requestWithSpecialChars: CreateBuildingRequest = {
        buildingCode: 'BLDG-SPECIAL',
        name: "O'Brien's Building & Co.",
      };

      const mockRow = {
        building_id: '123e4567-e89b-12d3-a456-426614174000',
        building_code: 'BLDG-SPECIAL',
        name: "O'Brien's Building & Co.",
        address_line1: null,
        address_line2: null,
        city: null,
        state_province: null,
        postal_code: null,
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
      };

      mockQueryOne.mockResolvedValue(mockRow);

      const result = await locationRepository.createBuilding(requestWithSpecialChars);

      expect(result.name).toBe("O'Brien's Building & Co.");
    });

    it('should handle unicode characters in address', async () => {
      const requestWithUnicode: CreateBuildingRequest = {
        buildingCode: 'BLDG-UNICODE',
        name: 'International Building',
        addressLine1: '東京都渋谷区',
        city: '東京',
      };

      const mockRow = {
        building_id: '123e4567-e89b-12d3-a456-426614174000',
        building_code: 'BLDG-UNICODE',
        name: 'International Building',
        address_line1: '東京都渋谷区',
        address_line2: null,
        city: '東京',
        state_province: null,
        postal_code: null,
        country: 'USA',
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
      };

      mockQueryOne.mockResolvedValue(mockRow);

      const result = await locationRepository.createBuilding(requestWithUnicode);

      expect(result.addressLine1).toBe('東京都渋谷区');
      expect(result.city).toBe('東京');
    });

    it('should handle very long building codes', async () => {
      const longCode = 'BLDG-' + 'A'.repeat(100);
      
      mockQueryOne.mockResolvedValue({ exists: false });

      await locationRepository.buildingCodeExists(longCode);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.any(String),
        [longCode]
      );
    });

    it('should handle database errors gracefully', async () => {
      mockQueryOne.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        locationRepository.createBuilding({
          buildingCode: 'BLDG-ERROR',
          name: 'Error Building',
        })
      ).rejects.toThrow('Database connection failed');
    });
  });
});


// ============================================================================
// Floor Repository Tests
// ============================================================================

describe('Location Repository - Floor CRUD', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Floor Number Uniqueness Tests
  // ============================================================================

  describe('floorNumberExistsInBuilding', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return true when floor number exists in building', async () => {
      mockQueryOne.mockResolvedValue({ exists: true });

      const result = await locationRepository.floorNumberExistsInBuilding(buildingId, 1);

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        [buildingId, 1]
      );
    });

    it('should return false when floor number does not exist in building', async () => {
      mockQueryOne.mockResolvedValue({ exists: false });

      const result = await locationRepository.floorNumberExistsInBuilding(buildingId, 99);

      expect(result).toBe(false);
    });

    it('should exclude specific floor ID when checking for duplicates', async () => {
      const excludeFloorId = '456e4567-e89b-12d3-a456-426614174000';
      mockQueryOne.mockResolvedValue({ exists: false });

      await locationRepository.floorNumberExistsInBuilding(buildingId, 1, excludeFloorId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('floor_id != $3'),
        [buildingId, 1, excludeFloorId]
      );
    });

    it('should return false when query returns null', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.floorNumberExistsInBuilding(buildingId, 1);

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // Building Exists Tests (Requirement 2.5)
  // ============================================================================

  describe('buildingExists', () => {
    it('should return true when building exists', async () => {
      mockQueryOne.mockResolvedValue({ exists: true });

      const result = await locationRepository.buildingExists('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBe(true);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT EXISTS'),
        ['123e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return false when building does not exist', async () => {
      mockQueryOne.mockResolvedValue({ exists: false });

      const result = await locationRepository.buildingExists('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when query returns null', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.buildingExists('123e4567-e89b-12d3-a456-426614174000');

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // Create Floor Tests (Requirement 2.1)
  // ============================================================================

  describe('createFloor', () => {
    const validRequest: CreateFloorRequest = {
      buildingId: '123e4567-e89b-12d3-a456-426614174000',
      floorNumber: 1,
      name: 'First Floor',
      description: 'Main lobby and reception',
    };

    const mockFloorRow = {
      floor_id: '456e4567-e89b-12d3-a456-426614174000',
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      floor_number: 1,
      name: 'First Floor',
      description: 'Main lobby and reception',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should create a floor with all fields', async () => {
      mockQueryOne.mockResolvedValue(mockFloorRow);

      const result = await locationRepository.createFloor(validRequest);

      expect(result).toEqual({
        floorId: '456e4567-e89b-12d3-a456-426614174000',
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        floorNumber: 1,
        name: 'First Floor',
        description: 'Main lobby and reception',
        totalRooms: 0,
        isActive: true,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      });
    });

    it('should create a floor with minimal required fields', async () => {
      const minimalRequest: CreateFloorRequest = {
        buildingId: '123e4567-e89b-12d3-a456-426614174000',
        floorNumber: 2,
        name: 'Second Floor',
      };

      const minimalRow = {
        ...mockFloorRow,
        floor_id: '556e4567-e89b-12d3-a456-426614174001',
        floor_number: 2,
        name: 'Second Floor',
        description: null,
      };

      mockQueryOne.mockResolvedValue(minimalRow);

      const result = await locationRepository.createFloor(minimalRequest);

      expect(result.floorNumber).toBe(2);
      expect(result.name).toBe('Second Floor');
      expect(result.description).toBeNull();
      expect(result.totalRooms).toBe(0);
    });

    it('should set userId as created_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockQueryOne.mockResolvedValue(mockFloorRow);

      await locationRepository.createFloor(validRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO floors'),
        expect.arrayContaining([userId])
      );
    });

    it('should throw error when database insert fails', async () => {
      mockQueryOne.mockResolvedValue(null);

      await expect(locationRepository.createFloor(validRequest)).rejects.toThrow(
        'Failed to create floor'
      );
    });
  });

  // ============================================================================
  // Get Floor By ID Tests
  // ============================================================================

  describe('getFloorById', () => {
    const mockFloorRowWithRooms = {
      floor_id: '456e4567-e89b-12d3-a456-426614174000',
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      floor_number: 1,
      name: 'First Floor',
      description: 'Main lobby',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T10:00:00.000Z',
      created_by: null,
      updated_by: null,
      total_rooms: '5',
    };

    it('should return floor with room count', async () => {
      mockQueryOne.mockResolvedValue(mockFloorRowWithRooms);

      const result = await locationRepository.getFloorById(
        '456e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).not.toBeNull();
      expect(result?.floorId).toBe('456e4567-e89b-12d3-a456-426614174000');
      expect(result?.totalRooms).toBe(5);
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT f.*'),
        ['456e4567-e89b-12d3-a456-426614174000']
      );
    });

    it('should return null when floor not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.getFloorById('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should include room count subquery', async () => {
      mockQueryOne.mockResolvedValue(mockFloorRowWithRooms);

      await locationRepository.getFloorById('456e4567-e89b-12d3-a456-426614174000');

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) FROM rooms'),
        expect.any(Array)
      );
    });

    it('should handle floor with zero rooms', async () => {
      mockQueryOne.mockResolvedValue({
        ...mockFloorRowWithRooms,
        total_rooms: '0',
      });

      const result = await locationRepository.getFloorById(
        '456e4567-e89b-12d3-a456-426614174000'
      );

      expect(result?.totalRooms).toBe(0);
    });
  });


  // ============================================================================
  // Get Floors By Building ID Tests (Requirement 2.2)
  // ============================================================================

  describe('getFloorsByBuildingId', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';
    const mockFloorRows = [
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174001',
        building_id: buildingId,
        floor_number: 1,
        name: 'First Floor',
        description: 'Lobby',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '3',
      },
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174002',
        building_id: buildingId,
        floor_number: 2,
        name: 'Second Floor',
        description: 'Offices',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '5',
      },
    ];

    it('should return floors for a building ordered by floor number', async () => {
      mockQueryMany.mockResolvedValue(mockFloorRows);

      const result = await locationRepository.getFloorsByBuildingId(buildingId);

      expect(result).toHaveLength(2);
      expect(result[0]!.floorNumber).toBe(1);
      expect(result[1]!.floorNumber).toBe(2);
    });

    it('should filter by building_id', async () => {
      mockQueryMany.mockResolvedValue(mockFloorRows);

      await locationRepository.getFloorsByBuildingId(buildingId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE f.building_id = $1'),
        [buildingId]
      );
    });

    it('should order by floor_number ascending', async () => {
      mockQueryMany.mockResolvedValue(mockFloorRows);

      await locationRepository.getFloorsByBuildingId(buildingId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY f.floor_number ASC'),
        expect.any(Array)
      );
    });

    it('should return empty array when building has no floors', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.getFloorsByBuildingId(buildingId);

      expect(result).toHaveLength(0);
    });

    it('should include room count for each floor', async () => {
      mockQueryMany.mockResolvedValue(mockFloorRows);

      const result = await locationRepository.getFloorsByBuildingId(buildingId);

      expect(result[0]!.totalRooms).toBe(3);
      expect(result[1]!.totalRooms).toBe(5);
    });
  });


  // ============================================================================
  // Update Floor Tests (Requirement 2.3)
  // ============================================================================

  describe('updateFloor', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';

    const mockUpdatedRow = {
      floor_id: floorId,
      building_id: '123e4567-e89b-12d3-a456-426614174000',
      floor_number: 1,
      name: 'Updated Floor Name',
      description: 'Updated description',
      is_active: true,
      created_at: '2024-01-15T10:00:00.000Z',
      updated_at: '2024-01-15T12:00:00.000Z',
      created_by: null,
      updated_by: null,
    };

    it('should update floor name', async () => {
      const updateRequest: UpdateFloorRequest = {
        name: 'Updated Floor Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateFloor(floorId, updateRequest);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Floor Name');
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE floors SET'),
        expect.arrayContaining(['Updated Floor Name'])
      );
    });

    it('should update multiple fields at once', async () => {
      const updateRequest: UpdateFloorRequest = {
        name: 'Updated Floor Name',
        description: 'Updated description',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '3' });

      const result = await locationRepository.updateFloor(floorId, updateRequest);

      expect(result).not.toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE floors SET'),
        expect.arrayContaining(['Updated Floor Name', 'Updated description'])
      );
    });

    it('should return existing floor when no updates provided', async () => {
      const emptyUpdate: UpdateFloorRequest = {};

      mockQueryOne.mockResolvedValue({
        ...mockUpdatedRow,
        total_rooms: '3',
      });

      const result = await locationRepository.updateFloor(floorId, emptyUpdate);

      expect(result).not.toBeNull();
      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT f.*'),
        [floorId]
      );
    });

    it('should return null when floor not found', async () => {
      const updateRequest: UpdateFloorRequest = {
        name: 'New Name',
      };

      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.updateFloor(floorId, updateRequest);

      expect(result).toBeNull();
    });

    it('should set userId as updated_by when provided', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      const updateRequest: UpdateFloorRequest = {
        name: 'Updated Name',
      };

      mockQueryOne
        .mockResolvedValueOnce(mockUpdatedRow)
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.updateFloor(floorId, updateRequest, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE floors SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should update isActive status', async () => {
      const updateRequest: UpdateFloorRequest = {
        isActive: false,
      };

      mockQueryOne
        .mockResolvedValueOnce({ ...mockUpdatedRow, is_active: false })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.updateFloor(floorId, updateRequest);

      expect(result?.isActive).toBe(false);
    });
  });


  // ============================================================================
  // Deactivate Floor Tests (Requirement 2.4)
  // ============================================================================

  describe('deactivateFloor', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';

    it('should deactivate a floor', async () => {
      const mockDeactivatedRow = {
        floor_id: floorId,
        building_id: '123e4567-e89b-12d3-a456-426614174000',
        floor_number: 1,
        name: 'First Floor',
        description: null,
        is_active: false,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T12:00:00.000Z',
        created_by: null,
        updated_by: null,
      };

      mockQueryOne
        .mockResolvedValueOnce(mockDeactivatedRow)
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.deactivateFloor(floorId);

      expect(result).not.toBeNull();
      expect(result?.isActive).toBe(false);
    });

    it('should pass userId to updateFloor', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';

      mockQueryOne
        .mockResolvedValueOnce({
          floor_id: floorId,
          building_id: '123e4567-e89b-12d3-a456-426614174000',
          floor_number: 1,
          name: 'Test',
          description: null,
          is_active: false,
          created_at: '2024-01-15T10:00:00.000Z',
          updated_at: '2024-01-15T12:00:00.000Z',
          created_by: null,
          updated_by: userId,
        })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.deactivateFloor(floorId, userId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE floors SET'),
        expect.arrayContaining([userId])
      );
    });

    it('should return null when floor not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await locationRepository.deactivateFloor('nonexistent-id');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // Get Floor Dependencies Tests
  // ============================================================================

  describe('getFloorDependencies', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';

    it('should return room and asset counts', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '5' })  // room count
        .mockResolvedValueOnce({ count: '25' }); // asset count

      const result = await locationRepository.getFloorDependencies(floorId);

      expect(result.roomCount).toBe(5);
      expect(result.assetCount).toBe(25);
    });

    it('should return zero counts when no dependencies', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '0' });

      const result = await locationRepository.getFloorDependencies(floorId);

      expect(result.roomCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should handle null query results', async () => {
      mockQueryOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await locationRepository.getFloorDependencies(floorId);

      expect(result.roomCount).toBe(0);
      expect(result.assetCount).toBe(0);
    });

    it('should query rooms table for room count', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '3' })
        .mockResolvedValueOnce({ count: '0' });

      await locationRepository.getFloorDependencies(floorId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('FROM rooms WHERE floor_id'),
        [floorId]
      );
    });

    it('should query hardware_assets through room hierarchy', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ count: '0' })
        .mockResolvedValueOnce({ count: '10' });

      await locationRepository.getFloorDependencies(floorId);

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('hardware_assets'),
        [floorId]
      );
    });
  });


  // ============================================================================
  // Delete Floor Tests
  // ============================================================================

  describe('deleteFloor', () => {
    const floorId = '456e4567-e89b-12d3-a456-426614174000';

    it('should delete floor and return true', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteFloor(floorId);

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM floors WHERE floor_id'),
        [floorId]
      );
    });

    it('should return false when floor not found', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: 0,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteFloor('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false when rowCount is null', async () => {
      mockQuery.mockResolvedValue({
        rows: [],
        rowCount: null,
        command: 'DELETE',
        oid: 0,
        fields: [],
      });

      const result = await locationRepository.deleteFloor(floorId);

      expect(result).toBe(false);
    });
  });


  // ============================================================================
  // List Floors Tests
  // ============================================================================

  describe('listFloors', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';
    const mockFloorRows = [
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174001',
        building_id: buildingId,
        floor_number: 1,
        name: 'First Floor',
        description: 'Lobby',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '3',
      },
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174002',
        building_id: buildingId,
        floor_number: 2,
        name: 'Second Floor',
        description: 'Offices',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '5',
      },
    ];

    it('should return paginated list of floors', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockFloorRows);

      const result = await locationRepository.listFloors();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.hasMore).toBe(false);
    });

    it('should apply pagination parameters', async () => {
      mockQueryOne.mockResolvedValue({ count: '50' });
      mockQueryMany.mockResolvedValue(mockFloorRows);

      const result = await locationRepository.listFloors({}, { page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.hasMore).toBe(true);
      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 10]) // limit and offset
      );
    });

    it('should filter by buildingId', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockFloorRows);

      await locationRepository.listFloors({ buildingId });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('building_id'),
        expect.arrayContaining([buildingId])
      );
    });

    it('should filter by isActive status', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockFloorRows[0]!]);

      await locationRepository.listFloors({ isActive: true });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([true])
      );
    });

    it('should combine multiple filters', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockFloorRows[0]!]);

      await locationRepository.listFloors({
        buildingId,
        isActive: true,
      });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('AND'),
        expect.arrayContaining([buildingId, true])
      );
    });

    it('should return empty list when no floors match', async () => {
      mockQueryOne.mockResolvedValue({ count: '0' });
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listFloors({ buildingId: 'nonexistent' });

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should order results by floor_number ascending', async () => {
      mockQueryOne.mockResolvedValue({ count: '2' });
      mockQueryMany.mockResolvedValue(mockFloorRows);

      await locationRepository.listFloors();

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY f.floor_number ASC'),
        expect.any(Array)
      );
    });

    it('should handle null count result', async () => {
      mockQueryOne.mockResolvedValue(null);
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.listFloors();

      expect(result.total).toBe(0);
    });
  });


  // ============================================================================
  // Get Active Floors By Building ID Tests
  // ============================================================================

  describe('getActiveFloorsByBuildingId', () => {
    const buildingId = '123e4567-e89b-12d3-a456-426614174000';
    const mockActiveFloorRows = [
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174001',
        building_id: buildingId,
        floor_number: 1,
        name: 'First Floor',
        description: 'Lobby',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '3',
      },
      {
        floor_id: '456e4567-e89b-12d3-a456-426614174002',
        building_id: buildingId,
        floor_number: 2,
        name: 'Second Floor',
        description: 'Offices',
        is_active: true,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
        created_by: null,
        updated_by: null,
        total_rooms: '5',
      },
    ];

    it('should return all active floors for a building', async () => {
      mockQueryMany.mockResolvedValue(mockActiveFloorRows);

      const result = await locationRepository.getActiveFloorsByBuildingId(buildingId);

      expect(result).toHaveLength(2);
      expect(result[0]!.isActive).toBe(true);
      expect(result[1]!.isActive).toBe(true);
    });

    it('should filter by building_id and is_active = TRUE', async () => {
      mockQueryMany.mockResolvedValue(mockActiveFloorRows);

      await locationRepository.getActiveFloorsByBuildingId(buildingId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('WHERE f.building_id = $1 AND f.is_active = TRUE'),
        [buildingId]
      );
    });

    it('should order by floor_number ascending', async () => {
      mockQueryMany.mockResolvedValue(mockActiveFloorRows);

      await locationRepository.getActiveFloorsByBuildingId(buildingId);

      expect(mockQueryMany).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY f.floor_number ASC'),
        expect.any(Array)
      );
    });

    it('should return empty array when no active floors', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await locationRepository.getActiveFloorsByBuildingId(buildingId);

      expect(result).toHaveLength(0);
    });

    it('should include room count for each floor', async () => {
      mockQueryMany.mockResolvedValue(mockActiveFloorRows);

      const result = await locationRepository.getActiveFloorsByBuildingId(buildingId);

      expect(result[0]!.totalRooms).toBe(3);
      expect(result[1]!.totalRooms).toBe(5);
    });
  });
});
