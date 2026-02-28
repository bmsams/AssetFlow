/**
 * Role Service
 *
 * Manages role-based access control (RBAC) including:
 * - Role validation
 * - Permission resolution from roles
 * - Role hierarchy management
 */
import { type Permission, type Role } from './auth-types';
/**
 * Check if a string is a valid role
 */
export declare function isValidRole(role: string): role is Role;
/**
 * Validate and normalize roles from Cognito groups
 * Filters out invalid roles and returns only valid ones
 */
export declare function normalizeRoles(groups: readonly string[] | undefined): Role[];
/**
 * Get all permissions for a set of roles
 * Combines permissions from all roles and removes duplicates
 */
export declare function getPermissionsForRoles(roles: readonly Role[]): Permission[];
/**
 * Check if a role has a specific permission
 */
export declare function roleHasPermission(role: Role, permission: Permission): boolean;
/**
 * Check if any of the given roles has the specified permission
 */
export declare function rolesHavePermission(roles: readonly Role[], permission: Permission): boolean;
/**
 * Get all available roles
 */
export declare function getAllRoles(): readonly Role[];
/**
 * Get all available permissions
 */
export declare function getAllPermissions(): readonly Permission[];
/**
 * Get permissions for a specific role
 */
export declare function getRolePermissions(role: Role): readonly Permission[];
/**
 * Check if a role is an admin role
 */
export declare function isAdminRole(role: Role): boolean;
/**
 * Check if any of the roles is an admin role
 */
export declare function hasAdminRole(roles: readonly Role[]): boolean;
/**
 * Get the highest privilege role from a list of roles
 * Admin > Asset Manager > Others > Viewer
 */
export declare function getHighestPrivilegeRole(roles: readonly Role[]): Role | null;
/**
 * Validate that a user has at least one of the required roles
 */
export declare function validateRoles(userRoles: readonly Role[], requiredRoles: readonly Role[]): {
    valid: boolean;
    missingRoles: Role[];
};
//# sourceMappingURL=role-service.d.ts.map