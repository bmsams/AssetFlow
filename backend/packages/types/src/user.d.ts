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
export declare const SYSTEM_ROLES: {
    readonly ADMIN: "admin";
    readonly ASSET_MANAGER: "asset_manager";
    readonly INVENTORY_MANAGER: "inventory_manager";
    readonly PROCUREMENT_MANAGER: "procurement_manager";
    readonly LICENSE_ANALYST: "license_analyst";
    readonly FACILITIES_MANAGER: "facilities_manager";
    readonly AUDITOR: "auditor";
    readonly VIEWER: "viewer";
};
export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];
/**
 * Permission actions
 */
export declare const PERMISSION_ACTIONS: {
    readonly CREATE: "create";
    readonly READ: "read";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly APPROVE: "approve";
    readonly EXPORT: "export";
    readonly ADMIN: "admin";
};
export type PermissionAction = (typeof PERMISSION_ACTIONS)[keyof typeof PERMISSION_ACTIONS];
/**
 * Resource types for permissions
 */
export declare const RESOURCE_TYPES: {
    readonly ASSET: "asset";
    readonly HARDWARE_ASSET: "hardware_asset";
    readonly SOFTWARE_ASSET: "software_asset";
    readonly ENTERPRISE_ASSET: "enterprise_asset";
    readonly CONTRACT: "contract";
    readonly PURCHASE_ORDER: "purchase_order";
    readonly STOCKROOM: "stockroom";
    readonly TRANSFER_ORDER: "transfer_order";
    readonly WORK_ORDER: "work_order";
    readonly USER: "user";
    readonly ROLE: "role";
    readonly REPORT: "report";
    readonly AUDIT: "audit";
};
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
