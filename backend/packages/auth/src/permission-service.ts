/**
 * Permission Service
 * 
 * Handles permission checking and authorization decisions.
 * Implements granular permission-based access control.
 */

import { createLogger } from '@ams/utils';

import {
  type AuthContext,
  type AuthorizationAuditEntry,
  type AuthorizationResult,
  type Permission,
  AuthorizationError,
  PERMISSIONS,
} from './auth-types';
import { hasAdminRole } from './role-service';

const logger = createLogger({ service: 'permission-service' });

/**
 * Check if a permission string is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(PERMISSIONS).includes(permission as Permission);
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(
  userPermissions: readonly Permission[],
  requiredPermission: Permission
): boolean {
  return userPermissions.includes(requiredPermission);
}

/**
 * Check if a user has all of the required permissions
 */
export function hasAllPermissions(
  userPermissions: readonly Permission[],
  requiredPermissions: readonly Permission[]
): boolean {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.every(permission =>
    userPermissions.includes(permission)
  );
}

/**
 * Check if a user has any of the required permissions
 */
export function hasAnyPermission(
  userPermissions: readonly Permission[],
  requiredPermissions: readonly Permission[]
): boolean {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some(permission =>
    userPermissions.includes(permission)
  );
}

/**
 * Get missing permissions from a required set
 */
export function getMissingPermissions(
  userPermissions: readonly Permission[],
  requiredPermissions: readonly Permission[]
): Permission[] {
  return requiredPermissions.filter(
    permission => !userPermissions.includes(permission)
  );
}

/**
 * Authorize an action based on required permissions
 * Returns an AuthorizationResult with the decision and reason
 */
export function authorize(
  context: AuthContext,
  requiredPermissions: readonly Permission[],
  options: {
    requireAll?: boolean;
    resource?: string;
    action?: string;
  } = {}
): AuthorizationResult {
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
  if (hasAdminRole(context.user.roles)) {
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
export function requirePermissions(
  context: AuthContext,
  requiredPermissions: readonly Permission[],
  options: {
    requireAll?: boolean;
    resource?: string;
    action?: string;
  } = {}
): void {
  const result = authorize(context, requiredPermissions, options);

  if (!result.allowed) {
    throw new AuthorizationError(
      result.reason,
      result.missingPermissions,
      'FORBIDDEN'
    );
  }
}

/**
 * Create an audit log entry for an authorization decision
 */
export function createAuthorizationAuditEntry(
  context: AuthContext,
  resource: string,
  action: string,
  requiredPermissions: readonly Permission[],
  decision: 'ALLOWED' | 'DENIED',
  reason: string
): AuthorizationAuditEntry {
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
export const OPERATION_PERMISSIONS = {
  // Asset operations
  'asset:list': [PERMISSIONS.ASSET_READ],
  'asset:get': [PERMISSIONS.ASSET_READ],
  'asset:create': [PERMISSIONS.ASSET_CREATE],
  'asset:update': [PERMISSIONS.ASSET_UPDATE],
  'asset:delete': [PERMISSIONS.ASSET_DELETE],
  
  // Inventory operations
  'inventory:list': [PERMISSIONS.INVENTORY_READ],
  'inventory:get': [PERMISSIONS.INVENTORY_READ],
  'inventory:update': [PERMISSIONS.INVENTORY_UPDATE],
  'inventory:transfer': [PERMISSIONS.INVENTORY_UPDATE],
  
  // Software operations
  'software:list': [PERMISSIONS.SOFTWARE_READ],
  'software:get': [PERMISSIONS.SOFTWARE_READ],
  'software:reconcile': [PERMISSIONS.SOFTWARE_MANAGE],
  'software:reclaim': [PERMISSIONS.SOFTWARE_MANAGE],
  
  // Maintenance operations
  'maintenance:list': [PERMISSIONS.MAINTENANCE_READ],
  'maintenance:get': [PERMISSIONS.MAINTENANCE_READ],
  'maintenance:create': [PERMISSIONS.MAINTENANCE_MANAGE],
  'maintenance:update': [PERMISSIONS.MAINTENANCE_MANAGE],
  
  // Contract operations
  'contract:list': [PERMISSIONS.CONTRACT_READ],
  'contract:get': [PERMISSIONS.CONTRACT_READ],
  'contract:create': [PERMISSIONS.CONTRACT_MANAGE],
  'contract:update': [PERMISSIONS.CONTRACT_MANAGE],
  
  // Report operations
  'report:list': [PERMISSIONS.REPORT_READ],
  'report:get': [PERMISSIONS.REPORT_READ],
  'report:export': [PERMISSIONS.REPORT_EXPORT],
  
  // Admin operations
  'admin:users:list': [PERMISSIONS.ADMIN_USERS],
  'admin:users:manage': [PERMISSIONS.ADMIN_USERS],
  'admin:roles:list': [PERMISSIONS.ADMIN_ROLES],
  'admin:roles:manage': [PERMISSIONS.ADMIN_ROLES],
  
  // Audit operations
  'audit:list': [PERMISSIONS.AUDIT_READ],
  'audit:get': [PERMISSIONS.AUDIT_READ],
} as const;

export type Operation = keyof typeof OPERATION_PERMISSIONS;

/**
 * Get required permissions for an operation
 */
export function getOperationPermissions(operation: Operation): readonly Permission[] {
  return OPERATION_PERMISSIONS[operation] ?? [];
}

/**
 * Authorize an operation by name
 */
export function authorizeOperation(
  context: AuthContext,
  operation: Operation,
  resource?: string
): AuthorizationResult {
  const requiredPermissions = getOperationPermissions(operation);
  return authorize(context, requiredPermissions, {
    resource: resource ?? operation,
    action: operation,
  });
}

/**
 * Require an operation to be authorized, throwing an error if not
 */
export function requireOperation(
  context: AuthContext,
  operation: Operation,
  resource?: string
): void {
  const result = authorizeOperation(context, operation, resource);

  if (!result.allowed) {
    throw new AuthorizationError(
      result.reason,
      result.missingPermissions,
      'FORBIDDEN'
    );
  }
}
