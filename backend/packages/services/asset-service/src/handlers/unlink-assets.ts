/**
 * Unlink Assets Lambda Handler
 *
 * Removes a relationship between two assets in the CMDB (Requirement 2.3)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetRelationType, DeleteRelationshipRequest } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS, VALID_RELATIONSHIP_TYPES } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import * as relationshipService from '../service/relationship-service';

const logger = createLogger({ service: 'unlink-assets-handler' });

/**
 * Validate unlink assets request
 */
function validateRequest(body: unknown): { valid: true; data: DeleteRelationshipRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate sourceAssetId
  if (!request['sourceAssetId']) {
    errors.push('sourceAssetId is required');
  } else {
    const uuidError = validateUUID(request['sourceAssetId'] as string, 'sourceAssetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate targetAssetId
  if (!request['targetAssetId']) {
    errors.push('targetAssetId is required');
  } else {
    const uuidError = validateUUID(request['targetAssetId'] as string, 'targetAssetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate relationType (optional)
  if (request['relationType'] !== undefined) {
    const result = validate()
      .enum(request['relationType'] as string, 'relationType', VALID_RELATIONSHIP_TYPES as unknown as string[])
      .result();

    if (!result.isValid) {
      errors.push(...result.errors.map(e => e.message));
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      sourceAssetId: request['sourceAssetId'] as string,
      targetAssetId: request['targetAssetId'] as string,
      relationType: request['relationType'] as AssetRelationType | undefined,
    },
  };
}

/**
 * Lambda handler for unlinking assets
 *
 * DELETE /assets/relationships
 *
 * Request body:
 * {
 *   "sourceAssetId": "uuid",
 *   "targetAssetId": "uuid",
 *   "relationType": "PARENT_CHILD" | ... // optional - if not provided, deletes all relationships between the assets
 * }
 *
 * Responses:
 * - 200: Relationship deleted successfully
 * - 400: Invalid request (missing/invalid parameters)
 * - 404: Relationship not found
 * - 500: Internal server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Unlink assets request received', { requestId });

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

    // Delete the relationship
    const deleted = await relationshipService.unlinkAssets(validation.data);

    if (!deleted) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          'Relationship not found',
          requestId,
          [{
            field: 'relationship',
            message: `No relationship found between ${validation.data.sourceAssetId} and ${validation.data.targetAssetId}${validation.data.relationType ? ` with type ${validation.data.relationType}` : ''}`,
            code: 'RELATIONSHIP_NOT_FOUND',
          }]
        )
      );
    }

    logger.info('Assets unlinked successfully', {
      requestId,
      sourceAssetId: validation.data.sourceAssetId,
      targetAssetId: validation.data.targetAssetId,
      relationType: validation.data.relationType,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ success: true, message: 'Relationship deleted successfully' }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to unlink assets', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to unlink assets', requestId)
    );
  }
}
