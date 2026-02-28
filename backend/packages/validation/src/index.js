"use strict";
/**
 * @ams/validation - Request validation middleware for Asset Management System
 *
 * This package provides JSON Schema-based request validation for Lambda handlers.
 * It supports validation of request body, query parameters, path parameters,
 * and headers with standardized error responses.
 *
 * Validates: Requirements 8.5
 *
 * @example
 * ```typescript
 * import { withValidation, withBodyValidation } from '@ams/validation';
 *
 * // Define validation schema
 * const createAssetSchema = {
 *   body: {
 *     type: 'object',
 *     required: ['name', 'type'],
 *     properties: {
 *       name: { type: 'string', minLength: 1, maxLength: 255 },
 *       type: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'] },
 *       email: { type: 'string', format: 'email' },
 *     },
 *   },
 * };
 *
 * // Use middleware
 * const handler = withValidation(createAssetSchema)(async (event) => {
 *   // Request is validated, proceed with business logic
 *   const body = JSON.parse(event.body!);
 *   // ...
 * });
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withValidation = exports.withQueryValidation = exports.withPathValidation = exports.withBodyValidation = exports.validateRequestBody = exports.validateRequest = exports.getValidatedQueryParams = exports.getValidatedPathParams = exports.getValidatedBody = exports.validateSchema = exports.SchemaValidator = exports.createSchemaValidator = exports.VALIDATION_ERROR_CODES = exports.SUPPORTED_FORMATS = exports.RequestValidationError = void 0;
// Types
var validation_types_1 = require("./validation-types");
Object.defineProperty(exports, "RequestValidationError", { enumerable: true, get: function () { return validation_types_1.RequestValidationError; } });
Object.defineProperty(exports, "SUPPORTED_FORMATS", { enumerable: true, get: function () { return validation_types_1.SUPPORTED_FORMATS; } });
Object.defineProperty(exports, "VALIDATION_ERROR_CODES", { enumerable: true, get: function () { return validation_types_1.VALIDATION_ERROR_CODES; } });
// Schema Validator
var schema_validator_1 = require("./schema-validator");
Object.defineProperty(exports, "createSchemaValidator", { enumerable: true, get: function () { return schema_validator_1.createSchemaValidator; } });
Object.defineProperty(exports, "SchemaValidator", { enumerable: true, get: function () { return schema_validator_1.SchemaValidator; } });
Object.defineProperty(exports, "validateSchema", { enumerable: true, get: function () { return schema_validator_1.validateSchema; } });
// Middleware
var validation_middleware_1 = require("./validation-middleware");
Object.defineProperty(exports, "getValidatedBody", { enumerable: true, get: function () { return validation_middleware_1.getValidatedBody; } });
Object.defineProperty(exports, "getValidatedPathParams", { enumerable: true, get: function () { return validation_middleware_1.getValidatedPathParams; } });
Object.defineProperty(exports, "getValidatedQueryParams", { enumerable: true, get: function () { return validation_middleware_1.getValidatedQueryParams; } });
Object.defineProperty(exports, "validateRequest", { enumerable: true, get: function () { return validation_middleware_1.validateRequest; } });
Object.defineProperty(exports, "validateRequestBody", { enumerable: true, get: function () { return validation_middleware_1.validateRequestBody; } });
Object.defineProperty(exports, "withBodyValidation", { enumerable: true, get: function () { return validation_middleware_1.withBodyValidation; } });
Object.defineProperty(exports, "withPathValidation", { enumerable: true, get: function () { return validation_middleware_1.withPathValidation; } });
Object.defineProperty(exports, "withQueryValidation", { enumerable: true, get: function () { return validation_middleware_1.withQueryValidation; } });
Object.defineProperty(exports, "withValidation", { enumerable: true, get: function () { return validation_middleware_1.withValidation; } });
//# sourceMappingURL=index.js.map