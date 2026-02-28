/**
 * Search Catalog Lambda Handler
 *
 * Searches catalog items with text search, filtering, and entitlement checking.
 * Requirement 6B.2: Support catalog search functionality
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

const logger = createLogger({ service: 'search-catalog-handler' });

/**
 * Valid catalog item types
 */
const VALID_ITEM_TYPES: CatalogItemType[] = ['HARDWARE', 'SOFTWARE', 'SERVICE', 'ACCESSORY', 'BUNDLE'];

/**
 * Valid catalog item statuses
 */
const VALID_STATUSES: CatalogItemStatus[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED', 'COMING_SOON'];

/**
 * Maximum search query length
 */
const MAX_QUERY_LENGTH = 200;

/**
 * Build user context from request
 */
function buildUserContext(event: APIGatewayProxyEvent): UserContext {
  const claims = event.requestContext.authorizer?.['claims'] ?? {};

  return {
    userId: claims['sub'] as string,
    roles: (claims['cognito:groups'] as string)?.split(',') ?? [],
    departmentId: (claims['custom:department_id'] as string | null) ?? null,
    departmentName: (claims['custom:department'] as string | null) ?? null,
    costCenterId: (claims['custom:cost_center_id'] as string | null) ?? null,
    locationId: (claims['custom:location_id'] as string | null) ?? null,
  };
}

/**
 * Parse and validate filters from query parameters
 */
function parseFilters(
  queryParams: Record<string, string | undefined>
): { valid: true; filters: CatalogSearchFilters } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  // Temporary mutable variables to build filters
  let categoryId: string | undefined;
  let itemType: CatalogItemType | undefined;
  let status: CatalogItemStatus | undefined;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let isRequestable: boolean | undefined;

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

  // Parse isRequestable
  if (queryParams['isRequestable']) {
    if (queryParams['isRequestable'] !== 'true' && queryParams['isRequestable'] !== 'false') {
      errors.push('isRequestable must be true or false');
    } else {
      isRequestable = queryParams['isRequestable'] === 'true';
    }
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
    ...(isRequestable !== undefined && { isRequestable }),
  };

  return { valid: true, filters };
}

/**
 * Lambda handler for searching catalog items
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Search catalog received', { requestId });

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

    // Get search query (required)
    const query = queryParams['q'] ?? queryParams['query'] ?? '';

    // Validate query
    if (!query || query.trim().length === 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Search query is required. Use the "q" or "query" parameter.',
          requestId
        )
      );
    }

    if (query.length > MAX_QUERY_LENGTH) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Search query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
          requestId
        )
      );
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

    // Search catalog
    const result = await serviceCatalogService.searchCatalog(
      query,
      userContext,
      filterResult.filters,
      { page, limit }
    );

    logger.info('Catalog search completed', {
      requestId,
      query,
      total: result.total,
      page: result.page,
      limit: result.limit,
      itemCount: result.items.length,
      suggestionCount: result.suggestions.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to search catalog', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to search catalog', requestId)
    );
  }
}

/**
 * Lambda handler for validating item request
 * Checks if user can request a specific catalog item
 */
export async function validateRequestHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Validate item request received', { requestId });

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

    // Parse request body for quantity
    let quantity = 1;
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.quantity !== undefined) {
          quantity = parseInt(body.quantity, 10);
          if (isNaN(quantity) || quantity < 1) {
            return createLambdaResponse(
              HTTP_STATUS.BAD_REQUEST,
              createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'quantity must be a positive integer', requestId)
            );
          }
        }
      } catch {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
        );
      }
    }

    // Build user context
    const userContext = buildUserContext(event);

    // Validate item request
    const result = await serviceCatalogService.validateItemRequest(catalogItemId, quantity, userContext);

    logger.info('Item request validation completed', {
      requestId,
      catalogItemId,
      quantity,
      isValid: result.isValid,
      requiresApproval: result.requiresApproval,
      errorCount: result.errors.length,
    });

    // Return appropriate status based on validation result
    if (!result.isValid) {
      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse(
          {
            isValid: false,
            errors: result.errors,
            requiresApproval: result.requiresApproval,
          },
          requestId
        )
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          isValid: true,
          errors: [],
          requiresApproval: result.requiresApproval,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to validate item request', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to validate item request', requestId)
    );
  }
}
