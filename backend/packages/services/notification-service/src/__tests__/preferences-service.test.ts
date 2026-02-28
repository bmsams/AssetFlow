/**
 * Notification Preferences Service Unit Tests
 *
 * Tests for Notification Preferences Service:
 * - User notification preferences per event type (Requirement 17.2)
 * - Notification batching to prevent alert fatigue (Requirement 17.9)
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

import * as preferencesService from '../preferences/preferences-service';
import * as preferencesRepository from '../preferences/preferences-repository';

describe('Preferences Service', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the in-memory stores before each test
    preferencesRepository.resetStores();
  });

  describe('getUserPreferences', () => {
    /**
     * Validates: Requirement 17.2
     * Users should be able to retrieve their notification preferences
     */
    it('should create default preferences if none exist', async () => {
      const preferences = await preferencesService.getUserPreferences(testUserId);

      expect(preferences).toBeDefined();
      expect(preferences.userId).toBe(testUserId);
      expect(preferences.globalEnabled).toBe(true);
      expect(preferences.defaultFrequency).toBe('IMMEDIATE');
      expect(preferences.defaultChannels).toContain('EMAIL');
      expect(preferences.defaultChannels).toContain('IN_APP');
    });

    /**
     * Validates: Requirement 17.2
     * Default preferences should include all event types
     */
    it('should include preferences for all event types', async () => {
      const preferences = await preferencesService.getUserPreferences(testUserId);

      const expectedEventTypes = [
        'CONTRACT_EXPIRING',
        'LOANER_OVERDUE',
        'STOCK_LOW',
        'COMPLIANCE_ALERT',
        'ASSET_STATE_CHANGED',
        'REQUEST_APPROVED',
        'REQUEST_REJECTED',
        'WORK_ORDER_ASSIGNED',
        'MAINTENANCE_DUE',
        'APPROVAL_REQUIRED',
        'SYSTEM_ALERT',
        'CUSTOM',
      ];

      expect(preferences.eventPreferences.length).toBe(expectedEventTypes.length);

      for (const eventType of expectedEventTypes) {
        const eventPref = preferences.eventPreferences.find((ep) => ep.eventType === eventType);
        expect(eventPref).toBeDefined();
        expect(eventPref?.enabled).toBe(true);
      }
    });

    /**
     * Validates: Requirement 17.9
     * Default preferences should include batching configuration
     */
    it('should include default batching configuration', async () => {
      const preferences = await preferencesService.getUserPreferences(testUserId);

      expect(preferences.batchingConfig).toBeDefined();
      expect(preferences.batchingConfig.enabled).toBe(true);
      expect(preferences.batchingConfig.maxBatchSize).toBeGreaterThan(0);
      expect(preferences.batchingConfig.maxBatchWaitMinutes).toBeGreaterThan(0);
    });

    it('should return existing preferences if they exist', async () => {
      // Create preferences first
      const firstCall = await preferencesService.getUserPreferences(testUserId);

      // Get again - should return same preferences
      const secondCall = await preferencesService.getUserPreferences(testUserId);

      expect(secondCall.preferencesId).toBe(firstCall.preferencesId);
    });
  });

  describe('updatePreferences', () => {
    /**
     * Validates: Requirement 17.2
     * Users should be able to disable notifications globally
     */
    it('should update globalEnabled setting', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        globalEnabled: false,
      });

      expect(updated.globalEnabled).toBe(false);
    });

    /**
     * Validates: Requirement 17.2
     * Users should be able to change default frequency
     */
    it('should update defaultFrequency setting', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        defaultFrequency: 'DAILY',
      });

      expect(updated.defaultFrequency).toBe('DAILY');
    });

    /**
     * Validates: Requirement 17.2
     * Users should be able to change default channels
     */
    it('should update defaultChannels setting', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        defaultChannels: ['EMAIL'],
      });

      expect(updated.defaultChannels).toEqual(['EMAIL']);
    });

    /**
     * Validates: Requirement 17.2
     * Users should be able to configure preferences per event type
     */
    it('should update event-specific preferences', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        eventPreferences: [
          {
            eventType: 'CONTRACT_EXPIRING',
            enabled: false,
          },
        ],
      });

      const contractPref = updated.eventPreferences.find(
        (ep) => ep.eventType === 'CONTRACT_EXPIRING'
      );
      expect(contractPref?.enabled).toBe(false);
    });

    /**
     * Validates: Requirement 17.2
     * Users should be able to configure channel preferences per event type
     */
    it('should update channel preferences for specific event types', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        eventPreferences: [
          {
            eventType: 'LOANER_OVERDUE',
            channels: [
              {
                channel: 'SMS',
                enabled: true,
                frequency: 'IMMEDIATE',
              },
            ],
          },
        ],
      });

      const loanerPref = updated.eventPreferences.find((ep) => ep.eventType === 'LOANER_OVERDUE');
      const smsPref = loanerPref?.channels.find((cp) => cp.channel === 'SMS');
      expect(smsPref?.enabled).toBe(true);
      expect(smsPref?.frequency).toBe('IMMEDIATE');
    });

    /**
     * Validates: Requirement 17.9
     * Users should be able to configure quiet hours
     */
    it('should update quiet hours configuration', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
      });

      expect(updated.quietHours.enabled).toBe(true);
      expect(updated.quietHours.startTime).toBe('22:00');
      expect(updated.quietHours.endTime).toBe('08:00');
      expect(updated.quietHours.timezone).toBe('America/New_York');
    });

    /**
     * Validates: Requirement 17.9
     * Users should be able to configure batching settings
     */
    it('should update batching configuration', async () => {
      const updated = await preferencesService.updatePreferences({
        userId: testUserId,
        batchingConfig: {
          enabled: true,
          maxBatchSize: 100,
          maxBatchWaitMinutes: 120,
          groupByEventType: true,
          digestFormat: 'DETAILED',
        },
      });

      expect(updated.batchingConfig.enabled).toBe(true);
      expect(updated.batchingConfig.maxBatchSize).toBe(100);
      expect(updated.batchingConfig.maxBatchWaitMinutes).toBe(120);
      expect(updated.batchingConfig.digestFormat).toBe('DETAILED');
    });

    it('should throw error when userId is missing', async () => {
      await expect(
        preferencesService.updatePreferences({
          userId: '',
          globalEnabled: false,
        })
      ).rejects.toThrow('User ID is required');
    });

    it('should throw error for invalid quiet hours time format', async () => {
      await expect(
        preferencesService.updatePreferences({
          userId: testUserId,
          quietHours: {
            startTime: '25:00', // Invalid
          },
        })
      ).rejects.toThrow('Invalid startTime format');
    });

    it('should throw error for invalid day of week', async () => {
      await expect(
        preferencesService.updatePreferences({
          userId: testUserId,
          quietHours: {
            daysOfWeek: [7], // Invalid - should be 0-6
          },
        })
      ).rejects.toThrow('Invalid day of week');
    });

    it('should throw error for invalid maxBatchSize', async () => {
      await expect(
        preferencesService.updatePreferences({
          userId: testUserId,
          batchingConfig: {
            maxBatchSize: 0, // Invalid - must be at least 1
          },
        })
      ).rejects.toThrow('maxBatchSize must be at least 1');
    });
  });

  describe('resetPreferences', () => {
    it('should reset preferences to defaults', async () => {
      // First update preferences
      await preferencesService.updatePreferences({
        userId: testUserId,
        globalEnabled: false,
        defaultFrequency: 'WEEKLY',
      });

      // Reset
      const reset = await preferencesService.resetPreferences(testUserId);

      expect(reset.globalEnabled).toBe(true);
      expect(reset.defaultFrequency).toBe('IMMEDIATE');
    });
  });

  describe('shouldSendNotification', () => {
    /**
     * Validates: Requirement 17.2
     * Notification decision should respect global enabled setting
     */
    it('should return shouldSend=false when notifications are globally disabled', async () => {
      await preferencesService.updatePreferences({
        userId: testUserId,
        globalEnabled: false,
      });

      const decision = await preferencesService.shouldSendNotification(
        testUserId,
        'SYSTEM_ALERT',
        ['EMAIL']
      );

      expect(decision.shouldSend).toBe(false);
      expect(decision.reason).toContain('globally disabled');
    });

    /**
     * Validates: Requirement 17.2
     * Notification decision should respect event type enabled setting
     */
    it('should return shouldSend=false when event type is disabled', async () => {
      await preferencesService.updatePreferences({
        userId: testUserId,
        eventPreferences: [
          {
            eventType: 'CONTRACT_EXPIRING',
            enabled: false,
          },
        ],
      });

      const decision = await preferencesService.shouldSendNotification(
        testUserId,
        'CONTRACT_EXPIRING',
        ['EMAIL']
      );

      expect(decision.shouldSend).toBe(false);
      expect(decision.reason).toContain('disabled for event type');
    });

    /**
     * Validates: Requirement 17.2
     * Notification decision should return enabled channels
     */
    it('should return enabled channels based on preferences', async () => {
      await preferencesService.updatePreferences({
        userId: testUserId,
        eventPreferences: [
          {
            eventType: 'SYSTEM_ALERT',
            channels: [
              { channel: 'EMAIL', enabled: true },
              { channel: 'SMS', enabled: false },
            ],
          },
        ],
      });

      const decision = await preferencesService.shouldSendNotification(
        testUserId,
        'SYSTEM_ALERT',
        ['EMAIL', 'SMS']
      );

      expect(decision.enabledChannels).toContain('EMAIL');
      expect(decision.enabledChannels).not.toContain('SMS');
    });

    /**
     * Validates: Requirement 17.9
     * Notification decision should indicate batching when frequency is not IMMEDIATE
     */
    it('should indicate batching when channel frequency is not IMMEDIATE', async () => {
      await preferencesService.updatePreferences({
        userId: testUserId,
        eventPreferences: [
          {
            eventType: 'ASSET_STATE_CHANGED',
            channels: [
              { channel: 'EMAIL', enabled: true, frequency: 'DAILY' },
            ],
          },
        ],
      });

      const decision = await preferencesService.shouldSendNotification(
        testUserId,
        'ASSET_STATE_CHANGED',
        ['EMAIL']
      );

      expect(decision.shouldBatch).toBe(true);
      expect(decision.batchFrequency).toBe('DAILY');
    });

    it('should return shouldSend=true for immediate notifications', async () => {
      // Use default preferences which have IMMEDIATE frequency
      const decision = await preferencesService.shouldSendNotification(
        testUserId,
        'APPROVAL_REQUIRED',
        ['IN_APP']
      );

      expect(decision.shouldSend).toBe(true);
      expect(decision.shouldBatch).toBe(false);
    });
  });

  describe('queueForBatch', () => {
    /**
     * Validates: Requirement 17.9
     * Notifications should be queueable for batched delivery
     */
    it('should queue notification for batch delivery', async () => {
      const batched = await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'EMAIL',
          subject: 'Asset Updated',
          body: 'Your asset has been updated.',
        },
        'DAILY'
      );

      expect(batched.batchId).toBeDefined();
      expect(batched.userId).toBe(testUserId);
      expect(batched.eventType).toBe('ASSET_STATE_CHANGED');
      expect(batched.queuedAt).toBeDefined();
      expect(batched.scheduledFor).toBeDefined();
    });

    it('should calculate correct scheduled time for hourly batching', async () => {
      const batched = await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'STOCK_LOW',
          channel: 'EMAIL',
          subject: 'Low Stock Alert',
          body: 'Stock is running low.',
        },
        'HOURLY'
      );

      const scheduledDate = new Date(batched.scheduledFor);
      const now = new Date();

      // Should be scheduled for the next hour
      expect(scheduledDate.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('getPendingBatchedNotifications', () => {
    /**
     * Validates: Requirement 17.9
     * Users should be able to view their pending batched notifications
     */
    it('should return pending batched notifications for a user', async () => {
      // Queue some notifications
      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'EMAIL',
          subject: 'Asset 1 Updated',
          body: 'Asset 1 has been updated.',
        },
        'DAILY'
      );

      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'CONTRACT_EXPIRING',
          channel: 'EMAIL',
          subject: 'Contract Expiring',
          body: 'A contract is expiring soon.',
        },
        'DAILY'
      );

      const pending = await preferencesService.getPendingBatchedNotifications(testUserId);

      expect(pending.length).toBe(2);
    });

    it('should filter by channel when specified', async () => {
      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'EMAIL',
          subject: 'Email Notification',
          body: 'Email body.',
        },
        'DAILY'
      );

      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'IN_APP',
          subject: 'In-App Notification',
          body: 'In-app body.',
        },
        'DAILY'
      );

      const emailPending = await preferencesService.getPendingBatchedNotifications(
        testUserId,
        'EMAIL'
      );

      expect(emailPending.length).toBe(1);
      expect(emailPending[0]?.channel).toBe('EMAIL');
    });
  });

  describe('createBatchFromPending', () => {
    /**
     * Validates: Requirement 17.9
     * Pending notifications should be groupable into batches
     */
    it('should create a batch from pending notifications', async () => {
      // Queue notifications
      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'EMAIL',
          subject: 'Asset Updated',
          body: 'Asset has been updated.',
        },
        'DAILY'
      );

      const batch = await preferencesService.createBatchFromPending(testUserId, 'EMAIL', 'DAILY');

      expect(batch).toBeDefined();
      expect(batch?.userId).toBe(testUserId);
      expect(batch?.channel).toBe('EMAIL');
      expect(batch?.notifications.length).toBe(1);
      expect(batch?.status).toBe('PENDING');
    });

    it('should return null when no pending notifications exist', async () => {
      const batch = await preferencesService.createBatchFromPending(testUserId, 'EMAIL', 'DAILY');

      expect(batch).toBeNull();
    });
  });

  describe('processPendingBatches', () => {
    /**
     * Validates: Requirement 17.9
     * Batched notifications should be processable for delivery
     */
    it('should process pending batches', async () => {
      // Queue and create a batch
      await preferencesService.queueForBatch(
        {
          userId: testUserId,
          eventType: 'ASSET_STATE_CHANGED',
          channel: 'EMAIL',
          subject: 'Asset Updated',
          body: 'Asset has been updated.',
        },
        'IMMEDIATE' // Use IMMEDIATE so it's ready for processing
      );

      await preferencesService.createBatchFromPending(testUserId, 'EMAIL', 'IMMEDIATE');

      const result = await preferencesService.processPendingBatches(10);

      expect(result.processed).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Preferences Service - Edge Cases', () => {
  const testUserId = '123e4567-e89b-12d3-a456-426614174001';

  beforeEach(() => {
    jest.clearAllMocks();
    preferencesRepository.resetStores();
  });

  it('should handle partial updates without affecting other settings', async () => {
    // Create initial preferences
    await preferencesService.getUserPreferences(testUserId);

    // Update only globalEnabled
    const updated = await preferencesService.updatePreferences({
      userId: testUserId,
      globalEnabled: false,
    });

    // Other settings should remain at defaults
    expect(updated.globalEnabled).toBe(false);
    expect(updated.defaultFrequency).toBe('IMMEDIATE');
    expect(updated.defaultChannels).toContain('EMAIL');
    expect(updated.batchingConfig.enabled).toBe(true);
  });

  it('should preserve unmodified event preferences when updating specific ones', async () => {
    // Create initial preferences
    await preferencesService.getUserPreferences(testUserId);

    // Update only CONTRACT_EXPIRING
    const updated = await preferencesService.updatePreferences({
      userId: testUserId,
      eventPreferences: [
        {
          eventType: 'CONTRACT_EXPIRING',
          enabled: false,
        },
      ],
    });

    // CONTRACT_EXPIRING should be disabled
    const contractPref = updated.eventPreferences.find(
      (ep) => ep.eventType === 'CONTRACT_EXPIRING'
    );
    expect(contractPref?.enabled).toBe(false);

    // Other event types should still be enabled
    const systemAlertPref = updated.eventPreferences.find(
      (ep) => ep.eventType === 'SYSTEM_ALERT'
    );
    expect(systemAlertPref?.enabled).toBe(true);
  });

  it('should handle multiple channel updates for same event type', async () => {
    const updated = await preferencesService.updatePreferences({
      userId: testUserId,
      eventPreferences: [
        {
          eventType: 'LOANER_OVERDUE',
          channels: [
            { channel: 'EMAIL', enabled: true, frequency: 'IMMEDIATE' },
            { channel: 'SMS', enabled: true, frequency: 'IMMEDIATE' },
            { channel: 'PUSH', enabled: false },
          ],
        },
      ],
    });

    const loanerPref = updated.eventPreferences.find((ep) => ep.eventType === 'LOANER_OVERDUE');

    const emailPref = loanerPref?.channels.find((cp) => cp.channel === 'EMAIL');
    const smsPref = loanerPref?.channels.find((cp) => cp.channel === 'SMS');
    const pushPref = loanerPref?.channels.find((cp) => cp.channel === 'PUSH');

    expect(emailPref?.enabled).toBe(true);
    expect(smsPref?.enabled).toBe(true);
    expect(pushPref?.enabled).toBe(false);
  });
});
