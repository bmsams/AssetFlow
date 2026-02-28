/**
 * Asset Service Handler Unit Tests
 *
 * Tests for Lambda handlers
 * Validates Requirements: 2.1, 2.6, 2.7
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock all dependencies before importing handlers
jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    query: jest.fn(),
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getOrSet: jest.fn((_key, fn) => fn()),
  invalidate: jest.fn(),
  DEFAULT_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
  CACHE_ENTITY_TYPES: { ASSET: 'asset' },
  entityKey: jest.fn((type, id) => `${type}:${id}`),
  assetByTagKey: jest.fn((tag) => `asset:tag:${tag}`),
  assetsByStockroomKey: jest.fn((id) => `asset:stockroom:${id}`),
}));

jest.mock('@ams/events', () => ({
  publishAssetCreated: jest.fn().mockResolvedValue('event-id'),
  publishAssetUpdated: jest.fn().mockResolvedValue('event-id'),
  publishAssetDeleted: jest.fn().mockResolvedValue('event-id'),
  publishAssetStateChanged: jest.fn().mockResolvedValue('event-id'),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  generateAssetTag: jest.fn(() => 'AMS-HW-20240115-ABC123'),
  now: jest.fn(() => '2024-01-15T10:00:00.000Z'),
  validateUUID: jest.fn((uuid) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      return { message: 'Invalid UUID format' };
    }
    return null;
  }),
  validate: jest.fn(() => ({
    required: jest.fn().mockReturnThis(),
    enum: jest.fn().mockReturnThis(),
    stringLength: jest.fn().mockReturnThis(),
    result: jest.fn(() => ({ isValid: true, errors: [] })),
  })),
}));

jest.mock('@ams/types', () => ({
  API_ERROR_CODES: {
    BAD_REQUEST: 'BAD_REQUEST',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
  createApiResponse: jest.fn((data, requestId) => ({
    success: true,
    data,
    requestId,
  })),
  createErrorResponse: jest.fn((code, message, requestId, errors) => ({
    success: false,
    error: { code, message, errors },
    requestId,
  })),
  createLambdaResponse: jest.fn((statusCode, body) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : '',
  })),
}));

// Import handlers after mocks are set up
import { handler as createAssetHandler } from '../handlers/create-asset';
import { handler as getAssetHandler } from '../handlers/get-asset';
import { handler as updateAssetHandler } from '../handlers/update-asset';
import { handler as deleteAssetHandler } from '../handlers/delete-asset';

// Mock the asset service module
jest.mock('../service/asset-service', () => ({
  createAsset: jest.fn(),
  getAsset: jest.fn(),
  updateAsset: jest.fn(),
  deleteAsset: jest.fn(),
  isValidStateTransition: jest.fn(),
}));

import * as assetService from '../service/asset-service';

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/assets',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: 'user-123',
        },
      },
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
      path: '/assets',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/assets',
    },
    resource: '/assets',
    ...overrides,
  };
}

describe('Create Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.1, 2.6
   */
  it('should create an asset successfully', async () => {
    const mockAsset = {
      assetId: '550e8400-e29b-41d4-a716-446655440000',
      assetTag: 'AMS-HW-20240115-ABC123',
      assetType: 'HARDWARE',
      displayName: 'Test Laptop',
      status: 'ORDERED',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    (assetService.createAsset as jest.Mock).mockResolvedValue(mockAsset);

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
      }),
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(201);
    expect(assetService.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
      }),
      'user-123'
    );
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: 'invalid json',
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for missing body', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: null,
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });
});

describe('Get Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.1
   */
  it('should get an asset successfully', async () => {
    const mockAsset = {
      assetId: '550e8400-e29b-41d4-a716-446655440000',
      assetTag: 'AMS-HW-20240115-ABC123',
      assetType: 'HARDWARE',
      displayName: 'Test Laptop',
      status: 'ORDERED',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    (assetService.getAsset as jest.Mock).mockResolvedValue(mockAsset);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    const result = await getAssetHandler(event);

    expect(result.statusCode).toBe(200);
    expect(assetService.getAsset).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should return 404 for non-existent asset', async () => {
    (assetService.getAsset as jest.Mock).mockResolvedValue(null);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    const result = await getAssetHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 400 for missing asset ID', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: null,
    });

    const result = await getAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid UUID format', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: 'invalid-uuid',
      },
    });

    const result = await getAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });
});

describe('Update Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.1, 2.7
   */
  it('should update an asset successfully', async () => {
    const mockAsset = {
      assetId: '550e8400-e29b-41d4-a716-446655440000',
      assetTag: 'AMS-HW-20240115-ABC123',
      assetType: 'HARDWARE',
      displayName: 'Updated Laptop',
      status: 'ORDERED',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T11:00:00.000Z',
    };

    (assetService.updateAsset as jest.Mock).mockResolvedValue(mockAsset);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({
        displayName: 'Updated Laptop',
      }),
    });

    const result = await updateAssetHandler(event);

    expect(result.statusCode).toBe(200);
    expect(assetService.updateAsset).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        displayName: 'Updated Laptop',
      }),
      'user-123'
    );
  });

  it('should return 404 for non-existent asset', async () => {
    (assetService.updateAsset as jest.Mock).mockResolvedValue(null);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
      body: JSON.stringify({
        displayName: 'Updated Laptop',
      }),
    });

    const result = await updateAssetHandler(event);

    expect(result.statusCode).toBe(404);
  });
});

describe('Delete Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.1, 2.7
   */
  it('should delete an asset successfully', async () => {
    (assetService.deleteAsset as jest.Mock).mockResolvedValue(true);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    const result = await deleteAssetHandler(event);

    expect(result.statusCode).toBe(204);
    expect(assetService.deleteAsset).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'user-123'
    );
  });

  it('should return 404 for non-existent asset', async () => {
    (assetService.deleteAsset as jest.Mock).mockResolvedValue(false);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
      },
    });

    const result = await deleteAssetHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 400 for missing asset ID', async () => {
    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: null,
    });

    const result = await deleteAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });
});
