/**
 * Complete Work Order Lambda Handler
 *
 * Completes a work order with notes, actual duration, and costs.
 * Implements work order status transition to COMPLETED.
 * Requirements: 2C.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { WorkOrderStatus } from '../maintenance/maintenance-service';
import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'complete-work-order-handler' });

/**
 * Work order completion request
 */
interface CompleteWorkOrderRequest {
  readonly completionNotes?: string;
  readonly actualDurationHours?: number;
  readonly actualLaborCost?: number;
  readonly actualPartsCost?: number;
}

/**
 * Valid statuses that can transition to COMPLETED
 */
const VALID_STATUSES_FOR_COMPLETION: WorkOrderStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'PENDING_PARTS',
  'PENDING_APPROVAL',
];

/**
 * Validate complete work order request
 */
function validateRequest(body: unknown): { valid: true; data: CompleteWorkOrderRequest } | { valid: false; errors: string[] } {
  // Body is optional for completion - can complete without notes
  if (body === null || body === undefined) {
    return { valid: true, data: {} };
  }

  if (typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate numeric fields
  if (request['actualDurationHours'] !== undefined) {
    if (typeof request['actualDurationHours'] !== 'number' || request['actualDurationHours'] < 0) {
      errors.push('actualDurationHours must be a non-negative number');
    }
  }

  if (request['actualLaborCost'] !== undefined) {
    if (typeof request['actualLaborCost'] !== 'number' || request['actualLaborCost'] < 0) {
      errors.push('actualLaborCost must be a non-negative number');
    }
  }

  if (request['actualPartsCost'] !== undefined) {
    if (typeof request['actualPartsCost'] !== 'number' || request['actualPartsCost'] < 0) {
      errors.push('actualPartsCost must be a non-negative number');
    }
  }

  // Validate string lengths
  const result = validate()
    .stringLength(request['completionNotes'] as string | undefined, 'completionNotes', 0, 5000)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      completionNotes: request['completionNotes'] as string | undefined,
      actualDurationHours: request['actualDurationHours'] as number | undefined,
      actualLaborCost: request['actualLaborCost'] as number | undefined,
      actualPartsCost: request['actualPartsCost'] as number | undefined,
    },
  };
}

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const claims = event.requestContext.authorizer?.['claims'] as Record<string, string> | undefined;
  const authSub = claims?.['sub'];

  logger.info('Complete work order request received', { requestId });

  try {
    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    const userId =
      (await resolveUserIdFromAuthId(authSub)) ??
      (await ensureUserIdFromAuthClaims({
        sub: authSub,
        email: claims?.['email'],
        givenName: claims?.['given_name'],
        familyName: claims?.['family_name'],
      }));

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(
          API_ERROR_CODES.USER_NOT_PROVISIONED,
          'User is not provisioned in the application',
          requestId
        )
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
    let body: unknown = null;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
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

    // Validate status transition - cannot complete already completed/cancelled/closed work orders
    if (!VALID_STATUSES_FOR_COMPLETION.includes(existingWorkOrder.status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Cannot complete work order in status ${existingWorkOrder.status}. Work order must be in one of: ${VALID_STATUSES_FOR_COMPLETION.join(', ')}`,
          requestId
        )
      );
    }

    // Complete work order
    const workOrder = await maintenanceService.completeWorkOrder(
      workOrderId,
      validation.data.completionNotes ?? null,
      validation.data.actualDurationHours ?? null,
      validation.data.actualLaborCost ?? null,
      validation.data.actualPartsCost ?? null,
      userId
    );

    logger.info('Work order completed successfully', {
      requestId,
      workOrderId: workOrder.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
      completedDate: workOrder.completedDate,
      actualTotalCost: workOrder.actualTotalCost,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to complete work order', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to complete work order', requestId)
    );
  }
}
