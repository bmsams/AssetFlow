"use strict";
/**
 * Pagination Types
 *
 * Defines types for pagination, filtering, and sorting parameters
 * used across collection endpoints in the Asset Management System.
 *
 * Validates: Requirements 8.7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationParseError = exports.PAGINATION_ERROR_CODES = exports.FILTER_OPERATORS = exports.PAGINATION_DEFAULTS = void 0;
/**
 * Default pagination configuration
 */
exports.PAGINATION_DEFAULTS = {
    /** Default page number */
    DEFAULT_PAGE: 1,
    /** Default items per page */
    DEFAULT_LIMIT: 20,
    /** Maximum items per page */
    MAX_LIMIT: 100,
    /** Minimum items per page */
    MIN_LIMIT: 1,
    /** Default sort direction */
    DEFAULT_SORT_DIRECTION: 'desc',
};
/**
 * Filter operators for query filtering
 */
exports.FILTER_OPERATORS = {
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
};
/**
 * Pagination error codes
 */
exports.PAGINATION_ERROR_CODES = {
    INVALID_PAGE: 'INVALID_PAGE',
    INVALID_LIMIT: 'INVALID_LIMIT',
    INVALID_CURSOR: 'INVALID_CURSOR',
    INVALID_SORT_FIELD: 'INVALID_SORT_FIELD',
    INVALID_SORT_DIRECTION: 'INVALID_SORT_DIRECTION',
    INVALID_FILTER_FIELD: 'INVALID_FILTER_FIELD',
    INVALID_FILTER_OPERATOR: 'INVALID_FILTER_OPERATOR',
    INVALID_FILTER_VALUE: 'INVALID_FILTER_VALUE',
    EXPIRED_CURSOR: 'EXPIRED_CURSOR',
};
/**
 * Error thrown when pagination parsing fails
 */
class PaginationParseError extends Error {
    code;
    statusCode;
    errors;
    constructor(message, errors, code = 'PAGINATION_ERROR') {
        super(message);
        this.name = 'PaginationParseError';
        this.code = code;
        this.statusCode = 400;
        this.errors = errors;
    }
}
exports.PaginationParseError = PaginationParseError;
//# sourceMappingURL=pagination-types.js.map