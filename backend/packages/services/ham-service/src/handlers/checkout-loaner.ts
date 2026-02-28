/**
 * Checkout Loaner Lambda Handler
 *
 * Checks out a loaner asset to a user with due date tracking.
 * Requirement 3.8: Track loaner checkouts with due dates
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { AssetCondition, CreateLoanerCheckoutRequest } from '../loaner/loaner-service';
import * as loanerService from '../loaner/loaner-service';

const logger = createLogger({ service: 'checkout-loaner-handler' });

/**
 * Valid asset conditions for checkout
 */
const VALID_CONDITIONS: AssetCondition[] = [
  'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'
];

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: CreateLoanerCheckoutRequest; userId: string } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate assetId (required)
  if (!request['assetId']) {
    errors.push('assetId is required');
  } else if (typeof request['assetId'] !== 'string') {
    errors.push('assetId must be a string');
  } else {
    const uuidError = validateUUID(request['assetId'] as string, 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate checkedOutTo (required)
  if (!request['checkedOutTo']) {
    errors.push('checkedOutTo is required');
  } else if (typeof request['checkedOutTo'] !== 'string') {
    errors.push('checkedOutTo must be a string');
  } else {
    const uuidError = validateUUID(request['checkedOutTo'] as string, 'checkedOutTo');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate dueDate (required)
  if (!request['dueDate']) {
    errors.push('dueDate is required');
  } else if (typeof request['dueDate'] !== 'string') {
    errors.push('dueDate must be a string');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request['dueDate'] as string)) {
      errors.push('dueDate must be in YYYY-MM-DD format');
    } else {
      const date = new Date(request['dueDate'] as string);
      if (isNaN(date.getTime())) {
        errors.push('dueDate is not a valid date');
      }
    }
  }

  // Validate conditionOut (required)
  if (!request['conditionOut']) {
    errors.push('conditionOut is required');
  } else if (typeof request['conditionOut'] !== 'string') {
    errors.push('conditionOut must be a string');
  } else if (!VALID_CONDITIONS.includes(request['conditionOut'] as AssetCondition)) {
    errors.push(`conditionOut must be one of: ${VALID_CONDITIONS.join(', ')}`);
  }

  // Validate optional string fields
  const optionalStringFields = ['conditionOutNotes', 'purpose', 'projectCode', 'notes'];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null) {
      if (typeof request[field] !== 'string') {
        errors.push(`${field} must be a string`);
      } else if ((request[field] as string).length > 1000) {
        errors.push(`${field} exceeds maximum length of 1000 characters`);
      }
    }
  }

  // Validate optional UUID fields
  const optionalUuidFields = ['departmentId', 'costCenterId'];
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

  // Validate dailyRate (optional)
  if (request['dailyRate'] !== undefined && request['dailyRate'] !== null) {
    if (typeof request['dailyRate'] !== 'number' || request['dailyRate'] < 0) {
      errors.push('dailyRate must be a non-negative number');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    userId: request['checkedOutTo'] as string,
    data: {
      assetId: request['assetId'] as string,
      checkedOutTo: request['checkedOutTo'] as string,
      checkedOutBy: '', // Will be set from auth context
      dueDate: request['dueDate'] as string,
      conditionOut: request['conditionOut'] as AssetCondition,
      conditionOutNotes: request['conditionOutNotes'] as string | undefined,
      purpose: request['purpose'] as string | undefined,
      departmentId: request['departmentId'] as string | undefined,
      costCenterId: request['costCenterId'] as string | undefined,
      projectCode: request['projectCode'] as string | undefined,
      dailyRate: request['dailyRate'] as number | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for checking out a loaner asset
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Checkout loaner request received', { requestId });

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
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Set the checkedOutBy from auth context
    const checkoutRequest: CreateLoanerCheckoutRequest = {
      ...validation.data,
      checkedOutBy: userId,
    };

    // Process the checkout
    const result = await loanerService.checkoutLoaner(checkoutRequest);

    logger.info('Loaner checkout successful', {
      requestId,
      checkoutId: result.checkout.checkoutId,
      checkoutNumber: result.checkout.checkoutNumber,
      assetId: result.checkout.assetId,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to checkout loaner', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not available')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err.message.includes('Due date must be')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to checkout loaner', requestId)
    );
  }
}
