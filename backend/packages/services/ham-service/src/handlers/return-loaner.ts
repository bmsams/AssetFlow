/**
 * Return Loaner Lambda Handler
 *
 * Returns a loaner asset and records condition.
 * Requirement 3.8: Track loaner returns with condition tracking
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { AssetCondition, ReturnLoanerRequest } from '../loaner/loaner-service';
import * as loanerService from '../loaner/loaner-service';

const logger = createLogger({ service: 'return-loaner-handler' });

/**
 * Valid asset conditions for return (includes LOST)
 */
const VALID_CONDITIONS: AssetCondition[] = [
  'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'LOST'
];

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: ReturnLoanerRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate conditionIn (required)
  if (!request['conditionIn']) {
    errors.push('conditionIn is required');
  } else if (typeof request['conditionIn'] !== 'string') {
    errors.push('conditionIn must be a string');
  } else if (!VALID_CONDITIONS.includes(request['conditionIn'] as AssetCondition)) {
    errors.push(`conditionIn must be one of: ${VALID_CONDITIONS.join(', ')}`);
  }

  // Validate conditionInNotes (optional)
  if (request['conditionInNotes'] !== undefined && request['conditionInNotes'] !== null) {
    if (typeof request['conditionInNotes'] !== 'string') {
      errors.push('conditionInNotes must be a string');
    } else if (request['conditionInNotes'].length > 1000) {
      errors.push('conditionInNotes exceeds maximum length of 1000 characters');
    }
  }

  // Validate damageCharges (optional)
  if (request['damageCharges'] !== undefined && request['damageCharges'] !== null) {
    if (typeof request['damageCharges'] !== 'number' || request['damageCharges'] < 0) {
      errors.push('damageCharges must be a non-negative number');
    }
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    } else if (request['notes'].length > 1000) {
      errors.push('notes exceeds maximum length of 1000 characters');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      returnedBy: '', // Will be set from auth context
      conditionIn: request['conditionIn'] as AssetCondition,
      conditionInNotes: request['conditionInNotes'] as string | undefined,
      damageCharges: request['damageCharges'] as number | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for returning a loaner asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const checkoutId = event.pathParameters?.['checkoutId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Return loaner request received', { requestId, checkoutId });

  try {
    // Validate checkout ID
    if (!checkoutId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Checkout ID is required', requestId)
      );
    }

    const uuidError = validateUUID(checkoutId, 'checkoutId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
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

    // Set the returnedBy from auth context
    const returnRequest: ReturnLoanerRequest = {
      ...validation.data,
      returnedBy: userId,
    };

    // Process the return
    const result = await loanerService.returnLoaner(checkoutId, returnRequest);

    logger.info('Loaner return successful', {
      requestId,
      checkoutId,
      status: result.checkout.status,
      wasOverdue: result.wasOverdue,
      daysOverdue: result.daysOverdue,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to return loaner', err, { requestId, checkoutId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot return loaner with status')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to return loaner', requestId)
    );
  }
}
