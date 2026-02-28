/**
 * Parts Inventory Repository - Data access layer for spare parts management
 *
 * Implements database operations for:
 * - Spare parts CRUD operations (Requirement 5.4)
 * - Part reservation for work orders (Requirement 5.5)
 * - Stock level monitoring and replenishment alerts
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'parts-inventory-repository' });

/**
 * Part category
 */
export type PartCategory =
  | 'MECHANICAL'
  | 'ELECTRICAL'
  | 'ELECTRONIC'
  | 'HYDRAULIC'
  | 'PNEUMATIC'
  | 'FILTER'
  | 'BEARING'
  | 'SEAL'
  | 'BELT'
  | 'FASTENER'
  | 'LUBRICANT'
  | 'CONSUMABLE'
  | 'SAFETY'
  | 'OTHER';

/**
 * Unit of measure
 */
export type UnitOfMeasure =
  | 'EACH'
  | 'BOX'
  | 'CASE'
  | 'PACK'
  | 'SET'
  | 'KIT'
  | 'ROLL'
  | 'GALLON'
  | 'LITER'
  | 'POUND'
  | 'KILOGRAM'
  | 'FOOT'
  | 'METER';

/**
 * ABC classification for inventory
 */
export type ABCClassification = 'A' | 'B' | 'C';

/**
 * Reservation status
 */
export type ReservationStatus =
  | 'PENDING'
  | 'RESERVED'
  | 'PARTIALLY_RESERVED'
  | 'ISSUED'
  | 'USED'
  | 'RETURNED'
  | 'CANCELLED';

/**
 * Spare part entity
 */
export interface SparePart {
  readonly partId: UUID;
  readonly partNumber: string;
  readonly partName: string | null;
  readonly description: string | null;
  readonly manufacturer: string | null;
  readonly category: PartCategory | null;
  readonly uom: UnitOfMeasure;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly unitCost: number | null;
  readonly storageLocation: string | null;
  readonly leadTimeDays: number | null;
  readonly preferredVendorId: UUID | null;
  readonly vendorPartNumber: string | null;
  readonly lastPurchasePrice: number | null;
  readonly lastPurchaseDate: string | null;
  readonly lastCountDate: string | null;
  readonly lastCountQuantity: number | null;
  readonly abcClassification: ABCClassification | null;
  readonly isActive: boolean;
  readonly isCritical: boolean;
  readonly obsoleteDate: string | null;
  readonly replacementPartId: UUID | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}


/**
 * Work order part entity
 */
export interface WorkOrderPart {
  readonly id: UUID;
  readonly workOrderId: UUID;
  readonly partId: UUID;
  readonly quantityRequired: number;
  readonly quantityReserved: number;
  readonly quantityUsed: number;
  readonly reservationStatus: ReservationStatus;
  readonly reservedDate: string | null;
  readonly issuedDate: string | null;
  readonly issuedBy: UUID | null;
  readonly returnedQuantity: number;
  readonly returnedDate: string | null;
  readonly unitCostAtIssue: number | null;
  readonly totalCost: number | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Part requirement for reservation
 */
export interface PartRequirement {
  readonly partId: UUID;
  readonly quantityRequired: number;
}

/**
 * Part reservation result
 */
export interface PartReservation {
  readonly reservationId: UUID;
  readonly workOrderId: UUID;
  readonly parts: readonly {
    readonly partId: UUID;
    readonly partNumber: string;
    readonly quantityRequested: number;
    readonly quantityReserved: number;
    readonly fullyReserved: boolean;
  }[];
  readonly reservedAt: string;
  readonly allPartsReserved: boolean;
}

/**
 * Part replenishment alert
 */
export interface PartReplenishmentAlert {
  readonly alertId: string;
  readonly partId: UUID;
  readonly partNumber: string;
  readonly partName: string | null;
  readonly currentQuantity: number;
  readonly reorderPoint: number;
  readonly quantityBelowReorder: number;
  readonly suggestedOrderQuantity: number;
  readonly unitCost: number | null;
  readonly estimatedOrderCost: number | null;
  readonly isCritical: boolean;
  readonly preferredVendorId: UUID | null;
  readonly createdAt: string;
}

/**
 * Database row types
 */
interface SparePartRow {
  part_id: string;
  part_number: string;
  part_name: string | null;
  description: string | null;
  manufacturer: string | null;
  category: PartCategory | null;
  uom: UnitOfMeasure;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_point: number;
  reorder_quantity: number | null;
  max_quantity: number | null;
  unit_cost: string | null;
  storage_location: string | null;
  lead_time_days: number | null;
  preferred_vendor_id: string | null;
  vendor_part_number: string | null;
  last_purchase_price: string | null;
  last_purchase_date: string | null;
  last_count_date: string | null;
  last_count_quantity: number | null;
  abc_classification: ABCClassification | null;
  is_active: boolean;
  is_critical: boolean;
  obsolete_date: string | null;
  replacement_part_id: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkOrderPartRow {
  id: string;
  work_order_id: string;
  part_id: string;
  quantity_required: number;
  quantity_reserved: number;
  quantity_used: number;
  reservation_status: ReservationStatus;
  reserved_date: string | null;
  issued_date: string | null;
  issued_by: string | null;
  returned_quantity: number;
  returned_date: string | null;
  unit_cost_at_issue: string | null;
  total_cost: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database row to SparePart entity
 */
function mapRowToSparePart(row: SparePartRow): SparePart {
  return {
    partId: row.part_id,
    partNumber: row.part_number,
    partName: row.part_name,
    description: row.description,
    manufacturer: row.manufacturer,
    category: row.category,
    uom: row.uom,
    quantityOnHand: row.quantity_on_hand,
    quantityReserved: row.quantity_reserved,
    quantityAvailable: row.quantity_available,
    reorderPoint: row.reorder_point,
    reorderQuantity: row.reorder_quantity,
    maxQuantity: row.max_quantity,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    storageLocation: row.storage_location,
    leadTimeDays: row.lead_time_days,
    preferredVendorId: row.preferred_vendor_id,
    vendorPartNumber: row.vendor_part_number,
    lastPurchasePrice: row.last_purchase_price ? parseFloat(row.last_purchase_price) : null,
    lastPurchaseDate: row.last_purchase_date,
    lastCountDate: row.last_count_date,
    lastCountQuantity: row.last_count_quantity,
    abcClassification: row.abc_classification,
    isActive: row.is_active,
    isCritical: row.is_critical,
    obsoleteDate: row.obsolete_date,
    replacementPartId: row.replacement_part_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to WorkOrderPart entity
 */
function mapRowToWorkOrderPart(row: WorkOrderPartRow): WorkOrderPart {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    partId: row.part_id,
    quantityRequired: row.quantity_required,
    quantityReserved: row.quantity_reserved,
    quantityUsed: row.quantity_used,
    reservationStatus: row.reservation_status,
    reservedDate: row.reserved_date,
    issuedDate: row.issued_date,
    issuedBy: row.issued_by,
    returnedQuantity: row.returned_quantity,
    returnedDate: row.returned_date,
    unitCostAtIssue: row.unit_cost_at_issue ? parseFloat(row.unit_cost_at_issue) : null,
    totalCost: row.total_cost ? parseFloat(row.total_cost) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// SPARE PARTS OPERATIONS
// ============================================================================

/**
 * Get spare part by ID
 */
export async function getSparePartById(partId: UUID): Promise<SparePart | null> {
  const result = await queryOne<SparePartRow>(
    'SELECT * FROM spare_parts WHERE part_id = $1',
    [partId]
  );

  return result ? mapRowToSparePart(result) : null;
}

/**
 * Get spare part by part number
 */
export async function getSparePartByNumber(partNumber: string): Promise<SparePart | null> {
  const result = await queryOne<SparePartRow>(
    'SELECT * FROM spare_parts WHERE part_number = $1',
    [partNumber]
  );

  return result ? mapRowToSparePart(result) : null;
}

/**
 * Get all spare parts with pagination
 */
export async function getSpareParts(
  pagination: PaginationParams = {},
  activeOnly = true
): Promise<PaginatedResult<SparePart>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;
  const activeCondition = activeOnly ? 'WHERE is_active = TRUE' : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM spare_parts ${activeCondition}`
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<SparePartRow>(
    `SELECT * FROM spare_parts 
     ${activeCondition}
     ORDER BY part_number ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return {
    items: rows.map(mapRowToSparePart),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get spare parts by category
 */
export async function getSparePartsByCategory(
  category: PartCategory,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<SparePart>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM spare_parts WHERE category = $1 AND is_active = TRUE',
    [category]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<SparePartRow>(
    `SELECT * FROM spare_parts 
     WHERE category = $1 AND is_active = TRUE
     ORDER BY part_number ASC
     LIMIT $2 OFFSET $3`,
    [category, limit, offset]
  );

  return {
    items: rows.map(mapRowToSparePart),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}


// ============================================================================
// PART RESERVATION OPERATIONS
// Requirement 5.5: Reserve parts for work orders
// ============================================================================

/**
 * Reserve parts for a work order
 * Requirement 5.5: WHEN a work order requires parts, THE Parts_Inventory_Service 
 * SHALL reserve parts and update availability
 */
export async function reservePartsForWorkOrder(
  workOrderId: UUID,
  parts: readonly PartRequirement[]
): Promise<PartReservation> {
  return withTransaction(async (ctx) => {
    const timestamp = now();
    const reservedParts: PartReservation['parts'][number][] = [];
    let allPartsReserved = true;

    for (const requirement of parts) {
      // Get the part with lock to prevent race conditions
      const part = await ctx.queryOne<SparePartRow>(
        'SELECT * FROM spare_parts WHERE part_id = $1 FOR UPDATE',
        [requirement.partId]
      );

      if (!part) {
        throw new Error(`Part not found: ${requirement.partId}`);
      }

      if (!part.is_active) {
        throw new Error(`Part is not active: ${part.part_number}`);
      }

      // Calculate how much we can reserve
      const availableToReserve = part.quantity_available;
      const quantityToReserve = Math.min(requirement.quantityRequired, availableToReserve);
      const fullyReserved = quantityToReserve >= requirement.quantityRequired;

      if (!fullyReserved) {
        allPartsReserved = false;
      }

      // Check if work order part record already exists
      const existingWop = await ctx.queryOne<WorkOrderPartRow>(
        'SELECT * FROM work_order_parts WHERE work_order_id = $1 AND part_id = $2',
        [workOrderId, requirement.partId]
      );

      if (existingWop) {
        // Update existing record
        const newQuantityReserved = existingWop.quantity_reserved + quantityToReserve;
        const newStatus: ReservationStatus = 
          newQuantityReserved >= existingWop.quantity_required ? 'RESERVED' : 'PARTIALLY_RESERVED';

        await ctx.queryOne(
          `UPDATE work_order_parts 
           SET quantity_reserved = $1, 
               reservation_status = $2,
               reserved_date = COALESCE(reserved_date, $3),
               updated_at = $3
           WHERE id = $4`,
          [newQuantityReserved, newStatus, timestamp, existingWop.id]
        );
      } else {
        // Create new work order part record
        const status: ReservationStatus = fullyReserved ? 'RESERVED' : 'PARTIALLY_RESERVED';

        await ctx.queryOne(
          `INSERT INTO work_order_parts (
            work_order_id, part_id, quantity_required, quantity_reserved,
            reservation_status, reserved_date, unit_cost_at_issue, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $6, $6)`,
          [
            workOrderId,
            requirement.partId,
            requirement.quantityRequired,
            quantityToReserve,
            status,
            timestamp,
            part.unit_cost,
          ]
        );
      }

      // Update spare part reserved quantity
      if (quantityToReserve > 0) {
        await ctx.queryOne(
          `UPDATE spare_parts 
           SET quantity_reserved = quantity_reserved + $1,
               updated_at = $2
           WHERE part_id = $3`,
          [quantityToReserve, timestamp, requirement.partId]
        );
      }

      reservedParts.push({
        partId: requirement.partId,
        partNumber: part.part_number,
        quantityRequested: requirement.quantityRequired,
        quantityReserved: quantityToReserve,
        fullyReserved,
      });

      logger.info('Part reserved for work order', {
        workOrderId,
        partId: requirement.partId,
        partNumber: part.part_number,
        quantityRequested: requirement.quantityRequired,
        quantityReserved: quantityToReserve,
        fullyReserved,
      });
    }

    return {
      reservationId: workOrderId, // Using work order ID as reservation ID
      workOrderId,
      parts: reservedParts,
      reservedAt: timestamp,
      allPartsReserved,
    };
  });
}

/**
 * Consume reserved parts (mark as used)
 * Called when parts are actually used in a work order
 */
export async function consumePartsForWorkOrder(
  workOrderId: UUID,
  partsUsed?: readonly { partId: UUID; quantityUsed: number }[]
): Promise<WorkOrderPart[]> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get all work order parts
    const wopRows = await ctx.queryMany<WorkOrderPartRow>(
      `SELECT * FROM work_order_parts 
       WHERE work_order_id = $1 
       FOR UPDATE`,
      [workOrderId]
    );

    if (wopRows.length === 0) {
      throw new Error(`No parts found for work order: ${workOrderId}`);
    }

    const consumedParts: WorkOrderPart[] = [];

    for (const wop of wopRows) {
      // Determine quantity to consume
      let quantityToConsume: number;
      
      if (partsUsed) {
        const partUsage = partsUsed.find(p => p.partId === wop.part_id);
        quantityToConsume = partUsage?.quantityUsed ?? 0;
      } else {
        // If no specific usage provided, consume all reserved
        quantityToConsume = wop.quantity_reserved;
      }

      if (quantityToConsume <= 0) {
        continue;
      }

      // Validate quantity
      if (quantityToConsume > wop.quantity_reserved) {
        throw new Error(
          `Cannot consume ${quantityToConsume} of part ${wop.part_id}. Only ${wop.quantity_reserved} reserved.`
        );
      }

      // Update work order part
      const result = await ctx.queryOne<WorkOrderPartRow>(
        `UPDATE work_order_parts 
         SET quantity_used = quantity_used + $1,
             quantity_reserved = quantity_reserved - $1,
             reservation_status = 'USED',
             total_cost = COALESCE(unit_cost_at_issue, 0) * (quantity_used + $1),
             updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [quantityToConsume, timestamp, wop.id]
      );

      if (result) {
        consumedParts.push(mapRowToWorkOrderPart(result));
      }

      // Update spare part inventory (reduce on-hand, reduce reserved)
      await ctx.queryOne(
        `UPDATE spare_parts 
         SET quantity_on_hand = quantity_on_hand - $1,
             quantity_reserved = quantity_reserved - $1,
             updated_at = $2
         WHERE part_id = $3`,
        [quantityToConsume, timestamp, wop.part_id]
      );

      logger.info('Part consumed for work order', {
        workOrderId,
        partId: wop.part_id,
        quantityConsumed: quantityToConsume,
      });
    }

    return consumedParts;
  });
}

/**
 * Cancel part reservation for a work order
 */
export async function cancelPartReservation(
  workOrderId: UUID,
  partId?: UUID
): Promise<void> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Build query based on whether specific part or all parts
    const whereClause = partId 
      ? 'WHERE work_order_id = $1 AND part_id = $2'
      : 'WHERE work_order_id = $1';
    const params = partId ? [workOrderId, partId] : [workOrderId];

    // Get work order parts to cancel
    const wopRows = await ctx.queryMany<WorkOrderPartRow>(
      `SELECT * FROM work_order_parts ${whereClause} FOR UPDATE`,
      params
    );

    for (const wop of wopRows) {
      if (wop.quantity_reserved > 0) {
        // Return reserved quantity to available
        await ctx.queryOne(
          `UPDATE spare_parts 
           SET quantity_reserved = quantity_reserved - $1,
               updated_at = $2
           WHERE part_id = $3`,
          [wop.quantity_reserved, timestamp, wop.part_id]
        );
      }

      // Update work order part status
      await ctx.queryOne(
        `UPDATE work_order_parts 
         SET quantity_reserved = 0,
             reservation_status = 'CANCELLED',
             updated_at = $1
         WHERE id = $2`,
        [timestamp, wop.id]
      );

      logger.info('Part reservation cancelled', {
        workOrderId,
        partId: wop.part_id,
        quantityReleased: wop.quantity_reserved,
      });
    }
  });
}


// ============================================================================
// STOCK LEVEL OPERATIONS
// Requirement 5.4: Manage spare parts inventory
// ============================================================================

/**
 * Check part stock levels and generate replenishment alerts
 * Requirement 5.4: THE Parts_Inventory_Service SHALL manage spare parts inventory
 */
export async function checkPartLevels(): Promise<PartReplenishmentAlert[]> {
  const timestamp = now();

  // Find all parts where quantity_available is at or below reorder point
  const rows = await queryMany<SparePartRow>(
    `SELECT * FROM spare_parts 
     WHERE is_active = TRUE 
       AND reorder_point IS NOT NULL
       AND quantity_available <= reorder_point
     ORDER BY is_critical DESC, quantity_available ASC`
  );

  const alerts: PartReplenishmentAlert[] = rows.map((row, index) => {
    const part = mapRowToSparePart(row);
    const quantityBelowReorder = part.reorderPoint - part.quantityAvailable;
    const suggestedOrderQuantity = part.reorderQuantity ?? Math.max(quantityBelowReorder, part.reorderPoint);
    const estimatedOrderCost = part.unitCost ? part.unitCost * suggestedOrderQuantity : null;

    return {
      alertId: `REPL-${Date.now()}-${index}`,
      partId: part.partId,
      partNumber: part.partNumber,
      partName: part.partName,
      currentQuantity: part.quantityAvailable,
      reorderPoint: part.reorderPoint,
      quantityBelowReorder,
      suggestedOrderQuantity,
      unitCost: part.unitCost,
      estimatedOrderCost,
      isCritical: part.isCritical,
      preferredVendorId: part.preferredVendorId,
      createdAt: timestamp,
    };
  });

  logger.info('Part level check completed', {
    totalPartsChecked: rows.length,
    alertsGenerated: alerts.length,
    criticalAlerts: alerts.filter(a => a.isCritical).length,
  });

  return alerts;
}

/**
 * Get parts below reorder point
 */
export async function getPartsBelowReorderPoint(): Promise<SparePart[]> {
  const rows = await queryMany<SparePartRow>(
    `SELECT * FROM spare_parts 
     WHERE is_active = TRUE 
       AND reorder_point IS NOT NULL
       AND quantity_available <= reorder_point
     ORDER BY is_critical DESC, quantity_available ASC`
  );

  return rows.map(mapRowToSparePart);
}

/**
 * Get critical parts with low stock
 */
export async function getCriticalPartsLowStock(): Promise<SparePart[]> {
  const rows = await queryMany<SparePartRow>(
    `SELECT * FROM spare_parts 
     WHERE is_active = TRUE 
       AND is_critical = TRUE
       AND reorder_point IS NOT NULL
       AND quantity_available <= reorder_point
     ORDER BY quantity_available ASC`
  );

  return rows.map(mapRowToSparePart);
}

/**
 * Update part quantity on hand
 */
export async function updatePartQuantity(
  partId: UUID,
  quantityChange: number,
  reason: string
): Promise<SparePart | null> {
  const timestamp = now();

  const result = await queryOne<SparePartRow>(
    `UPDATE spare_parts 
     SET quantity_on_hand = quantity_on_hand + $1,
         updated_at = $2
     WHERE part_id = $3
     RETURNING *`,
    [quantityChange, timestamp, partId]
  );

  if (result) {
    logger.info('Part quantity updated', {
      partId,
      quantityChange,
      newQuantityOnHand: result.quantity_on_hand,
      reason,
    });
  }

  return result ? mapRowToSparePart(result) : null;
}

/**
 * Record part receipt (increase inventory)
 */
export async function recordPartReceipt(
  partId: UUID,
  quantityReceived: number,
  purchasePrice?: number
): Promise<SparePart | null> {
  const timestamp = now();
  const today = new Date().toISOString().split('T')[0];

  const result = await queryOne<SparePartRow>(
    `UPDATE spare_parts 
     SET quantity_on_hand = quantity_on_hand + $1,
         last_purchase_price = COALESCE($2, last_purchase_price),
         last_purchase_date = $3,
         updated_at = $4
     WHERE part_id = $5
     RETURNING *`,
    [quantityReceived, purchasePrice ?? null, today, timestamp, partId]
  );

  if (result) {
    logger.info('Part receipt recorded', {
      partId,
      quantityReceived,
      newQuantityOnHand: result.quantity_on_hand,
    });
  }

  return result ? mapRowToSparePart(result) : null;
}

// ============================================================================
// WORK ORDER PARTS QUERIES
// ============================================================================

/**
 * Get work order parts by work order ID
 */
export async function getWorkOrderParts(workOrderId: UUID): Promise<WorkOrderPart[]> {
  const rows = await queryMany<WorkOrderPartRow>(
    `SELECT * FROM work_order_parts 
     WHERE work_order_id = $1
     ORDER BY created_at ASC`,
    [workOrderId]
  );

  return rows.map(mapRowToWorkOrderPart);
}

/**
 * Get work order part by ID
 */
export async function getWorkOrderPartById(id: UUID): Promise<WorkOrderPart | null> {
  const result = await queryOne<WorkOrderPartRow>(
    'SELECT * FROM work_order_parts WHERE id = $1',
    [id]
  );

  return result ? mapRowToWorkOrderPart(result) : null;
}

/**
 * Get parts with pending reservations
 */
export async function getPartsWithPendingReservations(): Promise<WorkOrderPart[]> {
  const rows = await queryMany<WorkOrderPartRow>(
    `SELECT * FROM work_order_parts 
     WHERE reservation_status IN ('PENDING', 'PARTIALLY_RESERVED')
     ORDER BY created_at ASC`
  );

  return rows.map(mapRowToWorkOrderPart);
}

/**
 * Get part usage history
 */
export async function getPartUsageHistory(
  partId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrderPart>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM work_order_parts WHERE part_id = $1',
    [partId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<WorkOrderPartRow>(
    `SELECT * FROM work_order_parts 
     WHERE part_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [partId, limit, offset]
  );

  return {
    items: rows.map(mapRowToWorkOrderPart),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
