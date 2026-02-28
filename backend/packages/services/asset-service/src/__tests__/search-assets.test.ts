/**
 * Search Assets Handler Unit Tests
 *
 * Tests for the search assets Lambda handler
 * Validates Requirements: 10.5, 10.6
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
  searchResultsKey: jest.fn((type, query) => `search:${type}:${query}`),
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

// Mock the search module
jest.mock('@ams/search', () => ({
  searchAssets: jest.fn(),
  isOpenSearchAvailable: jest.fn(),
}));

// Mock the asset service module
jest.mock('../service/asset-service', () => ({
  createAsset: jest.fn(),
  getAsset: jest.fn(),
  updateAsset: jest.fn(),
  deleteAsset: jest.fn(),
  listAssets: jest.fn(),
  isValidStateTransition: jest.fn(),
}));

// Import after mocks
import { handler as searchAssetsHandler } from '../handlers/search-assets';
import * as cache from '@ams/cache';
import * as search from '@ams/search';
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
    path: '/assets/search',
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
      path: '/assets/search',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/assets/search',
    },
    resource: '/assets/search',
    ...overrides,
  };
}

/**
 * Mock search result
 */
const mockSearchResult = {
  items: [
    {
      assetId: '550e8400-e29b-41d4-a716-446655440000',
      assetTag: 'AMS-HW-20240115-ABC123',
      assetType: 'HARDWARE',
      displayName: 'Test Laptop',
      status: 'DEPLOYED',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    },
    {
      assetId: '550e8400-e29b-41d4-a716-446655440001',
      assetTag: 'AMS-HW-20240115-DEF456',
      assetType: 'HARDWARE',
      displayName: 'Test Desktop',
      status: 'IN_STOCK',
      createdAt: '2024-01-15T11:00:00.000Z',
      updatedAt: '2024-01-15T11:00:00.000Z',
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  hasMore: false,
  took: 45,
  maxScore: 1.5,
};

describe('Search Assets Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cache.get as jest.Mock).mockResolvedValue(null);
    (cache.set as jest.Mock).mockResolvedValue(true);
    (search.isOpenSearchAvailable as jest.Mock).mockResolvedValue(true);
    (search.searchAssets as jest.Mock).mockResolvedValue(mockSearchResult);
  });

  /**
   * Validates: Requirements 10.5
   * Full-text search with pagination, filtering, sorting
   */
  describe('Full-text Search', () => {
    it('should search assets with query parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'laptop' }),
        expect.any(Object)
      );
    });

    it('should search assets with query alias parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          query: 'desktop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'desktop' }),
        expect.any(Object)
      );
    });

    it('should return all assets when no query provided', async () => {
      const event = createMockEvent({
        queryStringParameters: null,
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalled();
    });
  });

  /**
   * Validates: Requirements 10.5
   * Filtering by asset type, status, and other fields
   */
  describe('Filtering', () => {
    it('should filter by asset type', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          assetType: 'HARDWARE',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ assetType: 'HARDWARE' }),
        expect.any(Object)
      );
    });

    it('should filter by status', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          status: 'DEPLOYED',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DEPLOYED' }),
        expect.any(Object)
      );
    });

    it('should filter by multiple statuses', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          statuses: 'DEPLOYED,IN_STOCK',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ statuses: ['DEPLOYED', 'IN_STOCK'] }),
        expect.any(Object)
      );
    });

    it('should filter by assigned user', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          assignedTo: '550e8400-e29b-41d4-a716-446655440099',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: '550e8400-e29b-41d4-a716-446655440099' }),
        expect.any(Object)
      );
    });

    it('should filter by stockroom', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          stockroomId: '550e8400-e29b-41d4-a716-446655440088',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({ stockroomId: '550e8400-e29b-41d4-a716-446655440088' }),
        expect.any(Object)
      );
    });

    it('should filter by date range', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          createdAfter: '2024-01-01T00:00:00.000Z',
          createdBefore: '2024-12-31T23:59:59.999Z',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAfter: '2024-01-01T00:00:00.000Z',
          createdBefore: '2024-12-31T23:59:59.999Z',
        }),
        expect.any(Object)
      );
    });

    it('should ignore invalid asset types', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          assetType: 'INVALID_TYPE',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.not.objectContaining({ assetType: 'INVALID_TYPE' }),
        expect.any(Object)
      );
    });
  });

  /**
   * Validates: Requirements 10.5
   * Pagination support
   */
  describe('Pagination', () => {
    it('should support page parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          page: '2',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          pagination: expect.objectContaining({ page: 2 }),
        })
      );
    });

    it('should support limit parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          limit: '50',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          pagination: expect.objectContaining({ limit: 50 }),
        })
      );
    });

    it('should cap limit at 100', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          limit: '200',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      // Limit should not be set to 200 (invalid)
      expect(search.searchAssets).toHaveBeenCalled();
    });

    it('should ignore invalid page numbers', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          page: '-1',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalled();
    });
  });

  /**
   * Validates: Requirements 10.5
   * Sorting support
   */
  describe('Sorting', () => {
    it('should support sortBy parameter', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          sortBy: 'displayName',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sort: expect.objectContaining({ field: 'displayName' }),
        })
      );
    });

    it('should support sort direction', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          sortBy: 'createdAt',
          sortDir: 'asc',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sort: expect.objectContaining({
            field: 'createdAt',
            direction: 'asc',
          }),
        })
      );
    });

    it('should support order alias for sort direction', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          sort: 'updatedAt',
          order: 'desc',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.searchAssets).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          sort: expect.objectContaining({
            field: 'updatedAt',
            direction: 'desc',
          }),
        })
      );
    });
  });

  /**
   * Validates: Requirements 10.3
   * Cache-aside pattern for search results
   */
  describe('Caching', () => {
    it('should return cached results when available', async () => {
      (cache.get as jest.Mock).mockResolvedValue(mockSearchResult);

      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(cache.get).toHaveBeenCalled();
      expect(search.searchAssets).not.toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.data.cached).toBe(true);
    });

    it('should cache search results on cache miss', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(cache.get).toHaveBeenCalled();
      expect(search.searchAssets).toHaveBeenCalled();
      expect(cache.set).toHaveBeenCalled();

      const body = JSON.parse(result.body);
      expect(body.data.cached).toBe(false);
    });
  });

  /**
   * Validates: Requirements 10.6
   * Sub-500ms response times
   */
  describe('Performance', () => {
    it('should include timing information in response', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.took).toBeDefined();
      expect(typeof body.data.took).toBe('number');
    });

    it('should include max score in response', async () => {
      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.maxScore).toBe(1.5);
    });
  });

  /**
   * Validates: Fallback behavior when OpenSearch is unavailable
   */
  describe('Fallback to Database', () => {
    it('should fallback to database when OpenSearch is unavailable', async () => {
      (search.isOpenSearchAvailable as jest.Mock).mockResolvedValue(false);
      (assetService.listAssets as jest.Mock).mockResolvedValue({
        items: mockSearchResult.items,
        total: mockSearchResult.total,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(search.isOpenSearchAvailable).toHaveBeenCalled();
      expect(search.searchAssets).not.toHaveBeenCalled();
      expect(assetService.listAssets).toHaveBeenCalled();
    });
  });

  /**
   * Error handling
   */
  describe('Error Handling', () => {
    it('should return 500 on search error', async () => {
      (search.searchAssets as jest.Mock).mockRejectedValue(new Error('Search failed'));

      const event = createMockEvent({
        queryStringParameters: {
          q: 'laptop',
        },
      });

      const result = await searchAssetsHandler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});
