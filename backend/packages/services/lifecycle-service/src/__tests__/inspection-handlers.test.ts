/**
 * Inspection Handlers Unit Tests
 *
 * Tests for Inspection Lambda Handlers:
 * - Mark For Inspection Handler (Requirement 13.1)
 * - Record Inspection Result Handler (Requirement 13.2, 13.3)
 * - Get Inspection History Handler (Requirement 13.4)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  ensureUserIdFromAuthClaims: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
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
  validateUUID: jest.fn((value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  }),
}));

// Mock the receiving service
jest.mock('../receiving/receiving-service');

import { handler as markForInspectionHandler } from '../handlers/mark-for-inspection';
import { handler as recordInspectionResultHandler } from '../handlers/record-inspection-result';
import { handler as getInspectionHistoryHandler } from '../handlers/get-inspection-history';
import * as receivingService from '../receiving/receiving-service';

const mockReceivingService = receivingService as jest.Mocked<typeof receivingService>;

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
    path: '/test',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
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

describe('Mark For Inspection Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should mark item for inspection for valid request', async () => {
    const mockResult = {
      inspectionRecord: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        assetId: null,
        serialNumber: 'SN12345',
        inspectionStatus: 'PENDING' as const,
        inspectedBy: null,
        inspectedByName: null,
        inspectedDate: null,
        result: null,
        notes: 'Requires quality check',
        failureReason: null,
        routedToReturn: false,
        returnOrderId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      receivingLine: {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poLineId: null,
        lineNumber: 1,
        productId: null,
        productType: 'HARDWARE',
        productName: 'MacBook Pro',
        quantityExpected: 5,
        quantityReceived: 0,
        condition: 'NEW' as const,
        assetIdsCreated: [],
        serialNumbersScanned: [],
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
    };

    mockReceivingService.markForInspection.mockResolvedValue(mockResult);

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
        notes: 'Requires quality check',
      }),
    });

    const result = await markForInspectionHandler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.inspectionRecord.inspectionId).toBe('123e4567-e89b-12d3-a456-426614174050');
    expect(body.data.inspectionRecord.inspectionStatus).toBe('PENDING');
  });

  it('should return 400 for missing receivingLineId', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        serialNumber: 'SN12345',
      }),
    });

    const result = await markForInspectionHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid receivingLineId UUID', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: 'invalid-uuid',
      }),
    });

    const result = await markForInspectionHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 404 for non-existent receiving line', async () => {
    mockReceivingService.markForInspection.mockRejectedValue(
      new Error('Receiving line not found: 123e4567-e89b-12d3-a456-426614174040')
    );

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
      }),
    });

    const result = await markForInspectionHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
      }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await markForInspectionHandler(event);

    expect(result.statusCode).toBe(401);
  });
});

describe('Record Inspection Result Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should record passed inspection result', async () => {
    const mockResult = {
      inspectionRecord: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        assetId: '123e4567-e89b-12d3-a456-426614174060',
        serialNumber: 'SN12345',
        inspectionStatus: 'PASSED' as const,
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        inspectedByName: 'Test Inspector',
        inspectedDate: '2024-01-15T10:00:00.000Z',
        result: 'PASSED' as const,
        notes: 'All checks passed',
        failureReason: null,
        routedToReturn: false,
        returnOrderId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      assetCreated: {
        assetId: '123e4567-e89b-12d3-a456-426614174060',
        assetTag: 'AST-ABC123-XYZ',
        serialNumber: 'SN12345',
        productName: 'MacBook Pro',
        status: 'IN_STOCK' as const,
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
      },
      routedToReturn: false,
    };

    mockReceivingService.recordInspectionResult.mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'PASSED',
        inspectedByName: 'Test Inspector',
        notes: 'All checks passed',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.inspectionRecord.result).toBe('PASSED');
    expect(body.data.assetCreated).toBeDefined();
    expect(body.data.routedToReturn).toBe(false);
  });

  it('should record failed inspection result', async () => {
    const mockResult = {
      inspectionRecord: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        assetId: null,
        serialNumber: 'SN12345',
        inspectionStatus: 'FAILED' as const,
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        inspectedByName: 'Test Inspector',
        inspectedDate: '2024-01-15T10:00:00.000Z',
        result: 'FAILED' as const,
        notes: 'Physical damage detected',
        failureReason: 'Screen cracked',
        routedToReturn: false,
        returnOrderId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      assetCreated: undefined,
      routedToReturn: true,
    };

    mockReceivingService.recordInspectionResult.mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'FAILED',
        inspectedByName: 'Test Inspector',
        notes: 'Physical damage detected',
        failureReason: 'Screen cracked',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.inspectionRecord.result).toBe('FAILED');
    expect(body.data.assetCreated).toBeUndefined();
    expect(body.data.routedToReturn).toBe(true);
  });

  it('should return 400 for missing inspectionId', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        result: 'PASSED',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('should return 400 for missing result', async () => {
    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid result value', async () => {
    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'INVALID_RESULT',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.details[0].message).toContain('result must be one of');
  });

  it('should return 404 for non-existent inspection', async () => {
    mockReceivingService.recordInspectionResult.mockRejectedValue(
      new Error('Inspection record not found: 123e4567-e89b-12d3-a456-426614174050')
    );

    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'PASSED',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 409 for already completed inspection', async () => {
    mockReceivingService.recordInspectionResult.mockRejectedValue(
      new Error('Inspection already completed with result: PASSED')
    );

    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'FAILED',
      }),
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(409);
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      pathParameters: {
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      },
      body: JSON.stringify({
        result: 'PASSED',
      }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await recordInspectionResultHandler(event);

    expect(result.statusCode).toBe(401);
  });
});

describe('Get Inspection History Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get inspection history with no filters', async () => {
    const mockResult = {
      items: [
        {
          inspectionId: '123e4567-e89b-12d3-a456-426614174050',
          receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
          assetId: '123e4567-e89b-12d3-a456-426614174060',
          serialNumber: 'SN12345',
          inspectionStatus: 'PASSED' as const,
          inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
          inspectedByName: 'Test Inspector',
          inspectedDate: '2024-01-15T10:00:00.000Z',
          result: 'PASSED' as const,
          notes: 'All checks passed',
          failureReason: null,
          routedToReturn: false,
          returnOrderId: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    };

    mockReceivingService.getInspectionRecords.mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: null,
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.items.length).toBe(1);
    expect(body.data.total).toBe(1);
  });

  it('should get inspection history filtered by assetId', async () => {
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    };

    mockReceivingService.getInspectionRecords.mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        assetId: '123e4567-e89b-12d3-a456-426614174060',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(200);
    expect(mockReceivingService.getInspectionRecords).toHaveBeenCalledWith(
      { assetId: '123e4567-e89b-12d3-a456-426614174060' },
      { page: 1, limit: 50 }
    );
  });

  it('should get inspection history filtered by status', async () => {
    const mockResult = {
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    };

    mockReceivingService.getInspectionRecords.mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        status: 'PENDING',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(200);
    expect(mockReceivingService.getInspectionRecords).toHaveBeenCalledWith(
      { status: 'PENDING' },
      { page: 1, limit: 50 }
    );
  });

  it('should return 400 for invalid assetId UUID', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        assetId: 'invalid-uuid',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid status', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        status: 'INVALID_STATUS',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.details[0].message).toContain('status must be one of');
  });

  it('should return 400 for invalid page number', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        page: '-1',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid limit', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: {
        limit: '200',
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      httpMethod: 'GET',
      queryStringParameters: null,
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await getInspectionHistoryHandler(event);

    expect(result.statusCode).toBe(401);
  });
});
