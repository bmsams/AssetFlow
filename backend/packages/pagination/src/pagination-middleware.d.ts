/**
 * Pagination Middleware
 *
 * Provides middleware for parsing pagination, filtering, and sorting
 * parameters from API Gateway requests.
 *
 * Validates: Requirements 8.7
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { type FilterParams, type PaginatedApiResponse, type PaginationError, type PaginationMiddlewareOptions, type PaginationParams, type ParsedPaginationRequest, type SortParams } from './pagination-types';
/**
 * Parse pagination parameters from query string
 */
export declare function parsePaginationParams(queryParams: Record<string, string | undefined> | null, options?: PaginationMiddlewareOptions): {
    params: PaginationParams;
    errors: readonly PaginationError[];
};
/**
 * Parse sort parameters from query string
 */
export declare function parseSortParams(queryParams: Record<string, string | undefined> | null, options?: PaginationMiddlewareOptions): {
    params: SortParams;
    errors: readonly PaginationError[];
};
/**
 * Parse filter parameters from query string
 */
export declare function parseFilterParams(queryParams: Record<string, string | undefined> | null, options?: PaginationMiddlewareOptions): {
    params: FilterParams;
    errors: readonly PaginationError[];
};
/**
 * Parse all list query parameters from request
 */
export declare function parseListQueryParams(queryParams: Record<string, string | undefined> | null, options?: PaginationMiddlewareOptions): ParsedPaginationRequest;
/**
 * Get parsed pagination request from API Gateway event
 * Throws PaginationParseError if validation fails
 */
export declare function getPaginationRequest(event: APIGatewayProxyEvent, options?: PaginationMiddlewareOptions): ParsedPaginationRequest;
/**
 * Handler type for paginated handlers
 */
export type PaginatedHandler<T> = (event: APIGatewayProxyEvent, paginationRequest: ParsedPaginationRequest) => Promise<PaginatedApiResponse<T>>;
/**
 * Create a pagination middleware wrapper
 *
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
export declare function withPagination<T>(options?: PaginationMiddlewareOptions): (handler: PaginatedHandler<T>) => (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
/**
 * Convenience function to create pagination options for common use cases
 */
export declare function createPaginationOptions(allowedSortFields: readonly string[], allowedFilterFields: readonly string[], overrides?: Partial<PaginationMiddlewareOptions>): PaginationMiddlewareOptions;
/**
 * Extract pagination parameters from event without validation
 * Useful when you want to handle validation yourself
 */
export declare function extractPaginationParams(event: APIGatewayProxyEvent, options?: PaginationMiddlewareOptions): ParsedPaginationRequest;
//# sourceMappingURL=pagination-middleware.d.ts.map