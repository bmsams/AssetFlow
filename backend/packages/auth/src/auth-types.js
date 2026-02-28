"use strict";
/**
 * Authentication and Authorization Types
 *
 * Defines types for User, Role, Permission, and AuthContext
 * used throughout the Asset Management System.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationError = exports.AuthenticationError = exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.ROLES = void 0;
/**
 * Predefined system roles for RBAC
 * Based on Requirement 14.2
 */
exports.ROLES = {
    /** Full system access - can manage users, roles, and all resources */
    ADMIN: 'ADMIN',
    /** Asset CRUD operations - create, read, update, delete assets */
    ASSET_MANAGER: 'ASSET_MANAGER',
    /** Stockroom and inventory operations - manage inventory levels and transfers */
    INVENTORY_MANAGER: 'INVENTORY_MANAGER',
    /** Software license management - reconciliation, compliance, reclamation */
    SOFTWARE_MANAGER: 'SOFTWARE_MANAGER',
    /** Work orders and maintenance - manage maintenance plans and work orders */
    MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
    /** Read-only access - view assets and reports without modification */
    VIEWER: 'VIEWER',
};
/**
 * Granular permissions for fine-grained access control
 * Based on Requirement 14.3
 */
exports.PERMISSIONS = {
    // Asset permissions
    ASSET_READ: 'asset:read',
    ASSET_CREATE: 'asset:create',
    ASSET_UPDATE: 'asset:update',
    ASSET_DELETE: 'asset:delete',
    // Inventory permissions
    INVENTORY_READ: 'inventory:read',
    INVENTORY_UPDATE: 'inventory:update',
    // Software permissions
    SOFTWARE_READ: 'software:read',
    SOFTWARE_MANAGE: 'software:manage',
    // Maintenance permissions
    MAINTENANCE_READ: 'maintenance:read',
    MAINTENANCE_MANAGE: 'maintenance:manage',
    // Admin permissions
    ADMIN_USERS: 'admin:users',
    ADMIN_ROLES: 'admin:roles',
    // Contract permissions
    CONTRACT_READ: 'contract:read',
    CONTRACT_MANAGE: 'contract:manage',
    // Report permissions
    REPORT_READ: 'report:read',
    REPORT_EXPORT: 'report:export',
    // Audit permissions
    AUDIT_READ: 'audit:read',
};
/**
 * Role to permissions mapping
 * Defines which permissions each role has
 */
exports.ROLE_PERMISSIONS = {
    [exports.ROLES.ADMIN]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.ASSET_CREATE,
        exports.PERMISSIONS.ASSET_UPDATE,
        exports.PERMISSIONS.ASSET_DELETE,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.INVENTORY_UPDATE,
        exports.PERMISSIONS.SOFTWARE_READ,
        exports.PERMISSIONS.SOFTWARE_MANAGE,
        exports.PERMISSIONS.MAINTENANCE_READ,
        exports.PERMISSIONS.MAINTENANCE_MANAGE,
        exports.PERMISSIONS.ADMIN_USERS,
        exports.PERMISSIONS.ADMIN_ROLES,
        exports.PERMISSIONS.CONTRACT_READ,
        exports.PERMISSIONS.CONTRACT_MANAGE,
        exports.PERMISSIONS.REPORT_READ,
        exports.PERMISSIONS.REPORT_EXPORT,
        exports.PERMISSIONS.AUDIT_READ,
    ],
    [exports.ROLES.ASSET_MANAGER]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.ASSET_CREATE,
        exports.PERMISSIONS.ASSET_UPDATE,
        exports.PERMISSIONS.ASSET_DELETE,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.CONTRACT_READ,
        exports.PERMISSIONS.REPORT_READ,
        exports.PERMISSIONS.REPORT_EXPORT,
    ],
    [exports.ROLES.INVENTORY_MANAGER]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.INVENTORY_UPDATE,
        exports.PERMISSIONS.REPORT_READ,
        exports.PERMISSIONS.REPORT_EXPORT,
    ],
    [exports.ROLES.SOFTWARE_MANAGER]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.SOFTWARE_READ,
        exports.PERMISSIONS.SOFTWARE_MANAGE,
        exports.PERMISSIONS.CONTRACT_READ,
        exports.PERMISSIONS.REPORT_READ,
        exports.PERMISSIONS.REPORT_EXPORT,
    ],
    [exports.ROLES.MAINTENANCE_MANAGER]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.MAINTENANCE_READ,
        exports.PERMISSIONS.MAINTENANCE_MANAGE,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.REPORT_READ,
    ],
    [exports.ROLES.VIEWER]: [
        exports.PERMISSIONS.ASSET_READ,
        exports.PERMISSIONS.INVENTORY_READ,
        exports.PERMISSIONS.SOFTWARE_READ,
        exports.PERMISSIONS.MAINTENANCE_READ,
        exports.PERMISSIONS.CONTRACT_READ,
        exports.PERMISSIONS.REPORT_READ,
    ],
};
/**
 * Error thrown when authentication fails
 */
class AuthenticationError extends Error {
    code;
    statusCode;
    constructor(message, code = 'UNAUTHORIZED') {
        super(message);
        this.name = 'AuthenticationError';
        this.code = code;
        this.statusCode = 401;
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * Error thrown when authorization fails
 */
class AuthorizationError extends Error {
    code;
    statusCode;
    missingPermissions;
    constructor(message, missingPermissions = [], code = 'FORBIDDEN') {
        super(message);
        this.name = 'AuthorizationError';
        this.code = code;
        this.statusCode = 403;
        this.missingPermissions = missingPermissions;
    }
}
exports.AuthorizationError = AuthorizationError;
//# sourceMappingURL=auth-types.js.map