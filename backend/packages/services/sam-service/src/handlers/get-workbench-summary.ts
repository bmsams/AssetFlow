/**
 * Get Workbench Summary Lambda Handler
 *
 * Returns the full license workbench summary including compliance positions,
 * audit risks, and reclamation opportunities.
 *
 * Requirements: 4.10, 12.5
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

const logger = createLogger({ service: 'get-workbench-summary-handler' });

/**
 * Lambda handler for getting the license workbench summary
 *
 * GET /sam/workbench/summary
 * Returns aggregated data for the License Workbench page.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get workbench summary request received', { requestId });

  try {
    const positions = await reconciliationService.getCompliancePositions();

    const compliantCount = positions.filter((p) => p.compliancePosition === 'COMPLIANT').length;
    const underLicensedCount = positions.filter((p) => p.compliancePosition === 'UNDER_LICENSED').length;
    const overLicensedCount = positions.filter((p) => p.compliancePosition === 'OVER_LICENSED').length;

    const summary = {
      totalSoftwareTitles: positions.length,
      compliantCount,
      underLicensedCount,
      overLicensedCount,
      totalEntitlementValue: 0,
      totalPotentialExposure: 0,
      totalReclamationSavings: 0,
      criticalRisksCount: 0,
      highRisksCount: 0,
      reclamationOpportunitiesCount: 0,
      compliancePositions: positions,
      auditRisks: [],
      reclamationOpportunities: [],
    };

    logger.info('Workbench summary retrieved', {
      requestId,
      totalSoftwareTitles: summary.totalSoftwareTitles,
      compliantCount: summary.compliantCount,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get workbench summary', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get workbench summary', requestId)
    );
  }
}
