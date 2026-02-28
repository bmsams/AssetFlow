/**
 * Submit Request Lambda Handler
 *
 * Creates and submits a new request for assets/items.
 * Requirement 6.1: Create a request record and initiate approval workflow
 * Requirement 6B.3: Capture requester, items, quantities, justification
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { RequestPriority, SubmitRequestInput, SubmitRequestItemInput } from '../request/request-service';
import * as requestService from '../request/request-service';
import { getUserContext } from '../utils/user-context';

const logger = createLogger({ service: 'submit-request-handler' });

/**
 * Valid request priorities
 */
const VALID_PRIORITIES: RequestPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];

/**
 * Validate a single item
 */
function validateItem(item: unknown, index: number): { valid: true; data: SubmitRequestItemInput } | { valid: false; errors: string[] } {
  if (!item || typeof item !== 'object') {
    return { valid: false, errors: [`Item ${index + 1}: must be an object`] };
  }

  const itemObj = item as Record<string, unknown>;
  const errors: string[] = [];

  // Validate productName (required)
  if (!itemObj['productName']) {
    errors.push(`Item ${index + 1}: productName is required`);
  } else if (typeof itemObj['productName'] !== 'string') {
    errors.push(`Item ${index + 1}: productName must be a string`);
  } else if ((itemObj['productName'] as string).trim().length === 0) {
    errors.push(`Item ${index + 1}: productName cannot be empty`);
  }

  // Validate quantity (required)
  if (itemObj['quantity'] === undefined || itemObj['quantity'] === null) {
    errors.push(`Item ${index + 1}: quantity is required`);
  } else if (typeof itemObj['quantity'] !== 'number') {
    errors.push(`Item ${index + 1}: quantity must be a number`);
  } else if (itemObj['quantity'] <= 0) {
    errors.push(`Item ${index + 1}: quantity must be greater than 0`);
  } else if (!Number.isInteger(itemObj['quantity'])) {
    errors.push(`Item ${index + 1}: quantity must be an integer`);
  }

  // Validate optional UUID fields
  const optionalUuidFields = ['catalogItemId', 'productId'];
  for (const field of optionalUuidFields) {
    if (itemObj[field] !== undefined && itemObj[field] !== null) {
      if (typeof itemObj[field] !== 'string') {
        errors.push(`Item ${index + 1}: ${field} must be a string`);
      } else {
        const uuidError = validateUUID(itemObj[field] as string, field);
        if (uuidError) {
          errors.push(`Item ${index + 1}: ${uuidError.message}`);
        }
      }
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['productType', 'productDescription', 'justification', 'specifications', 'notes'];
  for (const field of optionalStringFields) {
    if (itemObj[field] !== undefined && itemObj[field] !== null && typeof itemObj[field] !== 'string') {
      errors.push(`Item ${index + 1}: ${field} must be a string`);
    }
  }

  // Validate unitPrice (optional number)
  if (itemObj['unitPrice'] !== undefined && itemObj['unitPrice'] !== null) {
    if (typeof itemObj['unitPrice'] !== 'number') {
      errors.push(`Item ${index + 1}: unitPrice must be a number`);
    } else if (itemObj['unitPrice'] < 0) {
      errors.push(`Item ${index + 1}: unitPrice cannot be negative`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      catalogItemId: itemObj['catalogItemId'] as string | undefined,
      productId: itemObj['productId'] as string | undefined,
      productType: itemObj['productType'] as string | undefined,
      productName: itemObj['productName'] as string,
      productDescription: itemObj['productDescription'] as string | undefined,
      quantity: itemObj['quantity'] as number,
      unitPrice: itemObj['unitPrice'] as number | undefined,
      justification: itemObj['justification'] as string | undefined,
      specifications: itemObj['specifications'] as string | undefined,
      notes: itemObj['notes'] as string | undefined,
    },
  };
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: Omit<SubmitRequestInput, 'requesterId'> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate justification (required)
  if (!request['justification']) {
    errors.push('justification is required');
  } else if (typeof request['justification'] !== 'string') {
    errors.push('justification must be a string');
  } else if ((request['justification'] as string).trim().length === 0) {
    errors.push('justification cannot be empty');
  } else if ((request['justification'] as string).length > 2000) {
    errors.push('justification exceeds maximum length of 2000 characters');
  }

  // Validate deliveryLocation (required)
  if (!request['deliveryLocation']) {
    errors.push('deliveryLocation is required');
  } else if (typeof request['deliveryLocation'] !== 'string') {
    errors.push('deliveryLocation must be a string');
  } else if ((request['deliveryLocation'] as string).trim().length === 0) {
    errors.push('deliveryLocation cannot be empty');
  }

  // Validate priority (optional)
  if (request['priority'] !== undefined && request['priority'] !== null) {
    if (typeof request['priority'] !== 'string') {
      errors.push('priority must be a string');
    } else if (!VALID_PRIORITIES.includes(request['priority'] as RequestPriority)) {
      errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  // Validate optional string fields
  const optionalStringFields = [
    'requesterName', 'requesterEmail', 'requesterDepartment', 'requestType',
    'businessNeed', 'deliveryAddress', 'deliveryInstructions', 'projectCode', 'notes'
  ];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate costCenterId (optional UUID)
  if (request['costCenterId'] !== undefined && request['costCenterId'] !== null) {
    if (typeof request['costCenterId'] !== 'string') {
      errors.push('costCenterId must be a string');
    } else {
      const uuidError = validateUUID(request['costCenterId'] as string, 'costCenterId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate requestedDeliveryDate (optional ISO date string)
  if (request['requestedDeliveryDate'] !== undefined && request['requestedDeliveryDate'] !== null) {
    if (typeof request['requestedDeliveryDate'] !== 'string') {
      errors.push('requestedDeliveryDate must be a string');
    } else {
      const date = new Date(request['requestedDeliveryDate'] as string);
      if (isNaN(date.getTime())) {
        errors.push('requestedDeliveryDate must be a valid ISO date string');
      }
    }
  }

  // Validate items (required)
  if (!request['items']) {
    errors.push('items is required');
  } else if (!Array.isArray(request['items'])) {
    errors.push('items must be an array');
  } else if (request['items'].length === 0) {
    errors.push('items must contain at least one item');
  } else {
    // Validate each item
    const validatedItems: SubmitRequestItemInput[] = [];
    for (let i = 0; i < request['items'].length; i++) {
      const itemValidation = validateItem(request['items'][i], i);
      if (!itemValidation.valid) {
        errors.push(...itemValidation.errors);
      } else {
        validatedItems.push(itemValidation.data);
      }
    }

    if (errors.length === 0) {
      return {
        valid: true,
        data: {
          requesterName: request['requesterName'] as string | undefined,
          requesterEmail: request['requesterEmail'] as string | undefined,
          requesterDepartment: request['requesterDepartment'] as string | undefined,
          requestType: request['requestType'] as string | undefined,
          priority: request['priority'] as RequestPriority | undefined,
          justification: request['justification'] as string,
          businessNeed: request['businessNeed'] as string | undefined,
          deliveryLocation: request['deliveryLocation'] as string,
          deliveryAddress: request['deliveryAddress'] as string | undefined,
          deliveryInstructions: request['deliveryInstructions'] as string | undefined,
          requestedDeliveryDate: request['requestedDeliveryDate'] as string | undefined,
          costCenterId: request['costCenterId'] as string | undefined,
          projectCode: request['projectCode'] as string | undefined,
          notes: request['notes'] as string | undefined,
          items: validatedItems,
        },
      };
    }
  }

  return { valid: false, errors };
}

/**
 * Lambda handler for submitting a request
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Submit request received', { requestId });

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

    // Create the submit request input
    const submitInput: SubmitRequestInput = {
      ...validation.data,
      requesterId: userId,
    };

    // Submit the request
    const result = await requestService.submitRequest(submitInput);

    logger.info('Request submitted', {
      requestId: result.request.requestId,
      requestNumber: result.request.requestNumber,
      status: result.request.status,
      itemCount: result.lines.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to submit request', err, { requestId });

    // Handle specific errors
    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('cannot be')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to submit request', requestId)
    );
  }
}
