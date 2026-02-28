/**
 * Check Stock Lambda Handler
 *
 * Checks stock availability for products across stockrooms.
 * Requirement 6.2: Check stock availability
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

import * as procurementService from '../procurement/procurement-service';

const logger = createLogger({ service: 'check-stock-handler' });

/**
 * Validate check stock request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: {
    productId: string;
    productType: string;
    quantityNeeded: number;
    stockroomId?: string;
  };
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate productId (required)
  if (!request['productId']) {
    errors.push('productId is required');
  } else if (typeof request['productId'] !== 'string') {
    errors.push('productId must be a string');
  } else {
    const uuidError = validateUUID(request['productId'] as string, 'productId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate productType (required)
  if (!request['productType']) {
    errors.push('productType is required');
  } else if (typeof request['productType'] !== 'string') {
    errors.push('productType must be a string');
  }

  // Validate quantityNeeded (required)
  if (request['quantityNeeded'] === undefined || request['quantityNeeded'] === null) {
    errors.push('quantityNeeded is required');
  } else if (typeof request['quantityNeeded'] !== 'number') {
    errors.push('quantityNeeded must be a number');
  } else if (request['quantityNeeded'] <= 0) {
    errors.push('quantityNeeded must be greater than 0');
  } else if (!Number.isInteger(request['quantityNeeded'])) {
    errors.push('quantityNeeded must be an integer');
  }

  // Validate stockroomId (optional)
  if (request['stockroomId'] !== undefined && request['stockroomId'] !== null) {
    if (typeof request['stockroomId'] !== 'string') {
      errors.push('stockroomId must be a string');
    } else {
      const uuidError = validateUUID(request['stockroomId'] as string, 'stockroomId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      productId: request['productId'] as string,
      productType: request['productType'] as string,
      quantityNeeded: request['quantityNeeded'] as number,
      stockroomId: request['stockroomId'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for checking stock availability
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Check stock request received', { requestId });

  try {
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
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Check stock availability
    const result = await procurementService.checkStock(
      validation.data.productId,
      validation.data.productType,
      validation.data.quantityNeeded,
      validation.data.stockroomId
    );

    logger.info('Stock check complete', {
      requestId,
      productId: validation.data.productId,
      isAvailable: result.isAvailable,
      quantityAvailable: result.quantityAvailable,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check stock', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check stock availability', requestId)
    );
  }
}
