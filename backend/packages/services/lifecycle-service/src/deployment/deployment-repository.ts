/**
 * Deployment Repository - Data access layer for deployment operations
 *
 * Implements database operations for:
 * - Deploying assets to users (Requirement 6.6)
 * - Creating CMDB relationships on deployment (Requirement 6.6)
 * - Correlating with discovery data (Requirement 6.7)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'deployment-repository' });

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/**
 * Asset status for deployment
 */
export type AssetStatus =
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'DEPLOYED'
  | 'IN_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED';

/**
 * CMDB relationship types
 */
export type RelationType =
  | 'PARENT_CHILD'
  | 'DEPENDENCY'
  | 'CONNECTED_TO'
  | 'INSTALLED_ON'
  | 'RUNS_ON'
  | 'LOCATED_IN'
  | 'MANAGED_BY'
  | 'USED_BY';

/**
 * Deployment record entity
 */
export interface DeploymentRecord {
  readonly deploymentId: UUID;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetName: string | null;
  readonly assignedToUserId: UUID;
  readonly assignedToUserName: string | null;
  readonly assignedToUserEmail: string | null;
  readonly deployedBy: UUID;
  readonly deployedByName: string | null;
  readonly deploymentDate: string;
  readonly status: DeploymentStatus;
  readonly location: string | null;
  readonly department: string | null;
  readonly costCenter: string | null;
  readonly notes: string | null;
  readonly discoveryCorrelationId: UUID | null;
  readonly discoverySource: string | null;
  readonly discoveryCorrelatedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * CMDB relationship created during deployment
 */
export interface DeploymentRelationship {
  readonly relationshipId: UUID;
  readonly deploymentId: UUID;
  readonly sourceAssetId: UUID;
  readonly targetAssetId: UUID;
  readonly relationType: RelationType;
  readonly metadata: Record<string, unknown> | null;
  readonly createdAt: string;
}

/**
 * Discovery correlation record
 */
export interface DiscoveryCorrelation {
  readonly correlationId: UUID;
  readonly assetId: UUID;
  readonly discoverySource: string;
  readonly discoveryRecordId: string;
  readonly serialNumber: string | null;
  readonly macAddress: string | null;
  readonly hostname: string | null;
  readonly ipAddress: string | null;
  readonly lastDiscoveredAt: string;
  readonly correlatedAt: string;
  readonly correlatedBy: UUID | null;
  readonly confidence: number;
}

/**
 * Create deployment record input
 */
export interface CreateDeploymentInput {
  readonly assetId: UUID;
  readonly assignedToUserId: UUID;
  readonly deployedBy: UUID;
  readonly deployedByName?: string;
  readonly location?: string;
  readonly department?: string;
  readonly costCenter?: string;
  readonly notes?: string;
}

/**
 * Create CMDB relationship input
 */
export interface CreateRelationshipInput {
  readonly deploymentId: UUID;
  readonly sourceAssetId: UUID;
  readonly targetAssetId: UUID;
  readonly relationType: RelationType;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Correlate discovery data input
 */
export interface CorrelateDiscoveryInput {
  readonly assetId: UUID;
  readonly discoverySource: string;
  readonly discoveryRecordId: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly hostname?: string;
  readonly ipAddress?: string;
  readonly correlatedBy?: UUID;
  readonly confidence?: number;
}

/**
 * Database row types
 */
interface DeploymentRecordRow {
  deployment_id: string;
  asset_id: string;
  asset_tag: string;
  asset_name: string | null;
  assigned_to_user_id: string;
  assigned_to_user_name: string | null;
  assigned_to_user_email: string | null;
  deployed_by: string;
  deployed_by_name: string | null;
  deployment_date: string;
  status: DeploymentStatus;
  location: string | null;
  department: string | null;
  cost_center: string | null;
  notes: string | null;
  discovery_correlation_id: string | null;
  discovery_source: string | null;
  discovery_correlated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RelationshipRow {
  relationship_id: string;
  deployment_id: string;
  source_asset_id: string;
  target_asset_id: string;
  relation_type: RelationType;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DiscoveryCorrelationRow {
  correlation_id: string;
  asset_id: string;
  discovery_source: string;
  discovery_record_id: string;
  serial_number: string | null;
  mac_address: string | null;
  hostname: string | null;
  ip_address: string | null;
  last_discovered_at: string;
  correlated_at: string;
  correlated_by: string | null;
  confidence: number;
}

interface AssetRow {
  asset_id: string;
  asset_tag: string;
  display_name: string | null;
  status: AssetStatus;
}

interface UserRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
}

/**
 * Map database row to DeploymentRecord
 */
function mapRowToDeploymentRecord(row: DeploymentRecordRow): DeploymentRecord {
  return {
    deploymentId: row.deployment_id,
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    assetName: row.asset_name,
    assignedToUserId: row.assigned_to_user_id,
    assignedToUserName: row.assigned_to_user_name,
    assignedToUserEmail: row.assigned_to_user_email,
    deployedBy: row.deployed_by,
    deployedByName: row.deployed_by_name,
    deploymentDate: row.deployment_date,
    status: row.status,
    location: row.location,
    department: row.department,
    costCenter: row.cost_center,
    notes: row.notes,
    discoveryCorrelationId: row.discovery_correlation_id,
    discoverySource: row.discovery_source,
    discoveryCorrelatedAt: row.discovery_correlated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to DeploymentRelationship
 */
function mapRowToRelationship(row: RelationshipRow): DeploymentRelationship {
  return {
    relationshipId: row.relationship_id,
    deploymentId: row.deployment_id,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    relationType: row.relation_type,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to DiscoveryCorrelation
 */
function mapRowToDiscoveryCorrelation(row: DiscoveryCorrelationRow): DiscoveryCorrelation {
  return {
    correlationId: row.correlation_id,
    assetId: row.asset_id,
    discoverySource: row.discovery_source,
    discoveryRecordId: row.discovery_record_id,
    serialNumber: row.serial_number,
    macAddress: row.mac_address,
    hostname: row.hostname,
    ipAddress: row.ip_address,
    lastDiscoveredAt: row.last_discovered_at,
    correlatedAt: row.correlated_at,
    correlatedBy: row.correlated_by,
    confidence: row.confidence,
  };
}

/**
 * Check if an asset exists and get its details
 */
export async function getAssetById(assetId: UUID): Promise<AssetRow | null> {
  const result = await queryOne<AssetRow>(
    'SELECT asset_id, asset_tag, display_name, status FROM assets WHERE asset_id = $1',
    [assetId]
  );
  return result;
}

/**
 * Check if a user exists and get their details
 */
export async function getUserById(userId: UUID): Promise<UserRow | null> {
  const result = await queryOne<UserRow>(
    'SELECT user_id, display_name, email FROM users WHERE user_id = $1',
    [userId]
  );
  return result;
}

/**
 * Create a deployment record and update asset status
 * Requirement 6.6: Assign the asset to a user
 */
export async function createDeployment(
  input: CreateDeploymentInput
): Promise<DeploymentRecord> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get asset details
    const asset = await ctx.queryOne<AssetRow>(
      'SELECT asset_id, asset_tag, display_name, status FROM assets WHERE asset_id = $1 FOR UPDATE',
      [input.assetId]
    );

    if (!asset) {
      throw new Error(`Asset not found: ${input.assetId}`);
    }

    // Validate asset is in a deployable status
    const deployableStatuses: AssetStatus[] = ['IN_STOCK', 'RESERVED', 'RECEIVED'];
    if (!deployableStatuses.includes(asset.status)) {
      throw new Error(
        `Asset cannot be deployed from status: ${asset.status}. ` +
        `Must be one of: ${deployableStatuses.join(', ')}`
      );
    }

    // Get user details
    const user = await ctx.queryOne<UserRow>(
      'SELECT user_id, display_name, email FROM users WHERE user_id = $1',
      [input.assignedToUserId]
    );

    if (!user) {
      throw new Error(`User not found: ${input.assignedToUserId}`);
    }

    // Create deployment record
    const result = await ctx.queryOne<DeploymentRecordRow>(
      `INSERT INTO deployment_records (
        asset_id, assigned_to_user_id, deployed_by, deployed_by_name,
        deployment_date, status, location, department, cost_center, notes,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7, $8, $9, $5, $5)
      RETURNING *,
        $10::text as asset_tag,
        $11::text as asset_name,
        $12::text as assigned_to_user_name,
        $13::text as assigned_to_user_email,
        NULL::uuid as discovery_correlation_id,
        NULL::text as discovery_source,
        NULL::timestamp as discovery_correlated_at`,
      [
        input.assetId,
        input.assignedToUserId,
        input.deployedBy,
        input.deployedByName ?? null,
        timestamp,
        input.location ?? null,
        input.department ?? null,
        input.costCenter ?? null,
        input.notes ?? null,
        asset.asset_tag,
        asset.display_name,
        user.display_name,
        user.email,
      ]
    );

    if (!result) {
      throw new Error('Failed to create deployment record');
    }

    // Update asset status to DEPLOYED
    await ctx.queryOne(
      `UPDATE assets SET 
        status = 'DEPLOYED',
        updated_at = $1
       WHERE asset_id = $2`,
      [timestamp, input.assetId]
    );

    // Update hardware_assets with assignment info if it's a hardware asset
    await ctx.queryOne(
      `UPDATE hardware_assets SET
        assigned_to = $1,
        install_date = $2
       WHERE asset_id = $3`,
      [input.assignedToUserId, timestamp, input.assetId]
    );

    // Create audit log entry
    await ctx.queryOne(
      `INSERT INTO audit_log (
        user_id, action_type, resource_type, resource_id, new_values
      ) VALUES ($1, 'STATUS_CHANGE', 'ASSET', $2, $3::jsonb)`,
      [
        input.deployedBy,
        input.assetId,
        JSON.stringify({
          previousStatus: asset.status,
          newStatus: 'DEPLOYED',
          assignedToUserId: input.assignedToUserId,
          location: input.location,
          department: input.department,
        }),
      ]
    );

    logger.info('Deployment record created', {
      deploymentId: result.deployment_id,
      assetId: input.assetId,
      assignedToUserId: input.assignedToUserId,
      deployedBy: input.deployedBy,
    });

    return mapRowToDeploymentRecord(result);
  });
}

/**
 * Get deployment record by ID
 */
export async function getDeploymentById(deploymentId: UUID): Promise<DeploymentRecord | null> {
  const result = await queryOne<DeploymentRecordRow>(
    `SELECT dr.*,
      a.asset_tag,
      a.display_name as asset_name,
      u.display_name as assigned_to_user_name,
      u.email as assigned_to_user_email,
      dc.correlation_id as discovery_correlation_id,
      dc.discovery_source,
      dc.correlated_at as discovery_correlated_at
     FROM deployment_records dr
     JOIN assets a ON dr.asset_id = a.asset_id
     LEFT JOIN users u ON dr.assigned_to_user_id = u.user_id
     LEFT JOIN discovery_correlations dc ON dr.asset_id = dc.asset_id
     WHERE dr.deployment_id = $1`,
    [deploymentId]
  );

  return result ? mapRowToDeploymentRecord(result) : null;
}

/**
 * Get deployment record by asset ID
 */
export async function getDeploymentByAssetId(assetId: UUID): Promise<DeploymentRecord | null> {
  const result = await queryOne<DeploymentRecordRow>(
    `SELECT dr.*,
      a.asset_tag,
      a.display_name as asset_name,
      u.display_name as assigned_to_user_name,
      u.email as assigned_to_user_email,
      dc.correlation_id as discovery_correlation_id,
      dc.discovery_source,
      dc.correlated_at as discovery_correlated_at
     FROM deployment_records dr
     JOIN assets a ON dr.asset_id = a.asset_id
     LEFT JOIN users u ON dr.assigned_to_user_id = u.user_id
     LEFT JOIN discovery_correlations dc ON dr.asset_id = dc.asset_id
     WHERE dr.asset_id = $1
     ORDER BY dr.deployment_date DESC
     LIMIT 1`,
    [assetId]
  );

  return result ? mapRowToDeploymentRecord(result) : null;
}

/**
 * Get deployments for a user
 */
export async function getDeploymentsByUserId(
  userId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<DeploymentRecord>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM deployment_records WHERE assigned_to_user_id = $1',
    [userId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<DeploymentRecordRow>(
    `SELECT dr.*,
      a.asset_tag,
      a.display_name as asset_name,
      u.display_name as assigned_to_user_name,
      u.email as assigned_to_user_email,
      dc.correlation_id as discovery_correlation_id,
      dc.discovery_source,
      dc.correlated_at as discovery_correlated_at
     FROM deployment_records dr
     JOIN assets a ON dr.asset_id = a.asset_id
     LEFT JOIN users u ON dr.assigned_to_user_id = u.user_id
     LEFT JOIN discovery_correlations dc ON dr.asset_id = dc.asset_id
     WHERE dr.assigned_to_user_id = $1
     ORDER BY dr.deployment_date DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return {
    items: rows.map(mapRowToDeploymentRecord),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Create CMDB relationship during deployment
 * Requirement 6.6: Create CMDB relationships on deployment
 */
export async function createDeploymentRelationship(
  input: CreateRelationshipInput
): Promise<DeploymentRelationship> {
  const timestamp = now();

  // Verify both assets exist
  const sourceExists = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM assets WHERE asset_id = $1) as exists',
    [input.sourceAssetId]
  );
  if (!sourceExists?.exists) {
    throw new Error(`Source asset not found: ${input.sourceAssetId}`);
  }

  const targetExists = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM assets WHERE asset_id = $1) as exists',
    [input.targetAssetId]
  );
  if (!targetExists?.exists) {
    throw new Error(`Target asset not found: ${input.targetAssetId}`);
  }

  // Create relationship in asset_relationships table
  const relationshipResult = await queryOne<{ relationship_id: string }>(
    `INSERT INTO asset_relationships (
      source_asset_id, target_asset_id, relation_type, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING relationship_id`,
    [
      input.sourceAssetId,
      input.targetAssetId,
      input.relationType,
      input.metadata ? JSON.stringify(input.metadata) : null,
      timestamp,
    ]
  );

  if (!relationshipResult) {
    throw new Error('Failed to create CMDB relationship');
  }

  // Link relationship to deployment
  const result = await queryOne<RelationshipRow>(
    `INSERT INTO deployment_relationships (
      deployment_id, relationship_id, source_asset_id, target_asset_id,
      relation_type, metadata, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [
      input.deploymentId,
      relationshipResult.relationship_id,
      input.sourceAssetId,
      input.targetAssetId,
      input.relationType,
      input.metadata ? JSON.stringify(input.metadata) : null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to link relationship to deployment');
  }

  logger.info('Deployment relationship created', {
    relationshipId: result.relationship_id,
    deploymentId: input.deploymentId,
    sourceAssetId: input.sourceAssetId,
    targetAssetId: input.targetAssetId,
    relationType: input.relationType,
  });

  return mapRowToRelationship(result);
}

/**
 * Get relationships created during a deployment
 */
export async function getDeploymentRelationships(
  deploymentId: UUID
): Promise<DeploymentRelationship[]> {
  const rows = await queryMany<RelationshipRow>(
    'SELECT * FROM deployment_relationships WHERE deployment_id = $1 ORDER BY created_at ASC',
    [deploymentId]
  );

  return rows.map(mapRowToRelationship);
}

/**
 * Correlate discovery data with an asset
 * Requirement 6.7: Correlate discovery data with the asset record
 */
export async function correlateDiscoveryData(
  input: CorrelateDiscoveryInput
): Promise<DiscoveryCorrelation> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Verify asset exists
    const asset = await ctx.queryOne<AssetRow>(
      'SELECT asset_id, asset_tag, display_name, status FROM assets WHERE asset_id = $1',
      [input.assetId]
    );

    if (!asset) {
      throw new Error(`Asset not found: ${input.assetId}`);
    }

    // Check if correlation already exists for this discovery record
    const existingCorrelation = await ctx.queryOne<{ correlation_id: string }>(
      `SELECT correlation_id FROM discovery_correlations 
       WHERE discovery_source = $1 AND discovery_record_id = $2`,
      [input.discoverySource, input.discoveryRecordId]
    );

    if (existingCorrelation) {
      // Update existing correlation
      const result = await ctx.queryOne<DiscoveryCorrelationRow>(
        `UPDATE discovery_correlations SET
          asset_id = $1,
          serial_number = COALESCE($2, serial_number),
          mac_address = COALESCE($3, mac_address),
          hostname = COALESCE($4, hostname),
          ip_address = COALESCE($5, ip_address),
          last_discovered_at = $6,
          correlated_at = $6,
          correlated_by = $7,
          confidence = COALESCE($8, confidence)
         WHERE correlation_id = $9
         RETURNING *`,
        [
          input.assetId,
          input.serialNumber ?? null,
          input.macAddress ?? null,
          input.hostname ?? null,
          input.ipAddress ?? null,
          timestamp,
          input.correlatedBy ?? null,
          input.confidence ?? null,
          existingCorrelation.correlation_id,
        ]
      );

      if (!result) {
        throw new Error('Failed to update discovery correlation');
      }

      logger.info('Discovery correlation updated', {
        correlationId: result.correlation_id,
        assetId: input.assetId,
        discoverySource: input.discoverySource,
      });

      return mapRowToDiscoveryCorrelation(result);
    }

    // Create new correlation
    const result = await ctx.queryOne<DiscoveryCorrelationRow>(
      `INSERT INTO discovery_correlations (
        asset_id, discovery_source, discovery_record_id,
        serial_number, mac_address, hostname, ip_address,
        last_discovered_at, correlated_at, correlated_by, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
      RETURNING *`,
      [
        input.assetId,
        input.discoverySource,
        input.discoveryRecordId,
        input.serialNumber ?? null,
        input.macAddress ?? null,
        input.hostname ?? null,
        input.ipAddress ?? null,
        timestamp,
        input.correlatedBy ?? null,
        input.confidence ?? 100,
      ]
    );

    if (!result) {
      throw new Error('Failed to create discovery correlation');
    }

    // Update hardware_assets with discovery info
    await ctx.queryOne(
      `UPDATE hardware_assets SET
        ip_address = COALESCE($1, ip_address),
        mac_address = COALESCE($2, mac_address),
        last_discovered_at = $3
       WHERE asset_id = $4`,
      [
        input.ipAddress ?? null,
        input.macAddress ?? null,
        timestamp,
        input.assetId,
      ]
    );

    logger.info('Discovery correlation created', {
      correlationId: result.correlation_id,
      assetId: input.assetId,
      discoverySource: input.discoverySource,
      discoveryRecordId: input.discoveryRecordId,
    });

    return mapRowToDiscoveryCorrelation(result);
  });
}

/**
 * Get discovery correlations for an asset
 */
export async function getDiscoveryCorrelations(
  assetId: UUID
): Promise<DiscoveryCorrelation[]> {
  const rows = await queryMany<DiscoveryCorrelationRow>(
    'SELECT * FROM discovery_correlations WHERE asset_id = $1 ORDER BY correlated_at DESC',
    [assetId]
  );

  return rows.map(mapRowToDiscoveryCorrelation);
}

/**
 * Find asset by discovery attributes for correlation
 */
export async function findAssetByDiscoveryAttributes(
  serialNumber?: string,
  macAddress?: string,
  hostname?: string
): Promise<AssetRow | null> {
  // Try to find by serial number first (most reliable)
  if (serialNumber) {
    const bySerial = await queryOne<AssetRow>(
      `SELECT a.asset_id, a.asset_tag, a.display_name, a.status
       FROM assets a
       JOIN hardware_assets ha ON a.asset_id = ha.asset_id
       WHERE ha.serial_number = $1`,
      [serialNumber]
    );
    if (bySerial) return bySerial;
  }

  // Try MAC address
  if (macAddress) {
    const byMac = await queryOne<AssetRow>(
      `SELECT a.asset_id, a.asset_tag, a.display_name, a.status
       FROM assets a
       JOIN hardware_assets ha ON a.asset_id = ha.asset_id
       WHERE ha.mac_address = $1`,
      [macAddress]
    );
    if (byMac) return byMac;
  }

  // Try hostname (least reliable)
  if (hostname) {
    const byHostname = await queryOne<AssetRow>(
      `SELECT a.asset_id, a.asset_tag, a.display_name, a.status
       FROM assets a
       WHERE a.display_name ILIKE $1`,
      [hostname]
    );
    if (byHostname) return byHostname;
  }

  return null;
}

/**
 * Update deployment status
 */
export async function updateDeploymentStatus(
  deploymentId: UUID,
  status: DeploymentStatus
): Promise<DeploymentRecord | null> {
  const timestamp = now();

  const result = await queryOne<DeploymentRecordRow>(
    `UPDATE deployment_records SET
      status = $1,
      updated_at = $2
     WHERE deployment_id = $3
     RETURNING *`,
    [status, timestamp, deploymentId]
  );

  if (result) {
    logger.info('Deployment status updated', { deploymentId, status });
  }

  return result ? mapRowToDeploymentRecord(result) : null;
}

/**
 * Get all deployments with pagination
 */
export async function getDeployments(
  pagination: PaginationParams = {},
  statusFilter?: DeploymentStatus[]
): Promise<PaginatedResult<DeploymentRecord>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  let paramIndex = 1;

  if (statusFilter && statusFilter.length > 0) {
    whereClause += ` AND dr.status = ANY($${paramIndex++})`;
    params.push(statusFilter as unknown as string);
  }

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM deployment_records dr ${whereClause}`,
    params
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<DeploymentRecordRow>(
    `SELECT dr.*,
      a.asset_tag,
      a.display_name as asset_name,
      u.display_name as assigned_to_user_name,
      u.email as assigned_to_user_email,
      dc.correlation_id as discovery_correlation_id,
      dc.discovery_source,
      dc.correlated_at as discovery_correlated_at
     FROM deployment_records dr
     JOIN assets a ON dr.asset_id = a.asset_id
     LEFT JOIN users u ON dr.assigned_to_user_id = u.user_id
     LEFT JOIN discovery_correlations dc ON dr.asset_id = dc.asset_id
     ${whereClause}
     ORDER BY dr.deployment_date DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToDeploymentRecord),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
