/**
 * Update Inventory Lambda Handler
 *
 * Updates inventory quantities and settings for a stockroom item.
 * Generates replenishment alerts when stock falls below threshold.
 * Requirements: 3.2, 3.3
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import type { UpdateInventoryRequest } from '../stockroom/stockroom-service';
import * as stockroomService from '../stockroom/stockroom-service';

const logger = createLogger({ service: 'update-inventory-handler' });

/**
 * Validate update inventory request
 */
function validateRequest(body: unknown): { valid: true; data: UpdateInventoryRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate quantity fields are non-negative integers
  const quantityFields = ['quantityOnHand', 'quantityReserved', 'quantityInTransit', 'quantityOnOrder'];
  for (const field of quantityFields) {
    const value = request[field];
    if (value !== undefined) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        errors.push(`${field} must be a non-negative integer`);
      }
    }
  }

  // Validate reorder settings
  const reorderFields = ['reorderPoint', 'reorderQuantity', 'maxQuantity'];
  for (const field of reorderFields) {
    const value = request[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        errors.push(`${field} must be a non-negative integer or null`);
      }
    }
  }

  // Validate reorderQuantity is positive if set
  if (request['reorderQuantity'] !== undefined && request['reorderQuantity'] !== null) {
    if ((request['reorderQuantity'] as number) <= 0) {
      errors.push('reorderQuantity must be greater than 0');
    }
  }

  // Validate unitCost
  if (request['unitCost'] !== undefined && request['unitCost'] !== null) {
    if (typeof request['unitCost'] !== 'number' || request['unitCost'] < 0) {
      errors.push('unitCost must be a non-negative number');
    }
  }

  // Validate string fields
  const result = validate()
    .stringLength(request['binLocation'] as string | undefined, 'binLocation', 0, 50)
    .stringLength(request['shelfLocation'] as string | undefined, 'shelfLocation', 0, 50)
    .result();

  if (!result.isValid) {
    errors.push(...result.errors.map(e => e.message));
  }

  // Validate isActive
  if (request['isActive'] !== undefined && typeof request['isActive'] !== 'boolean') {
    errors.push('isActive must be a boolean');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      quantityOnHand: request['quantityOnHand'] as number | undefined,
      quantityReserved: request['quantityReserved'] as number | undefined,
      quantityInTransit: request['quantityInTransit'] as number | undefined,
      quantityOnOrder: request['quantityOnOrder'] as number | undefined,
      reorderPoint: request['reorderPoint'] as number | undefined,
      reorderQuantity: request['reorderQuantity'] as number | undefined,
      maxQuantity: request['maxQuantity'] as number | undefined,
      unitCost: request['unitCost'] as number | undefined,
      binLocation: request['binLocation'] as string | undefined,
      shelfLocation: request['shelfLocation'] as string | undefined,
      isActive: request['isActive'] as boolean | undefined,
    },
  };
}

/**
 * Lambda handler for updating inventory
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const inventoryId = event.pathParameters?.['inventoryId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update inventory request received', { requestId, inventoryId });

  try {
    // Validate inventory ID
    if (!inventoryId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Inventory ID is required', requestId)
      );
    }

    const uuidError = validateUUID(inventoryId, 'inventoryId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
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

    // Update inventory
    const result = await stockroomService.updateInventory(inventoryId, validation.data, userId);

    logger.info('Inventory updated successfully', {
      requestId,
      inventoryId,
      alertsGenerated: result.alerts.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        item: result.item,
        alerts: result.alerts,
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update inventory', err, { requestId, inventoryId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Insufficient')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update inventory', requestId)
    );
  }
}
