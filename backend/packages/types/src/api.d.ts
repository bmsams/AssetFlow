/**
 * API types for request/response handling
 */
import type { ISODateString, UUID } from './common';
/**
 * Standard API error response
 */
export interface ApiErrorResponse {
    readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: readonly ValidationError[];
        readonly requestId: string;
        readonly timestamp: ISODateString;
    };
}
/**
 * Validation error detail
 */
export interface ValidationError {
    readonly field: string;
    readonly message: string;
    readonly code: string;
}
/**
 * API error codes
 */
export declare const API_ERROR_CODES: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly BAD_REQUEST: "BAD_REQUEST";
    readonly INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION";
};
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
/**
 * HTTP status codes mapping
 */
export declare const HTTP_STATUS: {
    readonly OK: 200;
    readonly CREATED: 201;
    readonly NO_CONTENT: 204;
    readonly BAD_REQUEST: 400;
    readonly UNAUTHORIZED: 401;
    readonly FORBIDDEN: 403;
    readonly NOT_FOUND: 404;
    readonly CONFLICT: 409;
    readonly UNPROCESSABLE_ENTITY: 422;
    readonly TOO_MANY_REQUESTS: 429;
    readonly INTERNAL_SERVER_ERROR: 500;
    readonly SERVICE_UNAVAILABLE: 503;
};
/**
 * API response wrapper for successful responses
 */
export interface ApiResponse<T> {
    readonly data: T;
    readonly meta?: {
        readonly requestId: string;
        readonly timestamp: ISODateString;
    };
}
/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> {
    readonly data: readonly T[];
    readonly pagination: {
        readonly total: number;
        readonly page: number;
        readonly limit: number;
        readonly hasMore: boolean;
        readonly nextCursor?: string;
    };
    readonly meta?: {
        readonly requestId: string;
        readonly timestamp: ISODateString;
    };
}
/**
 * Lambda API Gateway event context
 */
export interface ApiRequestContext {
    readonly requestId: string;
    readonly userId?: UUID;
    readonly userEmail?: string;
    readonly userRoles?: readonly string[];
    readonly sourceIp?: string;
    readonly userAgent?: string;
}
/**
 * Lambda handler response
 */
export interface LambdaResponse {
    readonly statusCode: number;
    readonly headers?: Record<string, string>;
    readonly body: string;
}
/**
 * Create a successful API response
 */
export declare function createApiResponse<T>(data: T, requestId: string): ApiResponse<T>;
/**
 * Create an error API response
 */
export declare function createErrorResponse(code: ApiErrorCode, message: string, requestId: string, details?: readonly ValidationError[]): ApiErrorResponse;
/**
 * Create a Lambda response
 */
export declare function createLambdaResponse(statusCode: number, body: unknown): LambdaResponse;
