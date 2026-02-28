/**
 * Transfer Handlers Unit Tests
 *
 * Tests for Transfer Lambda Handlers:
 * - create-transfer handler (Requirement 3.10)
 * - approve-transfer handler (Requirement 3.10)
 * - complete-transfer handler (Requirement 3.10)
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

// Mock the transfer service
jest.mock('../transfer/transfer-service', () => ({
  createTransfer: jest.fn(),
  approveTransfer: jest.fn(),
  rejectTransfer: jest.fn(),
  completeTransfer: jest.fn(),
}));

import { handler as createTransferHandler } from '../handlers/create-transfer';
import { handler as approveTransferHandler } from '../handlers/approve-transfer';
import { handler as completeTransferHandler } from '../handlers/complete-transfer';
import * as transferService from '../transfer/transfer-service';

const mockTransferService = transferService as jest.Mocked<typeof transferService>;


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
    path: '/transfers',
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
      path: '/transfers',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource123',
      resourcePath: '/transfers',
    },
    resource: '/transfers',
    ...overrides,
  };
}


describe('Create Transfer Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when body is missing', async () => {
      const event = createMockEvent({ body: null });
      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({ body: 'invalid json' });
      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('should return 400 when fromStockroomId is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when toStockroomId is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when stockrooms are the same', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when lines is empty', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when line has invalid quantity', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: -1 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when priority is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          priority: 'INVALID',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('Successful Creation', () => {
    it('should return 201 when transfer is created successfully', async () => {
      const mockTransfer = {
        transferId: '123e4567-e89b-12d3-a456-426614174004',
        transferNumber: 'TRF-ABC123-XYZ',
        fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
        toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
        status: 'PENDING_APPROVAL',
        priority: 'NORMAL',
      };

      const mockLines = [
        { lineId: '123e4567-e89b-12d3-a456-426614174005', quantity: 5 },
      ];

      mockTransferService.createTransfer.mockResolvedValue({
        transfer: mockTransfer as any,
        lines: mockLines as any,
      });

      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          priority: 'HIGH',
          reason: 'Urgent need',
          lines: [
            {
              productId: '123e4567-e89b-12d3-a456-426614174003',
              productType: 'HARDWARE_MODEL',
              quantity: 5,
            },
          ],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.transfer.transferNumber).toBe('TRF-ABC123-XYZ');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when stockroom not found', async () => {
      mockTransferService.createTransfer.mockRejectedValue(
        new Error('Source stockroom not found: 123e4567-e89b-12d3-a456-426614174001')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 500 for unexpected errors', async () => {
      mockTransferService.createTransfer.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
          toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
          lines: [{ productId: '123e4567-e89b-12d3-a456-426614174003', quantity: 5 }],
        }),
      });

      const result = await createTransferHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});


describe('Approve Transfer Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when transferId is missing', async () => {
      const event = createMockEvent({ pathParameters: null });
      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when transferId is not a valid UUID', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: 'not-a-uuid' },
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Approval', () => {
    it('should return 200 when transfer is approved successfully', async () => {
      const mockResult = {
        transfer: {
          transferId: '123e4567-e89b-12d3-a456-426614174004',
          transferNumber: 'TRF-ABC123-XYZ',
          status: 'APPROVED',
        },
        approved: true,
        message: 'Transfer order approved successfully',
      };

      mockTransferService.approveTransfer.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({ notes: 'Approved for urgent need' }),
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.approved).toBe(true);
    });
  });

  describe('Successful Rejection', () => {
    it('should return 200 when transfer is rejected successfully', async () => {
      const mockResult = {
        transfer: {
          transferId: '123e4567-e89b-12d3-a456-426614174004',
          transferNumber: 'TRF-ABC123-XYZ',
          status: 'REJECTED',
        },
        approved: false,
        message: 'Transfer order rejected: Insufficient inventory',
      };

      mockTransferService.rejectTransfer.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        queryStringParameters: { action: 'reject' },
        body: JSON.stringify({ rejectionReason: 'Insufficient inventory' }),
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.approved).toBe(false);
    });

    it('should return 400 when rejectionReason is missing for rejection', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        queryStringParameters: { action: 'reject' },
        body: JSON.stringify({}),
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when transfer not found', async () => {
      mockTransferService.approveTransfer.mockRejectedValue(
        new Error('Transfer order not found: 123e4567-e89b-12d3-a456-426614174004')
      );

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 409 when transfer is in invalid status', async () => {
      mockTransferService.approveTransfer.mockRejectedValue(
        new Error('Cannot approve transfer in status: COMPLETED')
      );

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
      });

      const result = await approveTransferHandler(event);

      expect(result.statusCode).toBe(409);
    });
  });
});


describe('Complete Transfer Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
          ],
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when transferId is missing', async () => {
      const event = createMockEvent({
        pathParameters: null,
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when lineReceipts is missing', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({}),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when lineReceipts is empty', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({ lineReceipts: [] }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when receivedQuantity is negative', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: -1 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when conditionReceived is invalid', async () => {
      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            {
              lineId: '123e4567-e89b-12d3-a456-426614174005',
              receivedQuantity: 5,
              conditionReceived: 'INVALID_CONDITION',
            },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Completion', () => {
    it('should return 200 when transfer is completed successfully', async () => {
      const mockResult = {
        transfer: {
          transferId: '123e4567-e89b-12d3-a456-426614174004',
          transferNumber: 'TRF-ABC123-XYZ',
          status: 'COMPLETED',
        },
        lines: [
          { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
        ],
        inventoryUpdated: true,
        fromStockroomUpdated: true,
        toStockroomUpdated: true,
      };

      mockTransferService.completeTransfer.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          receivingNotes: 'All items received in good condition',
          lineReceipts: [
            {
              lineId: '123e4567-e89b-12d3-a456-426614174005',
              receivedQuantity: 5,
              conditionReceived: 'GOOD',
            },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.transfer.status).toBe('COMPLETED');
      expect(body.data.inventoryUpdated).toBe(true);
    });

    it('should handle partial receipt', async () => {
      const mockResult = {
        transfer: {
          transferId: '123e4567-e89b-12d3-a456-426614174004',
          transferNumber: 'TRF-ABC123-XYZ',
          status: 'PARTIALLY_RECEIVED',
        },
        lines: [
          { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 3 },
        ],
        inventoryUpdated: false,
        fromStockroomUpdated: false,
        toStockroomUpdated: false,
      };

      mockTransferService.completeTransfer.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 3 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.transfer.status).toBe('PARTIALLY_RECEIVED');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when transfer not found', async () => {
      mockTransferService.completeTransfer.mockRejectedValue(
        new Error('Transfer order not found: 123e4567-e89b-12d3-a456-426614174004')
      );

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 409 when transfer is in invalid status', async () => {
      mockTransferService.completeTransfer.mockRejectedValue(
        new Error('Cannot complete transfer in status: PENDING_APPROVAL')
      );

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(409);
    });

    it('should return 500 for unexpected errors', async () => {
      mockTransferService.completeTransfer.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        pathParameters: { transferId: '123e4567-e89b-12d3-a456-426614174004' },
        body: JSON.stringify({
          lineReceipts: [
            { lineId: '123e4567-e89b-12d3-a456-426614174005', receivedQuantity: 5 },
          ],
        }),
      });

      const result = await completeTransferHandler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});

