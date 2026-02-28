/**
 * Auth Middleware Tests
 * 
 * Tests for JWT validation, authentication, and authorization middleware.
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import {
  authenticate,
  AuthenticationError,
  AuthorizationError,
  type AuthContext,
  createAuthContext,
  createAuthUserFromClaims,
  createMockVerifier,
  createUnauthenticatedContext,
  extractBearerToken,
  type JwtVerifier,
  PERMISSIONS,
  ROLES,
  withAuth,
} from '../index';

// Helper to create a mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/test',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/test',
    },
    resource: '/test',
    ...overrides,
  };
}

// Helper to create a valid JWT token for testing
function createTestToken(claims: Record<string, unknown> = {}): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    'cognito:groups': ['ADMIN'],
    given_name: 'Test',
    family_name: 'User',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    ...claims,
  };

  const encodeBase64 = (obj: unknown): string =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  return `${encodeBase64(header)}.${encodeBase64(payload)}.fake-signature`;
}

describe('extractBearerToken', () => {
  it('should extract token from valid Bearer header', () => {
    const token = extractBearerToken('Bearer abc123');
    expect(token).toBe('abc123');
  });

  it('should return null for missing header', () => {
    const token = extractBearerToken(undefined);
    expect(token).toBeNull();
  });

  it('should return null for empty header', () => {
    const token = extractBearerToken('');
    expect(token).toBeNull();
  });

  it('should return null for non-Bearer header', () => {
    const token = extractBearerToken('Basic abc123');
    expect(token).toBeNull();
  });

  it('should return null for malformed Bearer header', () => {
    const token = extractBearerToken('Bearer');
    expect(token).toBeNull();
  });

  it('should handle case-insensitive Bearer prefix', () => {
    const token = extractBearerToken('bearer abc123');
    expect(token).toBe('abc123');
  });
});

describe('createAuthUserFromClaims', () => {
  it('should create user from valid claims', () => {
    const claims = {
      sub: 'user-123',
      email: 'user@example.com',
      given_name: 'John',
      family_name: 'Doe',
      'cognito:groups': ['ADMIN', 'ASSET_MANAGER'],
      iat: 1234567890,
      exp: 1234571490,
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    };

    const user = createAuthUserFromClaims(claims);

    expect(user.sub).toBe('user-123');
    expect(user.email).toBe('user@example.com');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.roles).toContain(ROLES.ADMIN);
    expect(user.roles).toContain(ROLES.ASSET_MANAGER);
    expect(user.permissions.length).toBeGreaterThan(0);
  });

  it('should handle missing optional fields', () => {
    const claims = {
      sub: 'user-123',
      email: 'user@example.com',
      iat: 1234567890,
      exp: 1234571490,
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    };

    const user = createAuthUserFromClaims(claims);

    expect(user.sub).toBe('user-123');
    expect(user.email).toBe('user@example.com');
    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.roles).toEqual([]);
    expect(user.permissions).toEqual([]);
  });

  it('should filter out invalid roles', () => {
    const claims = {
      sub: 'user-123',
      email: 'user@example.com',
      'cognito:groups': ['ADMIN', 'INVALID_ROLE', 'VIEWER'],
      iat: 1234567890,
      exp: 1234571490,
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test',
    };

    const user = createAuthUserFromClaims(claims);

    expect(user.roles).toContain(ROLES.ADMIN);
    expect(user.roles).toContain(ROLES.VIEWER);
    expect(user.roles).not.toContain('INVALID_ROLE');
    expect(user.roles.length).toBe(2);
  });
});

describe('createAuthContext', () => {
  it('should create auth context from event and user', () => {
    const event = createMockEvent();
    const user = {
      sub: 'user-123',
      email: 'user@example.com',
      roles: [ROLES.ADMIN] as const,
      permissions: [PERMISSIONS.ASSET_READ] as const,
    };
    const tokenExpiration = Math.floor(Date.now() / 1000) + 3600;

    const context = createAuthContext(event, user, tokenExpiration);

    expect(context.user).toBe(user);
    expect(context.requestId).toBe('test-request-id');
    expect(context.sourceIp).toBe('127.0.0.1');
    expect(context.tokenExpiration).toBe(tokenExpiration);
    expect(context.isAuthenticated).toBe(true);
  });
});

describe('createUnauthenticatedContext', () => {
  it('should create unauthenticated context', () => {
    const event = createMockEvent();

    const context = createUnauthenticatedContext(event);

    expect(context.user.sub).toBe('');
    expect(context.user.email).toBe('');
    expect(context.user.roles).toEqual([]);
    expect(context.user.permissions).toEqual([]);
    expect(context.isAuthenticated).toBe(false);
  });
});

describe('authenticate', () => {
  let mockVerifier: JwtVerifier;

  beforeEach(() => {
    mockVerifier = createMockVerifier();
  });

  it('should authenticate valid token', async () => {
    const token = createTestToken();
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const context = await authenticate(event, mockVerifier);

    expect(context.isAuthenticated).toBe(true);
    expect(context.user.sub).toBe('test-user-id');
    expect(context.user.email).toBe('test@example.com');
    expect(context.user.roles).toContain(ROLES.ADMIN);
  });

  it('should throw AuthenticationError for missing token', async () => {
    const event = createMockEvent();

    await expect(authenticate(event, mockVerifier)).rejects.toThrow(
      AuthenticationError
    );
  });

  it('should throw AuthenticationError for expired token', async () => {
    const token = createTestToken({
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    await expect(authenticate(event, mockVerifier)).rejects.toThrow(
      AuthenticationError
    );
  });

  it('should throw AuthenticationError for invalid token format', async () => {
    const event = createMockEvent({
      headers: { Authorization: 'Bearer invalid-token' },
    });

    await expect(authenticate(event, mockVerifier)).rejects.toThrow(
      AuthenticationError
    );
  });

  it('should handle lowercase authorization header', async () => {
    const token = createTestToken();
    const event = createMockEvent({
      headers: { authorization: `Bearer ${token}` },
    });

    const context = await authenticate(event, mockVerifier);

    expect(context.isAuthenticated).toBe(true);
  });
});

describe('withAuth middleware', () => {
  let mockVerifier: JwtVerifier;

  beforeEach(() => {
    mockVerifier = createMockVerifier();
  });

  it('should allow authenticated request with required permissions', async () => {
    const token = createTestToken({ 'cognito:groups': ['ADMIN'] });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const handler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    });

    const wrappedHandler = withAuth(mockVerifier, {
      requiredPermissions: [PERMISSIONS.ASSET_READ],
    })(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent();

    const handler = jest.fn();

    const wrappedHandler = withAuth(mockVerifier)(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return 403 for unauthorized request', async () => {
    const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const handler = jest.fn();

    const wrappedHandler = withAuth(mockVerifier, {
      requiredPermissions: [PERMISSIONS.ADMIN_USERS],
    })(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should pass auth context to handler', async () => {
    const token = createTestToken({
      sub: 'specific-user-id',
      email: 'specific@example.com',
      'cognito:groups': ['ASSET_MANAGER'],
    });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    let capturedContext: AuthContext | null = null;
    const handler = jest.fn().mockImplementation((_event, context) => {
      capturedContext = context;
      return { statusCode: 200, body: '{}' };
    });

    const wrappedHandler = withAuth(mockVerifier)(handler);

    await wrappedHandler(event);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext!.user.sub).toBe('specific-user-id');
    expect(capturedContext!.user.email).toBe('specific@example.com');
    expect(capturedContext!.user.roles).toContain(ROLES.ASSET_MANAGER);
  });

  it('should allow admin to bypass permission checks', async () => {
    const token = createTestToken({ 'cognito:groups': ['ADMIN'] });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const handler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: '{}',
    });

    const wrappedHandler = withAuth(mockVerifier, {
      requiredPermissions: [PERMISSIONS.ADMIN_USERS, PERMISSIONS.ADMIN_ROLES],
    })(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('should work with operation-based permissions', async () => {
    const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const handler = jest.fn().mockResolvedValue({
      statusCode: 200,
      body: '{}',
    });

    const wrappedHandler = withAuth(mockVerifier, {
      operation: 'asset:create',
    })(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('should deny operation without required permissions', async () => {
    const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
    const event = createMockEvent({
      headers: { Authorization: `Bearer ${token}` },
    });

    const handler = jest.fn();

    const wrappedHandler = withAuth(mockVerifier, {
      operation: 'asset:create',
    })(handler);

    const result = await wrappedHandler(event);

    expect(result.statusCode).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('Error classes', () => {
  describe('AuthenticationError', () => {
    it('should have correct properties', () => {
      const error = new AuthenticationError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.name).toBe('AuthenticationError');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
    });

    it('should accept custom code', () => {
      const error = new AuthenticationError('Test', 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct properties', () => {
      const error = new AuthorizationError('Test message');

      expect(error.message).toBe('Test message');
      expect(error.name).toBe('AuthorizationError');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.missingPermissions).toEqual([]);
    });

    it('should include missing permissions', () => {
      const error = new AuthorizationError(
        'Test',
        [PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_DELETE],
        'FORBIDDEN'
      );

      expect(error.missingPermissions).toContain(PERMISSIONS.ASSET_CREATE);
      expect(error.missingPermissions).toContain(PERMISSIONS.ASSET_DELETE);
    });
  });
});
