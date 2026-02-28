/**
 * Work Order Service - Business logic layer for enhanced work order management
 *
 * Implements:
 * - Work order creation (Requirement 14.1)
 * - Technician assignment (Requirement 14.2)
 * - Parts tracking (Requirement 14.3)
 * - Labor hours and completion (Requirement 14.4)
 * - State transitions (Requirement 14.5)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { queryOne, withTransaction } from '@ams/database';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';

import type {
  AddPartToWorkOrderRequest,
  RecordPartUsageRequest,
  WorkOrderListFilters,
  WorkOrderPart,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderWithParts,
} from './work-order-repository';
import * as repository from './work-order-repository';

const logger = createLogger({ service: 'work-order-service' });

/**
 * Valid state transitions for work orders
 * Requirement 14.5: Support work order state transitions (OPEN → IN_PROGRESS → COMPLETED)
 */
export const VALID_STATE_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'ON_HOLD', 'OPEN', 'CANCELLED'],
  IN_PROGRESS: ['ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED'],
  ON_HOLD: ['IN_PROGRESS', 'CANCELLED'],
  PENDING_PARTS: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
  PENDING_APPROVAL: ['COMPLETED', 'IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: [],
};

/**
 * Statuses that allow assignment
 */
const ASSIGNABLE_STATUSES: readonly WorkOrderStatus[] = ['OPEN', 'ASSIGNED'];

/**
 * Statuses that allow completion
 */
const COMPLETABLE_STATUSES: readonly WorkOrderStatus[] = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL'
];

/**
 * Cache key for work order
 */
function workOrderCacheKey(workOrderId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.WORK_ORDER, workOrderId);
}

/**
 * Cache key for work order parts
 */
function workOrderPartsCacheKey(workOrderId: UUID): string {
  return `work-order:${workOrderId}:parts`;
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
 * Assign work order request
 */
export interface AssignWorkOrderRequest {
  readonly workOrderId: UUID;
  readonly assignedTo: UUID;
  readonly assignedBy: UUID;
}

/**
 * Complete work order request
 */
export interface CompleteWorkOrderRequest {
  readonly workOrderId: UUID;
  readonly completionNotes?: string;
  readonly actualDurationHours?: number;
  readonly actualLaborCost?: number;
  readonly userId?: UUID;
}

/**
 * Update work order status request
 */
export interface UpdateWorkOrderStatusRequest {
  readonly workOrderId: UUID;
  readonly status: WorkOrderStatus;
  readonly userId?: UUID;
}

/**
 * Validate state transition
 * Requirement 14.5: Support work order state transitions
 */
export function isValidStateTransition(
  currentStatus: WorkOrderStatus,
  newStatus: WorkOrderStatus
): boolean {
  const validTransitions = VALID_STATE_TRANSITIONS[currentStatus];
  return validTransitions.includes(newStatus);
}

/**
 * Check if work order can be assigned
 */
export function canAssign(status: WorkOrderStatus): boolean {
  return ASSIGNABLE_STATUSES.includes(status);
}

/**
 * Check if work order can be completed
 */
export function canComplete(status: WorkOrderStatus): boolean {
  return COMPLETABLE_STATUSES.includes(status);
}

// ============================================================================
// WORK ORDER CRUD OPERATIONS
// ============================================================================

/**
 * Get work order by ID with parts
 */
export async function getWorkOrder(workOrderId: UUID): Promise<WorkOrderWithParts | null> {
  const cacheKey = workOrderCacheKey(workOrderId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getWorkOrderWithParts(workOrderId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * List work orders with filters
 * Requirement 14.6: List work orders with optional status and assignee filters
 */
export async function listWorkOrders(
  filters: WorkOrderListFilters = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrderWithParts>> {
  logger.info('Listing work orders', { filters, pagination });

  return repository.listWorkOrders(filters, pagination);
}

/**
 * Create a new work order
 * Requirement 14.1: Create work orders for maintenance tasks
 */
export async function createWorkOrder(
  request: CreateWorkOrderRequest
): Promise<WorkOrderWithParts> {
  logger.info('Creating work order', {
    assetId: request.assetId,
    workType: request.workType,
    title: request.title,
  });

  const timestamp = now();
  const workOrderNumber = generateWorkOrderNumber();

  // Create work order in database
  const result = await queryOne<{ work_order_id: string }>(
    `INSERT INTO work_orders (
      work_order_number, asset_id, maintenance_plan_id, work_type, priority,
      title, description, instructions, assigned_to, scheduled_date, due_date,
      estimated_duration_hours, estimated_cost, work_location, facility_id,
      requires_approval, parent_work_order_id, created_at, updated_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18, $19)
    RETURNING work_order_id`,
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

  const workOrder = await repository.getWorkOrderWithParts(result.work_order_id);
  if (!workOrder) {
    throw new Error('Failed to retrieve created work order');
  }

  // Publish event
  await publishEvent('WORK_ORDER_CREATED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    assetId: workOrder.assetId,
    workType: workOrder.workType,
    priority: workOrder.priority,
    assignedTo: workOrder.assignedTo,
  });

  logger.info('Work order created', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
  });

  return workOrder;
}

// ============================================================================
// ASSIGNMENT OPERATIONS
// Requirement 14.2: Assign work orders to technicians
// ============================================================================

/**
 * Assign work order to a technician
 * Requirement 14.2: Assign work orders to technicians
 */
export async function assignWorkOrder(
  request: AssignWorkOrderRequest
): Promise<WorkOrderWithParts> {
  logger.info('Assigning work order', {
    workOrderId: request.workOrderId,
    assignedTo: request.assignedTo,
  });

  // Get current work order
  const currentWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!currentWorkOrder) {
    throw new Error(`Work order not found: ${request.workOrderId}`);
  }

  // Validate status allows assignment
  if (!canAssign(currentWorkOrder.status)) {
    throw new Error(
      `Cannot assign work order in status ${currentWorkOrder.status}. ` +
      `Work order must be in one of: ${ASSIGNABLE_STATUSES.join(', ')}`
    );
  }

  const timestamp = now();

  // Update work order
  await queryOne(
    `UPDATE work_orders 
     SET assigned_to = $1,
         assigned_by = $2,
         assigned_date = $3,
         status = CASE WHEN status = 'OPEN' THEN 'ASSIGNED' ELSE status END,
         updated_at = $3,
         updated_by = $2
     WHERE work_order_id = $4`,
    [request.assignedTo, request.assignedBy, timestamp, request.workOrderId]
  );

  // Invalidate cache
  await cache.del(workOrderCacheKey(request.workOrderId));

  // Get updated work order
  const updatedWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!updatedWorkOrder) {
    throw new Error('Failed to retrieve updated work order');
  }

  // Publish event
  await publishEvent('WORK_ORDER_ASSIGNED', {
    workOrderId: updatedWorkOrder.workOrderId,
    workOrderNumber: updatedWorkOrder.workOrderNumber,
    assignedTo: request.assignedTo,
    assignedBy: request.assignedBy,
    previousAssignee: currentWorkOrder.assignedTo,
  });

  logger.info('Work order assigned', {
    workOrderId: request.workOrderId,
    assignedTo: request.assignedTo,
    newStatus: updatedWorkOrder.status,
  });

  return updatedWorkOrder;
}

// ============================================================================
// STATUS TRANSITION OPERATIONS
// Requirement 14.5: Support work order state transitions
// ============================================================================

/**
 * Update work order status
 * Requirement 14.5: Support work order state transitions (OPEN → IN_PROGRESS → COMPLETED)
 */
export async function updateWorkOrderStatus(
  request: UpdateWorkOrderStatusRequest
): Promise<WorkOrderWithParts> {
  logger.info('Updating work order status', {
    workOrderId: request.workOrderId,
    newStatus: request.status,
  });

  // Get current work order
  const currentWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!currentWorkOrder) {
    throw new Error(`Work order not found: ${request.workOrderId}`);
  }

  // Validate state transition
  if (!isValidStateTransition(currentWorkOrder.status, request.status)) {
    throw new Error(
      `Invalid state transition from ${currentWorkOrder.status} to ${request.status}. ` +
      `Valid transitions: ${VALID_STATE_TRANSITIONS[currentWorkOrder.status].join(', ') || 'none'}`
    );
  }

  const timestamp = now();
  const updates: string[] = ['status = $1', 'updated_at = $2'];
  const values: unknown[] = [request.status, timestamp];
  let paramIndex = 3;

  // Set started_date when transitioning to IN_PROGRESS
  if (request.status === 'IN_PROGRESS' && !currentWorkOrder.startedDate) {
    updates.push(`started_date = $${paramIndex++}`);
    values.push(timestamp);
  }

  // Set completed_date when transitioning to COMPLETED
  if (request.status === 'COMPLETED') {
    updates.push(`completed_date = $${paramIndex++}`);
    values.push(timestamp.split('T')[0]);
  }

  if (request.userId) {
    updates.push(`updated_by = $${paramIndex++}`);
    values.push(request.userId);
  }

  values.push(request.workOrderId);

  await queryOne(
    `UPDATE work_orders SET ${updates.join(', ')} WHERE work_order_id = $${paramIndex}`,
    values
  );

  // Invalidate cache
  await cache.del(workOrderCacheKey(request.workOrderId));

  // Get updated work order
  const updatedWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!updatedWorkOrder) {
    throw new Error('Failed to retrieve updated work order');
  }

  // Publish event
  await publishEvent('WORK_ORDER_STATUS_CHANGED', {
    workOrderId: updatedWorkOrder.workOrderId,
    workOrderNumber: updatedWorkOrder.workOrderNumber,
    previousStatus: currentWorkOrder.status,
    newStatus: request.status,
  });

  logger.info('Work order status updated', {
    workOrderId: request.workOrderId,
    previousStatus: currentWorkOrder.status,
    newStatus: request.status,
  });

  return updatedWorkOrder;
}

// ============================================================================
// COMPLETION OPERATIONS
// Requirement 14.4: Record labor hours and completion status
// ============================================================================

/**
 * Complete a work order
 * Requirement 14.4: Record labor hours and completion status
 * Requirement 14.7: Update maintenance plan last performed date upon completion
 */
export async function completeWorkOrder(
  request: CompleteWorkOrderRequest
): Promise<WorkOrderWithParts> {
  logger.info('Completing work order', { workOrderId: request.workOrderId });

  // Get current work order
  const currentWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!currentWorkOrder) {
    throw new Error(`Work order not found: ${request.workOrderId}`);
  }

  // Validate status allows completion
  if (!canComplete(currentWorkOrder.status)) {
    throw new Error(
      `Cannot complete work order in status ${currentWorkOrder.status}. ` +
      `Work order must be in one of: ${COMPLETABLE_STATUSES.join(', ')}`
    );
  }

  return withTransaction(async (ctx) => {
    const timestamp = now();
    const completedDate = timestamp.split('T')[0];

    // Calculate actual parts cost from work order parts
    const actualPartsCost = await repository.calculateWorkOrderPartsCost(request.workOrderId);
    const actualTotalCost = (request.actualLaborCost ?? 0) + actualPartsCost;

    // Update work order
    await ctx.queryOne(
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
       WHERE work_order_id = $9`,
      [
        completedDate,
        request.completionNotes ?? null,
        request.actualDurationHours ?? null,
        request.actualLaborCost ?? null,
        actualPartsCost,
        actualTotalCost > 0 ? actualTotalCost : null,
        timestamp,
        request.userId ?? null,
        request.workOrderId,
      ]
    );

    // If linked to maintenance plan, update the plan
    // Requirement 14.7: Update maintenance plan last performed date upon completion
    if (currentWorkOrder.maintenancePlanId) {
      await ctx.queryOne(
        `UPDATE maintenance_plans 
         SET last_performed_date = $1,
             execution_count = execution_count + 1,
             last_work_order_id = $2,
             updated_at = $3
         WHERE plan_id = $4`,
        [completedDate, request.workOrderId, timestamp, currentWorkOrder.maintenancePlanId]
      );

      // Recalculate next due date for time-based plans
      await ctx.queryOne(
        `UPDATE maintenance_plans 
         SET next_due_date = CASE 
           WHEN schedule_type = 'TIME_BASED' AND frequency_days IS NOT NULL 
           THEN ($1::date + (frequency_days || ' days')::interval)::date
           ELSE next_due_date
         END
         WHERE plan_id = $2`,
        [completedDate, currentWorkOrder.maintenancePlanId]
      );

      logger.info('Maintenance plan updated after work order completion', {
        planId: currentWorkOrder.maintenancePlanId,
        lastPerformedDate: completedDate,
      });
    }

    // Invalidate caches
    await cache.del(workOrderCacheKey(request.workOrderId));
    if (currentWorkOrder.maintenancePlanId) {
      await cache.del(entityKey(CACHE_ENTITY_TYPES.MAINTENANCE_PLAN, currentWorkOrder.maintenancePlanId));
    }

    // Get updated work order
    const updatedWorkOrder = await repository.getWorkOrderWithParts(request.workOrderId);
    if (!updatedWorkOrder) {
      throw new Error('Failed to retrieve completed work order');
    }

    // Publish event
    await publishEvent('WORK_ORDER_COMPLETED', {
      workOrderId: updatedWorkOrder.workOrderId,
      workOrderNumber: updatedWorkOrder.workOrderNumber,
      assetId: updatedWorkOrder.assetId,
      maintenancePlanId: updatedWorkOrder.maintenancePlanId,
      completedDate,
      actualDurationHours: request.actualDurationHours,
      actualLaborCost: request.actualLaborCost,
      actualPartsCost,
      actualTotalCost,
    });

    logger.info('Work order completed', {
      workOrderId: request.workOrderId,
      completedDate,
      actualTotalCost,
    });

    return updatedWorkOrder;
  });
}

// ============================================================================
// PARTS TRACKING OPERATIONS
// Requirement 14.3: Track parts used in work orders
// ============================================================================

/**
 * Get parts for a work order
 */
export async function getWorkOrderParts(workOrderId: UUID): Promise<WorkOrderPart[]> {
  const cacheKey = workOrderPartsCacheKey(workOrderId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getWorkOrderParts(workOrderId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Add a part to a work order
 * Requirement 14.3: Track parts used in work orders
 */
export async function addPartToWorkOrder(
  request: AddPartToWorkOrderRequest
): Promise<WorkOrderPart> {
  logger.info('Adding part to work order', {
    workOrderId: request.workOrderId,
    partId: request.partId,
    quantityRequired: request.quantityRequired,
  });

  // Verify work order exists
  const workOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!workOrder) {
    throw new Error(`Work order not found: ${request.workOrderId}`);
  }

  // Cannot add parts to completed/cancelled/closed work orders
  const invalidStatuses: WorkOrderStatus[] = ['COMPLETED', 'CANCELLED', 'CLOSED'];
  if (invalidStatuses.includes(workOrder.status)) {
    throw new Error(`Cannot add parts to work order in status ${workOrder.status}`);
  }

  const part = await repository.addPartToWorkOrder(request);

  // Invalidate caches
  await cache.del(workOrderCacheKey(request.workOrderId));
  await cache.del(workOrderPartsCacheKey(request.workOrderId));

  // Publish event
  await publishEvent('WORK_ORDER_PART_ADDED', {
    workOrderId: request.workOrderId,
    partId: request.partId,
    partNumber: part.partNumber,
    quantityRequired: request.quantityRequired,
  });

  return part;
}

/**
 * Record part usage on a work order
 * Requirement 14.3: Track parts used in work orders
 */
export async function recordPartUsage(
  request: RecordPartUsageRequest
): Promise<WorkOrderPart> {
  logger.info('Recording part usage', {
    workOrderId: request.workOrderId,
    partId: request.partId,
    quantityUsed: request.quantityUsed,
  });

  // Verify work order exists and is in valid status
  const workOrder = await repository.getWorkOrderWithParts(request.workOrderId);
  if (!workOrder) {
    throw new Error(`Work order not found: ${request.workOrderId}`);
  }

  // Can only record usage on active work orders
  const validStatuses: WorkOrderStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS'];
  if (!validStatuses.includes(workOrder.status)) {
    throw new Error(`Cannot record part usage on work order in status ${workOrder.status}`);
  }

  const part = await repository.recordPartUsage(request);

  // Invalidate caches
  await cache.del(workOrderCacheKey(request.workOrderId));
  await cache.del(workOrderPartsCacheKey(request.workOrderId));

  // Publish event
  await publishEvent('WORK_ORDER_PART_USED', {
    workOrderId: request.workOrderId,
    partId: request.partId,
    partNumber: part.partNumber,
    quantityUsed: request.quantityUsed,
    totalQuantityUsed: part.quantityUsed,
    totalCost: part.totalCost,
  });

  return part;
}

/**
 * Remove a part from a work order
 */
export async function removePartFromWorkOrder(
  workOrderId: UUID,
  partId: UUID
): Promise<void> {
  logger.info('Removing part from work order', { workOrderId, partId });

  // Verify work order exists
  const workOrder = await repository.getWorkOrderWithParts(workOrderId);
  if (!workOrder) {
    throw new Error(`Work order not found: ${workOrderId}`);
  }

  // Cannot remove parts from completed/cancelled/closed work orders
  const invalidStatuses: WorkOrderStatus[] = ['COMPLETED', 'CANCELLED', 'CLOSED'];
  if (invalidStatuses.includes(workOrder.status)) {
    throw new Error(`Cannot remove parts from work order in status ${workOrder.status}`);
  }

  await repository.removePartFromWorkOrder(workOrderId, partId);

  // Invalidate caches
  await cache.del(workOrderCacheKey(workOrderId));
  await cache.del(workOrderPartsCacheKey(workOrderId));

  // Publish event
  await publishEvent('WORK_ORDER_PART_REMOVED', {
    workOrderId,
    partId,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique work order number
 */
function generateWorkOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WO-${timestamp}-${random}`;
}

// Re-export types
export type {
  AddPartToWorkOrderRequest,
  RecordPartUsageRequest,
  WorkOrderListFilters,
  WorkOrderPart,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
  WorkOrderWithParts,
} from './work-order-repository';
