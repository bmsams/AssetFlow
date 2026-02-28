/**
 * Initiate Reclamation Lambda Handler
 *
 * Initiates the reclamation workflow for identified candidates, triggering
 * notifications and approval workflows as configured.
 *
 * Requirements: 4.7
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

import * as reclamationService from '../reclamation/reclamation-service';

const logger = createLogger({ service: 'initiate-reclamation-handler' });

/**
 * Request body for initiating reclamation
 */
interface InitiateReclamationRequest {
  readonly candidateId: string;
  readonly skipNotification?: boolean;
  readonly skipApproval?: boolean;
  readonly actionType?: 'UNINSTALL' | 'DISABLE' | 'REVOKE_LICENSE' | 'REASSIGN';
  readonly scheduledDate?: string;
  readonly notes?: string;
}

/**
 * Request body for approving reclamation
 */
interface ApproveReclamationRequest {
  readonly notes?: string;
}

/**
 * Request body for rejecting reclamation
 */
interface RejectReclamationRequest {
  readonly reason: string;
}

/**
 * Request body for completing reclamation
 */
interface CompleteReclamationRequest {
  readonly actionResult: string;
  readonly licenseRecovered: boolean;
  readonly entitlementId?: string;
}

/**
 * Request body for cancelling reclamation
 */
interface CancelReclamationRequest {
  readonly reason: string;
}

/**
 * Validate action type
 */
function isValidActionType(
  type: string | undefined
): type is 'UNINSTALL' | 'DISABLE' | 'REVOKE_LICENSE' | 'REASSIGN' {
  if (!type) return true; // Optional, defaults to UNINSTALL
  return ['UNINSTALL', 'DISABLE', 'REVOKE_LICENSE', 'REASSIGN'].includes(type);
}

/**
 * Lambda handler for initiating reclamation workflow
 *
 * POST /reclamation/initiate
 * Body: { candidateId: string, skipNotification?: boolean, skipApproval?: boolean, ... }
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Initiate reclamation request received', { requestId });

  try {
    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: InitiateReclamationRequest;
    try {
      request = JSON.parse(event.body) as InitiateReclamationRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate candidateId
    if (!request.candidateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'candidateId is required', requestId)
      );
    }

    const uuidError = validateUUID(request.candidateId, 'candidateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Validate actionType
    if (!isValidActionType(request.actionType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'actionType must be one of: UNINSTALL, DISABLE, REVOKE_LICENSE, REASSIGN',
          requestId
        )
      );
    }

    // Validate scheduledDate if provided
    if (request.scheduledDate) {
      const date = new Date(request.scheduledDate);
      if (isNaN(date.getTime())) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'scheduledDate must be a valid ISO date string',
            requestId
          )
        );
      }
    }

    // Get user ID from authorizer context (if available)
    const authorizer = event.requestContext.authorizer;
    const claims = authorizer?.['claims'] as Record<string, unknown> | undefined;
    const initiatedBy = claims?.['sub'] as string | undefined;

    logger.info('Initiating reclamation workflow', {
      requestId,
      candidateId: request.candidateId,
      actionType: request.actionType,
      skipNotification: request.skipNotification,
      skipApproval: request.skipApproval,
    });

    const result = await reclamationService.initiateReclamation(request.candidateId, {
      skipNotification: request.skipNotification,
      skipApproval: request.skipApproval,
      actionType: request.actionType,
      scheduledDate: request.scheduledDate,
      notes: request.notes,
      initiatedBy,
    });

    logger.info('Reclamation workflow initiated', {
      requestId,
      candidateId: request.candidateId,
      workflowId: result.workflowId,
      status: result.status,
      requiresApproval: result.requiresApproval,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to initiate reclamation', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot initiate')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to initiate reclamation', requestId)
    );
  }
}

/**
 * Lambda handler for approving reclamation
 *
 * POST /reclamation/{candidateId}/approve
 */
export async function approveHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const candidateId = event.pathParameters?.['candidateId'];

  logger.info('Approve reclamation request received', { requestId, candidateId });

  try {
    // Validate candidateId
    if (!candidateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'candidateId is required', requestId)
      );
    }

    const uuidError = validateUUID(candidateId, 'candidateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Parse request body
    let request: ApproveReclamationRequest = {};
    if (event.body) {
      try {
        request = JSON.parse(event.body) as ApproveReclamationRequest;
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Get user ID from authorizer context
    const authorizer = event.requestContext.authorizer;
    const claims = authorizer?.['claims'] as Record<string, unknown> | undefined;
    const approvedBy = claims?.['sub'] as string;
    if (!approvedBy) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User ID not found in token', requestId)
      );
    }

    const result = await reclamationService.approveReclamation(
      candidateId,
      approvedBy,
      request.notes
    );

    logger.info('Reclamation approved', { requestId, candidateId, approvedBy });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to approve reclamation', err, { requestId, candidateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot approve')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to approve reclamation', requestId)
    );
  }
}

/**
 * Lambda handler for rejecting reclamation
 *
 * POST /reclamation/{candidateId}/reject
 */
export async function rejectHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const candidateId = event.pathParameters?.['candidateId'];

  logger.info('Reject reclamation request received', { requestId, candidateId });

  try {
    // Validate candidateId
    if (!candidateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'candidateId is required', requestId)
      );
    }

    const uuidError = validateUUID(candidateId, 'candidateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: RejectReclamationRequest;
    try {
      request = JSON.parse(event.body) as RejectReclamationRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate reason
    if (!request.reason || request.reason.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'reason is required', requestId)
      );
    }

    // Get user ID from authorizer context
    const authorizerReject = event.requestContext.authorizer;
    const claimsReject = authorizerReject?.['claims'] as Record<string, unknown> | undefined;
    const rejectedBy = claimsReject?.['sub'] as string;
    if (!rejectedBy) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User ID not found in token', requestId)
      );
    }

    const result = await reclamationService.rejectReclamation(
      candidateId,
      rejectedBy,
      request.reason
    );

    logger.info('Reclamation rejected', { requestId, candidateId, rejectedBy });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reject reclamation', err, { requestId, candidateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot reject')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reject reclamation', requestId)
    );
  }
}

/**
 * Lambda handler for completing reclamation
 *
 * POST /reclamation/{candidateId}/complete
 */
export async function completeHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const candidateId = event.pathParameters?.['candidateId'];

  logger.info('Complete reclamation request received', { requestId, candidateId });

  try {
    // Validate candidateId
    if (!candidateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'candidateId is required', requestId)
      );
    }

    const uuidError = validateUUID(candidateId, 'candidateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: CompleteReclamationRequest;
    try {
      request = JSON.parse(event.body) as CompleteReclamationRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate required fields
    if (!request.actionResult || request.actionResult.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'actionResult is required', requestId)
      );
    }

    if (typeof request.licenseRecovered !== 'boolean') {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'licenseRecovered must be a boolean',
          requestId
        )
      );
    }

    // Validate entitlementId if provided
    if (request.entitlementId) {
      const entitlementUuidError = validateUUID(request.entitlementId, 'entitlementId');
      if (entitlementUuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, entitlementUuidError.message, requestId)
        );
      }
    }

    const result = await reclamationService.completeReclamation(candidateId, {
      actionResult: request.actionResult,
      licenseRecovered: request.licenseRecovered,
      entitlementId: request.entitlementId,
    });

    logger.info('Reclamation completed', {
      requestId,
      candidateId,
      licenseRecovered: request.licenseRecovered,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to complete reclamation', err, { requestId, candidateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot complete')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to complete reclamation', requestId)
    );
  }
}

/**
 * Lambda handler for cancelling reclamation
 *
 * POST /reclamation/{candidateId}/cancel
 */
export async function cancelHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const candidateId = event.pathParameters?.['candidateId'];

  logger.info('Cancel reclamation request received', { requestId, candidateId });

  try {
    // Validate candidateId
    if (!candidateId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'candidateId is required', requestId)
      );
    }

    const uuidError = validateUUID(candidateId, 'candidateId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: CancelReclamationRequest;
    try {
      request = JSON.parse(event.body) as CancelReclamationRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate reason
    if (!request.reason || request.reason.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'reason is required', requestId)
      );
    }

    const result = await reclamationService.cancelReclamation(candidateId, request.reason);

    logger.info('Reclamation cancelled', { requestId, candidateId });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to cancel reclamation', err, { requestId, candidateId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot cancel')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel reclamation', requestId)
    );
  }
}
