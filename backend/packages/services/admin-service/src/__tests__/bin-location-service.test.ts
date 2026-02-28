/**
 * Bin Location Service Unit Tests (admin-service)
 *
 * Tests for the admin Bin Location Service business logic layer.
 * Requirements:
 * - Requirement 6.1: Create bin location with uniqueness check
 * - Requirement 6.2: Get bin location by ID
 * - Requirement 6.3: Update bin location with code uniqueness validation
 * - Requirement 6.4: Deactivate bin location (soft delete)
 */

jest.mock('../stockroom/bin-location-repository');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import type { BinLocation, CreateBinLocationRequest, UpdateBinLocationRequest } from '@ams/types';
import * as repository from '../stockroom/bin-location-repository';
import {
  createBinLocation,
  getBinLocation,
  updateBinLocation,
  deactivateBinLocation,
  listBinLocations,
  getBinLocationsByStockroom,
  isBinCodeUnique,
  BinLocationNotFoundError,
  BinCodeExistsError,
} from '../stockroom/bin-location-service';

const mockRepository = jest.mocked(repository);

// ============================================================================
// Test Data
// ============================================================================

const mockBinLocation: BinLocation = {
  binId: 'aaa14567-e89b-12d3-a456-426614174000',
  stockroomId: '111e4567-e89b-12d3-a456-426614174000',
  binCode: 'A1',
  shelfLocation: 'Shelf 1',
  capacity: 50,
  currentCount: 10,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateBinLocationRequest = {
  stockroomId: '111e4567-e89b-12d3-a456-426614174000',
  binCode: 'A1',
  shelfLocation: 'Shelf 1',
  capacity: 50,
};

describe('Bin Location Service (admin-service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // createBinLocation
  // ==========================================================================

  describe('createBinLocation', () => {
    it('should create bin location when code is unique', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(true);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);

      const result = await createBinLocation(validCreateRequest);

      expect(result).toEqual(mockBinLocation);
      expect(mockRepository.isBinCodeUnique).toHaveBeenCalledWith(
        validCreateRequest.stockroomId,
        validCreateRequest.binCode
      );
      expect(mockRepository.createBinLocation).toHaveBeenCalledWith(
        validCreateRequest,
        undefined
      );
    });

    it('should pass userId to repository', async () => {
      const userId = 'user-123';
      mockRepository.isBinCodeUnique.mockResolvedValue(true);
      mockRepository.createBinLocation.mockResolvedValue(mockBinLocation);

      await createBinLocation(validCreateRequest, userId);

      expect(mockRepository.createBinLocation).toHaveBeenCalledWith(
        validCreateRequest,
        userId
      );
    });

    it('should throw BinCodeExistsError when code is not unique', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(false);

      await expect(createBinLocation(validCreateRequest)).rejects.toThrow(
        BinCodeExistsError
      );
      expect(mockRepository.createBinLocation).not.toHaveBeenCalled();
    });

    it('should include stockroomId and binCode in BinCodeExistsError', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(false);

      await expect(createBinLocation(validCreateRequest)).rejects.toThrow(
        `Bin code 'A1' already exists in stockroom ${validCreateRequest.stockroomId}`
      );
    });
  });

  // ==========================================================================
  // getBinLocation
  // ==========================================================================

  describe('getBinLocation', () => {
    it('should return bin location when found', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);

      const result = await getBinLocation(mockBinLocation.binId);

      expect(result).toEqual(mockBinLocation);
    });

    it('should return null when not found', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      const result = await getBinLocation('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // updateBinLocation
  // ==========================================================================

  describe('updateBinLocation', () => {
    const updateRequest: UpdateBinLocationRequest = {
      shelfLocation: 'Shelf 2',
      capacity: 100,
    };

    const updatedBin: BinLocation = {
      ...mockBinLocation,
      shelfLocation: 'Shelf 2',
      capacity: 100,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update bin location successfully', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBin);

      const result = await updateBinLocation(mockBinLocation.binId, updateRequest);

      expect(result).toEqual(updatedBin);
      expect(mockRepository.updateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        updateRequest,
        undefined
      );
    });

    it('should pass userId to repository', async () => {
      const userId = 'user-456';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBin);

      await updateBinLocation(mockBinLocation.binId, updateRequest, userId);

      expect(mockRepository.updateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        updateRequest,
        userId
      );
    });

    it('should throw BinLocationNotFoundError when bin does not exist', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      await expect(
        updateBinLocation('nonexistent-id', updateRequest)
      ).rejects.toThrow(BinLocationNotFoundError);
      expect(mockRepository.updateBinLocation).not.toHaveBeenCalled();
    });

    it('should throw BinLocationNotFoundError when update returns null', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.updateBinLocation.mockResolvedValue(null);

      await expect(
        updateBinLocation(mockBinLocation.binId, updateRequest)
      ).rejects.toThrow(BinLocationNotFoundError);
    });

    it('should check code uniqueness when binCode changes', async () => {
      const codeChangeRequest: UpdateBinLocationRequest = { binCode: 'B2' };
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.isBinCodeUnique.mockResolvedValue(true);
      mockRepository.updateBinLocation.mockResolvedValue({
        ...mockBinLocation,
        binCode: 'B2',
      });

      await updateBinLocation(mockBinLocation.binId, codeChangeRequest);

      expect(mockRepository.isBinCodeUnique).toHaveBeenCalledWith(
        mockBinLocation.stockroomId,
        'B2',
        mockBinLocation.binId
      );
    });

    it('should throw BinCodeExistsError when new code is not unique', async () => {
      const codeChangeRequest: UpdateBinLocationRequest = { binCode: 'B2' };
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.isBinCodeUnique.mockResolvedValue(false);

      await expect(
        updateBinLocation(mockBinLocation.binId, codeChangeRequest)
      ).rejects.toThrow(BinCodeExistsError);
      expect(mockRepository.updateBinLocation).not.toHaveBeenCalled();
    });

    it('should not check uniqueness when binCode is unchanged', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.updateBinLocation.mockResolvedValue(updatedBin);

      await updateBinLocation(mockBinLocation.binId, updateRequest);

      expect(mockRepository.isBinCodeUnique).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // deactivateBinLocation
  // ==========================================================================

  describe('deactivateBinLocation', () => {
    const deactivatedBin: BinLocation = {
      ...mockBinLocation,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate bin location successfully', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBin);

      const result = await deactivateBinLocation(mockBinLocation.binId);

      expect(result.isActive).toBe(false);
    });

    it('should pass userId to repository', async () => {
      const userId = 'user-789';
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(deactivatedBin);

      await deactivateBinLocation(mockBinLocation.binId, userId);

      expect(mockRepository.deactivateBinLocation).toHaveBeenCalledWith(
        mockBinLocation.binId,
        userId
      );
    });

    it('should throw BinLocationNotFoundError when bin does not exist', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(null);

      await expect(
        deactivateBinLocation('nonexistent-id')
      ).rejects.toThrow(BinLocationNotFoundError);
    });

    it('should throw BinLocationNotFoundError when deactivate returns null', async () => {
      mockRepository.getBinLocationById.mockResolvedValue(mockBinLocation);
      mockRepository.deactivateBinLocation.mockResolvedValue(null);

      await expect(
        deactivateBinLocation(mockBinLocation.binId)
      ).rejects.toThrow(BinLocationNotFoundError);
    });
  });

  // ==========================================================================
  // listBinLocations
  // ==========================================================================

  describe('listBinLocations', () => {
    const paginatedResult = {
      items: [mockBinLocation],
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    };

    it('should return paginated results', async () => {
      mockRepository.listBinLocations.mockResolvedValue(paginatedResult);

      const result = await listBinLocations({}, { page: 1, limit: 50 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass filters to repository', async () => {
      const filters = {
        stockroomId: '111e4567-e89b-12d3-a456-426614174000' as const,
        isActive: true,
      };
      mockRepository.listBinLocations.mockResolvedValue(paginatedResult);

      await listBinLocations(filters, { page: 1, limit: 50 });

      expect(mockRepository.listBinLocations).toHaveBeenCalledWith(
        filters,
        { page: 1, limit: 50 }
      );
    });
  });

  // ==========================================================================
  // getBinLocationsByStockroom
  // ==========================================================================

  describe('getBinLocationsByStockroom', () => {
    it('should return bin locations for stockroom', async () => {
      mockRepository.getBinLocationsByStockroom.mockResolvedValue([mockBinLocation]);

      const result = await getBinLocationsByStockroom(mockBinLocation.stockroomId);

      expect(result).toEqual([mockBinLocation]);
      expect(mockRepository.getBinLocationsByStockroom).toHaveBeenCalledWith(
        mockBinLocation.stockroomId
      );
    });

    it('should return empty array when no bins exist', async () => {
      mockRepository.getBinLocationsByStockroom.mockResolvedValue([]);

      const result = await getBinLocationsByStockroom('empty-stockroom');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // isBinCodeUnique
  // ==========================================================================

  describe('isBinCodeUnique', () => {
    it('should return true when code is unique', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(true);

      const result = await isBinCodeUnique('stockroom-1', 'NEW-CODE');

      expect(result).toBe(true);
    });

    it('should return false when code exists', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(false);

      const result = await isBinCodeUnique('stockroom-1', 'A1');

      expect(result).toBe(false);
    });

    it('should pass excludeBinId for update scenarios', async () => {
      mockRepository.isBinCodeUnique.mockResolvedValue(true);

      await isBinCodeUnique('stockroom-1', 'A1', 'bin-to-exclude');

      expect(mockRepository.isBinCodeUnique).toHaveBeenCalledWith(
        'stockroom-1',
        'A1',
        'bin-to-exclude'
      );
    });
  });
});
