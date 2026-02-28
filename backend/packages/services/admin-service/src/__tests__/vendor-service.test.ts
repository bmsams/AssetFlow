/**
 * Vendor Service Unit Tests
 *
 * Tests for the Vendor Service business logic layer.
 * Requirements:
 * - Requirement 9.1: Create vendor with name, type, contact information, and payment terms
 * - Requirement 9.2: Return complete vendor details including contacts and payment terms
 * - Requirement 9.3: Update vendor details including contacts and payment terms
 * - Requirement 9.4: Update rating and log the change in audit history
 * - Requirement 9.5: Mark vendor as inactive and prevent new purchase orders
 * - Requirement 9.6: Return paginated list with type and rating filters
 * - Requirement 9.7: Return matching vendors using partial text matching
 */

// Mock the dependencies before importing service
jest.mock('../reference-data/vendor-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    VENDOR: 'vendor',
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

import type { CreateVendorRequest, UpdateVendorRequest, VendorDetails } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../reference-data/vendor-repository';
import {
  createVendor,
  getVendorById,
  getVendorOrThrow,
  getVendorByCode,
  updateVendor,
  deactivateVendor,
  deleteVendor,
  listVendors,
  searchVendors,
  updateVendorRating,
  getVendorsByType,
  getVendorsByRating,
  getVendorsForPurchasing,
  getAllVendors,
  getActiveVendors,
  getPreferredVendors,
  getApprovedVendors,
  isVendorCodeUnique,
  reactivateVendor,
  canReceivePurchaseOrders,
  getVendorSummary,
  VendorNotFoundError,
  VendorCodeExistsError,
  VendorHasDependenciesError,
} from '../reference-data/vendor-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockVendor: VendorDetails = {
  vendorId: '111e4567-e89b-12d3-a456-426614174000',
  vendorCode: 'VEND-001',
  vendorName: 'Acme Corporation',
  vendorType: 'MANUFACTURER',
  contactName: 'John Smith',
  contactEmail: 'john.smith@acme.com',
  contactPhone: '555-123-4567',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'New York',
  stateProvince: 'NY',
  postalCode: '10001',
  country: 'USA',
  paymentTerms: 'Net 30',
  rating: 'APPROVED',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockVendorNoCode: VendorDetails = {
  vendorId: '222e4567-e89b-12d3-a456-426614174000',
  vendorCode: null,
  vendorName: 'Beta Supplies',
  vendorType: 'RESELLER',
  contactName: 'Jane Doe',
  contactEmail: 'jane@betasupplies.com',
  contactPhone: '555-987-6543',
  addressLine1: '456 Oak Avenue',
  addressLine2: null,
  city: 'Los Angeles',
  stateProvince: 'CA',
  postalCode: '90001',
  country: 'USA',
  paymentTerms: 'Net 45',
  rating: 'PREFERRED',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockInactiveVendor: VendorDetails = {
  ...mockVendor,
  vendorId: '333e4567-e89b-12d3-a456-426614174000',
  vendorCode: 'VEND-003',
  vendorName: 'Inactive Vendor',
  isActive: false,
};

const mockSuspendedVendor: VendorDetails = {
  ...mockVendor,
  vendorId: '444e4567-e89b-12d3-a456-426614174000',
  vendorCode: 'VEND-004',
  vendorName: 'Suspended Vendor',
  rating: 'SUSPENDED',
  isActive: true,
};

const validCreateRequest: CreateVendorRequest = {
  vendorCode: 'VEND-001',
  vendorName: 'Acme Corporation',
  vendorType: 'MANUFACTURER',
  contactName: 'John Smith',
  contactEmail: 'john.smith@acme.com',
  contactPhone: '555-123-4567',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'New York',
  stateProvince: 'NY',
  postalCode: '10001',
  country: 'USA',
  paymentTerms: 'Net 30',
};

const validCreateRequestNoCode: CreateVendorRequest = {
  vendorName: 'Beta Supplies',
  vendorType: 'RESELLER',
  contactName: 'Jane Doe',
  contactEmail: 'jane@betasupplies.com',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'VENDOR_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Vendor Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });


  // ============================================================================
  // createVendor Tests (Requirement 9.1)
  // ============================================================================

  describe('createVendor', () => {
    it('should create vendor and publish event (Requirement 9.1)', async () => {
      mockRepository.vendorCodeExists.mockResolvedValue(false);
      mockRepository.createVendor.mockResolvedValue(mockVendor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createVendor(validCreateRequest);

      expect(result).toEqual(mockVendor);
      expect(mockRepository.vendorCodeExists).toHaveBeenCalledWith('VEND-001');
      expect(mockRepository.createVendor).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create vendor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.vendorCodeExists.mockResolvedValue(false);
      mockRepository.createVendor.mockResolvedValue(mockVendor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createVendor(validCreateRequest, userId);

      expect(mockRepository.createVendor).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw VendorCodeExistsError for duplicate code', async () => {
      mockRepository.vendorCodeExists.mockResolvedValue(true);

      await expect(createVendor(validCreateRequest)).rejects.toThrow(VendorCodeExistsError);
      await expect(createVendor(validCreateRequest)).rejects.toThrow(
        "Vendor code 'VEND-001' already exists"
      );
      expect(mockRepository.createVendor).not.toHaveBeenCalled();
    });

    it('should create vendor without vendor code', async () => {
      mockRepository.createVendor.mockResolvedValue(mockVendorNoCode);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createVendor(validCreateRequestNoCode);

      expect(result.vendorCode).toBeNull();
      expect(mockRepository.vendorCodeExists).not.toHaveBeenCalled();
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.vendorCodeExists.mockResolvedValue(false);
      mockRepository.createVendor.mockResolvedValue(mockVendor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createVendor(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('vendor:list');
    });

    it('should publish VENDOR_CREATED event after creation', async () => {
      const userId = 'user-123';
      mockRepository.vendorCodeExists.mockResolvedValue(false);
      mockRepository.createVendor.mockResolvedValue(mockVendor);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createVendor(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('VENDOR_CREATED', {
        vendorId: mockVendor.vendorId,
        vendorCode: mockVendor.vendorCode,
        vendorName: mockVendor.vendorName,
        createdBy: userId,
      });
    });
  });

  // ============================================================================
  // getVendorById Tests (Requirement 9.2)
  // ============================================================================

  describe('getVendorById', () => {
    it('should return vendor from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);

      const result = await getVendorById(mockVendor.vendorId);

      expect(result).toEqual(mockVendor);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `vendor:${mockVendor.vendorId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorById.mockResolvedValue(mockVendor);

      const result = await getVendorById(mockVendor.vendorId);

      expect(result).toEqual(mockVendor);
      expect(mockRepository.getVendorById).toHaveBeenCalledWith(mockVendor.vendorId);
    });

    it('should return null for non-existent vendor', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorById.mockResolvedValue(null);

      const result = await getVendorById('nonexistent-id');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // getVendorOrThrow Tests
  // ============================================================================

  describe('getVendorOrThrow', () => {
    it('should return vendor when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);

      const result = await getVendorOrThrow(mockVendor.vendorId);

      expect(result).toEqual(mockVendor);
    });

    it('should throw VendorNotFoundError when vendor not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getVendorOrThrow('nonexistent-id')).rejects.toThrow(VendorNotFoundError);
      await expect(getVendorOrThrow('nonexistent-id')).rejects.toThrow(
        'Vendor not found: nonexistent-id'
      );
    });
  });

  // ============================================================================
  // getVendorByCode Tests
  // ============================================================================

  describe('getVendorByCode', () => {
    it('should return vendor by code from cache', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);

      const result = await getVendorByCode('VEND-001');

      expect(result).toEqual(mockVendor);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:code:VEND-001',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorByCode.mockResolvedValue(mockVendor);

      const result = await getVendorByCode('VEND-001');

      expect(result).toEqual(mockVendor);
      expect(mockRepository.getVendorByCode).toHaveBeenCalledWith('VEND-001');
    });

    it('should return null for non-existent code', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorByCode.mockResolvedValue(null);

      const result = await getVendorByCode('NONEXISTENT');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // updateVendor Tests (Requirement 9.3)
  // ============================================================================

  describe('updateVendor', () => {
    const updateRequest: UpdateVendorRequest = {
      vendorName: 'Updated Acme Corporation',
      contactEmail: 'updated@acme.com',
      paymentTerms: 'Net 60',
    };

    const updatedVendor: VendorDetails = {
      ...mockVendor,
      vendorName: 'Updated Acme Corporation',
      contactEmail: 'updated@acme.com',
      paymentTerms: 'Net 60',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update vendor and invalidate cache (Requirement 9.3)', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(updatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateVendor(mockVendor.vendorId, updateRequest);

      expect(result).toEqual(updatedVendor);
      expect(mockRepository.getVendorById).toHaveBeenCalledWith(mockVendor.vendorId);
      expect(mockRepository.updateVendor).toHaveBeenCalledWith(
        mockVendor.vendorId,
        updateRequest,
        undefined
      );
    });

    it('should update vendor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(updatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendor(mockVendor.vendorId, updateRequest, userId);

      expect(mockRepository.updateVendor).toHaveBeenCalledWith(
        mockVendor.vendorId,
        updateRequest,
        userId
      );
    });

    it('should throw VendorNotFoundError for non-existent vendor', async () => {
      mockRepository.getVendorById.mockResolvedValue(null);

      await expect(updateVendor('nonexistent-id', updateRequest)).rejects.toThrow(VendorNotFoundError);
      expect(mockRepository.updateVendor).not.toHaveBeenCalled();
    });

    it('should throw VendorNotFoundError when update returns null', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(null);

      await expect(updateVendor(mockVendor.vendorId, updateRequest)).rejects.toThrow(VendorNotFoundError);
    });

    it('should publish VENDOR_UPDATED event with changes', async () => {
      const userId = 'user-123';
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(updatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendor(mockVendor.vendorId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('VENDOR_UPDATED', expect.objectContaining({
        vendorId: updatedVendor.vendorId,
        vendorName: updatedVendor.vendorName,
        updatedBy: userId,
      }));
    });

    it('should not publish event when no changes', async () => {
      const noChangeRequest: UpdateVendorRequest = {};
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(mockVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await updateVendor(mockVendor.vendorId, noChangeRequest);

      expect(mockPublishEvent).not.toHaveBeenCalled();
    });

    it('should invalidate cache patterns after update', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.updateVendor.mockResolvedValue(updatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendor(mockVendor.vendorId, updateRequest);

      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith(`vendor:${mockVendor.vendorId}`);
    });
  });


  // ============================================================================
  // deactivateVendor Tests (Requirement 9.5)
  // ============================================================================

  describe('deactivateVendor', () => {
    const deactivatedVendor: VendorDetails = {
      ...mockVendor,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate vendor successfully (Requirement 9.5)', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deactivateVendor.mockResolvedValue(deactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateVendor(mockVendor.vendorId);

      expect(result).toEqual(deactivatedVendor);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateVendor).toHaveBeenCalledWith(mockVendor.vendorId, undefined);
    });

    it('should deactivate vendor with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deactivateVendor.mockResolvedValue(deactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateVendor(mockVendor.vendorId, userId);

      expect(mockRepository.deactivateVendor).toHaveBeenCalledWith(mockVendor.vendorId, userId);
    });

    it('should throw VendorNotFoundError when vendor does not exist', async () => {
      mockRepository.getVendorById.mockResolvedValue(null);

      await expect(deactivateVendor('nonexistent-id')).rejects.toThrow(VendorNotFoundError);
      expect(mockRepository.deactivateVendor).not.toHaveBeenCalled();
    });

    it('should throw VendorNotFoundError when deactivate returns null', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deactivateVendor.mockResolvedValue(null);

      await expect(deactivateVendor(mockVendor.vendorId)).rejects.toThrow(VendorNotFoundError);
    });

    it('should still deactivate vendor with dependencies (warning only)', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 5, assetCount: 3 });
      mockRepository.deactivateVendor.mockResolvedValue(deactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateVendor(mockVendor.vendorId);

      expect(result.isActive).toBe(false);
    });

    it('should publish VENDOR_DEACTIVATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deactivateVendor.mockResolvedValue(deactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateVendor(mockVendor.vendorId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('VENDOR_DEACTIVATED', {
        vendorId: deactivatedVendor.vendorId,
        vendorName: deactivatedVendor.vendorName,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteVendor Tests (Requirement 9.5)
  // ============================================================================

  describe('deleteVendor', () => {
    it('should delete vendor when no dependencies', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deleteVendor.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteVendor(mockVendor.vendorId);

      expect(result).toBe(true);
      expect(mockRepository.deleteVendor).toHaveBeenCalledWith(mockVendor.vendorId);
    });

    it('should throw VendorNotFoundError when vendor does not exist', async () => {
      mockRepository.getVendorById.mockResolvedValue(null);

      await expect(deleteVendor('nonexistent-id')).rejects.toThrow(VendorNotFoundError);
      expect(mockRepository.getVendorDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteVendor).not.toHaveBeenCalled();
    });

    it('should throw VendorHasDependenciesError when has purchase orders', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 5, assetCount: 0 });

      await expect(deleteVendor(mockVendor.vendorId)).rejects.toThrow(VendorHasDependenciesError);
      await expect(deleteVendor(mockVendor.vendorId)).rejects.toThrow(/has 5 purchase order\(s\) and 0 asset\(s\)/);
      expect(mockRepository.deleteVendor).not.toHaveBeenCalled();
    });

    it('should throw VendorHasDependenciesError when has assets', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 10 });

      await expect(deleteVendor(mockVendor.vendorId)).rejects.toThrow(VendorHasDependenciesError);
      await expect(deleteVendor(mockVendor.vendorId)).rejects.toThrow(/has 0 purchase order\(s\) and 10 asset\(s\)/);
      expect(mockRepository.deleteVendor).not.toHaveBeenCalled();
    });

    it('should throw VendorHasDependenciesError when has both POs and assets', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 3, assetCount: 7 });

      const error = await deleteVendor(mockVendor.vendorId).catch((e) => e);

      expect(error).toBeInstanceOf(VendorHasDependenciesError);
      expect(error.poCount).toBe(3);
      expect(error.assetCount).toBe(7);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deleteVendor.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteVendor(mockVendor.vendorId);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });
      mockRepository.deleteVendor.mockResolvedValue(false);

      const result = await deleteVendor(mockVendor.vendorId);

      expect(result).toBe(false);
      expect(mockCache.delPattern).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listVendors Tests (Requirement 9.6)
  // ============================================================================

  describe('listVendors', () => {
    const paginatedResult = {
      items: [mockVendor, mockVendorNoCode],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated results (Requirement 9.6)', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await listVendors();

      expect(result).toEqual(paginatedResult);
      expect(result.items).toHaveLength(2);
    });

    it('should use cache for default pagination without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      await listVendors({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listVendors.mockResolvedValue(paginatedResult);

      await listVendors({ vendorType: 'MANUFACTURER' });

      expect(mockRepository.listVendors).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should bypass cache for non-default pagination', async () => {
      mockRepository.listVendors.mockResolvedValue({ ...paginatedResult, page: 2 });

      await listVendors({}, { page: 2, limit: 20 });

      expect(mockRepository.listVendors).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const filters = { vendorType: 'MANUFACTURER' as const, rating: 'APPROVED' as const, isActive: true };
      mockRepository.listVendors.mockResolvedValue(paginatedResult);

      await listVendors(filters);

      expect(mockRepository.listVendors).toHaveBeenCalledWith(filters, {});
    });
  });


  // ============================================================================
  // searchVendors Tests (Requirement 9.7)
  // ============================================================================

  describe('searchVendors', () => {
    const searchResults: VendorDetails[] = [mockVendor, mockVendorNoCode];

    it('should return matching vendors (Requirement 9.7)', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      const result = await searchVendors('Acme');

      expect(result).toEqual(searchResults);
      expect(result).toHaveLength(2);
    });

    it('should use cache for search results', async () => {
      mockCache.getOrSet.mockResolvedValue(searchResults);

      await searchVendors('Acme');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'search:vendor:acme',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.searchVendors.mockResolvedValue(searchResults);

      const result = await searchVendors('Acme');

      expect(result).toEqual(searchResults);
      expect(mockRepository.searchVendors).toHaveBeenCalledWith('Acme');
    });

    it('should return empty array when no matches', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await searchVendors('NonExistent');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // updateVendorRating Tests (Requirement 9.4)
  // ============================================================================

  describe('updateVendorRating', () => {
    const updatedVendorWithNewRating: VendorDetails = {
      ...mockVendor,
      rating: 'PREFERRED',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update rating and publish VENDOR_RATING_CHANGED event (Requirement 9.4)', async () => {
      mockRepository.updateVendorRating.mockResolvedValue({
        vendor: updatedVendorWithNewRating,
        previousRating: 'APPROVED',
      });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateVendorRating(mockVendor.vendorId, 'PREFERRED');

      expect(result.rating).toBe('PREFERRED');
      expect(mockRepository.updateVendorRating).toHaveBeenCalledWith(
        mockVendor.vendorId,
        'PREFERRED',
        undefined
      );
    });

    it('should update rating with userId', async () => {
      const userId = 'user-123';
      mockRepository.updateVendorRating.mockResolvedValue({
        vendor: updatedVendorWithNewRating,
        previousRating: 'APPROVED',
      });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendorRating(mockVendor.vendorId, 'PREFERRED', userId);

      expect(mockRepository.updateVendorRating).toHaveBeenCalledWith(
        mockVendor.vendorId,
        'PREFERRED',
        userId
      );
    });

    it('should throw VendorNotFoundError if not found', async () => {
      mockRepository.updateVendorRating.mockResolvedValue(null);

      await expect(updateVendorRating('nonexistent-id', 'PREFERRED')).rejects.toThrow(VendorNotFoundError);
    });

    it('should include previous rating in event', async () => {
      const userId = 'user-123';
      mockRepository.updateVendorRating.mockResolvedValue({
        vendor: updatedVendorWithNewRating,
        previousRating: 'APPROVED',
      });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendorRating(mockVendor.vendorId, 'PREFERRED', userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('VENDOR_RATING_CHANGED', {
        vendorId: updatedVendorWithNewRating.vendorId,
        vendorName: updatedVendorWithNewRating.vendorName,
        previousRating: 'APPROVED',
        newRating: 'PREFERRED',
        changedBy: userId,
      });
    });

    it('should invalidate cache after rating change', async () => {
      mockRepository.updateVendorRating.mockResolvedValue({
        vendor: updatedVendorWithNewRating,
        previousRating: 'APPROVED',
      });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateVendorRating(mockVendor.vendorId, 'PREFERRED');

      expect(mockCache.delPattern).toHaveBeenCalled();
    });
  });


  // ============================================================================
  // getVendorsByType Tests (Requirement 9.6)
  // ============================================================================

  describe('getVendorsByType', () => {
    const manufacturerVendors: VendorDetails[] = [mockVendor];

    it('should return vendors of specified type', async () => {
      mockCache.getOrSet.mockResolvedValue(manufacturerVendors);

      const result = await getVendorsByType('MANUFACTURER');

      expect(result).toEqual(manufacturerVendors);
      expect(result).toHaveLength(1);
    });

    it('should use cache with type-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(manufacturerVendors);

      await getVendorsByType('MANUFACTURER');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:type:MANUFACTURER',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorsByType.mockResolvedValue(manufacturerVendors);

      const result = await getVendorsByType('MANUFACTURER');

      expect(result).toEqual(manufacturerVendors);
      expect(mockRepository.getVendorsByType).toHaveBeenCalledWith('MANUFACTURER');
    });

    it('should return empty array when no vendors of type', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getVendorsByType('CONSULTANT');

      expect(result).toEqual([]);
    });
  });


  // ============================================================================
  // getVendorsByRating Tests (Requirement 9.6)
  // ============================================================================

  describe('getVendorsByRating', () => {
    const preferredVendors: VendorDetails[] = [mockVendorNoCode];

    it('should return vendors with specified rating', async () => {
      mockCache.getOrSet.mockResolvedValue(preferredVendors);

      const result = await getVendorsByRating('PREFERRED');

      expect(result).toEqual(preferredVendors);
      expect(result).toHaveLength(1);
    });

    it('should use cache with rating-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(preferredVendors);

      await getVendorsByRating('PREFERRED');

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:rating:PREFERRED',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorsByRating.mockResolvedValue(preferredVendors);

      const result = await getVendorsByRating('PREFERRED');

      expect(result).toEqual(preferredVendors);
      expect(mockRepository.getVendorsByRating).toHaveBeenCalledWith('PREFERRED');
    });

    it('should return empty array when no vendors with rating', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getVendorsByRating('BLACKLISTED');

      expect(result).toEqual([]);
    });
  });


  // ============================================================================
  // getVendorsForPurchasing Tests
  // ============================================================================

  describe('getVendorsForPurchasing', () => {
    const purchasingVendors: VendorDetails[] = [mockVendor, mockVendorNoCode];

    it('should return vendors eligible for POs', async () => {
      mockCache.getOrSet.mockResolvedValue(purchasingVendors);

      const result = await getVendorsForPurchasing();

      expect(result).toEqual(purchasingVendors);
      expect(result).toHaveLength(2);
    });

    it('should use cache with purchasing key', async () => {
      mockCache.getOrSet.mockResolvedValue(purchasingVendors);

      await getVendorsForPurchasing();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:purchasing',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getVendorsForPurchasing.mockResolvedValue(purchasingVendors);

      const result = await getVendorsForPurchasing();

      expect(result).toEqual(purchasingVendors);
      expect(mockRepository.getVendorsForPurchasing).toHaveBeenCalled();
    });
  });


  // ============================================================================
  // getAllVendors Tests
  // ============================================================================

  describe('getAllVendors', () => {
    const allVendors: VendorDetails[] = [mockVendor, mockVendorNoCode, mockInactiveVendor];

    it('should return all vendors', async () => {
      mockCache.getOrSet.mockResolvedValue(allVendors);

      const result = await getAllVendors();

      expect(result).toEqual(allVendors);
      expect(result).toHaveLength(3);
    });

    it('should use cache with all vendors key', async () => {
      mockCache.getOrSet.mockResolvedValue(allVendors);

      await getAllVendors();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:all',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getAllVendors.mockResolvedValue(allVendors);

      const result = await getAllVendors();

      expect(result).toEqual(allVendors);
      expect(mockRepository.getAllVendors).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getActiveVendors Tests
  // ============================================================================

  describe('getActiveVendors', () => {
    const activeVendors: VendorDetails[] = [mockVendor, mockVendorNoCode];

    it('should return only active vendors', async () => {
      mockCache.getOrSet.mockResolvedValue(activeVendors);

      const result = await getActiveVendors();

      expect(result).toEqual(activeVendors);
      expect(result.every(v => v.isActive)).toBe(true);
    });

    it('should use cache with active vendors key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeVendors);

      await getActiveVendors();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:active',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });
  });


  // ============================================================================
  // getPreferredVendors Tests
  // ============================================================================

  describe('getPreferredVendors', () => {
    const preferredVendors: VendorDetails[] = [mockVendorNoCode];

    it('should return preferred vendors', async () => {
      mockCache.getOrSet.mockResolvedValue(preferredVendors);

      const result = await getPreferredVendors();

      expect(result).toEqual(preferredVendors);
    });

    it('should use cache with preferred vendors key', async () => {
      mockCache.getOrSet.mockResolvedValue(preferredVendors);

      await getPreferredVendors();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:preferred',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });
  });

  // ============================================================================
  // getApprovedVendors Tests
  // ============================================================================

  describe('getApprovedVendors', () => {
    const approvedVendors: VendorDetails[] = [mockVendor, mockVendorNoCode];

    it('should return approved vendors (PREFERRED or APPROVED rating)', async () => {
      mockCache.getOrSet.mockResolvedValue(approvedVendors);

      const result = await getApprovedVendors();

      expect(result).toEqual(approvedVendors);
    });

    it('should use cache with approved vendors key', async () => {
      mockCache.getOrSet.mockResolvedValue(approvedVendors);

      await getApprovedVendors();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'vendor:approved',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });
  });


  // ============================================================================
  // isVendorCodeUnique Tests
  // ============================================================================

  describe('isVendorCodeUnique', () => {
    it('should return true for unique code', async () => {
      mockRepository.vendorCodeExists.mockResolvedValue(false);

      const result = await isVendorCodeUnique('NEW-CODE');

      expect(result).toBe(true);
      expect(mockRepository.vendorCodeExists).toHaveBeenCalledWith('NEW-CODE', undefined);
    });

    it('should return false when code exists', async () => {
      mockRepository.vendorCodeExists.mockResolvedValue(true);

      const result = await isVendorCodeUnique('EXISTING-CODE');

      expect(result).toBe(false);
    });

    it('should exclude specific vendor ID when checking uniqueness', async () => {
      const excludeVendorId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.vendorCodeExists.mockResolvedValue(false);

      const result = await isVendorCodeUnique('VEND-001', excludeVendorId);

      expect(result).toBe(true);
      expect(mockRepository.vendorCodeExists).toHaveBeenCalledWith('VEND-001', excludeVendorId);
    });
  });


  // ============================================================================
  // reactivateVendor Tests
  // ============================================================================

  describe('reactivateVendor', () => {
    const reactivatedVendor: VendorDetails = {
      ...mockInactiveVendor,
      isActive: true,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should reactivate vendor successfully', async () => {
      mockRepository.getVendorById.mockResolvedValue(mockInactiveVendor);
      mockRepository.updateVendor.mockResolvedValue(reactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reactivateVendor(mockInactiveVendor.vendorId);

      expect(result.isActive).toBe(true);
      expect(mockRepository.updateVendor).toHaveBeenCalledWith(
        mockInactiveVendor.vendorId,
        { isActive: true },
        undefined
      );
    });

    it('should throw VendorNotFoundError when vendor does not exist', async () => {
      mockRepository.getVendorById.mockResolvedValue(null);

      await expect(reactivateVendor('nonexistent-id')).rejects.toThrow(VendorNotFoundError);
    });

    it('should publish VENDOR_UPDATED event after reactivation', async () => {
      const userId = 'user-123';
      mockRepository.getVendorById.mockResolvedValue(mockInactiveVendor);
      mockRepository.updateVendor.mockResolvedValue(reactivatedVendor);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateVendor(mockInactiveVendor.vendorId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('VENDOR_UPDATED', {
        vendorId: reactivatedVendor.vendorId,
        vendorName: reactivatedVendor.vendorName,
        changes: [{ field: 'isActive', oldValue: false, newValue: true }],
        updatedBy: userId,
      });
    });
  });


  // ============================================================================
  // canReceivePurchaseOrders Tests
  // ============================================================================

  describe('canReceivePurchaseOrders', () => {
    it('should return true for active vendor with approved rating', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);

      const result = await canReceivePurchaseOrders(mockVendor.vendorId);

      expect(result).toBe(true);
    });

    it('should return false for non-existent vendor', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      const result = await canReceivePurchaseOrders('nonexistent-id');

      expect(result).toBe(false);
    });

    it('should return false for inactive vendor', async () => {
      mockCache.getOrSet.mockResolvedValue(mockInactiveVendor);

      const result = await canReceivePurchaseOrders(mockInactiveVendor.vendorId);

      expect(result).toBe(false);
    });

    it('should return false for suspended vendor', async () => {
      mockCache.getOrSet.mockResolvedValue(mockSuspendedVendor);

      const result = await canReceivePurchaseOrders(mockSuspendedVendor.vendorId);

      expect(result).toBe(false);
    });

    it('should return false for blacklisted vendor', async () => {
      const blacklistedVendor: VendorDetails = { ...mockVendor, rating: 'BLACKLISTED' };
      mockCache.getOrSet.mockResolvedValue(blacklistedVendor);

      const result = await canReceivePurchaseOrders(blacklistedVendor.vendorId);

      expect(result).toBe(false);
    });

    it('should return true for vendor with null rating', async () => {
      const noRatingVendor: VendorDetails = { ...mockVendor, rating: null };
      mockCache.getOrSet.mockResolvedValue(noRatingVendor);

      const result = await canReceivePurchaseOrders(noRatingVendor.vendorId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // getVendorSummary Tests
  // ============================================================================

  describe('getVendorSummary', () => {
    it('should return vendor summary with dependency counts', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 5, assetCount: 3 });

      const result = await getVendorSummary(mockVendor.vendorId);

      expect(result).not.toBeNull();
      expect(result!.vendor).toEqual(mockVendor);
      expect(result!.poCount).toBe(5);
      expect(result!.assetCount).toBe(3);
      expect(result!.canDelete).toBe(false);
      expect(result!.canReceivePOs).toBe(true);
    });

    it('should return null for non-existent vendor', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      const result = await getVendorSummary('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should indicate canDelete true when no dependencies', async () => {
      mockCache.getOrSet.mockResolvedValue(mockVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });

      const result = await getVendorSummary(mockVendor.vendorId);

      expect(result).not.toBeNull();
      expect(result!.canDelete).toBe(true);
    });

    it('should indicate canReceivePOs false for suspended vendor', async () => {
      mockCache.getOrSet.mockResolvedValue(mockSuspendedVendor);
      mockRepository.getVendorDependencies.mockResolvedValue({ poCount: 0, assetCount: 0 });

      const result = await getVendorSummary(mockSuspendedVendor.vendorId);

      expect(result).not.toBeNull();
      expect(result!.canReceivePOs).toBe(false);
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('VendorNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new VendorNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('VendorNotFoundError');
        expect(error.message).toBe('Vendor not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('VendorCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new VendorCodeExistsError('VEND-001');

        expect(error.name).toBe('VendorCodeExistsError');
        expect(error.message).toBe("Vendor code 'VEND-001' already exists");
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('VendorHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new VendorHasDependenciesError('111e4567-e89b-12d3-a456-426614174000', 5, 10);

        expect(error.name).toBe('VendorHasDependenciesError');
        expect(error.message).toContain('has 5 purchase order(s) and 10 asset(s)');
        expect(error.poCount).toBe(5);
        expect(error.assetCount).toBe(10);
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
