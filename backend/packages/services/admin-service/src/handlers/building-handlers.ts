/**
 * Building Handlers - Lambda handlers for Building CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/buildings - Create a new building
 * - GET /admin/buildings/{buildingId} - Get building by ID
 * - PUT /admin/buildings/{buildingId} - Update building
 * - DELETE /admin/buildings/{buildingId} - Deactivate building
 * - GET /admin/buildings - List buildings with pagination and filters
 * - GET /admin/buildings/check-code - Check building code uniqueness
 * - GET /admin/buildings/active - Get active buildings
 *
 * Requirement 1: Location Hierarchy - Building Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  BuildingListFilters,
  CreateBuildingRequest,
  UpdateBuildingRequest,
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

import * as buildingService from '../location/building-service';
import {
  BuildingCodeExistsError,
  BuildingHasDependenciesError,
  BuildingNotFoundError,
} from '../location/building-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'building-handlers' });

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
 * Validate building code format
 * Code must be alphanumeric with dashes/underscores, max 50 chars
 */
function isValidBuildingCode(code: string): boolean {
  const codeRegex = /^[a-zA-Z0-9_-]+$/;
  return codeRegex.test(code) && code.length <= 50;
}

/**
 * Validate create building request
 */
function validateCreateBuildingRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: buildingCode
  if (!request['buildingCode'] || typeof request['buildingCode'] !== 'string') {
    errors.push('buildingCode is required and must be a string');
  } else if (request['buildingCode'].length < 1 || request['buildingCode'].length > 50) {
    errors.push('buildingCode must be between 1 and 50 characters');
  } else if (!isValidBuildingCode(request['buildingCode'])) {
    errors.push('buildingCode must contain only alphanumeric characters, dashes, and underscores');
  }

  // Required: name
  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Optional string fields validation
  if (request['addressLine1'] !== undefined && typeof request['addressLine1'] !== 'string') {
    errors.push('addressLine1 must be a string');
  }

  if (request['addressLine2'] !== undefined && typeof request['addressLine2'] !== 'string') {
    errors.push('addressLine2 must be a string');
  }

  if (request['city'] !== undefined && typeof request['city'] !== 'string') {
    errors.push('city must be a string');
  }

  if (request['stateProvince'] !== undefined && typeof request['stateProvince'] !== 'string') {
    errors.push('stateProvince must be a string');
  }

  if (request['postalCode'] !== undefined && typeof request['postalCode'] !== 'string') {
    errors.push('postalCode must be a string');
  }

  if (request['country'] !== undefined && typeof request['country'] !== 'string') {
    errors.push('country must be a string');
  }

  if (request['contactName'] !== undefined && typeof request['contactName'] !== 'string') {
    errors.push('contactName must be a string');
  }

  if (request['contactPhone'] !== undefined && typeof request['contactPhone'] !== 'string') {
    errors.push('contactPhone must be a string');
  }

  if (request['contactEmail'] !== undefined && typeof request['contactEmail'] !== 'string') {
    errors.push('contactEmail must be a string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update building request
 */
function validateUpdateBuildingRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = [
    'name', 'addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country',
    'contactName', 'contactPhone', 'contactEmail', 'isActive'
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

  // Validate optional string fields if provided
  const stringFields = ['addressLine1', 'addressLine2', 'city', 'stateProvince', 'postalCode', 'country', 'contactName', 'contactPhone', 'contactEmail'];
  for (const field of stringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
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
 */
function parseListFilters(
  queryParams: Record<string, string | undefined>
): BuildingListFilters {
  const result: BuildingListFilters = {};

  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['city']) {
    Object.assign(result, { city: queryParams['city'] });
  }
  if (queryParams['stateProvince']) {
    Object.assign(result, { stateProvince: queryParams['stateProvince'] });
  }
  if (queryParams['country']) {
    Object.assign(result, { country: queryParams['country'] });
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
 * Create a new building
 * POST /admin/buildings
 *
 * Requirement 1.1: Create building with name, address, and contact information
 */
export async function createBuildingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create building request received', { requestId });

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
    const validation = validateCreateBuildingRequest(body);
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

    const request = body as CreateBuildingRequest;

    // Create building
    const building = await buildingService.createBuilding(request, userId);

    logger.info('Building created successfully', {
      requestId,
      buildingId: building.buildingId,
      buildingCode: building.buildingCode,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(building, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BuildingCodeExistsError) {
      logger.warn('Building code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create building', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create building', requestId)
    );
  }
}

/**
 * Get building by ID
 * GET /admin/buildings/{buildingId}
 *
 * Requirement 1.2: Return complete building details including floors count
 */
export async function getBuildingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get building request received', { requestId });

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

    // Get building
    const building = await buildingService.getBuilding(buildingId);

    if (!building) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Building not found: ${buildingId}`, requestId)
      );
    }

    logger.info('Building retrieved successfully', {
      requestId,
      buildingId: building.buildingId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(building, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get building', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get building', requestId)
    );
  }
}


/**
 * Update building details
 * PUT /admin/buildings/{buildingId}
 *
 * Requirement 1.3: Update specified fields and preserve unchanged fields
 */
export async function updateBuildingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update building request received', { requestId });

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
    const validation = validateUpdateBuildingRequest(body);
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

    const request = body as UpdateBuildingRequest;

    // Update building
    const building = await buildingService.updateBuilding(buildingId, request, userId);

    logger.info('Building updated successfully', {
      requestId,
      buildingId: building.buildingId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(building, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof BuildingNotFoundError) {
      logger.warn('Building not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update building', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update building', requestId)
    );
  }
}

/**
 * Deactivate a building
 * DELETE /admin/buildings/{buildingId}
 *
 * Requirement 1.4: Mark building as inactive and prevent new asset assignments
 * Requirement 1.6: Reject deletion if building has active assets or floors
 */
export async function deactivateBuildingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate building request received', { requestId });

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

    // Check query parameter for hard delete vs soft delete (deactivate)
    const hardDelete = event.queryStringParameters?.['hardDelete'] === 'true';

    if (hardDelete) {
      // Attempt hard delete (will fail if dependencies exist)
      const deleted = await buildingService.deleteBuilding(buildingId);

      if (deleted) {
        logger.info('Building deleted successfully', { requestId, buildingId });
        return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
      }
    } else {
      // Soft delete (deactivate)
      const building = await buildingService.deactivateBuilding(buildingId, userId);

      logger.info('Building deactivated successfully', {
        requestId,
        buildingId: building.buildingId,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(building, requestId));
    }

    // Should not reach here
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete building', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof BuildingNotFoundError) {
      logger.warn('Building not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof BuildingHasDependenciesError) {
      logger.warn('Building has dependencies', {
        requestId,
        error: err.message,
        floorCount: err.floorCount,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate building', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate building', requestId)
    );
  }
}


/**
 * List buildings with pagination and filters
 * GET /admin/buildings
 *
 * Requirement 1.5: Return paginated list of buildings matching filter criteria
 */
export async function listBuildingsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List buildings request received', { requestId });

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

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List buildings
    const result = await buildingService.listBuildings(filters, { page, limit });

    logger.info('Buildings listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list buildings', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list buildings', requestId)
    );
  }
}

/**
 * Check if building code is unique
 * GET /admin/buildings/check-code
 *
 * Used for form validation before submission
 */
export async function checkBuildingCodeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check building code request received', { requestId });

  try {
    // Get building code from query parameters
    const buildingCode = event.queryStringParameters?.['buildingCode'];
    if (!buildingCode) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'buildingCode query parameter is required', requestId)
      );
    }

    // Get optional exclude building ID (for updates)
    const excludeBuildingId = event.queryStringParameters?.['excludeBuildingId'];
    if (excludeBuildingId) {
      const uuidError = validateUUID(excludeBuildingId, 'excludeBuildingId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await buildingService.isBuildingCodeUnique(buildingCode, excludeBuildingId);

    logger.info('Building code check completed', {
      requestId,
      buildingCode,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ buildingCode, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check building code', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check building code', requestId)
    );
  }
}

/**
 * Get active buildings (for dropdowns/selectors)
 * GET /admin/buildings/active
 */
export async function getActiveBuildingsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active buildings request received', { requestId });

  try {
    const buildings = await buildingService.getActiveBuildings();

    logger.info('Active buildings retrieved successfully', {
      requestId,
      count: buildings.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ buildings }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active buildings', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active buildings', requestId)
    );
  }
}

// ============================================================================
// Main Handler - Routes requests to appropriate handler
// ============================================================================

/**
 * Main Lambda handler that routes requests based on HTTP method and path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const buildingId = event.pathParameters?.['buildingId'];

  logger.info('Building handler request', { method, path, buildingId });

  // Route based on method and path
  if (method === 'GET') {
    if (path.endsWith('/active')) {
      return getActiveBuildingsHandler(event);
    }
    if (path.endsWith('/check-code') || path.includes('check-code')) {
      return checkBuildingCodeHandler(event);
    }
    if (buildingId) {
      return getBuildingHandler(event);
    }
    return listBuildingsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) {
      return deactivateBuildingHandler(event);
    }
    return createBuildingHandler(event);
  }

  if (method === 'PUT' && buildingId) {
    return updateBuildingHandler(event);
  }

  if (method === 'DELETE' && buildingId) {
    return deactivateBuildingHandler(event);
  }

  // Method not allowed
  return createLambdaResponse(
    405,
    createErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      `Method ${method} not allowed for ${path}`,
      event.requestContext.requestId
    )
  );
}
