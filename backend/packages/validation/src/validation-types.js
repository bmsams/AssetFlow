"use strict";
/**
 * Validation Types
 *
 * Defines types for request validation including ValidationError,
 * ValidationResult, and schema definitions.
 *
 * Validates: Requirements 8.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestValidationError = exports.SUPPORTED_FORMATS = exports.VALIDATION_ERROR_CODES = void 0;
/**
 * Validation error codes for standardized error responses
 */
exports.VALIDATION_ERROR_CODES = {
    REQUIRED: 'REQUIRED',
    INVALID_TYPE: 'INVALID_TYPE',
    INVALID_FORMAT: 'INVALID_FORMAT',
    MIN_LENGTH: 'MIN_LENGTH',
    MAX_LENGTH: 'MAX_LENGTH',
    PATTERN_MISMATCH: 'PATTERN_MISMATCH',
    MIN_VALUE: 'MIN_VALUE',
    MAX_VALUE: 'MAX_VALUE',
    MIN_ITEMS: 'MIN_ITEMS',
    MAX_ITEMS: 'MAX_ITEMS',
    UNIQUE_ITEMS: 'UNIQUE_ITEMS',
    INVALID_ENUM: 'INVALID_ENUM',
    ADDITIONAL_PROPERTIES: 'ADDITIONAL_PROPERTIES',
    INVALID_JSON: 'INVALID_JSON',
    SCHEMA_ERROR: 'SCHEMA_ERROR',
};
/**
 * Supported format validators
 */
exports.SUPPORTED_FORMATS = [
    'email',
    'uuid',
    'uri',
    'uri-reference',
    'date',
    'date-time',
    'time',
    'hostname',
    'ipv4',
    'ipv6',
    'regex',
];
/**
 * Error thrown when validation fails
 */
class RequestValidationError extends Error {
    code;
    statusCode;
    errors;
    constructor(message, errors, code = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'RequestValidationError';
        this.code = code;
        this.statusCode = 400;
        this.errors = errors;
    }
}
exports.RequestValidationError = RequestValidationError;
//# sourceMappingURL=validation-types.js.map