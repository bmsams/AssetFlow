/**
 * Get Linear Asset Lambda Handler
 *
 * Retrieves a linear asset by ID with optional segment inclusion.
 * Requirement 5.3: Track assets spanning physical distances with segment-based location tracking
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as linearAssetService from '../linear-asset';

const logger = createLogger({ service: 'get-linear-asset-handler' });

/**
 * Lambda handler for getting a linear asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const linearAssetId = event.pathParameters?.['linearAssetId'];
  const includeSegments = event.queryStringParameters?.['includeSegments'] === 'true';

  logger.info('Get linear asset request received', { requestId, linearAssetId, includeSegments });

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

    // Get linear asset
    let result;
    if (includeSegments) {
      result = await linearAssetService.getLinearAssetWithSegments(linearAssetId);
    } else {
      result = await linearAssetService.getLinearAsset(linearAssetId);
    }

    if (!result) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Linear asset not found', requestId)
      );
    }

    logger.info('Linear asset retrieved successfully', {
      requestId,
      linearAssetId: result.linearAssetId,
      includeSegments,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get linear asset', err, { requestId, linearAssetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get linear asset', requestId)
    );
  }
}

/**
 * Lambda handler for getting a linear asset by enterprise asset ID
 */
export async function handlerByAssetId(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];
  const includeSegments = event.queryStringParameters?.['includeSegments'] === 'true';

  logger.info('Get linear asset by asset ID request received', { requestId, assetId, includeSegments });

  try {
    // Validate asset ID
    if (!assetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'assetId is required', requestId)
      );
    }

    const uuidError = validateUUID(assetId, 'assetId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Get linear asset by enterprise asset ID
    const linearAsset = await linearAssetService.getLinearAssetByAssetId(assetId);

    if (!linearAsset) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Linear asset not found for this enterprise asset', requestId)
      );
    }

    // If segments requested, get full data
    let result;
    if (includeSegments) {
      result = await linearAssetService.getLinearAssetWithSegments(linearAsset.linearAssetId);
    } else {
      result = linearAsset;
    }

    logger.info('Linear asset retrieved successfully', {
      requestId,
      linearAssetId: linearAsset.linearAssetId,
      assetId,
      includeSegments,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get linear asset by asset ID', err, { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get linear asset', requestId)
    );
  }
}
