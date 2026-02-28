/**
 * Pagination Middleware Tests
 * 
 * Tests for pagination, filtering, and sorting middleware including
 * parameter parsing, validation, and response formatting.
 * 
 * Validates: Requirements 8.7
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import {
  createCursor,
  createPaginatedApiResponse,
  createPaginatedResult,
  createPaginationOptions,
  decodeCursor,
  encodeCursor,
  extractPaginationParams,
  FILTER_OPERATORS,
  getPaginationRequest,
  normalizeLimit,
  normalizePage,
  PAGINATION_DEFAULTS,
  PAGINATION_ERROR_CODES,
  PaginationParseError,
  parseFilterParams,
  parseFilterString,
  parseListQueryParams,
  parsePaginationParams,
  parseSortParams,
  parseSortString,
  withPagination,
  type CursorData,
  type PaginatedHandler,
} from '../index';

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
      path: '/assets',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/assets',
    },
    resource: '/assets',
    ...overrides,
  };
}

describe('Cursor Encoding/Decoding', () => {
  it('should encode and decode cursor correctly', () => {
    const cursorData: CursorData = {
      lastId: '123e4567-e89b-12d3-a456-426614174000',
      sortValues: { createdAt: '2024-01-15T10:30:00Z', name: 'Test Asset' },
      createdAt: '2024-01-15T10:30:00Z',
    };

    const encoded = encodeCursor(cursorData);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(cursorData);
  });

  it('should return null for invalid cursor', () => {
    expect(decodeCursor('invalid-cursor')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-base64!')).toBeNull();
  });

  it('should return null for cursor with missing fields', () => {
    const invalidData = { lastId: '123' }; // Missing createdAt and sortValues
    const encoded = Buffer.from(JSON.stringify(invalidData), 'utf-8').toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('should create cursor from last item', () => {
    const lastItem = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      createdAt: '2024-01-15T10:30:00Z',
      name: 'Test Asset',
    };

    const cursor = createCursor(lastItem, 'id', ['createdAt']);
    expect(typeof cursor).toBe('string');

    const decoded = decodeCursor(cursor);
    expect(decoded?.lastId).toBe(lastItem.id);
    expect(decoded?.sortValues['createdAt']).toBe(lastItem.createdAt);
  });
});

describe('Pagination Parameter Parsing', () => {
  describe('normalizePage', () => {
    it('should return default page for undefined', () => {
      expect(normalizePage(undefined)).toBe(PAGINATION_DEFAULTS.DEFAULT_PAGE);
    });

    it('should return 1 for negative or zero page', () => {
      expect(normalizePage(0)).toBe(1);
      expect(normalizePage(-1)).toBe(1);
      expect(normalizePage(-100)).toBe(1);
    });

    it('should return the page number for valid input', () => {
      expect(normalizePage(1)).toBe(1);
      expect(normalizePage(5)).toBe(5);
      expect(normalizePage(100)).toBe(100);
    });

    it('should floor decimal page numbers', () => {
      expect(normalizePage(1.5)).toBe(1);
      expect(normalizePage(2.9)).toBe(2);
    });
  });

  describe('normalizeLimit', () => {
    it('should return default limit for undefined', () => {
      expect(normalizeLimit(undefined)).toBe(PAGINATION_DEFAULTS.DEFAULT_LIMIT);
    });

    it('should return minimum limit for values below minimum', () => {
      expect(normalizeLimit(0)).toBe(PAGINATION_DEFAULTS.MIN_LIMIT);
      expect(normalizeLimit(-1)).toBe(PAGINATION_DEFAULTS.MIN_LIMIT);
    });

    it('should return maximum limit for values above maximum', () => {
      expect(normalizeLimit(1000)).toBe(PAGINATION_DEFAULTS.MAX_LIMIT);
      expect(normalizeLimit(500)).toBe(PAGINATION_DEFAULTS.MAX_LIMIT);
    });

    it('should return the limit for valid input', () => {
      expect(normalizeLimit(10)).toBe(10);
      expect(normalizeLimit(50)).toBe(50);
    });

    it('should respect custom max limit', () => {
      expect(normalizeLimit(100, 50)).toBe(50);
      expect(normalizeLimit(30, 50)).toBe(30);
    });
  });

  describe('parsePaginationParams', () => {
    it('should return defaults for null query params', () => {
      const result = parsePaginationParams(null);
      expect(result.params.mode).toBe('page');
      expect(result.params.limit).toBe(PAGINATION_DEFAULTS.DEFAULT_LIMIT);
      if (result.params.mode === 'page') {
        expect(result.params.page).toBe(PAGINATION_DEFAULTS.DEFAULT_PAGE);
      }
      expect(result.errors).toHaveLength(0);
    });

    it('should parse page and limit from query params', () => {
      const result = parsePaginationParams({ page: '3', limit: '25' });
      expect(result.params.mode).toBe('page');
      if (result.params.mode === 'page') {
        expect(result.params.page).toBe(3);
      }
      expect(result.params.limit).toBe(25);
      expect(result.errors).toHaveLength(0);
    });

    it('should support pageSize as alias for limit', () => {
      const result = parsePaginationParams({ pageSize: '30' });
      expect(result.params.limit).toBe(30);
    });

    it('should return error for invalid page', () => {
      const result = parsePaginationParams({ page: 'invalid' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe(PAGINATION_ERROR_CODES.INVALID_PAGE);
    });

    it('should return error for invalid limit', () => {
      const result = parsePaginationParams({ limit: 'invalid' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe(PAGINATION_ERROR_CODES.INVALID_LIMIT);
    });

    it('should switch to cursor mode when cursor is provided', () => {
      const cursorData: CursorData = {
        lastId: '123',
        sortValues: {},
        createdAt: new Date().toISOString(),
      };
      const cursor = encodeCursor(cursorData);

      const result = parsePaginationParams({ cursor });
      expect(result.params.mode).toBe('cursor');
      if (result.params.mode === 'cursor') {
        expect(result.params.cursor).toBe(cursor);
      }
    });

    it('should return error for invalid cursor', () => {
      const result = parsePaginationParams({ cursor: 'invalid-cursor' });
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe(PAGINATION_ERROR_CODES.INVALID_CURSOR);
    });
  });
});

describe('Sort Parameter Parsing', () => {
  describe('parseSortString', () => {
    it('should return empty array for undefined', () => {
      expect(parseSortString(undefined)).toEqual([]);
    });

    it('should return default field when provided', () => {
      const result = parseSortString(undefined, 'createdAt', 'desc');
      expect(result).toEqual([{ field: 'createdAt', direction: 'desc' }]);
    });

    it('should parse simple field name', () => {
      const result = parseSortString('name');
      expect(result).toEqual([{ field: 'name', direction: 'desc' }]);
    });

    it('should parse field with colon direction', () => {
      expect(parseSortString('name:asc')).toEqual([{ field: 'name', direction: 'asc' }]);
      expect(parseSortString('name:desc')).toEqual([{ field: 'name', direction: 'desc' }]);
    });

    it('should parse field with prefix direction', () => {
      expect(parseSortString('-name')).toEqual([{ field: 'name', direction: 'desc' }]);
      expect(parseSortString('+name')).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('should parse multiple sort fields', () => {
      const result = parseSortString('name:asc,-createdAt,status');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ field: 'name', direction: 'asc' });
      expect(result[1]).toEqual({ field: 'createdAt', direction: 'desc' });
      expect(result[2]).toEqual({ field: 'status', direction: 'desc' });
    });
  });

  describe('parseSortParams', () => {
    it('should parse sort from query params', () => {
      const result = parseSortParams({ sort: 'name:asc' });
      expect(result.params.sorts).toEqual([{ field: 'name', direction: 'asc' }]);
      expect(result.errors).toHaveLength(0);
    });

    it('should support sortBy and orderBy aliases', () => {
      expect(parseSortParams({ sortBy: 'name' }).params.sorts[0]?.field).toBe('name');
      expect(parseSortParams({ orderBy: 'name' }).params.sorts[0]?.field).toBe('name');
    });

    it('should apply sortDirection override', () => {
      const result = parseSortParams({ sort: 'name', sortDirection: 'asc' });
      expect(result.params.sorts[0]?.direction).toBe('asc');
    });

    it('should validate against allowed fields', () => {
      const result = parseSortParams(
        { sort: 'invalidField' },
        { allowedSortFields: ['name', 'createdAt'] }
      );
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe(PAGINATION_ERROR_CODES.INVALID_SORT_FIELD);
    });

    it('should allow valid fields', () => {
      const result = parseSortParams(
        { sort: 'name' },
        { allowedSortFields: ['name', 'createdAt'] }
      );
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Filter Parameter Parsing', () => {
  describe('parseFilterString', () => {
    it('should return empty array for undefined', () => {
      expect(parseFilterString(undefined)).toEqual([]);
    });

    it('should parse simple field:value filter', () => {
      const result = parseFilterString('status:ACTIVE');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        field: 'status',
        operator: FILTER_OPERATORS.EQ,
        value: 'ACTIVE',
      });
    });

    it('should parse field:operator:value filter', () => {
      const result = parseFilterString('status:eq:ACTIVE');
      expect(result[0]).toEqual({
        field: 'status',
        operator: FILTER_OPERATORS.EQ,
        value: 'ACTIVE',
      });
    });

    it('should parse numeric values', () => {
      const result = parseFilterString('quantity:gt:10');
      expect(result[0]?.value).toBe(10);
    });

    it('should parse boolean values', () => {
      expect(parseFilterString('isActive:eq:true')[0]?.value).toBe(true);
      expect(parseFilterString('isActive:eq:false')[0]?.value).toBe(false);
    });

    it('should parse IN operator with array values', () => {
      const result = parseFilterString('status:in:(ACTIVE,DEPLOYED,RETIRED)');
      expect(result[0]?.operator).toBe(FILTER_OPERATORS.IN);
      expect(result[0]?.value).toEqual(['ACTIVE', 'DEPLOYED', 'RETIRED']);
    });

    it('should parse multiple filters', () => {
      const result = parseFilterString('status:eq:ACTIVE,type:eq:HARDWARE');
      expect(result).toHaveLength(2);
      expect(result[0]?.field).toBe('status');
      expect(result[1]?.field).toBe('type');
    });

    it('should handle contains operator', () => {
      const result = parseFilterString('name:contains:laptop');
      expect(result[0]?.operator).toBe(FILTER_OPERATORS.CONTAINS);
      expect(result[0]?.value).toBe('laptop');
    });

    it('should handle comparison operators', () => {
      expect(parseFilterString('price:gt:100')[0]?.operator).toBe(FILTER_OPERATORS.GT);
      expect(parseFilterString('price:gte:100')[0]?.operator).toBe(FILTER_OPERATORS.GTE);
      expect(parseFilterString('price:lt:100')[0]?.operator).toBe(FILTER_OPERATORS.LT);
      expect(parseFilterString('price:lte:100')[0]?.operator).toBe(FILTER_OPERATORS.LTE);
    });
  });

  describe('parseFilterParams', () => {
    it('should parse filter from query params', () => {
      const result = parseFilterParams({ filter: 'status:eq:ACTIVE' });
      expect(result.params.filters).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should support filters and where aliases', () => {
      expect(parseFilterParams({ filters: 'status:ACTIVE' }).params.filters).toHaveLength(1);
      expect(parseFilterParams({ where: 'status:ACTIVE' }).params.filters).toHaveLength(1);
    });

    it('should validate against allowed fields', () => {
      const result = parseFilterParams(
        { filter: 'invalidField:eq:value' },
        { allowedFilterFields: ['status', 'type'] }
      );
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.code).toBe(PAGINATION_ERROR_CODES.INVALID_FILTER_FIELD);
    });
  });
});

describe('parseListQueryParams', () => {
  it('should parse all parameters together', () => {
    const result = parseListQueryParams({
      page: '2',
      limit: '25',
      sort: 'name:asc',
      filter: 'status:eq:ACTIVE',
    });

    expect(result.isValid).toBe(true);
    expect(result.pagination.mode).toBe('page');
    if (result.pagination.mode === 'page') {
      expect(result.pagination.page).toBe(2);
    }
    expect(result.pagination.limit).toBe(25);
    expect(result.sort.sorts).toHaveLength(1);
    expect(result.filter.filters).toHaveLength(1);
  });

  it('should aggregate errors from all parsers', () => {
    const result = parseListQueryParams(
      {
        page: 'invalid',
        sort: 'invalidField',
        filter: 'invalidFilter:eq:value',
      },
      {
        allowedSortFields: ['name'],
        allowedFilterFields: ['status'],
      }
    );

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('Paginated Response Creation', () => {
  const sampleItems = [
    { id: '1', name: 'Asset 1', createdAt: '2024-01-01T00:00:00Z' },
    { id: '2', name: 'Asset 2', createdAt: '2024-01-02T00:00:00Z' },
    { id: '3', name: 'Asset 3', createdAt: '2024-01-03T00:00:00Z' },
  ];

  describe('createPaginatedResult', () => {
    it('should create page-based pagination result', () => {
      const result = createPaginatedResult(sampleItems, {
        mode: 'page',
        page: 1,
        limit: 20,
      }, { total: 100 });

      expect(result.data).toEqual(sampleItems);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should create cursor-based pagination result', () => {
      const result = createPaginatedResult(sampleItems, {
        mode: 'cursor',
        limit: 3,
      }, { idField: 'id', sortFields: ['createdAt'] });

      expect(result.data).toEqual(sampleItems);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.nextCursor).toBeDefined();
    });

    it('should not include nextCursor when no more items', () => {
      const result = createPaginatedResult(sampleItems, {
        mode: 'cursor',
        limit: 10, // More than items returned
      });

      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBeUndefined();
    });
  });

  describe('createPaginatedApiResponse', () => {
    it('should include meta information', () => {
      const result = createPaginatedApiResponse(
        sampleItems,
        { mode: 'page', page: 1, limit: 20 },
        'test-request-id',
        { total: 100 }
      );

      expect(result.meta).toBeDefined();
      expect(result.meta?.requestId).toBe('test-request-id');
      expect(result.meta?.timestamp).toBeDefined();
    });
  });
});

describe('getPaginationRequest', () => {
  it('should return parsed request for valid params', () => {
    const event = createMockEvent({
      queryStringParameters: { page: '1', limit: '20' },
    });

    const result = getPaginationRequest(event);
    expect(result.isValid).toBe(true);
    expect(result.pagination.mode).toBe('page');
  });

  it('should throw PaginationParseError for invalid params', () => {
    const event = createMockEvent({
      queryStringParameters: { page: 'invalid' },
    });

    expect(() => getPaginationRequest(event)).toThrow(PaginationParseError);
  });
});

describe('withPagination middleware', () => {
  const mockHandler: PaginatedHandler<{ id: string }> = jest.fn();

  beforeEach(() => {
    (mockHandler as jest.Mock).mockReset();
    (mockHandler as jest.Mock).mockResolvedValue({
      data: [{ id: '1' }],
      pagination: { limit: 20, hasMore: false },
    });
  });

  it('should pass valid requests to handler', async () => {
    const handler = withPagination()(mockHandler);
    const event = createMockEvent({
      queryStringParameters: { page: '1', limit: '20' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(mockHandler).toHaveBeenCalled();
  });

  it('should return 400 for invalid pagination params', async () => {
    const handler = withPagination({
      allowedSortFields: ['name'],
    })(mockHandler);
    const event = createMockEvent({
      queryStringParameters: { sort: 'invalidField' },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(400);
    expect(mockHandler).not.toHaveBeenCalled();

    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should pass pagination request to handler', async () => {
    const handler = withPagination()(mockHandler);
    const event = createMockEvent({
      queryStringParameters: { page: '2', limit: '25', sort: 'name:asc' },
    });

    await handler(event);

    expect(mockHandler).toHaveBeenCalledWith(
      event,
      expect.objectContaining({
        pagination: expect.objectContaining({ page: 2, limit: 25 }),
        sort: expect.objectContaining({
          sorts: [{ field: 'name', direction: 'asc' }],
        }),
      })
    );
  });
});

describe('createPaginationOptions', () => {
  it('should create options with allowed fields', () => {
    const options = createPaginationOptions(
      ['name', 'createdAt'],
      ['status', 'type'],
      { defaultLimit: 50 }
    );

    expect(options.allowedSortFields).toEqual(['name', 'createdAt']);
    expect(options.allowedFilterFields).toEqual(['status', 'type']);
    expect(options.defaultLimit).toBe(50);
  });
});

describe('extractPaginationParams', () => {
  it('should extract params without throwing on errors', () => {
    const event = createMockEvent({
      queryStringParameters: { page: 'invalid' },
    });

    const result = extractPaginationParams(event);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('PaginationParseError', () => {
  it('should have correct properties', () => {
    const errors = [
      { field: 'page', message: 'Invalid page', code: 'INVALID_PAGE' },
    ];
    const error = new PaginationParseError('Pagination failed', errors);

    expect(error.name).toBe('PaginationParseError');
    expect(error.message).toBe('Pagination failed');
    expect(error.code).toBe('PAGINATION_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.errors).toEqual(errors);
  });
});

describe('Edge Cases', () => {
  it('should handle empty query string parameters', () => {
    const result = parseListQueryParams({});
    expect(result.isValid).toBe(true);
    expect(result.pagination.mode).toBe('page');
  });

  it('should handle whitespace in sort string', () => {
    const result = parseSortString('  name:asc  ,  createdAt:desc  ');
    expect(result).toHaveLength(2);
    expect(result[0]?.field).toBe('name');
    expect(result[1]?.field).toBe('createdAt');
  });

  it('should handle quoted string values in filters', () => {
    const result = parseFilterString('name:eq:"Test Asset"');
    expect(result[0]?.value).toBe('Test Asset');
  });

  it('should handle null values in filters', () => {
    // isNull operator requires the format field:isNull:value (value is ignored)
    const result = parseFilterString('assignedTo:isNull:true');
    expect(result[0]?.operator).toBe(FILTER_OPERATORS.IS_NULL);
    expect(result[0]?.value).toBeNull(); // isNull ignores the value
  });
});
