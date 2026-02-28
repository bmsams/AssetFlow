"use strict";
/**
 * Pagination Utilities
 *
 * Utility functions for cursor encoding/decoding, pagination calculations,
 * and building paginated responses.
 *
 * Validates: Requirements 8.7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
exports.createCursor = createCursor;
exports.isCursorExpired = isCursorExpired;
exports.calculateOffset = calculateOffset;
exports.calculateTotalPages = calculateTotalPages;
exports.normalizePage = normalizePage;
exports.normalizeLimit = normalizeLimit;
exports.parseSortDirection = parseSortDirection;
exports.parseSortString = parseSortString;
exports.validateSortFields = validateSortFields;
exports.parseFilterOperator = parseFilterOperator;
exports.parseFilterString = parseFilterString;
exports.validateFilterFields = validateFilterFields;
exports.buildPaginationMeta = buildPaginationMeta;
exports.createPaginatedResult = createPaginatedResult;
exports.createPaginatedApiResponse = createPaginatedApiResponse;
exports.buildSqlOrderBy = buildSqlOrderBy;
exports.buildSqlLimitOffset = buildSqlLimitOffset;
const pagination_types_1 = require("./pagination-types");
/**
 * Encode cursor data to base64 string
 */
function encodeCursor(data) {
    const json = JSON.stringify(data);
    return Buffer.from(json, 'utf-8').toString('base64url');
}
/**
 * Decode cursor string to cursor data
 * Returns null if cursor is invalid
 */
function decodeCursor(cursor) {
    try {
        const json = Buffer.from(cursor, 'base64url').toString('utf-8');
        const data = JSON.parse(json);
        // Validate cursor structure
        if (!data.lastId || typeof data.lastId !== 'string') {
            return null;
        }
        if (!data.createdAt || typeof data.createdAt !== 'string') {
            return null;
        }
        if (!data.sortValues || typeof data.sortValues !== 'object') {
            return null;
        }
        return data;
    }
    catch {
        return null;
    }
}
/**
 * Create a cursor from the last item in a result set
 */
function createCursor(lastItem, idField, sortFields) {
    const sortValues = {};
    for (const field of sortFields) {
        sortValues[field] = lastItem[field];
    }
    const cursorData = {
        lastId: String(lastItem[idField]),
        sortValues,
        createdAt: new Date().toISOString(),
    };
    return encodeCursor(cursorData);
}
/**
 * Check if a cursor has expired
 * Default expiration is 24 hours
 */
function isCursorExpired(cursor, maxAgeMs = 24 * 60 * 60 * 1000) {
    const createdAt = new Date(cursor.createdAt).getTime();
    const now = Date.now();
    return now - createdAt > maxAgeMs;
}
/**
 * Calculate offset from page and limit
 */
function calculateOffset(page, limit) {
    return (page - 1) * limit;
}
/**
 * Calculate total pages from total items and limit
 */
function calculateTotalPages(total, limit) {
    return Math.ceil(total / limit);
}
/**
 * Normalize page number to valid range
 */
function normalizePage(page, totalPages) {
    const normalizedPage = Math.max(1, Math.floor(page ?? pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_PAGE));
    if (totalPages !== undefined && normalizedPage > totalPages) {
        return Math.max(1, totalPages);
    }
    return normalizedPage;
}
/**
 * Normalize limit to valid range
 */
function normalizeLimit(limit, maxLimit = pagination_types_1.PAGINATION_DEFAULTS.MAX_LIMIT, defaultLimit = pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_LIMIT) {
    if (limit === undefined) {
        return defaultLimit;
    }
    return Math.min(Math.max(pagination_types_1.PAGINATION_DEFAULTS.MIN_LIMIT, Math.floor(limit)), maxLimit);
}
/**
 * Parse sort direction from string
 */
function parseSortDirection(direction) {
    if (!direction) {
        return pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_SORT_DIRECTION;
    }
    const normalized = direction.toLowerCase().trim();
    if (normalized === 'asc' || normalized === 'ascending') {
        return 'asc';
    }
    if (normalized === 'desc' || normalized === 'descending') {
        return 'desc';
    }
    return pagination_types_1.PAGINATION_DEFAULTS.DEFAULT_SORT_DIRECTION;
}
/**
 * Parse sort string into sort parameters
 * Supports formats:
 * - "field" (default direction)
 * - "field:asc" or "field:desc"
 * - "-field" (descending) or "+field" (ascending)
 * - Multiple fields: "field1,-field2,field3:asc"
 */
function parseSortString(sortString, defaultField, defaultDirection = 'desc') {
    if (!sortString && !defaultField) {
        return [];
    }
    if (!sortString && defaultField) {
        return [{ field: defaultField, direction: defaultDirection }];
    }
    const sorts = [];
    const fields = sortString.split(',').map((s) => s.trim()).filter(Boolean);
    for (const fieldSpec of fields) {
        let field;
        let direction;
        // Check for prefix notation (-field or +field)
        if (fieldSpec.startsWith('-')) {
            field = fieldSpec.slice(1);
            direction = 'desc';
        }
        else if (fieldSpec.startsWith('+')) {
            field = fieldSpec.slice(1);
            direction = 'asc';
        }
        else if (fieldSpec.includes(':')) {
            // Check for suffix notation (field:asc or field:desc)
            const [fieldPart, dirPart] = fieldSpec.split(':');
            field = fieldPart;
            direction = parseSortDirection(dirPart);
        }
        else {
            field = fieldSpec;
            direction = defaultDirection;
        }
        if (field) {
            sorts.push({ field, direction });
        }
    }
    return sorts;
}
/**
 * Validate sort fields against allowed list
 */
function validateSortFields(sorts, allowedFields) {
    if (!allowedFields || allowedFields.length === 0) {
        return [];
    }
    const errors = [];
    const allowedSet = new Set(allowedFields);
    for (const sort of sorts) {
        if (!allowedSet.has(sort.field)) {
            errors.push({
                field: 'sort',
                message: `Invalid sort field: ${sort.field}. Allowed fields: ${allowedFields.join(', ')}`,
                code: pagination_types_1.PAGINATION_ERROR_CODES.INVALID_SORT_FIELD,
            });
        }
    }
    return errors;
}
/**
 * Parse filter operator from string
 */
function parseFilterOperator(operator) {
    const normalized = operator.toLowerCase().trim();
    const operatorValues = Object.values(pagination_types_1.FILTER_OPERATORS);
    // Check for exact match first (case-insensitive)
    for (const op of operatorValues) {
        if (op.toLowerCase() === normalized) {
            return op;
        }
    }
    // Handle common aliases
    const aliases = {
        '=': pagination_types_1.FILTER_OPERATORS.EQ,
        '==': pagination_types_1.FILTER_OPERATORS.EQ,
        '!=': pagination_types_1.FILTER_OPERATORS.NE,
        '<>': pagination_types_1.FILTER_OPERATORS.NE,
        '>': pagination_types_1.FILTER_OPERATORS.GT,
        '>=': pagination_types_1.FILTER_OPERATORS.GTE,
        '<': pagination_types_1.FILTER_OPERATORS.LT,
        '<=': pagination_types_1.FILTER_OPERATORS.LTE,
        'like': pagination_types_1.FILTER_OPERATORS.CONTAINS,
        'null': pagination_types_1.FILTER_OPERATORS.IS_NULL,
        'notnull': pagination_types_1.FILTER_OPERATORS.IS_NOT_NULL,
    };
    return aliases[normalized] ?? null;
}
/**
 * Parse filter string into filter conditions
 * Supports formats:
 * - "field:operator:value" (e.g., "status:eq:ACTIVE")
 * - "field:value" (defaults to eq operator)
 * - Multiple filters: "status:eq:ACTIVE,type:in:HARDWARE,SOFTWARE"
 */
function parseFilterString(filterString) {
    if (!filterString) {
        return [];
    }
    const filters = [];
    // Split by comma but not within parentheses (for IN operator values)
    const filterParts = splitFilterString(filterString);
    for (const part of filterParts) {
        const trimmed = part.trim();
        if (!trimmed)
            continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1)
            continue;
        const field = trimmed.slice(0, colonIndex);
        const rest = trimmed.slice(colonIndex + 1);
        // Check if there's an operator
        const secondColonIndex = rest.indexOf(':');
        let operator;
        let valueStr;
        if (secondColonIndex === -1) {
            // No operator specified, default to eq
            operator = pagination_types_1.FILTER_OPERATORS.EQ;
            valueStr = rest;
        }
        else {
            const operatorStr = rest.slice(0, secondColonIndex);
            const parsedOperator = parseFilterOperator(operatorStr);
            if (parsedOperator) {
                operator = parsedOperator;
                valueStr = rest.slice(secondColonIndex + 1);
            }
            else {
                // Invalid operator, treat as eq with full value
                operator = pagination_types_1.FILTER_OPERATORS.EQ;
                valueStr = rest;
            }
        }
        // Parse value based on operator
        const value = parseFilterValue(valueStr, operator);
        filters.push({ field, operator, value });
    }
    return filters;
}
/**
 * Split filter string by comma, respecting parentheses
 */
function splitFilterString(filterString) {
    const parts = [];
    let current = '';
    let depth = 0;
    for (const char of filterString) {
        if (char === '(' || char === '[') {
            depth++;
            current += char;
        }
        else if (char === ')' || char === ']') {
            depth--;
            current += char;
        }
        else if (char === ',' && depth === 0) {
            parts.push(current);
            current = '';
        }
        else {
            current += char;
        }
    }
    if (current) {
        parts.push(current);
    }
    return parts;
}
/**
 * Parse filter value based on operator
 */
function parseFilterValue(valueStr, operator) {
    // Handle IN and NIN operators (array values)
    if (operator === pagination_types_1.FILTER_OPERATORS.IN || operator === pagination_types_1.FILTER_OPERATORS.NIN) {
        // Remove parentheses if present
        let cleaned = valueStr.trim();
        if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
            cleaned = cleaned.slice(1, -1);
        }
        if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
            cleaned = cleaned.slice(1, -1);
        }
        return cleaned.split(',').map((v) => parseScalarValue(v.trim()));
    }
    // Handle BETWEEN operator (two values)
    if (operator === pagination_types_1.FILTER_OPERATORS.BETWEEN) {
        const parts = valueStr.split(',').map((v) => parseScalarValue(v.trim()));
        return parts.slice(0, 2);
    }
    // Handle IS_NULL and IS_NOT_NULL (no value needed)
    if (operator === pagination_types_1.FILTER_OPERATORS.IS_NULL || operator === pagination_types_1.FILTER_OPERATORS.IS_NOT_NULL) {
        return null;
    }
    return parseScalarValue(valueStr);
}
/**
 * Parse a scalar value (string, number, boolean, null)
 */
function parseScalarValue(value) {
    const trimmed = value.trim();
    // Check for null
    if (trimmed.toLowerCase() === 'null') {
        return null;
    }
    // Check for boolean
    if (trimmed.toLowerCase() === 'true') {
        return true;
    }
    if (trimmed.toLowerCase() === 'false') {
        return false;
    }
    // Check for number
    const num = Number(trimmed);
    if (!isNaN(num) && trimmed !== '') {
        return num;
    }
    // Remove quotes if present
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
/**
 * Validate filter fields against allowed list
 */
function validateFilterFields(filters, allowedFields) {
    if (!allowedFields || allowedFields.length === 0) {
        return [];
    }
    const errors = [];
    const allowedSet = new Set(allowedFields);
    for (const filter of filters) {
        if (!allowedSet.has(filter.field)) {
            errors.push({
                field: 'filter',
                message: `Invalid filter field: ${filter.field}. Allowed fields: ${allowedFields.join(', ')}`,
                code: pagination_types_1.PAGINATION_ERROR_CODES.INVALID_FILTER_FIELD,
            });
        }
    }
    return errors;
}
/**
 * Build pagination metadata for response
 */
function buildPaginationMeta(items, params, options = {}) {
    const { total, idField = 'id', sortFields = [] } = options;
    const hasMore = items.length === params.limit;
    if (params.mode === 'page') {
        const totalPages = total !== undefined ? calculateTotalPages(total, params.limit) : undefined;
        return {
            total,
            page: params.page,
            limit: params.limit,
            hasMore: total !== undefined ? params.page < (totalPages ?? 0) : hasMore,
            totalPages,
        };
    }
    // Cursor-based pagination
    let nextCursor;
    if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = createCursor(lastItem, idField, sortFields);
    }
    return {
        total,
        limit: params.limit,
        hasMore,
        nextCursor,
    };
}
/**
 * Create a paginated result
 */
function createPaginatedResult(items, params, options = {}) {
    return {
        data: items,
        pagination: buildPaginationMeta(items, params, options),
    };
}
/**
 * Create a paginated API response
 */
function createPaginatedApiResponse(items, params, requestId, options = {}) {
    return {
        data: items,
        pagination: buildPaginationMeta(items, params, options),
        meta: {
            requestId,
            timestamp: new Date().toISOString(),
        },
    };
}
/**
 * Build SQL ORDER BY clause from sort parameters
 */
function buildSqlOrderBy(sorts, tableAlias) {
    if (sorts.length === 0) {
        return '';
    }
    const prefix = tableAlias ? `${tableAlias}.` : '';
    const clauses = sorts.map((sort) => `${prefix}"${sort.field}" ${sort.direction.toUpperCase()}`);
    return `ORDER BY ${clauses.join(', ')}`;
}
/**
 * Build SQL LIMIT/OFFSET clause from pagination parameters
 */
function buildSqlLimitOffset(params) {
    if (params.mode === 'page') {
        const offset = calculateOffset(params.page, params.limit);
        return `LIMIT ${params.limit} OFFSET ${offset}`;
    }
    // For cursor-based, we just use LIMIT
    return `LIMIT ${params.limit}`;
}
//# sourceMappingURL=pagination-utils.js.map