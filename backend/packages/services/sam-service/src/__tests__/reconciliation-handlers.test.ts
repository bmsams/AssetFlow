/**
 * Unit tests for Reconciliation Handlers
 *
 * Tests the Lambda handlers for reconciliation operations:
 * - runReconciliation handler
 * - getCompliancePosition handler
 *
 * Requirements: 4.1, 4.2
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import { handler as runReconciliationHandler } from '../handlers/run-reconciliation';
import { handler as getCompliancePositionHandler } from '../handlers/get-compliance-position';

// Mock the reconciliation service
jest.mock('../reconciliation/reconciliation-service', () => ({
  runReconciliation: jest.fn(),
  runReconciliationForAllProducts: jest.fn(),
  getCompliancePosition: jest.fn(),
  getCompliancePositions: jest.fn(),
  getComplianceIssues: jest.fn(),
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

import * as reconciliationService from '../reconciliation/reconciliation-service';

const mockReconciliationService = reconciliationService as jest.Mocked<typeof reconciliationService>;

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
    path: '/reconciliation',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: null,
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
      path: '/reconciliation',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/reconciliation',
    },
    resource: '/reconciliation',
    ...overrides,
  };
}

describe('Run Reconciliation Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reconciliation/run', () => {
    it('should run reconciliation for a specific product', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const mockResult = {
        resultId: 'result-123',
        softwareProductId: productId,
        entitlementsOwned: 10,
        installationsFound: 8,
        compliancePosition: 'OVER_LICENSED' as const,
        overUnderCount: 2,
        lastReconciledAt: '2024-01-15T10:00:00Z',
        effectiveLicensePosition: 10,
        licenseDemand: 8,
        compliancePercentage: 125,
        reconciliationRunId: null,
        reconciliationType: 'ON_DEMAND',
        createdAt: '2024-01-15T10:00:00Z',
      };

      mockReconciliationService.runReconciliation.mockResolvedValue(mockResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId, reconciliationType: 'ON_DEMAND' }),
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReconciliationService.runReconciliation).toHaveBeenCalledWith(
        productId,
        'ON_DEMAND'
      );

      const body = JSON.parse(response.body);
      expect(body.data.compliancePosition).toBe('OVER_LICENSED');
      expect(body.data.entitlementsOwned).toBe(10);
      expect(body.data.installationsFound).toBe(8);
    });

    it('should run reconciliation for all products when no productId provided', async () => {
      const mockRunResult = {
        runId: 'run-123',
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
        productsReconciled: 5,
        results: [],
        summary: {
          compliant: 3,
          overLicensed: 1,
          underLicensed: 1,
        },
      };

      mockReconciliationService.runReconciliationForAllProducts.mockResolvedValue(mockRunResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ reconciliationType: 'AUTOMATIC' }),
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReconciliationService.runReconciliationForAllProducts).toHaveBeenCalledWith(
        'AUTOMATIC'
      );

      const body = JSON.parse(response.body);
      expect(body.data.productsReconciled).toBe(5);
      expect(body.data.summary.compliant).toBe(3);
    });

    it('should return 400 for invalid productId', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId: 'invalid-uuid' }),
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid reconciliationType', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ reconciliationType: 'INVALID_TYPE' }),
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: 'invalid json',
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    it('should return 404 when product not found', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      mockReconciliationService.runReconciliation.mockRejectedValue(
        new Error(`Software product not found: ${productId}`)
      );

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId }),
      });

      const response = await runReconciliationHandler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should default to ON_DEMAND reconciliation type', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      mockReconciliationService.runReconciliation.mockResolvedValue({
        resultId: 'result-123',
        softwareProductId: productId,
        entitlementsOwned: 10,
        installationsFound: 10,
        compliancePosition: 'COMPLIANT' as const,
        overUnderCount: 0,
        lastReconciledAt: '2024-01-15T10:00:00Z',
        effectiveLicensePosition: 10,
        licenseDemand: 10,
        compliancePercentage: 100,
        reconciliationRunId: null,
        reconciliationType: 'ON_DEMAND',
        createdAt: '2024-01-15T10:00:00Z',
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ productId }),
      });

      await runReconciliationHandler(event);

      expect(mockReconciliationService.runReconciliation).toHaveBeenCalledWith(
        productId,
        'ON_DEMAND'
      );
    });
  });
});

describe('Get Compliance Position Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /reconciliation/compliance/{productId}', () => {
    it('should return compliance position for a specific product', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      const mockPosition = {
        productId,
        product: {
          productId,
          publisher: 'Microsoft',
          productName: 'Office 365',
          version: null,
          edition: 'Enterprise',
          productCategory: 'OFFICE_PRODUCTIVITY',
          isSaas: true,
          normalizationKey: null,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        entitlementsOwned: 100,
        installationsFound: 85,
        compliancePosition: 'OVER_LICENSED' as const,
        overUnderCount: 15,
        compliancePercentage: 117.65,
        lastReconciledAt: '2024-01-15T10:00:00Z',
        entitlementDetails: null,
        installationDetails: null,
      };

      mockReconciliationService.getCompliancePosition.mockResolvedValue(mockPosition);

      const event = createMockEvent({
        pathParameters: { productId },
      });

      const response = await getCompliancePositionHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReconciliationService.getCompliancePosition).toHaveBeenCalledWith(productId);

      const body = JSON.parse(response.body);
      expect(body.data.compliancePosition).toBe('OVER_LICENSED');
      expect(body.data.entitlementsOwned).toBe(100);
      expect(body.data.installationsFound).toBe(85);
    });

    it('should return 400 for invalid productId', async () => {
      const event = createMockEvent({
        pathParameters: { productId: 'invalid-uuid' },
      });

      const response = await getCompliancePositionHandler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when product not found', async () => {
      const productId = '123e4567-e89b-12d3-a456-426614174000';
      mockReconciliationService.getCompliancePosition.mockRejectedValue(
        new Error(`Software product not found: ${productId}`)
      );

      const event = createMockEvent({
        pathParameters: { productId },
      });

      const response = await getCompliancePositionHandler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /reconciliation/compliance', () => {
    it('should return compliance positions for all products', async () => {
      const mockPositions = [
        {
          productId: '123e4567-e89b-12d3-a456-426614174001',
          product: null,
          entitlementsOwned: 10,
          installationsFound: 10,
          compliancePosition: 'COMPLIANT' as const,
          overUnderCount: 0,
          compliancePercentage: 100,
          lastReconciledAt: '2024-01-15T10:00:00Z',
          entitlementDetails: null,
          installationDetails: null,
        },
        {
          productId: '123e4567-e89b-12d3-a456-426614174002',
          product: null,
          entitlementsOwned: 5,
          installationsFound: 10,
          compliancePosition: 'UNDER_LICENSED' as const,
          overUnderCount: -5,
          compliancePercentage: 50,
          lastReconciledAt: '2024-01-15T10:00:00Z',
          entitlementDetails: null,
          installationDetails: null,
        },
      ];

      mockReconciliationService.getCompliancePositions.mockResolvedValue(mockPositions);

      const event = createMockEvent({
        pathParameters: null,
      });

      const response = await getCompliancePositionHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReconciliationService.getCompliancePositions).toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.summary.total).toBe(2);
      expect(body.data.summary.compliant).toBe(1);
      expect(body.data.summary.underLicensed).toBe(1);
    });

    it('should return only compliance issues when issuesOnly=true', async () => {
      const mockIssues = [
        {
          productId: '123e4567-e89b-12d3-a456-426614174002',
          product: null,
          entitlementsOwned: 5,
          installationsFound: 10,
          compliancePosition: 'UNDER_LICENSED' as const,
          overUnderCount: -5,
          compliancePercentage: 50,
          lastReconciledAt: '2024-01-15T10:00:00Z',
          entitlementDetails: null,
          installationDetails: null,
        },
      ];

      mockReconciliationService.getComplianceIssues.mockResolvedValue(mockIssues);

      const event = createMockEvent({
        pathParameters: null,
        queryStringParameters: { issuesOnly: 'true' },
      });

      const response = await getCompliancePositionHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockReconciliationService.getComplianceIssues).toHaveBeenCalled();

      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.issuesOnly).toBe(true);
    });
  });
});
