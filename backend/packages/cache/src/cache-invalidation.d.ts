/**
 * Cache Invalidation Service
 *
 * Implements synchronous cache invalidation with writes and cache stampede prevention.
 *
 * Requirements:
 * - 10.2: WHEN asset data is updated, THE Cache_Layer SHALL invalidate corresponding cache entries
 *
 * Features:
 * - Synchronous invalidation with database writes
 * - Cache stampede prevention via probabilistic early expiration
 * - Distributed locking for cache refresh operations
 * - Event-driven invalidation handlers
 */
import type { DomainEvent, UUID } from '@ams/types';
import { type CacheEntityType } from './cache-keys';
/**
 * Invalidation strategy options
 */
export interface InvalidationOptions {
    /** Whether to invalidate related entities (e.g., lists, searches) */
    readonly invalidateRelated?: boolean;
    /** Whether to use async invalidation (fire-and-forget) */
    readonly async?: boolean;
    /** Custom patterns to invalidate */
    readonly additionalPatterns?: readonly string[];
}
/**
 * Write-through invalidation options
 */
export interface WriteThroughOptions<T> {
    /** Entity type for cache key generation */
    readonly entityType: CacheEntityType;
    /** Entity ID */
    readonly entityId: UUID;
    /** Function to perform the database write */
    readonly writeFn: () => Promise<T>;
    /** Whether to update cache with new value after write */
    readonly updateCache?: boolean;
    /** Custom TTL for cache update */
    readonly ttl?: number;
    /** Additional patterns to invalidate */
    readonly additionalPatterns?: readonly string[];
}
/**
 * Cache stampede prevention options
 */
export interface StampedePreventionOptions {
    /** Base TTL in seconds */
    readonly ttl: number;
    /** Beta factor for probabilistic early expiration (default: 1.0) */
    readonly beta?: number;
    /** Minimum remaining TTL before early refresh is considered */
    readonly minTtlForEarlyRefresh?: number;
    /** Lock timeout in seconds for refresh operations */
    readonly lockTimeout?: number;
}
/**
 * Result of a cache operation with stampede prevention
 */
export interface StampedeProtectedResult<T> {
    /** The cached or fetched value */
    readonly value: T | null;
    /** Whether the value came from cache */
    readonly fromCache: boolean;
    /** Whether an early refresh was triggered */
    readonly earlyRefresh: boolean;
    /** Remaining TTL if from cache */
    readonly remainingTtl?: number;
}
/**
 * Entity invalidation mapping - maps event types to affected entity types
 */
export interface EntityInvalidationMapping {
    /** Primary entity type to invalidate */
    readonly primaryEntity: CacheEntityType;
    /** Related entity types to invalidate */
    readonly relatedEntities?: readonly CacheEntityType[];
    /** Function to extract entity ID from event payload */
    readonly extractEntityId: (payload: Record<string, unknown>) => UUID | undefined;
    /** Additional entity IDs to extract (for related entities) */
    readonly extractRelatedIds?: (payload: Record<string, unknown>) => readonly UUID[];
}
/**
 * Perform a database write with synchronous cache invalidation
 *
 * This ensures cache is invalidated BEFORE the write completes,
 * preventing stale data from being served.
 *
 * Validates: Requirements 10.2 - Synchronous invalidation with writes
 */
export declare function writeWithInvalidation<T>(options: WriteThroughOptions<T>): Promise<T>;
/**
 * Invalidate cache for a specific entity
 */
export declare function invalidateEntityCache(entityType: CacheEntityType, entityId: UUID, options?: InvalidationOptions): Promise<number>;
/**
 * Batch invalidate multiple entities
 */
export declare function invalidateMultipleEntities(entities: readonly {
    entityType: CacheEntityType;
    entityId: UUID;
}[], options?: InvalidationOptions): Promise<number>;
/**
 * Calculate probabilistic early expiration
 *
 * Uses the XFetch algorithm to probabilistically refresh cache entries
 * before they expire, preventing cache stampedes.
 *
 * The probability of early refresh increases as TTL decreases:
 * P(refresh) = exp(-delta * beta / ttl)
 *
 * Where:
 * - delta: time since value was computed (approximated as original TTL - remaining TTL)
 * - beta: scaling factor (default 1.0)
 * - ttl: remaining TTL
 */
export declare function shouldRefreshEarly(remainingTtl: number, originalTtl: number, beta?: number): boolean;
/**
 * Get value from cache with stampede prevention
 *
 * Implements probabilistic early expiration to prevent cache stampedes
 * when multiple requests hit an expiring cache entry simultaneously.
 *
 * Validates: Requirements 10.2 - Cache stampede prevention
 */
export declare function getWithStampedePrevention<T>(key: string, fetchFn: () => Promise<T>, options: StampedePreventionOptions): Promise<StampedeProtectedResult<T>>;
/**
 * Handle cache invalidation for a domain event
 *
 * This function is called by event consumers to invalidate cache
 * entries when domain events are received.
 */
export declare function handleEventInvalidation(event: DomainEvent): Promise<number>;
/**
 * Create an event handler middleware for cache invalidation
 *
 * This can be used with the EventRouter to automatically invalidate
 * cache when events are processed.
 */
export declare function createCacheInvalidationMiddleware(): (message: {
    event: DomainEvent;
}, next: () => Promise<void>) => Promise<void>;
/**
 * Invalidate all caches for a specific asset and its related data
 *
 * This is a comprehensive invalidation that clears all cache entries
 * that might contain data about a specific asset.
 */
export declare function invalidateAssetComprehensive(assetId: UUID): Promise<number>;
/**
 * Invalidate all caches for a user and their related data
 */
export declare function invalidateUserComprehensive(userId: UUID): Promise<number>;
/**
 * Invalidate all caches for a stockroom and its inventory
 */
export declare function invalidateStockroomComprehensive(stockroomId: UUID): Promise<number>;
/**
 * Clear all caches (use with caution!)
 *
 * This should only be used in emergency situations or during
 * major data migrations.
 */
export declare function clearAllCaches(): Promise<number>;
//# sourceMappingURL=cache-invalidation.d.ts.map