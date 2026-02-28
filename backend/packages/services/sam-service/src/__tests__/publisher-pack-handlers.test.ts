/**
 * Unit tests for Publisher Pack Handlers
 *
 * Tests the Lambda handler for applying publisher-specific license rules.
 *
 * Requirements: 4.3, 4.4, 4.5
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handlers/apply-publisher-rules';

// Mock the publisher pack service
jest.mock('../publisher-pack/publisher-pack-service', () => ({
  applyPublisherRules: jest.fn(),
  applyPublisherRulesForPublisher: jest.fn(),
  isSupportedPublisher: jest.fn(),
  getSupportedPublishers: jest.fn(() => ['MICROSOFT', 'ORACLE', 'ADOBE', 'SALESFORCE']),
}));

import * as publisherPackService from '../publisher-pack/publisher-pack-service';

const mockApplyPublisherRules = publisherPackService.applyPublisherRules as jest.Mock;
const mockApplyPublisherRulesForPublisher = publisherPackService.applyPublisherRulesForPublisher as jest.Mock;
const mockIsSupportedPublisher = publisherPackService.isSupportedPublisher as jest.Mock;

/**
 * Helper to create mock API Gateway event
 */
function createMockEvent(body: object | null = null): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/publisher-rules/apply',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: null,
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
      path: '/publisher-rules/apply',
      stage: 'test',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/publisher-rules/apply',
    },
    resource: '/publisher-rules/apply',
  };
}

describe('Apply Publisher Rules Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request validation', () => {
    it('should return 400 when neither productId nor publisher is provided', async () => {
      const event = createMockEvent({});

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('productId or publisher must be provided');
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent(null);
      event.body = 'invalid json';

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 400 for invalid productId format', async () => {
      const event = createMockEvent({ productId: 'not-a-uuid' });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for unsupported publisher', async () => {
      mockIsSupportedPublisher.mockReturnValue(false);
      const event = createMockEvent({ publisher: 'IBM' });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Unsupported publisher');
      expect(body.error.message).toContain('MICROSOFT');
    });
  });

  describe('Apply rules for specific product', () => {
    const mockResult = {
      productId: '550e8400-e29b-41d4-a716-446655440000',
      publisher: 'MICROSOFT',
      productName: 'SQL Server 2019 Enterprise',
      calculationMethod: 'PER_CORE_2PACK',
      licensesRequired: 16,
      licensesOwned: 20,
      compliancePosition: 'OVER_LICENSED',
      overUnderCount: 4,
      details: {
        productCategory: 'SQL_SERVER',
        totalCores: 32,
        totalProcessors: 2,
      },
      calculatedAt: '2024-06-01T00:00:00Z',
      warnings: [],
    };

    it('should apply rules for valid productId', async () => {
      mockApplyPublisherRules.mockResolvedValue(mockResult);
      const event = createMockEvent({ productId: '550e8400-e29b-41d4-a716-446655440000' });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockApplyPublisherRules).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
      
      const body = JSON.parse(response.body);
      expect(body.data.publisher).toBe('MICROSOFT');
      expect(body.data.licensesRequired).toBe(16);
      expect(body.data.compliancePosition).toBe('OVER_LICENSED');
    });

    it('should return 404 when product not found', async () => {
      mockApplyPublisherRules.mockRejectedValue(new Error('Software product not found: 550e8400-e29b-41d4-a716-446655440000'));
      const event = createMockEvent({ productId: '550e8400-e29b-41d4-a716-446655440000' });

      const response = await handler(event);

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('not found');
    });

    it('should return 400 for unsupported publisher product', async () => {
      mockApplyPublisherRules.mockRejectedValue(new Error('Unsupported publisher: IBM'));
      const event = createMockEvent({ productId: '550e8400-e29b-41d4-a716-446655440000' });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.message).toContain('Unsupported publisher');
    });
  });

  describe('Apply rules for all products from publisher', () => {
    const mockResults = [
      {
        productId: '550e8400-e29b-41d4-a716-446655440001',
        publisher: 'MICROSOFT',
        productName: 'SQL Server 2019',
        calculationMethod: 'PER_CORE_2PACK',
        licensesRequired: 16,
        licensesOwned: 20,
        compliancePosition: 'OVER_LICENSED',
        overUnderCount: 4,
        details: {},
        calculatedAt: '2024-06-01T00:00:00Z',
        warnings: [],
      },
      {
        productId: '550e8400-e29b-41d4-a716-446655440002',
        publisher: 'MICROSOFT',
        productName: 'Office 365 E3',
        calculationMethod: 'PER_USER_SUBSCRIPTION',
        licensesRequired: 100,
        licensesOwned: 100,
        compliancePosition: 'COMPLIANT',
        overUnderCount: 0,
        details: {},
        calculatedAt: '2024-06-01T00:00:00Z',
        warnings: [],
      },
      {
        productId: '550e8400-e29b-41d4-a716-446655440003',
        publisher: 'MICROSOFT',
        productName: 'Windows Server 2022',
        calculationMethod: 'PER_CORE_2PACK',
        licensesRequired: 32,
        licensesOwned: 24,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -8,
        details: {},
        calculatedAt: '2024-06-01T00:00:00Z',
        warnings: ['Under-licensed by 8 licenses'],
      },
    ];

    it('should apply rules for all products from supported publisher', async () => {
      mockIsSupportedPublisher.mockReturnValue(true);
      mockApplyPublisherRulesForPublisher.mockResolvedValue(mockResults);
      const event = createMockEvent({ publisher: 'Microsoft' });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockApplyPublisherRulesForPublisher).toHaveBeenCalledWith('Microsoft');
      
      const body = JSON.parse(response.body);
      expect(body.data.summary.publisher).toBe('Microsoft');
      expect(body.data.summary.productsProcessed).toBe(3);
      expect(body.data.summary.compliant).toBe(1);
      expect(body.data.summary.overLicensed).toBe(1);
      expect(body.data.summary.underLicensed).toBe(1);
      expect(body.data.summary.totalLicensesRequired).toBe(148);
      expect(body.data.summary.totalLicensesOwned).toBe(144);
      expect(body.data.results).toHaveLength(3);
    });

    it('should calculate total warnings in summary', async () => {
      mockIsSupportedPublisher.mockReturnValue(true);
      mockApplyPublisherRulesForPublisher.mockResolvedValue(mockResults);
      const event = createMockEvent({ publisher: 'Microsoft' });

      const response = await handler(event);

      const body = JSON.parse(response.body);
      expect(body.data.summary.totalWarnings).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockApplyPublisherRules.mockRejectedValue(new Error('Database connection failed'));
      const event = createMockEvent({ productId: '550e8400-e29b-41d4-a716-446655440000' });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
