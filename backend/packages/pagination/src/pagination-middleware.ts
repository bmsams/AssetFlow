/**
 * Pagination Middleware
 * 
 * Provides middleware for parsing pagination, filtering, and sorting
 * parameters from API Gateway requests.
 * 
 * Validates: Requirements 8.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
  type ValidationError,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import {
  type CursorBasedPaginationParams,
  type FilterParams,
  type PageBasedPaginationParams,
  type PaginatedApiResponse,
  type PaginationError,
  type PaginationMiddlewareOptions,
  type PaginationParams,
  type ParsedPaginationRequest,
  type SortParams,
  PAGINATION_DEFAULTS,
  PAGINATION_ERROR_CODES,
  PaginationParseError,
} from './pagination-types';
import {
  decodeCursor,
  isCursorExpired,
  normalizeLimit,
  normalizePage,
  parseFilterString,
  parseSortString,
  validateFilterFields,
  validateSortFields,
} from './pagination-utils';

const logger = createLogger({ service: 'pagination-middleware' });

/**
 * Default middleware options
 */
const DEFAULT_MIDDLEWARE_OPTIONS: Required<PaginationMiddlewareOptions> = {
  defaultLimit: PAGINATION_DEFAULTS.DEFAULT_LIMIT,
  maxLimit: PAGINATION_DEFAULTS.MAX_LIMIT,
  defaultSortField: 'createdAt',
  defaultSortDirection: 'desc',
  allowedSortFields: [],
  allowedFilterFields: [],
  includeTotalCount: true,
  preferredMode: 'page',
};

/**
 * Parse pagination parameters from query string
 */
export function parsePaginationParams(
  queryParams: Record<string, string | undefined> | null,
  options: PaginationMiddlewareOptions = {}
): { params: PaginationParams; errors: readonly PaginationError[] } {
  const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  const errors: PaginationError[] = [];
  
  const rawPage = queryParams?.['page'];
  const rawLimit = queryParams?.['limit'] ?? queryParams?.['pageSize'];
  const rawCursor = queryParams?.['cursor'] ?? queryParams?.['after'];
  
  // Determine pagination mode
  const hasCursor = rawCursor !== undefined && rawCursor !== '';
  const mode = hasCursor ? 'cursor' : mergedOptions.preferredMode;
  
  // Parse and validate limit
  let limit: number;
  if (rawLimit !== undefined) {
    const parsedLimit = parseInt(rawLimit, 10);
    if (isNaN(parsedLimit) || parsedLimit < PAGINATION_DEFAULTS.MIN_LIMIT) {
      errors.push({
        field: 'limit',
        message: `Invalid limit: must be a positive integer between ${PAGINATION_DEFAULTS.MIN_LIMIT} and ${mergedOptions.maxLimit}`,
        code: PAGINATION_ERROR_CODES.INVALID_LIMIT,
      });
      limit = mergedOptions.defaultLimit;
    } else {
      limit = normalizeLimit(parsedLimit, mergedOptions.maxLimit, mergedOptions.defaultLimit);
    }
  } else {
    limit = mergedOptions.defaultLimit;
  }
  
  if (mode === 'cursor') {
    // Cursor-based pagination
    let cursor: string | undefined;
    
    if (hasCursor) {
      const decodedCursor = decodeCursor(rawCursor!);
      if (!decodedCursor) {
        errors.push({
          field: 'cursor',
          message: 'Invalid cursor format',
          code: PAGINATION_ERROR_CODES.INVALID_CURSOR,
        });
      } else if (isCursorExpired(decodedCursor)) {
        errors.push({
          field: 'cursor',
          message: 'Cursor has expired. Please start from the beginning.',
          code: PAGINATION_ERROR_CODES.EXPIRED_CURSOR,
        });
      } else {
        cursor = rawCursor;
      }
    }
    
    const params: CursorBasedPaginationParams = {
      mode: 'cursor',
      cursor,
      limit,
    };
    
    return { params, errors };
  }
  
  // Page-based pagination
  let page: number;
  if (rawPage !== undefined) {
    const parsedPage = parseInt(rawPage, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      errors.push({
        field: 'page',
        message: 'Invalid page: must be a positive integer',
        code: PAGINATION_ERROR_CODES.INVALID_PAGE,
      });
      page = PAGINATION_DEFAULTS.DEFAULT_PAGE;
    } else {
      page = normalizePage(parsedPage);
    }
  } else {
    page = PAGINATION_DEFAULTS.DEFAULT_PAGE;
  }
  
  const params: PageBasedPaginationParams = {
    mode: 'page',
    page,
    limit,
  };
  
  return { params, errors };
}

/**
 * Parse sort parameters from query string
 */
export function parseSortParams(
  queryParams: Record<string, string | undefined> | null,
  options: PaginationMiddlewareOptions = {}
): { params: SortParams; errors: readonly PaginationError[] } {
  const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  
  const rawSort = queryParams?.['sort'] ?? queryParams?.['sortBy'] ?? queryParams?.['orderBy'];
  const rawDirection = queryParams?.['sortDirection'] ?? queryParams?.['order'] ?? queryParams?.['sortOrder'];
  
  // Parse sort string
  let sorts = parseSortString(
    rawSort,
    mergedOptions.defaultSortField,
    mergedOptions.defaultSortDirection
  );
  
  // Apply direction override if provided and only one sort field
  if (rawDirection && sorts.length === 1) {
    const direction = rawDirection.toLowerCase() === 'asc' ? 'asc' : 'desc';
    sorts = [{ ...sorts[0]!, direction }];
  }
  
  // Validate sort fields
  const errors = validateSortFields(sorts, mergedOptions.allowedSortFields);
  
  return {
    params: { sorts },
    errors,
  };
}

/**
 * Parse filter parameters from query string
 */
export function parseFilterParams(
  queryParams: Record<string, string | undefined> | null,
  options: PaginationMiddlewareOptions = {}
): { params: FilterParams; errors: readonly PaginationError[] } {
  const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  
  const rawFilter = queryParams?.['filter'] ?? queryParams?.['filters'] ?? queryParams?.['where'];
  
  // Parse filter string
  const filters = parseFilterString(rawFilter);
  
  // Validate filter fields
  const errors = validateFilterFields(filters, mergedOptions.allowedFilterFields);
  
  return {
    params: { filters },
    errors,
  };
}

/**
 * Parse all list query parameters from request
 */
export function parseListQueryParams(
  queryParams: Record<string, string | undefined> | null,
  options: PaginationMiddlewareOptions = {}
): ParsedPaginationRequest {
  const paginationResult = parsePaginationParams(queryParams, options);
  const sortResult = parseSortParams(queryParams, options);
  const filterResult = parseFilterParams(queryParams, options);
  
  const allErrors = [
    ...paginationResult.errors,
    ...sortResult.errors,
    ...filterResult.errors,
  ];
  
  return {
    pagination: paginationResult.params,
    sort: sortResult.params,
    filter: filterResult.params,
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Get parsed pagination request from API Gateway event
 * Throws PaginationParseError if validation fails
 */
export function getPaginationRequest(
  event: APIGatewayProxyEvent,
  options: PaginationMiddlewareOptions = {}
): ParsedPaginationRequest {
  const result = parseListQueryParams(event.queryStringParameters, options);
  
  if (!result.isValid) {
    throw new PaginationParseError(
      'Invalid pagination parameters',
      result.errors
    );
  }
  
  return result;
}

/**
 * Handler type for paginated handlers
 */
export type PaginatedHandler<T> = (
  event: APIGatewayProxyEvent,
  paginationRequest: ParsedPaginationRequest
) => Promise<PaginatedApiResponse<T>>;

/**
 * Create a pagination middleware wrapper
 * 
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
export function withPagination<T>(
  options: PaginationMiddlewareOptions = {}
): (handler: PaginatedHandler<T>) => (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return (handler: PaginatedHandler<T>) => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const requestId = event.requestContext.requestId;
      
      try {
        // Parse pagination parameters
        const paginationRequest = parseListQueryParams(event.queryStringParameters, options);
        
        if (!paginationRequest.isValid) {
          logger.warn('Pagination parameter validation failed', {
            requestId,
            path: event.path,
            method: event.httpMethod,
            errorCount: paginationRequest.errors.length,
            errors: paginationRequest.errors,
          });
          
          // Convert to base ValidationError type for response
          const errors: readonly ValidationError[] = paginationRequest.errors.map((e) => ({
            field: e.field,
            message: e.message,
            code: e.code,
          }));
          
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.VALIDATION_ERROR,
              'Invalid pagination parameters',
              requestId,
              errors
            )
          );
        }
        
        logger.debug('Pagination parameters parsed', {
          requestId,
          path: event.path,
          pagination: paginationRequest.pagination,
          sort: paginationRequest.sort,
          filterCount: paginationRequest.filter.filters.length,
        });
        
        // Call the handler with pagination request
        const response = await handler(event, paginationRequest);
        
        return createLambdaResponse(HTTP_STATUS.OK, response);
      } catch (error) {
        if (error instanceof PaginationParseError) {
          logger.warn('Pagination parse error', {
            requestId,
            error: error.message,
            errors: error.errors,
          });
          
          const errors: readonly ValidationError[] = error.errors.map((e) => ({
            field: e.field,
            message: e.message,
            code: e.code,
          }));
          
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(
              API_ERROR_CODES.VALIDATION_ERROR,
              error.message,
              requestId,
              errors
            )
          );
        }
        
        // Re-throw unexpected errors
        throw error;
      }
    };
  };
}

/**
 * Convenience function to create pagination options for common use cases
 */
export function createPaginationOptions(
  allowedSortFields: readonly string[],
  allowedFilterFields: readonly string[],
  overrides: Partial<PaginationMiddlewareOptions> = {}
): PaginationMiddlewareOptions {
  return {
    allowedSortFields,
    allowedFilterFields,
    ...overrides,
  };
}

/**
 * Extract pagination parameters from event without validation
 * Useful when you want to handle validation yourself
 */
export function extractPaginationParams(
  event: APIGatewayProxyEvent,
  options: PaginationMiddlewareOptions = {}
): ParsedPaginationRequest {
  return parseListQueryParams(event.queryStringParameters, options);
}
