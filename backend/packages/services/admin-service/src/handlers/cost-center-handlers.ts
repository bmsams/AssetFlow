/**
 * Cost Center Handlers - Lambda handlers for Cost Center CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/cost-centers - Create a new cost center
 * - GET /admin/cost-centers/{costCenterId} - Get cost center by ID
 * - PUT /admin/cost-centers/{costCenterId} - Update cost center
 * - DELETE /admin/cost-centers/{costCenterId} - Delete cost center
 * - GET /admin/cost-centers - List cost centers with pagination and filters
 * - POST /admin/cost-centers/{costCenterId}/expenses - Record expense against cost center
 * - GET /admin/cost-centers/{costCenterId}/utilization - Get cost center utilization
 * - GET /admin/departments/{departmentId}/cost-centers - Get cost centers by department
 *
 * Requirement 8: Cost Center Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CostCenterListFilters,
  CreateCostCenterRequest,
  UpdateCostCenterRequest,
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

import * as costCenterService from '../reference-data/cost-center-service';
import {
  BudgetExceededError,
  CostCenterCodeExistsError,
  CostCenterHasDependenciesError,
  CostCenterInactiveError,
  CostCenterNotFoundError,
} from '../reference-data/cost-center-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'cost-center-handlers' });


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
 * Validate cost center code format
 * Code must be alphanumeric with dashes/underscores, max 50 chars
 */
function isValidCostCenterCode(code: string): boolean {
  const codeRegex = /^[a-zA-Z0-9_-]+$/;
  return codeRegex.test(code) && code.length <= 50;
}

/**
 * Validate create cost center request
 * Requirement 8.1: Create cost center with code, name, department, and budget amount
 */
function validateCreateCostCenterRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: code
  if (!request['code'] || typeof request['code'] !== 'string') {
    errors.push('code is required and must be a string');
  } else if (request['code'].length < 1 || request['code'].length > 50) {
    errors.push('code must be between 1 and 50 characters');
  } else if (!isValidCostCenterCode(request['code'])) {
    errors.push('code must contain only alphanumeric characters, dashes, and underscores');
  }

  // Required: name
  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Required: budgetAmount
  if (request['budgetAmount'] === undefined || request['budgetAmount'] === null) {
    errors.push('budgetAmount is required');
  } else if (typeof request['budgetAmount'] !== 'number') {
    errors.push('budgetAmount must be a number');
  } else if (request['budgetAmount'] < 0) {
    errors.push('budgetAmount must be non-negative');
  }

  // Required: fiscalYear
  if (request['fiscalYear'] === undefined || request['fiscalYear'] === null) {
    errors.push('fiscalYear is required');
  } else if (typeof request['fiscalYear'] !== 'number') {
    errors.push('fiscalYear must be a number');
  } else if (!Number.isInteger(request['fiscalYear']) || request['fiscalYear'] < 2000 || request['fiscalYear'] > 2100) {
    errors.push('fiscalYear must be a valid year between 2000 and 2100');
  }

  // Optional: departmentId
  if (request['departmentId'] !== undefined && request['departmentId'] !== null) {
    if (typeof request['departmentId'] !== 'string') {
      errors.push('departmentId must be a string');
    } else {
      const uuidError = validateUUID(request['departmentId'], 'departmentId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Validate update cost center request
 * Requirement 8.3: Update budget or department assignment
 */
function validateUpdateCostCenterRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['name', 'departmentId', 'budgetAmount', 'isActive'];
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

  // Validate departmentId if provided
  if (request['departmentId'] !== undefined && request['departmentId'] !== null) {
    if (typeof request['departmentId'] !== 'string') {
      errors.push('departmentId must be a string');
    } else {
      const uuidError = validateUUID(request['departmentId'], 'departmentId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate budgetAmount if provided
  if (request['budgetAmount'] !== undefined) {
    if (typeof request['budgetAmount'] !== 'number') {
      errors.push('budgetAmount must be a number');
    } else if (request['budgetAmount'] < 0) {
      errors.push('budgetAmount must be non-negative');
    }
  }

  // Validate isActive if provided
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate record expense request
 */
function validateRecordExpenseRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: amount
  if (request['amount'] === undefined || request['amount'] === null) {
    errors.push('amount is required');
  } else if (typeof request['amount'] !== 'number') {
    errors.push('amount must be a number');
  } else if (request['amount'] <= 0) {
    errors.push('amount must be positive');
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Parse list filters from query parameters
 */
function parseListFilters(queryParams: Record<string, string | undefined>): CostCenterListFilters {
  const result: CostCenterListFilters = {};

  if (queryParams['departmentId']) {
    Object.assign(result, { departmentId: queryParams['departmentId'] });
  }
  if (queryParams['fiscalYear']) {
    const fiscalYear = parseInt(queryParams['fiscalYear'], 10);
    if (!isNaN(fiscalYear)) {
      Object.assign(result, { fiscalYear });
    }
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
 * Create a new cost center
 * POST /admin/cost-centers
 *
 * Requirement 8.1: Create cost center with code, name, department, and budget amount
 */
export async function createCostCenterHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create cost center request received', { requestId });

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
    const validation = validateCreateCostCenterRequest(body);
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

    const request = body as CreateCostCenterRequest;

    // Create cost center
    const costCenter = await costCenterService.createCostCenter(request, userId);

    logger.info('Cost center created successfully', {
      requestId,
      costCenterId: costCenter.costCenterId,
      code: costCenter.code,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(costCenter, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof CostCenterCodeExistsError) {
      logger.warn('Cost center code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to create cost center', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create cost center', requestId)
    );
  }
}


/**
 * Get cost center by ID
 * GET /admin/cost-centers/{costCenterId}
 *
 * Requirement 8.2: Return cost center details including budget, spent, and available amounts
 */
export async function getCostCenterHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get cost center request received', { requestId });

  try {
    // Get cost center ID from path parameters
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(costCenterId, 'costCenterId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get cost center
    const costCenter = await costCenterService.getCostCenterById(costCenterId);

    if (!costCenter) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Cost center not found: ${costCenterId}`, requestId)
      );
    }

    logger.info('Cost center retrieved successfully', {
      requestId,
      costCenterId: costCenter.costCenterId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(costCenter, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get cost center', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get cost center', requestId)
    );
  }
}


/**
 * Update cost center details
 * PUT /admin/cost-centers/{costCenterId}
 *
 * Requirement 8.3: Update budget or department assignment and recalculate available amount
 */
export async function updateCostCenterHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update cost center request received', { requestId });

  try {
    // Get cost center ID from path parameters
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(costCenterId, 'costCenterId');
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
    const validation = validateUpdateCostCenterRequest(body);
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

    const request = body as UpdateCostCenterRequest;

    // Update cost center
    const costCenter = await costCenterService.updateCostCenter(costCenterId, request, userId);

    logger.info('Cost center updated successfully', {
      requestId,
      costCenterId: costCenter.costCenterId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(costCenter, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof CostCenterNotFoundError) {
      logger.warn('Cost center not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to update cost center', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update cost center', requestId)
    );
  }
}


/**
 * Delete a cost center
 * DELETE /admin/cost-centers/{costCenterId}
 *
 * Requirement 8.6: Reject deletion if has allocated expenses
 */
export async function deleteCostCenterHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete cost center request received', { requestId });

  try {
    // Get cost center ID from path parameters
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(costCenterId, 'costCenterId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Delete cost center
    const deleted = await costCenterService.deleteCostCenter(costCenterId);

    if (deleted) {
      logger.info('Cost center deleted successfully', { requestId, costCenterId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if cost center exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete cost center', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof CostCenterNotFoundError) {
      logger.warn('Cost center not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof CostCenterHasDependenciesError) {
      logger.warn('Cost center has dependencies', {
        requestId,
        error: err.message,
        assetCount: err.assetCount,
        poCount: err.poCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete cost center', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete cost center', requestId)
    );
  }
}

/**
 * Deactivate a cost center
 * POST /admin/cost-centers/{costCenterId}/deactivate
 */
export async function deactivateCostCenterHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate cost center request received', { requestId });

  try {
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    const uuidError = validateUUID(costCenterId, 'costCenterId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    const costCenter = await costCenterService.deactivateCostCenter(costCenterId, userId);

    logger.info('Cost center deactivated successfully', {
      requestId,
      costCenterId: costCenter.costCenterId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(costCenter, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof CostCenterNotFoundError) {
      logger.warn('Cost center not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate cost center', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate cost center', requestId)
    );
  }
}


/**
 * List cost centers with pagination and filters
 * GET /admin/cost-centers
 *
 * Requirement 8.5: Return paginated list with budget utilization percentages
 */
export async function listCostCentersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List cost centers request received', { requestId });

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

    // Validate departmentId if provided
    if (queryParams['departmentId']) {
      const uuidError = validateUUID(queryParams['departmentId'], 'departmentId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List cost centers
    const result = await costCenterService.listCostCenters(filters, { page, limit });

    logger.info('Cost centers listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list cost centers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list cost centers', requestId)
    );
  }
}


/**
 * Record an expense against a cost center
 * POST /admin/cost-centers/{costCenterId}/expenses
 *
 * Requirement 8.4: Track spending against budget
 */
export async function recordExpenseHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Record expense request received', { requestId });

  try {
    // Get cost center ID from path parameters
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(costCenterId, 'costCenterId');
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
    const validation = validateRecordExpenseRequest(body);
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

    const request = body as { amount: number };

    // Record expense
    const costCenter = await costCenterService.recordExpense(costCenterId, request.amount, userId);

    logger.info('Expense recorded successfully', {
      requestId,
      costCenterId: costCenter.costCenterId,
      amount: request.amount,
      newSpentAmount: costCenter.spentAmount,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(costCenter, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof CostCenterNotFoundError) {
      logger.warn('Cost center not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof CostCenterInactiveError) {
      logger.warn('Cost center is inactive', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    if (err instanceof BudgetExceededError) {
      logger.warn('Budget exceeded', {
        requestId,
        error: err.message,
        availableAmount: err.availableAmount,
        requestedAmount: err.requestedAmount,
      });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to record expense', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record expense', requestId)
    );
  }
}


/**
 * Get cost center utilization
 * GET /admin/cost-centers/{costCenterId}/utilization
 *
 * Requirement 8.5: Return budget utilization percentages
 */
export async function getCostCenterUtilizationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get cost center utilization request received', { requestId });

  try {
    // Get cost center ID from path parameters
    const costCenterId = event.pathParameters?.['costCenterId'];
    if (!costCenterId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'costCenterId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(costCenterId, 'costCenterId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get budget summary (includes utilization)
    const summary = await costCenterService.getCostCenterBudgetSummary(costCenterId);

    if (!summary) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Cost center not found: ${costCenterId}`, requestId)
      );
    }

    logger.info('Cost center utilization retrieved successfully', {
      requestId,
      costCenterId: summary.costCenterId,
      utilizationPercentage: summary.utilizationPercentage,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get cost center utilization', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get cost center utilization', requestId)
    );
  }
}


/**
 * Get cost centers by department
 * GET /admin/departments/{departmentId}/cost-centers
 *
 * Returns all cost centers associated with a specific department
 */
export async function getCostCentersByDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get cost centers by department request received', { requestId });

  try {
    // Get department ID from path parameters
    const departmentId = event.pathParameters?.['departmentId'];
    if (!departmentId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'departmentId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(departmentId, 'departmentId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get cost centers for department
    const costCenters = await costCenterService.getCostCentersByDepartment(departmentId);

    logger.info('Cost centers by department retrieved successfully', {
      requestId,
      departmentId,
      count: costCenters.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ costCenters }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get cost centers by department', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get cost centers by department', requestId)
    );
  }
}


// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Unified cost center handler - routes requests to appropriate handler based on
 * HTTP method and path.
 *
 * This serves as the single Lambda entry point for all cost center operations.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const costCenterId = event.pathParameters?.['costCenterId'];

  logger.info('Cost center handler request', { method, path, costCenterId });

  if (method === 'GET') {
    if (path.includes('/utilization')) {
      return getCostCenterUtilizationHandler(event);
    }
    if (path.includes('/cost-centers') && event.pathParameters?.['departmentId']) {
      return getCostCentersByDepartmentHandler(event);
    }
    if (costCenterId) {
      return getCostCenterHandler(event);
    }
    return listCostCentersHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/expenses')) {
      return recordExpenseHandler(event);
    }
    if (path.endsWith('/deactivate')) {
      return deactivateCostCenterHandler(event);
    }
    return createCostCenterHandler(event);
  }

  if (method === 'PUT' && costCenterId) {
    return updateCostCenterHandler(event);
  }

  if (method === 'DELETE' && costCenterId) {
    return deleteCostCenterHandler(event);
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
