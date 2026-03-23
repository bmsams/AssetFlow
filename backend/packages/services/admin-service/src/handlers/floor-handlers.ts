/**
 * Floor Handlers - Lambda handlers for Floor CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/floors - Create a new floor
 * - GET /admin/floors/{floorId} - Get floor by ID
 * - PUT /admin/floors/{floorId} - Update floor
 * - DELETE /admin/floors/{floorId} - Deactivate floor
 * - GET /admin/floors - List floors with pagination and filters
 * - GET /admin/buildings/{buildingId}/floors - Get floors by building
 * - GET /admin/floors/check-number - Check floor number uniqueness
 * - GET /admin/buildings/{buildingId}/floors/active - Get active floors for building
 *
 * Requirement 2: Location Hierarchy - Floor Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateFloorRequest,
  FloorListFilters,
  UpdateFloorRequest,
} from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as floorService from '../location/floor-service';
import {
  BuildingNotFoundError,
  FloorHasDependenciesError,
  FloorNotFoundError,
  FloorNumberExistsError,
} from '../location/floor-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'floor-handlers' });

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Validation error type for request validation
 */
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

/**
 * Validate create floor request
 */
function validateCreateFloorRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required fields
  if (!request['buildingId'] || typeof request['buildingId'] !== 'string') {
    errors.push('buildingId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['buildingId'], 'buildingId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (request['floorNumber'] === undefined || request['floorNumber'] === null) {
    errors.push('floorNumber is required');
  } else if (typeof request['floorNumber'] !== 'number') {
    errors.push('floorNumber must be a number');
  } else if (!Number.isInteger(request['floorNumber'])) {
    errors.push('floorNumber must be an integer');
  }

  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Optional string fields validation
  if (request['description'] !== undefined && typeof request['description'] !== 'string') {
    errors.push('description must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update floor request
 */
function validateUpdateFloorRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['name', 'description', 'isActive'];

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

  // Validate description if provided
  if (request['description'] !== undefined && typeof request['description'] !== 'string') {
    errors.push('description must be a string');
  }

  // Boolean validation
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 */
function parseListFilters(
  queryParams: Record<string, string | undefined>
): FloorListFilters {
  const result: FloorListFilters = {};

  if (queryParams['buildingId']) {
    Object.assign(result, { buildingId: queryParams['buildingId'] });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
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

/**
 * Create a new floor
 * POST /admin/floors
 *
 * Requirement 2.1: Create floor with building reference, floor number, and name
 * Requirement 2.5: Reject creation for non-existent building
 */
export async function createFloorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create floor request received', { requestId });

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
    const validation = validateCreateFloorRequest(body);
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

    const request = body as CreateFloorRequest;

    // Create floor
    const floor = await floorService.createFloor(request, userId);

    logger.info('Floor created successfully', {
      requestId,
      floorId: floor.floorId,
      buildingId: floor.buildingId,
      floorNumber: floor.floorNumber,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(floor, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BuildingNotFoundError) {
      logger.warn('Building not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof FloorNumberExistsError) {
      logger.warn('Floor number already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create floor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create floor', requestId)
    );
  }
}

/**
 * Get floor by ID
 * GET /admin/floors/{floorId}
 *
 * Requirement 2.2: Return floor details
 */
export async function getFloorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get floor request received', { requestId });

  try {
    // Get floor ID from path parameters
    const floorId = event.pathParameters?.['floorId'];
    if (!floorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(floorId, 'floorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get floor
    const floor = await floorService.getFloor(floorId);

    if (!floor) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Floor not found: ${floorId}`, requestId)
      );
    }

    logger.info('Floor retrieved successfully', {
      requestId,
      floorId: floor.floorId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(floor, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get floor', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get floor', requestId)
    );
  }
}

/**
 * Update floor details
 * PUT /admin/floors/{floorId}
 *
 * Requirement 2.3: Update specified fields and maintain building relationship
 */
export async function updateFloorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update floor request received', { requestId });

  try {
    // Get floor ID from path parameters
    const floorId = event.pathParameters?.['floorId'];
    if (!floorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(floorId, 'floorId');
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
    const validation = validateUpdateFloorRequest(body);
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

    const request = body as UpdateFloorRequest;

    // Update floor
    const floor = await floorService.updateFloor(floorId, request, userId);

    logger.info('Floor updated successfully', {
      requestId,
      floorId: floor.floorId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(floor, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof FloorNotFoundError) {
      logger.warn('Floor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update floor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update floor', requestId)
    );
  }
}

/**
 * Deactivate a floor
 * DELETE /admin/floors/{floorId}
 *
 * Requirement 2.4: Mark floor as inactive and prevent new room assignments
 */
export async function deactivateFloorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate floor request received', { requestId });

  try {
    // Get floor ID from path parameters
    const floorId = event.pathParameters?.['floorId'];
    if (!floorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(floorId, 'floorId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Check query parameter for hard delete vs soft delete (deactivate)
    const hardDelete = event.queryStringParameters?.['hardDelete'] === 'true';

    if (hardDelete) {
      // Attempt hard delete (will fail if dependencies exist)
      const deleted = await floorService.deleteFloor(floorId);

      if (deleted) {
        logger.info('Floor deleted successfully', { requestId, floorId });
        return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
      }
    } else {
      // Soft delete (deactivate)
      const floor = await floorService.deactivateFloor(floorId, userId);

      logger.info('Floor deactivated successfully', {
        requestId,
        floorId: floor.floorId,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(floor, requestId));
    }

    // Should not reach here
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete floor', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof FloorNotFoundError) {
      logger.warn('Floor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof FloorHasDependenciesError) {
      logger.warn('Floor has dependencies', {
        requestId,
        error: err.message,
        roomCount: err.roomCount,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate floor', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate floor', requestId)
    );
  }
}

/**
 * List floors with pagination and filters
 * GET /admin/floors
 *
 * Returns paginated list of floors matching filter criteria
 */
export async function listFloorsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List floors request received', { requestId });

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

    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 1000', requestId)
      );
    }

    // Validate buildingId if provided
    if (queryParams['buildingId']) {
      const uuidError = validateUUID(queryParams['buildingId'], 'buildingId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List floors
    const result = await floorService.listFloors(filters, { page, limit });

    logger.info('Floors listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list floors', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list floors', requestId)
    );
  }
}

/**
 * Get floors by building
 * GET /admin/buildings/{buildingId}/floors
 *
 * Requirement 2.2: Return all floors for a building ordered by floor number
 */
export async function getFloorsByBuildingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get floors by building request received', { requestId });

  try {
    // Get building ID from path parameters
    const buildingId = event.pathParameters?.['buildingId'];
    if (!buildingId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'buildingId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(buildingId, 'buildingId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get floors
    const floors = await floorService.getFloorsByBuilding(buildingId);

    logger.info('Floors by building retrieved successfully', {
      requestId,
      buildingId,
      count: floors.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ floors }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get floors by building', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get floors by building', requestId)
    );
  }
}

/**
 * Check if floor number is unique within a building
 * GET /admin/floors/check-number
 *
 * Used for form validation before submission
 */
export async function checkFloorNumberHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check floor number request received', { requestId });

  try {
    // Get building ID from query parameters
    const buildingId = event.queryStringParameters?.['buildingId'];
    if (!buildingId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'buildingId query parameter is required', requestId)
      );
    }

    // Validate buildingId UUID format
    const buildingIdError = validateUUID(buildingId, 'buildingId');
    if (buildingIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, buildingIdError.message, requestId)
      );
    }

    // Get floor number from query parameters
    const floorNumberStr = event.queryStringParameters?.['floorNumber'];
    if (!floorNumberStr) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorNumber query parameter is required', requestId)
      );
    }

    const floorNumber = parseInt(floorNumberStr, 10);
    if (isNaN(floorNumber)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorNumber must be a valid integer', requestId)
      );
    }

    // Get optional exclude floor ID (for updates)
    const excludeFloorId = event.queryStringParameters?.['excludeFloorId'];
    if (excludeFloorId) {
      const uuidError = validateUUID(excludeFloorId, 'excludeFloorId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await floorService.isFloorNumberUnique(buildingId, floorNumber, excludeFloorId);

    logger.info('Floor number check completed', {
      requestId,
      buildingId,
      floorNumber,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ buildingId, floorNumber, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check floor number', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check floor number', requestId)
    );
  }
}

/**
 * Get active floors for a building (for dropdowns/selectors)
 * GET /admin/buildings/{buildingId}/floors/active
 */
export async function getActiveFloorsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active floors request received', { requestId });

  try {
    // Get building ID from path parameters
    const buildingId = event.pathParameters?.['buildingId'];
    if (!buildingId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'buildingId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(buildingId, 'buildingId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const floors = await floorService.getActiveFloorsByBuilding(buildingId);

    logger.info('Active floors retrieved successfully', {
      requestId,
      buildingId,
      count: floors.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ floors }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active floors', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active floors', requestId)
    );
  }
}

// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Unified Lambda handler for floor operations
 * Routes requests based on HTTP method and path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const floorId = event.pathParameters?.['floorId'];

  logger.info('Floor handler request', { method, path, floorId });

  if (method === 'GET') {
    if (floorId) return getFloorHandler(event);
    return listFloorsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) return deactivateFloorHandler(event);
    return createFloorHandler(event);
  }

  if (method === 'PUT' && floorId) return updateFloorHandler(event);
  if (method === 'DELETE' && floorId) return deactivateFloorHandler(event);

  return createLambdaResponse(405, createErrorResponse(
    API_ERROR_CODES.BAD_REQUEST,
    `Method ${method} not allowed for ${path}`,
    event.requestContext.requestId
  ));
}

export default handler;
