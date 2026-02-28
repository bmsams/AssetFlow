/**
 * List Segments Lambda Handler
 *
 * Lists segments for a linear asset with pagination support.
 * Requirement 5.3: Segment-based location tracking
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as linearAssetService from '../linear-asset';

const logger = createLogger({ service: 'list-segments-handler' });

/**
 * Lambda handler for listing segments
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const linearAssetId = event.pathParameters?.['linearAssetId'];

  // Parse pagination parameters
  const page = parseInt(event.queryStringParameters?.['page'] ?? '1', 10);
  const limit = parseInt(event.queryStringParameters?.['limit'] ?? '50', 10);

  logger.info('List segments request received', { requestId, linearAssetId, page, limit });

  try {
    // Validate linear asset ID
    if (!linearAssetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'linearAssetId is required', requestId)
      );
    }

    const uuidError = validateUUID(linearAssetId, 'linearAssetId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Verify linear asset exists
    const linearAsset = await linearAssetService.getLinearAsset(linearAssetId);
    if (!linearAsset) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Linear asset not found', requestId)
      );
    }

    // Get segments with pagination
    const result = await linearAssetService.getSegments(linearAssetId, { page, limit });

    logger.info('Segments listed successfully', {
      requestId,
      linearAssetId,
      total: result.total,
      returned: result.items.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list segments', err, { requestId, linearAssetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list segments', requestId)
    );
  }
}

/**
 * Lambda handler for getting segment condition summary
 */
export async function handlerConditionSummary(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const linearAssetId = event.pathParameters?.['linearAssetId'];

  logger.info('Get segment condition summary request received', { requestId, linearAssetId });

  try {
    // Validate linear asset ID
    if (!linearAssetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'linearAssetId is required', requestId)
      );
    }

    const uuidError = validateUUID(linearAssetId, 'linearAssetId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Verify linear asset exists
    const linearAsset = await linearAssetService.getLinearAsset(linearAssetId);
    if (!linearAsset) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Linear asset not found', requestId)
      );
    }

    // Get condition summary
    const summary = await linearAssetService.getSegmentConditionSummary(linearAssetId);

    logger.info('Segment condition summary retrieved successfully', {
      requestId,
      linearAssetId,
      totalSegments: summary.totalSegments,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(summary, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get segment condition summary', err, { requestId, linearAssetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get segment condition summary', requestId)
    );
  }
}
