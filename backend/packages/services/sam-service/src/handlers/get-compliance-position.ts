/**
 * Get Compliance Position Lambda Handler
 *
 * Retrieves the current compliance position for a software product.
 * Shows entitlements owned vs installations found and compliance status.
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
import { createLogger, validateUUID } from '@ams/utils';

import * as reconciliationService from '../reconciliation/reconciliation-service';

const logger = createLogger({ service: 'get-compliance-position-handler' });

/**
 * Lambda handler for getting compliance position
 *
 * GET /reconciliation/compliance/{productId}
 * Returns the current compliance position for the specified product.
 *
 * GET /reconciliation/compliance
 * Returns compliance positions for all active products.
 *
 * Query parameters:
 * - issuesOnly: If 'true', returns only products with compliance issues (under-licensed)
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const productId = event.pathParameters?.['productId'];
  const issuesOnly = event.queryStringParameters?.['issuesOnly'] === 'true';

  logger.info('Get compliance position request received', {
    requestId,
    productId,
    issuesOnly,
  });

  try {
    // If productId is provided, get compliance for specific product
    if (productId) {
      const uuidError = validateUUID(productId, 'productId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }

      logger.info('Getting compliance position for specific product', {
        requestId,
        productId,
      });

      const position = await reconciliationService.getCompliancePosition(productId);

      logger.info('Compliance position retrieved', {
        requestId,
        productId,
        compliancePosition: position.compliancePosition,
        entitlementsOwned: position.entitlementsOwned,
        installationsFound: position.installationsFound,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(position, requestId));
    }

    // No productId - get compliance for all products or issues only
    if (issuesOnly) {
      logger.info('Getting products with compliance issues', { requestId });

      const issues = await reconciliationService.getComplianceIssues();

      logger.info('Compliance issues retrieved', {
        requestId,
        issueCount: issues.length,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(
          {
            items: issues,
            total: issues.length,
            issuesOnly: true,
          },
          requestId
        )
      );
    }

    // Get all compliance positions
    logger.info('Getting compliance positions for all products', { requestId });

    const positions = await reconciliationService.getCompliancePositions();

    // Calculate summary
    const summary = {
      total: positions.length,
      compliant: positions.filter((p) => p.compliancePosition === 'COMPLIANT').length,
      overLicensed: positions.filter((p) => p.compliancePosition === 'OVER_LICENSED').length,
      underLicensed: positions.filter((p) => p.compliancePosition === 'UNDER_LICENSED').length,
    };

    logger.info('Compliance positions retrieved', {
      requestId,
      total: summary.total,
      compliant: summary.compliant,
      overLicensed: summary.overLicensed,
      underLicensed: summary.underLicensed,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: positions,
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get compliance position', err, { requestId, productId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get compliance position', requestId)
    );
  }
}
