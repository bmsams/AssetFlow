/**
 * Department Service Unit Tests
 *
 * Tests for the Department Service business logic layer.
 * Requirements:
 * - Requirement 7.1: Create department with name, code, parent reference
 * - Requirement 7.2: Return all departments with their hierarchy level and child count
 * - Requirement 7.3: Update specified fields and maintain parent relationship
 * - Requirement 7.4: Cascade deactivation to all child departments
 * - Requirement 7.5: Reject creation for non-existent parent, reject deletion if has children or users
 */

// Mock the dependencies before importing service
jest.mock('../reference-data/department-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    DEPARTMENT: 'department',
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

import type {
  CreateDepartmentRequest,
  DepartmentDetails,
  UpdateDepartmentRequest,
} from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../reference-data/department-repository';
import {
  createDepartment,
  getDepartment,
  getDepartmentOrThrow,
  getDepartmentsByParent,
  getAllDepartments,
  updateDepartment,
  deactivateDepartment,
  deleteDepartment,
  isDepartmentCodeUnique,
  getDepartmentHierarchy,
  DepartmentNotFoundError,
  DepartmentCodeExistsError,
  DepartmentHasDependenciesError,
  ParentDepartmentNotFoundError,
  CircularReferenceError,
} from '../reference-data/department-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);


// ============================================================================
// Test Data
// ============================================================================

const mockDepartment: DepartmentDetails = {
  departmentId: '111e4567-e89b-12d3-a456-426614174000',
  code: 'DEPT-001',
  name: 'Engineering',
  parentDepartmentId: null,
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockChildDepartment: DepartmentDetails = {
  departmentId: '222e4567-e89b-12d3-a456-426614174000',
  code: 'DEPT-002',
  name: 'Frontend Team',
  parentDepartmentId: '111e4567-e89b-12d3-a456-426614174000',
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const validCreateRequest: CreateDepartmentRequest = {
  code: 'DEPT-001',
  name: 'Engineering',
};

const validCreateRequestWithParent: CreateDepartmentRequest = {
  code: 'DEPT-002',
  name: 'Frontend Team',
  parentDepartmentId: '111e4567-e89b-12d3-a456-426614174000',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'DEPARTMENT_CREATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};


describe('Department Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default cache mock implementations
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });


  // ============================================================================
  // createDepartment Tests (Requirement 7.1, 7.5)
  // ============================================================================

  describe('createDepartment', () => {
    it('should create department and publish event (Requirement 7.1)', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.createDepartment.mockResolvedValue(mockDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createDepartment(validCreateRequest);

      expect(result).toEqual(mockDepartment);
      expect(mockRepository.departmentCodeExists).toHaveBeenCalledWith('DEPT-001');
      expect(mockRepository.createDepartment).toHaveBeenCalledWith(validCreateRequest, undefined);
    });

    it('should create department with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.createDepartment.mockResolvedValue(mockDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createDepartment(validCreateRequest, userId);

      expect(mockRepository.createDepartment).toHaveBeenCalledWith(validCreateRequest, userId);
    });

    it('should throw DepartmentCodeExistsError for duplicate code', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(true);

      await expect(createDepartment(validCreateRequest)).rejects.toThrow(DepartmentCodeExistsError);
      await expect(createDepartment(validCreateRequest)).rejects.toThrow(
        "Department code 'DEPT-001' already exists"
      );
      expect(mockRepository.createDepartment).not.toHaveBeenCalled();
    });


    it('should throw ParentDepartmentNotFoundError for non-existent parent (Requirement 7.5)', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.parentDepartmentExists.mockResolvedValue(false);

      await expect(createDepartment(validCreateRequestWithParent)).rejects.toThrow(
        ParentDepartmentNotFoundError
      );
      await expect(createDepartment(validCreateRequestWithParent)).rejects.toThrow(
        `Parent department not found: ${validCreateRequestWithParent.parentDepartmentId}`
      );
      expect(mockRepository.createDepartment).not.toHaveBeenCalled();
    });

    it('should create department with valid parent', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.parentDepartmentExists.mockResolvedValue(true);
      mockRepository.createDepartment.mockResolvedValue(mockChildDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await createDepartment(validCreateRequestWithParent);

      expect(result).toEqual(mockChildDepartment);
      expect(mockRepository.parentDepartmentExists).toHaveBeenCalledWith(
        validCreateRequestWithParent.parentDepartmentId
      );
    });

    it('should invalidate cache after creation', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.createDepartment.mockResolvedValue(mockDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createDepartment(validCreateRequest);

      expect(mockCache.del).toHaveBeenCalledWith('department:list');
    });

    it('should invalidate parent cache when creating child department', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.parentDepartmentExists.mockResolvedValue(true);
      mockRepository.createDepartment.mockResolvedValue(mockChildDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createDepartment(validCreateRequestWithParent);

      expect(mockCache.del).toHaveBeenCalledWith(
        `department:parent:${validCreateRequestWithParent.parentDepartmentId}`
      );
    });


    it('should publish DEPARTMENT_CREATED event after creation', async () => {
      const userId = 'user-123';
      mockRepository.departmentCodeExists.mockResolvedValue(false);
      mockRepository.createDepartment.mockResolvedValue(mockDepartment);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await createDepartment(validCreateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('DEPARTMENT_CREATED', {
        departmentId: mockDepartment.departmentId,
        code: mockDepartment.code,
        name: mockDepartment.name,
        parentDepartmentId: mockDepartment.parentDepartmentId,
        createdBy: userId,
      });
    });
  });


  // ============================================================================
  // getDepartment Tests (Requirement 7.2)
  // ============================================================================

  describe('getDepartment', () => {
    it('should return department from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue(mockDepartment);

      const result = await getDepartment(mockDepartment.departmentId);

      expect(result).toEqual(mockDepartment);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `department:${mockDepartment.departmentId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);

      const result = await getDepartment(mockDepartment.departmentId);

      expect(result).toEqual(mockDepartment);
      expect(mockRepository.getDepartmentById).toHaveBeenCalledWith(mockDepartment.departmentId);
    });

    it('should return null for non-existent department', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getDepartmentById.mockResolvedValue(null);

      const result = await getDepartment('nonexistent-id');

      expect(result).toBeNull();
    });
  });


  // ============================================================================
  // getDepartmentOrThrow Tests
  // ============================================================================

  describe('getDepartmentOrThrow', () => {
    it('should return department when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockDepartment);

      const result = await getDepartmentOrThrow(mockDepartment.departmentId);

      expect(result).toEqual(mockDepartment);
    });

    it('should throw DepartmentNotFoundError when department not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getDepartmentOrThrow('nonexistent-id')).rejects.toThrow(DepartmentNotFoundError);
      await expect(getDepartmentOrThrow('nonexistent-id')).rejects.toThrow(
        'Department not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getDepartmentsByParent Tests
  // ============================================================================

  describe('getDepartmentsByParent', () => {
    const childDepartments: DepartmentDetails[] = [
      mockChildDepartment,
      {
        ...mockChildDepartment,
        departmentId: '333e4567-e89b-12d3-a456-426614174000',
        code: 'DEPT-003',
        name: 'Backend Team',
      },
    ];

    it('should return child departments', async () => {
      mockCache.getOrSet.mockResolvedValue(childDepartments);

      const result = await getDepartmentsByParent(mockDepartment.departmentId);

      expect(result).toEqual(childDepartments);
      expect(result).toHaveLength(2);
    });

    it('should use cache with parent-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue(childDepartments);

      await getDepartmentsByParent(mockDepartment.departmentId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `department:parent:${mockDepartment.departmentId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getDepartmentsByParent.mockResolvedValue(childDepartments);

      const result = await getDepartmentsByParent(mockDepartment.departmentId);

      expect(result).toEqual(childDepartments);
      expect(mockRepository.getDepartmentsByParent).toHaveBeenCalledWith(mockDepartment.departmentId);
    });

    it('should return empty array when no children', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getDepartmentsByParent(mockDepartment.departmentId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });


  // ============================================================================
  // getAllDepartments Tests (Requirement 7.2)
  // ============================================================================

  describe('getAllDepartments', () => {
    const allDepartments: DepartmentDetails[] = [
      mockDepartment,
      mockChildDepartment,
    ];

    it('should return all departments with hierarchy info (Requirement 7.2)', async () => {
      mockCache.getOrSet.mockResolvedValue(allDepartments);

      const result = await getAllDepartments();

      expect(result).toEqual(allDepartments);
      expect(result).toHaveLength(2);
    });

    it('should use cache with all departments key', async () => {
      mockCache.getOrSet.mockResolvedValue(allDepartments);

      await getAllDepartments();

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'department:all',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository when cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getAllDepartments.mockResolvedValue(allDepartments);

      const result = await getAllDepartments();

      expect(result).toEqual(allDepartments);
      expect(mockRepository.getAllDepartments).toHaveBeenCalled();
    });
  });


  // ============================================================================
  // updateDepartment Tests (Requirement 7.3)
  // ============================================================================

  describe('updateDepartment', () => {
    const updateRequest: UpdateDepartmentRequest = {
      name: 'Engineering Department',
    };

    const updatedDepartment: DepartmentDetails = {
      ...mockDepartment,
      name: 'Engineering Department',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update department and invalidate cache (Requirement 7.3)', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.updateDepartment.mockResolvedValue(updatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateDepartment(mockDepartment.departmentId, updateRequest);

      expect(result).toEqual(updatedDepartment);
      expect(mockRepository.getDepartmentById).toHaveBeenCalledWith(mockDepartment.departmentId);
      expect(mockRepository.updateDepartment).toHaveBeenCalledWith(
        mockDepartment.departmentId,
        updateRequest,
        undefined
      );
    });


    it('should update department with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.updateDepartment.mockResolvedValue(updatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateDepartment(mockDepartment.departmentId, updateRequest, userId);

      expect(mockRepository.updateDepartment).toHaveBeenCalledWith(
        mockDepartment.departmentId,
        updateRequest,
        userId
      );
    });

    it('should throw DepartmentNotFoundError for non-existent department', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(null);

      await expect(
        updateDepartment('nonexistent-id', updateRequest)
      ).rejects.toThrow(DepartmentNotFoundError);
      expect(mockRepository.updateDepartment).not.toHaveBeenCalled();
    });

    it('should throw DepartmentNotFoundError when update returns null', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.updateDepartment.mockResolvedValue(null);

      await expect(
        updateDepartment(mockDepartment.departmentId, updateRequest)
      ).rejects.toThrow(DepartmentNotFoundError);
    });

    it('should throw ParentDepartmentNotFoundError for non-existent parent', async () => {
      const updateWithParent: UpdateDepartmentRequest = {
        parentDepartmentId: 'nonexistent-parent-id',
      };
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.parentDepartmentExists.mockResolvedValue(false);

      await expect(
        updateDepartment(mockDepartment.departmentId, updateWithParent)
      ).rejects.toThrow(ParentDepartmentNotFoundError);
      expect(mockRepository.updateDepartment).not.toHaveBeenCalled();
    });

    it('should throw CircularReferenceError for circular parent', async () => {
      const updateWithCircularParent: UpdateDepartmentRequest = {
        parentDepartmentId: mockChildDepartment.departmentId,
      };
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.parentDepartmentExists.mockResolvedValue(true);
      mockRepository.wouldCreateCircularReference.mockResolvedValue(true);

      await expect(
        updateDepartment(mockDepartment.departmentId, updateWithCircularParent)
      ).rejects.toThrow(CircularReferenceError);
      expect(mockRepository.updateDepartment).not.toHaveBeenCalled();
    });


    it('should update parent relationship when valid', async () => {
      const newParentId = '444e4567-e89b-12d3-a456-426614174000';
      const updateWithParent: UpdateDepartmentRequest = {
        parentDepartmentId: newParentId,
      };
      const updatedWithParent: DepartmentDetails = {
        ...mockDepartment,
        parentDepartmentId: newParentId,
      };
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.parentDepartmentExists.mockResolvedValue(true);
      mockRepository.wouldCreateCircularReference.mockResolvedValue(false);
      mockRepository.updateDepartment.mockResolvedValue(updatedWithParent);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateDepartment(mockDepartment.departmentId, updateWithParent);

      expect(result.parentDepartmentId).toBe(newParentId);
      expect(mockRepository.parentDepartmentExists).toHaveBeenCalledWith(newParentId);
      expect(mockRepository.wouldCreateCircularReference).toHaveBeenCalledWith(
        mockDepartment.departmentId,
        newParentId
      );
    });

    it('should publish DEPARTMENT_UPDATED event after update', async () => {
      const userId = 'user-123';
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.updateDepartment.mockResolvedValue(updatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateDepartment(mockDepartment.departmentId, updateRequest, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('DEPARTMENT_UPDATED', expect.objectContaining({
        departmentId: updatedDepartment.departmentId,
        code: updatedDepartment.code,
        updatedBy: userId,
      }));
    });
  });


  // ============================================================================
  // deactivateDepartment Tests (Requirement 7.4)
  // ============================================================================

  describe('deactivateDepartment', () => {
    const deactivatedDepartment: DepartmentDetails = {
      ...mockDepartment,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should cascade deactivation to all children (Requirement 7.4)', async () => {
      const childIds = [mockChildDepartment.departmentId, '333e4567-e89b-12d3-a456-426614174000'];
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getChildDepartmentIds.mockResolvedValue(childIds);
      mockRepository.deactivateDepartment.mockResolvedValue(deactivatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateDepartment(mockDepartment.departmentId);

      expect(result).toEqual(deactivatedDepartment);
      expect(result.isActive).toBe(false);
      expect(mockRepository.getChildDepartmentIds).toHaveBeenCalledWith(mockDepartment.departmentId);
      expect(mockRepository.deactivateDepartment).toHaveBeenCalledWith(
        mockDepartment.departmentId,
        undefined
      );
    });

    it('should deactivate department with userId', async () => {
      const userId = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getChildDepartmentIds.mockResolvedValue([]);
      mockRepository.deactivateDepartment.mockResolvedValue(deactivatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateDepartment(mockDepartment.departmentId, userId);

      expect(mockRepository.deactivateDepartment).toHaveBeenCalledWith(
        mockDepartment.departmentId,
        userId
      );
    });

    it('should throw DepartmentNotFoundError when department does not exist', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(null);

      await expect(deactivateDepartment('nonexistent-id')).rejects.toThrow(DepartmentNotFoundError);
      expect(mockRepository.deactivateDepartment).not.toHaveBeenCalled();
    });

    it('should throw DepartmentNotFoundError when deactivate returns null', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getChildDepartmentIds.mockResolvedValue([]);
      mockRepository.deactivateDepartment.mockResolvedValue(null);

      await expect(deactivateDepartment(mockDepartment.departmentId)).rejects.toThrow(
        DepartmentNotFoundError
      );
    });


    it('should invalidate cache for department and all children', async () => {
      const childIds = [mockChildDepartment.departmentId];
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getChildDepartmentIds.mockResolvedValue(childIds);
      mockRepository.deactivateDepartment.mockResolvedValue(deactivatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateDepartment(mockDepartment.departmentId);

      // Should invalidate parent department cache
      expect(mockCache.delPattern).toHaveBeenCalled();
      // Should invalidate child department caches
      expect(mockCache.del).toHaveBeenCalledWith(`department:${mockChildDepartment.departmentId}`);
    });

    it('should publish DEPARTMENT_DEACTIVATED event', async () => {
      const userId = 'user-123';
      const childIds = [mockChildDepartment.departmentId, '333e4567-e89b-12d3-a456-426614174000'];
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getChildDepartmentIds.mockResolvedValue(childIds);
      mockRepository.deactivateDepartment.mockResolvedValue(deactivatedDepartment);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateDepartment(mockDepartment.departmentId, userId);

      expect(mockPublishEvent).toHaveBeenCalledWith('DEPARTMENT_DEACTIVATED', {
        departmentId: deactivatedDepartment.departmentId,
        code: deactivatedDepartment.code,
        cascadedChildren: 2,
        deactivatedBy: userId,
      });
    });
  });


  // ============================================================================
  // deleteDepartment Tests (Requirement 7.5)
  // ============================================================================

  describe('deleteDepartment', () => {
    it('should delete department when no dependencies', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 0, userCount: 0 });
      mockRepository.deleteDepartment.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      const result = await deleteDepartment(mockDepartment.departmentId);

      expect(result).toBe(true);
      expect(mockRepository.deleteDepartment).toHaveBeenCalledWith(mockDepartment.departmentId);
    });

    it('should throw DepartmentNotFoundError when department does not exist', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(null);

      await expect(deleteDepartment('nonexistent-id')).rejects.toThrow(DepartmentNotFoundError);
      expect(mockRepository.getDepartmentDependencies).not.toHaveBeenCalled();
      expect(mockRepository.deleteDepartment).not.toHaveBeenCalled();
    });


    it('should throw DepartmentHasDependenciesError when has children (Requirement 7.5)', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 3, userCount: 0 });

      await expect(deleteDepartment(mockDepartment.departmentId)).rejects.toThrow(
        DepartmentHasDependenciesError
      );
      await expect(deleteDepartment(mockDepartment.departmentId)).rejects.toThrow(
        /has 3 child department\(s\) and 0 user\(s\)/
      );
      expect(mockRepository.deleteDepartment).not.toHaveBeenCalled();
    });

    it('should throw DepartmentHasDependenciesError when has users (Requirement 7.5)', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 0, userCount: 10 });

      await expect(deleteDepartment(mockDepartment.departmentId)).rejects.toThrow(
        DepartmentHasDependenciesError
      );
      await expect(deleteDepartment(mockDepartment.departmentId)).rejects.toThrow(
        /has 0 child department\(s\) and 10 user\(s\)/
      );
      expect(mockRepository.deleteDepartment).not.toHaveBeenCalled();
    });

    it('should throw DepartmentHasDependenciesError when has both children and users', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 5, userCount: 25 });

      const error = await deleteDepartment(mockDepartment.departmentId).catch((e) => e);

      expect(error).toBeInstanceOf(DepartmentHasDependenciesError);
      expect(error.childCount).toBe(5);
      expect(error.userCount).toBe(25);
    });

    it('should invalidate cache after deletion', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 0, userCount: 0 });
      mockRepository.deleteDepartment.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);

      await deleteDepartment(mockDepartment.departmentId);

      expect(mockCache.delPattern).toHaveBeenCalled();
    });

    it('should not invalidate cache when delete returns false', async () => {
      mockRepository.getDepartmentById.mockResolvedValue(mockDepartment);
      mockRepository.getDepartmentDependencies.mockResolvedValue({ childCount: 0, userCount: 0 });
      mockRepository.deleteDepartment.mockResolvedValue(false);

      const result = await deleteDepartment(mockDepartment.departmentId);

      expect(result).toBe(false);
      expect(mockCache.delPattern).not.toHaveBeenCalled();
    });
  });


  // ============================================================================
  // isDepartmentCodeUnique Tests
  // ============================================================================

  describe('isDepartmentCodeUnique', () => {
    it('should return true for unique code', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(false);

      const result = await isDepartmentCodeUnique('NEW-CODE');

      expect(result).toBe(true);
      expect(mockRepository.departmentCodeExists).toHaveBeenCalledWith('NEW-CODE', undefined);
    });

    it('should return false when code exists', async () => {
      mockRepository.departmentCodeExists.mockResolvedValue(true);

      const result = await isDepartmentCodeUnique('EXISTING-CODE');

      expect(result).toBe(false);
    });

    it('should exclude specific department ID when checking uniqueness', async () => {
      const excludeDepartmentId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.departmentCodeExists.mockResolvedValue(false);

      const result = await isDepartmentCodeUnique('DEPT-001', excludeDepartmentId);

      expect(result).toBe(true);
      expect(mockRepository.departmentCodeExists).toHaveBeenCalledWith('DEPT-001', excludeDepartmentId);
    });

    it('should return true when code exists but belongs to excluded department', async () => {
      const excludeDepartmentId = '111e4567-e89b-12d3-a456-426614174000';
      mockRepository.departmentCodeExists.mockResolvedValue(false);

      const result = await isDepartmentCodeUnique('DEPT-001', excludeDepartmentId);

      expect(result).toBe(true);
    });
  });


  // ============================================================================
  // getDepartmentHierarchy Tests
  // ============================================================================

  describe('getDepartmentHierarchy', () => {
    const hierarchyPath = [
      { department_id: '000e4567-e89b-12d3-a456-426614174000', code: 'ROOT', name: 'Root', hierarchy_level: '0' },
      { department_id: mockDepartment.departmentId, code: mockDepartment.code, name: mockDepartment.name, hierarchy_level: '1' },
      { department_id: mockChildDepartment.departmentId, code: mockChildDepartment.code, name: mockChildDepartment.name, hierarchy_level: '2' },
    ];

    it('should return hierarchy path from root', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => {
        return fetchFn();
      });
      mockRepository.getDepartmentHierarchy.mockResolvedValue(hierarchyPath);

      const result = await getDepartmentHierarchy(mockChildDepartment.departmentId);

      expect(result).toHaveLength(3);
      expect(result[0]?.hierarchyLevel).toBe(0);
      expect(result[2]?.hierarchyLevel).toBe(2);
    });

    it('should use cache with hierarchy-specific key', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      await getDepartmentHierarchy(mockChildDepartment.departmentId);

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `department:hierarchy:${mockChildDepartment.departmentId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });
  });


  // ============================================================================
  // Error Types Tests
  // ============================================================================

  describe('Error Types', () => {
    describe('DepartmentNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new DepartmentNotFoundError('111e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('DepartmentNotFoundError');
        expect(error.message).toBe('Department not found: 111e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('DepartmentCodeExistsError', () => {
      it('should have correct name and message', () => {
        const error = new DepartmentCodeExistsError('DEPT-001');

        expect(error.name).toBe('DepartmentCodeExistsError');
        expect(error.message).toBe("Department code 'DEPT-001' already exists");
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('DepartmentHasDependenciesError', () => {
      it('should have correct name, message, and properties', () => {
        const error = new DepartmentHasDependenciesError(
          '111e4567-e89b-12d3-a456-426614174000',
          3,
          5
        );

        expect(error.name).toBe('DepartmentHasDependenciesError');
        expect(error.message).toContain('has 3 child department(s) and 5 user(s)');
        expect(error.childCount).toBe(3);
        expect(error.userCount).toBe(5);
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('ParentDepartmentNotFoundError', () => {
      it('should have correct name and message', () => {
        const error = new ParentDepartmentNotFoundError('222e4567-e89b-12d3-a456-426614174000');

        expect(error.name).toBe('ParentDepartmentNotFoundError');
        expect(error.message).toBe('Parent department not found: 222e4567-e89b-12d3-a456-426614174000');
        expect(error).toBeInstanceOf(Error);
      });
    });

    describe('CircularReferenceError', () => {
      it('should have correct name and message', () => {
        const error = new CircularReferenceError(
          '111e4567-e89b-12d3-a456-426614174000',
          '222e4567-e89b-12d3-a456-426614174000'
        );

        expect(error.name).toBe('CircularReferenceError');
        expect(error.message).toContain('would create circular reference');
        expect(error).toBeInstanceOf(Error);
      });
    });
  });
});
