/**
 * Stockroom Admin Handlers - Lambda handlers for Stockroom CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/stockrooms - Create a new stockroom
 * - GET /admin/stockrooms/{stockroomId} - Get stockroom by ID
 * - GET /admin/stockrooms/location/{locationId} - Get stockrooms by location
 * - PUT /admin/stockrooms/{stockroomId} - Update stockroom
 * - POST /admin/stockrooms/{stockroomId}/deactivate - Deactivate stockroom
 * - DELETE /admin/stockrooms/{stockroomId} - Delete stockroom
 * - GET /admin/stockrooms - List stockrooms with pagination and filters
 *
 * Requirement 5: Stockroom CRUD Operations
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { UUID } from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { StockroomListFilters, StockroomType } from '../stockroom/stockroom-service';
import * as stockroomService from '../stockroom/stockroom-service';
import {
  LocationNotFoundError,
  StockroomCodeExistsError,
  StockroomHasDependenciesError,
  StockroomNameExistsError,
  StockroomNotFoundError,
} from '../stockroom/stockroom-service';

const logger = createLogger({ service: 'stockroom-admin-handlers' });


// ============================================================================
// Constants
// ============================================================================

const VALID_STOCKROOM_TYPES: StockroomType[] = [
  'STANDARD',
  'LOANER',
  'REPAIR',
  'DISPOSAL',
  'QUARANTINE',
  'MAIN',
  'SATELLITE',
  'VIRTUAL',
  'RECEIVING',
  'SPARE_PARTS',
  'OTHER',
];

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validation result type
 */
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate create stockroom request
 * Requirement 5.1: Create stockroom with name, type, manager, and capacity
 */
function validateCreateStockroomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required fields
  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Optional stockroomCode validation
  if (request['stockroomCode'] !== undefined) {
    if (typeof request['stockroomCode'] !== 'string') {
      errors.push('stockroomCode must be a string');
    } else if (request['stockroomCode'].length > 50) {
      errors.push('stockroomCode must be at most 50 characters');
    }
  }

  // Optional stockroomType validation
  if (request['stockroomType'] !== undefined) {
    if (typeof request['stockroomType'] !== 'string') {
      errors.push('stockroomType must be a string');
    } else if (!VALID_STOCKROOM_TYPES.includes(request['stockroomType'] as StockroomType)) {
      errors.push(`stockroomType must be one of: ${VALID_STOCKROOM_TYPES.join(', ')}`);
    }
  }

  // Optional managerId validation
  if (request['managerId'] !== undefined && request['managerId'] !== null) {
    if (typeof request['managerId'] !== 'string') {
      errors.push('managerId must be a string');
    } else {
      const uuidError = validateUUID(request['managerId'], 'managerId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Optional building (location) validation
  if (request['building'] !== undefined && request['building'] !== null) {
    if (typeof request['building'] !== 'string') {
      errors.push('building must be a string');
    } else {
      const uuidError = validateUUID(request['building'], 'building');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Optional string fields validation
  const optionalStringFields = [
    'location',
    'description',
    'addressLine1',
    'addressLine2',
    'city',
    'stateProvince',
    'postalCode',
    'country',
    'floor',
    'room',
    'contactName',
    'contactPhone',
  ];

  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Email validation
  if (request['contactEmail'] !== undefined && request['contactEmail'] !== null) {
    if (typeof request['contactEmail'] !== 'string') {
      errors.push('contactEmail must be a string');
    } else if (request['contactEmail'] !== '' && !isValidEmail(request['contactEmail'])) {
      errors.push('contactEmail must be a valid email address');
    }
  }

  // Capacity validation
  if (request['capacityUnits'] !== undefined && request['capacityUnits'] !== null) {
    if (typeof request['capacityUnits'] !== 'number') {
      errors.push('capacityUnits must be a number');
    } else if (!Number.isInteger(request['capacityUnits']) || request['capacityUnits'] < 0) {
      errors.push('capacityUnits must be a non-negative integer');
    }
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Validate update stockroom request
 * Requirement 5.3: Update specified fields and maintain location relationship
 */
function validateUpdateStockroomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = [
    'name',
    'stockroomType',
    'managerId',
    'location',
    'description',
    'addressLine1',
    'addressLine2',
    'city',
    'stateProvince',
    'postalCode',
    'country',
    'building',
    'floor',
    'room',
    'contactName',
    'contactEmail',
    'contactPhone',
    'capacityUnits',
    'isActive',
  ];

  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate name if provided
  if (request['name'] !== undefined) {
    if (typeof request['name'] !== 'string') {
      errors.push('name must be a string');
    } else if (request['name'].length < 1 || request['name'].length > 255) {
      errors.push('name must be between 1 and 255 characters');
    }
  }

  // Validate stockroomType if provided
  if (request['stockroomType'] !== undefined) {
    if (typeof request['stockroomType'] !== 'string') {
      errors.push('stockroomType must be a string');
    } else if (!VALID_STOCKROOM_TYPES.includes(request['stockroomType'] as StockroomType)) {
      errors.push(`stockroomType must be one of: ${VALID_STOCKROOM_TYPES.join(', ')}`);
    }
  }

  // Validate managerId if provided
  if (request['managerId'] !== undefined && request['managerId'] !== null) {
    if (typeof request['managerId'] !== 'string') {
      errors.push('managerId must be a string');
    } else {
      const uuidError = validateUUID(request['managerId'], 'managerId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate building if provided
  if (request['building'] !== undefined && request['building'] !== null) {
    if (typeof request['building'] !== 'string') {
      errors.push('building must be a string');
    } else {
      const uuidError = validateUUID(request['building'], 'building');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Optional string fields validation
  const optionalStringFields = [
    'location',
    'description',
    'addressLine1',
    'addressLine2',
    'city',
    'stateProvince',
    'postalCode',
    'country',
    'floor',
    'room',
    'contactName',
    'contactPhone',
  ];

  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Email validation
  if (request['contactEmail'] !== undefined && request['contactEmail'] !== null) {
    if (typeof request['contactEmail'] !== 'string') {
      errors.push('contactEmail must be a string');
    } else if (request['contactEmail'] !== '' && !isValidEmail(request['contactEmail'])) {
      errors.push('contactEmail must be a valid email address');
    }
  }

  // Capacity validation
  if (request['capacityUnits'] !== undefined && request['capacityUnits'] !== null) {
    if (typeof request['capacityUnits'] !== 'number') {
      errors.push('capacityUnits must be a number');
    } else if (!Number.isInteger(request['capacityUnits']) || request['capacityUnits'] < 0) {
      errors.push('capacityUnits must be a non-negative integer');
    }
  }

  // Boolean validation
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 * Requirement 5.6: Return paginated list of stockrooms matching criteria
 */
function parseListFilters(queryParams: Record<string, string | undefined>): StockroomListFilters {
  const result: StockroomListFilters = {};

  if (queryParams['stockroomType']) {
    Object.assign(result, { stockroomType: queryParams['stockroomType'] as StockroomType });
  }
  if (queryParams['managerId']) {
    Object.assign(result, { managerId: queryParams['managerId'] });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['city']) {
    Object.assign(result, { city: queryParams['city'] });
  }
  if (queryParams['search']) {
    Object.assign(result, { search: queryParams['search'] });
  }

  return result;
}


/**
 * Get user ID from event context
 */
function getUserId(event: APIGatewayProxyEvent): UUID | undefined {
  return event.requestContext.authorizer?.['claims']?.['sub'] as UUID | undefined;
}

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Create a new stockroom
 * POST /admin/stockrooms
 *
 * Requirement 5.1: Create stockroom with name, type, manager, and capacity
 * Requirement 5.5: Reject creation for non-existent location
 */
export async function createStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Create stockroom request received', { requestId });

  try {
    // Parse request body
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

    const request = body as stockroomService.CreateStockroomRequest;

    // Create stockroom
    const stockroom = await stockroomService.createStockroom(request, userId);

    logger.info('Stockroom created successfully', {
      requestId,
      stockroomId: stockroom.stockroomId,
      stockroomCode: stockroom.stockroomCode,
      name: stockroom.name,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(stockroom, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof LocationNotFoundError) {
      logger.warn('Location not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof StockroomNameExistsError) {
      logger.warn('Stockroom name already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err instanceof StockroomCodeExistsError) {
      logger.warn('Stockroom code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create stockroom', requestId)
    );
  }
}


/**
 * Get stockroom by ID
 * GET /admin/stockrooms/{stockroomId}
 *
 * Requirement 5.2: Return complete stockroom details including current utilization
 */
export async function getStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get stockroom request received', { requestId });

  try {
    // Get stockroom ID from path parameters
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get stockroom
    const stockroom = await stockroomService.getStockroom(stockroomId);

    if (!stockroom) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Stockroom not found: ${stockroomId}`, requestId)
      );
    }

    logger.info('Stockroom retrieved successfully', {
      requestId,
      stockroomId: stockroom.stockroomId,
    });

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


/**
 * Get stockrooms by location (building)
 * GET /admin/stockrooms/location/{locationId}
 *
 * Requirement 5.2: Return all stockrooms for a location ordered by name
 */
export async function getStockroomsByLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get stockrooms by location request received', { requestId });

  try {
    // Get location ID from path parameters
    const locationId = event.pathParameters?.['locationId'];
    if (!locationId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'locationId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(locationId, 'locationId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get stockrooms by location
    const stockrooms = await stockroomService.getStockroomsByLocation(locationId);

    logger.info('Stockrooms by location retrieved successfully', {
      requestId,
      locationId,
      count: stockrooms.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ stockrooms }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get stockrooms by location', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get stockrooms by location', requestId)
    );
  }
}


/**
 * Update stockroom details
 * PUT /admin/stockrooms/{stockroomId}
 *
 * Requirement 5.3: Update specified fields and maintain location relationship
 */
export async function updateStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Update stockroom request received', { requestId });

  try {
    // Get stockroom ID from path parameters
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse request body
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

    const request = body as stockroomService.UpdateStockroomRequest;

    // Update stockroom
    const stockroom = await stockroomService.updateStockroom(stockroomId, request, userId);

    logger.info('Stockroom updated successfully', {
      requestId,
      stockroomId: stockroom.stockroomId,
    });

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

    if (err instanceof StockroomNameExistsError) {
      logger.warn('Stockroom name already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to update stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update stockroom', requestId)
    );
  }
}


/**
 * Deactivate a stockroom
 * POST /admin/stockrooms/{stockroomId}/deactivate
 *
 * Requirement 5.4: Mark stockroom as inactive and prevent new inventory assignments
 */
export async function deactivateStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Deactivate stockroom request received', { requestId });

  try {
    // Get stockroom ID from path parameters
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Deactivate stockroom
    const stockroom = await stockroomService.deactivateStockroom(stockroomId, userId);

    logger.info('Stockroom deactivated successfully', {
      requestId,
      stockroomId: stockroom.stockroomId,
    });

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

    logger.error('Failed to deactivate stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate stockroom', requestId)
    );
  }
}


/**
 * Delete a stockroom
 * DELETE /admin/stockrooms/{stockroomId}
 *
 * Requirement 5.7: Reject deletion if stockroom has inventory
 */
export async function deleteStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete stockroom request received', { requestId });

  try {
    // Get stockroom ID from path parameters
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete stockroom
    const deleted = await stockroomService.deleteStockroom(stockroomId);

    if (deleted) {
      logger.info('Stockroom deleted successfully', { requestId, stockroomId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if stockroom exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete stockroom', requestId)
    );
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
        binLocationCount: err.binLocationCount,
        inventoryCount: err.inventoryCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete stockroom', requestId)
    );
  }
}


/**
 * List stockrooms with pagination and filters
 * GET /admin/stockrooms
 *
 * Requirement 5.6: Return paginated list of stockrooms matching criteria
 */
export async function listStockroomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List stockrooms request received', { requestId });

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};

    // Parse pagination
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 20;

    // Validate pagination
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Validate managerId if provided
    if (queryParams['managerId']) {
      const uuidError = validateUUID(queryParams['managerId'], 'managerId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Validate stockroomType if provided
    if (queryParams['stockroomType'] && !VALID_STOCKROOM_TYPES.includes(queryParams['stockroomType'] as StockroomType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `stockroomType must be one of: ${VALID_STOCKROOM_TYPES.join(', ')}`,
          requestId
        )
      );
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List stockrooms
    const result = await stockroomService.listStockrooms(filters, { page, limit });

    logger.info('Stockrooms listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
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


/**
 * Check if stockroom name is unique within a location
 * GET /admin/stockrooms/check-name
 *
 * Used for form validation before submission
 */
export async function checkStockroomNameHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check stockroom name request received', { requestId });

  try {
    // Get name from query parameters
    const name = event.queryStringParameters?.['name'];
    if (!name) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'name query parameter is required', requestId)
      );
    }

    // Get optional location ID
    const locationId = event.queryStringParameters?.['locationId'] ?? null;
    if (locationId) {
      const uuidError = validateUUID(locationId, 'locationId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Get optional exclude stockroom ID (for updates)
    const excludeStockroomId = event.queryStringParameters?.['excludeStockroomId'];
    if (excludeStockroomId) {
      const uuidError = validateUUID(excludeStockroomId, 'excludeStockroomId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await stockroomService.isStockroomNameUnique(locationId, name, excludeStockroomId);

    logger.info('Stockroom name check completed', {
      requestId,
      locationId,
      name,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ locationId, name, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check stockroom name', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check stockroom name', requestId)
    );
  }
}


/**
 * Get active stockrooms (for dropdowns/selectors)
 * GET /admin/stockrooms/active
 */
export async function getActiveStockroomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active stockrooms request received', { requestId });

  try {
    const stockrooms = await stockroomService.getActiveStockrooms();

    logger.info('Active stockrooms retrieved successfully', {
      requestId,
      count: stockrooms.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ stockrooms }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active stockrooms', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active stockrooms', requestId)
    );
  }
}

/**
 * Reactivate a stockroom
 * POST /admin/stockrooms/{stockroomId}/reactivate
 *
 * Requirement 5.5: Mark stockroom as active and allow inventory operations
 */
export async function reactivateStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Reactivate stockroom request received', { requestId });

  try {
    // Get stockroom ID from path parameters
    const stockroomId = event.pathParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Reactivate stockroom
    const stockroom = await stockroomService.reactivateStockroom(stockroomId, userId);

    logger.info('Stockroom reactivated successfully', {
      requestId,
      stockroomId: stockroom.stockroomId,
    });

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

    logger.error('Failed to reactivate stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reactivate stockroom', requestId)
    );
  }
}
