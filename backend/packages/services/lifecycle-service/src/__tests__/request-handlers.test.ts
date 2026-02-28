/**
 * Request Handlers Unit Tests
 *
 * Tests for Request Lambda Handlers:
 * - submit-request handler (Requirement 6.1, 6B.3)
 * - get-request-status handler (Requirement 6B.8)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  ensureUserIdFromAuthClaims: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
  validateUUID: (value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  },
}));

jest.mock('@ams/types', () => ({
  API_ERROR_CODES: {
    BAD_REQUEST: 'BAD_REQUEST',
    UNAUTHORIZED: 'UNAUTHORIZED',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },
  createApiResponse: (data: unknown, requestId: string) => ({
    success: true,
    data,
    requestId,
  }),
  createErrorResponse: (code: string, message: string, requestId: string, errors?: unknown[]) => ({
    success: false,
    error: { code, message, errors },
    requestId,
  }),
  createLambdaResponse: (statusCode: number, body: unknown) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
  }),
}));

// Mock the request service
jest.mock('../request/request-service', () => ({
  submitRequest: jest.fn(),
  getRequestStatus: jest.fn(),
  getRequesterRequests: jest.fn(),
}));

import { handler as submitRequestHandler } from '../handlers/submit-request';
import { handler as getRequestStatusHandler, listHandler } from '../handlers/get-request-status';
import * as requestService from '../request/request-service';

const mockRequestService = requestService as jest.Mocked<typeof requestService>;

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/requests',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api123',
      authorizer: {
        claims: {
          sub: '123e4567-e89b-12d3-a456-426614174000',
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
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
        userAgent: 'test',
        userArn: null,
      },
      path: '/requests',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource123',
      resourcePath: '/requests',
    },
    resource: '/requests',
    ...overrides,
  };
}

describe('Submit Request Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          items: [{ productName: 'Laptop', quantity: 1 }],
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when body is missing', async () => {
      const event = createMockEvent({ body: null });
      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({ body: 'invalid json' });
      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('should return 400 when justification is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          deliveryLocation: 'Building A',
          items: [{ productName: 'Laptop', quantity: 1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when deliveryLocation is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          items: [{ productName: 'Laptop', quantity: 1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when items is empty', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          items: [],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when item has invalid quantity', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          items: [{ productName: 'Laptop', quantity: -1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when item has missing productName', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          items: [{ quantity: 1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when priority is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          priority: 'INVALID',
          items: [{ productName: 'Laptop', quantity: 1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Submission', () => {
    it('should return 201 when request is submitted successfully', async () => {
      const mockRequest = {
        requestId: '123e4567-e89b-12d3-a456-426614174001',
        requestNumber: 'REQ-ABC123-XYZ',
        status: 'PENDING_APPROVAL',
        priority: 'HIGH',
        approvalWorkflowId: 'WF-ABC123',
      };

      const mockLines = [
        { lineId: '123e4567-e89b-12d3-a456-426614174002', quantity: 1 },
      ];

      mockRequestService.submitRequest.mockResolvedValue({
        request: mockRequest as any,
        lines: mockLines as any,
      });

      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop for development work',
          deliveryLocation: 'Building A, Floor 2',
          priority: 'HIGH',
          items: [
            {
              productName: 'MacBook Pro 16"',
              productType: 'LAPTOP',
              quantity: 1,
              unitPrice: 1500,
            },
          ],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.request.requestNumber).toBe('REQ-ABC123-XYZ');
      expect(body.data.request.status).toBe('PENDING_APPROVAL');
    });

    it('should handle multiple items', async () => {
      const mockRequest = {
        requestId: '123e4567-e89b-12d3-a456-426614174001',
        requestNumber: 'REQ-ABC123-XYZ',
        status: 'PENDING_APPROVAL',
        totalQuantity: 3,
      };

      const mockLines = [
        { lineId: 'line-1', quantity: 1 },
        { lineId: 'line-2', quantity: 2 },
      ];

      mockRequestService.submitRequest.mockResolvedValue({
        request: mockRequest as any,
        lines: mockLines as any,
      });

      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need equipment for new team',
          deliveryLocation: 'Building B',
          items: [
            { productName: 'Laptop', quantity: 1 },
            { productName: 'Monitor', quantity: 2 },
          ],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.lines.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockRequestService.submitRequest.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          justification: 'Need new laptop',
          deliveryLocation: 'Building A',
          items: [{ productName: 'Laptop', quantity: 1 }],
        }),
      });

      const result = await submitRequestHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('Get Request Status Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when requestId is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: null,
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when requestId is not a valid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { requestId: 'not-a-uuid' },
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Retrieval', () => {
    it('should return 200 with request status', async () => {
      const mockResult = {
        request: {
          requestId: '123e4567-e89b-12d3-a456-426614174001',
          requestNumber: 'REQ-ABC123-XYZ',
          requesterId: '123e4567-e89b-12d3-a456-426614174000',
          status: 'PENDING_APPROVAL',
        },
        lines: [{ lineId: 'line-1', quantity: 1 }],
        statusHistory: [
          { status: 'DRAFT', timestamp: '2024-01-15T09:00:00.000Z' },
          { status: 'SUBMITTED', timestamp: '2024-01-15T10:00:00.000Z' },
        ],
        canCancel: true,
        canModify: false,
      };

      mockRequestService.getRequestStatus.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.request.status).toBe('PENDING_APPROVAL');
      expect(body.data.canCancel).toBe(true);
    });
  });

  describe('Not Found', () => {
    it('should return 404 when request not found', async () => {
      mockRequestService.getRequestStatus.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockRequestService.getRequestStatus.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { requestId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getRequestStatusHandler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});

describe('List Requests Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Successful Listing', () => {
    it('should return 200 with paginated requests', async () => {
      const mockResult = {
        items: [
          { requestId: 'req-1', requestNumber: 'REQ-001', status: 'PENDING_APPROVAL' },
          { requestId: 'req-2', requestNumber: 'REQ-002', status: 'FULFILLED' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockRequestService.getRequesterRequests.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBe(2);
      expect(body.data.total).toBe(2);
    });

    it('should handle pagination parameters', async () => {
      mockRequestService.getRequesterRequests.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { page: '2', limit: '10' },
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockRequestService.getRequesterRequests).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { page: 2, limit: 10 },
        undefined
      );
    });

    it('should handle status filter', async () => {
      mockRequestService.getRequesterRequests.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { status: 'PENDING_APPROVAL,APPROVED' },
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockRequestService.getRequesterRequests).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        { page: 1, limit: 50 },
        ['PENDING_APPROVAL', 'APPROVED']
      );
    });
  });

  describe('Validation', () => {
    it('should return 400 for invalid page parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { page: '-1' },
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { limit: '200' },
      });

      const result = await listHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });
});
