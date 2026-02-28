/**
 * Maintenance Repository - Data access layer for maintenance plans and work orders
 *
 * Implements database operations for:
 * - Maintenance plan CRUD operations (Requirement 5.1)
 * - Work order generation and management (Requirement 5.2)
 * - Schedule calculation for time-based and usage-based maintenance
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { queryMany, queryOne, withTransaction } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'maintenance-repository' });

/**
 * Schedule type for maintenance plans
 */
export type ScheduleType = 'TIME_BASED' | 'USAGE_BASED' | 'CONDITION_BASED' | 'HYBRID';

/**
 * Maintenance type
 */
export type MaintenanceType =
  | 'PREVENTIVE'
  | 'PREDICTIVE'
  | 'INSPECTION'
  | 'CALIBRATION'
  | 'LUBRICATION'
  | 'CLEANING'
  | 'SAFETY_CHECK'
  | 'REGULATORY'
  | 'SEASONAL'
  | 'OTHER';

/**
 * Schedule unit for intervals
 */
export type ScheduleUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'HOURS' | 'MILES' | 'CYCLES';


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
 * Maintenance plan entity
 */
export interface MaintenancePlan {
  readonly planId: UUID;
  readonly assetId: UUID;
  readonly planName: string;
  readonly description: string | null;
  readonly maintenanceType: MaintenanceType;
  readonly scheduleType: ScheduleType;
  readonly frequencyDays: number | null;
  readonly frequencyHours: number | null;
  readonly lastPerformedDate: string | null;
  readonly nextDueDate: string | null;
  readonly procedureDocumentId: UUID | null;
  readonly estimatedDurationHours: number | null;
  readonly estimatedCost: number | null;
  readonly leadTimeDays: number;
  readonly allowEarlyExecution: boolean;
  readonly maxOverdueDays: number | null;
  readonly defaultAssignedTo: UUID | null;
  readonly requiredSkills: string[] | null;
  readonly requiredCertifications: string[] | null;
  readonly isActive: boolean;
  readonly priority: WorkOrderPriority;
  readonly executionCount: number;
  readonly lastWorkOrderId: UUID | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}


/**
 * Work order entity
 */
export interface WorkOrder {
  readonly workOrderId: UUID;
  readonly workOrderNumber: string;
  readonly assetId: UUID;
  readonly maintenancePlanId: UUID | null;
  readonly workType: WorkOrderType;
  readonly priority: WorkOrderPriority;
  readonly status: WorkOrderStatus;
  readonly title: string;
  readonly description: string | null;
  readonly instructions: string | null;
  readonly assignedTo: UUID | null;
  readonly assignedBy: UUID | null;
  readonly assignedDate: string | null;
  readonly scheduledDate: string | null;
  readonly dueDate: string | null;
  readonly startedDate: string | null;
  readonly completedDate: string | null;
  readonly completionNotes: string | null;
  readonly estimatedDurationHours: number | null;
  readonly actualDurationHours: number | null;
  readonly estimatedCost: number | null;
  readonly actualLaborCost: number | null;
  readonly actualPartsCost: number | null;
  readonly actualTotalCost: number | null;
  readonly workLocation: string | null;
  readonly facilityId: UUID | null;
  readonly requiresApproval: boolean;
  readonly approvedBy: UUID | null;
  readonly approvedDate: string | null;
  readonly parentWorkOrderId: UUID | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: UUID | null;
  readonly updatedBy: UUID | null;
}

/**
 * Create maintenance plan request
 */
export interface CreateMaintenancePlanRequest {
  readonly assetId: UUID;
  readonly planName: string;
  readonly description?: string;
  readonly maintenanceType: MaintenanceType;
  readonly scheduleType: ScheduleType;
  readonly frequencyDays?: number;
  readonly frequencyHours?: number;
  readonly procedureDocumentId?: UUID;
  readonly estimatedDurationHours?: number;
  readonly estimatedCost?: number;
  readonly leadTimeDays?: number;
  readonly allowEarlyExecution?: boolean;
  readonly maxOverdueDays?: number;
  readonly defaultAssignedTo?: UUID;
  readonly requiredSkills?: string[];
  readonly requiredCertifications?: string[];
  readonly priority?: WorkOrderPriority;
  readonly createdBy?: UUID;
}


/**
 * Update maintenance plan request
 */
export interface UpdateMaintenancePlanRequest {
  readonly planName?: string;
  readonly description?: string;
  readonly maintenanceType?: MaintenanceType;
  readonly scheduleType?: ScheduleType;
  readonly frequencyDays?: number | null;
  readonly frequencyHours?: number | null;
  readonly procedureDocumentId?: UUID | null;
  readonly estimatedDurationHours?: number | null;
  readonly estimatedCost?: number | null;
  readonly leadTimeDays?: number;
  readonly allowEarlyExecution?: boolean;
  readonly maxOverdueDays?: number | null;
  readonly defaultAssignedTo?: UUID | null;
  readonly requiredSkills?: string[] | null;
  readonly requiredCertifications?: string[] | null;
  readonly isActive?: boolean;
  readonly priority?: WorkOrderPriority;
  readonly updatedBy?: UUID;
}

/**
 * Create work order request
 */
export interface CreateWorkOrderRequest {
  readonly assetId: UUID;
  readonly maintenancePlanId?: UUID;
  readonly workType: WorkOrderType;
  readonly priority?: WorkOrderPriority;
  readonly title: string;
  readonly description?: string;
  readonly instructions?: string;
  readonly assignedTo?: UUID;
  readonly scheduledDate?: string;
  readonly dueDate?: string;
  readonly estimatedDurationHours?: number;
  readonly estimatedCost?: number;
  readonly workLocation?: string;
  readonly facilityId?: UUID;
  readonly requiresApproval?: boolean;
  readonly parentWorkOrderId?: UUID;
  readonly createdBy?: UUID;
}

/**
 * Database row types
 */
interface MaintenancePlanRow {
  plan_id: string;
  asset_id: string;
  plan_name: string;
  description: string | null;
  maintenance_type: MaintenanceType;
  schedule_type: ScheduleType;
  frequency_days: number | null;
  frequency_hours: number | null;
  last_performed_date: string | null;
  next_due_date: string | null;
  procedure_document_id: string | null;
  estimated_duration_hours: string | null;
  estimated_cost: string | null;
  lead_time_days: number;
  allow_early_execution: boolean;
  max_overdue_days: number | null;
  default_assigned_to: string | null;
  required_skills: string[] | null;
  required_certifications: string[] | null;
  is_active: boolean;
  priority: WorkOrderPriority;
  execution_count: number;
  last_work_order_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
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

/**
 * Map database row to MaintenancePlan entity
 */
function mapRowToMaintenancePlan(row: MaintenancePlanRow): MaintenancePlan {
  return {
    planId: row.plan_id,
    assetId: row.asset_id,
    planName: row.plan_name,
    description: row.description,
    maintenanceType: row.maintenance_type,
    scheduleType: row.schedule_type,
    frequencyDays: row.frequency_days,
    frequencyHours: row.frequency_hours,
    lastPerformedDate: row.last_performed_date,
    nextDueDate: row.next_due_date,
    procedureDocumentId: row.procedure_document_id,
    estimatedDurationHours: row.estimated_duration_hours ? parseFloat(row.estimated_duration_hours) : null,
    estimatedCost: row.estimated_cost ? parseFloat(row.estimated_cost) : null,
    leadTimeDays: row.lead_time_days,
    allowEarlyExecution: row.allow_early_execution,
    maxOverdueDays: row.max_overdue_days,
    defaultAssignedTo: row.default_assigned_to,
    requiredSkills: row.required_skills,
    requiredCertifications: row.required_certifications,
    isActive: row.is_active,
    priority: row.priority,
    executionCount: row.execution_count,
    lastWorkOrderId: row.last_work_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}


/**
 * Map database row to WorkOrder entity
 */
function mapRowToWorkOrder(row: WorkOrderRow): WorkOrder {
  return {
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number,
    assetId: row.asset_id,
    maintenancePlanId: row.maintenance_plan_id,
    workType: row.work_type,
    priority: row.priority,
    status: row.status,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    assignedDate: row.assigned_date,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date,
    startedDate: row.started_date,
    completedDate: row.completed_date,
    completionNotes: row.completion_notes,
    estimatedDurationHours: row.estimated_duration_hours ? parseFloat(row.estimated_duration_hours) : null,
    actualDurationHours: row.actual_duration_hours ? parseFloat(row.actual_duration_hours) : null,
    estimatedCost: row.estimated_cost ? parseFloat(row.estimated_cost) : null,
    actualLaborCost: row.actual_labor_cost ? parseFloat(row.actual_labor_cost) : null,
    actualPartsCost: row.actual_parts_cost ? parseFloat(row.actual_parts_cost) : null,
    actualTotalCost: row.actual_total_cost ? parseFloat(row.actual_total_cost) : null,
    workLocation: row.work_location,
    facilityId: row.facility_id,
    requiresApproval: row.requires_approval,
    approvedBy: row.approved_by,
    approvedDate: row.approved_date,
    parentWorkOrderId: row.parent_work_order_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

/**
 * Generate a unique work order number
 */
function generateWorkOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WO-${timestamp}-${random}`;
}

/**
 * Get maintenance plan by ID
 */
export async function getMaintenancePlanById(planId: UUID): Promise<MaintenancePlan | null> {
  const result = await queryOne<MaintenancePlanRow>(
    'SELECT * FROM maintenance_plans WHERE plan_id = $1',
    [planId]
  );

  return result ? mapRowToMaintenancePlan(result) : null;
}


/**
 * Get maintenance plans for an asset
 */
export async function getMaintenancePlansByAsset(
  assetId: UUID,
  includeInactive = false
): Promise<MaintenancePlan[]> {
  const activeCondition = includeInactive ? '' : 'AND is_active = TRUE';

  const rows = await queryMany<MaintenancePlanRow>(
    `SELECT * FROM maintenance_plans 
     WHERE asset_id = $1 ${activeCondition}
     ORDER BY priority DESC, next_due_date ASC NULLS LAST`,
    [assetId]
  );

  return rows.map(mapRowToMaintenancePlan);
}

/**
 * Get maintenance plans with optional active/inactive filter
 */
export async function getMaintenancePlans(
  pagination: PaginationParams = {},
  isActive?: boolean
): Promise<PaginatedResult<MaintenancePlan>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];

  if (isActive !== undefined) {
    conditions.push(`is_active = $${values.length + 1}`);
    values.push(isActive);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM maintenance_plans ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const limitParam = values.length + 1;
  const offsetParam = values.length + 2;
  const rows = await queryMany<MaintenancePlanRow>(
    `SELECT * FROM maintenance_plans
     ${whereClause}
     ORDER BY next_due_date ASC NULLS LAST, priority DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    [...values, limit, offset]
  );

  return {
    items: rows.map(mapRowToMaintenancePlan),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get all active maintenance plans with pagination
 */
export async function getActiveMaintenancePlans(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<MaintenancePlan>> {
  return getMaintenancePlans(pagination, true);
}

/**
 * Get maintenance plans that are due for execution
 * Requirement 5.1: Schedule preventative maintenance based on time intervals or usage metrics
 */
export async function getDueMaintenancePlans(
  asOfDate?: string
): Promise<MaintenancePlan[]> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);
  const rows = await queryMany<MaintenancePlanRow>(
    `SELECT * FROM maintenance_plans 
     WHERE is_active = TRUE
       AND next_due_date IS NOT NULL
       AND next_due_date <= $1
     ORDER BY priority DESC, next_due_date ASC`,
    [checkDate]
  );

  return rows.map(mapRowToMaintenancePlan);
}


/**
 * Get maintenance plans approaching due date (within lead time)
 */
export async function getUpcomingMaintenancePlans(
  daysAhead: number = 7
): Promise<MaintenancePlan[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  const rows = await queryMany<MaintenancePlanRow>(
    `SELECT * FROM maintenance_plans 
     WHERE is_active = TRUE
       AND next_due_date IS NOT NULL
       AND next_due_date <= $1
       AND next_due_date > CURRENT_DATE
     ORDER BY next_due_date ASC, priority DESC`,
    [futureDateStr]
  );

  return rows.map(mapRowToMaintenancePlan);
}

/**
 * Create a new maintenance plan
 */
export async function createMaintenancePlan(
  request: CreateMaintenancePlanRequest
): Promise<MaintenancePlan> {
  const timestamp = now();

  // Calculate initial next due date based on schedule type
  let nextDueDate: string | null = null;
  if (request.scheduleType === 'TIME_BASED' && request.frequencyDays) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + request.frequencyDays);
    nextDueDate = dueDate.toISOString().slice(0, 10);
  }

  const result = await queryOne<MaintenancePlanRow>(
    `INSERT INTO maintenance_plans (
      asset_id, plan_name, description, maintenance_type, schedule_type,
      frequency_days, frequency_hours, next_due_date, procedure_document_id,
      estimated_duration_hours, estimated_cost, lead_time_days, allow_early_execution,
      max_overdue_days, default_assigned_to, required_skills, required_certifications,
      priority, created_at, updated_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19, $20)
    RETURNING *`,
    [
      request.assetId,
      request.planName,
      request.description ?? null,
      request.maintenanceType,
      request.scheduleType,
      request.frequencyDays ?? null,
      request.frequencyHours ?? null,
      nextDueDate,
      request.procedureDocumentId ?? null,
      request.estimatedDurationHours ?? null,
      request.estimatedCost ?? null,
      request.leadTimeDays ?? 7,
      request.allowEarlyExecution ?? true,
      request.maxOverdueDays ?? null,
      request.defaultAssignedTo ?? null,
      request.requiredSkills ?? null,
      request.requiredCertifications ?? null,
      request.priority ?? 'MEDIUM',
      timestamp,
      request.createdBy ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create maintenance plan');
  }

  logger.info('Maintenance plan created', {
    planId: result.plan_id,
    assetId: request.assetId,
    planName: request.planName,
    scheduleType: request.scheduleType,
  });

  return mapRowToMaintenancePlan(result);
}


/**
 * Update a maintenance plan
 */
export async function updateMaintenancePlan(
  planId: UUID,
  request: UpdateMaintenancePlanRequest
): Promise<MaintenancePlan | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (request.planName !== undefined) {
    updates.push(`plan_name = $${paramIndex++}`);
    values.push(request.planName);
  }

  if (request.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(request.description);
  }

  if (request.maintenanceType !== undefined) {
    updates.push(`maintenance_type = $${paramIndex++}`);
    values.push(request.maintenanceType);
  }

  if (request.scheduleType !== undefined) {
    updates.push(`schedule_type = $${paramIndex++}`);
    values.push(request.scheduleType);
  }

  if (request.frequencyDays !== undefined) {
    updates.push(`frequency_days = $${paramIndex++}`);
    values.push(request.frequencyDays);
  }

  if (request.frequencyHours !== undefined) {
    updates.push(`frequency_hours = $${paramIndex++}`);
    values.push(request.frequencyHours);
  }

  if (request.procedureDocumentId !== undefined) {
    updates.push(`procedure_document_id = $${paramIndex++}`);
    values.push(request.procedureDocumentId);
  }

  if (request.estimatedDurationHours !== undefined) {
    updates.push(`estimated_duration_hours = $${paramIndex++}`);
    values.push(request.estimatedDurationHours);
  }

  if (request.estimatedCost !== undefined) {
    updates.push(`estimated_cost = $${paramIndex++}`);
    values.push(request.estimatedCost);
  }

  if (request.leadTimeDays !== undefined) {
    updates.push(`lead_time_days = $${paramIndex++}`);
    values.push(request.leadTimeDays);
  }

  if (request.allowEarlyExecution !== undefined) {
    updates.push(`allow_early_execution = $${paramIndex++}`);
    values.push(request.allowEarlyExecution);
  }

  if (request.maxOverdueDays !== undefined) {
    updates.push(`max_overdue_days = $${paramIndex++}`);
    values.push(request.maxOverdueDays);
  }

  if (request.defaultAssignedTo !== undefined) {
    updates.push(`default_assigned_to = $${paramIndex++}`);
    values.push(request.defaultAssignedTo);
  }

  if (request.requiredSkills !== undefined) {
    updates.push(`required_skills = $${paramIndex++}`);
    values.push(request.requiredSkills);
  }

  if (request.requiredCertifications !== undefined) {
    updates.push(`required_certifications = $${paramIndex++}`);
    values.push(request.requiredCertifications);
  }

  if (request.isActive !== undefined) {
    updates.push(`is_active = $${paramIndex++}`);
    values.push(request.isActive);
  }

  if (request.priority !== undefined) {
    updates.push(`priority = $${paramIndex++}`);
    values.push(request.priority);
  }

  if (updates.length === 0) {
    return getMaintenancePlanById(planId);
  }

  updates.push(`updated_at = $${paramIndex++}`);
  values.push(now());

  if (request.updatedBy) {
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(request.updatedBy);
  }

  values.push(planId);

  const sql = `UPDATE maintenance_plans SET ${updates.join(', ')} WHERE plan_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<MaintenancePlanRow>(sql, values);

  if (result) {
    logger.info('Maintenance plan updated', { planId });
  }

  return result ? mapRowToMaintenancePlan(result) : null;
}


/**
 * Update maintenance plan after execution
 * Updates last performed date and calculates next due date
 */
export async function recordMaintenanceExecution(
  planId: UUID,
  executionDate: string,
  workOrderId: UUID
): Promise<MaintenancePlan | null> {
  return withTransaction(async (ctx) => {
    // Get current plan with lock
    const current = await ctx.queryOne<MaintenancePlanRow>(
      'SELECT * FROM maintenance_plans WHERE plan_id = $1 FOR UPDATE',
      [planId]
    );

    if (!current) {
      return null;
    }

    // Calculate next due date based on schedule type
    let nextDueDate: string | null = null;
    const execDate = new Date(executionDate);

    if (current.schedule_type === 'TIME_BASED' && current.frequency_days) {
      const dueDate = new Date(execDate);
      dueDate.setDate(dueDate.getDate() + current.frequency_days);
      nextDueDate = dueDate.toISOString().slice(0, 10);
    } else if (current.schedule_type === 'USAGE_BASED') {
      // For usage-based, next due date is calculated when usage threshold is reached
      // This will be updated by the usage tracking system
      nextDueDate = null;
    }

    const timestamp = now();
    const result = await ctx.queryOne<MaintenancePlanRow>(
      `UPDATE maintenance_plans 
       SET last_performed_date = $1,
           next_due_date = $2,
           execution_count = execution_count + 1,
           last_work_order_id = $3,
           updated_at = $4
       WHERE plan_id = $5
       RETURNING *`,
      [executionDate, nextDueDate, workOrderId, timestamp, planId]
    );

    if (result) {
      logger.info('Maintenance execution recorded', {
        planId,
        executionDate,
        nextDueDate,
        workOrderId,
      });
    }

    return result ? mapRowToMaintenancePlan(result) : null;
  });
}

/**
 * Update next due date for usage-based maintenance
 */
export async function updateNextDueDate(
  planId: UUID,
  nextDueDate: string | null
): Promise<MaintenancePlan | null> {
  const timestamp = now();

  const result = await queryOne<MaintenancePlanRow>(
    `UPDATE maintenance_plans 
     SET next_due_date = $1, updated_at = $2
     WHERE plan_id = $3
     RETURNING *`,
    [nextDueDate, timestamp, planId]
  );

  return result ? mapRowToMaintenancePlan(result) : null;
}


/**
 * Get work order by ID
 */
export async function getWorkOrderById(workOrderId: UUID): Promise<WorkOrder | null> {
  const result = await queryOne<WorkOrderRow>(
    'SELECT * FROM work_orders WHERE work_order_id = $1',
    [workOrderId]
  );

  return result ? mapRowToWorkOrder(result) : null;
}

/**
 * Get work orders for an asset
 */
export async function getWorkOrdersByAsset(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM work_orders WHERE asset_id = $1',
    [assetId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<WorkOrderRow>(
    `SELECT * FROM work_orders 
     WHERE asset_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [assetId, limit, offset]
  );

  return {
    items: rows.map(mapRowToWorkOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Get work orders for a maintenance plan
 */
export async function getWorkOrdersByPlan(
  planId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM work_orders WHERE maintenance_plan_id = $1',
    [planId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<WorkOrderRow>(
    `SELECT * FROM work_orders 
     WHERE maintenance_plan_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [planId, limit, offset]
  );

  return {
    items: rows.map(mapRowToWorkOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}


/**
 * Get open work orders
 */
export async function getOpenWorkOrders(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  const openStatuses = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL'];

  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM work_orders WHERE status = ANY($1)`,
    [openStatuses]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  const rows = await queryMany<WorkOrderRow>(
    `SELECT * FROM work_orders 
     WHERE status = ANY($1)
     ORDER BY priority DESC, due_date ASC NULLS LAST, created_at ASC
     LIMIT $2 OFFSET $3`,
    [openStatuses, limit, offset]
  );

  return {
    items: rows.map(mapRowToWorkOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Create a new work order
 * Requirement 5.2: Generate work orders when maintenance is due
 */
export async function createWorkOrder(
  request: CreateWorkOrderRequest
): Promise<WorkOrder> {
  const timestamp = now();
  const workOrderNumber = generateWorkOrderNumber();

  const result = await queryOne<WorkOrderRow>(
    `INSERT INTO work_orders (
      work_order_number, asset_id, maintenance_plan_id, work_type, priority,
      title, description, instructions, assigned_to, scheduled_date, due_date,
      estimated_duration_hours, estimated_cost, work_location, facility_id,
      requires_approval, parent_work_order_id, created_at, updated_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18, $19)
    RETURNING *`,
    [
      workOrderNumber,
      request.assetId,
      request.maintenancePlanId ?? null,
      request.workType,
      request.priority ?? 'MEDIUM',
      request.title,
      request.description ?? null,
      request.instructions ?? null,
      request.assignedTo ?? null,
      request.scheduledDate ?? null,
      request.dueDate ?? null,
      request.estimatedDurationHours ?? null,
      request.estimatedCost ?? null,
      request.workLocation ?? null,
      request.facilityId ?? null,
      request.requiresApproval ?? false,
      request.parentWorkOrderId ?? null,
      timestamp,
      request.createdBy ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create work order');
  }

  logger.info('Work order created', {
    workOrderId: result.work_order_id,
    workOrderNumber: result.work_order_number,
    assetId: request.assetId,
    workType: request.workType,
    maintenancePlanId: request.maintenancePlanId,
  });

  return mapRowToWorkOrder(result);
}


/**
 * Update work order status
 */
export async function updateWorkOrderStatus(
  workOrderId: UUID,
  status: WorkOrderStatus,
  userId?: UUID
): Promise<WorkOrder | null> {
  const timestamp = now();
  const updates: string[] = ['status = $1', 'updated_at = $2'];
  const values: unknown[] = [status, timestamp];
  let paramIndex = 3;

  // Set started_date when transitioning to IN_PROGRESS
  if (status === 'IN_PROGRESS') {
    updates.push(`started_date = COALESCE(started_date, $${paramIndex++})`);
    values.push(timestamp);
  }

  // Set completed_date when transitioning to COMPLETED
  if (status === 'COMPLETED') {
    updates.push(`completed_date = $${paramIndex++}`);
    values.push(timestamp.split('T')[0]);
  }

  if (userId) {
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);
  }

  values.push(workOrderId);

  const sql = `UPDATE work_orders SET ${updates.join(', ')} WHERE work_order_id = $${paramIndex} RETURNING *`;
  const result = await queryOne<WorkOrderRow>(sql, values);

  if (result) {
    logger.info('Work order status updated', { workOrderId, status });
  }

  return result ? mapRowToWorkOrder(result) : null;
}

/**
 * Complete a work order with notes
 */
export async function completeWorkOrder(
  workOrderId: UUID,
  completionNotes: string | null,
  actualDurationHours: number | null,
  actualLaborCost: number | null,
  actualPartsCost: number | null,
  userId?: UUID
): Promise<WorkOrder | null> {
  const timestamp = now();
  const completedDate = timestamp.split('T')[0];

  const actualTotalCost = (actualLaborCost ?? 0) + (actualPartsCost ?? 0);

  const result = await queryOne<WorkOrderRow>(
    `UPDATE work_orders 
     SET status = 'COMPLETED',
         completed_date = $1,
         completion_notes = $2,
         actual_duration_hours = $3,
         actual_labor_cost = $4,
         actual_parts_cost = $5,
         actual_total_cost = $6,
         updated_at = $7,
         updated_by = $8
     WHERE work_order_id = $9
     RETURNING *`,
    [
      completedDate,
      completionNotes,
      actualDurationHours,
      actualLaborCost,
      actualPartsCost,
      actualTotalCost > 0 ? actualTotalCost : null,
      timestamp,
      userId ?? null,
      workOrderId,
    ]
  );

  if (result) {
    logger.info('Work order completed', {
      workOrderId,
      completedDate,
      actualDurationHours,
      actualTotalCost,
    });
  }

  return result ? mapRowToWorkOrder(result) : null;
}

/**
 * Assign work order to a user
 */
export async function assignWorkOrder(
  workOrderId: UUID,
  assignedTo: UUID,
  assignedBy: UUID
): Promise<WorkOrder | null> {
  const timestamp = now();

  const result = await queryOne<WorkOrderRow>(
    `UPDATE work_orders 
     SET assigned_to = $1,
         assigned_by = $2,
         assigned_date = $3,
         status = CASE WHEN status = 'OPEN' THEN 'ASSIGNED' ELSE status END,
         updated_at = $3,
         updated_by = $2
     WHERE work_order_id = $4
     RETURNING *`,
    [assignedTo, assignedBy, timestamp, workOrderId]
  );

  if (result) {
    logger.info('Work order assigned', { workOrderId, assignedTo, assignedBy });
  }

  return result ? mapRowToWorkOrder(result) : null;
}
