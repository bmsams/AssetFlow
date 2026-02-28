/**
 * Notification Tracking Service
 *
 * Business logic for delivery tracking, read receipts, retry logic, and notification history.
 *
 * Requirements:
 * - 17.8: Track notification delivery status and read receipts
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { NotificationChannel, NotificationEventType, NotificationPriority, NotificationStatus } from '../notification/notification-types';
import * as trackingRepository from './tracking-repository';
import {
  DEFAULT_RETRY_CONFIGS,
  type ChannelDeliveryStats,
  type ChannelReadStats,
  type CreateDeliveryTrackingRequest,
  type DeliveryStatus,
  type DeliveryTrackingRecord,
  type DeliveryWebhookEvent,
  type DeviceInfo,
  type NotificationHistoryEntry,
  type NotificationHistoryQuery,
  type NotificationHistoryResult,
  type PendingRetry,
  type ReadReceipt,
  type ReadSource,
  type ReadWebhookEvent,
  type RetryAttempt,
  type TrackingStatistics,
  type UpdateDeliveryStatusRequest,
} from './tracking-types';

const logger = createLogger({ service: 'tracking-service' });

// ============================================================================
// Delivery Tracking Operations
// ============================================================================

/**
 * Create a delivery tracking record for a notification
 *
 * Requirement 17.8: Track notification delivery status
 *
 * @param request - The tracking request
 * @returns The created tracking record
 */
export async function createDeliveryTracking(
  request: CreateDeliveryTrackingRequest
): Promise<DeliveryTrackingRecord> {
  logger.info('Creating delivery tracking', {
    notificationId: request.notificationId,
    channel: request.channel,
    recipientId: request.recipientId,
  });

  // Get default max attempts from channel config if not provided
  const maxAttempts = request.maxAttempts ?? DEFAULT_RETRY_CONFIGS[request.channel].maxAttempts;

  return trackingRepository.createDeliveryTracking({
    ...request,
    maxAttempts,
  });
}

/**
 * Get delivery tracking record by ID
 */
export async function getDeliveryTracking(trackingId: UUID): Promise<DeliveryTrackingRecord | null> {
  return trackingRepository.getDeliveryTracking(trackingId);
}

/**
 * Get all delivery tracking records for a notification
 */
export async function getDeliveryTrackingByNotification(
  notificationId: UUID
): Promise<DeliveryTrackingRecord[]> {
  return trackingRepository.getDeliveryTrackingByNotification(notificationId);
}

/**
 * Update delivery status
 *
 * Requirement 17.8: Track notification delivery status
 *
 * @param request - The status update request
 * @returns The updated tracking record
 */
export async function updateDeliveryStatus(
  request: UpdateDeliveryStatusRequest
): Promise<DeliveryTrackingRecord | null> {
  logger.info('Updating delivery status', {
    trackingId: request.trackingId,
    status: request.status,
  });

  const updated = await trackingRepository.updateDeliveryStatus(request);

  if (updated) {
    // Update history entry if exists
    const history = await trackingRepository.getHistoryByNotification(updated.notificationId);
    if (history) {
      await trackingRepository.updateHistoryEntry(history.historyId, {
        deliveryStatus: updated.status,
        deliveredAt: updated.deliveredAt,
        failureReason: updated.failureReason,
        attemptCount: updated.attemptCount,
      });
    }
  }

  return updated;
}

/**
 * Mark delivery as sent (initial send attempt)
 */
export async function markAsSent(
  trackingId: UUID,
  providerMessageId?: string,
  providerResponse?: string
): Promise<DeliveryTrackingRecord | null> {
  return updateDeliveryStatus({
    trackingId,
    status: 'SENT',
    providerMessageId,
    providerResponse,
  });
}

/**
 * Mark delivery as delivered (confirmed delivery)
 */
export async function markAsDelivered(
  trackingId: UUID,
  providerMessageId?: string
): Promise<DeliveryTrackingRecord | null> {
  return updateDeliveryStatus({
    trackingId,
    status: 'DELIVERED',
    providerMessageId,
    deliveredAt: new Date().toISOString(),
  });
}

/**
 * Mark delivery as failed
 */
export async function markAsFailed(
  trackingId: UUID,
  failureReason: string,
  failureCode?: string,
  scheduleRetry: boolean = true
): Promise<DeliveryTrackingRecord | null> {
  const tracking = await trackingRepository.getDeliveryTracking(trackingId);
  if (!tracking) {
    return null;
  }

  let nextRetryAt: string | undefined;

  if (scheduleRetry && tracking.attemptCount < tracking.maxAttempts - 1) {
    // Calculate next retry time using exponential backoff
    nextRetryAt = calculateNextRetryTime(tracking.channel, tracking.attemptCount);
  }

  return updateDeliveryStatus({
    trackingId,
    status: 'FAILED',
    failureReason,
    failureCode,
    nextRetryAt,
  });
}

/**
 * Mark delivery as bounced (email specific)
 */
export async function markAsBounced(
  trackingId: UUID,
  bounceReason: string
): Promise<DeliveryTrackingRecord | null> {
  return updateDeliveryStatus({
    trackingId,
    status: 'BOUNCED',
    failureReason: bounceReason,
  });
}

// ============================================================================
// Read Receipt Operations
// ============================================================================

/**
 * Record a read receipt when user views a notification
 *
 * Requirement 17.8: Track read receipts
 *
 * @param notificationId - The notification ID
 * @param recipientId - The recipient user ID
 * @param channel - The notification channel
 * @param readSource - How the notification was read
 * @param deviceInfo - Optional device information
 * @returns The created read receipt
 */
export async function recordReadReceipt(
  notificationId: UUID,
  recipientId: UUID,
  channel: NotificationChannel,
  readSource: ReadSource,
  deviceInfo?: DeviceInfo,
  metadata?: Record<string, unknown>
): Promise<ReadReceipt> {
  logger.info('Recording read receipt', {
    notificationId,
    recipientId,
    channel,
    readSource,
  });

  // Check if already read
  const existingReceipt = await trackingRepository.getReadReceiptByNotification(notificationId);
  if (existingReceipt) {
    logger.debug('Notification already marked as read', { notificationId });
    return existingReceipt;
  }

  const receipt = await trackingRepository.recordReadReceipt({
    notificationId,
    recipientId,
    channel,
    readSource,
    deviceInfo,
    metadata,
  });

  // Update history entry if exists
  const history = await trackingRepository.getHistoryByNotification(notificationId);
  if (history) {
    await trackingRepository.updateHistoryEntry(history.historyId, {
      readAt: receipt.readAt,
    });
  }

  return receipt;
}

/**
 * Check if a notification has been read
 */
export async function hasBeenRead(notificationId: UUID): Promise<boolean> {
  return trackingRepository.hasBeenRead(notificationId);
}

/**
 * Get read receipt for a notification
 */
export async function getReadReceipt(notificationId: UUID): Promise<ReadReceipt | null> {
  return trackingRepository.getReadReceiptByNotification(notificationId);
}

/**
 * Get read receipts for a user
 */
export async function getReadReceiptsByUser(
  recipientId: UUID,
  options?: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<ReadReceipt[]> {
  return trackingRepository.getReadReceiptsByRecipient(recipientId, options);
}

// ============================================================================
// Notification History Operations
// ============================================================================

/**
 * Log notification to history for audit purposes
 *
 * Requirement 17.8: Log notification history for audit
 *
 * @param notification - The notification details
 * @returns The created history entry
 */
export async function logNotificationHistory(notification: {
  notificationId: UUID;
  recipientId: UUID;
  channel: NotificationChannel;
  eventType: NotificationEventType;
  subject: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  deliveryStatus: DeliveryStatus;
  templateId?: UUID;
  templateName?: string;
  metadata?: Record<string, unknown>;
  sentAt?: string;
}): Promise<NotificationHistoryEntry> {
  logger.info('Logging notification to history', {
    notificationId: notification.notificationId,
    recipientId: notification.recipientId,
    channel: notification.channel,
    eventType: notification.eventType,
  });

  return trackingRepository.createHistoryEntry({
    notificationId: notification.notificationId,
    recipientId: notification.recipientId,
    channel: notification.channel,
    eventType: notification.eventType,
    subject: notification.subject,
    priority: notification.priority,
    status: notification.status,
    deliveryStatus: notification.deliveryStatus,
    sentAt: notification.sentAt,
    templateId: notification.templateId,
    templateName: notification.templateName,
    metadata: notification.metadata,
    attemptCount: 1,
  });
}

/**
 * Query notification history with filters
 *
 * Requirement 17.8: Log notification history for audit
 *
 * @param query - The query parameters
 * @returns Paginated history results
 */
export async function queryNotificationHistory(
  query: NotificationHistoryQuery
): Promise<NotificationHistoryResult> {
  logger.debug('Querying notification history', query);
  return trackingRepository.queryHistory(query);
}

/**
 * Get notification history for a specific user
 */
export async function getUserNotificationHistory(
  recipientId: UUID,
  options?: {
    channel?: NotificationChannel;
    eventType?: NotificationEventType;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }
): Promise<NotificationHistoryResult> {
  return queryNotificationHistory({
    recipientId,
    ...options,
  });
}

/**
 * Get notification history entry by notification ID
 */
export async function getHistoryByNotification(
  notificationId: UUID
): Promise<NotificationHistoryEntry | null> {
  return trackingRepository.getHistoryByNotification(notificationId);
}

// ============================================================================
// Retry Logic Operations
// ============================================================================

/**
 * Get pending retries that are due for processing
 *
 * Requirement 17.8: Implement retry for failed deliveries
 *
 * @param limit - Maximum number of retries to return
 * @returns List of pending retries
 */
export async function getPendingRetries(limit: number = 100): Promise<PendingRetry[]> {
  logger.debug('Getting pending retries', { limit });
  return trackingRepository.getPendingRetries(limit);
}

/**
 * Process a retry attempt
 *
 * Requirement 17.8: Implement retry for failed deliveries
 *
 * @param trackingId - The tracking record ID
 * @param success - Whether the retry was successful
 * @param errorCode - Error code if failed
 * @param errorMessage - Error message if failed
 * @param responseTime - Response time in milliseconds
 * @returns The retry attempt record
 */
export async function processRetryAttempt(
  trackingId: UUID,
  success: boolean,
  errorCode?: string,
  errorMessage?: string,
  responseTime?: number
): Promise<RetryAttempt> {
  const tracking = await trackingRepository.getDeliveryTracking(trackingId);
  if (!tracking) {
    throw new Error(`Tracking record not found: ${trackingId}`);
  }

  logger.info('Processing retry attempt', {
    trackingId,
    notificationId: tracking.notificationId,
    attemptNumber: tracking.attemptCount + 1,
    success,
  });

  // Record the retry attempt
  const attempt = await trackingRepository.recordRetryAttempt({
    trackingId,
    notificationId: tracking.notificationId,
    attemptNumber: tracking.attemptCount + 1,
    status: success ? 'SUCCESS' : 'FAILURE',
    errorCode,
    errorMessage,
    responseTime,
    attemptedAt: new Date().toISOString(),
  });

  // Update tracking status
  if (success) {
    await markAsDelivered(trackingId);
  } else {
    const isLastAttempt = tracking.attemptCount + 1 >= tracking.maxAttempts;
    await markAsFailed(trackingId, errorMessage ?? 'Retry failed', errorCode, !isLastAttempt);
  }

  return attempt;
}

/**
 * Get retry attempts for a tracking record
 */
export async function getRetryAttempts(trackingId: UUID): Promise<RetryAttempt[]> {
  return trackingRepository.getRetryAttempts(trackingId);
}

/**
 * Calculate next retry time using exponential backoff
 */
export function calculateNextRetryTime(
  channel: NotificationChannel,
  attemptCount: number
): string {
  const config = DEFAULT_RETRY_CONFIGS[channel];
  const delayMs = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attemptCount),
    config.maxDelayMs
  );

  const nextRetry = new Date();
  nextRetry.setTime(nextRetry.getTime() + delayMs);

  return nextRetry.toISOString();
}

/**
 * Check if a delivery status is retryable
 */
export function isRetryableStatus(
  channel: NotificationChannel,
  status: DeliveryStatus
): boolean {
  const config = DEFAULT_RETRY_CONFIGS[channel];
  return config.retryableStatuses.includes(status);
}

// ============================================================================
// Webhook Handlers
// ============================================================================

/**
 * Handle delivery status webhook from external provider
 *
 * @param event - The webhook event
 * @returns Updated tracking record
 */
export async function handleDeliveryWebhook(
  event: DeliveryWebhookEvent
): Promise<DeliveryTrackingRecord | null> {
  logger.info('Handling delivery webhook', {
    provider: event.provider,
    providerMessageId: event.providerMessageId,
    status: event.status,
  });

  // Find tracking record by provider message ID
  // In production, this would query by providerMessageId
  // For now, we'll need the trackingId to be passed in metadata
  const trackingId = event.metadata?.['trackingId'] as UUID | undefined;
  if (!trackingId) {
    logger.warn('No tracking ID in webhook event', { event });
    return null;
  }

  return updateDeliveryStatus({
    trackingId,
    status: event.status,
    providerMessageId: event.providerMessageId,
    failureReason: event.errorMessage,
    failureCode: event.errorCode,
    deliveredAt: event.status === 'DELIVERED' ? event.timestamp : undefined,
  });
}

/**
 * Handle read receipt webhook from external provider
 *
 * @param event - The webhook event
 * @returns Created read receipt
 */
export async function handleReadWebhook(
  event: ReadWebhookEvent
): Promise<ReadReceipt | null> {
  logger.info('Handling read webhook', {
    notificationId: event.notificationId,
    recipientId: event.recipientId,
    source: event.source,
  });

  // Get the tracking record to determine channel
  const trackingRecords = await trackingRepository.getDeliveryTrackingByNotification(
    event.notificationId
  );

  if (trackingRecords.length === 0) {
    logger.warn('No tracking record found for notification', {
      notificationId: event.notificationId,
    });
    return null;
  }

  const tracking = trackingRecords[0];
  if (!tracking) {
    return null;
  }

  return recordReadReceipt(
    event.notificationId,
    event.recipientId,
    tracking.channel,
    event.source,
    event.deviceInfo
  );
}

// ============================================================================
// Statistics Operations
// ============================================================================

/**
 * Get comprehensive tracking statistics
 *
 * @param fromDate - Start date for statistics
 * @param toDate - End date for statistics
 * @returns Combined delivery and read statistics
 */
export async function getTrackingStatistics(
  fromDate: string,
  toDate: string
): Promise<TrackingStatistics> {
  logger.debug('Getting tracking statistics', { fromDate, toDate });

  const [deliveryStats, readStats] = await Promise.all([
    trackingRepository.getDeliveryStatistics(fromDate, toDate),
    trackingRepository.getReadStatistics(fromDate, toDate),
  ]);

  // Calculate delivery rate
  const deliveryRate = deliveryStats.totalSent > 0
    ? deliveryStats.totalDelivered / deliveryStats.totalSent
    : 0;

  // Calculate average delivery time (placeholder - would need actual timing data)
  const averageDeliveryTimeMs = 0;

  // Build channel delivery stats
  const channelDeliveryStats: Record<NotificationChannel, ChannelDeliveryStats> = {
    EMAIL: {
      sent: deliveryStats.byChannel.EMAIL.sent,
      delivered: deliveryStats.byChannel.EMAIL.delivered,
      failed: deliveryStats.byChannel.EMAIL.failed,
      bounced: 0, // Would need separate tracking
      deliveryRate: deliveryStats.byChannel.EMAIL.sent > 0
        ? deliveryStats.byChannel.EMAIL.delivered / deliveryStats.byChannel.EMAIL.sent
        : 0,
      averageDeliveryTimeMs: 0,
    },
    SMS: {
      sent: deliveryStats.byChannel.SMS.sent,
      delivered: deliveryStats.byChannel.SMS.delivered,
      failed: deliveryStats.byChannel.SMS.failed,
      bounced: 0,
      deliveryRate: deliveryStats.byChannel.SMS.sent > 0
        ? deliveryStats.byChannel.SMS.delivered / deliveryStats.byChannel.SMS.sent
        : 0,
      averageDeliveryTimeMs: 0,
    },
    PUSH: {
      sent: deliveryStats.byChannel.PUSH.sent,
      delivered: deliveryStats.byChannel.PUSH.delivered,
      failed: deliveryStats.byChannel.PUSH.failed,
      bounced: 0,
      deliveryRate: deliveryStats.byChannel.PUSH.sent > 0
        ? deliveryStats.byChannel.PUSH.delivered / deliveryStats.byChannel.PUSH.sent
        : 0,
      averageDeliveryTimeMs: 0,
    },
    IN_APP: {
      sent: deliveryStats.byChannel.IN_APP.sent,
      delivered: deliveryStats.byChannel.IN_APP.delivered,
      failed: deliveryStats.byChannel.IN_APP.failed,
      bounced: 0,
      deliveryRate: deliveryStats.byChannel.IN_APP.sent > 0
        ? deliveryStats.byChannel.IN_APP.delivered / deliveryStats.byChannel.IN_APP.sent
        : 0,
      averageDeliveryTimeMs: 0,
    },
  };

  // Build channel read stats
  const channelReadStats: Record<NotificationChannel, ChannelReadStats> = {
    EMAIL: {
      delivered: readStats.byChannel.EMAIL.delivered,
      read: readStats.byChannel.EMAIL.read,
      readRate: readStats.byChannel.EMAIL.delivered > 0
        ? readStats.byChannel.EMAIL.read / readStats.byChannel.EMAIL.delivered
        : 0,
      averageTimeToReadMs: 0,
    },
    SMS: {
      delivered: readStats.byChannel.SMS.delivered,
      read: readStats.byChannel.SMS.read,
      readRate: readStats.byChannel.SMS.delivered > 0
        ? readStats.byChannel.SMS.read / readStats.byChannel.SMS.delivered
        : 0,
      averageTimeToReadMs: 0,
    },
    PUSH: {
      delivered: readStats.byChannel.PUSH.delivered,
      read: readStats.byChannel.PUSH.read,
      readRate: readStats.byChannel.PUSH.delivered > 0
        ? readStats.byChannel.PUSH.read / readStats.byChannel.PUSH.delivered
        : 0,
      averageTimeToReadMs: 0,
    },
    IN_APP: {
      delivered: readStats.byChannel.IN_APP.delivered,
      read: readStats.byChannel.IN_APP.read,
      readRate: readStats.byChannel.IN_APP.delivered > 0
        ? readStats.byChannel.IN_APP.read / readStats.byChannel.IN_APP.delivered
        : 0,
      averageTimeToReadMs: 0,
    },
  };

  // Calculate read rate
  const readRate = readStats.totalDelivered > 0
    ? readStats.totalRead / readStats.totalDelivered
    : 0;

  return {
    delivery: {
      totalSent: deliveryStats.totalSent,
      totalDelivered: deliveryStats.totalDelivered,
      totalFailed: deliveryStats.totalFailed,
      totalBounced: deliveryStats.totalBounced,
      totalPending: deliveryStats.totalPending,
      deliveryRate,
      averageDeliveryTimeMs,
      byChannel: channelDeliveryStats,
    },
    read: {
      totalDelivered: readStats.totalDelivered,
      totalRead: readStats.totalRead,
      readRate,
      averageTimeToReadMs: 0,
      byChannel: channelReadStats,
      bySource: readStats.bySource,
    },
    period: {
      from: fromDate,
      to: toDate,
    },
  };
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Clean up old tracking data
 *
 * @param olderThanDays - Delete records older than this many days
 * @returns Number of records deleted
 */
export async function cleanupOldTrackingData(olderThanDays: number): Promise<{
  trackingRecords: number;
  historyEntries: number;
}> {
  logger.info('Cleaning up old tracking data', { olderThanDays });

  const [trackingRecords, historyEntries] = await Promise.all([
    trackingRepository.deleteOldTrackingRecords(olderThanDays),
    trackingRepository.deleteOldHistoryEntries(olderThanDays),
  ]);

  logger.info('Cleanup completed', { trackingRecords, historyEntries });

  return { trackingRecords, historyEntries };
}
