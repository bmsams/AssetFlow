/**
 * Update Segment Lambda Handler
 *
 * Updates segment information for a linear asset.
 * Supports updating location markers, length, condition, material, and inspection data.
 * Requirement 5.3: Segment-based location tracking
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { ConditionRating, UpdateSegmentRequest } from '../linear-asset';
import * as linearAssetService from '../linear-asset';

const logger = createLogger({ service: 'update-segment-handler' });

const VALID_CONDITION_RATINGS: ConditionRating[] = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'];

/**
 * Validate update segment request
 */
function validateRequest(body: unknown): { valid: true; data: UpdateSegmentRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate condition rating if provided
  if (request['conditionRating'] !== undefined && request['conditionRating'] !== null) {
    if (!VALID_CONDITION_RATINGS.includes(request['conditionRating'] as ConditionRating)) {
      errors.push(`conditionRating must be one of: ${VALID_CONDITION_RATINGS.join(', ')}`);
    }
  }

  // Validate segment length if provided
  if (request['segmentLength'] !== undefined && request['segmentLength'] !== null) {
    if (typeof request['segmentLength'] !== 'number' || request['segmentLength'] <= 0) {
      errors.push('segmentLength must be a positive number');
    }
  }

  // Validate GPS coordinates
  if (request['startGpsLatitude'] !== undefined && request['startGpsLatitude'] !== null) {
    const lat = request['startGpsLatitude'] as number;
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      errors.push('startGpsLatitude must be a number between -90 and 90');
    }
  }

  if (request['startGpsLongitude'] !== undefined && request['startGpsLongitude'] !== null) {
    const lng = request['startGpsLongitude'] as number;
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      errors.push('startGpsLongitude must be a number between -180 and 180');
    }
  }

  if (request['endGpsLatitude'] !== undefined && request['endGpsLatitude'] !== null) {
    const lat = request['endGpsLatitude'] as number;
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
      errors.push('endGpsLatitude must be a number between -90 and 90');
    }
  }

  if (request['endGpsLongitude'] !== undefined && request['endGpsLongitude'] !== null) {
    const lng = request['endGpsLongitude'] as number;
    if (typeof lng !== 'number' || lng < -180 || lng > 180) {
      errors.push('endGpsLongitude must be a number between -180 and 180');
    }
  }

  // Validate date formats
  if (request['installationDate'] !== undefined && request['installationDate'] !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['installationDate'] as string)) {
      errors.push('installationDate must be in YYYY-MM-DD format');
    }
  }

  if (request['lastInspectionDate'] !== undefined && request['lastInspectionDate'] !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['lastInspectionDate'] as string)) {
      errors.push('lastInspectionDate must be in YYYY-MM-DD format');
    }
  }

  if (request['nextInspectionDue'] !== undefined && request['nextInspectionDue'] !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(request['nextInspectionDue'] as string)) {
      errors.push('nextInspectionDue must be in YYYY-MM-DD format');
    }
  }

  // Validate defect count if provided
  if (request['defectCount'] !== undefined) {
    if (typeof request['defectCount'] !== 'number' || request['defectCount'] < 0 || !Number.isInteger(request['defectCount'])) {
      errors.push('defectCount must be a non-negative integer');
    }
  }

  // Validate hasActiveDefects if provided
  if (request['hasActiveDefects'] !== undefined && typeof request['hasActiveDefects'] !== 'boolean') {
    errors.push('hasActiveDefects must be a boolean');
  }

  // Validate string lengths
  const result = validate()
    .stringLength(request['startMarker'] as string | undefined, 'startMarker', 0, 100)
    .stringLength(request['endMarker'] as string | undefined, 'endMarker', 0, 100)
    .stringLength(request['segmentDescription'] as string | undefined, 'segmentDescription', 0, 2000)
    .stringLength(request['material'] as string | undefined, 'material', 0, 100)
    .stringLength(request['lastInspectionNotes'] as string | undefined, 'lastInspectionNotes', 0, 2000)
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
      startMarker: request['startMarker'] as string | null | undefined,
      endMarker: request['endMarker'] as string | null | undefined,
      segmentLength: request['segmentLength'] as number | null | undefined,
      conditionRating: request['conditionRating'] as ConditionRating | null | undefined,
      segmentDescription: request['segmentDescription'] as string | null | undefined,
      material: request['material'] as string | null | undefined,
      installationDate: request['installationDate'] as string | null | undefined,
      startGpsLatitude: request['startGpsLatitude'] as number | null | undefined,
      startGpsLongitude: request['startGpsLongitude'] as number | null | undefined,
      endGpsLatitude: request['endGpsLatitude'] as number | null | undefined,
      endGpsLongitude: request['endGpsLongitude'] as number | null | undefined,
      lastInspectionDate: request['lastInspectionDate'] as string | null | undefined,
      lastInspectionNotes: request['lastInspectionNotes'] as string | null | undefined,
      nextInspectionDue: request['nextInspectionDue'] as string | null | undefined,
      defectCount: request['defectCount'] as number | undefined,
      hasActiveDefects: request['hasActiveDefects'] as boolean | undefined,
    },
  };
}

/**
 * Lambda handler for updating segments
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const segmentId = event.pathParameters?.['segmentId'];

  logger.info('Update segment request received', { requestId, segmentId });

  try {
    // Validate segment ID
    if (!segmentId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'segmentId is required', requestId)
      );
    }

    const uuidError = validateUUID(segmentId, 'segmentId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
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

    // Update segment
    const segment = await linearAssetService.updateSegment(segmentId, validation.data);

    logger.info('Segment updated successfully', {
      requestId,
      segmentId: segment.segmentId,
      linearAssetId: segment.linearAssetId,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(segment, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update segment', err, { requestId, segmentId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, 'Segment not found', requestId)
      );
    }

    if (err.message.includes('must be positive')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update segment', requestId)
    );
  }
}
