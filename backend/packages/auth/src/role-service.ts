/**
 * Role Service
 * 
 * Manages role-based access control (RBAC) including:
 * - Role validation
 * - Permission resolution from roles
 * - Role hierarchy management
 */

import { createLogger } from '@ams/utils';

import {
  type Permission,
  type Role,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
} from './auth-types';

const logger = createLogger({ service: 'role-service' });

/**
 * Check if a string is a valid role
 */
export function isValidRole(role: string): role is Role {
  return Object.values(ROLES).includes(role as Role);
}

/**
 * Validate and normalize roles from Cognito groups
 * Filters out invalid roles and returns only valid ones
 */
export function normalizeRoles(groups: readonly string[] | undefined): Role[] {
  if (!groups || groups.length === 0) {
    logger.debug('No groups provided, returning empty roles');
    return [];
  }

  const validRoles: Role[] = [];
  
  for (const group of groups) {
    // Cognito groups might be prefixed or have different casing
    const normalizedGroup = group.toUpperCase().replace(/-/g, '_');
    
    if (isValidRole(normalizedGroup)) {
      validRoles.push(normalizedGroup);
    } else {
      logger.debug('Ignoring unknown group', { group, normalizedGroup });
    }
  }

  return validRoles;
}

/**
 * Get all permissions for a set of roles
 * Combines permissions from all roles and removes duplicates
 */
export function getPermissionsForRoles(roles: readonly Role[]): Permission[] {
  const permissionSet = new Set<Permission>();

  for (const role of roles) {
    const rolePermissions = ROLE_PERMISSIONS[role];
    if (rolePermissions) {
      for (const permission of rolePermissions) {
        permissionSet.add(permission);
      }
    }
  }

  return Array.from(permissionSet);
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Check if any of the given roles has the specified permission
 */
export function rolesHavePermission(
  roles: readonly Role[],
  permission: Permission
): boolean {
  return roles.some(role => roleHasPermission(role, permission));
}

/**
 * Get all available roles
 */
export function getAllRoles(): readonly Role[] {
  return Object.values(ROLES);
}

/**
 * Get all available permissions
 */
export function getAllPermissions(): readonly Permission[] {
  return Object.values(PERMISSIONS);
}

/**
 * Get permissions for a specific role
 */
export function getRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a role is an admin role
 */
export function isAdminRole(role: Role): boolean {
  return role === ROLES.ADMIN;
}

/**
 * Check if any of the roles is an admin role
 */
export function hasAdminRole(roles: readonly Role[]): boolean {
  return roles.includes(ROLES.ADMIN);
}

/**
 * Get the highest privilege role from a list of roles
 * Admin > Asset Manager > Others > Viewer
 */
export function getHighestPrivilegeRole(roles: readonly Role[]): Role | null {
  if (roles.length === 0) {
    return null;
  }

  const rolePriority: Record<Role, number> = {
    [ROLES.ADMIN]: 100,
    [ROLES.ASSET_MANAGER]: 80,
    [ROLES.SOFTWARE_MANAGER]: 70,
    [ROLES.INVENTORY_MANAGER]: 60,
    [ROLES.MAINTENANCE_MANAGER]: 50,
    [ROLES.VIEWER]: 10,
  };

  let highestRole: Role = roles[0]!;
  let highestPriority = rolePriority[highestRole] ?? 0;

  for (const role of roles) {
    const priority = rolePriority[role] ?? 0;
    if (priority > highestPriority) {
      highestRole = role;
      highestPriority = priority;
    }
  }

  return highestRole;
}

/**
 * Validate that a user has at least one of the required roles
 */
export function validateRoles(
  userRoles: readonly Role[],
  requiredRoles: readonly Role[]
): { valid: boolean; missingRoles: Role[] } {
  if (requiredRoles.length === 0) {
    return { valid: true, missingRoles: [] };
  }

  // Admin role bypasses all role checks
  if (hasAdminRole(userRoles)) {
    return { valid: true, missingRoles: [] };
  }

  const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
  
  if (hasRequiredRole) {
    return { valid: true, missingRoles: [] };
  }

  return {
    valid: false,
    missingRoles: requiredRoles.filter(role => !userRoles.includes(role)),
  };
}
