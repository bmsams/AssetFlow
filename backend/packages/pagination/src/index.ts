/**
 * @ams/pagination - Pagination, filtering, and sorting middleware
 * 
 * This package provides middleware and utilities for handling pagination,
 * filtering, and sorting in collection endpoints.
 * 
 * Validates: Requirements 8.7
 */

// Types
export {
  type CursorBasedPaginationParams,
  type CursorData,
  type FilterCondition,
  type FilterOperator,
  type FilterParams,
  type ListQueryParams,
  type PageBasedPaginationParams,
  type PaginatedApiResponse,
  type PaginatedResult,
  type PaginationError,
  type PaginationErrorCode,
  type PaginationMeta,
  type PaginationMiddlewareOptions,
  type PaginationMode,
  type PaginationParams,
  type ParsedPaginationRequest,
  type SortDirection,
  type SortParam,
  type SortParams,
  FILTER_OPERATORS,
  PAGINATION_DEFAULTS,
  PAGINATION_ERROR_CODES,
  PaginationParseError,
} from './pagination-types';

// Utilities
export {
  buildPaginationMeta,
  buildSqlLimitOffset,
  buildSqlOrderBy,
  calculateOffset,
  calculateTotalPages,
  createCursor,
  createPaginatedApiResponse,
  createPaginatedResult,
  decodeCursor,
  encodeCursor,
  isCursorExpired,
  normalizeLimit,
  normalizePage,
  parseFilterOperator,
  parseFilterString,
  parseSortDirection,
  parseSortString,
  validateFilterFields,
  validateSortFields,
} from './pagination-utils';

// Middleware
export {
  type PaginatedHandler,
  createPaginationOptions,
  extractPaginationParams,
  parseFilterParams,
  parseListQueryParams,
  parsePaginationParams,
  parseSortParams,
  getPaginationRequest,
  withPagination,
} from './pagination-middleware';
