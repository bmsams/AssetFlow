/**
 * List Disposals Lambda Handler
 *
 * Returns paginated disposal workflows with optional status filtering.
 * Requirement 3.6: Enforce disposal workflows
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { DisposalWorkflowStatus } from '../disposal/disposal-repository';
import * as disposalService from '../disposal/disposal-service';

const logger = createLogger({ service: 'list-disposals-handler' });

const VALID_STATUSES: DisposalWorkflowStatus[] = [
  'INITIATED', 'DATA_WIPE_PENDING', 'DATA_WIPE_COMPLETE', 'ENVIRONMENTAL_CHECK_PENDING',
  'ENVIRONMENTAL_CHECK_COMPLETE', 'PICKUP_SCHEDULED', 'COMPLETED', 'CANCELLED',
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List disposals received', { requestId });

  try {
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    const queryParams = event.queryStringParameters ?? {};
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    if (isNaN(page) || page < 1) {
      return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId));
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId));
    }

    let statusFilter: DisposalWorkflowStatus | undefined;
    if (queryParams['status']) {
      const status = queryParams['status'] as DisposalWorkflowStatus;
      if (!VALID_STATUSES.includes(status)) {
        return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`, requestId));
      }
      statusFilter = status;
    }

    const result = await disposalService.listDisposals({ page, limit }, statusFilter);

    logger.info('Disposals listed', { requestId, total: result.total, page, limit });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list disposals', err, { requestId });
    return createLambdaResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list disposals', requestId));
  }
}
