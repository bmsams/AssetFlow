/**
 * Manufacturer Repository - Data access layer for manufacturer management
 *
 * Implements database operations for:
 * - Manufacturer CRUD operations (Requirement 10.1-10.5)
 * - Full-text search on manufacturer name and code
 * - Filtering by active status
 * - Dependency checking for models and assets
 */

import type {
  CreateManufacturerRequest,
  ManufacturerDetails,
  ManufacturerListFilters,
  PaginatedResult,
  PaginationParams,
  UpdateManufacturerRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'manufacturer-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for manufacturers table
 */
interface ManufacturerRow {
  manufacturer_id: string;
  name: string;
  code: string | null;
  website: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  model_count?: string;
}

/**
 * Manufacturer dependencies row
 */
interface ManufacturerDependenciesRow {
  model_count: string;
  asset_count: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to ManufacturerDetails entity
 * Requirement 10.2: Return manufacturer details including associated model count
 */
function mapRowToManufacturer(row: ManufacturerRow): ManufacturerDetails {
  return {
    manufacturerId: row.manufacturer_id,
    name: row.name,
    website: row.website,
    modelCount: parseInt(row.model_count ?? '0', 10),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Manufacturer Repository Functions
// ============================================================================

/**
 * Create a new manufacturer
 * Requirement 10.1: Create manufacturer with name and optional website
 */
export async function createManufacturer(
  request: CreateManufacturerRequest,
  userId?: UUID
): Promise<ManufacturerDetails> {
  const timestamp = now();

  const result = await queryOne<ManufacturerRow>(
    `INSERT INTO manufacturers (
      name, website, is_active, created_at, updated_at
    ) VALUES ($1, $2, TRUE, $3, $3)
    RETURNING manufacturer_id, name, code, website, is_active, created_at, updated_at,
              0::text as model_count`,
    [
      request.name,
      request.website ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create manufacturer');
  }

  logger.info('Manufacturer created', {
    manufacturerId: result.manufacturer_id,
    name: result.name,
    userId,
  });

  return mapRowToManufacturer(result);
}

/**
 * Get manufacturer by ID
 * Requirement 10.2: Return manufacturer details including associated model count
 */
export async function getManufacturerById(manufacturerId: UUID): Promise<ManufacturerDetails | null> {
  const result = await queryOne<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     WHERE m.manufacturer_id = $1`,
    [manufacturerId]
  );

  return result ? mapRowToManufacturer(result) : null;
}

/**
 * Get manufacturer by code
 */
export async function getManufacturerByCode(code: string): Promise<ManufacturerDetails | null> {
  const result = await queryOne<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     WHERE m.code = $1`,
    [code]
  );

  return result ? mapRowToManufacturer(result) : null;
}

/**
 * Get all manufacturers
 */
export async function getAllManufacturers(): Promise<ManufacturerDetails[]> {
  const rows = await queryMany<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     ORDER BY m.name ASC`
  );

  return rows.map(mapRowToManufacturer);
}

/**
 * Get active manufacturers only
 */
export async function getActiveManufacturers(): Promise<ManufacturerDetails[]> {
  const rows = await queryMany<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     WHERE m.is_active = TRUE
     ORDER BY m.name ASC`
  );

  return rows.map(mapRowToManufacturer);
}

/**
 * Update manufacturer details
 * Requirement 10.3: Update manufacturer details
 */
export async function updateManufacturer(
  manufacturerId: UUID,
  request: UpdateManufacturerRequest,
  userId?: UUID
): Promise<ManufacturerDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.website !== undefined) {
    updates.push(`website = $${paramIndex++}`);
    values.push(request.website);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getManufacturerById(manufacturerId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(manufacturerId);

  const sql = `UPDATE manufacturers 
               SET ${updates.join(', ')} 
               WHERE manufacturer_id = $${paramIndex}
               RETURNING manufacturer_id, name, code, website, is_active, created_at, updated_at,
                         COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = manufacturers.manufacturer_id), 0)::text as model_count`;

  const result = await queryOne<ManufacturerRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Manufacturer updated', { manufacturerId, userId });

  return mapRowToManufacturer(result);
}

/**
 * Deactivate a manufacturer
 */
export async function deactivateManufacturer(
  manufacturerId: UUID,
  userId?: UUID
): Promise<ManufacturerDetails | null> {
  const timestamp = now();

  const result = await queryOne<ManufacturerRow>(
    `UPDATE manufacturers 
     SET is_active = FALSE, updated_at = $1 
     WHERE manufacturer_id = $2
     RETURNING manufacturer_id, name, code, website, is_active, created_at, updated_at,
               COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = manufacturers.manufacturer_id), 0)::text as model_count`,
    [timestamp, manufacturerId]
  );

  if (!result) {
    return null;
  }

  logger.info('Manufacturer deactivated', { manufacturerId, userId });

  return mapRowToManufacturer(result);
}

/**
 * Delete a manufacturer (only if no dependencies)
 * Requirement 10.5: Reject deletion if has associated models
 */
export async function deleteManufacturer(manufacturerId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM manufacturers WHERE manufacturer_id = $1', [manufacturerId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Manufacturer deleted', { manufacturerId });
  }

  return deleted;
}

/**
 * Check if a manufacturer code already exists
 * Used for uniqueness validation
 */
export async function manufacturerCodeExists(
  code: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE code = $1 AND manufacturer_id != $2'
    : 'WHERE code = $1';
  const params = excludeId ? [code, excludeId] : [code];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM manufacturers ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a manufacturer name already exists
 * Used for uniqueness validation
 */
export async function manufacturerNameExists(
  name: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE LOWER(name) = LOWER($1) AND manufacturer_id != $2'
    : 'WHERE LOWER(name) = LOWER($1)';
  const params = excludeId ? [name, excludeId] : [name];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM manufacturers ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Get manufacturer dependencies (model count and asset count)
 * Used to check if manufacturer can be deleted
 * Requirement 10.5: Check for associated models before deletion
 */
export async function getManufacturerDependencies(manufacturerId: UUID): Promise<{
  modelCount: number;
  assetCount: number;
}> {
  const result = await queryOne<ManufacturerDependenciesRow>(
    `SELECT 
       COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = $1), 0)::text as model_count,
       COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE manufacturer_id = $1), 0)::text as asset_count`,
    [manufacturerId]
  );

  return {
    modelCount: parseInt(result?.model_count ?? '0', 10),
    assetCount: parseInt(result?.asset_count ?? '0', 10),
  };
}

/**
 * List manufacturers with pagination and filters
 * Requirement 10.4: Return paginated list with optional search filter
 */
export async function listManufacturers(
  filters: ManufacturerListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ManufacturerDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.isActive !== undefined) {
    conditions.push(`m.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(
      `(m.name ILIKE $${paramIndex} OR m.code ILIKE $${paramIndex} OR m.website ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM manufacturers m ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  values.push(limit, offset);

  const rows = await queryMany<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     ${whereClause}
     ORDER BY m.name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToManufacturer),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Search manufacturers by name or code
 * Requirement 10.4: Return matching manufacturers using partial text matching
 */
export async function searchManufacturers(searchTerm: string): Promise<ManufacturerDetails[]> {
  const searchPattern = `%${searchTerm}%`;

  const rows = await queryMany<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM models WHERE manufacturer_id = m.manufacturer_id), 0)::text as model_count
     FROM manufacturers m
     WHERE m.name ILIKE $1
        OR m.code ILIKE $1
        OR m.website ILIKE $1
     ORDER BY 
       CASE 
         WHEN m.name ILIKE $1 THEN 1
         WHEN m.code ILIKE $1 THEN 2
         ELSE 3
       END,
       m.name ASC
     LIMIT 50`,
    [searchPattern]
  );

  return rows.map(mapRowToManufacturer);
}

/**
 * Get manufacturers with models
 * Returns only manufacturers that have at least one model
 */
export async function getManufacturersWithModels(): Promise<ManufacturerDetails[]> {
  const rows = await queryMany<ManufacturerRow>(
    `SELECT m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
            m.created_at, m.updated_at,
            COUNT(mo.model_id)::text as model_count
     FROM manufacturers m
     INNER JOIN models mo ON mo.manufacturer_id = m.manufacturer_id
     WHERE m.is_active = TRUE
     GROUP BY m.manufacturer_id, m.name, m.code, m.website, m.is_active, 
              m.created_at, m.updated_at
     HAVING COUNT(mo.model_id) > 0
     ORDER BY m.name ASC`
  );

  return rows.map(mapRowToManufacturer);
}

