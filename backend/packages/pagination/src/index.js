"use strict";
/**
 * @ams/pagination - Pagination, filtering, and sorting middleware
 *
 * This package provides middleware and utilities for handling pagination,
 * filtering, and sorting in collection endpoints.
 *
 * Validates: Requirements 8.7
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withPagination = exports.getPaginationRequest = exports.parseSortParams = exports.parsePaginationParams = exports.parseListQueryParams = exports.parseFilterParams = exports.extractPaginationParams = exports.createPaginationOptions = exports.validateSortFields = exports.validateFilterFields = exports.parseSortString = exports.parseSortDirection = exports.parseFilterString = exports.parseFilterOperator = exports.normalizePage = exports.normalizeLimit = exports.isCursorExpired = exports.encodeCursor = exports.decodeCursor = exports.createPaginatedResult = exports.createPaginatedApiResponse = exports.createCursor = exports.calculateTotalPages = exports.calculateOffset = exports.buildSqlOrderBy = exports.buildSqlLimitOffset = exports.buildPaginationMeta = exports.PaginationParseError = exports.PAGINATION_ERROR_CODES = exports.PAGINATION_DEFAULTS = exports.FILTER_OPERATORS = void 0;
// Types
var pagination_types_1 = require("./pagination-types");
Object.defineProperty(exports, "FILTER_OPERATORS", { enumerable: true, get: function () { return pagination_types_1.FILTER_OPERATORS; } });
Object.defineProperty(exports, "PAGINATION_DEFAULTS", { enumerable: true, get: function () { return pagination_types_1.PAGINATION_DEFAULTS; } });
Object.defineProperty(exports, "PAGINATION_ERROR_CODES", { enumerable: true, get: function () { return pagination_types_1.PAGINATION_ERROR_CODES; } });
Object.defineProperty(exports, "PaginationParseError", { enumerable: true, get: function () { return pagination_types_1.PaginationParseError; } });
// Utilities
var pagination_utils_1 = require("./pagination-utils");
Object.defineProperty(exports, "buildPaginationMeta", { enumerable: true, get: function () { return pagination_utils_1.buildPaginationMeta; } });
Object.defineProperty(exports, "buildSqlLimitOffset", { enumerable: true, get: function () { return pagination_utils_1.buildSqlLimitOffset; } });
Object.defineProperty(exports, "buildSqlOrderBy", { enumerable: true, get: function () { return pagination_utils_1.buildSqlOrderBy; } });
Object.defineProperty(exports, "calculateOffset", { enumerable: true, get: function () { return pagination_utils_1.calculateOffset; } });
Object.defineProperty(exports, "calculateTotalPages", { enumerable: true, get: function () { return pagination_utils_1.calculateTotalPages; } });
Object.defineProperty(exports, "createCursor", { enumerable: true, get: function () { return pagination_utils_1.createCursor; } });
Object.defineProperty(exports, "createPaginatedApiResponse", { enumerable: true, get: function () { return pagination_utils_1.createPaginatedApiResponse; } });
Object.defineProperty(exports, "createPaginatedResult", { enumerable: true, get: function () { return pagination_utils_1.createPaginatedResult; } });
Object.defineProperty(exports, "decodeCursor", { enumerable: true, get: function () { return pagination_utils_1.decodeCursor; } });
Object.defineProperty(exports, "encodeCursor", { enumerable: true, get: function () { return pagination_utils_1.encodeCursor; } });
Object.defineProperty(exports, "isCursorExpired", { enumerable: true, get: function () { return pagination_utils_1.isCursorExpired; } });
Object.defineProperty(exports, "normalizeLimit", { enumerable: true, get: function () { return pagination_utils_1.normalizeLimit; } });
Object.defineProperty(exports, "normalizePage", { enumerable: true, get: function () { return pagination_utils_1.normalizePage; } });
Object.defineProperty(exports, "parseFilterOperator", { enumerable: true, get: function () { return pagination_utils_1.parseFilterOperator; } });
Object.defineProperty(exports, "parseFilterString", { enumerable: true, get: function () { return pagination_utils_1.parseFilterString; } });
Object.defineProperty(exports, "parseSortDirection", { enumerable: true, get: function () { return pagination_utils_1.parseSortDirection; } });
Object.defineProperty(exports, "parseSortString", { enumerable: true, get: function () { return pagination_utils_1.parseSortString; } });
Object.defineProperty(exports, "validateFilterFields", { enumerable: true, get: function () { return pagination_utils_1.validateFilterFields; } });
Object.defineProperty(exports, "validateSortFields", { enumerable: true, get: function () { return pagination_utils_1.validateSortFields; } });
// Middleware
var pagination_middleware_1 = require("./pagination-middleware");
Object.defineProperty(exports, "createPaginationOptions", { enumerable: true, get: function () { return pagination_middleware_1.createPaginationOptions; } });
Object.defineProperty(exports, "extractPaginationParams", { enumerable: true, get: function () { return pagination_middleware_1.extractPaginationParams; } });
Object.defineProperty(exports, "parseFilterParams", { enumerable: true, get: function () { return pagination_middleware_1.parseFilterParams; } });
Object.defineProperty(exports, "parseListQueryParams", { enumerable: true, get: function () { return pagination_middleware_1.parseListQueryParams; } });
Object.defineProperty(exports, "parsePaginationParams", { enumerable: true, get: function () { return pagination_middleware_1.parsePaginationParams; } });
Object.defineProperty(exports, "parseSortParams", { enumerable: true, get: function () { return pagination_middleware_1.parseSortParams; } });
Object.defineProperty(exports, "getPaginationRequest", { enumerable: true, get: function () { return pagination_middleware_1.getPaginationRequest; } });
Object.defineProperty(exports, "withPagination", { enumerable: true, get: function () { return pagination_middleware_1.withPagination; } });
//# sourceMappingURL=index.js.map