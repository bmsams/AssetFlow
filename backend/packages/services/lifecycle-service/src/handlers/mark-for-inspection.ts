/**
 * Mark For Inspection Lambda Handler
 *
 * Marks a received item for quality inspection.
 * Requirement 13.1: Mark received items for quality inspection
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { MarkForInspectionInput } from '../receiving/receiving-service';
import * as receivingService from '../receiving/receiving-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'mark-for-inspection-handler' });

/**
 * Validate mark for inspection request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: Omit<MarkForInspectionInput, 'markedBy'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate receivingLineId (required)
  if (!request['receivingLineId']) {
    errors.push('receivingLineId is required');
  } else if (typeof request['receivingLineId'] !== 'string') {
    errors.push('receivingLineId must be a string');
  } else {
    const uuidError = validateUUID(request['receivingLineId'] as string, 'receivingLineId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate assetId (optional)
  if (request['assetId'] !== undefined && request['assetId'] !== null) {
    if (typeof request['assetId'] !== 'string') {
      errors.push('assetId must be a string');
    } else {
      const uuidError = validateUUID(request['assetId'] as string, 'assetId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate serialNumber (optional)
  if (request['serialNumber'] !== undefined && request['serialNumber'] !== null) {
    if (typeof request['serialNumber'] !== 'string') {
      errors.push('serialNumber must be a string');
    } else if ((request['serialNumber'] as string).trim().length === 0) {
      errors.push('serialNumber cannot be empty if provided');
    }
  }

  // Validate markedByName (optional)
  if (request['markedByName'] !== undefined && request['markedByName'] !== null) {
    if (typeof request['markedByName'] !== 'string') {
      errors.push('markedByName must be a string');
    }
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      receivingLineId: request['receivingLineId'] as string,
      assetId: request['assetId'] as string | undefined,
      serialNumber: request['serialNumber'] as string | undefined,
      markedByName: request['markedByName'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for marking item for inspection
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Mark for inspection request received', { requestId });

  try {
    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.USER_NOT_PROVISIONED, 'User is not provisioned in the application', requestId)
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
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Mark for inspection
    const input: MarkForInspectionInput = {
      ...validation.data,
      markedBy: userId,
    };

    const result = await receivingService.markForInspection(input);

    logger.info('Item marked for inspection', {
      requestId,
      inspectionId: result.inspectionRecord.inspectionId,
      receivingLineId: validation.data.receivingLineId,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to mark for inspection', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (
      err.message.includes('is required') ||
      err.message.includes('must be') ||
      err.message.includes('cannot be')
    ) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to mark for inspection', requestId)
    );
  }
}
