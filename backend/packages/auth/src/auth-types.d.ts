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
export declare const ROLES: {
    /** Full system access - can manage users, roles, and all resources */
    readonly ADMIN: "ADMIN";
    /** Asset CRUD operations - create, read, update, delete assets */
    readonly ASSET_MANAGER: "ASSET_MANAGER";
    /** Stockroom and inventory operations - manage inventory levels and transfers */
    readonly INVENTORY_MANAGER: "INVENTORY_MANAGER";
    /** Software license management - reconciliation, compliance, reclamation */
    readonly SOFTWARE_MANAGER: "SOFTWARE_MANAGER";
    /** Work orders and maintenance - manage maintenance plans and work orders */
    readonly MAINTENANCE_MANAGER: "MAINTENANCE_MANAGER";
    /** Read-only access - view assets and reports without modification */
    readonly VIEWER: "VIEWER";
};
export type Role = (typeof ROLES)[keyof typeof ROLES];
/**
 * Granular permissions for fine-grained access control
 * Based on Requirement 14.3
 */
export declare const PERMISSIONS: {
    readonly ASSET_READ: "asset:read";
    readonly ASSET_CREATE: "asset:create";
    readonly ASSET_UPDATE: "asset:update";
    readonly ASSET_DELETE: "asset:delete";
    readonly INVENTORY_READ: "inventory:read";
    readonly INVENTORY_UPDATE: "inventory:update";
    readonly SOFTWARE_READ: "software:read";
    readonly SOFTWARE_MANAGE: "software:manage";
    readonly MAINTENANCE_READ: "maintenance:read";
    readonly MAINTENANCE_MANAGE: "maintenance:manage";
    readonly ADMIN_USERS: "admin:users";
    readonly ADMIN_ROLES: "admin:roles";
    readonly CONTRACT_READ: "contract:read";
    readonly CONTRACT_MANAGE: "contract:manage";
    readonly REPORT_READ: "report:read";
    readonly REPORT_EXPORT: "report:export";
    readonly AUDIT_READ: "audit:read";
};
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
/**
 * Role to permissions mapping
 * Defines which permissions each role has
 */
export declare const ROLE_PERMISSIONS: Record<Role, readonly Permission[]>;
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
export declare class AuthenticationError extends Error {
    readonly code: string;
    readonly statusCode: number;
    constructor(message: string, code?: string);
}
/**
 * Error thrown when authorization fails
 */
export declare class AuthorizationError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly missingPermissions: readonly Permission[];
    constructor(message: string, missingPermissions?: readonly Permission[], code?: string);
}
//# sourceMappingURL=auth-types.d.ts.map