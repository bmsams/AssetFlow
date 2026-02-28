/**
 * Get Related Assets Lambda Handler
 *
 * Retrieves all assets related to a given asset through CMDB relationships (Requirement 2.3)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetRelationType, RelatedAssetsQuery } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS, VALID_RELATIONSHIP_TYPES } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as relationshipService from '../service/relationship-service';

const logger = createLogger({ service: 'get-related-assets-handler' });

/**
 * Valid direction values
 */
const VALID_DIRECTIONS = ['source', 'target', 'both'] as const;
type Direction = typeof VALID_DIRECTIONS[number];

/**
 * Parse and validate query parameters
 */
function parseQueryParams(
  assetId: string,
  queryParams: Record<string, string | undefined> | null
): { valid: true; data: RelatedAssetsQuery } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // Validate assetId
  const uuidError = validateUUID(assetId, 'assetId');
  if (uuidError) {
    errors.push(uuidError.message);
  }

  // Parse relationType (optional)
  let relationType: AssetRelationType | undefined;
  if (queryParams?.['relationType']) {
    const typeValue = queryParams['relationType'];
    if (!VALID_RELATIONSHIP_TYPES.includes(typeValue as AssetRelationType)) {
      errors.push(`Invalid relationType: ${typeValue}. Valid values: ${VALID_RELATIONSHIP_TYPES.join(', ')}`);
    } else {
      relationType = typeValue as AssetRelationType;
    }
  }

  // Parse direction (optional)
  let direction: Direction | undefined;
  if (queryParams?.['direction']) {
    const dirValue = queryParams['direction'];
    if (!VALID_DIRECTIONS.includes(dirValue as Direction)) {
      errors.push(`Invalid direction: ${dirValue}. Valid values: ${VALID_DIRECTIONS.join(', ')}`);
    } else {
      direction = dirValue as Direction;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId,
      relationType,
      direction,
    },
  };
}

/**
 * Lambda handler for getting related assets
 *
 * GET /assets/{assetId}/relationships
 *
 * Query parameters:
 * - relationType: Filter by relationship type (optional)
 * - direction: Filter by direction - 'source', 'target', or 'both' (optional, default: 'both')
 *
 * Responses:
 * - 200: List of related assets with relationship details
 * - 400: Invalid request (invalid parameters)
 * - 404: Asset not found
 * - 500: Internal server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];

  logger.info('Get related assets request received', { requestId, assetId });

  try {
    // Validate asset ID
    if (!assetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Asset ID is required', requestId)
      );
    }

    // Parse and validate query parameters
    const validation = parseQueryParams(assetId, event.queryStringParameters);
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

    // Get related assets
    const relatedAssets = await relationshipService.getRelatedAssets(validation.data);

    logger.info('Related assets retrieved successfully', {
      requestId,
      assetId,
      count: relatedAssets.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        assetId,
        relatedAssets,
        total: relatedAssets.length,
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get related assets', err, { requestId, assetId });

    // Check for asset not found
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get related assets', requestId)
    );
  }
}
