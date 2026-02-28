/**
 * Permission Service
 *
 * Handles permission checking and authorization decisions.
 * Implements granular permission-based access control.
 */
import { type AuthContext, type AuthorizationAuditEntry, type AuthorizationResult, type Permission } from './auth-types';
/**
 * Check if a permission string is valid
 */
export declare function isValidPermission(permission: string): permission is Permission;
/**
 * Check if a user has a specific permission
 */
export declare function hasPermission(userPermissions: readonly Permission[], requiredPermission: Permission): boolean;
/**
 * Check if a user has all of the required permissions
 */
export declare function hasAllPermissions(userPermissions: readonly Permission[], requiredPermissions: readonly Permission[]): boolean;
/**
 * Check if a user has any of the required permissions
 */
export declare function hasAnyPermission(userPermissions: readonly Permission[], requiredPermissions: readonly Permission[]): boolean;
/**
 * Get missing permissions from a required set
 */
export declare function getMissingPermissions(userPermissions: readonly Permission[], requiredPermissions: readonly Permission[]): Permission[];
/**
 * Authorize an action based on required permissions
 * Returns an AuthorizationResult with the decision and reason
 */
export declare function authorize(context: AuthContext, requiredPermissions: readonly Permission[], options?: {
    requireAll?: boolean;
    resource?: string;
    action?: string;
}): AuthorizationResult;
/**
 * Require specific permissions, throwing an error if not authorized
 */
export declare function requirePermissions(context: AuthContext, requiredPermissions: readonly Permission[], options?: {
    requireAll?: boolean;
    resource?: string;
    action?: string;
}): void;
/**
 * Create an audit log entry for an authorization decision
 */
export declare function createAuthorizationAuditEntry(context: AuthContext, resource: string, action: string, requiredPermissions: readonly Permission[], decision: 'ALLOWED' | 'DENIED', reason: string): AuthorizationAuditEntry;
/**
 * Permission requirements for common operations
 */
export declare const OPERATION_PERMISSIONS: {
    readonly 'asset:list': readonly ["asset:read"];
    readonly 'asset:get': readonly ["asset:read"];
    readonly 'asset:create': readonly ["asset:create"];
    readonly 'asset:update': readonly ["asset:update"];
    readonly 'asset:delete': readonly ["asset:delete"];
    readonly 'inventory:list': readonly ["inventory:read"];
    readonly 'inventory:get': readonly ["inventory:read"];
    readonly 'inventory:update': readonly ["inventory:update"];
    readonly 'inventory:transfer': readonly ["inventory:update"];
    readonly 'software:list': readonly ["software:read"];
    readonly 'software:get': readonly ["software:read"];
    readonly 'software:reconcile': readonly ["software:manage"];
    readonly 'software:reclaim': readonly ["software:manage"];
    readonly 'maintenance:list': readonly ["maintenance:read"];
    readonly 'maintenance:get': readonly ["maintenance:read"];
    readonly 'maintenance:create': readonly ["maintenance:manage"];
    readonly 'maintenance:update': readonly ["maintenance:manage"];
    readonly 'contract:list': readonly ["contract:read"];
    readonly 'contract:get': readonly ["contract:read"];
    readonly 'contract:create': readonly ["contract:manage"];
    readonly 'contract:update': readonly ["contract:manage"];
    readonly 'report:list': readonly ["report:read"];
    readonly 'report:get': readonly ["report:read"];
    readonly 'report:export': readonly ["report:export"];
    readonly 'admin:users:list': readonly ["admin:users"];
    readonly 'admin:users:manage': readonly ["admin:users"];
    readonly 'admin:roles:list': readonly ["admin:roles"];
    readonly 'admin:roles:manage': readonly ["admin:roles"];
    readonly 'audit:list': readonly ["audit:read"];
    readonly 'audit:get': readonly ["audit:read"];
};
export type Operation = keyof typeof OPERATION_PERMISSIONS;
/**
 * Get required permissions for an operation
 */
export declare function getOperationPermissions(operation: Operation): readonly Permission[];
/**
 * Authorize an operation by name
 */
export declare function authorizeOperation(context: AuthContext, operation: Operation, resource?: string): AuthorizationResult;
/**
 * Require an operation to be authorized, throwing an error if not
 */
export declare function requireOperation(context: AuthContext, operation: Operation, resource?: string): void;
//# sourceMappingURL=permission-service.d.ts.map