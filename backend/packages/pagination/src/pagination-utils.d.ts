/**
 * Pagination Utilities
 *
 * Utility functions for cursor encoding/decoding, pagination calculations,
 * and building paginated responses.
 *
 * Validates: Requirements 8.7
 */
import type { CursorData, FilterCondition, FilterOperator, PaginatedApiResponse, PaginatedResult, PaginationMeta, PaginationParams, SortDirection, SortParam } from './pagination-types';
import { type PaginationError } from './pagination-types';
/**
 * Encode cursor data to base64 string
 */
export declare function encodeCursor(data: CursorData): string;
/**
 * Decode cursor string to cursor data
 * Returns null if cursor is invalid
 */
export declare function decodeCursor(cursor: string): CursorData | null;
/**
 * Create a cursor from the last item in a result set
 */
export declare function createCursor<T extends Record<string, unknown>>(lastItem: T, idField: string, sortFields: readonly string[]): string;
/**
 * Check if a cursor has expired
 * Default expiration is 24 hours
 */
export declare function isCursorExpired(cursor: CursorData, maxAgeMs?: number): boolean;
/**
 * Calculate offset from page and limit
 */
export declare function calculateOffset(page: number, limit: number): number;
/**
 * Calculate total pages from total items and limit
 */
export declare function calculateTotalPages(total: number, limit: number): number;
/**
 * Normalize page number to valid range
 */
export declare function normalizePage(page: number | undefined, totalPages?: number): number;
/**
 * Normalize limit to valid range
 */
export declare function normalizeLimit(limit: number | undefined, maxLimit?: number, defaultLimit?: number): number;
/**
 * Parse sort direction from string
 */
export declare function parseSortDirection(direction: string | undefined): SortDirection;
/**
 * Parse sort string into sort parameters
 * Supports formats:
 * - "field" (default direction)
 * - "field:asc" or "field:desc"
 * - "-field" (descending) or "+field" (ascending)
 * - Multiple fields: "field1,-field2,field3:asc"
 */
export declare function parseSortString(sortString: string | undefined, defaultField?: string, defaultDirection?: SortDirection): readonly SortParam[];
/**
 * Validate sort fields against allowed list
 */
export declare function validateSortFields(sorts: readonly SortParam[], allowedFields?: readonly string[]): readonly PaginationError[];
/**
 * Parse filter operator from string
 */
export declare function parseFilterOperator(operator: string): FilterOperator | null;
/**
 * Parse filter string into filter conditions
 * Supports formats:
 * - "field:operator:value" (e.g., "status:eq:ACTIVE")
 * - "field:value" (defaults to eq operator)
 * - Multiple filters: "status:eq:ACTIVE,type:in:HARDWARE,SOFTWARE"
 */
export declare function parseFilterString(filterString: string | undefined): readonly FilterCondition[];
/**
 * Validate filter fields against allowed list
 */
export declare function validateFilterFields(filters: readonly FilterCondition[], allowedFields?: readonly string[]): readonly PaginationError[];
/**
 * Build pagination metadata for response
 */
export declare function buildPaginationMeta<T>(items: readonly T[], params: PaginationParams, options?: {
    total?: number;
    idField?: string;
    sortFields?: readonly string[];
}): PaginationMeta;
/**
 * Create a paginated result
 */
export declare function createPaginatedResult<T>(items: readonly T[], params: PaginationParams, options?: {
    total?: number;
    idField?: string;
    sortFields?: readonly string[];
}): PaginatedResult<T>;
/**
 * Create a paginated API response
 */
export declare function createPaginatedApiResponse<T>(items: readonly T[], params: PaginationParams, requestId: string, options?: {
    total?: number;
    idField?: string;
    sortFields?: readonly string[];
}): PaginatedApiResponse<T>;
/**
 * Build SQL ORDER BY clause from sort parameters
 */
export declare function buildSqlOrderBy(sorts: readonly SortParam[], tableAlias?: string): string;
/**
 * Build SQL LIMIT/OFFSET clause from pagination parameters
 */
export declare function buildSqlLimitOffset(params: PaginationParams): string;
//# sourceMappingURL=pagination-utils.d.ts.map