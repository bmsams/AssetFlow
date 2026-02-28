/**
 * Asset Relationship Repository - Data access layer for asset relationships
 *
 * Implements CMDB relationship management with:
 * - Referential integrity enforcement (Requirement 2.9)
 * - Support for multiple relationship types (Requirement 2.3)
 */

import type {
  AssetRelationship,
  AssetRelationType,
  CreateRelationshipRequest,
  PaginatedResult,
  PaginationParams,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'relationship-repository' });

/**
 * Database row type for asset relationships
 */
interface RelationshipRow {
  relationship_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relation_type: AssetRelationType;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Map database row to AssetRelationship entity
 */
function mapRowToRelationship(row: RelationshipRow): AssetRelationship {
  return {
    relationshipId: row.relationship_id,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    relationType: row.relation_type,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
  };
}

/**
 * Check if an asset exists
 */
export async function assetExists(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM assets WHERE asset_id = $1) as exists',
    [assetId]
  );
  return result?.exists ?? false;
}

/**
 * Check if a relationship already exists
 */
export async function relationshipExists(
  sourceAssetId: UUID,
  targetAssetId: UUID,
  relationType: AssetRelationType
): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM asset_relationships WHERE source_asset_id = $1 AND target_asset_id = $2 AND relation_type = $3) as exists',
    [sourceAssetId, targetAssetId, relationType]
  );
  return result?.exists ?? false;
}

/**
 * Create a new asset relationship
 *
 * Implements Requirement 2.3: Maintain asset relationships in the CMDB
 * Implements Requirement 2.9: Enforce referential integrity for relationships
 */
export async function createRelationship(
  request: CreateRelationshipRequest,
  userId?: UUID
): Promise<AssetRelationship> {
  const timestamp = now();

  // Verify source asset exists (referential integrity)
  const sourceExists = await assetExists(request.sourceAssetId);
  if (!sourceExists) {
    throw new Error(`Source asset not found: ${request.sourceAssetId}`);
  }

  // Verify target asset exists (referential integrity)
  const targetExists = await assetExists(request.targetAssetId);
  if (!targetExists) {
    throw new Error(`Target asset not found: ${request.targetAssetId}`);
  }

  // Prevent self-referential relationships
  if (request.sourceAssetId === request.targetAssetId) {
    throw new Error('Cannot create relationship between an asset and itself');
  }

  // Check for duplicate relationship
  const exists = await relationshipExists(
    request.sourceAssetId,
    request.targetAssetId,
    request.relationType
  );
  if (exists) {
    throw new Error(
      `Relationship already exists: ${request.sourceAssetId} -> ${request.targetAssetId} (${request.relationType})`
    );
  }

  const result = await queryOne<RelationshipRow>(
    `INSERT INTO asset_relationships 
     (source_asset_id, target_asset_id, relation_type, metadata, created_at, created_by) 
     VALUES ($1, $2, $3, $4, $5, $6) 
     RETURNING *`,
    [
      request.sourceAssetId,
      request.targetAssetId,
      request.relationType,
      request.metadata ? JSON.stringify(request.metadata) : null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create relationship');
  }

  logger.info('Relationship created', {
    relationshipId: result.relationship_id,
    sourceAssetId: request.sourceAssetId,
    targetAssetId: request.targetAssetId,
    relationType: request.relationType,
  });

  return mapRowToRelationship(result);
}

/**
 * Get a relationship by ID
 */
export async function getRelationshipById(
  relationshipId: UUID
): Promise<AssetRelationship | null> {
  const result = await queryOne<RelationshipRow>(
    'SELECT * FROM asset_relationships WHERE relationship_id = $1',
    [relationshipId]
  );

  return result ? mapRowToRelationship(result) : null;
}

/**
 * Get a specific relationship between two assets
 */
export async function getRelationship(
  sourceAssetId: UUID,
  targetAssetId: UUID,
  relationType?: AssetRelationType
): Promise<AssetRelationship | null> {
  let sql = 'SELECT * FROM asset_relationships WHERE source_asset_id = $1 AND target_asset_id = $2';
  const values: unknown[] = [sourceAssetId, targetAssetId];

  if (relationType) {
    sql += ' AND relation_type = $3';
    values.push(relationType);
  }

  sql += ' LIMIT 1';

  const result = await queryOne<RelationshipRow>(sql, values);
  return result ? mapRowToRelationship(result) : null;
}

/**
 * Delete a relationship between two assets
 *
 * Implements Requirement 2.9: Enforce referential integrity for relationships
 */
export async function deleteRelationship(
  sourceAssetId: UUID,
  targetAssetId: UUID,
  relationType?: AssetRelationType
): Promise<boolean> {
  let sql = 'DELETE FROM asset_relationships WHERE source_asset_id = $1 AND target_asset_id = $2';
  const values: unknown[] = [sourceAssetId, targetAssetId];

  if (relationType) {
    sql += ' AND relation_type = $3';
    values.push(relationType);
  }

  const result = await query(sql, values);
  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted) {
    logger.info('Relationship deleted', {
      sourceAssetId,
      targetAssetId,
      relationType,
    });
  }

  return deleted;
}

/**
 * Delete a relationship by ID
 */
export async function deleteRelationshipById(relationshipId: UUID): Promise<boolean> {
  const result = await query(
    'DELETE FROM asset_relationships WHERE relationship_id = $1',
    [relationshipId]
  );

  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted) {
    logger.info('Relationship deleted by ID', { relationshipId });
  }

  return deleted;
}

/**
 * Get all relationships for an asset (as source or target)
 *
 * Implements Requirement 2.3: Maintain asset relationships in the CMDB
 */
export async function getRelationshipsForAsset(
  assetId: UUID,
  options: {
    relationType?: AssetRelationType;
    direction?: 'source' | 'target' | 'both';
  } = {}
): Promise<AssetRelationship[]> {
  const { relationType, direction = 'both' } = options;
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Build direction condition
  if (direction === 'source') {
    conditions.push(`source_asset_id = $${paramIndex++}`);
    values.push(assetId);
  } else if (direction === 'target') {
    conditions.push(`target_asset_id = $${paramIndex++}`);
    values.push(assetId);
  } else {
    conditions.push(`(source_asset_id = $${paramIndex} OR target_asset_id = $${paramIndex})`);
    values.push(assetId);
    paramIndex++;
  }

  // Add relation type filter if specified
  if (relationType) {
    conditions.push(`relation_type = $${paramIndex++}`);
    values.push(relationType);
  }

  const sql = `SELECT * FROM asset_relationships WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  const rows = await queryMany<RelationshipRow>(sql, values);

  return rows.map(mapRowToRelationship);
}

/**
 * Get paginated relationships for an asset
 */
export async function getRelationshipsForAssetPaginated(
  assetId: UUID,
  options: {
    relationType?: AssetRelationType;
    direction?: 'source' | 'target' | 'both';
  } = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AssetRelationship>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;
  const { relationType, direction = 'both' } = options;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Build direction condition
  if (direction === 'source') {
    conditions.push(`source_asset_id = $${paramIndex++}`);
    values.push(assetId);
  } else if (direction === 'target') {
    conditions.push(`target_asset_id = $${paramIndex++}`);
    values.push(assetId);
  } else {
    conditions.push(`(source_asset_id = $${paramIndex} OR target_asset_id = $${paramIndex})`);
    values.push(assetId);
    paramIndex++;
  }

  // Add relation type filter if specified
  if (relationType) {
    conditions.push(`relation_type = $${paramIndex++}`);
    values.push(relationType);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM asset_relationships WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const rows = await queryMany<RelationshipRow>(
    `SELECT * FROM asset_relationships WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.map(mapRowToRelationship),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Delete all relationships for an asset (used when deleting an asset)
 */
export async function deleteAllRelationshipsForAsset(assetId: UUID): Promise<number> {
  const result = await query(
    'DELETE FROM asset_relationships WHERE source_asset_id = $1 OR target_asset_id = $1',
    [assetId]
  );

  const deletedCount = result.rowCount ?? 0;

  if (deletedCount > 0) {
    logger.info('All relationships deleted for asset', { assetId, deletedCount });
  }

  return deletedCount;
}

/**
 * Get relationship counts by type for an asset
 */
export async function getRelationshipCountsByType(
  assetId: UUID
): Promise<Record<AssetRelationType, number>> {
  const rows = await queryMany<{ relation_type: AssetRelationType; count: string }>(
    `SELECT relation_type, COUNT(*) as count 
     FROM asset_relationships 
     WHERE source_asset_id = $1 OR target_asset_id = $1 
     GROUP BY relation_type`,
    [assetId]
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.relation_type] = parseInt(row.count, 10);
  }

  return counts as Record<AssetRelationType, number>;
}

/**
 * Check for circular dependencies (for PARENT_CHILD and DEPENDENCY types)
 */
export async function wouldCreateCircularDependency(
  sourceAssetId: UUID,
  targetAssetId: UUID,
  relationType: AssetRelationType
): Promise<boolean> {
  // Only check for hierarchical relationship types
  if (relationType !== 'PARENT_CHILD' && relationType !== 'DEPENDENCY') {
    return false;
  }

  // Check if target asset is already an ancestor of source asset
  // This uses a recursive CTE to traverse the relationship graph
  const result = await queryOne<{ has_cycle: boolean }>(
    `WITH RECURSIVE ancestors AS (
      SELECT source_asset_id, target_asset_id, relation_type
      FROM asset_relationships
      WHERE target_asset_id = $1 AND relation_type = $3
      
      UNION ALL
      
      SELECT r.source_asset_id, r.target_asset_id, r.relation_type
      FROM asset_relationships r
      INNER JOIN ancestors a ON r.target_asset_id = a.source_asset_id
      WHERE r.relation_type = $3
    )
    SELECT EXISTS(
      SELECT 1 FROM ancestors WHERE source_asset_id = $2
    ) as has_cycle`,
    [sourceAssetId, targetAssetId, relationType]
  );

  return result?.has_cycle ?? false;
}
