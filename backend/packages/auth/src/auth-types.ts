/**
 * Authentication and Authorization Types
 * 
 * Defines types for User, Role, Permission, and AuthContext
 * used throughout the Asset Management System.
 */

import type { ISODateString } from '@ams/types';

/**
 * Predefined system roles for RBAC
 * Based on Requirement 14.2
 */
export const ROLES = {
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
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Granular permissions for fine-grained access control
 * Based on Requirement 14.3
 */
export const PERMISSIONS = {
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
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role to permissions mapping
 * Defines which permissions each role has
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.ADMIN]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.ASSET_CREATE,
    PERMISSIONS.ASSET_UPDATE,
    PERMISSIONS.ASSET_DELETE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.SOFTWARE_READ,
    PERMISSIONS.SOFTWARE_MANAGE,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_MANAGE,
    PERMISSIONS.ADMIN_USERS,
    PERMISSIONS.ADMIN_ROLES,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.CONTRACT_MANAGE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_READ,
  ],
  [ROLES.ASSET_MANAGER]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.ASSET_CREATE,
    PERMISSIONS.ASSET_UPDATE,
    PERMISSIONS.ASSET_DELETE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  [ROLES.INVENTORY_MANAGER]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  [ROLES.SOFTWARE_MANAGER]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.SOFTWARE_READ,
    PERMISSIONS.SOFTWARE_MANAGE,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.REPORT_READ,
    PERMISSIONS.REPORT_EXPORT,
  ],
  [ROLES.MAINTENANCE_MANAGER]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.MAINTENANCE_MANAGE,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.REPORT_READ,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.ASSET_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.SOFTWARE_READ,
    PERMISSIONS.MAINTENANCE_READ,
    PERMISSIONS.CONTRACT_READ,
    PERMISSIONS.REPORT_READ,
  ],
} as const;

/**
 * User information extracted from JWT token
 */
export interface AuthUser {
  /** Cognito user sub (unique identifier) */
  readonly sub: string;
  /** User's email address */
  readonly email: string;
  /** User's first name (optional) */
  readonly firstName?: string;
  /** User's last name (optional) */
  readonly lastName?: string;
  /** User's assigned roles from Cognito groups */
  readonly roles: readonly Role[];
  /** Computed permissions based on roles */
  readonly permissions: readonly Permission[];
}

/**
 * Authentication context for request handling
 * Contains user information and authorization details
 */
export interface AuthContext {
  /** Authenticated user information */
  readonly user: AuthUser;
  /** Request ID for tracing */
  readonly requestId: string;
  /** Source IP address */
  readonly sourceIp?: string;
  /** User agent string */
  readonly userAgent?: string;
  /** Token expiration timestamp */
  readonly tokenExpiration: number;
  /** Whether the user is authenticated */
  readonly isAuthenticated: boolean;
}

/**
 * JWT token claims from Cognito
 */
export interface CognitoTokenClaims {
  /** Subject (user ID) */
  readonly sub: string;
  /** Email address */
  readonly email: string;
  /** Email verified flag */
  readonly email_verified?: boolean;
  /** Cognito groups (roles) */
  readonly 'cognito:groups'?: readonly string[];
  /** Cognito username */
  readonly 'cognito:username'?: string;
  /** Given name */
  readonly given_name?: string;
  /** Family name */
  readonly family_name?: string;
  /** Token issued at timestamp */
  readonly iat: number;
  /** Token expiration timestamp */
  readonly exp: number;
  /** Token issuer */
  readonly iss: string;
  /** Token audience */
  readonly aud?: string;
  /** Token use (access or id) */
  readonly token_use?: 'access' | 'id';
}

/**
 * Authorization decision result
 */
export interface AuthorizationResult {
  /** Whether access is allowed */
  readonly allowed: boolean;
  /** Reason for the decision */
  readonly reason: string;
  /** Missing permissions if denied */
  readonly missingPermissions?: readonly Permission[];
}

/**
 * Authorization audit log entry
 */
export interface AuthorizationAuditEntry {
  /** Timestamp of the authorization check */
  readonly timestamp: ISODateString;
  /** Request ID for correlation */
  readonly requestId: string;
  /** User who made the request */
  readonly userId: string;
  /** User's email */
  readonly userEmail: string;
  /** Resource being accessed */
  readonly resource: string;
  /** Action being performed */
  readonly action: string;
  /** Required permissions for the action */
  readonly requiredPermissions: readonly Permission[];
  /** User's actual permissions */
  readonly userPermissions: readonly Permission[];
  /** Authorization decision */
  readonly decision: 'ALLOWED' | 'DENIED';
  /** Reason for the decision */
  readonly reason: string;
  /** Source IP address */
  readonly sourceIp?: string;
}

/**
 * Configuration for the auth middleware
 */
export interface AuthConfig {
  /** Cognito User Pool ID */
  readonly userPoolId: string;
  /** Cognito Client ID */
  readonly clientId: string;
  /** AWS Region */
  readonly region: string;
  /** Whether to enable audit logging */
  readonly enableAuditLogging?: boolean;
  /** Cache TTL for token verification (seconds) */
  readonly tokenCacheTtlSeconds?: number;
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = 401;
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly missingPermissions: readonly Permission[];

  constructor(
    message: string,
    missingPermissions: readonly Permission[] = [],
    code: string = 'FORBIDDEN'
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = 403;
    this.missingPermissions = missingPermissions;
  }
}
