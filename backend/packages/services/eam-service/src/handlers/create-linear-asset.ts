/**
 * Create Linear Asset Lambda Handler
 *
 * Creates a new linear asset for tracking assets spanning physical distances
 * such as pipelines, roads, cables, and railways.
 * Requirement 5.3: Track assets spanning physical distances with segment-based location tracking
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { CreateLinearAssetRequest, ConditionRating, LinearUnit, RouteType } from '../linear-asset';
import * as linearAssetService from '../linear-asset';

const logger = createLogger({ service: 'create-linear-asset-handler' });

const VALID_LINEAR_UNITS: LinearUnit[] = ['METERS', 'KILOMETERS', 'FEET', 'MILES', 'YARDS'];
const VALID_ROUTE_TYPES: RouteType[] = ['PIPELINE', 'CABLE', 'TRACK', 'ROAD', 'FENCE', 'CONVEYOR', 'DUCT', 'OTHER'];
const VALID_CONDITION_RATINGS: ConditionRating[] = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'];

/**
 * Validate create linear asset request
 */
function validateRequest(body: unknown): { valid: true; data: CreateLinearAssetRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Required fields
  if (!request['assetId']) {
    errors.push('assetId is required');
  } else {
    const uuidError = validateUUID(request['assetId'] as string, 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate optional enum fields
  if (request['linearUnitOfMeasure'] !== undefined && !VALID_LINEAR_UNITS.includes(request['linearUnitOfMeasure'] as LinearUnit)) {
    errors.push(`linearUnitOfMeasure must be one of: ${VALID_LINEAR_UNITS.join(', ')}`);
  }

  if (request['routeType'] !== undefined && !VALID_ROUTE_TYPES.includes(request['routeType'] as RouteType)) {
    errors.push(`routeType must be one of: ${VALID_ROUTE_TYPES.join(', ')}`);
  }

  if (request['overallConditionRating'] !== undefined && !VALID_CONDITION_RATINGS.includes(request['overallConditionRating'] as ConditionRating)) {
    errors.push(`overallConditionRating must be one of: ${VALID_CONDITION_RATINGS.join(', ')}`);
  }

  // Validate GPS coordinates
  if (request['startGpsLatitude'] !== undefined) {
    const lat = request['startGpsLatitude'] as number;
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      errors.push('startGpsLatitude must be a number between -90 and 90');
    }
  }

  if (request['startGpsLongitude'] !== undefined) {
    const lng = request['startGpsLongitude'] as number;
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      errors.push('startGpsLongitude must be a number between -180 and 180');
    }
  }

  if (request['endGpsLatitude'] !== undefined) {
    const lat = request['endGpsLatitude'] as number;
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      errors.push('endGpsLatitude must be a number between -90 and 90');
    }
  }

  if (request['endGpsLongitude'] !== undefined) {
    const lng = request['endGpsLongitude'] as number;
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      errors.push('endGpsLongitude must be a number between -180 and 180');
    }
  }

  // Validate date formats
  if (request['lastInspectionDate'] !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['lastInspectionDate'] as string)) {
      errors.push('lastInspectionDate must be in YYYY-MM-DD format');
    }
  }

  if (request['nextInspectionDue'] !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['nextInspectionDue'] as string)) {
      errors.push('nextInspectionDue must be in YYYY-MM-DD format');
    }
  }

  // Validate string lengths
  const result = validate()
    .stringLength(request['startLocation'] as string | undefined, 'startLocation', 0, 255)
    .stringLength(request['endLocation'] as string | undefined, 'endLocation', 0, 255)
    .stringLength(request['routeDescription'] as string | undefined, 'routeDescription', 0, 2000)
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
      assetId: request['assetId'] as string,
      startLocation: request['startLocation'] as string | undefined,
      endLocation: request['endLocation'] as string | undefined,
      linearUnitOfMeasure: request['linearUnitOfMeasure'] as LinearUnit | undefined,
      startGpsLatitude: request['startGpsLatitude'] as number | undefined,
      startGpsLongitude: request['startGpsLongitude'] as number | undefined,
      endGpsLatitude: request['endGpsLatitude'] as number | undefined,
      endGpsLongitude: request['endGpsLongitude'] as number | undefined,
      routeDescription: request['routeDescription'] as string | undefined,
      routeType: request['routeType'] as RouteType | undefined,
      overallConditionRating: request['overallConditionRating'] as ConditionRating | undefined,
      lastInspectionDate: request['lastInspectionDate'] as string | undefined,
      nextInspectionDue: request['nextInspectionDue'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for creating linear assets
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Create linear asset request received', { requestId });

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

    // Create linear asset
    const linearAsset = await linearAssetService.createLinearAsset(validation.data);

    logger.info('Linear asset created successfully', {
      requestId,
      linearAssetId: linearAsset.linearAssetId,
      assetId: linearAsset.assetId,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(linearAsset, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create linear asset', err, { requestId });

    if (err.message.includes('not found') || err.message.includes('violates foreign key')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Enterprise asset not found', requestId)
      );
    }

    if (err.message.includes('duplicate') || err.message.includes('already exists')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, 'Linear asset already exists for this enterprise asset', requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create linear asset', requestId)
    );
  }
}
