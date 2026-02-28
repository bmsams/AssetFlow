"use strict";
/**
 * Authentication Middleware
 *
 * Provides JWT validation using AWS Cognito and authorization
 * middleware for Lambda handlers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCognitoVerifier = createCognitoVerifier;
exports.createMockVerifier = createMockVerifier;
exports.extractBearerToken = extractBearerToken;
exports.createAuthUserFromClaims = createAuthUserFromClaims;
exports.createAuthContext = createAuthContext;
exports.createUnauthenticatedContext = createUnauthenticatedContext;
exports.authenticate = authenticate;
exports.withAuth = withAuth;
exports.createAuthMiddleware = createAuthMiddleware;
exports.isAuthenticated = isAuthenticated;
exports.getAuthContext = getAuthContext;
const types_1 = require("@ams/types");
const utils_1 = require("@ams/utils");
const auth_types_1 = require("./auth-types");
const permission_service_1 = require("./permission-service");
const role_service_1 = require("./role-service");
const logger = (0, utils_1.createLogger)({ service: 'auth-middleware' });
/**
 * Simple JWT decoder for extracting claims without verification
 * Used for development/testing only
 */
function decodeJwtPayload(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new auth_types_1.AuthenticationError('Invalid JWT format');
    }
    try {
        const payload = Buffer.from(parts[1], 'base64').toString('utf-8');
        return JSON.parse(payload);
    }
    catch {
        throw new auth_types_1.AuthenticationError('Failed to decode JWT payload');
    }
}
/**
 * Create a JWT verifier for Cognito tokens
 * Uses aws-jwt-verify library for production validation
 */
async function createCognitoVerifier(config) {
    // Dynamic import to handle the ESM module
    const { CognitoJwtVerifier } = await Promise.resolve().then(() => __importStar(require('aws-jwt-verify')));
    const verifier = CognitoJwtVerifier.create({
        userPoolId: config.userPoolId,
        tokenUse: 'access',
        clientId: config.clientId,
    });
    return {
        verify: async (token) => {
            const payload = await verifier.verify(token);
            return payload;
        },
    };
}
/**
 * Create a mock JWT verifier for testing
 */
function createMockVerifier() {
    return {
        verify: async (token) => {
            // For testing, just decode without verification
            return decodeJwtPayload(token);
        },
    };
}
/**
 * Extract the Bearer token from the Authorization header
 */
function extractBearerToken(authHeader) {
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
function createAuthUserFromClaims(claims) {
    const roles = (0, role_service_1.normalizeRoles)(claims['cognito:groups']);
    const permissions = (0, role_service_1.getPermissionsForRoles)(roles);
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
function createAuthContext(event, user, tokenExpiration) {
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
function createUnauthenticatedContext(event) {
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
async function authenticate(event, verifier) {
    const requestId = event.requestContext.requestId;
    const authHeader = event.headers['Authorization'] ?? event.headers['authorization'];
    // Extract token from header
    const token = extractBearerToken(authHeader);
    if (!token) {
        logger.warn('No bearer token provided', { requestId });
        throw new auth_types_1.AuthenticationError('No authorization token provided');
    }
    try {
        // Verify the token
        const claims = await verifier.verify(token);
        // Check token expiration
        const now = Math.floor(Date.now() / 1000);
        if (claims.exp < now) {
            logger.warn('Token expired', { requestId, exp: claims.exp, now });
            throw new auth_types_1.AuthenticationError('Token has expired');
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
    }
    catch (error) {
        if (error instanceof auth_types_1.AuthenticationError) {
            throw error;
        }
        logger.error('Token verification failed', error, { requestId });
        throw new auth_types_1.AuthenticationError('Invalid or expired token');
    }
}
/**
 * Create an authentication/authorization middleware wrapper
 *
 * @param verifier - JWT verifier instance
 * @param options - Middleware options
 * @returns Middleware function that wraps handlers
 */
function withAuth(verifier, options = {}) {
    const { requiredPermissions = [], operation, requireAll = true, resource, enableAuditLogging = true, } = options;
    // Resolve permissions from operation if provided
    const permissions = operation
        ? (0, permission_service_1.getOperationPermissions)(operation)
        : requiredPermissions;
    return (handler) => {
        return async (event) => {
            const requestId = event.requestContext.requestId;
            try {
                // Authenticate the request
                const authContext = await authenticate(event, verifier);
                // Authorize the request
                const authResult = (0, permission_service_1.authorize)(authContext, permissions, {
                    requireAll,
                    resource: resource ?? event.path,
                    action: event.httpMethod,
                });
                // Log authorization decision if enabled
                if (enableAuditLogging) {
                    const auditEntry = (0, permission_service_1.createAuthorizationAuditEntry)(authContext, resource ?? event.path, event.httpMethod, permissions, authResult.allowed ? 'ALLOWED' : 'DENIED', authResult.reason);
                    logger.info('Authorization decision', { auditEntry });
                }
                if (!authResult.allowed) {
                    return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.FORBIDDEN, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.FORBIDDEN, authResult.reason, requestId));
                }
                // Call the handler with auth context
                return await handler(event, authContext);
            }
            catch (error) {
                if (error instanceof auth_types_1.AuthenticationError) {
                    logger.warn('Authentication failed', { requestId, error: error.message });
                    return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.UNAUTHORIZED, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.UNAUTHORIZED, error.message, requestId));
                }
                if (error instanceof auth_types_1.AuthorizationError) {
                    logger.warn('Authorization failed', {
                        requestId,
                        error: error.message,
                        missingPermissions: error.missingPermissions,
                    });
                    return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.FORBIDDEN, (0, types_1.createErrorResponse)(types_1.API_ERROR_CODES.FORBIDDEN, error.message, requestId));
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
async function createAuthMiddleware(config) {
    const verifier = await createCognitoVerifier(config);
    return withAuth(verifier);
}
/**
 * Utility to check if a request is authenticated without throwing
 */
async function isAuthenticated(event, verifier) {
    try {
        await authenticate(event, verifier);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Get auth context from event, returning unauthenticated context on failure
 */
async function getAuthContext(event, verifier) {
    try {
        return await authenticate(event, verifier);
    }
    catch {
        return createUnauthenticatedContext(event);
    }
}
//# sourceMappingURL=auth-middleware.js.map