/**
 * Notification Tracking Types
 *
 * Type definitions for delivery status tracking, read receipts, and notification history.
 *
 * Requirements:
 * - 17.8: Track notification delivery status and read receipts
 */

import type { ISODateString, UUID } from '@ams/types';

import type { NotificationChannel, NotificationEventType, NotificationPriority, NotificationStatus } from '../notification/notification-types';

// ============================================================================
// Delivery Status Types
// ============================================================================

/**
 * Detailed delivery status for tracking
 */
export type DeliveryStatus =
  | 'QUEUED'           // Notification is queued for delivery
  | 'SENDING'          // Currently being sent
  | 'SENT'             // Sent to provider (awaiting confirmation)
  | 'DELIVERED'        // Confirmed delivered to recipient
  | 'FAILED'           // Delivery failed
  | 'BOUNCED'          // Email bounced
  | 'REJECTED'         // Rejected by provider
  | 'EXPIRED';         // Delivery window expired

/**
 * Delivery tracking record
 */
export interface DeliveryTrackingRecord {
  readonly trackingId: UUID;
  readonly notificationId: UUID;
  readonly channel: NotificationChannel;
  readonly recipientId: UUID;
  readonly recipientAddress: string; // Email, phone, or device token
  readonly status: DeliveryStatus;
  readonly providerMessageId?: string;
  readonly providerResponse?: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly lastAttemptAt?: ISODateString;
  readonly nextRetryAt?: ISODateString;
  readonly deliveredAt?: ISODateString;
  readonly failureReason?: string;
  readonly failureCode?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request to create a delivery tracking record
 */
export interface CreateDeliveryTrackingRequest {
  readonly notificationId: UUID;
  readonly channel: NotificationChannel;
  readonly recipientId: UUID;
  readonly recipientAddress: string;
  readonly maxAttempts?: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Request to update delivery status
 */
export interface UpdateDeliveryStatusRequest {
  readonly trackingId: UUID;
  readonly status: DeliveryStatus;
  readonly providerMessageId?: string;
  readonly providerResponse?: string;
  readonly deliveredAt?: ISODateString;
  readonly failureReason?: string;
  readonly failureCode?: string;
  readonly nextRetryAt?: ISODateString;
}

// ============================================================================
// Read Receipt Types
// ============================================================================

/**
 * Read receipt record
 */
export interface ReadReceipt {
  readonly receiptId: UUID;
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly channel: NotificationChannel;
  readonly readAt: ISODateString;
  readonly readSource: ReadSource;
  readonly deviceInfo?: DeviceInfo;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Source of the read action
 */
export type ReadSource =
  | 'WEB_APP'          // Read in web application
  | 'MOBILE_APP'       // Read in mobile application
  | 'EMAIL_PIXEL'      // Email tracking pixel loaded
  | 'EMAIL_LINK'       // Link in email clicked
  | 'PUSH_OPEN'        // Push notification opened
  | 'API'              // Marked read via API
  | 'SYSTEM';          // System-marked as read

/**
 * Device information for read tracking
 */
export interface DeviceInfo {
  readonly deviceType?: string;
  readonly deviceId?: string;
  readonly platform?: string;
  readonly browser?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

/**
 * Request to record a read receipt
 */
export interface RecordReadReceiptRequest {
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly channel: NotificationChannel;
  readonly readSource: ReadSource;
  readonly deviceInfo?: DeviceInfo;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Notification History Types
// ============================================================================

/**
 * Notification history entry for audit logging
 */
export interface NotificationHistoryEntry {
  readonly historyId: UUID;
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly subject: string;
  readonly priority: NotificationPriority;
  readonly status: NotificationStatus;
  readonly deliveryStatus: DeliveryStatus;
  readonly sentAt?: ISODateString;
  readonly deliveredAt?: ISODateString;
  readonly readAt?: ISODateString;
  readonly failureReason?: string;
  readonly attemptCount: number;
  readonly templateId?: UUID;
  readonly templateName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: ISODateString;
}

/**
 * Query parameters for notification history
 */
export interface NotificationHistoryQuery {
  readonly recipientId?: UUID;
  readonly channel?: NotificationChannel;
  readonly eventType?: NotificationEventType;
  readonly status?: NotificationStatus;
  readonly deliveryStatus?: DeliveryStatus;
  readonly fromDate?: ISODateString;
  readonly toDate?: ISODateString;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: 'createdAt' | 'sentAt' | 'deliveredAt' | 'readAt';
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated notification history result
 */
export interface NotificationHistoryResult {
  readonly entries: readonly NotificationHistoryEntry[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

// ============================================================================
// Retry Types
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly retryableStatuses: readonly DeliveryStatus[];
}

/**
 * Default retry configuration by channel
 */
export const DEFAULT_RETRY_CONFIGS: Record<NotificationChannel, RetryConfig> = {
  EMAIL: {
    maxAttempts: 3,
    initialDelayMs: 60000,      // 1 minute
    maxDelayMs: 3600000,        // 1 hour
    backoffMultiplier: 2,
    retryableStatuses: ['FAILED', 'REJECTED'],
  },
  SMS: {
    maxAttempts: 2,
    initialDelayMs: 30000,      // 30 seconds
    maxDelayMs: 300000,         // 5 minutes
    backoffMultiplier: 2,
    retryableStatuses: ['FAILED'],
  },
  PUSH: {
    maxAttempts: 2,
    initialDelayMs: 10000,      // 10 seconds
    maxDelayMs: 60000,          // 1 minute
    backoffMultiplier: 2,
    retryableStatuses: ['FAILED'],
  },
  IN_APP: {
    maxAttempts: 1,
    initialDelayMs: 1000,
    maxDelayMs: 5000,
    backoffMultiplier: 1,
    retryableStatuses: ['FAILED'],
  },
};

/**
 * Retry attempt record
 */
export interface RetryAttempt {
  readonly attemptId: UUID;
  readonly trackingId: UUID;
  readonly notificationId: UUID;
  readonly attemptNumber: number;
  readonly status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly responseTime?: number;
  readonly attemptedAt: ISODateString;
  readonly scheduledAt?: ISODateString;
}

/**
 * Pending retry record
 */
export interface PendingRetry {
  readonly trackingId: UUID;
  readonly notificationId: UUID;
  readonly channel: NotificationChannel;
  readonly recipientId: UUID;
  readonly recipientAddress: string;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly nextRetryAt: ISODateString;
  readonly lastFailureReason?: string;
}

// ============================================================================
// Tracking Statistics Types
// ============================================================================

/**
 * Delivery statistics
 */
export interface DeliveryStatistics {
  readonly totalSent: number;
  readonly totalDelivered: number;
  readonly totalFailed: number;
  readonly totalBounced: number;
  readonly totalPending: number;
  readonly deliveryRate: number;
  readonly averageDeliveryTimeMs: number;
  readonly byChannel: Record<NotificationChannel, ChannelDeliveryStats>;
}

/**
 * Channel-specific delivery statistics
 */
export interface ChannelDeliveryStats {
  readonly sent: number;
  readonly delivered: number;
  readonly failed: number;
  readonly bounced: number;
  readonly deliveryRate: number;
  readonly averageDeliveryTimeMs: number;
}

/**
 * Read statistics
 */
export interface ReadStatistics {
  readonly totalDelivered: number;
  readonly totalRead: number;
  readonly readRate: number;
  readonly averageTimeToReadMs: number;
  readonly byChannel: Record<NotificationChannel, ChannelReadStats>;
  readonly bySource: Record<ReadSource, number>;
}

/**
 * Channel-specific read statistics
 */
export interface ChannelReadStats {
  readonly delivered: number;
  readonly read: number;
  readonly readRate: number;
  readonly averageTimeToReadMs: number;
}

/**
 * Combined tracking statistics
 */
export interface TrackingStatistics {
  readonly delivery: DeliveryStatistics;
  readonly read: ReadStatistics;
  readonly period: {
    readonly from: ISODateString;
    readonly to: ISODateString;
  };
}

// ============================================================================
// Webhook Types for External Tracking
// ============================================================================

/**
 * Webhook event for delivery status updates
 */
export interface DeliveryWebhookEvent {
  readonly eventType: 'DELIVERY_STATUS_UPDATE';
  readonly timestamp: ISODateString;
  readonly provider: string;
  readonly providerMessageId: string;
  readonly status: DeliveryStatus;
  readonly recipientAddress: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Webhook event for read receipts
 */
export interface ReadWebhookEvent {
  readonly eventType: 'READ_RECEIPT';
  readonly timestamp: ISODateString;
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly source: ReadSource;
  readonly deviceInfo?: DeviceInfo;
}
