/**
 * List Linear Assets Lambda Handler
 *
 * Returns paginated linear assets with optional route type filtering.
 * Requirement 5.3: Track assets spanning physical distances
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { RouteType } from '../linear-asset';
import * as linearAssetService from '../linear-asset';

const logger = createLogger({ service: 'list-linear-assets-handler' });

const VALID_ROUTE_TYPES: RouteType[] = [
  'PIPELINE', 'CABLE', 'TRACK', 'ROAD', 'FENCE', 'CONVEYOR', 'DUCT', 'OTHER',
];

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List linear assets received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};

    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    if (isNaN(page) || page < 1) {
      return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId));
    }
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId));
    }

    let result;
    if (queryParams['routeType']) {
      const routeType = queryParams['routeType'] as RouteType;
      if (!VALID_ROUTE_TYPES.includes(routeType)) {
        return createLambdaResponse(HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST,
            `Invalid routeType: ${routeType}. Must be one of: ${VALID_ROUTE_TYPES.join(', ')}`, requestId));
      }
      result = await linearAssetService.getLinearAssetsByRouteType(routeType, { page, limit });
    } else {
      result = await linearAssetService.getLinearAssets({ page, limit });
    }

    logger.info('Linear assets listed', { requestId, total: result.total, page, limit });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list linear assets', err, { requestId });
    return createLambdaResponse(HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list linear assets', requestId));
  }
}
