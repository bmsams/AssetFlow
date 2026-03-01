/**
 * Contract Handlers Unit Tests
 *
 * Tests for Contract Lambda Handlers:
 * - create-contract handler (Requirement 6A.1, 6A.2)
 * - update-contract handler (Requirement 6A.1, 6A.2)
 * - get-contracts-by-vendor handler (Requirement 6A.1)
 */

import { APIGatewayProxyEvent } from 'aws-lambda';

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
    if (typeof value !== 'string' || !uuidRegex.test(value)) {
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

// Mock the contract service
jest.mock('../contract/contract-service', () => ({
  createContract: jest.fn(),
  updateContract: jest.fn(),
  getContract: jest.fn(),
  getContractWithLinks: jest.fn(),
  getContractsByVendor: jest.fn(),
  getContracts: jest.fn(),
  VALID_CONTRACT_TYPES: ['PURCHASE', 'LEASE', 'MAINTENANCE', 'SUPPORT', 'LICENSE', 'WARRANTY'],
  VALID_CONTRACT_STATUSES: ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED'],
}));

import { handler as createContractHandler } from '../handlers/create-contract';
import { handler as updateContractHandler } from '../handlers/update-contract';
import { handler as getContractsByVendorHandler, getContractHandler, listContractsHandler } from '../handlers/get-contracts-by-vendor';
import * as contractService from '../contract/contract-service';

const mockContractService = contractService as jest.Mocked<typeof contractService>;

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
    path: '/contracts',
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
      path: '/contracts',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource123',
      resourcePath: '/contracts',
    },
    resource: '/contracts',
    ...overrides,
  };
}


describe('Create Contract Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when body is missing', async () => {
      const event = createMockEvent({ body: null });
      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({ body: 'invalid json' });
      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('should return 400 when vendorId is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          contractType: 'MAINTENANCE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when contractType is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when contractType is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'INVALID_TYPE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when startDate is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          endDate: '2025-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when endDate is before startDate', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          startDate: '2025-01-01',
          endDate: '2024-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when totalValue is negative', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          totalValue: -100,
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('Successful Creation', () => {
    it('should return 201 when contract is created successfully', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174002',
        contractNumber: 'CON-ABC123-XYZ',
        vendorId: '123e4567-e89b-12d3-a456-426614174001',
        contractType: 'MAINTENANCE',
        startDate: '2024-01-01',
        endDate: '2025-01-01',
        status: 'DRAFT',
        totalValue: 10000,
      };

      mockContractService.createContract.mockResolvedValue(mockContract as any);

      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          contractName: 'Annual Maintenance Agreement',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          totalValue: 10000,
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.contractNumber).toBe('CON-ABC123-XYZ');
      expect(body.data.contractType).toBe('MAINTENANCE');
    });

    it('should support all contract types', async () => {
      const contractTypes = ['PURCHASE', 'LEASE', 'MAINTENANCE', 'SUPPORT', 'LICENSE', 'WARRANTY'];

      for (const contractType of contractTypes) {
        const mockContract = {
          contractId: '123e4567-e89b-12d3-a456-426614174002',
          contractNumber: `CON-${contractType}-XYZ`,
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType,
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          status: 'DRAFT',
        };

        mockContractService.createContract.mockResolvedValue(mockContract as any);

        const event = createMockEvent({
          body: JSON.stringify({
            vendorId: '123e4567-e89b-12d3-a456-426614174001',
            contractType,
            startDate: '2024-01-01',
            endDate: '2025-01-01',
          }),
        });

        const result = await createContractHandler(event);

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.data.contractType).toBe(contractType);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockContractService.createContract.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          vendorId: '123e4567-e89b-12d3-a456-426614174001',
          contractType: 'MAINTENANCE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
        }),
      });

      const result = await createContractHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});


describe('Update Contract Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({ status: 'ACTIVE' }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when contractId is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: null,
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when contractId is not a valid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: 'not-a-uuid' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when no update fields provided', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({}),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when status is invalid', async () => {
      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({ status: 'INVALID_STATUS' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Update', () => {
    it('should return 200 when contract is updated successfully', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
        status: 'ACTIVE',
        contractType: 'MAINTENANCE',
      };

      mockContractService.updateContract.mockResolvedValue(mockContract as any);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ACTIVE');
    });
  });

  describe('Not Found', () => {
    it('should return 404 when contract not found', async () => {
      mockContractService.updateContract.mockRejectedValue(
        new Error('Contract not found: 123e4567-e89b-12d3-a456-426614174001')
      );

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Invalid Status Transition', () => {
    it('should return 400 for invalid status transition', async () => {
      mockContractService.updateContract.mockRejectedValue(
        new Error('Invalid status transition from TERMINATED to ACTIVE')
      );

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      const result = await updateContractHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });
});


describe('Get Contracts by Vendor Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should list all contracts when vendorId is missing', async () => {
      mockContractService.getContracts.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: null,
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockContractService.getContracts).toHaveBeenCalledWith(
        { page: 1, limit: 50 },
        undefined,
        undefined
      );
    });

    it('should return 400 when vendorId is not a valid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: 'not-a-uuid' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid page parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { page: '-1' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { limit: '200' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid status filter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { status: 'INVALID_STATUS' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid type filter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { type: 'INVALID_TYPE' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Retrieval', () => {
    it('should return 200 with paginated contracts', async () => {
      const mockResult = {
        items: [
          { contractId: 'con-1', contractNumber: 'CON-001', contractType: 'MAINTENANCE', status: 'ACTIVE' },
          { contractId: 'con-2', contractNumber: 'CON-002', contractType: 'SUPPORT', status: 'ACTIVE' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockContractService.getContractsByVendor.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBe(2);
      expect(body.data.total).toBe(2);
    });

    it('should handle pagination parameters', async () => {
      mockContractService.getContractsByVendor.mockResolvedValue({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { page: '2', limit: '10' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockContractService.getContractsByVendor).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001',
        { page: 2, limit: 10 },
        undefined,
        undefined
      );
    });

    it('should handle status filter', async () => {
      mockContractService.getContractsByVendor.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { status: 'ACTIVE,EXPIRED' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockContractService.getContractsByVendor).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001',
        { page: 1, limit: 50 },
        ['ACTIVE', 'EXPIRED'],
        undefined
      );
    });

    it('should handle type filter', async () => {
      mockContractService.getContractsByVendor.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      } as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { vendorId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { type: 'MAINTENANCE,SUPPORT' },
      });

      const result = await getContractsByVendorHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockContractService.getContractsByVendor).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001',
        { page: 1, limit: 50 },
        undefined,
        ['MAINTENANCE', 'SUPPORT']
      );
    });
  });
});


describe('Get Contract Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when contractId is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: null,
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when contractId is not a valid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { contractId: 'not-a-uuid' },
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Successful Retrieval', () => {
    it('should return 200 with contract details', async () => {
      const mockContract = {
        contractId: '123e4567-e89b-12d3-a456-426614174001',
        contractNumber: 'CON-ABC123-XYZ',
        contractType: 'MAINTENANCE',
        status: 'ACTIVE',
        vendorId: '123e4567-e89b-12d3-a456-426614174002',
      };

      mockContractService.getContract.mockResolvedValue(mockContract as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.contract.contractNumber).toBe('CON-ABC123-XYZ');
    });

    it('should include links when requested', async () => {
      const mockResult = {
        contract: {
          contractId: '123e4567-e89b-12d3-a456-426614174001',
          contractNumber: 'CON-ABC123-XYZ',
          contractType: 'MAINTENANCE',
          status: 'ACTIVE',
        },
        assets: [{ linkId: 'link-1', assetId: 'asset-1' }],
        entitlements: [{ linkId: 'link-2', entitlementId: 'ent-1' }],
      };

      mockContractService.getContractWithLinks.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
        queryStringParameters: { includeLinks: 'true' },
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.assets.length).toBe(1);
      expect(body.data.entitlements.length).toBe(1);
    });
  });

  describe('Not Found', () => {
    it('should return 404 when contract not found', async () => {
      mockContractService.getContract.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { contractId: '123e4567-e89b-12d3-a456-426614174001' },
      });

      const result = await getContractHandler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

describe('List Contracts Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful Listing', () => {
    it('should return 200 with paginated contracts', async () => {
      const mockResult = {
        items: [
          { contractId: 'con-1', contractNumber: 'CON-001', contractType: 'MAINTENANCE' },
          { contractId: 'con-2', contractNumber: 'CON-002', contractType: 'SUPPORT' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        hasMore: false,
      };

      mockContractService.getContracts.mockResolvedValue(mockResult as any);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await listContractsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBe(2);
    });
  });
});
