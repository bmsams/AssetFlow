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
export function buildInsertQuery(
  table: string,
  data: Record<string, unknown>
): QueryParams {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const text = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `.trim();

  return { text, values };
}

/**
 * Build a parameterized UPDATE query
 */
export function buildUpdateQuery(
  table: string,
  data: Record<string, unknown>,
  whereColumn: string,
  whereValue: unknown
): QueryParams {
  const columns = Object.keys(data);
  const values = Object.values(data);

  const setClauses = columns.map((col, i) => `${col} = $${i + 1}`);
  const whereParamIndex = columns.length + 1;

  const text = `
    UPDATE ${table}
    SET ${setClauses.join(', ')}, updated_at = NOW()
    WHERE ${whereColumn} = $${whereParamIndex}
    RETURNING *
  `.trim();

  return { text, values: [...values, whereValue] };
}

/**
 * Build a parameterized DELETE query
 */
export function buildDeleteQuery(
  table: string,
  whereColumn: string,
  whereValue: unknown
): QueryParams {
  const text = `DELETE FROM ${table} WHERE ${whereColumn} = $1 RETURNING *`;
  return { text, values: [whereValue] };
}

/**
 * Build a SELECT query with filters, sorting, and pagination
 */
export function buildSelectQuery(
  table: string,
  options: {
    columns?: readonly string[];
    filters?: readonly FilterCondition[];
    sort?: SortParams;
    pagination?: PaginationParams;
  } = {}
): QueryParams {
  const { columns = ['*'], filters = [], sort, pagination } = options;
  const values: unknown[] = [];
  let paramIndex = 1;

  // Build SELECT clause
  const selectClause = `SELECT ${columns.join(', ')}`;

  // Build FROM clause
  const fromClause = `FROM ${table}`;

  // Build WHERE clause
  const whereClauses: string[] = [];
  for (const filter of filters) {
    const { clause, newParamIndex } = buildFilterClause(filter, paramIndex);
    whereClauses.push(clause);
    values.push(filter.value);
    paramIndex = newParamIndex;
  }
  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Build ORDER BY clause
  const orderClause = sort ? `ORDER BY ${sort.field} ${sort.direction.toUpperCase()}` : '';

  // Build LIMIT/OFFSET clause
  let limitClause = '';
  if (pagination) {
    const limit = pagination.limit ?? 20;
    const offset = ((pagination.page ?? 1) - 1) * limit;
    limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(limit, offset);
  }

  const text = [selectClause, fromClause, whereClause, orderClause, limitClause]
    .filter(Boolean)
    .join(' ')
    .trim();

  return { text, values };
}

/**
 * Build a filter clause for a single condition
 */
function buildFilterClause(
  filter: FilterCondition,
  paramIndex: number
): { clause: string; newParamIndex: number } {
  const { field, operator } = filter;

  switch (operator) {
    case 'eq':
      return { clause: `${field} = $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'ne':
      return { clause: `${field} != $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'gt':
      return { clause: `${field} > $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'gte':
      return { clause: `${field} >= $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'lt':
      return { clause: `${field} < $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'lte':
      return { clause: `${field} <= $${paramIndex}`, newParamIndex: paramIndex + 1 };
    case 'in':
      return { clause: `${field} = ANY($${paramIndex})`, newParamIndex: paramIndex + 1 };
    case 'nin':
      return { clause: `${field} != ALL($${paramIndex})`, newParamIndex: paramIndex + 1 };
    case 'contains':
      return { clause: `${field} ILIKE '%' || $${paramIndex} || '%'`, newParamIndex: paramIndex + 1 };
    case 'startsWith':
      return { clause: `${field} ILIKE $${paramIndex} || '%'`, newParamIndex: paramIndex + 1 };
    case 'endsWith':
      return { clause: `${field} ILIKE '%' || $${paramIndex}`, newParamIndex: paramIndex + 1 };
    default:
      throw new Error(`Unknown filter operator: ${operator as string}`);
  }
}

/**
 * Build a COUNT query with filters
 */
export function buildCountQuery(
  table: string,
  filters: readonly FilterCondition[] = []
): QueryParams {
  const values: unknown[] = [];
  let paramIndex = 1;

  const whereClauses: string[] = [];
  for (const filter of filters) {
    const { clause, newParamIndex } = buildFilterClause(filter, paramIndex);
    whereClauses.push(clause);
    values.push(filter.value);
    paramIndex = newParamIndex;
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const text = `SELECT COUNT(*) as count FROM ${table} ${whereClause}`.trim();

  return { text, values };
}

/**
 * Build an EXISTS query
 */
export function buildExistsQuery(
  table: string,
  whereColumn: string,
  whereValue: unknown
): QueryParams {
  const text = `SELECT EXISTS(SELECT 1 FROM ${table} WHERE ${whereColumn} = $1) as exists`;
  return { text, values: [whereValue] };
}

/**
 * Escape identifier (table/column name) for safe use in queries
 */
export function escapeIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return identifier;
}

/**
 * Build a batch INSERT query
 */
export function buildBatchInsertQuery(
  table: string,
  columns: readonly string[],
  rows: readonly Record<string, unknown>[]
): QueryParams {
  if (rows.length === 0) {
    throw new Error('Cannot build batch insert with empty rows');
  }

  const values: unknown[] = [];
  const rowPlaceholders: string[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const placeholders: string[] = [];
    for (const col of columns) {
      placeholders.push(`$${paramIndex}`);
      values.push(row[col]);
      paramIndex++;
    }
    rowPlaceholders.push(`(${placeholders.join(', ')})`);
  }

  const text = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${rowPlaceholders.join(', ')}
    RETURNING *
  `.trim();

  return { text, values };
}
