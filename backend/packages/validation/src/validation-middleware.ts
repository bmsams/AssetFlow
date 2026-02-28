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

import {
  API_ERROR_CODES,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
  type ValidationError,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import { createSchemaValidator, SchemaValidator } from './schema-validator';
import {
  type EndpointValidationSchema,
  type JsonSchema,
  type ValidationErrorDetail,
  type ValidationMiddlewareOptions,
  type ValidationResult,
  type ValidationTarget,
  RequestValidationError,
  VALIDATION_ERROR_CODES,
} from './validation-types';

const logger = createLogger({ service: 'validation-middleware' });

/**
 * Default middleware options
 */
const DEFAULT_MIDDLEWARE_OPTIONS: ValidationMiddlewareOptions = {
  stripUnknown: false,
  errorMessagePrefix: 'Request validation failed',
};

/**
 * Parse JSON body safely
 */
function parseJsonBody(body: string | null): { success: true; data: unknown } | { success: false; error: ValidationErrorDetail } {
  if (!body) {
    return { success: true, data: {} };
  }

  try {
    return { success: true, data: JSON.parse(body) };
  } catch (error) {
    return {
      success: false,
      error: {
        field: 'body',
        message: 'Invalid JSON in request body',
        code: VALIDATION_ERROR_CODES.INVALID_JSON,
      },
    };
  }
}

/**
 * Convert query string parameters to appropriate types based on schema
 */
function coerceQueryParameters(
  params: Record<string, string | undefined> | null,
  schema: JsonSchema
): Record<string, unknown> {
  if (!params) {
    return {};
  }

  const result: Record<string, unknown> = {};
  const properties = schema.properties ?? {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    const propSchema = properties[key];
    if (!propSchema) {
      result[key] = value;
      continue;
    }

    const propType = Array.isArray(propSchema.type) ? propSchema.type[0] : propSchema.type;

    switch (propType) {
      case 'integer':
      case 'number': {
        const num = Number(value);
        result[key] = isNaN(num) ? value : num;
        break;
      }
      case 'boolean':
        result[key] = value === 'true' || value === '1';
        break;
      case 'array':
        // Handle comma-separated values
        result[key] = value.split(',').map((v) => v.trim());
        break;
      default:
        result[key] = value;
    }
  }

  return result;
}

/**
 * Validate a specific part of the request
 */
function validateTarget(
  validator: SchemaValidator,
  data: unknown,
  schema: JsonSchema,
  target: ValidationTarget
): ValidationResult {
  const result = validator.validate(data, schema);
  
  if (!result.isValid) {
    // Prefix field names with target for clarity
    const prefixedErrors = result.errors.map((error) => ({
      ...error,
      field: target === 'body' ? error.field : `${target}.${error.field}`,
    }));
    return { isValid: false, errors: prefixedErrors };
  }

  return result;
}

/**
 * Validate the entire request against endpoint schemas
 */
export function validateRequest(
  event: APIGatewayProxyEvent,
  schemas: EndpointValidationSchema,
  validator: SchemaValidator
): ValidationResult {
  const allErrors: ValidationErrorDetail[] = [];

  // Validate body
  if (schemas.body) {
    const bodyResult = parseJsonBody(event.body);
    if (!bodyResult.success) {
      allErrors.push(bodyResult.error);
    } else {
      const result = validateTarget(validator, bodyResult.data, schemas.body, 'body');
      if (!result.isValid) {
        allErrors.push(...result.errors);
      }
    }
  }

  // Validate query string parameters
  if (schemas.queryStringParameters) {
    const coercedParams = coerceQueryParameters(
      event.queryStringParameters,
      schemas.queryStringParameters
    );
    const result = validateTarget(
      validator,
      coercedParams,
      schemas.queryStringParameters,
      'queryStringParameters'
    );
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  // Validate path parameters
  if (schemas.pathParameters) {
    const result = validateTarget(
      validator,
      event.pathParameters ?? {},
      schemas.pathParameters,
      'pathParameters'
    );
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  // Validate headers
  if (schemas.headers) {
    // Normalize header names to lowercase for validation
    const normalizedHeaders: Record<string, string> = {};
    if (event.headers) {
      for (const [key, value] of Object.entries(event.headers)) {
        if (value) {
          normalizedHeaders[key.toLowerCase()] = value;
        }
      }
    }
    const result = validateTarget(validator, normalizedHeaders, schemas.headers, 'headers');
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
  }

  if (allErrors.length > 0) {
    return { isValid: false, errors: allErrors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Handler type for validated handlers
 */
export type ValidatedHandler = (
  event: APIGatewayProxyEvent
) => Promise<APIGatewayProxyResult>;

/**
 * Create a validation middleware wrapper
 * 
 * @param schemas - Validation schemas for the endpoint
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
export function withValidation(
  schemas: EndpointValidationSchema,
  options: ValidationMiddlewareOptions = {}
): (handler: ValidatedHandler) => ValidatedHandler {
  const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
  const validator = createSchemaValidator(mergedOptions.validatorOptions);

  return (handler: ValidatedHandler): ValidatedHandler => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const requestId = event.requestContext.requestId;

      // Validate the request
      const validationResult = validateRequest(event, schemas, validator);

      if (!validationResult.isValid) {
        logger.warn('Request validation failed', {
          requestId,
          path: event.path,
          method: event.httpMethod,
          errorCount: validationResult.errors.length,
          errors: validationResult.errors,
        });

        // Convert to base ValidationError type for response
        const errors: readonly ValidationError[] = validationResult.errors.map((e) => ({
          field: e.field,
          message: e.message,
          code: e.code,
        }));

        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            mergedOptions.errorMessagePrefix ?? 'Request validation failed',
            requestId,
            errors
          )
        );
      }

      logger.debug('Request validation passed', {
        requestId,
        path: event.path,
        method: event.httpMethod,
      });

      // Call the handler
      return handler(event);
    };
  };
}

/**
 * Validate request body only (convenience function)
 */
export function withBodyValidation(
  bodySchema: JsonSchema,
  options?: ValidationMiddlewareOptions
): (handler: ValidatedHandler) => ValidatedHandler {
  return withValidation({ body: bodySchema }, options);
}

/**
 * Validate query parameters only (convenience function)
 */
export function withQueryValidation(
  querySchema: JsonSchema,
  options?: ValidationMiddlewareOptions
): (handler: ValidatedHandler) => ValidatedHandler {
  return withValidation({ queryStringParameters: querySchema }, options);
}

/**
 * Validate path parameters only (convenience function)
 */
export function withPathValidation(
  pathSchema: JsonSchema,
  options?: ValidationMiddlewareOptions
): (handler: ValidatedHandler) => ValidatedHandler {
  return withValidation({ pathParameters: pathSchema }, options);
}

/**
 * Standalone validation function for use outside middleware
 */
export function validateRequestBody(
  body: string | null,
  schema: JsonSchema,
  options?: ValidationMiddlewareOptions
): ValidationResult {
  const validator = createSchemaValidator(options?.validatorOptions);
  
  const bodyResult = parseJsonBody(body);
  if (!bodyResult.success) {
    return { isValid: false, errors: [bodyResult.error] };
  }

  return validator.validate(bodyResult.data, schema);
}

/**
 * Get parsed and validated body from event
 * Throws RequestValidationError if validation fails
 */
export function getValidatedBody<T>(
  event: APIGatewayProxyEvent,
  schema: JsonSchema,
  options?: ValidationMiddlewareOptions
): T {
  const validator = createSchemaValidator(options?.validatorOptions);
  
  const bodyResult = parseJsonBody(event.body);
  if (!bodyResult.success) {
    throw new RequestValidationError(
      'Invalid JSON in request body',
      [bodyResult.error]
    );
  }

  const result = validator.validateAndTransform<T>(bodyResult.data, schema);
  if (!result.isValid) {
    throw new RequestValidationError(
      'Request body validation failed',
      result.errors
    );
  }

  return result.data;
}

/**
 * Get parsed and validated query parameters from event
 * Throws RequestValidationError if validation fails
 */
export function getValidatedQueryParams<T>(
  event: APIGatewayProxyEvent,
  schema: JsonSchema,
  options?: ValidationMiddlewareOptions
): T {
  const validator = createSchemaValidator(options?.validatorOptions);
  const coercedParams = coerceQueryParameters(event.queryStringParameters, schema);
  
  const result = validator.validateAndTransform<T>(coercedParams, schema);
  if (!result.isValid) {
    throw new RequestValidationError(
      'Query parameter validation failed',
      result.errors
    );
  }

  return result.data;
}

/**
 * Get parsed and validated path parameters from event
 * Throws RequestValidationError if validation fails
 */
export function getValidatedPathParams<T>(
  event: APIGatewayProxyEvent,
  schema: JsonSchema,
  options?: ValidationMiddlewareOptions
): T {
  const validator = createSchemaValidator(options?.validatorOptions);
  
  const result = validator.validateAndTransform<T>(event.pathParameters ?? {}, schema);
  if (!result.isValid) {
    throw new RequestValidationError(
      'Path parameter validation failed',
      result.errors
    );
  }

  return result.data;
}
