/**
 * User Admin Handlers - Lambda handlers for User Administration operations
 *
 * Implements HTTP endpoints for:
 * - GET /admin/users - List users with pagination and filters
 * - GET /admin/users/{userId} - Get user by ID
 * - PUT /admin/users/{userId} - Update user details (department, manager)
 * - POST /admin/users/{userId}/deactivate - Deactivate a user
 * - POST /admin/users/{userId}/reactivate - Reactivate a user
 * - GET /admin/users/{userId}/roles - Get user's role assignments
 * - POST /admin/users/{userId}/roles - Assign a role to user
 * - DELETE /admin/users/{userId}/roles/{roleId} - Remove a role from user
 * - GET /admin/roles - Get all available roles
 * - GET /admin/users/search?q={term} - Search users
 *
 * Requirement 12: User Administration
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { UUID } from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { UpdateUserRequest, UserListFilters } from '../user-admin/user-admin-service';
import * as userAdminService from '../user-admin/user-admin-service';
import {
  DepartmentNotFoundError,
  ManagerNotFoundError,
  RoleAlreadyAssignedError,
  RoleNotAssignedError,
  RoleNotFoundError,
  SelfManagerError,
  UserNotFoundError,
} from '../user-admin/user-admin-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'user-admin-handlers' });


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
 * Validate update user request
 * Requirement 12.3: Update user department or manager assignment
 */
function validateUpdateUserRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Check if at least one field is provided
  const updateFields = ['firstName', 'lastName', 'departmentId', 'managerId'];
  const hasUpdateField = updateFields.some((field) => request[field] !== undefined);
  if (!hasUpdateField) {
    errors.push('At least one field must be provided for update');
  }

  // Validate firstName if provided
  if (request['firstName'] !== undefined && request['firstName'] !== null) {
    if (typeof request['firstName'] !== 'string') {
      errors.push('firstName must be a string');
    } else if (request['firstName'].length > 100) {
      errors.push('firstName must be at most 100 characters');
    }
  }

  // Validate lastName if provided
  if (request['lastName'] !== undefined && request['lastName'] !== null) {
    if (typeof request['lastName'] !== 'string') {
      errors.push('lastName must be a string');
    } else if (request['lastName'].length > 100) {
      errors.push('lastName must be at most 100 characters');
    }
  }

  // Validate departmentId if provided
  if (request['departmentId'] !== undefined && request['departmentId'] !== null) {
    if (typeof request['departmentId'] !== 'string') {
      errors.push('departmentId must be a string');
    } else {
      const uuidError = validateUUID(request['departmentId'] as string, 'departmentId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate managerId if provided
  if (request['managerId'] !== undefined && request['managerId'] !== null) {
    if (typeof request['managerId'] !== 'string') {
      errors.push('managerId must be a string');
    } else {
      const uuidError = validateUUID(request['managerId'] as string, 'managerId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}


/**
 * Validate assign role request
 * Requirement 12.6: Assign a role to a user
 */
function validateAssignRoleRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;

  // Required: roleId
  if (!request['roleId'] || typeof request['roleId'] !== 'string') {
    errors.push('roleId is required and must be a string');
  } else {
    const uuidError = validateUUID(request['roleId'] as string, 'roleId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse list filters from query parameters
 */
function parseListFilters(queryParams: Record<string, string | undefined>): UserListFilters {
  const result: UserListFilters = {};

  if (queryParams['departmentId']) {
    Object.assign(result, { departmentId: queryParams['departmentId'] });
  }
  if (queryParams['managerId']) {
    Object.assign(result, { managerId: queryParams['managerId'] });
  }
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
 * List users with pagination and filters
 * GET /admin/users
 *
 * Requirement 12.1: Return paginated list of users matching filter criteria
 */
export async function listUsersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List users request received', { requestId });

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

    // List users
    const result = await userAdminService.listUsers(filters, { page, limit });

    logger.info('Users listed successfully', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list users', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list users', requestId)
    );
  }
}


/**
 * Get user by ID
 * GET /admin/users/{userId}
 *
 * Requirement 12.2: Return user details including department, manager, and assigned roles
 */
export async function getUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get user request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get user
    const user = await userAdminService.getUser(userId);

    if (!user) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `User not found: ${userId}`, requestId)
      );
    }

    logger.info('User retrieved successfully', {
      requestId,
      userId: user.userId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(user, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get user', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get user', requestId)
    );
  }
}


/**
 * Update user details
 * PUT /admin/users/{userId}
 *
 * Requirement 12.3: Update user department or manager assignment and log the change
 */
export async function updateUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId: currentUserId } = await getUserContext(event);

  logger.info('Update user request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
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
    const validation = validateUpdateUserRequest(body);
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

    const request = body as UpdateUserRequest;

    // Update user
    const user = await userAdminService.updateUser(userId, request, currentUserId);

    logger.info('User updated successfully', {
      requestId,
      userId: user.userId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(user, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof DepartmentNotFoundError) {
      logger.warn('Department not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    if (err instanceof ManagerNotFoundError) {
      logger.warn('Manager not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    if (err instanceof SelfManagerError) {
      logger.warn('Self manager error', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to update user', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update user', requestId)
    );
  }
}


/**
 * Deactivate a user
 * POST /admin/users/{userId}/deactivate
 *
 * Requirement 12.4: Mark user as inactive and revoke active sessions
 */
export async function deactivateUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId: currentUserId } = await getUserContext(event);

  logger.info('Deactivate user request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Deactivate user
    const user = await userAdminService.deactivateUser(userId, currentUserId);

    logger.info('User deactivated successfully', {
      requestId,
      userId: user.userId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(user, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to deactivate user', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate user', requestId)
    );
  }
}


/**
 * Reactivate a user
 * POST /admin/users/{userId}/reactivate
 *
 * Requirement 12.5: Mark user as active and restore previous role assignments
 */
export async function reactivateUserHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId: currentUserId } = await getUserContext(event);

  logger.info('Reactivate user request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Reactivate user
    const user = await userAdminService.reactivateUser(userId, currentUserId);

    logger.info('User reactivated successfully', {
      requestId,
      userId: user.userId,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(user, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to reactivate user', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reactivate user', requestId)
    );
  }
}


/**
 * Get user's role assignments
 * GET /admin/users/{userId}/roles
 */
export async function getUserRolesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get user roles request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get user role assignments
    const roles = await userAdminService.getUserRoleAssignments(userId);

    logger.info('User roles retrieved successfully', {
      requestId,
      userId,
      roleCount: roles.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ roles, count: roles.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    logger.error('Failed to get user roles', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get user roles', requestId)
    );
  }
}


/**
 * Assign a role to a user
 * POST /admin/users/{userId}/roles
 *
 * Requirement 12.6: Create role assignment and log the change
 */
export async function assignRoleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId: currentUserId } = await getUserContext(event);

  logger.info('Assign role request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(userId, 'userId');
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
    const validation = validateAssignRoleRequest(body);
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

    const request = body as { roleId: UUID };

    // Assign role
    const assignment = await userAdminService.assignRole(userId, request.roleId, currentUserId);

    logger.info('Role assigned successfully', {
      requestId,
      userId,
      roleId: request.roleId,
      roleName: assignment.roleName,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(assignment, requestId));
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoleNotFoundError) {
      logger.warn('Role not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoleAlreadyAssignedError) {
      logger.warn('Role already assigned', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    logger.error('Failed to assign role', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to assign role', requestId)
    );
  }
}


/**
 * Remove a role from a user
 * DELETE /admin/users/{userId}/roles/{roleId}
 *
 * Requirement 12.7: Delete role assignment and log the change
 */
export async function removeRoleHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { userId: currentUserId } = await getUserContext(event);

  logger.info('Remove role request received', { requestId });

  try {
    // Get user ID from path parameters
    const userId = event.pathParameters?.['userId'];
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'userId is required', requestId)
      );
    }

    // Validate user UUID format
    const userUuidError = validateUUID(userId, 'userId');
    if (userUuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, userUuidError.message, requestId)
      );
    }

    // Get role ID from path parameters
    const roleId = event.pathParameters?.['roleId'];
    if (!roleId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'roleId is required', requestId)
      );
    }

    // Validate role UUID format
    const roleUuidError = validateUUID(roleId, 'roleId');
    if (roleUuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, roleUuidError.message, requestId)
      );
    }

    // Remove role
    await userAdminService.removeRole(userId, roleId, currentUserId);

    logger.info('Role removed successfully', {
      requestId,
      userId,
      roleId,
    });

    return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
  } catch (error) {
    const err = error as Error;

    if (err instanceof UserNotFoundError) {
      logger.warn('User not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoleNotFoundError) {
      logger.warn('Role not found', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err instanceof RoleNotAssignedError) {
      logger.warn('Role not assigned', { requestId, error: err.message });
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to remove role', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to remove role', requestId)
    );
  }
}


/**
 * Get all available roles
 * GET /admin/roles
 */
export async function getAllRolesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get all roles request received', { requestId });

  try {
    // Get all roles
    const roles = await userAdminService.getAllRoles();

    logger.info('Roles retrieved successfully', {
      requestId,
      roleCount: roles.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ roles, count: roles.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get roles', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get roles', requestId)
    );
  }
}


/**
 * Search users by name or email
 * GET /admin/users/search?q={term}
 */
export async function searchUsersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Search users request received', { requestId });

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

    // Search users
    const users = await userAdminService.searchUsers(searchTerm.trim());

    logger.info('Users search completed', {
      requestId,
      searchTerm,
      resultCount: users.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ users, count: users.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to search users', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to search users', requestId)
    );
  }
}

/**
 * Main Lambda handler router for user administration endpoints
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.pathParameters?.['userId'];
  const roleId = event.pathParameters?.['roleId'];

  logger.info('User admin handler request', { method, path, userId, roleId });

  if (method === 'GET' && path.endsWith('/admin/roles')) {
    return getAllRolesHandler(event);
  }

  if (method === 'GET' && path.includes('/admin/users/search')) {
    return searchUsersHandler(event);
  }

  if (method === 'GET' && userId && path.endsWith('/roles')) {
    return getUserRolesHandler(event);
  }

  if (method === 'POST' && userId && path.endsWith('/deactivate')) {
    return deactivateUserHandler(event);
  }

  if (method === 'POST' && userId && path.endsWith('/reactivate')) {
    return reactivateUserHandler(event);
  }

  if (method === 'POST' && userId && path.endsWith('/roles')) {
    return assignRoleHandler(event);
  }

  if (method === 'DELETE' && userId && !!roleId) {
    return removeRoleHandler(event);
  }

  if (method === 'GET' && !!userId) {
    return getUserHandler(event);
  }

  if (method === 'GET') {
    return listUsersHandler(event);
  }

  if (method === 'PUT' && !!userId) {
    return updateUserHandler(event);
  }

  if (method === 'DELETE' && !!userId) {
    return deactivateUserHandler(event);
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
