/**
 * Simple query builder utilities for common database operations
 */
import type { FilterCondition, PaginationParams, SortParams } from '@ams/types';
/**
 * Query parameters with values
 */
export interface QueryParams {
    readonly text: string;
    readonly values: unknown[];
}
/**
 * Build a parameterized INSERT query
 */
export declare function buildInsertQuery(table: string, data: Record<string, unknown>): QueryParams;
/**
 * Build a parameterized UPDATE query
 */
export declare function buildUpdateQuery(table: string, data: Record<string, unknown>, whereColumn: string, whereValue: unknown): QueryParams;
/**
 * Build a parameterized DELETE query
 */
export declare function buildDeleteQuery(table: string, whereColumn: string, whereValue: unknown): QueryParams;
/**
 * Build a SELECT query with filters, sorting, and pagination
 */
export declare function buildSelectQuery(table: string, options?: {
    columns?: readonly string[];
    filters?: readonly FilterCondition[];
    sort?: SortParams;
    pagination?: PaginationParams;
}): QueryParams;
/**
 * Build a COUNT query with filters
 */
export declare function buildCountQuery(table: string, filters?: readonly FilterCondition[]): QueryParams;
/**
 * Build an EXISTS query
 */
export declare function buildExistsQuery(table: string, whereColumn: string, whereValue: unknown): QueryParams;
/**
 * Escape identifier (table/column name) for safe use in queries
 */
export declare function escapeIdentifier(identifier: string): string;
/**
 * Build a batch INSERT query
 */
export declare function buildBatchInsertQuery(table: string, columns: readonly string[], rows: readonly Record<string, unknown>[]): QueryParams;
//# sourceMappingURL=query-builder.d.ts.map