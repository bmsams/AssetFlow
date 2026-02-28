/**
 * Transition Asset State Lambda Handler
 *
 * Implements asset lifecycle state machine transitions (Requirement 2.4)
 * Publishes state change events to SNS (Requirement 9.2)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetStatus, StateTransitionRequest } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validate, validateUUID } from '@ams/utils';

import { invalidateAssetComprehensive } from '@ams/cache';

import * as assetService from '../service/asset-service';
import { StateTransitionError } from '../service/asset-service';

const logger = createLogger({ service: 'transition-state-handler' });

const VALID_STATUSES: AssetStatus[] = [
  'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
  'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
];

/**
 * Validate state transition request
 */
function validateRequest(body: unknown): { valid: true; data: StateTransitionRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const result = validate()
    .required(request['newState'], 'newState')
    .enum(request['newState'] as string, 'newState', VALID_STATUSES)
    .stringLength(request['reason'] as string | undefined, 'reason', 0, 500)
    .result();

  if (!result.isValid) {
    return { valid: false, errors: result.errors.map(e => e.message) };
  }

  return {
    valid: true,
    data: {
      newState: request['newState'] as AssetStatus,
      reason: request['reason'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for transitioning asset state
 *
 * POST /assets/{assetId}/transition
 *
 * Request body:
 * {
 *   "newState": "RECEIVED" | "IN_STOCK" | "RESERVED" | "DEPLOYED" | "IN_MAINTENANCE" | "RETIRED" | "DISPOSED",
 *   "reason": "Optional reason for the transition"
 * }
 *
 * Responses:
 * - 200: State transitioned successfully
 * - 400: Invalid request (missing/invalid parameters)
 * - 404: Asset not found
 * - 409: Invalid state transition (returns valid transitions)
 * - 500: Internal server error
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Transition state request received', { requestId, assetId });

  try {
    // Validate asset ID
    if (!assetId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Asset ID is required', requestId)
      );
    }

    const uuidError = validateUUID(assetId, 'assetId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
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

    // Transition state
    const asset = await assetService.transitionState(
      assetId,
      validation.data.newState,
      userId,
      validation.data.reason
    );

    logger.info('Asset state transitioned successfully', {
      requestId,
      assetId,
      newState: validation.data.newState,
    });

    try {
      await invalidateAssetComprehensive(assetId);
    } catch (cacheError) {
      logger.warn('Cache invalidation failed, continuing', { assetId, error: cacheError });
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(asset, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to transition asset state', err, { requestId, assetId });

    // Handle StateTransitionError with detailed information
    if (err instanceof StateTransitionError) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(
          API_ERROR_CODES.INVALID_STATE_TRANSITION,
          err.message,
          requestId,
          [{
            field: 'newState',
            message: `Invalid transition from ${err.currentState} to ${err.attemptedState}. Valid transitions: [${err.validTransitions.join(', ')}]${err.isTerminalState ? ' (current state is terminal)' : ''}`,
            code: 'INVALID_STATE_TRANSITION',
          }]
        )
      );
    }

    // Check for asset not found
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    // Check for legacy invalid state transition errors
    if (err.message.includes('Invalid state transition')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.INVALID_STATE_TRANSITION, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to transition asset state', requestId)
    );
  }
}
