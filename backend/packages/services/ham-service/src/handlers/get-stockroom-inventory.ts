/**
 * Get Stockroom Inventory Lambda Handler
 *
 * Retrieves inventory for a specific stockroom with pagination support.
 * Requirement 3.2: Track inventory quantities, locations, and stock levels
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as stockroomService from '../stockroom/stockroom-service';

const logger = createLogger({ service: 'get-stockroom-inventory-handler' });

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(queryParams: Record<string, string | undefined> | null): {
  page: number;
  limit: number;
  includeInactive: boolean;
} {
  const page = parseInt(queryParams?.['page'] ?? '1', 10);
  const limit = parseInt(queryParams?.['limit'] ?? '50', 10);
  const includeInactive = queryParams?.['includeInactive'] === 'true';

  return {
    page: isNaN(page) || page < 1 ? 1 : page,
    limit: isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 100),
    includeInactive,
  };
}

/**
 * Lambda handler for getting stockroom inventory
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const stockroomId = event.pathParameters?.['stockroomId'];

  logger.info('Get stockroom inventory request received', { requestId, stockroomId });

  try {
    // Validate stockroom ID
    if (!stockroomId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Stockroom ID is required', requestId)
      );
    }

    const uuidError = validateUUID(stockroomId, 'stockroomId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Parse pagination parameters
    const { page, limit, includeInactive } = parsePaginationParams(event.queryStringParameters);

    // Get stockroom inventory
    const result = await stockroomService.getStockroomInventory(
      stockroomId,
      { page, limit },
      includeInactive
    );

    logger.info('Stockroom inventory retrieved successfully', {
      requestId,
      stockroomId,
      itemCount: result.items.length,
      total: result.total,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get stockroom inventory', err, { requestId, stockroomId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get stockroom inventory', requestId)
    );
  }
}
