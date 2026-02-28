/**
 * Sync Cost Centers Lambda Handler
 *
 * Handles synchronization of cost centers from ERP systems (SAP, Oracle, Workday).
 * Requirement 7.4: Sync cost centers from ERP systems
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

import type { ERPSystemType, SyncCostCentersRequest } from '../erp/erp-types';
import * as erpService from '../erp/erp-service';

const logger = createLogger({ service: 'sync-cost-centers-handler' });

/**
 * Valid ERP system types
 */
const VALID_ERP_SYSTEMS: ERPSystemType[] = ['SAP', 'ORACLE', 'WORKDAY'];

/**
 * Validate sync cost centers request
 */
function validateRequest(
  body: unknown
): { valid: true; request: SyncCostCentersRequest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be a JSON object'] };
  }

  const payload = body as Record<string, unknown>;

  // Validate erpSystem (required)
  if (!payload['erpSystem']) {
    errors.push('erpSystem is required');
  } else if (!VALID_ERP_SYSTEMS.includes(payload['erpSystem'] as ERPSystemType)) {
    errors.push(`erpSystem must be one of: ${VALID_ERP_SYSTEMS.join(', ')}`);
  }

  // Validate direction (optional)
  if (payload['direction'] && !['INBOUND', 'OUTBOUND', 'BIDIRECTIONAL'].includes(payload['direction'] as string)) {
    errors.push('direction must be one of: INBOUND, OUTBOUND, BIDIRECTIONAL');
  }

  // Validate costCenterCodes (optional)
  if (payload['costCenterCodes'] && !Array.isArray(payload['costCenterCodes'])) {
    errors.push('costCenterCodes must be an array of strings');
  }

  // Validate companyCode (optional)
  if (payload['companyCode'] && typeof payload['companyCode'] !== 'string') {
    errors.push('companyCode must be a string');
  }

  // Validate includeInactive (optional)
  if (payload['includeInactive'] !== undefined && typeof payload['includeInactive'] !== 'boolean') {
    errors.push('includeInactive must be a boolean');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, request: payload as unknown as SyncCostCentersRequest };
}

/**
 * Lambda handler for syncing cost centers from ERP systems
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Cost center sync request received', { requestId });

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

    // Validate request
    const validationResult = validateRequest(body);
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

    // Sync cost centers
    const result = await erpService.syncCostCenters(validationResult.request);

    logger.info('Cost center sync completed', {
      requestId,
      erpSystem: result.erpSystem,
      totalRecords: result.totalRecords,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      failedCount: result.failedCount,
      processingTimeMs: result.processingTimeMs,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to sync cost centers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to sync cost centers', requestId)
    );
  }
}
