/**
 * Unit tests for SaaS License Service
 *
 * Tests the business logic for SaaS license management:
 * - Connect to vendor portals to sync subscription usage data (Requirement 4.11)
 * - Identify unused subscriptions for cost optimization (Requirement 4.12)
 * - Track subscription renewal dates and send advance notifications (Requirement 4.13)
 *
 * Requirements: 4.11, 4.12, 4.13
 */

import * as saasLicenseService from '../saas-license/saas-license-service';
import * as saasLicenseRepository from '../saas-license/saas-license-repository';

// Mock the repository
jest.mock('../saas-license/saas-license-repository');

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

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

const mockRepository = saasLicenseRepository as jest.Mocked<typeof saasLicenseRepository>;

describe('SaaS License Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockSubscription: saasLicenseRepository.SaaSSubscription = {
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
      vendorPortalId: 'adobe-portal-123',
      vendorContractId: null,
      lastSyncedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };


    it('should create a new SaaS subscription', async () => {
      mockRepository.createSubscription.mockResolvedValue(mockSubscription);

      const request: saasLicenseRepository.CreateSubscriptionRequest = {
        vendorName: 'ADOBE',
        productName: 'Creative Cloud',
        subscriptionType: 'ANNUAL',
        totalSeats: 100,
        costPerSeat: 50,
        startDate: '2024-01-01',
        renewalDate: '2025-01-01',
        vendorPortalId: 'adobe-portal-123',
      };

      const result = await saasLicenseService.createSubscription(request);

      expect(result).toEqual(mockSubscription);
      expect(mockRepository.createSubscription).toHaveBeenCalledWith(request);
    });
  });

  describe('getSubscription', () => {
    const mockSubscription: saasLicenseRepository.SaaSSubscription = {
      subscriptionId: 'sub-1',
      vendorName: 'SALESFORCE',
      productName: 'Sales Cloud',
      subscriptionType: 'ANNUAL',
      totalSeats: 50,
      usedSeats: 40,
      unusedSeats: 10,
      costPerSeat: 150,
      totalCost: 7500,
      startDate: '2024-01-01',
      renewalDate: '2025-01-01',
      status: 'ACTIVE',
      vendorPortalId: 'sf-portal-456',
      vendorContractId: null,
      lastSyncedAt: '2024-06-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-01T00:00:00Z',
    };

    it('should return subscription by ID', async () => {
      mockRepository.getSubscriptionById.mockResolvedValue(mockSubscription);

      const result = await saasLicenseService.getSubscription('sub-1');

      expect(result).toEqual(mockSubscription);
      expect(mockRepository.getSubscriptionById).toHaveBeenCalledWith('sub-1');
    });

    it('should return null for non-existent subscription', async () => {
      mockRepository.getSubscriptionById.mockResolvedValue(null);

      const result = await saasLicenseService.getSubscription('non-existent');

      expect(result).toBeNull();
    });
  });


  describe('syncSaaSUsage', () => {
    const mockSubscription: saasLicenseRepository.SaaSSubscription = {
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
      vendorPortalId: 'adobe-portal-123',
      vendorContractId: null,
      lastSyncedAt: '2024-06-15T10:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    const mockUsageRecord: saasLicenseRepository.SaaSUsageRecord = {
      usageId: 'usage-1',
      subscriptionId: 'sub-1',
      userId: 'adobe-user-1',
      userEmail: 'user1@company.com',
      lastActiveDate: '2024-06-10T00:00:00Z',
      loginCount30Day: 15,
      featureUsage: { photoshop: 10, illustrator: 5 },
      isActive: true,
      createdAt: '2024-06-15T10:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    it('should sync usage data from vendor portal', async () => {
      mockRepository.getSubscriptionById.mockResolvedValue(mockSubscription);
      mockRepository.upsertUsageRecord.mockResolvedValue(mockUsageRecord);
      mockRepository.updateSubscription.mockResolvedValue(mockSubscription);

      const result = await saasLicenseService.syncSaaSUsage('sub-1');

      expect(result.subscriptionId).toBe('sub-1');
      expect(result.vendorName).toBe('ADOBE');
      expect(result.usersProcessed).toBeGreaterThan(0);
      expect(mockRepository.upsertUsageRecord).toHaveBeenCalled();
      expect(mockRepository.updateSubscription).toHaveBeenCalled();
    });

    it('should throw error for non-existent subscription', async () => {
      mockRepository.getSubscriptionById.mockResolvedValue(null);

      await expect(saasLicenseService.syncSaaSUsage('non-existent')).rejects.toThrow(
        'Subscription not found'
      );
    });

    it('should throw error for subscription without vendor portal ID', async () => {
      const subscriptionWithoutPortal = {
        ...mockSubscription,
        vendorPortalId: null,
      };
      mockRepository.getSubscriptionById.mockResolvedValue(subscriptionWithoutPortal);

      await expect(saasLicenseService.syncSaaSUsage('sub-1')).rejects.toThrow(
        'no vendor portal ID'
      );
    });
  });


  describe('getUnusedSubscriptions', () => {
    const mockUnusedSubscriptions: saasLicenseRepository.SaaSSubscription[] = [
      {
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
        vendorPortalId: 'adobe-portal-123',
        vendorContractId: null,
        lastSyncedAt: '2024-06-15T10:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
      },
      {
        subscriptionId: 'sub-2',
        vendorName: 'SALESFORCE',
        productName: 'Sales Cloud',
        subscriptionType: 'ANNUAL',
        totalSeats: 50,
        usedSeats: 40,
        unusedSeats: 10,
        costPerSeat: 150,
        totalCost: 7500,
        startDate: '2024-01-01',
        renewalDate: '2025-01-01',
        status: 'ACTIVE',
        vendorPortalId: 'sf-portal-456',
        vendorContractId: null,
        lastSyncedAt: '2024-06-15T10:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
      },
    ];

    const mockInactiveUsers: saasLicenseRepository.SaaSUsageRecord[] = [
      {
        usageId: 'usage-1',
        subscriptionId: 'sub-1',
        userId: 'user-1',
        userEmail: 'inactive@company.com',
        lastActiveDate: '2024-04-01T00:00:00Z',
        loginCount30Day: 0,
        featureUsage: {},
        isActive: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-06-15T10:00:00Z',
      },
    ];

    it('should return unused subscriptions with cost optimization details', async () => {
      mockRepository.getUnusedSubscriptions.mockResolvedValue(mockUnusedSubscriptions);
      mockRepository.getInactiveUsageRecords.mockResolvedValue(mockInactiveUsers);

      const result = await saasLicenseService.getUnusedSubscriptions(1, 30);

      expect(result.length).toBe(2);
      expect(result[0]?.unusedSeats).toBeGreaterThan(0);
      expect(result[0]?.potentialMonthlySavings).toBeGreaterThan(0);
      expect(result[0]?.potentialAnnualSavings).toBeGreaterThan(0);
      expect(result[0]?.recommendation).toBeDefined();
    });

    it('should sort by potential savings (highest first)', async () => {
      mockRepository.getUnusedSubscriptions.mockResolvedValue(mockUnusedSubscriptions);
      mockRepository.getInactiveUsageRecords.mockResolvedValue([]);

      const result = await saasLicenseService.getUnusedSubscriptions(1, 30);

      // First subscription has 75 unused seats * $50 = $3750/month
      // Second subscription has 10 unused seats * $150 = $1500/month
      expect(result[0]?.potentialMonthlySavings).toBeGreaterThanOrEqual(
        result[1]?.potentialMonthlySavings ?? 0
      );
    });

    it('should return empty array when no unused subscriptions', async () => {
      mockRepository.getUnusedSubscriptions.mockResolvedValue([]);

      const result = await saasLicenseService.getUnusedSubscriptions(1, 30);

      expect(result).toHaveLength(0);
    });

    it('should calculate utilization percentage correctly', async () => {
      mockRepository.getUnusedSubscriptions.mockResolvedValue([mockUnusedSubscriptions[0]!]);
      mockRepository.getInactiveUsageRecords.mockResolvedValue([]);

      const result = await saasLicenseService.getUnusedSubscriptions(1, 30);

      // 25 used out of 100 = 25% utilization
      expect(result[0]?.utilizationPercentage).toBe(25);
    });
  });


  describe('checkRenewalNotifications', () => {
    const mockExpiringSubscription: saasLicenseRepository.SaaSSubscription = {
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
      renewalDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!, // 25 days from now
      status: 'EXPIRING_SOON',
      vendorPortalId: 'adobe-portal-123',
      vendorContractId: null,
      lastSyncedAt: '2024-06-15T10:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    const mockNotification: saasLicenseRepository.RenewalNotification = {
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
    };

    it('should generate renewal notifications for expiring subscriptions', async () => {
      mockRepository.updateSubscriptionStatuses.mockResolvedValue(1);
      mockRepository.getExpiringSubscriptions.mockResolvedValue([mockExpiringSubscription]);
      mockRepository.createRenewalNotification.mockResolvedValue(mockNotification);

      const result = await saasLicenseService.checkRenewalNotifications();

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]?.notificationType).toBe('30_DAY');
      expect(mockRepository.createRenewalNotification).toHaveBeenCalled();
    });

    it('should return empty array when no subscriptions are expiring', async () => {
      mockRepository.updateSubscriptionStatuses.mockResolvedValue(0);
      mockRepository.getExpiringSubscriptions.mockResolvedValue([]);

      const result = await saasLicenseService.checkRenewalNotifications();

      expect(result).toHaveLength(0);
    });

    it('should not create duplicate notifications', async () => {
      const existingNotification = { ...mockNotification, status: 'SENT' as const };
      mockRepository.updateSubscriptionStatuses.mockResolvedValue(0);
      mockRepository.getExpiringSubscriptions.mockResolvedValue([mockExpiringSubscription]);
      mockRepository.createRenewalNotification.mockResolvedValue(existingNotification);

      const result = await saasLicenseService.checkRenewalNotifications();

      // Should not include already sent notifications
      expect(result).toHaveLength(0);
    });
  });


  describe('sendPendingNotifications', () => {
    const mockSubscription: saasLicenseRepository.SaaSSubscription = {
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
      renewalDate: '2024-07-15',
      status: 'EXPIRING_SOON',
      vendorPortalId: 'adobe-portal-123',
      vendorContractId: null,
      lastSyncedAt: '2024-06-15T10:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    const mockPendingNotification: saasLicenseRepository.RenewalNotification = {
      notificationId: 'notif-1',
      subscriptionId: 'sub-1',
      daysBeforeRenewal: 30,
      notificationType: '30_DAY',
      status: 'PENDING',
      sentAt: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      createdAt: '2024-06-15T10:00:00Z',
      updatedAt: '2024-06-15T10:00:00Z',
    };

    const mockSentNotification: saasLicenseRepository.RenewalNotification = {
      ...mockPendingNotification,
      status: 'SENT',
      sentAt: '2024-06-15T11:00:00Z',
    };

    it('should send pending notifications', async () => {
      mockRepository.getPendingNotifications.mockResolvedValue([mockPendingNotification]);
      mockRepository.getSubscriptionById.mockResolvedValue(mockSubscription);
      mockRepository.updateNotificationStatus.mockResolvedValue(mockSentNotification);

      const result = await saasLicenseService.sendPendingNotifications();

      expect(result.length).toBe(1);
      expect(result[0]?.status).toBe('SENT');
      expect(mockRepository.updateNotificationStatus).toHaveBeenCalledWith(
        'notif-1',
        'SENT'
      );
    });

    it('should return empty array when no pending notifications', async () => {
      mockRepository.getPendingNotifications.mockResolvedValue([]);

      const result = await saasLicenseService.sendPendingNotifications();

      expect(result).toHaveLength(0);
    });

    it('should skip notifications for non-existent subscriptions', async () => {
      mockRepository.getPendingNotifications.mockResolvedValue([mockPendingNotification]);
      mockRepository.getSubscriptionById.mockResolvedValue(null);

      const result = await saasLicenseService.sendPendingNotifications();

      expect(result).toHaveLength(0);
      expect(mockRepository.updateNotificationStatus).not.toHaveBeenCalled();
    });
  });


  describe('acknowledgeNotification', () => {
    const mockAcknowledgedNotification: saasLicenseRepository.RenewalNotification = {
      notificationId: 'notif-1',
      subscriptionId: 'sub-1',
      daysBeforeRenewal: 30,
      notificationType: '30_DAY',
      status: 'ACKNOWLEDGED',
      sentAt: '2024-06-15T10:00:00Z',
      acknowledgedBy: 'user-1',
      acknowledgedAt: '2024-06-15T11:00:00Z',
      createdAt: '2024-06-15T10:00:00Z',
      updatedAt: '2024-06-15T11:00:00Z',
    };

    it('should acknowledge a notification', async () => {
      mockRepository.updateNotificationStatus.mockResolvedValue(mockAcknowledgedNotification);

      const result = await saasLicenseService.acknowledgeNotification('notif-1', 'user-1');

      expect(result.status).toBe('ACKNOWLEDGED');
      expect(result.acknowledgedBy).toBe('user-1');
      expect(mockRepository.updateNotificationStatus).toHaveBeenCalledWith(
        'notif-1',
        'ACKNOWLEDGED',
        'user-1'
      );
    });
  });

  describe('getSubscriptionSummary', () => {
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
      byStatus: {
        ACTIVE: 4,
        EXPIRING_SOON: 1,
      },
    };

    it('should return subscription summary statistics', async () => {
      mockRepository.getSubscriptionSummary.mockResolvedValue(mockSummary);

      const result = await saasLicenseService.getSubscriptionSummary();

      expect(result.totalSubscriptions).toBe(5);
      expect(result.totalSeats).toBe(300);
      expect(result.unusedSeats).toBe(100);
      expect(result.potentialSavings).toBe(5000);
      expect(result.byVendor['ADOBE']).toBeDefined();
      expect(result.byStatus['ACTIVE']).toBe(4);
    });
  });

  describe('deleteSubscription', () => {
    it('should delete a subscription', async () => {
      mockRepository.deleteSubscription.mockResolvedValue(undefined);

      await saasLicenseService.deleteSubscription('sub-1');

      expect(mockRepository.deleteSubscription).toHaveBeenCalledWith('sub-1');
    });

    it('should throw error for non-existent subscription', async () => {
      mockRepository.deleteSubscription.mockRejectedValue(
        new Error('SaaS subscription not found: non-existent')
      );

      await expect(saasLicenseService.deleteSubscription('non-existent')).rejects.toThrow(
        'SaaS subscription not found'
      );
    });
  });
});