/**
 * Create Asset Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { CreateAssetRequest } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate } from '@ams/utils';

import { invalidateAssetComprehensive } from '@ams/cache';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'create-asset-handler' });

/**
 * Validate create asset request
 */
function validateRequest(body: unknown): { valid: true; data: CreateAssetRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const result = validate()
    .required(request['assetType'], 'assetType')
    .enum(request['assetType'] as string, 'assetType', ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'])
    .required(request['displayName'], 'displayName')
    .stringLength(request['displayName'] as string, 'displayName', 1, 255)
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
      assetType: request['assetType'] as CreateAssetRequest['assetType'],
      displayName: request['displayName'] as string,
      description: request['description'] as string | undefined,
      status: request['status'] as CreateAssetRequest['status'],
      attributes: attributesRaw as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Lambda handler for creating assets
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create asset request received', { requestId });

  try {
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

    // Create asset
    const asset = await assetService.createAsset(validation.data, userId);

    logger.info('Asset created successfully', { requestId, assetId: asset.assetId });

    try {
      await invalidateAssetComprehensive(asset.assetId);
    } catch (cacheError) {
      logger.warn('Cache invalidation failed, continuing', { assetId: asset.assetId, error: cacheError });
    }

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(asset, requestId)
    );
  } catch (error) {
    logger.error('Failed to create asset', error as Error, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create asset', requestId)
    );
  }
}
