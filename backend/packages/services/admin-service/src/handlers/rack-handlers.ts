/**
 * Rack Handlers - Lambda handlers for Rack CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/racks - Create a new rack
 * - GET /admin/racks/{rackId} - Get rack by ID
 * - PUT /admin/racks/{rackId} - Update rack
 * - DELETE /admin/racks/{rackId} - Deactivate rack
 * - GET /admin/racks - List racks with pagination and filters
 * - GET /admin/rooms/{roomId}/racks - Get racks by room
 * - GET /admin/racks/check-name - Check rack name uniqueness
 * - GET /admin/rooms/{roomId}/racks/active - Get active racks for room
 * - PATCH /admin/racks/{rackId}/used-units - Update used units
 *
 * Requirement 4: Location Hierarchy - Rack Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateRackRequest,
  RackListFilters,
  UpdateRackRequest,
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

import * as rackService from '../location/rack-service';
import {
  InsufficientRackUnitsError,
  RackHasDependenciesError,
  RackNameExistsError,
  RackNotFoundError,
  RoomNotFoundError,
} from '../location/rack-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'rack-handlers' });

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
 * Validate create rack request
 */
function validateCreateRackRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required fields
  if (!request['roomId'] || typeof request['roomId'] !== 'string') {
    errors.push('roomId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['roomId'], 'roomId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (!request['rackName'] || typeof request['rackName'] !== 'string') {
    errors.push('rackName is required and must be a string');
  } else if (request['rackName'].length < 1 || request['rackName'].length > 100) {
    errors.push('rackName must be between 1 and 100 characters');
  }

  if (request['totalUnits'] === undefined || request['totalUnits'] === null) {
    errors.push('totalUnits is required');
  } else if (typeof request['totalUnits'] !== 'number') {
    errors.push('totalUnits must be a number');
  } else if (!Number.isInteger(request['totalUnits']) || request['totalUnits'] < 1) {
    errors.push('totalUnits must be a positive integer');
  } else if (request['totalUnits'] > 100) {
    errors.push('totalUnits cannot exceed 100');
  }

  // Optional fields validation
  if (request['description'] !== undefined && typeof request['description'] !== 'string') {
    errors.push('description must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update rack request
 */
function validateUpdateRackRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['rackName', 'totalUnits', 'description', 'isActive'];

  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate rackName if provided
  if (request['rackName'] !== undefined) {
    if (typeof request['rackName'] !== 'string') {
      errors.push('rackName must be a string');
    } else if (request['rackName'].length < 1 || request['rackName'].length > 100) {
      errors.push('rackName must be between 1 and 100 characters');
    }
  }

  // Validate totalUnits if provided
  if (request['totalUnits'] !== undefined) {
    if (typeof request['totalUnits'] !== 'number') {
      errors.push('totalUnits must be a number');
    } else if (!Number.isInteger(request['totalUnits']) || request['totalUnits'] < 1) {
      errors.push('totalUnits must be a positive integer');
    } else if (request['totalUnits'] > 100) {
      errors.push('totalUnits cannot exceed 100');
    }
  }

  // Validate description if provided
  if (request['description'] !== undefined && request['description'] !== null && typeof request['description'] !== 'string') {
    errors.push('description must be a string or null');
  }

  // Boolean validation
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update used units request
 */
function validateUpdateUsedUnitsRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  if (request['usedUnits'] === undefined || request['usedUnits'] === null) {
    errors.push('usedUnits is required');
  } else if (typeof request['usedUnits'] !== 'number') {
    errors.push('usedUnits must be a number');
  } else if (!Number.isInteger(request['usedUnits']) || request['usedUnits'] < 0) {
    errors.push('usedUnits must be a non-negative integer');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 */
function parseListFilters(
  queryParams: Record<string, string | undefined>
): RackListFilters {
  const result: RackListFilters = {};

  if (queryParams['roomId']) {
    Object.assign(result, { roomId: queryParams['roomId'] });
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
 * Create a new rack
 * POST /admin/racks
 *
 * Requirement 4.1: Create rack with room reference, rack name, and total rack units
 */
export async function createRackHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create rack request received', { requestId });

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
    const validation = validateCreateRackRequest(body);
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

    const request = body as CreateRackRequest;

    // Create rack
    const rack = await rackService.createRack(request, userId);

    logger.info('Rack created successfully', {
      requestId,
      rackId: rack.rackId,
      roomId: rack.roomId,
      rackName: rack.rackName,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(rack, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof RoomNotFoundError) {
      logger.warn('Room not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RackNameExistsError) {
      logger.warn('Rack name already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create rack', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create rack', requestId)
    );
  }
}


/**
 * Get rack by ID
 * GET /admin/racks/{rackId}
 *
 * Requirement 4.2: Return rack information including total units, used units, and available units
 */
export async function getRackHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get rack request received', { requestId });

  try {
    // Get rack ID from path parameters
    const rackId = event.pathParameters?.['rackId'];
    if (!rackId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rackId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(rackId, 'rackId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get rack
    const rack = await rackService.getRack(rackId);

    if (!rack) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Rack not found: ${rackId}`, requestId)
      );
    }

    logger.info('Rack retrieved successfully', {
      requestId,
      rackId: rack.rackId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(rack, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get rack', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get rack', requestId)
    );
  }
}

/**
 * Update rack details
 * PUT /admin/racks/{rackId}
 *
 * Requirement 4.3: Update specified fields and recalculate available units
 */
export async function updateRackHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update rack request received', { requestId });

  try {
    // Get rack ID from path parameters
    const rackId = event.pathParameters?.['rackId'];
    if (!rackId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rackId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(rackId, 'rackId');
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
    const validation = validateUpdateRackRequest(body);
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

    const request = body as UpdateRackRequest;

    // Update rack
    const rack = await rackService.updateRack(rackId, request, userId);

    logger.info('Rack updated successfully', {
      requestId,
      rackId: rack.rackId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(rack, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof RackNotFoundError) {
      logger.warn('Rack not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof InsufficientRackUnitsError) {
      logger.warn('Insufficient rack units', {
        requestId,
        error: err.message,
        totalUnits: err.totalUnits,
        usedUnits: err.usedUnits,
      });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update rack', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update rack', requestId)
    );
  }
}


/**
 * Deactivate a rack
 * DELETE /admin/racks/{rackId}
 *
 * Requirement 4.4: Mark rack as inactive and prevent new asset assignments
 * Requirement 4.5: Reject deletion if rack has mounted equipment
 */
export async function deactivateRackHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate rack request received', { requestId });

  try {
    // Get rack ID from path parameters
    const rackId = event.pathParameters?.['rackId'];
    if (!rackId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rackId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(rackId, 'rackId');
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
      const deleted = await rackService.deleteRack(rackId);

      if (deleted) {
        logger.info('Rack deleted successfully', { requestId, rackId });
        return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
      }
    } else {
      // Soft delete (deactivate)
      const rack = await rackService.deactivateRack(rackId, userId);

      logger.info('Rack deactivated successfully', {
        requestId,
        rackId: rack.rackId,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(rack, requestId));
    }

    // Should not reach here
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete rack', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof RackNotFoundError) {
      logger.warn('Rack not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RackHasDependenciesError) {
      logger.warn('Rack has dependencies', {
        requestId,
        error: err.message,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate rack', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate rack', requestId)
    );
  }
}


/**
 * List racks with pagination and filters
 * GET /admin/racks
 *
 * Requirement 4.4: Return all racks with their utilization status
 */
export async function listRacksHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List racks request received', { requestId });

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

    // Validate roomId if provided
    if (queryParams['roomId']) {
      const uuidError = validateUUID(queryParams['roomId'], 'roomId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List racks
    const result = await rackService.listRacks(filters, { page, limit });

    logger.info('Racks listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list racks', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list racks', requestId)
    );
  }
}

/**
 * Get racks by room
 * GET /admin/rooms/{roomId}/racks
 *
 * Requirement 4.4: Return all racks for a room with their utilization status
 */
export async function getRacksByRoomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get racks by room request received', { requestId });

  try {
    // Get room ID from path parameters
    const roomId = event.pathParameters?.['roomId'];
    if (!roomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'roomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(roomId, 'roomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get racks
    const racks = await rackService.getRacksByRoom(roomId);

    logger.info('Racks by room retrieved successfully', {
      requestId,
      roomId,
      count: racks.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ racks }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get racks by room', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get racks by room', requestId)
    );
  }
}


/**
 * Check if rack name is unique within a room
 * GET /admin/racks/check-name
 *
 * Used for form validation before submission
 */
export async function checkRackNameHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check rack name request received', { requestId });

  try {
    // Get room ID from query parameters
    const roomId = event.queryStringParameters?.['roomId'];
    if (!roomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'roomId query parameter is required', requestId)
      );
    }

    // Validate roomId UUID format
    const roomIdError = validateUUID(roomId, 'roomId');
    if (roomIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, roomIdError.message, requestId)
      );
    }

    // Get rack name from query parameters
    const rackName = event.queryStringParameters?.['rackName'];
    if (!rackName) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rackName query parameter is required', requestId)
      );
    }

    // Get optional exclude rack ID (for updates)
    const excludeRackId = event.queryStringParameters?.['excludeRackId'];
    if (excludeRackId) {
      const uuidError = validateUUID(excludeRackId, 'excludeRackId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await rackService.isRackNameUnique(roomId, rackName, excludeRackId);

    logger.info('Rack name check completed', {
      requestId,
      roomId,
      rackName,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ roomId, rackName, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check rack name', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check rack name', requestId)
    );
  }
}

/**
 * Get active racks for a room (for dropdowns/selectors)
 * GET /admin/rooms/{roomId}/racks/active
 */
export async function getActiveRacksHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active racks request received', { requestId });

  try {
    // Get room ID from path parameters
    const roomId = event.pathParameters?.['roomId'];
    if (!roomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'roomId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(roomId, 'roomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const racks = await rackService.getActiveRacksByRoom(roomId);

    logger.info('Active racks retrieved successfully', {
      requestId,
      roomId,
      count: racks.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ racks }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active racks', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active racks', requestId)
    );
  }
}


/**
 * Update rack used units
 * PATCH /admin/racks/{rackId}/used-units
 *
 * Requirement 4.6: Update used units and recalculate available units
 * Used when assets are mounted/unmounted from a rack.
 */
export async function updateRackUsedUnitsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update rack used units request received', { requestId });

  try {
    // Get rack ID from path parameters
    const rackId = event.pathParameters?.['rackId'];
    if (!rackId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'rackId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(rackId, 'rackId');
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
    const validation = validateUpdateUsedUnitsRequest(body);
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

    const request = body as { usedUnits: number };

    // Update rack used units
    const rack = await rackService.updateUsedUnits(rackId, request.usedUnits, userId);

    logger.info('Rack used units updated successfully', {
      requestId,
      rackId: rack.rackId,
      usedUnits: rack.usedUnits,
      availableUnits: rack.availableUnits,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(rack, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof RackNotFoundError) {
      logger.warn('Rack not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof InsufficientRackUnitsError) {
      logger.warn('Insufficient rack units', {
        requestId,
        error: err.message,
        totalUnits: err.totalUnits,
        usedUnits: err.usedUnits,
        requestedUnits: err.requestedUnits,
      });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update rack used units', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update rack used units', requestId)
    );
  }
}

// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Unified Lambda handler for rack operations
 * Routes requests based on HTTP method and path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const rackId = event.pathParameters?.['rackId'];

  logger.info('Rack handler request', { method, path, rackId });

  if (method === 'GET') {
    if (rackId) return getRackHandler(event);
    return listRacksHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) return deactivateRackHandler(event);
    return createRackHandler(event);
  }

  if (method === 'PUT' && rackId) return updateRackHandler(event);
  if (method === 'DELETE' && rackId) return deactivateRackHandler(event);

  return createLambdaResponse(405, createErrorResponse(
    API_ERROR_CODES.BAD_REQUEST,
    `Method ${method} not allowed for ${path}`,
    event.requestContext.requestId
  ));
}

export default handler;
