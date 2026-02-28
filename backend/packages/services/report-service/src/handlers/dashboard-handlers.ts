/**
 * Dashboard Handlers - Lambda handlers for dashboard data endpoints
 *
 * Implements HTTP endpoints for:
 * - GET /dashboard/summary - Asset summary with counts and value
 * - GET /dashboard/lease-expirations - Upcoming lease expirations
 * - GET /dashboard/compliance - Compliance indicator data
 *
 * Requirements:
 * - Requirement 12.1: Display total asset value and counts by category
 * - Requirement 12.2: Show lifecycle distribution and compliance indicators
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

import * as dashboardService from '../dashboard/dashboard-service';

const logger = createLogger({ service: 'dashboard-handlers' });

// ============================================================================
// Dashboard Summary Handler
// ============================================================================

/**
 * Get dashboard summary data
 * GET /dashboard/summary
 *
 * Returns total asset count, value, and breakdowns by type and status.
 */
export async function getDashboardSummaryHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get dashboard summary request received', { requestId });

  try {
    const summary = await dashboardService.getDashboardSummary();

    logger.info('Dashboard summary retrieved successfully', {
      requestId,
      totalAssets: summary.totalAssetCount,
      totalValue: summary.totalAssetValue,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get dashboard summary', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get dashboard summary', requestId)
    );
  }
}

// ============================================================================
// Lease Expirations Handler
// ============================================================================

/**
 * Get upcoming lease expirations
 * GET /dashboard/lease-expirations
 *
 * Query Parameters:
 * - days: Number of days ahead to look (default: 180)
 */
export async function getLeaseExpirationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get lease expirations request received', { requestId });

  try {
    // Parse days parameter
    const queryParams = event.queryStringParameters ?? {};
    const daysParam = queryParams['days'];
    let daysAhead = 180;

    if (daysParam) {
      const parsed = parseInt(daysParam, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 365) {
        daysAhead = parsed;
      }
    }

    const expirations = await dashboardService.getLeaseExpirations(daysAhead);

    logger.info('Lease expirations retrieved successfully', {
      requestId,
      count: expirations.length,
      daysAhead,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(expirations, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get lease expirations', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get lease expirations', requestId)
    );
  }
}

// ============================================================================
// Compliance Indicators Handler
// ============================================================================

/**
 * Get compliance indicators
 * GET /dashboard/compliance
 *
 * Returns compliance status for licenses, warranties, maintenance, and audits.
 */
export async function getComplianceIndicatorsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get compliance indicators request received', { requestId });

  try {
    const indicators = await dashboardService.getComplianceIndicators();

    logger.info('Compliance indicators retrieved successfully', {
      requestId,
      count: indicators.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(indicators, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get compliance indicators', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get compliance indicators', requestId)
    );
  }
}

// ============================================================================
// Unified Router Handler (Lambda entry point)
// ============================================================================

/**
 * Main handler that routes to the appropriate dashboard handler based on path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  logger.info('Dashboard request received', { requestId, path });

  if (path.endsWith('/summary')) {
    return getDashboardSummaryHandler(event);
  } else if (path.endsWith('/lease-expirations')) {
    return getLeaseExpirationsHandler(event);
  } else if (path.endsWith('/compliance')) {
    return getComplianceIndicatorsHandler(event);
  }

  return createLambdaResponse(
    HTTP_STATUS.NOT_FOUND,
    createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Unknown dashboard endpoint: ${path}`, requestId)
  );
}

export default handler;
