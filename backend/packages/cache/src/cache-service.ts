/**
 * Cache service implementing cache-aside pattern
 *
 * Implements Requirements:
 * - 10.1: Cache frequently accessed asset data with configurable TTL
 * - 10.3: Cache-aside pattern for database query results
 */

import { createLogger } from '@ams/utils';

import { getRedisClient } from './client';
import { type CacheEntityType, CACHE_ENTITY_TYPES } from './cache-keys';

const logger = createLogger({ service: 'cache-service' });

/**
 * Default TTL values in seconds
 * Requirement 10.1: Configurable TTL for different data types
 */
export const DEFAULT_TTL = {
  /** Very short-lived data (1 minute) - real-time metrics, session data */
  VERY_SHORT: 60,
  /** Short-lived data (5 minutes) - search results, list queries */
  SHORT: 300,
  /** Medium-lived data (15 minutes) - individual asset lookups */
  MEDIUM: 900,
  /** Long-lived data (1 hour) - user permissions, roles */
  LONG: 3600,
  /** Very long-lived data (24 hours) - configuration, reference data */
  VERY_LONG: 86400,
  /** Static data (7 days) - rarely changing reference data */
  STATIC: 604800,
} as const;

/**
 * TTL configuration by entity type
 * Requirement 10.1: Different TTL for different data types
 */
export const ENTITY_TTL: Record<CacheEntityType, number> = {
  // Assets - medium TTL as they change moderately
  [CACHE_ENTITY_TYPES.ASSET]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.HARDWARE_ASSET]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.SOFTWARE_ASSET]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.ENTERPRISE_ASSET]: DEFAULT_TTL.MEDIUM,

  // Software products and entitlements - longer TTL as they change less frequently
  [CACHE_ENTITY_TYPES.SOFTWARE_PRODUCT]: DEFAULT_TTL.LONG,
  [CACHE_ENTITY_TYPES.ENTITLEMENT]: DEFAULT_TTL.LONG,

  // Contracts and vendors - longer TTL
  [CACHE_ENTITY_TYPES.CONTRACT]: DEFAULT_TTL.LONG,
  [CACHE_ENTITY_TYPES.VENDOR]: DEFAULT_TTL.VERY_LONG,

  // Stockroom and inventory - shorter TTL due to frequent changes
  [CACHE_ENTITY_TYPES.STOCKROOM]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.INVENTORY]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.BIN_LOCATION]: DEFAULT_TTL.MEDIUM,

  // Location hierarchy - longer TTL as they rarely change
  [CACHE_ENTITY_TYPES.BUILDING]: DEFAULT_TTL.VERY_LONG,
  [CACHE_ENTITY_TYPES.FLOOR]: DEFAULT_TTL.VERY_LONG,
  [CACHE_ENTITY_TYPES.ROOM]: DEFAULT_TTL.VERY_LONG,
  [CACHE_ENTITY_TYPES.RACK]: DEFAULT_TTL.LONG,

  // User data - longer TTL for permissions/roles
  [CACHE_ENTITY_TYPES.USER]: DEFAULT_TTL.LONG,

  // Reconciliation - short TTL as it's computed data
  [CACHE_ENTITY_TYPES.RECONCILIATION]: DEFAULT_TTL.SHORT,

  // Maintenance and work orders - medium TTL
  [CACHE_ENTITY_TYPES.MAINTENANCE_PLAN]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.WORK_ORDER]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.SPARE_PART]: DEFAULT_TTL.MEDIUM,

  // Linear assets and hierarchy - medium TTL
  [CACHE_ENTITY_TYPES.LINEAR_ASSET]: DEFAULT_TTL.MEDIUM,
  [CACHE_ENTITY_TYPES.ASSET_HIERARCHY]: DEFAULT_TTL.MEDIUM,

  // Reference data - static/very long TTL as it rarely changes
  [CACHE_ENTITY_TYPES.MANUFACTURER]: DEFAULT_TTL.STATIC,
  [CACHE_ENTITY_TYPES.MODEL]: DEFAULT_TTL.STATIC,
  [CACHE_ENTITY_TYPES.COST_CENTER]: DEFAULT_TTL.VERY_LONG,
  [CACHE_ENTITY_TYPES.DEPARTMENT]: DEFAULT_TTL.VERY_LONG,

  // Procurement - medium TTL as POs change during lifecycle
  [CACHE_ENTITY_TYPES.PURCHASE_ORDER]: DEFAULT_TTL.MEDIUM,

  // Configuration - very long TTL
  [CACHE_ENTITY_TYPES.CONFIG]: DEFAULT_TTL.VERY_LONG,
  [CACHE_ENTITY_TYPES.FEATURE_FLAG]: DEFAULT_TTL.LONG,

  // Notifications - short/medium TTL
  [CACHE_ENTITY_TYPES.NOTIFICATION]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.NOTIFICATION_PREFERENCES]: DEFAULT_TTL.MEDIUM,

  // Integration - short/medium TTL
  [CACHE_ENTITY_TYPES.DISCOVERY]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.ERP_SYNC]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.VENDOR_CATALOG]: DEFAULT_TTL.MEDIUM,

  // Reports and dashboards - short TTL for freshness
  [CACHE_ENTITY_TYPES.DASHBOARD]: DEFAULT_TTL.SHORT,
  [CACHE_ENTITY_TYPES.REPORT]: DEFAULT_TTL.SHORT,
};

/**
 * TTL for specific cache patterns
 */
export const PATTERN_TTL = {
  /** Search results - short TTL */
  SEARCH: DEFAULT_TTL.SHORT,
  /** List queries - short TTL */
  LIST: DEFAULT_TTL.SHORT,
  /** Count queries - short TTL */
  COUNT: DEFAULT_TTL.SHORT,
  /** User permissions - long TTL */
  PERMISSIONS: DEFAULT_TTL.LONG,
  /** Configuration data - very long TTL */
  CONFIG: DEFAULT_TTL.VERY_LONG,
  /** Reference data (manufacturers, models) - static TTL */
  REFERENCE: DEFAULT_TTL.STATIC,
} as const;

/**
 * Cache options for get/set operations
 */
export interface CacheOptions {
  /** TTL in seconds (overrides entity-based TTL) */
  readonly ttl?: number;
  /** Skip cache lookup and always fetch from source */
  readonly skipCache?: boolean;
  /** Entity type for automatic TTL selection */
  readonly entityType?: CacheEntityType;
}

/**
 * Options supported by set operation
 */
export interface CacheSetOptions {
  /** TTL in seconds (overrides entity-based TTL) */
  readonly ttl?: number;
  /** Entity type for automatic TTL selection */
  readonly entityType?: CacheEntityType;
}

/**
 * Cache-aside options with fetch function
 */
export interface CacheAsideOptions<T> extends CacheOptions {
  /** Function to fetch data on cache miss */
  readonly fetchFn: () => Promise<T>;
  /** Whether to cache null/undefined results */
  readonly cacheNullResults?: boolean;
  /** Callback on cache hit */
  readonly onHit?: (value: T) => void;
  /** Callback on cache miss */
  readonly onMiss?: () => void;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  errors: number;
  sets: number;
  deletes: number;
  invalidations: number;
}

/**
 * Cache operation result
 */
export interface CacheResult<T> {
  readonly value: T | null;
  readonly hit: boolean;
  readonly ttl?: number;
}

const stats: CacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  deletes: 0,
  invalidations: 0,
};

/**
 * Get TTL for an entity type
 */
export function getTTLForEntityType(entityType: CacheEntityType): number {
  return ENTITY_TTL[entityType] ?? DEFAULT_TTL.MEDIUM;
}

/**
 * Resolve TTL from options
 */
function resolveTTL(options: CacheOptions = {}): number {
  if (options.ttl !== undefined) {
    return options.ttl;
  }
  if (options.entityType) {
    return getTTLForEntityType(options.entityType);
  }
  return DEFAULT_TTL.MEDIUM;
}

/**
 * Get a value from cache
 * Requirement 10.3: Cache-aside pattern - check cache first
 */
export async function get<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const value = await client.get(key);

    if (value === null) {
      stats.misses++;
      logger.debug('Cache miss', { key });
      return null;
    }

    stats.hits++;
    logger.debug('Cache hit', { key });
    return JSON.parse(value) as T;
  } catch (error) {
    stats.errors++;
    logger.error('Cache get error', error as Error, { key });
    return null;
  }
}

/**
 * Get a value from cache with metadata
 */
export async function getWithMeta<T>(key: string): Promise<CacheResult<T>> {
  try {
    const client = getRedisClient();
    const pipeline = client.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);

    const results = await pipeline.exec();
    if (!results) {
      stats.misses++;
      return { value: null, hit: false };
    }

    const [getResult, ttlResult] = results;
    const value = getResult?.[1] as string | null;
    const remainingTtl = ttlResult?.[1] as number;

    if (value === null) {
      stats.misses++;
      logger.debug('Cache miss', { key });
      return { value: null, hit: false };
    }

    stats.hits++;
    logger.debug('Cache hit', { key, ttl: remainingTtl });
    return {
      value: JSON.parse(value) as T,
      hit: true,
      ttl: remainingTtl,
    };
  } catch (error) {
    stats.errors++;
    logger.error('Cache getWithMeta error', error as Error, { key });
    return { value: null, hit: false };
  }
}

/**
 * Set a value in cache
 * Requirement 10.1: Cache with configurable TTL
 */
export async function set<T>(
  key: string,
  value: T,
  ttlOrOptions: number | CacheSetOptions = DEFAULT_TTL.MEDIUM
): Promise<boolean> {
  try {
    const ttlSeconds =
      typeof ttlOrOptions === 'number'
        ? ttlOrOptions
        : resolveTTL({
            ttl: ttlOrOptions.ttl,
            entityType: ttlOrOptions.entityType,
          });
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    await client.setex(key, ttlSeconds, serialized);
    stats.sets++;
    logger.debug('Cache set', { key, ttl: ttlSeconds });
    return true;
  } catch (error) {
    stats.errors++;
    logger.error('Cache set error', error as Error, { key });
    return false;
  }
}

/**
 * Set a value in cache with entity-based TTL
 */
export async function setWithEntityTTL<T>(
  key: string,
  value: T,
  entityType: CacheEntityType
): Promise<boolean> {
  const ttl = getTTLForEntityType(entityType);
  return set(key, value, ttl);
}

/**
 * Delete a value from cache
 * Requirement 10.2: Invalidate cache entries
 */
export async function del(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.del(key);
    stats.deletes++;
    logger.debug('Cache delete', { key });
    return true;
  } catch (error) {
    stats.errors++;
    logger.error('Cache delete error', error as Error, { key });
    return false;
  }
}

/**
 * Delete multiple keys
 */
export async function delMany(keys: readonly string[]): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }

  try {
    const client = getRedisClient();
    const deleted = await client.del(...keys);
    stats.deletes += deleted;
    logger.debug('Cache delete many', { count: deleted });
    return deleted;
  } catch (error) {
    stats.errors++;
    logger.error('Cache delete many error', error as Error);
    return 0;
  }
}

/**
 * Delete multiple keys matching a pattern
 * Requirement 10.2: Invalidate cache entries
 */
export async function delPattern(pattern: string): Promise<number> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    // Remove prefix from keys since del will add it back
    const keysWithoutPrefix = keys.map((k) => k.replace(/^ams:/, ''));
    const deleted = await client.del(...keysWithoutPrefix);
    stats.deletes += deleted;
    stats.invalidations++;
    logger.debug('Cache pattern delete', { pattern, deleted });
    return deleted;
  } catch (error) {
    stats.errors++;
    logger.error('Cache pattern delete error', error as Error, { pattern });
    return 0;
  }
}

/**
 * Backward-compatible alias for deleting keys by pattern.
 * Accepts both prefixed (ams:...) and unprefixed patterns.
 */
export async function deletePattern(pattern: string): Promise<number> {
  const normalizedPattern = pattern.replace(/^ams:/, '');
  return delPattern(normalizedPattern);
}

/**
 * Scan and delete keys matching a pattern (safer for large datasets)
 * Uses SCAN instead of KEYS to avoid blocking Redis
 */
export async function scanAndDelete(pattern: string, batchSize: number = 100): Promise<number> {
  try {
    const client = getRedisClient();
    let cursor = '0';
    let totalDeleted = 0;

    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', batchSize);
      cursor = nextCursor;

      if (keys.length > 0) {
        const keysWithoutPrefix = keys.map((k) => k.replace(/^ams:/, ''));
        const deleted = await client.del(...keysWithoutPrefix);
        totalDeleted += deleted;
      }
    } while (cursor !== '0');

    stats.deletes += totalDeleted;
    stats.invalidations++;
    logger.debug('Cache scan and delete', { pattern, deleted: totalDeleted });
    return totalDeleted;
  } catch (error) {
    stats.errors++;
    logger.error('Cache scan and delete error', error as Error, { pattern });
    return 0;
  }
}

/**
 * Check if a key exists in cache
 */
export async function exists(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    stats.errors++;
    logger.error('Cache exists error', error as Error, { key });
    return false;
  }
}

/**
 * Check if multiple keys exist in cache
 */
export async function existsMany(keys: readonly string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();

  if (keys.length === 0) {
    return result;
  }

  try {
    const client = getRedisClient();
    const pipeline = client.pipeline();

    for (const key of keys) {
      pipeline.exists(key);
    }

    const results = await pipeline.exec();
    if (results) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const exists = results[i]?.[1] === 1;
        if (key !== undefined) {
          result.set(key, exists);
        }
      }
    }

    return result;
  } catch (error) {
    stats.errors++;
    logger.error('Cache existsMany error', error as Error);
    return result;
  }
}

/**
 * Get remaining TTL for a key
 */
export async function ttl(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    stats.errors++;
    logger.error('Cache TTL error', error as Error, { key });
    return -1;
  }
}

/**
 * Refresh TTL for a key without changing its value
 */
export async function touch(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.expire(key, ttlSeconds);
    return result === 1;
  } catch (error) {
    stats.errors++;
    logger.error('Cache touch error', error as Error, { key });
    return false;
  }
}

/**
 * Cache-aside pattern: get from cache or fetch from source
 * Requirement 10.3: Implement cache-aside pattern for database query results
 *
 * This is the primary method for implementing cache-aside pattern:
 * 1. Check cache for existing value
 * 2. If cache hit, return cached value
 * 3. If cache miss, fetch from source (database)
 * 4. Store fetched value in cache
 * 5. Return the value
 */
export async function getOrSet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const ttlSeconds = resolveTTL(options);
  const { skipCache = false } = options;

  // Skip cache if requested
  if (skipCache) {
    logger.debug('Cache skipped', { key });
    return fetchFn();
  }

  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch from source
  const value = await fetchFn();

  // Store in cache (don't await to avoid blocking)
  void set(key, value, ttlSeconds);

  return value;
}

/**
 * Cache-aside pattern with full options
 * Provides callbacks for cache hit/miss and supports caching null results
 */
export async function cacheAside<T>(
  key: string,
  options: CacheAsideOptions<T>
): Promise<T | null> {
  const ttlSeconds = resolveTTL(options);
  const { skipCache = false, fetchFn, cacheNullResults = false, onHit, onMiss } = options;

  // Skip cache if requested
  if (skipCache) {
    logger.debug('Cache skipped', { key });
    return fetchFn();
  }

  // Try to get from cache
  const cached = await get<T>(key);
  if (cached !== null) {
    onHit?.(cached);
    return cached;
  }

  // Cache miss
  onMiss?.();

  // Fetch from source
  const value = await fetchFn();

  // Store in cache if value is not null or if cacheNullResults is true
  if (value !== null || cacheNullResults) {
    void set(key, value, ttlSeconds);
  }

  return value;
}

/**
 * Batch cache-aside pattern for multiple keys
 * Fetches missing keys in a single batch operation
 */
export async function getOrSetMany<T>(
  keys: readonly string[],
  fetchFn: (missingKeys: readonly string[]) => Promise<Map<string, T>>,
  options: CacheOptions = {}
): Promise<Map<string, T>> {
  const ttlSeconds = resolveTTL(options);
  const { skipCache = false } = options;

  if (keys.length === 0) {
    return new Map();
  }

  // Skip cache if requested
  if (skipCache) {
    logger.debug('Cache skipped for batch', { count: keys.length });
    return fetchFn(keys);
  }

  // Try to get all from cache
  const cached = await mget<T>(keys);
  const missingKeys = keys.filter((key) => !cached.has(key));

  // If all keys are cached, return
  if (missingKeys.length === 0) {
    return cached;
  }

  // Fetch missing keys
  const fetched = await fetchFn(missingKeys);

  // Store fetched values in cache
  if (fetched.size > 0) {
    void mset(fetched, ttlSeconds);
  }

  // Merge cached and fetched results
  for (const [key, value] of fetched) {
    cached.set(key, value);
  }

  return cached;
}

/**
 * Invalidate cache for an entity
 * Requirement 10.2: Invalidate corresponding cache entries when data is updated
 */
export async function invalidate(entityType: string, entityId: string): Promise<void> {
  const pattern = `${entityType}:${entityId}*`;
  await delPattern(pattern);
  stats.invalidations++;
  logger.info('Cache invalidated', { entityType, entityId });
}

/**
 * Invalidate all cache entries for an entity type
 */
export async function invalidateAll(entityType: string): Promise<void> {
  const pattern = `${entityType}:*`;
  await delPattern(pattern);
  stats.invalidations++;
  logger.info('Cache invalidated for type', { entityType });
}

/**
 * Invalidate multiple entity keys at once
 */
export async function invalidateMany(
  entries: ReadonlyArray<{ entityType: string; entityId: string }>
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const patterns = entries.map(({ entityType, entityId }) => `${entityType}:${entityId}*`);

  // Use pipeline for efficiency
  const client = getRedisClient();
  const pipeline = client.pipeline();

  for (const pattern of patterns) {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      const keysWithoutPrefix = keys.map((k) => k.replace(/^ams:/, ''));
      pipeline.del(...keysWithoutPrefix);
    }
  }

  await pipeline.exec();
  stats.invalidations += entries.length;
  logger.info('Cache invalidated for multiple entities', { count: entries.length });
}

/**
 * Invalidate related cache entries when an asset is updated
 * This handles cascading invalidation for related data
 */
export async function invalidateAssetRelated(assetId: string): Promise<void> {
  const patterns = [
    `asset:${assetId}*`,
    `hw-asset:${assetId}*`,
    `sw-asset:${assetId}*`,
    `en-asset:${assetId}*`,
    `*:asset:${assetId}*`,
    `asset-hierarchy:*${assetId}*`,
  ];

  for (const pattern of patterns) {
    await delPattern(pattern);
  }

  // Also invalidate list caches as they may contain this asset
  await delPattern('asset:list:*');

  stats.invalidations++;
  logger.info('Asset-related cache invalidated', { assetId });
}

/**
 * Get cache statistics
 */
export function getStats(): CacheStats {
  return { ...stats };
}

/**
 * Reset cache statistics
 */
export function resetStats(): void {
  stats.hits = 0;
  stats.misses = 0;
  stats.errors = 0;
  stats.sets = 0;
  stats.deletes = 0;
  stats.invalidations = 0;
}

/**
 * Calculate cache hit rate
 */
export function getHitRate(): number {
  const total = stats.hits + stats.misses;
  if (total === 0) {
    return 0;
  }
  return stats.hits / total;
}

/**
 * Get detailed cache metrics
 */
export function getMetrics(): {
  stats: CacheStats;
  hitRate: number;
  errorRate: number;
} {
  const total = stats.hits + stats.misses;
  const totalOps = total + stats.sets + stats.deletes;

  return {
    stats: getStats(),
    hitRate: total > 0 ? stats.hits / total : 0,
    errorRate: totalOps > 0 ? stats.errors / totalOps : 0,
  };
}

/**
 * Batch get multiple keys
 */
export async function mget<T>(keys: readonly string[]): Promise<Map<string, T>> {
  if (keys.length === 0) {
    return new Map();
  }

  try {
    const client = getRedisClient();
    const values = await client.mget(...keys);
    const result = new Map<string, T>();

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      if (key !== undefined && value !== null && value !== undefined) {
        result.set(key, JSON.parse(value) as T);
        stats.hits++;
      } else if (key !== undefined) {
        stats.misses++;
      }
    }

    return result;
  } catch (error) {
    stats.errors++;
    logger.error('Cache mget error', error as Error);
    return new Map();
  }
}

/**
 * Batch set multiple key-value pairs
 */
export async function mset<T>(
  entries: ReadonlyMap<string, T>,
  ttlSeconds: number = DEFAULT_TTL.MEDIUM
): Promise<boolean> {
  if (entries.size === 0) {
    return true;
  }

  try {
    const client = getRedisClient();
    const pipeline = client.pipeline();

    for (const [key, value] of entries) {
      pipeline.setex(key, ttlSeconds, JSON.stringify(value));
    }

    await pipeline.exec();
    stats.sets += entries.size;
    logger.debug('Cache mset', { count: entries.size, ttl: ttlSeconds });
    return true;
  } catch (error) {
    stats.errors++;
    logger.error('Cache mset error', error as Error);
    return false;
  }
}

/**
 * Batch set with entity-based TTL
 */
export async function msetWithEntityTTL<T>(
  entries: ReadonlyMap<string, T>,
  entityType: CacheEntityType
): Promise<boolean> {
  const ttl = getTTLForEntityType(entityType);
  return mset(entries, ttl);
}

/**
 * Increment a numeric value in cache
 */
export async function incr(key: string, amount: number = 1): Promise<number> {
  try {
    const client = getRedisClient();
    if (amount === 1) {
      return await client.incr(key);
    }
    return await client.incrby(key, amount);
  } catch (error) {
    stats.errors++;
    logger.error('Cache incr error', error as Error, { key });
    return 0;
  }
}

/**
 * Decrement a numeric value in cache
 */
export async function decr(key: string, amount: number = 1): Promise<number> {
  try {
    const client = getRedisClient();
    if (amount === 1) {
      return await client.decr(key);
    }
    return await client.decrby(key, amount);
  } catch (error) {
    stats.errors++;
    logger.error('Cache decr error', error as Error, { key });
    return 0;
  }
}

/**
 * Set a value only if the key does not exist (for distributed locking)
 */
export async function setNX<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_TTL.SHORT
): Promise<boolean> {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);
    const result = await client.set(key, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    stats.errors++;
    logger.error('Cache setNX error', error as Error, { key });
    return false;
  }
}

/**
 * Acquire a distributed lock
 */
export async function acquireLock(
  lockKey: string,
  lockValue: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  return setNX(lockKey, lockValue, ttlSeconds);
}

/**
 * Release a distributed lock (only if we own it)
 */
export async function releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await client.eval(script, 1, lockKey, lockValue);
    return result === 1;
  } catch (error) {
    stats.errors++;
    logger.error('Cache releaseLock error', error as Error, { lockKey });
    return false;
  }
}

/**
 * Execute a function with a distributed lock
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  options: { ttlSeconds?: number; retryCount?: number; retryDelayMs?: number } = {}
): Promise<T | null> {
  const { ttlSeconds = 30, retryCount = 3, retryDelayMs = 100 } = options;
  const lockValue = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

  // Try to acquire lock with retries
  let acquired = false;
  for (let i = 0; i < retryCount; i++) {
    acquired = await acquireLock(lockKey, lockValue, ttlSeconds);
    if (acquired) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (i + 1)));
  }

  if (!acquired) {
    logger.warn('Failed to acquire lock', { lockKey, retryCount });
    return null;
  }

  try {
    return await fn();
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}
