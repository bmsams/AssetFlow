/**
 * Stockroom Handlers Unit Tests
 *
 * Tests for Lambda handlers:
 * - getStockroomInventory (Requirement 3.2)
 * - updateInventory (Requirement 3.2, 3.3)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dependencies
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
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  validateUUID: jest.fn((value, field) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      return { message: `${field} must be a valid UUID` };
    }
    return null;
  }),
  validate: jest.fn(() => ({
    stringLength: jest.fn().mockReturnThis(),
    result: jest.fn(() => ({ isValid: true, errors: [] })),
  })),
}));

jest.mock('../stockroom/stockroom-service', () => ({
  getStockroomInventory: jest.fn(),
  updateInventory: jest.fn(),
  getInventoryItem: jest.fn(),
}));

import { createApiResponse, createErrorResponse, HTTP_STATUS } from '@ams/types';

import * as stockroomService from '../stockroom/stockroom-service';
import { handler as getStockroomInventoryHandler } from '../handlers/get-stockroom-inventory';
import { handler as updateInventoryHandler } from '../handlers/update-inventory';

/**
 * Create mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/stockrooms',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {},
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
        userAgent: 'test',
        userArn: null,
      },
      path: '/stockrooms',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/stockrooms',
    },
    resource: '/stockrooms',
    ...overrides,
  };
}

describe('getStockroomInventory Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when stockroomId is missing', async () => {
    const event = createMockEvent({
      pathParameters: null,
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Stockroom ID is required',
      'test-request-id'
    );
  });

  it('should return 400 when stockroomId is invalid UUID', async () => {
    const event = createMockEvent({
      pathParameters: { stockroomId: 'invalid-uuid' },
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      expect.stringContaining('UUID'),
      'test-request-id'
    );
  });

  it('should return inventory with default pagination', async () => {
    const mockResult = {
      items: [
        {
          inventoryId: 'inv-001',
          stockroomId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          productType: 'HARDWARE_MODEL',
          quantityOnHand: 50,
          quantityAvailable: 45,
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
      hasMore: false,
    };

    (stockroomService.getStockroomInventory as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: { stockroomId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(stockroomService.getStockroomInventory).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      { page: 1, limit: 50 },
      false
    );
    expect(createApiResponse).toHaveBeenCalledWith(mockResult, 'test-request-id');
  });

  it('should parse pagination parameters from query string', async () => {
    const mockResult = {
      items: [],
      total: 0,
      page: 2,
      limit: 25,
      hasMore: false,
    };

    (stockroomService.getStockroomInventory as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: { stockroomId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      queryStringParameters: { page: '2', limit: '25', includeInactive: 'true' },
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(stockroomService.getStockroomInventory).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      { page: 2, limit: 25 },
      true
    );
  });

  it('should return 404 when stockroom not found', async () => {
    (stockroomService.getStockroomInventory as jest.Mock).mockRejectedValue(
      new Error('Stockroom not found: a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    );

    const event = createMockEvent({
      pathParameters: { stockroomId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'NOT_FOUND',
      expect.stringContaining('not found'),
      'test-request-id'
    );
  });

  it('should return 500 on unexpected error', async () => {
    (stockroomService.getStockroomInventory as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const event = createMockEvent({
      pathParameters: { stockroomId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getStockroomInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'INTERNAL_ERROR',
      'Failed to get stockroom inventory',
      'test-request-id'
    );
  });
});

describe('updateInventory Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when inventoryId is missing', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: null,
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Inventory ID is required',
      'test-request-id'
    );
  });

  it('should return 400 when inventoryId is invalid UUID', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'invalid-uuid' },
      body: JSON.stringify({ quantityOnHand: 50 }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      expect.stringContaining('UUID'),
      'test-request-id'
    );
  });

  it('should return 400 when body is invalid JSON', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: 'invalid json',
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Invalid JSON in request body',
      'test-request-id'
    );
  });

  it('should return 400 when quantityOnHand is negative', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ quantityOnHand: -5 }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Validation failed',
      'test-request-id',
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('quantityOnHand') }),
      ])
    );
  });

  it('should update inventory successfully', async () => {
    const mockResult = {
      item: {
        inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stockroomId: 'sr-001',
        quantityOnHand: 60,
        quantityAvailable: 55,
      },
      alerts: [],
    };

    (stockroomService.updateInventory as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ quantityOnHand: 60 }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: { claims: { sub: 'user-001' } },
      },
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(stockroomService.updateInventory).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      { quantityOnHand: 60 },
      'user-001'
    );
    expect(createApiResponse).toHaveBeenCalledWith(
      { item: mockResult.item, alerts: mockResult.alerts },
      'test-request-id'
    );
  });

  it('should return alerts when stock falls below threshold', async () => {
    const mockResult = {
      item: {
        inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stockroomId: 'sr-001',
        quantityOnHand: 15,
        quantityAvailable: 15,
        reorderPoint: 20,
      },
      alerts: [
        {
          alertId: 'alert-001',
          alertType: 'LOW_STOCK',
          priority: 'HIGH',
          stockroomId: 'sr-001',
          inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          currentQuantity: 15,
          reorderPoint: 20,
          shortfall: 5,
        },
      ],
    };

    (stockroomService.updateInventory as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ quantityOnHand: 15 }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(createApiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        alerts: expect.arrayContaining([
          expect.objectContaining({ alertType: 'LOW_STOCK' }),
        ]),
      }),
      'test-request-id'
    );
  });

  it('should return 404 when inventory item not found', async () => {
    (stockroomService.updateInventory as jest.Mock).mockRejectedValue(
      new Error('Inventory item not found: a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    );

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ quantityOnHand: 50 }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'NOT_FOUND',
      expect.stringContaining('not found'),
      'test-request-id'
    );
  });

  it('should return 400 when insufficient inventory', async () => {
    (stockroomService.updateInventory as jest.Mock).mockRejectedValue(
      new Error('Insufficient inventory: current=10, adjustment=-15')
    );

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ quantityOnHand: -5 }),
    });

    // Note: This would be caught by validation, but testing service error handling
    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
  });

  it('should validate reorderQuantity is positive', async () => {
    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ reorderQuantity: 0 }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Validation failed',
      'test-request-id',
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('reorderQuantity') }),
      ])
    );
  });

  it('should accept null for optional fields', async () => {
    const mockResult = {
      item: {
        inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        stockroomId: 'sr-001',
        quantityOnHand: 50,
        reorderPoint: null,
      },
      alerts: [],
    };

    (stockroomService.updateInventory as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'PUT',
      pathParameters: { inventoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ reorderPoint: null, reorderQuantity: null }),
    });

    const result = await updateInventoryHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
  });
});
