/**
 * Validation Middleware
 *
 * Provides request validation middleware for Lambda handlers.
 * Validates request body, query parameters, path parameters,
 * and headers against JSON schemas.
 *
 * Validates: Requirements 8.5
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SchemaValidator } from './schema-validator';
import { type EndpointValidationSchema, type JsonSchema, type ValidationMiddlewareOptions, type ValidationResult } from './validation-types';
/**
 * Validate the entire request against endpoint schemas
 */
export declare function validateRequest(event: APIGatewayProxyEvent, schemas: EndpointValidationSchema, validator: SchemaValidator): ValidationResult;
/**
 * Handler type for validated handlers
 */
export type ValidatedHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
/**
 * Create a validation middleware wrapper
 *
 * @param schemas - Validation schemas for the endpoint
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
export declare function withValidation(schemas: EndpointValidationSchema, options?: ValidationMiddlewareOptions): (handler: ValidatedHandler) => ValidatedHandler;
/**
 * Validate request body only (convenience function)
 */
export declare function withBodyValidation(bodySchema: JsonSchema, options?: ValidationMiddlewareOptions): (handler: ValidatedHandler) => ValidatedHandler;
/**
 * Validate query parameters only (convenience function)
 */
export declare function withQueryValidation(querySchema: JsonSchema, options?: ValidationMiddlewareOptions): (handler: ValidatedHandler) => ValidatedHandler;
/**
 * Validate path parameters only (convenience function)
 */
export declare function withPathValidation(pathSchema: JsonSchema, options?: ValidationMiddlewareOptions): (handler: ValidatedHandler) => ValidatedHandler;
/**
 * Standalone validation function for use outside middleware
 */
export declare function validateRequestBody(body: string | null, schema: JsonSchema, options?: ValidationMiddlewareOptions): ValidationResult;
/**
 * Get parsed and validated body from event
 * Throws RequestValidationError if validation fails
 */
export declare function getValidatedBody<T>(event: APIGatewayProxyEvent, schema: JsonSchema, options?: ValidationMiddlewareOptions): T;
/**
 * Get parsed and validated query parameters from event
 * Throws RequestValidationError if validation fails
 */
export declare function getValidatedQueryParams<T>(event: APIGatewayProxyEvent, schema: JsonSchema, options?: ValidationMiddlewareOptions): T;
/**
 * Get parsed and validated path parameters from event
 * Throws RequestValidationError if validation fails
 */
export declare function getValidatedPathParams<T>(event: APIGatewayProxyEvent, schema: JsonSchema, options?: ValidationMiddlewareOptions): T;
//# sourceMappingURL=validation-middleware.d.ts.map