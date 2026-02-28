/**
 * Get Maintenance Plan Lambda Handler
 *
 * Retrieves a maintenance plan by ID or lists plans for an asset.
 * Requirements: 5.1
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'get-maintenance-plan-handler' });

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const planId = event.pathParameters?.['planId'];
  const assetId = event.queryStringParameters?.['assetId'];

  logger.info('Get maintenance plan request received', { requestId, planId, assetId });

  try {
    // If planId is provided, get single plan
    if (planId) {
      const uuidError = validateUUID(planId, 'planId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }

      const plan = await maintenanceService.getMaintenancePlan(planId);
      if (!plan) {
        return createLambdaResponse(
          HTTP_STATUS.NOT_FOUND,
          createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Maintenance plan not found: ${planId}`, requestId)
        );
      }

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(plan, requestId));
    }

    // If assetId is provided, get plans for asset
    if (assetId) {
      const uuidError = validateUUID(assetId, 'assetId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }

      const includeInactive = event.queryStringParameters?.['includeInactive'] === 'true';
      const plans = await maintenanceService.getMaintenancePlansByAsset(assetId, includeInactive);

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse({ items: plans, total: plans.length }, requestId));
    }

    // Otherwise, get all active plans with pagination
    const page = parseInt(event.queryStringParameters?.['page'] ?? '1', 10);
    const limit = parseInt(event.queryStringParameters?.['limit'] ?? '50', 10);

    const result = await maintenanceService.getActiveMaintenancePlans({ page, limit });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get maintenance plan', err, { requestId, planId, assetId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get maintenance plan', requestId)
    );
  }
}
