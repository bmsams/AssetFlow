/**
 * Stockroom Repository - Data access layer for stockroom inventory
 *
 * Implements database operations for:
 * - Stockroom CRUD operations (Requirement 5.1-5.7)
 * - Stockroom inventory tracking (Requirement 3.2)
 * - Stock level queries for threshold monitoring (Requirement 3.3)
 */

import type { PaginatedResult, PaginationParams, StockroomType, UUID } from '@ams/types';
import { query, queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'stockroom-repository' });

/**
 * Stockroom entity
 */
export interface Stockroom {
  readonly stockroomId: UUID;
  readonly stockroomCode: string | null;
  readonly name: string;
  readonly location: string | null;
  readonly stockroomType: StockroomType | null;
  readonly managerId: UUID | null;
  readonly isActive: boolean;
  readonly description: string | null;
  readonly building: string | null;
  readonly floor: string | null;
  readonly room: string | null;
  readonly capacityUnits: number | null;
  readonly currentUtilization: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Product types for inventory
 */
export type ProductType =
  | 'HARDWARE_MODEL'
  | 'SOFTWARE_PRODUCT'
  | 'SPARE_PART'
  | 'CONSUMABLE'
  | 'ACCESSORY'
  | 'OTHER';

/**
 * Stockroom inventory item
 */
export interface StockroomInventoryItem {
  readonly inventoryId: UUID;
  readonly stockroomId: UUID;
  readonly productId: UUID | null;
  readonly productType: ProductType;
  readonly productSku: string | null;
  readonly productDescription: string | null;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly quantityInTransit: number;
  readonly quantityOnOrder: number;
  readonly reorderPoint: number | null;
  readonly reorderQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly unitOfMeasure: string;
  readonly unitCost: number | null;
  readonly binLocation: string | null;
  readonly shelfLocation: string | null;
  readonly isActive: boolean;
  readonly lastCountDate: string | null;
  readonly lastReceivedDate: string | null;
  readonly lastIssuedDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Inventory update request
 */
export interface UpdateInventoryRequest {
  readonly quantityOnHand?: number;
  readonly quantityReserved?: number;
  readonly quantityInTransit?: number;
  readonly quantityOnOrder?: number;
  readonly reorderPoint?: number;
  readonly reorderQuantity?: number;
  readonly maxQuantity?: number;
  readonly unitCost?: number;
  readonly binLocation?: string;
  readonly shelfLocation?: string;
  readonly isActive?: boolean;
}

/**
 * Create inventory request
 */
export interface CreateInventoryRequest {
  readonly stockroomId: UUID;
  readonly productId?: UUID;
  readonly productType: ProductType;
  readonly productSku?: string;
  readonly productDescription?: string;
  readonly quantityOnHand: number;
  readonly quantityReserved?: number;
  readonly reorderPoint?: number;
  readonly reorderQuantity?: number;
  readonly maxQuantity?: number;
  readonly unitOfMeasure?: string;
  readonly unitCost?: number;
  readonly binLocation?: string;
  readonly shelfLocation?: string;
}

/**
 * Low stock alert item
 */
export interface LowStockItem {
  readonly inventoryId: UUID;
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly productId: UUID | null;
  readonly productType: ProductType;
  readonly productSku: string | null;
  readonly productDescription: string | null;
  readonly quantityOnHand: number;
  readonly quantityAvailable: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number | null;
  readonly shortfall: number;
}

/**
 * Create stockroom request
 * Requirement 5.1: Create stockroom with location reference, name, and type
 */
export interface CreateStockroomRequest {
  readonly stockroomCode?: string;
  readonly name: string;
  readonly stockroomType?: StockroomType;
  readonly managerId?: UUID;
  readonly location?: string;
  readonly description?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly building?: string;
  readonly floor?: string;
  readonly room?: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly capacityUnits?: number;
  readonly parentStockroomId?: UUID;
  readonly costCenterId?: UUID;
}

/**
 * Update stockroom request
 * Requirement 5.3: Update specified fields and maintain location relationship
 */
export interface UpdateStockroomRequest {
  readonly name?: string;
  readonly stockroomType?: StockroomType;
  readonly managerId?: UUID | null;
  readonly location?: string;
  readonly description?: string;
  readonly addressLine1?: string;
  readonly addressLine2?: string;
  readonly city?: string;
  readonly stateProvince?: string;
  readonly postalCode?: string;
  readonly country?: string;
  readonly building?: string;
  readonly floor?: string;
  readonly room?: string;
  readonly contactName?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly capacityUnits?: number;
  readonly parentStockroomId?: UUID | null;
  readonly costCenterId?: UUID | null;
  readonly isActive?: boolean;
}

/**
 * Stockroom list filters
 */
export interface StockroomListFilters {
  readonly stockroomType?: StockroomType;
  readonly managerId?: UUID;
  readonly isActive?: boolean;
  readonly city?: string;
  readonly search?: string;
}

/**
 * Database row types
 */
interface StockroomRow {
  stockroom_id: string;
  stockroom_code: string | null;
  name: string;
  location: string | null;
  stockroom_type: StockroomType | null;
  manager_id: string | null;
  is_active: boolean;
  description: string | null;
  building: string | null;
  floor: string | null;
  room: string | null;
  capacity_units: number | null;
  current_utilization: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  parent_stockroom_id: string | null;
  cost_center_id: string | null;
}

interface InventoryRow {
  inventory_id: string;
  stockroom_id: string;
  product_id: string | null;
  product_type: ProductType;
  product_sku: string | null;
  product_description: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  quantity_in_transit: number | null;
  quantity_on_order: number | null;
  reorder_point: number | null;
  reorder_quantity: number | null;
  max_quantity: number | null;
  unit_of_measure: string;
  unit_cost: string | null;
  bin_location: string | null;
  shelf_location: string | null;
  is_active: boolean;
  last_count_date: string | null;
  last_received_date: string | null;
  last_issued_date: string | null;
  created_at: string;
  updated_at: string;
}

interface LowStockRow extends InventoryRow {
  stockroom_name: string;
  shortfall: number;
}

/**
 * Map database row to Stockroom entity
 */
function mapRowToStockroom(row: StockroomRow): Stockroom {
  return {
    stockroomId: row.stockroom_id,
    stockroomCode: row.stockroom_code,
    name: row.name,
    location: row.location,
    stockroomType: row.stockroom_type,
    managerId: row.manager_id,
    isActive: row.is_active,
    description: row.description,
    building: row.building,
    floor: row.floor,
    room: row.room,
    capacityUnits: row.capacity_units,
    currentUtilization: row.current_utilization,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to StockroomInventoryItem entity
 */
function mapRowToInventoryItem(row: InventoryRow): StockroomInventoryItem {
  return {
    inventoryId: row.inventory_id,
    stockroomId: row.stockroom_id,
    productId: row.product_id,
    productType: row.product_type,
    productSku: row.product_sku,
    productDescription: row.product_description,
    quantityOnHand: row.quantity_on_hand,
    quantityReserved: row.quantity_reserved,
    quantityAvailable: row.quantity_available,
    quantityInTransit: row.quantity_in_transit ?? 0,
    quantityOnOrder: row.quantity_on_order ?? 0,
    reorderPoint: row.reorder_point,
    reorderQuantity: row.reorder_quantity,
    maxQuantity: row.max_quantity,
    unitOfMeasure: row.unit_of_measure,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    binLocation: row.bin_location,
    shelfLocation: row.shelf_location,
    isActive: row.is_active,
    lastCountDate: row.last_count_date,
    lastReceivedDate: row.last_received_date,
    lastIssuedDate: row.last_issued_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to LowStockItem
 */
function mapRowToLowStockItem(row: LowStockRow): LowStockItem {
  return {
    inventoryId: row.inventory_id,
    stockroomId: row.stockroom_id,
    stockroomName: row.stockroom_name,
    productId: row.product_id,
    productType: row.product_type,
    productSku: row.product_sku,
    productDescription: row.product_description,
    quantityOnHand: row.quantity_on_hand,
    quantityAvailable: row.quantity_available,
    reorderPoint: row.reorder_point!,
    reorderQuantity: row.reorder_quantity,
    shortfall: row.shortfall,
  };
}

/**
 * Get stockroom by ID
 */
export async function getStockroomById(stockroomId: UUID): Promise<Stockroom | null> {
  const result = await queryOne<StockroomRow>(
    'SELECT * FROM stockrooms WHERE stockroom_id = $1',
    [stockroomId]
  );

  return result ? mapRowToStockroom(result) : null;
}

/**
 * Get all active stockrooms
 */
export async function getActiveStockrooms(): Promise<Stockroom[]> {
  const rows = await queryMany<StockroomRow>(
    'SELECT * FROM stockrooms WHERE is_active = TRUE ORDER BY name ASC'
  );

  return rows.map(mapRowToStockroom);
}

/**
 * Get stockroom inventory with pagination
 * Requirement 3.2: Track inventory quantities, locations, and stock levels
 */
export async function getStockroomInventory(
  stockroomId: UUID,
  pagination: PaginationParams = {},
  includeInactive = false
): Promise<PaginatedResult<StockroomInventoryItem>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const activeCondition = includeInactive ? '' : 'AND is_active = TRUE';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM stockroom_inventory WHERE stockroom_id = $1 ${activeCondition}`,
    [stockroomId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const rows = await queryMany<InventoryRow>(
    `SELECT * FROM stockroom_inventory 
     WHERE stockroom_id = $1 ${activeCondition}
     ORDER BY product_description ASC, product_sku ASC
     LIMIT $2 OFFSET $3`,
    [stockroomId, limit, offset]
  );

  return {
    items: rows.map(mapRowToInventoryItem),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get inventory item by ID
 */
export async function getInventoryItemById(inventoryId: UUID): Promise<StockroomInventoryItem | null> {
  const result = await queryOne<InventoryRow>(
    'SELECT * FROM stockroom_inventory WHERE inventory_id = $1',
    [inventoryId]
  );

  return result ? mapRowToInventoryItem(result) : null;
}

/**
 * Get inventory item by stockroom and product
 */
export async function getInventoryByProduct(
  stockroomId: UUID,
  productId: UUID,
  productType: ProductType
): Promise<StockroomInventoryItem | null> {
  const result = await queryOne<InventoryRow>(
    `SELECT * FROM stockroom_inventory 
     WHERE stockroom_id = $1 AND product_id = $2 AND product_type = $3`,
    [stockroomId, productId, productType]
  );

  return result ? mapRowToInventoryItem(result) : null;
}

/**
 * Create inventory item
 */
export async function createInventoryItem(
  request: CreateInventoryRequest
): Promise<StockroomInventoryItem> {
  const timestamp = now();

  const result = await queryOne<InventoryRow>(
    `INSERT INTO stockroom_inventory (
      stockroom_id, product_id, product_type, product_sku, product_description,
      quantity_on_hand, quantity_reserved, reorder_point, reorder_quantity,
      max_quantity, unit_of_measure, unit_cost, bin_location, shelf_location,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
    RETURNING *`,
    [
      request.stockroomId,
      request.productId ?? null,
      request.productType,
      request.productSku ?? null,
      request.productDescription ?? null,
      request.quantityOnHand,
      request.quantityReserved ?? 0,
      request.reorderPoint ?? null,
      request.reorderQuantity ?? null,
      request.maxQuantity ?? null,
      request.unitOfMeasure ?? 'EACH',
      request.unitCost ?? null,
      request.binLocation ?? null,
      request.shelfLocation ?? null,
      timestamp,
    ]
  );

  if (!result) {
    throw new Error('Failed to create inventory item');
  }

  logger.info('Inventory item created', {
    inventoryId: result.inventory_id,
    stockroomId: request.stockroomId,
    productType: request.productType,
  });

  return mapRowToInventoryItem(result);
}

/**
 * Update inventory item
 */
export async function updateInventoryItem(
  inventoryId: UUID,
  request: UpdateInventoryRequest
): Promise<StockroomInventoryItem | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.quantityOnHand !== undefined) {
    updates.push(`quantity_on_hand = $${paramIndex++}`);
    values.push(request.quantityOnHand);
  }

  if (request.quantityReserved !== undefined) {
    updates.push(`quantity_reserved = $${paramIndex++}`);
    values.push(request.quantityReserved);
  }

  if (request.quantityInTransit !== undefined) {
    updates.push(`quantity_in_transit = $${paramIndex++}`);
    values.push(request.quantityInTransit);
  }

  if (request.quantityOnOrder !== undefined) {
    updates.push(`quantity_on_order = $${paramIndex++}`);
    values.push(request.quantityOnOrder);
  }

  if (request.reorderPoint !== undefined) {
    updates.push(`reorder_point = $${paramIndex++}`);
    values.push(request.reorderPoint);
  }

  if (request.reorderQuantity !== undefined) {
    updates.push(`reorder_quantity = $${paramIndex++}`);
    values.push(request.reorderQuantity);
  }

  if (request.maxQuantity !== undefined) {
    updates.push(`max_quantity = $${paramIndex++}`);
    values.push(request.maxQuantity);
  }

  if (request.unitCost !== undefined) {
    updates.push(`unit_cost = $${paramIndex++}`);
    values.push(request.unitCost);
  }

  if (request.binLocation !== undefined) {
    updates.push(`bin_location = $${paramIndex++}`);
    values.push(request.binLocation);
  }

  if (request.shelfLocation !== undefined) {
    updates.push(`shelf_location = $${paramIndex++}`);
    values.push(request.shelfLocation);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getInventoryItemById(inventoryId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  values.push(inventoryId);

  const sql = `UPDATE stockroom_inventory SET ${updates.join(', ')} WHERE inventory_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<InventoryRow>(sql, values);

  if (result) {
    logger.info('Inventory item updated', { inventoryId });
  }

  return result ? mapRowToInventoryItem(result) : null;
}

/**
 * Adjust inventory quantity (add or subtract)
 * Uses transaction to ensure atomicity
 */
export async function adjustInventoryQuantity(
  inventoryId: UUID,
  adjustment: number,
  adjustmentType: 'received' | 'issued' | 'adjustment'
): Promise<StockroomInventoryItem | null> {
  return withTransaction(async (ctx) => {
    // Get current inventory with lock
    const current = await ctx.queryOne<InventoryRow>(
      'SELECT * FROM stockroom_inventory WHERE inventory_id = $1 FOR UPDATE',
      [inventoryId]
    );

    if (!current) {
      return null;
    }

    const newQuantity = current.quantity_on_hand + adjustment;
    if (newQuantity < 0) {
      throw new Error(`Insufficient inventory: current=${current.quantity_on_hand}, adjustment=${adjustment}`);
    }

    const timestamp = now();
    const dateField = adjustmentType === 'received' ? 'last_received_date' : 
                      adjustmentType === 'issued' ? 'last_issued_date' : null;

    let sql: string;
    let values: unknown[];

    if (dateField) {
      sql = `UPDATE stockroom_inventory 
             SET quantity_on_hand = $1, ${dateField} = $2, updated_at = $2 
             WHERE inventory_id = $3 RETURNING *`;
      values = [newQuantity, timestamp, inventoryId];
    } else {
      sql = `UPDATE stockroom_inventory 
             SET quantity_on_hand = $1, updated_at = $2 
             WHERE inventory_id = $3 RETURNING *`;
      values = [newQuantity, timestamp, inventoryId];
    }

    const result = await ctx.queryOne<InventoryRow>(sql, values);

    if (result) {
      logger.info('Inventory quantity adjusted', {
        inventoryId,
        previousQuantity: current.quantity_on_hand,
        adjustment,
        newQuantity,
        adjustmentType,
      });
    }

    return result ? mapRowToInventoryItem(result) : null;
  });
}

/**
 * Reserve inventory quantity
 */
export async function reserveInventory(
  inventoryId: UUID,
  quantity: number
): Promise<StockroomInventoryItem | null> {
  return withTransaction(async (ctx) => {
    // Get current inventory with lock
    const current = await ctx.queryOne<InventoryRow>(
      'SELECT * FROM stockroom_inventory WHERE inventory_id = $1 FOR UPDATE',
      [inventoryId]
    );

    if (!current) {
      return null;
    }

    const availableQuantity = current.quantity_on_hand - current.quantity_reserved;
    if (quantity > availableQuantity) {
      throw new Error(`Insufficient available inventory: available=${availableQuantity}, requested=${quantity}`);
    }

    const newReserved = current.quantity_reserved + quantity;
    const timestamp = now();

    const result = await ctx.queryOne<InventoryRow>(
      `UPDATE stockroom_inventory 
       SET quantity_reserved = $1, updated_at = $2 
       WHERE inventory_id = $3 RETURNING *`,
      [newReserved, timestamp, inventoryId]
    );

    if (result) {
      logger.info('Inventory reserved', {
        inventoryId,
        previousReserved: current.quantity_reserved,
        additionalReserved: quantity,
        newReserved,
      });
    }

    return result ? mapRowToInventoryItem(result) : null;
  });
}

/**
 * Release reserved inventory
 */
export async function releaseReservation(
  inventoryId: UUID,
  quantity: number
): Promise<StockroomInventoryItem | null> {
  return withTransaction(async (ctx) => {
    const current = await ctx.queryOne<InventoryRow>(
      'SELECT * FROM stockroom_inventory WHERE inventory_id = $1 FOR UPDATE',
      [inventoryId]
    );

    if (!current) {
      return null;
    }

    if (quantity > current.quantity_reserved) {
      throw new Error(`Cannot release more than reserved: reserved=${current.quantity_reserved}, requested=${quantity}`);
    }

    const newReserved = current.quantity_reserved - quantity;
    const timestamp = now();

    const result = await ctx.queryOne<InventoryRow>(
      `UPDATE stockroom_inventory 
       SET quantity_reserved = $1, updated_at = $2 
       WHERE inventory_id = $3 RETURNING *`,
      [newReserved, timestamp, inventoryId]
    );

    if (result) {
      logger.info('Reservation released', {
        inventoryId,
        previousReserved: current.quantity_reserved,
        released: quantity,
        newReserved,
      });
    }

    return result ? mapRowToInventoryItem(result) : null;
  });
}

/**
 * Get items below reorder point across all stockrooms
 * Requirement 3.3: Generate replenishment alerts when stock falls below threshold
 */
export async function getItemsBelowReorderPoint(
  stockroomId?: UUID
): Promise<LowStockItem[]> {
  const stockroomCondition = stockroomId ? 'AND si.stockroom_id = $1' : '';
  const params = stockroomId ? [stockroomId] : [];

  const rows = await queryMany<LowStockRow>(
    `SELECT 
      si.*,
      s.name as stockroom_name,
      (si.reorder_point - si.quantity_on_hand) as shortfall
     FROM stockroom_inventory si
     JOIN stockrooms s ON si.stockroom_id = s.stockroom_id
     WHERE si.is_active = TRUE
       AND si.reorder_point IS NOT NULL
       AND si.quantity_on_hand <= si.reorder_point
       ${stockroomCondition}
     ORDER BY shortfall DESC, s.name ASC`,
    params
  );

  return rows.map(mapRowToLowStockItem);
}

/**
 * Get inventory summary for a stockroom
 */
export async function getStockroomSummary(stockroomId: UUID): Promise<{
  totalItems: number;
  totalQuantity: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}> {
  const result = await queryOne<{
    total_items: string;
    total_quantity: string;
    total_value: string;
    low_stock_count: string;
    out_of_stock_count: string;
  }>(
    `SELECT 
      COUNT(*) as total_items,
      COALESCE(SUM(quantity_on_hand), 0) as total_quantity,
      COALESCE(SUM(quantity_on_hand * COALESCE(unit_cost, 0)), 0) as total_value,
      COUNT(*) FILTER (WHERE reorder_point IS NOT NULL AND quantity_on_hand <= reorder_point AND quantity_on_hand > 0) as low_stock_count,
      COUNT(*) FILTER (WHERE quantity_on_hand = 0) as out_of_stock_count
     FROM stockroom_inventory
     WHERE stockroom_id = $1 AND is_active = TRUE`,
    [stockroomId]
  );

  return {
    totalItems: parseInt(result?.total_items ?? '0', 10),
    totalQuantity: parseInt(result?.total_quantity ?? '0', 10),
    totalValue: parseFloat(result?.total_value ?? '0'),
    lowStockCount: parseInt(result?.low_stock_count ?? '0', 10),
    outOfStockCount: parseInt(result?.out_of_stock_count ?? '0', 10),
  };
}


// ============================================================================
// Stockroom CRUD Functions
// ============================================================================

/**
 * Check if a stockroom name already exists in a location
 * Used for uniqueness validation
 * Requirement 5.1: Ensure unique stockroom names within a location
 */
export async function stockroomNameExistsInLocation(
  locationId: UUID | null,
  name: string,
  excludeId?: UUID
): Promise<boolean> {
  // If locationId is null, check globally for name uniqueness
  const locationCondition = locationId
    ? 'AND (building = $2 OR location = $2)'
    : 'AND building IS NULL AND location IS NULL';
  
  const excludeCondition = excludeId ? 'AND stockroom_id != $3' : '';
  
  const params: unknown[] = [name];
  if (locationId) {
    params.push(locationId);
  }
  if (excludeId) {
    params.push(excludeId);
  }

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM stockrooms 
      WHERE LOWER(name) = LOWER($1) ${locationCondition} ${excludeCondition}
    ) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a stockroom code already exists
 * Used for uniqueness validation
 */
export async function stockroomCodeExists(
  stockroomCode: string,
  excludeId?: UUID
): Promise<boolean> {
  const condition = excludeId
    ? 'WHERE stockroom_code = $1 AND stockroom_id != $2'
    : 'WHERE stockroom_code = $1';
  const params = excludeId ? [stockroomCode, excludeId] : [stockroomCode];

  const result = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM stockrooms ${condition}) as exists`,
    params
  );

  return result?.exists ?? false;
}

/**
 * Check if a location (building) exists
 * Requirement 5.5: Reject creation for non-existent location
 */
export async function locationExists(locationId: UUID): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM buildings WHERE building_id = $1) as exists',
    [locationId]
  );

  return result?.exists ?? false;
}

/**
 * Create a new stockroom
 * Requirement 5.1: Create stockroom with location reference, name, and type
 */
export async function createStockroom(
  request: CreateStockroomRequest,
  userId?: UUID
): Promise<Stockroom> {
  const timestamp = now();

  const result = await queryOne<StockroomRow>(
    `INSERT INTO stockrooms (
      stockroom_code, name, stockroom_type, manager_id, location, description,
      address_line1, address_line2, city, state_province, postal_code, country,
      building, floor, room, contact_name, contact_email, contact_phone,
      capacity_units, parent_stockroom_id, cost_center_id,
      is_active, created_at, updated_at, created_by, updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, TRUE, $22, $22, $23, $23)
    RETURNING *`,
    [
      request.stockroomCode ?? null,
      request.name,
      request.stockroomType ?? null,
      request.managerId ?? null,
      request.location ?? null,
      request.description ?? null,
      request.addressLine1 ?? null,
      request.addressLine2 ?? null,
      request.city ?? null,
      request.stateProvince ?? null,
      request.postalCode ?? null,
      request.country ?? 'USA',
      request.building ?? null,
      request.floor ?? null,
      request.room ?? null,
      request.contactName ?? null,
      request.contactEmail ?? null,
      request.contactPhone ?? null,
      request.capacityUnits ?? null,
      request.parentStockroomId ?? null,
      request.costCenterId ?? null,
      timestamp,
      userId ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create stockroom');
  }

  logger.info('Stockroom created', {
    stockroomId: result.stockroom_id,
    stockroomCode: result.stockroom_code,
    name: result.name,
  });

  return mapRowToStockroom(result);
}

/**
 * Update stockroom details
 * Requirement 5.3: Update specified fields and preserve unchanged fields
 */
export async function updateStockroom(
  stockroomId: UUID,
  request: UpdateStockroomRequest,
  userId?: UUID
): Promise<Stockroom | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(request.name);
  }

  if (request.stockroomType !== undefined) {
    updates.push(`stockroom_type = $${paramIndex++}`);
    values.push(request.stockroomType);
  }

  if (request.managerId !== undefined) {
    updates.push(`manager_id = $${paramIndex++}`);
    values.push(request.managerId);
  }

  if (request.location !== undefined) {
    updates.push(`location = $${paramIndex++}`);
    values.push(request.location);
  }

  if (request.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(request.description);
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

  if (request.building !== undefined) {
    updates.push(`building = $${paramIndex++}`);
    values.push(request.building);
  }

  if (request.floor !== undefined) {
    updates.push(`floor = $${paramIndex++}`);
    values.push(request.floor);
  }

  if (request.room !== undefined) {
    updates.push(`room = $${paramIndex++}`);
    values.push(request.room);
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

  if (request.capacityUnits !== undefined) {
    updates.push(`capacity_units = $${paramIndex++}`);
    values.push(request.capacityUnits);
  }

  if (request.parentStockroomId !== undefined) {
    updates.push(`parent_stockroom_id = $${paramIndex++}`);
    values.push(request.parentStockroomId);
  }

  if (request.costCenterId !== undefined) {
    updates.push(`cost_center_id = $${paramIndex++}`);
    values.push(request.costCenterId);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (updates.length === 0) {
    return getStockroomById(stockroomId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  updates.push(`updated_by = $${paramIndex++}`);
  values.push(userId ?? null);

  values.push(stockroomId);

  const sql = `UPDATE stockrooms SET ${updates.join(', ')} WHERE stockroom_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<StockroomRow>(sql, values);

  if (!result) {
    return null;
  }

  logger.info('Stockroom updated', { stockroomId });

  return mapRowToStockroom(result);
}

/**
 * Deactivate a stockroom
 * Requirement 5.4: Mark stockroom as inactive and prevent new inventory assignments
 */
export async function deactivateStockroom(
  stockroomId: UUID,
  userId?: UUID
): Promise<Stockroom | null> {
  return updateStockroom(stockroomId, { isActive: false }, userId);
}

/**
 * Reactivate a stockroom
 * Requirement 5.5: Mark stockroom as active and allow inventory operations
 */
export async function reactivateStockroom(
  stockroomId: UUID,
  userId?: UUID
): Promise<Stockroom | null> {
  return updateStockroom(stockroomId, { isActive: true }, userId);
}

/**
 * Check if stockroom has dependencies (bin locations or inventory)
 * Requirement 5.7: Reject deletion if stockroom has inventory
 */
export async function getStockroomDependencies(stockroomId: UUID): Promise<{
  binLocationCount: number;
  inventoryCount: number;
}> {
  const binResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM bin_locations WHERE stockroom_id = $1',
    [stockroomId]
  );

  const inventoryResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM stockroom_inventory WHERE stockroom_id = $1',
    [stockroomId]
  );

  return {
    binLocationCount: parseInt(binResult?.count ?? '0', 10),
    inventoryCount: parseInt(inventoryResult?.count ?? '0', 10),
  };
}

/**
 * Delete a stockroom (only if no dependencies)
 * Requirement 5.7: Reject deletion if stockroom has inventory
 */
export async function deleteStockroom(stockroomId: UUID): Promise<boolean> {
  const result = await query('DELETE FROM stockrooms WHERE stockroom_id = $1', [stockroomId]);

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Stockroom deleted', { stockroomId });
  }

  return deleted;
}

/**
 * List stockrooms with pagination and filters
 * Requirement 5.6: Return paginated list of stockrooms matching criteria
 */
export async function listStockrooms(
  filters: StockroomListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Stockroom>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.stockroomType) {
    conditions.push(`stockroom_type = $${paramIndex++}`);
    values.push(filters.stockroomType);
  }

  if (filters.managerId) {
    conditions.push(`manager_id = $${paramIndex++}`);
    values.push(filters.managerId);
  }

  if (filters.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(filters.isActive);
  }

  if (filters.city) {
    conditions.push(`city ILIKE $${paramIndex++}`);
    values.push(`%${filters.city}%`);
  }

  if (filters.search) {
    conditions.push(`(name ILIKE $${paramIndex} OR stockroom_code ILIKE $${paramIndex} OR location ILIKE $${paramIndex})`);
    values.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM stockrooms ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  values.push(limit, offset);

  const rows = await queryMany<StockroomRow>(
    `SELECT * FROM stockrooms
     ${whereClause}
     ORDER BY name ASC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );

  return {
    items: rows.map(mapRowToStockroom),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get stockrooms by location (building)
 * Requirement 5.2: Return all stockrooms for a location ordered by name
 */
export async function getStockroomsByLocation(locationId: UUID): Promise<Stockroom[]> {
  const rows = await queryMany<StockroomRow>(
    `SELECT * FROM stockrooms 
     WHERE building = $1 OR location = $1
     ORDER BY name ASC`,
    [locationId]
  );

  return rows.map(mapRowToStockroom);
}

/**
 * Get stockroom by code
 */
export async function getStockroomByCode(stockroomCode: string): Promise<Stockroom | null> {
  const result = await queryOne<StockroomRow>(
    'SELECT * FROM stockrooms WHERE stockroom_code = $1',
    [stockroomCode]
  );

  return result ? mapRowToStockroom(result) : null;
}
