/**
 * Cache key generation utilities
 *
 * Provides consistent cache key generation across the application
 * Implements namespacing strategy for cache keys
 *
 * Key Format: {namespace}:{entity_type}:{identifier}:{variant}
 * Example: ams:asset:550e8400-e29b-41d4-a716-446655440000:detail
 *
 * Requirements:
 * - 10.1: Configurable TTL (keys organized by entity type for TTL selection)
 * - 10.3: Cache-aside pattern (consistent key generation for cache lookups)
 */

import type { UUID } from '@ams/types';

/**
 * Entity types for cache keys
 * Used for organizing cache entries and selecting appropriate TTL
 */
export const CACHE_ENTITY_TYPES = {
  // Core assets
  ASSET: 'asset',
  HARDWARE_ASSET: 'hw-asset',
  SOFTWARE_ASSET: 'sw-asset',
  ENTERPRISE_ASSET: 'en-asset',

  // Software management
  SOFTWARE_PRODUCT: 'sw-product',
  ENTITLEMENT: 'entitlement',
  RECONCILIATION: 'reconciliation',

  // Contracts and vendors
  CONTRACT: 'contract',
  VENDOR: 'vendor',

  // Inventory management
  STOCKROOM: 'stockroom',
  INVENTORY: 'inventory',
  BIN_LOCATION: 'bin-location',

  // Location hierarchy
  BUILDING: 'building',
  FLOOR: 'floor',
  ROOM: 'room',
  RACK: 'rack',

  // User management
  USER: 'user',

  // Maintenance
  MAINTENANCE_PLAN: 'maint-plan',
  WORK_ORDER: 'work-order',
  SPARE_PART: 'spare-part',

  // Enterprise assets
  LINEAR_ASSET: 'linear-asset',
  ASSET_HIERARCHY: 'asset-hierarchy',

  // Reference data
  MANUFACTURER: 'manufacturer',
  MODEL: 'model',
  COST_CENTER: 'cost-center',
  DEPARTMENT: 'department',

  // Procurement
  PURCHASE_ORDER: 'purchase-order',

  // Configuration
  CONFIG: 'config',
  FEATURE_FLAG: 'feature-flag',

  // Notifications
  NOTIFICATION: 'notification',
  NOTIFICATION_PREFERENCES: 'notification-prefs',

  // Integration
  DISCOVERY: 'discovery',
  ERP_SYNC: 'erp-sync',
  VENDOR_CATALOG: 'vendor-catalog',

  // Reports
  DASHBOARD: 'dashboard',
  REPORT: 'report',
} as const;

export type CacheEntityType = (typeof CACHE_ENTITY_TYPES)[keyof typeof CACHE_ENTITY_TYPES];

/**
 * Cache key variants for different query types
 */
export const CACHE_VARIANTS = {
  DETAIL: 'detail',
  LIST: 'list',
  COUNT: 'count',
  SUMMARY: 'summary',
  SEARCH: 'search',
  RELATED: 'related',
  CHILDREN: 'children',
  PARENT: 'parent',
} as const;

export type CacheVariant = (typeof CACHE_VARIANTS)[keyof typeof CACHE_VARIANTS];

/**
 * Build a cache key for a single entity
 * Format: {entity_type}:{entity_id}
 */
export function entityKey(entityType: CacheEntityType, entityId: UUID): string {
  return `${entityType}:${entityId}`;
}

/**
 * Build a cache key for a single entity with variant
 * Format: {entity_type}:{entity_id}:{variant}
 */
export function entityKeyWithVariant(
  entityType: CacheEntityType,
  entityId: UUID,
  variant: CacheVariant
): string {
  return `${entityType}:${entityId}:${variant}`;
}

/**
 * Build a cache key for an entity list
 * Format: {entity_type}:list or {entity_type}:list:{sorted_params}
 */
export function listKey(entityType: CacheEntityType, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return `${entityType}:list`;
  }

  // Sort params for consistent key generation
  const sortedParams = sortAndSerializeParams(params);
  return `${entityType}:list:${sortedParams}`;
}

/**
 * Build a cache key for paginated list
 * Format: {entity_type}:list:page={page}&limit={limit}&{other_params}
 */
export function paginatedListKey(
  entityType: CacheEntityType,
  page: number,
  limit: number,
  params?: Record<string, unknown>
): string {
  const allParams = { page, limit, ...params };
  return listKey(entityType, allParams);
}

/**
 * Build a cache key for a count query
 * Format: {entity_type}:count or {entity_type}:count:{sorted_params}
 */
export function countKey(entityType: CacheEntityType, params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return `${entityType}:count`;
  }

  const sortedParams = sortAndSerializeParams(params);
  return `${entityType}:count:${sortedParams}`;
}

/**
 * Build a cache key for asset by tag
 * Format: asset:tag:{asset_tag}
 */
export function assetByTagKey(assetTag: string): string {
  return `asset:tag:${assetTag}`;
}

/**
 * Build a cache key for asset by serial number
 * Format: asset:serial:{serial_number}
 */
export function assetBySerialKey(serialNumber: string): string {
  return `asset:serial:${normalizeSerialNumber(serialNumber)}`;
}

/**
 * Build a cache key for assets by stockroom
 * Format: asset:stockroom:{stockroom_id}
 */
export function assetsByStockroomKey(stockroomId: UUID): string {
  return `asset:stockroom:${stockroomId}`;
}

/**
 * Build a cache key for assets by assigned user
 * Format: asset:assigned:{user_id}
 */
export function assetsByAssignedUserKey(userId: UUID): string {
  return `asset:assigned:${userId}`;
}

/**
 * Build a cache key for assets by status
 * Format: asset:status:{status}
 */
export function assetsByStatusKey(status: string): string {
  return `asset:status:${status.toLowerCase()}`;
}

/**
 * Build a cache key for assets by type
 * Format: asset:type:{asset_type}
 */
export function assetsByTypeKey(assetType: string): string {
  return `asset:type:${assetType.toLowerCase()}`;
}

/**
 * Build a cache key for stockroom inventory
 * Format: inventory:stockroom:{stockroom_id}
 */
export function stockroomInventoryKey(stockroomId: UUID): string {
  return `inventory:stockroom:${stockroomId}`;
}

/**
 * Build a cache key for stockroom inventory item
 * Format: inventory:stockroom:{stockroom_id}:product:{product_id}
 */
export function stockroomInventoryItemKey(stockroomId: UUID, productId: UUID): string {
  return `inventory:stockroom:${stockroomId}:product:${productId}`;
}

/**
 * Build a cache key for user permissions
 * Format: user:permissions:{user_id}
 */
export function userPermissionsKey(userId: UUID): string {
  return `user:permissions:${userId}`;
}

/**
 * Build a cache key for user roles
 * Format: user:roles:{user_id}
 */
export function userRolesKey(userId: UUID): string {
  return `user:roles:${userId}`;
}

/**
 * Build a cache key for user session
 * Format: user:session:{session_id}
 */
export function userSessionKey(sessionId: string): string {
  return `user:session:${sessionId}`;
}

/**
 * Build a cache key for user profile
 * Format: user:profile:{user_id}
 */
export function userProfileKey(userId: UUID): string {
  return `user:profile:${userId}`;
}

/**
 * Build a cache key for reconciliation results
 * Format: reconciliation:{product_id}
 */
export function reconciliationKey(productId: UUID): string {
  return `reconciliation:${productId}`;
}

/**
 * Build a cache key for compliance position
 * Format: compliance:{product_id}
 */
export function compliancePositionKey(productId: UUID): string {
  return `compliance:${productId}`;
}

/**
 * Build a cache key for all reconciliation results
 * Format: reconciliation:all or reconciliation:all:{sorted_params}
 */
export function allReconciliationKey(params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return 'reconciliation:all';
  }
  const sortedParams = sortAndSerializeParams(params);
  return `reconciliation:all:${sortedParams}`;
}

/**
 * Build a cache key for contract by vendor
 * Format: contract:vendor:{vendor_id}
 */
export function contractsByVendorKey(vendorId: UUID): string {
  return `contract:vendor:${vendorId}`;
}

/**
 * Build a cache key for expiring contracts
 * Format: contract:expiring:{days_threshold}
 */
export function expiringContractsKey(daysThreshold: number): string {
  return `contract:expiring:${daysThreshold}`;
}

/**
 * Build a cache key for contracts by type
 * Format: contract:type:{contract_type}
 */
export function contractsByTypeKey(contractType: string): string {
  return `contract:type:${contractType.toLowerCase()}`;
}

/**
 * Build a cache key for contracts by asset
 * Format: contract:asset:{asset_id}
 */
export function contractsByAssetKey(assetId: UUID): string {
  return `contract:asset:${assetId}`;
}

/**
 * Build a cache key for maintenance plans by asset
 * Format: maint-plan:asset:{asset_id}
 */
export function maintenancePlansByAssetKey(assetId: UUID): string {
  return `maint-plan:asset:${assetId}`;
}

/**
 * Build a cache key for due maintenance plans
 * Format: maint-plan:due:{date}
 */
export function dueMaintenancePlansKey(date: string): string {
  return `maint-plan:due:${date}`;
}

/**
 * Build a cache key for overdue work orders
 * Format: work-order:overdue
 */
export function overdueWorkOrdersKey(): string {
  return 'work-order:overdue';
}

/**
 * Build a cache key for work orders by asset
 * Format: work-order:asset:{asset_id}
 */
export function workOrdersByAssetKey(assetId: UUID): string {
  return `work-order:asset:${assetId}`;
}

/**
 * Build a cache key for work orders by status
 * Format: work-order:status:{status}
 */
export function workOrdersByStatusKey(status: string): string {
  return `work-order:status:${status.toLowerCase()}`;
}

/**
 * Build a cache key for work orders by assignee
 * Format: work-order:assignee:{user_id}
 */
export function workOrdersByAssigneeKey(userId: UUID): string {
  return `work-order:assignee:${userId}`;
}

/**
 * Build a cache key for loaner checkouts by user
 * Format: loaner:user:{user_id}
 */
export function loanersByUserKey(userId: UUID): string {
  return `loaner:user:${userId}`;
}

/**
 * Build a cache key for overdue loaners
 * Format: loaner:overdue
 */
export function overdueLoanersKey(): string {
  return 'loaner:overdue';
}

/**
 * Build a cache key for loaner by asset
 * Format: loaner:asset:{asset_id}
 */
export function loanerByAssetKey(assetId: UUID): string {
  return `loaner:asset:${assetId}`;
}

/**
 * Build a cache key for search results
 * Format: search:{entity_type}:{query_hash}
 */
export function searchResultsKey(entityType: CacheEntityType, query: string): string {
  // Hash the query for shorter keys
  const queryHash = simpleHash(query);
  return `search:${entityType}:${queryHash}`;
}

/**
 * Build a cache key for search results with filters
 * Format: search:{entity_type}:{query_hash}:{filter_hash}
 */
export function searchResultsWithFiltersKey(
  entityType: CacheEntityType,
  query: string,
  filters: Record<string, unknown>
): string {
  const queryHash = simpleHash(query);
  const filterHash = simpleHash(JSON.stringify(filters));
  return `search:${entityType}:${queryHash}:${filterHash}`;
}

/**
 * Build a cache key for configuration
 * Format: config:{config_key}
 */
export function configKey(configKey: string): string {
  return `config:${configKey}`;
}

/**
 * Build a cache key for feature flag
 * Format: feature-flag:{flag_name}
 */
export function featureFlagKey(flagName: string): string {
  return `feature-flag:${flagName}`;
}

/**
 * Build a cache key for reference data (manufacturers, models, etc.)
 * Format: ref:{ref_type}:{ref_id}
 */
export function referenceDataKey(refType: string, refId: string): string {
  return `ref:${refType}:${refId}`;
}

/**
 * Build a cache key for all reference data of a type
 * Format: ref:{ref_type}:all
 */
export function allReferenceDataKey(refType: string): string {
  return `ref:${refType}:all`;
}

// ============================================================================
// Location Hierarchy Cache Keys
// ============================================================================

/**
 * Build a cache key for a building
 * Format: building:{building_id}
 */
export function buildingKey(buildingId: UUID): string {
  return `${CACHE_ENTITY_TYPES.BUILDING}:${buildingId}`;
}

/**
 * Build a cache key for building list
 * Format: building:list or building:list:{sorted_params}
 */
export function buildingListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.BUILDING, params);
}

/**
 * Build a cache key for a floor
 * Format: floor:{floor_id}
 */
export function floorKey(floorId: UUID): string {
  return `${CACHE_ENTITY_TYPES.FLOOR}:${floorId}`;
}

/**
 * Build a cache key for floors by building
 * Format: floor:building:{building_id}
 */
export function floorsByBuildingKey(buildingId: UUID): string {
  return `${CACHE_ENTITY_TYPES.FLOOR}:building:${buildingId}`;
}

/**
 * Build a cache key for a room
 * Format: room:{room_id}
 */
export function roomKey(roomId: UUID): string {
  return `${CACHE_ENTITY_TYPES.ROOM}:${roomId}`;
}

/**
 * Build a cache key for rooms by floor
 * Format: room:floor:{floor_id}
 */
export function roomsByFloorKey(floorId: UUID): string {
  return `${CACHE_ENTITY_TYPES.ROOM}:floor:${floorId}`;
}

/**
 * Build a cache key for a rack
 * Format: rack:{rack_id}
 */
export function rackKey(rackId: UUID): string {
  return `${CACHE_ENTITY_TYPES.RACK}:${rackId}`;
}

/**
 * Build a cache key for racks by room
 * Format: rack:room:{room_id}
 */
export function racksByRoomKey(roomId: UUID): string {
  return `${CACHE_ENTITY_TYPES.RACK}:room:${roomId}`;
}

/**
 * Build a cache key for a stockroom
 * Format: stockroom:{stockroom_id}
 */
export function stockroomKey(stockroomId: UUID): string {
  return `${CACHE_ENTITY_TYPES.STOCKROOM}:${stockroomId}`;
}

/**
 * Build a cache key for stockrooms by location (building)
 * Format: stockroom:location:{location_id}
 */
export function stockroomsByLocationKey(locationId: UUID): string {
  return `${CACHE_ENTITY_TYPES.STOCKROOM}:location:${locationId}`;
}

/**
 * Build a cache key for stockroom list
 * Format: stockroom:list or stockroom:list:{sorted_params}
 */
export function stockroomListKey(params?: Record<string, unknown>): string {
  return listKey(CACHE_ENTITY_TYPES.STOCKROOM, params);
}

/**
 * Build a cache key for a bin location
 * Format: bin-location:{bin_id}
 */
export function binLocationKey(binId: UUID): string {
  return `${CACHE_ENTITY_TYPES.BIN_LOCATION}:${binId}`;
}

/**
 * Build a cache key for bin locations by stockroom
 * Format: bin-location:stockroom:{stockroom_id}
 */
export function binLocationsByStockroomKey(stockroomId: UUID): string {
  return `${CACHE_ENTITY_TYPES.BIN_LOCATION}:stockroom:${stockroomId}`;
}

/**
 * Build a cache key for a purchase order
 * Format: purchase-order:{po_id}
 */
export function purchaseOrderKey(poId: UUID): string {
  return `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:${poId}`;
}

/**
 * Build a cache key for purchase order by PO number
 * Format: purchase-order:number:{po_number}
 */
export function purchaseOrderByNumberKey(poNumber: string): string {
  return `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:number:${poNumber}`;
}

/**
 * Build a cache key for purchase orders by vendor
 * Format: purchase-order:vendor:{vendor_id}
 */
export function purchaseOrdersByVendorKey(vendorId: UUID): string {
  return `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:vendor:${vendorId}`;
}

/**
 * Build a cache key for purchase orders by status
 * Format: purchase-order:status:{status}
 */
export function purchaseOrdersByStatusKey(status: string): string {
  return `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:status:${status.toLowerCase()}`;
}

// ============================================================================
// Location Hierarchy Invalidation Patterns
// ============================================================================

/**
 * Build patterns for invalidating a building and all its children (floors, rooms, racks)
 * When a building changes, we need to invalidate:
 * - The building itself
 * - All floors in the building
 * - All rooms in those floors
 * - All racks in those rooms
 */
export function buildingInvalidationPatterns(buildingId: UUID): readonly string[] {
  return [
    `${CACHE_ENTITY_TYPES.BUILDING}:${buildingId}*`,
    `${CACHE_ENTITY_TYPES.BUILDING}:list*`,
    `${CACHE_ENTITY_TYPES.FLOOR}:building:${buildingId}*`,
    `${CACHE_ENTITY_TYPES.FLOOR}:list*`,
    `search:${CACHE_ENTITY_TYPES.BUILDING}:*`,
  ];
}

/**
 * Build patterns for invalidating a floor and all its children (rooms, racks)
 * When a floor changes, we need to invalidate:
 * - The floor itself
 * - The parent building's floor list
 * - All rooms in the floor
 * - All racks in those rooms
 */
export function floorInvalidationPatterns(floorId: UUID, buildingId?: UUID): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.FLOOR}:${floorId}*`,
    `${CACHE_ENTITY_TYPES.FLOOR}:list*`,
    `${CACHE_ENTITY_TYPES.ROOM}:floor:${floorId}*`,
    `${CACHE_ENTITY_TYPES.ROOM}:list*`,
    `search:${CACHE_ENTITY_TYPES.FLOOR}:*`,
  ];
  
  if (buildingId) {
    patterns.push(`${CACHE_ENTITY_TYPES.FLOOR}:building:${buildingId}*`);
  }
  
  return patterns;
}

/**
 * Build patterns for invalidating a room and all its children (racks)
 * When a room changes, we need to invalidate:
 * - The room itself
 * - The parent floor's room list
 * - All racks in the room
 */
export function roomInvalidationPatterns(roomId: UUID, floorId?: UUID): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.ROOM}:${roomId}*`,
    `${CACHE_ENTITY_TYPES.ROOM}:list*`,
    `${CACHE_ENTITY_TYPES.RACK}:room:${roomId}*`,
    `${CACHE_ENTITY_TYPES.RACK}:list*`,
    `search:${CACHE_ENTITY_TYPES.ROOM}:*`,
  ];
  
  if (floorId) {
    patterns.push(`${CACHE_ENTITY_TYPES.ROOM}:floor:${floorId}*`);
  }
  
  return patterns;
}

/**
 * Build patterns for invalidating a rack
 * When a rack changes, we need to invalidate:
 * - The rack itself
 * - The parent room's rack list
 */
export function rackInvalidationPatterns(rackId: UUID, roomId?: UUID): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.RACK}:${rackId}*`,
    `${CACHE_ENTITY_TYPES.RACK}:list*`,
    `search:${CACHE_ENTITY_TYPES.RACK}:*`,
  ];
  
  if (roomId) {
    patterns.push(`${CACHE_ENTITY_TYPES.RACK}:room:${roomId}*`);
  }
  
  return patterns;
}

/**
 * Build patterns for invalidating a stockroom
 * When a stockroom changes, we need to invalidate:
 * - The stockroom itself
 * - The location's stockroom list
 * - All bin locations in the stockroom
 */
export function stockroomInvalidationPatterns(stockroomId: UUID, locationId?: UUID): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.STOCKROOM}:${stockroomId}*`,
    `${CACHE_ENTITY_TYPES.STOCKROOM}:list*`,
    `${CACHE_ENTITY_TYPES.BIN_LOCATION}:stockroom:${stockroomId}*`,
    `search:${CACHE_ENTITY_TYPES.STOCKROOM}:*`,
    'stockrooms:active',
  ];
  
  if (locationId) {
    patterns.push(`${CACHE_ENTITY_TYPES.STOCKROOM}:location:${locationId}*`);
  }
  
  return patterns;
}

/**
 * Build patterns for invalidating a bin location
 * When a bin location changes, we need to invalidate:
 * - The bin location itself
 * - The parent stockroom's bin list
 */
export function binLocationInvalidationPatterns(binId: UUID, stockroomId?: UUID): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.BIN_LOCATION}:${binId}*`,
    `${CACHE_ENTITY_TYPES.BIN_LOCATION}:list*`,
    `search:${CACHE_ENTITY_TYPES.BIN_LOCATION}:*`,
  ];
  
  if (stockroomId) {
    patterns.push(`${CACHE_ENTITY_TYPES.BIN_LOCATION}:stockroom:${stockroomId}*`);
  }
  
  return patterns;
}

/**
 * Build patterns for invalidating a purchase order
 * When a purchase order changes, we need to invalidate:
 * - The purchase order itself
 * - The vendor's PO list
 * - Status-based lists
 */
export function purchaseOrderInvalidationPatterns(poId: UUID, vendorId?: UUID, status?: string): readonly string[] {
  const patterns: string[] = [
    `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:${poId}*`,
    `${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:list*`,
    `search:${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:*`,
  ];
  
  if (vendorId) {
    patterns.push(`${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:vendor:${vendorId}*`);
  }
  
  if (status) {
    patterns.push(`${CACHE_ENTITY_TYPES.PURCHASE_ORDER}:status:${status.toLowerCase()}*`);
  }
  
  return patterns;
}

/**
 * Simple string hash function for cache keys
 * Produces a short, URL-safe hash
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Sort and serialize parameters for consistent cache key generation
 */
function sortAndSerializeParams(params: Record<string, unknown>): string {
  return Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => {
      const value = params[key];
      // Handle arrays
      if (Array.isArray(value)) {
        return `${key}=${value.sort().join(',')}`;
      }
      // Handle objects by hashing
      if (typeof value === 'object') {
        return `${key}=${simpleHash(JSON.stringify(value))}`;
      }
      return `${key}=${String(value)}`;
    })
    .join('&');
}

/**
 * Normalize serial number for consistent cache key generation
 */
function normalizeSerialNumber(serialNumber: string): string {
  return serialNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Build a pattern for invalidating all keys of an entity type
 * Format: {entity_type}:*
 */
export function entityTypePattern(entityType: CacheEntityType): string {
  return `${entityType}:*`;
}

/**
 * Build a pattern for invalidating all keys related to an entity
 * Format: *{entity_type}*{entity_id}*
 */
export function entityPattern(entityType: CacheEntityType, entityId: UUID): string {
  return `*${entityType}*${entityId}*`;
}

/**
 * Build a pattern for invalidating all list keys of an entity type
 * Format: {entity_type}:list:*
 */
export function listPattern(entityType: CacheEntityType): string {
  return `${entityType}:list:*`;
}

/**
 * Build a pattern for invalidating all search keys of an entity type
 * Format: search:{entity_type}:*
 */
export function searchPattern(entityType: CacheEntityType): string {
  return `search:${entityType}:*`;
}

/**
 * Build a pattern for invalidating all count keys of an entity type
 * Format: {entity_type}:count:*
 */
export function countPattern(entityType: CacheEntityType): string {
  return `${entityType}:count:*`;
}

/**
 * Build a pattern for invalidating all user-related keys
 * Format: user:*:{user_id}*
 */
export function userPattern(userId: UUID): string {
  return `user:*:${userId}*`;
}

/**
 * Build a pattern for invalidating all asset-related keys
 * Format: *asset*:{asset_id}*
 */
export function assetPattern(assetId: UUID): string {
  return `*asset*:${assetId}*`;
}

/**
 * Parse a cache key to extract entity type and ID
 */
export function parseKey(key: string): { entityType: string; entityId?: string; variant?: string } | null {
  // Remove prefix if present
  const cleanKey = key.replace(/^ams:/, '');
  const parts = cleanKey.split(':');

  if (parts.length < 1) {
    return null;
  }

  const entityType = parts[0];
  const entityId = parts.length > 1 ? parts[1] : undefined;
  const variant = parts.length > 2 ? parts[2] : undefined;

  return { entityType: entityType ?? '', entityId, variant };
}

/**
 * Check if a key matches a pattern
 */
export function keyMatchesPattern(key: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(key);
}

/**
 * Generate a unique cache key for a composite entity
 * Useful for caching relationships or computed values
 */
export function compositeKey(...parts: string[]): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Generate a versioned cache key
 * Useful for cache busting when data schema changes
 */
export function versionedKey(key: string, version: number | string): string {
  return `v${version}:${key}`;
}
