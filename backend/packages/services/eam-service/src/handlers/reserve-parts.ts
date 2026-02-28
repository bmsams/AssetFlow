/**
 * Reserve Parts Lambda Handler
 *
 * Reserves spare parts for a work order.
 * Implements part reservation with availability checking.
 * Requirements: 5.4, 5.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { PartRequirement } from '../parts-inventory/parts-inventory-service';
import * as partsInventoryService from '../parts-inventory/parts-inventory-service';

const logger = createLogger({ service: 'reserve-parts-handler' });

/**
 * Reserve parts request
 */
interface ReservePartsRequest {
  readonly workOrderId: string;
  readonly parts: readonly PartRequirement[];
}

/**
 * Validate reserve parts request
 */
function validateRequest(body: unknown): { valid: true; data: ReservePartsRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate workOrderId
  if (!request['workOrderId']) {
    errors.push('workOrderId is required');
  } else {
    const uuidError = validateUUID(request['workOrderId'] as string, 'workOrderId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate parts array
  if (!request['parts']) {
    errors.push('parts array is required');
  } else if (!Array.isArray(request['parts'])) {
    errors.push('parts must be an array');
  } else if (request['parts'].length === 0) {
    errors.push('parts array cannot be empty');
  } else {
    const parts = request['parts'] as unknown[];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] as Record<string, unknown>;
      
      if (!part || typeof part !== 'object') {
        errors.push(`parts[${i}] must be an object`);
        continue;
      }

      if (!part['partId']) {
        errors.push(`parts[${i}].partId is required`);
      } else {
        const uuidError = validateUUID(part['partId'] as string, `parts[${i}].partId`);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }

      if (part['quantityRequired'] === undefined || part['quantityRequired'] === null) {
        errors.push(`parts[${i}].quantityRequired is required`);
      } else if (typeof part['quantityRequired'] !== 'number') {
        errors.push(`parts[${i}].quantityRequired must be a number`);
      } else if (part['quantityRequired'] <= 0) {
        errors.push(`parts[${i}].quantityRequired must be greater than 0`);
      } else if (!Number.isInteger(part['quantityRequired'])) {
        errors.push(`parts[${i}].quantityRequired must be an integer`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const parts = (request['parts'] as Record<string, unknown>[]).map(p => ({
    partId: p['partId'] as string,
    quantityRequired: p['quantityRequired'] as number,
  }));

  return {
    valid: true,
    data: {
      workOrderId: request['workOrderId'] as string,
      parts,
    },
  };
}

/**
 * Lambda handler for reserving parts
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Reserve parts request received', { requestId });

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

    // Reserve parts
    const reservation = await partsInventoryService.reserveParts(
      validation.data.workOrderId,
      validation.data.parts
    );

    logger.info('Parts reserved successfully', {
      requestId,
      workOrderId: validation.data.workOrderId,
      reservationId: reservation.reservationId,
      allPartsReserved: reservation.allPartsReserved,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(reservation, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reserve parts', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('not active')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reserve parts', requestId)
    );
  }
}
