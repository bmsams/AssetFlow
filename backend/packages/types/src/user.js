"use strict";
/**
 * User and Security types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_TYPES = exports.PERMISSION_ACTIONS = exports.SYSTEM_ROLES = void 0;
/**
 * Predefined system roles
 */
exports.SYSTEM_ROLES = {
    ADMIN: 'admin',
    ASSET_MANAGER: 'asset_manager',
    INVENTORY_MANAGER: 'inventory_manager',
    PROCUREMENT_MANAGER: 'procurement_manager',
    LICENSE_ANALYST: 'license_analyst',
    FACILITIES_MANAGER: 'facilities_manager',
    AUDITOR: 'auditor',
    VIEWER: 'viewer',
};
/**
 * Permission actions
 */
exports.PERMISSION_ACTIONS = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    APPROVE: 'approve',
    EXPORT: 'export',
    ADMIN: 'admin',
};
/**
 * Resource types for permissions
 */
exports.RESOURCE_TYPES = {
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
};
//# sourceMappingURL=user.js.map