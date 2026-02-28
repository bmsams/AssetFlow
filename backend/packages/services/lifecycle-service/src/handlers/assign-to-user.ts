/**
 * Assign To User Lambda Handler
 *
 * Assigns or reassigns an asset to a user.
 * Requirement 6.6: Assign the asset to a user
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { AssignToUserInput } from '../deployment/deployment-service';
import * as deploymentService from '../deployment/deployment-service';

const logger = createLogger({ service: 'assign-to-user-handler' });

/**
 * Validate assign to user request body
 */
function validateRequest(body: unknown, pathAssetId?: string): {
  valid: true;
  data: Omit<AssignToUserInput, 'assignedBy'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Get assetId from path parameter or body
  let assetId: string | undefined;
  if (pathAssetId) {
    const uuidError = validateUUID(pathAssetId, 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      assetId = pathAssetId;
    }
  } else if (request['assetId']) {
    if (typeof request['assetId'] !== 'string') {
      errors.push('assetId must be a string');
    } else {
      const uuidError = validateUUID(request['assetId'] as string, 'assetId');
      if (uuidError) {
        errors.push(uuidError.message);
      } else {
        assetId = request['assetId'] as string;
      }
    }
  } else {
    errors.push('assetId is required');
  }

  // Validate newUserId (required) - can also be called userId
  const newUserId = request['newUserId'] ?? request['userId'];
  if (!newUserId) {
    errors.push('newUserId (or userId) is required');
  } else if (typeof newUserId !== 'string') {
    errors.push('newUserId must be a string');
  } else {
    const uuidError = validateUUID(newUserId as string, 'newUserId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['assignedByName', 'location', 'department', 'costCenter', 'notes'];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId: assetId!,
      newUserId: newUserId as string,
      assignedByName: request['assignedByName'] as string | undefined,
      location: request['location'] as string | undefined,
      department: request['department'] as string | undefined,
      costCenter: request['costCenter'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for assigning an asset to a user
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;
  const pathAssetId = event.pathParameters?.['assetId'];

  logger.info('Assign to user request received', { requestId, pathAssetId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
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
    const validation = validateRequest(body, pathAssetId);
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

    // Assign the asset to the user
    const input: AssignToUserInput = {
      ...validation.data,
      assignedBy: userId,
    };

    const result = await deploymentService.assignToUser(input);

    logger.info('Asset assigned to user', {
      requestId,
      deploymentId: result.deployment.deploymentId,
      assetId: result.deployment.assetId,
      newUserId: result.deployment.assignedToUserId,
      previousUserId: result.previousAssignment?.assignedToUserId ?? null,
      isReassignment: result.previousAssignment !== null,
    });

    // Return 200 for reassignment, 201 for new assignment
    const statusCode = result.previousAssignment ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;

    return createLambdaResponse(statusCode, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to assign asset to user', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (
      err.message.includes('cannot be deployed') ||
      err.message.includes('Must be one of') ||
      err.message.includes('is required') ||
      err.message.includes('must be')
    ) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to assign asset to user', requestId)
    );
  }
}
