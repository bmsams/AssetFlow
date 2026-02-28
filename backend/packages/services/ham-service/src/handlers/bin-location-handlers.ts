/**
 * Bin Location Handlers - Lambda handlers for Bin Location CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/bin-locations - Create a new bin location
 * - GET /admin/bin-locations/{binId} - Get bin location by ID
 * - GET /admin/stockrooms/{stockroomId}/bin-locations - Get bin locations by stockroom
 * - PUT /admin/bin-locations/{binId} - Update bin location
 * - POST /admin/bin-locations/{binId}/deactivate - Deactivate bin location
 * - DELETE /admin/bin-locations/{binId} - Delete bin location
 * - GET /admin/bin-locations - List bin locations with pagination and filters
 * - GET /admin/bin-locations/check-code - Check bin code uniqueness
 *
 * Requirement 6: Stockroom Bin/Shelf Location Management
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
  BinLocationHasDependenciesError,
  BinLocationNotFoundError,
  StockroomNotFoundError,
} from '../stockroom/bin-location-service';

const logger = createLogger({ service: 'bin-location-handlers' });

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
 * Validate create bin location request
 * Requirement 6.1: Create bin location with stockroom reference, code, and capacity
 */
function validateCreateBinLocationRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required fields
  if (!request['stockroomId'] || typeof request['stockroomId'] !== 'string') {
    errors.push('stockroomId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['stockroomId'], 'stockroomId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (!request['binCode'] || typeof request['binCode'] !== 'string') {
    errors.push('binCode is required and must be a string');
  } else if (request['binCode'].length < 1 || request['binCode'].length > 50) {
    errors.push('binCode must be between 1 and 50 characters');
  }

  // Optional shelfLocation validation
  if (request['shelfLocation'] !== undefined && request['shelfLocation'] !== null) {
    if (typeof request['shelfLocation'] !== 'string') {
      errors.push('shelfLocation must be a string');
    }
  }

  // Optional capacity validation
  if (request['capacity'] !== undefined && request['capacity'] !== null) {
    if (typeof request['capacity'] !== 'number') {
      errors.push('capacity must be a number');
    } else if (!Number.isInteger(request['capacity']) || request['capacity'] < 1) {
      errors.push('capacity must be a positive integer');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update bin location request
 * Requirement 6.3: Update specified fields and maintain stockroom relationship
 */
function validateUpdateBinLocationRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['binCode', 'shelfLocation', 'capacity', 'isActive'];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate binCode if provided
  if (request['binCode'] !== undefined) {
    if (typeof request['binCode'] !== 'string') {
      errors.push('binCode must be a string');
    } else if (request['binCode'].length < 1 || request['binCode'].length > 50) {
      errors.push('binCode must be between 1 and 50 characters');
    }
  }

  // Validate shelfLocation if provided
  if (request['shelfLocation'] !== undefined && request['shelfLocation'] !== null) {
    if (typeof request['shelfLocation'] !== 'string') {
      errors.push('shelfLocation must be a string');
    }
  }

  // Validate capacity if provided
  if (request['capacity'] !== undefined && request['capacity'] !== null) {
    if (typeof request['capacity'] !== 'number') {
      errors.push('capacity must be a number');
    } else if (!Number.isInteger(request['capacity']) || request['capacity'] < 1) {
      errors.push('capacity must be a positive integer');
    }
  }

  // Validate isActive if provided
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 */
function parseListFilters(queryParams: Record<string, string | undefined>): BinLocationListFilters {
  const result: BinLocationListFilters = {};

  if (queryParams['stockroomId']) {
    Object.assign(result, { stockroomId: queryParams['stockroomId'] });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['hasCapacity'] !== undefined) {
    Object.assign(result, { hasCapacity: queryParams['hasCapacity'] === 'true' });
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
 * Create a new bin location
 * POST /admin/bin-locations
 *
 * Requirement 6.1: Create bin location with stockroom reference, code, and capacity
 * Requirement 6.5: Reject creation for non-existent stockroom
 */
export async function createBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Create bin location request received', { requestId });

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

    // Create bin location
    const binLocation = await binLocationService.createBinLocation(request, userId);

    logger.info('Bin location created successfully', {
      requestId,
      binId: binLocation.binId,
      stockroomId: binLocation.stockroomId,
      binCode: binLocation.binCode,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(binLocation, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof StockroomNotFoundError) {
      logger.warn('Stockroom not found', { requestId, error: err.message });
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

    logger.error('Failed to create bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create bin location', requestId)
    );
  }
}


/**
 * Get bin location by ID
 * GET /admin/bin-locations/{binId}
 *
 * Requirement 6.2: Return bin location details including current utilization
 */
export async function getBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get bin location request received', { requestId });

  try {
    // Get bin ID from path parameters
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(binId, 'binId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get bin location
    const binLocation = await binLocationService.getBinLocation(binId);

    if (!binLocation) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Bin location not found: ${binId}`, requestId)
      );
    }

    logger.info('Bin location retrieved successfully', {
      requestId,
      binId: binLocation.binId,
    });

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

/**
 * Get bin locations by stockroom
 * GET /admin/stockrooms/{stockroomId}/bin-locations
 *
 * Requirement 6.2: Return all bin locations for a stockroom ordered by code
 */
export async function getBinLocationsByStockroomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get bin locations by stockroom request received', { requestId });

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

    // Get bin locations by stockroom
    const binLocations = await binLocationService.getBinLocationsByStockroom(stockroomId);

    logger.info('Bin locations by stockroom retrieved successfully', {
      requestId,
      stockroomId,
      count: binLocations.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ binLocations }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get bin locations by stockroom', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get bin locations by stockroom', requestId)
    );
  }
}


/**
 * Update bin location details
 * PUT /admin/bin-locations/{binId}
 *
 * Requirement 6.3: Update specified fields and maintain stockroom relationship
 */
export async function updateBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Update bin location request received', { requestId });

  try {
    // Get bin ID from path parameters
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(binId, 'binId');
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

    // Update bin location
    const binLocation = await binLocationService.updateBinLocation(binId, request, userId);

    logger.info('Bin location updated successfully', {
      requestId,
      binId: binLocation.binId,
    });

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


/**
 * Deactivate a bin location
 * POST /admin/bin-locations/{binId}/deactivate
 *
 * Requirement 6.4: Mark bin location as inactive and prevent new inventory assignments
 */
export async function deactivateBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Deactivate bin location request received', { requestId });

  try {
    // Get bin ID from path parameters
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(binId, 'binId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Deactivate bin location
    const binLocation = await binLocationService.deactivateBinLocation(binId, userId);

    logger.info('Bin location deactivated successfully', {
      requestId,
      binId: binLocation.binId,
    });

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

/**
 * Delete a bin location
 * DELETE /admin/bin-locations/{binId}
 *
 * Requirement 6.5: Reject deletion if bin location has items
 */
export async function deleteBinLocationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete bin location request received', { requestId });

  try {
    // Get bin ID from path parameters
    const binId = event.pathParameters?.['binId'];
    if (!binId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(binId, 'binId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete bin location
    const deleted = await binLocationService.deleteBinLocation(binId);

    if (deleted) {
      logger.info('Bin location deleted successfully', { requestId, binId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if bin location exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete bin location', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof BinLocationNotFoundError) {
      logger.warn('Bin location not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof BinLocationHasDependenciesError) {
      logger.warn('Bin location has dependencies', {
        requestId,
        error: err.message,
        inventoryCount: err.inventoryCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete bin location', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete bin location', requestId)
    );
  }
}


/**
 * List bin locations with pagination and filters
 * GET /admin/bin-locations
 *
 * Requirement 6.2: Return all bin locations with their current utilization
 */
export async function listBinLocationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List bin locations request received', { requestId });

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

    // Validate stockroomId if provided
    if (queryParams['stockroomId']) {
      const uuidError = validateUUID(queryParams['stockroomId'], 'stockroomId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List bin locations
    const result = await binLocationService.listBinLocations(filters, { page, limit });

    logger.info('Bin locations listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
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

/**
 * Check if bin code is unique within a stockroom
 * GET /admin/bin-locations/check-code
 *
 * Used for form validation before submission
 */
export async function checkBinCodeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check bin code request received', { requestId });

  try {
    // Get stockroomId from query parameters
    const stockroomId = event.queryStringParameters?.['stockroomId'];
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'stockroomId query parameter is required', requestId)
      );
    }

    // Validate stockroomId UUID format
    const stockroomUuidError = validateUUID(stockroomId, 'stockroomId');
    if (stockroomUuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, stockroomUuidError.message, requestId)
      );
    }

    // Get binCode from query parameters
    const binCode = event.queryStringParameters?.['binCode'];
    if (!binCode) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'binCode query parameter is required', requestId)
      );
    }

    // Get optional exclude bin ID (for updates)
    const excludeBinId = event.queryStringParameters?.['excludeBinId'];
    if (excludeBinId) {
      const uuidError = validateUUID(excludeBinId, 'excludeBinId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await binLocationService.isBinCodeUnique(stockroomId, binCode, excludeBinId);

    logger.info('Bin code check completed', {
      requestId,
      stockroomId,
      binCode,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ stockroomId, binCode, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check bin code', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check bin code', requestId)
    );
  }
}


/**
 * Get active bin locations for a stockroom (for dropdowns/selectors)
 * GET /admin/stockrooms/{stockroomId}/bin-locations/active
 */
export async function getActiveBinLocationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active bin locations request received', { requestId });

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

    // Get active bin locations
    const binLocations = await binLocationService.getActiveBinLocationsByStockroom(stockroomId);

    logger.info('Active bin locations retrieved successfully', {
      requestId,
      stockroomId,
      count: binLocations.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ binLocations }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active bin locations', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active bin locations', requestId)
    );
  }
}

/**
 * Get bin location utilization summary for a stockroom
 * GET /admin/stockrooms/{stockroomId}/bin-locations/utilization
 */
export async function getBinLocationUtilizationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get bin location utilization request received', { requestId });

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

    // Get utilization summary
    const utilization = await binLocationService.getBinLocationUtilizationSummary(stockroomId);

    logger.info('Bin location utilization retrieved successfully', {
      requestId,
      stockroomId,
      totalBins: utilization.totalBins,
      utilizationPercentage: utilization.utilizationPercentage,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(utilization, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get bin location utilization', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get bin location utilization', requestId)
    );
  }
}
