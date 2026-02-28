/**
 * Link Assets Lambda Handler
 *
 * Creates a relationship between two assets in the CMDB (Requirement 2.3)
 * Enforces referential integrity for relationships (Requirement 2.9)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetRelationType, CreateRelationshipRequest } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS, VALID_RELATIONSHIP_TYPES } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import * as relationshipService from '../service/relationship-service';
import {
  CircularDependencyError,
  DuplicateRelationshipError,
  ReferentialIntegrityError,
} from '../service/relationship-service';

const logger = createLogger({ service: 'link-assets-handler' });

/**
 * Validate link assets request
 */
function validateRequest(body: unknown): { valid: true; data: CreateRelationshipRequest } | { valid: false; errors: string[] } {
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

  // Validate relationType
  const result = validate()
    .required(request['relationType'], 'relationType')
    .enum(request['relationType'] as string, 'relationType', VALID_RELATIONSHIP_TYPES as unknown as string[])
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      sourceAssetId: request['sourceAssetId'] as string,
      targetAssetId: request['targetAssetId'] as string,
      relationType: request['relationType'] as AssetRelationType,
      metadata: request['metadata'] as Record<string, unknown> | undefined,
    },
  };
}

/**
 * Lambda handler for linking assets
 *
 * POST /assets/relationships
 *
 * Request body:
 * {
 *   "sourceAssetId": "uuid",
 *   "targetAssetId": "uuid",
 *   "relationType": "PARENT_CHILD" | "DEPENDENCY" | "CONNECTED_TO" | "INSTALLED_ON" | "RUNS_ON" | "LOCATION" | "COMPONENT",
 *   "metadata": { ... } // optional
 * }
 *
 * Responses:
 * - 201: Relationship created successfully
 * - 400: Invalid request (missing/invalid parameters)
 * - 404: Source or target asset not found
 * - 409: Relationship already exists or would create circular dependency
 * - 500: Internal server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Link assets request received', { requestId });

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

    // Create the relationship
    const relationship = await relationshipService.linkAssets(validation.data, userId);

    logger.info('Assets linked successfully', {
      requestId,
      relationshipId: relationship.relationshipId,
      sourceAssetId: validation.data.sourceAssetId,
      targetAssetId: validation.data.targetAssetId,
      relationType: validation.data.relationType,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(relationship, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to link assets', err, { requestId });

    // Handle referential integrity errors (asset not found)
    if (err instanceof ReferentialIntegrityError) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          err.message,
          requestId,
          [{ field: 'assetId', message: err.reason, code: 'ASSET_NOT_FOUND' }]
        )
      );
    }

    // Handle duplicate relationship errors
    if (err instanceof DuplicateRelationshipError) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(
          API_ERROR_CODES.CONFLICT,
          err.message,
          requestId,
          [{ field: 'relationship', message: 'Relationship already exists', code: 'DUPLICATE_RELATIONSHIP' }]
        )
      );
    }

    // Handle circular dependency errors
    if (err instanceof CircularDependencyError) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(
          API_ERROR_CODES.CONFLICT,
          err.message,
          requestId,
          [{ field: 'relationship', message: 'Would create circular dependency', code: 'CIRCULAR_DEPENDENCY' }]
        )
      );
    }

    // Handle generic errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to link assets', requestId)
    );
  }
}
