/**
 * Unit tests for SaaS License Handlers
 *
 * Tests the Lambda handlers for SaaS license management:
 * - syncSaaSUsage handler (Requirement 4.11)
 * - getUnusedSubscriptions handler (Requirement 4.12)
 * - checkRenewals handler (Requirement 4.13)
 *
 * Requirements: 4.11, 4.12, 4.13
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import * as saasLicenseService from '../saas-license/saas-license-service';
import {
  handler as syncSaaSUsageHandler,
  createSubscriptionHandler,
  getSubscriptionHandler,
  listSubscriptionsHandler,
  checkRenewalsHandler,
} from '../handlers/sync-saas-usage';
import {
  handler as getUnusedSubscriptionsHandler,
  getSummaryHandler,
} from '../handlers/get-unused-subscriptions';

// Mock the service
jest.mock('../saas-license/saas-license-service');

const mockService = saasLicenseService as jest.Mocked<typeof saasLicenseService>;

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
    path: '/saas-licenses',
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
      path: '/saas-licenses',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/saas-licenses',
    },
    resource: '/saas-licenses',
    ...overrides,
  };
}


describe('SaaS License Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncSaaSUsageHandler', () => {
    const mockSyncResult: saasLicenseService.SyncSaaSUsageResult = {
      syncId: 'sync-1',
      subscriptionId: 'sub-1',
      vendorName: 'ADOBE',
      syncedAt: '2024-06-15T10:00:00Z',
      totalLicenses: 100,
      assignedLicenses: 75,
      activeLicenses: 60,
      inactiveLicenses: 15,
      usersProcessed: 75,
      subscription: {
        subscriptionId: 'sub-1',
        vendorName: 'ADOBE',
        productName: 'Creative Cloud',
        subscriptionType: 'ANNUAL',
        totalSeats: 100,
        usedSeats: 75,
        unusedSeats: 25,
        costPerSeat: 50,
        totalCost: 5000,
        startDate: '2024-01-01',
        renewalDate: '2025-01-01',
        status: 'ACTIVE',
        vendorPortalId: 'adobe-123',
        vendorContractId: null,
        lastSyncedAt: '2024-06-15T10:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
      },
    };

    it('should sync SaaS usage successfully', async () => {
      mockService.syncSaaSUsage.mockResolvedValue(mockSyncResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { subscriptionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await syncSaaSUsageHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.syncId).toBe('sync-1');
      expect(body.data.usersProcessed).toBe(75);
    });

    it('should return 400 for missing subscriptionId', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: null,
      });

      const result = await syncSaaSUsageHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid UUID', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { subscriptionId: 'invalid-uuid' },
      });

      const result = await syncSaaSUsageHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 404 for non-existent subscription', async () => {
      mockService.syncSaaSUsage.mockRejectedValue(new Error('Subscription not found: sub-1'));

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: { subscriptionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await syncSaaSUsageHandler(event);

      expect(result.statusCode).toBe(404);
    });
  });


  describe('createSubscriptionHandler', () => {
    const mockSubscription: saasLicenseService.SaaSSubscription = {
      subscriptionId: 'sub-1',
      vendorName: 'ADOBE',
      productName: 'Creative Cloud',
      subscriptionType: 'ANNUAL',
      totalSeats: 100,
      usedSeats: 0,
      unusedSeats: 100,
      costPerSeat: 50,
      totalCost: 5000,
      startDate: '2024-01-01',
      renewalDate: '2025-01-01',
      status: 'ACTIVE',
      vendorPortalId: 'adobe-123',
      vendorContractId: null,
      lastSyncedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('should create subscription successfully', async () => {
      mockService.createSubscription.mockResolvedValue(mockSubscription);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          vendorName: 'ADOBE',
          productName: 'Creative Cloud',
          subscriptionType: 'ANNUAL',
          totalSeats: 100,
          costPerSeat: 50,
          startDate: '2024-01-01',
          renewalDate: '2025-01-01',
          vendorPortalId: 'adobe-123',
        }),
      });

      const result = await createSubscriptionHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.subscriptionId).toBe('sub-1');
    });

    it('should return 400 for missing body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: null,
      });

      const result = await createSubscriptionHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid vendorName', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          vendorName: 'INVALID',
          productName: 'Test',
          subscriptionType: 'ANNUAL',
          totalSeats: 100,
          costPerSeat: 50,
          startDate: '2024-01-01',
          renewalDate: '2025-01-01',
        }),
      });

      const result = await createSubscriptionHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('vendorName');
    });

    it('should return 400 for missing required fields', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          vendorName: 'ADOBE',
        }),
      });

      const result = await createSubscriptionHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('getUnusedSubscriptionsHandler', () => {
    const mockUnusedSubscriptions: saasLicenseService.UnusedSubscriptionDetails[] = [
      {
        subscription: {
          subscriptionId: 'sub-1',
          vendorName: 'ADOBE',
          productName: 'Creative Cloud',
          subscriptionType: 'ANNUAL',
          totalSeats: 100,
          usedSeats: 25,
          unusedSeats: 75,
          costPerSeat: 50,
          totalCost: 5000,
          startDate: '2024-01-01',
          renewalDate: '2025-01-01',
          status: 'ACTIVE',
          vendorPortalId: 'adobe-123',
          vendorContractId: null,
          lastSyncedAt: '2024-06-15T10:00:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
        unusedSeats: 75,
        potentialMonthlySavings: 3750,
        potentialAnnualSavings: 45000,
        utilizationPercentage: 25,
        inactiveUsers: [],
        recommendation: 'CRITICAL: Very low utilization.',
      },
    ];

    it('should return unused subscriptions', async () => {
      mockService.getUnusedSubscriptions.mockResolvedValue(mockUnusedSubscriptions);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/saas-licenses/unused',
      });

      const result = await getUnusedSubscriptionsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.summary.totalUnusedSeats).toBe(75);
      expect(body.data.summary.totalPotentialAnnualSavings).toBe(45000);
    });

    it('should accept query parameters', async () => {
      mockService.getUnusedSubscriptions.mockResolvedValue([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/saas-licenses/unused',
        queryStringParameters: {
          minUnusedSeats: '5',
          inactiveDays: '60',
        },
      });

      const result = await getUnusedSubscriptionsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getUnusedSubscriptions).toHaveBeenCalledWith(5, 60);
    });

    it('should return 400 for invalid minUnusedSeats', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/saas-licenses/unused',
        queryStringParameters: {
          minUnusedSeats: '-1',
        },
      });

      const result = await getUnusedSubscriptionsHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid inactiveDays', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/saas-licenses/unused',
        queryStringParameters: {
          inactiveDays: '500',
        },
      });

      const result = await getUnusedSubscriptionsHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('listSubscriptionsHandler', () => {
    const mockSubscriptions: saasLicenseService.SaaSSubscription[] = [
      {
        subscriptionId: 'sub-1',
        vendorName: 'ADOBE',
        productName: 'Creative Cloud',
        subscriptionType: 'ANNUAL',
        totalSeats: 100,
        usedSeats: 75,
        unusedSeats: 25,
        costPerSeat: 50,
        totalCost: 5000,
        startDate: '2024-01-01',
        renewalDate: '2025-01-01',
        status: 'ACTIVE',
        vendorPortalId: 'adobe-123',
        vendorContractId: null,
        lastSyncedAt: '2024-06-15T10:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
      },
    ];

    const mockSummary = {
      totalSubscriptions: 1,
      totalSeats: 100,
      usedSeats: 75,
      unusedSeats: 25,
      totalMonthlyCost: 5000,
      potentialSavings: 1250,
      byVendor: { ADOBE: { count: 1, seats: 100, cost: 5000 } },
      byStatus: { ACTIVE: 1 },
    };

    it('should list subscriptions', async () => {
      mockService.getSubscriptions.mockResolvedValue(mockSubscriptions);
      mockService.getSubscriptionSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await listSubscriptionsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.summary.totalSubscriptions).toBe(1);
    });

    it('should filter by vendorName', async () => {
      mockService.getSubscriptions.mockResolvedValue(mockSubscriptions);
      mockService.getSubscriptionSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { vendorName: 'ADOBE' },
      });

      const result = await listSubscriptionsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getSubscriptions).toHaveBeenCalledWith('ADOBE', undefined, 100);
    });

    it('should return 400 for invalid vendorName', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: { vendorName: 'INVALID' },
      });

      const result = await listSubscriptionsHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('checkRenewalsHandler', () => {
    const mockNotifications: saasLicenseService.RenewalNotificationResult[] = [
      {
        subscriptionId: 'sub-1',
        productName: 'Creative Cloud',
        vendorName: 'ADOBE',
        renewalDate: '2024-07-15',
        daysUntilRenewal: 25,
        totalCost: 5000,
        notificationType: '30_DAY',
        notification: {
          notificationId: 'notif-1',
          subscriptionId: 'sub-1',
          daysBeforeRenewal: 25,
          notificationType: '30_DAY',
          status: 'PENDING',
          sentAt: null,
          acknowledgedBy: null,
          acknowledgedAt: null,
          createdAt: '2024-06-15T10:00:00Z',
          updatedAt: '2024-06-15T10:00:00Z',
        },
      },
    ];

    it('should check and generate renewal notifications', async () => {
      mockService.checkRenewalNotifications.mockResolvedValue(mockNotifications);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/saas-licenses/check-renewals',
      });

      const result = await checkRenewalsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.notificationsGenerated).toBe(1);
      expect(body.data.notifications).toHaveLength(1);
    });

    it('should return empty when no renewals pending', async () => {
      mockService.checkRenewalNotifications.mockResolvedValue([]);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/saas-licenses/check-renewals',
      });

      const result = await checkRenewalsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.notificationsGenerated).toBe(0);
    });
  });

  describe('getSummaryHandler', () => {
    const mockSummary = {
      totalSubscriptions: 5,
      totalSeats: 300,
      usedSeats: 200,
      unusedSeats: 100,
      totalMonthlyCost: 15000,
      potentialSavings: 5000,
      byVendor: {
        ADOBE: { count: 2, seats: 150, cost: 7500 },
        SALESFORCE: { count: 3, seats: 150, cost: 7500 },
      },
      byStatus: { ACTIVE: 4, EXPIRING_SOON: 1 },
    };

    it('should return subscription summary', async () => {
      mockService.getSubscriptionSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/saas-licenses/summary',
      });

      const result = await getSummaryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.totalSubscriptions).toBe(5);
      expect(body.data.potentialSavings).toBe(5000);
    });
  });

  describe('getSubscriptionHandler', () => {
    const mockSubscription: saasLicenseService.SaaSSubscription = {
      subscriptionId: 'sub-1',
      vendorName: 'ADOBE',
      productName: 'Creative Cloud',
      subscriptionType: 'ANNUAL',
      totalSeats: 100,
      usedSeats: 75,
      unusedSeats: 25,
      costPerSeat: 50,
      totalCost: 5000,
      startDate: '2024-01-01',
      renewalDate: '2025-01-01',
      status: 'ACTIVE',
      vendorPortalId: 'adobe-123',
      vendorContractId: null,
      lastSyncedAt: '2024-06-15T10:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    it('should return subscription with usage records', async () => {
      mockService.getSubscription.mockResolvedValue(mockSubscription);
      mockService.getUsageRecords.mockResolvedValue([]);
      mockService.getNotificationsBySubscription.mockResolvedValue([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { subscriptionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await getSubscriptionHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.subscription.subscriptionId).toBe('sub-1');
    });

    it('should return 404 for non-existent subscription', async () => {
      mockService.getSubscription.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: { subscriptionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await getSubscriptionHandler(event);

      expect(result.statusCode).toBe(404);
    });
  });
});