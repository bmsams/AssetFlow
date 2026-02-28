"use strict";
/**
 * Pagination Middleware
 *
 * Provides middleware for parsing pagination, filtering, and sorting
 * parameters from API Gateway requests.
 *
 * Validates: Requirements 8.7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePaginationParams = parsePaginationParams;
exports.parseSortParams = parseSortParams;
exports.parseFilterParams = parseFilterParams;
exports.parseListQueryParams = parseListQueryParams;
exports.getPaginationRequest = getPaginationRequest;
exports.withPagination = withPagination;
exports.createPaginationOptions = createPaginationOptions;
exports.extractPaginationParams = extractPaginationParams;
const types_1 = require("@ams/types");
const utils_1 = require("@ams/utils");
const pagination_types_1 = require("./pagination-types");
const pagination_utils_1 = require("./pagination-utils");
const logger = (0, utils_1.createLogger)({ service: 'pagination-middleware' });
/**
 * Default middleware options
 */
const DEFAULT_MIDDLEWARE_OPTIONS = {
    defaultLimit: pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_LIMIT,
    maxLimit: pagination_types_1.PAGINATION_DEFAULTS.MAX_LIMIT,
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
function parsePaginationParams(queryParams, options = {}) {
    const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
    const errors = [];
    const rawPage = queryParams?.['page'];
    const rawLimit = queryParams?.['limit'] ?? queryParams?.['pageSize'];
    const rawCursor = queryParams?.['cursor'] ?? queryParams?.['after'];
    // Determine pagination mode
    const hasCursor = rawCursor !== undefined && rawCursor !== '';
    const mode = hasCursor ? 'cursor' : mergedOptions.preferredMode;
    // Parse and validate limit
    let limit;
    if (rawLimit !== undefined) {
        const parsedLimit = parseInt(rawLimit, 10);
        if (isNaN(parsedLimit) || parsedLimit < pagination_types_1.PAGINATION_DEFAULTS.MIN_LIMIT) {
            errors.push({
                field: 'limit',
                message: `Invalid limit: must be a positive integer between ${pagination_types_1.PAGINATION_DEFAULTS.MIN_LIMIT} and ${mergedOptions.maxLimit}`,
                code: pagination_types_1.PAGINATION_ERROR_CODES.INVALID_LIMIT,
            });
            limit = mergedOptions.defaultLimit;
        }
        else {
            limit = (0, pagination_utils_1.normalizeLimit)(parsedLimit, mergedOptions.maxLimit, mergedOptions.defaultLimit);
        }
    }
    else {
        limit = mergedOptions.defaultLimit;
    }
    if (mode === 'cursor') {
        // Cursor-based pagination
        let cursor;
        if (hasCursor) {
            const decodedCursor = (0, pagination_utils_1.decodeCursor)(rawCursor);
            if (!decodedCursor) {
                errors.push({
                    field: 'cursor',
                    message: 'Invalid cursor format',
                    code: pagination_types_1.PAGINATION_ERROR_CODES.INVALID_CURSOR,
                });
            }
            else if ((0, pagination_utils_1.isCursorExpired)(decodedCursor)) {
                errors.push({
                    field: 'cursor',
                    message: 'Cursor has expired. Please start from the beginning.',
                    code: pagination_types_1.PAGINATION_ERROR_CODES.EXPIRED_CURSOR,
                });
            }
            else {
                cursor = rawCursor;
            }
        }
        const params = {
            mode: 'cursor',
            cursor,
            limit,
        };
        return { params, errors };
    }
    // Page-based pagination
    let page;
    if (rawPage !== undefined) {
        const parsedPage = parseInt(rawPage, 10);
        if (isNaN(parsedPage) || parsedPage < 1) {
            errors.push({
                field: 'page',
                message: 'Invalid page: must be a positive integer',
                code: pagination_types_1.PAGINATION_ERROR_CODES.INVALID_PAGE,
            });
            page = pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_PAGE;
        }
        else {
            page = (0, pagination_utils_1.normalizePage)(parsedPage);
        }
    }
    else {
        page = pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_PAGE;
    }
    const params = {
        mode: 'page',
        page,
        limit,
    };
    return { params, errors };
}
/**
 * Parse sort parameters from query string
 */
function parseSortParams(queryParams, options = {}) {
    const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
    const rawSort = queryParams?.['sort'] ?? queryParams?.['sortBy'] ?? queryParams?.['orderBy'];
    const rawDirection = queryParams?.['sortDirection'] ?? queryParams?.['order'] ?? queryParams?.['sortOrder'];
    // Parse sort string
    let sorts = (0, pagination_utils_1.parseSortString)(rawSort, mergedOptions.defaultSortField, mergedOptions.defaultSortDirection);
    // Apply direction override if provided and only one sort field
    if (rawDirection && sorts.length === 1) {
        const direction = rawDirection.toLowerCase() === 'asc' ? 'asc' : 'desc';
        sorts = [{ ...sorts[0], direction }];
    }
    // Validate sort fields
    const errors = (0, pagination_utils_1.validateSortFields)(sorts, mergedOptions.allowedSortFields);
    return {
        params: { sorts },
        errors,
    };
}
/**
 * Parse filter parameters from query string
 */
function parseFilterParams(queryParams, options = {}) {
    const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
    const rawFilter = queryParams?.['filter'] ?? queryParams?.['filters'] ?? queryParams?.['where'];
    // Parse filter string
    const filters = (0, pagination_utils_1.parseFilterString)(rawFilter);
    // Validate filter fields
    const errors = (0, pagination_utils_1.validateFilterFields)(filters, mergedOptions.allowedFilterFields);
    return {
        params: { filters },
        errors,
    };
}
/**
 * Parse all list query parameters from request
 */
function parseListQueryParams(queryParams, options = {}) {
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
function getPaginationRequest(event, options = {}) {
    const result = parseListQueryParams(event.queryStringParameters, options);
    if (!result.isValid) {
        throw new pagination_types_1.PaginationParseError('Invalid pagination parameters', result.errors);
    }
    return result;
}
/**
 * Create a pagination middleware wrapper
 *
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
function withPagination(options = {}) {
    return (handler) => {
        return async (event) => {
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
                    const errors = paginationRequest.errors.map((e) => ({
                        field: e.field,
                        message: e.message,
                        code: e.code,
                    }));
                    return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.BAD_REQUEST, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.VALIDATION_ERROR, 'Invalid pagination parameters', requestId, errors));
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
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.OK, response);
            }
            catch (error) {
                if (error instanceof pagination_types_1.PaginationParseError) {
                    logger.warn('Pagination parse error', {
                        requestId,
                        error: error.message,
                        errors: error.errors,
                    });
                    const errors = error.errors.map((e) => ({
                        field: e.field,
                        message: e.message,
                        code: e.code,
                    }));
                    return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.BAD_REQUEST, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.VALIDATION_ERROR, error.message, requestId, errors));
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
function createPaginationOptions(allowedSortFields, allowedFilterFields, overrides = {}) {
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
function extractPaginationParams(event, options = {}) {
    return parseListQueryParams(event.queryStringParameters, options);
}
//# sourceMappingURL=pagination-middleware.js.map