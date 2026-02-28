/**
 * Unit Tests: Cache Invalidation Edge Cases in Write Handlers
 *
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
 *
 * Tests that:
 * - Cache invalidation failure does not cause write handlers to fail
 * - Cache invalidation is NOT called when the write operation fails
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// ============================================================================
// Mock Setup
// ============================================================================

const mockInvalidateAssetComprehensive = jest.fn().mockResolvedValue(5);

jest.mock('@ams/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getOrSet: jest.fn((_key: string, fn: () => unknown) => fn()),
  invalidate: jest.fn(),
  invalidateAssetComprehensive: (...args: unknown[]) => mockInvalidateAssetComprehensive(...args),
  DEFAULT_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
  CACHE_ENTITY_TYPES: { ASSET: 'asset' },
  entityKey: jest.fn((type: string, id: string) => `${type}:${id}`),
  assetByTagKey: jest.fn((tag: string) => `asset:tag:${tag}`),
  assetsByStockroomKey: jest.fn((id: string) => `asset:stockroom:${id}`),
}));

jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn: (client: Record<string, jest.Mock>) => unknown) => fn({
    query: jest.fn(),
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
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
  validateUUID: jest.fn((uuid: string) => {
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
    INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },
  createApiResponse: jest.fn((data: unknown, requestId: string) => ({
    success: true,
    data,
    requestId,
  })),
  createErrorResponse: jest.fn((code: string, message: string, requestId: string, errors?: unknown[]) => ({
    success: false,
    error: { code, message, errors },
    requestId,
  })),
  createLambdaResponse: jest.fn((statusCode: number, body: unknown) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : '',
  })),
}));

jest.mock('../service/asset-service', () => ({
  createAsset: jest.fn(),
  updateAsset: jest.fn(),
  deleteAsset: jest.fn(),
  transitionState: jest.fn(),
  StateTransitionError: class StateTransitionError extends Error {
    currentState: string;
    attemptedState: string;
    validTransitions: string[];
    isTerminalState: boolean;
    constructor(msg: string) {
      super(msg);
      this.currentState = 'ORDERED';
      this.attemptedState = 'DISPOSED';
      this.validTransitions = [];
      this.isTerminalState = false;
    }
  },
}));

import { handler as createAssetHandler } from '../handlers/create-asset';
import { handler as updateAssetHandler } from '../handlers/update-asset';
import { handler as deleteAssetHandler } from '../handlers/delete-asset';
import { handler as transitionStateHandler } from '../handlers/transition-state';
import * as assetService from '../service/asset-service';

// ============================================================================
// Helpers
// ============================================================================

const VALID_ASSET_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockAsset = {
  assetId: VALID_ASSET_ID,
  assetTag: 'AMS-HW-20240115-ABC123',
  assetType: 'HARDWARE',
  displayName: 'Test Asset',
  status: 'ORDERED',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

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
      authorizer: { claims: { sub: 'user-123' } },
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null, accountId: null, apiKey: null, apiKeyId: null,
        caller: null, clientCert: null, cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null, cognitoIdentityId: null,
        cognitoIdentityPoolId: null, principalOrgId: null,
        sourceIp: '127.0.0.1', user: null, userAgent: 'test-agent', userArn: null,
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

// ============================================================================
// Tests: Cache invalidation failure does not fail write handlers (Req 5.5)
// ============================================================================

describe('Cache invalidation failure resilience (Requirement 5.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('create-asset returns success even when cache invalidation throws', async () => {
    (assetService.createAsset as jest.Mock).mockResolvedValue(mockAsset);
    mockInvalidateAssetComprehensive.mockRejectedValue(new Error('Redis connection refused'));

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ assetType: 'HARDWARE', displayName: 'Test Asset' }),
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(201);
    expect(mockInvalidateAssetComprehensive).toHaveBeenCalledWith(VALID_ASSET_ID);
  });

  it('update-asset returns success even when cache invalidation throws', async () => {
    (assetService.updateAsset as jest.Mock).mockResolvedValue(mockAsset);
    mockInvalidateAssetComprehensive.mockRejectedValue(new Error('Redis timeout'));

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { assetId: VALID_ASSET_ID },
      body: JSON.stringify({ displayName: 'Updated Asset' }),
    });

    const result = await updateAssetHandler(event);

    expect(result.statusCode).toBe(200);
    expect(mockInvalidateAssetComprehensive).toHaveBeenCalledWith(VALID_ASSET_ID);
  });

  it('delete-asset returns success even when cache invalidation throws', async () => {
    (assetService.deleteAsset as jest.Mock).mockResolvedValue(true);
    mockInvalidateAssetComprehensive.mockRejectedValue(new Error('Redis cluster down'));

    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: { assetId: VALID_ASSET_ID },
    });

    const result = await deleteAssetHandler(event);

    expect(result.statusCode).toBe(204);
    expect(mockInvalidateAssetComprehensive).toHaveBeenCalledWith(VALID_ASSET_ID);
  });

  it('transition-state returns success even when cache invalidation throws', async () => {
    (assetService.transitionState as jest.Mock).mockResolvedValue({ ...mockAsset, status: 'RECEIVED' });
    mockInvalidateAssetComprehensive.mockRejectedValue(new Error('Redis error'));

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { assetId: VALID_ASSET_ID },
      body: JSON.stringify({ newState: 'RECEIVED' }),
    });

    const result = await transitionStateHandler(event);

    expect(result.statusCode).toBe(200);
    expect(mockInvalidateAssetComprehensive).toHaveBeenCalledWith(VALID_ASSET_ID);
  });
});

// ============================================================================
// Tests: Cache invalidation NOT called when write operation fails
// ============================================================================

describe('Cache invalidation is not called on write failure', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInvalidateAssetComprehensive.mockResolvedValue(5);
  });

  it('create-asset does not invalidate cache on validation error', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: null,
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(400);
    expect(mockInvalidateAssetComprehensive).not.toHaveBeenCalled();
  });

  it('update-asset does not invalidate cache when asset not found', async () => {
    (assetService.updateAsset as jest.Mock).mockResolvedValue(null);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { assetId: VALID_ASSET_ID },
      body: JSON.stringify({ displayName: 'Updated Asset' }),
    });

    const result = await updateAssetHandler(event);

    expect(result.statusCode).toBe(404);
    expect(mockInvalidateAssetComprehensive).not.toHaveBeenCalled();
  });

  it('delete-asset does not invalidate cache when asset not found', async () => {
    (assetService.deleteAsset as jest.Mock).mockResolvedValue(false);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      pathParameters: { assetId: VALID_ASSET_ID },
    });

    const result = await deleteAssetHandler(event);

    expect(result.statusCode).toBe(404);
    expect(mockInvalidateAssetComprehensive).not.toHaveBeenCalled();
  });

  it('create-asset does not invalidate cache on service error', async () => {
    (assetService.createAsset as jest.Mock).mockRejectedValue(new Error('DB connection failed'));

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({ assetType: 'HARDWARE', displayName: 'Test Asset' }),
    });

    const result = await createAssetHandler(event);

    expect(result.statusCode).toBe(500);
    expect(mockInvalidateAssetComprehensive).not.toHaveBeenCalled();
  });

  it('update-asset does not invalidate cache on invalid UUID', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { assetId: 'not-a-uuid' },
      body: JSON.stringify({ displayName: 'Updated Asset' }),
    });

    const result = await updateAssetHandler(event);

    expect(result.statusCode).toBe(400);
    expect(mockInvalidateAssetComprehensive).not.toHaveBeenCalled();
  });
});
