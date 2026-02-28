/**
 * Cache service implementing cache-aside pattern
 *
 * Implements Requirements:
 * - 10.1: Cache frequently accessed asset data with configurable TTL
 * - 10.3: Cache-aside pattern for database query results
 */
import { type CacheEntityType } from './cache-keys';
/**
 * Default TTL values in seconds
 * Requirement 10.1: Configurable TTL for different data types
 */
export declare const DEFAULT_TTL: {
    /** Very short-lived data (1 minute) - real-time metrics, session data */
    readonly VERY_SHORT: 60;
    /** Short-lived data (5 minutes) - search results, list queries */
    readonly SHORT: 300;
    /** Medium-lived data (15 minutes) - individual asset lookups */
    readonly MEDIUM: 900;
    /** Long-lived data (1 hour) - user permissions, roles */
    readonly LONG: 3600;
    /** Very long-lived data (24 hours) - configuration, reference data */
    readonly VERY_LONG: 86400;
    /** Static data (7 days) - rarely changing reference data */
    readonly STATIC: 604800;
};
/**
 * TTL configuration by entity type
 * Requirement 10.1: Different TTL for different data types
 */
export declare const ENTITY_TTL: Record<CacheEntityType, number>;
/**
 * TTL for specific cache patterns
 */
export declare const PATTERN_TTL: {
    /** Search results - short TTL */
    readonly SEARCH: 300;
    /** List queries - short TTL */
    readonly LIST: 300;
    /** Count queries - short TTL */
    readonly COUNT: 300;
    /** User permissions - long TTL */
    readonly PERMISSIONS: 3600;
    /** Configuration data - very long TTL */
    readonly CONFIG: 86400;
    /** Reference data (manufacturers, models) - static TTL */
    readonly REFERENCE: 604800;
};
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
/**
 * Get TTL for an entity type
 */
export declare function getTTLForEntityType(entityType: CacheEntityType): number;
/**
 * Get a value from cache
 * Requirement 10.3: Cache-aside pattern - check cache first
 */
export declare function get<T>(key: string): Promise<T | null>;
/**
 * Get a value from cache with metadata
 */
export declare function getWithMeta<T>(key: string): Promise<CacheResult<T>>;
/**
 * Set a value in cache
 * Requirement 10.1: Cache with configurable TTL
 */
export declare function set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
/**
 * Set a value in cache with entity-based TTL
 */
export declare function setWithEntityTTL<T>(key: string, value: T, entityType: CacheEntityType): Promise<boolean>;
/**
 * Delete a value from cache
 * Requirement 10.2: Invalidate cache entries
 */
export declare function del(key: string): Promise<boolean>;
/**
 * Delete multiple keys
 */
export declare function delMany(keys: readonly string[]): Promise<number>;
/**
 * Delete multiple keys matching a pattern
 * Requirement 10.2: Invalidate cache entries
 */
export declare function delPattern(pattern: string): Promise<number>;
/**
 * Scan and delete keys matching a pattern (safer for large datasets)
 * Uses SCAN instead of KEYS to avoid blocking Redis
 */
export declare function scanAndDelete(pattern: string, batchSize?: number): Promise<number>;
/**
 * Check if a key exists in cache
 */
export declare function exists(key: string): Promise<boolean>;
/**
 * Check if multiple keys exist in cache
 */
export declare function existsMany(keys: readonly string[]): Promise<Map<string, boolean>>;
/**
 * Get remaining TTL for a key
 */
export declare function ttl(key: string): Promise<number>;
/**
 * Refresh TTL for a key without changing its value
 */
export declare function touch(key: string, ttlSeconds: number): Promise<boolean>;
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
export declare function getOrSet<T>(key: string, fetchFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
/**
 * Cache-aside pattern with full options
 * Provides callbacks for cache hit/miss and supports caching null results
 */
export declare function cacheAside<T>(key: string, options: CacheAsideOptions<T>): Promise<T | null>;
/**
 * Batch cache-aside pattern for multiple keys
 * Fetches missing keys in a single batch operation
 */
export declare function getOrSetMany<T>(keys: readonly string[], fetchFn: (missingKeys: readonly string[]) => Promise<Map<string, T>>, options?: CacheOptions): Promise<Map<string, T>>;
/**
 * Invalidate cache for an entity
 * Requirement 10.2: Invalidate corresponding cache entries when data is updated
 */
export declare function invalidate(entityType: string, entityId: string): Promise<void>;
/**
 * Invalidate all cache entries for an entity type
 */
export declare function invalidateAll(entityType: string): Promise<void>;
/**
 * Invalidate multiple entity keys at once
 */
export declare function invalidateMany(entries: ReadonlyArray<{
    entityType: string;
    entityId: string;
}>): Promise<void>;
/**
 * Invalidate related cache entries when an asset is updated
 * This handles cascading invalidation for related data
 */
export declare function invalidateAssetRelated(assetId: string): Promise<void>;
/**
 * Get cache statistics
 */
export declare function getStats(): CacheStats;
/**
 * Reset cache statistics
 */
export declare function resetStats(): void;
/**
 * Calculate cache hit rate
 */
export declare function getHitRate(): number;
/**
 * Get detailed cache metrics
 */
export declare function getMetrics(): {
    stats: CacheStats;
    hitRate: number;
    errorRate: number;
};
/**
 * Batch get multiple keys
 */
export declare function mget<T>(keys: readonly string[]): Promise<Map<string, T>>;
/**
 * Batch set multiple key-value pairs
 */
export declare function mset<T>(entries: ReadonlyMap<string, T>, ttlSeconds?: number): Promise<boolean>;
/**
 * Batch set with entity-based TTL
 */
export declare function msetWithEntityTTL<T>(entries: ReadonlyMap<string, T>, entityType: CacheEntityType): Promise<boolean>;
/**
 * Increment a numeric value in cache
 */
export declare function incr(key: string, amount?: number): Promise<number>;
/**
 * Decrement a numeric value in cache
 */
export declare function decr(key: string, amount?: number): Promise<number>;
/**
 * Set a value only if the key does not exist (for distributed locking)
 */
export declare function setNX<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean>;
/**
 * Acquire a distributed lock
 */
export declare function acquireLock(lockKey: string, lockValue: string, ttlSeconds?: number): Promise<boolean>;
/**
 * Release a distributed lock (only if we own it)
 */
export declare function releaseLock(lockKey: string, lockValue: string): Promise<boolean>;
/**
 * Execute a function with a distributed lock
 */
export declare function withLock<T>(lockKey: string, fn: () => Promise<T>, options?: {
    ttlSeconds?: number;
    retryCount?: number;
    retryDelayMs?: number;
}): Promise<T | null>;
//# sourceMappingURL=cache-service.d.ts.map