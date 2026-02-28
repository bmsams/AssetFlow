/**
 * Bin Location Repository - Data access layer for bin/shelf locations within stockrooms
 *
 * Implements database operations for:
 * - Bin location CRUD operations (Requirement 6.1-6.5)
 * - Bin location queries by stockroom
 * - Capacity and utilization tracking
 */

import type {
  BinLocation,
  BinLocationListFilters,
  CreateBinLocationRequest,
  PaginatedResult,
  PaginationParams,
  UpdateBinLocationRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'bin-location-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for bin_locations table
 */
interface BinLocationRow {
  bin_id: string;
  stockroom_id: string;
  bin_code: string;
  shelf_location: string | null;
  capacity: number | null;
  current_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to BinLocation entity
 */
function mapRowToBinLocation(row: BinLocationRow): BinLocation {
  return {
    binId: row.bin_id,
    stockroomId: row.stockroom_id,
    binCode: row.bin_code,
    shelfLocation: row.shelf_location,
    capacity: row.capacity,
    currentCount: row.current_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// Bin Location Repository Functions
// ============================================================================

/**
 * Create a new bin location
 * Requirement 6.1: Create bin location with stockroom reference, code, and capacity
 */
export async function createBinLocation(
  request: CreateBinLocationRequest,
  userId?: UUID
): Promise<BinLocation> {
  const timestamp = now();

  const result = await queryOne<BinLocationRow>(
    `INSERT INTO bin_locations (
      stockroom_id, bin_code, shelf_location, capacity,
      current_count, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 0, TRUE, $5, $5)
    RETURNING *`,
    [
      request.stockroomId,
      request.binCode,
      request.shelfLocation ?? null,
      request.capacity ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create bin location');
  }

  logger.info('Bin location created', {
    binId: result.bin_id,
    stockroomId: result.stockroom_id,
    binCode: result.bin_code,
    userId,
  });

  return mapRowToBinLocation(result);
}

/**
 * Get bin location by ID
 */
export async function getBinLocationById(binId: UUID): Promise<BinLocation | null> {
  const result = await queryOne<BinLocationRow>(
    'SELECT * FROM bin_locations WHERE bin_id = $1',
    [binId]
  );

  return result ? mapRowToBinLocation(result) : null;
}

/**
 * Get bin location by stockroom and bin code
 */
export async function getBinLocationByCode(
  stockroomId: UUID,
  binCode: string
): Promise<BinLocation | null> {
  const result = await queryOne<BinLocationRow>(
    'SELECT * FROM bin_locations WHERE stockroom_id = $1 AND bin_code = $2',
    [stockroomId, binCode]
  );

  return result ? mapRowToBinLocation(result) : null;
}

/**
 * Get all bin locations for a stockroom ordered by code
 * Requirement 6.2: Return all bin locations for a stockroom ordered by code
 */
export async function getBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  const rows = await queryMany<BinLocationRow>(
    `SELECT * FROM bin_locations 
     WHERE stockroom_id = $1 
     ORDER BY bin_code ASC`,
    [stockroomId]
  );

  return rows.map(mapRowToBinLocation);
}

/**
 * Get all active bin locations for a stockroom
 */
export async function getActiveBinLocationsByStockroom(stockroomId: UUID): Promise<BinLocation[]> {
  const rows = await queryMany<BinLocationRow>(
    `SELECT * FROM bin_locations 
     WHERE stockroom_id = $1 AND is_active = TRUE
     ORDER BY bin_code ASC`,
    [stockroomId]
  );

  return rows.map(mapRowToBinLocation);
}

/**
 * Update bin location details
 * Requirement 6.3: Update specified fields and maintain stockroom relationship
 */
export async function updateBinLocation(
  binId: UUID,
  request: UpdateBinLocationRequest,
  userId?: UUID
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

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(binId);

  const sql = `UPDATE bin_locations SET ${updates.join(', ')} WHERE bin_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<BinLocationRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Bin location updated', { binId, userId });

  return mapRowToBinLocation(result);
}

/**
 * Deactivate a bin location
 * Requirement 6.4: Mark bin location as inactive and prevent new inventory assignments
 */
export async function deactivateBinLocation(
  binId: UUID,
  userId?: UUID
): Promise<BinLocation | null> {
  return updateBinLocation(binId, { isActive: false }, userId);
}

/**
 * Delete a bin location (only if no dependencies)
 */
export async function deleteBinLocation(binId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM bin_locations WHERE bin_id = $1', [binId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Bin location deleted', { binId });
  }

  return deleted;
}

/**
 * Check if a bin code already exists in a stockroom
 * Used for uniqueness validation (unique constraint: stockroom_id + bin_code)
 */
export async function binCodeExistsInStockroom(
  stockroomId: UUID,
  binCode: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE stockroom_id = $1 AND bin_code = $2 AND bin_id != $3'
    : 'WHERE stockroom_id = $1 AND bin_code = $2';
  const params = excludeId
    ? [stockroomId, binCode, excludeId]
    : [stockroomId, binCode];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM bin_locations ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a stockroom exists
 * Requirement 6.5: Reject creation for non-existent stockroom
 */
export async function stockroomExists(stockroomId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM stockrooms WHERE stockroom_id = $1) as exists',
    [stockroomId]
  );

  return result?.exists ?? false;
}

/**
 * Get bin location dependencies (inventory items assigned to this bin)
 * Used to check if bin can be deleted
 */
export async function getBinLocationDependencies(binId: UUID): Promise<{
  inventoryCount: number;
}> {
  // Get the bin location to find its stockroom and bin code
  const binLocation = await getBinLocationById(binId);
  
  if (!binLocation) {
    return { inventoryCount: 0 };
  }

  // Check for inventory items assigned to this bin location
  const inventoryResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM stockroom_inventory 
     WHERE stockroom_id = $1 AND bin_location = $2`,
    [binLocation.stockroomId, binLocation.binCode]
  );

  return {
    inventoryCount: parseInt(inventoryResult?.count ?? '0', 10),
  };
}

/**
 * List bin locations with pagination and filters
 */
export async function listBinLocations(
  filters: BinLocationListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<BinLocation>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.stockroomId) {
    conditions.push(`stockroom_id = $${paramIndex++}`);
    values.push(filters.stockroomId);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.hasCapacity !== undefined) {
    if (filters.hasCapacity) {
      conditions.push('capacity IS NOT NULL');
    } else {
      conditions.push('capacity IS NULL');
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
  values.push(limit, offset);

  const rows = await queryMany<BinLocationRow>(
    `SELECT * FROM bin_locations
     ${whereClause}
     ORDER BY bin_code ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToBinLocation),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Update bin location current count
 * Used when inventory is added or removed from a bin
 */
export async function updateBinLocationCount(
  binId: UUID,
  newCount: number
): Promise<BinLocation | null> {
  const timestamp = now();

  const result = await queryOne<BinLocationRow>(
    `UPDATE bin_locations 
     SET current_count = $1, updated_at = $2 
     WHERE bin_id = $3 
     RETURNING *`,
    [newCount, timestamp, binId]
  );

  if (result) {
    logger.info('Bin location count updated', { binId, newCount });
  }

  return result ? mapRowToBinLocation(result) : null;
}

/**
 * Increment bin location current count
 * Used when inventory is added to a bin
 */
export async function incrementBinLocationCount(
  binId: UUID,
  amount: number = 1
): Promise<BinLocation | null> {
  const timestamp = now();

  const result = await queryOne<BinLocationRow>(
    `UPDATE bin_locations 
     SET current_count = current_count + $1, updated_at = $2 
     WHERE bin_id = $3 
     RETURNING *`,
    [amount, timestamp, binId]
  );

  if (result) {
    logger.info('Bin location count incremented', { binId, amount, newCount: result.current_count });
  }

  return result ? mapRowToBinLocation(result) : null;
}

/**
 * Decrement bin location current count
 * Used when inventory is removed from a bin
 */
export async function decrementBinLocationCount(
  binId: UUID,
  amount: number = 1
): Promise<BinLocation | null> {
  const timestamp = now();

  // Use GREATEST to prevent negative counts
  const result = await queryOne<BinLocationRow>(
    `UPDATE bin_locations 
     SET current_count = GREATEST(0, current_count - $1), updated_at = $2 
     WHERE bin_id = $3 
     RETURNING *`,
    [amount, timestamp, binId]
  );

  if (result) {
    logger.info('Bin location count decremented', { binId, amount, newCount: result.current_count });
  }

  return result ? mapRowToBinLocation(result) : null;
}

/**
 * Get bin locations that are at or over capacity
 * Used for capacity alerts
 */
export async function getBinLocationsAtCapacity(stockroomId?: UUID): Promise<BinLocation[]> {
  const stockroomCondition = stockroomId ? 'AND stockroom_id = $1' : '';
  const params = stockroomId ? [stockroomId] : [];

  const rows = await queryMany<BinLocationRow>(
    `SELECT * FROM bin_locations 
     WHERE is_active = TRUE 
       AND capacity IS NOT NULL 
       AND current_count >= capacity
       ${stockroomCondition}
     ORDER BY bin_code ASC`,
    params
  );

  return rows.map(mapRowToBinLocation);
}

/**
 * Get bin locations with available capacity
 * Used for finding bins that can accept more inventory
 */
export async function getBinLocationsWithAvailableCapacity(
  stockroomId: UUID
): Promise<BinLocation[]> {
  const rows = await queryMany<BinLocationRow>(
    `SELECT * FROM bin_locations 
     WHERE stockroom_id = $1 
       AND is_active = TRUE 
       AND (capacity IS NULL OR current_count < capacity)
     ORDER BY bin_code ASC`,
    [stockroomId]
  );

  return rows.map(mapRowToBinLocation);
}

/**
 * Get bin location utilization summary for a stockroom
 */
export async function getBinLocationUtilizationSummary(stockroomId: UUID): Promise<{
  totalBins: number;
  activeBins: number;
  binsWithCapacity: number;
  binsAtCapacity: number;
  totalCapacity: number;
  totalCurrentCount: number;
  utilizationPercentage: number;
}> {
  const result = await queryOne<{
    total_bins: string;
    active_bins: string;
    bins_with_capacity: string;
    bins_at_capacity: string;
    total_capacity: string;
    total_current_count: string;
  }>(
    `SELECT 
      COUNT(*) as total_bins,
      COUNT(*) FILTER (WHERE is_active = TRUE) as active_bins,
      COUNT(*) FILTER (WHERE capacity IS NOT NULL) as bins_with_capacity,
      COUNT(*) FILTER (WHERE capacity IS NOT NULL AND current_count >= capacity) as bins_at_capacity,
      COALESCE(SUM(capacity) FILTER (WHERE capacity IS NOT NULL), 0) as total_capacity,
      COALESCE(SUM(current_count), 0) as total_current_count
     FROM bin_locations
     WHERE stockroom_id = $1`,
    [stockroomId]
  );

  const totalCapacity = parseInt(result?.total_capacity ?? '0', 10);
  const totalCurrentCount = parseInt(result?.total_current_count ?? '0', 10);
  const utilizationPercentage = totalCapacity > 0 
    ? Math.round((totalCurrentCount / totalCapacity) * 100) 
    : 0;

  return {
    totalBins: parseInt(result?.total_bins ?? '0', 10),
    activeBins: parseInt(result?.active_bins ?? '0', 10),
    binsWithCapacity: parseInt(result?.bins_with_capacity ?? '0', 10),
    binsAtCapacity: parseInt(result?.bins_at_capacity ?? '0', 10),
    totalCapacity,
    totalCurrentCount,
    utilizationPercentage,
  };
}
