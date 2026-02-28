/**
 * Loaner Handlers Unit Tests
 *
 * Tests for Loaner Lambda Handlers:
 * - Checkout loaner handler (Requirement 3.8)
 * - Return loaner handler (Requirement 3.8)
 * - Get overdue loans handler (Requirement 3.8, 3.9)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the dependencies before importing handlers
jest.mock('../loaner/loaner-service');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  validateUUID: jest.fn((value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  }),
}));

import { handler as checkoutHandler } from '../handlers/checkout-loaner';
import { handler as returnHandler } from '../handlers/return-loaner';
import { handler as getOverdueHandler } from '../handlers/get-overdue-loans';
import * as loanerService from '../loaner/loaner-service';

const mockLoanerService = loanerService as jest.Mocked<typeof loanerService>;

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
    path: '/loaners',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: '550e8400-e29b-41d4-a716-446655440000',
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
      path: '/loaners',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/loaners',
    },
    resource: '/loaners',
    ...overrides,
  };
}

describe('checkout-loaner handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful checkout', () => {
    it('should checkout a loaner successfully', async () => {
      const mockCheckout = {
        checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        checkoutNumber: 'LN-ABC123',
        assetId: '550e8400-e29b-41d4-a716-446655440002',
        checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
        checkedOutBy: '550e8400-e29b-41d4-a716-446655440000',
        checkoutDate: '2024-01-15T10:00:00.000Z',
        dueDate: '2024-01-22',
        returnDate: null,
        conditionOut: 'GOOD' as const,
        status: 'CHECKED_OUT' as const,
        isOverdue: false,
        escalationLevel: 0,
      };

      mockLoanerService.checkoutLoaner.mockResolvedValue({
        checkout: mockCheckout as any,
      });

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'GOOD',
        }),
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(201);
      expect(mockLoanerService.checkoutLoaner).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'GOOD',
          checkedOutBy: '550e8400-e29b-41d4-a716-446655440000',
        })
      );
    });
  });

  describe('validation errors', () => {
    it('should return 400 when assetId is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'GOOD',
        }),
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when dueDate is invalid format', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '01-22-2024', // Wrong format
          conditionOut: 'GOOD',
        }),
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when conditionOut is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'INVALID_CONDITION',
        }),
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({
        body: 'not valid json',
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'GOOD',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('service errors', () => {
    it('should return 409 when asset is not available', async () => {
      mockLoanerService.checkoutLoaner.mockRejectedValue(
        new Error('Asset 550e8400-e29b-41d4-a716-446655440002 is not available for checkout')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '550e8400-e29b-41d4-a716-446655440002',
          checkedOutTo: '550e8400-e29b-41d4-a716-446655440003',
          dueDate: '2024-01-22',
          conditionOut: 'GOOD',
        }),
      });

      const result = await checkoutHandler(event);

      expect(result.statusCode).toBe(409);
    });
  });
});

describe('return-loaner handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful return', () => {
    it('should return a loaner successfully', async () => {
      const mockResult = {
        checkout: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
          status: 'RETURNED' as const,
          conditionIn: 'GOOD' as const,
        },
        wasOverdue: false,
        daysOverdue: 0,
        totalCharges: null,
      };

      mockLoanerService.returnLoaner.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        },
        body: JSON.stringify({
          conditionIn: 'GOOD',
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockLoanerService.returnLoaner).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        expect.objectContaining({
          conditionIn: 'GOOD',
          returnedBy: '550e8400-e29b-41d4-a716-446655440000',
        })
      );
    });

    it('should return a loaner with damage charges', async () => {
      const mockResult = {
        checkout: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
          status: 'RETURNED_DAMAGED' as const,
          conditionIn: 'DAMAGED' as const,
        },
        wasOverdue: true,
        daysOverdue: 5,
        totalCharges: 150.00,
      };

      mockLoanerService.returnLoaner.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        },
        body: JSON.stringify({
          conditionIn: 'DAMAGED',
          conditionInNotes: 'Screen cracked',
          damageCharges: 100.00,
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('validation errors', () => {
    it('should return 400 when checkoutId is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: null,
        body: JSON.stringify({
          conditionIn: 'GOOD',
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when checkoutId is invalid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: 'not-a-uuid',
        },
        body: JSON.stringify({
          conditionIn: 'GOOD',
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when conditionIn is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        },
        body: JSON.stringify({}),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('service errors', () => {
    it('should return 404 when checkout not found', async () => {
      mockLoanerService.returnLoaner.mockRejectedValue(
        new Error('Checkout not found: 550e8400-e29b-41d4-a716-446655440001')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        },
        body: JSON.stringify({
          conditionIn: 'GOOD',
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 when checkout already returned', async () => {
      mockLoanerService.returnLoaner.mockRejectedValue(
        new Error('Cannot return loaner with status: RETURNED')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          checkoutId: '550e8400-e29b-41d4-a716-446655440001',
        },
        body: JSON.stringify({
          conditionIn: 'GOOD',
        }),
      });

      const result = await returnHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });
});

describe('get-overdue-loans handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('successful retrieval', () => {
    it('should return overdue loans with summary', async () => {
      const mockResult = {
        loans: {
          items: [
            {
              checkout: {
                checkoutId: '550e8400-e29b-41d4-a716-446655440001',
                dueDate: '2024-01-10',
                status: 'OVERDUE',
                escalationLevel: 2,
              },
              daysOverdue: 5,
              borrowerEmail: 'user@example.com',
              borrowerName: 'John Doe',
              managerEmail: 'manager@example.com',
              managerName: 'Jane Manager',
              assetTag: 'AST-001',
              assetName: 'Laptop',
            },
          ],
          total: 1,
          page: 1,
          limit: 50,
          hasMore: false,
        },
        summary: {
          totalOverdue: 1,
          level1Count: 0,
          level2Count: 1,
          level3Count: 0,
        },
      };

      mockLoanerService.getOverdueLoans.mockResolvedValue(mockResult as any);
      mockLoanerService.getEscalationLevel.mockReturnValue(2);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: null,
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.summary.totalOverdue).toBe(1);
      expect(body.data.loans).toHaveLength(1);
    });

    it('should handle pagination parameters', async () => {
      const mockResult = {
        loans: {
          items: [],
          total: 0,
          page: 2,
          limit: 25,
          hasMore: false,
        },
        summary: {
          totalOverdue: 0,
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
        },
      };

      mockLoanerService.getOverdueLoans.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          page: '2',
          limit: '25',
        },
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockLoanerService.getOverdueLoans).toHaveBeenCalledWith({
        page: 2,
        limit: 25,
      });
    });

    it('should return empty list when no overdue loans', async () => {
      const mockResult = {
        loans: {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
          hasMore: false,
        },
        summary: {
          totalOverdue: 0,
          level1Count: 0,
          level2Count: 0,
          level3Count: 0,
        },
      };

      mockLoanerService.getOverdueLoans.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.loans).toHaveLength(0);
      expect(body.data.summary.totalOverdue).toBe(0);
    });
  });

  describe('pagination validation', () => {
    it('should default to page 1 when invalid page provided', async () => {
      const mockResult = {
        loans: { items: [], total: 0, page: 1, limit: 50, hasMore: false },
        summary: { totalOverdue: 0, level1Count: 0, level2Count: 0, level3Count: 0 },
      };

      mockLoanerService.getOverdueLoans.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          page: 'invalid',
        },
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockLoanerService.getOverdueLoans).toHaveBeenCalledWith({
        page: 1,
        limit: 50,
      });
    });

    it('should cap limit at 100', async () => {
      const mockResult = {
        loans: { items: [], total: 0, page: 1, limit: 100, hasMore: false },
        summary: { totalOverdue: 0, level1Count: 0, level2Count: 0, level3Count: 0 },
      };

      mockLoanerService.getOverdueLoans.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          limit: '500',
        },
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockLoanerService.getOverdueLoans).toHaveBeenCalledWith({
        page: 1,
        limit: 100,
      });
    });
  });

  describe('service errors', () => {
    it('should return 500 on service error', async () => {
      mockLoanerService.getOverdueLoans.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await getOverdueHandler(event);

      expect(result.statusCode).toBe(500);
    });
  });
});
