/**
 * Bin Location Handlers - Lambda handlers for Bin Location CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/bin-locations - Create a new bin location
 * - GET /admin/bin-locations/{binId} - Get bin location by ID
 * - PUT /admin/bin-locations/{binId} - Update bin location
 * - POST /admin/bin-locations/{binId}/deactivate - Deactivate bin location
 * - GET /admin/bin-locations - List bin locations with pagination and filters
 *
 * Requirements: 6.1-6.4 - Bin Location CRUD operations
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  BinLocationListFilters,
  CreateBinLocationRequest,
  UpdateBinLocationRequest,
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

import * as binLocationService from '../stockroom/bin-location-service';
import {
  BinCodeExistsError,
  BinLocationNotFoundError,
} from '../stockroom/bin-location-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'bin-location-handlers' });

// ============================================================================
// Request Validation
// ============================================================================

interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

function validateCreateBinLocationRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: stockroomId
  if (!request['stockroomId']) {
    errors.push('stockroomId is required');
  } else {
    const uuidError = validateUUID(request['stockroomId'] as string, 'stockroomId');
    if (uuidError) errors.push(uuidError.message);
  }

  // Required: binCode
  if (!request['binCode'] || typeof request['binCode'] !== 'string') {
    errors.push('binCode is required and must be a string');
  } else if (request['binCode'].length < 1 || request['binCode'].length > 50) {
    errors.push('binCode must be between 1 and 50 characters');
  }

  // Optional: shelfLocation
  if (request['shelfLocation'] !== undefined && typeof request['shelfLocation'] !== 'string') {
    errors.push('shelfLocation must be a string');
  }

  // Optional: capacity
  if (request['capacity'] !== undefined && request['capacity'] !== null) {
    if (typeof request['capacity'] !== 'number' || request['capacity'] < 0) {
      errors.push('capacity must be a non-negative number');
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateUpdateBinLocationRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  const updateFields = ['binCode', 'shelfLocation', 'capacity', 'isActive'];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  if (request['binCode'] !== undefined) {
    if (typeof request['binCode'] !== 'string') {
      errors.push('binCode must be a string');
    } else if (request['binCode'].length < 1 || request['binCode'].length > 50) {
      errors.push('binCode must be between 1 and 50 characters');
    }
  }

  if (request['shelfLocation'] !== undefined && request['shelfLocation'] !== null && typeof request['shelfLocation'] !== 'string') {
    errors.push('shelfLocation must be a string');
  }

  if (request['capacity'] !== undefined && request['capacity'] !== null) {
    if (typeof request['capacity'] !== 'number' || request['capacity'] < 0) {
      errors.push('capacity must be a non-negative number');
    }
  }

  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

function parseListFilters(queryParams: Record<string, string | undefined>): BinLocationListFilters {
  const result: BinLocationListFilters = {};

  if (queryParams['stockroomId']) {
    Object.assign(result, { stockroomId: queryParams['stockroomId'] as UUID });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['hasCapacity'] !== undefined) {
    Object.assign(result, { hasCapacity: queryParams['hasCapacity'] === 'true' });
  }

  return result;
}

// User context (Cognito sub -> DB user_id, with provisioning)

// ============================================================================
// Lambda Handlers
// ============================================================================

export async function createBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create bin location request received', { requestId });

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

    const validation = validateCreateBinLocationRequest(body);
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

    const request = body as CreateBinLocationRequest;
    const binLocation = await binLocationService.createBinLocation(request, userId);

    logger.info('Bin location created successfully', { requestId, binId: binLocation.binId });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(binLocation, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BinCodeExistsError) {
      logger.warn('Bin code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create bin location', requestId)
    );
  }
}

export async function getBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get bin location request received', { requestId });

  try {
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    const uuidError = validateUUID(binId, 'binId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const binLocation = await binLocationService.getBinLocation(binId as UUID);

    if (!binLocation) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Bin location not found: ${binId}`, requestId)
      );
    }

    logger.info('Bin location retrieved successfully', { requestId, binId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(binLocation, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get bin location', requestId)
    );
  }
}

export async function updateBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update bin location request received', { requestId });

  try {
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    const uuidError = validateUUID(binId, 'binId');
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

    const validation = validateUpdateBinLocationRequest(body);
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

    const request = body as UpdateBinLocationRequest;
    const binLocation = await binLocationService.updateBinLocation(binId as UUID, request, userId);

    logger.info('Bin location updated successfully', { requestId, binId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(binLocation, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BinLocationNotFoundError) {
      logger.warn('Bin location not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof BinCodeExistsError) {
      logger.warn('Bin code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to update bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update bin location', requestId)
    );
  }
}

export async function deactivateBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate bin location request received', { requestId });

  try {
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    const uuidError = validateUUID(binId, 'binId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const binLocation = await binLocationService.deactivateBinLocation(binId as UUID, userId);

    logger.info('Bin location deactivated successfully', { requestId, binId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(binLocation, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BinLocationNotFoundError) {
      logger.warn('Bin location not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate bin location', requestId)
    );
  }
}

export async function listBinLocationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List bin locations request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};

    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

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
    const result = await binLocationService.listBinLocations(filters, { page, limit });

    logger.info('Bin locations listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list bin locations', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list bin locations', requestId)
    );
  }
}

export async function getBinLocationsByStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get bin locations by stockroom request received', { requestId });

  try {
    const stockroomId = event.pathParameters?.['stockroomId'] ?? event.queryStringParameters?.['stockroomId'];
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

    const binLocations = await binLocationService.getBinLocationsByStockroom(stockroomId as UUID);

    logger.info('Bin locations retrieved successfully', { requestId, stockroomId, count: binLocations.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ binLocations }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get bin locations by stockroom', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get bin locations', requestId)
    );
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const binId = event.pathParameters?.['binId'];

  logger.info('Bin location handler request', { method, path, binId });

  if (method === 'GET') {
    if (path.includes('/by-stockroom') || event.queryStringParameters?.['stockroomId']) {
      return getBinLocationsByStockroomHandler(event);
    }
    if (binId) {
      return getBinLocationHandler(event);
    }
    return listBinLocationsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) {
      return deactivateBinLocationHandler(event);
    }
    return createBinLocationHandler(event);
  }

  if (method === 'PUT' && binId) {
    return updateBinLocationHandler(event);
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
