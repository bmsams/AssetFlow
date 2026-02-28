/**
 * Retirement Handlers Unit Tests
 *
 * Tests for Retirement Lambda Handlers:
 * - Initiate Retirement Handler (Requirement 6.8)
 * - Complete Disposal Handler (Requirement 6.9)
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

// Mock the retirement service
jest.mock('../retirement/retirement-service');

import { handler as initiateRetirementHandler } from '../handlers/initiate-retirement';
import { handler as completeDisposalHandler } from '../handlers/complete-disposal';
import * as retirementService from '../retirement/retirement-service';

const mockRetirementService = retirementService as jest.Mocked<typeof retirementService>;

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

// Test data constants
const VALID_ASSET_ID = '123e4567-e89b-12d3-a456-426614174001';
const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_WORKFLOW_ID = '123e4567-e89b-12d3-a456-426614174010';
const VALID_VERIFIER_ID = '123e4567-e89b-12d3-a456-426614174002';

describe('Initiate Retirement Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful retirement initiation', () => {
    it('should initiate retirement for valid request', async () => {
      const mockResult = {
        workflow: {
          workflowId: VALID_WORKFLOW_ID,
          workflowNumber: 'RET-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-001',
          assetName: 'MacBook Pro',
          status: 'DATA_WIPE_PENDING' as const,
          retirementReason: 'End of life',
          disposalMethod: 'RECYCLED' as const,
          initiatedBy: VALID_USER_ID,
          initiatedAt: '2024-01-15T10:00:00.000Z',
          approvedBy: null,
          approvedAt: null,
          dataWipeRequired: true,
          dataWipeCompletedAt: null,
          dataWipeVerifiedBy: null,
          disposalCompletedAt: null,
          disposalCompletedBy: null,
          destructionCertificateId: null,
          notes: 'Test retirement',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        tasks: [
          {
            taskId: '123e4567-e89b-12d3-a456-426614174020',
            workflowId: VALID_WORKFLOW_ID,
            taskType: 'DATA_SANITIZATION' as const,
            taskName: 'Data Sanitization',
            description: 'Perform secure data wipe',
            status: 'PENDING' as const,
            assignedTo: null,
            dueDate: null,
            completedAt: null,
            completedBy: null,
            completionNotes: null,
            sequence: 1,
            isRequired: true,
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      };

      mockRetirementService.initiateRetirement.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          retirementReason: 'End of life',
          disposalMethod: 'RECYCLED',
          dataWipeRequired: true,
          notes: 'Test retirement',
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.workflow.assetId).toBe(VALID_ASSET_ID);
      expect(body.data.workflow.status).toBe('DATA_WIPE_PENDING');
      expect(body.data.tasks.length).toBe(1);
    });

    it('should initiate retirement with minimal required fields', async () => {
      const mockResult = {
        workflow: {
          workflowId: VALID_WORKFLOW_ID,
          workflowNumber: 'RET-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-001',
          assetName: null,
          status: 'DATA_WIPE_PENDING' as const,
          retirementReason: null,
          disposalMethod: null,
          initiatedBy: VALID_USER_ID,
          initiatedAt: '2024-01-15T10:00:00.000Z',
          approvedBy: null,
          approvedAt: null,
          dataWipeRequired: true,
          dataWipeCompletedAt: null,
          dataWipeVerifiedBy: null,
          disposalCompletedAt: null,
          disposalCompletedBy: null,
          destructionCertificateId: null,
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        tasks: [],
      };

      mockRetirementService.initiateRetirement.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing assetId', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          retirementReason: 'End of life',
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid assetId UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: 'invalid-uuid',
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid disposalMethod', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          disposalMethod: 'INVALID_METHOD',
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('disposalMethod must be one of');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid JSON in request body');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent asset', async () => {
      mockRetirementService.initiateRetirement.mockRejectedValue(
        new Error(`Asset not found: ${VALID_ASSET_ID}`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 409 for asset with active retirement workflow', async () => {
      mockRetirementService.initiateRetirement.mockRejectedValue(
        new Error(`Asset ${VALID_ASSET_ID} already has an active retirement workflow`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(409);
    });

    it('should return 400 for asset in non-retirable status', async () => {
      mockRetirementService.initiateRetirement.mockRejectedValue(
        new Error('Asset cannot be retired from status: DISPOSED. Must be one of: DEPLOYED, IN_STOCK, IN_MAINTENANCE')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await initiateRetirementHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });
});


describe('Complete Disposal Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful disposal completion', () => {
    it('should complete disposal for valid request', async () => {
      const mockResult = {
        workflow: {
          workflowId: VALID_WORKFLOW_ID,
          workflowNumber: 'RET-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-001',
          assetName: 'MacBook Pro',
          status: 'COMPLETED' as const,
          retirementReason: 'End of life',
          disposalMethod: 'DESTROYED' as const,
          initiatedBy: VALID_USER_ID,
          initiatedAt: '2024-01-15T10:00:00.000Z',
          approvedBy: null,
          approvedAt: null,
          dataWipeRequired: true,
          dataWipeCompletedAt: '2024-01-15T11:00:00.000Z',
          dataWipeVerifiedBy: VALID_VERIFIER_ID,
          disposalCompletedAt: '2024-01-15T12:00:00.000Z',
          disposalCompletedBy: VALID_USER_ID,
          destructionCertificateId: '123e4567-e89b-12d3-a456-426614174030',
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T12:00:00.000Z',
        },
        certificate: {
          certificateId: '123e4567-e89b-12d3-a456-426614174030',
          certificateNumber: 'CERT-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          workflowId: VALID_WORKFLOW_ID,
          vendorId: null,
          vendorName: 'Secure Disposal Inc',
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED' as const,
          serialNumber: 'SN12345',
          assetTag: 'AST-001',
          documentUrl: 'https://example.com/cert.pdf',
          verifiedBy: VALID_VERIFIER_ID,
          verifiedAt: '2024-01-15T12:00:00.000Z',
          notes: 'Destruction verified',
          createdAt: '2024-01-15T12:00:00.000Z',
          createdBy: VALID_USER_ID,
        },
        assetUpdated: true,
      };

      mockRetirementService.completeDisposal.mockResolvedValue(mockResult);

      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
          vendorName: 'Secure Disposal Inc',
          serialNumber: 'SN12345',
          assetTag: 'AST-001',
          documentUrl: 'https://example.com/cert.pdf',
          notes: 'Destruction verified',
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.workflow.status).toBe('COMPLETED');
      expect(body.data.certificate.certificateNumber).toBe('CERT-ABC123-XYZ');
      expect(body.data.assetUpdated).toBe(true);
    });

    it('should complete disposal with minimal required fields', async () => {
      const mockResult = {
        workflow: {
          workflowId: VALID_WORKFLOW_ID,
          workflowNumber: 'RET-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-001',
          assetName: null,
          status: 'COMPLETED' as const,
          retirementReason: null,
          disposalMethod: 'RECYCLED' as const,
          initiatedBy: VALID_USER_ID,
          initiatedAt: '2024-01-15T10:00:00.000Z',
          approvedBy: null,
          approvedAt: null,
          dataWipeRequired: true,
          dataWipeCompletedAt: null,
          dataWipeVerifiedBy: null,
          disposalCompletedAt: '2024-01-15T12:00:00.000Z',
          disposalCompletedBy: VALID_USER_ID,
          destructionCertificateId: '123e4567-e89b-12d3-a456-426614174030',
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T12:00:00.000Z',
        },
        certificate: {
          certificateId: '123e4567-e89b-12d3-a456-426614174030',
          certificateNumber: 'CERT-ABC123-XYZ',
          assetId: VALID_ASSET_ID,
          workflowId: VALID_WORKFLOW_ID,
          vendorId: null,
          vendorName: null,
          destructionDate: '2024-01-15',
          destructionMethod: 'RECYCLED' as const,
          serialNumber: null,
          assetTag: null,
          documentUrl: null,
          verifiedBy: VALID_VERIFIER_ID,
          verifiedAt: '2024-01-15T12:00:00.000Z',
          notes: null,
          createdAt: '2024-01-15T12:00:00.000Z',
          createdBy: VALID_USER_ID,
        },
        assetUpdated: true,
      };

      mockRetirementService.completeDisposal.mockResolvedValue(mockResult);

      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'RECYCLED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(200);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing workflowId in path', async () => {
      const event = createMockEvent({
        pathParameters: null,
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('workflowId is required in path');
    });

    it('should return 400 for invalid workflowId UUID', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: 'invalid-uuid',
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for missing destructionDate', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid destructionDate format', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '01-15-2024',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('YYYY-MM-DD format');
    });

    it('should return 400 for missing destructionMethod', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid destructionMethod', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'INVALID_METHOD',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('destructionMethod must be one of');
    });

    it('should return 400 for missing verifiedBy', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: 'invalid json',
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid JSON in request body');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent workflow', async () => {
      mockRetirementService.completeDisposal.mockRejectedValue(
        new Error(`Retirement workflow not found: ${VALID_WORKFLOW_ID}`)
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 409 for workflow in invalid status', async () => {
      mockRetirementService.completeDisposal.mockRejectedValue(
        new Error('Cannot complete disposal for workflow in status: COMPLETED')
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(409);
    });

    it('should return 401 for unauthenticated request', async () => {
      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(401);
    });

    it('should return 500 for unexpected errors', async () => {
      mockRetirementService.completeDisposal.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        pathParameters: {
          workflowId: VALID_WORKFLOW_ID,
        },
        body: JSON.stringify({
          destructionDate: '2024-01-15',
          destructionMethod: 'DESTROYED',
          verifiedBy: VALID_VERIFIER_ID,
        }),
      });

      const result = await completeDisposalHandler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Failed to complete disposal');
    });
  });
});
