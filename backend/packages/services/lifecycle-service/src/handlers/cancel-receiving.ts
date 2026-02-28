/**
 * Cancel Receiving Lambda Handler
 *
 * Cancels a receiving record that has not been completed.
 * Requirement 21: Receiving API Integration - POST /lifecycle/receiving/{receivingId}/cancel
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

import * as receivingService from '../receiving/receiving-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'cancel-receiving-handler' });

/**
 * Lambda handler for cancelling a receiving record
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Cancel receiving request received', { requestId });

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

    // Get receivingId from path parameters
    const receivingId = event.pathParameters?.['receivingId'];
    if (!receivingId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'receivingId is required', requestId)
      );
    }

    // Validate UUID format
    const uuidError = validateUUID(receivingId, 'receivingId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse optional reason from body
    let reason: string | undefined;
    if (event.body) {
      try {
        const body = JSON.parse(event.body) as Record<string, unknown>;
        if (body['reason'] !== undefined && body['reason'] !== null) {
          if (typeof body['reason'] !== 'string') {
            return createLambdaResponse(
              HTTP_STATUS.BAD_REQUEST,
              createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'reason must be a string', requestId)
            );
          }
          reason = body['reason'];
        }
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Cancel the receiving record
    const updatedRecord = await receivingService.cancelReceiving(receivingId, userId, reason);

    // Get the full receiving record with lines for response
    const result = await receivingService.getReceivingRecord(receivingId);
    if (!result) {
      // This shouldn't happen since we just updated it, but handle gracefully
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to retrieve updated receiving record', requestId)
      );
    }

    logger.info('Receiving cancelled', {
      requestId,
      receivingId: updatedRecord.receivingId,
      status: updatedRecord.status,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to cancel receiving', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (
      err.message.includes('Cannot cancel') ||
      err.message.includes('already cancelled') ||
      err.message.includes('completed') ||
      err.message.includes('assets already received')
    ) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel receiving', requestId)
    );
  }
}
