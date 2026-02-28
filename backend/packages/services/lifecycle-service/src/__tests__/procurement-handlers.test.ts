/**
 * Procurement Handlers Unit Tests
 *
 * Tests for Procurement Lambda Handlers:
 * - Check Stock Handler (Requirement 6.2)
 * - Reserve Inventory Handler (Requirement 6.2)
 * - Create Purchase Order Handler (Requirement 6.2, 6.3)
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
  validateUUID: jest.fn((value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  }),
}));

// Mock the procurement service
jest.mock('../procurement/procurement-service');

import { handler as checkStockHandler } from '../handlers/check-stock';
import { handler as reserveInventoryHandler } from '../handlers/reserve-inventory';
import { handler as createPurchaseOrderHandler } from '../handlers/create-purchase-order';
import * as procurementService from '../procurement/procurement-service';

const mockProcurementService = procurementService as jest.Mocked<typeof procurementService>;

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

describe('Check Stock Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return stock availability for valid request', async () => {
    const mockResult = {
      productId: '123e4567-e89b-12d3-a456-426614174001',
      productType: 'HARDWARE_MODEL',
      quantityRequested: 5,
      quantityAvailable: 10,
      isAvailable: true,
      shortfall: 0,
      stockrooms: [],
    };

    mockProcurementService.checkStock.mockResolvedValue(mockResult);

    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await checkStockHandler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.data.isAvailable).toBe(true);
    expect(body.data.quantityAvailable).toBe(10);
  });

  it('should return 400 for missing productId', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await checkStockHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid productId UUID', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        productId: 'invalid-uuid',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await checkStockHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for invalid quantityNeeded', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 0,
      }),
    });

    const result = await checkStockHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await checkStockHandler(event);

    expect(result.statusCode).toBe(401);
  });
});

describe('Reserve Inventory Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reserve inventory for valid request', async () => {
    const mockResult = {
      reservations: [
        {
          reservationId: '123e4567-e89b-12d3-a456-426614174050',
          inventoryId: '123e4567-e89b-12d3-a456-426614174051',
          stockroomId: '123e4567-e89b-12d3-a456-426614174010',
          productId: '123e4567-e89b-12d3-a456-426614174001',
          productType: 'HARDWARE_MODEL',
          quantityReserved: 5,
          status: 'ACTIVE' as const,
        },
      ],
      totalReserved: 5,
      fullyReserved: true,
      shortfall: 0,
    };

    mockProcurementService.reserveInventory.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await reserveInventoryHandler(event);

    expect(result.statusCode).toBe(201); // Created when fully reserved
    const body = JSON.parse(result.body);
    expect(body.data.fullyReserved).toBe(true);
    expect(body.data.totalReserved).toBe(5);
  });

  it('should return 200 when partially reserved', async () => {
    const mockResult = {
      reservations: [],
      totalReserved: 3,
      fullyReserved: false,
      shortfall: 2,
    };

    mockProcurementService.reserveInventory.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await reserveInventoryHandler(event);

    expect(result.statusCode).toBe(200); // OK when partially reserved
    const body = JSON.parse(result.body);
    expect(body.data.fullyReserved).toBe(false);
  });

  it('should return 400 for missing required fields', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        // Missing productType and quantityNeeded
      }),
    });

    const result = await reserveInventoryHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 409 for insufficient inventory', async () => {
    mockProcurementService.reserveInventory.mockRejectedValue(
      new Error('Insufficient available inventory: available=0, requested=5')
    );

    const event = createMockEvent({
      body: JSON.stringify({
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        quantityNeeded: 5,
      }),
    });

    const result = await reserveInventoryHandler(event);

    expect(result.statusCode).toBe(409);
  });
});

describe('Create Purchase Order Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create purchase order for valid request', async () => {
    const mockResult = {
      purchaseOrder: {
        poId: '123e4567-e89b-12d3-a456-426614174020',
        poNumber: 'PO-ABC123-XYZ',
        status: 'DRAFT',
        totalAmount: 3000,
      },
      lines: [
        {
          lineId: '123e4567-e89b-12d3-a456-426614174021',
          productName: 'MacBook Pro 16"',
          quantity: 2,
          unitPrice: 1500,
          totalPrice: 3000,
        },
      ],
    };

    mockProcurementService.createPurchaseOrder.mockResolvedValue(mockResult as any);

    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [
          {
            productName: 'MacBook Pro 16"',
            quantity: 2,
            unitPrice: 1500,
          },
        ],
      }),
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.data.purchaseOrder.poNumber).toBe('PO-ABC123-XYZ');
    expect(body.data.lines.length).toBe(1);
  });

  it('should return 400 for empty lines array', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [],
      }),
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing productName in line', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [
          {
            quantity: 2,
            unitPrice: 1500,
          },
        ],
      }),
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid quantity in line', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [
          {
            productName: 'MacBook Pro 16"',
            quantity: -1,
            unitPrice: 1500,
          },
        ],
      }),
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for missing unitPrice in line', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [
          {
            productName: 'MacBook Pro 16"',
            quantity: 2,
          },
        ],
      }),
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(400);
  });

  it('should return 400 for invalid JSON body', async () => {
    const event = createMockEvent({
      body: 'invalid json',
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(400);
    const body = JSON.parse(result.body);
    expect(body.error.message).toBe('Invalid JSON in request body');
  });

  it('should return 401 for unauthenticated request', async () => {
    const event = createMockEvent({
      body: JSON.stringify({
        vendorName: 'Tech Supplier Inc',
        lines: [
          {
            productName: 'MacBook Pro 16"',
            quantity: 2,
            unitPrice: 1500,
          },
        ],
      }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: null,
      },
    });

    const result = await createPurchaseOrderHandler(event);

    expect(result.statusCode).toBe(401);
  });
});
