/**
 * Authentication Middleware
 *
 * Provides JWT validation using AWS Cognito and authorization
 * middleware for Lambda handlers.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { type AuthConfig, type AuthContext, type AuthUser, type CognitoTokenClaims, type Permission } from './auth-types';
import { type Operation } from './permission-service';
/**
 * JWT Verifier interface for token validation
 * This allows for dependency injection and testing
 */
export interface JwtVerifier {
    verify(token: string): Promise<CognitoTokenClaims>;
}
/**
 * Create a JWT verifier for Cognito tokens
 * Uses aws-jwt-verify library for production validation
 */
export declare function createCognitoVerifier(config: AuthConfig): Promise<JwtVerifier>;
/**
 * Create a mock JWT verifier for testing
 */
export declare function createMockVerifier(): JwtVerifier;
/**
 * Extract the Bearer token from the Authorization header
 */
export declare function extractBearerToken(authHeader: string | undefined): string | null;
/**
 * Create an AuthUser from JWT claims
 */
export declare function createAuthUserFromClaims(claims: CognitoTokenClaims): AuthUser;
/**
 * Create an AuthContext from an API Gateway event and JWT claims
 */
export declare function createAuthContext(event: APIGatewayProxyEvent, user: AuthUser, tokenExpiration: number): AuthContext;
/**
 * Create an unauthenticated AuthContext
 */
export declare function createUnauthenticatedContext(event: APIGatewayProxyEvent): AuthContext;
/**
 * Authenticate a request by validating the JWT token
 */
export declare function authenticate(event: APIGatewayProxyEvent, verifier: JwtVerifier): Promise<AuthContext>;
/**
 * Handler wrapper type for authenticated handlers
 */
export type AuthenticatedHandler = (event: APIGatewayProxyEvent, context: AuthContext) => Promise<APIGatewayProxyResult>;
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
export declare function withAuth(verifier: JwtVerifier, options?: WithAuthOptions): (handler: AuthenticatedHandler) => (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;
/**
 * Create a pre-configured auth middleware with Cognito verifier
 */
export declare function createAuthMiddleware(config: AuthConfig): Promise<ReturnType<typeof withAuth>>;
/**
 * Utility to check if a request is authenticated without throwing
 */
export declare function isAuthenticated(event: APIGatewayProxyEvent, verifier: JwtVerifier): Promise<boolean>;
/**
 * Get auth context from event, returning unauthenticated context on failure
 */
export declare function getAuthContext(event: APIGatewayProxyEvent, verifier: JwtVerifier): Promise<AuthContext>;
//# sourceMappingURL=auth-middleware.d.ts.map