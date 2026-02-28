/**
 * Record Inspection Result Lambda Handler
 *
 * Records the result of a quality inspection (pass/fail).
 * Requirement 13.2: Record inspection results (pass/fail with notes)
 * Requirement 13.3: Route failed inspections to return workflow
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

import type { InspectionResult } from '../receiving/receiving-repository';
import type { RecordInspectionResultInput } from '../receiving/receiving-service';
import * as receivingService from '../receiving/receiving-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'record-inspection-result-handler' });

/**
 * Valid inspection results
 */
const VALID_RESULTS: InspectionResult[] = ['PASSED', 'FAILED'];

/**
 * Validate record inspection result request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: Omit<RecordInspectionResultInput, 'inspectedBy' | 'inspectionId'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate result (required)
  if (!request['result']) {
    errors.push('result is required');
  } else if (typeof request['result'] !== 'string') {
    errors.push('result must be a string');
  } else if (!VALID_RESULTS.includes(request['result'] as InspectionResult)) {
    errors.push(`result must be one of: ${VALID_RESULTS.join(', ')}`);
  }

  // Validate inspectedByName (optional)
  if (request['inspectedByName'] !== undefined && request['inspectedByName'] !== null) {
    if (typeof request['inspectedByName'] !== 'string') {
      errors.push('inspectedByName must be a string');
    }
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    }
  }

  // Validate failureReason (optional, but recommended for FAILED result)
  if (request['failureReason'] !== undefined && request['failureReason'] !== null) {
    if (typeof request['failureReason'] !== 'string') {
      errors.push('failureReason must be a string');
    }
  }

  // Warn if result is FAILED but no failureReason provided
  if (request['result'] === 'FAILED' && !request['failureReason']) {
    // Not an error, but log a warning
    logger.warn('Inspection failed without failure reason');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      result: request['result'] as InspectionResult,
      inspectedByName: request['inspectedByName'] as string | undefined,
      notes: request['notes'] as string | undefined,
      failureReason: request['failureReason'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for recording inspection result
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);
  const inspectionId = event.pathParameters?.['inspectionId'];

  logger.info('Record inspection result request received', { requestId });

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

    if (!inspectionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'inspectionId is required', requestId)
      );
    }

    const inspectionIdError = validateUUID(inspectionId, 'inspectionId');
    if (inspectionIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, inspectionIdError.message, requestId)
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

    // Record inspection result
    const input: RecordInspectionResultInput = {
      ...validation.data,
      inspectionId,
      inspectedBy: userId,
    };

    const result = await receivingService.recordInspectionResult(input);

    logger.info('Inspection result recorded', {
      requestId,
      inspectionId,
      result: validation.data.result,
      assetCreated: result.assetCreated?.assetId,
      routedToReturn: result.routedToReturn,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to record inspection result', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('already completed')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record inspection result', requestId)
    );
  }
}
