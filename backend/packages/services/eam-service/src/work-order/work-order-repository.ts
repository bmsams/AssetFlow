/**
 * Work Order Repository - Data access layer for enhanced work order management
 *
 * Extends maintenance repository with:
 * - Parts tracking for work orders (Requirement 14.3)
 * - Assignment and completion logic (Requirement 14.2, 14.4, 14.5)
 * - Work order state transitions
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'work-order-repository' });

/**
 * Work order status
 */
export type WorkOrderStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'PENDING_PARTS'
  | 'PENDING_APPROVAL'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'CLOSED';

/**
 * Work order priority
 */
export type WorkOrderPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Work order type
 */
export type WorkOrderType =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'EMERGENCY'
  | 'INSPECTION'
  | 'CALIBRATION'
  | 'INSTALLATION'
  | 'MODIFICATION'
  | 'DECOMMISSION'
  | 'PROJECT'
  | 'OTHER';

/**
 * Work order part tracking entity
 */
export interface WorkOrderPart {
  readonly id: UUID;
  readonly workOrderId: UUID;
  readonly partId: UUID;
  readonly partNumber: string;
  readonly partName: string | null;
  readonly quantityRequired: number;
  readonly quantityReserved: number;
  readonly quantityUsed: number;
  readonly unitCost: number | null;
  readonly totalCost: number | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Work order with parts summary
 */
export interface WorkOrderWithParts {
  readonly workOrderId: UUID;
  readonly workOrderNumber: string;
  readonly assetId: UUID;
  readonly assetTag: string | null;
  readonly maintenancePlanId: UUID | null;
  readonly workType: WorkOrderType;
  readonly priority: WorkOrderPriority;
  readonly status: WorkOrderStatus;
  readonly title: string;
  readonly description: string | null;
  readonly assignedTo: UUID | null;
  readonly assignedToName: string | null;
  readonly assignedBy: UUID | null;
  readonly assignedDate: string | null;
  readonly scheduledDate: string | null;
  readonly dueDate: string | null;
  readonly startedDate: string | null;
  readonly completedDate: string | null;
  readonly completionNotes: string | null;
  readonly estimatedDurationHours: number | null;
  readonly actualDurationHours: number | null;
  readonly actualLaborCost: number | null;
  readonly actualPartsCost: number | null;
  readonly actualTotalCost: number | null;
  readonly partsUsed: readonly WorkOrderPart[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Add part to work order request
 */
export interface AddPartToWorkOrderRequest {
  readonly workOrderId: UUID;
  readonly partId: UUID;
  readonly quantityRequired: number;
  readonly notes?: string;
}

/**
 * Record part usage request
 */
export interface RecordPartUsageRequest {
  readonly workOrderId: UUID;
  readonly partId: UUID;
  readonly quantityUsed: number;
  readonly notes?: string;
}

/**
 * Work order list filters
 */
export interface WorkOrderListFilters {
  readonly status?: WorkOrderStatus;
  readonly priority?: WorkOrderPriority;
  readonly assignedTo?: UUID;
  readonly assetId?: UUID;
  readonly buildingId?: UUID;
  readonly building?: string;
  readonly maintenancePlanId?: UUID;
  readonly workType?: WorkOrderType;
  readonly fromDate?: string;
  readonly toDate?: string;
}

/**
 * Database row types
 */
interface WorkOrderPartRow {
  id: string;
  work_order_id: string;
  part_id: string;
  part_number: string;
  part_name: string | null;
  quantity_required: number;
  quantity_reserved: number;
  quantity_used: number;
  unit_cost_at_issue: string | null;
  total_cost: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkOrderRow {
  work_order_id: string;
  work_order_number: string;
  asset_id: string;
  maintenance_plan_id: string | null;
  work_type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string;
  description: string | null;
  instructions: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_date: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  started_date: string | null;
  completed_date: string | null;
  completion_notes: string | null;
  estimated_duration_hours: string | null;
  actual_duration_hours: string | null;
  estimated_cost: string | null;
  actual_labor_cost: string | null;
  actual_parts_cost: string | null;
  actual_total_cost: string | null;
  work_location: string | null;
  facility_id: string | null;
  requires_approval: boolean;
  approved_by: string | null;
  approved_date: string | null;
  parent_work_order_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

interface WorkOrderWithUserRow extends WorkOrderRow {
  asset_tag: string | null;
  assigned_to_name: string | null;
}

/**
 * Map database row to WorkOrderPart entity
 */
function mapRowToWorkOrderPart(row: WorkOrderPartRow): WorkOrderPart {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    partId: row.part_id,
    partNumber: row.part_number,
    partName: row.part_name,
    quantityRequired: row.quantity_required,
    quantityReserved: row.quantity_reserved,
    quantityUsed: row.quantity_used,
    unitCost: row.unit_cost_at_issue ? parseFloat(row.unit_cost_at_issue) : null,
    totalCost: row.total_cost ? parseFloat(row.total_cost) : null,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// PARTS TRACKING OPERATIONS
// Requirement 14.3: Track parts used in work orders
// ============================================================================

/**
 * Get parts for a work order
 * Requirement 14.3: Track parts used in work orders
 */
export async function getWorkOrderParts(workOrderId: UUID): Promise<WorkOrderPart[]> {
  const rows = await queryMany<WorkOrderPartRow>(
    `SELECT 
       wop.id,
       wop.work_order_id,
       wop.part_id,
       sp.part_number,
       sp.part_name,
       wop.quantity_required,
       wop.quantity_reserved,
       wop.quantity_used,
       wop.unit_cost_at_issue,
       wop.total_cost,
       wop.notes,
       wop.created_at,
       wop.updated_at
     FROM work_order_parts wop
     JOIN spare_parts sp ON wop.part_id = sp.part_id
     WHERE wop.work_order_id = $1
     ORDER BY wop.created_at ASC`,
    [workOrderId]
  );

  return rows.map(mapRowToWorkOrderPart);
}

/**
 * Add a part to a work order
 * Requirement 14.3: Track parts used in work orders
 */
export async function addPartToWorkOrder(
  request: AddPartToWorkOrderRequest
): Promise<WorkOrderPart> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get the spare part details
    const partRow = await ctx.queryOne<{ part_id: string; part_number: string; part_name: string | null; unit_cost: string | null }>(
      'SELECT part_id, part_number, part_name, unit_cost FROM spare_parts WHERE part_id = $1',
      [request.partId]
    );

    if (!partRow) {
      throw new Error(`Part not found: ${request.partId}`);
    }

    // Check if part already exists for this work order
    const existingPart = await ctx.queryOne<WorkOrderPartRow>(
      'SELECT * FROM work_order_parts WHERE work_order_id = $1 AND part_id = $2',
      [request.workOrderId, request.partId]
    );

    if (existingPart) {
      // Update existing record
      const result = await ctx.queryOne<WorkOrderPartRow>(
        `UPDATE work_order_parts 
         SET quantity_required = quantity_required + $1,
             notes = COALESCE($2, notes),
             updated_at = $3
         WHERE work_order_id = $4 AND part_id = $5
         RETURNING id, work_order_id, part_id, quantity_required, quantity_reserved, 
                   quantity_used, unit_cost_at_issue, total_cost, notes, created_at, updated_at`,
        [request.quantityRequired, request.notes ?? null, timestamp, request.workOrderId, request.partId]
      );

      if (!result) {
        throw new Error('Failed to update work order part');
      }

      logger.info('Work order part quantity updated', {
        workOrderId: request.workOrderId,
        partId: request.partId,
        additionalQuantity: request.quantityRequired,
      });

      return {
        ...mapRowToWorkOrderPart(result),
        partNumber: partRow.part_number,
        partName: partRow.part_name,
      };
    }

    // Insert new work order part
    const result = await ctx.queryOne<WorkOrderPartRow>(
      `INSERT INTO work_order_parts (
        work_order_id, part_id, quantity_required, quantity_reserved, quantity_used,
        unit_cost_at_issue, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $6)
      RETURNING id, work_order_id, part_id, quantity_required, quantity_reserved, 
                quantity_used, unit_cost_at_issue, total_cost, notes, created_at, updated_at`,
      [
        request.workOrderId,
        request.partId,
        request.quantityRequired,
        partRow.unit_cost,
        request.notes ?? null,
        timestamp,
      ]
    );

    if (!result) {
      throw new Error('Failed to add part to work order');
    }

    logger.info('Part added to work order', {
      workOrderId: request.workOrderId,
      partId: request.partId,
      partNumber: partRow.part_number,
      quantityRequired: request.quantityRequired,
    });

    return {
      ...mapRowToWorkOrderPart(result),
      partNumber: partRow.part_number,
      partName: partRow.part_name,
    };
  });
}

/**
 * Record part usage on a work order
 * Requirement 14.3: Track parts used in work orders
 */
export async function recordPartUsage(
  request: RecordPartUsageRequest
): Promise<WorkOrderPart> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get the work order part record
    const wopRow = await ctx.queryOne<WorkOrderPartRow & { part_number: string; part_name: string | null }>(
      `SELECT wop.*, sp.part_number, sp.part_name
       FROM work_order_parts wop
       JOIN spare_parts sp ON wop.part_id = sp.part_id
       WHERE wop.work_order_id = $1 AND wop.part_id = $2
       FOR UPDATE`,
      [request.workOrderId, request.partId]
    );

    if (!wopRow) {
      throw new Error(`Part ${request.partId} not found on work order ${request.workOrderId}`);
    }

    // Validate quantity
    const availableToUse = wopRow.quantity_reserved - wopRow.quantity_used;
    if (request.quantityUsed > availableToUse) {
      throw new Error(
        `Cannot use ${request.quantityUsed} of part ${wopRow.part_number}. Only ${availableToUse} available (reserved: ${wopRow.quantity_reserved}, already used: ${wopRow.quantity_used})`
      );
    }

    // Update work order part
    const newQuantityUsed = wopRow.quantity_used + request.quantityUsed;
    const unitCost = wopRow.unit_cost_at_issue ? parseFloat(wopRow.unit_cost_at_issue) : 0;
    const newTotalCost = unitCost * newQuantityUsed;

    const result = await ctx.queryOne<WorkOrderPartRow>(
      `UPDATE work_order_parts 
       SET quantity_used = $1,
           total_cost = $2,
           notes = COALESCE($3, notes),
           updated_at = $4
       WHERE work_order_id = $5 AND part_id = $6
       RETURNING id, work_order_id, part_id, quantity_required, quantity_reserved, 
                 quantity_used, unit_cost_at_issue, total_cost, notes, created_at, updated_at`,
      [newQuantityUsed, newTotalCost, request.notes ?? null, timestamp, request.workOrderId, request.partId]
    );

    if (!result) {
      throw new Error('Failed to record part usage');
    }

    // Update spare parts inventory (reduce on-hand)
    await ctx.queryOne(
      `UPDATE spare_parts 
       SET quantity_on_hand = quantity_on_hand - $1,
           quantity_reserved = quantity_reserved - $1,
           updated_at = $2
       WHERE part_id = $3`,
      [request.quantityUsed, timestamp, request.partId]
    );

    logger.info('Part usage recorded', {
      workOrderId: request.workOrderId,
      partId: request.partId,
      partNumber: wopRow.part_number,
      quantityUsed: request.quantityUsed,
      totalQuantityUsed: newQuantityUsed,
      totalCost: newTotalCost,
    });

    return {
      ...mapRowToWorkOrderPart(result),
      partNumber: wopRow.part_number,
      partName: wopRow.part_name,
    };
  });
}

/**
 * Remove a part from a work order
 */
export async function removePartFromWorkOrder(
  workOrderId: UUID,
  partId: UUID
): Promise<void> {
  return withTransaction(async (ctx) => {
    const timestamp = now();

    // Get the work order part record
    const wopRow = await ctx.queryOne<WorkOrderPartRow>(
      'SELECT * FROM work_order_parts WHERE work_order_id = $1 AND part_id = $2 FOR UPDATE',
      [workOrderId, partId]
    );

    if (!wopRow) {
      throw new Error(`Part ${partId} not found on work order ${workOrderId}`);
    }

    // Cannot remove if parts have been used
    if (wopRow.quantity_used > 0) {
      throw new Error(`Cannot remove part ${partId} from work order - ${wopRow.quantity_used} units have already been used`);
    }

    // Release any reserved quantity back to inventory
    if (wopRow.quantity_reserved > 0) {
      await ctx.queryOne(
        `UPDATE spare_parts 
         SET quantity_reserved = quantity_reserved - $1,
             updated_at = $2
         WHERE part_id = $3`,
        [wopRow.quantity_reserved, timestamp, partId]
      );
    }

    // Delete the work order part record
    await ctx.queryOne(
      'DELETE FROM work_order_parts WHERE work_order_id = $1 AND part_id = $2',
      [workOrderId, partId]
    );

    logger.info('Part removed from work order', {
      workOrderId,
      partId,
      quantityReleased: wopRow.quantity_reserved,
    });
  });
}

/**
 * Calculate total parts cost for a work order
 */
export async function calculateWorkOrderPartsCost(workOrderId: UUID): Promise<number> {
  const result = await queryOne<{ total_cost: string }>(
    `SELECT COALESCE(SUM(total_cost), 0) as total_cost
     FROM work_order_parts
     WHERE work_order_id = $1`,
    [workOrderId]
  );

  return result ? parseFloat(result.total_cost) : 0;
}

// ============================================================================
// WORK ORDER WITH PARTS QUERIES
// ============================================================================

/**
 * Get work order with parts details
 */
export async function getWorkOrderWithParts(workOrderId: UUID): Promise<WorkOrderWithParts | null> {
  // Get work order with assigned user name
  const workOrderRow = await queryOne<WorkOrderWithUserRow>(
    `SELECT wo.*, 
            a.asset_tag,
            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') as assigned_to_name
     FROM work_orders wo
     LEFT JOIN assets a ON wo.asset_id = a.asset_id
     LEFT JOIN users u ON wo.assigned_to = u.user_id
     WHERE wo.work_order_id = $1`,
    [workOrderId]
  );

  if (!workOrderRow) {
    return null;
  }

  // Get parts for this work order
  const parts = await getWorkOrderParts(workOrderId);

  return {
    workOrderId: workOrderRow.work_order_id,
    workOrderNumber: workOrderRow.work_order_number,
    assetId: workOrderRow.asset_id,
    assetTag: workOrderRow.asset_tag,
    maintenancePlanId: workOrderRow.maintenance_plan_id,
    workType: workOrderRow.work_type,
    priority: workOrderRow.priority,
    status: workOrderRow.status,
    title: workOrderRow.title,
    description: workOrderRow.description,
    assignedTo: workOrderRow.assigned_to,
    assignedToName: workOrderRow.assigned_to_name,
    assignedBy: workOrderRow.assigned_by,
    assignedDate: workOrderRow.assigned_date,
    scheduledDate: workOrderRow.scheduled_date,
    dueDate: workOrderRow.due_date,
    startedDate: workOrderRow.started_date,
    completedDate: workOrderRow.completed_date,
    completionNotes: workOrderRow.completion_notes,
    estimatedDurationHours: workOrderRow.estimated_duration_hours ? parseFloat(workOrderRow.estimated_duration_hours) : null,
    actualDurationHours: workOrderRow.actual_duration_hours ? parseFloat(workOrderRow.actual_duration_hours) : null,
    actualLaborCost: workOrderRow.actual_labor_cost ? parseFloat(workOrderRow.actual_labor_cost) : null,
    actualPartsCost: workOrderRow.actual_parts_cost ? parseFloat(workOrderRow.actual_parts_cost) : null,
    actualTotalCost: workOrderRow.actual_total_cost ? parseFloat(workOrderRow.actual_total_cost) : null,
    partsUsed: parts,
    createdAt: workOrderRow.created_at,
    updatedAt: workOrderRow.updated_at,
  };
}

/**
 * List work orders with filters and pagination
 * Requirement 14.6: List work orders with optional status and assignee filters
 */
export async function listWorkOrders(
  filters: WorkOrderListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrderWithParts>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (filters.status) {
    conditions.push(`wo.status = $${paramIndex++}`);
    values.push(filters.status);
  }

  if (filters.priority) {
    conditions.push(`wo.priority = $${paramIndex++}`);
    values.push(filters.priority);
  }

  if (filters.assignedTo) {
    conditions.push(`wo.assigned_to = $${paramIndex++}`);
    values.push(filters.assignedTo);
  }

  if (filters.assetId) {
    conditions.push(`wo.asset_id = $${paramIndex++}`);
    values.push(filters.assetId);
  }

  if (filters.buildingId) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM hardware_assets ha
        JOIN buildings b ON b.building_id = $${paramIndex}
        WHERE ha.asset_id = wo.asset_id
          AND (
            LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.building_code, '')))
            OR LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.name, '')))
          )
      )`
    );
    values.push(filters.buildingId);
    paramIndex++;
  }

  if (filters.building) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM hardware_assets ha
        WHERE ha.asset_id = wo.asset_id
          AND LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM($${paramIndex}))
      )`
    );
    values.push(filters.building);
    paramIndex++;
  }

  if (filters.maintenancePlanId) {
    conditions.push(`wo.maintenance_plan_id = $${paramIndex++}`);
    values.push(filters.maintenancePlanId);
  }

  if (filters.workType) {
    conditions.push(`wo.work_type = $${paramIndex++}`);
    values.push(filters.workType);
  }

  if (filters.fromDate) {
    conditions.push(`wo.created_at >= $${paramIndex++}`);
    values.push(filters.fromDate);
  }

  if (filters.toDate) {
    conditions.push(`wo.created_at <= $${paramIndex++}`);
    values.push(filters.toDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM work_orders wo ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated work orders
  const rows = await queryMany<WorkOrderWithUserRow>(
    `SELECT wo.*, 
            a.asset_tag,
            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') as assigned_to_name
     FROM work_orders wo
     LEFT JOIN assets a ON wo.asset_id = a.asset_id
     LEFT JOIN users u ON wo.assigned_to = u.user_id
     ${whereClause}
     ORDER BY 
       CASE wo.priority 
         WHEN 'CRITICAL' THEN 1 
         WHEN 'HIGH' THEN 2 
         WHEN 'MEDIUM' THEN 3 
         WHEN 'LOW' THEN 4 
       END,
       wo.due_date ASC NULLS LAST,
       wo.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    [...values, limit, offset]
  );

  // Get parts for each work order
  const workOrdersWithParts: WorkOrderWithParts[] = await Promise.all(
    rows.map(async (row) => {
      const parts = await getWorkOrderParts(row.work_order_id);
      return {
        workOrderId: row.work_order_id,
        workOrderNumber: row.work_order_number,
        assetId: row.asset_id,
        assetTag: row.asset_tag,
        maintenancePlanId: row.maintenance_plan_id,
        workType: row.work_type,
        priority: row.priority,
        status: row.status,
        title: row.title,
        description: row.description,
        assignedTo: row.assigned_to,
        assignedToName: row.assigned_to_name,
        assignedBy: row.assigned_by,
        assignedDate: row.assigned_date,
        scheduledDate: row.scheduled_date,
        dueDate: row.due_date,
        startedDate: row.started_date,
        completedDate: row.completed_date,
        completionNotes: row.completion_notes,
        estimatedDurationHours: row.estimated_duration_hours ? parseFloat(row.estimated_duration_hours) : null,
        actualDurationHours: row.actual_duration_hours ? parseFloat(row.actual_duration_hours) : null,
        actualLaborCost: row.actual_labor_cost ? parseFloat(row.actual_labor_cost) : null,
        actualPartsCost: row.actual_parts_cost ? parseFloat(row.actual_parts_cost) : null,
        actualTotalCost: row.actual_total_cost ? parseFloat(row.actual_total_cost) : null,
        partsUsed: parts,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    })
  );

  return {
    items: workOrdersWithParts,
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
