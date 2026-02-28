/**
 * Unit tests for Reclamation Handlers
 *
 * Tests the Lambda handlers for reclamation operations:
 * - identifyReclamationCandidates handler (Requirement 4.6)
 * - initiateReclamation handler (Requirement 4.7)
 * - approve, reject, complete, cancel handlers
 *
 * Requirements: 4.6, 4.7
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import { handler as identifyHandler, getCandidatesHandler, getRulesHandler } from '../handlers/identify-reclamation-candidates';
import { handler as initiateHandler, approveHandler, rejectHandler, completeHandler, cancelHandler } from '../handlers/initiate-reclamation';

// Mock the reclamation service
jest.mock('../reclamation/reclamation-service', () => ({
  getReclamationRules: jest.fn(),
  getReclamationRule: jest.fn(),
  identifyReclamationCandidates: jest.fn(),
  initiateReclamation: jest.fn(),
  approveReclamation: jest.fn(),
  rejectReclamation: jest.fn(),
  completeReclamation: jest.fn(),
  cancelReclamation: jest.fn(),
  getReclamationCandidates: jest.fn(),
  getReclamationSummary: jest.fn(),
}));

// Mock the cache module
jest.mock('@ams/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  DEFAULT_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

// Mock the events module
jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue('event-id'),
}));

import * as reclamationService from '../reclamation/reclamation-service';

const mockReclamationService = reclamationService as jest.Mocked<typeof reclamationService>;

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/reclamation',
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
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/reclamation',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/reclamation',
    },
    resource: '/reclamation',
    ...overrides,
  };
}

describe('Identify Reclamation Candidates Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reclamation/identify', () => {
    it('should identify reclamation candidates for all products', async () => {
      const mockResult = {
        runId: 'run-123',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
        rulesApplied: 3,
        installationsScanned: 500,
        candidatesIdentified: 25,
        candidates: [],
        potentialSavings: 1250.0,
      };

      mockReclamationService.identifyReclamationCandidates.mockResolvedValue(mockResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const response = await identifyHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.identifyReclamationCandidates).toHaveBeenCalledWith(
        undefined,
        undefined
      );

      const body = JSON.parse(response.body);
      expect(body.data.candidatesIdentified).toBe(25);
      expect(body.data.potentialSavings).toBe(1250.0);
    });

    it('should identify candidates for a specific product', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        runId: 'run-123',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
        rulesApplied: 1,
        installationsScanned: 50,
        candidatesIdentified: 5,
        candidates: [],
        potentialSavings: 250.0,
      };

      mockReclamationService.identifyReclamationCandidates.mockResolvedValue(mockResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId }),
      });

      const response = await identifyHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.identifyReclamationCandidates).toHaveBeenCalledWith(
        undefined,
        productId
      );
    });

    it('should return 400 for invalid productId', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId: 'invalid-uuid' }),
      });

      const response = await identifyHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: 'invalid json',
      });

      const response = await identifyHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /reclamation/candidates', () => {
    it('should return reclamation candidates', async () => {
      const mockCandidates = [
        {
          candidateId: 'candidate-1',
          installationId: 'install-1',
          daysSinceLastUse: 120,
          status: 'IDENTIFIED',
          installation: {
            productName: 'Adobe Photoshop',
            publisher: 'Adobe',
          },
        },
      ];

      const mockSummary = {
        totalCandidates: 1,
        byStatus: { IDENTIFIED: 1 },
        potentialSavings: 50.0,
        licensesRecovered: 0,
      };

      mockReclamationService.getReclamationCandidates.mockResolvedValue(mockCandidates as any);
      mockReclamationService.getReclamationSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const response = await getCandidatesHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.summary.totalCandidates).toBe(1);
    });

    it('should filter by status when provided', async () => {
      mockReclamationService.getReclamationCandidates.mockResolvedValue([]);
      mockReclamationService.getReclamationSummary.mockResolvedValue({
        totalCandidates: 0,
        byStatus: {},
        potentialSavings: 0,
        licensesRecovered: 0,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { status: 'PENDING_APPROVAL' },
      });

      const response = await getCandidatesHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.getReclamationCandidates).toHaveBeenCalledWith(
        'PENDING_APPROVAL',
        100
      );
    });

    it('should return 400 for invalid status', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { status: 'INVALID_STATUS' },
      });

      const response = await getCandidatesHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /reclamation/rules', () => {
    it('should return reclamation rules', async () => {
      const mockRules = [
        {
          ruleId: 'rule-1',
          ruleName: 'Standard 90-Day Unused',
          daysSinceLastUse: 90,
          isActive: true,
        },
      ];

      mockReclamationService.getReclamationRules.mockResolvedValue(mockRules as any);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const response = await getRulesHandler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].ruleName).toBe('Standard 90-Day Unused');
    });
  });
});

describe('Initiate Reclamation Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reclamation/initiate', () => {
    it('should initiate reclamation workflow', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        candidateId,
        installationId: 'install-1',
        workflowId: 'workflow-123',
        status: 'PENDING_APPROVAL' as const,
        requiresApproval: true,
        userNotified: true,
        managerNotified: true,
        scheduledActionDate: '2024-01-29T10:00:00Z',
      };

      mockReclamationService.initiateReclamation.mockResolvedValue(mockResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ candidateId }),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.initiateReclamation).toHaveBeenCalledWith(
        candidateId,
        expect.objectContaining({
          skipNotification: undefined,
          skipApproval: undefined,
        })
      );

      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('PENDING_APPROVAL');
      expect(body.data.workflowId).toBe('workflow-123');
    });

    it('should pass options to service', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      mockReclamationService.initiateReclamation.mockResolvedValue({
        candidateId,
        installationId: 'install-1',
        workflowId: 'workflow-123',
        status: 'IN_PROGRESS' as const,
        requiresApproval: false,
        userNotified: false,
        managerNotified: false,
        scheduledActionDate: null,
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          candidateId,
          skipNotification: true,
          skipApproval: true,
          actionType: 'DISABLE',
        }),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.initiateReclamation).toHaveBeenCalledWith(
        candidateId,
        expect.objectContaining({
          skipNotification: true,
          skipApproval: true,
          actionType: 'DISABLE',
        })
      );
    });

    it('should return 400 when candidateId is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid candidateId', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ candidateId: 'invalid-uuid' }),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid actionType', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          candidateId: '123e4567-e89b-12d3-a456-426614174000',
          actionType: 'INVALID_ACTION',
        }),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when candidate not found', async () => {
      mockReclamationService.initiateReclamation.mockRejectedValue(
        new Error('Reclamation candidate not found: candidate-123')
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ candidateId: '123e4567-e89b-12d3-a456-426614174000' }),
      });

      const response = await initiateHandler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /reclamation/{candidateId}/approve', () => {
    it('should approve reclamation', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      mockReclamationService.approveReclamation.mockResolvedValue({
        candidateId,
        status: 'APPROVED',
        approvedBy: 'user-123',
        approvedAt: '2024-01-16T10:00:00Z',
      } as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId },
        body: JSON.stringify({ notes: 'Approved for reclamation' }),
      });

      const response = await approveHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.approveReclamation).toHaveBeenCalledWith(
        candidateId,
        'user-123',
        'Approved for reclamation'
      );
    });

    it('should return 400 for invalid candidateId', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId: 'invalid-uuid' },
      });

      const response = await approveHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /reclamation/{candidateId}/reject', () => {
    it('should reject reclamation', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      mockReclamationService.rejectReclamation.mockResolvedValue({
        candidateId,
        status: 'REJECTED',
        rejectionReason: 'User needs this software',
      } as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId },
        body: JSON.stringify({ reason: 'User needs this software' }),
      });

      const response = await rejectHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.rejectReclamation).toHaveBeenCalledWith(
        candidateId,
        'user-123',
        'User needs this software'
      );
    });

    it('should return 400 when reason is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId: '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({}),
      });

      const response = await rejectHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /reclamation/{candidateId}/complete', () => {
    it('should complete reclamation with license recovery', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      mockReclamationService.completeReclamation.mockResolvedValue({
        candidateId,
        status: 'COMPLETED',
        licenseRecovered: true,
      } as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId },
        body: JSON.stringify({
          actionResult: 'Software uninstalled successfully',
          licenseRecovered: true,
          entitlementId: '123e4567-e89b-12d3-a456-426614174001',
        }),
      });

      const response = await completeHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.completeReclamation).toHaveBeenCalledWith(
        candidateId,
        {
          actionResult: 'Software uninstalled successfully',
          licenseRecovered: true,
          entitlementId: '123e4567-e89b-12d3-a456-426614174001',
        }
      );
    });

    it('should return 400 when actionResult is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId: '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({ licenseRecovered: true }),
      });

      const response = await completeHandler(event);

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when licenseRecovered is not boolean', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId: '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({
          actionResult: 'Done',
          licenseRecovered: 'yes',
        }),
      });

      const response = await completeHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /reclamation/{candidateId}/cancel', () => {
    it('should cancel reclamation', async () => {
      const candidateId = '123e4567-e89b-12d3-a456-426614174000';
      mockReclamationService.cancelReclamation.mockResolvedValue({
        candidateId,
        status: 'CANCELLED',
      } as any);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId },
        body: JSON.stringify({ reason: 'User requested to keep software' }),
      });

      const response = await cancelHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReclamationService.cancelReclamation).toHaveBeenCalledWith(
        candidateId,
        'User requested to keep software'
      );
    });

    it('should return 400 when reason is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { candidateId: '123e4567-e89b-12d3-a456-426614174000' },
        body: JSON.stringify({}),
      });

      const response = await cancelHandler(event);

      expect(response.statusCode).toBe(400);
    });
  });
});
