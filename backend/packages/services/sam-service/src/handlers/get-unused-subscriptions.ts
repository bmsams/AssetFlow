/**
 * Get Unused Subscriptions Lambda Handler
 *
 * Identifies unused SaaS subscriptions for cost optimization.
 * Returns subscriptions with unused seats and potential savings.
 *
 * Requirements: 4.12
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

import * as saasLicenseService from '../saas-license/saas-license-service';

const logger = createLogger({ service: 'get-unused-subscriptions-handler' });

/**
 * Lambda handler for getting unused SaaS subscriptions
 *
 * GET /saas-licenses/unused
 * Query params: minUnusedSeats (optional), inactiveDays (optional)
 *
 * Requirement 4.12: Identify unused subscriptions for cost optimization
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get unused subscriptions request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const minUnusedSeats = queryParams['minUnusedSeats']
      ? parseInt(queryParams['minUnusedSeats'], 10)
      : 1;
    const inactiveDays = queryParams['inactiveDays']
      ? parseInt(queryParams['inactiveDays'], 10)
      : 30;


    // Validate minUnusedSeats
    if (isNaN(minUnusedSeats) || minUnusedSeats < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'minUnusedSeats must be a positive number',
          requestId
        )
      );
    }

    // Validate inactiveDays
    if (isNaN(inactiveDays) || inactiveDays < 1 || inactiveDays > 365) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'inactiveDays must be a number between 1 and 365',
          requestId
        )
      );
    }

    logger.info('Getting unused subscriptions', {
      requestId,
      minUnusedSeats,
      inactiveDays,
    });

    const unusedSubscriptions = await saasLicenseService.getUnusedSubscriptions(
      minUnusedSeats,
      inactiveDays
    );

    // Calculate totals
    const totalUnusedSeats = unusedSubscriptions.reduce(
      (sum, s) => sum + s.unusedSeats,
      0
    );
    const totalPotentialMonthlySavings = unusedSubscriptions.reduce(
      (sum, s) => sum + s.potentialMonthlySavings,
      0
    );
    const totalPotentialAnnualSavings = unusedSubscriptions.reduce(
      (sum, s) => sum + s.potentialAnnualSavings,
      0
    );

    logger.info('Unused subscriptions retrieved', {
      requestId,
      subscriptionsFound: unusedSubscriptions.length,
      totalUnusedSeats,
      totalPotentialAnnualSavings,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: unusedSubscriptions,
          count: unusedSubscriptions.length,
          summary: {
            totalUnusedSeats,
            totalPotentialMonthlySavings,
            totalPotentialAnnualSavings,
          },
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get unused subscriptions', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get unused subscriptions',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for getting subscription summary
 *
 * GET /saas-licenses/summary
 */
export async function getSummaryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get SaaS subscription summary request received', { requestId });

  try {
    const summary = await saasLicenseService.getSubscriptionSummary();

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get subscription summary', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get subscription summary',
        requestId
      )
    );
  }
}