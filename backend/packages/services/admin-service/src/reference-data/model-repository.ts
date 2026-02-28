/**
 * Model Repository - Data access layer for model catalog management
 *
 * Implements database operations for:
 * - Model CRUD operations (Requirement 11.1-11.6)
 * - Full-text search on model name, model number, and SKU
 * - Filtering by manufacturer, status, category, and active status
 * - Dependency checking for assets
 */

import type {
  CreateModelRequest,
  ModelDetails,
  ModelListFilters,
  ModelStatus,
  PaginatedResult,
  PaginationParams,
  UpdateModelRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'model-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for models table
 */
interface ModelRow {
  model_id: string;
  manufacturer_id: string;
  manufacturer_name: string;
  model_name: string;
  model_number: string | null;
  sku: string | null;
  category: string | null;
  specifications: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  asset_count?: string;
}

/**
 * Model dependencies row
 */
interface ModelDependenciesRow {
  asset_count: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to ModelDetails entity
 * Requirement 11.2: Return model details including specifications and asset count
 */
function mapRowToModel(row: ModelRow): ModelDetails {
  return {
    modelId: row.model_id,
    manufacturerId: row.manufacturer_id,
    manufacturerName: row.manufacturer_name,
    modelName: row.model_name,
    modelNumber: row.model_number,
    sku: row.sku,
    category: row.category,
    specifications: row.specifications ? JSON.parse(row.specifications) : null,
    status: row.status as ModelStatus,
    assetCount: parseInt(row.asset_count ?? '0', 10),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Model Repository Functions
// ============================================================================

/**
 * Create a new model
 * Requirement 11.1: Create model with manufacturer, model name, and specifications
 */
export async function createModel(
  request: CreateModelRequest,
  userId?: UUID
): Promise<ModelDetails> {
  const timestamp = now();

  const result = await queryOne<ModelRow>(
    `INSERT INTO models (
      manufacturer_id, model_name, model_number, sku, category, specifications,
      status, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', TRUE, $7, $7)
    RETURNING 
      m.model_id, m.manufacturer_id, 
      (SELECT name FROM manufacturers WHERE manufacturer_id = m.manufacturer_id) as manufacturer_name,
      m.model_name, m.model_number, m.sku, m.category, 
      m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
      0::text as asset_count
    FROM (
      INSERT INTO models (
        manufacturer_id, model_name, model_number, sku, category, specifications,
        status, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', TRUE, $7, $7)
      RETURNING *
    ) m`,
    [
      request.manufacturerId,
      request.modelName,
      request.modelNumber ?? null,
      request.sku ?? null,
      request.category ?? null,
      request.specifications ? JSON.stringify(request.specifications) : null,
      timestamp,
    ]
  );

  // If the complex query fails, use a simpler approach
  if (!result) {
    // Insert first
    const insertResult = await queryOne<{ model_id: string }>(
      `INSERT INTO models (
        manufacturer_id, model_name, model_number, sku, category, specifications,
        status, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', TRUE, $7, $7)
      RETURNING model_id`,
      [
        request.manufacturerId,
        request.modelName,
        request.modelNumber ?? null,
        request.sku ?? null,
        request.category ?? null,
        request.specifications ? JSON.stringify(request.specifications) : null,
        timestamp,
      ]
    );

    if (!insertResult) {
      throw new Error('Failed to create model');
    }

    // Then fetch the full model
    const model = await getModelById(insertResult.model_id);
    if (!model) {
      throw new Error('Failed to retrieve created model');
    }

    logger.info('Model created', {
      modelId: model.modelId,
      modelName: model.modelName,
      userId,
    });

    return model;
  }

  logger.info('Model created', {
    modelId: result.model_id,
    modelName: result.model_name,
    userId,
  });

  return mapRowToModel(result);
}

/**
 * Get model by ID
 * Requirement 11.2: Return complete model details including specifications and asset count
 */
export async function getModelById(modelId: UUID): Promise<ModelDetails | null> {
  const result = await queryOne<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.model_id = $1`,
    [modelId]
  );

  return result ? mapRowToModel(result) : null;
}

/**
 * Get model by SKU
 */
export async function getModelBySku(sku: string): Promise<ModelDetails | null> {
  const result = await queryOne<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.sku = $1`,
    [sku]
  );

  return result ? mapRowToModel(result) : null;
}

/**
 * Get model by model number and manufacturer
 */
export async function getModelByNumberAndManufacturer(
  modelNumber: string,
  manufacturerId: UUID
): Promise<ModelDetails | null> {
  const result = await queryOne<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.model_number = $1 AND m.manufacturer_id = $2`,
    [modelNumber, manufacturerId]
  );

  return result ? mapRowToModel(result) : null;
}

/**
 * Get all models
 */
export async function getAllModels(): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     ORDER BY mfr.name ASC, m.model_name ASC`
  );

  return rows.map(mapRowToModel);
}

/**
 * Get active models only
 */
export async function getActiveModels(): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.is_active = TRUE AND m.status != 'END_OF_LIFE'
     ORDER BY mfr.name ASC, m.model_name ASC`
  );

  return rows.map(mapRowToModel);
}

/**
 * Get models by manufacturer
 */
export async function getModelsByManufacturer(manufacturerId: UUID): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.manufacturer_id = $1
     ORDER BY m.model_name ASC`,
    [manufacturerId]
  );

  return rows.map(mapRowToModel);
}

/**
 * Get models by status
 */
export async function getModelsByStatus(status: ModelStatus): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.status = $1
     ORDER BY mfr.name ASC, m.model_name ASC`,
    [status]
  );

  return rows.map(mapRowToModel);
}

/**
 * Get models by category
 */
export async function getModelsByCategory(category: string): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.category = $1
     ORDER BY mfr.name ASC, m.model_name ASC`,
    [category]
  );

  return rows.map(mapRowToModel);
}

/**
 * Update model details
 * Requirement 11.3: Update model specifications or lifecycle status
 */
export async function updateModel(
  modelId: UUID,
  request: UpdateModelRequest,
  userId?: UUID
): Promise<ModelDetails | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.modelName !== undefined) {
    updates.push(`model_name = $${paramIndex++}`);
    values.push(request.modelName);
  }

  if (request.modelNumber !== undefined) {
    updates.push(`model_number = $${paramIndex++}`);
    values.push(request.modelNumber);
  }

  if (request.sku !== undefined) {
    updates.push(`sku = $${paramIndex++}`);
    values.push(request.sku);
  }

  if (request.category !== undefined) {
    updates.push(`category = $${paramIndex++}`);
    values.push(request.category);
  }

  if (request.specifications !== undefined) {
    updates.push(`specifications = $${paramIndex++}`);
    values.push(request.specifications ? JSON.stringify(request.specifications) : null);
  }

  if (request.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(request.status);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getModelById(modelId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(modelId);

  const sql = `UPDATE models 
               SET ${updates.join(', ')} 
               WHERE model_id = $${paramIndex}
               RETURNING model_id`;

  const result = await queryOne<{ model_id: string }>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Model updated', { modelId, userId });

  return getModelById(modelId);
}

/**
 * Update model status
 * Requirement 11.4: Mark model as end-of-life
 */
export async function updateModelStatus(
  modelId: UUID,
  status: ModelStatus,
  userId?: UUID
): Promise<ModelDetails | null> {
  const timestamp = now();

  const result = await queryOne<{ model_id: string }>(
    `UPDATE models 
     SET status = $1, updated_at = $2 
     WHERE model_id = $3
     RETURNING model_id`,
    [status, timestamp, modelId]
  );

  if (!result) {
    return null;
  }

  logger.info('Model status updated', { modelId, status, userId });

  return getModelById(modelId);
}

/**
 * Deactivate a model
 */
export async function deactivateModel(
  modelId: UUID,
  userId?: UUID
): Promise<ModelDetails | null> {
  const timestamp = now();

  const result = await queryOne<{ model_id: string }>(
    `UPDATE models 
     SET is_active = FALSE, updated_at = $1 
     WHERE model_id = $2
     RETURNING model_id`,
    [timestamp, modelId]
  );

  if (!result) {
    return null;
  }

  logger.info('Model deactivated', { modelId, userId });

  return getModelById(modelId);
}

/**
 * Delete a model (only if no dependencies)
 */
export async function deleteModel(modelId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM models WHERE model_id = $1', [modelId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Model deleted', { modelId });
  }

  return deleted;
}

/**
 * Check if a model SKU already exists
 * Used for uniqueness validation
 */
export async function modelSkuExists(
  sku: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE sku = $1 AND model_id != $2'
    : 'WHERE sku = $1';
  const params = excludeId ? [sku, excludeId] : [sku];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM models ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a model name already exists for a manufacturer
 * Used for uniqueness validation
 */
export async function modelNameExistsForManufacturer(
  modelName: string,
  manufacturerId: UUID,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE LOWER(model_name) = LOWER($1) AND manufacturer_id = $2 AND model_id != $3'
    : 'WHERE LOWER(model_name) = LOWER($1) AND manufacturer_id = $2';
  const params = excludeId ? [modelName, manufacturerId, excludeId] : [modelName, manufacturerId];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM models ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Get model dependencies (asset count)
 * Used to check if model can be deleted
 */
export async function getModelDependencies(modelId: UUID): Promise<{
  assetCount: number;
}> {
  const result = await queryOne<ModelDependenciesRow>(
    `SELECT 
       COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = $1), 0)::text as asset_count`,
    [modelId]
  );

  return {
    assetCount: parseInt(result?.asset_count ?? '0', 10),
  };
}

/**
 * List models with pagination and filters
 * Requirement 11.5: Return paginated list with optional manufacturer and status filters
 */
export async function listModels(
  filters: ModelListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<ModelDetails>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.manufacturerId !== undefined) {
    conditions.push(`m.manufacturer_id = $${paramIndex++}`);
    values.push(filters.manufacturerId);
  }

  if (filters.status !== undefined) {
    conditions.push(`m.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.category !== undefined) {
    conditions.push(`m.category = $${paramIndex++}`);
    values.push(filters.category);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`m.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.search) {
    conditions.push(
      `(m.model_name ILIKE $${paramIndex} OR m.model_number ILIKE $${paramIndex} OR m.sku ILIKE $${paramIndex} OR mfr.name ILIKE $${paramIndex})`
    );
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  values.push(limit, offset);

  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     ${whereClause}
     ORDER BY mfr.name ASC, m.model_name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToModel),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Search models by name, model number, or SKU
 * Requirement 11.6: Return matching models using partial text matching
 */
export async function searchModels(searchTerm: string): Promise<ModelDetails[]> {
  const searchPattern = `%${searchTerm}%`;

  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.model_name ILIKE $1
        OR m.model_number ILIKE $1
        OR m.sku ILIKE $1
        OR mfr.name ILIKE $1
     ORDER BY 
       CASE 
         WHEN m.model_name ILIKE $1 THEN 1
         WHEN m.model_number ILIKE $1 THEN 2
         WHEN m.sku ILIKE $1 THEN 3
         ELSE 4
       END,
       mfr.name ASC,
       m.model_name ASC
     LIMIT 50`,
    [searchPattern]
  );

  return rows.map(mapRowToModel);
}

/**
 * Get models available for asset creation
 * Returns only active models that are not end-of-life
 * Requirement 11.4: Prevent new asset creation with end-of-life models
 */
export async function getModelsForAssetCreation(): Promise<ModelDetails[]> {
  const rows = await queryMany<ModelRow>(
    `SELECT m.model_id, m.manufacturer_id, 
            mfr.name as manufacturer_name,
            m.model_name, m.model_number, m.sku, m.category, 
            m.specifications::text, m.status, m.is_active, m.created_at, m.updated_at,
            COALESCE((SELECT COUNT(*) FROM hardware_assets WHERE model_id = m.model_id), 0)::text as asset_count
     FROM models m
     LEFT JOIN manufacturers mfr ON mfr.manufacturer_id = m.manufacturer_id
     WHERE m.is_active = TRUE 
       AND m.status != 'END_OF_LIFE'
       AND mfr.is_active = TRUE
     ORDER BY mfr.name ASC, m.model_name ASC`
  );

  return rows.map(mapRowToModel);
}

