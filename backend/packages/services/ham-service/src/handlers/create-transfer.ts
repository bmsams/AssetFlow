/**
 * Create Transfer Lambda Handler
 *
 * Creates a new transfer order for moving assets/inventory between stockrooms.
 * Requirement 3.10: Process asset movements between stockrooms with approval workflows
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { CreateTransferLineRequest, CreateTransferOrderRequest, TransferPriority } from '../transfer/transfer-service';
import * as transferService from '../transfer/transfer-service';

const logger = createLogger({ service: 'create-transfer-handler' });

/**
 * Valid transfer priorities
 */
const VALID_PRIORITIES: TransferPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];

/**
 * Validate a single line item
 */
function validateLineItem(line: unknown, index: number): { valid: true; data: CreateTransferLineRequest } | { valid: false; errors: string[] } {
  if (!line || typeof line !== 'object') {
    return { valid: false, errors: [`Line ${index + 1}: must be an object`] };
  }

  const lineObj = line as Record<string, unknown>;
  const errors: string[] = [];

  // Must have either assetId or productId
  if (!lineObj['assetId'] && !lineObj['productId']) {
    errors.push(`Line ${index + 1}: must have either assetId or productId`);
  }

  // Validate assetId if provided
  if (lineObj['assetId'] !== undefined && lineObj['assetId'] !== null) {
    if (typeof lineObj['assetId'] !== 'string') {
      errors.push(`Line ${index + 1}: assetId must be a string`);
    } else {
      const uuidError = validateUUID(lineObj['assetId'] as string, 'assetId');
      if (uuidError) {
        errors.push(`Line ${index + 1}: ${uuidError.message}`);
      }
    }
  }

  // Validate productId if provided
  if (lineObj['productId'] !== undefined && lineObj['productId'] !== null) {
    if (typeof lineObj['productId'] !== 'string') {
      errors.push(`Line ${index + 1}: productId must be a string`);
    } else {
      const uuidError = validateUUID(lineObj['productId'] as string, 'productId');
      if (uuidError) {
        errors.push(`Line ${index + 1}: ${uuidError.message}`);
      }
    }
  }

  // Validate quantity (required)
  if (lineObj['quantity'] === undefined || lineObj['quantity'] === null) {
    errors.push(`Line ${index + 1}: quantity is required`);
  } else if (typeof lineObj['quantity'] !== 'number') {
    errors.push(`Line ${index + 1}: quantity must be a number`);
  } else if (lineObj['quantity'] <= 0) {
    errors.push(`Line ${index + 1}: quantity must be greater than 0`);
  } else if (!Number.isInteger(lineObj['quantity'])) {
    errors.push(`Line ${index + 1}: quantity must be an integer`);
  }

  // Validate optional string fields
  const optionalStringFields = ['productType', 'productDescription', 'serialNumber', 'assetTag', 'notes'];
  for (const field of optionalStringFields) {
    if (lineObj[field] !== undefined && lineObj[field] !== null && typeof lineObj[field] !== 'string') {
      errors.push(`Line ${index + 1}: ${field} must be a string`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      assetId: lineObj['assetId'] as string | undefined,
      productId: lineObj['productId'] as string | undefined,
      productType: lineObj['productType'] as string | undefined,
      productDescription: lineObj['productDescription'] as string | undefined,
      serialNumber: lineObj['serialNumber'] as string | undefined,
      assetTag: lineObj['assetTag'] as string | undefined,
      quantity: lineObj['quantity'] as number,
      notes: lineObj['notes'] as string | undefined,
    },
  };
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: Omit<CreateTransferOrderRequest, 'requestedBy'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate fromStockroomId (required)
  if (!request['fromStockroomId']) {
    errors.push('fromStockroomId is required');
  } else if (typeof request['fromStockroomId'] !== 'string') {
    errors.push('fromStockroomId must be a string');
  } else {
    const uuidError = validateUUID(request['fromStockroomId'] as string, 'fromStockroomId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate toStockroomId (required)
  if (!request['toStockroomId']) {
    errors.push('toStockroomId is required');
  } else if (typeof request['toStockroomId'] !== 'string') {
    errors.push('toStockroomId must be a string');
  } else {
    const uuidError = validateUUID(request['toStockroomId'] as string, 'toStockroomId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate stockrooms are different
  if (request['fromStockroomId'] && request['toStockroomId'] && 
      request['fromStockroomId'] === request['toStockroomId']) {
    errors.push('fromStockroomId and toStockroomId must be different');
  }

  // Validate priority (optional)
  if (request['priority'] !== undefined && request['priority'] !== null) {
    if (typeof request['priority'] !== 'string') {
      errors.push('priority must be a string');
    } else if (!VALID_PRIORITIES.includes(request['priority'] as TransferPriority)) {
      errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  // Validate reason (optional)
  if (request['reason'] !== undefined && request['reason'] !== null) {
    if (typeof request['reason'] !== 'string') {
      errors.push('reason must be a string');
    } else if ((request['reason'] as string).length > 2000) {
      errors.push('reason exceeds maximum length of 2000 characters');
    }
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    } else if ((request['notes'] as string).length > 2000) {
      errors.push('notes exceeds maximum length of 2000 characters');
    }
  }

  // Validate lines (required)
  if (!request['lines']) {
    errors.push('lines is required');
  } else if (!Array.isArray(request['lines'])) {
    errors.push('lines must be an array');
  } else if (request['lines'].length === 0) {
    errors.push('lines must contain at least one item');
  } else {
    // Validate each line item
    const validatedLines: CreateTransferLineRequest[] = [];
    for (let i = 0; i < request['lines'].length; i++) {
      const lineValidation = validateLineItem(request['lines'][i], i);
      if (!lineValidation.valid) {
        errors.push(...lineValidation.errors);
      } else {
        validatedLines.push(lineValidation.data);
      }
    }

    if (errors.length === 0) {
      return {
        valid: true,
        data: {
          fromStockroomId: request['fromStockroomId'] as string,
          toStockroomId: request['toStockroomId'] as string,
          priority: request['priority'] as TransferPriority | undefined,
          reason: request['reason'] as string | undefined,
          notes: request['notes'] as string | undefined,
          lines: validatedLines,
        },
      };
    }
  }

  return { valid: false, errors };
}

/**
 * Lambda handler for creating a transfer order
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

  logger.info('Create transfer request received', { requestId });

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
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Create the transfer order request
    const transferRequest: CreateTransferOrderRequest = {
      ...validation.data,
      requestedBy: userId,
    };

    // Create the transfer order
    const result = await transferService.createTransfer(transferRequest);

    logger.info('Transfer order created', {
      requestId,
      transferId: result.transfer.transferId,
      transferNumber: result.transfer.transferNumber,
      fromStockroomId: result.transfer.fromStockroomId,
      toStockroomId: result.transfer.toStockroomId,
      lineCount: result.lines.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create transfer order', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('must be different') || err.message.includes('must have')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create transfer order', requestId)
    );
  }
}

