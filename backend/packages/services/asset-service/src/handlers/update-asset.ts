/**
 * Update Asset Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { UpdateAssetRequest } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import { invalidateAssetComprehensive } from '@ams/cache';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'update-asset-handler' });

/**
 * Validate update asset request
 */
function validateRequest(body: unknown): { valid: true; data: UpdateAssetRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const result = validate()
    .stringLength(request['displayName'] as string | undefined, 'displayName', 1, 255)
    .stringLength(request['description'] as string | undefined, 'description', 0, 2000)
    .stringLength(request['substatus'] as string | undefined, 'substatus', 0, 50)
    .result();

  if (!result.isValid) {
    return { valid: false, errors: result.errors.map(e => e.message) };
  }

  const attributesRaw = request['attributes'];
  if (
    attributesRaw !== undefined &&
    (attributesRaw === null || typeof attributesRaw !== 'object' || Array.isArray(attributesRaw))
  ) {
    return { valid: false, errors: ['attributes must be an object'] };
  }

  return {
    valid: true,
    data: {
      displayName: request['displayName'] as string | undefined,
      description: request['description'] as string | undefined,
      substatus: request['substatus'] as string | undefined,
      attributes: attributesRaw as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Lambda handler for updating an asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update asset request received', { requestId, assetId });

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

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
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

    // Update asset
    const asset = await assetService.updateAsset(assetId, validation.data, userId);

    if (!asset) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Asset not found: ${assetId}`, requestId)
      );
    }

    logger.info('Asset updated successfully', { requestId, assetId });

    try {
      await invalidateAssetComprehensive(assetId);
    } catch (cacheError) {
      logger.warn('Cache invalidation failed, continuing', { assetId, error: cacheError });
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(asset, requestId)
    );
  } catch (error) {
    logger.error('Failed to update asset', error as Error, { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update asset', requestId)
    );
  }
}
