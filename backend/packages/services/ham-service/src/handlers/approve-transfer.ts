/**
 * Approve Transfer Lambda Handler
 *
 * Approves or rejects a transfer order as part of the approval workflow.
 * Requirement 3.10: Process asset movements between stockrooms with approval workflows
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { ApproveTransferRequest, RejectTransferRequest } from '../transfer/transfer-service';
import * as transferService from '../transfer/transfer-service';

const logger = createLogger({ service: 'approve-transfer-handler' });

/**
 * Validate approve request body
 */
function validateApproveRequest(body: unknown): { valid: true; data: Omit<ApproveTransferRequest, 'approvedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    // Body is optional for approval - can approve without additional data
    return { valid: true, data: {} };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

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
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Validate reject request body
 */
function validateRejectRequest(body: unknown): { valid: true; data: Omit<RejectTransferRequest, 'rejectedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required for rejection'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate rejectionReason (required for rejection)
  if (!request['rejectionReason']) {
    errors.push('rejectionReason is required');
  } else if (typeof request['rejectionReason'] !== 'string') {
    errors.push('rejectionReason must be a string');
  } else if ((request['rejectionReason'] as string).trim().length === 0) {
    errors.push('rejectionReason cannot be empty');
  } else if ((request['rejectionReason'] as string).length > 2000) {
    errors.push('rejectionReason exceeds maximum length of 2000 characters');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      rejectionReason: request['rejectionReason'] as string,
    },
  };
}

/**
 * Lambda handler for approving a transfer order
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const claims = event.requestContext.authorizer?.['claims'] as Record<string, string> | undefined;
  const authSub = claims?.['sub'];
  const userId =
    (await resolveUserIdFromAuthId(authSub)) ??
    (await ensureUserIdFromAuthClaims({
      sub: authSub ?? '',
      email: claims?.['email'],
      givenName: claims?.['given_name'],
      familyName: claims?.['family_name'],
    }));

  // Get transferId from path parameters
  const transferId = event.pathParameters?.['transferId'];

  // Determine action from query parameters or path
  const action = event.queryStringParameters?.['action'] ?? 'approve';

  logger.info('Approve/reject transfer request received', { requestId, transferId, action });

  try {
    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.USER_NOT_PROVISIONED, 'User is not provisioned in the application', requestId)
      );
    }

    // Validate transferId
    if (!transferId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'transferId is required in path', requestId)
      );
    }

    const transferIdError = validateUUID(transferId, 'transferId');
    if (transferIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, transferIdError.message, requestId)
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

    // Handle approval or rejection based on action
    if (action === 'reject') {
      // Validate rejection request
      const validation = validateRejectRequest(body);
      if (!validation.valid) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'Validation failed',
            requestId,
            validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
          )
        );
      }

      // Reject the transfer
      const rejectRequest: RejectTransferRequest = {
        ...validation.data,
        rejectedBy: userId,
      };

      const result = await transferService.rejectTransfer(transferId, rejectRequest);

      logger.info('Transfer order rejected', {
        requestId,
        transferId: result.transfer.transferId,
        transferNumber: result.transfer.transferNumber,
        rejectedBy: userId,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(result, requestId)
      );
    } else {
      // Validate approval request
      const validation = validateApproveRequest(body);
      if (!validation.valid) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'Validation failed',
            requestId,
            validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
          )
        );
      }

      // Approve the transfer
      const approveRequest: ApproveTransferRequest = {
        ...validation.data,
        approvedBy: userId,
      };

      const result = await transferService.approveTransfer(transferId, approveRequest);

      logger.info('Transfer order approved', {
        requestId,
        transferId: result.transfer.transferId,
        transferNumber: result.transfer.transferNumber,
        approvedBy: userId,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(result, requestId)
      );
    }
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to approve/reject transfer', err, { requestId, transferId, action });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot approve') || err.message.includes('Cannot reject')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to process transfer approval', requestId)
    );
  }
}

