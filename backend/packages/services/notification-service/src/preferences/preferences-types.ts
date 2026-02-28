/**
 * Notification Preferences Types
 *
 * Type definitions for user notification preferences and batching configuration.
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.9: Implement notification batching to prevent alert fatigue
 */

import type { ISODateString, UUID } from '@ams/types';

import type { NotificationChannel, NotificationEventType } from '../notification/notification-types';

// ============================================================================
// Preference Types
// ============================================================================

/**
 * Notification frequency options for batching
 * Requirement 17.9: Implement notification batching to prevent alert fatigue
 */
export type NotificationFrequency =
  | 'IMMEDIATE'     // Send immediately (no batching)
  | 'HOURLY'        // Batch and send hourly digest
  | 'DAILY'         // Batch and send daily digest
  | 'WEEKLY'        // Batch and send weekly digest
  | 'DISABLED';     // Do not send notifications

/**
 * Quiet hours configuration for preventing notifications during specific times
 */
export interface QuietHours {
  readonly enabled: boolean;
  readonly startTime: string;  // HH:MM format (24-hour)
  readonly endTime: string;    // HH:MM format (24-hour)
  readonly timezone: string;   // IANA timezone (e.g., 'America/New_York')
  readonly daysOfWeek: readonly number[];  // 0 = Sunday, 6 = Saturday
}

/**
 * Channel-specific preference for an event type
 * Requirement 17.2: Allow users to configure notification preferences per event type
 */
export interface ChannelPreference {
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly frequency: NotificationFrequency;
}

/**
 * Event type preference configuration
 * Requirement 17.2: Allow users to configure notification preferences per event type
 */
export interface EventTypePreference {
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly channels: readonly ChannelPreference[];
}

/**
 * User notification preferences
 * Requirement 17.2: Allow users to configure notification preferences per event type
 */
export interface NotificationPreferences {
  readonly preferencesId: UUID;
  readonly userId: UUID;
  readonly globalEnabled: boolean;
  readonly defaultFrequency: NotificationFrequency;
  readonly defaultChannels: readonly NotificationChannel[];
  readonly eventPreferences: readonly EventTypePreference[];
  readonly quietHours: QuietHours;
  readonly batchingConfig: BatchingConfig;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

// ============================================================================
// Batching Types
// ============================================================================

/**
 * Batching configuration
 * Requirement 17.9: Implement notification batching to prevent alert fatigue
 */
export interface BatchingConfig {
  readonly enabled: boolean;
  readonly maxBatchSize: number;           // Maximum notifications per batch
  readonly maxBatchWaitMinutes: number;    // Maximum time to wait before sending batch
  readonly groupByEventType: boolean;      // Group notifications by event type in digest
  readonly digestFormat: DigestFormat;     // Format for digest notifications
}

/**
 * Digest format options
 */
export type DigestFormat = 'SUMMARY' | 'DETAILED' | 'COMPACT';

/**
 * Batched notification entry
 */
export interface BatchedNotification {
  readonly batchId: UUID;
  readonly userId: UUID;
  readonly eventType: NotificationEventType;
  readonly channel: NotificationChannel;
  readonly subject: string;
  readonly body: string;
  readonly metadata?: Record<string, unknown>;
  readonly queuedAt: ISODateString;
  readonly scheduledFor: ISODateString;
}

/**
 * Notification batch ready for delivery
 */
export interface NotificationBatch {
  readonly batchId: UUID;
  readonly userId: UUID;
  readonly channel: NotificationChannel;
  readonly frequency: NotificationFrequency;
  readonly notifications: readonly BatchedNotification[];
  readonly createdAt: ISODateString;
  readonly scheduledFor: ISODateString;
  readonly status: BatchStatus;
}

/**
 * Batch status
 */
export type BatchStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Request to get user preferences
 */
export interface GetPreferencesRequest {
  readonly userId: UUID;
}

/**
 * Request to update user preferences
 */
export interface UpdatePreferencesRequest {
  readonly userId: UUID;
  readonly globalEnabled?: boolean;
  readonly defaultFrequency?: NotificationFrequency;
  readonly defaultChannels?: readonly NotificationChannel[];
  readonly eventPreferences?: readonly EventTypePreferenceUpdate[];
  readonly quietHours?: QuietHoursUpdate;
  readonly batchingConfig?: BatchingConfigUpdate;
}

/**
 * Event type preference update
 */
export interface EventTypePreferenceUpdate {
  readonly eventType: NotificationEventType;
  readonly enabled?: boolean;
  readonly channels?: readonly ChannelPreferenceUpdate[];
}

/**
 * Channel preference update
 */
export interface ChannelPreferenceUpdate {
  readonly channel: NotificationChannel;
  readonly enabled?: boolean;
  readonly frequency?: NotificationFrequency;
}

/**
 * Quiet hours update
 */
export interface QuietHoursUpdate {
  readonly enabled?: boolean;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly timezone?: string;
  readonly daysOfWeek?: readonly number[];
}

/**
 * Batching config update
 */
export interface BatchingConfigUpdate {
  readonly enabled?: boolean;
  readonly maxBatchSize?: number;
  readonly maxBatchWaitMinutes?: number;
  readonly groupByEventType?: boolean;
  readonly digestFormat?: DigestFormat;
}

/**
 * Result of checking if notification should be sent
 */
export interface NotificationDecision {
  readonly shouldSend: boolean;
  readonly shouldBatch: boolean;
  readonly batchFrequency?: NotificationFrequency;
  readonly reason: string;
  readonly enabledChannels: readonly NotificationChannel[];
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default quiet hours configuration
 */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startTime: '22:00',
  endTime: '08:00',
  timezone: 'UTC',
  daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
};

/**
 * Default batching configuration
 */
export const DEFAULT_BATCHING_CONFIG: BatchingConfig = {
  enabled: true,
  maxBatchSize: 50,
  maxBatchWaitMinutes: 60,
  groupByEventType: true,
  digestFormat: 'SUMMARY',
};

/**
 * Default notification channels
 */
export const DEFAULT_CHANNELS: readonly NotificationChannel[] = ['EMAIL', 'IN_APP'];

/**
 * Default notification frequency
 */
export const DEFAULT_FREQUENCY: NotificationFrequency = 'IMMEDIATE';
