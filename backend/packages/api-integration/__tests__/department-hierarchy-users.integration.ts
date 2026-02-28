/**
 * Integration tests for Department Hierarchy with Users
 * Validates the end-to-end management of department hierarchy and user associations
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { DepartmentService } from '@ams/admin-service';
import { UserAdminService } from '@ams/admin-service';
import { Department, User, UserRole } from '@ams/types';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Department Hierarchy with Users Integration', () => {
  // Test data
  const testRootDeptCode = 'INT-DEPT-ROOT';
  const testRootDeptName = 'Integration Test Department';
  let rootDeptId: string;
  let childDeptIds: string[] = [];
  let grandchildDeptIds: string[] = [];
  let userIds: string[] = [];

  // Test the department hierarchy creation with user assignments
  it('should create a department hierarchy with three levels', async () => {
    // Get service
    const departmentService = new DepartmentService();
    
    // 1. Create root department
    const rootDeptInput: Omit<Department, 'departmentId' | 'createdAt' | 'updatedAt'> = {
      code: testRootDeptCode,
      name: testRootDeptName,
      description: 'Root department for integration tests',
      status: 'ACTIVE',
      parentId: null,
    };
    
    const rootDept = await departmentService.createDepartment(rootDeptInput);
    rootDeptId = rootDept.departmentId;
    
    // Verify root department was created
    expect(rootDept).toBeDefined();
    expect(rootDept.departmentId).toBeDefined();
    expect(rootDept.code).toBe(testRootDeptCode);
    expect(rootDept.name).toBe(testRootDeptName);
    expect(rootDept.parentId).toBeNull();
    
    // 2. Create child departments
    for (let i = 1; i <= 3; i++) {
      const childDeptInput: Omit<Department, 'departmentId' | 'createdAt' | 'updatedAt'> = {
        code: `${testRootDeptCode}-CHILD-${i}`,
        name: `Child Department ${i}`,
        description: `Child department ${i} for integration tests`,
        status: 'ACTIVE',
        parentId: rootDeptId,
      };
      
      const childDept = await departmentService.createDepartment(childDeptInput);
      childDeptIds.push(childDept.departmentId);
      
      // Verify child department was created
      expect(childDept).toBeDefined();
      expect(childDept.departmentId).toBeDefined();
      expect(childDept.parentId).toBe(rootDeptId);
      
      // 3. Create grandchild departments for the first child
      if (i === 1) {
        for (let j = 1; j <= 2; j++) {
          const grandchildDeptInput: Omit<Department, 'departmentId' | 'createdAt' | 'updatedAt'> = {
            code: `${testRootDeptCode}-CHILD-${i}-SUB-${j}`,
            name: `Grandchild Department ${i}-${j}`,
            description: `Grandchild department ${j} under child ${i} for integration tests`,
            status: 'ACTIVE',
            parentId: childDept.departmentId,
          };
          
          const grandchildDept = await departmentService.createDepartment(grandchildDeptInput);
          grandchildDeptIds.push(grandchildDept.departmentId);
          
          // Verify grandchild department was created
          expect(grandchildDept).toBeDefined();
          expect(grandchildDept.departmentId).toBeDefined();
          expect(grandchildDept.parentId).toBe(childDept.departmentId);
        }
      }
    }
    
    // Verify child departments were created
    expect(childDeptIds.length).toBe(3);
    
    // Verify grandchild departments were created
    expect(grandchildDeptIds.length).toBe(2);
  });

  it('should retrieve the complete department hierarchy', async () => {
    // Get service
    const departmentService = new DepartmentService();
    
    // Retrieve the department hierarchy
    const hierarchy = await departmentService.getDepartmentHierarchy(rootDeptId);
    
    // Verify root department
    expect(hierarchy).toBeDefined();
    expect(hierarchy.departmentId).toBe(rootDeptId);
    expect(hierarchy.code).toBe(testRootDeptCode);
    expect(hierarchy.name).toBe(testRootDeptName);
    
    // Verify child departments
    expect(hierarchy.children).toBeDefined();
    expect(hierarchy.children.length).toBe(childDeptIds.length);
    
    // Verify all child department IDs are present
    for (const childId of childDeptIds) {
      const found = hierarchy.children.some(child => child.departmentId === childId);
      expect(found).toBe(true);
    }
    
    // Verify grandchild departments
    const firstChild = hierarchy.children.find(child => 
      child.departmentId === childDeptIds[0]);
    
    expect(firstChild.children).toBeDefined();
    expect(firstChild.children.length).toBe(grandchildDeptIds.length);
    
    // Verify all grandchild department IDs are present
    for (const grandchildId of grandchildDeptIds) {
      const found = firstChild.children.some(
        grandchild => grandchild.departmentId === grandchildId
      );
      expect(found).toBe(true);
    }
  });
  
  it('should create users and assign them to departments', async () => {
    // Get service
    const userAdminService = new UserAdminService();
    
    // Create users assigned to different levels of the hierarchy
    
    // 1. Create a user at the root department
    const rootUserInput = {
      username: 'root_user@test.com',
      email: 'root_user@test.com',
      firstName: 'Root',
      lastName: 'User',
      departmentId: rootDeptId,
      status: 'ACTIVE',
      roles: [UserRole.USER],
    };
    
    const rootUser = await userAdminService.createUser(rootUserInput);
    userIds.push(rootUser.userId);
    
    // Verify root user was created
    expect(rootUser).toBeDefined();
    expect(rootUser.userId).toBeDefined();
    expect(rootUser.departmentId).toBe(rootDeptId);
    
    // 2. Create a manager user at the first child department
    const managerUserInput = {
      username: 'manager_user@test.com',
      email: 'manager_user@test.com',
      firstName: 'Manager',
      lastName: 'User',
      departmentId: childDeptIds[0],
      status: 'ACTIVE',
      roles: [UserRole.USER, UserRole.MANAGER],
    };
    
    const managerUser = await userAdminService.createUser(managerUserInput);
    userIds.push(managerUser.userId);
    
    // Verify manager user was created
    expect(managerUser).toBeDefined();
    expect(managerUser.userId).toBeDefined();
    expect(managerUser.departmentId).toBe(childDeptIds[0]);
    expect(managerUser.roles).toContain(UserRole.MANAGER);
    
    // 3. Create regular users at the grandchild departments
    for (let i = 0; i < grandchildDeptIds.length; i++) {
      const regularUserInput = {
        username: `regular_user_${i+1}@test.com`,
        email: `regular_user_${i+1}@test.com`,
        firstName: `Regular${i+1}`,
        lastName: 'User',
        departmentId: grandchildDeptIds[i],
        status: 'ACTIVE',
        roles: [UserRole.USER],
      };
      
      const regularUser = await userAdminService.createUser(regularUserInput);
      userIds.push(regularUser.userId);
      
      // Verify regular user was created
      expect(regularUser).toBeDefined();
      expect(regularUser.userId).toBeDefined();
      expect(regularUser.departmentId).toBe(grandchildDeptIds[i]);
    }
    
    // Verify all users were created
    expect(userIds.length).toBe(4); // 1 root + 1 manager + 2 regular
  });
  
  it('should retrieve users by department and recursively through hierarchy', async () => {
    // Get services
    const departmentService = new DepartmentService();
    const userAdminService = new UserAdminService();
    
    // 1. Get users in root department only (non-recursive)
    const rootDeptUsers = await userAdminService.getUsersByDepartment(rootDeptId, false);
    
    // Verify only root department user is returned
    expect(rootDeptUsers).toBeDefined();
    expect(rootDeptUsers.length).toBe(1);
    expect(rootDeptUsers[0].departmentId).toBe(rootDeptId);
    
    // 2. Get all users in the hierarchy (recursive)
    const allUsers = await userAdminService.getUsersByDepartment(rootDeptId, true);
    
    // Verify all users are returned
    expect(allUsers).toBeDefined();
    expect(allUsers.length).toBe(userIds.length);
    
    // Verify all user IDs are present
    for (const userId of userIds) {
      const found = allUsers.some(user => user.userId === userId);
      expect(found).toBe(true);
    }
    
    // 3. Get users by role
    const managerUsers = await userAdminService.getUsersByRole(UserRole.MANAGER);
    
    // Verify only manager users are returned
    expect(managerUsers).toBeDefined();
    expect(managerUsers.length).toBe(1);
    expect(managerUsers[0].roles).toContain(UserRole.MANAGER);
  });
  
  it('should enforce constraints on department hierarchy and user assignments', async () => {
    // Get services
    const departmentService = new DepartmentService();
    const userAdminService = new UserAdminService();
    
    // 1. Attempt to create a department with duplicate code (should fail)
    const duplicateDeptInput: Omit<Department, 'departmentId' | 'createdAt' | 'updatedAt'> = {
      code: testRootDeptCode, // Same code as root department
      name: 'Duplicate Department',
      description: 'Duplicate department for integration tests',
      status: 'ACTIVE',
      parentId: null,
    };
    
    await expect(departmentService.createDepartment(duplicateDeptInput))
      .rejects.toThrow(/duplicate.*code/i);
    
    // 2. Attempt to create a user with non-existent department (should fail)
    const invalidUserInput = {
      username: 'invalid_user@test.com',
      email: 'invalid_user@test.com',
      firstName: 'Invalid',
      lastName: 'User',
      departmentId: 'non-existent-department-id',
      status: 'ACTIVE',
      roles: [UserRole.USER],
    };
    
    await expect(userAdminService.createUser(invalidUserInput))
      .rejects.toThrow(/department.*not found/i);
    
    // 3. Attempt to assign a user to a deactivated department (should fail)
    // First, deactivate a department
    await departmentService.deactivateDepartment(grandchildDeptIds[0]);
    
    // Verify department is deactivated
    const deactivatedDept = await departmentService.getDepartment(grandchildDeptIds[0]);
    expect(deactivatedDept.status).toBe('INACTIVE');
    
    // Attempt to create a user in the deactivated department
    const userInDeactivatedDeptInput = {
      username: 'invalid_dept_user@test.com',
      email: 'invalid_dept_user@test.com',
      firstName: 'Invalid',
      lastName: 'Department',
      departmentId: grandchildDeptIds[0],
      status: 'ACTIVE',
      roles: [UserRole.USER],
    };
    
    await expect(userAdminService.createUser(userInDeactivatedDeptInput))
      .rejects.toThrow(/department.*inactive/i);
  });
  
  it('should update user department assignments', async () => {
    // Get service
    const userAdminService = new UserAdminService();
    
    // Get a user to update
    const userToUpdate = userIds[2]; // One of the regular users
    const originalUser = await userAdminService.getUser(userToUpdate);
    
    // Update user's department to a different department
    const updatedDepartmentId = childDeptIds[1]; // Second child department
    await userAdminService.updateUser(userToUpdate, {
      departmentId: updatedDepartmentId,
    });
    
    // Verify user's department was updated
    const updatedUser = await userAdminService.getUser(userToUpdate);
    expect(updatedUser.departmentId).toBe(updatedDepartmentId);
    expect(updatedUser.departmentId).not.toBe(originalUser.departmentId);
  });
  
  it('should enforce cascade deactivation in department hierarchy', async () => {
    // Get services
    const departmentService = new DepartmentService();
    
    // Deactivate root department
    await departmentService.deactivateDepartment(rootDeptId);
    
    // Verify root department is deactivated
    const rootDept = await departmentService.getDepartment(rootDeptId);
    expect(rootDept.status).toBe('INACTIVE');
    
    // Verify child departments are also deactivated
    for (const childId of childDeptIds) {
      const childDept = await departmentService.getDepartment(childId);
      expect(childDept.status).toBe('INACTIVE');
    }
    
    // Verify grandchild departments are also deactivated
    for (const grandchildId of grandchildDeptIds) {
      const grandchildDept = await departmentService.getDepartment(grandchildId);
      expect(grandchildDept.status).toBe('INACTIVE');
    }
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete users
    for (const userId of userIds) {
      await dbClient.query('DELETE FROM users WHERE user_id = $1', [userId]);
    }
    
    // Delete department hierarchy from bottom up
    for (const grandchildId of grandchildDeptIds) {
      await dbClient.query('DELETE FROM department_hierarchy WHERE child_id = $1', [grandchildId]);
      await dbClient.query('DELETE FROM departments WHERE department_id = $1', [grandchildId]);
    }
    
    for (const childId of childDeptIds) {
      await dbClient.query('DELETE FROM department_hierarchy WHERE child_id = $1', [childId]);
      await dbClient.query('DELETE FROM departments WHERE department_id = $1', [childId]);
    }
    
    await dbClient.query('DELETE FROM departments WHERE department_id = $1', [rootDeptId]);
  });
});