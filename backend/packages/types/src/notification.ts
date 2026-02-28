/**
 * Notification Types
 *
 * Shared type definitions for notification service.
 * Consolidates types from notification-service local definitions.
 */

import type { ISODateString, UUID } from './common';

export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'PUSH';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type NotificationStatus = 'PENDING' | 'SENDING' | 'DELIVERED' | 'FAILED' | 'READ' | 'BOUNCED';
export type NotificationEventType =
  | 'CONTRACT_EXPIRING' | 'LOANER_OVERDUE' | 'STOCK_LOW' | 'COMPLIANCE_ALERT'
  | 'ASSET_STATE_CHANGED' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED'
  | 'WORK_ORDER_ASSIGNED' | 'MAINTENANCE_DUE' | 'APPROVAL_REQUIRED'
  | 'SYSTEM_ALERT' | 'CUSTOM';
export type NotificationFrequency = 'IMMEDIATE' | 'HOURLY' | 'DAILY' | 'WEEKLY';

export interface NotificationPreferences {
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

export interface EventTypePreference {
  readonly eventType: NotificationEventType;
  readonly enabled: boolean;
  readonly channels: readonly ChannelPreference[];
  readonly frequency: NotificationFrequency;
}

export interface ChannelPreference {
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
}

export interface QuietHours {
  readonly enabled: boolean;
  readonly startTime: string;
  readonly endTime: string;
  readonly timezone: string;
}

export interface BatchingConfig {
  readonly enabled: boolean;
  readonly maxBatchSize: number;
  readonly batchWindowMinutes: number;
}

export interface NotificationHistoryItem {
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly subject: string;
  readonly status: NotificationStatus;
  readonly priority: NotificationPriority;
  readonly sentAt?: ISODateString;
  readonly readAt?: ISODateString;
  readonly createdAt: ISODateString;
}
