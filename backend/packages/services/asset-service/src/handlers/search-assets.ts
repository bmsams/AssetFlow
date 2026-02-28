/**
 * Search Assets Lambda Handler
 *
 * Implements advanced asset search with:
 * - Full-text search via OpenSearch (Requirement 10.5)
 * - Pagination, filtering, and sorting
 * - Cache-aside pattern for frequently accessed results (Requirement 10.3)
 * - Sub-500ms response times (Requirement 10.6)
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { AssetStatus, AssetType, SortDirection } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import * as cache from '@ams/cache';
import { searchResultsKey, CACHE_ENTITY_TYPES } from '@ams/cache';
import { createLogger } from '@ams/utils';
import type { AssetSearchParams, SearchOptions, SearchResult } from '@ams/search';
import { searchAssets as opensearchAssets, isOpenSearchAvailable } from '@ams/search';

import * as assetService from '../service/asset-service';

const logger = createLogger({ service: 'search-assets-handler' });

/**
 * Cache TTL for search results (short TTL since search results change frequently)
 */
const SEARCH_CACHE_TTL = 60; // 1 minute

/**
 * Parse and validate query parameters for asset search
 */
function parseSearchParams(
  params: Record<string, string | undefined> | null
): {
  searchParams: AssetSearchParams;
  options: SearchOptions;
  cacheKey: string;
} {
  const searchParams: AssetSearchParams = {};
  const options: SearchOptions = {
    pagination: {},
    sort: {},
  };

  if (!params) {
    const cacheKey = searchResultsKey(CACHE_ENTITY_TYPES.ASSET, 'all');
    return { searchParams, options, cacheKey };
  }

  // Build search params
  const searchParamsBuilder: Record<string, unknown> = {};

  // Full-text query
  if (params['q'] || params['query'] || params['search']) {
    searchParamsBuilder['query'] = params['q'] ?? params['query'] ?? params['search'];
  }

  // Asset type filter
  if (params['assetType'] || params['type']) {
    const validTypes: AssetType[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'];
    const assetType = params['assetType'] ?? params['type'];
    if (validTypes.includes(assetType as AssetType)) {
      searchParamsBuilder['assetType'] = assetType as AssetType;
    }
  }

  // Status filter (single)
  if (params['status']) {
    const validStatuses: AssetStatus[] = [
      'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
      'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED',
    ];
    if (validStatuses.includes(params['status'] as AssetStatus)) {
      searchParamsBuilder['status'] = params['status'] as AssetStatus;
    }
  }

  // Status filter (multiple, comma-separated)
  if (params['statuses']) {
    const validStatuses: AssetStatus[] = [
      'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
      'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED',
    ];
    const statuses = params['statuses'].split(',').filter(
      (s) => validStatuses.includes(s as AssetStatus)
    ) as AssetStatus[];
    if (statuses.length > 0) {
      searchParamsBuilder['statuses'] = statuses;
    }
  }

  // Assigned to filter
  if (params['assignedTo']) {
    searchParamsBuilder['assignedTo'] = params['assignedTo'];
  }

  // Stockroom filter
  if (params['stockroomId']) {
    searchParamsBuilder['stockroomId'] = params['stockroomId'];
  }

  // Building filters
  if (params['buildingId']) {
    searchParamsBuilder['buildingId'] = params['buildingId'];
  }

  if (params['building']) {
    searchParamsBuilder['building'] = params['building'];
  }

  // Manufacturer filter
  if (params['manufacturer']) {
    searchParamsBuilder['manufacturer'] = params['manufacturer'];
  }

  // Model filter
  if (params['model']) {
    searchParamsBuilder['model'] = params['model'];
  }

  // Serial number filter
  if (params['serialNumber']) {
    searchParamsBuilder['serialNumber'] = params['serialNumber'];
  }

  // Date range filters
  if (params['createdAfter']) {
    searchParamsBuilder['createdAfter'] = params['createdAfter'];
  }
  if (params['createdBefore']) {
    searchParamsBuilder['createdBefore'] = params['createdBefore'];
  }
  if (params['updatedAfter']) {
    searchParamsBuilder['updatedAfter'] = params['updatedAfter'];
  }
  if (params['updatedBefore']) {
    searchParamsBuilder['updatedBefore'] = params['updatedBefore'];
  }

  // Pagination params
  const paginationBuilder: Record<string, unknown> = {};
  if (params['page']) {
    const page = parseInt(params['page'], 10);
    if (!isNaN(page) && page > 0) {
      paginationBuilder['page'] = page;
    }
  }

  const limitParam = params['limit'];
  if (limitParam) {
    const limit = parseInt(limitParam, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      paginationBuilder['limit'] = limit;
    }
  }

  if (params['cursor']) {
    paginationBuilder['cursor'] = params['cursor'];
  }

  // Sort params
  const sortBuilder: Record<string, unknown> = {};
  if (params['sortBy'] || params['sort']) {
    sortBuilder['field'] = params['sortBy'] ?? params['sort'];
  }

  if (params['sortDir'] || params['order']) {
    const dir = (params['sortDir'] ?? params['order'])?.toLowerCase();
    if (dir === 'asc' || dir === 'desc') {
      sortBuilder['direction'] = dir as SortDirection;
    }
  }

  // Build cache key from all parameters
  const cacheKeyParams = {
    ...searchParamsBuilder,
    ...paginationBuilder,
    ...sortBuilder,
  };
  const cacheKey = searchResultsKey(
    CACHE_ENTITY_TYPES.ASSET,
    JSON.stringify(cacheKeyParams)
  );

  return {
    searchParams: searchParamsBuilder as AssetSearchParams,
    options: {
      pagination: paginationBuilder,
      sort: sortBuilder,
    } as SearchOptions,
    cacheKey,
  };
}

/**
 * Fallback to database search when OpenSearch is unavailable
 */
async function fallbackToDatabase(
  searchParams: AssetSearchParams,
  options: SearchOptions
): Promise<SearchResult<import('@ams/types').Asset>> {
  const startTime = Date.now();

  // Convert search params to the simpler AssetSearchQuery format
  const searchQuery = {
    query: searchParams.query,
    assetType: searchParams.assetType,
    status: searchParams.status,
    assignedTo: searchParams.assignedTo,
    stockroomId: searchParams.stockroomId,
    buildingId: (searchParams as AssetSearchParams & { buildingId?: string }).buildingId,
    building: (searchParams as AssetSearchParams & { building?: string }).building,
  };

  const result = await assetService.listAssets(searchQuery, options.pagination);

  return {
    ...result,
    took: Date.now() - startTime,
  };
}

/**
 * Lambda handler for searching assets
 *
 * Implements cache-aside pattern:
 * 1. Check cache for existing results
 * 2. If cache miss, query OpenSearch
 * 3. Store results in cache
 * 4. Return results
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const startTime = Date.now();

  logger.info('Search assets request received', { requestId });

  try {
    // Parse query parameters
    const { searchParams, options, cacheKey } = parseSearchParams(
      event.queryStringParameters as Record<string, string | undefined> | null
    );

    // Check cache first (cache-aside pattern - Requirement 10.3)
    const cachedResult = await cache.get<SearchResult<import('@ams/types').Asset>>(cacheKey);
    if (cachedResult) {
      logger.info('Search cache hit', {
        requestId,
        cacheKey,
        total: cachedResult.total,
        took: Date.now() - startTime,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(
          {
            items: cachedResult.items,
            total: cachedResult.total,
            page: cachedResult.page,
            limit: cachedResult.limit,
            totalPages: Math.max(1, Math.ceil(cachedResult.total / cachedResult.limit)),
            hasMore: cachedResult.hasMore,
            cached: true,
            took: Date.now() - startTime,
          },
          requestId
        )
      );
    }

    // Cache miss - query OpenSearch or fallback to database
    let result: SearchResult<import('@ams/types').Asset>;

    const searchWithLocation = searchParams as AssetSearchParams & { buildingId?: string; building?: string };
    const requiresDbFallbackForBuilding = Boolean(searchWithLocation.buildingId || searchWithLocation.building);

    const opensearchAvailable = await isOpenSearchAvailable();
    if (opensearchAvailable && !requiresDbFallbackForBuilding) {
      logger.info('Using OpenSearch for search', { requestId });
      result = await opensearchAssets(searchParams, options);
    } else {
      logger.info('Using database fallback for search', {
        requestId,
        opensearchAvailable,
        requiresDbFallbackForBuilding,
      });
      result = await fallbackToDatabase(searchParams, options);
    }

    // Store in cache (don't await to avoid blocking response)
    void cache.set(cacheKey, result, SEARCH_CACHE_TTL);

    const totalTime = Date.now() - startTime;

    // Log warning if response time exceeds 500ms (Requirement 10.6)
    if (totalTime > 500) {
      logger.warn('Search response time exceeded 500ms', {
        requestId,
        took: totalTime,
        searchParams,
      });
    }

    logger.info('Search completed', {
      requestId,
      total: result.total,
      returned: result.items.length,
      took: totalTime,
      opensearchTook: result.took,
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
          cached: false,
          took: totalTime,
          maxScore: result.maxScore,
        },
        requestId
      )
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Search failed', error as Error, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        `Search failed: ${errorMessage}`,
        requestId
      )
    );
  }
}
