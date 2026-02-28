/**
 * Consume Parts Lambda Handler
 *
 * Marks reserved parts as consumed when used in a work order.
 * Updates inventory quantities and tracks part usage.
 * Requirements: 5.4, 5.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as partsInventoryService from '../parts-inventory/parts-inventory-service';

const logger = createLogger({ service: 'consume-parts-handler' });

/**
 * Part usage specification
 */
interface PartUsage {
  readonly partId: string;
  readonly quantityUsed: number;
}

/**
 * Consume parts request
 */
interface ConsumePartsRequest {
  readonly partsUsed?: readonly PartUsage[];
}

/**
 * Validate consume parts request
 */
function validateRequest(body: unknown): { valid: true; data: ConsumePartsRequest } | { valid: false; errors: string[] } {
  // Body is optional - if not provided, all reserved parts will be consumed
  if (body === null || body === undefined) {
    return { valid: true, data: {} };
  }

  if (typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate partsUsed array if provided
  if (request['partsUsed'] !== undefined) {
    if (!Array.isArray(request['partsUsed'])) {
      errors.push('partsUsed must be an array');
    } else {
      const partsUsed = request['partsUsed'] as unknown[];
      for (let i = 0; i < partsUsed.length; i++) {
        const part = partsUsed[i] as Record<string, unknown>;
        
        if (!part || typeof part !== 'object') {
          errors.push(`partsUsed[${i}] must be an object`);
          continue;
        }

        if (!part['partId']) {
          errors.push(`partsUsed[${i}].partId is required`);
        } else {
          const uuidError = validateUUID(part['partId'] as string, `partsUsed[${i}].partId`);
          if (uuidError) {
            errors.push(uuidError.message);
          }
        }

        if (part['quantityUsed'] === undefined || part['quantityUsed'] === null) {
          errors.push(`partsUsed[${i}].quantityUsed is required`);
        } else if (typeof part['quantityUsed'] !== 'number') {
          errors.push(`partsUsed[${i}].quantityUsed must be a number`);
        } else if (part['quantityUsed'] < 0) {
          errors.push(`partsUsed[${i}].quantityUsed must be non-negative`);
        } else if (!Number.isInteger(part['quantityUsed'])) {
          errors.push(`partsUsed[${i}].quantityUsed must be an integer`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  let partsUsed: PartUsage[] | undefined;
  if (request['partsUsed'] && Array.isArray(request['partsUsed'])) {
    partsUsed = (request['partsUsed'] as Record<string, unknown>[]).map(p => ({
      partId: p['partId'] as string,
      quantityUsed: p['quantityUsed'] as number,
    }));
  }

  return {
    valid: true,
    data: {
      partsUsed,
    },
  };
}

/**
 * Lambda handler for consuming parts
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Consume parts request received', { requestId });

  try {
    // Get work order ID from path parameters
    const workOrderId = event.pathParameters?.['workOrderId'];
    if (!workOrderId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workOrderId is required in path', requestId)
      );
    }

    const uuidError = validateUUID(workOrderId, 'workOrderId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Parse request body
    let body: unknown = null;
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
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

    // Consume parts
    const consumedParts = await partsInventoryService.consumeParts(
      workOrderId,
      validation.data.partsUsed
    );

    logger.info('Parts consumed successfully', {
      requestId,
      workOrderId,
      partsConsumed: consumedParts.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        workOrderId,
        partsConsumed: consumedParts,
        totalPartsCost: consumedParts.reduce((sum, p) => sum + (p.totalCost ?? 0), 0),
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to consume parts', err, { requestId });

    if (err.message.includes('not found') || err.message.includes('No parts found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot consume')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to consume parts', requestId)
    );
  }
}
