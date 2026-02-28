/**
 * Delete Asset Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import { invalidateAssetComprehensive } from '@ams/cache';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'delete-asset-handler' });

/**
 * Lambda handler for deleting an asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Delete asset request received', { requestId, assetId });

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

    // Delete asset
    const deleted = await assetService.deleteAsset(assetId, userId);

    if (!deleted) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Asset not found: ${assetId}`, requestId)
      );
    }

    logger.info('Asset deleted successfully', { requestId, assetId });

    try {
      await invalidateAssetComprehensive(assetId);
    } catch (cacheError) {
      logger.warn('Cache invalidation failed, continuing', { assetId, error: cacheError });
    }

    return createLambdaResponse(HTTP_STATUS.NO_CONTENT, null);
  } catch (error) {
    logger.error('Failed to delete asset', error as Error, { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to delete asset', requestId)
    );
  }
}
