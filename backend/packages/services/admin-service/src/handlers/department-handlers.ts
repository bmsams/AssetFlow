/**
 * Department Handlers - Lambda handlers for Department CRUD operations
 *
 * Implements HTTP endpoints for:
 * - POST /admin/departments - Create a new department
 * - GET /admin/departments/{departmentId} - Get department by ID
 * - GET /admin/departments/{departmentId}/children - Get child departments
 * - PUT /admin/departments/{departmentId} - Update department
 * - POST /admin/departments/{departmentId}/deactivate - Deactivate department with cascade
 * - DELETE /admin/departments/{departmentId} - Delete department
 * - GET /admin/departments - List departments with pagination and filters
 * - GET /admin/departments/check-code - Check department code uniqueness
 * - GET /admin/departments/{departmentId}/hierarchy - Get department hierarchy path
 * - GET /admin/departments/roots - Get root departments
 *
 * Requirement 7: Department Management
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type {
  CreateDepartmentRequest,
  DepartmentListFilters,
  UpdateDepartmentRequest,
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

import * as departmentService from '../reference-data/department-service';
import {
  CircularReferenceError,
  DepartmentCodeExistsError,
  DepartmentHasDependenciesError,
  DepartmentNotFoundError,
  ParentDepartmentNotFoundError,
} from '../reference-data/department-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'department-handlers' });


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
 * Validate department code format
 * Code must be alphanumeric with dashes/underscores, max 50 chars
 */
function isValidDepartmentCode(code: string): boolean {
  const codeRegex = /^[a-zA-Z0-9_-]+$/;
  return codeRegex.test(code) && code.length <= 50;
}

/**
 * Validate create department request
 * Requirement 7.1: Create department with code, name, and optional parent
 */
function validateCreateDepartmentRequest(body: unknown): ValidationResult {
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
  } else if (!isValidDepartmentCode(request['code'])) {
    errors.push('code must contain only alphanumeric characters, dashes, and underscores');
  }

  // Required: name
  if (!request['name'] || typeof request['name'] !== 'string') {
    errors.push('name is required and must be a string');
  } else if (request['name'].length < 1 || request['name'].length > 255) {
    errors.push('name must be between 1 and 255 characters');
  }

  // Optional: parentDepartmentId
  if (request['parentDepartmentId'] !== undefined && request['parentDepartmentId'] !== null) {
    if (typeof request['parentDepartmentId'] !== 'string') {
      errors.push('parentDepartmentId must be a string');
    } else {
      const uuidError = validateUUID(request['parentDepartmentId'], 'parentDepartmentId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Validate update department request
 * Requirement 7.3: Update specified fields and maintain parent relationship
 */
function validateUpdateDepartmentRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['name', 'parentDepartmentId', 'isActive'];
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

  // Validate parentDepartmentId if provided
  if (request['parentDepartmentId'] !== undefined && request['parentDepartmentId'] !== null) {
    if (typeof request['parentDepartmentId'] !== 'string') {
      errors.push('parentDepartmentId must be a string');
    } else {
      const uuidError = validateUUID(request['parentDepartmentId'], 'parentDepartmentId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
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
function parseListFilters(queryParams: Record<string, string | undefined>): DepartmentListFilters {
  const result: DepartmentListFilters = {};

  if (queryParams['parentDepartmentId']) {
    Object.assign(result, { parentDepartmentId: queryParams['parentDepartmentId'] });
  }
  if (queryParams['isActive'] !== undefined) {
    Object.assign(result, { isActive: queryParams['isActive'] === 'true' });
  }
  if (queryParams['includeHierarchy'] !== undefined) {
    Object.assign(result, { includeHierarchy: queryParams['includeHierarchy'] === 'true' });
  }
  if (queryParams['search']) {
    Object.assign(result, { search: queryParams['search'] });
  }

  return result;
}

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Create a new department
 * POST /admin/departments
 *
 * Requirement 7.1: Create department with name, code, parent reference, and manager
 * Requirement 7.5: Reject creation for non-existent parent
 */
export async function createDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Create department request received', { requestId });

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
    const validation = validateCreateDepartmentRequest(body);
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

    const request = body as CreateDepartmentRequest;

    // Create department
    const department = await departmentService.createDepartment(request, userId);

    logger.info('Department created successfully', {
      requestId,
      departmentId: department.departmentId,
      code: department.code,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(department, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof DepartmentCodeExistsError) {
      logger.warn('Department code already exists', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err instanceof ParentDepartmentNotFoundError) {
      logger.warn('Parent department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to create department', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create department', requestId)
    );
  }
}


/**
 * Get department by ID
 * GET /admin/departments/{departmentId}
 *
 * Requirement 7.2: Return all departments with their hierarchy level and child count
 */
export async function getDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get department request received', { requestId });

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

    // Get department
    const department = await departmentService.getDepartment(departmentId);

    if (!department) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Department not found: ${departmentId}`, requestId)
      );
    }

    logger.info('Department retrieved successfully', {
      requestId,
      departmentId: department.departmentId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(department, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get department', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get department', requestId)
    );
  }
}


/**
 * Get child departments for a parent department
 * GET /admin/departments/{departmentId}/children
 *
 * Requirement 7.2: Return department details including parent and child departments
 */
export async function getDepartmentsByParentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get departments by parent request received', { requestId });

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

    // Get child departments
    const departments = await departmentService.getDepartmentsByParent(departmentId);

    logger.info('Child departments retrieved successfully', {
      requestId,
      parentId: departmentId,
      count: departments.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ departments }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get child departments', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get child departments', requestId)
    );
  }
}


/**
 * Update department details
 * PUT /admin/departments/{departmentId}
 *
 * Requirement 7.3: Update specified fields and maintain parent relationship
 */
export async function updateDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Update department request received', { requestId });

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
    const validation = validateUpdateDepartmentRequest(body);
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

    const request = body as UpdateDepartmentRequest;

    // Update department
    const department = await departmentService.updateDepartment(departmentId, request, userId);

    logger.info('Department updated successfully', {
      requestId,
      departmentId: department.departmentId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(department, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof DepartmentNotFoundError) {
      logger.warn('Department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof ParentDepartmentNotFoundError) {
      logger.warn('Parent department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof CircularReferenceError) {
      logger.warn('Circular reference detected', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update department', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update department', requestId)
    );
  }
}


/**
 * Deactivate a department with cascade to children
 * POST /admin/departments/{departmentId}/deactivate
 *
 * Requirement 7.4: Cascade deactivation to all child departments
 */
export async function deactivateDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId } = await getUserContext(event);

  logger.info('Deactivate department request received', { requestId });

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

    // Deactivate department (cascades to children)
    const department = await departmentService.deactivateDepartment(departmentId, userId);

    logger.info('Department deactivated successfully', {
      requestId,
      departmentId: department.departmentId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(department, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof DepartmentNotFoundError) {
      logger.warn('Department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate department', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate department', requestId)
    );
  }
}


/**
 * Delete a department
 * DELETE /admin/departments/{departmentId}
 *
 * Requirement 7.5: Reject deletion if has children or users
 */
export async function deleteDepartmentHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Delete department request received', { requestId });

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

    // Delete department
    const deleted = await departmentService.deleteDepartment(departmentId);

    if (deleted) {
      logger.info('Department deleted successfully', { requestId, departmentId });
      return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
    }

    // Should not reach here if department exists
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete department', requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof DepartmentNotFoundError) {
      logger.warn('Department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof DepartmentHasDependenciesError) {
      logger.warn('Department has dependencies', {
        requestId,
        error: err.message,
        childCount: err.childCount,
        userCount: err.userCount,
      });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to delete department', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete department', requestId)
    );
  }
}


/**
 * List departments with pagination and filters
 * GET /admin/departments
 *
 * Requirement 7.2: Return all departments with their hierarchy level and child count
 */
export async function listDepartmentsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List departments request received', { requestId });

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

    // Validate parentDepartmentId if provided
    if (queryParams['parentDepartmentId']) {
      const uuidError = validateUUID(queryParams['parentDepartmentId'], 'parentDepartmentId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Parse filters
    const filters = parseListFilters(queryParams);

    // List departments
    const result = await departmentService.listDepartments(filters, { page, limit });

    logger.info('Departments listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list departments', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list departments', requestId)
    );
  }
}


/**
 * Check if department code is unique
 * GET /admin/departments/check-code
 *
 * Used for form validation before submission
 */
export async function checkDepartmentCodeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check department code request received', { requestId });

  try {
    // Get department code from query parameters
    const code = event.queryStringParameters?.['code'];
    if (!code) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'code query parameter is required', requestId)
      );
    }

    // Get optional exclude department ID (for updates)
    const excludeDepartmentId = event.queryStringParameters?.['excludeDepartmentId'];
    if (excludeDepartmentId) {
      const uuidError = validateUUID(excludeDepartmentId, 'excludeDepartmentId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
    }

    // Check uniqueness
    const isUnique = await departmentService.isDepartmentCodeUnique(code, excludeDepartmentId);

    logger.info('Department code check completed', {
      requestId,
      code,
      isUnique,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ code, isUnique }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check department code', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check department code', requestId)
    );
  }
}


/**
 * Get department hierarchy path
 * GET /admin/departments/{departmentId}/hierarchy
 *
 * Returns the path from root to the specified department
 */
export async function getDepartmentHierarchyHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get department hierarchy request received', { requestId });

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

    // Get hierarchy
    const hierarchy = await departmentService.getDepartmentHierarchy(departmentId);

    if (hierarchy.length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Department not found: ${departmentId}`, requestId)
      );
    }

    logger.info('Department hierarchy retrieved successfully', {
      requestId,
      departmentId,
      hierarchyDepth: hierarchy.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ hierarchy }, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get department hierarchy', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get department hierarchy', requestId)
    );
  }
}


/**
 * Get root departments (departments with no parent)
 * GET /admin/departments/roots
 *
 * Returns all top-level departments for building hierarchical views
 */
export async function getRootDepartmentsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get root departments request received', { requestId });

  try {
    const departments = await departmentService.getRootDepartments();

    logger.info('Root departments retrieved successfully', {
      requestId,
      count: departments.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ departments }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get root departments', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get root departments', requestId)
    );
  }
}

/**
 * Get active departments (for dropdowns/selectors)
 * GET /admin/departments/active
 */
export async function getActiveDepartmentsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get active departments request received', { requestId });

  try {
    const departments = await departmentService.getActiveDepartments();

    logger.info('Active departments retrieved successfully', {
      requestId,
      count: departments.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ departments }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get active departments', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get active departments', requestId)
    );
  }
}


// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Unified department handler - routes requests to appropriate handler functions
 * based on HTTP method and path.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const departmentId = event.pathParameters?.['departmentId'];

  logger.info('Department handler request', { method, path, departmentId });

  // Route based on method and path
  if (method === 'GET') {
    // check path-specific routes first
    if (path.endsWith('/hierarchy')) {
      return getDepartmentHierarchyHandler(event);
    }
    if (path.endsWith('/children')) {
      return getDepartmentsByParentHandler(event);
    }
    if (path.endsWith('/roots') || path.includes('/roots')) {
      return getRootDepartmentsHandler(event);
    }
    if (path.endsWith('/active') || path.includes('/active')) {
      return getActiveDepartmentsHandler(event);
    }
    if (path.endsWith('/check-code') || path.includes('check-code')) {
      return checkDepartmentCodeHandler(event);
    }
    if (departmentId) {
      return getDepartmentHandler(event);
    }
    return listDepartmentsHandler(event);
  }

  if (method === 'POST') {
    if (path.endsWith('/deactivate')) {
      return deactivateDepartmentHandler(event);
    }
    return createDepartmentHandler(event);
  }

  if (method === 'PUT' && departmentId) {
    return updateDepartmentHandler(event);
  }

  if (method === 'DELETE' && departmentId) {
    return deleteDepartmentHandler(event);
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
