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
export declare const CACHE_ENTITY_TYPES: {
    readonly ASSET: "asset";
    readonly HARDWARE_ASSET: "hw-asset";
    readonly SOFTWARE_ASSET: "sw-asset";
    readonly ENTERPRISE_ASSET: "en-asset";
    readonly SOFTWARE_PRODUCT: "sw-product";
    readonly ENTITLEMENT: "entitlement";
    readonly RECONCILIATION: "reconciliation";
    readonly CONTRACT: "contract";
    readonly VENDOR: "vendor";
    readonly STOCKROOM: "stockroom";
    readonly INVENTORY: "inventory";
    readonly BIN_LOCATION: "bin-location";
    readonly BUILDING: "building";
    readonly FLOOR: "floor";
    readonly ROOM: "room";
    readonly RACK: "rack";
    readonly USER: "user";
    readonly MAINTENANCE_PLAN: "maint-plan";
    readonly WORK_ORDER: "work-order";
    readonly SPARE_PART: "spare-part";
    readonly LINEAR_ASSET: "linear-asset";
    readonly ASSET_HIERARCHY: "asset-hierarchy";
    readonly MANUFACTURER: "manufacturer";
    readonly MODEL: "model";
    readonly COST_CENTER: "cost-center";
    readonly DEPARTMENT: "department";
    readonly PURCHASE_ORDER: "purchase-order";
    readonly CONFIG: "config";
    readonly FEATURE_FLAG: "feature-flag";
};
export type CacheEntityType = (typeof CACHE_ENTITY_TYPES)[keyof typeof CACHE_ENTITY_TYPES];
/**
 * Cache key variants for different query types
 */
export declare const CACHE_VARIANTS: {
    readonly DETAIL: "detail";
    readonly LIST: "list";
    readonly COUNT: "count";
    readonly SUMMARY: "summary";
    readonly SEARCH: "search";
    readonly RELATED: "related";
    readonly CHILDREN: "children";
    readonly PARENT: "parent";
};
export type CacheVariant = (typeof CACHE_VARIANTS)[keyof typeof CACHE_VARIANTS];
/**
 * Build a cache key for a single entity
 * Format: {entity_type}:{entity_id}
 */
export declare function entityKey(entityType: CacheEntityType, entityId: UUID): string;
/**
 * Build a cache key for a single entity with variant
 * Format: {entity_type}:{entity_id}:{variant}
 */
export declare function entityKeyWithVariant(entityType: CacheEntityType, entityId: UUID, variant: CacheVariant): string;
/**
 * Build a cache key for an entity list
 * Format: {entity_type}:list or {entity_type}:list:{sorted_params}
 */
export declare function listKey(entityType: CacheEntityType, params?: Record<string, unknown>): string;
/**
 * Build a cache key for paginated list
 * Format: {entity_type}:list:page={page}&limit={limit}&{other_params}
 */
export declare function paginatedListKey(entityType: CacheEntityType, page: number, limit: number, params?: Record<string, unknown>): string;
/**
 * Build a cache key for a count query
 * Format: {entity_type}:count or {entity_type}:count:{sorted_params}
 */
export declare function countKey(entityType: CacheEntityType, params?: Record<string, unknown>): string;
/**
 * Build a cache key for asset by tag
 * Format: asset:tag:{asset_tag}
 */
export declare function assetByTagKey(assetTag: string): string;
/**
 * Build a cache key for asset by serial number
 * Format: asset:serial:{serial_number}
 */
export declare function assetBySerialKey(serialNumber: string): string;
/**
 * Build a cache key for assets by stockroom
 * Format: asset:stockroom:{stockroom_id}
 */
export declare function assetsByStockroomKey(stockroomId: UUID): string;
/**
 * Build a cache key for assets by assigned user
 * Format: asset:assigned:{user_id}
 */
export declare function assetsByAssignedUserKey(userId: UUID): string;
/**
 * Build a cache key for assets by status
 * Format: asset:status:{status}
 */
export declare function assetsByStatusKey(status: string): string;
/**
 * Build a cache key for assets by type
 * Format: asset:type:{asset_type}
 */
export declare function assetsByTypeKey(assetType: string): string;
/**
 * Build a cache key for stockroom inventory
 * Format: inventory:stockroom:{stockroom_id}
 */
export declare function stockroomInventoryKey(stockroomId: UUID): string;
/**
 * Build a cache key for stockroom inventory item
 * Format: inventory:stockroom:{stockroom_id}:product:{product_id}
 */
export declare function stockroomInventoryItemKey(stockroomId: UUID, productId: UUID): string;
/**
 * Build a cache key for user permissions
 * Format: user:permissions:{user_id}
 */
export declare function userPermissionsKey(userId: UUID): string;
/**
 * Build a cache key for user roles
 * Format: user:roles:{user_id}
 */
export declare function userRolesKey(userId: UUID): string;
/**
 * Build a cache key for user session
 * Format: user:session:{session_id}
 */
export declare function userSessionKey(sessionId: string): string;
/**
 * Build a cache key for user profile
 * Format: user:profile:{user_id}
 */
export declare function userProfileKey(userId: UUID): string;
/**
 * Build a cache key for reconciliation results
 * Format: reconciliation:{product_id}
 */
export declare function reconciliationKey(productId: UUID): string;
/**
 * Build a cache key for compliance position
 * Format: compliance:{product_id}
 */
export declare function compliancePositionKey(productId: UUID): string;
/**
 * Build a cache key for all reconciliation results
 * Format: reconciliation:all or reconciliation:all:{sorted_params}
 */
export declare function allReconciliationKey(params?: Record<string, unknown>): string;
/**
 * Build a cache key for contract by vendor
 * Format: contract:vendor:{vendor_id}
 */
export declare function contractsByVendorKey(vendorId: UUID): string;
/**
 * Build a cache key for expiring contracts
 * Format: contract:expiring:{days_threshold}
 */
export declare function expiringContractsKey(daysThreshold: number): string;
/**
 * Build a cache key for contracts by type
 * Format: contract:type:{contract_type}
 */
export declare function contractsByTypeKey(contractType: string): string;
/**
 * Build a cache key for contracts by asset
 * Format: contract:asset:{asset_id}
 */
export declare function contractsByAssetKey(assetId: UUID): string;
/**
 * Build a cache key for maintenance plans by asset
 * Format: maint-plan:asset:{asset_id}
 */
export declare function maintenancePlansByAssetKey(assetId: UUID): string;
/**
 * Build a cache key for due maintenance plans
 * Format: maint-plan:due:{date}
 */
export declare function dueMaintenancePlansKey(date: string): string;
/**
 * Build a cache key for overdue work orders
 * Format: work-order:overdue
 */
export declare function overdueWorkOrdersKey(): string;
/**
 * Build a cache key for work orders by asset
 * Format: work-order:asset:{asset_id}
 */
export declare function workOrdersByAssetKey(assetId: UUID): string;
/**
 * Build a cache key for work orders by status
 * Format: work-order:status:{status}
 */
export declare function workOrdersByStatusKey(status: string): string;
/**
 * Build a cache key for work orders by assignee
 * Format: work-order:assignee:{user_id}
 */
export declare function workOrdersByAssigneeKey(userId: UUID): string;
/**
 * Build a cache key for loaner checkouts by user
 * Format: loaner:user:{user_id}
 */
export declare function loanersByUserKey(userId: UUID): string;
/**
 * Build a cache key for overdue loaners
 * Format: loaner:overdue
 */
export declare function overdueLoanersKey(): string;
/**
 * Build a cache key for loaner by asset
 * Format: loaner:asset:{asset_id}
 */
export declare function loanerByAssetKey(assetId: UUID): string;
/**
 * Build a cache key for search results
 * Format: search:{entity_type}:{query_hash}
 */
export declare function searchResultsKey(entityType: CacheEntityType, query: string): string;
/**
 * Build a cache key for search results with filters
 * Format: search:{entity_type}:{query_hash}:{filter_hash}
 */
export declare function searchResultsWithFiltersKey(entityType: CacheEntityType, query: string, filters: Record<string, unknown>): string;
/**
 * Build a cache key for configuration
 * Format: config:{config_key}
 */
export declare function configKey(configKey: string): string;
/**
 * Build a cache key for feature flag
 * Format: feature-flag:{flag_name}
 */
export declare function featureFlagKey(flagName: string): string;
/**
 * Build a cache key for reference data (manufacturers, models, etc.)
 * Format: ref:{ref_type}:{ref_id}
 */
export declare function referenceDataKey(refType: string, refId: string): string;
/**
 * Build a cache key for all reference data of a type
 * Format: ref:{ref_type}:all
 */
export declare function allReferenceDataKey(refType: string): string;
/**
 * Build a cache key for a building
 * Format: building:{building_id}
 */
export declare function buildingKey(buildingId: UUID): string;
/**
 * Build a cache key for building list
 * Format: building:list or building:list:{sorted_params}
 */
export declare function buildingListKey(params?: Record<string, unknown>): string;
/**
 * Build a cache key for a floor
 * Format: floor:{floor_id}
 */
export declare function floorKey(floorId: UUID): string;
/**
 * Build a cache key for floors by building
 * Format: floor:building:{building_id}
 */
export declare function floorsByBuildingKey(buildingId: UUID): string;
/**
 * Build a cache key for a room
 * Format: room:{room_id}
 */
export declare function roomKey(roomId: UUID): string;
/**
 * Build a cache key for rooms by floor
 * Format: room:floor:{floor_id}
 */
export declare function roomsByFloorKey(floorId: UUID): string;
/**
 * Build a cache key for a rack
 * Format: rack:{rack_id}
 */
export declare function rackKey(rackId: UUID): string;
/**
 * Build a cache key for racks by room
 * Format: rack:room:{room_id}
 */
export declare function racksByRoomKey(roomId: UUID): string;
/**
 * Build a cache key for a stockroom
 * Format: stockroom:{stockroom_id}
 */
export declare function stockroomKey(stockroomId: UUID): string;
/**
 * Build a cache key for stockrooms by location (building)
 * Format: stockroom:location:{location_id}
 */
export declare function stockroomsByLocationKey(locationId: UUID): string;
/**
 * Build a cache key for stockroom list
 * Format: stockroom:list or stockroom:list:{sorted_params}
 */
export declare function stockroomListKey(params?: Record<string, unknown>): string;
/**
 * Build a cache key for a bin location
 * Format: bin-location:{bin_id}
 */
export declare function binLocationKey(binId: UUID): string;
/**
 * Build a cache key for bin locations by stockroom
 * Format: bin-location:stockroom:{stockroom_id}
 */
export declare function binLocationsByStockroomKey(stockroomId: UUID): string;
/**
 * Build a cache key for a purchase order
 * Format: purchase-order:{po_id}
 */
export declare function purchaseOrderKey(poId: UUID): string;
/**
 * Build a cache key for purchase order by PO number
 * Format: purchase-order:number:{po_number}
 */
export declare function purchaseOrderByNumberKey(poNumber: string): string;
/**
 * Build a cache key for purchase orders by vendor
 * Format: purchase-order:vendor:{vendor_id}
 */
export declare function purchaseOrdersByVendorKey(vendorId: UUID): string;
/**
 * Build a cache key for purchase orders by status
 * Format: purchase-order:status:{status}
 */
export declare function purchaseOrdersByStatusKey(status: string): string;
/**
 * Build patterns for invalidating a building and all its children (floors, rooms, racks)
 * When a building changes, we need to invalidate:
 * - The building itself
 * - All floors in the building
 * - All rooms in those floors
 * - All racks in those rooms
 */
export declare function buildingInvalidationPatterns(buildingId: UUID): readonly string[];
/**
 * Build patterns for invalidating a floor and all its children (rooms, racks)
 * When a floor changes, we need to invalidate:
 * - The floor itself
 * - The parent building's floor list
 * - All rooms in the floor
 * - All racks in those rooms
 */
export declare function floorInvalidationPatterns(floorId: UUID, buildingId?: UUID): readonly string[];
/**
 * Build patterns for invalidating a room and all its children (racks)
 * When a room changes, we need to invalidate:
 * - The room itself
 * - The parent floor's room list
 * - All racks in the room
 */
export declare function roomInvalidationPatterns(roomId: UUID, floorId?: UUID): readonly string[];
/**
 * Build patterns for invalidating a rack
 * When a rack changes, we need to invalidate:
 * - The rack itself
 * - The parent room's rack list
 */
export declare function rackInvalidationPatterns(rackId: UUID, roomId?: UUID): readonly string[];
/**
 * Build patterns for invalidating a stockroom
 * When a stockroom changes, we need to invalidate:
 * - The stockroom itself
 * - The location's stockroom list
 * - All bin locations in the stockroom
 */
export declare function stockroomInvalidationPatterns(stockroomId: UUID, locationId?: UUID): readonly string[];
/**
 * Build patterns for invalidating a bin location
 * When a bin location changes, we need to invalidate:
 * - The bin location itself
 * - The parent stockroom's bin list
 */
export declare function binLocationInvalidationPatterns(binId: UUID, stockroomId?: UUID): readonly string[];
/**
 * Build patterns for invalidating a purchase order
 * When a purchase order changes, we need to invalidate:
 * - The purchase order itself
 * - The vendor's PO list
 * - Status-based lists
 */
export declare function purchaseOrderInvalidationPatterns(poId: UUID, vendorId?: UUID, status?: string): readonly string[];
/**
 * Build a pattern for invalidating all keys of an entity type
 * Format: {entity_type}:*
 */
export declare function entityTypePattern(entityType: CacheEntityType): string;
/**
 * Build a pattern for invalidating all keys related to an entity
 * Format: *{entity_type}*{entity_id}*
 */
export declare function entityPattern(entityType: CacheEntityType, entityId: UUID): string;
/**
 * Build a pattern for invalidating all list keys of an entity type
 * Format: {entity_type}:list:*
 */
export declare function listPattern(entityType: CacheEntityType): string;
/**
 * Build a pattern for invalidating all search keys of an entity type
 * Format: search:{entity_type}:*
 */
export declare function searchPattern(entityType: CacheEntityType): string;
/**
 * Build a pattern for invalidating all count keys of an entity type
 * Format: {entity_type}:count:*
 */
export declare function countPattern(entityType: CacheEntityType): string;
/**
 * Build a pattern for invalidating all user-related keys
 * Format: user:*:{user_id}*
 */
export declare function userPattern(userId: UUID): string;
/**
 * Build a pattern for invalidating all asset-related keys
 * Format: *asset*:{asset_id}*
 */
export declare function assetPattern(assetId: UUID): string;
/**
 * Parse a cache key to extract entity type and ID
 */
export declare function parseKey(key: string): {
    entityType: string;
    entityId?: string;
    variant?: string;
} | null;
/**
 * Check if a key matches a pattern
 */
export declare function keyMatchesPattern(key: string, pattern: string): boolean;
/**
 * Generate a unique cache key for a composite entity
 * Useful for caching relationships or computed values
 */
export declare function compositeKey(...parts: string[]): string;
/**
 * Generate a versioned cache key
 * Useful for cache busting when data schema changes
 */
export declare function versionedKey(key: string, version: number | string): string;
//# sourceMappingURL=cache-keys.d.ts.map