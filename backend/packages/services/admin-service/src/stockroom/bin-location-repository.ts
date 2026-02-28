/**
 * Bin Location Repository
 *
 * Database operations for bin location management.
 *
 * Requirements: 6.1-6.4 - Bin Location CRUD operations
 */

import type {
  BinLocation,
  BinLocationListFilters,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
  UUID,
} from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'bin-location-repository' });

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
 * Create a new bin location
 */
export async function createBinLocation(
  request: CreateBinLocationRequest,
  createdBy?: UUID
): Promise<BinLocation> {
  const result = await queryOne<BinLocation>(
    `INSERT INTO bin_locations (stockroom_id, bin_code, shelf_location, capacity, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $5)
     RETURNING 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [request.stockroomId, request.binCode, request.shelfLocation ?? null, request.capacity ?? null, createdBy ?? null]
  );

  if (!result) {
    throw new Error('Failed to create bin location');
  }

  logger.info('Bin location created', { binId: result.binId });
  return result;
}

/**
 * Get bin location by ID
 */
export async function getBinLocationById(binId: UUID): Promise<BinLocation | null> {
  return queryOne<BinLocation>(
    `SELECT 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM bin_locations 
     WHERE bin_id = $1`,
    [binId]
  );
}

/**
 * Update bin location
 */
export async function updateBinLocation(
  binId: UUID,
  request: UpdateBinLocationRequest,
  updatedBy?: UUID
): Promise<BinLocation | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.binCode !== undefined) {
    updates.push(`bin_code = $${paramIndex++}`);
    values.push(request.binCode);
  }
  if (request.shelfLocation !== undefined) {
    updates.push(`shelf_location = $${paramIndex++}`);
    values.push(request.shelfLocation);
  }
  if (request.capacity !== undefined) {
    updates.push(`capacity = $${paramIndex++}`);
    values.push(request.capacity);
  }
  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getBinLocationById(binId);
  }

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(updatedBy ?? null);
  updates.push(`updated_at = NOW()`);

  values.push(binId);

  const result = await queryOne<BinLocation>(
    `UPDATE bin_locations SET ${updates.join(', ')} 
     WHERE bin_id = $${paramIndex} 
     RETURNING 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    values
  );

  if (result) {
    logger.info('Bin location updated', { binId });
  }
  return result;
}

/**
 * Deactivate bin location (soft delete)
 */
export async function deactivateBinLocation(
  binId: UUID,
  updatedBy?: UUID
): Promise<BinLocation | null> {
  return updateBinLocation(binId, { isActive: false }, updatedBy);
}

/**
 * List bin locations with filters and pagination
 */
export async function listBinLocations(
  filters: BinLocationListFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<BinLocation>> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.stockroomId !== undefined) {
    conditions.push(`stockroom_id = $${paramIndex++}`);
    values.push(filters.stockroomId);
  }
  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }
  if (filters.hasCapacity !== undefined) {
    if (filters.hasCapacity) {
      conditions.push(`(capacity IS NULL OR current_count < capacity)`);
    } else {
      conditions.push(`(capacity IS NOT NULL AND current_count >= capacity)`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM bin_locations ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const offset = (pagination.page - 1) * pagination.limit;
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(pagination.limit, offset);

  const items = await queryMany<BinLocation>(
    `SELECT 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM bin_locations ${whereClause} 
     ORDER BY bin_code ASC 
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
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
 * Get bin locations by stockroom ID
 */
export async function getBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  return queryMany<BinLocation>(
    `SELECT 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM bin_locations 
     WHERE stockroom_id = $1 AND is_active = true 
     ORDER BY bin_code ASC`,
    [stockroomId]
  );
}

/**
 * Get bin location by code within a stockroom
 */
export async function getBinLocationByCode(
  stockroomId: UUID,
  binCode: string
): Promise<BinLocation | null> {
  return queryOne<BinLocation>(
    `SELECT 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"
     FROM bin_locations 
     WHERE stockroom_id = $1 AND bin_code = $2`,
    [stockroomId, binCode]
  );
}

/**
 * Check if bin code is unique within a stockroom
 */
export async function isBinCodeUnique(
  stockroomId: UUID,
  binCode: string,
  excludeBinId?: UUID
): Promise<boolean> {
  let query = `SELECT COUNT(*) as count FROM bin_locations WHERE stockroom_id = $1 AND bin_code = $2`;
  const values: unknown[] = [stockroomId, binCode];

  if (excludeBinId) {
    query += ` AND bin_id != $3`;
    values.push(excludeBinId);
  }

  const result = await queryOne<{ count: string }>(query, values);
  return parseInt(result?.count ?? '0', 10) === 0;
}

/**
 * Update bin location current count
 */
export async function updateBinLocationCount(
  binId: UUID,
  countChange: number
): Promise<BinLocation | null> {
  const result = await queryOne<BinLocation>(
    `UPDATE bin_locations 
     SET current_count = current_count + $2, updated_at = NOW()
     WHERE bin_id = $1
     RETURNING 
       bin_id as "binId",
       stockroom_id as "stockroomId",
       bin_code as "binCode",
       shelf_location as "shelfLocation",
       capacity,
       current_count as "currentCount",
       is_active as "isActive",
       created_at::text as "createdAt",
       updated_at::text as "updatedAt"`,
    [binId, countChange]
  );

  if (result) {
    logger.info('Bin location count updated', { binId, countChange, newCount: result.currentCount });
  }
  return result;
}

/**
 * Check if bin location has capacity
 */
export async function checkBinCapacity(binId: UUID): Promise<{ hasCapacity: boolean; available: number | null }> {
  const bin = await getBinLocationById(binId);
  if (!bin) {
    return { hasCapacity: false, available: null };
  }

  if (bin.capacity === null) {
    // No capacity limit
    return { hasCapacity: true, available: null };
  }

  const available = bin.capacity - (bin.currentCount ?? 0);
  return { hasCapacity: available > 0, available };
}
