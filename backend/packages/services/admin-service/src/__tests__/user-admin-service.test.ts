/**
 * User Admin Service Unit Tests
 *
 * Tests for the User Admin Service business logic layer.
 * Requirements:
 * - Requirement 12.1: Return paginated list of users matching filter criteria
 * - Requirement 12.2: Return user details including department, manager, and assigned roles
 * - Requirement 12.3: Update user department or manager assignment and log the change
 * - Requirement 12.4: Mark user as inactive and revoke active sessions
 * - Requirement 12.5: Mark user as active and restore previous role assignments
 * - Requirement 12.6: Create role assignment and log the change
 * - Requirement 12.7: Delete role assignment and log the change
 */

// Mock the dependencies before importing service
jest.mock('../user-admin/user-admin-repository');
jest.mock('@ams/cache', () => ({
  ...jest.requireActual('@ams/cache'),
  getOrSet: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  CACHE_ENTITY_TYPES: {
    USER: 'user',
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

import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import * as repository from '../user-admin/user-admin-repository';
import type { UserDetails, RoleAssignment, UpdateUserRequest, UserListFilters } from '../user-admin/user-admin-repository';
import {
  getUser,
  getUserOrThrow,
  getUserByEmail,
  getUserByCognitoSub,
  updateUser,
  deactivateUser,
  reactivateUser,
  assignRole,
  removeRole,
  getUserRoleAssignments,
  listUsers,
  getUsersByDepartment,
  getUsersByManager,
  getActiveUsers,
  searchUsers,
  getAllRoles,
  userHasRole,
  userHasRoleByName,
  UserNotFoundError,
  RoleNotFoundError,
  DepartmentNotFoundError,
  ManagerNotFoundError,
  RoleAlreadyAssignedError,
  RoleNotAssignedError,
  SelfManagerError,
} from '../user-admin/user-admin-service';

// Use jest.mocked for proper typing
const mockRepository = jest.mocked(repository);
const mockCache = jest.mocked(cache);
const mockPublishEvent = jest.mocked(publishEvent);

// ============================================================================
// Test Data
// ============================================================================

const mockUser: UserDetails = {
  userId: '111e4567-e89b-12d3-a456-426614174000',
  cognitoSub: 'cognito-sub-123',
  email: 'john.doe@example.com',
  firstName: 'John',
  lastName: 'Doe',
  departmentId: '222e4567-e89b-12d3-a456-426614174000',
  departmentName: 'Engineering',
  managerId: '333e4567-e89b-12d3-a456-426614174000',
  managerName: 'Jane Smith',
  roles: ['ADMIN', 'USER'],
  isActive: true,
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockInactiveUser: UserDetails = {
  ...mockUser,
  userId: '444e4567-e89b-12d3-a456-426614174000',
  email: 'inactive.user@example.com',
  isActive: false,
};

const mockManager: UserDetails = {
  ...mockUser,
  userId: '333e4567-e89b-12d3-a456-426614174000',
  email: 'jane.smith@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  managerId: null,
  managerName: null,
};

const mockRoleAssignment: RoleAssignment = {
  userId: mockUser.userId,
  roleId: '555e4567-e89b-12d3-a456-426614174000',
  roleName: 'ADMIN',
  assignedAt: '2024-01-15T10:00:00.000Z',
  assignedBy: '666e4567-e89b-12d3-a456-426614174000',
};

const mockPublishResult = {
  eventId: 'evt-123',
  eventType: 'USER_UPDATED' as const,
  timestamp: '2024-01-15T10:00:00.000Z',
  messageId: 'msg-123',
};


describe('User Admin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCache.listKey.mockImplementation((type: string, params?: Record<string, unknown>) =>
      params ? `${type}:list:${JSON.stringify(params)}` : `${type}:list`
    );
  });

  // ============================================================================
  // getUser Tests (Requirement 12.2)
  // ============================================================================

  describe('getUser', () => {
    it('should return user from cache when available (Requirement 12.2)', async () => {
      mockCache.getOrSet.mockResolvedValue(mockUser);

      const result = await getUser(mockUser.userId);

      expect(result).toEqual(mockUser);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `user:${mockUser.userId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getUserById.mockResolvedValue(mockUser);

      const result = await getUser(mockUser.userId);

      expect(result).toEqual(mockUser);
      expect(mockRepository.getUserById).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should return null for non-existent user', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getUserById.mockResolvedValue(null);

      const result = await getUser('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should include department, manager, and roles in response', async () => {
      mockCache.getOrSet.mockResolvedValue(mockUser);

      const result = await getUser(mockUser.userId);

      expect(result?.departmentId).toBe(mockUser.departmentId);
      expect(result?.departmentName).toBe('Engineering');
      expect(result?.managerId).toBe(mockUser.managerId);
      expect(result?.managerName).toBe('Jane Smith');
      expect(result?.roles).toEqual(['ADMIN', 'USER']);
    });
  });

  // ============================================================================
  // getUserOrThrow Tests
  // ============================================================================

  describe('getUserOrThrow', () => {
    it('should return user when found', async () => {
      mockCache.getOrSet.mockResolvedValue(mockUser);

      const result = await getUserOrThrow(mockUser.userId);

      expect(result).toEqual(mockUser);
    });

    it('should throw UserNotFoundError when user not found', async () => {
      mockCache.getOrSet.mockResolvedValue(null);

      await expect(getUserOrThrow('nonexistent-id')).rejects.toThrow(UserNotFoundError);
      await expect(getUserOrThrow('nonexistent-id')).rejects.toThrow(
        'User not found: nonexistent-id'
      );
    });
  });


  // ============================================================================
  // getUserByEmail Tests
  // ============================================================================

  describe('getUserByEmail', () => {
    it('should return user when found by email', async () => {
      mockRepository.getUserByEmail.mockResolvedValue(mockUser);

      const result = await getUserByEmail('john.doe@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.getUserByEmail).toHaveBeenCalledWith('john.doe@example.com');
    });

    it('should return null when email not found', async () => {
      mockRepository.getUserByEmail.mockResolvedValue(null);

      const result = await getUserByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getUserByCognitoSub Tests
  // ============================================================================

  describe('getUserByCognitoSub', () => {
    it('should return user when found by Cognito sub', async () => {
      mockRepository.getUserByCognitoSub.mockResolvedValue(mockUser);

      const result = await getUserByCognitoSub('cognito-sub-123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.getUserByCognitoSub).toHaveBeenCalledWith('cognito-sub-123');
    });

    it('should return null when Cognito sub not found', async () => {
      mockRepository.getUserByCognitoSub.mockResolvedValue(null);

      const result = await getUserByCognitoSub('unknown-sub');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // updateUser Tests (Requirement 12.3)
  // ============================================================================

  describe('updateUser', () => {
    const updateRequest: UpdateUserRequest = {
      firstName: 'Jonathan',
      lastName: 'Doe',
      departmentId: '777e4567-e89b-12d3-a456-426614174000',
    };

    const updatedUser: UserDetails = {
      ...mockUser,
      firstName: 'Jonathan',
      departmentId: '777e4567-e89b-12d3-a456-426614174000',
      departmentName: 'Sales',
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should update user and publish event (Requirement 12.3)', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.departmentExists.mockResolvedValue(true);
      mockRepository.updateUser.mockResolvedValue(updatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUser(mockUser.userId, updateRequest);

      expect(result).toEqual(updatedUser);
      expect(mockRepository.updateUser).toHaveBeenCalledWith(
        mockUser.userId,
        updateRequest,
        undefined
      );
    });

    it('should update user with updatedBy parameter', async () => {
      const updatedBy = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.departmentExists.mockResolvedValue(true);
      mockRepository.updateUser.mockResolvedValue(updatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUser(mockUser.userId, updateRequest, updatedBy);

      expect(mockRepository.updateUser).toHaveBeenCalledWith(
        mockUser.userId,
        updateRequest,
        updatedBy
      );
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.getUserById.mockResolvedValue(null);

      await expect(updateUser('nonexistent-id', updateRequest)).rejects.toThrow(UserNotFoundError);
      expect(mockRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should throw DepartmentNotFoundError when department does not exist', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.departmentExists.mockResolvedValue(false);

      await expect(updateUser(mockUser.userId, { departmentId: 'invalid-dept' })).rejects.toThrow(
        DepartmentNotFoundError
      );
      expect(mockRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should throw ManagerNotFoundError when manager does not exist', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.managerExists.mockResolvedValue(false);

      await expect(updateUser(mockUser.userId, { managerId: 'invalid-manager' })).rejects.toThrow(
        ManagerNotFoundError
      );
      expect(mockRepository.updateUser).not.toHaveBeenCalled();
    });

    it('should throw SelfManagerError when trying to set self as manager', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);

      await expect(updateUser(mockUser.userId, { managerId: mockUser.userId })).rejects.toThrow(
        SelfManagerError
      );
      expect(mockRepository.updateUser).not.toHaveBeenCalled();
    });


    it('should invalidate cache after update', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.departmentExists.mockResolvedValue(true);
      mockRepository.updateUser.mockResolvedValue(updatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUser(mockUser.userId, updateRequest);

      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should publish USER_UPDATED event with changes', async () => {
      const updatedBy = 'user-123';
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.departmentExists.mockResolvedValue(true);
      mockRepository.updateUser.mockResolvedValue(updatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await updateUser(mockUser.userId, updateRequest, updatedBy);

      expect(mockPublishEvent).toHaveBeenCalledWith('USER_UPDATED', expect.objectContaining({
        userId: updatedUser.userId,
        email: updatedUser.email,
        updatedBy,
      }));
    });

    it('should allow updating manager to valid user', async () => {
      const newManagerId = '888e4567-e89b-12d3-a456-426614174000';
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.managerExists.mockResolvedValue(true);
      mockRepository.updateUser.mockResolvedValue({ ...mockUser, managerId: newManagerId });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUser(mockUser.userId, { managerId: newManagerId });

      expect(result.managerId).toBe(newManagerId);
    });

    it('should allow setting manager to null', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.updateUser.mockResolvedValue({ ...mockUser, managerId: null, managerName: null });
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await updateUser(mockUser.userId, { managerId: null });

      expect(result.managerId).toBeNull();
    });
  });

  // ============================================================================
  // deactivateUser Tests (Requirement 12.4)
  // ============================================================================

  describe('deactivateUser', () => {
    const deactivatedUser: UserDetails = {
      ...mockUser,
      isActive: false,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should deactivate user and publish event (Requirement 12.4)', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.deactivateUser.mockResolvedValue(deactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await deactivateUser(mockUser.userId);

      expect(result).toEqual(deactivatedUser);
      expect(result.isActive).toBe(false);
      expect(mockRepository.deactivateUser).toHaveBeenCalledWith(mockUser.userId, undefined);
    });

    it('should deactivate user with deactivatedBy parameter', async () => {
      const deactivatedBy = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.deactivateUser.mockResolvedValue(deactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateUser(mockUser.userId, deactivatedBy);

      expect(mockRepository.deactivateUser).toHaveBeenCalledWith(mockUser.userId, deactivatedBy);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.getUserById.mockResolvedValue(null);

      await expect(deactivateUser('nonexistent-id')).rejects.toThrow(UserNotFoundError);
      expect(mockRepository.deactivateUser).not.toHaveBeenCalled();
    });

    it('should invalidate cache after deactivation', async () => {
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.deactivateUser.mockResolvedValue(deactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateUser(mockUser.userId);

      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should publish USER_DEACTIVATED event', async () => {
      const deactivatedBy = 'user-123';
      mockRepository.getUserById.mockResolvedValue(mockUser);
      mockRepository.deactivateUser.mockResolvedValue(deactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await deactivateUser(mockUser.userId, deactivatedBy);

      expect(mockPublishEvent).toHaveBeenCalledWith('USER_DEACTIVATED', {
        userId: deactivatedUser.userId,
        email: deactivatedUser.email,
        deactivatedBy,
      });
    });
  });


  // ============================================================================
  // reactivateUser Tests (Requirement 12.5)
  // ============================================================================

  describe('reactivateUser', () => {
    const reactivatedUser: UserDetails = {
      ...mockInactiveUser,
      isActive: true,
      updatedAt: '2024-01-15T12:00:00.000Z',
    };

    it('should reactivate user and publish event (Requirement 12.5)', async () => {
      mockRepository.getUserById.mockResolvedValue(mockInactiveUser);
      mockRepository.reactivateUser.mockResolvedValue(reactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await reactivateUser(mockInactiveUser.userId);

      expect(result).toEqual(reactivatedUser);
      expect(result.isActive).toBe(true);
      expect(mockRepository.reactivateUser).toHaveBeenCalledWith(mockInactiveUser.userId, undefined);
    });

    it('should reactivate user with reactivatedBy parameter', async () => {
      const reactivatedBy = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.getUserById.mockResolvedValue(mockInactiveUser);
      mockRepository.reactivateUser.mockResolvedValue(reactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateUser(mockInactiveUser.userId, reactivatedBy);

      expect(mockRepository.reactivateUser).toHaveBeenCalledWith(mockInactiveUser.userId, reactivatedBy);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.getUserById.mockResolvedValue(null);

      await expect(reactivateUser('nonexistent-id')).rejects.toThrow(UserNotFoundError);
      expect(mockRepository.reactivateUser).not.toHaveBeenCalled();
    });

    it('should invalidate cache after reactivation', async () => {
      mockRepository.getUserById.mockResolvedValue(mockInactiveUser);
      mockRepository.reactivateUser.mockResolvedValue(reactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateUser(mockInactiveUser.userId);

      expect(mockCache.delPattern).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should publish USER_REACTIVATED event', async () => {
      const reactivatedBy = 'user-123';
      mockRepository.getUserById.mockResolvedValue(mockInactiveUser);
      mockRepository.reactivateUser.mockResolvedValue(reactivatedUser);
      mockCache.delPattern.mockResolvedValue(1);
      mockCache.del.mockResolvedValue(true);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await reactivateUser(mockInactiveUser.userId, reactivatedBy);

      expect(mockPublishEvent).toHaveBeenCalledWith('USER_REACTIVATED', {
        userId: reactivatedUser.userId,
        email: reactivatedUser.email,
        reactivatedBy,
      });
    });
  });

  // ============================================================================
  // assignRole Tests (Requirement 12.6)
  // ============================================================================

  describe('assignRole', () => {
    const roleId = '555e4567-e89b-12d3-a456-426614174000';

    it('should assign role to user and publish event (Requirement 12.6)', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.roleExists.mockResolvedValue(true);
      mockRepository.assignRole.mockResolvedValue(mockRoleAssignment);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await assignRole(mockUser.userId, roleId);

      expect(result).toEqual(mockRoleAssignment);
      expect(mockRepository.assignRole).toHaveBeenCalledWith(mockUser.userId, roleId, undefined);
    });

    it('should assign role with assignedBy parameter', async () => {
      const assignedBy = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.roleExists.mockResolvedValue(true);
      mockRepository.assignRole.mockResolvedValue(mockRoleAssignment);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await assignRole(mockUser.userId, roleId, assignedBy);

      expect(mockRepository.assignRole).toHaveBeenCalledWith(mockUser.userId, roleId, assignedBy);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.userExists.mockResolvedValue(false);

      await expect(assignRole('nonexistent-user', roleId)).rejects.toThrow(UserNotFoundError);
      expect(mockRepository.assignRole).not.toHaveBeenCalled();
    });

    it('should throw RoleNotFoundError when role does not exist', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.roleExists.mockResolvedValue(false);

      await expect(assignRole(mockUser.userId, 'nonexistent-role')).rejects.toThrow(RoleNotFoundError);
      expect(mockRepository.assignRole).not.toHaveBeenCalled();
    });

    it('should invalidate user cache after role assignment', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.roleExists.mockResolvedValue(true);
      mockRepository.assignRole.mockResolvedValue(mockRoleAssignment);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await assignRole(mockUser.userId, roleId);

      expect(mockCache.del).toHaveBeenCalledWith(`user:${mockUser.userId}`);
      expect(mockCache.delPattern).toHaveBeenCalledWith('user:list*');
    });

    it('should publish USER_ROLE_ASSIGNED event', async () => {
      const assignedBy = 'user-123';
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.roleExists.mockResolvedValue(true);
      mockRepository.assignRole.mockResolvedValue(mockRoleAssignment);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await assignRole(mockUser.userId, roleId, assignedBy);

      expect(mockPublishEvent).toHaveBeenCalledWith('USER_ROLE_ASSIGNED', {
        userId: mockUser.userId,
        roleId,
        roleName: mockRoleAssignment.roleName,
        assignedBy,
      });
    });
  });


  // ============================================================================
  // removeRole Tests (Requirement 12.7)
  // ============================================================================

  describe('removeRole', () => {
    const roleId = '555e4567-e89b-12d3-a456-426614174000';
    const mockRole = {
      role_id: roleId,
      role_name: 'ADMIN',
      description: 'Administrator role',
      is_system_role: true,
    };

    it('should remove role from user and publish event (Requirement 12.7)', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(mockRole);
      mockRepository.userHasRole.mockResolvedValue(true);
      mockRepository.removeRole.mockResolvedValue(true);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      const result = await removeRole(mockUser.userId, roleId);

      expect(result).toBe(true);
      expect(mockRepository.removeRole).toHaveBeenCalledWith(mockUser.userId, roleId, undefined);
    });

    it('should remove role with removedBy parameter', async () => {
      const removedBy = '999e4567-e89b-12d3-a456-426614174999';
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(mockRole);
      mockRepository.userHasRole.mockResolvedValue(true);
      mockRepository.removeRole.mockResolvedValue(true);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await removeRole(mockUser.userId, roleId, removedBy);

      expect(mockRepository.removeRole).toHaveBeenCalledWith(mockUser.userId, roleId, removedBy);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.userExists.mockResolvedValue(false);

      await expect(removeRole('nonexistent-user', roleId)).rejects.toThrow(UserNotFoundError);
      expect(mockRepository.removeRole).not.toHaveBeenCalled();
    });

    it('should throw RoleNotFoundError when role does not exist', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(null);

      await expect(removeRole(mockUser.userId, 'nonexistent-role')).rejects.toThrow(RoleNotFoundError);
      expect(mockRepository.removeRole).not.toHaveBeenCalled();
    });

    it('should throw RoleNotAssignedError when user does not have the role', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(mockRole);
      mockRepository.userHasRole.mockResolvedValue(false);

      await expect(removeRole(mockUser.userId, roleId)).rejects.toThrow(RoleNotAssignedError);
      expect(mockRepository.removeRole).not.toHaveBeenCalled();
    });

    it('should invalidate user cache after role removal', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(mockRole);
      mockRepository.userHasRole.mockResolvedValue(true);
      mockRepository.removeRole.mockResolvedValue(true);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await removeRole(mockUser.userId, roleId);

      expect(mockCache.del).toHaveBeenCalledWith(`user:${mockUser.userId}`);
      expect(mockCache.delPattern).toHaveBeenCalledWith('user:list*');
    });

    it('should publish USER_ROLE_REMOVED event', async () => {
      const removedBy = 'user-123';
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getRoleById.mockResolvedValue(mockRole);
      mockRepository.userHasRole.mockResolvedValue(true);
      mockRepository.removeRole.mockResolvedValue(true);
      mockCache.del.mockResolvedValue(true);
      mockCache.delPattern.mockResolvedValue(1);
      mockPublishEvent.mockResolvedValue(mockPublishResult);

      await removeRole(mockUser.userId, roleId, removedBy);

      expect(mockPublishEvent).toHaveBeenCalledWith('USER_ROLE_REMOVED', {
        userId: mockUser.userId,
        roleId,
        roleName: mockRole.role_name,
        removedBy,
      });
    });
  });

  // ============================================================================
  // getUserRoleAssignments Tests
  // ============================================================================

  describe('getUserRoleAssignments', () => {
    it('should return role assignments for user', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getUserRoleAssignments.mockResolvedValue([mockRoleAssignment]);

      const result = await getUserRoleAssignments(mockUser.userId);

      expect(result).toEqual([mockRoleAssignment]);
      expect(mockRepository.getUserRoleAssignments).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should throw UserNotFoundError when user does not exist', async () => {
      mockRepository.userExists.mockResolvedValue(false);

      await expect(getUserRoleAssignments('nonexistent-user')).rejects.toThrow(UserNotFoundError);
    });

    it('should return empty array when user has no roles', async () => {
      mockRepository.userExists.mockResolvedValue(true);
      mockRepository.getUserRoleAssignments.mockResolvedValue([]);

      const result = await getUserRoleAssignments(mockUser.userId);

      expect(result).toEqual([]);
    });
  });


  // ============================================================================
  // listUsers Tests (Requirement 12.1)
  // ============================================================================

  describe('listUsers', () => {
    const paginatedResult = {
      items: [mockUser, mockManager],
      total: 2,
      page: 1,
      limit: 20,
      hasMore: false,
    };

    it('should return paginated results (Requirement 12.1)', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      const result = await listUsers();

      expect(result).toEqual(paginatedResult);
      expect(result.items).toHaveLength(2);
    });

    it('should use cache for default pagination without filters', async () => {
      mockCache.getOrSet.mockResolvedValue(paginatedResult);

      await listUsers({}, { page: 1, limit: 20 });

      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'user:list',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.SHORT }
      );
    });

    it('should bypass cache when filters are applied', async () => {
      mockRepository.listUsers.mockResolvedValue(paginatedResult);

      await listUsers({ isActive: true });

      expect(mockRepository.listUsers).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should bypass cache for non-default pagination', async () => {
      mockRepository.listUsers.mockResolvedValue({ ...paginatedResult, page: 2 });

      await listUsers({}, { page: 2, limit: 20 });

      expect(mockRepository.listUsers).toHaveBeenCalled();
      expect(mockCache.getOrSet).not.toHaveBeenCalled();
    });

    it('should apply department filter correctly', async () => {
      const filters: UserListFilters = { departmentId: '222e4567-e89b-12d3-a456-426614174000' };
      mockRepository.listUsers.mockResolvedValue(paginatedResult);

      await listUsers(filters);

      expect(mockRepository.listUsers).toHaveBeenCalledWith(filters, {});
    });

    it('should apply manager filter correctly', async () => {
      const filters: UserListFilters = { managerId: '333e4567-e89b-12d3-a456-426614174000' };
      mockRepository.listUsers.mockResolvedValue(paginatedResult);

      await listUsers(filters);

      expect(mockRepository.listUsers).toHaveBeenCalledWith(filters, {});
    });

    it('should apply isActive filter correctly', async () => {
      const filters: UserListFilters = { isActive: true };
      mockRepository.listUsers.mockResolvedValue(paginatedResult);

      await listUsers(filters);

      expect(mockRepository.listUsers).toHaveBeenCalledWith(filters, {});
    });

    it('should apply search filter correctly', async () => {
      const filters: UserListFilters = { search: 'john' };
      mockRepository.listUsers.mockResolvedValue(paginatedResult);

      await listUsers(filters);

      expect(mockRepository.listUsers).toHaveBeenCalledWith(filters, {});
    });

    it('should handle pagination parameters', async () => {
      const pagination = { page: 2, limit: 10 };
      mockRepository.listUsers.mockResolvedValue({ ...paginatedResult, page: 2, limit: 10 });

      await listUsers({}, pagination);

      expect(mockRepository.listUsers).toHaveBeenCalledWith({}, pagination);
    });
  });

  // ============================================================================
  // getUsersByDepartment Tests
  // ============================================================================

  describe('getUsersByDepartment', () => {
    const departmentId = '222e4567-e89b-12d3-a456-426614174000';

    it('should return users from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue([mockUser]);

      const result = await getUsersByDepartment(departmentId);

      expect(result).toEqual([mockUser]);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `user:department:${departmentId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getUsersByDepartment.mockResolvedValue([mockUser]);

      const result = await getUsersByDepartment(departmentId);

      expect(result).toEqual([mockUser]);
      expect(mockRepository.getUsersByDepartment).toHaveBeenCalledWith(departmentId);
    });

    it('should return empty array when no users in department', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getUsersByDepartment(departmentId);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // getUsersByManager Tests
  // ============================================================================

  describe('getUsersByManager', () => {
    const managerId = '333e4567-e89b-12d3-a456-426614174000';

    it('should return users from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue([mockUser]);

      const result = await getUsersByManager(managerId);

      expect(result).toEqual([mockUser]);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        `user:manager:${managerId}`,
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getUsersByManager.mockResolvedValue([mockUser]);

      const result = await getUsersByManager(managerId);

      expect(result).toEqual([mockUser]);
      expect(mockRepository.getUsersByManager).toHaveBeenCalledWith(managerId);
    });

    it('should return empty array when manager has no direct reports', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getUsersByManager(managerId);

      expect(result).toEqual([]);
    });
  });


  // ============================================================================
  // getActiveUsers Tests
  // ============================================================================

  describe('getActiveUsers', () => {
    it('should return active users from cache when available', async () => {
      mockCache.getOrSet.mockResolvedValue([mockUser, mockManager]);

      const result = await getActiveUsers();

      expect(result).toEqual([mockUser, mockManager]);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'user:active',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.MEDIUM }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getActiveUsers.mockResolvedValue([mockUser, mockManager]);

      const result = await getActiveUsers();

      expect(result).toEqual([mockUser, mockManager]);
      expect(mockRepository.getActiveUsers).toHaveBeenCalled();
    });

    it('should return empty array when no active users', async () => {
      mockCache.getOrSet.mockResolvedValue([]);

      const result = await getActiveUsers();

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // searchUsers Tests
  // ============================================================================

  describe('searchUsers', () => {
    const searchResults: UserDetails[] = [mockUser, mockManager];

    it('should return matching users', async () => {
      mockRepository.searchUsers.mockResolvedValue(searchResults);

      const result = await searchUsers('john');

      expect(result).toEqual(searchResults);
      expect(result).toHaveLength(2);
    });

    it('should call repository with search term', async () => {
      mockRepository.searchUsers.mockResolvedValue(searchResults);

      await searchUsers('john');

      expect(mockRepository.searchUsers).toHaveBeenCalledWith('john');
    });

    it('should return empty array when no matches', async () => {
      mockRepository.searchUsers.mockResolvedValue([]);

      const result = await searchUsers('nonexistent');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should search by email', async () => {
      mockRepository.searchUsers.mockResolvedValue([mockUser]);

      const result = await searchUsers('john.doe@example.com');

      expect(result).toEqual([mockUser]);
    });

    it('should search by partial name', async () => {
      mockRepository.searchUsers.mockResolvedValue([mockUser]);

      const result = await searchUsers('Doe');

      expect(result).toEqual([mockUser]);
    });
  });

  // ============================================================================
  // getAllRoles Tests
  // ============================================================================

  describe('getAllRoles', () => {
    const mockRoles = [
      { role_id: 'role-1', role_name: 'ADMIN', description: 'Administrator', is_system_role: true },
      { role_id: 'role-2', role_name: 'USER', description: 'Regular user', is_system_role: false },
    ];

    it('should return all roles from cache when available', async () => {
      const expectedRoles = mockRoles.map(r => ({
        roleId: r.role_id,
        roleName: r.role_name,
        description: r.description,
        isSystemRole: r.is_system_role,
      }));
      mockCache.getOrSet.mockResolvedValue(expectedRoles);

      const result = await getAllRoles();

      expect(result).toEqual(expectedRoles);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        'roles:all',
        expect.any(Function),
        { ttl: cache.DEFAULT_TTL.LONG }
      );
    });

    it('should fetch from repository on cache miss', async () => {
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn) => fetchFn());
      mockRepository.getAllRoles.mockResolvedValue(mockRoles);

      const result = await getAllRoles();

      expect(result).toHaveLength(2);
      expect(result[0]?.roleName).toBe('ADMIN');
      expect(mockRepository.getAllRoles).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // userHasRole Tests
  // ============================================================================

  describe('userHasRole', () => {
    const roleId = '555e4567-e89b-12d3-a456-426614174000';

    it('should return true when user has the role', async () => {
      mockRepository.userHasRole.mockResolvedValue(true);

      const result = await userHasRole(mockUser.userId, roleId);

      expect(result).toBe(true);
      expect(mockRepository.userHasRole).toHaveBeenCalledWith(mockUser.userId, roleId);
    });

    it('should return false when user does not have the role', async () => {
      mockRepository.userHasRole.mockResolvedValue(false);

      const result = await userHasRole(mockUser.userId, roleId);

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // userHasRoleByName Tests
  // ============================================================================

  describe('userHasRoleByName', () => {
    it('should return true when user has the role by name', async () => {
      mockRepository.userHasRoleByName.mockResolvedValue(true);

      const result = await userHasRoleByName(mockUser.userId, 'ADMIN');

      expect(result).toBe(true);
      expect(mockRepository.userHasRoleByName).toHaveBeenCalledWith(mockUser.userId, 'ADMIN');
    });

    it('should return false when user does not have the role by name', async () => {
      mockRepository.userHasRoleByName.mockResolvedValue(false);

      const result = await userHasRoleByName(mockUser.userId, 'SUPER_ADMIN');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Error Class Tests
  // ============================================================================

  describe('Error Classes', () => {
    it('UserNotFoundError should have correct name and message', () => {
      const error = new UserNotFoundError('user-123');
      expect(error.name).toBe('UserNotFoundError');
      expect(error.message).toBe('User not found: user-123');
    });

    it('RoleNotFoundError should have correct name and message', () => {
      const error = new RoleNotFoundError('role-123');
      expect(error.name).toBe('RoleNotFoundError');
      expect(error.message).toBe('Role not found: role-123');
    });

    it('DepartmentNotFoundError should have correct name and message', () => {
      const error = new DepartmentNotFoundError('dept-123');
      expect(error.name).toBe('DepartmentNotFoundError');
      expect(error.message).toBe('Department not found: dept-123');
    });

    it('ManagerNotFoundError should have correct name and message', () => {
      const error = new ManagerNotFoundError('mgr-123');
      expect(error.name).toBe('ManagerNotFoundError');
      expect(error.message).toBe('Manager not found or inactive: mgr-123');
    });

    it('RoleAlreadyAssignedError should have correct name and message', () => {
      const error = new RoleAlreadyAssignedError('user-123', 'role-123');
      expect(error.name).toBe('RoleAlreadyAssignedError');
      expect(error.message).toBe('User user-123 already has role role-123');
    });

    it('RoleNotAssignedError should have correct name and message', () => {
      const error = new RoleNotAssignedError('user-123', 'role-123');
      expect(error.name).toBe('RoleNotAssignedError');
      expect(error.message).toBe('User user-123 does not have role role-123');
    });

    it('SelfManagerError should have correct name and message', () => {
      const error = new SelfManagerError('user-123');
      expect(error.name).toBe('SelfManagerError');
      expect(error.message).toBe('User user-123 cannot be their own manager');
    });
  });
});
