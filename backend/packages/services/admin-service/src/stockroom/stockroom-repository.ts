/**
 * Stockroom Repository
 *
 * Database operations for stockroom management.
 *
 * Requirements: 5.1-5.6 - Stockroom CRUD operations
 */

import type {
  CreateStockroomRequest,
  Stockroom,
  StockroomListFilters,
  UpdateStockroomRequest,
  UUID,
} from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'stockroom-repository' });

// ============================================================================
// Types
// ============================================================================

interface PaginationParams {
  page: number;
  limit: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Repository Functions
// ============================================================================

/**
 * Create a new stockroom
 */
export async function createStockroom(
  request: CreateStockroomRequest,
  createdBy?: UUID
): Promise<Stockroom> {
  const result = await queryOne<Stockroom>(
    `INSERT INTO stockrooms (name, location, stockroom_type, manager_id, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING 
       stockroom_id as "stockroomId",
       name,
       location,
       stockroom_type as "stockroomType",
       manager_id as "managerId",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [request.name, request.location ?? null, request.stockroomType, request.managerId ?? null, createdBy ?? null]
  );

  if (!result) {
    throw new Error('Failed to create stockroom');
  }

  logger.info('Stockroom created', { stockroomId: result.stockroomId });
  return result;
}

/**
 * Get stockroom by ID
 */
export async function getStockroomById(stockroomId: UUID): Promise<Stockroom | null> {
  return queryOne<Stockroom>(
    `SELECT 
       stockroom_id as "stockroomId",
       name,
       location,
       stockroom_type as "stockroomType",
       manager_id as "managerId",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM stockrooms 
     WHERE stockroom_id = $1`,
    [stockroomId]
  );
}

/**
 * Update stockroom
 */
export async function updateStockroom(
  stockroomId: UUID,
  request: UpdateStockroomRequest,
  updatedBy?: UUID
): Promise<Stockroom | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (request.name !== undefined) {
    setClauses.push('name = $' + idx++);
    values.push(request.name);
  }
  if (request.location !== undefined) {
    setClauses.push('location = $' + idx++);
    values.push(request.location);
  }
  if (request.stockroomType !== undefined) {
    setClauses.push('stockroom_type = $' + idx++);
    values.push(request.stockroomType);
  }
  if (request.managerId !== undefined) {
    setClauses.push('manager_id = $' + idx++);
    values.push(request.managerId);
  }
  if (request.isActive !== undefined) {
    setClauses.push('is_active = $' + idx++);
    values.push(request.isActive);
  }

  if (setClauses.length === 0) {
    return getStockroomById(stockroomId);
  }

  setClauses.push('updated_by = $' + idx++);
  values.push(updatedBy ?? null);
  setClauses.push('updated_at = NOW()');

  values.push(stockroomId);

  const result = await queryOne<Stockroom>(
    `UPDATE stockrooms SET ${setClauses.join(', ')} 
     WHERE stockroom_id = $${idx} 
     RETURNING 
       stockroom_id as "stockroomId",
       name,
       location,
       stockroom_type as "stockroomType",
       manager_id as "managerId",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    values
  );

  if (result) {
    logger.info('Stockroom updated', { stockroomId });
  }
  return result;
}

/**
 * Deactivate stockroom (soft delete)
 */
export async function deactivateStockroom(
  stockroomId: UUID,
  updatedBy?: UUID
): Promise<Stockroom | null> {
  return updateStockroom(stockroomId, { isActive: false }, updatedBy);
}

/**
 * List stockrooms with filters and pagination
 */
export async function listStockrooms(
  filters: StockroomListFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<Stockroom>> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (filters.stockroomType !== undefined) {
    conditions.push('stockroom_type = $' + idx++);
    values.push(filters.stockroomType);
  }
  if (filters.managerId !== undefined) {
    conditions.push('manager_id = $' + idx++);
    values.push(filters.managerId);
  }
  if (filters.isActive !== undefined) {
    conditions.push('is_active = $' + idx++);
    values.push(filters.isActive);
  }
  if (filters.search) {
    conditions.push('(name ILIKE $' + idx + ' OR location ILIKE $' + idx + ')');
    values.push('%' + filters.search + '%');
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM stockrooms ' + whereClause,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const offset = (pagination.page - 1) * pagination.limit;
  const limitIdx = idx++;
  const offsetIdx = idx;
  values.push(pagination.limit, offset);

  const items = await queryMany<Stockroom>(
    `SELECT 
       stockroom_id as "stockroomId",
       name,
       location,
       stockroom_type as "stockroomType",
       manager_id as "managerId",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM stockrooms ${whereClause} 
     ORDER BY name ASC 
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    values
  );

  return {
    items,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
  };
}

/**
 * Get active stockrooms (for dropdowns)
 */
export async function getActiveStockrooms(): Promise<Stockroom[]> {
  return queryMany<Stockroom>(
    `SELECT 
       stockroom_id as "stockroomId",
       name,
       location,
       stockroom_type as "stockroomType",
       manager_id as "managerId",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM stockrooms 
     WHERE is_active = true 
     ORDER BY name ASC`
  );
}

/**
 * Check if stockroom has dependencies (assets, inventory)
 */
export async function getStockroomDependencies(
  stockroomId: UUID
): Promise<{ assetCount: number; inventoryCount: number }> {
  const assetResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM assets WHERE stockroom_id = $1',
    [stockroomId]
  );

  const inventoryResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM stockroom_inventory WHERE stockroom_id = $1',
    [stockroomId]
  );

  return {
    assetCount: parseInt(assetResult?.count ?? '0', 10),
    inventoryCount: parseInt(inventoryResult?.count ?? '0', 10),
  };
}
