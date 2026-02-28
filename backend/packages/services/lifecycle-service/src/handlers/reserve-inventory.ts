/**
 * Reserve Inventory Lambda Handler
 *
 * Reserves inventory for a request from available stock.
 * Requirement 6.2: Reserve inventory when stock is available
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

const logger = createLogger({ service: 'reserve-inventory-handler' });

/**
 * Validate reserve inventory request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: {
    productId: string;
    productType: string;
    quantityNeeded: number;
    requestId?: string;
    requestLineId?: string;
    stockroomId?: string;
    expiresAt?: string;
    notes?: string;
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

  // Validate optional UUID fields
  const optionalUuidFields = ['requestId', 'requestLineId', 'stockroomId'];
  for (const field of optionalUuidFields) {
    if (request[field] !== undefined && request[field] !== null) {
      if (typeof request[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else {
        const uuidError = validateUUID(request[field] as string, field);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }
    }
  }

  // Validate expiresAt (optional ISO date string)
  if (request['expiresAt'] !== undefined && request['expiresAt'] !== null) {
    if (typeof request['expiresAt'] !== 'string') {
      errors.push('expiresAt must be a string');
    } else {
      const date = new Date(request['expiresAt'] as string);
      if (isNaN(date.getTime())) {
        errors.push('expiresAt must be a valid ISO date string');
      }
    }
  }

  // Validate notes (optional string)
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
      productId: request['productId'] as string,
      productType: request['productType'] as string,
      quantityNeeded: request['quantityNeeded'] as number,
      requestId: request['requestId'] as string | undefined,
      requestLineId: request['requestLineId'] as string | undefined,
      stockroomId: request['stockroomId'] as string | undefined,
      expiresAt: request['expiresAt'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for reserving inventory
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Reserve inventory request received', { requestId });

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

    // Reserve inventory
    const result = await procurementService.reserveInventory(
      validation.data.productId,
      validation.data.productType,
      validation.data.quantityNeeded,
      userId,
      {
        requestId: validation.data.requestId,
        requestLineId: validation.data.requestLineId,
        stockroomId: validation.data.stockroomId,
        expiresAt: validation.data.expiresAt,
        notes: validation.data.notes,
      }
    );

    logger.info('Inventory reservation complete', {
      requestId,
      productId: validation.data.productId,
      totalReserved: result.totalReserved,
      fullyReserved: result.fullyReserved,
      reservationCount: result.reservations.length,
    });

    // Return appropriate status based on result
    const httpStatus = result.fullyReserved ? HTTP_STATUS.CREATED : HTTP_STATUS.OK;

    return createLambdaResponse(httpStatus, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reserve inventory', err, { requestId });

    // Handle specific errors
    if (err.message.includes('Insufficient')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reserve inventory', requestId)
    );
  }
}
