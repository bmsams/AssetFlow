/**
 * Ingest Tanium Data Lambda Handler
 *
 * Handles ingestion of discovery data from Tanium (endpoint management).
 * Requirement 7.1: Ingest asset data from Tanium
 * Requirement 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import type { TaniumPayload } from '../discovery/discovery-types';
import * as discoveryService from '../discovery/discovery-service';

const logger = createLogger({ service: 'ingest-tanium-data-handler' });

/**
 * Validate Tanium payload structure
 */
function validateTaniumPayload(
  body: unknown
): { valid: true; payload: TaniumPayload } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate endpoints array
  if (!Array.isArray(payload['endpoints'])) {
    errors.push('endpoints must be an array');
  } else {
    const endpoints = payload['endpoints'] as Record<string, unknown>[];
    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      if (!endpoint) continue;
      if (!endpoint['computerID']) {
        errors.push(`endpoints[${i}].computerID is required`);
      }
      if (!endpoint['computerName']) {
        errors.push(`endpoints[${i}].computerName is required`);
      }
    }
  }

  // Validate syncTimestamp
  if (!payload['syncTimestamp'] || typeof payload['syncTimestamp'] !== 'string') {
    errors.push('syncTimestamp is required and must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, payload: payload as unknown as TaniumPayload };
}

/**
 * Lambda handler for ingesting Tanium discovery data
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Tanium data ingestion request received', { requestId });

  try {
    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body);
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate payload
    const validationResult = validateTaniumPayload(body);
    if (!validationResult.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validationResult.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Ingest Tanium data
    const result = await discoveryService.ingestTaniumData(validationResult.payload);

    logger.info('Tanium data ingestion completed', {
      requestId,
      totalRecords: result.totalRecords,
      matchedCount: result.matchedCount,
      createdCount: result.createdCount,
      failedCount: result.failedCount,
      processingTimeMs: result.processingTimeMs,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to ingest Tanium data', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to ingest Tanium data', requestId)
    );
  }
}
