/**
 * Authentication Middleware
 * 
 * Provides JWT validation using AWS Cognito and authorization
 * middleware for Lambda handlers.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger } from '@ams/utils';

import {
  type AuthConfig,
  type AuthContext,
  type AuthUser,
  type CognitoTokenClaims,
  type Permission,
  AuthenticationError,
  AuthorizationError,
} from './auth-types';
import {
  authorize,
  createAuthorizationAuditEntry,
  type Operation,
  getOperationPermissions,
} from './permission-service';
import { getPermissionsForRoles, normalizeRoles } from './role-service';

const logger = createLogger({ service: 'auth-middleware' });

/**
 * JWT Verifier interface for token validation
 * This allows for dependency injection and testing
 */
export interface JwtVerifier {
  verify(token: string): Promise<CognitoTokenClaims>;
}

/**
 * Simple JWT decoder for extracting claims without verification
 * Used for development/testing only
 */
function decodeJwtPayload(token: string): CognitoTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthenticationError('Invalid JWT format');
  }

  try {
    const payload = Buffer.from(parts[1]!, 'base64').toString('utf-8');
    return JSON.parse(payload) as CognitoTokenClaims;
  } catch {
    throw new AuthenticationError('Failed to decode JWT payload');
  }
}

/**
 * Create a JWT verifier for Cognito tokens
 * Uses aws-jwt-verify library for production validation
 */
export async function createCognitoVerifier(config: AuthConfig): Promise<JwtVerifier> {
  // Dynamic import to handle the ESM module
  const { CognitoJwtVerifier } = await import('aws-jwt-verify');
  
  const verifier = CognitoJwtVerifier.create({
    userPoolId: config.userPoolId,
    tokenUse: 'access',
    clientId: config.clientId,
  });

  return {
    verify: async (token: string): Promise<CognitoTokenClaims> => {
      const payload = await verifier.verify(token);
      return payload as unknown as CognitoTokenClaims;
    },
  };
}

/**
 * Create a mock JWT verifier for testing
 */
export function createMockVerifier(): JwtVerifier {
  return {
    verify: async (token: string): Promise<CognitoTokenClaims> => {
      // For testing, just decode without verification
      return decodeJwtPayload(token);
    },
  };
}

/**
 * Extract the Bearer token from the Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Create an AuthUser from JWT claims
 */
export function createAuthUserFromClaims(claims: CognitoTokenClaims): AuthUser {
  const roles = normalizeRoles(claims['cognito:groups']);
  const permissions = getPermissionsForRoles(roles);

  return {
    sub: claims.sub,
    email: claims.email,
    firstName: claims.given_name,
    lastName: claims.family_name,
    roles,
    permissions,
  };
}

/**
 * Create an AuthContext from an API Gateway event and JWT claims
 */
export function createAuthContext(
  event: APIGatewayProxyEvent,
  user: AuthUser,
  tokenExpiration: number
): AuthContext {
  return {
    user,
    requestId: event.requestContext.requestId,
    sourceIp: event.requestContext.identity?.sourceIp,
    userAgent: event.headers['User-Agent'] ?? event.headers['user-agent'],
    tokenExpiration,
    isAuthenticated: true,
  };
}

/**
 * Create an unauthenticated AuthContext
 */
export function createUnauthenticatedContext(
  event: APIGatewayProxyEvent
): AuthContext {
  return {
    user: {
      sub: '',
      email: '',
      roles: [],
      permissions: [],
    },
    requestId: event.requestContext.requestId,
    sourceIp: event.requestContext.identity?.sourceIp,
    userAgent: event.headers['User-Agent'] ?? event.headers['user-agent'],
    tokenExpiration: 0,
    isAuthenticated: false,
  };
}

/**
 * Authenticate a request by validating the JWT token
 */
export async function authenticate(
  event: APIGatewayProxyEvent,
  verifier: JwtVerifier
): Promise<AuthContext> {
  const requestId = event.requestContext.requestId;
  const authHeader = event.headers['Authorization'] ?? event.headers['authorization'];

  // Extract token from header
  const token = extractBearerToken(authHeader);
  if (!token) {
    logger.warn('No bearer token provided', { requestId });
    throw new AuthenticationError('No authorization token provided');
  }

  try {
    // Verify the token
    const claims = await verifier.verify(token);

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      logger.warn('Token expired', { requestId, exp: claims.exp, now });
      throw new AuthenticationError('Token has expired');
    }

    // Create user from claims
    const user = createAuthUserFromClaims(claims);

    logger.info('User authenticated', {
      requestId,
      userId: user.sub,
      email: user.email,
      roles: user.roles,
    });

    return createAuthContext(event, user, claims.exp);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    logger.error('Token verification failed', error as Error, { requestId });
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Handler wrapper type for authenticated handlers
 */
export type AuthenticatedHandler = (
  event: APIGatewayProxyEvent,
  context: AuthContext
) => Promise<APIGatewayProxyResult>;

/**
 * Options for the withAuth middleware
 */
export interface WithAuthOptions {
  /** Required permissions for the endpoint */
  requiredPermissions?: readonly Permission[];
  /** Required operation (alternative to requiredPermissions) */
  operation?: Operation;
  /** Whether all permissions are required (default: true) */
  requireAll?: boolean;
  /** Resource name for audit logging */
  resource?: string;
  /** Whether to enable audit logging */
  enableAuditLogging?: boolean;
}

/**
 * Create an authentication/authorization middleware wrapper
 * 
 * @param verifier - JWT verifier instance
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
export function withAuth(
  verifier: JwtVerifier,
  options: WithAuthOptions = {}
): (handler: AuthenticatedHandler) => (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  const {
    requiredPermissions = [],
    operation,
    requireAll = true,
    resource,
    enableAuditLogging = true,
  } = options;

  // Resolve permissions from operation if provided
  const permissions = operation
    ? getOperationPermissions(operation)
    : requiredPermissions;

  return (handler: AuthenticatedHandler) => {
    return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
      const requestId = event.requestContext.requestId;

      try {
        // Authenticate the request
        const authContext = await authenticate(event, verifier);

        // Authorize the request
        const authResult = authorize(authContext, permissions, {
          requireAll,
          resource: resource ?? event.path,
          action: event.httpMethod,
        });

        // Log authorization decision if enabled
        if (enableAuditLogging) {
          const auditEntry = createAuthorizationAuditEntry(
            authContext,
            resource ?? event.path,
            event.httpMethod,
            permissions,
            authResult.allowed ? 'ALLOWED' : 'DENIED',
            authResult.reason
          );
          logger.info('Authorization decision', { auditEntry });
        }

        if (!authResult.allowed) {
          return createLambdaResponse(
            HTTP_STATUS.FORBIDDEN,
            createErrorResponse(
              API_ERROR_CODES.FORBIDDEN,
              authResult.reason,
              requestId
            )
          );
        }

        // Call the handler with auth context
        return await handler(event, authContext);
      } catch (error) {
        if (error instanceof AuthenticationError) {
          logger.warn('Authentication failed', { requestId, error: error.message });
          return createLambdaResponse(
            HTTP_STATUS.UNAUTHORIZED,
            createErrorResponse(
              API_ERROR_CODES.UNAUTHORIZED,
              error.message,
              requestId
            )
          );
        }

        if (error instanceof AuthorizationError) {
          logger.warn('Authorization failed', {
            requestId,
            error: error.message,
            missingPermissions: error.missingPermissions,
          });
          return createLambdaResponse(
            HTTP_STATUS.FORBIDDEN,
            createErrorResponse(
              API_ERROR_CODES.FORBIDDEN,
              error.message,
              requestId
            )
          );
        }

        // Re-throw unexpected errors
        throw error;
      }
    };
  };
}

/**
 * Create a pre-configured auth middleware with Cognito verifier
 */
export async function createAuthMiddleware(
  config: AuthConfig
): Promise<ReturnType<typeof withAuth>> {
  const verifier = await createCognitoVerifier(config);
  return withAuth(verifier);
}

/**
 * Utility to check if a request is authenticated without throwing
 */
export async function isAuthenticated(
  event: APIGatewayProxyEvent,
  verifier: JwtVerifier
): Promise<boolean> {
  try {
    await authenticate(event, verifier);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get auth context from event, returning unauthenticated context on failure
 */
export async function getAuthContext(
  event: APIGatewayProxyEvent,
  verifier: JwtVerifier
): Promise<AuthContext> {
  try {
    return await authenticate(event, verifier);
  } catch {
    return createUnauthenticatedContext(event);
  }
}
