/**
 * Get Audit Discrepancies Lambda Handler
 *
 * Retrieves discrepancies between expected and scanned assets for an audit.
 * Requirement 3.5: Compare scanned assets against expected inventory and report discrepancies
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as auditService from '../audit/audit-service';

const logger = createLogger({ service: 'get-audit-discrepancies-handler' });

/**
 * Parse pagination parameters from query string
 */
function parsePaginationParams(queryParams: Record<string, string | undefined> | null): {
  page: number;
  limit: number;
} {
  const page = parseInt(queryParams?.['page'] ?? '1', 10);
  const limit = parseInt(queryParams?.['limit'] ?? '50', 10);

  return {
    page: isNaN(page) || page < 1 ? 1 : page,
    limit: isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 100),
  };
}

/**
 * Lambda handler for getting audit discrepancies
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const auditId = event.pathParameters?.['auditId'];

  logger.info('Get audit discrepancies request received', { requestId, auditId });

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

    // Parse pagination parameters
    const { page, limit } = parsePaginationParams(event.queryStringParameters);

    // Get discrepancies
    const result = await auditService.getAuditDiscrepancies(auditId, { page, limit });

    logger.info('Audit discrepancies retrieved successfully', {
      requestId,
      auditId,
      totalDiscrepancies: result.summary.totalDiscrepancies,
      accuracyPercentage: result.summary.accuracyPercentage,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get audit discrepancies', err, { requestId, auditId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get audit discrepancies', requestId)
    );
  }
}
