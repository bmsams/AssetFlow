/**
 * Common types used across the Asset Management System
 */

/**
 * UUID type alias for better type safety
 */
export type UUID = string;

/**
 * ISO 8601 date string type alias
 */
export type ISODateString = string;

/**
 * Pagination parameters for list operations
 */
export interface PaginationParams {
  readonly page?: number;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor?: string;
}

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort parameters
 */
export interface SortParams {
  readonly field: string;
  readonly direction: SortDirection;
}

/**
 * Filter operator types
 */
export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

/**
 * Filter condition
 */
export interface FilterCondition {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

/**
 * Base entity with common audit fields
 */
export interface BaseEntity {
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly createdBy?: UUID;
  readonly updatedBy?: UUID;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;
