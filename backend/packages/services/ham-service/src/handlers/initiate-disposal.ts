/**
 * Initiate Disposal Lambda Handler
 *
 * Initiates a disposal workflow for an asset with required tasks.
 * Requirement 3.6: Enforce disposal workflows including data sanitization verification
 * Requirement 3.7: Create tasks for data sanitization and vendor pickup
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { CreateDisposalWorkflowRequest, DisposalMethod } from '../disposal/disposal-service';
import * as disposalService from '../disposal/disposal-service';

const logger = createLogger({ service: 'initiate-disposal-handler' });

/**
 * Valid disposal methods
 */
const VALID_DISPOSAL_METHODS: DisposalMethod[] = [
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
function validateRequest(body: unknown): { valid: true; data: Omit<CreateDisposalWorkflowRequest, 'initiatedBy'> } | { valid: false; errors: string[] } {
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

  // Validate disposalMethod (optional)
  if (request['disposalMethod'] !== undefined && request['disposalMethod'] !== null) {
    if (typeof request['disposalMethod'] !== 'string') {
      errors.push('disposalMethod must be a string');
    } else if (!VALID_DISPOSAL_METHODS.includes(request['disposalMethod'] as DisposalMethod)) {
      errors.push(`disposalMethod must be one of: ${VALID_DISPOSAL_METHODS.join(', ')}`);
    }
  }

  // Validate dataWipeRequired (optional)
  if (request['dataWipeRequired'] !== undefined && request['dataWipeRequired'] !== null) {
    if (typeof request['dataWipeRequired'] !== 'boolean') {
      errors.push('dataWipeRequired must be a boolean');
    }
  }

  // Validate environmentalCheckRequired (optional)
  if (request['environmentalCheckRequired'] !== undefined && request['environmentalCheckRequired'] !== null) {
    if (typeof request['environmentalCheckRequired'] !== 'boolean') {
      errors.push('environmentalCheckRequired must be a boolean');
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
      assetId: request['assetId'] as string,
      disposalMethod: request['disposalMethod'] as DisposalMethod | undefined,
      dataWipeRequired: request['dataWipeRequired'] as boolean | undefined,
      environmentalCheckRequired: request['environmentalCheckRequired'] as boolean | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for initiating a disposal workflow
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Initiate disposal request received', { requestId });

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

    // Create the disposal workflow request
    const disposalRequest: CreateDisposalWorkflowRequest = {
      ...validation.data,
      initiatedBy: userId,
    };

    // Initiate the disposal workflow
    const result = await disposalService.initiateDisposal(disposalRequest);

    logger.info('Disposal workflow initiated', {
      requestId,
      workflowId: result.workflow.workflowId,
      workflowNumber: result.workflow.workflowNumber,
      assetId: result.workflow.assetId,
      taskCount: result.tasks.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to initiate disposal', err, { requestId });

    // Handle specific errors
    if (err.message.includes('already has an active disposal workflow')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
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
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to initiate disposal workflow', requestId)
    );
  }
}

