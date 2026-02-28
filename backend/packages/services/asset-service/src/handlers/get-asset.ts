/**
 * Get Asset Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'get-asset-handler' });

/**
 * Lambda handler for getting an asset by ID
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];

  logger.info('Get asset request received', { requestId, assetId });

  try {
    // Validate asset ID
    if (!assetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Asset ID is required', requestId)
      );
    }

    const uuidError = validateUUID(assetId, 'assetId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Get asset
    const asset = await assetService.getAsset(assetId);

    if (!asset) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Asset not found: ${assetId}`, requestId)
      );
    }

    logger.info('Asset retrieved successfully', { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(asset, requestId)
    );
  } catch (error) {
    logger.error('Failed to get asset', error as Error, { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get asset', requestId)
    );
  }
}
