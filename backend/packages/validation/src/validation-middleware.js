"use strict";
/**
 * Validation Middleware
 *
 * Provides request validation middleware for Lambda handlers.
 * Validates request body, query parameters, path parameters,
 * and headers against JSON schemas.
 *
 * Validates: Requirements 8.5
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = validateRequest;
exports.withValidation = withValidation;
exports.withBodyValidation = withBodyValidation;
exports.withQueryValidation = withQueryValidation;
exports.withPathValidation = withPathValidation;
exports.validateRequestBody = validateRequestBody;
exports.getValidatedBody = getValidatedBody;
exports.getValidatedQueryParams = getValidatedQueryParams;
exports.getValidatedPathParams = getValidatedPathParams;
const types_1 = require("@ams/types");
const utils_1 = require("@ams/utils");
const schema_validator_1 = require("./schema-validator");
const validation_types_1 = require("./validation-types");
const logger = (0, utils_1.createLogger)({ service: 'validation-middleware' });
/**
 * Default middleware options
 */
const DEFAULT_MIDDLEWARE_OPTIONS = {
    stripUnknown: false,
    errorMessagePrefix: 'Request validation failed',
};
/**
 * Parse JSON body safely
 */
function parseJsonBody(body) {
    if (!body) {
        return { success: true, data: {} };
    }
    try {
        return { success: true, data: JSON.parse(body) };
    }
    catch (error) {
        return {
            success: false,
            error: {
                field: 'body',
                message: 'Invalid JSON in request body',
                code: validation_types_1.VALIDATION_ERROR_CODES.INVALID_JSON,
            },
        };
    }
}
/**
 * Convert query string parameters to appropriate types based on schema
 */
function coerceQueryParameters(params, schema) {
    if (!params) {
        return {};
    }
    const result = {};
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
function validateTarget(validator, data, schema, target) {
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
function validateRequest(event, schemas, validator) {
    const allErrors = [];
    // Validate body
    if (schemas.body) {
        const bodyResult = parseJsonBody(event.body);
        if (!bodyResult.success) {
            allErrors.push(bodyResult.error);
        }
        else {
            const result = validateTarget(validator, bodyResult.data, schemas.body, 'body');
            if (!result.isValid) {
                allErrors.push(...result.errors);
            }
        }
    }
    // Validate query string parameters
    if (schemas.queryStringParameters) {
        const coercedParams = coerceQueryParameters(event.queryStringParameters, schemas.queryStringParameters);
        const result = validateTarget(validator, coercedParams, schemas.queryStringParameters, 'queryStringParameters');
        if (!result.isValid) {
            allErrors.push(...result.errors);
        }
    }
    // Validate path parameters
    if (schemas.pathParameters) {
        const result = validateTarget(validator, event.pathParameters ?? {}, schemas.pathParameters, 'pathParameters');
        if (!result.isValid) {
            allErrors.push(...result.errors);
        }
    }
    // Validate headers
    if (schemas.headers) {
        // Normalize header names to lowercase for validation
        const normalizedHeaders = {};
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
 * Create a validation middleware wrapper
 *
 * @param schemas - Validation schemas for the endpoint
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
function withValidation(schemas, options = {}) {
    const mergedOptions = { ...DEFAULT_MIDDLEWARE_OPTIONS, ...options };
    const validator = (0, schema_validator_1.createSchemaValidator)(mergedOptions.validatorOptions);
    return (handler) => {
        return async (event) => {
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
                const errors = validationResult.errors.map((e) => ({
                    field: e.field,
                    message: e.message,
                    code: e.code,
                }));
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.BAD_REQUEST, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.VALIDATION_ERROR, mergedOptions.errorMessagePrefix ?? 'Request validation failed', requestId, errors));
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
function withBodyValidation(bodySchema, options) {
    return withValidation({ body: bodySchema }, options);
}
/**
 * Validate query parameters only (convenience function)
 */
function withQueryValidation(querySchema, options) {
    return withValidation({ queryStringParameters: querySchema }, options);
}
/**
 * Validate path parameters only (convenience function)
 */
function withPathValidation(pathSchema, options) {
    return withValidation({ pathParameters: pathSchema }, options);
}
/**
 * Standalone validation function for use outside middleware
 */
function validateRequestBody(body, schema, options) {
    const validator = (0, schema_validator_1.createSchemaValidator)(options?.validatorOptions);
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
function getValidatedBody(event, schema, options) {
    const validator = (0, schema_validator_1.createSchemaValidator)(options?.validatorOptions);
    const bodyResult = parseJsonBody(event.body);
    if (!bodyResult.success) {
        throw new validation_types_1.RequestValidationError('Invalid JSON in request body', [bodyResult.error]);
    }
    const result = validator.validateAndTransform(bodyResult.data, schema);
    if (!result.isValid) {
        throw new validation_types_1.RequestValidationError('Request body validation failed', result.errors);
    }
    return result.data;
}
/**
 * Get parsed and validated query parameters from event
 * Throws RequestValidationError if validation fails
 */
function getValidatedQueryParams(event, schema, options) {
    const validator = (0, schema_validator_1.createSchemaValidator)(options?.validatorOptions);
    const coercedParams = coerceQueryParameters(event.queryStringParameters, schema);
    const result = validator.validateAndTransform(coercedParams, schema);
    if (!result.isValid) {
        throw new validation_types_1.RequestValidationError('Query parameter validation failed', result.errors);
    }
    return result.data;
}
/**
 * Get parsed and validated path parameters from event
 * Throws RequestValidationError if validation fails
 */
function getValidatedPathParams(event, schema, options) {
    const validator = (0, schema_validator_1.createSchemaValidator)(options?.validatorOptions);
    const result = validator.validateAndTransform(event.pathParameters ?? {}, schema);
    if (!result.isValid) {
        throw new validation_types_1.RequestValidationError('Path parameter validation failed', result.errors);
    }
    return result.data;
}
//# sourceMappingURL=validation-middleware.js.map