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

import type { DomainEvent, EventType, UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import {
  CACHE_ENTITY_TYPES,
  type CacheEntityType,
  entityKey,
  listPattern,
  searchPattern,
} from './cache-keys';
import {
  acquireLock,
  del,
  delPattern,
  get,
  getWithMeta,
  releaseLock,
  scanAndDelete,
  set,
  ENTITY_TTL,
  DEFAULT_TTL,
} from './cache-service';

const logger = createLogger({ service: 'cache-invalidation' });

// ============================================================================
// Types and Interfaces
// ============================================================================

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

// ============================================================================
// Synchronous Write-Through Invalidation
// ============================================================================

/**
 * Perform a database write with synchronous cache invalidation
 *
 * This ensures cache is invalidated BEFORE the write completes,
 * preventing stale data from being served.
 *
 * Validates: Requirements 10.2 - Synchronous invalidation with writes
 */
export async function writeWithInvalidation<T>(
  options: WriteThroughOptions<T>
): Promise<T> {
  const {
    entityType,
    entityId,
    writeFn,
    updateCache = false,
    ttl,
    additionalPatterns = [],
  } = options;

  const cacheKey = entityKey(entityType, entityId);

  logger.debug('Starting write-through invalidation', {
    entityType,
    entityId,
    updateCache,
  });

  // Step 1: Invalidate cache BEFORE write to prevent stale reads
  await invalidateEntityCache(entityType, entityId, {
    invalidateRelated: true,
    additionalPatterns: additionalPatterns as string[],
  });

  // Step 2: Perform the database write
  const result = await writeFn();

  // Step 3: Optionally update cache with new value
  if (updateCache && result !== null && result !== undefined) {
    const cacheTtl = ttl ?? ENTITY_TTL[entityType] ?? DEFAULT_TTL.MEDIUM;
    await set(cacheKey, result, cacheTtl);
    logger.debug('Cache updated after write', { entityType, entityId, ttl: cacheTtl });
  }

  logger.info('Write-through invalidation completed', {
    entityType,
    entityId,
    cacheUpdated: updateCache,
  });

  return result;
}

/**
 * Invalidate cache for a specific entity
 */
export async function invalidateEntityCache(
  entityType: CacheEntityType,
  entityId: UUID,
  options: InvalidationOptions = {}
): Promise<number> {
  const { invalidateRelated = true, additionalPatterns = [] } = options;

  let totalDeleted = 0;

  // Primary entity key
  const primaryKey = entityKey(entityType, entityId);
  const deleted = await del(primaryKey);
  if (deleted) {
    totalDeleted++;
  }

  // Entity-specific patterns
  const entityPattern = `${entityType}:${entityId}*`;
  totalDeleted += await delPattern(entityPattern);

  // Related patterns (lists, searches, counts)
  if (invalidateRelated) {
    // Invalidate list caches for this entity type
    totalDeleted += await delPattern(listPattern(entityType));

    // Invalidate search caches for this entity type
    totalDeleted += await delPattern(searchPattern(entityType));

    // Invalidate count caches
    totalDeleted += await delPattern(`${entityType}:count:*`);
  }

  // Additional custom patterns
  for (const pattern of additionalPatterns) {
    totalDeleted += await delPattern(pattern);
  }

  logger.debug('Entity cache invalidated', {
    entityType,
    entityId,
    totalDeleted,
    invalidateRelated,
  });

  return totalDeleted;
}

/**
 * Batch invalidate multiple entities
 */
export async function invalidateMultipleEntities(
  entities: readonly { entityType: CacheEntityType; entityId: UUID }[],
  options: InvalidationOptions = {}
): Promise<number> {
  let totalDeleted = 0;

  // Group by entity type for efficient pattern invalidation
  const byType = new Map<CacheEntityType, UUID[]>();
  for (const { entityType, entityId } of entities) {
    const ids = byType.get(entityType) ?? [];
    ids.push(entityId);
    byType.set(entityType, ids);
  }

  // Invalidate each entity
  for (const { entityType, entityId } of entities) {
    totalDeleted += await invalidateEntityCache(entityType, entityId, {
      ...options,
      // Only invalidate related once per entity type
      invalidateRelated: false,
    });
  }

  // Invalidate related patterns once per entity type
  if (options.invalidateRelated !== false) {
    for (const entityType of byType.keys()) {
      totalDeleted += await delPattern(listPattern(entityType));
      totalDeleted += await delPattern(searchPattern(entityType));
      totalDeleted += await delPattern(`${entityType}:count:*`);
    }
  }

  logger.info('Batch entity cache invalidation completed', {
    entityCount: entities.length,
    totalDeleted,
  });

  return totalDeleted;
}

// ============================================================================
// Cache Stampede Prevention
// ============================================================================

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
export function shouldRefreshEarly(
  remainingTtl: number,
  originalTtl: number,
  beta: number = 1.0
): boolean {
  if (remainingTtl <= 0) {
    return true; // Expired, must refresh
  }

  // Don't refresh if plenty of TTL remaining (more than 50%)
  if (remainingTtl > originalTtl * 0.5) {
    return false;
  }

  // Calculate delta (time since value was computed)
  const delta = originalTtl - remainingTtl;

  // Probabilistic early expiration using exponential distribution
  // Higher delta and lower remaining TTL = higher probability of refresh
  const probability = Math.exp(-delta * beta / Math.max(remainingTtl, 1));

  // Random check against probability
  const shouldRefresh = Math.random() > probability;

  if (shouldRefresh) {
    logger.debug('Early refresh triggered', {
      remainingTtl,
      originalTtl,
      delta,
      probability,
    });
  }

  return shouldRefresh;
}

/**
 * Get value from cache with stampede prevention
 *
 * Implements probabilistic early expiration to prevent cache stampedes
 * when multiple requests hit an expiring cache entry simultaneously.
 *
 * Validates: Requirements 10.2 - Cache stampede prevention
 */
export async function getWithStampedePrevention<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: StampedePreventionOptions
): Promise<StampedeProtectedResult<T>> {
  const {
    ttl,
    beta = 1.0,
    minTtlForEarlyRefresh = 60,
    lockTimeout = 10,
  } = options;

  // Try to get from cache with metadata
  const cacheResult = await getWithMeta<T>(key);

  // Cache miss - fetch and cache
  if (!cacheResult.hit || cacheResult.value === null) {
    const value = await fetchWithLock(key, fetchFn, ttl, lockTimeout);
    return {
      value,
      fromCache: false,
      earlyRefresh: false,
    };
  }

  const remainingTtl = cacheResult.ttl ?? 0;

  // Check if we should trigger early refresh
  if (
    remainingTtl > 0 &&
    remainingTtl < minTtlForEarlyRefresh &&
    shouldRefreshEarly(remainingTtl, ttl, beta)
  ) {
    // Trigger async refresh while returning cached value
    void refreshInBackground(key, fetchFn, ttl, lockTimeout);

    return {
      value: cacheResult.value,
      fromCache: true,
      earlyRefresh: true,
      remainingTtl,
    };
  }

  return {
    value: cacheResult.value,
    fromCache: true,
    earlyRefresh: false,
    remainingTtl,
  };
}

/**
 * Fetch value with distributed lock to prevent thundering herd
 */
async function fetchWithLock<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  lockTimeout: number
): Promise<T> {
  const lockKey = `lock:refresh:${key}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

  // Try to acquire lock
  const acquired = await acquireLock(lockKey, lockValue, lockTimeout);

  if (!acquired) {
    // Another process is refreshing, wait and retry from cache
    logger.debug('Lock not acquired, waiting for refresh', { key });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Try cache again
    const cached = await get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Still no cache, wait a bit more and try once more
    await new Promise((resolve) => setTimeout(resolve, 200));
    const retryCache = await get<T>(key);
    if (retryCache !== null) {
      return retryCache;
    }

    // Give up waiting, fetch ourselves
    logger.warn('Lock wait timeout, fetching anyway', { key });
  }

  try {
    // Fetch the value
    const value = await fetchFn();

    // Cache the result
    await set(key, value, ttl);

    return value;
  } finally {
    // Release lock if we acquired it
    if (acquired) {
      await releaseLock(lockKey, lockValue);
    }
  }
}

/**
 * Refresh cache in background without blocking
 */
async function refreshInBackground<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  lockTimeout: number
): Promise<void> {
  const lockKey = `lock:refresh:${key}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

  // Try to acquire lock (non-blocking)
  const acquired = await acquireLock(lockKey, lockValue, lockTimeout);

  if (!acquired) {
    // Another process is already refreshing
    logger.debug('Background refresh skipped, lock held by another process', { key });
    return;
  }

  try {
    logger.debug('Starting background refresh', { key });
    const value = await fetchFn();
    await set(key, value, ttl);
    logger.debug('Background refresh completed', { key });
  } catch (error) {
    logger.error('Background refresh failed', error as Error, { key });
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}

// ============================================================================
// Event-Driven Invalidation
// ============================================================================

/**
 * Event type to entity invalidation mapping
 */
const EVENT_INVALIDATION_MAP: Partial<Record<EventType, EntityInvalidationMapping>> = {
  // Asset events
  ASSET_CREATED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  ASSET_UPDATED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    relatedEntities: [
      CACHE_ENTITY_TYPES.HARDWARE_ASSET,
      CACHE_ENTITY_TYPES.SOFTWARE_ASSET,
      CACHE_ENTITY_TYPES.ENTERPRISE_ASSET,
    ],
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  ASSET_DELETED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    relatedEntities: [
      CACHE_ENTITY_TYPES.HARDWARE_ASSET,
      CACHE_ENTITY_TYPES.SOFTWARE_ASSET,
      CACHE_ENTITY_TYPES.ENTERPRISE_ASSET,
      CACHE_ENTITY_TYPES.ASSET_HIERARCHY,
    ],
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  ASSET_STATE_CHANGED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  ASSET_ASSIGNED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    relatedEntities: [CACHE_ENTITY_TYPES.USER],
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['assignedTo']) ids.push(payload['assignedTo'] as UUID);
      if (payload['previousAssignee']) ids.push(payload['previousAssignee'] as UUID);
      return ids;
    },
  },
  ASSET_DEPLOYED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  ASSET_RETIRED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },

  // SAM events
  RECONCILIATION_COMPLETED: {
    primaryEntity: CACHE_ENTITY_TYPES.RECONCILIATION,
    relatedEntities: [CACHE_ENTITY_TYPES.SOFTWARE_PRODUCT, CACHE_ENTITY_TYPES.ENTITLEMENT],
    extractEntityId: (payload) => payload['productId'] as UUID | undefined,
  },

  // HAM events
  TRANSFER_ORDER_COMPLETED: {
    primaryEntity: CACHE_ENTITY_TYPES.STOCKROOM,
    relatedEntities: [CACHE_ENTITY_TYPES.INVENTORY, CACHE_ENTITY_TYPES.ASSET],
    extractEntityId: (payload) => payload['fromStockroomId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['toStockroomId']) ids.push(payload['toStockroomId'] as UUID);
      return ids;
    },
  },
  STOCK_LEVEL_ALERT: {
    primaryEntity: CACHE_ENTITY_TYPES.INVENTORY,
    relatedEntities: [CACHE_ENTITY_TYPES.STOCKROOM],
    extractEntityId: (payload) => payload['stockroomId'] as UUID | undefined,
  },
  LOANER_CHECKOUT: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  LOANER_RETURNED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },
  DISPOSAL_COMPLETED: {
    primaryEntity: CACHE_ENTITY_TYPES.ASSET,
    extractEntityId: (payload) => payload['assetId'] as UUID | undefined,
  },

  // EAM events
  WORK_ORDER_CREATED: {
    primaryEntity: CACHE_ENTITY_TYPES.WORK_ORDER,
    relatedEntities: [CACHE_ENTITY_TYPES.ASSET, CACHE_ENTITY_TYPES.MAINTENANCE_PLAN],
    extractEntityId: (payload) => payload['workOrderId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['assetId']) ids.push(payload['assetId'] as UUID);
      return ids;
    },
  },
  WORK_ORDER_COMPLETED: {
    primaryEntity: CACHE_ENTITY_TYPES.WORK_ORDER,
    relatedEntities: [CACHE_ENTITY_TYPES.ASSET, CACHE_ENTITY_TYPES.SPARE_PART],
    extractEntityId: (payload) => payload['workOrderId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['assetId']) ids.push(payload['assetId'] as UUID);
      return ids;
    },
  },
  MAINTENANCE_DUE: {
    primaryEntity: CACHE_ENTITY_TYPES.MAINTENANCE_PLAN,
    relatedEntities: [CACHE_ENTITY_TYPES.ASSET],
    extractEntityId: (payload) => payload['maintenancePlanId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['assetId']) ids.push(payload['assetId'] as UUID);
      return ids;
    },
  },

  // Contract events
  CONTRACT_EXPIRING: {
    primaryEntity: CACHE_ENTITY_TYPES.CONTRACT,
    relatedEntities: [CACHE_ENTITY_TYPES.VENDOR],
    extractEntityId: (payload) => payload['contractId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['vendorId']) ids.push(payload['vendorId'] as UUID);
      return ids;
    },
  },
  CONTRACT_RENEWED: {
    primaryEntity: CACHE_ENTITY_TYPES.CONTRACT,
    relatedEntities: [CACHE_ENTITY_TYPES.VENDOR],
    extractEntityId: (payload) => payload['contractId'] as UUID | undefined,
    extractRelatedIds: (payload) => {
      const ids: UUID[] = [];
      if (payload['vendorId']) ids.push(payload['vendorId'] as UUID);
      return ids;
    },
  },
};

/**
 * Handle cache invalidation for a domain event
 *
 * This function is called by event consumers to invalidate cache
 * entries when domain events are received.
 */
export async function handleEventInvalidation(event: DomainEvent): Promise<number> {
  const mapping = EVENT_INVALIDATION_MAP[event.eventType];

  if (!mapping) {
    logger.debug('No invalidation mapping for event type', { eventType: event.eventType });
    return 0;
  }

  const payload = event.payload as Record<string, unknown>;
  const primaryEntityId = mapping.extractEntityId(payload);

  if (!primaryEntityId) {
    logger.warn('Could not extract entity ID from event', {
      eventType: event.eventType,
      eventId: event.eventId,
    });
    return 0;
  }

  let totalDeleted = 0;

  // Invalidate primary entity
  totalDeleted += await invalidateEntityCache(mapping.primaryEntity, primaryEntityId, {
    invalidateRelated: true,
  });

  // Invalidate related entities
  if (mapping.relatedEntities) {
    for (const relatedType of mapping.relatedEntities) {
      // Invalidate list/search caches for related types
      totalDeleted += await delPattern(listPattern(relatedType));
      totalDeleted += await delPattern(searchPattern(relatedType));
    }
  }

  // Invalidate specific related entity IDs
  if (mapping.extractRelatedIds) {
    const relatedIds = mapping.extractRelatedIds(payload);
    for (const relatedId of relatedIds) {
      // Find the appropriate entity type for this ID
      // For now, invalidate across common types
      for (const entityType of [
        CACHE_ENTITY_TYPES.ASSET,
        CACHE_ENTITY_TYPES.USER,
        CACHE_ENTITY_TYPES.STOCKROOM,
        CACHE_ENTITY_TYPES.VENDOR,
      ]) {
        totalDeleted += await invalidateEntityCache(entityType, relatedId, {
          invalidateRelated: false,
        });
      }
    }
  }

  logger.info('Event-driven cache invalidation completed', {
    eventType: event.eventType,
    eventId: event.eventId,
    primaryEntity: mapping.primaryEntity,
    primaryEntityId,
    totalDeleted,
  });

  return totalDeleted;
}

/**
 * Create an event handler middleware for cache invalidation
 *
 * This can be used with the EventRouter to automatically invalidate
 * cache when events are processed.
 */
export function createCacheInvalidationMiddleware() {
  return async (
    message: { event: DomainEvent },
    next: () => Promise<void>
  ): Promise<void> => {
    // Invalidate cache before processing
    await handleEventInvalidation(message.event);

    // Continue to next handler
    await next();
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Invalidate all caches for a specific asset and its related data
 *
 * This is a comprehensive invalidation that clears all cache entries
 * that might contain data about a specific asset.
 */
export async function invalidateAssetComprehensive(assetId: UUID): Promise<number> {
  let totalDeleted = 0;

  // Asset-specific patterns
  const patterns = [
    `asset:${assetId}*`,
    `hw-asset:${assetId}*`,
    `sw-asset:${assetId}*`,
    `en-asset:${assetId}*`,
    `*:asset:${assetId}*`,
    `asset-hierarchy:*${assetId}*`,
    `loaner:asset:${assetId}*`,
    `work-order:asset:${assetId}*`,
    `maint-plan:asset:${assetId}*`,
    `contract:asset:${assetId}*`,
  ];

  for (const pattern of patterns) {
    totalDeleted += await scanAndDelete(pattern);
  }

  // Invalidate list caches
  totalDeleted += await delPattern('asset:list:*');
  totalDeleted += await delPattern('hw-asset:list:*');
  totalDeleted += await delPattern('sw-asset:list:*');
  totalDeleted += await delPattern('en-asset:list:*');

  // Invalidate search caches
  totalDeleted += await delPattern('search:asset:*');
  totalDeleted += await delPattern('search:hw-asset:*');
  totalDeleted += await delPattern('search:sw-asset:*');
  totalDeleted += await delPattern('search:en-asset:*');

  logger.info('Comprehensive asset cache invalidation completed', {
    assetId,
    totalDeleted,
  });

  return totalDeleted;
}

/**
 * Invalidate all caches for a user and their related data
 */
export async function invalidateUserComprehensive(userId: UUID): Promise<number> {
  let totalDeleted = 0;

  const patterns = [
    `user:${userId}*`,
    `user:permissions:${userId}*`,
    `user:roles:${userId}*`,
    `user:profile:${userId}*`,
    `asset:assigned:${userId}*`,
    `loaner:user:${userId}*`,
    `work-order:assignee:${userId}*`,
  ];

  for (const pattern of patterns) {
    totalDeleted += await scanAndDelete(pattern);
  }

  logger.info('Comprehensive user cache invalidation completed', {
    userId,
    totalDeleted,
  });

  return totalDeleted;
}

/**
 * Invalidate all caches for a stockroom and its inventory
 */
export async function invalidateStockroomComprehensive(stockroomId: UUID): Promise<number> {
  let totalDeleted = 0;

  const patterns = [
    `stockroom:${stockroomId}*`,
    `inventory:stockroom:${stockroomId}*`,
    `asset:stockroom:${stockroomId}*`,
  ];

  for (const pattern of patterns) {
    totalDeleted += await scanAndDelete(pattern);
  }

  // Invalidate list caches
  totalDeleted += await delPattern('stockroom:list:*');
  totalDeleted += await delPattern('inventory:list:*');

  logger.info('Comprehensive stockroom cache invalidation completed', {
    stockroomId,
    totalDeleted,
  });

  return totalDeleted;
}

/**
 * Clear all caches (use with caution!)
 *
 * This should only be used in emergency situations or during
 * major data migrations.
 */
export async function clearAllCaches(): Promise<number> {
  logger.warn('Clearing all caches - this is a destructive operation');

  const totalDeleted = await scanAndDelete('*');

  logger.warn('All caches cleared', { totalDeleted });

  return totalDeleted;
}
