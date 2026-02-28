/**
 * Asset Relationship Handler Unit Tests
 *
 * Tests for Lambda handlers: linkAssets, unlinkAssets, getRelatedAssets
 * Validates Requirements: 2.3, 2.9
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock all dependencies before importing handlers
jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
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
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
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
  VALID_RELATIONSHIP_TYPES: [
    'PARENT_CHILD',
    'DEPENDENCY',
    'CONNECTED_TO',
    'INSTALLED_ON',
    'RUNS_ON',
    'LOCATION',
    'COMPONENT',
  ],
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

// Mock the relationship service module
jest.mock('../service/relationship-service', () => ({
  linkAssets: jest.fn(),
  unlinkAssets: jest.fn(),
  getRelatedAssets: jest.fn(),
  ReferentialIntegrityError: class ReferentialIntegrityError extends Error {
    assetId: string;
    reason: string;
    constructor(assetId: string, reason: string) {
      super(`Referential integrity violation for asset ${assetId}: ${reason}`);
      this.name = 'ReferentialIntegrityError';
      this.assetId = assetId;
      this.reason = reason;
    }
  },
  DuplicateRelationshipError: class DuplicateRelationshipError extends Error {
    sourceAssetId: string;
    targetAssetId: string;
    relationType: string;
    constructor(sourceAssetId: string, targetAssetId: string, relationType: string) {
      super(`Relationship already exists: ${sourceAssetId} -> ${targetAssetId} (${relationType})`);
      this.name = 'DuplicateRelationshipError';
      this.sourceAssetId = sourceAssetId;
      this.targetAssetId = targetAssetId;
      this.relationType = relationType;
    }
  },
  CircularDependencyError: class CircularDependencyError extends Error {
    sourceAssetId: string;
    targetAssetId: string;
    relationType: string;
    constructor(sourceAssetId: string, targetAssetId: string, relationType: string) {
      super(`Creating relationship would create a circular dependency`);
      this.name = 'CircularDependencyError';
      this.sourceAssetId = sourceAssetId;
      this.targetAssetId = targetAssetId;
      this.relationType = relationType;
    }
  },
}));

// Import handlers after mocks are set up
import { handler as linkAssetsHandler } from '../handlers/link-assets';
import { handler as unlinkAssetsHandler } from '../handlers/unlink-assets';
import { handler as getRelatedAssetsHandler } from '../handlers/get-related-assets';

import * as relationshipService from '../service/relationship-service';

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
    path: '/assets/relationships',
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
      path: '/assets/relationships',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/assets/relationships',
    },
    resource: '/assets/relationships',
    ...overrides,
  };
}

// Test UUIDs
const SOURCE_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
const TARGET_ASSET_ID = '550e8400-e29b-41d4-a716-446655440002';
const RELATIONSHIP_ID = '550e8400-e29b-41d4-a716-446655440003';

describe('Link Assets Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.3, 2.9
   */
  it('should create a relationship successfully', async () => {
    const mockRelationship = {
      relationshipId: RELATIONSHIP_ID,
      sourceAssetId: SOURCE_ASSET_ID,
      targetAssetId: TARGET_ASSET_ID,
      relationType: 'PARENT_CHILD',
      createdAt: '2024-01-15T10:00:00.000Z',
      createdBy: 'user-123',
    };

    (relationshipService.linkAssets as jest.Mock).mockResolvedValue(mockRelationship);

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(201);
    expect(relationshipService.linkAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
      'user-123'
    );
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: 'invalid json',
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for missing required fields', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        // missing targetAssetId and relationType
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid UUID format', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: 'invalid-uuid',
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  /**
   * Validates: Requirement 2.9 (referential integrity)
   */
  it('should return 404 when source asset does not exist', async () => {
    const error = new (relationshipService.ReferentialIntegrityError as unknown as new (assetId: string, reason: string) => Error)(
      SOURCE_ASSET_ID,
      'Source asset does not exist'
    );
    (relationshipService.linkAssets as jest.Mock).mockRejectedValue(error);

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 409 when relationship already exists', async () => {
    const error = new (relationshipService.DuplicateRelationshipError as unknown as new (s: string, t: string, r: string) => Error)(
      SOURCE_ASSET_ID,
      TARGET_ASSET_ID,
      'PARENT_CHILD'
    );
    (relationshipService.linkAssets as jest.Mock).mockRejectedValue(error);

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(409);
  });

  it('should return 409 when circular dependency would be created', async () => {
    const error = new (relationshipService.CircularDependencyError as unknown as new (s: string, t: string, r: string) => Error)(
      SOURCE_ASSET_ID,
      TARGET_ASSET_ID,
      'PARENT_CHILD'
    );
    (relationshipService.linkAssets as jest.Mock).mockRejectedValue(error);

    const event = createMockEvent({
      httpMethod: 'POST',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await linkAssetsHandler(event);

    expect(result.statusCode).toBe(409);
  });
});

describe('Unlink Assets Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.3
   */
  it('should delete a relationship successfully', async () => {
    (relationshipService.unlinkAssets as jest.Mock).mockResolvedValue(true);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await unlinkAssetsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(relationshipService.unlinkAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      })
    );
  });

  it('should delete all relationships between assets when relationType not specified', async () => {
    (relationshipService.unlinkAssets as jest.Mock).mockResolvedValue(true);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
      }),
    });

    const result = await unlinkAssetsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(relationshipService.unlinkAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: undefined,
      })
    );
  });

  it('should return 404 when relationship does not exist', async () => {
    (relationshipService.unlinkAssets as jest.Mock).mockResolvedValue(false);

    const event = createMockEvent({
      httpMethod: 'DELETE',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        targetAssetId: TARGET_ASSET_ID,
        relationType: 'PARENT_CHILD',
      }),
    });

    const result = await unlinkAssetsHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      httpMethod: 'DELETE',
      body: 'invalid json',
    });

    const result = await unlinkAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for missing required fields', async () => {
    const event = createMockEvent({
      httpMethod: 'DELETE',
      body: JSON.stringify({
        sourceAssetId: SOURCE_ASSET_ID,
        // missing targetAssetId
      }),
    });

    const result = await unlinkAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });
});

describe('Get Related Assets Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Validates: Requirements 2.3
   */
  it('should get related assets successfully', async () => {
    const mockRelatedAssets = [
      {
        asset: {
          assetId: TARGET_ASSET_ID,
          assetTag: 'AMS-HW-00000001',
          assetType: 'HARDWARE',
          displayName: 'Related Asset',
          status: 'DEPLOYED',
        },
        relationship: {
          relationshipId: RELATIONSHIP_ID,
          sourceAssetId: SOURCE_ASSET_ID,
          targetAssetId: TARGET_ASSET_ID,
          relationType: 'PARENT_CHILD',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        direction: 'target',
      },
    ];

    (relationshipService.getRelatedAssets as jest.Mock).mockResolvedValue(mockRelatedAssets);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: SOURCE_ASSET_ID,
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(relationshipService.getRelatedAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: SOURCE_ASSET_ID,
      })
    );
  });

  it('should filter by relationType when provided', async () => {
    (relationshipService.getRelatedAssets as jest.Mock).mockResolvedValue([]);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: SOURCE_ASSET_ID,
      },
      queryStringParameters: {
        relationType: 'DEPENDENCY',
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(relationshipService.getRelatedAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: SOURCE_ASSET_ID,
        relationType: 'DEPENDENCY',
      })
    );
  });

  it('should filter by direction when provided', async () => {
    (relationshipService.getRelatedAssets as jest.Mock).mockResolvedValue([]);

    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: SOURCE_ASSET_ID,
      },
      queryStringParameters: {
        direction: 'source',
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(200);
    expect(relationshipService.getRelatedAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: SOURCE_ASSET_ID,
        direction: 'source',
      })
    );
  });

  it('should return 400 for missing asset ID', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: null,
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid UUID format', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: 'invalid-uuid',
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid relationType', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: SOURCE_ASSET_ID,
      },
      queryStringParameters: {
        relationType: 'INVALID_TYPE',
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid direction', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      pathParameters: {
        assetId: SOURCE_ASSET_ID,
      },
      queryStringParameters: {
        direction: 'invalid',
      },
    });

    const result = await getRelatedAssetsHandler(event);

    expect(result.statusCode).toBe(400);
  });
});
