/**
 * Complete Receiving Lambda Handler
 *
 * Manually completes a receiving record.
 * Requirement 21: Receiving API Integration - POST /lifecycle/receiving/{receivingId}/complete
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

const logger = createLogger({ service: 'complete-receiving-handler' });

/**
 * Lambda handler for completing a receiving record
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Complete receiving request received', { requestId });

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

    // Parse optional notes from body
    let notes: string | undefined;
    if (event.body) {
      try {
        const body = JSON.parse(event.body) as Record<string, unknown>;
        if (body['notes'] !== undefined && body['notes'] !== null) {
          if (typeof body['notes'] !== 'string') {
            return createLambdaResponse(
              HTTP_STATUS.BAD_REQUEST,
              createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'notes must be a string', requestId)
            );
          }
          notes = body['notes'];
        }
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Complete the receiving record
    const updatedRecord = await receivingService.completeReceiving(receivingId, userId, notes);

    // Get the full receiving record with lines for response
    const result = await receivingService.getReceivingRecord(receivingId);
    if (!result) {
      // This shouldn't happen since we just updated it, but handle gracefully
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to retrieve updated receiving record', requestId)
      );
    }

    logger.info('Receiving completed', {
      requestId,
      receivingId: updatedRecord.receivingId,
      status: updatedRecord.status,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to complete receiving', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot complete') || err.message.includes('cancelled')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to complete receiving', requestId)
    );
  }
}
