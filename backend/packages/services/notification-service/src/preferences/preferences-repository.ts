/**
 * Notification Preferences Repository
 *
 * Database operations for notification preferences and batching.
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.9: Implement notification batching to prevent alert fatigue
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { NotificationChannel, NotificationEventType } from '../notification/notification-types';
import type {
  BatchedNotification,
  BatchingConfig,
  BatchStatus,
  ChannelPreference,
  EventTypePreference,
  NotificationBatch,
  NotificationFrequency,
  NotificationPreferences,
  QuietHours,
} from './preferences-types';

const logger = createLogger({ service: 'preferences-repository' });

// ============================================================================
// In-Memory Storage (for development/testing)
// In production, this would use the database
// ============================================================================

const preferencesStore = new Map<UUID, NotificationPreferences>();
const batchedNotificationsStore = new Map<UUID, BatchedNotification[]>();
const batchesStore = new Map<UUID, NotificationBatch>();

// ============================================================================
// Preferences Operations
// ============================================================================

/**
 * Get user notification preferences
 */
export async function getPreferences(userId: UUID): Promise<NotificationPreferences | null> {
  logger.debug('Getting preferences for user', { userId });

  const preferences = preferencesStore.get(userId);
  return preferences ?? null;
}

/**
 * Create default preferences for a user
 */
export async function createDefaultPreferences(userId: UUID): Promise<NotificationPreferences> {
  const now = new Date().toISOString();
  const preferencesId = generateUUID();

  logger.debug('Creating default preferences for user', { userId, preferencesId });

  const preferences: NotificationPreferences = {
    preferencesId,
    userId,
    globalEnabled: true,
    defaultFrequency: 'IMMEDIATE',
    defaultChannels: ['EMAIL', 'IN_APP'],
    eventPreferences: createDefaultEventPreferences(),
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'UTC',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    },
    batchingConfig: {
      enabled: true,
      maxBatchSize: 50,
      maxBatchWaitMinutes: 60,
      groupByEventType: true,
      digestFormat: 'SUMMARY',
    },
    createdAt: now,
    updatedAt: now,
  };

  preferencesStore.set(userId, preferences);
  return preferences;
}

/**
 * Update user notification preferences
 */
export async function updatePreferences(
  userId: UUID,
  updates: {
    globalEnabled?: boolean;
    defaultFrequency?: NotificationFrequency;
    defaultChannels?: readonly NotificationChannel[];
    eventPreferences?: readonly EventTypePreference[];
    quietHours?: QuietHours;
    batchingConfig?: BatchingConfig;
  }
): Promise<NotificationPreferences | null> {
  logger.debug('Updating preferences for user', { userId, updates });

  let preferences = preferencesStore.get(userId);

  if (!preferences) {
    // Create default preferences if none exist
    preferences = await createDefaultPreferences(userId);
  }

  const now = new Date().toISOString();

  const updated: NotificationPreferences = {
    ...preferences,
    globalEnabled: updates.globalEnabled ?? preferences.globalEnabled,
    defaultFrequency: updates.defaultFrequency ?? preferences.defaultFrequency,
    defaultChannels: updates.defaultChannels ?? preferences.defaultChannels,
    eventPreferences: updates.eventPreferences ?? preferences.eventPreferences,
    quietHours: updates.quietHours ?? preferences.quietHours,
    batchingConfig: updates.batchingConfig ?? preferences.batchingConfig,
    updatedAt: now,
  };

  preferencesStore.set(userId, updated);
  return updated;
}

/**
 * Delete user preferences
 */
export async function deletePreferences(userId: UUID): Promise<boolean> {
  logger.debug('Deleting preferences for user', { userId });
  return preferencesStore.delete(userId);
}

/**
 * Get preferences for multiple users
 */
export async function getPreferencesForUsers(
  userIds: readonly UUID[]
): Promise<Map<UUID, NotificationPreferences>> {
  logger.debug('Getting preferences for multiple users', { count: userIds.length });

  const result = new Map<UUID, NotificationPreferences>();

  for (const userId of userIds) {
    const preferences = preferencesStore.get(userId);
    if (preferences) {
      result.set(userId, preferences);
    }
  }

  return result;
}

// ============================================================================
// Batching Operations
// ============================================================================

/**
 * Queue a notification for batching
 */
export async function queueNotificationForBatch(
  notification: Omit<BatchedNotification, 'batchId' | 'queuedAt'>
): Promise<BatchedNotification> {
  const batchId = generateUUID();
  const now = new Date().toISOString();

  logger.debug('Queueing notification for batch', {
    userId: notification.userId,
    eventType: notification.eventType,
    channel: notification.channel,
  });

  const batched: BatchedNotification = {
    ...notification,
    batchId,
    queuedAt: now,
  };

  // Add to user's batched notifications
  const userBatched = batchedNotificationsStore.get(notification.userId) ?? [];
  userBatched.push(batched);
  batchedNotificationsStore.set(notification.userId, userBatched);

  return batched;
}

/**
 * Get pending batched notifications for a user
 */
export async function getPendingBatchedNotifications(
  userId: UUID,
  channel?: NotificationChannel
): Promise<BatchedNotification[]> {
  logger.debug('Getting pending batched notifications', { userId, channel });

  const userBatched = batchedNotificationsStore.get(userId) ?? [];

  if (channel) {
    return userBatched.filter((n) => n.channel === channel);
  }

  return userBatched;
}

/**
 * Get batched notifications ready for delivery
 */
export async function getBatchedNotificationsReadyForDelivery(
  beforeTime: string
): Promise<BatchedNotification[]> {
  logger.debug('Getting batched notifications ready for delivery', { beforeTime });

  const ready: BatchedNotification[] = [];

  for (const [, notifications] of batchedNotificationsStore) {
    for (const notification of notifications) {
      if (notification.scheduledFor <= beforeTime) {
        ready.push(notification);
      }
    }
  }

  return ready;
}

/**
 * Create a notification batch
 */
export async function createBatch(
  batch: Omit<NotificationBatch, 'batchId' | 'createdAt' | 'status'>
): Promise<NotificationBatch> {
  const batchId = generateUUID();
  const now = new Date().toISOString();

  logger.debug('Creating notification batch', {
    userId: batch.userId,
    channel: batch.channel,
    notificationCount: batch.notifications.length,
  });

  const created: NotificationBatch = {
    ...batch,
    batchId,
    createdAt: now,
    status: 'PENDING',
  };

  batchesStore.set(batchId, created);
  return created;
}

/**
 * Update batch status
 */
export async function updateBatchStatus(
  batchId: UUID,
  status: BatchStatus
): Promise<void> {
  logger.debug('Updating batch status', { batchId, status });

  const batch = batchesStore.get(batchId);
  if (batch) {
    batchesStore.set(batchId, { ...batch, status });
  }
}

/**
 * Get pending batches for a user
 */
export async function getPendingBatches(userId: UUID): Promise<NotificationBatch[]> {
  logger.debug('Getting pending batches for user', { userId });

  const batches: NotificationBatch[] = [];

  for (const [, batch] of batchesStore) {
    if (batch.userId === userId && batch.status === 'PENDING') {
      batches.push(batch);
    }
  }

  return batches;
}

/**
 * Clear batched notifications for a user after sending
 */
export async function clearBatchedNotifications(
  userId: UUID,
  batchIds: readonly UUID[]
): Promise<number> {
  logger.debug('Clearing batched notifications', { userId, batchIds });

  const userBatched = batchedNotificationsStore.get(userId) ?? [];
  const batchIdSet = new Set(batchIds);

  const remaining = userBatched.filter((n) => !batchIdSet.has(n.batchId));
  const cleared = userBatched.length - remaining.length;

  batchedNotificationsStore.set(userId, remaining);

  return cleared;
}

/**
 * Get batches ready for processing
 */
export async function getBatchesReadyForProcessing(
  beforeTime: string,
  limit: number = 100
): Promise<NotificationBatch[]> {
  logger.debug('Getting batches ready for processing', { beforeTime, limit });

  const ready: NotificationBatch[] = [];

  for (const [, batch] of batchesStore) {
    if (batch.status === 'PENDING' && batch.scheduledFor <= beforeTime) {
      ready.push(batch);
      if (ready.length >= limit) {
        break;
      }
    }
  }

  return ready;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create default event preferences for all event types
 */
function createDefaultEventPreferences(): EventTypePreference[] {
  const eventTypes: NotificationEventType[] = [
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

  return eventTypes.map((eventType) => ({
    eventType,
    enabled: true,
    channels: createDefaultChannelPreferences(eventType),
  }));
}

/**
 * Create default channel preferences for an event type
 */
function createDefaultChannelPreferences(eventType: NotificationEventType): ChannelPreference[] {
  const channels: NotificationChannel[] = ['EMAIL', 'IN_APP', 'SMS', 'PUSH'];

  // Determine default frequency based on event type urgency
  const getDefaultFrequency = (et: NotificationEventType): NotificationFrequency => {
    switch (et) {
      case 'LOANER_OVERDUE':
      case 'COMPLIANCE_ALERT':
      case 'APPROVAL_REQUIRED':
      case 'SYSTEM_ALERT':
        return 'IMMEDIATE';
      case 'CONTRACT_EXPIRING':
      case 'STOCK_LOW':
      case 'MAINTENANCE_DUE':
        return 'DAILY';
      case 'ASSET_STATE_CHANGED':
      case 'REQUEST_APPROVED':
      case 'REQUEST_REJECTED':
      case 'WORK_ORDER_ASSIGNED':
        return 'IMMEDIATE';
      default:
        return 'IMMEDIATE';
    }
  };

  const frequency = getDefaultFrequency(eventType);

  return channels.map((channel) => ({
    channel,
    enabled: channel === 'EMAIL' || channel === 'IN_APP',
    frequency,
  }));
}

/**
 * Generate a UUID
 */
function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Reset function for testing
// ============================================================================

/**
 * Reset all stores (for testing purposes)
 */
export function resetStores(): void {
  preferencesStore.clear();
  batchedNotificationsStore.clear();
  batchesStore.clear();
}
