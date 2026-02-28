/**
 * Create Purchase Order Lambda Handler
 *
 * Creates a purchase order for items not available in stock.
 * Requirement 6.2, 6.3: Generate purchase orders when stock insufficient
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

import type { CreatePurchaseOrderInput, CreatePurchaseOrderLineInput } from '../procurement/procurement-service';
import * as procurementService from '../procurement/procurement-service';

const logger = createLogger({ service: 'create-purchase-order-handler' });

/**
 * Validate a single line item
 */
function validateLineItem(
  item: unknown,
  index: number
): { valid: true; data: CreatePurchaseOrderLineInput } | { valid: false; errors: string[] } {
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

  // Validate quantity (required)
  if (itemObj['quantity'] === undefined || itemObj['quantity'] === null) {
    errors.push(`Line ${index + 1}: quantity is required`);
  } else if (typeof itemObj['quantity'] !== 'number') {
    errors.push(`Line ${index + 1}: quantity must be a number`);
  } else if (itemObj['quantity'] <= 0) {
    errors.push(`Line ${index + 1}: quantity must be greater than 0`);
  } else if (!Number.isInteger(itemObj['quantity'])) {
    errors.push(`Line ${index + 1}: quantity must be an integer`);
  }

  // Validate unitPrice (required)
  if (itemObj['unitPrice'] === undefined || itemObj['unitPrice'] === null) {
    errors.push(`Line ${index + 1}: unitPrice is required`);
  } else if (typeof itemObj['unitPrice'] !== 'number') {
    errors.push(`Line ${index + 1}: unitPrice must be a number`);
  } else if (itemObj['unitPrice'] < 0) {
    errors.push(`Line ${index + 1}: unitPrice cannot be negative`);
  }

  // Validate optional UUID fields
  const optionalUuidFields = ['productId', 'requestLineId', 'vendorId', 'costCenterId'];
  for (const field of optionalUuidFields) {
    if (itemObj[field] !== undefined && itemObj[field] !== null) {
      if (typeof itemObj[field] !== 'string') {
        errors.push(`Line ${index + 1}: ${field} must be a string`);
      } else {
        const uuidError = validateUUID(itemObj[field] as string, field);
        if (uuidError) {
          errors.push(`Line ${index + 1}: ${uuidError.message}`);
        }
      }
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['productType', 'productDescription', 'productSku', 'notes', 'vendorName'];
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
      productId: itemObj['productId'] as string | undefined,
      productType: itemObj['productType'] as string | undefined,
      productName: itemObj['productName'] as string,
      productDescription: itemObj['productDescription'] as string | undefined,
      productSku: itemObj['productSku'] as string | undefined,
      quantity: itemObj['quantity'] as number,
      unitPrice: itemObj['unitPrice'] as number,
      vendorId: itemObj['vendorId'] as string | undefined,
      vendorName: itemObj['vendorName'] as string | undefined,
      costCenterId: itemObj['costCenterId'] as string | undefined,
      requestLineId: itemObj['requestLineId'] as string | undefined,
      notes: itemObj['notes'] as string | undefined,
    },
  };
}

/**
 * Validate create purchase order request body
 */
function validateRequest(body: unknown): {
  valid: true;
  data: Omit<CreatePurchaseOrderInput, 'requesterId'>;
} | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate optional UUID fields
  const optionalUuidFields = ['vendorId', 'sourceRequestId'];
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

  // Validate optional string fields
  const optionalStringFields = [
    'vendorName',
    'requesterName',
    'shippingAddress',
    'shippingMethod',
    'paymentTerms',
    'currency',
    'notes',
    'internalNotes',
  ];
  for (const field of optionalStringFields) {
    if (request[field] !== undefined && request[field] !== null && typeof request[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate expectedDeliveryDate (optional ISO date string)
  if (request['expectedDeliveryDate'] !== undefined && request['expectedDeliveryDate'] !== null) {
    if (typeof request['expectedDeliveryDate'] !== 'string') {
      errors.push('expectedDeliveryDate must be a string');
    } else {
      const date = new Date(request['expectedDeliveryDate'] as string);
      if (isNaN(date.getTime())) {
        errors.push('expectedDeliveryDate must be a valid ISO date string');
      }
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
    // Validate each line
    const validatedLines: CreatePurchaseOrderLineInput[] = [];
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
          vendorId: request['vendorId'] as string | undefined,
          vendorName: request['vendorName'] as string | undefined,
          requesterName: request['requesterName'] as string | undefined,
          expectedDeliveryDate: request['expectedDeliveryDate'] as string | undefined,
          shippingAddress: request['shippingAddress'] as string | undefined,
          shippingMethod: request['shippingMethod'] as string | undefined,
          paymentTerms: request['paymentTerms'] as string | undefined,
          currency: request['currency'] as string | undefined,
          notes: request['notes'] as string | undefined,
          internalNotes: request['internalNotes'] as string | undefined,
          sourceRequestId: request['sourceRequestId'] as string | undefined,
          lines: validatedLines,
        },
      };
    }
  }

  return { valid: false, errors };
}

/**
 * Lambda handler for creating a purchase order
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Create purchase order request received', { requestId });

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

    // Create the purchase order input
    const poInput: CreatePurchaseOrderInput = {
      ...validation.data,
      requesterId: userId,
    };

    // Create the purchase order
    const result = await procurementService.createPurchaseOrder(poInput, userId);

    logger.info('Purchase order created', {
      requestId,
      poId: result.purchaseOrder.poId,
      poNumber: result.purchaseOrder.poNumber,
      totalAmount: result.purchaseOrder.totalAmount,
      lineCount: result.lines.length,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create purchase order', err, { requestId });

    // Handle specific errors
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create purchase order', requestId)
    );
  }
}
