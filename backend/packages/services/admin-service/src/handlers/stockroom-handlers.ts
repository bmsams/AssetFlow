/**
 * Stockroom Handlers - Lambda handlers for Stockroom CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/stockrooms - Create a new stockroom
 * - GET /admin/stockrooms/{stockroomId} - Get stockroom by ID
 * - PUT /admin/stockrooms/{stockroomId} - Update stockroom
 * - POST /admin/stockrooms/{stockroomId}/deactivate - Deactivate stockroom
 * - GET /admin/stockrooms - List stockrooms with pagination and filters
 *
 * Requirements: 5.1-5.6 - Stockroom CRUD operations
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateStockroomRequest,
  StockroomListFilters,
  StockroomType,
  UpdateStockroomRequest,
  UUID,
} from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as stockroomService from '../stockroom/stockroom-service';
import {
  StockroomHasDependenciesError,
  StockroomNotFoundError,
} from '../stockroom/stockroom-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'stockroom-handlers' });

const VALID_STOCKROOM_TYPES: StockroomType[] = ['STANDARD', 'LOANER', 'REPAIR', 'DISPOSAL', 'QUARANTINE', 'MAIN', 'SATELLITE', 'VIRTUAL', 'RECEIVING', 'SPARE_PARTS', 'OTHER'];

// ============================================================================
// Request Validation
// ============================================================================

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

function validateCreateStockroomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: name
  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Required: stockroomType
  if (!request['stockroomType'] || typeof request['stockroomType'] !== 'string') {
    errors.push('stockroomType is required');
  } else if (!VALID_STOCKROOM_TYPES.includes(request['stockroomType'] as StockroomType)) {
    errors.push(`stockroomType must be one of: ${VALID_STOCKROOM_TYPES.join(', ')}`);
  }

  // Optional: location
  if (request['location'] !== undefined && typeof request['location'] !== 'string') {
    errors.push('location must be a string');
  }

  // Optional: managerId
  if (request['managerId'] !== undefined && request['managerId'] !== null) {
    const uuidError = validateUUID(request['managerId'] as string, 'managerId');
    if (uuidError) errors.push(uuidError.message);
  }

  return { valid: errors.length === 0, errors };
}

function validateUpdateStockroomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  const updateFields = ['name', 'location', 'stockroomType', 'managerId', 'isActive'];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  if (request['name'] !== undefined) {
    if (typeof request['name'] !== 'string') {
      errors.push('name must be a string');
    } else if (request['name'].length < 1 || request['name'].length > 255) {
      errors.push('name must be between 1 and 255 characters');
    }
  }

  if (request['stockroomType'] !== undefined) {
    if (!VALID_STOCKROOM_TYPES.includes(request['stockroomType'] as StockroomType)) {
      errors.push(`stockroomType must be one of: ${VALID_STOCKROOM_TYPES.join(', ')}`);
    }
  }

  if (request['location'] !== undefined && request['location'] !== null && typeof request['location'] !== 'string') {
    errors.push('location must be a string');
  }

  if (request['managerId'] !== undefined && request['managerId'] !== null) {
    const uuidError = validateUUID(request['managerId'] as string, 'managerId');
    if (uuidError) errors.push(uuidError.message);
  }

  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

function parseListFilters(queryParams: Record<string, string | undefined>): StockroomListFilters {
  const result: StockroomListFilters = {};

  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['stockroomType']) {
    Object.assign(result, { stockroomType: queryParams['stockroomType'] as StockroomType });
  }
  if (queryParams['managerId']) {
    Object.assign(result, { managerId: queryParams['managerId'] as UUID });
  }
  if (queryParams['search']) {
    Object.assign(result, { search: queryParams['search'] });
  }

  return result;
}

// User context (Cognito sub -> DB user_id, with provisioning)

// ============================================================================
// Lambda Handlers
// ============================================================================

export async function createStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create stockroom request received', { requestId });

  try {
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    const validation = validateCreateStockroomRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const request = body as CreateStockroomRequest;
    const stockroom = await stockroomService.createStockroom(request, userId);

    logger.info('Stockroom created successfully', { requestId, stockroomId: stockroom.stockroomId });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(stockroom, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create stockroom', requestId)
    );
  }
}

export async function getStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get stockroom request received', { requestId });

  try {
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const stockroom = await stockroomService.getStockroom(stockroomId as UUID);

    if (!stockroom) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Stockroom not found: ${stockroomId}`, requestId)
      );
    }

    logger.info('Stockroom retrieved successfully', { requestId, stockroomId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(stockroom, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get stockroom', requestId)
    );
  }
}

export async function updateStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update stockroom request received', { requestId });

  try {
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    const validation = validateUpdateStockroomRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const request = body as UpdateStockroomRequest;
    const stockroom = await stockroomService.updateStockroom(stockroomId as UUID, request, userId);

    logger.info('Stockroom updated successfully', { requestId, stockroomId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(stockroom, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof StockroomNotFoundError) {
      logger.warn('Stockroom not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update stockroom', requestId)
    );
  }
}

export async function deactivateStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate stockroom request received', { requestId });

  try {
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const stockroom = await stockroomService.deactivateStockroom(stockroomId as UUID, userId);

    logger.info('Stockroom deactivated successfully', { requestId, stockroomId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(stockroom, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof StockroomNotFoundError) {
      logger.warn('Stockroom not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof StockroomHasDependenciesError) {
      logger.warn('Stockroom has dependencies', {
        requestId,
        error: err.message,
        assetCount: err.assetCount,
        inventoryCount: err.inventoryCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate stockroom', requestId)
    );
  }
}

export async function listStockroomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List stockrooms request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};

    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 20;

    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 1000', requestId)
      );
    }

    const filters = parseListFilters(queryParams);
    const result = await stockroomService.listStockrooms(filters, { page, limit });

    logger.info('Stockrooms listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list stockrooms', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list stockrooms', requestId)
    );
  }
}

export async function getActiveStockroomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active stockrooms request received', { requestId });

  try {
    const stockrooms = await stockroomService.getActiveStockrooms();

    logger.info('Active stockrooms retrieved successfully', { requestId, count: stockrooms.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ stockrooms }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active stockrooms', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active stockrooms', requestId)
    );
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const stockroomId = event.pathParameters?.['stockroomId'];

  logger.info('Stockroom handler request', { method, path, stockroomId });

  if (method === 'GET') {
    if (path.endsWith('/active')) {
      return getActiveStockroomsHandler(event);
    }
    if (stockroomId) {
      return getStockroomHandler(event);
    }
    return listStockroomsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) {
      return deactivateStockroomHandler(event);
    }
    return createStockroomHandler(event);
  }

  if (method === 'PUT' && stockroomId) {
    return updateStockroomHandler(event);
  }

  return createLambdaResponse(
    405,
    createErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      `Method ${method} not allowed for ${path}`,
      event.requestContext.requestId
    )
  );
}
