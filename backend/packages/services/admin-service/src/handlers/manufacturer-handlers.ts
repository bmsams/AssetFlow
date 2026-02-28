/**
 * Manufacturer Handlers - Lambda handlers for Manufacturer CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/manufacturers - Create a new manufacturer
 * - GET /admin/manufacturers/{manufacturerId} - Get manufacturer by ID
 * - PUT /admin/manufacturers/{manufacturerId} - Update manufacturer
 * - DELETE /admin/manufacturers/{manufacturerId} - Delete manufacturer
 * - GET /admin/manufacturers - List manufacturers with pagination and filters
 * - GET /admin/manufacturers/search - Search manufacturers by name
 *
 * Requirement 10: Manufacturer Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateManufacturerRequest,
  ManufacturerListFilters,
  UpdateManufacturerRequest,
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

import * as manufacturerService from '../reference-data/manufacturer-service';
import {
  ManufacturerHasDependenciesError,
  ManufacturerNameExistsError,
  ManufacturerNotFoundError,
} from '../reference-data/manufacturer-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'manufacturer-handlers' });

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
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate create manufacturer request
 * Requirement 10.1: Create manufacturer with name and optional website
 */
function validateCreateManufacturerRequest(body: unknown): ValidationResult {
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

  // Optional: website
  if (request['website'] !== undefined && request['website'] !== null) {
    if (typeof request['website'] !== 'string') {
      errors.push('website must be a string');
    } else if (request['website'].length > 0 && !isValidUrl(request['website'])) {
      errors.push('website must be a valid URL');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update manufacturer request
 * Requirement 10.3: Update manufacturer details
 */
function validateUpdateManufacturerRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['name', 'website', 'isActive'];
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

  // Validate website if provided
  if (request['website'] !== undefined && request['website'] !== null) {
    if (typeof request['website'] !== 'string') {
      errors.push('website must be a string');
    } else if (request['website'].length > 0 && !isValidUrl(request['website'])) {
      errors.push('website must be a valid URL');
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
function parseListFilters(queryParams: Record<string, string | undefined>): ManufacturerListFilters {
  const result: ManufacturerListFilters = {};

  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['search']) {
    Object.assign(result, { search: queryParams['search'] });
  }

  return result;
}

/**
 * Get user ID from event context
 */
// User context (Cognito sub -> DB user_id, with provisioning)

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Create a new manufacturer
 * POST /admin/manufacturers
 *
 * Requirement 10.1: Create manufacturer with name and optional website
 */
export async function createManufacturerHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create manufacturer request received', { requestId });

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
    const validation = validateCreateManufacturerRequest(body);
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

    const request = body as CreateManufacturerRequest;

    // Create manufacturer
    const manufacturer = await manufacturerService.createManufacturer(request, userId);

    logger.info('Manufacturer created successfully', {
      requestId,
      manufacturerId: manufacturer.manufacturerId,
      name: manufacturer.name,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(manufacturer, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ManufacturerNameExistsError) {
      logger.warn('Manufacturer name already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create manufacturer', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create manufacturer', requestId)
    );
  }
}

/**
 * Get manufacturer by ID
 * GET /admin/manufacturers/{manufacturerId}
 *
 * Requirement 10.2: Return manufacturer details including associated model count
 */
export async function getManufacturerHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get manufacturer request received', { requestId });

  try {
    // Get manufacturer ID from path parameters
    const manufacturerId = event.pathParameters?.['manufacturerId'];
    if (!manufacturerId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'manufacturerId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(manufacturerId, 'manufacturerId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get manufacturer
    const manufacturer = await manufacturerService.getManufacturerById(manufacturerId);

    if (!manufacturer) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Manufacturer not found: ${manufacturerId}`, requestId)
      );
    }

    logger.info('Manufacturer retrieved successfully', {
      requestId,
      manufacturerId: manufacturer.manufacturerId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(manufacturer, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get manufacturer', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get manufacturer', requestId)
    );
  }
}

/**
 * Update manufacturer details
 * PUT /admin/manufacturers/{manufacturerId}
 *
 * Requirement 10.3: Update manufacturer details
 */
export async function updateManufacturerHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update manufacturer request received', { requestId });

  try {
    // Get manufacturer ID from path parameters
    const manufacturerId = event.pathParameters?.['manufacturerId'];
    if (!manufacturerId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'manufacturerId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(manufacturerId, 'manufacturerId');
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
    const validation = validateUpdateManufacturerRequest(body);
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

    const request = body as UpdateManufacturerRequest;

    // Update manufacturer
    const manufacturer = await manufacturerService.updateManufacturer(manufacturerId, request, userId);

    logger.info('Manufacturer updated successfully', {
      requestId,
      manufacturerId: manufacturer.manufacturerId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(manufacturer, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ManufacturerNotFoundError) {
      logger.warn('Manufacturer not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof ManufacturerNameExistsError) {
      logger.warn('Manufacturer name already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to update manufacturer', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update manufacturer', requestId)
    );
  }
}

/**
 * Delete a manufacturer
 * DELETE /admin/manufacturers/{manufacturerId}
 *
 * Requirement 10.5: Reject deletion if has associated models
 */
export async function deleteManufacturerHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete manufacturer request received', { requestId });

  try {
    // Get manufacturer ID from path parameters
    const manufacturerId = event.pathParameters?.['manufacturerId'];
    if (!manufacturerId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'manufacturerId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(manufacturerId, 'manufacturerId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete manufacturer
    const deleted = await manufacturerService.deleteManufacturer(manufacturerId);

    if (deleted) {
      logger.info('Manufacturer deleted successfully', { requestId, manufacturerId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if manufacturer exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete manufacturer', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof ManufacturerNotFoundError) {
      logger.warn('Manufacturer not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof ManufacturerHasDependenciesError) {
      logger.warn('Manufacturer has dependencies', {
        requestId,
        error: err.message,
        modelCount: err.modelCount,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete manufacturer', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete manufacturer', requestId)
    );
  }
}

/**
 * List manufacturers with pagination and filters
 * GET /admin/manufacturers
 *
 * Requirement 10.4: Return paginated list with optional search filter
 */
export async function listManufacturersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List manufacturers request received', { requestId });

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

    // List manufacturers
    const result = await manufacturerService.listManufacturers(filters, { page, limit });

    logger.info('Manufacturers listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list manufacturers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list manufacturers', requestId)
    );
  }
}

/**
 * Search manufacturers by name
 * GET /admin/manufacturers/search?q={searchTerm}
 *
 * Requirement 10.4: Return matching manufacturers using partial text matching
 */
export async function searchManufacturersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Search manufacturers request received', { requestId });

  try {
    // Get search term from query parameters
    const queryParams = event.queryStringParameters ?? {};
    const searchTerm = queryParams['q'] ?? queryParams['search'] ?? '';

    if (!searchTerm || searchTerm.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Search term (q or search) is required',
          requestId
        )
      );
    }

    if (searchTerm.length < 2) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Search term must be at least 2 characters',
          requestId
        )
      );
    }

    // Search manufacturers
    const manufacturers = await manufacturerService.searchManufacturers(searchTerm.trim());

    logger.info('Manufacturers search completed', {
      requestId,
      searchTerm,
      resultCount: manufacturers.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ manufacturers, count: manufacturers.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to search manufacturers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to search manufacturers', requestId)
    );
  }
}

/**
 * Get active manufacturers
 * GET /admin/manufacturers/active
 *
 * Returns only active manufacturers
 */
export async function getActiveManufacturersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active manufacturers request received', { requestId });

  try {
    // Get active manufacturers
    const manufacturers = await manufacturerService.getActiveManufacturers();

    logger.info('Active manufacturers retrieved successfully', {
      requestId,
      count: manufacturers.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ manufacturers, count: manufacturers.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active manufacturers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active manufacturers', requestId)
    );
  }
}

/**
 * Get manufacturers with models
 * GET /admin/manufacturers/with-models
 *
 * Returns only manufacturers that have at least one model
 */
export async function getManufacturersWithModelsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get manufacturers with models request received', { requestId });

  try {
    // Get manufacturers with models
    const manufacturers = await manufacturerService.getManufacturersWithModels();

    logger.info('Manufacturers with models retrieved successfully', {
      requestId,
      count: manufacturers.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ manufacturers, count: manufacturers.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get manufacturers with models', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get manufacturers with models', requestId)
    );
  }
}

// ============================================================================
// Unified Router Handler
// ============================================================================

/**
 * Unified manufacturer handler that routes based on HTTP method and path
 *
 * Routes:
 * - GET    /admin/manufacturers                      -> listManufacturersHandler
 * - GET    /admin/manufacturers/search               -> searchManufacturersHandler
 * - GET    /admin/manufacturers/active               -> getActiveManufacturersHandler
 * - GET    /admin/manufacturers/with-models           -> getManufacturersWithModelsHandler
 * - GET    /admin/manufacturers/{manufacturerId}      -> getManufacturerHandler
 * - POST   /admin/manufacturers                      -> createManufacturerHandler
 * - PUT    /admin/manufacturers/{manufacturerId}      -> updateManufacturerHandler
 * - DELETE /admin/manufacturers/{manufacturerId}      -> deleteManufacturerHandler
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const manufacturerId = event.pathParameters?.['manufacturerId'];

  logger.info('Manufacturer handler request', { method, path, manufacturerId });

  if (method === 'GET') {
    if (path.endsWith('/search')) {
      return searchManufacturersHandler(event);
    }
    if (path.endsWith('/active')) {
      return getActiveManufacturersHandler(event);
    }
    if (path.endsWith('/with-models')) {
      return getManufacturersWithModelsHandler(event);
    }
    if (manufacturerId) {
      return getManufacturerHandler(event);
    }
    return listManufacturersHandler(event);
  }

  if (method === 'POST') {
    return createManufacturerHandler(event);
  }

  if (method === 'PUT') {
    if (manufacturerId) {
      return updateManufacturerHandler(event);
    }
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        'manufacturerId is required for PUT requests',
        event.requestContext.requestId
      )
    );
  }

  if (method === 'DELETE') {
    if (manufacturerId) {
      return deleteManufacturerHandler(event);
    }
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        'manufacturerId is required for DELETE requests',
        event.requestContext.requestId
      )
    );
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

export default handler;

