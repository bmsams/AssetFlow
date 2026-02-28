/**
 * Get Work Order Lambda Handler
 *
 * Retrieves a work order by ID with full details.
 * Requirements: 2C.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'get-work-order-handler' });

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get work order request received', { requestId });

  try {
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

    // Get work order
    const workOrder = await maintenanceService.getWorkOrder(workOrderId);
    if (!workOrder) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Work order not found: ${workOrderId}`, requestId)
      );
    }

    logger.info('Work order retrieved successfully', {
      requestId,
      workOrderId: workOrder.workOrderId,
      workOrderNumber: workOrder.workOrderNumber,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(workOrder, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get work order', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get work order', requestId)
    );
  }
}
