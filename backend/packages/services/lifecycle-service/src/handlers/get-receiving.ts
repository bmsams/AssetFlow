/**
 * Get Receiving Lambda Handler
 *
 * Retrieves a receiving record by ID with all its lines.
 * Requirement 21: Receiving API Integration - GET /lifecycle/receiving/{receivingId}
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

const logger = createLogger({ service: 'get-receiving-handler' });

/**
 * Lambda handler for getting a receiving record
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get receiving request received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
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

    // Get the receiving record
    const result = await receivingService.getReceivingRecord(receivingId);

    if (!result) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Receiving record not found: ${receivingId}`, requestId)
      );
    }

    logger.info('Receiving record retrieved', {
      requestId,
      receivingId: result.receivingRecord.receivingId,
      lineCount: result.lines.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get receiving record', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get receiving record', requestId)
    );
  }
}
