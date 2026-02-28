/**
 * Get Overdue Loans Lambda Handler
 *
 * Retrieves all overdue loaner checkouts with escalation information.
 * Requirement 3.8: Track overdue items
 * Requirement 3.9: Support escalating notifications at 1, 3, and 7 days
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as loanerService from '../loaner/loaner-service';

const logger = createLogger({ service: 'get-overdue-loans-handler' });

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
 * Lambda handler for getting overdue loans
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get overdue loans request received', { requestId });

  try {
    // Parse pagination parameters
    const { page, limit } = parsePaginationParams(event.queryStringParameters);

    // Get overdue loans
    const result = await loanerService.getOverdueLoans({ page, limit });

    logger.info('Overdue loans retrieved successfully', {
      requestId,
      totalOverdue: result.summary.totalOverdue,
      level1Count: result.summary.level1Count,
      level2Count: result.summary.level2Count,
      level3Count: result.summary.level3Count,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        loans: result.loans.items.map(loan => ({
          checkout: loan.checkout,
          daysOverdue: loan.daysOverdue,
          escalationLevel: loanerService.getEscalationLevel(loan.daysOverdue),
          borrower: {
            email: loan.borrowerEmail,
            name: loan.borrowerName,
          },
          manager: {
            email: loan.managerEmail,
            name: loan.managerName,
          },
          asset: {
            tag: loan.assetTag,
            name: loan.assetName,
          },
        })),
        pagination: {
          total: result.loans.total,
          page: result.loans.page,
          limit: result.loans.limit,
          hasMore: result.loans.hasMore,
        },
        summary: result.summary,
        escalationThresholds: loanerService.ESCALATION_THRESHOLDS,
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get overdue loans', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get overdue loans', requestId)
    );
  }
}
