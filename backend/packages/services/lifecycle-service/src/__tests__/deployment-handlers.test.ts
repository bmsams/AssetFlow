/**
 * Deployment Handlers Unit Tests
 *
 * Tests for Deployment Lambda Handlers:
 * - Deploy Asset Handler (Requirement 6.6, 6.7)
 * - Assign To User Handler (Requirement 6.6)
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

// Mock the deployment service
jest.mock('../deployment/deployment-service');

import { handler as deployAssetHandler } from '../handlers/deploy-asset';
import { handler as assignToUserHandler } from '../handlers/assign-to-user';
import * as deploymentService from '../deployment/deployment-service';

const mockDeploymentService = deploymentService as jest.Mocked<typeof deploymentService>;


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
const VALID_USER_ID = '123e4567-e89b-12d3-a456-426614174002';
const VALID_DEPLOYER_ID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_TARGET_ASSET_ID = '123e4567-e89b-12d3-a456-426614174003';

describe('Deploy Asset Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful deployment', () => {
    it('should deploy asset for valid request', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: 'Admin User',
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: 'Building A, Floor 2',
          department: 'Engineering',
          costCenter: 'CC-1001',
          notes: 'New hire equipment',
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        relationships: [],
      };

      mockDeploymentService.deployAsset.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
          deployedByName: 'Admin User',
          location: 'Building A, Floor 2',
          department: 'Engineering',
          costCenter: 'CC-1001',
          notes: 'New hire equipment',
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.deployment.assetId).toBe(VALID_ASSET_ID);
      expect(body.data.deployment.assignedToUserId).toBe(VALID_USER_ID);
      expect(body.data.deployment.status).toBe('COMPLETED');
    });

    it('should deploy asset with CMDB relationships', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: null,
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        relationships: [
          {
            relationshipId: '123e4567-e89b-12d3-a456-426614174020',
            deploymentId: '123e4567-e89b-12d3-a456-426614174010',
            sourceAssetId: VALID_ASSET_ID,
            targetAssetId: VALID_TARGET_ASSET_ID,
            relationType: 'CONNECTED_TO' as const,
            metadata: { port: 'USB-C' },
            createdAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      };

      mockDeploymentService.deployAsset.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
          relationships: [
            {
              targetAssetId: VALID_TARGET_ASSET_ID,
              relationType: 'CONNECTED_TO',
              metadata: { port: 'USB-C' },
            },
          ],
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.relationships.length).toBe(1);
      expect(body.data.relationships[0].relationType).toBe('CONNECTED_TO');
    });

    it('should deploy asset with discovery data correlation', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: null,
          discoveryCorrelationId: '123e4567-e89b-12d3-a456-426614174030',
          discoverySource: 'SCCM',
          discoveryCorrelatedAt: '2024-01-15T10:00:00.000Z',
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        relationships: [],
      };

      mockDeploymentService.deployAsset.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
          discoveryData: {
            discoverySource: 'SCCM',
            discoveryRecordId: 'SCCM-12345',
            serialNumber: 'SN12345',
            macAddress: '00:11:22:33:44:55',
            hostname: 'LAPTOP-001',
            ipAddress: '192.168.1.100',
          },
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.deployment.discoverySource).toBe('SCCM');
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing assetId', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assignedToUserId: VALID_USER_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid assetId UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: 'invalid-uuid',
          assignedToUserId: VALID_USER_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for missing assignedToUserId', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid relationship type', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
          relationships: [
            {
              targetAssetId: VALID_TARGET_ASSET_ID,
              relationType: 'INVALID_TYPE',
            },
          ],
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.details[0].message).toContain('relationType must be one of');
    });

    it('should return 400 for missing discoverySource in discoveryData', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
          discoveryData: {
            discoveryRecordId: 'SCCM-12345',
          },
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Invalid JSON in request body');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent asset', async () => {
      mockDeploymentService.deployAsset.mockRejectedValue(
        new Error(`Asset not found: ${VALID_ASSET_ID}`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      mockDeploymentService.deployAsset.mockRejectedValue(
        new Error(`User not found: ${VALID_USER_ID}`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for asset in non-deployable status', async () => {
      mockDeploymentService.deployAsset.mockRejectedValue(
        new Error('Asset cannot be deployed from status: DISPOSED. Must be one of: IN_STOCK, RESERVED, RECEIVED')
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
        }),
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          assignedToUserId: VALID_USER_ID,
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await deployAssetHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });
});


describe('Assign To User Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Successful assignment', () => {
    it('should assign asset to user for valid request', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: 'Admin User',
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: 'Building A',
          department: 'Engineering',
          costCenter: null,
          notes: null,
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        previousAssignment: null,
      };

      mockDeploymentService.assignToUser.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: VALID_USER_ID,
          assignedByName: 'Admin User',
          location: 'Building A',
          department: 'Engineering',
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.deployment.assignedToUserId).toBe(VALID_USER_ID);
      expect(body.data.previousAssignment).toBeNull();
    });

    it('should reassign asset and return 200', async () => {
      const previousUserId = '123e4567-e89b-12d3-a456-426614174099';
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174011',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: 'Reassigned from Jane Smith',
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        previousAssignment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: previousUserId,
          assignedToUserName: 'Jane Smith',
          assignedToUserEmail: 'jane.smith@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-01T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: null,
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-01T10:00:00.000Z',
          updatedAt: '2024-01-01T10:00:00.000Z',
        },
      };

      mockDeploymentService.assignToUser.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.deployment.assignedToUserId).toBe(VALID_USER_ID);
      expect(body.data.previousAssignment).not.toBeNull();
      expect(body.data.previousAssignment.assignedToUserId).toBe(previousUserId);
    });

    it('should accept userId as alternative to newUserId', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: null,
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        previousAssignment: null,
      };

      mockDeploymentService.assignToUser.mockResolvedValue(mockResult);

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          userId: VALID_USER_ID, // Using userId instead of newUserId
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(201);
    });

    it('should accept assetId from path parameter', async () => {
      const mockResult = {
        deployment: {
          deploymentId: '123e4567-e89b-12d3-a456-426614174010',
          assetId: VALID_ASSET_ID,
          assetTag: 'AST-ABC123',
          assetName: 'MacBook Pro',
          assignedToUserId: VALID_USER_ID,
          assignedToUserName: 'John Doe',
          assignedToUserEmail: 'john.doe@example.com',
          deployedBy: VALID_DEPLOYER_ID,
          deployedByName: null,
          deploymentDate: '2024-01-15T10:00:00.000Z',
          status: 'COMPLETED' as const,
          location: null,
          department: null,
          costCenter: null,
          notes: null,
          discoveryCorrelationId: null,
          discoverySource: null,
          discoveryCorrelatedAt: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        previousAssignment: null,
      };

      mockDeploymentService.assignToUser.mockResolvedValue(mockResult);

      const event = createMockEvent({
        pathParameters: {
          assetId: VALID_ASSET_ID,
        },
        body: JSON.stringify({
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(201);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for missing assetId', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing newUserId', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid assetId UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: 'invalid-uuid',
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid newUserId UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: 'invalid-uuid',
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent asset', async () => {
      mockDeploymentService.assignToUser.mockRejectedValue(
        new Error(`Asset not found: ${VALID_ASSET_ID}`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 404 for non-existent user', async () => {
      mockDeploymentService.assignToUser.mockRejectedValue(
        new Error(`User not found: ${VALID_USER_ID}`)
      );

      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: VALID_USER_ID,
        }),
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 401 for unauthenticated request', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          newUserId: VALID_USER_ID,
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: null,
        },
      });

      const result = await assignToUserHandler(event);

      expect(result.statusCode).toBe(401);
    });
  });
});
