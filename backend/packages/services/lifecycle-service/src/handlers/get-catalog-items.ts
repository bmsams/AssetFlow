/**
 * Get Catalog Items Lambda Handler
 *
 * Retrieves catalog items with filtering, pagination, and entitlement checking.
 * Requirement 6B.1: Display available items with descriptions and pricing
 * Requirement 6B.2: Support catalog item categories
 * Requirement 6B.9: Enforce entitlement rules based on role/department
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

import type {
  CatalogItemStatus,
  CatalogItemType,
  CatalogSearchFilters,
  UserContext,
} from '../service-catalog/service-catalog-service';
import * as serviceCatalogService from '../service-catalog/service-catalog-service';

const logger = createLogger({ service: 'get-catalog-items-handler' });

/**
 * Valid catalog item types
 */
const VALID_ITEM_TYPES: CatalogItemType[] = ['HARDWARE', 'SOFTWARE', 'SERVICE', 'ACCESSORY', 'BUNDLE'];

/**
 * Valid catalog item statuses
 */
const VALID_STATUSES: CatalogItemStatus[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'COMING_SOON'];

/**
 * Build user context from request
 */
function buildUserContext(event: APIGatewayProxyEvent): UserContext {
  const claims = event.requestContext.authorizer?.['claims'] ?? {};
  
  return {
    userId: claims['sub'] as string,
    roles: (claims['cognito:groups'] as string)?.split(',') ?? [],
    departmentId: claims['custom:department_id'] as string | null ?? null,
    departmentName: claims['custom:department'] as string | null ?? null,
    costCenterId: claims['custom:cost_center_id'] as string | null ?? null,
    locationId: claims['custom:location_id'] as string | null ?? null,
  };
}

/**
 * Parse and validate filters from query parameters
 */
function parseFilters(
  queryParams: Record<string, string | undefined>
): { valid: true; filters: CatalogSearchFilters } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // Temporary mutable object to build filters
  let categoryId: string | undefined;
  let itemType: CatalogItemType | undefined;
  let status: CatalogItemStatus | undefined;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let manufacturer: string | undefined;
  let isRequestable: boolean | undefined;
  let inStock: boolean | undefined;
  let tags: string[] | undefined;

  // Parse categoryId
  if (queryParams['categoryId']) {
    const uuidError = validateUUID(queryParams['categoryId'], 'categoryId');
    if (uuidError) {
      errors.push(uuidError.message);
    } else {
      categoryId = queryParams['categoryId'];
    }
  }

  // Parse itemType
  if (queryParams['itemType']) {
    if (!VALID_ITEM_TYPES.includes(queryParams['itemType'] as CatalogItemType)) {
      errors.push(`itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
    } else {
      itemType = queryParams['itemType'] as CatalogItemType;
    }
  }

  // Parse status
  if (queryParams['status']) {
    if (!VALID_STATUSES.includes(queryParams['status'] as CatalogItemStatus)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    } else {
      status = queryParams['status'] as CatalogItemStatus;
    }
  }

  // Parse minPrice
  if (queryParams['minPrice']) {
    const parsedMinPrice = parseFloat(queryParams['minPrice']);
    if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
      errors.push('minPrice must be a non-negative number');
    } else {
      minPrice = parsedMinPrice;
    }
  }

  // Parse maxPrice
  if (queryParams['maxPrice']) {
    const parsedMaxPrice = parseFloat(queryParams['maxPrice']);
    if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0) {
      errors.push('maxPrice must be a non-negative number');
    } else {
      maxPrice = parsedMaxPrice;
    }
  }

  // Validate price range
  if (minPrice !== undefined && maxPrice !== undefined) {
    if (minPrice > maxPrice) {
      errors.push('minPrice cannot be greater than maxPrice');
    }
  }

  // Parse manufacturer
  if (queryParams['manufacturer']) {
    manufacturer = queryParams['manufacturer'];
  }

  // Parse isRequestable
  if (queryParams['isRequestable']) {
    if (queryParams['isRequestable'] !== 'true' && queryParams['isRequestable'] !== 'false') {
      errors.push('isRequestable must be true or false');
    } else {
      isRequestable = queryParams['isRequestable'] === 'true';
    }
  }

  // Parse inStock
  if (queryParams['inStock']) {
    if (queryParams['inStock'] !== 'true' && queryParams['inStock'] !== 'false') {
      errors.push('inStock must be true or false');
    } else {
      inStock = queryParams['inStock'] === 'true';
    }
  }

  // Parse tags
  if (queryParams['tags']) {
    tags = queryParams['tags'].split(',').map((t) => t.trim()).filter((t) => t.length > 0);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build the immutable filters object
  const filters: CatalogSearchFilters = {
    ...(categoryId !== undefined && { categoryId }),
    ...(itemType !== undefined && { itemType }),
    ...(status !== undefined && { status }),
    ...(minPrice !== undefined && { minPrice }),
    ...(maxPrice !== undefined && { maxPrice }),
    ...(manufacturer !== undefined && { manufacturer }),
    ...(isRequestable !== undefined && { isRequestable }),
    ...(inStock !== undefined && { inStock }),
    ...(tags !== undefined && { tags }),
  };

  return { valid: true, filters };
}

/**
 * Lambda handler for getting catalog items
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get catalog items received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Build user context
    const userContext = buildUserContext(event);

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};

    // Parse pagination
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    // Validate pagination
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Parse filters
    const filterResult = parseFilters(queryParams);
    if (!filterResult.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          filterResult.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Get catalog items
    const result = await serviceCatalogService.getCatalogItems(
      userContext,
      filterResult.filters,
      { page, limit }
    );

    logger.info('Catalog items retrieved', {
      requestId,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get catalog items', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get catalog items', requestId)
    );
  }
}

/**
 * Lambda handler for getting a single catalog item by ID
 */
export async function getItemHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get catalog item received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Get catalog item ID from path parameters
    const catalogItemId = event.pathParameters?.['catalogItemId'];
    if (!catalogItemId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'catalogItemId is required', requestId)
      );
    }

    // Validate catalog item ID is a valid UUID
    const uuidError = validateUUID(catalogItemId, 'catalogItemId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
      );
    }

    // Build user context
    const userContext = buildUserContext(event);

    // Get catalog item
    const item = await serviceCatalogService.getCatalogItem(catalogItemId, userContext);

    if (!item) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Catalog item not found: ${catalogItemId}`, requestId)
      );
    }

    logger.info('Catalog item retrieved', {
      requestId,
      catalogItemId,
      itemCode: item.itemCode,
      isEntitled: item.isEntitled,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(item, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get catalog item', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get catalog item', requestId)
    );
  }
}

/**
 * Lambda handler for browsing catalog (items + categories)
 */
export async function browseHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Browse catalog received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Build user context
    const userContext = buildUserContext(event);

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};

    // Parse categoryId (optional)
    let categoryId: string | undefined;
    if (queryParams['categoryId']) {
      const uuidError = validateUUID(queryParams['categoryId'], 'categoryId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
      categoryId = queryParams['categoryId'];
    }

    // Parse pagination
    const page = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 50;

    // Validate pagination
    if (isNaN(page) || page < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'page must be a positive integer', requestId)
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'limit must be between 1 and 100', requestId)
      );
    }

    // Browse catalog
    const result = await serviceCatalogService.browseCatalog(userContext, categoryId, { page, limit });

    logger.info('Catalog browsed', {
      requestId,
      categoryId,
      itemCount: result.items.length,
      categoryCount: result.categories.length,
      total: result.total,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to browse catalog', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to browse catalog', requestId)
    );
  }
}

/**
 * Lambda handler for getting catalog categories
 */
export async function getCategoriesHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get catalog categories received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters ?? {};

    // Parse parentCategoryId (optional)
    let parentCategoryId: string | null | undefined;
    if (queryParams['parentCategoryId'] === 'null' || queryParams['parentCategoryId'] === '') {
      parentCategoryId = null; // Get top-level categories
    } else if (queryParams['parentCategoryId']) {
      const uuidError = validateUUID(queryParams['parentCategoryId'], 'parentCategoryId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, uuidError.message, requestId)
        );
      }
      parentCategoryId = queryParams['parentCategoryId'];
    }

    // Get categories
    const categories = await serviceCatalogService.getCatalogCategories(parentCategoryId);

    logger.info('Catalog categories retrieved', {
      requestId,
      parentCategoryId,
      categoryCount: categories.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({ categories }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get catalog categories', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get catalog categories', requestId)
    );
  }
}
