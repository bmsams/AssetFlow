/**
 * List Work Orders Lambda Handler
 *
 * Lists work orders with filtering by asset, status, priority, and assigned user.
 * Supports pagination.
 * Requirements: 2C.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, validateUUID } from '@ams/utils';

import type { WorkOrder, WorkOrderPriority, WorkOrderStatus } from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'list-work-orders-handler' });

const VALID_STATUSES: WorkOrderStatus[] = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
  'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
];

const VALID_PRIORITIES: WorkOrderPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/**
 * Work order filter options
 */
interface WorkOrderFilters {
  readonly assetId?: UUID;
  readonly buildingId?: UUID;
  readonly building?: string;
  readonly status?: WorkOrderStatus;
  readonly priority?: WorkOrderPriority;
  readonly assignedTo?: UUID;
  readonly maintenancePlanId?: UUID;
}

/**
 * Database row type for work orders
 */
interface WorkOrderRow {
  work_order_id: string;
  work_order_number: string;
  asset_id: string;
  asset_tag: string | null;
  maintenance_plan_id: string | null;
  work_type: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string;
  description: string | null;
  instructions: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
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
 * Map database row to WorkOrder entity
 */
function mapRowToWorkOrder(row: WorkOrderRow): WorkOrder {
  return {
    workOrderId: row.work_order_id,
    workOrderNumber: row.work_order_number,
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    maintenancePlanId: row.maintenance_plan_id,
    workType: row.work_type as WorkOrder['workType'],
    priority: row.priority,
    status: row.status,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
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
  } as WorkOrder;
}

/**
 * List work orders with filters
 */
async function listWorkOrders(
  filters: WorkOrderFilters,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<WorkOrder>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

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

  if (filters.maintenancePlanId) {
    conditions.push(`wo.maintenance_plan_id = $${paramIndex++}`);
    values.push(filters.maintenancePlanId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM work_orders wo ${whereClause}`,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const rows = await queryMany<WorkOrderRow>(
    `SELECT wo.*,
            a.asset_tag,
            NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS assigned_to_name
     FROM work_orders wo
     LEFT JOIN assets a ON a.asset_id = wo.asset_id
     LEFT JOIN users u ON u.user_id = wo.assigned_to
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

  return {
    items: rows.map(mapRowToWorkOrder),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Parse and validate query parameters
 */
function parseQueryParams(event: APIGatewayProxyEvent): { valid: true; filters: WorkOrderFilters; pagination: PaginationParams } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  const filters: WorkOrderFilters = {};
  let page: number | undefined;
  let limit: number | undefined;

  const queryParams = event.queryStringParameters ?? {};

  // Parse assetId
  if (queryParams['assetId']) {
    const uuidError = validateUUID(queryParams['assetId'], 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      (filters as { assetId?: string }).assetId = queryParams['assetId'];
    }
  }

  // Parse status
  if (queryParams['status']) {
    if (!VALID_STATUSES.includes(queryParams['status'] as WorkOrderStatus)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      (filters as { status?: WorkOrderStatus }).status = queryParams['status'] as WorkOrderStatus;
    }
  }

  // Parse buildingId
  if (queryParams['buildingId']) {
    const uuidError = validateUUID(queryParams['buildingId'], 'buildingId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      (filters as { buildingId?: string }).buildingId = queryParams['buildingId'];
    }
  }

  // Parse building (legacy/location-string filter)
  if (queryParams['building']) {
    const building = queryParams['building']?.trim();
    if (!building) {
      errors.push('building must not be empty when provided');
    } else {
      (filters as { building?: string }).building = building;
    }
  }

  // Parse priority
  if (queryParams['priority']) {
    if (!VALID_PRIORITIES.includes(queryParams['priority'] as WorkOrderPriority)) {
      errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    } else {
      (filters as { priority?: WorkOrderPriority }).priority = queryParams['priority'] as WorkOrderPriority;
    }
  }

  // Parse assignedTo
  if (queryParams['assignedTo']) {
    const uuidError = validateUUID(queryParams['assignedTo'], 'assignedTo');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      (filters as { assignedTo?: string }).assignedTo = queryParams['assignedTo'];
    }
  }

  // Parse maintenancePlanId
  if (queryParams['maintenancePlanId']) {
    const uuidError = validateUUID(queryParams['maintenancePlanId'], 'maintenancePlanId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      (filters as { maintenancePlanId?: string }).maintenancePlanId = queryParams['maintenancePlanId'];
    }
  }

  // Parse pagination
  if (queryParams['page']) {
    const parsedPage = parseInt(queryParams['page'], 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('page must be a positive integer');
    } else {
      page = parsedPage;
    }
  }

  if (queryParams['limit']) {
    const parsedLimit = parseInt(queryParams['limit'], 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      limit = parsedLimit;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const pagination: PaginationParams = { page, limit };
  return { valid: true, filters, pagination };
}

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List work orders request received', { requestId });

  try {
    // Parse and validate query parameters
    const parseResult = parseQueryParams(event);
    if (!parseResult.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Invalid query parameters',
          requestId,
          parseResult.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // List work orders
    const result = await listWorkOrders(parseResult.filters, parseResult.pagination);

    logger.info('Work orders listed successfully', {
      requestId,
      total: result.total,
      returned: result.items.length,
      filters: parseResult.filters,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list work orders', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list work orders', requestId)
    );
  }
}
