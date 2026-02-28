"use strict";
/**
 * Role Service
 *
 * Manages role-based access control (RBAC) including:
 * - Role validation
 * - Permission resolution from roles
 * - Role hierarchy management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidRole = isValidRole;
exports.normalizeRoles = normalizeRoles;
exports.getPermissionsForRoles = getPermissionsForRoles;
exports.roleHasPermission = roleHasPermission;
exports.rolesHavePermission = rolesHavePermission;
exports.getAllRoles = getAllRoles;
exports.getAllPermissions = getAllPermissions;
exports.getRolePermissions = getRolePermissions;
exports.isAdminRole = isAdminRole;
exports.hasAdminRole = hasAdminRole;
exports.getHighestPrivilegeRole = getHighestPrivilegeRole;
exports.validateRoles = validateRoles;
const utils_1 = require("@ams/utils");
const auth_types_1 = require("./auth-types");
const logger = (0, utils_1.createLogger)({ service: 'role-service' });
/**
 * Check if a string is a valid role
 */
function isValidRole(role) {
    return Object.values(auth_types_1.ROLES).includes(role);
}
/**
 * Validate and normalize roles from Cognito groups
 * Filters out invalid roles and returns only valid ones
 */
function normalizeRoles(groups) {
    if (!groups || groups.length === 0) {
        logger.debug('No groups provided, returning empty roles');
        return [];
    }
    const validRoles = [];
    for (const group of groups) {
        // Cognito groups might be prefixed or have different casing
        const normalizedGroup = group.toUpperCase().replace(/-/g, '_');
        if (isValidRole(normalizedGroup)) {
            validRoles.push(normalizedGroup);
        }
        else {
            logger.debug('Ignoring unknown group', { group, normalizedGroup });
        }
    }
    return validRoles;
}
/**
 * Get all permissions for a set of roles
 * Combines permissions from all roles and removes duplicates
 */
function getPermissionsForRoles(roles) {
    const permissionSet = new Set();
    for (const role of roles) {
        const rolePermissions = auth_types_1.ROLE_PERMISSIONS[role];
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
function roleHasPermission(role, permission) {
    const permissions = auth_types_1.ROLE_PERMISSIONS[role];
    return permissions ? permissions.includes(permission) : false;
}
/**
 * Check if any of the given roles has the specified permission
 */
function rolesHavePermission(roles, permission) {
    return roles.some(role => roleHasPermission(role, permission));
}
/**
 * Get all available roles
 */
function getAllRoles() {
    return Object.values(auth_types_1.ROLES);
}
/**
 * Get all available permissions
 */
function getAllPermissions() {
    return Object.values(auth_types_1.PERMISSIONS);
}
/**
 * Get permissions for a specific role
 */
function getRolePermissions(role) {
    return auth_types_1.ROLE_PERMISSIONS[role] ?? [];
}
/**
 * Check if a role is an admin role
 */
function isAdminRole(role) {
    return role === auth_types_1.ROLES.ADMIN;
}
/**
 * Check if any of the roles is an admin role
 */
function hasAdminRole(roles) {
    return roles.includes(auth_types_1.ROLES.ADMIN);
}
/**
 * Get the highest privilege role from a list of roles
 * Admin > Asset Manager > Others > Viewer
 */
function getHighestPrivilegeRole(roles) {
    if (roles.length === 0) {
        return null;
    }
    const rolePriority = {
        [auth_types_1.ROLES.ADMIN]: 100,
        [auth_types_1.ROLES.ASSET_MANAGER]: 80,
        [auth_types_1.ROLES.SOFTWARE_MANAGER]: 70,
        [auth_types_1.ROLES.INVENTORY_MANAGER]: 60,
        [auth_types_1.ROLES.MAINTENANCE_MANAGER]: 50,
        [auth_types_1.ROLES.VIEWER]: 10,
    };
    let highestRole = roles[0];
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
function validateRoles(userRoles, requiredRoles) {
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
//# sourceMappingURL=role-service.js.map