"use strict";
/**
 * API Integration Tests
 *
 * Tests for API layer integration including authentication, authorization,
 * validation, pagination, and error handling.
 *
 * Validates: Requirements 8.1-8.9
 */
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("@ams/auth");
const validation_1 = require("@ams/validation");
const pagination_1 = require("@ams/pagination");
const types_1 = require("@ams/types");
// Mock logger
jest.mock('@ams/utils', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));
/**
 * Helper to create a mock API Gateway event
 */
function createMockEvent(overrides = {}) {
    return {
        body: null,
        headers: {},
        multiValueHeaders: {},
        httpMethod: 'GET',
        isBase64Encoded: false,
        path: '/api/v1/assets',
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
                sourceIp: '192.168.1.100',
                user: null,
                userAgent: 'Mozilla/5.0 (Test Agent)',
                userArn: null,
            },
            path: '/api/v1/assets',
            stage: 'v1',
            requestId: 'test-request-id-12345',
            requestTimeEpoch: Date.now(),
            resourceId: 'test-resource',
            resourcePath: '/api/v1/assets',
        },
        resource: '/api/v1/assets',
        ...overrides,
    };
}
/**
 * Helper to create a valid JWT token for testing
 */
function createTestToken(claims = {}) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        sub: 'test-user-id-12345',
        email: 'testuser@example.com',
        'cognito:groups': ['ADMIN'],
        given_name: 'Test',
        family_name: 'User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_testpool',
        ...claims,
    };
    const encodeBase64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    return `${encodeBase64(header)}.${encodeBase64(payload)}.fake-signature`;
}
/**
 * Test Suite: Authentication Integration
 * Validates: Requirements 8.2 - JWT-based authentication with Cognito integration
 */
describe('Authentication Integration', () => {
    let mockVerifier;
    beforeEach(() => {
        mockVerifier = (0, auth_1.createMockVerifier)();
    });
    describe('JWT Token Validation', () => {
        it('should authenticate valid JWT token and extract user claims', async () => {
            const token = createTestToken({
                sub: 'user-abc-123',
                email: 'admin@company.com',
                'cognito:groups': ['ADMIN', 'ASSET_MANAGER'],
                given_name: 'Admin',
                family_name: 'User',
            });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
            });
            const context = await (0, auth_1.authenticate)(event, mockVerifier);
            expect(context.isAuthenticated).toBe(true);
            expect(context.user.sub).toBe('user-abc-123');
            expect(context.user.email).toBe('admin@company.com');
            expect(context.user.firstName).toBe('Admin');
            expect(context.user.lastName).toBe('User');
            expect(context.user.roles).toContain(auth_1.ROLES.ADMIN);
            expect(context.user.roles).toContain(auth_1.ROLES.ASSET_MANAGER);
        });
        it('should reject request without Authorization header', async () => {
            const event = createMockEvent({ headers: {} });
            await expect((0, auth_1.authenticate)(event, mockVerifier)).rejects.toThrow(auth_1.AuthenticationError);
            await expect((0, auth_1.authenticate)(event, mockVerifier)).rejects.toThrow('No authorization token provided');
        });
        it('should reject request with invalid Bearer format', async () => {
            const event = createMockEvent({
                headers: { Authorization: 'InvalidFormat token123' },
            });
            await expect((0, auth_1.authenticate)(event, mockVerifier)).rejects.toThrow(auth_1.AuthenticationError);
        });
        it('should reject expired JWT token', async () => {
            const token = createTestToken({
                exp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
            });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
            });
            await expect((0, auth_1.authenticate)(event, mockVerifier)).rejects.toThrow(auth_1.AuthenticationError);
        });
        it('should handle case-insensitive Authorization header', async () => {
            const token = createTestToken();
            const event = createMockEvent({
                headers: { authorization: `Bearer ${token}` },
            });
            const context = await (0, auth_1.authenticate)(event, mockVerifier);
            expect(context.isAuthenticated).toBe(true);
        });
        it('should include request metadata in auth context', async () => {
            const token = createTestToken();
            const event = createMockEvent({
                headers: {
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'Custom-Agent/1.0',
                },
                requestContext: {
                    ...createMockEvent().requestContext,
                    requestId: 'unique-request-id-xyz',
                    identity: {
                        ...createMockEvent().requestContext.identity,
                        sourceIp: '10.0.0.50',
                    },
                },
            });
            const context = await (0, auth_1.authenticate)(event, mockVerifier);
            expect(context.requestId).toBe('unique-request-id-xyz');
            expect(context.sourceIp).toBe('10.0.0.50');
            expect(context.userAgent).toBe('Custom-Agent/1.0');
        });
    });
});
/**
 * Test Suite: Authorization Integration
 * Validates: Requirements 8.3 - Role-based access control for all endpoints
 */
describe('Authorization Integration', () => {
    let mockVerifier;
    beforeEach(() => {
        mockVerifier = (0, auth_1.createMockVerifier)();
    });
    describe('Role-Based Access Control', () => {
        it('should allow ADMIN role to access all endpoints', async () => {
            const token = createTestToken({ 'cognito:groups': ['ADMIN'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'DELETE',
                path: '/api/v1/assets/123',
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ success: true }),
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_DELETE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should allow ASSET_MANAGER to perform asset CRUD operations', async () => {
            const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'POST',
                path: '/api/v1/assets',
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 201,
                body: JSON.stringify({ id: 'new-asset-id' }),
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_CREATE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(201);
            expect(handler).toHaveBeenCalled();
        });
        it('should deny VIEWER role from modifying assets', async () => {
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'PUT',
                path: '/api/v1/assets/123',
            });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_UPDATE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(403);
            expect(handler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.FORBIDDEN);
        });
        it('should allow INVENTORY_MANAGER to update inventory', async () => {
            const token = createTestToken({ 'cognito:groups': ['INVENTORY_MANAGER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'PUT',
                path: '/api/v1/stockrooms/123/inventory',
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ updated: true }),
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.INVENTORY_UPDATE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should deny INVENTORY_MANAGER from managing software', async () => {
            const token = createTestToken({ 'cognito:groups': ['INVENTORY_MANAGER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'POST',
                path: '/api/v1/software/reconciliation',
            });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.SOFTWARE_MANAGE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(403);
            expect(handler).not.toHaveBeenCalled();
        });
        it('should support multiple roles with combined permissions', async () => {
            const token = createTestToken({
                'cognito:groups': ['ASSET_MANAGER', 'SOFTWARE_MANAGER'],
            });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                httpMethod: 'POST',
                path: '/api/v1/software/reclamation',
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ success: true }),
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.SOFTWARE_MANAGE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should return 401 for unauthenticated requests', async () => {
            const event = createMockEvent({ headers: {} });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_READ],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(401);
            expect(handler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.UNAUTHORIZED);
        });
    });
});
/**
 * Test Suite: Request Validation Integration
 * Validates: Requirements 8.5 - Validate request payload against OpenAPI schema
 */
describe('Request Validation Integration', () => {
    describe('Body Validation', () => {
        const assetCreateSchema = {
            type: 'object',
            required: ['displayName', 'assetType'],
            properties: {
                displayName: { type: 'string', minLength: 1, maxLength: 255 },
                assetType: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'] },
                description: { type: 'string', maxLength: 1000 },
                serialNumber: { type: 'string', pattern: '^[A-Z0-9-]+$' },
                purchasePrice: { type: 'number', minimum: 0 },
            },
            additionalProperties: false,
        };
        it('should accept valid asset creation request', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    displayName: 'Dell Laptop XPS 15',
                    assetType: 'HARDWARE',
                    description: 'Developer workstation',
                    serialNumber: 'DELL-XPS-2024-001',
                    purchasePrice: 1599.99,
                }),
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 201,
                body: JSON.stringify({ id: 'new-asset-id' }),
            });
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(201);
            expect(handler).toHaveBeenCalled();
        });
        it('should reject request with missing required fields', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    description: 'Missing required fields',
                }),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.VALIDATION_ERROR);
            expect(body.error.details).toHaveLength(2);
            expect(body.error.details.map((d) => d.field)).toContain('displayName');
            expect(body.error.details.map((d) => d.field)).toContain('assetType');
        });
        it('should reject request with invalid enum value', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    displayName: 'Test Asset',
                    assetType: 'INVALID_TYPE',
                }),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.details[0].field).toBe('assetType');
        });
        it('should reject request with invalid pattern', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    displayName: 'Test Asset',
                    assetType: 'HARDWARE',
                    serialNumber: 'invalid serial with spaces!',
                }),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
        it('should reject request with invalid JSON body', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: 'not valid json {{{',
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.details[0].code).toBe('INVALID_JSON');
        });
        it('should reject request with additional properties when not allowed', async () => {
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    displayName: 'Test Asset',
                    assetType: 'HARDWARE',
                    unknownField: 'should not be here',
                }),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ body: assetCreateSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
    });
    describe('Path Parameter Validation', () => {
        const pathSchema = {
            type: 'object',
            required: ['assetId'],
            properties: {
                assetId: { type: 'string', format: 'uuid' },
            },
        };
        it('should accept valid UUID path parameter', async () => {
            const event = createMockEvent({
                httpMethod: 'GET',
                path: '/api/v1/assets/550e8400-e29b-41d4-a716-446655440000',
                pathParameters: { assetId: '550e8400-e29b-41d4-a716-446655440000' },
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000' }),
            });
            const wrappedHandler = (0, validation_1.withValidation)({ pathParameters: pathSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should reject invalid UUID path parameter', async () => {
            const event = createMockEvent({
                httpMethod: 'GET',
                path: '/api/v1/assets/not-a-valid-uuid',
                pathParameters: { assetId: 'not-a-valid-uuid' },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ pathParameters: pathSchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
    });
    describe('Query Parameter Validation', () => {
        const querySchema = {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['ORDERED', 'RECEIVED', 'IN_STOCK', 'DEPLOYED', 'RETIRED'] },
                assetType: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'] },
                minPrice: { type: 'number', minimum: 0 },
                maxPrice: { type: 'number', minimum: 0 },
            },
        };
        it('should accept valid query parameters', async () => {
            const event = createMockEvent({
                httpMethod: 'GET',
                queryStringParameters: {
                    status: 'DEPLOYED',
                    assetType: 'HARDWARE',
                    minPrice: '100',
                    maxPrice: '5000',
                },
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ data: [] }),
            });
            const wrappedHandler = (0, validation_1.withValidation)({ queryStringParameters: querySchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should reject invalid enum query parameter', async () => {
            const event = createMockEvent({
                httpMethod: 'GET',
                queryStringParameters: {
                    status: 'INVALID_STATUS',
                },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)({ queryStringParameters: querySchema })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
/**
 * Test Suite: Error Response Integration
 * Validates: Requirements 8.6 - Standardized error responses with error codes
 */
describe('Error Response Integration', () => {
    describe('Standardized Error Format', () => {
        it('should return standardized error response for validation errors', async () => {
            const schema = {
                body: {
                    type: 'object',
                    required: ['name'],
                    properties: { name: { type: 'string' } },
                },
            };
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({}),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)(schema)(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            // Verify standardized error structure
            expect(body).toHaveProperty('error');
            expect(body.error).toHaveProperty('code');
            expect(body.error).toHaveProperty('message');
            expect(body.error).toHaveProperty('requestId');
            expect(body.error).toHaveProperty('timestamp');
            expect(body.error).toHaveProperty('details');
            // Verify error code
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.VALIDATION_ERROR);
            // Verify request ID is included
            expect(body.error.requestId).toBe('test-request-id-12345');
            // Verify timestamp is ISO format
            expect(new Date(body.error.timestamp).toISOString()).toBe(body.error.timestamp);
        });
        it('should return standardized error response for authentication errors', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const event = createMockEvent({ headers: {} });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier)(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.UNAUTHORIZED);
            expect(body.error).toHaveProperty('message');
            expect(body.error).toHaveProperty('requestId');
            expect(body.error).toHaveProperty('timestamp');
        });
        it('should return standardized error response for authorization errors', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ADMIN_USERS],
            })(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.FORBIDDEN);
            expect(body.error).toHaveProperty('message');
            expect(body.error).toHaveProperty('requestId');
        });
        it('should include validation error details with field and code', async () => {
            const schema = {
                body: {
                    type: 'object',
                    required: ['email', 'age'],
                    properties: {
                        email: { type: 'string', format: 'email' },
                        age: { type: 'integer', minimum: 18 },
                    },
                },
            };
            const event = createMockEvent({
                httpMethod: 'POST',
                body: JSON.stringify({
                    email: 'invalid-email',
                    age: 15,
                }),
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)(schema)(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            expect(body.error.details).toBeInstanceOf(Array);
            expect(body.error.details.length).toBeGreaterThan(0);
            body.error.details.forEach((detail) => {
                expect(detail).toHaveProperty('field');
                expect(detail).toHaveProperty('message');
                expect(detail).toHaveProperty('code');
            });
        });
    });
    describe('HTTP Status Codes', () => {
        it('should return 400 for validation errors', async () => {
            const schema = {
                body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
            };
            const event = createMockEvent({ httpMethod: 'POST', body: '{}' });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)(schema)(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(types_1.HTTP_STATUS.BAD_REQUEST);
        });
        it('should return 401 for authentication errors', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const event = createMockEvent({ headers: {} });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier)(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(types_1.HTTP_STATUS.UNAUTHORIZED);
        });
        it('should return 403 for authorization errors', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ADMIN_USERS],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(types_1.HTTP_STATUS.FORBIDDEN);
        });
    });
});
/**
 * Test Suite: Pagination Integration
 * Validates: Requirements 8.7 - Pagination, filtering, and sorting for collection endpoints
 */
describe('Pagination Integration', () => {
    const paginationOptions = {
        defaultLimit: 20,
        maxLimit: 100,
        defaultSortField: 'createdAt',
        defaultSortDirection: 'desc',
        allowedSortFields: ['createdAt', 'displayName', 'status', 'purchasePrice'],
        allowedFilterFields: ['status', 'assetType', 'assignedTo'],
    };
    describe('Page-Based Pagination', () => {
        it('should parse valid page and limit parameters', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    page: '2',
                    limit: '25',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(true);
            expect(result.pagination.mode).toBe('page');
            if (result.pagination.mode === 'page') {
                expect(result.pagination.page).toBe(2);
                expect(result.pagination.limit).toBe(25);
            }
        });
        it('should use default values when parameters not provided', () => {
            const event = createMockEvent({
                queryStringParameters: null,
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(true);
            if (result.pagination.mode === 'page') {
                expect(result.pagination.page).toBe(1);
                expect(result.pagination.limit).toBe(20);
            }
        });
        it('should cap limit at maxLimit', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    limit: '500',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(true);
            expect(result.pagination.limit).toBe(100);
        });
        it('should reject invalid page number', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    page: '-1',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.field === 'page')).toBe(true);
        });
    });
    describe('Cursor-Based Pagination', () => {
        it('should parse valid cursor parameter', () => {
            // Create a valid cursor (base64url encoded JSON with correct structure)
            const cursorData = {
                lastId: 'asset-123',
                sortValues: { createdAt: '2024-01-15T10:00:00Z' },
                createdAt: new Date().toISOString(),
            };
            const cursor = Buffer.from(JSON.stringify(cursorData)).toString('base64url');
            const event = createMockEvent({
                queryStringParameters: {
                    cursor,
                    limit: '20',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.pagination.mode).toBe('cursor');
            if (result.pagination.mode === 'cursor') {
                expect(result.pagination.cursor).toBe(cursor);
            }
        });
        it('should reject invalid cursor format', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    cursor: 'not-a-valid-cursor',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.errors.some(e => e.field === 'cursor')).toBe(true);
        });
    });
    describe('Sorting', () => {
        it('should parse valid sort parameter', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    sort: 'displayName',
                    sortDirection: 'asc',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(true);
            expect(result.sort.sorts[0]?.field).toBe('displayName');
            expect(result.sort.sorts[0]?.direction).toBe('asc');
        });
        it('should use default sort when not provided', () => {
            const event = createMockEvent({
                queryStringParameters: null,
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.sort.sorts[0]?.field).toBe('createdAt');
            expect(result.sort.sorts[0]?.direction).toBe('desc');
        });
        it('should reject sort on disallowed field', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    sort: 'secretField',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.errors.some(e => e.field === 'sort')).toBe(true);
        });
        it('should support multiple sort fields', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    sort: 'status:asc,createdAt:desc',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.sort.sorts.length).toBe(2);
            expect(result.sort.sorts[0]?.field).toBe('status');
            expect(result.sort.sorts[0]?.direction).toBe('asc');
            expect(result.sort.sorts[1]?.field).toBe('createdAt');
            expect(result.sort.sorts[1]?.direction).toBe('desc');
        });
    });
    describe('Filtering', () => {
        it('should parse valid filter parameters', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    filter: 'status:eq:DEPLOYED,assetType:eq:HARDWARE',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.isValid).toBe(true);
            expect(result.filter.filters.length).toBe(2);
        });
        it('should reject filter on disallowed field', () => {
            const event = createMockEvent({
                queryStringParameters: {
                    filter: 'secretField:eq:value',
                },
            });
            const result = (0, pagination_1.parseListQueryParams)(event.queryStringParameters, paginationOptions);
            expect(result.errors.some(e => e.field === 'filter')).toBe(true);
        });
    });
    describe('Pagination Middleware', () => {
        it('should pass parsed pagination to handler', async () => {
            const event = createMockEvent({
                queryStringParameters: {
                    page: '3',
                    limit: '15',
                    sort: 'displayName:asc',
                },
            });
            let capturedRequest = null;
            const handler = jest.fn().mockImplementation((_event, paginationRequest) => {
                capturedRequest = paginationRequest;
                return {
                    data: [],
                    pagination: {
                        total: 0,
                        page: 3,
                        limit: 15,
                        hasMore: false,
                    },
                };
            });
            const wrappedHandler = (0, pagination_1.withPagination)(paginationOptions)(handler);
            await wrappedHandler(event);
            expect(handler).toHaveBeenCalled();
            expect(capturedRequest).not.toBeNull();
        });
        it('should return 400 for invalid pagination parameters', async () => {
            const event = createMockEvent({
                queryStringParameters: {
                    page: 'invalid',
                },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, pagination_1.withPagination)(paginationOptions)(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(handler).not.toHaveBeenCalled();
        });
    });
});
/**
 * Test Suite: Request Tracing Integration
 * Validates: Requirements 8.9 - Request tracing headers for debugging
 */
describe('Request Tracing Integration', () => {
    describe('Request ID Propagation', () => {
        it('should include request ID in successful responses', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const token = createTestToken();
            const event = createMockEvent({
                headers: { Authorization: `Bearer ${token}` },
                requestContext: {
                    ...createMockEvent().requestContext,
                    requestId: 'trace-id-abc-123',
                },
            });
            const handler = jest.fn().mockImplementation((_event, authContext) => {
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.OK, (0, types_1.createApiResponse)({ message: 'success' }, authContext.requestId));
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier)(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            expect(body.meta.requestId).toBe('trace-id-abc-123');
        });
        it('should include request ID in error responses', async () => {
            const schema = {
                body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
            };
            const event = createMockEvent({
                httpMethod: 'POST',
                body: '{}',
                requestContext: {
                    ...createMockEvent().requestContext,
                    requestId: 'error-trace-id-xyz',
                },
            });
            const handler = jest.fn();
            const wrappedHandler = (0, validation_1.withValidation)(schema)(handler);
            const result = await wrappedHandler(event);
            const body = JSON.parse(result.body);
            expect(body.error.requestId).toBe('error-trace-id-xyz');
        });
        it('should include CORS headers in responses', async () => {
            const response = (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.OK, { data: 'test' });
            expect(response.headers).toHaveProperty('Access-Control-Allow-Origin');
            expect(response.headers).toHaveProperty('Access-Control-Allow-Headers');
            expect(response.headers?.['Content-Type']).toBe('application/json');
        });
    });
    describe('Auth Context Propagation', () => {
        it('should pass complete auth context to handlers', async () => {
            const mockVerifier = (0, auth_1.createMockVerifier)();
            const token = createTestToken({
                sub: 'user-trace-test',
                email: 'trace@example.com',
                'cognito:groups': ['ASSET_MANAGER'],
            });
            const event = createMockEvent({
                headers: {
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'TraceTest/1.0',
                },
                requestContext: {
                    ...createMockEvent().requestContext,
                    requestId: 'context-trace-id',
                    identity: {
                        ...createMockEvent().requestContext.identity,
                        sourceIp: '10.20.30.40',
                    },
                },
            });
            let capturedContext = null;
            const handler = jest.fn().mockImplementation((_event, context) => {
                capturedContext = context;
                return { statusCode: 200, body: '{}' };
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier)(handler);
            await wrappedHandler(event);
            expect(capturedContext).not.toBeNull();
            expect(capturedContext.requestId).toBe('context-trace-id');
            expect(capturedContext.sourceIp).toBe('10.20.30.40');
            expect(capturedContext.userAgent).toBe('TraceTest/1.0');
            expect(capturedContext.user.sub).toBe('user-trace-test');
            expect(capturedContext.user.email).toBe('trace@example.com');
        });
    });
});
/**
 * Test Suite: Middleware Chain Integration
 * Validates: Requirements 8.1-8.9 - Complete middleware chain working together
 */
describe('Middleware Chain Integration', () => {
    let mockVerifier;
    beforeEach(() => {
        mockVerifier = (0, auth_1.createMockVerifier)();
    });
    describe('Combined Auth + Validation + Pagination', () => {
        const bodySchema = {
            type: 'object',
            required: ['displayName', 'assetType'],
            properties: {
                displayName: { type: 'string', minLength: 1 },
                assetType: { type: 'string', enum: ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'] },
            },
        };
        it('should process request through complete middleware chain', async () => {
            const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
            const event = createMockEvent({
                httpMethod: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    displayName: 'New Laptop',
                    assetType: 'HARDWARE',
                }),
            });
            let handlerCalled = false;
            let receivedAuthContext = null;
            // Create handler that uses both auth and validation
            const baseHandler = jest.fn().mockImplementation((_event, authContext) => {
                handlerCalled = true;
                receivedAuthContext = authContext;
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.CREATED, (0, types_1.createApiResponse)({ id: 'new-asset-123' }, authContext.requestId));
            });
            // Apply validation first, then auth
            const validatedHandler = (0, validation_1.withValidation)({ body: bodySchema })(async (event) => {
                // After validation passes, apply auth
                const authHandler = (0, auth_1.withAuth)(mockVerifier, {
                    requiredPermissions: [auth_1.PERMISSIONS.ASSET_CREATE],
                })(baseHandler);
                return authHandler(event);
            });
            const result = await validatedHandler(event);
            expect(result.statusCode).toBe(201);
            expect(handlerCalled).toBe(true);
            expect(receivedAuthContext).not.toBeNull();
            expect(receivedAuthContext.user.roles).toContain(auth_1.ROLES.ASSET_MANAGER);
        });
        it('should fail at validation before reaching auth', async () => {
            const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
            const event = createMockEvent({
                httpMethod: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    // Missing required fields
                    description: 'Invalid request',
                }),
            });
            const baseHandler = jest.fn();
            const validatedHandler = (0, validation_1.withValidation)({ body: bodySchema })(baseHandler);
            const result = await validatedHandler(event);
            expect(result.statusCode).toBe(400);
            expect(baseHandler).not.toHaveBeenCalled();
            const body = JSON.parse(result.body);
            expect(body.error.code).toBe(types_1.API_ERROR_CODES.VALIDATION_ERROR);
        });
        it('should fail at auth after validation passes', async () => {
            // No auth token
            const event = createMockEvent({
                httpMethod: 'POST',
                headers: {},
                body: JSON.stringify({
                    displayName: 'Valid Asset',
                    assetType: 'HARDWARE',
                }),
            });
            const baseHandler = jest.fn();
            const validatedHandler = (0, validation_1.withValidation)({ body: bodySchema })(async (event) => {
                const authHandler = (0, auth_1.withAuth)(mockVerifier, {
                    requiredPermissions: [auth_1.PERMISSIONS.ASSET_CREATE],
                })(baseHandler);
                return authHandler(event);
            });
            const result = await validatedHandler(event);
            expect(result.statusCode).toBe(401);
            expect(baseHandler).not.toHaveBeenCalled();
        });
        it('should fail at authorization after auth passes', async () => {
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] }); // VIEWER can't create
            const event = createMockEvent({
                httpMethod: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    displayName: 'Valid Asset',
                    assetType: 'HARDWARE',
                }),
            });
            const baseHandler = jest.fn();
            const validatedHandler = (0, validation_1.withValidation)({ body: bodySchema })(async (event) => {
                const authHandler = (0, auth_1.withAuth)(mockVerifier, {
                    requiredPermissions: [auth_1.PERMISSIONS.ASSET_CREATE],
                })(baseHandler);
                return authHandler(event);
            });
            const result = await validatedHandler(event);
            expect(result.statusCode).toBe(403);
            expect(baseHandler).not.toHaveBeenCalled();
        });
    });
    describe('RESTful Endpoint Patterns', () => {
        /**
         * Validates: Requirement 8.1 - RESTful endpoints with consistent resource naming
         */
        it('should handle GET /assets (list) with pagination', async () => {
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
            const event = createMockEvent({
                httpMethod: 'GET',
                path: '/api/v1/assets',
                headers: { Authorization: `Bearer ${token}` },
                queryStringParameters: {
                    page: '1',
                    limit: '20',
                    sort: 'createdAt:desc',
                    filter: 'status:eq:DEPLOYED',
                },
            });
            const handler = jest.fn().mockImplementation((_event, authContext) => {
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.OK, {
                    data: [],
                    pagination: { total: 0, page: 1, limit: 20, hasMore: false },
                    meta: { requestId: authContext.requestId, timestamp: new Date().toISOString() },
                });
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_READ],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
            expect(handler).toHaveBeenCalled();
        });
        it('should handle GET /assets/:id (single resource)', async () => {
            const token = createTestToken({ 'cognito:groups': ['VIEWER'] });
            const assetId = '550e8400-e29b-41d4-a716-446655440000';
            const event = createMockEvent({
                httpMethod: 'GET',
                path: `/api/v1/assets/${assetId}`,
                headers: { Authorization: `Bearer ${token}` },
                pathParameters: { assetId },
            });
            const pathSchema = {
                type: 'object',
                required: ['assetId'],
                properties: { assetId: { type: 'string', format: 'uuid' } },
            };
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ data: { id: assetId, displayName: 'Test Asset' } }),
            });
            const validatedHandler = (0, validation_1.withValidation)({ pathParameters: pathSchema })(async (event) => {
                const authHandler = (0, auth_1.withAuth)(mockVerifier, {
                    requiredPermissions: [auth_1.PERMISSIONS.ASSET_READ],
                })(handler);
                return authHandler(event);
            });
            const result = await validatedHandler(event);
            expect(result.statusCode).toBe(200);
        });
        it('should handle POST /assets (create)', async () => {
            const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
            const event = createMockEvent({
                httpMethod: 'POST',
                path: '/api/v1/assets',
                headers: { Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                    displayName: 'New Server',
                    assetType: 'HARDWARE',
                    serialNumber: 'SRV-2024-001',
                }),
            });
            const handler = jest.fn().mockImplementation((_event, authContext) => {
                return (0, types_1.createLambdaResponse)(types_1.HTTP_STATUS.CREATED, {
                    data: { id: 'new-id', displayName: 'New Server' },
                    meta: { requestId: authContext.requestId, timestamp: new Date().toISOString() },
                });
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_CREATE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(201);
        });
        it('should handle PUT /assets/:id (update)', async () => {
            const token = createTestToken({ 'cognito:groups': ['ASSET_MANAGER'] });
            const assetId = '550e8400-e29b-41d4-a716-446655440000';
            const event = createMockEvent({
                httpMethod: 'PUT',
                path: `/api/v1/assets/${assetId}`,
                headers: { Authorization: `Bearer ${token}` },
                pathParameters: { assetId },
                body: JSON.stringify({
                    displayName: 'Updated Server Name',
                }),
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 200,
                body: JSON.stringify({ data: { id: assetId, displayName: 'Updated Server Name' } }),
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_UPDATE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(200);
        });
        it('should handle DELETE /assets/:id (delete)', async () => {
            const token = createTestToken({ 'cognito:groups': ['ADMIN'] });
            const assetId = '550e8400-e29b-41d4-a716-446655440000';
            const event = createMockEvent({
                httpMethod: 'DELETE',
                path: `/api/v1/assets/${assetId}`,
                headers: { Authorization: `Bearer ${token}` },
                pathParameters: { assetId },
            });
            const handler = jest.fn().mockResolvedValue({
                statusCode: 204,
                body: '',
            });
            const wrappedHandler = (0, auth_1.withAuth)(mockVerifier, {
                requiredPermissions: [auth_1.PERMISSIONS.ASSET_DELETE],
            })(handler);
            const result = await wrappedHandler(event);
            expect(result.statusCode).toBe(204);
        });
    });
});
//# sourceMappingURL=api-integration.test.js.map