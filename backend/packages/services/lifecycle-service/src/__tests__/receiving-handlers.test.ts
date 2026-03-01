/**
 * Receiving Handlers Unit Tests
 *
 * Tests for Receiving Lambda Handlers:
 * - Record Receiving Handler (Requirement 6.4, 6.5)
 * - Scan Asset Handler (Requirement 6.4, 6.5)
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

import { handler as recordReceivingHandler } from '../handlers/record-receiving';
import { handler as scanAssetHandler } from '../handlers/scan-asset';
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

describe('Record Receiving Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PO-based receiving', () => {
    it('should record receiving from PO for valid request', async () => {
      const mockResult = {
        receivingRecord: {
          receivingId: '123e4567-e89b-12d3-a456-426614174020',
          poId: '123e4567-e89b-12d3-a456-426614174001',
          poNumber: 'PO-ABC123',
          vendorId: null,
          vendorName: null,
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          receivedByName: 'Test User',
          receivedDate: '2024-01-15T10:00:00.000Z',
          stockroomId: '123e4567-e89b-12d3-a456-426614174030',
          stockroomName: 'Main Stockroom',
          status: 'PENDING' as const,
          notes: null,
          totalLinesExpected: 2,
          totalLinesReceived: 0,
          totalQuantityExpected: 7,
          totalQuantityReceived: 0,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        lines: [
          {
            lineId: '123e4567-e89b-12d3-a456-426614174040',
            receivingId: '123e4567-e89b-12d3-a456-426614174020',
            poLineId: '123e4567-e89b-12d3-a456-426614174010',
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
        ],
      };

      mockReceivingService.recordReceivingFromPO.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
          stockroomId: '123e4567-e89b-12d3-a456-426614174030',
          receivedByName: 'Test User',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.receivingRecord.poId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(body.data.lines.length).toBe(1);
    });

    it('should return 400 for invalid poId UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          poId: 'invalid-uuid',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent PO', async () => {
      mockReceivingService.recordReceivingFromPO.mockRejectedValue(
        new Error('Purchase order not found: 123e4567-e89b-12d3-a456-426614174001')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for PO in non-receivable status', async () => {
      mockReceivingService.recordReceivingFromPO.mockRejectedValue(
        new Error('Purchase order cannot be received in status: DRAFT')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 409 for duplicate/conflict receiving creation errors', async () => {
      mockReceivingService.recordReceivingFromPO.mockRejectedValue(
        new Error('duplicate key value violates unique constraint "unique_receiving_line"')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should return 400 when blocked by stockroom availability constraints', async () => {
      mockReceivingService.recordReceivingFromPO.mockRejectedValue(
        new Error('No active stockroom is available for receiving')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('Manual receiving', () => {
    it('should record manual receiving for valid request', async () => {
      const mockResult = {
        receivingRecord: {
          receivingId: '123e4567-e89b-12d3-a456-426614174020',
          poId: null,
          poNumber: null,
          vendorId: null,
          vendorName: null,
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          receivedByName: 'Test User',
          receivedDate: '2024-01-15T10:00:00.000Z',
          stockroomId: null,
          stockroomName: null,
          status: 'PENDING' as const,
          notes: 'Walk-in delivery',
          totalLinesExpected: 1,
          totalLinesReceived: 0,
          totalQuantityExpected: 3,
          totalQuantityReceived: 0,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        lines: [
          {
            lineId: '123e4567-e89b-12d3-a456-426614174040',
            receivingId: '123e4567-e89b-12d3-a456-426614174020',
            poLineId: null,
            lineNumber: 1,
            productId: null,
            productType: 'HARDWARE',
            productName: 'Keyboard',
            quantityExpected: 3,
            quantityReceived: 0,
            condition: 'NEW' as const,
            assetIdsCreated: [],
            serialNumbersScanned: [],
            notes: null,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      };

      mockReceivingService.recordReceivingManual.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          receivedByName: 'Test User',
          notes: 'Walk-in delivery',
          lines: [
            {
              productName: 'Keyboard',
              productType: 'HARDWARE',
              quantityExpected: 3,
            },
          ],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.receivingRecord.poId).toBeNull();
      expect(body.data.lines.length).toBe(1);
    });

    it('should return 400 for empty lines array', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          lines: [],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing productName in line', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          lines: [
            {
              quantityExpected: 3,
            },
          ],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid quantityExpected', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          lines: [
            {
              productName: 'Keyboard',
              quantityExpected: 0,
            },
          ],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for non-integer quantityExpected', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          lines: [
            {
              productName: 'Keyboard',
              quantityExpected: 2.5,
            },
          ],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Common validation', () => {
    it('should return 400 when both poId and lines provided', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
          lines: [
            {
              productName: 'Keyboard',
              quantityExpected: 3,
            },
          ],
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('Cannot specify both');
    });

    it('should return 400 when neither poId nor lines provided', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          stockroomId: '123e4567-e89b-12d3-a456-426614174030',
        }),
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('Either poId');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid JSON in request body');
    });

    it('should return 401 for unauthenticated request', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          poId: '123e4567-e89b-12d3-a456-426614174001',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await recordReceivingHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });
});

describe('Scan Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should scan asset for valid request', async () => {
    const mockResult = {
      asset: {
        assetId: '123e4567-e89b-12d3-a456-426614174050',
        assetTag: 'AST-ABC123-XYZ',
        serialNumber: 'SN12345',
        productName: 'MacBook Pro',
        status: 'IN_STOCK' as const,
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: '123e4567-e89b-12d3-a456-426614174001',
        createdAt: '2024-01-15T10:00:00.000Z',
      },
      receivingLine: {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poLineId: '123e4567-e89b-12d3-a456-426614174010',
        lineNumber: 1,
        productId: null,
        productType: 'HARDWARE',
        productName: 'MacBook Pro',
        quantityExpected: 5,
        quantityReceived: 3,
        condition: 'NEW' as const,
        assetIdsCreated: ['asset1', 'asset2', '123e4567-e89b-12d3-a456-426614174050'],
        serialNumbersScanned: ['SN001', 'SN002', 'SN12345'],
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      receivingRecord: {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: '123e4567-e89b-12d3-a456-426614174001',
        poNumber: 'PO-ABC123',
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: '123e4567-e89b-12d3-a456-426614174030',
        stockroomName: null,
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 1,
        totalLinesReceived: 0,
        totalQuantityExpected: 5,
        totalQuantityReceived: 3,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      isLineComplete: false,
      isReceivingComplete: false,
    };

    mockReceivingService.scanAsset.mockResolvedValue(mockResult);

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
        condition: 'NEW',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.asset.assetId).toBe('123e4567-e89b-12d3-a456-426614174050');
    expect(body.data.asset.status).toBe('IN_STOCK');
    expect(body.data.isLineComplete).toBe(false);
  });

  it('should return 400 for missing receivingLineId', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        serialNumber: 'SN12345',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid receivingLineId UUID', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: 'invalid-uuid',
        serialNumber: 'SN12345',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid condition', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        condition: 'INVALID_CONDITION',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.details[0].message).toContain('condition must be one of');
  });

  it('should return 400 for empty serialNumber', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: '',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.details[0].message).toContain('serialNumber cannot be empty');
  });

  it('should return 404 for non-existent receiving line', async () => {
    mockReceivingService.scanAsset.mockRejectedValue(
      new Error('Receiving line not found: 123e4567-e89b-12d3-a456-426614174040')
    );

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(404);
  });

  it('should return 409 when all items already received', async () => {
    mockReceivingService.scanAsset.mockRejectedValue(
      new Error('All items already received for this line: expected=5, received=5')
    );

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(409);
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
      }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(401);
  });

  it('should allow scanning without serial number', async () => {
    const mockResult = {
      asset: {
        assetId: '123e4567-e89b-12d3-a456-426614174050',
        assetTag: 'AST-ABC123-XYZ',
        serialNumber: null,
        productName: 'Generic Item',
        status: 'IN_STOCK' as const,
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
      },
      receivingLine: {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poLineId: null,
        lineNumber: 1,
        productId: null,
        productType: 'HARDWARE',
        productName: 'Generic Item',
        quantityExpected: 3,
        quantityReceived: 1,
        condition: 'NEW' as const,
        assetIdsCreated: ['123e4567-e89b-12d3-a456-426614174050'],
        serialNumbersScanned: [],
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      receivingRecord: {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: null,
        poNumber: null,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: null,
        stockroomName: null,
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 1,
        totalLinesReceived: 0,
        totalQuantityExpected: 3,
        totalQuantityReceived: 1,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
      isLineComplete: false,
      isReceivingComplete: false,
    };

    mockReceivingService.scanAsset.mockResolvedValue(mockResult);

    const event = createMockEvent({
      body: JSON.stringify({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        // No serialNumber or barcode
      }),
    });

    const result = await scanAssetHandler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.asset.serialNumber).toBeNull();
  });
});
