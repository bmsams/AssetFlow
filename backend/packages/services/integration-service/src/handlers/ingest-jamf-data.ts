/**
 * Ingest Jamf Data Lambda Handler
 *
 * Handles ingestion of discovery data from Jamf (Apple device management).
 * Requirement 7.1: Ingest asset data from Jamf
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

import type { JamfPayload } from '../discovery/discovery-types';
import * as discoveryService from '../discovery/discovery-service';

const logger = createLogger({ service: 'ingest-jamf-data-handler' });

/**
 * Validate Jamf payload structure
 */
function validateJamfPayload(
  body: unknown
): { valid: true; payload: JamfPayload } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate that at least one of computers or mobileDevices is present
  const hasComputers = Array.isArray(payload['computers']) && payload['computers'].length > 0;
  const hasMobileDevices = Array.isArray(payload['mobileDevices']) && payload['mobileDevices'].length > 0;

  if (!hasComputers && !hasMobileDevices) {
    errors.push('At least one of computers or mobileDevices array must be provided');
  }

  // Validate computers array if present
  if (payload['computers'] && Array.isArray(payload['computers'])) {
    const computers = payload['computers'] as Record<string, unknown>[];
    for (let i = 0; i < computers.length; i++) {
      const computer = computers[i];
      if (!computer) continue;
      if (typeof computer['id'] !== 'number') {
        errors.push(`computers[${i}].id is required and must be a number`);
      }
      if (!computer['name']) {
        errors.push(`computers[${i}].name is required`);
      }
      if (!computer['serialNumber']) {
        errors.push(`computers[${i}].serialNumber is required`);
      }
    }
  }

  // Validate mobileDevices array if present
  if (payload['mobileDevices'] && Array.isArray(payload['mobileDevices'])) {
    const devices = payload['mobileDevices'] as Record<string, unknown>[];
    for (let i = 0; i < devices.length; i++) {
      const device = devices[i];
      if (!device) continue;
      if (typeof device['id'] !== 'number') {
        errors.push(`mobileDevices[${i}].id is required and must be a number`);
      }
      if (!device['name']) {
        errors.push(`mobileDevices[${i}].name is required`);
      }
      if (!device['serialNumber']) {
        errors.push(`mobileDevices[${i}].serialNumber is required`);
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

  return { valid: true, payload: payload as unknown as JamfPayload };
}

/**
 * Lambda handler for ingesting Jamf discovery data
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Jamf data ingestion request received', { requestId });

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
    const validationResult = validateJamfPayload(body);
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

    // Ingest Jamf data
    const result = await discoveryService.ingestJamfData(validationResult.payload);

    logger.info('Jamf data ingestion completed', {
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
    logger.error('Failed to ingest Jamf data', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to ingest Jamf data', requestId)
    );
  }
}
