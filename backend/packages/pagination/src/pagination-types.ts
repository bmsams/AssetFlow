/**
 * Pagination Types
 * 
 * Defines types for pagination, filtering, and sorting parameters
 * used across collection endpoints in the Asset Management System.
 * 
 * Validates: Requirements 8.7
 */

import type { ISODateString } from '@ams/types';

/**
 * Default pagination configuration
 */
export const PAGINATION_DEFAULTS = {
  /** Default page number */
  DEFAULT_PAGE: 1,
  /** Default items per page */
  DEFAULT_LIMIT: 20,
  /** Maximum items per page */
  MAX_LIMIT: 100,
  /** Minimum items per page */
  MIN_LIMIT: 1,
  /** Default sort direction */
  DEFAULT_SORT_DIRECTION: 'desc' as const,
} as const;

/**
 * Pagination mode - page-based or cursor-based
 */
export type PaginationMode = 'page' | 'cursor';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Filter operators for query filtering
 */
export const FILTER_OPERATORS = {
  /** Equal to */
  EQ: 'eq',
  /** Not equal to */
  NE: 'ne',
  /** Greater than */
  GT: 'gt',
  /** Greater than or equal to */
  GTE: 'gte',
  /** Less than */
  LT: 'lt',
  /** Less than or equal to */
  LTE: 'lte',
  /** In array */
  IN: 'in',
  /** Not in array */
  NIN: 'nin',
  /** Contains (string) */
  CONTAINS: 'contains',
  /** Starts with (string) */
  STARTS_WITH: 'startsWith',
  /** Ends with (string) */
  ENDS_WITH: 'endsWith',
  /** Is null */
  IS_NULL: 'isNull',
  /** Is not null */
  IS_NOT_NULL: 'isNotNull',
  /** Between (range) */
  BETWEEN: 'between',
} as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[keyof typeof FILTER_OPERATORS];

/**
 * Pagination parameters for page-based pagination
 */
export interface PageBasedPaginationParams {
  /** Current page number (1-indexed) */
  readonly page: number;
  /** Number of items per page */
  readonly limit: number;
  /** Pagination mode */
  readonly mode: 'page';
}

/**
 * Pagination parameters for cursor-based pagination
 */
export interface CursorBasedPaginationParams {
  /** Cursor for the next page (base64 encoded) */
  readonly cursor?: string;
  /** Number of items per page */
  readonly limit: number;
  /** Pagination mode */
  readonly mode: 'cursor';
}

/**
 * Combined pagination parameters
 */
export type PaginationParams = PageBasedPaginationParams | CursorBasedPaginationParams;

/**
 * Sort parameters for a single field
 */
export interface SortParam {
  /** Field name to sort by */
  readonly field: string;
  /** Sort direction */
  readonly direction: SortDirection;
}

/**
 * Sort parameters (can be multiple fields)
 */
export interface SortParams {
  /** Array of sort parameters */
  readonly sorts: readonly SortParam[];
}

/**
 * Filter condition for a single field
 */
export interface FilterCondition {
  /** Field name to filter */
  readonly field: string;
  /** Filter operator */
  readonly operator: FilterOperator;
  /** Filter value(s) */
  readonly value: unknown;
}

/**
 * Filter parameters
 */
export interface FilterParams {
  /** Array of filter conditions */
  readonly filters: readonly FilterCondition[];
}

/**
 * Combined query parameters for list endpoints
 */
export interface ListQueryParams {
  /** Pagination parameters */
  readonly pagination: PaginationParams;
  /** Sort parameters */
  readonly sort: SortParams;
  /** Filter parameters */
  readonly filter: FilterParams;
}

/**
 * Cursor data structure (encoded in cursor string)
 */
export interface CursorData {
  /** Last item ID */
  readonly lastId: string;
  /** Last sort values for stable pagination */
  readonly sortValues: Record<string, unknown>;
  /** Timestamp when cursor was created */
  readonly createdAt: ISODateString;
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  /** Total number of items (if available) */
  readonly total?: number;
  /** Current page number (page-based) */
  readonly page?: number;
  /** Items per page */
  readonly limit: number;
  /** Whether there are more items */
  readonly hasMore: boolean;
  /** Cursor for next page (cursor-based) */
  readonly nextCursor?: string;
  /** Cursor for previous page (cursor-based) */
  readonly prevCursor?: string;
  /** Total number of pages (page-based) */
  readonly totalPages?: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of items */
  readonly data: readonly T[];
  /** Pagination metadata */
  readonly pagination: PaginationMeta;
}

/**
 * Paginated API response format
 */
export interface PaginatedApiResponse<T> {
  /** Array of items */
  readonly data: readonly T[];
  /** Pagination metadata */
  readonly pagination: PaginationMeta;
  /** Response metadata */
  readonly meta?: {
    readonly requestId: string;
    readonly timestamp: ISODateString;
  };
}

/**
 * Pagination middleware options
 */
export interface PaginationMiddlewareOptions {
  /** Default page size */
  readonly defaultLimit?: number;
  /** Maximum page size */
  readonly maxLimit?: number;
  /** Default sort field */
  readonly defaultSortField?: string;
  /** Default sort direction */
  readonly defaultSortDirection?: SortDirection;
  /** Allowed sort fields (whitelist) */
  readonly allowedSortFields?: readonly string[];
  /** Allowed filter fields (whitelist) */
  readonly allowedFilterFields?: readonly string[];
  /** Whether to include total count (can be expensive) */
  readonly includeTotalCount?: boolean;
  /** Pagination mode preference */
  readonly preferredMode?: PaginationMode;
}

/**
 * Parsed pagination request from query parameters
 */
export interface ParsedPaginationRequest {
  /** Pagination parameters */
  readonly pagination: PaginationParams;
  /** Sort parameters */
  readonly sort: SortParams;
  /** Filter parameters */
  readonly filter: FilterParams;
  /** Whether request is valid */
  readonly isValid: boolean;
  /** Validation errors if any */
  readonly errors: readonly PaginationError[];
}

/**
 * Pagination error
 */
export interface PaginationError {
  /** Error field */
  readonly field: string;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
}

/**
 * Pagination error codes
 */
export const PAGINATION_ERROR_CODES = {
  INVALID_PAGE: 'INVALID_PAGE',
  INVALID_LIMIT: 'INVALID_LIMIT',
  INVALID_CURSOR: 'INVALID_CURSOR',
  INVALID_SORT_FIELD: 'INVALID_SORT_FIELD',
  INVALID_SORT_DIRECTION: 'INVALID_SORT_DIRECTION',
  INVALID_FILTER_FIELD: 'INVALID_FILTER_FIELD',
  INVALID_FILTER_OPERATOR: 'INVALID_FILTER_OPERATOR',
  INVALID_FILTER_VALUE: 'INVALID_FILTER_VALUE',
  EXPIRED_CURSOR: 'EXPIRED_CURSOR',
} as const;

export type PaginationErrorCode = (typeof PAGINATION_ERROR_CODES)[keyof typeof PAGINATION_ERROR_CODES];

/**
 * Error thrown when pagination parsing fails
 */
export class PaginationParseError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly errors: readonly PaginationError[];

  constructor(
    message: string,
    errors: readonly PaginationError[],
    code: string = 'PAGINATION_ERROR'
  ) {
    super(message);
    this.name = 'PaginationParseError';
    this.code = code;
    this.statusCode = 400;
    this.errors = errors;
  }
}
