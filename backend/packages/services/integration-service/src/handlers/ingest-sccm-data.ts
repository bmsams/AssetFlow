/**
 * Ingest SCCM Data Lambda Handler
 *
 * Handles ingestion of discovery data from Microsoft System Center Configuration Manager (SCCM).
 * Requirement 7.1: Ingest asset data from SCCM
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

import type { SCCMPayload } from '../discovery/discovery-types';
import * as discoveryService from '../discovery/discovery-service';

const logger = createLogger({ service: 'ingest-sccm-data-handler' });

/**
 * Validate SCCM payload structure
 */
function validateSCCMPayload(
  body: unknown
): { valid: true; payload: SCCMPayload } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate devices array
  if (!Array.isArray(payload['devices'])) {
    errors.push('devices must be an array');
  } else {
    const devices = payload['devices'] as Record<string, unknown>[];
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      if (!device) continue;
      if (!device['resourceId']) {
        errors.push(`devices[${i}].resourceId is required`);
      }
      if (!device['name']) {
        errors.push(`devices[${i}].name is required`);
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

  return { valid: true, payload: payload as unknown as SCCMPayload };
}

/**
 * Lambda handler for ingesting SCCM discovery data
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('SCCM data ingestion request received', { requestId });

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
    const validationResult = validateSCCMPayload(body);
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

    // Ingest SCCM data
    const result = await discoveryService.ingestSCCMData(validationResult.payload);

    logger.info('SCCM data ingestion completed', {
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
    logger.error('Failed to ingest SCCM data', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to ingest SCCM data', requestId)
    );
  }
}
