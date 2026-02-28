/**
 * Cost Center Service Unit Tests
 *
 * Tests for the Cost Center Service business logic layer.
 * Requirements:
 * - Requirement 8.1: Create cost center with code, name, department, and budget amount
 * - Requirement 8.2: Return cost center details including budget, spent, and available amounts
 * - Requirement 8.3: Update budget or department assignment and recalculate available amount
 * - Requirement 8.4: Mark cost center as inactive and prevent new expense allocations
 * - Requirement 8.5: Return paginated list with budget utilization percentages
 * - Requirement 8.6: Reject deletion if has allocated expenses
 */

// Mock the dependencies before importing service
jest.mock('../reference-data/cost-center-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    COST_CENTER: 'cost_center',
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

import type { CostCenterDetails, CreateCostCenterRequest, UpdateCostCenterRequest } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../reference-data/cost-center-repository';
import {
  createCostCenter,
  getCostCenterById,
  getCostCenterOrThrow,
  updateCostCenter,
  deactivateCostCenter,
  deleteCostCenter,
  listCostCenters,
  recordExpense,
  getCostCenterUtilization,
  getCostCentersByDepartment,
  isCostCenterCodeUnique,
  getAllCostCenters,
  getActiveCostCenters,
  getCostCentersByFiscalYear,
  reactivateCostCenter,
  getCostCenterBudgetSummary,
  CostCenterNotFoundError,
  CostCenterCodeExistsError,
  CostCenterHasDependenciesError,
  CostCenterInactiveError,
} from '../reference-data/cost-center-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockCostCenter: CostCenterDetails = {
  costCenterId: '111e4567-e89b-12d3-a456-426614174000',
  code: 'CC-001',
  name: 'Engineering Budget',
  departmentId: '222e4567-e89b-12d3-a456-426614174000',
  budgetAmount: 100000,
  spentAmount: 25000,
  availableAmount: 75000,
  fiscalYear: 2024,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockCostCenterNoBudget: CostCenterDetails = {
  costCenterId: '333e4567-e89b-12d3-a456-426614174000',
  code: 'CC-002',
  name: 'Marketing Budget',
  departmentId: null,
  budgetAmount: 0,
  spentAmount: 0,
  availableAmount: 0,
  fiscalYear: 2024,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};


const validCreateRequest: CreateCostCenterRequest = {
  code: 'CC-001',
  name: 'Engineering Budget',
  departmentId: '222e4567-e89b-12d3-a456-426614174000',
  budgetAmount: 100000,
  fiscalYear: 2024,
};

const validCreateRequestNoDepartment: CreateCostCenterRequest = {
  code: 'CC-003',
  name: 'General Budget',
  budgetAmount: 50000,
  fiscalYear: 2024,
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'COST_CENTER_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};

describe('Cost Center Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });

  // ============================================================================
  // createCostCenter Tests (Requirement 8.1)
  // ============================================================================

  describe('createCostCenter', () => {
    it('should create cost center and publish event (Requirement 8.1)', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(mockCostCenter);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createCostCenter(validCreateRequest);

      expect(result).toEqual(mockCostCenter);
      expect(mockRepository.costCenterCodeExists).toHaveBeenCalledWith('CC-001');
      expect(mockRepository.createCostCenter).toHaveBeenCalledWith(validCreateRequest, undefined);
    });


    it('should create cost center with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(mockCostCenter);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createCostCenter(validCreateRequest, userId);

      expect(mockRepository.createCostCenter).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw CostCenterCodeExistsError for duplicate code', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(true);

      await expect(createCostCenter(validCreateRequest)).rejects.toThrow(CostCenterCodeExistsError);
      await expect(createCostCenter(validCreateRequest)).rejects.toThrow(
        "Cost center code 'CC-001' already exists"
      );
      expect(mockRepository.createCostCenter).not.toHaveBeenCalled();
    });

    it('should create cost center without department', async () => {
      const costCenterNoDept = { ...mockCostCenter, departmentId: null };
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(costCenterNoDept);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createCostCenter(validCreateRequestNoDepartment);

      expect(result.departmentId).toBeNull();
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(mockCostCenter);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createCostCenter(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('cost_center:list');
    });


    it('should invalidate department cache when creating with department', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(mockCostCenter);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createCostCenter(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith(
        `cost_center:department:${validCreateRequest.departmentId}`
      );
    });

    it('should publish COST_CENTER_CREATED event after creation', async () => {
      const userId = 'user-123';
      mockRepository.costCenterCodeExists.mockResolvedValue(false);
      mockRepository.createCostCenter.mockResolvedValue(mockCostCenter);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createCostCenter(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('COST_CENTER_CREATED', {
        costCenterId: mockCostCenter.costCenterId,
        code: mockCostCenter.code,
        name: mockCostCenter.name,
        budgetAmount: mockCostCenter.budgetAmount,
        createdBy: userId,
      });
    });
  });

  // ============================================================================
  // getCostCenterById Tests (Requirement 8.2)
  // ============================================================================

  describe('getCostCenterById', () => {
    it('should return cost center from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockCostCenter);

      const result = await getCostCenterById(mockCostCenter.costCenterId);

      expect(result).toEqual(mockCostCenter);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `cost_center:${mockCostCenter.costCenterId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });


    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);

      const result = await getCostCenterById(mockCostCenter.costCenterId);

      expect(result).toEqual(mockCostCenter);
      expect(mockRepository.getCostCenterById).toHaveBeenCalledWith(mockCostCenter.costCenterId);
    });

    it('should return null for non-existent cost center', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getCostCenterById.mockResolvedValue(null);

      const result = await getCostCenterById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getCostCenterOrThrow Tests
  // ============================================================================

  describe('getCostCenterOrThrow', () => {
    it('should return cost center when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockCostCenter);

      const result = await getCostCenterOrThrow(mockCostCenter.costCenterId);

      expect(result).toEqual(mockCostCenter);
    });

    it('should throw CostCenterNotFoundError when cost center not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getCostCenterOrThrow('nonexistent-id')).rejects.toThrow(CostCenterNotFoundError);
      await expect(getCostCenterOrThrow('nonexistent-id')).rejects.toThrow(
        'Cost center not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // updateCostCenter Tests (Requirement 8.3)
  // ============================================================================

  describe('updateCostCenter', () => {
    const updateRequest: UpdateCostCenterRequest = {
      name: 'Updated Engineering Budget',
      budgetAmount: 150000,
    };

    const updatedCostCenter: CostCenterDetails = {
      ...mockCostCenter,
      name: 'Updated Engineering Budget',
      budgetAmount: 150000,
      availableAmount: 125000,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update cost center and invalidate cache (Requirement 8.3)', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(updatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateCostCenter(mockCostCenter.costCenterId, updateRequest);

      expect(result).toEqual(updatedCostCenter);
      expect(mockRepository.getCostCenterById).toHaveBeenCalledWith(mockCostCenter.costCenterId);
      expect(mockRepository.updateCostCenter).toHaveBeenCalledWith(
        mockCostCenter.costCenterId,
        updateRequest,
        undefined
      );
    });

    it('should update cost center with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(updatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateCostCenter(mockCostCenter.costCenterId, updateRequest, userId);

      expect(mockRepository.updateCostCenter).toHaveBeenCalledWith(
        mockCostCenter.costCenterId,
        updateRequest,
        userId
      );
    });


    it('should throw CostCenterNotFoundError for non-existent cost center', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(null);

      await expect(updateCostCenter('nonexistent-id', updateRequest)).rejects.toThrow(CostCenterNotFoundError);
      expect(mockRepository.updateCostCenter).not.toHaveBeenCalled();
    });

    it('should throw CostCenterNotFoundError when update returns null', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(null);

      await expect(updateCostCenter(mockCostCenter.costCenterId, updateRequest)).rejects.toThrow(CostCenterNotFoundError);
    });

    it('should invalidate new department cache when department changes', async () => {
      const newDepartmentId = '444e4567-e89b-12d3-a456-426614174000';
      const updateWithDepartment: UpdateCostCenterRequest = { departmentId: newDepartmentId };
      const updatedWithDepartment: CostCenterDetails = { ...mockCostCenter, departmentId: newDepartmentId };
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(updatedWithDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateCostCenter(mockCostCenter.costCenterId, updateWithDepartment);

      expect(mockCache.del).toHaveBeenCalledWith(`cost_center:department:${newDepartmentId}`);
    });

    it('should publish COST_CENTER_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(updatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateCostCenter(mockCostCenter.costCenterId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('COST_CENTER_UPDATED', expect.objectContaining({
        costCenterId: updatedCostCenter.costCenterId,
        code: updatedCostCenter.code,
        updatedBy: userId,
      }));
    });
  });


  // ============================================================================
  // deactivateCostCenter Tests (Requirement 8.4)
  // ============================================================================

  describe('deactivateCostCenter', () => {
    const deactivatedCostCenter: CostCenterDetails = {
      ...mockCostCenter,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate cost center successfully (Requirement 8.4)', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deactivateCostCenter.mockResolvedValue(deactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateCostCenter(mockCostCenter.costCenterId);

      expect(result).toEqual(deactivatedCostCenter);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateCostCenter).toHaveBeenCalledWith(mockCostCenter.costCenterId, undefined);
    });

    it('should deactivate cost center with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deactivateCostCenter.mockResolvedValue(deactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateCostCenter(mockCostCenter.costCenterId, userId);

      expect(mockRepository.deactivateCostCenter).toHaveBeenCalledWith(mockCostCenter.costCenterId, userId);
    });


    it('should throw CostCenterNotFoundError when cost center does not exist', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(null);

      await expect(deactivateCostCenter('nonexistent-id')).rejects.toThrow(CostCenterNotFoundError);
      expect(mockRepository.deactivateCostCenter).not.toHaveBeenCalled();
    });

    it('should throw CostCenterNotFoundError when deactivate returns null', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deactivateCostCenter.mockResolvedValue(null);

      await expect(deactivateCostCenter(mockCostCenter.costCenterId)).rejects.toThrow(CostCenterNotFoundError);
    });

    it('should still deactivate cost center with dependencies (warning only)', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 5, poCount: 3 });
      mockRepository.deactivateCostCenter.mockResolvedValue(deactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateCostCenter(mockCostCenter.costCenterId);

      expect(result.isActive).toBe(false);
    });

    it('should publish COST_CENTER_UPDATED event after deactivation', async () => {
      const userId = 'user-123';
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deactivateCostCenter.mockResolvedValue(deactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateCostCenter(mockCostCenter.costCenterId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('COST_CENTER_UPDATED', {
        costCenterId: deactivatedCostCenter.costCenterId,
        code: deactivatedCostCenter.code,
        changes: [{ field: 'isActive', oldValue: true, newValue: false }],
        updatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteCostCenter Tests (Requirement 8.6)
  // ============================================================================

  describe('deleteCostCenter', () => {
    it('should delete cost center when no dependencies', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deleteCostCenter.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteCostCenter(mockCostCenter.costCenterId);

      expect(result).toBe(true);
      expect(mockRepository.deleteCostCenter).toHaveBeenCalledWith(mockCostCenter.costCenterId);
    });

    it('should throw CostCenterNotFoundError when cost center does not exist', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(null);

      await expect(deleteCostCenter('nonexistent-id')).rejects.toThrow(CostCenterNotFoundError);
      expect(mockRepository.getCostCenterDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteCostCenter).not.toHaveBeenCalled();
    });

    it('should throw CostCenterHasDependenciesError when has assets (Requirement 8.6)', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 5, poCount: 0 });

      await expect(deleteCostCenter(mockCostCenter.costCenterId)).rejects.toThrow(CostCenterHasDependenciesError);
      await expect(deleteCostCenter(mockCostCenter.costCenterId)).rejects.toThrow(/has 5 asset\(s\) and 0 purchase order\(s\)/);
      expect(mockRepository.deleteCostCenter).not.toHaveBeenCalled();
    });


    it('should throw CostCenterHasDependenciesError when has purchase orders (Requirement 8.6)', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 10 });

      await expect(deleteCostCenter(mockCostCenter.costCenterId)).rejects.toThrow(CostCenterHasDependenciesError);
      await expect(deleteCostCenter(mockCostCenter.costCenterId)).rejects.toThrow(/has 0 asset\(s\) and 10 purchase order\(s\)/);
      expect(mockRepository.deleteCostCenter).not.toHaveBeenCalled();
    });

    it('should throw CostCenterHasDependenciesError when has both assets and POs', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 3, poCount: 7 });

      const error = await deleteCostCenter(mockCostCenter.costCenterId).catch((e) => e);

      expect(error).toBeInstanceOf(CostCenterHasDependenciesError);
      expect(error.assetCount).toBe(3);
      expect(error.poCount).toBe(7);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deleteCostCenter.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteCostCenter(mockCostCenter.costCenterId);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.getCostCenterDependencies.mockResolvedValue({ assetCount: 0, poCount: 0 });
      mockRepository.deleteCostCenter.mockResolvedValue(false);

      const result = await deleteCostCenter(mockCostCenter.costCenterId);

      expect(result).toBe(false);
      expect(mockCache.delPattern).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // listCostCenters Tests (Requirement 8.5)
  // ============================================================================

  describe('listCostCenters', () => {
    const paginatedResult = {
      items: [mockCostCenter, mockCostCenterNoBudget],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated results (Requirement 8.5)', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await listCostCenters();

      expect(result).toEqual(paginatedResult);
      expect(result.items).toHaveLength(2);
    });

    it('should use cache for default pagination without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      await listCostCenters({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'cost_center:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listCostCenters.mockResolvedValue(paginatedResult);

      await listCostCenters({ departmentId: '222e4567-e89b-12d3-a456-426614174000' });

      expect(mockRepository.listCostCenters).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should bypass cache for non-default pagination', async () => {
      mockRepository.listCostCenters.mockResolvedValue({ ...paginatedResult, page: 2 });

      await listCostCenters({}, { page: 2, limit: 20 });

      expect(mockRepository.listCostCenters).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const filters = { departmentId: '222e4567-e89b-12d3-a456-426614174000', fiscalYear: 2024, isActive: true };
      mockRepository.listCostCenters.mockResolvedValue(paginatedResult);

      await listCostCenters(filters);

      expect(mockRepository.listCostCenters).toHaveBeenCalledWith(filters, {});
    });
  });


  // ============================================================================
  // recordExpense Tests (Requirement 8.4)
  // ============================================================================

  describe('recordExpense', () => {
    const expenseAmount = 5000;
    const updatedAfterExpense: CostCenterDetails = {
      ...mockCostCenter,
      spentAmount: 30000,
      availableAmount: 70000,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should record expense and update spent amount', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.recordExpense.mockResolvedValue(updatedAfterExpense);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await recordExpense(mockCostCenter.costCenterId, expenseAmount);

      expect(result.spentAmount).toBe(30000);
      expect(result.availableAmount).toBe(70000);
      expect(mockRepository.recordExpense).toHaveBeenCalledWith(mockCostCenter.costCenterId, expenseAmount);
    });

    it('should throw CostCenterNotFoundError if not found', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(null);

      await expect(recordExpense('nonexistent-id', expenseAmount)).rejects.toThrow(CostCenterNotFoundError);
      expect(mockRepository.recordExpense).not.toHaveBeenCalled();
    });

    it('should throw CostCenterInactiveError if inactive', async () => {
      const inactiveCostCenter = { ...mockCostCenter, isActive: false };
      mockRepository.getCostCenterById.mockResolvedValue(inactiveCostCenter);

      await expect(recordExpense(mockCostCenter.costCenterId, expenseAmount)).rejects.toThrow(CostCenterInactiveError);
      await expect(recordExpense(mockCostCenter.costCenterId, expenseAmount)).rejects.toThrow('is inactive and cannot accept new expenses');
      expect(mockRepository.recordExpense).not.toHaveBeenCalled();
    });


    it('should allow expense that exceeds budget (warning only)', async () => {
      const largeExpense = 100000;
      const overBudgetResult: CostCenterDetails = { ...mockCostCenter, spentAmount: 125000, availableAmount: -25000 };
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.recordExpense.mockResolvedValue(overBudgetResult);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await recordExpense(mockCostCenter.costCenterId, largeExpense);

      expect(result.spentAmount).toBe(125000);
      expect(result.availableAmount).toBe(-25000);
    });

    it('should publish COST_CENTER_UPDATED event after recording expense', async () => {
      const userId = 'user-123';
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.recordExpense.mockResolvedValue(updatedAfterExpense);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await recordExpense(mockCostCenter.costCenterId, expenseAmount, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('COST_CENTER_UPDATED', expect.objectContaining({
        costCenterId: updatedAfterExpense.costCenterId,
        code: updatedAfterExpense.code,
        updatedBy: userId,
      }));
    });

    it('should invalidate cache after recording expense', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(mockCostCenter);
      mockRepository.recordExpense.mockResolvedValue(updatedAfterExpense);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await recordExpense(mockCostCenter.costCenterId, expenseAmount);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });
  });


  // ============================================================================
  // getCostCenterUtilization Tests
  // ============================================================================

  describe('getCostCenterUtilization', () => {
    it('should calculate utilization percentage correctly', async () => {
      mockRepository.getCostCenterUtilization.mockResolvedValue(25);

      const result = await getCostCenterUtilization(mockCostCenter.costCenterId);

      expect(result).toBe(25);
      expect(mockRepository.getCostCenterUtilization).toHaveBeenCalledWith(mockCostCenter.costCenterId);
    });

    it('should return null for non-existent cost center', async () => {
      mockRepository.getCostCenterUtilization.mockResolvedValue(null);

      const result = await getCostCenterUtilization('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should return 0 for cost center with zero budget', async () => {
      mockRepository.getCostCenterUtilization.mockResolvedValue(0);

      const result = await getCostCenterUtilization(mockCostCenterNoBudget.costCenterId);

      expect(result).toBe(0);
    });

    it('should return over 100 for over-budget cost center', async () => {
      mockRepository.getCostCenterUtilization.mockResolvedValue(125);

      const result = await getCostCenterUtilization(mockCostCenter.costCenterId);

      expect(result).toBe(125);
    });
  });


  // ============================================================================
  // getCostCentersByDepartment Tests
  // ============================================================================

  describe('getCostCentersByDepartment', () => {
    const departmentCostCenters: CostCenterDetails[] = [
      mockCostCenter,
      { ...mockCostCenter, costCenterId: '444e4567-e89b-12d3-a456-426614174000', code: 'CC-004', name: 'Engineering R&D' },
    ];

    it('should return cost centers for department', async () => {
      mockCache.getOrSet.mockResolvedValue(departmentCostCenters);

      const result = await getCostCentersByDepartment(mockCostCenter.departmentId!);

      expect(result).toEqual(departmentCostCenters);
      expect(result).toHaveLength(2);
    });

    it('should use cache with department-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(departmentCostCenters);

      await getCostCentersByDepartment(mockCostCenter.departmentId!);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `cost_center:department:${mockCostCenter.departmentId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getCostCentersByDepartment.mockResolvedValue(departmentCostCenters);

      const result = await getCostCentersByDepartment(mockCostCenter.departmentId!);

      expect(result).toEqual(departmentCostCenters);
      expect(mockRepository.getCostCentersByDepartment).toHaveBeenCalledWith(mockCostCenter.departmentId);
    });

    it('should return empty array when no cost centers for department', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getCostCentersByDepartment('555e4567-e89b-12d3-a456-426614174000');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // isCostCenterCodeUnique Tests
  // ============================================================================

  describe('isCostCenterCodeUnique', () => {
    it('should return true for unique code', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(false);

      const result = await isCostCenterCodeUnique('NEW-CODE');

      expect(result).toBe(true);
      expect(mockRepository.costCenterCodeExists).toHaveBeenCalledWith('NEW-CODE', undefined);
    });

    it('should return false when code exists', async () => {
      mockRepository.costCenterCodeExists.mockResolvedValue(true);

      const result = await isCostCenterCodeUnique('EXISTING-CODE');

      expect(result).toBe(false);
    });

    it('should exclude specific cost center ID when checking uniqueness', async () => {
      const excludeCostCenterId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.costCenterCodeExists.mockResolvedValue(false);

      const result = await isCostCenterCodeUnique('CC-001', excludeCostCenterId);

      expect(result).toBe(true);
      expect(mockRepository.costCenterCodeExists).toHaveBeenCalledWith('CC-001', excludeCostCenterId);
    });
  });


  // ============================================================================
  // getAllCostCenters Tests
  // ============================================================================

  describe('getAllCostCenters', () => {
    const allCostCenters: CostCenterDetails[] = [mockCostCenter, mockCostCenterNoBudget];

    it('should return all cost centers', async () => {
      mockCache.getOrSet.mockResolvedValue(allCostCenters);

      const result = await getAllCostCenters();

      expect(result).toEqual(allCostCenters);
      expect(result).toHaveLength(2);
    });

    it('should use cache with all cost centers key', async () => {
      mockCache.getOrSet.mockResolvedValue(allCostCenters);

      await getAllCostCenters();

      expect(mockCache.getOrSet).toHaveBeenCalledWith('cost_center:all', expect.any(Function), { ttl: cache.DEFAULT_TTL.MEDIUM });
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getAllCostCenters.mockResolvedValue(allCostCenters);

      const result = await getAllCostCenters();

      expect(result).toEqual(allCostCenters);
      expect(mockRepository.getAllCostCenters).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getActiveCostCenters Tests
  // ============================================================================

  describe('getActiveCostCenters', () => {
    const activeCostCenters: CostCenterDetails[] = [mockCostCenter];

    it('should return only active cost centers', async () => {
      mockCache.getOrSet.mockResolvedValue(activeCostCenters);

      const result = await getActiveCostCenters();

      expect(result).toEqual(activeCostCenters);
      expect(result.every(cc => cc.isActive)).toBe(true);
    });

    it('should use cache with active cost centers key', async () => {
      mockCache.getOrSet.mockResolvedValue(activeCostCenters);

      await getActiveCostCenters();

      expect(mockCache.getOrSet).toHaveBeenCalledWith('cost_center:active', expect.any(Function), { ttl: cache.DEFAULT_TTL.MEDIUM });
    });
  });


  // ============================================================================
  // getCostCentersByFiscalYear Tests
  // ============================================================================

  describe('getCostCentersByFiscalYear', () => {
    const fiscalYearCostCenters: CostCenterDetails[] = [mockCostCenter, mockCostCenterNoBudget];

    it('should return cost centers for fiscal year', async () => {
      mockCache.getOrSet.mockResolvedValue(fiscalYearCostCenters);

      const result = await getCostCentersByFiscalYear(2024);

      expect(result).toEqual(fiscalYearCostCenters);
      expect(result).toHaveLength(2);
    });

    it('should use cache with fiscal year key', async () => {
      mockCache.getOrSet.mockResolvedValue(fiscalYearCostCenters);

      await getCostCentersByFiscalYear(2024);

      expect(mockCache.getOrSet).toHaveBeenCalledWith('cost_center:fiscal:2024', expect.any(Function), { ttl: cache.DEFAULT_TTL.MEDIUM });
    });
  });

  // ============================================================================
  // reactivateCostCenter Tests
  // ============================================================================

  describe('reactivateCostCenter', () => {
    const inactiveCostCenter: CostCenterDetails = { ...mockCostCenter, isActive: false };
    const reactivatedCostCenter: CostCenterDetails = { ...mockCostCenter, isActive: true, updatedAt: '2024-01-15T12:00:00.000Z' };

    it('should reactivate cost center successfully', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(inactiveCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(reactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reactivateCostCenter(mockCostCenter.costCenterId);

      expect(result.isActive).toBe(true);
      expect(mockRepository.updateCostCenter).toHaveBeenCalledWith(mockCostCenter.costCenterId, { isActive: true }, undefined);
    });

    it('should throw CostCenterNotFoundError when cost center does not exist', async () => {
      mockRepository.getCostCenterById.mockResolvedValue(null);

      await expect(reactivateCostCenter('nonexistent-id')).rejects.toThrow(CostCenterNotFoundError);
    });


    it('should publish COST_CENTER_UPDATED event after reactivation', async () => {
      const userId = 'user-123';
      mockRepository.getCostCenterById.mockResolvedValue(inactiveCostCenter);
      mockRepository.updateCostCenter.mockResolvedValue(reactivatedCostCenter);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateCostCenter(mockCostCenter.costCenterId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('COST_CENTER_UPDATED', {
        costCenterId: reactivatedCostCenter.costCenterId,
        code: reactivatedCostCenter.code,
        changes: [{ field: 'isActive', oldValue: false, newValue: true }],
        updatedBy: userId,
      });
    });
  });

  // ============================================================================
  // getCostCenterBudgetSummary Tests
  // ============================================================================

  describe('getCostCenterBudgetSummary', () => {
    it('should return budget summary with utilization percentage', async () => {
      mockCache.getOrSet.mockResolvedValue(mockCostCenter);

      const result = await getCostCenterBudgetSummary(mockCostCenter.costCenterId);

      expect(result).not.toBeNull();
      expect(result!.costCenterId).toBe(mockCostCenter.costCenterId);
      expect(result!.budgetAmount).toBe(100000);
      expect(result!.spentAmount).toBe(25000);
      expect(result!.availableAmount).toBe(75000);
      expect(result!.utilizationPercentage).toBe(25);
      expect(result!.isOverBudget).toBe(false);
    });

    it('should return null for non-existent cost center', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      const result = await getCostCenterBudgetSummary('nonexistent-id');

      expect(result).toBeNull();
    });


    it('should return 0 utilization for zero budget', async () => {
      mockCache.getOrSet.mockResolvedValue(mockCostCenterNoBudget);

      const result = await getCostCenterBudgetSummary(mockCostCenterNoBudget.costCenterId);

      expect(result).not.toBeNull();
      expect(result!.utilizationPercentage).toBe(0);
      expect(result!.isOverBudget).toBe(false);
    });

    it('should indicate over budget when spent exceeds budget', async () => {
      const overBudgetCostCenter: CostCenterDetails = { ...mockCostCenter, spentAmount: 120000, availableAmount: -20000 };
      mockCache.getOrSet.mockResolvedValue(overBudgetCostCenter);

      const result = await getCostCenterBudgetSummary(mockCostCenter.costCenterId);

      expect(result).not.toBeNull();
      expect(result!.utilizationPercentage).toBe(120);
      expect(result!.isOverBudget).toBe(true);
    });
  });

  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('CostCenterNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new CostCenterNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('CostCenterNotFoundError');
        expect(error.message).toBe('Cost center not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('CostCenterCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new CostCenterCodeExistsError('CC-001');

        expect(error.name).toBe('CostCenterCodeExistsError');
        expect(error.message).toBe("Cost center code 'CC-001' already exists");
        expect(error).toBeInstanceOf(Error);
      });
    });


    describe('CostCenterHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new CostCenterHasDependenciesError('111e4567-e89b-12d3-a456-426614174000', 5, 10);

        expect(error.name).toBe('CostCenterHasDependenciesError');
        expect(error.message).toContain('has 5 asset(s) and 10 purchase order(s)');
        expect(error.assetCount).toBe(5);
        expect(error.poCount).toBe(10);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('CostCenterInactiveError', () => {
      it('should have correct name and message', () => {
        const error = new CostCenterInactiveError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('CostCenterInactiveError');
        expect(error.message).toContain('is inactive and cannot accept new expenses');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
