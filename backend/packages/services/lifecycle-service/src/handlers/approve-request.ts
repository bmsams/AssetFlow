/**
 * Approve Request Lambda Handler
 *
 * Approves a request in the approval workflow.
 * Requirement 6B.5: Notify approvers and track approval status
 * Requirement 6B.6: Support multi-level approvals and delegation
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ApproveRequestInput, DelegateApprovalInput } from '../approval-workflow/approval-workflow-service';
import * as approvalWorkflowService from '../approval-workflow/approval-workflow-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'approve-request-handler' });

/**
 * Validate approve request body
 */
function validateApproveRequest(body: unknown): { valid: true; data: Omit<ApproveRequestInput, 'approverId'> } | { valid: false; errors: string[] } {
  // Body is optional for approval - can approve without additional data
  if (!body || typeof body !== 'object') {
    return { valid: true, data: {} };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate approverName (optional)
  if (request['approverName'] !== undefined && request['approverName'] !== null) {
    if (typeof request['approverName'] !== 'string') {
      errors.push('approverName must be a string');
    }
  }

  // Validate reason (optional)
  if (request['reason'] !== undefined && request['reason'] !== null) {
    if (typeof request['reason'] !== 'string') {
      errors.push('reason must be a string');
    } else if ((request['reason'] as string).length > 2000) {
      errors.push('reason exceeds maximum length of 2000 characters');
    }
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
      approverName: request['approverName'] as string | undefined,
      reason: request['reason'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Validate delegate request body
 */
function validateDelegateRequest(body: unknown): { valid: true; data: Omit<DelegateApprovalInput, 'delegatedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required for delegation'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate delegatedTo (required)
  if (!request['delegatedTo']) {
    errors.push('delegatedTo is required');
  } else if (typeof request['delegatedTo'] !== 'string') {
    errors.push('delegatedTo must be a string');
  } else {
    const uuidError = validateUUID(request['delegatedTo'] as string, 'delegatedTo');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate reason (required)
  if (!request['reason']) {
    errors.push('reason is required for delegation');
  } else if (typeof request['reason'] !== 'string') {
    errors.push('reason must be a string');
  } else if ((request['reason'] as string).trim().length === 0) {
    errors.push('reason cannot be empty');
  } else if ((request['reason'] as string).length > 2000) {
    errors.push('reason exceeds maximum length of 2000 characters');
  }

  // Validate optional string fields
  const optionalStringFields = ['delegatedToName', 'delegatedToEmail'];
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
      delegatedTo: request['delegatedTo'] as string,
      delegatedToName: request['delegatedToName'] as string | undefined,
      delegatedToEmail: request['delegatedToEmail'] as string | undefined,
      reason: request['reason'] as string,
    },
  };
}

/**
 * Lambda handler for approving a request
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const lambdaRequestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  // Get requestId from path parameters
  const requestId = event.pathParameters?.['requestId'];

  // Determine action from query parameters
  const action = event.queryStringParameters?.['action'] ?? 'approve';

  logger.info('Approve/delegate request received', { lambdaRequestId, requestId, action });

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

    // Handle delegation
    if (action === 'delegate') {
      const validation = validateDelegateRequest(body);
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

      const delegateInput: DelegateApprovalInput = {
        ...validation.data,
        delegatedBy: userId,
      };

      const result = await approvalWorkflowService.delegateApproval(requestId, delegateInput);

      logger.info('Request approval delegated', {
        lambdaRequestId,
        requestId,
        workflowId: result.workflow.workflowId,
        delegatedBy: userId,
        delegatedTo: delegateInput.delegatedTo,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(result, lambdaRequestId)
      );
    }

    // Handle approval
    const validation = validateApproveRequest(body);
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

    const approveInput: ApproveRequestInput = {
      ...validation.data,
      approverId: userId,
    };

    const result = await approvalWorkflowService.approveRequest(requestId, approveInput);

    logger.info('Request approved', {
      lambdaRequestId,
      requestId,
      workflowId: result.workflow.workflowId,
      stepLevel: result.step.stepLevel,
      isComplete: result.isComplete,
      approverId: userId,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, lambdaRequestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to approve/delegate request', err, { lambdaRequestId, requestId, action });

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

    if (errorMessage.includes('cannot approve') || errorMessage.includes('cannot delegate') || errorMessage.includes('workflow status')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, lambdaRequestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to process approval', lambdaRequestId)
    );
  }
}

