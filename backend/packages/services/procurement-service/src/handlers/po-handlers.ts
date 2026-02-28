/**
 * Purchase Order Handlers
 *
 * Lambda handlers for purchase order management endpoints.
 *
 * Requirements: 16.1-16.12
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import type {
  CreatePOLineRequest,
  CreatePurchaseOrderRequest,
  POListFilters,
  POProductType,
  UpdatePurchaseOrderRequest,
  UpdatePOLineRequest,
} from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as poService from '../purchase-order/po-service';

const logger = createLogger({ service: 'po-handlers' });

const VALID_PRODUCT_TYPES: POProductType[] = ['HARDWARE_MODEL', 'SOFTWARE_PRODUCT', 'SERVICE', 'OTHER'];

function isValidationError(message: string): boolean {
  return (
    message.includes('Validation failed') ||
    message.includes('is required') ||
    message.includes('must be') ||
    message.includes('inactive') ||
    message.includes('not approved') ||
    message.includes('approved vendor/model price') ||
    message.includes('approved price currency') ||
    message.includes('does not match approved vendor/model price') ||
    message.includes('Line-level vendor overrides require') ||
    message.includes('Budget validation failed')
  );
}

async function getUserContext(
  event: APIGatewayProxyEvent
): Promise<{ authSub?: string; userId?: string }> {
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
  return { authSub, userId };
}

// ============================================================================
// Validation
// ============================================================================

function validateCreatePORequest(
  body: unknown
): { valid: true; data: CreatePurchaseOrderRequest; lines?: CreatePOLineRequest[] } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!request['vendorId']) {
    errors.push('vendorId is required');
  } else {
    const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
    if (uuidError) errors.push(uuidError.message);
  }

  if (!request['costCenterId']) {
    errors.push('costCenterId is required');
  } else {
    const uuidError = validateUUID(request['costCenterId'] as string, 'costCenterId');
    if (uuidError) errors.push(uuidError.message);
  }

  if (request['currency'] !== undefined) {
    if (typeof request['currency'] !== 'string' || request['currency'].trim().length !== 3) {
      errors.push('currency must be a 3-character code when provided');
    }
  }

  // Validate lines if provided
  const lines = request['lines'] as unknown[];
  const validatedLines: CreatePOLineRequest[] = [];

  if (lines && Array.isArray(lines)) {
    lines.forEach((line, index) => {
      const lineObj = line as Record<string, unknown>;
      
      if (!lineObj['productDescription']) {
        errors.push(`lines[${index}].productDescription is required`);
      }
      
      if (!lineObj['productType']) {
        errors.push(`lines[${index}].productType is required`);
      } else if (!VALID_PRODUCT_TYPES.includes(lineObj['productType'] as POProductType)) {
        errors.push(`lines[${index}].productType must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`);
      }
      
      if (lineObj['quantity'] === undefined || typeof lineObj['quantity'] !== 'number' || lineObj['quantity'] <= 0) {
        errors.push(`lines[${index}].quantity must be a positive number`);
      }
      
      if (lineObj['unitPrice'] === undefined || typeof lineObj['unitPrice'] !== 'number' || lineObj['unitPrice'] < 0) {
        errors.push(`lines[${index}].unitPrice must be a non-negative number`);
      }

      if (lineObj['costCenterId'] !== undefined && lineObj['costCenterId'] !== null && lineObj['costCenterId'] !== '') {
        const uuidError = validateUUID(lineObj['costCenterId'] as string, `lines[${index}].costCenterId`);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }

      if (lineObj['vendorId'] !== undefined && lineObj['vendorId'] !== null && lineObj['vendorId'] !== '') {
        const uuidError = validateUUID(lineObj['vendorId'] as string, `lines[${index}].vendorId`);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }

      if (lineObj['productId'] !== undefined && lineObj['productId'] !== null && lineObj['productId'] !== '') {
        const uuidError = validateUUID(lineObj['productId'] as string, `lines[${index}].productId`);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }

      if (lineObj['productType'] === 'HARDWARE_MODEL' && !lineObj['productId']) {
        errors.push(`lines[${index}].productId is required for HARDWARE_MODEL`);
      }

      if (errors.length === 0) {
        validatedLines.push({
          productType: lineObj['productType'] as POProductType,
          productId: lineObj['productId'] as string | undefined,
          productDescription: lineObj['productDescription'] as string,
          sku: lineObj['sku'] as string | undefined,
          quantity: lineObj['quantity'] as number,
          unitPrice: lineObj['unitPrice'] as number,
          vendorId: (lineObj['vendorId'] as string) || undefined,
          costCenterId: lineObj['costCenterId'] as string | undefined,
          notes: lineObj['notes'] as string | undefined,
        });
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      vendorId: request['vendorId'] as string,
      costCenterId: request['costCenterId'] as string,
      currency: request['currency'] as string | undefined,
      expectedDeliveryDate: request['expectedDeliveryDate'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
    lines: validatedLines.length > 0 ? validatedLines : undefined,
  };
}


// ============================================================================
// Handlers
// ============================================================================

/**
 * Create a new purchase order
 * POST /purchase-orders
 */
export async function createPurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Create purchase order request', { requestId });

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

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const validation = validateCreatePORequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Validation failed', requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' })))
      );
    }

    const po = await poService.createPurchaseOrder(
      { ...validation.data, createdBy: userId },
      validation.lines
    );

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create PO', err, { requestId });

    if (isValidationError(err.message)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to create purchase order', requestId)
    );
  }
}

/**
 * Get purchase order by ID
 * GET /purchase-orders/:poId
 */
export async function getPurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('Get purchase order request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    const uuidError = validateUUID(poId, 'poId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const po = await poService.getPurchaseOrder(poId);
    if (!po) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Purchase order not found: ${poId}`, requestId)
      );
    }

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get PO', err, { requestId, poId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get purchase order', requestId)
    );
  }
}

/**
 * List purchase orders
 * GET /purchase-orders
 */
export async function listPurchaseOrdersHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List purchase orders request', { requestId });

  try {
    const params = event.queryStringParameters ?? {};
    
    const filters: POListFilters = {
      status: params['status'] as POListFilters['status'],
      vendorId: params['vendorId'],
      costCenterId: params['costCenterId'],
      requestedBy: params['requestedBy'],
      fromDate: params['fromDate'],
      toDate: params['toDate'],
      search: params['search'],
    };

    const pagination = {
      page: parseInt(params['page'] ?? '1', 10),
      limit: parseInt(params['limit'] ?? '50', 10),
    };

    const result = await poService.listPurchaseOrders(filters, pagination);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list POs', err, { requestId });
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list purchase orders', requestId)
    );
  }
}


/**
 * Add line item to purchase order
 * POST /purchase-orders/:poId/lines
 */
export async function addLineItemHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('Add line item request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const request = body as Record<string, unknown>;
    const errors: string[] = [];

    if (!request['productDescription']) errors.push('productDescription is required');
    if (!request['productType']) errors.push('productType is required');
    if (request['quantity'] === undefined || typeof request['quantity'] !== 'number') errors.push('quantity is required');
    if (request['unitPrice'] === undefined || typeof request['unitPrice'] !== 'number') errors.push('unitPrice is required');
    if (request['productId'] !== undefined && request['productId'] !== null && request['productId'] !== '') {
      const uuidError = validateUUID(request['productId'] as string, 'productId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
    if (request['productType'] === 'HARDWARE_MODEL' && !request['productId']) {
      errors.push('productId is required for HARDWARE_MODEL');
    }
    if (request['costCenterId'] !== undefined && request['costCenterId'] !== null && request['costCenterId'] !== '') {
      const uuidError = validateUUID(request['costCenterId'] as string, 'costCenterId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }

    if (request['vendorId'] !== undefined && request['vendorId'] !== null && request['vendorId'] !== '') {
      const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }

    if (errors.length > 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Validation failed', requestId,
          errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' })))
      );
    }

    const lineRequest: CreatePOLineRequest = {
      productType: request['productType'] as POProductType,
      productId: request['productId'] as string | undefined,
      productDescription: request['productDescription'] as string,
      sku: request['sku'] as string | undefined,
      quantity: request['quantity'] as number,
      unitPrice: request['unitPrice'] as number,
      vendorId: (request['vendorId'] as string) || undefined,
      costCenterId: request['costCenterId'] as string | undefined,
      notes: request['notes'] as string | undefined,
    };

    const po = await poService.addLineItem(poId, lineRequest);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to add line item', err, { requestId, poId });

    if (isValidationError(err.message)) {
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

    if (err.message.includes('Cannot modify')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to add line item', requestId)
    );
  }
}

/**
 * Update line item
 * PUT /purchase-orders/:poId/lines/:lineId
 */
export async function updateLineItemHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const lineId = event.pathParameters?.['lineId'];

  logger.info('Update line item request', { requestId, poId, lineId });

  try {
    if (!poId || !lineId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID and Line ID are required', requestId)
      );
    }

    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const request = body as Record<string, unknown>;
    if (request['costCenterId'] !== undefined && request['costCenterId'] !== null && request['costCenterId'] !== '') {
      const uuidError = validateUUID(request['costCenterId'] as string, 'costCenterId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    if (request['vendorId'] !== undefined && request['vendorId'] !== null && request['vendorId'] !== '') {
      const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    const lineRequest: UpdatePOLineRequest = {
      quantity: request['quantity'] as number | undefined,
      unitPrice: request['unitPrice'] as number | undefined,
      vendorId:
        request['vendorId'] === null || request['vendorId'] === ''
          ? null
          : request['vendorId'] as string | undefined,
      costCenterId:
        request['costCenterId'] === null
          ? null
          : request['costCenterId'] as string | undefined,
      notes: request['notes'] as string | null | undefined,
    };

    const po = await poService.updateLineItem(poId, lineId, lineRequest);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update line item', err, { requestId, poId, lineId });

    if (isValidationError(err.message)) {
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

    if (err.message.includes('Cannot modify')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update line item', requestId)
    );
  }
}

/**
 * Remove line item
 * DELETE /purchase-orders/:poId/lines/:lineId
 */
export async function removeLineItemHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const lineId = event.pathParameters?.['lineId'];

  logger.info('Remove line item request', { requestId, poId, lineId });

  try {
    if (!poId || !lineId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID and Line ID are required', requestId)
      );
    }

    const po = await poService.removeLineItem(poId, lineId);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to remove line item', err, { requestId, poId, lineId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot modify')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to remove line item', requestId)
    );
  }
}


/**
 * Submit purchase order for approval
 * POST /purchase-orders/:poId/submit
 */
export async function submitForApprovalHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('Submit for approval request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    const po = await poService.submitForApproval(poId);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to submit for approval', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot submit') || err.message.includes('no line items')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to submit for approval', requestId)
    );
  }
}

/**
 * Approve purchase order
 * POST /purchase-orders/:poId/approve
 */
export async function approvePurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Approve PO request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

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

    let body: Record<string, unknown> = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      // Ignore parse errors for optional body
    }

    const po = await poService.approvePurchaseOrder(poId, userId, body['approvalNotes'] as string | undefined);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to approve PO', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot approve')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to approve purchase order', requestId)
    );
  }
}

/**
 * Reject purchase order
 * POST /purchase-orders/:poId/reject
 */
export async function rejectPurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Reject PO request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    if (!body['rejectionReason']) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'rejectionReason is required', requestId)
      );
    }

    const po = await poService.rejectPurchaseOrder(poId, userId, body['rejectionReason'] as string);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reject PO', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot reject')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to reject purchase order', requestId)
    );
  }
}

/**
 * Send purchase order to vendor
 * POST /purchase-orders/:poId/send
 */
export async function sendToVendorHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('Send to vendor request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    const po = await poService.sendToVendor(poId);

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send to vendor', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot send')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to send to vendor', requestId)
    );
  }
}

/**
 * Cancel purchase order
 * POST /purchase-orders/:poId/cancel
 */
export async function cancelPurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Cancel PO request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      // Ignore parse errors for optional body
    }

    const po = await poService.cancelPurchaseOrder(
      poId,
      userId,
      body['cancellationReason'] as string | undefined
    );

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to cancel PO', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot cancel')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to cancel purchase order', requestId)
    );
  }
}

/**
 * POST /purchase-orders/:poId/receipt-accounting
 */
export async function postReceiptAccountingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Post receipt accounting request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    const poIdValidationError = validateUUID(poId, 'poId');
    if (poIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, poIdValidationError.message, requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const receiptId = body['receiptId'] as string | undefined;
    if (!receiptId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'receiptId is required', requestId)
      );
    }

    const receiptIdValidationError = validateUUID(receiptId, 'receiptId');
    if (receiptIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, receiptIdValidationError.message, requestId)
      );
    }

    const result = await poService.postReceiptAccounting(
      poId,
      receiptId,
      body['receiptNumber'] as string | undefined,
      userId
    );

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to post receipt accounting', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot post receipt accounting')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (isValidationError(err.message)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to post receipt accounting', requestId)
    );
  }
}

/**
 * POST /purchase-orders/:poId/invoice-accounting
 */
export async function postInvoiceAccountingHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Post invoice accounting request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    const poIdValidationError = validateUUID(poId, 'poId');
    if (poIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, poIdValidationError.message, requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const invoiceId = body['invoiceId'] as string | undefined;
    if (!invoiceId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'invoiceId is required', requestId)
      );
    }

    const invoiceIdValidationError = validateUUID(invoiceId, 'invoiceId');
    if (invoiceIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, invoiceIdValidationError.message, requestId)
      );
    }

    const result = await poService.postInvoiceAccounting(
      poId,
      invoiceId,
      body['invoiceNumber'] as string | undefined,
      userId
    );

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to post invoice accounting', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot post invoice accounting')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (isValidationError(err.message)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to post invoice accounting', requestId)
    );
  }
}

/**
 * GET /purchase-orders/:poId/close-guard
 */
export async function getPOCloseGuardHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];

  logger.info('PO close guard request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    const poIdValidationError = validateUUID(poId, 'poId');
    if (poIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, poIdValidationError.message, requestId)
      );
    }

    const result = await poService.getCloseGuard(poId);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to evaluate PO close guard', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to evaluate PO close guard', requestId)
    );
  }
}

/**
 * POST /purchase-orders/:poId/close
 */
export async function closePurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Close PO request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    const poIdValidationError = validateUUID(poId, 'poId');
    if (poIdValidationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, poIdValidationError.message, requestId)
      );
    }

    let body: Record<string, unknown> = {};
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const po = await poService.closePurchaseOrder(poId, userId, body['closeNotes'] as string | undefined);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to close PO', err, { requestId, poId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot close')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (isValidationError(err.message)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to close purchase order', requestId)
    );
  }
}

/**
 * Update purchase order
 * PUT /purchase-orders/:poId
 */
export async function updatePurchaseOrderHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const poId = event.pathParameters?.['poId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Update purchase order request', { requestId, poId });

  try {
    if (!poId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'PO ID is required', requestId)
      );
    }

    if (!authSub) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(API_ERROR_CODES.FORBIDDEN, 'User is not provisioned in the application', requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? JSON.parse(event.body) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    if (body['vendorId'] !== undefined && body['vendorId'] !== null && body['vendorId'] !== '') {
      const uuidError = validateUUID(body['vendorId'] as string, 'vendorId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    if (body['costCenterId'] !== undefined && body['costCenterId'] !== null && body['costCenterId'] !== '') {
      const uuidError = validateUUID(body['costCenterId'] as string, 'costCenterId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    if (body['currency'] !== undefined) {
      if (typeof body['currency'] !== 'string' || (body['currency'] as string).trim().length !== 3) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'currency must be a 3-character code when provided',
            requestId
          )
        );
      }
    }

    const request: UpdatePurchaseOrderRequest = {
      vendorId: body['vendorId'] as string | undefined,
      costCenterId: body['costCenterId'] as string | undefined,
      currency: body['currency'] as string | undefined,
      expectedDeliveryDate: body['expectedDeliveryDate'] as string | undefined,
      taxAmount: body['taxAmount'] as number | undefined,
      shippingAmount: body['shippingAmount'] as number | undefined,
      notes: body['notes'] as string | undefined,
      updatedBy: userId,
    };

    const po = await poService.updatePurchaseOrder(poId, request);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(po, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update PO', err, { requestId, poId });

    if (isValidationError(err.message)) {
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

    if (err.message.includes('Cannot modify')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to update purchase order', requestId)
    );
  }
}

/**
 * Main Lambda handler router for purchase order endpoints
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;

  logger.info('PO handler request', { method, path });

  const hasPoId = Boolean(event.pathParameters?.['poId']);
  const hasLineId = Boolean(event.pathParameters?.['lineId']);

  if (method === 'GET' && path.endsWith('/close-guard')) {
    return getPOCloseGuardHandler(event);
  }

  if (method === 'GET' && hasPoId) {
    return getPurchaseOrderHandler(event);
  }

  if (method === 'GET') {
    return listPurchaseOrdersHandler(event);
  }

  if (method === 'POST' && path.endsWith('/submit')) {
    return submitForApprovalHandler(event);
  }

  if (method === 'POST' && path.endsWith('/send')) {
    return sendToVendorHandler(event);
  }

  if (method === 'POST' && path.endsWith('/cancel')) {
    return cancelPurchaseOrderHandler(event);
  }

  if (method === 'POST' && path.endsWith('/approve')) {
    return approvePurchaseOrderHandler(event);
  }

  if (method === 'POST' && path.endsWith('/reject')) {
    return rejectPurchaseOrderHandler(event);
  }

  if (method === 'POST' && path.endsWith('/receipt-accounting')) {
    return postReceiptAccountingHandler(event);
  }

  if (method === 'POST' && path.endsWith('/invoice-accounting')) {
    return postInvoiceAccountingHandler(event);
  }

  if (method === 'POST' && path.endsWith('/close')) {
    return closePurchaseOrderHandler(event);
  }

  if (method === 'POST' && path.endsWith('/lines')) {
    return addLineItemHandler(event);
  }

  if (method === 'POST') {
    return createPurchaseOrderHandler(event);
  }

  if (method === 'PUT' && hasLineId) {
    return updateLineItemHandler(event);
  }

  if (method === 'PUT' && hasPoId) {
    return updatePurchaseOrderHandler(event);
  }

  if (method === 'DELETE' && hasLineId) {
    return removeLineItemHandler(event);
  }

  return createLambdaResponse(
    405,
    createErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      `Method ${method} not allowed for ${path}`,
      event.requestContext.requestId
    )
  );
}

