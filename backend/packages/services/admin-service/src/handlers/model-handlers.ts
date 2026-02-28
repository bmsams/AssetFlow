/**
 * Model Handlers - Lambda handlers for Model Catalog CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/models - Create a new model
 * - GET /admin/models/{modelId} - Get model by ID
 * - PUT /admin/models/{modelId} - Update model
 * - DELETE /admin/models/{modelId} - Delete model
 * - GET /admin/models - List models with pagination and filters
 * - GET /admin/models/search - Search models by name, model number, or SKU
 * - PUT /admin/models/{modelId}/status - Update model lifecycle status
 * - PUT /admin/models/{modelId}/deprecate - Deprecate a model
 * - PUT /admin/models/{modelId}/end-of-life - Mark model as end-of-life
 *
 * Requirement 11: Model Catalog Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateModelRequest,
  ModelListFilters,
  ModelStatus,
  UpdateModelRequest,
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

import * as modelService from '../reference-data/model-service';
import {
  InvalidStatusTransitionError,
  ModelHasDependenciesError,
  ModelNameExistsError,
  ModelNotFoundError,
  ModelSkuExistsError,
} from '../reference-data/model-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'model-handlers' });

const VALID_MODEL_STATUSES: ModelStatus[] = ['ACTIVE', 'DEPRECATED', 'END_OF_LIFE'];

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
 * Validate create model request
 * Requirement 11.1: Create model with manufacturer, model name, and specifications
 */
function validateCreateModelRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: manufacturerId
  if (!request['manufacturerId'] || typeof request['manufacturerId'] !== 'string') {
    errors.push('manufacturerId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['manufacturerId'] as string, 'manufacturerId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Required: modelName
  if (!request['modelName'] || typeof request['modelName'] !== 'string') {
    errors.push('modelName is required and must be a string');
  } else if (request['modelName'].length < 1 || request['modelName'].length > 255) {
    errors.push('modelName must be between 1 and 255 characters');
  }

  // Optional: modelNumber
  if (request['modelNumber'] !== undefined && request['modelNumber'] !== null) {
    if (typeof request['modelNumber'] !== 'string') {
      errors.push('modelNumber must be a string');
    } else if (request['modelNumber'].length > 100) {
      errors.push('modelNumber must be at most 100 characters');
    }
  }

  // Optional: sku
  if (request['sku'] !== undefined && request['sku'] !== null) {
    if (typeof request['sku'] !== 'string') {
      errors.push('sku must be a string');
    } else if (request['sku'].length > 100) {
      errors.push('sku must be at most 100 characters');
    }
  }

  // Optional: category
  if (request['category'] !== undefined && request['category'] !== null) {
    if (typeof request['category'] !== 'string') {
      errors.push('category must be a string');
    } else if (request['category'].length > 100) {
      errors.push('category must be at most 100 characters');
    }
  }

  // Optional: specifications
  if (request['specifications'] !== undefined && request['specifications'] !== null) {
    if (typeof request['specifications'] !== 'object') {
      errors.push('specifications must be an object');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate update model request
 * Requirement 11.3: Update model specifications or lifecycle status
 */
function validateUpdateModelRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['modelName', 'modelNumber', 'sku', 'category', 'specifications', 'status', 'isActive'];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate modelName if provided
  if (request['modelName'] !== undefined) {
    if (typeof request['modelName'] !== 'string') {
      errors.push('modelName must be a string');
    } else if (request['modelName'].length < 1 || request['modelName'].length > 255) {
      errors.push('modelName must be between 1 and 255 characters');
    }
  }

  // Validate modelNumber if provided
  if (request['modelNumber'] !== undefined && request['modelNumber'] !== null) {
    if (typeof request['modelNumber'] !== 'string') {
      errors.push('modelNumber must be a string');
    } else if (request['modelNumber'].length > 100) {
      errors.push('modelNumber must be at most 100 characters');
    }
  }

  // Validate sku if provided
  if (request['sku'] !== undefined && request['sku'] !== null) {
    if (typeof request['sku'] !== 'string') {
      errors.push('sku must be a string');
    } else if (request['sku'].length > 100) {
      errors.push('sku must be at most 100 characters');
    }
  }

  // Validate category if provided
  if (request['category'] !== undefined && request['category'] !== null) {
    if (typeof request['category'] !== 'string') {
      errors.push('category must be a string');
    } else if (request['category'].length > 100) {
      errors.push('category must be at most 100 characters');
    }
  }

  // Validate specifications if provided
  if (request['specifications'] !== undefined && request['specifications'] !== null) {
    if (typeof request['specifications'] !== 'object') {
      errors.push('specifications must be an object');
    }
  }

  // Validate status if provided
  if (request['status'] !== undefined) {
    if (!VALID_MODEL_STATUSES.includes(request['status'] as ModelStatus)) {
      errors.push(`status must be one of: ${VALID_MODEL_STATUSES.join(', ')}`);
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
function parseListFilters(queryParams: Record<string, string | undefined>): ModelListFilters {
  const result: ModelListFilters = {};

  if (queryParams['manufacturerId']) {
    Object.assign(result, { manufacturerId: queryParams['manufacturerId'] });
  }
  if (queryParams['status'] && VALID_MODEL_STATUSES.includes(queryParams['status'] as ModelStatus)) {
    Object.assign(result, { status: queryParams['status'] as ModelStatus });
  }
  if (queryParams['category']) {
    Object.assign(result, { category: queryParams['category'] });
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
 * Create a new model
 * POST /admin/models
 *
 * Requirement 11.1: Create model with manufacturer, model name, and specifications
 */
export async function createModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create model request received', { requestId });

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
    const validation = validateCreateModelRequest(body);
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

    const request = body as CreateModelRequest;

    // Create model
    const model = await modelService.createModel(request, userId);

    logger.info('Model created successfully', {
      requestId,
      modelId: model.modelId,
      modelName: model.modelName,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelSkuExistsError) {
      logger.warn('Model SKU already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err instanceof ModelNameExistsError) {
      logger.warn('Model name already exists for manufacturer', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create model', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create model', requestId)
    );
  }
}

/**
 * Get model by ID
 * GET /admin/models/{modelId}
 *
 * Requirement 11.2: Return complete model details including specifications and asset count
 */
export async function getModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get model request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get model
    const model = await modelService.getModelById(modelId);

    if (!model) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Model not found: ${modelId}`, requestId)
      );
    }

    logger.info('Model retrieved successfully', {
      requestId,
      modelId: model.modelId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get model', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get model', requestId)
    );
  }
}

/**
 * Update model details
 * PUT /admin/models/{modelId}
 *
 * Requirement 11.3: Update model specifications or lifecycle status
 */
export async function updateModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update model request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
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
    const validation = validateUpdateModelRequest(body);
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

    const request = body as UpdateModelRequest;

    // Update model
    const model = await modelService.updateModel(modelId, request, userId);

    logger.info('Model updated successfully', {
      requestId,
      modelId: model.modelId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelNotFoundError) {
      logger.warn('Model not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof ModelSkuExistsError) {
      logger.warn('Model SKU already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err instanceof InvalidStatusTransitionError) {
      logger.warn('Invalid status transition', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update model', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update model', requestId)
    );
  }
}

/**
 * Delete a model
 * DELETE /admin/models/{modelId}
 */
export async function deleteModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete model request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete model
    const deleted = await modelService.deleteModel(modelId);

    if (deleted) {
      logger.info('Model deleted successfully', { requestId, modelId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if model exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete model', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelNotFoundError) {
      logger.warn('Model not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof ModelHasDependenciesError) {
      logger.warn('Model has dependencies', {
        requestId,
        error: err.message,
        assetCount: err.assetCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete model', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete model', requestId)
    );
  }
}

/**
 * List models with pagination and filters
 * GET /admin/models
 *
 * Requirement 11.5: Return paginated list with optional manufacturer and status filters
 */
export async function listModelsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List models request received', { requestId });

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

    // List models
    const result = await modelService.listModels(filters, { page, limit });

    logger.info('Models listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list models', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list models', requestId)
    );
  }
}

/**
 * Search models by name, model number, or SKU
 * GET /admin/models/search?q={searchTerm}
 *
 * Requirement 11.6: Return matching models using partial text matching
 */
export async function searchModelsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Search models request received', { requestId });

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

    // Search models
    const models = await modelService.searchModels(searchTerm.trim());

    logger.info('Models search completed', {
      requestId,
      searchTerm,
      resultCount: models.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ models, count: models.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to search models', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to search models', requestId)
    );
  }
}

/**
 * Update model lifecycle status
 * PUT /admin/models/{modelId}/status
 *
 * Requirement 11.3: Update model lifecycle status
 */
export async function updateModelStatusHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update model status request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
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

    if (!body || typeof body !== 'object') {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    const request = body as Record<string, unknown>;
    const status = request['status'] as ModelStatus;

    if (!status || !VALID_MODEL_STATUSES.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `status must be one of: ${VALID_MODEL_STATUSES.join(', ')}`,
          requestId
        )
      );
    }

    // Update model status
    const model = await modelService.updateModelStatus(modelId, status, userId);

    logger.info('Model status updated successfully', {
      requestId,
      modelId: model.modelId,
      status: model.status,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelNotFoundError) {
      logger.warn('Model not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof InvalidStatusTransitionError) {
      logger.warn('Invalid status transition', {
        requestId,
        error: err.message,
        currentStatus: err.currentStatus,
        requestedStatus: err.requestedStatus,
      });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update model status', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update model status', requestId)
    );
  }
}

/**
 * Deprecate a model
 * PUT /admin/models/{modelId}/deprecate
 */
export async function deprecateModelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deprecate model request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Deprecate model
    const model = await modelService.deprecateModel(modelId, userId);

    logger.info('Model deprecated successfully', {
      requestId,
      modelId: model.modelId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelNotFoundError) {
      logger.warn('Model not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof InvalidStatusTransitionError) {
      logger.warn('Invalid status transition', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to deprecate model', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deprecate model', requestId)
    );
  }
}

/**
 * Mark model as end-of-life
 * PUT /admin/models/{modelId}/end-of-life
 *
 * Requirement 11.4: Mark model as end-of-life and prevent new asset creation
 */
export async function markModelEndOfLifeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Mark model end-of-life request received', { requestId });

  try {
    // Get model ID from path parameters
    const modelId = event.pathParameters?.['modelId'];
    if (!modelId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'modelId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(modelId, 'modelId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Mark model as end-of-life
    const model = await modelService.markModelEndOfLife(modelId, userId);

    logger.info('Model marked as end-of-life successfully', {
      requestId,
      modelId: model.modelId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(model, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof ModelNotFoundError) {
      logger.warn('Model not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof InvalidStatusTransitionError) {
      logger.warn('Invalid status transition', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to mark model as end-of-life', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to mark model as end-of-life', requestId)
    );
  }
}

/**
 * Get active models
 * GET /admin/models/active
 *
 * Returns only active models that are not end-of-life
 */
export async function getActiveModelsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active models request received', { requestId });

  try {
    // Get active models
    const models = await modelService.getActiveModels();

    logger.info('Active models retrieved successfully', {
      requestId,
      count: models.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ models, count: models.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active models', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active models', requestId)
    );
  }
}

/**
 * Get models by manufacturer
 * GET /admin/models/manufacturer/{manufacturerId}
 */
export async function getModelsByManufacturerHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get models by manufacturer request received', { requestId });

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

    // Get models by manufacturer
    const models = await modelService.getModelsByManufacturer(manufacturerId);

    logger.info('Models by manufacturer retrieved successfully', {
      requestId,
      manufacturerId,
      count: models.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ models, count: models.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get models by manufacturer', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get models by manufacturer', requestId)
    );
  }
}

/**
 * Get models available for asset creation
 * GET /admin/models/for-asset-creation
 *
 * Returns only active models that are not end-of-life
 * Requirement 11.4: Prevent new asset creation with end-of-life models
 */
export async function getModelsForAssetCreationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get models for asset creation request received', { requestId });

  try {
    // Get models for asset creation
    const models = await modelService.getModelsForAssetCreation();

    logger.info('Models for asset creation retrieved successfully', {
      requestId,
      count: models.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ models, count: models.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get models for asset creation', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get models for asset creation', requestId)
    );
  }
}

// ============================================================================
// Unified Router Handler
// ============================================================================

/**
 * Unified handler that routes requests based on HTTP method and path.
 *
 * Routes:
 * - GET    /admin/models                              -> listModelsHandler
 * - GET    /admin/models/active                       -> getActiveModelsHandler
 * - GET    /admin/models/search                       -> searchModelsHandler
 * - GET    /admin/models/for-asset-creation           -> getModelsForAssetCreationHandler
 * - GET    /admin/models/manufacturer/{manufacturerId}-> getModelsByManufacturerHandler
 * - GET    /admin/models/{modelId}                    -> getModelHandler
 * - POST   /admin/models                              -> createModelHandler
 * - PUT    /admin/models/{modelId}                    -> updateModelHandler
 * - PUT    /admin/models/{modelId}/status             -> updateModelStatusHandler
 * - PUT    /admin/models/{modelId}/deprecate          -> deprecateModelHandler
 * - PUT    /admin/models/{modelId}/end-of-life        -> markModelEndOfLifeHandler
 * - DELETE /admin/models/{modelId}                    -> deleteModelHandler
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const modelId = event.pathParameters?.['modelId'];

  logger.info('Model handler request', { method, path, modelId });

  if (method === 'GET') {
    // Static sub-paths must be checked before the dynamic {modelId} catch-all
    if (path.endsWith('/models/active')) {
      return getActiveModelsHandler(event);
    }
    if (path.endsWith('/models/search')) {
      return searchModelsHandler(event);
    }
    if (path.endsWith('/models/for-asset-creation')) {
      return getModelsForAssetCreationHandler(event);
    }
    if (path.includes('/models/manufacturer/')) {
      return getModelsByManufacturerHandler(event);
    }
    if (modelId) {
      return getModelHandler(event);
    }
    // Base collection path: GET /admin/models
    if (path.endsWith('/models') || path.endsWith('/models/')) {
      return listModelsHandler(event);
    }
  }

  if (method === 'POST') {
    if (path.endsWith('/models') || path.endsWith('/models/')) {
      return createModelHandler(event);
    }
  }

  if (method === 'PUT') {
    if (modelId) {
      if (path.endsWith('/status')) {
        return updateModelStatusHandler(event);
      }
      if (path.endsWith('/deprecate')) {
        return deprecateModelHandler(event);
      }
      if (path.endsWith('/end-of-life')) {
        return markModelEndOfLifeHandler(event);
      }
      return updateModelHandler(event);
    }
  }

  if (method === 'DELETE') {
    if (modelId) {
      return deleteModelHandler(event);
    }
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

