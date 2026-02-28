/**
 * Assign Work Order Lambda Handler
 *
 * Assigns a work order to a technician/user.
 * Implements work order status transition from OPEN to ASSIGNED.
 * Requirements: 2C.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'assign-work-order-handler' });

/**
 * Validate assign work order request
 */
function validateRequest(body: unknown): { valid: true; data: { assignedTo: string } } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Required field
  if (!request['assignedTo']) {
    errors.push('assignedTo is required');
  } else {
    const uuidError = validateUUID(request['assignedTo'] as string, 'assignedTo');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assignedTo: request['assignedTo'] as string,
    },
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

  logger.info('Assign work order request received', { requestId });

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

    // Get work order ID from path parameters
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
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
    const validation = validateRequest(body);
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

    // Check if work order exists
    const existingWorkOrder = await maintenanceService.getWorkOrder(workOrderId);
    if (!existingWorkOrder) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Work order not found: ${workOrderId}`, requestId)
      );
    }

    // Validate status transition - can only assign from OPEN or ASSIGNED status
    const validStatusesForAssignment = ['OPEN', 'ASSIGNED'];
    if (!validStatusesForAssignment.includes(existingWorkOrder.status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Cannot assign work order in status ${existingWorkOrder.status}. Work order must be in OPEN or ASSIGNED status.`,
          requestId
        )
      );
    }

    // Assign work order
    const workOrder = await maintenanceService.assignWorkOrder(
      workOrderId,
      validation.data.assignedTo,
      userId
    );

    logger.info('Work order assigned successfully', {
      requestId,
      workOrderId: workOrder.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      assignedTo: workOrder.assignedTo,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to assign work order', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to assign work order', requestId)
    );
  }
}
