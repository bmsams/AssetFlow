/**
 * User and Security types
 */

import type { BaseEntity, ISODateString, UUID } from './common';

/**
 * User entity
 */
export interface User extends BaseEntity {
  readonly userId: UUID;
  readonly cognitoSub: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly departmentId?: UUID;
  readonly managerId?: UUID;
  readonly isActive: boolean;
}

/**
 * Department entity
 */
export interface Department {
  readonly departmentId: UUID;
  readonly name: string;
  readonly code?: string;
  readonly parentDepartmentId?: UUID;
  readonly managerId?: UUID;
  readonly isActive: boolean;
}

/**
 * Role entity
 */
export interface Role {
  readonly roleId: UUID;
  readonly roleName: string;
  readonly description?: string;
  readonly isSystemRole: boolean;
}

/**
 * User role assignment
 */
export interface UserRole {
  readonly userId: UUID;
  readonly roleId: UUID;
  readonly assignedAt: ISODateString;
  readonly assignedBy?: UUID;
}

/**
 * Permission entity
 */
export interface Permission {
  readonly permissionId: UUID;
  readonly permissionName: string;
  readonly resourceType: string;
  readonly action: string;
}

/**
 * Role permission assignment
 */
export interface RolePermission {
  readonly roleId: UUID;
  readonly permissionId: UUID;
}

/**
 * Predefined system roles
 */
export const SYSTEM_ROLES = {
  ADMIN: 'admin',
  ASSET_MANAGER: 'asset_manager',
  INVENTORY_MANAGER: 'inventory_manager',
  PROCUREMENT_MANAGER: 'procurement_manager',
  LICENSE_ANALYST: 'license_analyst',
  FACILITIES_MANAGER: 'facilities_manager',
  AUDITOR: 'auditor',
  VIEWER: 'viewer',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/**
 * Permission actions
 */
export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  ADMIN: 'admin',
} as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];

/**
 * Resource types for permissions
 */
export const RESOURCE_TYPES = {
  ASSET: 'asset',
  HARDWARE_ASSET: 'hardware_asset',
  SOFTWARE_ASSET: 'software_asset',
  ENTERPRISE_ASSET: 'enterprise_asset',
  CONTRACT: 'contract',
  PURCHASE_ORDER: 'purchase_order',
  STOCKROOM: 'stockroom',
  TRANSFER_ORDER: 'transfer_order',
  WORK_ORDER: 'work_order',
  USER: 'user',
  ROLE: 'role',
  REPORT: 'report',
  AUDIT: 'audit',
} as const;

export type ResourceType = (typeof RESOURCE_TYPES)[keyof typeof RESOURCE_TYPES];

/**
 * User context for request handling
 */
export interface UserContext {
  readonly userId: UUID;
  readonly email: string;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly departmentId?: UUID;
}

/**
 * Authentication token claims
 */
export interface TokenClaims {
  readonly sub: string;
  readonly email: string;
  readonly 'cognito:groups'?: readonly string[];
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
}
