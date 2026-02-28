/**
 * Transition State Handler Unit Tests
 *
 * Tests for the asset lifecycle state machine implementation
 * Validates Requirements: 2.4, 9.2
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
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
    CONFLICT: 'CONFLICT',
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

// Import handler after mocks are set up
import { handler } from '../handlers/transition-state';

// Mock the asset service module
jest.mock('../service/asset-service', () => {
  const originalModule = jest.requireActual('../service/asset-service');
  return {
    ...originalModule,
    transitionState: jest.fn(),
    isValidStateTransition: originalModule.isValidStateTransition,
    getValidTransitions: originalModule.getValidTransitions,
    getStateDescription: originalModule.getStateDescription,
    isTerminalState: originalModule.isTerminalState,
    StateTransitionError: originalModule.StateTransitionError,
  };
});

import * as assetService from '../service/asset-service';
import { StateTransitionError } from '../service/asset-service';

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
    path: '/assets/{assetId}/transition',
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
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/assets/{assetId}/transition',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/assets/{assetId}/transition',
    },
    resource: '/assets/{assetId}/transition',
    ...overrides,
  };
}

describe('Transition State Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful State Transitions', () => {
    /**
     * Validates: Requirements 2.4, 9.2
     * Tests ORDERED → RECEIVED transition
     */
    it('should transition from ORDERED to RECEIVED', async () => {
      const mockAsset = {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        assetTag: 'AMS-HW-20240115-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'RECEIVED',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      (assetService.transitionState as jest.Mock).mockResolvedValue(mockAsset);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'RECEIVED',
          reason: 'Asset received at warehouse',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(assetService.transitionState).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'RECEIVED',
        'user-123',
        'Asset received at warehouse'
      );
    });

    /**
     * Validates: Requirements 2.4
     * Tests RECEIVED → IN_STOCK transition
     */
    it('should transition from RECEIVED to IN_STOCK', async () => {
      const mockAsset = {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        assetTag: 'AMS-HW-20240115-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'IN_STOCK',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      (assetService.transitionState as jest.Mock).mockResolvedValue(mockAsset);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'IN_STOCK',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    /**
     * Validates: Requirements 2.4
     * Tests IN_STOCK → DEPLOYED transition
     */
    it('should transition from IN_STOCK to DEPLOYED', async () => {
      const mockAsset = {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        assetTag: 'AMS-HW-20240115-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'DEPLOYED',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      (assetService.transitionState as jest.Mock).mockResolvedValue(mockAsset);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'DEPLOYED',
          reason: 'Deployed to user John Doe',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    /**
     * Validates: Requirements 2.4
     * Tests DEPLOYED → IN_MAINTENANCE transition
     */
    it('should transition from DEPLOYED to IN_MAINTENANCE', async () => {
      const mockAsset = {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        assetTag: 'AMS-HW-20240115-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'IN_MAINTENANCE',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      (assetService.transitionState as jest.Mock).mockResolvedValue(mockAsset);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'IN_MAINTENANCE',
          reason: 'Scheduled maintenance',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });

    /**
     * Validates: Requirements 2.4
     * Tests RETIRED → DISPOSED transition (terminal state)
     */
    it('should transition from RETIRED to DISPOSED', async () => {
      const mockAsset = {
        assetId: '550e8400-e29b-41d4-a716-446655440000',
        assetTag: 'AMS-HW-20240115-ABC123',
        assetType: 'HARDWARE',
        displayName: 'Test Laptop',
        status: 'DISPOSED',
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T11:00:00.000Z',
      };

      (assetService.transitionState as jest.Mock).mockResolvedValue(mockAsset);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'DISPOSED',
          reason: 'Asset disposed per policy',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Invalid State Transitions', () => {
    /**
     * Validates: Requirements 2.4
     * Tests that ORDERED cannot transition directly to DEPLOYED
     */
    it('should return 409 for invalid transition ORDERED → DEPLOYED', async () => {
      const error = new StateTransitionError('ORDERED', 'DEPLOYED', ['RECEIVED']);
      (assetService.transitionState as jest.Mock).mockRejectedValue(error);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'DEPLOYED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(409);
    });

    /**
     * Validates: Requirements 2.4
     * Tests that DISPOSED is a terminal state
     */
    it('should return 409 when trying to transition from DISPOSED', async () => {
      const error = new StateTransitionError('DISPOSED', 'IN_STOCK', []);
      (assetService.transitionState as jest.Mock).mockRejectedValue(error);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'IN_STOCK',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(409);
    });

    /**
     * Validates: Requirements 2.4
     * Tests that IN_STOCK cannot transition to ORDERED (backward)
     */
    it('should return 409 for backward transition IN_STOCK → ORDERED', async () => {
      const error = new StateTransitionError('IN_STOCK', 'ORDERED', ['RESERVED', 'DEPLOYED', 'RETIRED']);
      (assetService.transitionState as jest.Mock).mockRejectedValue(error);

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'ORDERED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(409);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for missing asset ID', async () => {
      const event = createMockEvent({
        pathParameters: null,
        body: JSON.stringify({
          newState: 'RECEIVED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid UUID format', async () => {
      const event = createMockEvent({
        pathParameters: {
          assetId: 'invalid-uuid',
        },
        body: JSON.stringify({
          newState: 'RECEIVED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for missing request body', async () => {
      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: null,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: 'invalid json',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent asset', async () => {
      (assetService.transitionState as jest.Mock).mockRejectedValue(
        new Error('Asset not found: 550e8400-e29b-41d4-a716-446655440000')
      );

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'RECEIVED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 500 for unexpected errors', async () => {
      (assetService.transitionState as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        pathParameters: {
          assetId: '550e8400-e29b-41d4-a716-446655440000',
        },
        body: JSON.stringify({
          newState: 'RECEIVED',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});

describe('State Transition Validation Functions', () => {
  const { isValidStateTransition, getValidTransitions, isTerminalState, getStateDescription } = 
    jest.requireActual('../service/asset-service');

  describe('isValidStateTransition', () => {
    /**
     * Validates: Requirements 2.4
     * Tests all valid state transitions
     */
    it('should allow ORDERED → RECEIVED', () => {
      expect(isValidStateTransition('ORDERED', 'RECEIVED')).toBe(true);
    });

    it('should allow RECEIVED → IN_STOCK', () => {
      expect(isValidStateTransition('RECEIVED', 'IN_STOCK')).toBe(true);
    });

    it('should allow IN_STOCK → RESERVED', () => {
      expect(isValidStateTransition('IN_STOCK', 'RESERVED')).toBe(true);
    });

    it('should allow IN_STOCK → DEPLOYED', () => {
      expect(isValidStateTransition('IN_STOCK', 'DEPLOYED')).toBe(true);
    });

    it('should allow IN_STOCK → RETIRED', () => {
      expect(isValidStateTransition('IN_STOCK', 'RETIRED')).toBe(true);
    });

    it('should allow RESERVED → IN_STOCK', () => {
      expect(isValidStateTransition('RESERVED', 'IN_STOCK')).toBe(true);
    });

    it('should allow RESERVED → DEPLOYED', () => {
      expect(isValidStateTransition('RESERVED', 'DEPLOYED')).toBe(true);
    });

    it('should allow DEPLOYED → IN_STOCK', () => {
      expect(isValidStateTransition('DEPLOYED', 'IN_STOCK')).toBe(true);
    });

    it('should allow DEPLOYED → IN_MAINTENANCE', () => {
      expect(isValidStateTransition('DEPLOYED', 'IN_MAINTENANCE')).toBe(true);
    });

    it('should allow DEPLOYED → RETIRED', () => {
      expect(isValidStateTransition('DEPLOYED', 'RETIRED')).toBe(true);
    });

    it('should allow IN_MAINTENANCE → DEPLOYED', () => {
      expect(isValidStateTransition('IN_MAINTENANCE', 'DEPLOYED')).toBe(true);
    });

    it('should allow IN_MAINTENANCE → RETIRED', () => {
      expect(isValidStateTransition('IN_MAINTENANCE', 'RETIRED')).toBe(true);
    });

    it('should allow RETIRED → DISPOSED', () => {
      expect(isValidStateTransition('RETIRED', 'DISPOSED')).toBe(true);
    });

    /**
     * Validates: Requirements 2.4
     * Tests invalid state transitions
     */
    it('should not allow ORDERED → DEPLOYED (skip states)', () => {
      expect(isValidStateTransition('ORDERED', 'DEPLOYED')).toBe(false);
    });

    it('should not allow DISPOSED → any state (terminal)', () => {
      expect(isValidStateTransition('DISPOSED', 'ORDERED')).toBe(false);
      expect(isValidStateTransition('DISPOSED', 'IN_STOCK')).toBe(false);
      expect(isValidStateTransition('DISPOSED', 'DEPLOYED')).toBe(false);
    });

    it('should not allow same state transition', () => {
      expect(isValidStateTransition('ORDERED', 'ORDERED')).toBe(false);
      expect(isValidStateTransition('DEPLOYED', 'DEPLOYED')).toBe(false);
    });

    it('should not allow backward transitions in early lifecycle', () => {
      expect(isValidStateTransition('RECEIVED', 'ORDERED')).toBe(false);
      expect(isValidStateTransition('IN_STOCK', 'RECEIVED')).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for ORDERED', () => {
      expect(getValidTransitions('ORDERED')).toEqual(['RECEIVED']);
    });

    it('should return valid transitions for IN_STOCK', () => {
      expect(getValidTransitions('IN_STOCK')).toEqual(['RESERVED', 'DEPLOYED', 'RETIRED']);
    });

    it('should return empty array for DISPOSED', () => {
      expect(getValidTransitions('DISPOSED')).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for DISPOSED', () => {
      expect(isTerminalState('DISPOSED')).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isTerminalState('ORDERED')).toBe(false);
      expect(isTerminalState('DEPLOYED')).toBe(false);
      expect(isTerminalState('RETIRED')).toBe(false);
    });
  });

  describe('getStateDescription', () => {
    it('should return description for ORDERED', () => {
      expect(getStateDescription('ORDERED')).toContain('ordered');
    });

    it('should return description for DISPOSED', () => {
      expect(getStateDescription('DISPOSED')).toContain('terminal');
    });
  });
});

describe('StateTransitionError', () => {
  const { StateTransitionError } = jest.requireActual('../service/asset-service');

  it('should create error with valid transitions info', () => {
    const error = new StateTransitionError('ORDERED', 'DEPLOYED', ['RECEIVED']);
    
    expect(error.currentState).toBe('ORDERED');
    expect(error.attemptedState).toBe('DEPLOYED');
    expect(error.validTransitions).toEqual(['RECEIVED']);
    expect(error.isTerminalState).toBe(false);
    expect(error.message).toContain('ORDERED');
    expect(error.message).toContain('DEPLOYED');
    expect(error.message).toContain('RECEIVED');
  });

  it('should indicate terminal state in error', () => {
    const error = new StateTransitionError('DISPOSED', 'IN_STOCK', []);
    
    expect(error.isTerminalState).toBe(true);
    expect(error.message).toContain('terminal');
  });

  it('should handle same state transition', () => {
    const error = new StateTransitionError('DEPLOYED', 'DEPLOYED', ['IN_STOCK', 'IN_MAINTENANCE', 'RETIRED']);
    
    expect(error.message).toContain('already');
  });
});
