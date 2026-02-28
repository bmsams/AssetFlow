/**
 * Asset Hierarchy Service - Business logic layer for asset parent-child relationships
 *
 * Implements:
 * - Parent-child relationship management (Requirement 5.6)
 * - Hierarchy traversal (ancestors, descendants, full tree)
 * - Status propagation to child components (Requirement 5.7)
 * - Circular reference prevention
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  AssetStatus,
  EnterpriseAssetHierarchy,
  HierarchyNode,
  LinkParentChildRequest,
  StatusPropagationResult,
} from './asset-hierarchy-repository';
import * as repository from './asset-hierarchy-repository';

const logger = createLogger({ service: 'asset-hierarchy-service' });

/**
 * Cache key for enterprise asset hierarchy
 */
function assetHierarchyCacheKey(assetId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.ENTERPRISE_ASSET, assetId);
}

/**
 * Cache key for asset children
 */
function childrenCacheKey(assetId: UUID): string {
  return `asset:${assetId}:children`;
}

/**
 * Cache key for asset ancestors
 */
function ancestorsCacheKey(assetId: UUID): string {
  return `asset:${assetId}:ancestors`;
}

/**
 * Cache key for asset descendants
 */
function descendantsCacheKey(assetId: UUID): string {
  return `asset:${assetId}:descendants`;
}

/**
 * Hierarchy type for getHierarchy operation
 */
export type HierarchyType = 'ancestors' | 'descendants' | 'full';

/**
 * Hierarchy result with metadata
 */
export interface HierarchyResult {
  readonly rootAsset: EnterpriseAssetHierarchy | null;
  readonly nodes: readonly HierarchyNode[];
  readonly totalNodes: number;
  readonly maxDepth: number;
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

/**
 * Get enterprise asset by ID with hierarchy info
 */
export async function getEnterpriseAsset(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  const cacheKey = assetHierarchyCacheKey(assetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getEnterpriseAssetById(assetId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get parent asset of a given asset
 */
export async function getParentAsset(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  return repository.getParentAsset(assetId);
}

/**
 * Get direct children of an asset
 */
export async function getChildAssets(parentAssetId: UUID): Promise<EnterpriseAssetHierarchy[]> {
  const cacheKey = childrenCacheKey(parentAssetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getChildAssets(parentAssetId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get hierarchy based on type
 * Requirement 5.6: Support parent-child relationships for complex equipment with sub-components
 */
export async function getHierarchy(
  assetId: UUID,
  type: HierarchyType,
  maxDepth?: number
): Promise<HierarchyResult> {
  logger.info('Getting hierarchy', { assetId, type, maxDepth });

  const depth = maxDepth ?? repository.MAX_HIERARCHY_DEPTH;
  let nodes: HierarchyNode[];
  let rootAsset: EnterpriseAssetHierarchy | null = null;

  switch (type) {
    case 'ancestors':
      nodes = await repository.getAncestors(assetId, depth);
      break;

    case 'descendants':
      nodes = await repository.getDescendants(assetId, depth);
      rootAsset = await repository.getEnterpriseAssetById(assetId);
      break;

    case 'full':
      // For full hierarchy, first find the root, then get all descendants
      rootAsset = await repository.getRootAsset(assetId);
      if (rootAsset) {
        nodes = await repository.getFullHierarchy(rootAsset.assetId, depth);
      } else {
        // If no root found, the asset itself is the root
        rootAsset = await repository.getEnterpriseAssetById(assetId);
        nodes = await repository.getFullHierarchy(assetId, depth);
      }
      break;

    default:
      throw new Error(`Invalid hierarchy type: ${type}`);
  }

  const maxNodeDepth = nodes.length > 0 
    ? Math.max(...nodes.map(n => n.depth)) 
    : 0;

  logger.info('Hierarchy retrieved', {
    assetId,
    type,
    totalNodes: nodes.length,
    maxDepth: maxNodeDepth,
  });

  return {
    rootAsset,
    nodes,
    totalNodes: nodes.length,
    maxDepth: maxNodeDepth,
  };
}

/**
 * Get ancestors of an asset
 */
export async function getAncestors(
  assetId: UUID,
  maxDepth?: number
): Promise<HierarchyNode[]> {
  const cacheKey = ancestorsCacheKey(assetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getAncestors(assetId, maxDepth),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get descendants of an asset
 */
export async function getDescendants(
  assetId: UUID,
  maxDepth?: number
): Promise<HierarchyNode[]> {
  const cacheKey = descendantsCacheKey(assetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getDescendants(assetId, maxDepth),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get root asset of a hierarchy
 */
export async function getRootAsset(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  return repository.getRootAsset(assetId);
}


// ============================================================================
// MODIFICATION OPERATIONS
// ============================================================================

/**
 * Link a child asset to a parent asset
 * Requirement 5.6: Support parent-child relationships for complex equipment with sub-components
 */
export async function linkParentChild(
  request: LinkParentChildRequest
): Promise<EnterpriseAssetHierarchy> {
  const { parentAssetId, childAssetId } = request;

  logger.info('Linking parent-child relationship', { parentAssetId, childAssetId });

  // Validate both assets exist
  const [parentAsset, childAsset] = await Promise.all([
    repository.getEnterpriseAssetById(parentAssetId),
    repository.getEnterpriseAssetById(childAssetId),
  ]);

  if (!parentAsset) {
    throw new Error(`Parent asset not found: ${parentAssetId}`);
  }

  if (!childAsset) {
    throw new Error(`Child asset not found: ${childAssetId}`);
  }

  // Check if child already has this parent
  if (childAsset.parentAssetId === parentAssetId) {
    logger.info('Relationship already exists', { parentAssetId, childAssetId });
    return childAsset;
  }

  // Perform the link operation
  const updatedChild = await repository.linkParentChild(request);

  // Invalidate caches
  await invalidateHierarchyCaches(parentAssetId, childAssetId);

  // Publish event
  await publishEvent('ASSET_HIERARCHY_LINKED', {
    parentAssetId,
    childAssetId,
    previousParentId: childAsset.parentAssetId,
  });

  logger.info('Parent-child relationship created', {
    parentAssetId,
    childAssetId,
    parentDisplayName: parentAsset.displayName,
    childDisplayName: updatedChild.displayName,
  });

  return updatedChild;
}

/**
 * Unlink a child asset from its parent
 */
export async function unlinkParentChild(childAssetId: UUID): Promise<EnterpriseAssetHierarchy> {
  logger.info('Unlinking parent-child relationship', { childAssetId });

  // Get current child to find parent
  const childAsset = await repository.getEnterpriseAssetById(childAssetId);
  if (!childAsset) {
    throw new Error(`Asset not found: ${childAssetId}`);
  }

  if (!childAsset.parentAssetId) {
    throw new Error(`Asset has no parent to unlink: ${childAssetId}`);
  }

  const previousParentId = childAsset.parentAssetId;

  // Perform the unlink operation
  const updatedChild = await repository.unlinkParentChild(childAssetId);

  // Invalidate caches
  await invalidateHierarchyCaches(previousParentId, childAssetId);

  // Publish event
  await publishEvent('ASSET_HIERARCHY_UNLINKED', {
    previousParentId,
    childAssetId,
  });

  logger.info('Parent-child relationship removed', {
    previousParentId,
    childAssetId,
  });

  return updatedChild;
}

// ============================================================================
// STATUS PROPAGATION
// Requirement 5.7: Propagate status updates to child components
// ============================================================================

/**
 * Propagate status change to all descendant assets
 * Requirement 5.7: WHEN a parent asset status changes, THE Asset_Hierarchy_Service 
 * SHALL propagate relevant status updates to child components
 */
export async function propagateStatus(
  parentAssetId: UUID,
  newStatus: AssetStatus
): Promise<StatusPropagationResult> {
  logger.info('Propagating status to descendants', { parentAssetId, newStatus });

  // Check if this status should propagate
  if (!repository.shouldPropagateStatus(newStatus)) {
    logger.info('Status does not propagate to children', { parentAssetId, newStatus });
    return {
      parentAssetId,
      newStatus,
      childrenUpdated: 0,
      updatedAssetIds: [],
    };
  }

  // Verify parent asset exists
  const parentAsset = await repository.getEnterpriseAssetById(parentAssetId);
  if (!parentAsset) {
    throw new Error(`Parent asset not found: ${parentAssetId}`);
  }

  // Propagate the status
  const result = await repository.propagateStatusToDescendants(parentAssetId, newStatus);

  // Invalidate caches for all affected assets
  for (const assetId of result.updatedAssetIds) {
    await cache.del(assetHierarchyCacheKey(assetId));
  }
  await cache.del(descendantsCacheKey(parentAssetId));

  // Publish event
  await publishEvent('ASSET_STATUS_PROPAGATED', {
    parentAssetId,
    newStatus,
    childrenUpdated: result.childrenUpdated,
    updatedAssetIds: result.updatedAssetIds,
  });

  logger.info('Status propagation complete', {
    parentAssetId,
    newStatus,
    childrenUpdated: result.childrenUpdated,
  });

  return result;
}

/**
 * Check if a status should propagate to children
 */
export function shouldPropagateStatus(status: AssetStatus): boolean {
  return repository.shouldPropagateStatus(status);
}

// ============================================================================
// UTILITY OPERATIONS
// ============================================================================

/**
 * Get count of direct children for an asset
 */
export async function getChildCount(assetId: UUID): Promise<number> {
  return repository.getChildCount(assetId);
}

/**
 * Get count of all descendants for an asset
 */
export async function getDescendantCount(assetId: UUID): Promise<number> {
  return repository.getDescendantCount(assetId);
}

/**
 * Check if an asset has any children
 */
export async function hasChildren(assetId: UUID): Promise<boolean> {
  return repository.hasChildren(assetId);
}

/**
 * Check if an asset has a parent
 */
export async function hasParent(assetId: UUID): Promise<boolean> {
  return repository.hasParent(assetId);
}

/**
 * Get hierarchy depth of an asset
 */
export async function getHierarchyDepth(assetId: UUID): Promise<number> {
  return repository.getHierarchyDepth(assetId);
}

/**
 * Check if linking would create a circular reference
 */
export async function wouldCreateCircularReference(
  parentAssetId: UUID,
  childAssetId: UUID
): Promise<boolean> {
  return repository.wouldCreateCircularReference(parentAssetId, childAssetId);
}

/**
 * Invalidate hierarchy-related caches for affected assets
 */
async function invalidateHierarchyCaches(
  parentAssetId: UUID,
  childAssetId: UUID
): Promise<void> {
  await Promise.all([
    cache.del(assetHierarchyCacheKey(parentAssetId)),
    cache.del(assetHierarchyCacheKey(childAssetId)),
    cache.del(childrenCacheKey(parentAssetId)),
    cache.del(ancestorsCacheKey(childAssetId)),
    cache.del(descendantsCacheKey(parentAssetId)),
  ]);
}

// Re-export types
export type {
  AssetStatus,
  EnterpriseAssetHierarchy,
  HierarchyNode,
  LinkParentChildRequest,
  StatusPropagationResult,
} from './asset-hierarchy-repository';

export { MAX_HIERARCHY_DEPTH } from './asset-hierarchy-repository';
