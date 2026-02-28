/**
 * Notification Preferences Service
 *
 * Business logic for managing user notification preferences and batching.
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.9: Implement notification batching to prevent alert fatigue
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type { NotificationChannel, NotificationEventType } from '../notification/notification-types';
import * as preferencesRepository from './preferences-repository';
import type {
  BatchedNotification,
  BatchingConfig,
  BatchingConfigUpdate,
  ChannelPreference,
  ChannelPreferenceUpdate,
  EventTypePreference,
  EventTypePreferenceUpdate,
  NotificationBatch,
  NotificationDecision,
  NotificationFrequency,
  NotificationPreferences,
  QuietHours,
  QuietHoursUpdate,
  UpdatePreferencesRequest,
} from './preferences-types';

const logger = createLogger({ service: 'preferences-service' });

// ============================================================================
// Preferences CRUD Operations
// ============================================================================

/**
 * Get user notification preferences
 * Creates default preferences if none exist
 *
 * Requirement 17.2: Allow users to configure notification preferences per event type
 *
 * @param userId - The user ID
 * @returns User notification preferences
 */
export async function getUserPreferences(userId: UUID): Promise<NotificationPreferences> {
  logger.info('Getting user preferences', { userId });

  const cacheKey = entityKey(CACHE_ENTITY_TYPES.NOTIFICATION_PREFERENCES, userId);
  const cached = await cache.get<NotificationPreferences>(cacheKey);
  if (cached) {
    return cached;
  }

  let preferences = await preferencesRepository.getPreferences(userId);

  if (!preferences) {
    logger.info('Creating default preferences for user', { userId });
    preferences = await preferencesRepository.createDefaultPreferences(userId);
  }

  await cache.set(cacheKey, preferences, { ttl: cache.DEFAULT_TTL.MEDIUM });
  return preferences;
}

/**
 * Update user notification preferences
 *
 * Requirement 17.2: Allow users to configure notification preferences per event type
 *
 * @param request - The update request
 * @returns Updated preferences
 */
export async function updatePreferences(
  request: UpdatePreferencesRequest
): Promise<NotificationPreferences> {
  logger.info('Updating user preferences', { userId: request.userId });

  // Validate the request
  validateUpdateRequest(request);

  // Get existing preferences or create defaults
  const existing = await getUserPreferences(request.userId);

  // Merge event preferences if provided
  let eventPreferences = existing.eventPreferences;
  if (request.eventPreferences && request.eventPreferences.length > 0) {
    eventPreferences = mergeEventPreferences(
      existing.eventPreferences,
      request.eventPreferences
    );
  }

  // Merge quiet hours if provided
  let quietHours = existing.quietHours;
  if (request.quietHours) {
    quietHours = mergeQuietHours(existing.quietHours, request.quietHours);
  }

  // Merge batching config if provided
  let batchingConfig = existing.batchingConfig;
  if (request.batchingConfig) {
    batchingConfig = mergeBatchingConfig(existing.batchingConfig, request.batchingConfig);
  }

  // Update preferences
  const updated = await preferencesRepository.updatePreferences(request.userId, {
    globalEnabled: request.globalEnabled,
    defaultFrequency: request.defaultFrequency,
    defaultChannels: request.defaultChannels,
    eventPreferences,
    quietHours,
    batchingConfig,
  });

  if (!updated) {
    throw new Error('Failed to update preferences');
  }

  // Invalidate cache
  const cacheKey = entityKey(CACHE_ENTITY_TYPES.NOTIFICATION_PREFERENCES, request.userId);
  await cache.del(cacheKey);

  // Publish event
  await publishEvent('NOTIFICATION_PREFERENCES_UPDATED', {
    userId: request.userId,
  });

  logger.info('User preferences updated', { userId: request.userId });
  return updated;
}

/**
 * Reset user preferences to defaults
 *
 * @param userId - The user ID
 * @returns Default preferences
 */
export async function resetPreferences(userId: UUID): Promise<NotificationPreferences> {
  logger.info('Resetting user preferences to defaults', { userId });

  await preferencesRepository.deletePreferences(userId);
  return preferencesRepository.createDefaultPreferences(userId);
}

// ============================================================================
// Notification Decision Logic
// ============================================================================

/**
 * Determine if a notification should be sent based on user preferences
 *
 * Requirement 17.2: Allow users to configure notification preferences per event type
 * Requirement 17.9: Implement notification batching to prevent alert fatigue
 *
 * @param userId - The user ID
 * @param eventType - The notification event type
 * @param requestedChannels - The channels requested for notification
 * @returns Decision on whether to send, batch, and which channels to use
 */
export async function shouldSendNotification(
  userId: UUID,
  eventType: NotificationEventType,
  requestedChannels: readonly NotificationChannel[]
): Promise<NotificationDecision> {
  logger.debug('Checking notification decision', { userId, eventType, requestedChannels });

  const preferences = await getUserPreferences(userId);

  // Check if notifications are globally disabled
  if (!preferences.globalEnabled) {
    return {
      shouldSend: false,
      shouldBatch: false,
      reason: 'Notifications globally disabled',
      enabledChannels: [],
    };
  }

  // Check quiet hours
  if (isInQuietHours(preferences.quietHours)) {
    // During quiet hours, batch all notifications
    return {
      shouldSend: false,
      shouldBatch: true,
      batchFrequency: 'DAILY',
      reason: 'Currently in quiet hours - notification will be batched',
      enabledChannels: getEnabledChannels(preferences, eventType, requestedChannels),
    };
  }

  // Get event-specific preferences
  const eventPref = preferences.eventPreferences.find((ep) => ep.eventType === eventType);

  if (!eventPref || !eventPref.enabled) {
    return {
      shouldSend: false,
      shouldBatch: false,
      reason: `Notifications disabled for event type: ${eventType}`,
      enabledChannels: [],
    };
  }

  // Determine enabled channels and their frequencies
  const enabledChannels = getEnabledChannels(preferences, eventType, requestedChannels);

  if (enabledChannels.length === 0) {
    return {
      shouldSend: false,
      shouldBatch: false,
      reason: 'No enabled channels for this notification',
      enabledChannels: [],
    };
  }

  // Check if batching is needed based on frequency settings
  const batchingDecision = determineBatchingDecision(eventPref, enabledChannels, preferences.batchingConfig);

  return {
    shouldSend: !batchingDecision.shouldBatch,
    shouldBatch: batchingDecision.shouldBatch,
    batchFrequency: batchingDecision.frequency,
    reason: batchingDecision.reason,
    enabledChannels,
  };
}

/**
 * Get enabled channels for an event type
 */
function getEnabledChannels(
  preferences: NotificationPreferences,
  eventType: NotificationEventType,
  requestedChannels: readonly NotificationChannel[]
): NotificationChannel[] {
  const eventPref = preferences.eventPreferences.find((ep) => ep.eventType === eventType);

  if (!eventPref) {
    // Use default channels if no event-specific preferences
    return requestedChannels.filter((ch) => preferences.defaultChannels.includes(ch));
  }

  return requestedChannels.filter((requestedChannel) => {
    const channelPref = eventPref.channels.find((cp) => cp.channel === requestedChannel);
    return channelPref?.enabled ?? false;
  });
}

/**
 * Determine if batching is needed based on preferences
 */
function determineBatchingDecision(
  eventPref: EventTypePreference,
  enabledChannels: readonly NotificationChannel[],
  batchingConfig: BatchingConfig
): { shouldBatch: boolean; frequency?: NotificationFrequency; reason: string } {
  if (!batchingConfig.enabled) {
    return { shouldBatch: false, reason: 'Batching disabled' };
  }

  // Check if any channel requires batching
  for (const channel of enabledChannels) {
    const channelPref = eventPref.channels.find((cp) => cp.channel === channel);

    if (channelPref && channelPref.frequency !== 'IMMEDIATE' && channelPref.frequency !== 'DISABLED') {
      return {
        shouldBatch: true,
        frequency: channelPref.frequency,
        reason: `Channel ${channel} configured for ${channelPref.frequency} delivery`,
      };
    }
  }

  return { shouldBatch: false, reason: 'All channels configured for immediate delivery' };
}

// ============================================================================
// Batching Operations
// ============================================================================

/**
 * Queue a notification for batched delivery
 *
 * Requirement 17.9: Implement notification batching to prevent alert fatigue
 *
 * @param notification - The notification to queue
 * @returns The batched notification entry
 */
export async function queueForBatch(
  notification: {
    userId: UUID;
    eventType: NotificationEventType;
    channel: NotificationChannel;
    subject: string;
    body: string;
    metadata?: Record<string, unknown>;
  },
  frequency: NotificationFrequency
): Promise<BatchedNotification> {
  logger.info('Queueing notification for batch', {
    userId: notification.userId,
    eventType: notification.eventType,
    channel: notification.channel,
    frequency,
  });

  const scheduledFor = calculateScheduledTime(frequency);

  return preferencesRepository.queueNotificationForBatch({
    ...notification,
    scheduledFor,
  });
}

/**
 * Process pending batches and send digest notifications
 *
 * Requirement 17.9: Implement notification batching to prevent alert fatigue
 *
 * @param limit - Maximum number of batches to process
 * @returns Processing result
 */
export async function processPendingBatches(limit: number = 100): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  logger.info('Processing pending batches', { limit });

  const now = new Date().toISOString();
  const readyBatches = await preferencesRepository.getBatchesReadyForProcessing(now, limit);

  let sent = 0;
  let failed = 0;

  for (const batch of readyBatches) {
    try {
      await preferencesRepository.updateBatchStatus(batch.batchId, 'PROCESSING');

      // Generate digest content (will be used when sending the actual notification)
      // In production, this would be passed to the notification service
      generateDigestContent(batch);

      // Here we would call the notification service to send the digest
      // For now, we just mark it as sent
      logger.info('Sending batch digest', {
        batchId: batch.batchId,
        userId: batch.userId,
        channel: batch.channel,
        notificationCount: batch.notifications.length,
      });

      await preferencesRepository.updateBatchStatus(batch.batchId, 'SENT');

      // Clear the batched notifications
      const batchIds = batch.notifications.map((n) => n.batchId);
      await preferencesRepository.clearBatchedNotifications(batch.userId, batchIds);

      sent++;
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to process batch', err, { batchId: batch.batchId });
      await preferencesRepository.updateBatchStatus(batch.batchId, 'FAILED');
      failed++;
    }
  }

  logger.info('Batch processing completed', {
    processed: readyBatches.length,
    sent,
    failed,
  });

  return {
    processed: readyBatches.length,
    sent,
    failed,
  };
}

/**
 * Get pending batched notifications for a user
 *
 * @param userId - The user ID
 * @param channel - Optional channel filter
 * @returns Pending batched notifications
 */
export async function getPendingBatchedNotifications(
  userId: UUID,
  channel?: NotificationChannel
): Promise<BatchedNotification[]> {
  return preferencesRepository.getPendingBatchedNotifications(userId, channel);
}

/**
 * Create a batch from pending notifications
 *
 * @param userId - The user ID
 * @param channel - The notification channel
 * @param frequency - The batch frequency
 * @returns The created batch
 */
export async function createBatchFromPending(
  userId: UUID,
  channel: NotificationChannel,
  frequency: NotificationFrequency
): Promise<NotificationBatch | null> {
  const pending = await preferencesRepository.getPendingBatchedNotifications(userId, channel);

  if (pending.length === 0) {
    return null;
  }

  const scheduledFor = calculateScheduledTime(frequency);

  return preferencesRepository.createBatch({
    userId,
    channel,
    frequency,
    notifications: pending,
    scheduledFor,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate update preferences request
 */
function validateUpdateRequest(request: UpdatePreferencesRequest): void {
  if (!request.userId) {
    throw new Error('User ID is required');
  }

  // Validate quiet hours if provided
  if (request.quietHours) {
    if (request.quietHours.startTime && !isValidTimeFormat(request.quietHours.startTime)) {
      throw new Error('Invalid startTime format. Use HH:MM (24-hour)');
    }
    if (request.quietHours.endTime && !isValidTimeFormat(request.quietHours.endTime)) {
      throw new Error('Invalid endTime format. Use HH:MM (24-hour)');
    }
    if (request.quietHours.daysOfWeek) {
      for (const day of request.quietHours.daysOfWeek) {
        if (day < 0 || day > 6) {
          throw new Error('Invalid day of week. Must be 0-6 (Sunday-Saturday)');
        }
      }
    }
  }

  // Validate batching config if provided
  if (request.batchingConfig) {
    if (request.batchingConfig.maxBatchSize !== undefined && request.batchingConfig.maxBatchSize < 1) {
      throw new Error('maxBatchSize must be at least 1');
    }
    if (request.batchingConfig.maxBatchWaitMinutes !== undefined && request.batchingConfig.maxBatchWaitMinutes < 1) {
      throw new Error('maxBatchWaitMinutes must be at least 1');
    }
  }
}

/**
 * Merge event preferences with updates
 */
function mergeEventPreferences(
  existing: readonly EventTypePreference[],
  updates: readonly EventTypePreferenceUpdate[]
): EventTypePreference[] {
  const result = [...existing];

  for (const update of updates) {
    const index = result.findIndex((ep) => ep.eventType === update.eventType);

    if (index >= 0) {
      const existingPref = result[index];
      if (!existingPref) continue;
      
      let channels = existingPref.channels;

      if (update.channels) {
        channels = mergeChannelPreferences(existingPref.channels, update.channels);
      }

      result[index] = {
        eventType: existingPref.eventType,
        enabled: update.enabled ?? existingPref.enabled,
        channels,
      };
    }
  }

  return result;
}

/**
 * Merge channel preferences with updates
 */
function mergeChannelPreferences(
  existing: readonly ChannelPreference[],
  updates: readonly ChannelPreferenceUpdate[]
): ChannelPreference[] {
  const result = [...existing];

  for (const update of updates) {
    const index = result.findIndex((cp) => cp.channel === update.channel);

    if (index >= 0) {
      const existingPref = result[index];
      if (!existingPref) continue;
      
      result[index] = {
        channel: existingPref.channel,
        enabled: update.enabled ?? existingPref.enabled,
        frequency: update.frequency ?? existingPref.frequency,
      };
    }
  }

  return result;
}

/**
 * Merge quiet hours with updates
 */
function mergeQuietHours(existing: QuietHours, update: QuietHoursUpdate): QuietHours {
  return {
    enabled: update.enabled ?? existing.enabled,
    startTime: update.startTime ?? existing.startTime,
    endTime: update.endTime ?? existing.endTime,
    timezone: update.timezone ?? existing.timezone,
    daysOfWeek: update.daysOfWeek ?? existing.daysOfWeek,
  };
}

/**
 * Merge batching config with updates
 */
function mergeBatchingConfig(existing: BatchingConfig, update: BatchingConfigUpdate): BatchingConfig {
  return {
    enabled: update.enabled ?? existing.enabled,
    maxBatchSize: update.maxBatchSize ?? existing.maxBatchSize,
    maxBatchWaitMinutes: update.maxBatchWaitMinutes ?? existing.maxBatchWaitMinutes,
    groupByEventType: update.groupByEventType ?? existing.groupByEventType,
    digestFormat: update.digestFormat ?? existing.digestFormat,
  };
}

/**
 * Check if current time is within quiet hours
 */
function isInQuietHours(quietHours: QuietHours): boolean {
  if (!quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentDay = now.getDay();

  // Check if today is a quiet day
  if (!quietHours.daysOfWeek.includes(currentDay)) {
    return false;
  }

  // Get current time in HH:MM format
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (quietHours.startTime > quietHours.endTime) {
    return currentTime >= quietHours.startTime || currentTime < quietHours.endTime;
  }

  // Normal quiet hours (e.g., 12:00 to 13:00)
  return currentTime >= quietHours.startTime && currentTime < quietHours.endTime;
}

/**
 * Validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time);
}

/**
 * Calculate scheduled time based on frequency
 */
function calculateScheduledTime(frequency: NotificationFrequency): string {
  const now = new Date();

  switch (frequency) {
    case 'HOURLY':
      now.setHours(now.getHours() + 1, 0, 0, 0);
      break;
    case 'DAILY':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0); // 9 AM next day
      break;
    case 'WEEKLY':
      now.setDate(now.getDate() + 7);
      now.setHours(9, 0, 0, 0); // 9 AM next week
      break;
    case 'IMMEDIATE':
    default:
      // No delay for immediate
      break;
  }

  return now.toISOString();
}

/**
 * Generate digest content from a batch
 */
function generateDigestContent(batch: NotificationBatch): {
  subject: string;
  body: string;
  htmlBody?: string;
} {
  const count = batch.notifications.length;
  const frequencyLabel = batch.frequency.toLowerCase();

  const subject = `Your ${frequencyLabel} notification digest (${count} notification${count !== 1 ? 's' : ''})`;

  // Group notifications by event type
  const byEventType = new Map<NotificationEventType, BatchedNotification[]>();
  for (const notification of batch.notifications) {
    const existing = byEventType.get(notification.eventType) ?? [];
    existing.push(notification);
    byEventType.set(notification.eventType, existing);
  }

  // Build body
  const bodyParts: string[] = [
    `You have ${count} notification${count !== 1 ? 's' : ''} from the past ${frequencyLabel} period:`,
    '',
  ];

  for (const [eventType, notifications] of byEventType) {
    bodyParts.push(`## ${formatEventType(eventType)} (${notifications.length})`);
    for (const notification of notifications) {
      bodyParts.push(`- ${notification.subject}`);
    }
    bodyParts.push('');
  }

  return {
    subject,
    body: bodyParts.join('\n'),
  };
}

/**
 * Format event type for display
 */
function formatEventType(eventType: NotificationEventType): string {
  return eventType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}
