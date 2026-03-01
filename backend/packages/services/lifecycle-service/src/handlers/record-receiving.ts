/**
 * Record Receiving Lambda Handler
 *
 * Records receiving of assets from a purchase order or manually.
 * Requirement 6.4, 6.5: Record receiving and link to purchase order
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

import type {
  RecordReceivingFromPOInput,
  RecordReceivingManualInput,
} from '../receiving/receiving-service';
import * as receivingService from '../receiving/receiving-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'record-receiving-handler' });

interface CodedError extends Error {
  code?: string;
}

const CONFLICT_ERROR_PATTERNS = [
  'duplicate key value',
  'unique constraint',
  'already exists',
];

const BAD_REQUEST_ERROR_PATTERNS = [
  'cannot be received',
  'No receivable lines',
  'is required',
  'must be',
  'No active stockroom',
  'no remaining quantity to receive',
];

function isConflictError(error: CodedError): boolean {
  if (error.code === '23505') {
    return true;
  }

  return CONFLICT_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern));
}

function isBadRequestError(error: CodedError): boolean {
  return BAD_REQUEST_ERROR_PATTERNS.some((pattern) => error.message.includes(pattern));
}

/**
 * Validate a manual receiving line
 */
function validateManualLine(
  item: unknown,
  index: number
): { valid: true; data: RecordReceivingManualInput['lines'][0] } | { valid: false; errors: string[] } {
  if (!item || typeof item !== 'object') {
    return { valid: false, errors: [`Line ${index + 1}: must be an object`] };
  }

  const itemObj = item as Record<string, unknown>;
  const errors: string[] = [];

  // Validate productName (required)
  if (!itemObj['productName']) {
    errors.push(`Line ${index + 1}: productName is required`);
  } else if (typeof itemObj['productName'] !== 'string') {
    errors.push(`Line ${index + 1}: productName must be a string`);
  } else if ((itemObj['productName'] as string).trim().length === 0) {
    errors.push(`Line ${index + 1}: productName cannot be empty`);
  }

  // Validate quantityExpected (required)
  if (itemObj['quantityExpected'] === undefined || itemObj['quantityExpected'] === null) {
    errors.push(`Line ${index + 1}: quantityExpected is required`);
  } else if (typeof itemObj['quantityExpected'] !== 'number') {
    errors.push(`Line ${index + 1}: quantityExpected must be a number`);
  } else if (itemObj['quantityExpected'] <= 0) {
    errors.push(`Line ${index + 1}: quantityExpected must be greater than 0`);
  } else if (!Number.isInteger(itemObj['quantityExpected'])) {
    errors.push(`Line ${index + 1}: quantityExpected must be an integer`);
  }

  // Validate optional UUID fields
  if (itemObj['productId'] !== undefined && itemObj['productId'] !== null) {
    if (typeof itemObj['productId'] !== 'string') {
      errors.push(`Line ${index + 1}: productId must be a string`);
    } else {
      const uuidError = validateUUID(itemObj['productId'] as string, 'productId');
      if (uuidError) {
        errors.push(`Line ${index + 1}: ${uuidError.message}`);
      }
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['productType', 'notes'];
  for (const field of optionalStringFields) {
    if (itemObj[field] !== undefined && itemObj[field] !== null && typeof itemObj[field] !== 'string') {
      errors.push(`Line ${index + 1}: ${field} must be a string`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      productName: itemObj['productName'] as string,
      productId: itemObj['productId'] as string | undefined,
      productType: itemObj['productType'] as string | undefined,
      quantityExpected: itemObj['quantityExpected'] as number,
      notes: itemObj['notes'] as string | undefined,
    },
  };
}

/**
 * Validate record receiving request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: { type: 'po'; input: Omit<RecordReceivingFromPOInput, 'receivedBy'> } |
        { type: 'manual'; input: Omit<RecordReceivingManualInput, 'receivedBy'> };
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Determine if this is a PO-based or manual receiving
  const hasPOId = request['poId'] !== undefined && request['poId'] !== null;
  const hasLines = request['lines'] !== undefined && request['lines'] !== null;

  if (hasPOId && hasLines) {
    errors.push('Cannot specify both poId and lines. Use poId for PO-based receiving or lines for manual receiving.');
    return { valid: false, errors };
  }

  if (!hasPOId && !hasLines) {
    errors.push('Either poId (for PO-based receiving) or lines (for manual receiving) is required');
    return { valid: false, errors };
  }

  // Validate common optional fields
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

  if (request['receivedByName'] !== undefined && request['receivedByName'] !== null) {
    if (typeof request['receivedByName'] !== 'string') {
      errors.push('receivedByName must be a string');
    }
  }

  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    }
  }

  if (hasPOId) {
    // Validate PO-based receiving
    if (typeof request['poId'] !== 'string') {
      errors.push('poId must be a string');
    } else {
      const uuidError = validateUUID(request['poId'] as string, 'poId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }

    // Validate optional poLineIds
    if (request['poLineIds'] !== undefined && request['poLineIds'] !== null) {
      if (!Array.isArray(request['poLineIds'])) {
        errors.push('poLineIds must be an array');
      } else {
        for (let i = 0; i < request['poLineIds'].length; i++) {
          const lineId = request['poLineIds'][i];
          if (typeof lineId !== 'string') {
            errors.push(`poLineIds[${i}] must be a string`);
          } else {
            const uuidError = validateUUID(lineId as string, `poLineIds[${i}]`);
            if (uuidError) {
              errors.push(uuidError.message);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: {
        type: 'po',
        input: {
          poId: request['poId'] as string,
          receivedByName: request['receivedByName'] as string | undefined,
          stockroomId: request['stockroomId'] as string | undefined,
          notes: request['notes'] as string | undefined,
          poLineIds: request['poLineIds'] as string[] | undefined,
        },
      },
    };
  } else {
    // Validate manual receiving
    if (!Array.isArray(request['lines'])) {
      errors.push('lines must be an array');
      return { valid: false, errors };
    }

    if (request['lines'].length === 0) {
      errors.push('lines must contain at least one item');
      return { valid: false, errors };
    }

    const validatedLines: RecordReceivingManualInput['lines'] = [];
    for (let i = 0; i < request['lines'].length; i++) {
      const lineValidation = validateManualLine(request['lines'][i], i);
      if (!lineValidation.valid) {
        errors.push(...lineValidation.errors);
      } else {
        validatedLines.push(lineValidation.data);
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return {
      valid: true,
      data: {
        type: 'manual',
        input: {
          receivedByName: request['receivedByName'] as string | undefined,
          stockroomId: request['stockroomId'] as string | undefined,
          notes: request['notes'] as string | undefined,
          lines: validatedLines,
        },
      },
    };
  }
}

/**
 * Lambda handler for recording receiving
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Record receiving request received', { requestId });

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

    // Process receiving based on type
    let result: receivingService.RecordReceivingResult;

    if (validation.data.type === 'po') {
      const input: RecordReceivingFromPOInput = {
        ...validation.data.input,
        receivedBy: userId,
      };
      result = await receivingService.recordReceivingFromPO(input);
    } else {
      const input: RecordReceivingManualInput = {
        ...validation.data.input,
        receivedBy: userId,
      };
      result = await receivingService.recordReceivingManual(input);
    }

    logger.info('Receiving recorded', {
      requestId,
      receivingId: result.receivingRecord.receivingId,
      poId: result.receivingRecord.poId,
      lineCount: result.lines.length,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as CodedError;
    logger.error('Failed to record receiving', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (isConflictError(err)) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (isBadRequestError(err)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record receiving', requestId)
    );
  }
}
