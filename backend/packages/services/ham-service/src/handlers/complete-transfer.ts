/**
 * Complete Transfer Lambda Handler
 *
 * Completes a transfer order by receiving items and updating inventory quantities.
 * Requirement 3.10: Process asset movements between stockrooms with approval workflows
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { AssetCondition, CompleteTransferRequest, LineReceiptRequest } from '../transfer/transfer-service';
import * as transferService from '../transfer/transfer-service';

const logger = createLogger({ service: 'complete-transfer-handler' });

/**
 * Valid asset conditions
 */
const VALID_CONDITIONS: AssetCondition[] = [
  'NEW',
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
  'UNKNOWN',
];

/**
 * Validate a single line receipt
 */
function validateLineReceipt(receipt: unknown, index: number): { valid: true; data: LineReceiptRequest } | { valid: false; errors: string[] } {
  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, errors: [`Receipt ${index + 1}: must be an object`] };
  }

  const receiptObj = receipt as Record<string, unknown>;
  const errors: string[] = [];

  // Validate lineId (required)
  if (!receiptObj['lineId']) {
    errors.push(`Receipt ${index + 1}: lineId is required`);
  } else if (typeof receiptObj['lineId'] !== 'string') {
    errors.push(`Receipt ${index + 1}: lineId must be a string`);
  } else {
    const uuidError = validateUUID(receiptObj['lineId'] as string, 'lineId');
    if (uuidError) {
      errors.push(`Receipt ${index + 1}: ${uuidError.message}`);
    }
  }

  // Validate receivedQuantity (required)
  if (receiptObj['receivedQuantity'] === undefined || receiptObj['receivedQuantity'] === null) {
    errors.push(`Receipt ${index + 1}: receivedQuantity is required`);
  } else if (typeof receiptObj['receivedQuantity'] !== 'number') {
    errors.push(`Receipt ${index + 1}: receivedQuantity must be a number`);
  } else if (receiptObj['receivedQuantity'] < 0) {
    errors.push(`Receipt ${index + 1}: receivedQuantity cannot be negative`);
  } else if (!Number.isInteger(receiptObj['receivedQuantity'])) {
    errors.push(`Receipt ${index + 1}: receivedQuantity must be an integer`);
  }

  // Validate damagedQuantity (optional)
  if (receiptObj['damagedQuantity'] !== undefined && receiptObj['damagedQuantity'] !== null) {
    if (typeof receiptObj['damagedQuantity'] !== 'number') {
      errors.push(`Receipt ${index + 1}: damagedQuantity must be a number`);
    } else if (receiptObj['damagedQuantity'] < 0) {
      errors.push(`Receipt ${index + 1}: damagedQuantity cannot be negative`);
    } else if (!Number.isInteger(receiptObj['damagedQuantity'])) {
      errors.push(`Receipt ${index + 1}: damagedQuantity must be an integer`);
    }
  }

  // Validate conditionReceived (optional)
  if (receiptObj['conditionReceived'] !== undefined && receiptObj['conditionReceived'] !== null) {
    if (typeof receiptObj['conditionReceived'] !== 'string') {
      errors.push(`Receipt ${index + 1}: conditionReceived must be a string`);
    } else if (!VALID_CONDITIONS.includes(receiptObj['conditionReceived'] as AssetCondition)) {
      errors.push(`Receipt ${index + 1}: conditionReceived must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }
  }

  // Validate conditionNotes (optional)
  if (receiptObj['conditionNotes'] !== undefined && receiptObj['conditionNotes'] !== null) {
    if (typeof receiptObj['conditionNotes'] !== 'string') {
      errors.push(`Receipt ${index + 1}: conditionNotes must be a string`);
    } else if ((receiptObj['conditionNotes'] as string).length > 2000) {
      errors.push(`Receipt ${index + 1}: conditionNotes exceeds maximum length of 2000 characters`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      lineId: receiptObj['lineId'] as string,
      receivedQuantity: receiptObj['receivedQuantity'] as number,
      damagedQuantity: receiptObj['damagedQuantity'] as number | undefined,
      conditionReceived: receiptObj['conditionReceived'] as AssetCondition | undefined,
      conditionNotes: receiptObj['conditionNotes'] as string | undefined,
    },
  };
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: Omit<CompleteTransferRequest, 'receivedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate receivingNotes (optional)
  if (request['receivingNotes'] !== undefined && request['receivingNotes'] !== null) {
    if (typeof request['receivingNotes'] !== 'string') {
      errors.push('receivingNotes must be a string');
    } else if ((request['receivingNotes'] as string).length > 2000) {
      errors.push('receivingNotes exceeds maximum length of 2000 characters');
    }
  }

  // Validate lineReceipts (required)
  if (!request['lineReceipts']) {
    errors.push('lineReceipts is required');
  } else if (!Array.isArray(request['lineReceipts'])) {
    errors.push('lineReceipts must be an array');
  } else if (request['lineReceipts'].length === 0) {
    errors.push('lineReceipts must contain at least one item');
  } else {
    // Validate each line receipt
    const validatedReceipts: LineReceiptRequest[] = [];
    for (let i = 0; i < request['lineReceipts'].length; i++) {
      const receiptValidation = validateLineReceipt(request['lineReceipts'][i], i);
      if (!receiptValidation.valid) {
        errors.push(...receiptValidation.errors);
      } else {
        validatedReceipts.push(receiptValidation.data);
      }
    }

    if (errors.length === 0) {
      return {
        valid: true,
        data: {
          receivingNotes: request['receivingNotes'] as string | undefined,
          lineReceipts: validatedReceipts,
        },
      };
    }
  }

  return { valid: false, errors };
}

/**
 * Lambda handler for completing a transfer order
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const claims = event.requestContext.authorizer?.['claims'] as Record<string, string> | undefined;
  const authSub = claims?.['sub'];
  const userId =
    (await resolveUserIdFromAuthId(authSub)) ??
    (await ensureUserIdFromAuthClaims({
      sub: authSub ?? '',
      email: claims?.['email'],
      givenName: claims?.['given_name'],
      familyName: claims?.['family_name'],
    }));

  // Get transferId from path parameters
  const transferId = event.pathParameters?.['transferId'];

  logger.info('Complete transfer request received', { requestId, transferId });

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

    // Validate transferId
    if (!transferId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'transferId is required in path', requestId)
      );
    }

    const transferIdError = validateUUID(transferId, 'transferId');
    if (transferIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, transferIdError.message, requestId)
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

    // Create the complete transfer request
    const completeRequest: CompleteTransferRequest = {
      ...validation.data,
      receivedBy: userId,
    };

    // Complete the transfer
    const result = await transferService.completeTransfer(transferId, completeRequest);

    logger.info('Transfer order completed', {
      requestId,
      transferId: result.transfer.transferId,
      transferNumber: result.transfer.transferNumber,
      status: result.transfer.status,
      receivedBy: userId,
      inventoryUpdated: result.inventoryUpdated,
      fromStockroomUpdated: result.fromStockroomUpdated,
      toStockroomUpdated: result.toStockroomUpdated,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to complete transfer', err, { requestId, transferId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot complete')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (
      err.message.includes('OVER_RECEIPT') ||
      err.message.includes('INVALID_RECEIPT') ||
      err.message.includes('UNKNOWN_RECEIPT_LINE') ||
      err.message.includes('INVALID_TRANSFER_LINE')
    ) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    if (err.message.includes('Insufficient inventory')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to complete transfer', requestId)
    );
  }
}

