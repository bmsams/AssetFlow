/**
 * Maintenance Service - Business logic layer for maintenance plan management
 *
 * Implements:
 * - Maintenance plan scheduling (Requirement 5.1)
 * - Work order generation when maintenance is due (Requirement 5.2)
 * - Time-based and usage-based schedule calculation
 * - Maintenance history tracking
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  CreateMaintenancePlanRequest,
  CreateWorkOrderRequest,
  MaintenancePlan,
  MaintenanceType,
  ScheduleType,
  ScheduleUnit,
  UpdateMaintenancePlanRequest,
  WorkOrder,
  WorkOrderStatus,
} from './maintenance-repository';
import * as repository from './maintenance-repository';

const logger = createLogger({ service: 'maintenance-service' });


/**
 * Cache key for maintenance plan
 */
function maintenancePlanCacheKey(planId: UUID): string {
  return entityKey(CACHE_ENTITY_TYPES.MAINTENANCE_PLAN, planId);
}

/**
 * Cache key for asset maintenance plans
 */
function assetMaintenancePlansCacheKey(assetId: UUID): string {
  return `asset:${assetId}:maintenance-plans`;
}

/**
 * Maintenance schedule configuration
 */
export interface MaintenanceSchedule {
  readonly planId: UUID;
  readonly scheduleType: ScheduleType;
  readonly interval: number;
  readonly unit: ScheduleUnit;
}

/**
 * Due maintenance item with plan details
 */
export interface DueMaintenanceItem {
  readonly plan: MaintenancePlan;
  readonly daysOverdue: number;
  readonly isOverdue: boolean;
  readonly isCritical: boolean;
}

/**
 * Work order generation result
 */
export interface WorkOrderGenerationResult {
  readonly workOrdersCreated: readonly WorkOrder[];
  readonly plansProcessed: number;
  readonly errors: readonly { planId: UUID; error: string }[];
}

/**
 * Calculate next due date based on schedule type and interval
 * Requirement 5.1: Schedule preventative maintenance based on time intervals or usage metrics
 */
export function calculateNextDueDate(
  scheduleType: ScheduleType,
  interval: number,
  unit: ScheduleUnit,
  fromDate: Date = new Date()
): Date | null {
  if (scheduleType === 'USAGE_BASED') {
    // Usage-based schedules don't have a fixed date
    // They are triggered when usage threshold is reached
    return null;
  }

  const nextDate = new Date(fromDate);

  switch (unit) {
    case 'DAYS':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'WEEKS':
      nextDate.setDate(nextDate.getDate() + interval * 7);
      break;
    case 'MONTHS':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'HOURS':
    case 'MILES':
    case 'CYCLES':
      // These are usage-based units, return null for time-based calculation
      return null;
    default:
      return null;
  }

  return nextDate;
}


/**
 * Convert frequency to schedule unit
 * @internal Used for schedule calculations
 */
export function getScheduleUnit(plan: MaintenancePlan): ScheduleUnit {
  if (plan.frequencyDays !== null) {
    return 'DAYS';
  }
  if (plan.frequencyHours !== null) {
    return 'HOURS';
  }
  return 'DAYS';
}

/**
 * Get interval value from plan
 * @internal Used for schedule calculations
 */
export function getIntervalValue(plan: MaintenancePlan): number {
  return plan.frequencyDays ?? plan.frequencyHours ?? 0;
}

/**
 * Get maintenance plan by ID
 */
export async function getMaintenancePlan(planId: UUID): Promise<MaintenancePlan | null> {
  const cacheKey = maintenancePlanCacheKey(planId);

  return cache.getOrSet(
    cacheKey,
    () => repository.getMaintenancePlanById(planId),
    { ttl: cache.DEFAULT_TTL.MEDIUM }
  );
}

/**
 * Get maintenance plans for an asset
 */
export async function getMaintenancePlansByAsset(
  assetId: UUID,
  includeInactive = false
): Promise<MaintenancePlan[]> {
  logger.info('Getting maintenance plans for asset', { assetId, includeInactive });

  return repository.getMaintenancePlansByAsset(assetId, includeInactive);
}

/**
 * Get all active maintenance plans with pagination
 */
export async function getActiveMaintenancePlans(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<MaintenancePlan>> {
  return repository.getActiveMaintenancePlans(pagination);
}

/**
 * Get maintenance plans with optional active/inactive filter
 */
export async function getMaintenancePlans(
  pagination: PaginationParams = {},
  isActive?: boolean
): Promise<PaginatedResult<MaintenancePlan>> {
  return repository.getMaintenancePlans(pagination, isActive);
}

/**
 * Create a new maintenance plan
 * Requirement 5.1: Schedule preventative maintenance based on time intervals or usage metrics
 */
export async function createMaintenancePlan(
  request: CreateMaintenancePlanRequest
): Promise<MaintenancePlan> {
  logger.info('Creating maintenance plan', {
    assetId: request.assetId,
    planName: request.planName,
    scheduleType: request.scheduleType,
  });

  // Validate schedule configuration
  if (request.scheduleType === 'TIME_BASED' && !request.frequencyDays) {
    throw new Error('Time-based maintenance plans require frequencyDays');
  }

  if (request.scheduleType === 'USAGE_BASED' && !request.frequencyHours) {
    throw new Error('Usage-based maintenance plans require frequencyHours');
  }

  const plan = await repository.createMaintenancePlan(request);

  // Invalidate cache
  await cache.del(assetMaintenancePlansCacheKey(request.assetId));

  // Publish event
  await publishEvent('MAINTENANCE_PLAN_CREATED', {
    planId: plan.planId,
    assetId: plan.assetId,
    planName: plan.planName,
    scheduleType: plan.scheduleType,
    nextDueDate: plan.nextDueDate,
  });

  logger.info('Maintenance plan created', {
    planId: plan.planId,
    assetId: plan.assetId,
    nextDueDate: plan.nextDueDate,
  });

  return plan;
}


/**
 * Update a maintenance plan
 */
export async function updateMaintenancePlan(
  planId: UUID,
  request: UpdateMaintenancePlanRequest
): Promise<MaintenancePlan> {
  logger.info('Updating maintenance plan', { planId, request });

  // Get current plan
  const currentPlan = await repository.getMaintenancePlanById(planId);
  if (!currentPlan) {
    throw new Error(`Maintenance plan not found: ${planId}`);
  }

  // Validate schedule configuration if changing schedule type
  if (request.scheduleType === 'TIME_BASED') {
    const frequencyDays = request.frequencyDays ?? currentPlan.frequencyDays;
    if (!frequencyDays) {
      throw new Error('Time-based maintenance plans require frequencyDays');
    }
  }

  if (request.scheduleType === 'USAGE_BASED') {
    const frequencyHours = request.frequencyHours ?? currentPlan.frequencyHours;
    if (!frequencyHours) {
      throw new Error('Usage-based maintenance plans require frequencyHours');
    }
  }

  const updatedPlan = await repository.updateMaintenancePlan(planId, request);
  if (!updatedPlan) {
    throw new Error(`Failed to update maintenance plan: ${planId}`);
  }

  // Invalidate cache
  await cache.del(maintenancePlanCacheKey(planId));
  await cache.del(assetMaintenancePlansCacheKey(currentPlan.assetId));

  // Publish event
  await publishEvent('MAINTENANCE_PLAN_UPDATED', {
    planId: updatedPlan.planId,
    assetId: updatedPlan.assetId,
    planName: updatedPlan.planName,
    changes: Object.keys(request),
  });

  logger.info('Maintenance plan updated', { planId });

  return updatedPlan;
}

/**
 * Deactivate a maintenance plan
 */
export async function deactivateMaintenancePlan(
  planId: UUID,
  userId?: UUID
): Promise<MaintenancePlan> {
  logger.info('Deactivating maintenance plan', { planId });

  const plan = await updateMaintenancePlan(planId, {
    isActive: false,
    updatedBy: userId,
  });

  // Publish event
  await publishEvent('MAINTENANCE_PLAN_DEACTIVATED', {
    planId: plan.planId,
    assetId: plan.assetId,
    planName: plan.planName,
  });

  return plan;
}


/**
 * Check for due maintenance and return items that need attention
 * Requirement 5.1: Schedule preventative maintenance based on time intervals
 */
export async function checkDueMaintenance(
  asOfDate?: string
): Promise<DueMaintenanceItem[]> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);
  logger.info('Checking due maintenance', { asOfDate: checkDate });

  const duePlans = await repository.getDueMaintenancePlans(checkDate);
  const today = new Date(checkDate);

  const dueItems: DueMaintenanceItem[] = duePlans.map((plan) => {
    const dueDate = plan.nextDueDate ? new Date(plan.nextDueDate) : today;
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysOverdue > 0;
    const isCritical = isOverdue && (
      plan.priority === 'CRITICAL' ||
      (plan.maxOverdueDays !== null && daysOverdue > plan.maxOverdueDays)
    );

    return {
      plan,
      daysOverdue: Math.max(0, daysOverdue),
      isOverdue,
      isCritical,
    };
  });

  logger.info('Due maintenance check complete', {
    totalDue: dueItems.length,
    overdue: dueItems.filter(i => i.isOverdue).length,
    critical: dueItems.filter(i => i.isCritical).length,
  });

  return dueItems;
}

/**
 * Get upcoming maintenance within specified days
 */
export async function getUpcomingMaintenance(
  daysAhead: number = 7
): Promise<MaintenancePlan[]> {
  logger.info('Getting upcoming maintenance', { daysAhead });

  return repository.getUpcomingMaintenancePlans(daysAhead);
}

/**
 * Generate work orders for due maintenance plans
 * Requirement 5.2: Generate work orders when maintenance is due
 */
export async function generateWorkOrders(
  asOfDate?: string,
  userId?: UUID
): Promise<WorkOrderGenerationResult> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);
  logger.info('Generating work orders for due maintenance', { asOfDate: checkDate });

  const dueItems = await checkDueMaintenance(checkDate);
  const workOrdersCreated: WorkOrder[] = [];
  const errors: { planId: UUID; error: string }[] = [];

  for (const item of dueItems) {
    try {
      const workOrder = await createWorkOrderFromPlan(item.plan, checkDate, userId);
      workOrdersCreated.push(workOrder);

      // Update the maintenance plan with the new work order
      await repository.recordMaintenanceExecution(
        item.plan.planId,
        checkDate,
        workOrder.workOrderId
      );

      // Invalidate cache
      await cache.del(maintenancePlanCacheKey(item.plan.planId));
      await cache.del(assetMaintenancePlansCacheKey(item.plan.assetId));
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to generate work order for plan', err, {
        planId: item.plan.planId,
      });
      errors.push({ planId: item.plan.planId, error: err.message });
    }
  }

  logger.info('Work order generation complete', {
    plansProcessed: dueItems.length,
    workOrdersCreated: workOrdersCreated.length,
    errors: errors.length,
  });

  return {
    workOrdersCreated,
    plansProcessed: dueItems.length,
    errors,
  };
}


/**
 * Create a work order from a maintenance plan
 */
async function createWorkOrderFromPlan(
  plan: MaintenancePlan,
  scheduledDate: string,
  userId?: UUID
): Promise<WorkOrder> {
  // Calculate due date based on lead time
  const dueDate = new Date(scheduledDate);
  dueDate.setDate(dueDate.getDate() + (plan.leadTimeDays || 7));

  const workOrderRequest: CreateWorkOrderRequest = {
    assetId: plan.assetId,
    maintenancePlanId: plan.planId,
    workType: mapMaintenanceTypeToWorkType(plan.maintenanceType),
    priority: plan.priority,
    title: `${plan.planName} - Scheduled Maintenance`,
    description: plan.description ?? undefined,
    assignedTo: plan.defaultAssignedTo ?? undefined,
    scheduledDate,
    dueDate: dueDate.toISOString().split('T')[0],
    estimatedDurationHours: plan.estimatedDurationHours ?? undefined,
    estimatedCost: plan.estimatedCost ?? undefined,
    createdBy: userId,
  };

  const workOrder = await repository.createWorkOrder(workOrderRequest);

  // Publish event
  await publishEvent('WORK_ORDER_CREATED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    assetId: workOrder.assetId,
    maintenancePlanId: workOrder.maintenancePlanId,
    workType: workOrder.workType,
    priority: workOrder.priority,
    scheduledDate: workOrder.scheduledDate,
  });

  return workOrder;
}

/**
 * Map maintenance type to work order type
 */
function mapMaintenanceTypeToWorkType(maintenanceType: MaintenanceType): repository.WorkOrderType {
  switch (maintenanceType) {
    case 'PREVENTIVE':
    case 'PREDICTIVE':
    case 'SEASONAL':
      return 'PREVENTIVE';
    case 'INSPECTION':
    case 'SAFETY_CHECK':
    case 'REGULATORY':
      return 'INSPECTION';
    case 'CALIBRATION':
      return 'CALIBRATION';
    case 'LUBRICATION':
    case 'CLEANING':
    case 'OTHER':
    default:
      return 'PREVENTIVE';
  }
}


/**
 * Get work order by ID
 */
export async function getWorkOrder(workOrderId: UUID): Promise<WorkOrder | null> {
  return repository.getWorkOrderById(workOrderId);
}

/**
 * Get work orders for an asset
 */
export async function getWorkOrdersByAsset(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  return repository.getWorkOrdersByAsset(assetId, pagination);
}

/**
 * Get work orders for a maintenance plan
 */
export async function getWorkOrdersByPlan(
  planId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  return repository.getWorkOrdersByPlan(planId, pagination);
}

/**
 * Get all open work orders
 */
export async function getOpenWorkOrders(
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  return repository.getOpenWorkOrders(pagination);
}

/**
 * Create a manual work order (not from a maintenance plan)
 */
export async function createWorkOrder(
  request: CreateWorkOrderRequest
): Promise<WorkOrder> {
  logger.info('Creating manual work order', {
    assetId: request.assetId,
    workType: request.workType,
    title: request.title,
  });

  const workOrder = await repository.createWorkOrder(request);

  // Publish event
  await publishEvent('WORK_ORDER_CREATED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    assetId: workOrder.assetId,
    workType: workOrder.workType,
    priority: workOrder.priority,
    scheduledDate: workOrder.scheduledDate,
  });

  return workOrder;
}

/**
 * Assign a work order to a user
 */
export async function assignWorkOrder(
  workOrderId: UUID,
  assignedTo: UUID,
  assignedBy: UUID
): Promise<WorkOrder> {
  logger.info('Assigning work order', { workOrderId, assignedTo, assignedBy });

  const workOrder = await repository.assignWorkOrder(workOrderId, assignedTo, assignedBy);
  if (!workOrder) {
    throw new Error(`Work order not found: ${workOrderId}`);
  }

  // Publish event
  await publishEvent('WORK_ORDER_ASSIGNED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    assignedTo,
    assignedBy,
  });

  return workOrder;
}


/**
 * Update work order status
 */
export async function updateWorkOrderStatus(
  workOrderId: UUID,
  status: WorkOrderStatus,
  userId?: UUID
): Promise<WorkOrder> {
  logger.info('Updating work order status', { workOrderId, status });

  const workOrder = await repository.updateWorkOrderStatus(workOrderId, status, userId);
  if (!workOrder) {
    throw new Error(`Work order not found: ${workOrderId}`);
  }

  // Publish event
  await publishEvent('WORK_ORDER_STATUS_CHANGED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    status,
    previousStatus: workOrder.status,
  });

  return workOrder;
}

/**
 * Complete a work order
 */
export async function completeWorkOrder(
  workOrderId: UUID,
  completionNotes: string | null,
  actualDurationHours: number | null,
  actualLaborCost: number | null,
  actualPartsCost: number | null,
  userId?: UUID
): Promise<WorkOrder> {
  logger.info('Completing work order', { workOrderId });

  const workOrder = await repository.completeWorkOrder(
    workOrderId,
    completionNotes,
    actualDurationHours,
    actualLaborCost,
    actualPartsCost,
    userId
  );

  if (!workOrder) {
    throw new Error(`Work order not found: ${workOrderId}`);
  }

  // If this work order is from a maintenance plan, update the plan
  if (workOrder.maintenancePlanId) {
    await repository.recordMaintenanceExecution(
      workOrder.maintenancePlanId,
      workOrder.completedDate!,
      workOrder.workOrderId
    );

    // Invalidate cache
    await cache.del(maintenancePlanCacheKey(workOrder.maintenancePlanId));
  }

  // Publish event
  await publishEvent('WORK_ORDER_COMPLETED', {
    workOrderId: workOrder.workOrderId,
    workOrderNumber: workOrder.workOrderNumber,
    assetId: workOrder.assetId,
    maintenancePlanId: workOrder.maintenancePlanId,
    completedDate: workOrder.completedDate,
    actualDurationHours,
    actualTotalCost: workOrder.actualTotalCost,
  });

  return workOrder;
}

/**
 * Update usage-based maintenance schedule
 * Called when asset usage metrics are updated
 */
export async function updateUsageBasedSchedule(
  assetId: UUID,
  currentUsageHours: number
): Promise<MaintenancePlan[]> {
  logger.info('Updating usage-based schedules', { assetId, currentUsageHours });

  const plans = await repository.getMaintenancePlansByAsset(assetId, false);
  const usageBasedPlans = plans.filter(p => p.scheduleType === 'USAGE_BASED');
  const updatedPlans: MaintenancePlan[] = [];

  for (const plan of usageBasedPlans) {
    if (!plan.frequencyHours) continue;

    // Calculate next due based on usage threshold
    const lastPerformedHours = plan.lastPerformedDate ? 0 : 0; // Would need to track this
    const nextDueHours = lastPerformedHours + plan.frequencyHours;

    if (currentUsageHours >= nextDueHours) {
      // Maintenance is due now
      const today = new Date().toISOString().slice(0, 10);
      const updated = await repository.updateNextDueDate(plan.planId, today);
      if (updated) {
        updatedPlans.push(updated);
        await cache.del(maintenancePlanCacheKey(plan.planId));
      }
    }
  }

  return updatedPlans;
}

// Re-export types
export type {
  CreateMaintenancePlanRequest,
  CreateWorkOrderRequest,
  MaintenancePlan,
  MaintenanceType,
  ScheduleType,
  ScheduleUnit,
  UpdateMaintenancePlanRequest,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from './maintenance-repository';
