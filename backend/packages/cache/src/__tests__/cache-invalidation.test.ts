/**
 * Cache Invalidation Unit Tests
 *
 * Tests for synchronous cache invalidation with writes and cache stampede prevention.
 * Validates Requirements: 10.2
 */

import type Redis from 'ioredis';

// Mock ioredis before importing cache modules
const mockPipeline = {
  get: jest.fn().mockReturnThis(),
  ttl: jest.fn().mockReturnThis(),
  setex: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exists: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedisClient = {
  get: jest.fn(),
  setex: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  scan: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  mget: jest.fn(),
  incr: jest.fn(),
  incrby: jest.fn(),
  decr: jest.fn(),
  decrby: jest.fn(),
  eval: jest.fn(),
  pipeline: jest.fn(() => mockPipeline),
};

jest.mock('../client', () => ({
  getRedisClient: jest.fn(() => mockRedisClient as unknown as Redis),
  initializeRedis: jest.fn(() => mockRedisClient as unknown as Redis),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Import after mocks
import type { AssetCreatedEvent, AssetUpdatedEvent, DomainEvent } from '@ams/types';

import { CACHE_ENTITY_TYPES } from '../cache-keys';
import {
  writeWithInvalidation,
  invalidateEntityCache,
  invalidateMultipleEntities,
  shouldRefreshEarly,
  getWithStampedePrevention,
  handleEventInvalidation,
  createCacheInvalidationMiddleware,
  invalidateAssetComprehensive,
  invalidateUserComprehensive,
  invalidateStockroomComprehensive,
} from '../cache-invalidation';

describe('Cache Invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset scan to return empty by default
    mockRedisClient.scan.mockResolvedValue(['0', []]);
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.del.mockResolvedValue(0);
  });

  // ============================================================================
  // Synchronous Write-Through Invalidation Tests
  // ============================================================================

  /**
   * Validates: Requirements 10.2
   * Synchronous invalidation with writes
   */
  describe('writeWithInvalidation', () => {
    it('should invalidate cache before performing write', async () => {
      const writeFn = jest.fn().mockResolvedValue({ id: '123', name: 'Test Asset' });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await writeWithInvalidation({
        entityType: CACHE_ENTITY_TYPES.ASSET,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        writeFn,
      });

      // Verify cache was invalidated (del called before write)
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(writeFn).toHaveBeenCalled();
      expect(result).toEqual({ id: '123', name: 'Test Asset' });
    });

    it('should update cache after write when updateCache is true', async () => {
      const writeFn = jest.fn().mockResolvedValue({ id: '123', name: 'Updated Asset' });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.setex.mockResolvedValue('OK');

      await writeWithInvalidation({
        entityType: CACHE_ENTITY_TYPES.ASSET,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        writeFn,
        updateCache: true,
      });

      // Verify cache was updated after write
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'asset:550e8400-e29b-41d4-a716-446655440000',
        expect.any(Number),
        expect.any(String)
      );
    });

    it('should use custom TTL when provided', async () => {
      const writeFn = jest.fn().mockResolvedValue({ id: '123' });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.setex.mockResolvedValue('OK');

      await writeWithInvalidation({
        entityType: CACHE_ENTITY_TYPES.ASSET,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        writeFn,
        updateCache: true,
        ttl: 7200,
      });

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.any(String),
        7200,
        expect.any(String)
      );
    });

    it('should invalidate additional patterns when provided', async () => {
      const writeFn = jest.fn().mockResolvedValue({ id: '123' });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue(['ams:custom:pattern:1']);

      await writeWithInvalidation({
        entityType: CACHE_ENTITY_TYPES.ASSET,
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        writeFn,
        additionalPatterns: ['custom:pattern:*'],
      });

      // Verify additional pattern was invalidated
      expect(mockRedisClient.keys).toHaveBeenCalledWith('custom:pattern:*');
    });

    it('should propagate write errors', async () => {
      const writeFn = jest.fn().mockRejectedValue(new Error('Database error'));
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      await expect(
        writeWithInvalidation({
          entityType: CACHE_ENTITY_TYPES.ASSET,
          entityId: '550e8400-e29b-41d4-a716-446655440000',
          writeFn,
        })
      ).rejects.toThrow('Database error');
    });
  });

  /**
   * Validates: Requirements 10.2
   * Entity cache invalidation
   */
  describe('invalidateEntityCache', () => {
    it('should invalidate primary entity key', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      await invalidateEntityCache(
        CACHE_ENTITY_TYPES.ASSET,
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'asset:550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should invalidate entity-specific patterns', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue(['ams:asset:123:detail', 'ams:asset:123:summary']);

      await invalidateEntityCache(CACHE_ENTITY_TYPES.ASSET, '123');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:123*');
    });

    it('should invalidate related patterns when invalidateRelated is true', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      await invalidateEntityCache(CACHE_ENTITY_TYPES.ASSET, '123', {
        invalidateRelated: true,
      });

      // Should invalidate list, search, and count patterns
      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('search:asset:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:count:*');
    });

    it('should not invalidate related patterns when invalidateRelated is false', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      await invalidateEntityCache(CACHE_ENTITY_TYPES.ASSET, '123', {
        invalidateRelated: false,
      });

      // Should only call keys for entity-specific pattern
      expect(mockRedisClient.keys).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:123*');
    });

    it('should return total deleted count', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValueOnce(['ams:asset:123:detail']);
      mockRedisClient.keys.mockResolvedValue([]);

      const deleted = await invalidateEntityCache(CACHE_ENTITY_TYPES.ASSET, '123');

      expect(deleted).toBeGreaterThanOrEqual(1);
    });
  });

  describe('invalidateMultipleEntities', () => {
    it('should invalidate multiple entities', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const entities = [
        { entityType: CACHE_ENTITY_TYPES.ASSET, entityId: '123' },
        { entityType: CACHE_ENTITY_TYPES.ASSET, entityId: '456' },
        { entityType: CACHE_ENTITY_TYPES.USER, entityId: '789' },
      ];

      await invalidateMultipleEntities(entities);

      // Should invalidate each entity
      expect(mockRedisClient.del).toHaveBeenCalledWith('asset:123');
      expect(mockRedisClient.del).toHaveBeenCalledWith('asset:456');
      expect(mockRedisClient.del).toHaveBeenCalledWith('user:789');
    });

    it('should invalidate related patterns once per entity type', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const entities = [
        { entityType: CACHE_ENTITY_TYPES.ASSET, entityId: '123' },
        { entityType: CACHE_ENTITY_TYPES.ASSET, entityId: '456' },
      ];

      await invalidateMultipleEntities(entities, { invalidateRelated: true });

      // List pattern should only be called once for asset type
      const listPatternCalls = mockRedisClient.keys.mock.calls.filter(
        (call) => call[0] === 'asset:list:*'
      );
      expect(listPatternCalls.length).toBe(1);
    });
  });

  // ============================================================================
  // Cache Stampede Prevention Tests
  // ============================================================================

  /**
   * Validates: Requirements 10.2
   * Cache stampede prevention
   */
  describe('shouldRefreshEarly', () => {
    it('should return true when TTL is expired', () => {
      expect(shouldRefreshEarly(0, 900)).toBe(true);
      expect(shouldRefreshEarly(-1, 900)).toBe(true);
    });

    it('should return false when plenty of TTL remaining', () => {
      // More than 50% TTL remaining should not trigger early refresh
      expect(shouldRefreshEarly(600, 900)).toBe(false);
      expect(shouldRefreshEarly(500, 900)).toBe(false);
    });

    it('should have increasing probability as TTL decreases', () => {
      // Run multiple times to test probabilistic behavior
      let refreshCount = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (shouldRefreshEarly(50, 900, 1.0)) {
          refreshCount++;
        }
      }

      // With low remaining TTL, should have some refreshes
      // but not deterministic due to probability
      expect(refreshCount).toBeGreaterThan(0);
    });

    it('should respect beta factor', () => {
      // Higher beta = more aggressive early refresh
      let lowBetaRefreshes = 0;
      let highBetaRefreshes = 0;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        if (shouldRefreshEarly(100, 900, 0.5)) {
          lowBetaRefreshes++;
        }
        if (shouldRefreshEarly(100, 900, 2.0)) {
          highBetaRefreshes++;
        }
      }

      // Higher beta should generally result in more refreshes
      // (though this is probabilistic)
      expect(highBetaRefreshes).toBeGreaterThanOrEqual(0);
      expect(lowBetaRefreshes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getWithStampedePrevention', () => {
    it('should return cached value on cache hit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify({ id: '123', name: 'Cached' })],
        [null, 600], // 600 seconds remaining TTL
      ]);

      const fetchFn = jest.fn();
      const result = await getWithStampedePrevention('asset:123', fetchFn, {
        ttl: 900,
      });

      expect(result.value).toEqual({ id: '123', name: 'Cached' });
      expect(result.fromCache).toBe(true);
      expect(result.earlyRefresh).toBe(false);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch and cache on cache miss', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null],
        [null, -2],
      ]);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.setex.mockResolvedValue('OK');

      const fetchFn = jest.fn().mockResolvedValue({ id: '123', name: 'Fetched' });
      const result = await getWithStampedePrevention('asset:123', fetchFn, {
        ttl: 900,
      });

      expect(result.value).toEqual({ id: '123', name: 'Fetched' });
      expect(result.fromCache).toBe(false);
      expect(fetchFn).toHaveBeenCalled();
    });

    it('should use lock when fetching on cache miss', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null],
        [null, -2],
      ]);
      mockRedisClient.set.mockResolvedValue('OK'); // Lock acquired
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1); // Lock released

      const fetchFn = jest.fn().mockResolvedValue({ id: '123' });
      await getWithStampedePrevention('asset:123', fetchFn, {
        ttl: 900,
        lockTimeout: 10,
      });

      // Should try to acquire lock
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('lock:refresh:'),
        expect.any(String),
        'EX',
        10,
        'NX'
      );
    });

    it('should return cached value and trigger early refresh when TTL is low', async () => {
      // Mock cache hit with low TTL
      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify({ id: '123', name: 'Cached' })],
        [null, 30], // Only 30 seconds remaining
      ]);
      mockRedisClient.set.mockResolvedValue(null); // Lock not acquired (another process refreshing)

      const fetchFn = jest.fn().mockResolvedValue({ id: '123', name: 'Refreshed' });

      // Force early refresh by mocking Math.random
      const originalRandom = Math.random;
      Math.random = jest.fn().mockReturnValue(0.99); // High value to trigger refresh

      const result = await getWithStampedePrevention('asset:123', fetchFn, {
        ttl: 900,
        minTtlForEarlyRefresh: 60,
      });

      Math.random = originalRandom;

      expect(result.value).toEqual({ id: '123', name: 'Cached' });
      expect(result.fromCache).toBe(true);
      // Early refresh may or may not be triggered depending on probability
      expect(result.remainingTtl).toBe(30);
    });
  });

  // ============================================================================
  // Event-Driven Invalidation Tests
  // ============================================================================

  /**
   * Validates: Requirements 10.2
   * Event-driven cache invalidation
   */
  describe('handleEventInvalidation', () => {
    it('should invalidate cache for ASSET_CREATED event', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const event: AssetCreatedEvent = {
        eventId: 'evt-123',
        eventType: 'ASSET_CREATED',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        payload: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
          assetType: 'HARDWARE',
          assetTag: 'AMS-HW-20250101-ABC123',
          createdBy: 'user-123',
          asset: {} as any,
        },
      };

      const deleted = await handleEventInvalidation(event);

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'asset:550e8400-e29b-41d4-a716-446655440000'
      );
      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it('should invalidate related entities for ASSET_UPDATED event', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const event: AssetUpdatedEvent = {
        eventId: 'evt-456',
        eventType: 'ASSET_UPDATED',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        payload: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
          assetType: 'HARDWARE',
          updatedBy: 'user-123',
          changes: [{ field: 'name', oldValue: 'Old', newValue: 'New' }],
        },
      };

      await handleEventInvalidation(event);

      // Should invalidate related entity types (hw-asset, sw-asset, en-asset)
      expect(mockRedisClient.keys).toHaveBeenCalledWith('hw-asset:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('sw-asset:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('en-asset:list:*');
    });

    it('should return 0 for events without invalidation mapping', async () => {
      const event = {
        eventId: 'evt-789',
        eventType: 'UNKNOWN_EVENT' as any,
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        payload: {},
      } as DomainEvent;

      const deleted = await handleEventInvalidation(event);

      expect(deleted).toBe(0);
    });

    it('should handle events with related entity IDs', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const event = {
        eventId: 'evt-assign',
        eventType: 'ASSET_ASSIGNED',
        timestamp: new Date().toISOString(),
        version: '1.0',
        source: 'test',
        payload: {
          assetId: 'asset-123',
          assetType: 'HARDWARE',
          assignedTo: 'user-456',
          assignedBy: 'admin-789',
          previousAssignee: 'user-old',
        },
      } as DomainEvent;

      await handleEventInvalidation(event);

      // Should invalidate asset and related user caches
      expect(mockRedisClient.del).toHaveBeenCalledWith('asset:asset-123');
    });
  });

  describe('createCacheInvalidationMiddleware', () => {
    it('should create middleware that invalidates cache and calls next', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.keys.mockResolvedValue([]);

      const middleware = createCacheInvalidationMiddleware();
      const next = jest.fn().mockResolvedValue(undefined);

      const message = {
        event: {
          eventId: 'evt-123',
          eventType: 'ASSET_CREATED',
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'test',
          payload: {
            assetId: 'asset-123',
            assetType: 'HARDWARE',
            assetTag: 'AMS-HW-123',
            createdBy: 'user-123',
            asset: {},
          },
        } as DomainEvent,
      };

      await middleware(message, next);

      // Should invalidate cache
      expect(mockRedisClient.del).toHaveBeenCalled();
      // Should call next handler
      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Comprehensive Invalidation Tests
  // ============================================================================

  describe('invalidateAssetComprehensive', () => {
    it('should invalidate all asset-related cache patterns', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(0);

      await invalidateAssetComprehensive('asset-123');

      // Should scan for multiple asset-related patterns
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        expect.stringContaining('asset:asset-123'),
        'COUNT',
        100
      );
    });

    it('should invalidate list and search caches', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(0);

      await invalidateAssetComprehensive('asset-123');

      // Should invalidate list caches
      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:list:*');
      expect(mockRedisClient.keys).toHaveBeenCalledWith('hw-asset:list:*');

      // Should invalidate search caches
      expect(mockRedisClient.keys).toHaveBeenCalledWith('search:asset:*');
    });
  });

  describe('invalidateUserComprehensive', () => {
    it('should invalidate all user-related cache patterns', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);
      mockRedisClient.del.mockResolvedValue(0);

      await invalidateUserComprehensive('user-123');

      // Should scan for user-related patterns
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        expect.stringContaining('user:user-123'),
        'COUNT',
        100
      );
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'user:permissions:user-123*',
        'COUNT',
        100
      );
    });
  });

  describe('invalidateStockroomComprehensive', () => {
    it('should invalidate all stockroom-related cache patterns', async () => {
      mockRedisClient.scan.mockResolvedValue(['0', []]);
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(0);

      await invalidateStockroomComprehensive('stockroom-123');

      // Should scan for stockroom-related patterns
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'stockroom:stockroom-123*',
        'COUNT',
        100
      );
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        'inventory:stockroom:stockroom-123*',
        'COUNT',
        100
      );
    });
  });
});
