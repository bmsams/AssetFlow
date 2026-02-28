/**
 * Disposal Handlers Unit Tests
 *
 * Tests for Disposal Lambda Handlers:
 * - initiate-disposal handler (Requirement 3.6)
 * - record-destruction handler (Requirement 3.7)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock the dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
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

// Mock the disposal service
jest.mock('../disposal/disposal-service', () => ({
  initiateDisposal: jest.fn(),
  recordDestruction: jest.fn(),
  getDisposalWorkflow: jest.fn(),
  validateDisposalRequirements: jest.fn(),
}));

import { handler as initiateDisposalHandler } from '../handlers/initiate-disposal';
import { handler as recordDestructionHandler } from '../handlers/record-destruction';
import * as disposalService from '../disposal/disposal-service';

const mockDisposalService = disposalService as jest.Mocked<typeof disposalService>;

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
    path: '/disposal',
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
      path: '/disposal',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource123',
      resourcePath: '/disposal',
    },
    resource: '/disposal',
    ...overrides,
  };
}

describe('Initiate Disposal Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when body is missing', async () => {
      const event = createMockEvent({
        body: null,
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when body is invalid JSON', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('should return 400 when assetId is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({}),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when assetId is not a valid UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: 'not-a-uuid',
        }),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when disposalMethod is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
          disposalMethod: 'INVALID_METHOD',
        }),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Successful Initiation', () => {
    it('should return 201 when disposal is initiated successfully', async () => {
      const mockWorkflow = {
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        workflowNumber: 'DSP-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'DATA_WIPE_PENDING',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174000',
        initiatedAt: '2024-01-15T10:00:00.000Z',
        dataWipeRequired: true,
        environmentalCheckRequired: true,
      };

      const mockTasks = [
        { taskId: '1', taskType: 'DATA_SANITIZATION', status: 'PENDING' },
        { taskId: '2', taskType: 'ENVIRONMENTAL_COMPLIANCE', status: 'PENDING' },
        { taskId: '3', taskType: 'VENDOR_PICKUP', status: 'PENDING' },
      ];

      mockDisposalService.initiateDisposal.mockResolvedValue({
        workflow: mockWorkflow as any,
        tasks: mockTasks as any,
      });

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
          disposalMethod: 'RECYCLED',
          dataWipeRequired: true,
          environmentalCheckRequired: true,
        }),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.workflow.workflowId).toBe(mockWorkflow.workflowId);
      expect(body.data.tasks.length).toBe(3);
    });

    it('should pass correct parameters to service', async () => {
      mockDisposalService.initiateDisposal.mockResolvedValue({
        workflow: { workflowId: 'test' } as any,
        tasks: [],
      });

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
          disposalMethod: 'DESTROYED',
          dataWipeRequired: false,
          notes: 'Test disposal',
        }),
      });

      await initiateDisposalHandler(event);

      expect(mockDisposalService.initiateDisposal).toHaveBeenCalledWith({
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        initiatedBy: '123e4567-e89b-12d3-a456-426614174000',
        disposalMethod: 'DESTROYED',
        dataWipeRequired: false,
        environmentalCheckRequired: undefined,
        notes: 'Test disposal',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 409 when asset already has active disposal workflow', async () => {
      mockDisposalService.initiateDisposal.mockRejectedValue(
        new Error('Asset 123e4567-e89b-12d3-a456-426614174001 already has an active disposal workflow')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should return 500 for unexpected errors', async () => {
      mockDisposalService.initiateDisposal.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const result = await initiateDisposalHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

describe('Record Destruction Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(401);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Request Validation', () => {
    it('should return 400 when workflowId is missing', async () => {
      const event = createMockEvent({
        pathParameters: null,
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when workflowId is not a valid UUID', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: 'not-a-uuid',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when destructionDate is missing', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when destructionDate is invalid format', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '15-01-2024', // Wrong format
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when destructionMethod is missing', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when destructionMethod is invalid', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'INVALID_METHOD',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });

    it('should return 400 when verifiedBy is missing', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
    });
  });

  describe('Successful Recording', () => {
    it('should return 200 when destruction is recorded successfully', async () => {
      const mockWorkflow = {
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        workflowNumber: 'DSP-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        status: 'COMPLETED',
        completedAt: '2024-01-15T10:00:00.000Z',
      };

      const mockCertificate = {
        certificateId: '123e4567-e89b-12d3-a456-426614174003',
        certificateNumber: 'CERT-ABC123-XYZ',
        assetId: '123e4567-e89b-12d3-a456-426614174001',
        workflowId: '123e4567-e89b-12d3-a456-426614174002',
        destructionDate: '2024-01-15',
        destructionMethod: 'DESTROYED',
      };

      mockDisposalService.recordDestruction.mockResolvedValue({
        workflow: mockWorkflow as any,
        certificate: mockCertificate as any,
        assetUpdated: true,
      });

      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
          vendorName: 'Secure Disposal Inc.',
          notes: 'Asset destroyed per policy',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(true);
      expect(body.data.workflow.status).toBe('COMPLETED');
      expect(body.data.certificate.certificateNumber).toBe('CERT-ABC123-XYZ');
    });

    it('should pass correct parameters to service', async () => {
      mockDisposalService.recordDestruction.mockResolvedValue({
        workflow: { workflowId: 'test' } as any,
        certificate: { certificateId: 'test' } as any,
        assetUpdated: true,
      });

      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'RECYCLED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174003',
          vendorId: '123e4567-e89b-12d3-a456-426614174004',
          vendorName: 'Green Recycling Co.',
          documentUrl: 'https://example.com/cert.pdf',
        }),
      });

      await recordDestructionHandler(event);

      expect(mockDisposalService.recordDestruction).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174002',
        {
          destructionDate: '2024-01-15',
          destructionMethod: 'RECYCLED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174003',
          vendorId: '123e4567-e89b-12d3-a456-426614174004',
          vendorName: 'Green Recycling Co.',
          serialNumber: undefined,
          assetTag: undefined,
          documentUrl: 'https://example.com/cert.pdf',
          notes: undefined,
        },
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when workflow is not found', async () => {
      mockDisposalService.recordDestruction.mockRejectedValue(
        new Error('Disposal workflow not found: 123e4567-e89b-12d3-a456-426614174002')
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 409 when workflow is in invalid state', async () => {
      mockDisposalService.recordDestruction.mockRejectedValue(
        new Error('Cannot record destruction for workflow in status: COMPLETED')
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(409);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
    });

    it('should return 500 for unexpected errors', async () => {
      mockDisposalService.recordDestruction.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: '123e4567-e89b-12d3-a456-426614174002',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: '123e4567-e89b-12d3-a456-426614174000',
        }),
      });

      const result = await recordDestructionHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

