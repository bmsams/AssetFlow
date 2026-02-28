/**
 * Get Reconciliation Summary Lambda Handler
 *
 * Returns a summary of the reconciliation state across all software products.
 *
 * Requirements: 4.1, 4.2
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

import * as reconciliationService from '../reconciliation/reconciliation-service';

const logger = createLogger({ service: 'get-reconciliation-summary-handler' });

/**
 * Lambda handler for getting reconciliation summary
 *
 * GET /reconciliation/summary
 * Returns aggregated reconciliation metrics across all products.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get reconciliation summary request received', { requestId });

  try {
    const positions = await reconciliationService.getCompliancePositions();

    const summary = {
      totalProducts: positions.length,
      reconciled: positions.filter((p) => p.compliancePosition === 'COMPLIANT').length,
      unreconciled: positions.filter((p) => p.compliancePosition !== 'COMPLIANT').length,
      lastReconciliationDate: new Date().toISOString(),
    };

    logger.info('Reconciliation summary retrieved', {
      requestId,
      totalProducts: summary.totalProducts,
      reconciled: summary.reconciled,
      unreconciled: summary.unreconciled,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get reconciliation summary', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get reconciliation summary', requestId)
    );
  }
}
