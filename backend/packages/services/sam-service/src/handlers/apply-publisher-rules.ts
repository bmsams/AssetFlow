/**
 * Apply Publisher Rules Lambda Handler
 *
 * Applies vendor-specific license calculation rules for supported publishers
 * (Microsoft, Oracle, Adobe, Salesforce).
 *
 * Requirements: 4.3, 4.4, 4.5
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

import * as publisherPackService from '../publisher-pack/publisher-pack-service';

const logger = createLogger({ service: 'apply-publisher-rules-handler' });

/**
 * Request body for applying publisher rules
 */
interface ApplyPublisherRulesRequest {
  readonly productId?: string;
  readonly publisher?: string;
}

/**
 * Lambda handler for applying publisher-specific license rules
 *
 * POST /publisher-rules/apply
 * Body: { productId?: string, publisher?: string }
 *
 * If productId is provided, applies rules for that specific product.
 * If publisher is provided, applies rules for all products from that publisher.
 * At least one of productId or publisher must be provided.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Apply publisher rules request received', { requestId });

  try {
    // Parse request body
    let request: ApplyPublisherRulesRequest = {};
    if (event.body) {
      try {
        request = JSON.parse(event.body) as ApplyPublisherRulesRequest;
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.BAD_REQUEST,
            'Invalid JSON in request body',
            requestId
          )
        );
      }
    }

    // Validate that at least one parameter is provided
    if (!request.productId && !request.publisher) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Either productId or publisher must be provided',
          requestId
        )
      );
    }

    // If productId is provided, apply rules for specific product
    if (request.productId) {
      const uuidError = validateUUID(request.productId, 'productId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }

      logger.info('Applying publisher rules for specific product', {
        requestId,
        productId: request.productId,
      });

      const result = await publisherPackService.applyPublisherRules(request.productId);

      logger.info('Publisher rules applied for product', {
        requestId,
        productId: request.productId,
        publisher: result.publisher,
        licensesRequired: result.licensesRequired,
        licensesOwned: result.licensesOwned,
        compliancePosition: result.compliancePosition,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
    }

    // If publisher is provided, apply rules for all products from that publisher
    if (request.publisher) {
      // Validate publisher is supported
      if (!publisherPackService.isSupportedPublisher(request.publisher)) {
        const supported = publisherPackService.getSupportedPublishers().join(', ');
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            `Unsupported publisher: ${request.publisher}. Supported publishers: ${supported}`,
            requestId
          )
        );
      }

      logger.info('Applying publisher rules for all products from publisher', {
        requestId,
        publisher: request.publisher,
      });

      const results = await publisherPackService.applyPublisherRulesForPublisher(request.publisher);

      // Calculate summary
      const summary = {
        publisher: request.publisher,
        productsProcessed: results.length,
        compliant: results.filter(r => r.compliancePosition === 'COMPLIANT').length,
        overLicensed: results.filter(r => r.compliancePosition === 'OVER_LICENSED').length,
        underLicensed: results.filter(r => r.compliancePosition === 'UNDER_LICENSED').length,
        totalLicensesRequired: results.reduce((sum, r) => sum + r.licensesRequired, 0),
        totalLicensesOwned: results.reduce((sum, r) => sum + r.licensesOwned, 0),
        totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      };

      logger.info('Publisher rules applied for all products', {
        requestId,
        ...summary,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse({ summary, results }, requestId)
      );
    }

    // Should not reach here
    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Unexpected error', requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to apply publisher rules', err, { requestId });

    // Handle specific errors
    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Unsupported publisher')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to apply publisher rules', requestId)
    );
  }
}
