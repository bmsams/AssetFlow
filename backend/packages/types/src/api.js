"use strict";
/**
 * API types for request/response handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP_STATUS = exports.API_ERROR_CODES = void 0;
exports.createApiResponse = createApiResponse;
exports.createErrorResponse = createErrorResponse;
exports.createLambdaResponse = createLambdaResponse;
/**
 * API error codes
 */
exports.API_ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    BAD_REQUEST: 'BAD_REQUEST',
    INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
};
/**
 * HTTP status codes mapping
 */
exports.HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
};
/**
 * Create a successful API response
 */
function createApiResponse(data, requestId) {
    return {
        data,
        meta: {
            requestId,
            timestamp: new Date().toISOString(),
        },
    };
}
/**
 * Create an error API response
 */
function createErrorResponse(code, message, requestId, details) {
    return {
        error: {
            code,
            message,
            details,
            requestId,
            timestamp: new Date().toISOString(),
        },
    };
}
/**
 * Create a Lambda response
 */
function createLambdaResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-Id',
        },
        body: JSON.stringify(body),
    };
}
//# sourceMappingURL=api.js.map