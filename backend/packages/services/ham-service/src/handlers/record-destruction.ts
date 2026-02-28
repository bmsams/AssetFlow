/**
 * Record Destruction Lambda Handler
 *
 * Records destruction details and generates destruction certificate.
 * Requirement 3.7: Record disposal method, date, and destruction certificates
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { DisposalMethod, RecordDestructionRequest } from '../disposal/disposal-service';
import * as disposalService from '../disposal/disposal-service';

const logger = createLogger({ service: 'record-destruction-handler' });

/**
 * Valid disposal/destruction methods
 */
const VALID_DESTRUCTION_METHODS: DisposalMethod[] = [
  'RECYCLED',
  'DONATED',
  'SOLD',
  'DESTROYED',
  'RETURNED_TO_VENDOR',
  'TRADE_IN',
];

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: RecordDestructionRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate destructionDate (required)
  if (!request['destructionDate']) {
    errors.push('destructionDate is required');
  } else if (typeof request['destructionDate'] !== 'string') {
    errors.push('destructionDate must be a string');
  } else {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(request['destructionDate'] as string)) {
      errors.push('destructionDate must be in YYYY-MM-DD format');
    } else {
      const date = new Date(request['destructionDate'] as string);
      if (isNaN(date.getTime())) {
        errors.push('destructionDate is not a valid date');
      }
    }
  }

  // Validate destructionMethod (required)
  if (!request['destructionMethod']) {
    errors.push('destructionMethod is required');
  } else if (typeof request['destructionMethod'] !== 'string') {
    errors.push('destructionMethod must be a string');
  } else if (!VALID_DESTRUCTION_METHODS.includes(request['destructionMethod'] as DisposalMethod)) {
    errors.push(`destructionMethod must be one of: ${VALID_DESTRUCTION_METHODS.join(', ')}`);
  }

  // Validate verifiedBy (required)
  if (!request['verifiedBy']) {
    errors.push('verifiedBy is required');
  } else if (typeof request['verifiedBy'] !== 'string') {
    errors.push('verifiedBy must be a string');
  } else {
    const uuidError = validateUUID(request['verifiedBy'] as string, 'verifiedBy');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate vendorId (optional)
  if (request['vendorId'] !== undefined && request['vendorId'] !== null) {
    if (typeof request['vendorId'] !== 'string') {
      errors.push('vendorId must be a string');
    } else {
      const uuidError = validateUUID(request['vendorId'] as string, 'vendorId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate vendorName (optional)
  if (request['vendorName'] !== undefined && request['vendorName'] !== null) {
    if (typeof request['vendorName'] !== 'string') {
      errors.push('vendorName must be a string');
    } else if ((request['vendorName'] as string).length > 255) {
      errors.push('vendorName exceeds maximum length of 255 characters');
    }
  }

  // Validate serialNumber (optional)
  if (request['serialNumber'] !== undefined && request['serialNumber'] !== null) {
    if (typeof request['serialNumber'] !== 'string') {
      errors.push('serialNumber must be a string');
    } else if ((request['serialNumber'] as string).length > 100) {
      errors.push('serialNumber exceeds maximum length of 100 characters');
    }
  }

  // Validate assetTag (optional)
  if (request['assetTag'] !== undefined && request['assetTag'] !== null) {
    if (typeof request['assetTag'] !== 'string') {
      errors.push('assetTag must be a string');
    } else if ((request['assetTag'] as string).length > 50) {
      errors.push('assetTag exceeds maximum length of 50 characters');
    }
  }

  // Validate documentUrl (optional)
  if (request['documentUrl'] !== undefined && request['documentUrl'] !== null) {
    if (typeof request['documentUrl'] !== 'string') {
      errors.push('documentUrl must be a string');
    } else if ((request['documentUrl'] as string).length > 2000) {
      errors.push('documentUrl exceeds maximum length of 2000 characters');
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

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      destructionDate: request['destructionDate'] as string,
      destructionMethod: request['destructionMethod'] as DisposalMethod,
      verifiedBy: request['verifiedBy'] as string,
      vendorId: request['vendorId'] as string | undefined,
      vendorName: request['vendorName'] as string | undefined,
      serialNumber: request['serialNumber'] as string | undefined,
      assetTag: request['assetTag'] as string | undefined,
      documentUrl: request['documentUrl'] as string | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for recording destruction details
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  // Get workflowId from path parameters
  const workflowId = event.pathParameters?.['workflowId'];

  logger.info('Record destruction request received', { requestId, workflowId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Validate workflowId
    if (!workflowId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'workflowId is required in path', requestId)
      );
    }

    const workflowIdError = validateUUID(workflowId, 'workflowId');
    if (workflowIdError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, workflowIdError.message, requestId)
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

    // Record the destruction
    const result = await disposalService.recordDestruction(
      workflowId,
      validation.data,
      userId
    );

    logger.info('Destruction recorded', {
      requestId,
      workflowId: result.workflow.workflowId,
      certificateId: result.certificate.certificateId,
      certificateNumber: result.certificate.certificateNumber,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to record destruction', err, { requestId, workflowId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Cannot record destruction')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record destruction', requestId)
    );
  }
}

