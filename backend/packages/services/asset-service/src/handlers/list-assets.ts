/**
 * List Assets Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetSearchQuery, AssetStatus, AssetType, PaginationParams } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'list-assets-handler' });

/**
 * Parse query parameters for asset search
 */
function parseQueryParams(params: Record<string, string | undefined> | null): {
  searchQuery: AssetSearchQuery;
  pagination: PaginationParams;
} {
  let searchQuery: AssetSearchQuery = {};
  let pagination: PaginationParams = {};

  if (!params) {
    return { searchQuery, pagination };
  }

  // Search query params
  const query = params['query'] ?? params['search'] ?? params['q'];
  if (query) {
    searchQuery = { ...searchQuery, query };
  }

  const assetType = params['assetType'] ?? params['type'];
  if (assetType) {
    const validTypes: AssetType[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'];
    if (validTypes.includes(assetType as AssetType)) {
      searchQuery = { ...searchQuery, assetType: assetType as AssetType };
    }
  }

  if (params['status']) {
    const validStatuses: AssetStatus[] = [
      'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
      'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
    ];
    if (validStatuses.includes(params['status'] as AssetStatus)) {
      searchQuery = { ...searchQuery, status: params['status'] as AssetStatus };
    }
  }

  if (params['assignedTo']) {
    searchQuery = { ...searchQuery, assignedTo: params['assignedTo'] };
  }

  if (params['stockroomId']) {
    searchQuery = { ...searchQuery, stockroomId: params['stockroomId'] };
  }

  if (params['buildingId']) {
    searchQuery = { ...searchQuery, buildingId: params['buildingId'] };
  }

  if (params['building']) {
    searchQuery = { ...searchQuery, building: params['building'] };
  }

  // Pagination params
  if (params['page']) {
    const page = parseInt(params['page'], 10);
    if (!isNaN(page) && page > 0) {
      pagination = { ...pagination, page };
    }
  }

  const limitParam = params['limit'];
  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      pagination = { ...pagination, limit };
    }
  }

  if (params['cursor']) {
    pagination = { ...pagination, cursor: params['cursor'] };
  }

  return { searchQuery, pagination };
}

/**
 * Lambda handler for listing assets
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List assets request received', { requestId });

  try {
    // Parse query parameters
    const { searchQuery, pagination } = parseQueryParams(
      event.queryStringParameters as Record<string, string | undefined> | null
    );

    // List assets
    const result = await assetService.listAssets(searchQuery, pagination);

    logger.info('Assets listed successfully', {
      requestId,
      total: result.total,
      returned: result.items.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: result.items,
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        },
        requestId
      )
    );
  } catch (error) {
    logger.error('Failed to list assets', error as Error, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to list assets', requestId)
    );
  }
}
