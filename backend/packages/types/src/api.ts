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
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_PROVISIONED: 'USER_NOT_PROVISIONED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

/**
 * HTTP status codes mapping
 */
export const HTTP_STATUS = {
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
} as const;

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
export function createApiResponse<T>(
  data: T,
  requestId: string
): ApiResponse<T> {
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
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: readonly ValidationError[]
): ApiErrorResponse {
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
export function createLambdaResponse(
  statusCode: number,
  body: unknown
): LambdaResponse {
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
