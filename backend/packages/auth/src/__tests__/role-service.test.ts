/**
 * Role Service Tests
 */

import {
  getAllPermissions,
  getAllRoles,
  getHighestPrivilegeRole,
  getPermissionsForRoles,
  getRolePermissions,
  hasAdminRole,
  isAdminRole,
  isValidRole,
  normalizeRoles,
  PERMISSIONS,
  roleHasPermission,
  ROLES,
  rolesHavePermission,
  validateRoles,
} from '../index';

describe('isValidRole', () => {
  it('should return true for valid roles', () => {
    expect(isValidRole('ADMIN')).toBe(true);
    expect(isValidRole('ASSET_MANAGER')).toBe(true);
    expect(isValidRole('INVENTORY_MANAGER')).toBe(true);
    expect(isValidRole('SOFTWARE_MANAGER')).toBe(true);
    expect(isValidRole('MAINTENANCE_MANAGER')).toBe(true);
    expect(isValidRole('VIEWER')).toBe(true);
  });

  it('should return false for invalid roles', () => {
    expect(isValidRole('INVALID')).toBe(false);
    expect(isValidRole('')).toBe(false);
    expect(isValidRole('admin')).toBe(false); // case sensitive
    expect(isValidRole('SUPER_ADMIN')).toBe(false);
  });
});

describe('normalizeRoles', () => {
  it('should normalize valid roles from groups', () => {
    const roles = normalizeRoles(['ADMIN', 'VIEWER']);
    expect(roles).toContain(ROLES.ADMIN);
    expect(roles).toContain(ROLES.VIEWER);
  });

  it('should handle case-insensitive groups', () => {
    const roles = normalizeRoles(['admin', 'Asset_Manager']);
    expect(roles).toContain(ROLES.ADMIN);
    expect(roles).toContain(ROLES.ASSET_MANAGER);
  });

  it('should handle hyphenated groups', () => {
    const roles = normalizeRoles(['asset-manager', 'inventory-manager']);
    expect(roles).toContain(ROLES.ASSET_MANAGER);
    expect(roles).toContain(ROLES.INVENTORY_MANAGER);
  });

  it('should filter out invalid groups', () => {
    const roles = normalizeRoles(['ADMIN', 'INVALID_GROUP', 'VIEWER']);
    expect(roles).toContain(ROLES.ADMIN);
    expect(roles).toContain(ROLES.VIEWER);
    expect(roles.length).toBe(2);
  });

  it('should return empty array for undefined groups', () => {
    const roles = normalizeRoles(undefined);
    expect(roles).toEqual([]);
  });

  it('should return empty array for empty groups', () => {
    const roles = normalizeRoles([]);
    expect(roles).toEqual([]);
  });
});

describe('getPermissionsForRoles', () => {
  it('should return all permissions for admin role', () => {
    const permissions = getPermissionsForRoles([ROLES.ADMIN]);
    expect(permissions).toContain(PERMISSIONS.ASSET_READ);
    expect(permissions).toContain(PERMISSIONS.ASSET_CREATE);
    expect(permissions).toContain(PERMISSIONS.ADMIN_USERS);
    expect(permissions).toContain(PERMISSIONS.ADMIN_ROLES);
  });

  it('should return limited permissions for viewer role', () => {
    const permissions = getPermissionsForRoles([ROLES.VIEWER]);
    expect(permissions).toContain(PERMISSIONS.ASSET_READ);
    expect(permissions).not.toContain(PERMISSIONS.ASSET_CREATE);
    expect(permissions).not.toContain(PERMISSIONS.ADMIN_USERS);
  });

  it('should combine permissions from multiple roles', () => {
    const permissions = getPermissionsForRoles([ROLES.VIEWER, ROLES.INVENTORY_MANAGER]);
    expect(permissions).toContain(PERMISSIONS.ASSET_READ);
    expect(permissions).toContain(PERMISSIONS.INVENTORY_UPDATE);
  });

  it('should deduplicate permissions', () => {
    const permissions = getPermissionsForRoles([ROLES.ADMIN, ROLES.ASSET_MANAGER]);
    const uniquePermissions = new Set(permissions);
    expect(permissions.length).toBe(uniquePermissions.size);
  });

  it('should return empty array for empty roles', () => {
    const permissions = getPermissionsForRoles([]);
    expect(permissions).toEqual([]);
  });
});

describe('roleHasPermission', () => {
  it('should return true when role has permission', () => {
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.ASSET_READ)).toBe(true);
    expect(roleHasPermission(ROLES.ASSET_MANAGER, PERMISSIONS.ASSET_CREATE)).toBe(true);
  });

  it('should return false when role lacks permission', () => {
    expect(roleHasPermission(ROLES.VIEWER, PERMISSIONS.ASSET_CREATE)).toBe(false);
    expect(roleHasPermission(ROLES.VIEWER, PERMISSIONS.ADMIN_USERS)).toBe(false);
  });
});

describe('rolesHavePermission', () => {
  it('should return true when any role has permission', () => {
    expect(rolesHavePermission([ROLES.VIEWER, ROLES.ADMIN], PERMISSIONS.ADMIN_USERS)).toBe(true);
  });

  it('should return false when no role has permission', () => {
    expect(rolesHavePermission([ROLES.VIEWER], PERMISSIONS.ADMIN_USERS)).toBe(false);
  });

  it('should return false for empty roles', () => {
    expect(rolesHavePermission([], PERMISSIONS.ASSET_READ)).toBe(false);
  });
});

describe('getAllRoles', () => {
  it('should return all defined roles', () => {
    const roles = getAllRoles();
    expect(roles).toContain(ROLES.ADMIN);
    expect(roles).toContain(ROLES.ASSET_MANAGER);
    expect(roles).toContain(ROLES.INVENTORY_MANAGER);
    expect(roles).toContain(ROLES.SOFTWARE_MANAGER);
    expect(roles).toContain(ROLES.MAINTENANCE_MANAGER);
    expect(roles).toContain(ROLES.VIEWER);
    expect(roles.length).toBe(6);
  });
});

describe('getAllPermissions', () => {
  it('should return all defined permissions', () => {
    const permissions = getAllPermissions();
    expect(permissions).toContain(PERMISSIONS.ASSET_READ);
    expect(permissions).toContain(PERMISSIONS.ASSET_CREATE);
    expect(permissions).toContain(PERMISSIONS.ADMIN_USERS);
    expect(permissions.length).toBeGreaterThan(0);
  });
});

describe('getRolePermissions', () => {
  it('should return permissions for a specific role', () => {
    const permissions = getRolePermissions(ROLES.VIEWER);
    expect(permissions).toContain(PERMISSIONS.ASSET_READ);
    expect(permissions).not.toContain(PERMISSIONS.ASSET_CREATE);
  });
});

describe('isAdminRole', () => {
  it('should return true for admin role', () => {
    expect(isAdminRole(ROLES.ADMIN)).toBe(true);
  });

  it('should return false for non-admin roles', () => {
    expect(isAdminRole(ROLES.VIEWER)).toBe(false);
    expect(isAdminRole(ROLES.ASSET_MANAGER)).toBe(false);
  });
});

describe('hasAdminRole', () => {
  it('should return true when admin role is present', () => {
    expect(hasAdminRole([ROLES.VIEWER, ROLES.ADMIN])).toBe(true);
  });

  it('should return false when admin role is not present', () => {
    expect(hasAdminRole([ROLES.VIEWER, ROLES.ASSET_MANAGER])).toBe(false);
  });

  it('should return false for empty roles', () => {
    expect(hasAdminRole([])).toBe(false);
  });
});

describe('getHighestPrivilegeRole', () => {
  it('should return admin as highest privilege', () => {
    const role = getHighestPrivilegeRole([ROLES.VIEWER, ROLES.ADMIN, ROLES.ASSET_MANAGER]);
    expect(role).toBe(ROLES.ADMIN);
  });

  it('should return asset manager over viewer', () => {
    const role = getHighestPrivilegeRole([ROLES.VIEWER, ROLES.ASSET_MANAGER]);
    expect(role).toBe(ROLES.ASSET_MANAGER);
  });

  it('should return null for empty roles', () => {
    const role = getHighestPrivilegeRole([]);
    expect(role).toBeNull();
  });

  it('should return the only role when single role provided', () => {
    const role = getHighestPrivilegeRole([ROLES.VIEWER]);
    expect(role).toBe(ROLES.VIEWER);
  });
});

describe('validateRoles', () => {
  it('should validate when user has required role', () => {
    const result = validateRoles([ROLES.ASSET_MANAGER], [ROLES.ASSET_MANAGER]);
    expect(result.valid).toBe(true);
    expect(result.missingRoles).toEqual([]);
  });

  it('should validate when user has any of required roles', () => {
    const result = validateRoles([ROLES.VIEWER], [ROLES.VIEWER, ROLES.ASSET_MANAGER]);
    expect(result.valid).toBe(true);
  });

  it('should validate admin for any required roles', () => {
    const result = validateRoles([ROLES.ADMIN], [ROLES.ASSET_MANAGER, ROLES.SOFTWARE_MANAGER]);
    expect(result.valid).toBe(true);
  });

  it('should fail when user lacks required roles', () => {
    const result = validateRoles([ROLES.VIEWER], [ROLES.ADMIN]);
    expect(result.valid).toBe(false);
    expect(result.missingRoles).toContain(ROLES.ADMIN);
  });

  it('should pass when no roles required', () => {
    const result = validateRoles([ROLES.VIEWER], []);
    expect(result.valid).toBe(true);
  });
});
