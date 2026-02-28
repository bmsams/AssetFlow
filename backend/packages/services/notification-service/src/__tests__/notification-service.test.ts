/**
 * Notification Service Unit Tests
 *
 * Tests for Notification Service:
 * - Multi-channel notification delivery (Requirement 17.1)
 * - Template variable substitution (Requirement 17.7)
 */

// Mock the dependencies before importing service
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
  validateUUID: jest.fn().mockReturnValue(null),
}));

// Mock the repository
jest.mock('../notification/notification-repository');

import * as notificationService from '../notification/notification-service';
import * as notificationRepository from '../notification/notification-repository';
import type { Notification, NotificationTemplate } from '../notification/notification-types';

const mockRepository = notificationRepository as jest.Mocked<typeof notificationRepository>;


describe('Notification Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendNotification', () => {
    const mockNotification: Notification = {
      notificationId: '123e4567-e89b-12d3-a456-426614174001',
      recipientId: '123e4567-e89b-12d3-a456-426614174000',
      recipientEmail: 'test@example.com',
      channel: 'EMAIL',
      eventType: 'SYSTEM_ALERT',
      subject: 'Test Subject',
      body: 'Test Body',
      priority: 'NORMAL',
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    it('should throw error when recipientId is missing', async () => {
      const request = {
        recipientId: '',
        channels: ['EMAIL' as const],
        eventType: 'SYSTEM_ALERT' as const,
        subject: 'Test',
        body: 'Test body',
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'Recipient ID is required'
      );
    });

    it('should throw error when channels is empty', async () => {
      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: [] as const,
        eventType: 'SYSTEM_ALERT' as const,
        subject: 'Test',
        body: 'Test body',
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'At least one notification channel is required'
      );
    });

    it('should throw error when eventType is missing', async () => {
      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['EMAIL' as const],
        eventType: '' as any,
        subject: 'Test',
        body: 'Test body',
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'Event type is required'
      );
    });

    it('should throw error when neither templateId nor content is provided', async () => {
      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP' as const],
        eventType: 'SYSTEM_ALERT' as const,
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'Either templateId or subject/body content is required'
      );
    });

    it('should throw error when email channel requires recipientEmail', async () => {
      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['EMAIL' as const],
        eventType: 'SYSTEM_ALERT' as const,
        subject: 'Test',
        body: 'Test body',
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'Recipient email is required for email notifications'
      );
    });

    it('should throw error when SMS channel requires recipientPhone', async () => {
      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['SMS' as const],
        eventType: 'SYSTEM_ALERT' as const,
        subject: 'Test',
        body: 'Test body',
      };

      await expect(notificationService.sendNotification(request)).rejects.toThrow(
        'Recipient phone is required for SMS notifications'
      );
    });

    it('should send notification to IN_APP channel without handler (returns failed)', async () => {
      mockRepository.createNotification.mockResolvedValue(mockNotification);
      mockRepository.updateNotificationStatus.mockResolvedValue(undefined);
      mockRepository.recordDeliveryAttempt.mockResolvedValue({
        attemptId: 'attempt-1',
        notificationId: mockNotification.notificationId,
        channel: 'IN_APP',
        attemptNumber: 1,
        status: 'FAILURE',
        attemptedAt: '2024-01-15T10:00:00.000Z',
        durationMs: 0,
      });

      const request = {
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP' as const],
        eventType: 'SYSTEM_ALERT' as const,
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const result = await notificationService.sendNotification(request);

      expect(result.totalRequested).toBe(1);
      // Without handler configured, it should fail
      expect(result.failed).toBe(1);
    });
  });


  describe('getNotification', () => {
    it('should return notification when found', async () => {
      const mockNotification: Notification = {
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'EMAIL',
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
        priority: 'NORMAL',
        status: 'DELIVERED',
        retryCount: 0,
        maxRetries: 3,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockRepository.getNotificationById.mockResolvedValue(mockNotification);

      const result = await notificationService.getNotification(mockNotification.notificationId);

      expect(result).toEqual(mockNotification);
      expect(mockRepository.getNotificationById).toHaveBeenCalledWith(mockNotification.notificationId);
    });

    it('should return null when notification not found', async () => {
      mockRepository.getNotificationById.mockResolvedValue(null);

      const result = await notificationService.getNotification('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockRepository.markNotificationAsRead.mockResolvedValue(undefined);

      await notificationService.markAsRead('123e4567-e89b-12d3-a456-426614174001');

      expect(mockRepository.markNotificationAsRead).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001'
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      mockRepository.markAllNotificationsAsRead.mockResolvedValue(5);

      const result = await notificationService.markAllAsRead(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).toBe(5);
      expect(mockRepository.markAllNotificationsAsRead).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        undefined
      );
    });

    it('should mark all notifications as read for a specific channel', async () => {
      mockRepository.markAllNotificationsAsRead.mockResolvedValue(3);

      const result = await notificationService.markAllAsRead(
        '123e4567-e89b-12d3-a456-426614174000',
        'IN_APP'
      );

      expect(result).toBe(3);
      expect(mockRepository.markAllNotificationsAsRead).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'IN_APP'
      );
    });
  });

  describe('getUnreadNotifications', () => {
    it('should return unread notifications for a user', async () => {
      const mockNotifications: Notification[] = [
        {
          notificationId: 'notif-1',
          recipientId: '123e4567-e89b-12d3-a456-426614174000',
          channel: 'IN_APP',
          eventType: 'SYSTEM_ALERT',
          subject: 'Test 1',
          body: 'Body 1',
          priority: 'NORMAL',
          status: 'DELIVERED',
          retryCount: 0,
          maxRetries: 3,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockRepository.getUnreadNotifications.mockResolvedValue(mockNotifications);

      const result = await notificationService.getUnreadNotifications(
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result).toEqual(mockNotifications);
    });
  });


  describe('Template Operations', () => {
    const mockTemplate: NotificationTemplate = {
      templateId: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Test Template',
      description: 'A test template',
      eventType: 'SYSTEM_ALERT',
      channel: 'EMAIL',
      subject: 'Hello {{userName}}',
      body: 'Your asset {{assetName}} has been updated.',
      variables: [
        { name: 'userName', required: true, type: 'string' },
        { name: 'assetName', required: true, type: 'string' },
      ],
      isActive: true,
      version: 1,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    describe('getTemplate', () => {
      it('should return template when found', async () => {
        mockRepository.getTemplateById.mockResolvedValue(mockTemplate);

        const result = await notificationService.getTemplate(mockTemplate.templateId);

        expect(result).toEqual(mockTemplate);
      });

      it('should return null when template not found', async () => {
        mockRepository.getTemplateById.mockResolvedValue(null);

        const result = await notificationService.getTemplate('non-existent-id');

        expect(result).toBeNull();
      });
    });

    describe('getTemplates', () => {
      it('should return all templates', async () => {
        mockRepository.getAllTemplates.mockResolvedValue([mockTemplate]);

        const result = await notificationService.getTemplates();

        expect(result).toEqual([mockTemplate]);
      });

      it('should filter templates by event type', async () => {
        mockRepository.getAllTemplates.mockResolvedValue([mockTemplate]);

        await notificationService.getTemplates({ eventType: 'SYSTEM_ALERT' });

        expect(mockRepository.getAllTemplates).toHaveBeenCalledWith({
          eventType: 'SYSTEM_ALERT',
        });
      });
    });

    describe('createTemplate', () => {
      it('should create a new template', async () => {
        mockRepository.createTemplate.mockResolvedValue(mockTemplate);

        const result = await notificationService.createTemplate({
          name: 'Test Template',
          eventType: 'SYSTEM_ALERT',
          channel: 'EMAIL',
          subject: 'Hello {{userName}}',
          body: 'Your asset {{assetName}} has been updated.',
          variables: [
            { name: 'userName', required: true, type: 'string' },
            { name: 'assetName', required: true, type: 'string' },
          ],
        });

        expect(result).toEqual(mockTemplate);
        expect(mockRepository.createTemplate).toHaveBeenCalled();
      });
    });

    describe('updateTemplate', () => {
      it('should update an existing template', async () => {
        const updatedTemplate = { ...mockTemplate, subject: 'Updated Subject' };
        mockRepository.updateTemplate.mockResolvedValue(updatedTemplate);

        const result = await notificationService.updateTemplate(mockTemplate.templateId, {
          subject: 'Updated Subject',
        });

        expect(result?.subject).toBe('Updated Subject');
      });

      it('should return null when template not found', async () => {
        mockRepository.updateTemplate.mockResolvedValue(null);

        const result = await notificationService.updateTemplate('non-existent-id', {
          subject: 'Updated Subject',
        });

        expect(result).toBeNull();
      });
    });

    describe('deleteTemplate', () => {
      it('should delete a template', async () => {
        mockRepository.deleteTemplate.mockResolvedValue(true);

        const result = await notificationService.deleteTemplate(mockTemplate.templateId);

        expect(result).toBe(true);
      });

      it('should return false when template not found', async () => {
        mockRepository.deleteTemplate.mockResolvedValue(false);

        const result = await notificationService.deleteTemplate('non-existent-id');

        expect(result).toBe(false);
      });
    });
  });


  describe('getStatistics', () => {
    it('should return notification statistics', async () => {
      const mockStats = {
        totalSent: 100,
        totalDelivered: 95,
        totalFailed: 5,
        totalRead: 80,
        byChannel: {
          EMAIL: 50,
          IN_APP: 30,
          SMS: 15,
          PUSH: 5,
        },
        byEventType: {
          CONTRACT_EXPIRING: 10,
          LOANER_OVERDUE: 10,
          STOCK_LOW: 10,
          COMPLIANCE_ALERT: 10,
          ASSET_STATE_CHANGED: 10,
          REQUEST_APPROVED: 10,
          REQUEST_REJECTED: 10,
          WORK_ORDER_ASSIGNED: 10,
          MAINTENANCE_DUE: 10,
          APPROVAL_REQUIRED: 5,
          SYSTEM_ALERT: 3,
          CUSTOM: 2,
        },
        deliveryRate: 0.95,
        readRate: 0.84,
      };

      mockRepository.getNotificationStatistics.mockResolvedValue(mockStats);

      const result = await notificationService.getStatistics();

      expect(result).toEqual(mockStats);
    });

    it('should filter statistics by date range', async () => {
      mockRepository.getNotificationStatistics.mockResolvedValue({
        totalSent: 50,
        totalDelivered: 48,
        totalFailed: 2,
        totalRead: 40,
        byChannel: { EMAIL: 50, IN_APP: 0, SMS: 0, PUSH: 0 },
        byEventType: {
          CONTRACT_EXPIRING: 5,
          LOANER_OVERDUE: 5,
          STOCK_LOW: 5,
          COMPLIANCE_ALERT: 5,
          ASSET_STATE_CHANGED: 5,
          REQUEST_APPROVED: 5,
          REQUEST_REJECTED: 5,
          WORK_ORDER_ASSIGNED: 5,
          MAINTENANCE_DUE: 5,
          APPROVAL_REQUIRED: 3,
          SYSTEM_ALERT: 1,
          CUSTOM: 1,
        },
        deliveryRate: 0.96,
        readRate: 0.83,
      });

      await notificationService.getStatistics({
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-01-31T23:59:59.999Z',
      });

      expect(mockRepository.getNotificationStatistics).toHaveBeenCalledWith({
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-01-31T23:59:59.999Z',
      });
    });
  });

  describe('retryFailedNotifications', () => {
    it('should process pending notifications for retry', async () => {
      mockRepository.getPendingNotificationsForRetry.mockResolvedValue([]);

      const result = await notificationService.retryFailedNotifications(10);

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe('cleanupOldNotifications', () => {
    it('should delete old notifications', async () => {
      mockRepository.deleteOldNotifications.mockResolvedValue(25);

      const result = await notificationService.cleanupOldNotifications(30);

      expect(result).toBe(25);
      expect(mockRepository.deleteOldNotifications).toHaveBeenCalledWith(30);
    });
  });
});
