/**
 * List Transfers Lambda Handler
 *
 * Returns paginated transfer orders with optional status filtering.
 * Requirement 3.10: Process asset movements between stockrooms
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { TransferOrder, TransferOrderLine, TransferOrderStatus } from '../transfer/transfer-service';
import * as transferService from '../transfer/transfer-service';

const logger = createLogger({ service: 'list-transfers-handler' });

const VALID_STATUSES: TransferOrderStatus[] = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
  'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'COMPLETED',
  'CANCELLED', 'ON_HOLD',
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('List transfers received', { requestId });

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
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    let statusFilter: TransferOrderStatus[] | undefined;
    if (queryParams['status']) {
      const statuses = queryParams['status'].split(',');
      for (const s of statuses) {
        if (!VALID_STATUSES.includes(s as TransferOrderStatus)) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(API_ERROR_CODES.BAD_REQUEST, `Invalid status: ${s}. Must be one of: ${VALID_STATUSES.join(', ')}`, requestId)
          );
        }
      }
      statusFilter = statuses as TransferOrderStatus[];
    }

    const result = await transferService.listTransfers({ page, limit }, statusFilter);
    const itemsWithLines = await Promise.all(
      result.items.map(async (transfer) => {
        const transferWithLines = await transferService.getTransfer(transfer.transferId);
        return {
          ...(transfer as TransferOrder),
          lines: transferWithLines?.lines ?? ([] as TransferOrderLine[]),
        };
      })
    );

    logger.info('Transfers listed', { requestId, total: result.total, page, limit });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          ...result,
          items: itemsWithLines,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list transfers', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list transfers', requestId)
    );
  }
}
