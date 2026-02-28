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
export { type EndpointValidationSchema, type JsonSchema, type SchemaValidatorOptions, type SupportedFormat, type ValidationErrorCode, type ValidationErrorDetail, type ValidationMiddlewareOptions, type ValidationResult, type ValidationTarget, RequestValidationError, SUPPORTED_FORMATS, VALIDATION_ERROR_CODES, } from './validation-types';
export { createSchemaValidator, SchemaValidator, validateSchema, } from './schema-validator';
export { type ValidatedHandler, getValidatedBody, getValidatedPathParams, getValidatedQueryParams, validateRequest, validateRequestBody, withBodyValidation, withPathValidation, withQueryValidation, withValidation, } from './validation-middleware';
//# sourceMappingURL=index.d.ts.map