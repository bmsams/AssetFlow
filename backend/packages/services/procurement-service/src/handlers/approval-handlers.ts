/**
 * Approval Handlers
 *
 * Lambda handlers for purchase order approval workflow endpoints.
 *
 * Requirements: 17.1-17.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { CreateDelegationRequest } from '../approval/approval-service';
import * as approvalService from '../approval/approval-service';

const logger = createLogger({ service: 'approval-handlers' });

async function getUserContext(
  event: APIGatewayProxyEvent
): Promise<{ authSub?: string; userId?: string }> {
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
  return { authSub, userId };
}

/**
 * Get pending approvals for current user
 * GET /approvals/pending
 */
export async function getPendingApprovalsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Get pending approvals request', { requestId });

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

    const pendingApprovals = await approvalService.getPendingApprovalsForUser(userId);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items: pendingApprovals, total: pendingApprovals.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get pending approvals', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get pending approvals', requestId)
    );
  }
}

/**
 * Get approval thresholds
 * GET /approvals/thresholds
 */
export async function getApprovalThresholdsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get approval thresholds request', { requestId });

  try {
    const thresholds = await approvalService.getApprovalThresholds();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items: thresholds, total: thresholds.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get approval thresholds', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get approval thresholds', requestId)
    );
  }
}

/**
 * Get approval history for a PO
 * GET /approvals/history/:poId
 */
export async function getApprovalHistoryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('Get approval history request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    const uuidError = validateUUID(poId, 'poId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const history = await approvalService.getApprovalHistory(poId);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items: history, total: history.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get approval history', err, { requestId, poId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get approval history', requestId)
    );
  }
}


/**
 * Create approval delegation
 * POST /approvals/delegations
 */
export async function createDelegationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Create delegation request', { requestId });

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
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const errors: string[] = [];

    if (!body['delegateId']) {
      errors.push('delegateId is required');
    } else {
      const uuidError = validateUUID(body['delegateId'] as string, 'delegateId');
      if (uuidError) errors.push(uuidError.message);
    }

    if (!body['startDate']) {
      errors.push('startDate is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body['startDate'] as string)) {
      errors.push('startDate must be in YYYY-MM-DD format');
    }

    if (!body['endDate']) {
      errors.push('endDate is required');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(body['endDate'] as string)) {
      errors.push('endDate must be in YYYY-MM-DD format');
    }

    if (errors.length > 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Validation failed', requestId,
          errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' })))
      );
    }

    const request: CreateDelegationRequest = {
      delegatorId: userId,
      delegateId: body['delegateId'] as string,
      startDate: body['startDate'] as string,
      endDate: body['endDate'] as string,
    };

    const delegation = await approvalService.createDelegation(request);

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(delegation, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create delegation', err, { requestId });

    if (err.message.includes('already has an active delegation') || err.message.includes('End date must be after')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create delegation', requestId)
    );
  }
}

/**
 * Get delegations for current user (as delegate)
 * GET /approvals/delegations
 */
export async function getDelegationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Get delegations request', { requestId });

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
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    const delegations = await approvalService.getDelegationsForDelegate(userId);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items: delegations, total: delegations.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get delegations', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get delegations', requestId)
    );
  }
}

/**
 * Deactivate a delegation
 * DELETE /approvals/delegations/:delegationId
 */
export async function deactivateDelegationHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const delegationId = event.pathParameters?.['delegationId'];

  logger.info('Deactivate delegation request', { requestId, delegationId });

  try {
    if (!delegationId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Delegation ID is required', requestId)
      );
    }

    const uuidError = validateUUID(delegationId, 'delegationId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const result = await approvalService.deactivateDelegation(delegationId);

    if (!result) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Delegation not found: ${delegationId}`, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ success: true, message: 'Delegation deactivated' }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to deactivate delegation', err, { requestId, delegationId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to deactivate delegation', requestId)
    );
  }
}

/**
 * Send approval reminders
 * POST /approvals/reminders
 */
export async function sendApprovalRemindersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Send approval reminders request', { requestId });

  try {
    const params = event.queryStringParameters ?? {};
    const daysThreshold = parseInt(params['daysThreshold'] ?? '3', 10);

    const result = await approvalService.sendApprovalReminders(daysThreshold);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send approval reminders', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to send approval reminders', requestId)
    );
  }
}

/**
 * Main Lambda handler router for approval endpoints
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('Approval handler request', { method, path });

  if (method === 'GET' && path.endsWith('/pending-approvals')) {
    return getPendingApprovalsHandler(event);
  }

  if (method === 'POST' && path.endsWith('/approve')) {
    // Approve/reject live in po-handlers; return method-not-allowed here
    return createLambdaResponse(
      405,
      createErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        'Approve endpoint is handled by purchase order handler',
        event.requestContext.requestId
      )
    );
  }

  if (method === 'POST' && path.endsWith('/reject')) {
    return createLambdaResponse(
      405,
      createErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        'Reject endpoint is handled by purchase order handler',
        event.requestContext.requestId
      )
    );
  }

  if (method === 'GET' && path.includes('/approvals/thresholds')) {
    return getApprovalThresholdsHandler(event);
  }

  if (method === 'GET' && path.includes('/approvals/history/')) {
    return getApprovalHistoryHandler(event);
  }

  if (method === 'POST' && path.includes('/approvals/delegations')) {
    return createDelegationHandler(event);
  }

  if (method === 'GET' && path.endsWith('/approvals/delegations')) {
    return getDelegationsHandler(event);
  }

  if (method === 'DELETE' && path.includes('/approvals/delegations/')) {
    return deactivateDelegationHandler(event);
  }

  if (method === 'POST' && path.endsWith('/approvals/reminders')) {
    return sendApprovalRemindersHandler(event);
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
