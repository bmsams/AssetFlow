/**
 * Notification Tracking Service Unit Tests
 *
 * Tests for Tracking Service:
 * - Delivery status tracking (Requirement 17.8)
 * - Read receipts (Requirement 17.8)
 * - Notification history for audit (Requirement 17.8)
 * - Retry logic for failed deliveries (Requirement 17.8)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
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
  validateUUID: jest.fn().mockReturnValue(null),
}));

import * as trackingService from '../tracking/tracking-service';
import * as trackingRepository from '../tracking/tracking-repository';
import { DEFAULT_RETRY_CONFIGS } from '../tracking/tracking-types';

describe('Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear in-memory storage before each test
    trackingRepository.clearAllTrackingData();
  });

  describe('Delivery Tracking', () => {
    describe('createDeliveryTracking', () => {
      it('should create a delivery tracking record', async () => {
        const request = {
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        };

        const result = await trackingService.createDeliveryTracking(request);

        expect(result).toBeDefined();
        expect(result.trackingId).toBeDefined();
        expect(result.notificationId).toBe(request.notificationId);
        expect(result.channel).toBe(request.channel);
        expect(result.recipientId).toBe(request.recipientId);
        expect(result.recipientAddress).toBe(request.recipientAddress);
        expect(result.status).toBe('QUEUED');
        expect(result.attemptCount).toBe(0);
        expect(result.maxAttempts).toBe(DEFAULT_RETRY_CONFIGS.EMAIL.maxAttempts);
      });

      it('should use custom maxAttempts when provided', async () => {
        const request = {
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'SMS' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: '+1234567890',
          maxAttempts: 5,
        };

        const result = await trackingService.createDeliveryTracking(request);

        expect(result.maxAttempts).toBe(5);
      });
    });

    describe('updateDeliveryStatus', () => {
      it('should update delivery status to SENT', async () => {
        // Create a tracking record first
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const result = await trackingService.markAsSent(
          tracking.trackingId,
          'provider-msg-123',
          'Accepted'
        );

        expect(result).toBeDefined();
        expect(result?.status).toBe('SENT');
        expect(result?.providerMessageId).toBe('provider-msg-123');
        expect(result?.providerResponse).toBe('Accepted');
        expect(result?.attemptCount).toBe(1);
      });

      it('should update delivery status to DELIVERED', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const result = await trackingService.markAsDelivered(
          tracking.trackingId,
          'provider-msg-123'
        );

        expect(result).toBeDefined();
        expect(result?.status).toBe('DELIVERED');
        expect(result?.deliveredAt).toBeDefined();
      });

      it('should update delivery status to FAILED with retry scheduled', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const result = await trackingService.markAsFailed(
          tracking.trackingId,
          'Connection timeout',
          'TIMEOUT',
          true
        );

        expect(result).toBeDefined();
        expect(result?.status).toBe('FAILED');
        expect(result?.failureReason).toBe('Connection timeout');
        expect(result?.failureCode).toBe('TIMEOUT');
        expect(result?.nextRetryAt).toBeDefined();
      });

      it('should not schedule retry when scheduleRetry is false', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const result = await trackingService.markAsFailed(
          tracking.trackingId,
          'Permanent failure',
          'PERMANENT',
          false
        );

        expect(result).toBeDefined();
        expect(result?.status).toBe('FAILED');
        expect(result?.nextRetryAt).toBeUndefined();
      });

      it('should update delivery status to BOUNCED', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'invalid@example.com',
        });

        const result = await trackingService.markAsBounced(
          tracking.trackingId,
          'Mailbox not found'
        );

        expect(result).toBeDefined();
        expect(result?.status).toBe('BOUNCED');
        expect(result?.failureReason).toBe('Mailbox not found');
      });

      it('should return null for non-existent tracking ID', async () => {
        const result = await trackingService.markAsDelivered('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('getDeliveryTracking', () => {
      it('should retrieve tracking record by ID', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const result = await trackingService.getDeliveryTracking(tracking.trackingId);

        expect(result).toBeDefined();
        expect(result?.trackingId).toBe(tracking.trackingId);
      });

      it('should return null for non-existent ID', async () => {
        const result = await trackingService.getDeliveryTracking('non-existent-id');
        expect(result).toBeNull();
      });
    });

    describe('getDeliveryTrackingByNotification', () => {
      it('should retrieve all tracking records for a notification', async () => {
        const notificationId = '123e4567-e89b-12d3-a456-426614174001';

        // Create multiple tracking records for same notification
        await trackingService.createDeliveryTracking({
          notificationId,
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        await trackingService.createDeliveryTracking({
          notificationId,
          channel: 'SMS' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: '+1234567890',
        });

        const results = await trackingService.getDeliveryTrackingByNotification(notificationId);

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.notificationId === notificationId)).toBe(true);
      });
    });
  });

  describe('Read Receipts', () => {
    describe('recordReadReceipt', () => {
      it('should record a read receipt', async () => {
        const notificationId = '123e4567-e89b-12d3-a456-426614174001';
        const recipientId = '123e4567-e89b-12d3-a456-426614174000';

        const result = await trackingService.recordReadReceipt(
          notificationId,
          recipientId,
          'EMAIL',
          'WEB_APP',
          { deviceType: 'desktop', browser: 'Chrome' }
        );

        expect(result).toBeDefined();
        expect(result.receiptId).toBeDefined();
        expect(result.notificationId).toBe(notificationId);
        expect(result.recipientId).toBe(recipientId);
        expect(result.channel).toBe('EMAIL');
        expect(result.readSource).toBe('WEB_APP');
        expect(result.readAt).toBeDefined();
        expect(result.deviceInfo?.deviceType).toBe('desktop');
      });

      it('should return existing receipt if already read', async () => {
        const notificationId = '123e4567-e89b-12d3-a456-426614174001';
        const recipientId = '123e4567-e89b-12d3-a456-426614174000';

        const firstReceipt = await trackingService.recordReadReceipt(
          notificationId,
          recipientId,
          'EMAIL',
          'WEB_APP'
        );

        const secondReceipt = await trackingService.recordReadReceipt(
          notificationId,
          recipientId,
          'EMAIL',
          'MOBILE_APP'
        );

        expect(secondReceipt.receiptId).toBe(firstReceipt.receiptId);
        expect(secondReceipt.readSource).toBe('WEB_APP'); // Original source preserved
      });
    });

    describe('hasBeenRead', () => {
      it('should return true if notification has been read', async () => {
        const notificationId = '123e4567-e89b-12d3-a456-426614174001';

        await trackingService.recordReadReceipt(
          notificationId,
          '123e4567-e89b-12d3-a456-426614174000',
          'IN_APP',
          'WEB_APP'
        );

        const result = await trackingService.hasBeenRead(notificationId);
        expect(result).toBe(true);
      });

      it('should return false if notification has not been read', async () => {
        const result = await trackingService.hasBeenRead('unread-notification-id');
        expect(result).toBe(false);
      });
    });

    describe('getReadReceipt', () => {
      it('should retrieve read receipt by notification ID', async () => {
        const notificationId = '123e4567-e89b-12d3-a456-426614174001';

        await trackingService.recordReadReceipt(
          notificationId,
          '123e4567-e89b-12d3-a456-426614174000',
          'EMAIL',
          'EMAIL_LINK'
        );

        const result = await trackingService.getReadReceipt(notificationId);

        expect(result).toBeDefined();
        expect(result?.notificationId).toBe(notificationId);
        expect(result?.readSource).toBe('EMAIL_LINK');
      });

      it('should return null if no read receipt exists', async () => {
        const result = await trackingService.getReadReceipt('no-receipt-id');
        expect(result).toBeNull();
      });
    });
  });

  describe('Notification History', () => {
    describe('logNotificationHistory', () => {
      it('should create a history entry', async () => {
        const result = await trackingService.logNotificationHistory({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          channel: 'EMAIL',
          eventType: 'CONTRACT_EXPIRING',
          subject: 'Contract Expiring Soon',
          priority: 'HIGH',
          status: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
          templateId: 'template-123',
          templateName: 'contract-expiration',
          sentAt: '2024-01-15T10:00:00.000Z',
        });

        expect(result).toBeDefined();
        expect(result.historyId).toBeDefined();
        expect(result.notificationId).toBe('123e4567-e89b-12d3-a456-426614174001');
        expect(result.eventType).toBe('CONTRACT_EXPIRING');
        expect(result.subject).toBe('Contract Expiring Soon');
        expect(result.attemptCount).toBe(1);
      });
    });

    describe('queryNotificationHistory', () => {
      beforeEach(async () => {
        // Create some history entries for testing
        await trackingService.logNotificationHistory({
          notificationId: 'notif-1',
          recipientId: 'user-1',
          channel: 'EMAIL',
          eventType: 'CONTRACT_EXPIRING',
          subject: 'Contract 1 Expiring',
          priority: 'HIGH',
          status: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
        });

        await trackingService.logNotificationHistory({
          notificationId: 'notif-2',
          recipientId: 'user-1',
          channel: 'SMS',
          eventType: 'LOANER_OVERDUE',
          subject: 'Loaner Overdue',
          priority: 'NORMAL',
          status: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
        });

        await trackingService.logNotificationHistory({
          notificationId: 'notif-3',
          recipientId: 'user-2',
          channel: 'EMAIL',
          eventType: 'STOCK_LOW',
          subject: 'Stock Alert',
          priority: 'NORMAL',
          status: 'FAILED',
          deliveryStatus: 'FAILED',
        });
      });

      it('should return all history entries', async () => {
        const result = await trackingService.queryNotificationHistory({});

        expect(result.entries.length).toBe(3);
        expect(result.total).toBe(3);
      });

      it('should filter by recipientId', async () => {
        const result = await trackingService.queryNotificationHistory({
          recipientId: 'user-1',
        });

        expect(result.entries.length).toBe(2);
        expect(result.entries.every((e) => e.recipientId === 'user-1')).toBe(true);
      });

      it('should filter by channel', async () => {
        const result = await trackingService.queryNotificationHistory({
          channel: 'EMAIL',
        });

        expect(result.entries.length).toBe(2);
        expect(result.entries.every((e) => e.channel === 'EMAIL')).toBe(true);
      });

      it('should filter by eventType', async () => {
        const result = await trackingService.queryNotificationHistory({
          eventType: 'CONTRACT_EXPIRING',
        });

        expect(result.entries.length).toBe(1);
        expect(result.entries[0]?.eventType).toBe('CONTRACT_EXPIRING');
      });

      it('should filter by deliveryStatus', async () => {
        const result = await trackingService.queryNotificationHistory({
          deliveryStatus: 'FAILED',
        });

        expect(result.entries.length).toBe(1);
        expect(result.entries[0]?.deliveryStatus).toBe('FAILED');
      });

      it('should paginate results', async () => {
        const result = await trackingService.queryNotificationHistory({
          page: 1,
          limit: 2,
        });

        expect(result.entries.length).toBe(2);
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(true);
      });
    });

    describe('getUserNotificationHistory', () => {
      it('should get history for a specific user', async () => {
        await trackingService.logNotificationHistory({
          notificationId: 'notif-1',
          recipientId: 'user-1',
          channel: 'EMAIL',
          eventType: 'SYSTEM_ALERT',
          subject: 'Alert 1',
          priority: 'NORMAL',
          status: 'DELIVERED',
          deliveryStatus: 'DELIVERED',
        });

        const result = await trackingService.getUserNotificationHistory('user-1');

        expect(result.entries.length).toBe(1);
        expect(result.entries[0]?.recipientId).toBe('user-1');
      });
    });
  });

  describe('Retry Logic', () => {
    describe('calculateNextRetryTime', () => {
      it('should calculate exponential backoff for EMAIL', () => {
        const config = DEFAULT_RETRY_CONFIGS.EMAIL;

        // First retry
        const firstRetry = trackingService.calculateNextRetryTime('EMAIL', 0);
        const firstRetryTime = new Date(firstRetry).getTime();
        const now = Date.now();
        const expectedFirstDelay = config.initialDelayMs;

        expect(firstRetryTime - now).toBeGreaterThanOrEqual(expectedFirstDelay - 1000);
        expect(firstRetryTime - now).toBeLessThanOrEqual(expectedFirstDelay + 1000);

        // Second retry (should be 2x initial delay)
        const secondRetry = trackingService.calculateNextRetryTime('EMAIL', 1);
        const secondRetryTime = new Date(secondRetry).getTime();
        const expectedSecondDelay = config.initialDelayMs * config.backoffMultiplier;

        expect(secondRetryTime - now).toBeGreaterThanOrEqual(expectedSecondDelay - 1000);
        expect(secondRetryTime - now).toBeLessThanOrEqual(expectedSecondDelay + 1000);
      });

      it('should cap delay at maxDelayMs', () => {
        const config = DEFAULT_RETRY_CONFIGS.EMAIL;

        // Many retries should cap at max
        const retry = trackingService.calculateNextRetryTime('EMAIL', 100);
        const retryTime = new Date(retry).getTime();
        const now = Date.now();

        expect(retryTime - now).toBeLessThanOrEqual(config.maxDelayMs + 1000);
      });
    });

    describe('isRetryableStatus', () => {
      it('should return true for retryable statuses', () => {
        expect(trackingService.isRetryableStatus('EMAIL', 'FAILED')).toBe(true);
        expect(trackingService.isRetryableStatus('EMAIL', 'REJECTED')).toBe(true);
      });

      it('should return false for non-retryable statuses', () => {
        expect(trackingService.isRetryableStatus('EMAIL', 'DELIVERED')).toBe(false);
        expect(trackingService.isRetryableStatus('EMAIL', 'BOUNCED')).toBe(false);
      });
    });

    describe('getPendingRetries', () => {
      it('should return pending retries that are due', async () => {
        // Create a tracking record and mark it as failed with past retry time
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        // Mark as failed with immediate retry
        await trackingRepository.updateDeliveryStatus({
          trackingId: tracking.trackingId,
          status: 'FAILED',
          failureReason: 'Test failure',
          nextRetryAt: new Date(Date.now() - 1000).toISOString(), // Past time
        });

        const pendingRetries = await trackingService.getPendingRetries();

        expect(pendingRetries.length).toBe(1);
        expect(pendingRetries[0]?.trackingId).toBe(tracking.trackingId);
      });

      it('should not return retries that are not yet due', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        // Mark as failed with future retry
        await trackingRepository.updateDeliveryStatus({
          trackingId: tracking.trackingId,
          status: 'FAILED',
          failureReason: 'Test failure',
          nextRetryAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour in future
        });

        const pendingRetries = await trackingService.getPendingRetries();

        expect(pendingRetries.length).toBe(0);
      });
    });

    describe('processRetryAttempt', () => {
      it('should record successful retry attempt', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const attempt = await trackingService.processRetryAttempt(
          tracking.trackingId,
          true,
          undefined,
          undefined,
          150
        );

        expect(attempt).toBeDefined();
        expect(attempt.status).toBe('SUCCESS');
        expect(attempt.attemptNumber).toBe(1);
        expect(attempt.responseTime).toBe(150);

        // Check tracking was updated
        const updatedTracking = await trackingService.getDeliveryTracking(tracking.trackingId);
        expect(updatedTracking?.status).toBe('DELIVERED');
      });

      it('should record failed retry attempt', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        const attempt = await trackingService.processRetryAttempt(
          tracking.trackingId,
          false,
          'TIMEOUT',
          'Connection timeout',
          5000
        );

        expect(attempt).toBeDefined();
        expect(attempt.status).toBe('FAILURE');
        expect(attempt.errorCode).toBe('TIMEOUT');
        expect(attempt.errorMessage).toBe('Connection timeout');

        // Check tracking was updated
        const updatedTracking = await trackingService.getDeliveryTracking(tracking.trackingId);
        expect(updatedTracking?.status).toBe('FAILED');
      });

      it('should throw error for non-existent tracking ID', async () => {
        await expect(
          trackingService.processRetryAttempt('non-existent-id', true)
        ).rejects.toThrow('Tracking record not found');
      });
    });

    describe('getRetryAttempts', () => {
      it('should return all retry attempts for a tracking record', async () => {
        const tracking = await trackingService.createDeliveryTracking({
          notificationId: '123e4567-e89b-12d3-a456-426614174001',
          channel: 'EMAIL' as const,
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          recipientAddress: 'test@example.com',
        });

        // Record multiple attempts
        await trackingService.processRetryAttempt(tracking.trackingId, false, 'ERROR1', 'First failure');
        await trackingService.processRetryAttempt(tracking.trackingId, false, 'ERROR2', 'Second failure');
        await trackingService.processRetryAttempt(tracking.trackingId, true);

        const attempts = await trackingService.getRetryAttempts(tracking.trackingId);

        expect(attempts.length).toBe(3);
        expect(attempts[0]?.attemptNumber).toBe(1);
        expect(attempts[1]?.attemptNumber).toBe(2);
        expect(attempts[2]?.attemptNumber).toBe(3);
        expect(attempts[2]?.status).toBe('SUCCESS');
      });
    });
  });

  describe('Statistics', () => {
    describe('getTrackingStatistics', () => {
      beforeEach(async () => {
        // Create some tracking records
        const tracking1 = await trackingService.createDeliveryTracking({
          notificationId: 'notif-1',
          channel: 'EMAIL' as const,
          recipientId: 'user-1',
          recipientAddress: 'test1@example.com',
        });
        await trackingService.markAsDelivered(tracking1.trackingId);

        const tracking2 = await trackingService.createDeliveryTracking({
          notificationId: 'notif-2',
          channel: 'EMAIL' as const,
          recipientId: 'user-2',
          recipientAddress: 'test2@example.com',
        });
        await trackingService.markAsFailed(tracking2.trackingId, 'Failed', undefined, false);

        const tracking3 = await trackingService.createDeliveryTracking({
          notificationId: 'notif-3',
          channel: 'SMS' as const,
          recipientId: 'user-1',
          recipientAddress: '+1234567890',
        });
        await trackingService.markAsDelivered(tracking3.trackingId);

        // Record read receipts
        await trackingService.recordReadReceipt('notif-1', 'user-1', 'EMAIL', 'WEB_APP');
      });

      it('should return comprehensive statistics', async () => {
        const fromDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
        const toDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now

        const stats = await trackingService.getTrackingStatistics(fromDate, toDate);

        expect(stats.delivery.totalSent).toBe(3);
        expect(stats.delivery.totalDelivered).toBe(2);
        expect(stats.delivery.totalFailed).toBe(1);
        expect(stats.delivery.byChannel.EMAIL.sent).toBe(2);
        expect(stats.delivery.byChannel.SMS.sent).toBe(1);

        expect(stats.read.totalRead).toBe(1);
        expect(stats.read.bySource.WEB_APP).toBe(1);

        expect(stats.period.from).toBe(fromDate);
        expect(stats.period.to).toBe(toDate);
      });
    });
  });

  describe('Cleanup', () => {
    describe('cleanupOldTrackingData', () => {
      it('should delete old tracking data', async () => {
        // Create a tracking record
        await trackingService.createDeliveryTracking({
          notificationId: 'notif-1',
          channel: 'EMAIL' as const,
          recipientId: 'user-1',
          recipientAddress: 'test@example.com',
        });

        // Cleanup with 0 days (should delete everything)
        const result = await trackingService.cleanupOldTrackingData(0);

        expect(result.trackingRecords).toBeGreaterThanOrEqual(0);
        expect(result.historyEntries).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
