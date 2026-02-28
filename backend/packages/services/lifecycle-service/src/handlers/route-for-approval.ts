/**
 * Route For Approval Lambda Handler
 *
 * Routes a request for approval based on configurable rules.
 * Requirement 6B.4: Route requests based on configurable rules (cost thresholds, item types, requester department)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { RouteForApprovalInput } from '../approval-workflow/approval-workflow-service';
import * as approvalWorkflowService from '../approval-workflow/approval-workflow-service';

const logger = createLogger({ service: 'route-for-approval-handler' });

/**
 * Valid request types
 */
const VALID_REQUEST_TYPES = ['STANDARD', 'URGENT', 'EMERGENCY', 'BULK', 'PROJECT'];

/**
 * Valid priorities
 */
const VALID_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];

/**
 * Validate route for approval request body
 */
function validateRequest(body: unknown): { valid: true; data: Omit<RouteForApprovalInput, 'initiatedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate requestId (required)
  if (!request['requestId']) {
    errors.push('requestId is required');
  } else if (typeof request['requestId'] !== 'string') {
    errors.push('requestId must be a string');
  } else {
    const uuidError = validateUUID(request['requestId'] as string, 'requestId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate requestType (optional, defaults to STANDARD)
  if (request['requestType'] !== undefined && request['requestType'] !== null) {
    if (typeof request['requestType'] !== 'string') {
      errors.push('requestType must be a string');
    } else if (!VALID_REQUEST_TYPES.includes(request['requestType'] as string)) {
      errors.push(`requestType must be one of: ${VALID_REQUEST_TYPES.join(', ')}`);
    }
  }

  // Validate estimatedCost (optional)
  if (request['estimatedCost'] !== undefined && request['estimatedCost'] !== null) {
    if (typeof request['estimatedCost'] !== 'number') {
      errors.push('estimatedCost must be a number');
    } else if (request['estimatedCost'] < 0) {
      errors.push('estimatedCost cannot be negative');
    }
  }

  // Validate priority (optional)
  if (request['priority'] !== undefined && request['priority'] !== null) {
    if (typeof request['priority'] !== 'string') {
      errors.push('priority must be a string');
    } else if (!VALID_PRIORITIES.includes(request['priority'] as string)) {
      errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['requesterDepartment', 'itemType'];
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
      requestId: request['requestId'] as string,
      requestType: (request['requestType'] as string) ?? 'STANDARD',
      estimatedCost: request['estimatedCost'] as number | undefined,
      requesterDepartment: request['requesterDepartment'] as string | undefined,
      itemType: request['itemType'] as string | undefined,
      priority: request['priority'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for routing a request for approval
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Route for approval request received', { lambdaRequestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', lambdaRequestId)
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', lambdaRequestId)
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          lambdaRequestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Create the route for approval input
    const routeInput: RouteForApprovalInput = {
      ...validation.data,
      initiatedBy: userId,
    };

    // Route the request for approval
    const result = await approvalWorkflowService.routeForApproval(routeInput);

    logger.info('Request routed for approval', {
      lambdaRequestId,
      requestId: routeInput.requestId,
      workflowId: result.workflow.workflowId,
      approverCount: result.approverCount,
      levelCount: result.levelCount,
      matchedRuleCount: result.matchedRules.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, lambdaRequestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to route request for approval', err, { lambdaRequestId });

    // Handle specific errors
    if (err.message.includes('already exists')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, lambdaRequestId)
      );
    }

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, lambdaRequestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to route request for approval', lambdaRequestId)
    );
  }
}

