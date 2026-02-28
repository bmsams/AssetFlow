/**
 * Location Repository - Data access layer for location hierarchy
 *
 * Implements database operations for:
 * - Building management (Requirement 1): CRUD operations for buildings
 * - Floor management (Requirement 2): CRUD operations for floors
 * - Room management (Requirement 3): CRUD operations for rooms
 * - Rack management (Requirement 4): CRUD operations for racks
 */

import type {
  Building,
  BuildingListFilters,
  CreateBuildingRequest,
  CreateFloorRequest,
  CreateRoomRequest,
  CreateRackRequest,
  Floor,
  FloorListFilters,
  PaginatedResult,
  PaginationParams,
  Rack,
  RackListFilters,
  Room,
  RoomListFilters,
  RoomType,
  UpdateBuildingRequest,
  UpdateFloorRequest,
  UpdateRoomRequest,
  UpdateRackRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'location-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

/**
 * Database row type for buildings
 */
interface BuildingRow {
  building_id: string;
  building_code: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Extended building row with floor count
 */
interface BuildingRowWithFloors extends BuildingRow {
  total_floors: string;
}

/**
 * Database row type for floors
 */
interface FloorRow {
  floor_id: string;
  building_id: string;
  floor_number: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Extended floor row with room count
 */
interface FloorRowWithRooms extends FloorRow {
  total_rooms: string;
}

/**
 * Database row type for rooms
 */
interface RoomRow {
  room_id: string;
  floor_id: string;
  room_number: string;
  name: string;
  room_type: string;
  capacity: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Extended room row with rack count
 */
interface RoomRowWithRacks extends RoomRow {
  total_racks: string;
}

/**
 * Database row type for racks
 */
interface RackRow {
  rack_id: string;
  room_id: string;
  rack_name: string;
  total_units: number;
  used_units: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Extended rack row with asset count
 */
interface RackRowWithAssets extends RackRow {
  asset_count: string;
}

// ============================================================================
// Row Mappers
// ============================================================================

/**
 * Map database row to Building entity
 */
function mapRowToBuilding(row: BuildingRowWithFloors): Building {
  return {
    buildingId: row.building_id,
    buildingCode: row.building_code,
    name: row.name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateProvince: row.state_province,
    postalCode: row.postal_code,
    country: row.country,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    totalFloors: parseInt(row.total_floors ?? '0', 10),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to Floor entity
 */
function mapRowToFloor(row: FloorRowWithRooms): Floor {
  return {
    floorId: row.floor_id,
    buildingId: row.building_id,
    floorNumber: row.floor_number,
    name: row.name,
    description: row.description,
    totalRooms: parseInt(row.total_rooms ?? '0', 10),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to Room entity
 */
function mapRowToRoom(row: RoomRowWithRacks): Room {
  return {
    roomId: row.room_id,
    floorId: row.floor_id,
    roomNumber: row.room_number,
    name: row.name,
    roomType: row.room_type as RoomType,
    capacity: row.capacity,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to Rack entity
 * Requirement 4.6: Calculate available units as totalUnits - usedUnits
 */
function mapRowToRack(row: RackRowWithAssets): Rack {
  return {
    rackId: row.rack_id,
    roomId: row.room_id,
    rackName: row.rack_name,
    totalUnits: row.total_units,
    usedUnits: row.used_units,
    availableUnits: row.total_units - row.used_units,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Correlated rack asset count using denormalized hardware location columns.
 * Current schema stores hardware location as building/floor/room/rack text.
 */
const RACK_ASSET_COUNT_SUBQUERY = `COALESCE((
  SELECT COUNT(*)
  FROM hardware_assets ha
  JOIN rooms r2 ON r2.room_id = rk.room_id
  JOIN floors f2 ON f2.floor_id = r2.floor_id
  JOIN buildings b2 ON b2.building_id = f2.building_id
  WHERE ha.building = ANY (ARRAY[b2.building_code, b2.name])
    AND ha.floor = ANY (ARRAY[f2.floor_number::text, f2.name])
    AND ha.room = ANY (ARRAY[r2.room_number, r2.name])
    AND ha.rack = rk.rack_name
), 0)`;

let hardwareLocationSchemaChecked = false;
let hardwareLocationSchemaCheckPromise: Promise<void> | null = null;

async function ensureHardwareLocationSchemaCompatibility(): Promise<void> {
  if (hardwareLocationSchemaChecked) {
    return;
  }
  if (hardwareLocationSchemaCheckPromise) {
    return hardwareLocationSchemaCheckPromise;
  }

  hardwareLocationSchemaCheckPromise = (async () => {
    const rows = await queryMany<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'hardware_assets'
         AND column_name IN ('building', 'floor', 'room', 'rack')`
    );

    const actualColumns = new Set(rows.map((row) => row.column_name));
    const requiredColumns = ['building', 'floor', 'room', 'rack'];
    const missingColumns = requiredColumns.filter((column) => !actualColumns.has(column));
    if (missingColumns.length > 0) {
      throw new Error(
        `hardware_assets schema mismatch: missing columns ${missingColumns.join(', ')}`
      );
    }

    hardwareLocationSchemaChecked = true;
  })();

  try {
    await hardwareLocationSchemaCheckPromise;
  } finally {
    hardwareLocationSchemaCheckPromise = null;
  }
}

// ============================================================================
// Building Repository Functions
// ============================================================================

/**
 * Check if a building code already exists
 * Used for uniqueness validation
 */
export async function buildingCodeExists(
  buildingCode: string,
  excludeBuildingId?: UUID
): Promise<boolean> {
  const condition = excludeBuildingId
    ? 'WHERE building_code = $1 AND building_id != $2'
    : 'WHERE building_code = $1';
  const params = excludeBuildingId ? [buildingCode, excludeBuildingId] : [buildingCode];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM buildings ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Create a new building
 * Requirement 1.1: Create building with name, address, and contact information
 */
export async function createBuilding(
  request: CreateBuildingRequest,
  userId?: UUID
): Promise<Building> {
  const timestamp = now();

  const result = await queryOne<BuildingRow>(
    `INSERT INTO buildings (
      building_code, name, address_line1, address_line2, city, state_province,
      postal_code, country, contact_name, contact_email, contact_phone,
      is_active, created_at, updated_at, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $12, $13, $13)
    RETURNING *`,
    [
      request.buildingCode,
      request.name,
      request.addressLine1 ?? null,
      request.addressLine2 ?? null,
      request.city ?? null,
      request.stateProvince ?? null,
      request.postalCode ?? null,
      request.country ?? 'USA',
      request.contactName ?? null,
      request.contactEmail ?? null,
      request.contactPhone ?? null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create building');
  }

  logger.info('Building created', {
    buildingId: result.building_id,
    buildingCode: result.building_code,
  });

  // Return with totalFloors = 0 for new building
  return mapRowToBuilding({ ...result, total_floors: '0' });
}

/**
 * Get building by ID with floor count
 * Requirement 1.2: Return complete building details including floors count
 */
export async function getBuildingById(buildingId: UUID): Promise<Building | null> {
  const result = await queryOne<BuildingRowWithFloors>(
    `SELECT b.*, 
            COALESCE((SELECT COUNT(*) FROM floors f WHERE f.building_id = b.building_id), 0) as total_floors
     FROM buildings b
     WHERE b.building_id = $1`,
    [buildingId]
  );

  return result ? mapRowToBuilding(result) : null;
}

/**
 * Get building by code
 */
export async function getBuildingByCode(buildingCode: string): Promise<Building | null> {
  const result = await queryOne<BuildingRowWithFloors>(
    `SELECT b.*, 
            COALESCE((SELECT COUNT(*) FROM floors f WHERE f.building_id = b.building_id), 0) as total_floors
     FROM buildings b
     WHERE b.building_code = $1`,
    [buildingCode]
  );

  return result ? mapRowToBuilding(result) : null;
}

/**
 * Update building details
 * Requirement 1.3: Update specified fields and preserve unchanged fields
 */
export async function updateBuilding(
  buildingId: UUID,
  request: UpdateBuildingRequest,
  userId?: UUID
): Promise<Building | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.addressLine1 !== undefined) {
    updates.push(`address_line1 = $${paramIndex++}`);
    values.push(request.addressLine1);
  }

  if (request.addressLine2 !== undefined) {
    updates.push(`address_line2 = $${paramIndex++}`);
    values.push(request.addressLine2);
  }

  if (request.city !== undefined) {
    updates.push(`city = $${paramIndex++}`);
    values.push(request.city);
  }

  if (request.stateProvince !== undefined) {
    updates.push(`state_province = $${paramIndex++}`);
    values.push(request.stateProvince);
  }

  if (request.postalCode !== undefined) {
    updates.push(`postal_code = $${paramIndex++}`);
    values.push(request.postalCode);
  }

  if (request.country !== undefined) {
    updates.push(`country = $${paramIndex++}`);
    values.push(request.country);
  }

  if (request.contactName !== undefined) {
    updates.push(`contact_name = $${paramIndex++}`);
    values.push(request.contactName);
  }

  if (request.contactEmail !== undefined) {
    updates.push(`contact_email = $${paramIndex++}`);
    values.push(request.contactEmail);
  }

  if (request.contactPhone !== undefined) {
    updates.push(`contact_phone = $${paramIndex++}`);
    values.push(request.contactPhone);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getBuildingById(buildingId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(userId ?? null);

  values.push(buildingId);

  const sql = `UPDATE buildings SET ${updates.join(', ')} WHERE building_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<BuildingRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Building updated', { buildingId });

  // Get floor count for the updated building
  const floorCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM floors WHERE building_id = $1',
    [buildingId]
  );

  return mapRowToBuilding({
    ...result,
    total_floors: floorCount?.count ?? '0',
  });
}

/**
 * Deactivate a building
 * Requirement 1.4: Mark building as inactive
 */
export async function deactivateBuilding(
  buildingId: UUID,
  userId?: UUID
): Promise<Building | null> {
  return updateBuilding(buildingId, { isActive: false }, userId);
}

/**
 * Check if building has dependencies (floors or assets)
 * Requirement 1.6: Reject deletion if building has active assets or floors
 */
export async function getBuildingDependencies(buildingId: UUID): Promise<{
  floorCount: number;
  assetCount: number;
}> {
  await ensureHardwareLocationSchemaCompatibility();

  const floorResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM floors WHERE building_id = $1',
    [buildingId]
  );

  // Check for assets assigned to rooms in this building
  const assetResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM hardware_assets ha
     JOIN buildings b ON b.building_id = $1
     WHERE ha.building = ANY (ARRAY[b.building_code, b.name])`,
    [buildingId]
  );

  return {
    floorCount: parseInt(floorResult?.count ?? '0', 10),
    assetCount: parseInt(assetResult?.count ?? '0', 10),
  };
}

/**
 * Delete a building (only if no dependencies)
 * Requirement 1.6: Reject deletion if building has active assets or floors
 */
export async function deleteBuilding(buildingId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM buildings WHERE building_id = $1', [buildingId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Building deleted', { buildingId });
  }

  return deleted;
}

/**
 * List buildings with pagination and filters
 * Requirement 1.5: Return paginated list of buildings matching filter criteria
 */
export async function listBuildings(
  filters: BuildingListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Building>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.isActive !== undefined) {
    conditions.push(`b.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.city) {
    conditions.push(`b.city ILIKE $${paramIndex++}`);
    values.push(`%${filters.city}%`);
  }

  if (filters.stateProvince) {
    conditions.push(`b.state_province ILIKE $${paramIndex++}`);
    values.push(`%${filters.stateProvince}%`);
  }

  if (filters.country) {
    conditions.push(`b.country ILIKE $${paramIndex++}`);
    values.push(`%${filters.country}%`);
  }

  if (filters.search) {
    conditions.push(`(b.name ILIKE $${paramIndex} OR b.building_code ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM buildings b ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results with floor counts
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);

  const rows = await queryMany<BuildingRowWithFloors>(
    `SELECT b.*, 
            COALESCE((SELECT COUNT(*) FROM floors f WHERE f.building_id = b.building_id), 0) as total_floors
     FROM buildings b
     ${whereClause}
     ORDER BY b.name ASC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  return {
    items: rows.map(mapRowToBuilding),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all active buildings (for dropdowns/selectors)
 */
export async function getActiveBuildings(): Promise<Building[]> {
  const rows = await queryMany<BuildingRowWithFloors>(
    `SELECT b.*, 
            COALESCE((SELECT COUNT(*) FROM floors f WHERE f.building_id = b.building_id), 0) as total_floors
     FROM buildings b
     WHERE b.is_active = TRUE
     ORDER BY b.name ASC`
  );

  return rows.map(mapRowToBuilding);
}


// ============================================================================
// Floor Repository Functions
// ============================================================================

/**
 * Check if a floor number already exists in a building
 * Used for uniqueness validation (unique constraint: building_id + floor_number)
 */
export async function floorNumberExistsInBuilding(
  buildingId: UUID,
  floorNumber: number,
  excludeFloorId?: UUID
): Promise<boolean> {
  const condition = excludeFloorId
    ? 'WHERE building_id = $1 AND floor_number = $2 AND floor_id != $3'
    : 'WHERE building_id = $1 AND floor_number = $2';
  const params = excludeFloorId
    ? [buildingId, floorNumber, excludeFloorId]
    : [buildingId, floorNumber];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM floors ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a building exists
 * Requirement 2.5: Reject creation for non-existent building
 */
export async function buildingExists(buildingId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM buildings WHERE building_id = $1) as exists',
    [buildingId]
  );

  return result?.exists ?? false;
}

/**
 * Create a new floor
 * Requirement 2.1: Create floor with building reference, floor number, and name
 */
export async function createFloor(
  request: CreateFloorRequest,
  userId?: UUID
): Promise<Floor> {
  const timestamp = now();

  const result = await queryOne<FloorRow>(
    `INSERT INTO floors (
      building_id, floor_number, name, description,
      is_active, created_at, updated_at, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, TRUE, $5, $5, $6, $6)
    RETURNING *`,
    [
      request.buildingId,
      request.floorNumber,
      request.name,
      request.description ?? null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create floor');
  }

  logger.info('Floor created', {
    floorId: result.floor_id,
    buildingId: result.building_id,
    floorNumber: result.floor_number,
  });

  // Return with totalRooms = 0 for new floor
  return mapRowToFloor({ ...result, total_rooms: '0' });
}

/**
 * Get floor by ID with room count
 */
export async function getFloorById(floorId: UUID): Promise<Floor | null> {
  const result = await queryOne<FloorRowWithRooms>(
    `SELECT f.*, 
            COALESCE((SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.floor_id), 0) as total_rooms
     FROM floors f
     WHERE f.floor_id = $1`,
    [floorId]
  );

  return result ? mapRowToFloor(result) : null;
}

/**
 * Get floors for a building ordered by floor number
 * Requirement 2.2: Return all floors for a building ordered by floor number
 */
export async function getFloorsByBuildingId(buildingId: UUID): Promise<Floor[]> {
  const rows = await queryMany<FloorRowWithRooms>(
    `SELECT f.*, 
            COALESCE((SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.floor_id), 0) as total_rooms
     FROM floors f
     WHERE f.building_id = $1
     ORDER BY f.floor_number ASC`,
    [buildingId]
  );

  return rows.map(mapRowToFloor);
}

/**
 * Update floor details
 * Requirement 2.3: Update specified fields and maintain building relationship
 */
export async function updateFloor(
  floorId: UUID,
  request: UpdateFloorRequest,
  userId?: UUID
): Promise<Floor | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(request.description);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getFloorById(floorId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(userId ?? null);

  values.push(floorId);

  const sql = `UPDATE floors SET ${updates.join(', ')} WHERE floor_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<FloorRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Floor updated', { floorId });

  // Get room count for the updated floor
  const roomCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM rooms WHERE floor_id = $1',
    [floorId]
  );

  return mapRowToFloor({
    ...result,
    total_rooms: roomCount?.count ?? '0',
  });
}

/**
 * Deactivate a floor
 * Requirement 2.4: Mark floor as inactive and prevent new room assignments
 */
export async function deactivateFloor(
  floorId: UUID,
  userId?: UUID
): Promise<Floor | null> {
  return updateFloor(floorId, { isActive: false }, userId);
}

/**
 * Check if floor has dependencies (rooms or assets)
 */
export async function getFloorDependencies(floorId: UUID): Promise<{
  roomCount: number;
  assetCount: number;
}> {
  await ensureHardwareLocationSchemaCompatibility();

  const roomResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM rooms WHERE floor_id = $1',
    [floorId]
  );

  // Check for assets assigned to rooms on this floor
  const assetResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM hardware_assets ha
     JOIN floors f ON f.floor_id = $1
     JOIN buildings b ON b.building_id = f.building_id
     WHERE ha.building = ANY (ARRAY[b.building_code, b.name])
       AND ha.floor = ANY (ARRAY[f.floor_number::text, f.name])`,
    [floorId]
  );

  return {
    roomCount: parseInt(roomResult?.count ?? '0', 10),
    assetCount: parseInt(assetResult?.count ?? '0', 10),
  };
}

/**
 * Delete a floor (only if no dependencies)
 */
export async function deleteFloor(floorId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM floors WHERE floor_id = $1', [floorId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Floor deleted', { floorId });
  }

  return deleted;
}

/**
 * List floors with pagination and filters
 */
export async function listFloors(
  filters: FloorListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Floor>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.buildingId) {
    conditions.push(`f.building_id = $${paramIndex++}`);
    values.push(filters.buildingId);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`f.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM floors f ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results with room counts
  values.push(limit, offset);

  const rows = await queryMany<FloorRowWithRooms>(
    `SELECT f.*, 
            COALESCE((SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.floor_id), 0) as total_rooms
     FROM floors f
     ${whereClause}
     ORDER BY f.floor_number ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToFloor),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all active floors for a building (for dropdowns/selectors)
 */
export async function getActiveFloorsByBuildingId(buildingId: UUID): Promise<Floor[]> {
  const rows = await queryMany<FloorRowWithRooms>(
    `SELECT f.*, 
            COALESCE((SELECT COUNT(*) FROM rooms r WHERE r.floor_id = f.floor_id), 0) as total_rooms
     FROM floors f
     WHERE f.building_id = $1 AND f.is_active = TRUE
     ORDER BY f.floor_number ASC`,
    [buildingId]
  );

  return rows.map(mapRowToFloor);
}


// ============================================================================
// Room Repository Functions
// ============================================================================

/**
 * Check if a room number already exists in a floor
 * Used for uniqueness validation (unique constraint: floor_id + room_number)
 */
export async function roomNumberExistsInFloor(
  floorId: UUID,
  roomNumber: string,
  excludeRoomId?: UUID
): Promise<boolean> {
  const condition = excludeRoomId
    ? 'WHERE floor_id = $1 AND room_number = $2 AND room_id != $3'
    : 'WHERE floor_id = $1 AND room_number = $2';
  const params = excludeRoomId
    ? [floorId, roomNumber, excludeRoomId]
    : [floorId, roomNumber];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM rooms ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a floor exists
 * Requirement 3.5: Reject creation for non-existent floor
 */
export async function floorExists(floorId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM floors WHERE floor_id = $1) as exists',
    [floorId]
  );

  return result?.exists ?? false;
}

/**
 * Create a new room
 * Requirement 3.1: Create room with floor reference, room number, name, and type
 */
export async function createRoom(
  request: CreateRoomRequest,
  userId?: UUID
): Promise<Room> {
  const timestamp = now();

  const result = await queryOne<RoomRow>(
    `INSERT INTO rooms (
      floor_id, room_number, name, room_type, capacity, description,
      is_active, created_at, updated_at, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $7, $8, $8)
    RETURNING *`,
    [
      request.floorId,
      request.roomNumber,
      request.name,
      request.roomType,
      request.capacity ?? null,
      request.description ?? null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create room');
  }

  logger.info('Room created', {
    roomId: result.room_id,
    floorId: result.floor_id,
    roomNumber: result.room_number,
  });

  // Return with totalRacks = 0 for new room
  return mapRowToRoom({ ...result, total_racks: '0' });
}

/**
 * Get room by ID with rack count
 * Requirement 3.2: Return room details
 */
export async function getRoomById(roomId: UUID): Promise<Room | null> {
  const result = await queryOne<RoomRowWithRacks>(
    `SELECT r.*, 
            COALESCE((SELECT COUNT(*) FROM racks rk WHERE rk.room_id = r.room_id), 0) as total_racks
     FROM rooms r
     WHERE r.room_id = $1`,
    [roomId]
  );

  return result ? mapRowToRoom(result) : null;
}

/**
 * Get rooms for a floor ordered by room number
 * Requirement 3.2: Return all rooms for a floor ordered by room number
 */
export async function getRoomsByFloorId(floorId: UUID): Promise<Room[]> {
  const rows = await queryMany<RoomRowWithRacks>(
    `SELECT r.*, 
            COALESCE((SELECT COUNT(*) FROM racks rk WHERE rk.room_id = r.room_id), 0) as total_racks
     FROM rooms r
     WHERE r.floor_id = $1
     ORDER BY r.room_number ASC`,
    [floorId]
  );

  return rows.map(mapRowToRoom);
}

/**
 * Update room details
 * Requirement 3.3: Update specified fields and maintain floor relationship
 */
export async function updateRoom(
  roomId: UUID,
  request: UpdateRoomRequest,
  userId?: UUID
): Promise<Room | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.roomType !== undefined) {
    updates.push(`room_type = $${paramIndex++}`);
    values.push(request.roomType);
  }

  if (request.capacity !== undefined) {
    updates.push(`capacity = $${paramIndex++}`);
    values.push(request.capacity);
  }

  if (request.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(request.description);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getRoomById(roomId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(userId ?? null);

  values.push(roomId);

  const sql = `UPDATE rooms SET ${updates.join(', ')} WHERE room_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<RoomRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Room updated', { roomId });

  // Get rack count for the updated room
  const rackCount = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM racks WHERE room_id = $1',
    [roomId]
  );

  return mapRowToRoom({
    ...result,
    total_racks: rackCount?.count ?? '0',
  });
}

/**
 * Deactivate a room
 * Requirement 3.4: Mark room as inactive and prevent new rack/asset assignments
 */
export async function deactivateRoom(
  roomId: UUID,
  userId?: UUID
): Promise<Room | null> {
  return updateRoom(roomId, { isActive: false }, userId);
}

/**
 * Check if room has dependencies (racks or assets)
 */
export async function getRoomDependencies(roomId: UUID): Promise<{
  rackCount: number;
  assetCount: number;
}> {
  await ensureHardwareLocationSchemaCompatibility();

  const rackResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM racks WHERE room_id = $1',
    [roomId]
  );

  // Check for assets assigned to this room
  const assetResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM rooms r
     JOIN floors f ON r.floor_id = f.floor_id
     JOIN buildings b ON f.building_id = b.building_id
     JOIN hardware_assets ha ON ha.building = ANY (ARRAY[b.building_code, b.name])
       AND ha.floor = ANY (ARRAY[f.floor_number::text, f.name])
       AND ha.room = ANY (ARRAY[r.room_number, r.name])
     WHERE r.room_id = $1`,
    [roomId]
  );

  return {
    rackCount: parseInt(rackResult?.count ?? '0', 10),
    assetCount: parseInt(assetResult?.count ?? '0', 10),
  };
}

/**
 * Delete a room (only if no dependencies)
 */
export async function deleteRoom(roomId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM rooms WHERE room_id = $1', [roomId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Room deleted', { roomId });
  }

  return deleted;
}

/**
 * List rooms with pagination and filters
 */
export async function listRooms(
  filters: RoomListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Room>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.floorId) {
    conditions.push(`r.floor_id = $${paramIndex++}`);
    values.push(filters.floorId);
  }

  if (filters.roomType) {
    conditions.push(`r.room_type = $${paramIndex++}`);
    values.push(filters.roomType);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`r.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM rooms r ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results with rack counts
  values.push(limit, offset);

  const rows = await queryMany<RoomRowWithRacks>(
    `SELECT r.*, 
            COALESCE((SELECT COUNT(*) FROM racks rk WHERE rk.room_id = r.room_id), 0) as total_racks
     FROM rooms r
     ${whereClause}
     ORDER BY r.room_number ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToRoom),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all active rooms for a floor (for dropdowns/selectors)
 */
export async function getActiveRoomsByFloorId(floorId: UUID): Promise<Room[]> {
  const rows = await queryMany<RoomRowWithRacks>(
    `SELECT r.*, 
            COALESCE((SELECT COUNT(*) FROM racks rk WHERE rk.room_id = r.room_id), 0) as total_racks
     FROM rooms r
     WHERE r.floor_id = $1 AND r.is_active = TRUE
     ORDER BY r.room_number ASC`,
    [floorId]
  );

  return rows.map(mapRowToRoom);
}


// ============================================================================
// Rack Repository Functions
// ============================================================================

/**
 * Check if a rack name already exists in a room
 * Used for uniqueness validation (unique constraint: room_id + rack_name)
 */
export async function rackNameExistsInRoom(
  roomId: UUID,
  rackName: string,
  excludeRackId?: UUID
): Promise<boolean> {
  const condition = excludeRackId
    ? 'WHERE room_id = $1 AND rack_name = $2 AND rack_id != $3'
    : 'WHERE room_id = $1 AND rack_name = $2';
  const params = excludeRackId
    ? [roomId, rackName, excludeRackId]
    : [roomId, rackName];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM racks ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a room exists
 * Requirement 4.5: Reject creation for non-existent room
 */
export async function roomExists(roomId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM rooms WHERE room_id = $1) as exists',
    [roomId]
  );

  return result?.exists ?? false;
}

/**
 * Create a new rack
 * Requirement 4.1: Create rack with room reference, rack name, and total rack units
 */
export async function createRack(
  request: CreateRackRequest,
  userId?: UUID
): Promise<Rack> {
  const timestamp = now();

  const result = await queryOne<RackRow>(
    `INSERT INTO racks (
      room_id, rack_name, total_units, used_units, description,
      is_active, created_at, updated_at, created_by, updated_by
    ) VALUES ($1, $2, $3, 0, $4, TRUE, $5, $5, $6, $6)
    RETURNING *`,
    [
      request.roomId,
      request.rackName,
      request.totalUnits,
      request.description ?? null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create rack');
  }

  logger.info('Rack created', {
    rackId: result.rack_id,
    roomId: result.room_id,
    rackName: result.rack_name,
  });

  // Return with assetCount = 0 for new rack
  return mapRowToRack({ ...result, asset_count: '0' });
}

/**
 * Get rack by ID with asset count
 * Requirement 4.2: Return rack information including total units, used units, and available units
 */
export async function getRackById(rackId: UUID): Promise<Rack | null> {
  await ensureHardwareLocationSchemaCompatibility();

  const result = await queryOne<RackRowWithAssets>(
    `SELECT rk.*, 
            ${RACK_ASSET_COUNT_SUBQUERY} as asset_count
     FROM racks rk
     WHERE rk.rack_id = $1`,
    [rackId]
  );

  return result ? mapRowToRack(result) : null;
}

/**
 * Get racks for a room ordered by name
 * Requirement 4.2: Return all racks for a room ordered by name
 */
export async function getRacksByRoomId(roomId: UUID): Promise<Rack[]> {
  await ensureHardwareLocationSchemaCompatibility();

  const rows = await queryMany<RackRowWithAssets>(
    `SELECT rk.*, 
            ${RACK_ASSET_COUNT_SUBQUERY} as asset_count
     FROM racks rk
     WHERE rk.room_id = $1
     ORDER BY rk.rack_name ASC`,
    [roomId]
  );

  return rows.map(mapRowToRack);
}

/**
 * Update rack details
 * Requirement 4.3: Update specified fields and recalculate available units
 */
export async function updateRack(
  rackId: UUID,
  request: UpdateRackRequest,
  userId?: UUID
): Promise<Rack | null> {
  await ensureHardwareLocationSchemaCompatibility();

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.rackName !== undefined) {
    updates.push(`rack_name = $${paramIndex++}`);
    values.push(request.rackName);
  }

  if (request.totalUnits !== undefined) {
    updates.push(`total_units = $${paramIndex++}`);
    values.push(request.totalUnits);
  }

  if (request.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(request.description);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getRackById(rackId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(userId ?? null);

  values.push(rackId);

  const sql = `UPDATE racks SET ${updates.join(', ')} WHERE rack_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<RackRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Rack updated', { rackId });

  // Get asset count for the updated rack
  const assetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM racks rk
     JOIN rooms r ON rk.room_id = r.room_id
     JOIN floors f ON r.floor_id = f.floor_id
     JOIN buildings b ON f.building_id = b.building_id
     JOIN hardware_assets ha ON ha.building = ANY (ARRAY[b.building_code, b.name])
       AND ha.floor = ANY (ARRAY[f.floor_number::text, f.name])
       AND ha.room = ANY (ARRAY[r.room_number, r.name])
       AND ha.rack = rk.rack_name
     WHERE rk.rack_id = $1`,
    [rackId]
  );

  return mapRowToRack({
    ...result,
    asset_count: assetCount?.count ?? '0',
  });
}

/**
 * Deactivate a rack
 * Requirement 4.4: Mark rack as inactive and prevent new asset assignments
 */
export async function deactivateRack(
  rackId: UUID,
  userId?: UUID
): Promise<Rack | null> {
  return updateRack(rackId, { isActive: false }, userId);
}

/**
 * Check if rack has dependencies (mounted assets)
 * Requirement 4.5: Reject deletion if rack has mounted equipment
 */
export async function getRackDependencies(rackId: UUID): Promise<{
  assetCount: number;
}> {
  await ensureHardwareLocationSchemaCompatibility();

  // Check for assets mounted in this rack
  const assetResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM racks rk
     JOIN rooms r ON rk.room_id = r.room_id
     JOIN floors f ON r.floor_id = f.floor_id
     JOIN buildings b ON f.building_id = b.building_id
     JOIN hardware_assets ha ON ha.building = ANY (ARRAY[b.building_code, b.name])
       AND ha.floor = ANY (ARRAY[f.floor_number::text, f.name])
       AND ha.room = ANY (ARRAY[r.room_number, r.name])
       AND ha.rack = rk.rack_name
     WHERE rk.rack_id = $1`,
    [rackId]
  );

  return {
    assetCount: parseInt(assetResult?.count ?? '0', 10),
  };
}

/**
 * Delete a rack (only if no dependencies)
 * Requirement 4.5: Reject deletion if rack has mounted equipment
 */
export async function deleteRack(rackId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM racks WHERE rack_id = $1', [rackId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Rack deleted', { rackId });
  }

  return deleted;
}

/**
 * List racks with pagination and filters
 * Requirement 4.4: Return all racks with their utilization status
 */
export async function listRacks(
  filters: RackListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Rack>> {
  await ensureHardwareLocationSchemaCompatibility();

  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.roomId) {
    conditions.push(`rk.room_id = $${paramIndex++}`);
    values.push(filters.roomId);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`rk.is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.hasAvailableUnits === true) {
    conditions.push(`rk.used_units < rk.total_units`);
  } else if (filters.hasAvailableUnits === false) {
    conditions.push(`rk.used_units >= rk.total_units`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM racks rk ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results with asset counts
  values.push(limit, offset);

  const rows = await queryMany<RackRowWithAssets>(
    `SELECT rk.*, 
            ${RACK_ASSET_COUNT_SUBQUERY} as asset_count
     FROM racks rk
     ${whereClause}
     ORDER BY rk.rack_name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToRack),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all active racks for a room (for dropdowns/selectors)
 */
export async function getActiveRacksByRoomId(roomId: UUID): Promise<Rack[]> {
  await ensureHardwareLocationSchemaCompatibility();

  const rows = await queryMany<RackRowWithAssets>(
    `SELECT rk.*, 
            ${RACK_ASSET_COUNT_SUBQUERY} as asset_count
     FROM racks rk
     WHERE rk.room_id = $1 AND rk.is_active = TRUE
     ORDER BY rk.rack_name ASC`,
    [roomId]
  );

  return rows.map(mapRowToRack);
}

/**
 * Update rack used units
 * Used when assets are mounted/unmounted from a rack
 */
export async function updateRackUsedUnits(
  rackId: UUID,
  usedUnits: number,
  userId?: UUID
): Promise<Rack | null> {
  await ensureHardwareLocationSchemaCompatibility();

  const timestamp = now();

  const result = await queryOne<RackRow>(
    `UPDATE racks 
     SET used_units = $1, updated_at = $2, updated_by = $3
     WHERE rack_id = $4
     RETURNING *`,
    [usedUnits, timestamp, userId ?? null, rackId]
  );

  if (!result) {
    return null;
  }

  logger.info('Rack used units updated', { rackId, usedUnits });

  // Get asset count for the updated rack
  const assetCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM racks rk
     JOIN rooms r ON rk.room_id = r.room_id
     JOIN floors f ON r.floor_id = f.floor_id
     JOIN buildings b ON f.building_id = b.building_id
     JOIN hardware_assets ha ON ha.building = ANY (ARRAY[b.building_code, b.name])
       AND ha.floor = ANY (ARRAY[f.floor_number::text, f.name])
       AND ha.room = ANY (ARRAY[r.room_number, r.name])
       AND ha.rack = rk.rack_name
     WHERE rk.rack_id = $1`,
    [rackId]
  );

  return mapRowToRack({
    ...result,
    asset_count: assetCount?.count ?? '0',
  });
}
