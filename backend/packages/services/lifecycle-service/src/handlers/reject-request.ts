/**
 * Reject Request Lambda Handler
 *
 * Rejects a request in the approval workflow.
 * Requirement 6B.5: Notify approvers and track approval status
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { RejectRequestInput } from '../approval-workflow/approval-workflow-service';
import * as approvalWorkflowService from '../approval-workflow/approval-workflow-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'reject-request-handler' });

/**
 * Validate reject request body
 */
function validateRejectRequest(body: unknown): { valid: true; data: Omit<RejectRequestInput, 'rejectedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required for rejection'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate rejectionReason (required)
  if (!request['rejectionReason']) {
    errors.push('rejectionReason is required');
  } else if (typeof request['rejectionReason'] !== 'string') {
    errors.push('rejectionReason must be a string');
  } else if ((request['rejectionReason'] as string).trim().length === 0) {
    errors.push('rejectionReason cannot be empty');
  } else if ((request['rejectionReason'] as string).length > 2000) {
    errors.push('rejectionReason exceeds maximum length of 2000 characters');
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    } else if ((request['notes'] as string).length > 2000) {
      errors.push('notes exceeds maximum length of 2000 characters');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      rejectionReason: request['rejectionReason'] as string,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for rejecting a request
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  // Get requestId from path parameters
  const requestId = event.pathParameters?.['requestId'];

  logger.info('Reject request received', { lambdaRequestId, requestId });

  try {
    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', lambdaRequestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.USER_NOT_PROVISIONED, 'User is not provisioned in the application', lambdaRequestId)
      );
    }

    // Validate requestId
    if (!requestId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'requestId is required in path', lambdaRequestId)
      );
    }

    const requestIdError = validateUUID(requestId, 'requestId');
    if (requestIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, requestIdError.message, lambdaRequestId)
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

    // Validate rejection request
    const validation = validateRejectRequest(body);
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

    // Create the reject input
    const rejectInput: RejectRequestInput = {
      ...validation.data,
      rejectedBy: userId,
    };

    // Reject the request
    const result = await approvalWorkflowService.rejectRequest(requestId, rejectInput);

    logger.info('Request rejected', {
      lambdaRequestId,
      requestId,
      workflowId: result.workflow.workflowId,
      stepLevel: result.step.stepLevel,
      rejectedBy: userId,
      rejectionReason: rejectInput.rejectionReason,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, lambdaRequestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reject request', err, { lambdaRequestId, requestId });

    // Handle specific errors
    const errorMessage = err.message.toLowerCase();
    if (errorMessage.includes('not found') || errorMessage.includes('no approval workflow found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, lambdaRequestId)
      );
    }

    if (errorMessage.includes('not authorized')) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, err.message, lambdaRequestId)
      );
    }

    if (errorMessage.includes('cannot reject') || errorMessage.includes('workflow status')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, lambdaRequestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reject request', lambdaRequestId)
    );
  }
}

