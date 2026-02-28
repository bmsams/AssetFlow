/**
 * Requisition Handlers
 *
 * Lambda handlers for requisition lifecycle and conversion endpoints.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type {
  CreateRequisitionInput,
  RequisitionProductType,
  RequisitionStatus,
} from '../requisition';
import * as requisitionService from '../requisition';

const logger = createLogger({ service: 'requisition-handlers' });

const VALID_REQUISITION_STATUSES: RequisitionStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PARTIALLY_CONVERTED',
  'CONVERTED',
  'CANCELLED',
];

const VALID_PRODUCT_TYPES: RequisitionProductType[] = [
  'HARDWARE_MODEL',
  'SOFTWARE_PRODUCT',
  'SERVICE',
  'OTHER',
];

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isNotFoundError(message: string): boolean {
  return message.includes('not found');
}

function isConflictError(message: string): boolean {
  return (
    message.includes('Cannot submit requisition') ||
    message.includes('Cannot approve requisition') ||
    message.includes('Cannot reject requisition') ||
    message.includes('Cannot convert requisition') ||
    message.includes('No approved unconverted requisition lines found')
  );
}

function isValidationError(message: string): boolean {
  return (
    message.includes('Validation failed') ||
    message.includes('must contain at least one line') ||
    message.includes('is required') ||
    message.includes('must be') ||
    message.includes('inactive') ||
    message.includes('not approved') ||
    message.includes('approved vendor/model price') ||
    message.includes('approved price currency') ||
    message.includes('does not match approved vendor/model price') ||
    message.includes('required') ||
    message.includes('Invalid')
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

function validateCreateRequisitionRequest(
  body: unknown
): { valid: true; data: CreateRequisitionInput } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  if (request['requestedBy']) {
    const uuidError = validateUUID(request['requestedBy'] as string, 'requestedBy');
    if (uuidError) errors.push(uuidError.message);
  }

  if (request['needByDate'] && !isIsoDate(request['needByDate'] as string)) {
    errors.push('needByDate must be in YYYY-MM-DD format');
  }

  if (request['costCenterId']) {
    const uuidError = validateUUID(request['costCenterId'] as string, 'costCenterId');
    if (uuidError) errors.push(uuidError.message);
  }

  if (request['shipToBuildingId']) {
    const uuidError = validateUUID(request['shipToBuildingId'] as string, 'shipToBuildingId');
    if (uuidError) errors.push(uuidError.message);
  }

  if (!Array.isArray(request['lines']) || request['lines'].length === 0) {
    errors.push('lines must contain at least one line item');
  }

  const lineInputs: CreateRequisitionInput['lines'] = [];
  if (Array.isArray(request['lines'])) {
    request['lines'].forEach((line, index) => {
      if (!line || typeof line !== 'object') {
        errors.push(`lines[${index}] must be an object`);
        return;
      }

      const lineObj = line as Record<string, unknown>;
      const productType = lineObj['productType'] as RequisitionProductType;
      const productDescription = asString(lineObj['productDescription']);
      const quantity = lineObj['quantity'];
      const unitPrice = lineObj['unitPrice'];

      if (!productType || !VALID_PRODUCT_TYPES.includes(productType)) {
        errors.push(`lines[${index}].productType must be one of: ${VALID_PRODUCT_TYPES.join(', ')}`);
      }

      if (!productDescription || productDescription.trim().length === 0) {
        errors.push(`lines[${index}].productDescription is required`);
      }

      if (typeof quantity !== 'number' || quantity <= 0) {
        errors.push(`lines[${index}].quantity must be a positive number`);
      }

      if (unitPrice !== undefined && (typeof unitPrice !== 'number' || unitPrice < 0)) {
        errors.push(`lines[${index}].unitPrice must be a non-negative number when provided`);
      }

      if (lineObj['productId']) {
        const uuidError = validateUUID(lineObj['productId'] as string, `lines[${index}].productId`);
        if (uuidError) errors.push(uuidError.message);
      }

      if (lineObj['vendorId']) {
        const uuidError = validateUUID(lineObj['vendorId'] as string, `lines[${index}].vendorId`);
        if (uuidError) errors.push(uuidError.message);
      }

      if (lineObj['costCenterId']) {
        const uuidError = validateUUID(
          lineObj['costCenterId'] as string,
          `lines[${index}].costCenterId`
        );
        if (uuidError) errors.push(uuidError.message);
      }

      if (lineObj['currency'] && typeof lineObj['currency'] !== 'string') {
        errors.push(`lines[${index}].currency must be a string`);
      }

      lineInputs.push({
        productType,
        productId: asString(lineObj['productId']),
        productDescription: productDescription ?? '',
        sku: asString(lineObj['sku']),
        quantity: typeof quantity === 'number' ? quantity : 0,
        unitPrice: typeof unitPrice === 'number' ? unitPrice : undefined,
        currency: asString(lineObj['currency']),
        vendorId: asString(lineObj['vendorId']),
        costCenterId: asString(lineObj['costCenterId']),
        notes: asString(lineObj['notes']),
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      requestedBy: asString(request['requestedBy']),
      needByDate: asString(request['needByDate']),
      legalEntity: asString(request['legalEntity']),
      currency: asString(request['currency']),
      costCenterId: asString(request['costCenterId']),
      shipToBuildingId: asString(request['shipToBuildingId']),
      shipToAddress: asString(request['shipToAddress']),
      notes: asString(request['notes']),
      lines: lineInputs,
    },
  };
}

function createValidationResponse(
  requestId: string,
  errors: string[]
): APIGatewayProxyResult {
  return createLambdaResponse(
    HTTP_STATUS.BAD_REQUEST,
    createErrorResponse(
      API_ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      requestId,
      errors.map(error => ({ field: '', message: error, code: 'VALIDATION_ERROR' }))
    )
  );
}

function createServiceErrorResponse(
  requestId: string,
  message: string,
  fallbackMessage: string
): APIGatewayProxyResult {
  if (isNotFoundError(message)) {
    return createLambdaResponse(
      HTTP_STATUS.NOT_FOUND,
      createErrorResponse(API_ERROR_CODES.NOT_FOUND, message, requestId)
    );
  }

  if (isConflictError(message)) {
    return createLambdaResponse(
      HTTP_STATUS.CONFLICT,
      createErrorResponse(API_ERROR_CODES.CONFLICT, message, requestId)
    );
  }

  if (isValidationError(message)) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, message, requestId)
    );
  }

  return createLambdaResponse(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, fallbackMessage, requestId)
  );
}

/**
 * POST /procurement/requisitions
 */
export async function createRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const { authSub, userId } = await getUserContext(event);

  logger.info('Create requisition request', { requestId });

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
        createErrorResponse(
          API_ERROR_CODES.USER_NOT_PROVISIONED,
          'User is not provisioned in the application',
          requestId
        )
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

    const validation = validateCreateRequisitionRequest(body);
    if (!validation.valid) {
      return createValidationResponse(requestId, validation.errors);
    }

    const requisition = await requisitionService.createRequisition({
      ...validation.data,
      requestedBy: validation.data.requestedBy ?? userId,
      createdBy: userId,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(requisition, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create requisition', err, { requestId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to create requisition');
  }
}

/**
 * GET /procurement/requisitions/:requisitionId
 */
export async function getRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];

  logger.info('Get requisition request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
      );
    }

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const requisition = await requisitionService.getRequisition(requisitionId);
    if (!requisition) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          `Requisition not found: ${requisitionId}`,
          requestId
        )
      );
    }

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(requisition, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get requisition', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to get requisition');
  }
}

/**
 * GET /procurement/requisitions
 */
export async function listRequisitionsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const params = event.queryStringParameters ?? {};

  logger.info('List requisitions request', { requestId });

  try {
    const status = params['status'] as RequisitionStatus | undefined;
    if (status && !VALID_REQUISITION_STATUSES.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${VALID_REQUISITION_STATUSES.join(', ')}`,
          requestId
        )
      );
    }

    if (params['requestedBy']) {
      const uuidError = validateUUID(params['requestedBy'], 'requestedBy');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    if (params['fromDate'] && !isIsoDate(params['fromDate'])) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'fromDate must be in YYYY-MM-DD format',
          requestId
        )
      );
    }

    if (params['toDate'] && !isIsoDate(params['toDate'])) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'toDate must be in YYYY-MM-DD format',
          requestId
        )
      );
    }

    const parsedPage = parseInt(params['page'] ?? '1', 10);
    const parsedLimit = parseInt(params['limit'] ?? '50', 10);
    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const limit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 50 : parsedLimit;

    const result = await requisitionService.listRequisitions(
      {
        status,
        requestedBy: params['requestedBy'],
        fromDate: params['fromDate'],
        toDate: params['toDate'],
        search: params['search'],
      },
      {
        page,
        limit,
      }
    );

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list requisitions', err, { requestId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to list requisitions');
  }
}

/**
 * POST /procurement/requisitions/:requisitionId/submit
 */
export async function submitRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Submit requisition request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
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

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const requisition = await requisitionService.submitRequisition(requisitionId, userId);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(requisition, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to submit requisition', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to submit requisition');
  }
}

/**
 * POST /procurement/requisitions/:requisitionId/approve
 */
export async function approveRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Approve requisition request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
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

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    let body: Record<string, unknown> = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body) as Record<string, unknown>;
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
        );
      }
    }

    const notes = asString(body['notes']);
    const requisition = await requisitionService.approveRequisition(requisitionId, userId, notes);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(requisition, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to approve requisition', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to approve requisition');
  }
}

/**
 * POST /procurement/requisitions/:requisitionId/reject
 */
export async function rejectRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Reject requisition request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
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

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    let body: Record<string, unknown>;
    try {
      body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON', requestId)
      );
    }

    const reason = asString(body['reason'])?.trim();
    if (!reason) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'reason is required', requestId)
      );
    }

    const requisition = await requisitionService.rejectRequisition(requisitionId, userId, reason);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(requisition, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to reject requisition', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to reject requisition');
  }
}

/**
 * POST /procurement/requisitions/:requisitionId/convert
 */
export async function convertRequisitionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];
  const { authSub, userId } = await getUserContext(event);

  logger.info('Convert requisition request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
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

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const result = await requisitionService.convertRequisitionToPOs(requisitionId, userId);
    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to convert requisition', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to convert requisition');
  }
}

/**
 * GET /procurement/requisitions/:requisitionId/links
 */
export async function getRequisitionLinksHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const requisitionId = event.pathParameters?.['requisitionId'];

  logger.info('Get requisition links request', { requestId, requisitionId });

  try {
    if (!requisitionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Requisition ID is required', requestId)
      );
    }

    const uuidError = validateUUID(requisitionId, 'requisitionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const links = await requisitionService.getRequisitionLinks(requisitionId);
    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ items: links, total: links.length }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get requisition links', err, { requestId, requisitionId });
    return createServiceErrorResponse(requestId, err.message, 'Failed to get requisition links');
  }
}

/**
 * Main Lambda handler router for requisition endpoints.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const hasRequisitionId = Boolean(event.pathParameters?.['requisitionId']);

  logger.info('Requisition handler request', { method, path });

  if (method === 'GET' && path.endsWith('/links')) {
    return getRequisitionLinksHandler(event);
  }

  if (method === 'GET' && hasRequisitionId) {
    return getRequisitionHandler(event);
  }

  if (method === 'GET') {
    return listRequisitionsHandler(event);
  }

  if (method === 'POST' && path.endsWith('/submit')) {
    return submitRequisitionHandler(event);
  }

  if (method === 'POST' && path.endsWith('/approve')) {
    return approveRequisitionHandler(event);
  }

  if (method === 'POST' && path.endsWith('/reject')) {
    return rejectRequisitionHandler(event);
  }

  if (method === 'POST' && path.endsWith('/convert')) {
    return convertRequisitionHandler(event);
  }

  if (method === 'POST') {
    return createRequisitionHandler(event);
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
