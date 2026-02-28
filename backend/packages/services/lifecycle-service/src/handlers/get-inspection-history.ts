/**
 * Get Inspection History Lambda Handler
 *
 * Retrieves inspection history for an asset or receiving record.
 * Requirement 13.4: Track inspection history per asset
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { InspectionHistoryFilter, InspectionResult, InspectionStatus } from '../receiving/receiving-repository';
import * as receivingService from '../receiving/receiving-service';

const logger = createLogger({ service: 'get-inspection-history-handler' });

/**
 * Valid inspection statuses
 */
const VALID_STATUSES: InspectionStatus[] = ['PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED'];

/**
 * Valid inspection results
 */
const VALID_RESULTS: InspectionResult[] = ['PASSED', 'FAILED'];

/**
 * Validate query parameters
 */
function validateQueryParams(params: Record<string, string | undefined> | null): {
  valid: true;
  data: { filter: InspectionHistoryFilter; page: number; limit: number };
} | { valid: false; errors: string[] } {
  const errors: string[] = [];
  let assetId: string | undefined;
  let receivingLineId: string | undefined;
  let receivingId: string | undefined;
  let status: InspectionStatus | undefined;
  let result: InspectionResult | undefined;

  if (!params) {
    return { valid: true, data: { filter: {}, page: 1, limit: 50 } };
  }

  // Validate assetId (optional)
  if (params['assetId']) {
    const uuidError = validateUUID(params['assetId'], 'assetId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      assetId = params['assetId'];
    }
  }

  // Validate receivingLineId (optional)
  if (params['receivingLineId']) {
    const uuidError = validateUUID(params['receivingLineId'], 'receivingLineId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      receivingLineId = params['receivingLineId'];
    }
  }

  // Validate receivingId (optional)
  if (params['receivingId']) {
    const uuidError = validateUUID(params['receivingId'], 'receivingId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      receivingId = params['receivingId'];
    }
  }

  // Validate status (optional)
  if (params['status']) {
    if (!VALID_STATUSES.includes(params['status'] as InspectionStatus)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      status = params['status'] as InspectionStatus;
    }
  }

  // Validate result (optional)
  if (params['result']) {
    if (!VALID_RESULTS.includes(params['result'] as InspectionResult)) {
      errors.push(`result must be one of: ${VALID_RESULTS.join(', ')}`);
    } else {
      result = params['result'] as InspectionResult;
    }
  }

  // Validate pagination
  let page = 1;
  let limit = 50;

  if (params['page']) {
    const parsedPage = parseInt(params['page'], 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('page must be a positive integer');
    } else {
      page = parsedPage;
    }
  }

  if (params['limit']) {
    const parsedLimit = parseInt(params['limit'], 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      limit = parsedLimit;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build filter object
  const filter: InspectionHistoryFilter = {
    ...(assetId && { assetId }),
    ...(receivingLineId && { receivingLineId }),
    ...(receivingId && { receivingId }),
    ...(status && { status }),
    ...(result && { result }),
  };

  return { valid: true, data: { filter, page, limit } };
}

/**
 * Lambda handler for getting inspection history
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get inspection history request received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Validate query parameters
    const validation = validateQueryParams(event.queryStringParameters);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    const { filter, page, limit } = validation.data;

    // Get inspection records
    const result = await receivingService.getInspectionRecords(filter, { page, limit });

    logger.info('Inspection history retrieved', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get inspection history', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get inspection history', requestId)
    );
  }
}
