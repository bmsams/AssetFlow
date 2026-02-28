/**
 * Work Order Handlers - Lambda handlers for enhanced work order management
 *
 * Implements API endpoints for:
 * - Parts tracking (Requirement 14.3)
 * - Assignment (Requirement 14.2)
 * - Status transitions (Requirement 14.5)
 * - Completion with labor hours (Requirement 14.4)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type {
  AddPartToWorkOrderRequest,
  RecordPartUsageRequest,
  WorkOrderListFilters,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from '../work-order/work-order-service';
import * as workOrderService from '../work-order/work-order-service';

const logger = createLogger({ service: 'work-order-handlers' });

const VALID_STATUSES: WorkOrderStatus[] = [
  'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD',
  'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED', 'CLOSED'
];

const VALID_PRIORITIES: WorkOrderPriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const VALID_WORK_TYPES: WorkOrderType[] = [
  'PREVENTIVE', 'CORRECTIVE', 'EMERGENCY', 'INSPECTION',
  'CALIBRATION', 'INSTALLATION', 'MODIFICATION', 'DECOMMISSION', 'PROJECT', 'OTHER'
];

// ============================================================================
// GET WORK ORDER WITH PARTS
// ============================================================================

/**
 * Get work order with parts details
 */
export async function getWorkOrderWithParts(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get work order with parts request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const workOrder = await workOrderService.getWorkOrder(workOrderId);
    if (!workOrder) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Work order not found: ${workOrderId}`, requestId)
      );
    }

    logger.info('Work order with parts retrieved', {
      requestId,
      workOrderId,
      partsCount: workOrder.partsUsed.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get work order with parts', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get work order', requestId)
    );
  }
}

// ============================================================================
// LIST WORK ORDERS
// ============================================================================

/**
 * Parse and validate list work orders query parameters
 */
function parseListQueryParams(event: APIGatewayProxyEvent): {
  valid: true;
  filters: WorkOrderListFilters;
  pagination: { page?: number; limit?: number };
} | { valid: false; errors: string[] } {
  const errors: string[] = [];
  let filters: WorkOrderListFilters = {};
  let page: number | undefined;
  let limit: number | undefined;

  const queryParams = event.queryStringParameters ?? {};

  // Parse status
  if (queryParams['status']) {
    if (!VALID_STATUSES.includes(queryParams['status'] as WorkOrderStatus)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      filters = { ...filters, status: queryParams['status'] as WorkOrderStatus };
    }
  }

  // Parse priority
  if (queryParams['priority']) {
    if (!VALID_PRIORITIES.includes(queryParams['priority'] as WorkOrderPriority)) {
      errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    } else {
      filters = { ...filters, priority: queryParams['priority'] as WorkOrderPriority };
    }
  }

  // Parse workType
  if (queryParams['workType']) {
    if (!VALID_WORK_TYPES.includes(queryParams['workType'] as WorkOrderType)) {
      errors.push(`workType must be one of: ${VALID_WORK_TYPES.join(', ')}`);
    } else {
      filters = { ...filters, workType: queryParams['workType'] as WorkOrderType };
    }
  }

  // Parse assignedTo
  if (queryParams['assignedTo']) {
    const uuidError = validateUUID(queryParams['assignedTo'], 'assignedTo');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      filters = { ...filters, assignedTo: queryParams['assignedTo'] };
    }
  }

  // Parse assetId
  if (queryParams['assetId']) {
    const uuidError = validateUUID(queryParams['assetId'], 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      filters = { ...filters, assetId: queryParams['assetId'] };
    }
  }

  // Parse buildingId
  if (queryParams['buildingId']) {
    const uuidError = validateUUID(queryParams['buildingId'], 'buildingId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      filters = { ...filters, buildingId: queryParams['buildingId'] };
    }
  }

  // Parse building (legacy/location-string filter)
  if (queryParams['building']) {
    const building = queryParams['building']?.trim();
    if (!building) {
      errors.push('building must not be empty when provided');
    } else {
      filters = { ...filters, building };
    }
  }

  // Parse maintenancePlanId
  if (queryParams['maintenancePlanId']) {
    const uuidError = validateUUID(queryParams['maintenancePlanId'], 'maintenancePlanId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      filters = { ...filters, maintenancePlanId: queryParams['maintenancePlanId'] };
    }
  }

  // Parse date filters
  if (queryParams['fromDate']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(queryParams['fromDate'])) {
      errors.push('fromDate must be in YYYY-MM-DD format');
    } else {
      filters = { ...filters, fromDate: queryParams['fromDate'] };
    }
  }

  if (queryParams['toDate']) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(queryParams['toDate'])) {
      errors.push('toDate must be in YYYY-MM-DD format');
    } else {
      filters = { ...filters, toDate: queryParams['toDate'] };
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

  return { valid: true, filters: filters as WorkOrderListFilters, pagination: { page, limit } };
}

/**
 * List work orders with filters
 */
export async function listWorkOrdersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List work orders request received', { requestId });

  try {
    const parseResult = parseListQueryParams(event);
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

    const result = await workOrderService.listWorkOrders(parseResult.filters, parseResult.pagination);

    logger.info('Work orders listed', {
      requestId,
      total: result.total,
      returned: result.items.length,
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

// ============================================================================
// UPDATE WORK ORDER STATUS
// ============================================================================

/**
 * Update work order status
 */
export async function updateWorkOrderStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update work order status request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    if (!body || typeof body !== 'object') {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    const request = body as Record<string, unknown>;

    // Validate status
    if (!request['status']) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'status is required', requestId)
      );
    }

    if (!VALID_STATUSES.includes(request['status'] as WorkOrderStatus)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${VALID_STATUSES.join(', ')}`,
          requestId
        )
      );
    }

    const workOrder = await workOrderService.updateWorkOrderStatus({
      workOrderId,
      status: request['status'] as WorkOrderStatus,
      userId,
    });

    logger.info('Work order status updated', {
      requestId,
      workOrderId,
      newStatus: request['status'],
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update work order status', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Invalid state transition')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update work order status', requestId)
    );
  }
}

// ============================================================================
// PARTS TRACKING HANDLERS
// Requirement 14.3: Track parts used in work orders
// ============================================================================

/**
 * Get parts for a work order
 */
export async function getWorkOrderPartsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get work order parts request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const parts = await workOrderService.getWorkOrderParts(workOrderId);

    logger.info('Work order parts retrieved', {
      requestId,
      workOrderId,
      partsCount: parts.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(parts, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get work order parts', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get work order parts', requestId)
    );
  }
}

/**
 * Validate add part request
 */
function validateAddPartRequest(body: unknown): {
  valid: true;
  data: Omit<AddPartToWorkOrderRequest, 'workOrderId'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (!request['partId']) {
    errors.push('partId is required');
  } else {
    const uuidError = validateUUID(request['partId'] as string, 'partId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['quantityRequired'] === undefined) {
    errors.push('quantityRequired is required');
  } else if (typeof request['quantityRequired'] !== 'number' || request['quantityRequired'] <= 0) {
    errors.push('quantityRequired must be a positive number');
  }

  // Validate optional fields
  const result = validate()
    .stringLength(request['notes'] as string | undefined, 'notes', 0, 1000)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      partId: request['partId'] as string,
      quantityRequired: request['quantityRequired'] as number,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Add part to work order
 */
export async function addPartToWorkOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Add part to work order request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateAddPartRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const part = await workOrderService.addPartToWorkOrder({
      workOrderId,
      ...validation.data,
    });

    logger.info('Part added to work order', {
      requestId,
      workOrderId,
      partId: part.partId,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(part, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to add part to work order', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot add parts')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to add part to work order', requestId)
    );
  }
}

/**
 * Validate record part usage request
 */
function validateRecordPartUsageRequest(body: unknown): {
  valid: true;
  data: Omit<RecordPartUsageRequest, 'workOrderId'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (!request['partId']) {
    errors.push('partId is required');
  } else {
    const uuidError = validateUUID(request['partId'] as string, 'partId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['quantityUsed'] === undefined) {
    errors.push('quantityUsed is required');
  } else if (typeof request['quantityUsed'] !== 'number' || request['quantityUsed'] <= 0) {
    errors.push('quantityUsed must be a positive number');
  }

  // Validate optional fields
  const result = validate()
    .stringLength(request['notes'] as string | undefined, 'notes', 0, 1000)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      partId: request['partId'] as string,
      quantityUsed: request['quantityUsed'] as number,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Record part usage on work order
 */
export async function recordPartUsageHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Record part usage request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateRecordPartUsageRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const part = await workOrderService.recordPartUsage({
      workOrderId,
      ...validation.data,
    });

    logger.info('Part usage recorded', {
      requestId,
      workOrderId,
      partId: part.partId,
      quantityUsed: part.quantityUsed,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(part, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to record part usage', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot') || err.message.includes('Only')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record part usage', requestId)
    );
  }
}

/**
 * Remove part from work order
 */
export async function removePartFromWorkOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Remove part from work order request received', { requestId });

  try {
    const workOrderId = event.pathParameters?.['workOrderId'];
    const partId = event.pathParameters?.['partId'];

    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    if (!partId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'partId is required in path', requestId)
      );
    }

    const workOrderIdError = validateUUID(workOrderId, 'workOrderId');
    if (workOrderIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, workOrderIdError.message, requestId)
      );
    }

    const partIdError = validateUUID(partId, 'partId');
    if (partIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, partIdError.message, requestId)
      );
    }

    await workOrderService.removePartFromWorkOrder(workOrderId, partId);

    logger.info('Part removed from work order', {
      requestId,
      workOrderId,
      partId,
    });

    return createLambdaResponse(
      HTTP_STATUS.NO_CONTENT,
      null
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to remove part from work order', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot remove')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to remove part from work order', requestId)
    );
  }
}

// ============================================================================
// UNIFIED HANDLER
// Routes API Gateway requests to the appropriate handler function
// CDK routes:
//   GET    /eam/work-orders                          → list
//   POST   /eam/work-orders                          → create
//   GET    /eam/work-orders/{workOrderId}             → get by ID
//   POST   /eam/work-orders/{workOrderId}/complete    → complete
//   POST   /eam/work-orders/{workOrderId}/assign      → assign
// ============================================================================

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const workOrderId = event.pathParameters?.['workOrderId'];

  logger.info('Handler request', { method, path, workOrderId });

  // POST /eam/work-orders/{workOrderId}/complete
  if (method === 'POST' && workOrderId && path.endsWith('/complete')) {
    const { handler: completeHandler } = await import('./complete-work-order');
    return completeHandler(event);
  }

  // POST /eam/work-orders/{workOrderId}/assign
  if (method === 'POST' && workOrderId && path.endsWith('/assign')) {
    const { handler: assignHandler } = await import('./assign-work-order');
    return assignHandler(event);
  }

  // GET /eam/work-orders/{workOrderId}
  if (method === 'GET' && workOrderId) {
    return getWorkOrderWithParts(event);
  }

  // GET /eam/work-orders
  if (method === 'GET' && !workOrderId) {
    return listWorkOrdersHandler(event);
  }

  // POST /eam/work-orders
  if (method === 'POST' && !workOrderId) {
    const { handler: createHandler } = await import('./create-work-order');
    return createHandler(event);
  }

  return createLambdaResponse(405, createErrorResponse(
    API_ERROR_CODES.BAD_REQUEST,
    `Method ${method} not allowed for ${path}`,
    event.requestContext.requestId
  ));
}

export default handler;
