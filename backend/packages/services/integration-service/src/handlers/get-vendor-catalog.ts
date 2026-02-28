/**
 * Get Vendor Catalog Lambda Handler
 *
 * Handles retrieval of vendor product catalogs with search and filtering.
 * Supports vendors like CDW, Insight, SHI, Dell Direct, HP Direct.
 *
 * Requirement 7.5: Vendor integration for catalog access
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

import type { CatalogItemAvailability, VendorCatalogSearchRequest, VendorType } from '../vendor/vendor-types';
import * as vendorService from '../vendor/vendor-service';

const logger = createLogger({ service: 'get-vendor-catalog-handler' });

/**
 * Supported vendor types for catalog retrieval
 */
const SUPPORTED_VENDORS: VendorType[] = ['CDW', 'INSIGHT', 'SHI', 'DELL_DIRECT', 'HP_DIRECT', 'OTHER'];

/**
 * Valid availability values
 */
const VALID_AVAILABILITY: CatalogItemAvailability[] = ['IN_STOCK', 'LIMITED', 'BACKORDERED', 'DISCONTINUED'];

/**
 * Parse and validate query parameters for catalog search
 */
function parseSearchRequest(
  queryParams: Record<string, string | undefined> | null,
  vendorType?: VendorType
): { valid: true; request: VendorCatalogSearchRequest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!queryParams) {
    return { valid: true, request: { vendorType } };
  }

  // Build request object
  let parsedVendorType: VendorType | undefined = vendorType;
  let searchTerm: string | undefined;
  let category: string | undefined;
  let manufacturer: string | undefined;
  let minPrice: number | undefined;
  let maxPrice: number | undefined;
  let availability: CatalogItemAvailability | undefined;
  let page: number | undefined;
  let limit: number | undefined;

  // Vendor type (optional if provided in path)
  if (!vendorType && queryParams['vendorType']) {
    const vt = queryParams['vendorType'].toUpperCase() as VendorType;
    if (!SUPPORTED_VENDORS.includes(vt)) {
      errors.push(`Invalid vendorType. Supported: ${SUPPORTED_VENDORS.join(', ')}`);
    } else {
      parsedVendorType = vt;
    }
  }

  // Search term
  if (queryParams['search']) {
    searchTerm = queryParams['search'];
  }

  // Category filter
  if (queryParams['category']) {
    category = queryParams['category'];
  }

  // Manufacturer filter
  if (queryParams['manufacturer']) {
    manufacturer = queryParams['manufacturer'];
  }

  // Price range
  if (queryParams['minPrice']) {
    const parsedMinPrice = parseFloat(queryParams['minPrice']);
    if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
      errors.push('minPrice must be a non-negative number');
    } else {
      minPrice = parsedMinPrice;
    }
  }

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

  // Availability filter
  if (queryParams['availability']) {
    const parsedAvailability = queryParams['availability'].toUpperCase() as CatalogItemAvailability;
    if (!VALID_AVAILABILITY.includes(parsedAvailability)) {
      errors.push(`Invalid availability. Valid values: ${VALID_AVAILABILITY.join(', ')}`);
    } else {
      availability = parsedAvailability;
    }
  }

  // Pagination
  if (queryParams['page']) {
    const parsedPage = parseInt(queryParams['page'], 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push('page must be a positive integer');
    } else {
      page = parsedPage;
    }
  }

  if (queryParams['limit']) {
    const parsedLimit = parseInt(queryParams['limit'], 10);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      errors.push('limit must be an integer between 1 and 100');
    } else {
      limit = parsedLimit;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const request: VendorCatalogSearchRequest = {
    vendorType: parsedVendorType,
    searchTerm,
    category,
    manufacturer,
    minPrice,
    maxPrice,
    availability,
    page,
    limit,
  };

  return { valid: true, request };
}

/**
 * Lambda handler for getting vendor catalog
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Vendor catalog request received', { requestId });

  try {
    // Get vendor type from path parameter (optional)
    const pathVendorType = event.pathParameters?.['vendorType']?.toUpperCase() as VendorType | undefined;

    if (pathVendorType && !SUPPORTED_VENDORS.includes(pathVendorType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          `Invalid vendor type. Supported vendors: ${SUPPORTED_VENDORS.join(', ')}`,
          requestId
        )
      );
    }

    // Parse query parameters
    const parseResult = parseSearchRequest(
      event.queryStringParameters as Record<string, string | undefined> | null,
      pathVendorType
    );

    if (!parseResult.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Invalid query parameters',
          requestId,
          parseResult.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // If vendor type is specified and no search params, return full catalog
    if (pathVendorType && !parseResult.request.searchTerm && !parseResult.request.category) {
      const catalog = await vendorService.getVendorCatalog(pathVendorType);

      logger.info('Vendor catalog retrieved', {
        requestId,
        vendorType: pathVendorType,
        totalItems: catalog.totalItems,
        categories: catalog.categories.length,
      });

      return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(catalog, requestId));
    }

    // Otherwise, perform search
    const searchResult = await vendorService.searchVendorCatalog(parseResult.request);

    logger.info('Vendor catalog search completed', {
      requestId,
      vendorType: parseResult.request.vendorType,
      searchTerm: parseResult.request.searchTerm,
      totalCount: searchResult.totalCount,
      returnedItems: searchResult.items.length,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(searchResult, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get vendor catalog', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to get vendor catalog', requestId)
    );
  }
}

