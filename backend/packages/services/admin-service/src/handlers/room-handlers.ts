/**
 * Room Handlers - Lambda handlers for Room CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/rooms - Create a new room
 * - GET /admin/rooms/{roomId} - Get room by ID
 * - PUT /admin/rooms/{roomId} - Update room
 * - DELETE /admin/rooms/{roomId} - Deactivate room
 * - GET /admin/rooms - List rooms with pagination and filters
 * - GET /admin/floors/{floorId}/rooms - Get rooms by floor
 * - GET /admin/rooms/check-number - Check room number uniqueness
 * - GET /admin/floors/{floorId}/rooms/active - Get active rooms for floor
 *
 * Requirement 3: Location Hierarchy - Room Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateRoomRequest,
  RoomListFilters,
  RoomType,
  UpdateRoomRequest,
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

import * as roomService from '../location/room-service';
import {
  FloorNotFoundError,
  RoomHasDependenciesError,
  RoomNotFoundError,
  RoomNumberExistsError,
} from '../location/room-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'room-handlers' });

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid room types for validation
 */
const VALID_ROOM_TYPES: readonly RoomType[] = [
  'OFFICE',
  'SERVER_ROOM',
  'STORAGE',
  'CONFERENCE',
  'LAB',
  'UTILITY',
  'OTHER',
];

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
 * Validate create room request
 */
function validateCreateRoomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required fields
  if (!request['floorId'] || typeof request['floorId'] !== 'string') {
    errors.push('floorId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['floorId'], 'floorId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (!request['roomNumber'] || typeof request['roomNumber'] !== 'string') {
    errors.push('roomNumber is required and must be a string');
  } else if (request['roomNumber'].length < 1 || request['roomNumber'].length > 50) {
    errors.push('roomNumber must be between 1 and 50 characters');
  }

  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  if (!request['roomType'] || typeof request['roomType'] !== 'string') {
    errors.push('roomType is required and must be a string');
  } else if (!VALID_ROOM_TYPES.includes(request['roomType'] as RoomType)) {
    errors.push(`roomType must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
  }

  // Optional fields validation
  if (request['capacity'] !== undefined) {
    if (typeof request['capacity'] !== 'number') {
      errors.push('capacity must be a number');
    } else if (!Number.isInteger(request['capacity']) || request['capacity'] < 0) {
      errors.push('capacity must be a non-negative integer');
    }
  }

  if (request['description'] !== undefined && typeof request['description'] !== 'string') {
    errors.push('description must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update room request
 */
function validateUpdateRoomRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['name', 'roomType', 'capacity', 'description', 'isActive'];

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

  // Validate roomType if provided
  if (request['roomType'] !== undefined) {
    if (typeof request['roomType'] !== 'string') {
      errors.push('roomType must be a string');
    } else if (!VALID_ROOM_TYPES.includes(request['roomType'] as RoomType)) {
      errors.push(`roomType must be one of: ${VALID_ROOM_TYPES.join(', ')}`);
    }
  }

  // Validate capacity if provided
  if (request['capacity'] !== undefined) {
    if (request['capacity'] !== null && typeof request['capacity'] !== 'number') {
      errors.push('capacity must be a number or null');
    } else if (
      typeof request['capacity'] === 'number' &&
      (!Number.isInteger(request['capacity']) || request['capacity'] < 0)
    ) {
      errors.push('capacity must be a non-negative integer');
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
 * Parse list filters from query parameters
 */
function parseListFilters(
  queryParams: Record<string, string | undefined>
): RoomListFilters {
  const result: RoomListFilters = {};

  if (queryParams['floorId']) {
    Object.assign(result, { floorId: queryParams['floorId'] });
  }
  if (queryParams['roomType']) {
    Object.assign(result, { roomType: queryParams['roomType'] as RoomType });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }

  return result;
}

// User context (Cognito sub -> DB user_id, with provisioning)

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Create a new room
 * POST /admin/rooms
 *
 * Requirement 3.1: Create room with floor reference, room number, name, and type
 * Requirement 3.5: Reject creation for non-existent floor
 */
export async function createRoomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create room request received', { requestId });

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
    const validation = validateCreateRoomRequest(body);
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

    const request = body as CreateRoomRequest;

    // Create room
    const room = await roomService.createRoom(request, userId);

    logger.info('Room created successfully', {
      requestId,
      roomId: room.roomId,
      floorId: room.floorId,
      roomNumber: room.roomNumber,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(room, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof FloorNotFoundError) {
      logger.warn('Floor not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoomNumberExistsError) {
      logger.warn('Room number already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create room', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create room', requestId)
    );
  }
}

/**
 * Get room by ID
 * GET /admin/rooms/{roomId}
 *
 * Requirement 3.2: Return room details
 */
export async function getRoomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get room request received', { requestId });

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

    // Get room
    const room = await roomService.getRoom(roomId);

    if (!room) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Room not found: ${roomId}`, requestId)
      );
    }

    logger.info('Room retrieved successfully', {
      requestId,
      roomId: room.roomId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(room, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get room', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get room', requestId)
    );
  }
}

/**
 * Update room details
 * PUT /admin/rooms/{roomId}
 *
 * Requirement 3.3: Update specified fields including capacity and room type
 */
export async function updateRoomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update room request received', { requestId });

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
    const validation = validateUpdateRoomRequest(body);
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

    const request = body as UpdateRoomRequest;

    // Update room
    const room = await roomService.updateRoom(roomId, request, userId);

    logger.info('Room updated successfully', {
      requestId,
      roomId: room.roomId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(room, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof RoomNotFoundError) {
      logger.warn('Room not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update room', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update room', requestId)
    );
  }
}

/**
 * Deactivate a room
 * DELETE /admin/rooms/{roomId}
 *
 * Requirement 3.4: Mark room as inactive and prevent new asset assignments
 */
export async function deactivateRoomHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate room request received', { requestId });

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

    // Check query parameter for hard delete vs soft delete (deactivate)
    const hardDelete = event.queryStringParameters?.['hardDelete'] === 'true';

    if (hardDelete) {
      // Attempt hard delete (will fail if dependencies exist)
      const deleted = await roomService.deleteRoom(roomId);

      if (deleted) {
        logger.info('Room deleted successfully', { requestId, roomId });
        return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
      }
    } else {
      // Soft delete (deactivate)
      const room = await roomService.deactivateRoom(roomId, userId);

      logger.info('Room deactivated successfully', {
        requestId,
        roomId: room.roomId,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(room, requestId));
    }

    // Should not reach here
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete room', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof RoomNotFoundError) {
      logger.warn('Room not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoomHasDependenciesError) {
      logger.warn('Room has dependencies', {
        requestId,
        error: err.message,
        rackCount: err.rackCount,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate room', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate room', requestId)
    );
  }
}

/**
 * List rooms with pagination and filters
 * GET /admin/rooms
 *
 * Returns paginated list of rooms matching filter criteria
 */
export async function listRoomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List rooms request received', { requestId });

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

    // Validate floorId if provided
    if (queryParams['floorId']) {
      const uuidError = validateUUID(queryParams['floorId'], 'floorId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Validate roomType if provided
    if (queryParams['roomType'] && !VALID_ROOM_TYPES.includes(queryParams['roomType'] as RoomType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `roomType must be one of: ${VALID_ROOM_TYPES.join(', ')}`,
          requestId
        )
      );
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List rooms
    const result = await roomService.listRooms(filters, { page, limit });

    logger.info('Rooms listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list rooms', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list rooms', requestId)
    );
  }
}

/**
 * Get rooms by floor
 * GET /admin/floors/{floorId}/rooms
 *
 * Requirement 3.2: Return all rooms for a floor ordered by room number
 */
export async function getRoomsByFloorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get rooms by floor request received', { requestId });

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

    // Get rooms
    const rooms = await roomService.getRoomsByFloor(floorId);

    logger.info('Rooms by floor retrieved successfully', {
      requestId,
      floorId,
      count: rooms.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ rooms }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get rooms by floor', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get rooms by floor', requestId)
    );
  }
}

/**
 * Check if room number is unique within a floor
 * GET /admin/rooms/check-number
 *
 * Used for form validation before submission
 */
export async function checkRoomNumberHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check room number request received', { requestId });

  try {
    // Get floor ID from query parameters
    const floorId = event.queryStringParameters?.['floorId'];
    if (!floorId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'floorId query parameter is required', requestId)
      );
    }

    // Validate floorId UUID format
    const floorIdError = validateUUID(floorId, 'floorId');
    if (floorIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, floorIdError.message, requestId)
      );
    }

    // Get room number from query parameters
    const roomNumber = event.queryStringParameters?.['roomNumber'];
    if (!roomNumber) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'roomNumber query parameter is required', requestId)
      );
    }

    // Get optional exclude room ID (for updates)
    const excludeRoomId = event.queryStringParameters?.['excludeRoomId'];
    if (excludeRoomId) {
      const uuidError = validateUUID(excludeRoomId, 'excludeRoomId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await roomService.isRoomNumberUnique(floorId, roomNumber, excludeRoomId);

    logger.info('Room number check completed', {
      requestId,
      floorId,
      roomNumber,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ floorId, roomNumber, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check room number', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check room number', requestId)
    );
  }
}

/**
 * Get active rooms for a floor (for dropdowns/selectors)
 * GET /admin/floors/{floorId}/rooms/active
 */
export async function getActiveRoomsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active rooms request received', { requestId });

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

    const rooms = await roomService.getActiveRoomsByFloor(floorId);

    logger.info('Active rooms retrieved successfully', {
      requestId,
      floorId,
      count: rooms.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ rooms }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active rooms', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active rooms', requestId)
    );
  }
}

// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Unified Lambda handler for room operations
 * Routes requests based on HTTP method and path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const roomId = event.pathParameters?.['roomId'];

  logger.info('Room handler request', { method, path, roomId });

  if (method === 'GET') {
    if (roomId) return getRoomHandler(event);
    return listRoomsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) return deactivateRoomHandler(event);
    return createRoomHandler(event);
  }

  if (method === 'PUT' && roomId) return updateRoomHandler(event);
  if (method === 'DELETE' && roomId) return deactivateRoomHandler(event);

  return createLambdaResponse(405, createErrorResponse(
    API_ERROR_CODES.BAD_REQUEST,
    `Method ${method} not allowed for ${path}`,
    event.requestContext.requestId
  ));
}

export default handler;
