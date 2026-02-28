/**
 * Get Asset Audit Log Lambda Handler
 *
 * Retrieves the complete audit history for a specific asset (Requirement 2.5, 2.7)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'get-audit-log-handler' });

/**
 * Lambda handler for getting an asset's audit log
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const assetId = event.pathParameters?.['assetId'];

  logger.info('Get asset audit log request received', { requestId, assetId });

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

    // Parse pagination parameters
    const page = parseInt(event.queryStringParameters?.['page'] ?? '1', 10);
    const limit = parseInt(event.queryStringParameters?.['limit'] ?? '50', 10);

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Invalid pagination parameters. Page must be >= 1, limit must be between 1 and 100',
          requestId
        )
      );
    }

    // Get audit log
    const auditLog = await assetService.getAssetAuditLog(assetId, { page, limit });

    logger.info('Asset audit log retrieved successfully', {
      requestId,
      assetId,
      total: auditLog.total,
      page: auditLog.page,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(auditLog, requestId)
    );
  } catch (error) {
    logger.error('Failed to get asset audit log', error as Error, { requestId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get asset audit log', requestId)
    );
  }
}
