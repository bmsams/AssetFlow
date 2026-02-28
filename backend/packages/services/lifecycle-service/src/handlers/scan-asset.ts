/**
 * Scan Asset Lambda Handler
 *
 * Scans an asset barcode/serial number and creates an asset record.
 * Requirement 6.4: Support barcode scanning to create asset records automatically
 * Requirement 6.5: Update status to In_Stock and associate with purchase order
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

import type { ReceivingCondition, ScanAssetInput } from '../receiving/receiving-service';
import * as receivingService from '../receiving/receiving-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'scan-asset-handler' });

/**
 * Valid receiving conditions
 */
const VALID_CONDITIONS: ReceivingCondition[] = ['NEW', 'GOOD', 'DAMAGED', 'DEFECTIVE'];

/**
 * Validate scan asset request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: ScanAssetInput;
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

  // Validate serialNumber (optional)
  if (request['serialNumber'] !== undefined && request['serialNumber'] !== null) {
    if (typeof request['serialNumber'] !== 'string') {
      errors.push('serialNumber must be a string');
    } else if ((request['serialNumber'] as string).trim().length === 0) {
      errors.push('serialNumber cannot be empty if provided');
    }
  }

  // Validate barcode (optional)
  if (request['barcode'] !== undefined && request['barcode'] !== null) {
    if (typeof request['barcode'] !== 'string') {
      errors.push('barcode must be a string');
    } else if ((request['barcode'] as string).trim().length === 0) {
      errors.push('barcode cannot be empty if provided');
    }
  }

  // Validate condition (optional)
  if (request['condition'] !== undefined && request['condition'] !== null) {
    if (typeof request['condition'] !== 'string') {
      errors.push('condition must be a string');
    } else if (!VALID_CONDITIONS.includes(request['condition'] as ReceivingCondition)) {
      errors.push(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }
  }

  // Validate productName (optional)
  if (request['productName'] !== undefined && request['productName'] !== null) {
    if (typeof request['productName'] !== 'string') {
      errors.push('productName must be a string');
    }
  }

  // Validate productType (optional)
  if (request['productType'] !== undefined && request['productType'] !== null) {
    if (typeof request['productType'] !== 'string') {
      errors.push('productType must be a string');
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
      serialNumber: request['serialNumber'] as string | undefined,
      barcode: request['barcode'] as string | undefined,
      condition: request['condition'] as ReceivingCondition | undefined,
      productName: request['productName'] as string | undefined,
      productType: request['productType'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for scanning an asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Scan asset request received', { requestId });

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

    // Scan the asset
    const result = await receivingService.scanAsset(validation.data);

    logger.info('Asset scanned successfully', {
      requestId,
      assetId: result.asset.assetId,
      assetTag: result.asset.assetTag,
      serialNumber: result.asset.serialNumber,
      receivingLineId: validation.data.receivingLineId,
      isLineComplete: result.isLineComplete,
      isReceivingComplete: result.isReceivingComplete,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to scan asset', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('All items already received')) {
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to scan asset', requestId)
    );
  }
}
