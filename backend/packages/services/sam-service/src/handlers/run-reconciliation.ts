/**
 * Run Reconciliation Lambda Handler
 *
 * Executes software license reconciliation for a specific product or all products.
 * Compares entitlements owned against installations discovered to determine compliance position.
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

const logger = createLogger({ service: 'run-reconciliation-handler' });

/**
 * Request body for reconciliation
 */
interface RunReconciliationRequest {
  readonly productId?: string;
  readonly reconciliationType?: 'AUTOMATIC' | 'MANUAL' | 'ON_DEMAND' | 'AUDIT_PREP';
}

/**
 * Validate reconciliation type
 */
function isValidReconciliationType(
  type: string | undefined
): type is 'AUTOMATIC' | 'MANUAL' | 'ON_DEMAND' | 'AUDIT_PREP' {
  if (!type) return true; // Optional, defaults to ON_DEMAND
  return ['AUTOMATIC', 'MANUAL', 'ON_DEMAND', 'AUDIT_PREP'].includes(type);
}

/**
 * Lambda handler for running reconciliation
 *
 * POST /reconciliation/run
 * Body: { productId?: string, reconciliationType?: string }
 *
 * If productId is provided, reconciles that specific product.
 * If productId is not provided, reconciles all active products.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Run reconciliation request received', { requestId });

  try {
    // Parse request body
    let request: RunReconciliationRequest = {};
    if (event.body) {
      try {
        request = JSON.parse(event.body) as RunReconciliationRequest;
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Validate reconciliation type
    if (!isValidReconciliationType(request.reconciliationType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'reconciliationType must be one of: AUTOMATIC, MANUAL, ON_DEMAND, AUDIT_PREP',
          requestId
        )
      );
    }

    const reconciliationType = request.reconciliationType ?? 'ON_DEMAND';

    // If productId is provided, reconcile specific product
    if (request.productId) {
      const uuidError = validateUUID(request.productId, 'productId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }

      logger.info('Running reconciliation for specific product', {
        requestId,
        productId: request.productId,
        reconciliationType,
      });

      const result = await reconciliationService.runReconciliation(
        request.productId,
        reconciliationType
      );

      logger.info('Reconciliation completed for product', {
        requestId,
        productId: request.productId,
        compliancePosition: result.compliancePosition,
        entitlementsOwned: result.entitlementsOwned,
        installationsFound: result.installationsFound,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
    }

    // No productId provided - reconcile all products
    logger.info('Running reconciliation for all products', {
      requestId,
      reconciliationType,
    });

    const runResult = await reconciliationService.runReconciliationForAllProducts(reconciliationType);

    logger.info('Reconciliation run completed', {
      requestId,
      runId: runResult.runId,
      productsReconciled: runResult.productsReconciled,
      compliant: runResult.summary.compliant,
      overLicensed: runResult.summary.overLicensed,
      underLicensed: runResult.summary.underLicensed,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(runResult, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to run reconciliation', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to run reconciliation', requestId)
    );
  }
}
