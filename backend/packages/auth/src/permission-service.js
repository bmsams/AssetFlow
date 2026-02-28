"use strict";
/**
 * Permission Service
 *
 * Handles permission checking and authorization decisions.
 * Implements granular permission-based access control.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATION_PERMISSIONS = void 0;
exports.isValidPermission = isValidPermission;
exports.hasPermission = hasPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.hasAnyPermission = hasAnyPermission;
exports.getMissingPermissions = getMissingPermissions;
exports.authorize = authorize;
exports.requirePermissions = requirePermissions;
exports.createAuthorizationAuditEntry = createAuthorizationAuditEntry;
exports.getOperationPermissions = getOperationPermissions;
exports.authorizeOperation = authorizeOperation;
exports.requireOperation = requireOperation;
const utils_1 = require("@ams/utils");
const auth_types_1 = require("./auth-types");
const role_service_1 = require("./role-service");
const logger = (0, utils_1.createLogger)({ service: 'permission-service' });
/**
 * Check if a permission string is valid
 */
function isValidPermission(permission) {
    return Object.values(auth_types_1.PERMISSIONS).includes(permission);
}
/**
 * Check if a user has a specific permission
 */
function hasPermission(userPermissions, requiredPermission) {
    return userPermissions.includes(requiredPermission);
}
/**
 * Check if a user has all of the required permissions
 */
function hasAllPermissions(userPermissions, requiredPermissions) {
    if (requiredPermissions.length === 0) {
        return true;
    }
    return requiredPermissions.every(permission => userPermissions.includes(permission));
}
/**
 * Check if a user has any of the required permissions
 */
function hasAnyPermission(userPermissions, requiredPermissions) {
    if (requiredPermissions.length === 0) {
        return true;
    }
    return requiredPermissions.some(permission => userPermissions.includes(permission));
}
/**
 * Get missing permissions from a required set
 */
function getMissingPermissions(userPermissions, requiredPermissions) {
    return requiredPermissions.filter(permission => !userPermissions.includes(permission));
}
/**
 * Authorize an action based on required permissions
 * Returns an AuthorizationResult with the decision and reason
 */
function authorize(context, requiredPermissions, options = {}) {
    const { requireAll = true, resource = 'unknown', action = 'access' } = options;
    // Check if user is authenticated
    if (!context.isAuthenticated) {
        logger.warn('Authorization denied: user not authenticated', {
            requestId: context.requestId,
            resource,
            action,
        });
        return {
            allowed: false,
            reason: 'User is not authenticated',
        };
    }
    // Admin role bypasses all permission checks
    if ((0, role_service_1.hasAdminRole)(context.user.roles)) {
        logger.debug('Authorization allowed: admin role', {
            requestId: context.requestId,
            userId: context.user.sub,
            resource,
            action,
        });
        return {
            allowed: true,
            reason: 'Admin role has full access',
        };
    }
    // No permissions required
    if (requiredPermissions.length === 0) {
        return {
            allowed: true,
            reason: 'No permissions required',
        };
    }
    const userPermissions = context.user.permissions;
    // Check permissions based on requireAll flag
    const hasRequired = requireAll
        ? hasAllPermissions(userPermissions, requiredPermissions)
        : hasAnyPermission(userPermissions, requiredPermissions);
    if (hasRequired) {
        logger.debug('Authorization allowed', {
            requestId: context.requestId,
            userId: context.user.sub,
            resource,
            action,
            requiredPermissions,
        });
        return {
            allowed: true,
            reason: 'User has required permissions',
        };
    }
    const missingPermissions = getMissingPermissions(userPermissions, requiredPermissions);
    logger.warn('Authorization denied: missing permissions', {
        requestId: context.requestId,
        userId: context.user.sub,
        resource,
        action,
        requiredPermissions,
        userPermissions,
        missingPermissions,
    });
    return {
        allowed: false,
        reason: `Missing required permissions: ${missingPermissions.join(', ')}`,
        missingPermissions,
    };
}
/**
 * Require specific permissions, throwing an error if not authorized
 */
function requirePermissions(context, requiredPermissions, options = {}) {
    const result = authorize(context, requiredPermissions, options);
    if (!result.allowed) {
        throw new auth_types_1.AuthorizationError(result.reason, result.missingPermissions, 'FORBIDDEN');
    }
}
/**
 * Create an audit log entry for an authorization decision
 */
function createAuthorizationAuditEntry(context, resource, action, requiredPermissions, decision, reason) {
    return {
        timestamp: new Date().toISOString(),
        requestId: context.requestId,
        userId: context.user.sub,
        userEmail: context.user.email,
        resource,
        action,
        requiredPermissions,
        userPermissions: context.user.permissions,
        decision,
        reason,
        sourceIp: context.sourceIp,
    };
}
/**
 * Permission requirements for common operations
 */
exports.OPERATION_PERMISSIONS = {
    // Asset operations
    'asset:list': [auth_types_1.PERMISSIONS.ASSET_READ],
    'asset:get': [auth_types_1.PERMISSIONS.ASSET_READ],
    'asset:create': [auth_types_1.PERMISSIONS.ASSET_CREATE],
    'asset:update': [auth_types_1.PERMISSIONS.ASSET_UPDATE],
    'asset:delete': [auth_types_1.PERMISSIONS.ASSET_DELETE],
    // Inventory operations
    'inventory:list': [auth_types_1.PERMISSIONS.INVENTORY_READ],
    'inventory:get': [auth_types_1.PERMISSIONS.INVENTORY_READ],
    'inventory:update': [auth_types_1.PERMISSIONS.INVENTORY_UPDATE],
    'inventory:transfer': [auth_types_1.PERMISSIONS.INVENTORY_UPDATE],
    // Software operations
    'software:list': [auth_types_1.PERMISSIONS.SOFTWARE_READ],
    'software:get': [auth_types_1.PERMISSIONS.SOFTWARE_READ],
    'software:reconcile': [auth_types_1.PERMISSIONS.SOFTWARE_MANAGE],
    'software:reclaim': [auth_types_1.PERMISSIONS.SOFTWARE_MANAGE],
    // Maintenance operations
    'maintenance:list': [auth_types_1.PERMISSIONS.MAINTENANCE_READ],
    'maintenance:get': [auth_types_1.PERMISSIONS.MAINTENANCE_READ],
    'maintenance:create': [auth_types_1.PERMISSIONS.MAINTENANCE_MANAGE],
    'maintenance:update': [auth_types_1.PERMISSIONS.MAINTENANCE_MANAGE],
    // Contract operations
    'contract:list': [auth_types_1.PERMISSIONS.CONTRACT_READ],
    'contract:get': [auth_types_1.PERMISSIONS.CONTRACT_READ],
    'contract:create': [auth_types_1.PERMISSIONS.CONTRACT_MANAGE],
    'contract:update': [auth_types_1.PERMISSIONS.CONTRACT_MANAGE],
    // Report operations
    'report:list': [auth_types_1.PERMISSIONS.REPORT_READ],
    'report:get': [auth_types_1.PERMISSIONS.REPORT_READ],
    'report:export': [auth_types_1.PERMISSIONS.REPORT_EXPORT],
    // Admin operations
    'admin:users:list': [auth_types_1.PERMISSIONS.ADMIN_USERS],
    'admin:users:manage': [auth_types_1.PERMISSIONS.ADMIN_USERS],
    'admin:roles:list': [auth_types_1.PERMISSIONS.ADMIN_ROLES],
    'admin:roles:manage': [auth_types_1.PERMISSIONS.ADMIN_ROLES],
    // Audit operations
    'audit:list': [auth_types_1.PERMISSIONS.AUDIT_READ],
    'audit:get': [auth_types_1.PERMISSIONS.AUDIT_READ],
};
/**
 * Get required permissions for an operation
 */
function getOperationPermissions(operation) {
    return exports.OPERATION_PERMISSIONS[operation] ?? [];
}
/**
 * Authorize an operation by name
 */
function authorizeOperation(context, operation, resource) {
    const requiredPermissions = getOperationPermissions(operation);
    return authorize(context, requiredPermissions, {
        resource: resource ?? operation,
        action: operation,
    });
}
/**
 * Require an operation to be authorized, throwing an error if not
 */
function requireOperation(context, operation, resource) {
    const result = authorizeOperation(context, operation, resource);
    if (!result.allowed) {
        throw new auth_types_1.AuthorizationError(result.reason, result.missingPermissions, 'FORBIDDEN');
    }
}
//# sourceMappingURL=permission-service.js.map