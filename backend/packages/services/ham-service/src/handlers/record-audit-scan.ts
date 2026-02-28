/**
 * Record Audit Scan Lambda Handler
 *
 * Records a barcode/QR code scan during a mobile audit.
 * Requirement 3.4: Support barcode and QR code scanning for asset verification
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { AssetCondition } from '../audit/audit-service';
import * as auditService from '../audit/audit-service';

const logger = createLogger({ service: 'record-audit-scan-handler' });

/**
 * Valid asset conditions
 */
const VALID_CONDITIONS: AssetCondition[] = [
  'NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'MISSING', 'UNKNOWN'
];

/**
 * Request body interface
 */
interface RecordAuditScanRequest {
  readonly barcodeScanned: string;
  readonly foundLocation?: string;
  readonly foundCondition?: AssetCondition;
  readonly notes?: string;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: RecordAuditScanRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as Record<string, unknown>;
  const errors: string[] = [];

  // Validate barcodeScanned (required)
  if (!request['barcodeScanned']) {
    errors.push('barcodeScanned is required');
  } else if (typeof request['barcodeScanned'] !== 'string') {
    errors.push('barcodeScanned must be a string');
  } else if (request['barcodeScanned'].length === 0) {
    errors.push('barcodeScanned cannot be empty');
  } else if (request['barcodeScanned'].length > 255) {
    errors.push('barcodeScanned exceeds maximum length of 255 characters');
  }

  // Validate foundLocation (optional)
  if (request['foundLocation'] !== undefined && request['foundLocation'] !== null) {
    if (typeof request['foundLocation'] !== 'string') {
      errors.push('foundLocation must be a string');
    } else if (request['foundLocation'].length > 255) {
      errors.push('foundLocation exceeds maximum length of 255 characters');
    }
  }

  // Validate foundCondition (optional)
  if (request['foundCondition'] !== undefined && request['foundCondition'] !== null) {
    if (typeof request['foundCondition'] !== 'string') {
      errors.push('foundCondition must be a string');
    } else if (!VALID_CONDITIONS.includes(request['foundCondition'] as AssetCondition)) {
      errors.push(`foundCondition must be one of: ${VALID_CONDITIONS.join(', ')}`);
    }
  }

  // Validate notes (optional)
  if (request['notes'] !== undefined && request['notes'] !== null) {
    if (typeof request['notes'] !== 'string') {
      errors.push('notes must be a string');
    } else if (request['notes'].length > 1000) {
      errors.push('notes exceeds maximum length of 1000 characters');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      barcodeScanned: request['barcodeScanned'] as string,
      foundLocation: request['foundLocation'] as string | undefined,
      foundCondition: request['foundCondition'] as AssetCondition | undefined,
      notes: request['notes'] as string | undefined,
    },
  };
}

/**
 * Lambda handler for recording audit scans
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const auditId = event.pathParameters?.['auditId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Record audit scan request received', { requestId, auditId });

  try {
    // Validate audit ID
    if (!auditId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Audit ID is required', requestId)
      );
    }

    const uuidError = validateUUID(auditId, 'auditId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

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

    // Record the scan
    const result = await auditService.recordAuditScan(
      auditId,
      validation.data.barcodeScanned,
      userId,
      {
        foundLocation: validation.data.foundLocation,
        foundCondition: validation.data.foundCondition,
        notes: validation.data.notes,
      }
    );

    logger.info('Audit scan recorded successfully', {
      requestId,
      auditId,
      scanId: result.scan.scanId,
      isDiscrepancy: result.discrepancy !== null,
    });

    return createLambdaResponse(
      HTTP_STATUS.CREATED,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to record audit scan', err, { requestId, auditId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('not in progress')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    if (err.message.includes('already scanned')) {
      return createLambdaResponse(
        HTTP_STATUS.CONFLICT,
        createErrorResponse(API_ERROR_CODES.CONFLICT, err.message, requestId)
      );
    }

    if (err.message.includes('Invalid scan data')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to record audit scan', requestId)
    );
  }
}
