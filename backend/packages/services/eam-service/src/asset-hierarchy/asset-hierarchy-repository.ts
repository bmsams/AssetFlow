/**
 * Asset Hierarchy Repository - Data access layer for asset parent-child relationships
 *
 * Implements database operations for:
 * - Parent-child relationship management (Requirement 5.6)
 * - Hierarchy traversal (ancestors, descendants, full tree)
 * - Status propagation to child components (Requirement 5.7)
 * - Circular reference prevention
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'asset-hierarchy-repository' });

/**
 * Maximum depth for hierarchy queries to prevent infinite loops
 */
export const MAX_HIERARCHY_DEPTH = 10;

/**
 * Asset status for propagation
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
 * Hierarchy node representing an asset in the tree
 */
export interface HierarchyNode {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly status: AssetStatus;
  readonly parentAssetId: UUID | null;
  readonly depth: number;
  readonly path: readonly UUID[];
  readonly childCount: number;
}

/**
 * Enterprise asset with hierarchy info
 */
export interface EnterpriseAssetHierarchy {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly status: AssetStatus;
  readonly parentAssetId: UUID | null;
  readonly serialNumber: string | null;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly assetClass: string | null;
  readonly criticalityLevel: string | null;
  readonly facilityId: UUID | null;
  readonly building: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Link parent-child request
 */
export interface LinkParentChildRequest {
  readonly parentAssetId: UUID;
  readonly childAssetId: UUID;
}

/**
 * Status propagation result
 */
export interface StatusPropagationResult {
  readonly parentAssetId: UUID;
  readonly newStatus: AssetStatus;
  readonly childrenUpdated: number;
  readonly updatedAssetIds: readonly UUID[];
}

/**
 * Database row types
 */
interface EnterpriseAssetRow {
  asset_id: string;
  asset_tag: string;
  display_name: string;
  status: AssetStatus;
  parent_asset_id: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  asset_class: string | null;
  criticality_level: string | null;
  facility_id: string | null;
  building: string | null;
  created_at: string;
  updated_at: string;
}

interface HierarchyRow {
  asset_id: string;
  asset_tag: string;
  display_name: string;
  status: AssetStatus;
  parent_asset_id: string | null;
  depth: number;
  path: string[];
  child_count: string;
}

/**
 * Map database row to EnterpriseAssetHierarchy entity
 */
function mapRowToEnterpriseAssetHierarchy(row: EnterpriseAssetRow): EnterpriseAssetHierarchy {
  return {
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    displayName: row.display_name,
    status: row.status,
    parentAssetId: row.parent_asset_id,
    serialNumber: row.serial_number,
    manufacturer: row.manufacturer,
    model: row.model,
    assetClass: row.asset_class,
    criticalityLevel: row.criticality_level,
    facilityId: row.facility_id,
    building: row.building,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to HierarchyNode entity
 */
function mapRowToHierarchyNode(row: HierarchyRow): HierarchyNode {
  return {
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    displayName: row.display_name,
    status: row.status,
    parentAssetId: row.parent_asset_id,
    depth: row.depth,
    path: row.path,
    childCount: parseInt(row.child_count, 10),
  };
}


// ============================================================================
// HIERARCHY QUERY OPERATIONS
// ============================================================================

/**
 * Get enterprise asset by ID with hierarchy info
 */
export async function getEnterpriseAssetById(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  const result = await queryOne<EnterpriseAssetRow>(
    `SELECT 
      a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
      ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
      ea.asset_class, ea.criticality_level, ea.facility_id, ea.building
     FROM assets a
     JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
     WHERE a.asset_id = $1`,
    [assetId]
  );

  return result ? mapRowToEnterpriseAssetHierarchy(result) : null;
}

/**
 * Get parent asset of a given asset
 */
export async function getParentAsset(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  const result = await queryOne<EnterpriseAssetRow>(
    `SELECT 
      a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
      ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
      ea.asset_class, ea.criticality_level, ea.facility_id, ea.building
     FROM assets a
     JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
     WHERE a.asset_id = (
       SELECT parent_asset_id FROM enterprise_assets WHERE asset_id = $1
     )`,
    [assetId]
  );

  return result ? mapRowToEnterpriseAssetHierarchy(result) : null;
}

/**
 * Get direct children of an asset
 */
export async function getChildAssets(parentAssetId: UUID): Promise<EnterpriseAssetHierarchy[]> {
  const rows = await queryMany<EnterpriseAssetRow>(
    `SELECT 
      a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
      ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
      ea.asset_class, ea.criticality_level, ea.facility_id, ea.building
     FROM assets a
     JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
     WHERE ea.parent_asset_id = $1
     ORDER BY a.display_name ASC`,
    [parentAssetId]
  );

  return rows.map(mapRowToEnterpriseAssetHierarchy);
}

/**
 * Get all ancestors of an asset (from immediate parent to root)
 * Uses recursive CTE to traverse up the hierarchy
 */
export async function getAncestors(
  assetId: UUID,
  maxDepth: number = MAX_HIERARCHY_DEPTH
): Promise<HierarchyNode[]> {
  const rows = await queryMany<HierarchyRow>(
    `WITH RECURSIVE ancestors AS (
      -- Base case: start with the asset's parent
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        1 as depth,
        ARRAY[a.asset_id] as path
      FROM assets a
      JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
      WHERE a.asset_id = (SELECT parent_asset_id FROM enterprise_assets WHERE asset_id = $1)
      
      UNION ALL
      
      -- Recursive case: get parent of current node
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        anc.depth + 1,
        anc.path || a.asset_id
      FROM ancestors anc
      JOIN enterprise_assets ea ON ea.asset_id = anc.parent_asset_id
      JOIN assets a ON a.asset_id = ea.asset_id
      WHERE anc.depth < $2
    )
    SELECT 
      ancestors.*,
      (SELECT COUNT(*) FROM enterprise_assets WHERE parent_asset_id = ancestors.asset_id)::text as child_count
    FROM ancestors
    ORDER BY depth ASC`,
    [assetId, maxDepth]
  );

  return rows.map(mapRowToHierarchyNode);
}

/**
 * Get all descendants of an asset (children, grandchildren, etc.)
 * Uses recursive CTE to traverse down the hierarchy
 */
export async function getDescendants(
  assetId: UUID,
  maxDepth: number = MAX_HIERARCHY_DEPTH
): Promise<HierarchyNode[]> {
  const rows = await queryMany<HierarchyRow>(
    `WITH RECURSIVE descendants AS (
      -- Base case: start with direct children
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        1 as depth,
        ARRAY[a.asset_id] as path
      FROM assets a
      JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
      WHERE ea.parent_asset_id = $1
      
      UNION ALL
      
      -- Recursive case: get children of current nodes
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        desc_cte.depth + 1,
        desc_cte.path || a.asset_id
      FROM descendants desc_cte
      JOIN enterprise_assets ea ON ea.parent_asset_id = desc_cte.asset_id
      JOIN assets a ON a.asset_id = ea.asset_id
      WHERE desc_cte.depth < $2
    )
    SELECT 
      descendants.*,
      (SELECT COUNT(*) FROM enterprise_assets WHERE parent_asset_id = descendants.asset_id)::text as child_count
    FROM descendants
    ORDER BY depth ASC, display_name ASC`,
    [assetId, maxDepth]
  );

  return rows.map(mapRowToHierarchyNode);
}

/**
 * Get full hierarchy tree starting from a root asset
 * Returns the root and all descendants
 */
export async function getFullHierarchy(
  rootAssetId: UUID,
  maxDepth: number = MAX_HIERARCHY_DEPTH
): Promise<HierarchyNode[]> {
  const rows = await queryMany<HierarchyRow>(
    `WITH RECURSIVE hierarchy AS (
      -- Base case: start with the root asset
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        0 as depth,
        ARRAY[a.asset_id] as path
      FROM assets a
      JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
      WHERE a.asset_id = $1
      
      UNION ALL
      
      -- Recursive case: get children of current nodes
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status,
        ea.parent_asset_id,
        h.depth + 1,
        h.path || a.asset_id
      FROM hierarchy h
      JOIN enterprise_assets ea ON ea.parent_asset_id = h.asset_id
      JOIN assets a ON a.asset_id = ea.asset_id
      WHERE h.depth < $2
    )
    SELECT 
      hierarchy.*,
      (SELECT COUNT(*) FROM enterprise_assets WHERE parent_asset_id = hierarchy.asset_id)::text as child_count
    FROM hierarchy
    ORDER BY depth ASC, display_name ASC`,
    [rootAssetId, maxDepth]
  );

  return rows.map(mapRowToHierarchyNode);
}

/**
 * Get root asset of a hierarchy (asset with no parent)
 */
export async function getRootAsset(assetId: UUID): Promise<EnterpriseAssetHierarchy | null> {
  const result = await queryOne<EnterpriseAssetRow>(
    `WITH RECURSIVE ancestors AS (
      -- Base case: start with the given asset
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building,
        0 as depth
      FROM assets a
      JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
      WHERE a.asset_id = $1
      
      UNION ALL
      
      -- Recursive case: get parent
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building,
        anc.depth + 1
      FROM ancestors anc
      JOIN enterprise_assets ea ON ea.asset_id = anc.parent_asset_id
      JOIN assets a ON a.asset_id = ea.asset_id
      WHERE anc.depth < $2
    )
    SELECT * FROM ancestors WHERE parent_asset_id IS NULL
    ORDER BY depth DESC
    LIMIT 1`,
    [assetId, MAX_HIERARCHY_DEPTH]
  );

  return result ? mapRowToEnterpriseAssetHierarchy(result) : null;
}


// ============================================================================
// HIERARCHY MODIFICATION OPERATIONS
// ============================================================================

/**
 * Check if linking would create a circular reference
 * Returns true if circular reference would be created
 */
export async function wouldCreateCircularReference(
  parentAssetId: UUID,
  childAssetId: UUID
): Promise<boolean> {
  // Check if the proposed parent is a descendant of the child
  // This would create a cycle
  const result = await queryOne<{ found: boolean }>(
    `WITH RECURSIVE descendants AS (
      -- Start with the child asset
      SELECT asset_id, 1 as depth
      FROM enterprise_assets
      WHERE asset_id = $2
      
      UNION ALL
      
      -- Get all descendants
      SELECT ea.asset_id, d.depth + 1
      FROM descendants d
      JOIN enterprise_assets ea ON ea.parent_asset_id = d.asset_id
      WHERE d.depth < $3
    )
    SELECT EXISTS(
      SELECT 1 FROM descendants WHERE asset_id = $1
    ) as found`,
    [parentAssetId, childAssetId, MAX_HIERARCHY_DEPTH]
  );

  return result?.found ?? false;
}

/**
 * Link a child asset to a parent asset
 * Requirement 5.6: Support parent-child relationships for complex equipment
 */
export async function linkParentChild(
  request: LinkParentChildRequest
): Promise<EnterpriseAssetHierarchy> {
  return withTransaction(async (ctx) => {
    const { parentAssetId, childAssetId } = request;
    const timestamp = now();

    // Verify parent asset exists and is an enterprise asset
    const parentExists = await ctx.queryOne<{ asset_id: string }>(
      'SELECT asset_id FROM enterprise_assets WHERE asset_id = $1',
      [parentAssetId]
    );

    if (!parentExists) {
      throw new Error(`Parent asset not found or is not an enterprise asset: ${parentAssetId}`);
    }

    // Verify child asset exists and is an enterprise asset
    const childExists = await ctx.queryOne<{ asset_id: string; parent_asset_id: string | null }>(
      'SELECT asset_id, parent_asset_id FROM enterprise_assets WHERE asset_id = $1 FOR UPDATE',
      [childAssetId]
    );

    if (!childExists) {
      throw new Error(`Child asset not found or is not an enterprise asset: ${childAssetId}`);
    }

    // Check for self-reference
    if (parentAssetId === childAssetId) {
      throw new Error('An asset cannot be its own parent');
    }

    // Check for circular reference
    const wouldCreateCycle = await wouldCreateCircularReference(parentAssetId, childAssetId);
    if (wouldCreateCycle) {
      throw new Error('Cannot link: would create circular reference in hierarchy');
    }

    // Update the child asset's parent
    await ctx.queryOne(
      `UPDATE enterprise_assets 
       SET parent_asset_id = $1
       WHERE asset_id = $2`,
      [parentAssetId, childAssetId]
    );

    // Update the assets table timestamp
    await ctx.queryOne(
      `UPDATE assets SET updated_at = $1 WHERE asset_id = $2`,
      [timestamp, childAssetId]
    );

    logger.info('Parent-child relationship created', {
      parentAssetId,
      childAssetId,
    });

    // Return the updated child asset
    const result = await ctx.queryOne<EnterpriseAssetRow>(
      `SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building
       FROM assets a
       JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
       WHERE a.asset_id = $1`,
      [childAssetId]
    );

    if (!result) {
      throw new Error('Failed to retrieve updated asset');
    }

    return mapRowToEnterpriseAssetHierarchy(result);
  });
}

/**
 * Unlink a child asset from its parent
 */
export async function unlinkParentChild(childAssetId: UUID): Promise<EnterpriseAssetHierarchy> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Verify child asset exists and has a parent
    const child = await ctx.queryOne<{ asset_id: string; parent_asset_id: string | null }>(
      'SELECT asset_id, parent_asset_id FROM enterprise_assets WHERE asset_id = $1 FOR UPDATE',
      [childAssetId]
    );

    if (!child) {
      throw new Error(`Asset not found: ${childAssetId}`);
    }

    if (!child.parent_asset_id) {
      throw new Error(`Asset has no parent to unlink: ${childAssetId}`);
    }

    const previousParentId = child.parent_asset_id;

    // Remove the parent reference
    await ctx.queryOne(
      `UPDATE enterprise_assets 
       SET parent_asset_id = NULL
       WHERE asset_id = $1`,
      [childAssetId]
    );

    // Update the assets table timestamp
    await ctx.queryOne(
      `UPDATE assets SET updated_at = $1 WHERE asset_id = $2`,
      [timestamp, childAssetId]
    );

    logger.info('Parent-child relationship removed', {
      previousParentId,
      childAssetId,
    });

    // Return the updated child asset
    const result = await ctx.queryOne<EnterpriseAssetRow>(
      `SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building
       FROM assets a
       JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
       WHERE a.asset_id = $1`,
      [childAssetId]
    );

    if (!result) {
      throw new Error('Failed to retrieve updated asset');
    }

    return mapRowToEnterpriseAssetHierarchy(result);
  });
}


// ============================================================================
// STATUS PROPAGATION OPERATIONS
// Requirement 5.7: Propagate status updates to child components
// ============================================================================

/**
 * Statuses that should propagate to children
 */
const PROPAGATING_STATUSES: readonly AssetStatus[] = [
  'RETIRED',
  'DISPOSED',
  'IN_MAINTENANCE',
];

/**
 * Check if a status should propagate to children
 */
export function shouldPropagateStatus(status: AssetStatus): boolean {
  return PROPAGATING_STATUSES.includes(status);
}

/**
 * Propagate status change to all descendant assets
 * Requirement 5.7: WHEN a parent asset status changes, THE Asset_Hierarchy_Service 
 * SHALL propagate relevant status updates to child components
 */
export async function propagateStatusToDescendants(
  parentAssetId: UUID,
  newStatus: AssetStatus
): Promise<StatusPropagationResult> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get all descendant asset IDs
    const descendants = await ctx.queryMany<{ asset_id: string }>(
      `WITH RECURSIVE descendants AS (
        -- Direct children
        SELECT asset_id
        FROM enterprise_assets
        WHERE parent_asset_id = $1
        
        UNION ALL
        
        -- Recursive children
        SELECT ea.asset_id
        FROM descendants d
        JOIN enterprise_assets ea ON ea.parent_asset_id = d.asset_id
      )
      SELECT asset_id FROM descendants`,
      [parentAssetId]
    );

    if (descendants.length === 0) {
      logger.info('No descendants to update', { parentAssetId, newStatus });
      return {
        parentAssetId,
        newStatus,
        childrenUpdated: 0,
        updatedAssetIds: [],
      };
    }

    const descendantIds = descendants.map(d => d.asset_id);

    // Update all descendant assets' status
    await ctx.queryOne(
      `UPDATE assets 
       SET status = $1, updated_at = $2
       WHERE asset_id = ANY($3)`,
      [newStatus, timestamp, descendantIds]
    );

    logger.info('Status propagated to descendants', {
      parentAssetId,
      newStatus,
      childrenUpdated: descendantIds.length,
    });

    return {
      parentAssetId,
      newStatus,
      childrenUpdated: descendantIds.length,
      updatedAssetIds: descendantIds,
    };
  });
}

/**
 * Get count of direct children for an asset
 */
export async function getChildCount(assetId: UUID): Promise<number> {
  const result = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM enterprise_assets WHERE parent_asset_id = $1',
    [assetId]
  );

  return parseInt(result?.count ?? '0', 10);
}

/**
 * Get count of all descendants for an asset
 */
export async function getDescendantCount(assetId: UUID): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `WITH RECURSIVE descendants AS (
      SELECT asset_id
      FROM enterprise_assets
      WHERE parent_asset_id = $1
      
      UNION ALL
      
      SELECT ea.asset_id
      FROM descendants d
      JOIN enterprise_assets ea ON ea.parent_asset_id = d.asset_id
    )
    SELECT COUNT(*) as count FROM descendants`,
    [assetId]
  );

  return parseInt(result?.count ?? '0', 10);
}

/**
 * Check if an asset has any children
 */
export async function hasChildren(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM enterprise_assets WHERE parent_asset_id = $1) as exists',
    [assetId]
  );

  return result?.exists ?? false;
}

/**
 * Check if an asset has a parent
 */
export async function hasParent(assetId: UUID): Promise<boolean> {
  const result = await queryOne<{ parent_asset_id: string | null }>(
    'SELECT parent_asset_id FROM enterprise_assets WHERE asset_id = $1',
    [assetId]
  );

  return result?.parent_asset_id !== null;
}

/**
 * Get hierarchy depth of an asset (distance from root)
 */
export async function getHierarchyDepth(assetId: UUID): Promise<number> {
  const result = await queryOne<{ depth: number }>(
    `WITH RECURSIVE ancestors AS (
      SELECT asset_id, parent_asset_id, 0 as depth
      FROM enterprise_assets
      WHERE asset_id = $1
      
      UNION ALL
      
      SELECT ea.asset_id, ea.parent_asset_id, a.depth + 1
      FROM ancestors a
      JOIN enterprise_assets ea ON ea.asset_id = a.parent_asset_id
      WHERE a.depth < $2
    )
    SELECT MAX(depth) as depth FROM ancestors`,
    [assetId, MAX_HIERARCHY_DEPTH]
  );

  return result?.depth ?? 0;
}

/**
 * Get assets at a specific depth in the hierarchy from a root
 */
export async function getAssetsAtDepth(
  rootAssetId: UUID,
  depth: number
): Promise<EnterpriseAssetHierarchy[]> {
  const rows = await queryMany<EnterpriseAssetRow>(
    `WITH RECURSIVE hierarchy AS (
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building,
        0 as depth
      FROM assets a
      JOIN enterprise_assets ea ON a.asset_id = ea.asset_id
      WHERE a.asset_id = $1
      
      UNION ALL
      
      SELECT 
        a.asset_id, a.asset_tag, a.display_name, a.status, a.created_at, a.updated_at,
        ea.parent_asset_id, ea.serial_number, ea.manufacturer, ea.model,
        ea.asset_class, ea.criticality_level, ea.facility_id, ea.building,
        h.depth + 1
      FROM hierarchy h
      JOIN enterprise_assets ea ON ea.parent_asset_id = h.asset_id
      JOIN assets a ON a.asset_id = ea.asset_id
      WHERE h.depth < $2
    )
    SELECT * FROM hierarchy WHERE depth = $2
    ORDER BY display_name ASC`,
    [rootAssetId, depth]
  );

  return rows.map(mapRowToEnterpriseAssetHierarchy);
}
