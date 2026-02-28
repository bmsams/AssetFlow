/**
 * Linear Asset Repository - Data access layer for linear assets and segments
 *
 * Implements database operations for:
 * - Linear asset CRUD operations (Requirement 5.3)
 * - Segment management for detailed tracking
 * - Total length calculation from segments
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'linear-asset-repository' });

/**
 * Linear unit of measure
 */
export type LinearUnit = 'METERS' | 'KILOMETERS' | 'FEET' | 'MILES' | 'YARDS';

/**
 * Route type for linear assets
 */
export type RouteType = 'PIPELINE' | 'CABLE' | 'TRACK' | 'ROAD' | 'FENCE' | 'CONVEYOR' | 'DUCT' | 'OTHER';

/**
 * Condition rating for linear assets and segments
 */
export type ConditionRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

/**
 * Linear asset entity
 */
export interface LinearAsset {
  readonly linearAssetId: UUID;
  readonly assetId: UUID;
  readonly startLocation: string | null;
  readonly endLocation: string | null;
  readonly totalLength: number | null;
  readonly segmentCount: number;
  readonly linearUnitOfMeasure: LinearUnit;
  readonly startGpsLatitude: number | null;
  readonly startGpsLongitude: number | null;
  readonly endGpsLatitude: number | null;
  readonly endGpsLongitude: number | null;
  readonly routeDescription: string | null;
  readonly routeType: RouteType | null;
  readonly overallConditionRating: ConditionRating | null;
  readonly lastInspectionDate: string | null;
  readonly nextInspectionDue: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Linear asset segment entity
 */
export interface LinearAssetSegment {
  readonly segmentId: UUID;
  readonly linearAssetId: UUID;
  readonly sequenceNumber: number;
  readonly startMarker: string | null;
  readonly endMarker: string | null;
  readonly segmentLength: number | null;
  readonly conditionRating: ConditionRating | null;
  readonly segmentDescription: string | null;
  readonly material: string | null;
  readonly installationDate: string | null;
  readonly startGpsLatitude: number | null;
  readonly startGpsLongitude: number | null;
  readonly endGpsLatitude: number | null;
  readonly endGpsLongitude: number | null;
  readonly lastInspectionDate: string | null;
  readonly lastInspectionNotes: string | null;
  readonly nextInspectionDue: string | null;
  readonly defectCount: number;
  readonly hasActiveDefects: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}


/**
 * Create linear asset request
 */
export interface CreateLinearAssetRequest {
  readonly assetId: UUID;
  readonly startLocation?: string;
  readonly endLocation?: string;
  readonly linearUnitOfMeasure?: LinearUnit;
  readonly startGpsLatitude?: number;
  readonly startGpsLongitude?: number;
  readonly endGpsLatitude?: number;
  readonly endGpsLongitude?: number;
  readonly routeDescription?: string;
  readonly routeType?: RouteType;
  readonly overallConditionRating?: ConditionRating;
  readonly lastInspectionDate?: string;
  readonly nextInspectionDue?: string;
}

/**
 * Update linear asset request
 */
export interface UpdateLinearAssetRequest {
  readonly startLocation?: string | null;
  readonly endLocation?: string | null;
  readonly linearUnitOfMeasure?: LinearUnit;
  readonly startGpsLatitude?: number | null;
  readonly startGpsLongitude?: number | null;
  readonly endGpsLatitude?: number | null;
  readonly endGpsLongitude?: number | null;
  readonly routeDescription?: string | null;
  readonly routeType?: RouteType | null;
  readonly overallConditionRating?: ConditionRating | null;
  readonly lastInspectionDate?: string | null;
  readonly nextInspectionDue?: string | null;
}

/**
 * Create segment request
 */
export interface CreateSegmentRequest {
  readonly linearAssetId: UUID;
  readonly sequenceNumber: number;
  readonly startMarker?: string;
  readonly endMarker?: string;
  readonly segmentLength?: number;
  readonly conditionRating?: ConditionRating;
  readonly segmentDescription?: string;
  readonly material?: string;
  readonly installationDate?: string;
  readonly startGpsLatitude?: number;
  readonly startGpsLongitude?: number;
  readonly endGpsLatitude?: number;
  readonly endGpsLongitude?: number;
  readonly nextInspectionDue?: string;
}

/**
 * Update segment request
 */
export interface UpdateSegmentRequest {
  readonly startMarker?: string | null;
  readonly endMarker?: string | null;
  readonly segmentLength?: number | null;
  readonly conditionRating?: ConditionRating | null;
  readonly segmentDescription?: string | null;
  readonly material?: string | null;
  readonly installationDate?: string | null;
  readonly startGpsLatitude?: number | null;
  readonly startGpsLongitude?: number | null;
  readonly endGpsLatitude?: number | null;
  readonly endGpsLongitude?: number | null;
  readonly lastInspectionDate?: string | null;
  readonly lastInspectionNotes?: string | null;
  readonly nextInspectionDue?: string | null;
  readonly defectCount?: number;
  readonly hasActiveDefects?: boolean;
}

/**
 * Database row types
 */
interface LinearAssetRow {
  linear_asset_id: string;
  asset_id: string;
  start_location: string | null;
  end_location: string | null;
  total_length: string | null;
  segment_count: number;
  linear_unit_of_measure: LinearUnit;
  start_gps_latitude: string | null;
  start_gps_longitude: string | null;
  end_gps_latitude: string | null;
  end_gps_longitude: string | null;
  route_description: string | null;
  route_type: RouteType | null;
  overall_condition_rating: ConditionRating | null;
  last_inspection_date: string | null;
  next_inspection_due: string | null;
  created_at: string;
  updated_at: string;
}

interface LinearAssetSegmentRow {
  segment_id: string;
  linear_asset_id: string;
  sequence_number: number;
  start_marker: string | null;
  end_marker: string | null;
  segment_length: string | null;
  condition_rating: ConditionRating | null;
  segment_description: string | null;
  material: string | null;
  installation_date: string | null;
  start_gps_latitude: string | null;
  start_gps_longitude: string | null;
  end_gps_latitude: string | null;
  end_gps_longitude: string | null;
  last_inspection_date: string | null;
  last_inspection_notes: string | null;
  next_inspection_due: string | null;
  defect_count: number;
  has_active_defects: boolean;
  created_at: string;
  updated_at: string;
}


/**
 * Map database row to LinearAsset entity
 */
function mapRowToLinearAsset(row: LinearAssetRow): LinearAsset {
  return {
    linearAssetId: row.linear_asset_id,
    assetId: row.asset_id,
    startLocation: row.start_location,
    endLocation: row.end_location,
    totalLength: row.total_length ? parseFloat(row.total_length) : null,
    segmentCount: row.segment_count,
    linearUnitOfMeasure: row.linear_unit_of_measure,
    startGpsLatitude: row.start_gps_latitude ? parseFloat(row.start_gps_latitude) : null,
    startGpsLongitude: row.start_gps_longitude ? parseFloat(row.start_gps_longitude) : null,
    endGpsLatitude: row.end_gps_latitude ? parseFloat(row.end_gps_latitude) : null,
    endGpsLongitude: row.end_gps_longitude ? parseFloat(row.end_gps_longitude) : null,
    routeDescription: row.route_description,
    routeType: row.route_type,
    overallConditionRating: row.overall_condition_rating,
    lastInspectionDate: row.last_inspection_date,
    nextInspectionDue: row.next_inspection_due,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to LinearAssetSegment entity
 */
function mapRowToSegment(row: LinearAssetSegmentRow): LinearAssetSegment {
  return {
    segmentId: row.segment_id,
    linearAssetId: row.linear_asset_id,
    sequenceNumber: row.sequence_number,
    startMarker: row.start_marker,
    endMarker: row.end_marker,
    segmentLength: row.segment_length ? parseFloat(row.segment_length) : null,
    conditionRating: row.condition_rating,
    segmentDescription: row.segment_description,
    material: row.material,
    installationDate: row.installation_date,
    startGpsLatitude: row.start_gps_latitude ? parseFloat(row.start_gps_latitude) : null,
    startGpsLongitude: row.start_gps_longitude ? parseFloat(row.start_gps_longitude) : null,
    endGpsLatitude: row.end_gps_latitude ? parseFloat(row.end_gps_latitude) : null,
    endGpsLongitude: row.end_gps_longitude ? parseFloat(row.end_gps_longitude) : null,
    lastInspectionDate: row.last_inspection_date,
    lastInspectionNotes: row.last_inspection_notes,
    nextInspectionDue: row.next_inspection_due,
    defectCount: row.defect_count,
    hasActiveDefects: row.has_active_defects,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get linear asset by ID
 */
export async function getLinearAssetById(linearAssetId: UUID): Promise<LinearAsset | null> {
  const result = await queryOne<LinearAssetRow>(
    'SELECT * FROM linear_assets WHERE linear_asset_id = $1',
    [linearAssetId]
  );

  return result ? mapRowToLinearAsset(result) : null;
}

/**
 * Get linear asset by enterprise asset ID
 */
export async function getLinearAssetByAssetId(assetId: UUID): Promise<LinearAsset | null> {
  const result = await queryOne<LinearAssetRow>(
    'SELECT * FROM linear_assets WHERE asset_id = $1',
    [assetId]
  );

  return result ? mapRowToLinearAsset(result) : null;
}

/**
 * Get all linear assets with pagination
 */
export async function getLinearAssets(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAsset>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM linear_assets'
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LinearAssetRow>(
    `SELECT * FROM linear_assets 
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    items: rows.map(mapRowToLinearAsset),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}


/**
 * Get linear assets by route type
 */
export async function getLinearAssetsByRouteType(
  routeType: RouteType,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAsset>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM linear_assets WHERE route_type = $1',
    [routeType]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LinearAssetRow>(
    `SELECT * FROM linear_assets 
     WHERE route_type = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [routeType, limit, offset]
  );

  return {
    items: rows.map(mapRowToLinearAsset),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Create a new linear asset
 * Requirement 5.3: Track assets spanning physical distances
 */
export async function createLinearAsset(
  request: CreateLinearAssetRequest
): Promise<LinearAsset> {
  const timestamp = now();

  const result = await queryOne<LinearAssetRow>(
    `INSERT INTO linear_assets (
      asset_id, start_location, end_location, linear_unit_of_measure,
      start_gps_latitude, start_gps_longitude, end_gps_latitude, end_gps_longitude,
      route_description, route_type, overall_condition_rating,
      last_inspection_date, next_inspection_due, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
    RETURNING *`,
    [
      request.assetId,
      request.startLocation ?? null,
      request.endLocation ?? null,
      request.linearUnitOfMeasure ?? 'METERS',
      request.startGpsLatitude ?? null,
      request.startGpsLongitude ?? null,
      request.endGpsLatitude ?? null,
      request.endGpsLongitude ?? null,
      request.routeDescription ?? null,
      request.routeType ?? null,
      request.overallConditionRating ?? null,
      request.lastInspectionDate ?? null,
      request.nextInspectionDue ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create linear asset');
  }

  logger.info('Linear asset created', {
    linearAssetId: result.linear_asset_id,
    assetId: request.assetId,
    routeType: request.routeType,
  });

  return mapRowToLinearAsset(result);
}

/**
 * Update a linear asset
 */
export async function updateLinearAsset(
  linearAssetId: UUID,
  request: UpdateLinearAssetRequest
): Promise<LinearAsset | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.startLocation !== undefined) {
    updates.push(`start_location = $${paramIndex++}`);
    values.push(request.startLocation);
  }

  if (request.endLocation !== undefined) {
    updates.push(`end_location = $${paramIndex++}`);
    values.push(request.endLocation);
  }

  if (request.linearUnitOfMeasure !== undefined) {
    updates.push(`linear_unit_of_measure = $${paramIndex++}`);
    values.push(request.linearUnitOfMeasure);
  }

  if (request.startGpsLatitude !== undefined) {
    updates.push(`start_gps_latitude = $${paramIndex++}`);
    values.push(request.startGpsLatitude);
  }

  if (request.startGpsLongitude !== undefined) {
    updates.push(`start_gps_longitude = $${paramIndex++}`);
    values.push(request.startGpsLongitude);
  }

  if (request.endGpsLatitude !== undefined) {
    updates.push(`end_gps_latitude = $${paramIndex++}`);
    values.push(request.endGpsLatitude);
  }

  if (request.endGpsLongitude !== undefined) {
    updates.push(`end_gps_longitude = $${paramIndex++}`);
    values.push(request.endGpsLongitude);
  }

  if (request.routeDescription !== undefined) {
    updates.push(`route_description = $${paramIndex++}`);
    values.push(request.routeDescription);
  }

  if (request.routeType !== undefined) {
    updates.push(`route_type = $${paramIndex++}`);
    values.push(request.routeType);
  }

  if (request.overallConditionRating !== undefined) {
    updates.push(`overall_condition_rating = $${paramIndex++}`);
    values.push(request.overallConditionRating);
  }

  if (request.lastInspectionDate !== undefined) {
    updates.push(`last_inspection_date = $${paramIndex++}`);
    values.push(request.lastInspectionDate);
  }

  if (request.nextInspectionDue !== undefined) {
    updates.push(`next_inspection_due = $${paramIndex++}`);
    values.push(request.nextInspectionDue);
  }

  if (updates.length === 0) {
    return getLinearAssetById(linearAssetId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(linearAssetId);

  const sql = `UPDATE linear_assets SET ${updates.join(', ')} WHERE linear_asset_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<LinearAssetRow>(sql, values);

  if (result) {
    logger.info('Linear asset updated', { linearAssetId });
  }

  return result ? mapRowToLinearAsset(result) : null;
}

/**
 * Delete a linear asset
 */
export async function deleteLinearAsset(linearAssetId: UUID): Promise<boolean> {
  const result = await queryOne<{ linear_asset_id: string }>(
    'DELETE FROM linear_assets WHERE linear_asset_id = $1 RETURNING linear_asset_id',
    [linearAssetId]
  );

  if (result) {
    logger.info('Linear asset deleted', { linearAssetId });
  }

  return result !== null;
}


// ============================================================================
// SEGMENT OPERATIONS
// ============================================================================

/**
 * Get segment by ID
 */
export async function getSegmentById(segmentId: UUID): Promise<LinearAssetSegment | null> {
  const result = await queryOne<LinearAssetSegmentRow>(
    'SELECT * FROM linear_asset_segments WHERE segment_id = $1',
    [segmentId]
  );

  return result ? mapRowToSegment(result) : null;
}

/**
 * Get all segments for a linear asset
 * Requirement 5.3: Segment-based location tracking
 */
export async function getSegmentsByLinearAssetId(
  linearAssetId: UUID
): Promise<LinearAssetSegment[]> {
  const rows = await queryMany<LinearAssetSegmentRow>(
    `SELECT * FROM linear_asset_segments 
     WHERE linear_asset_id = $1
     ORDER BY sequence_number ASC`,
    [linearAssetId]
  );

  return rows.map(mapRowToSegment);
}

/**
 * Get segments with pagination
 */
export async function getSegments(
  linearAssetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LinearAssetSegment>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM linear_asset_segments WHERE linear_asset_id = $1',
    [linearAssetId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<LinearAssetSegmentRow>(
    `SELECT * FROM linear_asset_segments 
     WHERE linear_asset_id = $1
     ORDER BY sequence_number ASC
     LIMIT $2 OFFSET $3`,
    [linearAssetId, limit, offset]
  );

  return {
    items: rows.map(mapRowToSegment),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Create a new segment
 * Requirement 5.3: Segment-based location tracking
 */
export async function createSegment(
  request: CreateSegmentRequest
): Promise<LinearAssetSegment> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Create the segment
    const result = await ctx.queryOne<LinearAssetSegmentRow>(
      `INSERT INTO linear_asset_segments (
        linear_asset_id, sequence_number, start_marker, end_marker,
        segment_length, condition_rating, segment_description, material,
        installation_date, start_gps_latitude, start_gps_longitude,
        end_gps_latitude, end_gps_longitude, next_inspection_due,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
      RETURNING *`,
      [
        request.linearAssetId,
        request.sequenceNumber,
        request.startMarker ?? null,
        request.endMarker ?? null,
        request.segmentLength ?? null,
        request.conditionRating ?? null,
        request.segmentDescription ?? null,
        request.material ?? null,
        request.installationDate ?? null,
        request.startGpsLatitude ?? null,
        request.startGpsLongitude ?? null,
        request.endGpsLatitude ?? null,
        request.endGpsLongitude ?? null,
        request.nextInspectionDue ?? null,
        timestamp,
      ]
    );

    if (!result) {
      throw new Error('Failed to create segment');
    }

    // Update segment count and total length on the linear asset
    await updateLinearAssetAggregates(ctx, request.linearAssetId);

    logger.info('Segment created', {
      segmentId: result.segment_id,
      linearAssetId: request.linearAssetId,
      sequenceNumber: request.sequenceNumber,
    });

    return mapRowToSegment(result);
  });
}

/**
 * Update a segment
 */
export async function updateSegment(
  segmentId: UUID,
  request: UpdateSegmentRequest
): Promise<LinearAssetSegment | null> {
  return withTransaction(async (ctx) => {
    // Get current segment to find linear asset ID
    const current = await ctx.queryOne<LinearAssetSegmentRow>(
      'SELECT * FROM linear_asset_segments WHERE segment_id = $1 FOR UPDATE',
      [segmentId]
    );

    if (!current) {
      return null;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.startMarker !== undefined) {
      updates.push(`start_marker = $${paramIndex++}`);
      values.push(request.startMarker);
    }

    if (request.endMarker !== undefined) {
      updates.push(`end_marker = $${paramIndex++}`);
      values.push(request.endMarker);
    }

    if (request.segmentLength !== undefined) {
      updates.push(`segment_length = $${paramIndex++}`);
      values.push(request.segmentLength);
    }

    if (request.conditionRating !== undefined) {
      updates.push(`condition_rating = $${paramIndex++}`);
      values.push(request.conditionRating);
    }

    if (request.segmentDescription !== undefined) {
      updates.push(`segment_description = $${paramIndex++}`);
      values.push(request.segmentDescription);
    }

    if (request.material !== undefined) {
      updates.push(`material = $${paramIndex++}`);
      values.push(request.material);
    }

    if (request.installationDate !== undefined) {
      updates.push(`installation_date = $${paramIndex++}`);
      values.push(request.installationDate);
    }

    if (request.startGpsLatitude !== undefined) {
      updates.push(`start_gps_latitude = $${paramIndex++}`);
      values.push(request.startGpsLatitude);
    }

    if (request.startGpsLongitude !== undefined) {
      updates.push(`start_gps_longitude = $${paramIndex++}`);
      values.push(request.startGpsLongitude);
    }

    if (request.endGpsLatitude !== undefined) {
      updates.push(`end_gps_latitude = $${paramIndex++}`);
      values.push(request.endGpsLatitude);
    }

    if (request.endGpsLongitude !== undefined) {
      updates.push(`end_gps_longitude = $${paramIndex++}`);
      values.push(request.endGpsLongitude);
    }

    if (request.lastInspectionDate !== undefined) {
      updates.push(`last_inspection_date = $${paramIndex++}`);
      values.push(request.lastInspectionDate);
    }

    if (request.lastInspectionNotes !== undefined) {
      updates.push(`last_inspection_notes = $${paramIndex++}`);
      values.push(request.lastInspectionNotes);
    }

    if (request.nextInspectionDue !== undefined) {
      updates.push(`next_inspection_due = $${paramIndex++}`);
      values.push(request.nextInspectionDue);
    }

    if (request.defectCount !== undefined) {
      updates.push(`defect_count = $${paramIndex++}`);
      values.push(request.defectCount);
    }

    if (request.hasActiveDefects !== undefined) {
      updates.push(`has_active_defects = $${paramIndex++}`);
      values.push(request.hasActiveDefects);
    }

    if (updates.length === 0) {
      return mapRowToSegment(current);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now());

    values.push(segmentId);

    const sql = `UPDATE linear_asset_segments SET ${updates.join(', ')} WHERE segment_id = $${paramIndex} RETURNING *`;
    const result = await ctx.queryOne<LinearAssetSegmentRow>(sql, values);

    if (!result) {
      return null;
    }

    // Update total length if segment length changed
    if (request.segmentLength !== undefined) {
      await updateLinearAssetAggregates(ctx, current.linear_asset_id);
    }

    logger.info('Segment updated', { segmentId });

    return mapRowToSegment(result);
  });
}

/**
 * Delete a segment
 */
export async function deleteSegment(segmentId: UUID): Promise<boolean> {
  return withTransaction(async (ctx) => {
    // Get segment to find linear asset ID
    const segment = await ctx.queryOne<LinearAssetSegmentRow>(
      'SELECT * FROM linear_asset_segments WHERE segment_id = $1',
      [segmentId]
    );

    if (!segment) {
      return false;
    }

    // Delete the segment
    await ctx.queryOne<{ segment_id: string }>(
      'DELETE FROM linear_asset_segments WHERE segment_id = $1 RETURNING segment_id',
      [segmentId]
    );

    // Update aggregates on the linear asset
    await updateLinearAssetAggregates(ctx, segment.linear_asset_id);

    logger.info('Segment deleted', { segmentId, linearAssetId: segment.linear_asset_id });

    return true;
  });
}

/**
 * Update linear asset aggregates (segment count and total length)
 * Requirement 5.3: Calculate total length from segments
 */
async function updateLinearAssetAggregates(
  ctx: { queryOne: typeof queryOne },
  linearAssetId: UUID
): Promise<void> {
  const timestamp = now();

  await ctx.queryOne(
    `UPDATE linear_assets 
     SET segment_count = (
       SELECT COUNT(*) FROM linear_asset_segments WHERE linear_asset_id = $1
     ),
     total_length = (
       SELECT COALESCE(SUM(segment_length), 0) FROM linear_asset_segments WHERE linear_asset_id = $1
     ),
     updated_at = $2
     WHERE linear_asset_id = $1`,
    [linearAssetId, timestamp]
  );

  logger.debug('Linear asset aggregates updated', { linearAssetId });
}

/**
 * Calculate total length from segments
 * Requirement 5.3: Calculate total length from segments
 */
export async function calculateTotalLength(linearAssetId: UUID): Promise<number> {
  const result = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(segment_length), 0) as total 
     FROM linear_asset_segments 
     WHERE linear_asset_id = $1`,
    [linearAssetId]
  );

  return result ? parseFloat(result.total) : 0;
}

/**
 * Get segments by condition rating
 */
export async function getSegmentsByCondition(
  linearAssetId: UUID,
  conditionRating: ConditionRating
): Promise<LinearAssetSegment[]> {
  const rows = await queryMany<LinearAssetSegmentRow>(
    `SELECT * FROM linear_asset_segments 
     WHERE linear_asset_id = $1 AND condition_rating = $2
     ORDER BY sequence_number ASC`,
    [linearAssetId, conditionRating]
  );

  return rows.map(mapRowToSegment);
}

/**
 * Get segments with active defects
 */
export async function getSegmentsWithDefects(
  linearAssetId: UUID
): Promise<LinearAssetSegment[]> {
  const rows = await queryMany<LinearAssetSegmentRow>(
    `SELECT * FROM linear_asset_segments 
     WHERE linear_asset_id = $1 AND has_active_defects = TRUE
     ORDER BY sequence_number ASC`,
    [linearAssetId]
  );

  return rows.map(mapRowToSegment);
}

/**
 * Get segments due for inspection
 */
export async function getSegmentsDueForInspection(
  asOfDate?: string
): Promise<LinearAssetSegment[]> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);

  const rows = await queryMany<LinearAssetSegmentRow>(
    `SELECT * FROM linear_asset_segments 
     WHERE next_inspection_due IS NOT NULL AND next_inspection_due <= $1
     ORDER BY next_inspection_due ASC`,
    [checkDate]
  );

  return rows.map(mapRowToSegment);
}
