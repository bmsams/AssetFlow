/**
 * Cache Service Unit Tests
 *
 * Tests for the cache service implementing cache-aside pattern
 * Validates Requirements: 10.1, 10.3
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
import {
  get,
  set,
  del,
  delMany,
  delPattern,
  exists,
  existsMany,
  ttl,
  touch,
  getOrSet,
  cacheAside,
  getOrSetMany,
  invalidate,
  invalidateAll,
  invalidateAssetRelated,
  getStats,
  resetStats,
  getHitRate,
  getMetrics,
  mget,
  mset,
  incr,
  decr,
  setNX,
  acquireLock,
  releaseLock,
  withLock,
  getWithMeta,
  setWithEntityTTL,
  msetWithEntityTTL,
  getTTLForEntityType,
  DEFAULT_TTL,
  ENTITY_TTL,
  PATTERN_TTL,
} from '../cache-service';
import { CACHE_ENTITY_TYPES } from '../cache-keys';

describe('Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStats();
  });

  /**
   * Validates: Requirements 10.1
   * TTL configuration for different data types
   */
  describe('TTL Configuration', () => {
    it('should have correct default TTL values', () => {
      expect(DEFAULT_TTL.VERY_SHORT).toBe(60);
      expect(DEFAULT_TTL.SHORT).toBe(300);
      expect(DEFAULT_TTL.MEDIUM).toBe(900);
      expect(DEFAULT_TTL.LONG).toBe(3600);
      expect(DEFAULT_TTL.VERY_LONG).toBe(86400);
      expect(DEFAULT_TTL.STATIC).toBe(604800);
    });

    it('should have entity-specific TTL values', () => {
      expect(ENTITY_TTL[CACHE_ENTITY_TYPES.ASSET]).toBe(DEFAULT_TTL.MEDIUM);
      expect(ENTITY_TTL[CACHE_ENTITY_TYPES.USER]).toBe(DEFAULT_TTL.LONG);
      expect(ENTITY_TTL[CACHE_ENTITY_TYPES.VENDOR]).toBe(DEFAULT_TTL.VERY_LONG);
      expect(ENTITY_TTL[CACHE_ENTITY_TYPES.INVENTORY]).toBe(DEFAULT_TTL.SHORT);
    });

    it('should have pattern-specific TTL values', () => {
      expect(PATTERN_TTL.SEARCH).toBe(DEFAULT_TTL.SHORT);
      expect(PATTERN_TTL.LIST).toBe(DEFAULT_TTL.SHORT);
      expect(PATTERN_TTL.PERMISSIONS).toBe(DEFAULT_TTL.LONG);
      expect(PATTERN_TTL.CONFIG).toBe(DEFAULT_TTL.VERY_LONG);
      expect(PATTERN_TTL.REFERENCE).toBe(DEFAULT_TTL.STATIC);
    });

    it('should return correct TTL for entity type', () => {
      expect(getTTLForEntityType(CACHE_ENTITY_TYPES.ASSET)).toBe(DEFAULT_TTL.MEDIUM);
      expect(getTTLForEntityType(CACHE_ENTITY_TYPES.USER)).toBe(DEFAULT_TTL.LONG);
      expect(getTTLForEntityType(CACHE_ENTITY_TYPES.INVENTORY)).toBe(DEFAULT_TTL.SHORT);
    });
  });

  /**
   * Validates: Requirements 10.3
   * Cache-aside pattern - get operation
   */
  describe('get', () => {
    it('should return cached value on cache hit', async () => {
      const testData = { id: '123', name: 'Test Asset' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await get<typeof testData>('asset:123');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('asset:123');
      expect(getStats().hits).toBe(1);
      expect(getStats().misses).toBe(0);
    });

    it('should return null on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await get<{ id: string }>('asset:nonexistent');

      expect(result).toBeNull();
      expect(getStats().hits).toBe(0);
      expect(getStats().misses).toBe(1);
    });

    it('should return null and increment errors on Redis error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await get<{ id: string }>('asset:123');

      expect(result).toBeNull();
      expect(getStats().errors).toBe(1);
    });
  });

  /**
   * Validates: Requirements 10.1
   * Cache with configurable TTL
   */
  describe('set', () => {
    it('should set value with default TTL', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');
      const testData = { id: '123', name: 'Test Asset' };

      const result = await set('asset:123', testData);

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'asset:123',
        DEFAULT_TTL.MEDIUM,
        JSON.stringify(testData)
      );
      expect(getStats().sets).toBe(1);
    });

    it('should set value with custom TTL', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');
      const testData = { id: '123', name: 'Test Asset' };

      const result = await set('asset:123', testData, 3600);

      expect(result).toBe(true);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'asset:123',
        3600,
        JSON.stringify(testData)
      );
    });

    it('should return false on Redis error', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis connection failed'));

      const result = await set('asset:123', { id: '123' });

      expect(result).toBe(false);
      expect(getStats().errors).toBe(1);
    });
  });

  describe('setWithEntityTTL', () => {
    it('should set value with entity-specific TTL', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');
      const testData = { id: '123', name: 'Test Asset' };

      await setWithEntityTTL('asset:123', testData, CACHE_ENTITY_TYPES.ASSET);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'asset:123',
        ENTITY_TTL[CACHE_ENTITY_TYPES.ASSET],
        JSON.stringify(testData)
      );
    });
  });

  /**
   * Validates: Requirements 10.2
   * Cache invalidation
   */
  describe('del', () => {
    it('should delete a key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const result = await del('asset:123');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('asset:123');
      expect(getStats().deletes).toBe(1);
    });

    it('should return false on Redis error', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis connection failed'));

      const result = await del('asset:123');

      expect(result).toBe(false);
      expect(getStats().errors).toBe(1);
    });
  });

  describe('delMany', () => {
    it('should delete multiple keys', async () => {
      mockRedisClient.del.mockResolvedValue(3);

      const result = await delMany(['asset:1', 'asset:2', 'asset:3']);

      expect(result).toBe(3);
      expect(mockRedisClient.del).toHaveBeenCalledWith('asset:1', 'asset:2', 'asset:3');
      expect(getStats().deletes).toBe(3);
    });

    it('should return 0 for empty array', async () => {
      const result = await delMany([]);

      expect(result).toBe(0);
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('delPattern', () => {
    it('should delete keys matching pattern', async () => {
      mockRedisClient.keys.mockResolvedValue(['ams:asset:1', 'ams:asset:2']);
      mockRedisClient.del.mockResolvedValue(2);

      const result = await delPattern('asset:*');

      expect(result).toBe(2);
      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:*');
      expect(getStats().invalidations).toBe(1);
    });

    it('should return 0 when no keys match', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      const result = await delPattern('nonexistent:*');

      expect(result).toBe(0);
    });
  });

  describe('exists', () => {
    it('should return true when key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await exists('asset:123');

      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await exists('asset:nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('ttl', () => {
    it('should return remaining TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(300);

      const result = await ttl('asset:123');

      expect(result).toBe(300);
    });

    it('should return -1 on error', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis error'));

      const result = await ttl('asset:123');

      expect(result).toBe(-1);
    });
  });

  describe('touch', () => {
    it('should refresh TTL for existing key', async () => {
      mockRedisClient.expire.mockResolvedValue(1);

      const result = await touch('asset:123', 600);

      expect(result).toBe(true);
      expect(mockRedisClient.expire).toHaveBeenCalledWith('asset:123', 600);
    });

    it('should return false for non-existent key', async () => {
      mockRedisClient.expire.mockResolvedValue(0);

      const result = await touch('asset:nonexistent', 600);

      expect(result).toBe(false);
    });
  });

  /**
   * Validates: Requirements 10.3
   * Cache-aside pattern implementation
   */
  describe('getOrSet', () => {
    it('should return cached value on cache hit', async () => {
      const cachedData = { id: '123', name: 'Cached Asset' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const fetchFn = jest.fn();
      const result = await getOrSet('asset:123', fetchFn);

      expect(result).toEqual(cachedData);
      expect(fetchFn).not.toHaveBeenCalled();
      expect(getStats().hits).toBe(1);
    });

    it('should fetch and cache on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const fetchedData = { id: '123', name: 'Fetched Asset' };
      const fetchFn = jest.fn().mockResolvedValue(fetchedData);

      const result = await getOrSet('asset:123', fetchFn);

      expect(result).toEqual(fetchedData);
      expect(fetchFn).toHaveBeenCalled();
      expect(getStats().misses).toBe(1);
    });

    it('should use custom TTL when provided', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const fetchFn = jest.fn().mockResolvedValue({ id: '123' });

      await getOrSet('asset:123', fetchFn, { ttl: 7200 });

      // Wait for async set
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'asset:123',
        7200,
        expect.any(String)
      );
    });

    it('should use entity-based TTL when entityType provided', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const fetchFn = jest.fn().mockResolvedValue({ id: '123' });

      await getOrSet('user:123', fetchFn, { entityType: CACHE_ENTITY_TYPES.USER });

      // Wait for async set
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'user:123',
        ENTITY_TTL[CACHE_ENTITY_TYPES.USER],
        expect.any(String)
      );
    });

    it('should skip cache when skipCache is true', async () => {
      const fetchedData = { id: '123', name: 'Fetched Asset' };
      const fetchFn = jest.fn().mockResolvedValue(fetchedData);

      const result = await getOrSet('asset:123', fetchFn, { skipCache: true });

      expect(result).toEqual(fetchedData);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(fetchFn).toHaveBeenCalled();
    });
  });

  describe('cacheAside', () => {
    it('should call onHit callback on cache hit', async () => {
      const cachedData = { id: '123', name: 'Cached Asset' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));
      const onHit = jest.fn();
      const onMiss = jest.fn();

      await cacheAside('asset:123', {
        fetchFn: jest.fn(),
        onHit,
        onMiss,
      });

      expect(onHit).toHaveBeenCalledWith(cachedData);
      expect(onMiss).not.toHaveBeenCalled();
    });

    it('should call onMiss callback on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      const onHit = jest.fn();
      const onMiss = jest.fn();
      const fetchFn = jest.fn().mockResolvedValue({ id: '123' });

      await cacheAside('asset:123', {
        fetchFn,
        onHit,
        onMiss,
      });

      expect(onHit).not.toHaveBeenCalled();
      expect(onMiss).toHaveBeenCalled();
    });
  });

  describe('getOrSetMany', () => {
    it('should return all cached values when all keys are cached', async () => {
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({ id: '1' }),
        JSON.stringify({ id: '2' }),
      ]);

      const fetchFn = jest.fn();
      const result = await getOrSetMany(['asset:1', 'asset:2'], fetchFn);

      expect(result.size).toBe(2);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('should fetch missing keys', async () => {
      mockRedisClient.mget.mockResolvedValue([JSON.stringify({ id: '1' }), null]);
      mockPipeline.exec.mockResolvedValue([]);
      const fetchFn = jest.fn().mockResolvedValue(new Map([['asset:2', { id: '2' }]]));

      const result = await getOrSetMany(['asset:1', 'asset:2'], fetchFn);

      expect(result.size).toBe(2);
      expect(fetchFn).toHaveBeenCalledWith(['asset:2']);
    });

    it('should return empty map for empty keys array', async () => {
      const result = await getOrSetMany([], jest.fn());

      expect(result.size).toBe(0);
    });
  });

  /**
   * Validates: Requirements 10.2
   * Cache invalidation on updates
   */
  describe('invalidate', () => {
    it('should invalidate cache for entity', async () => {
      mockRedisClient.keys.mockResolvedValue(['ams:asset:123:detail', 'ams:asset:123:summary']);
      mockRedisClient.del.mockResolvedValue(2);

      await invalidate('asset', '123');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:123*');
      expect(getStats().invalidations).toBeGreaterThan(0);
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all cache entries for entity type', async () => {
      mockRedisClient.keys.mockResolvedValue(['ams:asset:1', 'ams:asset:2', 'ams:asset:3']);
      mockRedisClient.del.mockResolvedValue(3);

      await invalidateAll('asset');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('asset:*');
    });
  });

  describe('invalidateAssetRelated', () => {
    it('should invalidate all asset-related cache entries', async () => {
      mockRedisClient.keys.mockResolvedValue([]);
      mockRedisClient.del.mockResolvedValue(0);

      await invalidateAssetRelated('123');

      // Should call keys for multiple patterns
      expect(mockRedisClient.keys).toHaveBeenCalledTimes(7); // 6 patterns + list pattern
    });
  });

  /**
   * Cache statistics
   */
  describe('Statistics', () => {
    it('should track cache statistics', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: '1' }));
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);

      await get('asset:1'); // hit
      await get('asset:2'); // miss
      await set('asset:3', { id: '3' }); // set
      await del('asset:4'); // delete

      const stats = getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.sets).toBe(1);
      expect(stats.deletes).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: '1' }));
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: '2' }));
      mockRedisClient.get.mockResolvedValueOnce(null);

      await get('asset:1'); // hit
      await get('asset:2'); // hit
      await get('asset:3'); // miss

      expect(getHitRate()).toBeCloseTo(0.667, 2);
    });

    it('should return 0 hit rate when no operations', () => {
      expect(getHitRate()).toBe(0);
    });

    it('should reset statistics', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify({ id: '1' }));
      await get('asset:1');

      resetStats();

      const stats = getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.invalidations).toBe(0);
    });

    it('should return detailed metrics', async () => {
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ id: '1' }));
      mockRedisClient.get.mockResolvedValueOnce(null);

      await get('asset:1');
      await get('asset:2');

      const metrics = getMetrics();
      expect(metrics.stats.hits).toBe(1);
      expect(metrics.stats.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
      expect(metrics.errorRate).toBe(0);
    });
  });

  /**
   * Batch operations
   */
  describe('mget', () => {
    it('should get multiple values', async () => {
      mockRedisClient.mget.mockResolvedValue([
        JSON.stringify({ id: '1' }),
        JSON.stringify({ id: '2' }),
        null,
      ]);

      const result = await mget<{ id: string }>(['asset:1', 'asset:2', 'asset:3']);

      expect(result.size).toBe(2);
      expect(result.get('asset:1')).toEqual({ id: '1' });
      expect(result.get('asset:2')).toEqual({ id: '2' });
      expect(result.has('asset:3')).toBe(false);
      expect(getStats().hits).toBe(2);
      expect(getStats().misses).toBe(1);
    });

    it('should return empty map for empty keys', async () => {
      const result = await mget([]);

      expect(result.size).toBe(0);
    });
  });

  describe('mset', () => {
    it('should set multiple values', async () => {
      mockPipeline.exec.mockResolvedValue([]);
      const entries = new Map([
        ['asset:1', { id: '1' }],
        ['asset:2', { id: '2' }],
      ]);

      const result = await mset(entries, 300);

      expect(result).toBe(true);
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(getStats().sets).toBe(2);
    });

    it('should return true for empty entries', async () => {
      const result = await mset(new Map());

      expect(result).toBe(true);
    });
  });

  describe('msetWithEntityTTL', () => {
    it('should set multiple values with entity-specific TTL', async () => {
      mockPipeline.exec.mockResolvedValue([]);
      const entries = new Map([['user:1', { id: '1' }]]);

      await msetWithEntityTTL(entries, CACHE_ENTITY_TYPES.USER);

      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });
  });

  /**
   * Atomic operations
   */
  describe('incr/decr', () => {
    it('should increment value', async () => {
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await incr('counter:views');

      expect(result).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter:views');
    });

    it('should increment by amount', async () => {
      mockRedisClient.incrby.mockResolvedValue(5);

      const result = await incr('counter:views', 5);

      expect(result).toBe(5);
      expect(mockRedisClient.incrby).toHaveBeenCalledWith('counter:views', 5);
    });

    it('should decrement value', async () => {
      mockRedisClient.decr.mockResolvedValue(0);

      const result = await decr('counter:views');

      expect(result).toBe(0);
      expect(mockRedisClient.decr).toHaveBeenCalledWith('counter:views');
    });

    it('should decrement by amount', async () => {
      mockRedisClient.decrby.mockResolvedValue(5);

      const result = await decr('counter:views', 5);

      expect(result).toBe(5);
      expect(mockRedisClient.decrby).toHaveBeenCalledWith('counter:views', 5);
    });
  });

  /**
   * Distributed locking
   */
  describe('setNX', () => {
    it('should set value only if key does not exist', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await setNX('lock:resource', 'owner-1', 30);

      expect(result).toBe(true);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:resource',
        JSON.stringify('owner-1'),
        'EX',
        30,
        'NX'
      );
    });

    it('should return false if key exists', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const result = await setNX('lock:resource', 'owner-2', 30);

      expect(result).toBe(false);
    });
  });

  describe('acquireLock/releaseLock', () => {
    it('should acquire lock', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await acquireLock('lock:resource', 'owner-1', 30);

      expect(result).toBe(true);
    });

    it('should release lock when owner matches', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      const result = await releaseLock('lock:resource', 'owner-1');

      expect(result).toBe(true);
    });

    it('should not release lock when owner does not match', async () => {
      mockRedisClient.eval.mockResolvedValue(0);

      const result = await releaseLock('lock:resource', 'wrong-owner');

      expect(result).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);
      const fn = jest.fn().mockResolvedValue('result');

      const result = await withLock('lock:resource', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
    });

    it('should return null if lock cannot be acquired', async () => {
      mockRedisClient.set.mockResolvedValue(null);
      const fn = jest.fn();

      const result = await withLock('lock:resource', fn, { retryCount: 1, retryDelayMs: 10 });

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('getWithMeta', () => {
    it('should return value with metadata on cache hit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify({ id: '123' })],
        [null, 300],
      ]);

      const result = await getWithMeta<{ id: string }>('asset:123');

      expect(result.hit).toBe(true);
      expect(result.value).toEqual({ id: '123' });
      expect(result.ttl).toBe(300);
    });

    it('should return null with hit=false on cache miss', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, null],
        [null, -2],
      ]);

      const result = await getWithMeta<{ id: string }>('asset:nonexistent');

      expect(result.hit).toBe(false);
      expect(result.value).toBeNull();
    });
  });

  describe('existsMany', () => {
    it('should check existence of multiple keys', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 0],
        [null, 1],
      ]);

      const result = await existsMany(['asset:1', 'asset:2', 'asset:3']);

      expect(result.get('asset:1')).toBe(true);
      expect(result.get('asset:2')).toBe(false);
      expect(result.get('asset:3')).toBe(true);
    });

    it('should return empty map for empty keys', async () => {
      const result = await existsMany([]);

      expect(result.size).toBe(0);
    });
  });
});
