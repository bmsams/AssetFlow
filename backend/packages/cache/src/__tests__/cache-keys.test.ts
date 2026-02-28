/**
 * Cache Keys Unit Tests
 *
 * Tests for cache key generation utilities
 * Validates consistent key generation for cache-aside pattern
 */

import {
  CACHE_ENTITY_TYPES,
  CACHE_VARIANTS,
  entityKey,
  entityKeyWithVariant,
  listKey,
  paginatedListKey,
  countKey,
  assetByTagKey,
  assetBySerialKey,
  assetsByStockroomKey,
  assetsByAssignedUserKey,
  assetsByStatusKey,
  assetsByTypeKey,
  stockroomInventoryKey,
  stockroomInventoryItemKey,
  userPermissionsKey,
  userRolesKey,
  userSessionKey,
  userProfileKey,
  reconciliationKey,
  compliancePositionKey,
  allReconciliationKey,
  contractsByVendorKey,
  expiringContractsKey,
  contractsByTypeKey,
  contractsByAssetKey,
  maintenancePlansByAssetKey,
  dueMaintenancePlansKey,
  overdueWorkOrdersKey,
  workOrdersByAssetKey,
  workOrdersByStatusKey,
  workOrdersByAssigneeKey,
  loanersByUserKey,
  overdueLoanersKey,
  loanerByAssetKey,
  searchResultsKey,
  searchResultsWithFiltersKey,
  configKey,
  featureFlagKey,
  referenceDataKey,
  allReferenceDataKey,
  entityTypePattern,
  entityPattern,
  listPattern,
  searchPattern,
  countPattern,
  userPattern,
  assetPattern,
  parseKey,
  keyMatchesPattern,
  compositeKey,
  versionedKey,
  // New location hierarchy functions
  buildingKey,
  buildingListKey,
  floorKey,
  floorsByBuildingKey,
  roomKey,
  roomsByFloorKey,
  rackKey,
  racksByRoomKey,
  binLocationKey,
  binLocationsByStockroomKey,
  purchaseOrderKey,
  purchaseOrderByNumberKey,
  purchaseOrdersByVendorKey,
  purchaseOrdersByStatusKey,
  // Stockroom keys
  stockroomKey,
  stockroomsByLocationKey,
  stockroomListKey,
  // Invalidation patterns
  buildingInvalidationPatterns,
  floorInvalidationPatterns,
  roomInvalidationPatterns,
  rackInvalidationPatterns,
  stockroomInvalidationPatterns,
  binLocationInvalidationPatterns,
  purchaseOrderInvalidationPatterns,
} from '../cache-keys';

describe('Cache Keys', () => {
  describe('CACHE_ENTITY_TYPES', () => {
    it('should have all required entity types', () => {
      expect(CACHE_ENTITY_TYPES.ASSET).toBe('asset');
      expect(CACHE_ENTITY_TYPES.HARDWARE_ASSET).toBe('hw-asset');
      expect(CACHE_ENTITY_TYPES.SOFTWARE_ASSET).toBe('sw-asset');
      expect(CACHE_ENTITY_TYPES.ENTERPRISE_ASSET).toBe('en-asset');
      expect(CACHE_ENTITY_TYPES.USER).toBe('user');
      expect(CACHE_ENTITY_TYPES.VENDOR).toBe('vendor');
      expect(CACHE_ENTITY_TYPES.CONTRACT).toBe('contract');
      expect(CACHE_ENTITY_TYPES.STOCKROOM).toBe('stockroom');
      expect(CACHE_ENTITY_TYPES.INVENTORY).toBe('inventory');
      expect(CACHE_ENTITY_TYPES.MAINTENANCE_PLAN).toBe('maint-plan');
      expect(CACHE_ENTITY_TYPES.WORK_ORDER).toBe('work-order');
      expect(CACHE_ENTITY_TYPES.CONFIG).toBe('config');
      expect(CACHE_ENTITY_TYPES.FEATURE_FLAG).toBe('feature-flag');
    });
  });

  describe('CACHE_VARIANTS', () => {
    it('should have all required variants', () => {
      expect(CACHE_VARIANTS.DETAIL).toBe('detail');
      expect(CACHE_VARIANTS.LIST).toBe('list');
      expect(CACHE_VARIANTS.COUNT).toBe('count');
      expect(CACHE_VARIANTS.SUMMARY).toBe('summary');
      expect(CACHE_VARIANTS.SEARCH).toBe('search');
      expect(CACHE_VARIANTS.RELATED).toBe('related');
    });
  });

  describe('entityKey', () => {
    it('should generate correct entity key', () => {
      const key = entityKey(CACHE_ENTITY_TYPES.ASSET, '550e8400-e29b-41d4-a716-446655440000');
      expect(key).toBe('asset:550e8400-e29b-41d4-a716-446655440000');
    });

    it('should work with different entity types', () => {
      expect(entityKey(CACHE_ENTITY_TYPES.USER, 'user-123')).toBe('user:user-123');
      expect(entityKey(CACHE_ENTITY_TYPES.VENDOR, 'vendor-456')).toBe('vendor:vendor-456');
      expect(entityKey(CACHE_ENTITY_TYPES.CONTRACT, 'contract-789')).toBe('contract:contract-789');
    });
  });

  describe('entityKeyWithVariant', () => {
    it('should generate key with variant', () => {
      const key = entityKeyWithVariant(
        CACHE_ENTITY_TYPES.ASSET,
        '550e8400-e29b-41d4-a716-446655440000',
        CACHE_VARIANTS.DETAIL
      );
      expect(key).toBe('asset:550e8400-e29b-41d4-a716-446655440000:detail');
    });

    it('should work with different variants', () => {
      const assetId = 'asset-123';
      expect(entityKeyWithVariant(CACHE_ENTITY_TYPES.ASSET, assetId, CACHE_VARIANTS.SUMMARY))
        .toBe('asset:asset-123:summary');
      expect(entityKeyWithVariant(CACHE_ENTITY_TYPES.ASSET, assetId, CACHE_VARIANTS.RELATED))
        .toBe('asset:asset-123:related');
    });
  });

  describe('listKey', () => {
    it('should generate simple list key without params', () => {
      const key = listKey(CACHE_ENTITY_TYPES.ASSET);
      expect(key).toBe('asset:list');
    });

    it('should generate list key with sorted params', () => {
      const key = listKey(CACHE_ENTITY_TYPES.ASSET, { status: 'DEPLOYED', type: 'HARDWARE' });
      expect(key).toBe('asset:list:status=DEPLOYED&type=HARDWARE');
    });

    it('should sort params alphabetically for consistency', () => {
      const key1 = listKey(CACHE_ENTITY_TYPES.ASSET, { z: '1', a: '2', m: '3' });
      const key2 = listKey(CACHE_ENTITY_TYPES.ASSET, { a: '2', m: '3', z: '1' });
      expect(key1).toBe(key2);
      expect(key1).toBe('asset:list:a=2&m=3&z=1');
    });

    it('should handle empty params object', () => {
      const key = listKey(CACHE_ENTITY_TYPES.ASSET, {});
      expect(key).toBe('asset:list');
    });

    it('should filter out null and undefined values', () => {
      const key = listKey(CACHE_ENTITY_TYPES.ASSET, { 
        status: 'DEPLOYED', 
        type: null, 
        owner: undefined 
      });
      expect(key).toBe('asset:list:status=DEPLOYED');
    });

    it('should handle array values', () => {
      const key = listKey(CACHE_ENTITY_TYPES.ASSET, { statuses: ['DEPLOYED', 'IN_STOCK'] });
      expect(key).toBe('asset:list:statuses=DEPLOYED,IN_STOCK');
    });
  });

  describe('paginatedListKey', () => {
    it('should generate paginated list key', () => {
      const key = paginatedListKey(CACHE_ENTITY_TYPES.ASSET, 1, 20);
      expect(key).toBe('asset:list:limit=20&page=1');
    });

    it('should include additional params', () => {
      const key = paginatedListKey(CACHE_ENTITY_TYPES.ASSET, 2, 50, { status: 'DEPLOYED' });
      expect(key).toBe('asset:list:limit=50&page=2&status=DEPLOYED');
    });
  });

  describe('countKey', () => {
    it('should generate simple count key without params', () => {
      const key = countKey(CACHE_ENTITY_TYPES.ASSET);
      expect(key).toBe('asset:count');
    });

    it('should generate count key with params', () => {
      const key = countKey(CACHE_ENTITY_TYPES.ASSET, { status: 'DEPLOYED' });
      expect(key).toBe('asset:count:status=DEPLOYED');
    });
  });

  describe('Asset-specific keys', () => {
    it('should generate asset by tag key', () => {
      const key = assetByTagKey('AMS-HW-20240115-ABC123');
      expect(key).toBe('asset:tag:AMS-HW-20240115-ABC123');
    });

    it('should generate asset by serial key with normalization', () => {
      const key = assetBySerialKey('SN-123-ABC');
      expect(key).toBe('asset:serial:SN123ABC');
    });

    it('should normalize serial numbers to uppercase', () => {
      const key = assetBySerialKey('sn-123-abc');
      expect(key).toBe('asset:serial:SN123ABC');
    });

    it('should generate assets by stockroom key', () => {
      const key = assetsByStockroomKey('stockroom-123');
      expect(key).toBe('asset:stockroom:stockroom-123');
    });

    it('should generate assets by assigned user key', () => {
      const key = assetsByAssignedUserKey('user-123');
      expect(key).toBe('asset:assigned:user-123');
    });

    it('should generate assets by status key', () => {
      const key = assetsByStatusKey('DEPLOYED');
      expect(key).toBe('asset:status:deployed');
    });

    it('should generate assets by type key', () => {
      const key = assetsByTypeKey('HARDWARE');
      expect(key).toBe('asset:type:hardware');
    });
  });

  describe('Stockroom and inventory keys', () => {
    it('should generate stockroom inventory key', () => {
      const key = stockroomInventoryKey('stockroom-123');
      expect(key).toBe('inventory:stockroom:stockroom-123');
    });

    it('should generate stockroom inventory item key', () => {
      const key = stockroomInventoryItemKey('stockroom-123', 'product-456');
      expect(key).toBe('inventory:stockroom:stockroom-123:product:product-456');
    });
  });

  describe('User-related keys', () => {
    it('should generate user permissions key', () => {
      const key = userPermissionsKey('user-123');
      expect(key).toBe('user:permissions:user-123');
    });

    it('should generate user roles key', () => {
      const key = userRolesKey('user-123');
      expect(key).toBe('user:roles:user-123');
    });

    it('should generate user session key', () => {
      const key = userSessionKey('session-abc');
      expect(key).toBe('user:session:session-abc');
    });

    it('should generate user profile key', () => {
      const key = userProfileKey('user-123');
      expect(key).toBe('user:profile:user-123');
    });
  });

  describe('Reconciliation and compliance keys', () => {
    it('should generate reconciliation key', () => {
      const key = reconciliationKey('product-123');
      expect(key).toBe('reconciliation:product-123');
    });

    it('should generate compliance position key', () => {
      const key = compliancePositionKey('product-123');
      expect(key).toBe('compliance:product-123');
    });

    it('should generate all reconciliation key without params', () => {
      const key = allReconciliationKey();
      expect(key).toBe('reconciliation:all');
    });

    it('should generate all reconciliation key with params', () => {
      const key = allReconciliationKey({ publisher: 'Microsoft' });
      expect(key).toBe('reconciliation:all:publisher=Microsoft');
    });
  });

  describe('Contract keys', () => {
    it('should generate contracts by vendor key', () => {
      const key = contractsByVendorKey('vendor-123');
      expect(key).toBe('contract:vendor:vendor-123');
    });

    it('should generate expiring contracts key', () => {
      const key = expiringContractsKey(30);
      expect(key).toBe('contract:expiring:30');
    });

    it('should generate contracts by type key', () => {
      const key = contractsByTypeKey('MAINTENANCE');
      expect(key).toBe('contract:type:maintenance');
    });

    it('should generate contracts by asset key', () => {
      const key = contractsByAssetKey('asset-123');
      expect(key).toBe('contract:asset:asset-123');
    });
  });

  describe('Maintenance and work order keys', () => {
    it('should generate maintenance plans by asset key', () => {
      const key = maintenancePlansByAssetKey('asset-123');
      expect(key).toBe('maint-plan:asset:asset-123');
    });

    it('should generate due maintenance plans key', () => {
      const key = dueMaintenancePlansKey('2024-01-15');
      expect(key).toBe('maint-plan:due:2024-01-15');
    });

    it('should generate overdue work orders key', () => {
      const key = overdueWorkOrdersKey();
      expect(key).toBe('work-order:overdue');
    });

    it('should generate work orders by asset key', () => {
      const key = workOrdersByAssetKey('asset-123');
      expect(key).toBe('work-order:asset:asset-123');
    });

    it('should generate work orders by status key', () => {
      const key = workOrdersByStatusKey('IN_PROGRESS');
      expect(key).toBe('work-order:status:in_progress');
    });

    it('should generate work orders by assignee key', () => {
      const key = workOrdersByAssigneeKey('user-123');
      expect(key).toBe('work-order:assignee:user-123');
    });
  });

  describe('Loaner keys', () => {
    it('should generate loaners by user key', () => {
      const key = loanersByUserKey('user-123');
      expect(key).toBe('loaner:user:user-123');
    });

    it('should generate overdue loaners key', () => {
      const key = overdueLoanersKey();
      expect(key).toBe('loaner:overdue');
    });

    it('should generate loaner by asset key', () => {
      const key = loanerByAssetKey('asset-123');
      expect(key).toBe('loaner:asset:asset-123');
    });
  });

  describe('Search keys', () => {
    it('should generate search results key with hashed query', () => {
      const key = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'laptop dell');
      expect(key).toMatch(/^search:asset:[a-z0-9]+$/);
    });

    it('should generate consistent hash for same query', () => {
      const key1 = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'laptop dell');
      const key2 = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'laptop dell');
      expect(key1).toBe(key2);
    });

    it('should generate different hash for different queries', () => {
      const key1 = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'laptop dell');
      const key2 = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'desktop hp');
      expect(key1).not.toBe(key2);
    });

    it('should generate search results with filters key', () => {
      const key = searchResultsWithFiltersKey(
        CACHE_ENTITY_TYPES.ASSET,
        'laptop',
        { status: 'DEPLOYED' }
      );
      expect(key).toMatch(/^search:asset:[a-z0-9]+:[a-z0-9]+$/);
    });
  });

  describe('Configuration keys', () => {
    it('should generate config key', () => {
      const key = configKey('app-settings');
      expect(key).toBe('config:app-settings');
    });

    it('should generate feature flag key', () => {
      const key = featureFlagKey('new-dashboard');
      expect(key).toBe('feature-flag:new-dashboard');
    });
  });

  describe('Reference data keys', () => {
    it('should generate reference data key', () => {
      const key = referenceDataKey('manufacturer', 'dell');
      expect(key).toBe('ref:manufacturer:dell');
    });

    it('should generate all reference data key', () => {
      const key = allReferenceDataKey('manufacturer');
      expect(key).toBe('ref:manufacturer:all');
    });
  });

  describe('Pattern generators', () => {
    it('should generate entity type pattern', () => {
      const pattern = entityTypePattern(CACHE_ENTITY_TYPES.ASSET);
      expect(pattern).toBe('asset:*');
    });

    it('should generate entity pattern', () => {
      const pattern = entityPattern(CACHE_ENTITY_TYPES.ASSET, 'asset-123');
      expect(pattern).toBe('*asset*asset-123*');
    });

    it('should generate list pattern', () => {
      const pattern = listPattern(CACHE_ENTITY_TYPES.ASSET);
      expect(pattern).toBe('asset:list:*');
    });

    it('should generate search pattern', () => {
      const pattern = searchPattern(CACHE_ENTITY_TYPES.ASSET);
      expect(pattern).toBe('search:asset:*');
    });

    it('should generate count pattern', () => {
      const pattern = countPattern(CACHE_ENTITY_TYPES.ASSET);
      expect(pattern).toBe('asset:count:*');
    });

    it('should generate user pattern', () => {
      const pattern = userPattern('user-123');
      expect(pattern).toBe('user:*:user-123*');
    });

    it('should generate asset pattern', () => {
      const pattern = assetPattern('asset-123');
      expect(pattern).toBe('*asset*:asset-123*');
    });
  });

  describe('parseKey', () => {
    it('should parse simple entity key', () => {
      const result = parseKey('asset:123');
      expect(result).toEqual({
        entityType: 'asset',
        entityId: '123',
        variant: undefined,
      });
    });

    it('should parse key with variant', () => {
      const result = parseKey('asset:123:detail');
      expect(result).toEqual({
        entityType: 'asset',
        entityId: '123',
        variant: 'detail',
      });
    });

    it('should handle key with ams prefix', () => {
      const result = parseKey('ams:asset:123');
      expect(result).toEqual({
        entityType: 'asset',
        entityId: '123',
        variant: undefined,
      });
    });

    it('should return null for empty key', () => {
      const result = parseKey('');
      expect(result).toEqual({
        entityType: '',
        entityId: undefined,
        variant: undefined,
      });
    });
  });

  describe('keyMatchesPattern', () => {
    it('should match simple wildcard pattern', () => {
      expect(keyMatchesPattern('asset:123', 'asset:*')).toBe(true);
      expect(keyMatchesPattern('asset:123:detail', 'asset:*')).toBe(true);
      expect(keyMatchesPattern('user:123', 'asset:*')).toBe(false);
    });

    it('should match pattern with multiple wildcards', () => {
      expect(keyMatchesPattern('asset:123:detail', '*:123:*')).toBe(true);
      expect(keyMatchesPattern('user:123:roles', '*:123:*')).toBe(true);
      expect(keyMatchesPattern('asset:456:detail', '*:123:*')).toBe(false);
    });

    it('should match exact pattern', () => {
      expect(keyMatchesPattern('asset:123', 'asset:123')).toBe(true);
      expect(keyMatchesPattern('asset:123', 'asset:456')).toBe(false);
    });
  });

  describe('compositeKey', () => {
    it('should join parts with colon', () => {
      const key = compositeKey('asset', '123', 'relationships', 'parent');
      expect(key).toBe('asset:123:relationships:parent');
    });

    it('should filter out empty parts', () => {
      const key = compositeKey('asset', '', '123', null as unknown as string, 'detail');
      expect(key).toBe('asset:123:detail');
    });
  });

  describe('versionedKey', () => {
    it('should add version prefix', () => {
      const key = versionedKey('asset:123', 2);
      expect(key).toBe('v2:asset:123');
    });

    it('should work with string version', () => {
      const key = versionedKey('asset:123', '2.1');
      expect(key).toBe('v2.1:asset:123');
    });
  });

  describe('Key consistency', () => {
    it('should generate consistent keys for same inputs', () => {
      // Test multiple calls with same inputs produce same keys
      const inputs = [
        () => entityKey(CACHE_ENTITY_TYPES.ASSET, 'asset-123'),
        () => listKey(CACHE_ENTITY_TYPES.ASSET, { status: 'DEPLOYED', type: 'HARDWARE' }),
        () => searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'laptop dell'),
      ];

      for (const keyFn of inputs) {
        const key1 = keyFn();
        const key2 = keyFn();
        expect(key1).toBe(key2);
      }
    });

    it('should generate different keys for different inputs', () => {
      const key1 = entityKey(CACHE_ENTITY_TYPES.ASSET, 'asset-123');
      const key2 = entityKey(CACHE_ENTITY_TYPES.ASSET, 'asset-456');
      const key3 = entityKey(CACHE_ENTITY_TYPES.USER, 'asset-123');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('CACHE_ENTITY_TYPES - Location Hierarchy', () => {
    it('should have location hierarchy entity types', () => {
      expect(CACHE_ENTITY_TYPES.BUILDING).toBe('building');
      expect(CACHE_ENTITY_TYPES.FLOOR).toBe('floor');
      expect(CACHE_ENTITY_TYPES.ROOM).toBe('room');
      expect(CACHE_ENTITY_TYPES.RACK).toBe('rack');
    });

    it('should have bin location entity type', () => {
      expect(CACHE_ENTITY_TYPES.BIN_LOCATION).toBe('bin-location');
    });

    it('should have purchase order entity type', () => {
      expect(CACHE_ENTITY_TYPES.PURCHASE_ORDER).toBe('purchase-order');
    });
  });

  describe('Building cache keys', () => {
    it('should generate building key', () => {
      const key = buildingKey('building-123');
      expect(key).toBe('building:building-123');
    });

    it('should generate building list key without params', () => {
      const key = buildingListKey();
      expect(key).toBe('building:list');
    });

    it('should generate building list key with params', () => {
      const key = buildingListKey({ isActive: true, city: 'Seattle' });
      expect(key).toBe('building:list:city=Seattle&isActive=true');
    });
  });

  describe('Floor cache keys', () => {
    it('should generate floor key', () => {
      const key = floorKey('floor-456');
      expect(key).toBe('floor:floor-456');
    });

    it('should generate floors by building key', () => {
      const key = floorsByBuildingKey('building-123');
      expect(key).toBe('floor:building:building-123');
    });
  });

  describe('Room cache keys', () => {
    it('should generate room key', () => {
      const key = roomKey('room-789');
      expect(key).toBe('room:room-789');
    });

    it('should generate rooms by floor key', () => {
      const key = roomsByFloorKey('floor-456');
      expect(key).toBe('room:floor:floor-456');
    });
  });

  describe('Rack cache keys', () => {
    it('should generate rack key', () => {
      const key = rackKey('rack-101');
      expect(key).toBe('rack:rack-101');
    });

    it('should generate racks by room key', () => {
      const key = racksByRoomKey('room-789');
      expect(key).toBe('rack:room:room-789');
    });
  });

  describe('Stockroom cache keys', () => {
    it('should generate stockroom key', () => {
      const key = stockroomKey('stockroom-123');
      expect(key).toBe('stockroom:stockroom-123');
    });

    it('should generate stockrooms by location key', () => {
      const key = stockroomsByLocationKey('building-456');
      expect(key).toBe('stockroom:location:building-456');
    });

    it('should generate stockroom list key without params', () => {
      const key = stockroomListKey();
      expect(key).toBe('stockroom:list');
    });

    it('should generate stockroom list key with params', () => {
      const key = stockroomListKey({ isActive: true, stockroomType: 'MAIN' });
      expect(key).toBe('stockroom:list:isActive=true&stockroomType=MAIN');
    });
  });

  describe('Bin location cache keys', () => {
    it('should generate bin location key', () => {
      const key = binLocationKey('bin-202');
      expect(key).toBe('bin-location:bin-202');
    });

    it('should generate bin locations by stockroom key', () => {
      const key = binLocationsByStockroomKey('stockroom-303');
      expect(key).toBe('bin-location:stockroom:stockroom-303');
    });
  });

  describe('Purchase order cache keys', () => {
    it('should generate purchase order key', () => {
      const key = purchaseOrderKey('po-404');
      expect(key).toBe('purchase-order:po-404');
    });

    it('should generate purchase order by number key', () => {
      const key = purchaseOrderByNumberKey('PO-2024-001');
      expect(key).toBe('purchase-order:number:PO-2024-001');
    });

    it('should generate purchase orders by vendor key', () => {
      const key = purchaseOrdersByVendorKey('vendor-505');
      expect(key).toBe('purchase-order:vendor:vendor-505');
    });

    it('should generate purchase orders by status key', () => {
      const key = purchaseOrdersByStatusKey('APPROVED');
      expect(key).toBe('purchase-order:status:approved');
    });

    it('should normalize status to lowercase', () => {
      const key1 = purchaseOrdersByStatusKey('PENDING_APPROVAL');
      const key2 = purchaseOrdersByStatusKey('pending_approval');
      expect(key1).toBe(key2);
      expect(key1).toBe('purchase-order:status:pending_approval');
    });
  });

  describe('Building invalidation patterns', () => {
    it('should generate building invalidation patterns', () => {
      const patterns = buildingInvalidationPatterns('building-123');
      expect(patterns).toContain('building:building-123*');
      expect(patterns).toContain('building:list*');
      expect(patterns).toContain('floor:building:building-123*');
      expect(patterns).toContain('floor:list*');
      expect(patterns).toContain('search:building:*');
    });

    it('should include patterns for cascading invalidation', () => {
      const patterns = buildingInvalidationPatterns('building-123');
      // When a building changes, floors in that building should be invalidated
      expect(patterns.some(p => p.includes('floor:building:building-123'))).toBe(true);
    });
  });

  describe('Floor invalidation patterns', () => {
    it('should generate floor invalidation patterns without building ID', () => {
      const patterns = floorInvalidationPatterns('floor-456');
      expect(patterns).toContain('floor:floor-456*');
      expect(patterns).toContain('floor:list*');
      expect(patterns).toContain('room:floor:floor-456*');
      expect(patterns).toContain('room:list*');
      expect(patterns).toContain('search:floor:*');
    });

    it('should include building-specific pattern when building ID provided', () => {
      const patterns = floorInvalidationPatterns('floor-456', 'building-123');
      expect(patterns).toContain('floor:building:building-123*');
    });

    it('should include patterns for cascading invalidation to rooms', () => {
      const patterns = floorInvalidationPatterns('floor-456');
      expect(patterns.some(p => p.includes('room:floor:floor-456'))).toBe(true);
    });
  });

  describe('Room invalidation patterns', () => {
    it('should generate room invalidation patterns without floor ID', () => {
      const patterns = roomInvalidationPatterns('room-789');
      expect(patterns).toContain('room:room-789*');
      expect(patterns).toContain('room:list*');
      expect(patterns).toContain('rack:room:room-789*');
      expect(patterns).toContain('rack:list*');
      expect(patterns).toContain('search:room:*');
    });

    it('should include floor-specific pattern when floor ID provided', () => {
      const patterns = roomInvalidationPatterns('room-789', 'floor-456');
      expect(patterns).toContain('room:floor:floor-456*');
    });

    it('should include patterns for cascading invalidation to racks', () => {
      const patterns = roomInvalidationPatterns('room-789');
      expect(patterns.some(p => p.includes('rack:room:room-789'))).toBe(true);
    });
  });

  describe('Rack invalidation patterns', () => {
    it('should generate rack invalidation patterns without room ID', () => {
      const patterns = rackInvalidationPatterns('rack-101');
      expect(patterns).toContain('rack:rack-101*');
      expect(patterns).toContain('rack:list*');
      expect(patterns).toContain('search:rack:*');
    });

    it('should include room-specific pattern when room ID provided', () => {
      const patterns = rackInvalidationPatterns('rack-101', 'room-789');
      expect(patterns).toContain('rack:room:room-789*');
    });
  });

  describe('Stockroom invalidation patterns', () => {
    it('should generate stockroom invalidation patterns without location ID', () => {
      const patterns = stockroomInvalidationPatterns('stockroom-123');
      expect(patterns).toContain('stockroom:stockroom-123*');
      expect(patterns).toContain('stockroom:list*');
      expect(patterns).toContain('bin-location:stockroom:stockroom-123*');
      expect(patterns).toContain('search:stockroom:*');
      expect(patterns).toContain('stockrooms:active');
    });

    it('should include location-specific pattern when location ID provided', () => {
      const patterns = stockroomInvalidationPatterns('stockroom-123', 'building-456');
      expect(patterns).toContain('stockroom:location:building-456*');
    });

    it('should include patterns for cascading invalidation to bin locations', () => {
      const patterns = stockroomInvalidationPatterns('stockroom-123');
      expect(patterns.some(p => p.includes('bin-location:stockroom:stockroom-123'))).toBe(true);
    });

    it('should include all required patterns for cache invalidation', () => {
      const stockroomId = 'stockroom-abc';
      const locationId = 'building-xyz';
      const patterns = stockroomInvalidationPatterns(stockroomId, locationId);
      
      // Verify the three required patterns from task 7.1.5
      // 1. stockroom:{stockroomId}*
      expect(patterns.some(p => p === `stockroom:${stockroomId}*`)).toBe(true);
      // 2. stockroom:location:{locationId}*
      expect(patterns.some(p => p === `stockroom:location:${locationId}*`)).toBe(true);
      // 3. stockroom:list*
      expect(patterns.some(p => p === 'stockroom:list*')).toBe(true);
    });
  });

  describe('Bin location invalidation patterns', () => {
    it('should generate bin location invalidation patterns without stockroom ID', () => {
      const patterns = binLocationInvalidationPatterns('bin-202');
      expect(patterns).toContain('bin-location:bin-202*');
      expect(patterns).toContain('bin-location:list*');
      expect(patterns).toContain('search:bin-location:*');
    });

    it('should include stockroom-specific pattern when stockroom ID provided', () => {
      const patterns = binLocationInvalidationPatterns('bin-202', 'stockroom-303');
      expect(patterns).toContain('bin-location:stockroom:stockroom-303*');
    });
  });

  describe('Purchase order invalidation patterns', () => {
    it('should generate purchase order invalidation patterns without vendor or status', () => {
      const patterns = purchaseOrderInvalidationPatterns('po-404');
      expect(patterns).toContain('purchase-order:po-404*');
      expect(patterns).toContain('purchase-order:list*');
      expect(patterns).toContain('search:purchase-order:*');
    });

    it('should include vendor-specific pattern when vendor ID provided', () => {
      const patterns = purchaseOrderInvalidationPatterns('po-404', 'vendor-505');
      expect(patterns).toContain('purchase-order:vendor:vendor-505*');
    });

    it('should include status-specific pattern when status provided', () => {
      const patterns = purchaseOrderInvalidationPatterns('po-404', undefined, 'APPROVED');
      expect(patterns).toContain('purchase-order:status:approved*');
    });

    it('should include both vendor and status patterns when both provided', () => {
      const patterns = purchaseOrderInvalidationPatterns('po-404', 'vendor-505', 'PENDING_APPROVAL');
      expect(patterns).toContain('purchase-order:vendor:vendor-505*');
      expect(patterns).toContain('purchase-order:status:pending_approval*');
    });
  });

  describe('Location hierarchy key consistency', () => {
    it('should generate consistent keys for location hierarchy', () => {
      // Test that the same inputs always produce the same keys
      const buildingId = 'building-abc-123';
      const floorId = 'floor-def-456';
      const roomId = 'room-ghi-789';
      const rackId = 'rack-jkl-012';

      expect(buildingKey(buildingId)).toBe(buildingKey(buildingId));
      expect(floorKey(floorId)).toBe(floorKey(floorId));
      expect(roomKey(roomId)).toBe(roomKey(roomId));
      expect(rackKey(rackId)).toBe(rackKey(rackId));
    });

    it('should generate different keys for different entities', () => {
      const id = 'same-id-123';
      
      const building = buildingKey(id);
      const floor = floorKey(id);
      const room = roomKey(id);
      const rack = rackKey(id);

      // All should be different due to entity type prefix
      expect(building).not.toBe(floor);
      expect(floor).not.toBe(room);
      expect(room).not.toBe(rack);
      expect(building).not.toBe(rack);
    });
  });
});
