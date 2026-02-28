/**
 * List Loaners Lambda Handler
 *
 * Returns paginated loaner checkouts with optional status filtering.
 * Requirement 3.8: Track loaner checkouts with due dates
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { LoanerStatus } from '../loaner/loaner-repository';
import * as loanerService from '../loaner/loaner-service';

const logger = createLogger({ service: 'list-loaners-handler' });

const VALID_STATUSES: LoanerStatus[] = [
  'CHECKED_OUT', 'RETURNED', 'RETURNED_LATE', 'RETURNED_DAMAGED', 'OVERDUE', 'LOST', 'CANCELLED',
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List loaners received', { requestId });

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

    let statusFilter: LoanerStatus[] | undefined;
    if (queryParams['status']) {
      const statuses = queryParams['status'].split(',');
      for (const s of statuses) {
        if (!VALID_STATUSES.includes(s as LoanerStatus)) {
          return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(API_ERROR_CODES.BAD_REQUEST, `Invalid status: ${s}. Must be one of: ${VALID_STATUSES.join(', ')}`, requestId));
        }
      }
      statusFilter = statuses as LoanerStatus[];
    }

    const result = await loanerService.listCheckouts({ page, limit }, statusFilter);

    logger.info('Loaners listed', { requestId, total: result.total, page, limit });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list loaners', err, { requestId });
    return createLambdaResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list loaners', requestId));
  }
}
