/**
 * Linear Asset Service - Business logic layer for linear asset management
 *
 * Implements:
 * - Linear asset creation and management (Requirement 5.3)
 * - Segment-based location tracking
 * - Total length calculation from segments
 * - Segment condition monitoring
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  ConditionRating,
  CreateLinearAssetRequest,
  CreateSegmentRequest,
  LinearAsset,
  LinearAssetSegment,
  RouteType,
  UpdateLinearAssetRequest,
  UpdateSegmentRequest,
} from './linear-asset-repository';
import * as repository from './linear-asset-repository';

const logger = createLogger({ service: 'linear-asset-service' });

/**
 * Cache key for linear asset
 */
function linearAssetCacheKey(linearAssetId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.LINEAR_ASSET, linearAssetId);
}

/**
 * Cache key for linear asset by enterprise asset ID
 */
function linearAssetByAssetIdCacheKey(assetId: UUID): string {
  return `asset:${assetId}:linear-asset`;
}

/**
 * Cache key for segments of a linear asset
 */
function segmentsCacheKey(linearAssetId: UUID): string {
  return `linear-asset:${linearAssetId}:segments`;
}

/**
 * Linear asset with segments
 */
export interface LinearAssetWithSegments extends LinearAsset {
  readonly segments: readonly LinearAssetSegment[];
}

/**
 * Segment condition summary
 */
export interface SegmentConditionSummary {
  readonly linearAssetId: UUID;
  readonly totalSegments: number;
  readonly byCondition: Record<ConditionRating, number>;
  readonly segmentsWithDefects: number;
  readonly segmentsDueForInspection: number;
}

/**
 * Get linear asset by ID
 */
export async function getLinearAsset(linearAssetId: UUID): Promise<LinearAsset | null> {
  const cacheKey = linearAssetCacheKey(linearAssetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getLinearAssetById(linearAssetId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get linear asset by enterprise asset ID
 */
export async function getLinearAssetByAssetId(assetId: UUID): Promise<LinearAsset | null> {
  const cacheKey = linearAssetByAssetIdCacheKey(assetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getLinearAssetByAssetId(assetId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get linear asset with all segments
 * Requirement 5.3: Track assets spanning physical distances with segment-based location tracking
 */
export async function getLinearAssetWithSegments(
  linearAssetId: UUID
): Promise<LinearAssetWithSegments | null> {
  const linearAsset = await getLinearAsset(linearAssetId);
  if (!linearAsset) {
    return null;
  }

  const segments = await getSegmentsByLinearAssetId(linearAssetId);

  return {
    ...linearAsset,
    segments,
  };
}


/**
 * Get all linear assets with pagination
 */
export async function getLinearAssets(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAsset>> {
  return repository.getLinearAssets(pagination);
}

/**
 * Get linear assets by route type
 */
export async function getLinearAssetsByRouteType(
  routeType: RouteType,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAsset>> {
  return repository.getLinearAssetsByRouteType(routeType, pagination);
}

/**
 * Create a new linear asset
 * Requirement 5.3: Track assets spanning physical distances
 */
export async function createLinearAsset(
  request: CreateLinearAssetRequest
): Promise<LinearAsset> {
  logger.info('Creating linear asset', {
    assetId: request.assetId,
    routeType: request.routeType,
    linearUnit: request.linearUnitOfMeasure,
  });

  // Validate that the enterprise asset exists
  // Note: In a real implementation, we would check the enterprise_assets table
  // For now, we trust the foreign key constraint

  const linearAsset = await repository.createLinearAsset(request);

  // Invalidate cache
  await cache.del(linearAssetByAssetIdCacheKey(request.assetId));

  // Publish event
  await publishEvent('LINEAR_ASSET_CREATED', {
    linearAssetId: linearAsset.linearAssetId,
    assetId: linearAsset.assetId,
    routeType: linearAsset.routeType,
    linearUnit: linearAsset.linearUnitOfMeasure,
  });

  logger.info('Linear asset created', {
    linearAssetId: linearAsset.linearAssetId,
    assetId: linearAsset.assetId,
  });

  return linearAsset;
}

/**
 * Update a linear asset
 */
export async function updateLinearAsset(
  linearAssetId: UUID,
  request: UpdateLinearAssetRequest
): Promise<LinearAsset> {
  logger.info('Updating linear asset', { linearAssetId, request });

  const currentAsset = await repository.getLinearAssetById(linearAssetId);
  if (!currentAsset) {
    throw new Error(`Linear asset not found: ${linearAssetId}`);
  }

  const updatedAsset = await repository.updateLinearAsset(linearAssetId, request);
  if (!updatedAsset) {
    throw new Error(`Failed to update linear asset: ${linearAssetId}`);
  }

  // Invalidate cache
  await cache.del(linearAssetCacheKey(linearAssetId));
  await cache.del(linearAssetByAssetIdCacheKey(currentAsset.assetId));

  // Publish event
  await publishEvent('LINEAR_ASSET_UPDATED', {
    linearAssetId: updatedAsset.linearAssetId,
    assetId: updatedAsset.assetId,
    changes: Object.keys(request),
  });

  logger.info('Linear asset updated', { linearAssetId });

  return updatedAsset;
}

/**
 * Delete a linear asset
 */
export async function deleteLinearAsset(linearAssetId: UUID): Promise<void> {
  logger.info('Deleting linear asset', { linearAssetId });

  const currentAsset = await repository.getLinearAssetById(linearAssetId);
  if (!currentAsset) {
    throw new Error(`Linear asset not found: ${linearAssetId}`);
  }

  const deleted = await repository.deleteLinearAsset(linearAssetId);
  if (!deleted) {
    throw new Error(`Failed to delete linear asset: ${linearAssetId}`);
  }

  // Invalidate cache
  await cache.del(linearAssetCacheKey(linearAssetId));
  await cache.del(linearAssetByAssetIdCacheKey(currentAsset.assetId));
  await cache.del(segmentsCacheKey(linearAssetId));

  // Publish event
  await publishEvent('LINEAR_ASSET_DELETED', {
    linearAssetId,
    assetId: currentAsset.assetId,
  });

  logger.info('Linear asset deleted', { linearAssetId });
}

// ============================================================================
// SEGMENT OPERATIONS
// ============================================================================

/**
 * Get segment by ID
 */
export async function getSegment(segmentId: UUID): Promise<LinearAssetSegment | null> {
  return repository.getSegmentById(segmentId);
}

/**
 * Get all segments for a linear asset
 * Requirement 5.3: Segment-based location tracking
 */
export async function getSegmentsByLinearAssetId(
  linearAssetId: UUID
): Promise<LinearAssetSegment[]> {
  const cacheKey = segmentsCacheKey(linearAssetId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getSegmentsByLinearAssetId(linearAssetId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get segments with pagination
 */
export async function getSegments(
  linearAssetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAssetSegment>> {
  return repository.getSegments(linearAssetId, pagination);
}


/**
 * Create a new segment
 * Requirement 5.3: Segment-based location tracking
 */
export async function createSegment(
  request: CreateSegmentRequest
): Promise<LinearAssetSegment> {
  logger.info('Creating segment', {
    linearAssetId: request.linearAssetId,
    sequenceNumber: request.sequenceNumber,
  });

  // Validate that the linear asset exists
  const linearAsset = await repository.getLinearAssetById(request.linearAssetId);
  if (!linearAsset) {
    throw new Error(`Linear asset not found: ${request.linearAssetId}`);
  }

  // Validate segment length is positive if provided
  if (request.segmentLength !== undefined && request.segmentLength <= 0) {
    throw new Error('Segment length must be positive');
  }

  const segment = await repository.createSegment(request);

  // Invalidate cache
  await cache.del(segmentsCacheKey(request.linearAssetId));
  await cache.del(linearAssetCacheKey(request.linearAssetId));
  await cache.del(linearAssetByAssetIdCacheKey(linearAsset.assetId));

  // Publish event
  await publishEvent('SEGMENT_CREATED', {
    segmentId: segment.segmentId,
    linearAssetId: segment.linearAssetId,
    sequenceNumber: segment.sequenceNumber,
    segmentLength: segment.segmentLength,
  });

  logger.info('Segment created', {
    segmentId: segment.segmentId,
    linearAssetId: segment.linearAssetId,
  });

  return segment;
}

/**
 * Update a segment
 * Requirement 5.3: Segment-based location tracking
 */
export async function updateSegment(
  segmentId: UUID,
  request: UpdateSegmentRequest
): Promise<LinearAssetSegment> {
  logger.info('Updating segment', { segmentId, request });

  // Validate segment length is positive if provided
  if (request.segmentLength !== undefined && request.segmentLength !== null && request.segmentLength <= 0) {
    throw new Error('Segment length must be positive');
  }

  const currentSegment = await repository.getSegmentById(segmentId);
  if (!currentSegment) {
    throw new Error(`Segment not found: ${segmentId}`);
  }

  const updatedSegment = await repository.updateSegment(segmentId, request);
  if (!updatedSegment) {
    throw new Error(`Failed to update segment: ${segmentId}`);
  }

  // Get linear asset for cache invalidation
  const linearAsset = await repository.getLinearAssetById(currentSegment.linearAssetId);

  // Invalidate cache
  await cache.del(segmentsCacheKey(currentSegment.linearAssetId));
  await cache.del(linearAssetCacheKey(currentSegment.linearAssetId));
  if (linearAsset) {
    await cache.del(linearAssetByAssetIdCacheKey(linearAsset.assetId));
  }

  // Publish event
  await publishEvent('SEGMENT_UPDATED', {
    segmentId: updatedSegment.segmentId,
    linearAssetId: updatedSegment.linearAssetId,
    changes: Object.keys(request),
  });

  logger.info('Segment updated', { segmentId });

  return updatedSegment;
}

/**
 * Delete a segment
 */
export async function deleteSegment(segmentId: UUID): Promise<void> {
  logger.info('Deleting segment', { segmentId });

  const currentSegment = await repository.getSegmentById(segmentId);
  if (!currentSegment) {
    throw new Error(`Segment not found: ${segmentId}`);
  }

  const linearAsset = await repository.getLinearAssetById(currentSegment.linearAssetId);

  const deleted = await repository.deleteSegment(segmentId);
  if (!deleted) {
    throw new Error(`Failed to delete segment: ${segmentId}`);
  }

  // Invalidate cache
  await cache.del(segmentsCacheKey(currentSegment.linearAssetId));
  await cache.del(linearAssetCacheKey(currentSegment.linearAssetId));
  if (linearAsset) {
    await cache.del(linearAssetByAssetIdCacheKey(linearAsset.assetId));
  }

  // Publish event
  await publishEvent('SEGMENT_DELETED', {
    segmentId,
    linearAssetId: currentSegment.linearAssetId,
  });

  logger.info('Segment deleted', { segmentId });
}

// ============================================================================
// ANALYSIS AND REPORTING
// ============================================================================

/**
 * Calculate total length from segments
 * Requirement 5.3: Calculate total length from segments
 */
export async function calculateTotalLength(linearAssetId: UUID): Promise<number> {
  return repository.calculateTotalLength(linearAssetId);
}

/**
 * Get segment condition summary
 */
export async function getSegmentConditionSummary(
  linearAssetId: UUID
): Promise<SegmentConditionSummary> {
  const segments = await getSegmentsByLinearAssetId(linearAssetId);

  const byCondition: Record<ConditionRating, number> = {
    EXCELLENT: 0,
    GOOD: 0,
    FAIR: 0,
    POOR: 0,
    CRITICAL: 0,
  };

  let segmentsWithDefects = 0;
  let segmentsDueForInspection = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const segment of segments) {
    if (segment.conditionRating) {
      byCondition[segment.conditionRating]++;
    }
    if (segment.hasActiveDefects) {
      segmentsWithDefects++;
    }
    if (segment.nextInspectionDue && segment.nextInspectionDue <= today) {
      segmentsDueForInspection++;
    }
  }

  return {
    linearAssetId,
    totalSegments: segments.length,
    byCondition,
    segmentsWithDefects,
    segmentsDueForInspection,
  };
}

/**
 * Get segments by condition rating
 */
export async function getSegmentsByCondition(
  linearAssetId: UUID,
  conditionRating: ConditionRating
): Promise<LinearAssetSegment[]> {
  return repository.getSegmentsByCondition(linearAssetId, conditionRating);
}

/**
 * Get segments with active defects
 */
export async function getSegmentsWithDefects(
  linearAssetId: UUID
): Promise<LinearAssetSegment[]> {
  return repository.getSegmentsWithDefects(linearAssetId);
}

/**
 * Get segments due for inspection
 */
export async function getSegmentsDueForInspection(
  asOfDate?: string
): Promise<LinearAssetSegment[]> {
  return repository.getSegmentsDueForInspection(asOfDate);
}

// Re-export types
export type {
  ConditionRating,
  CreateLinearAssetRequest,
  CreateSegmentRequest,
  LinearAsset,
  LinearAssetSegment,
  LinearUnit,
  RouteType,
  UpdateLinearAssetRequest,
  UpdateSegmentRequest,
} from './linear-asset-repository';
