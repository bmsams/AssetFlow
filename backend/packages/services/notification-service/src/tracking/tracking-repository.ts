/**
 * Notification Tracking Repository
 *
 * Database operations for delivery tracking, read receipts, and notification history.
 *
 * Requirements:
 * - 17.8: Track notification delivery status and read receipts
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { NotificationChannel } from '../notification/notification-types';
import type {
  CreateDeliveryTrackingRequest,
  DeliveryStatus,
  DeliveryTrackingRecord,
  NotificationHistoryEntry,
  NotificationHistoryQuery,
  NotificationHistoryResult,
  PendingRetry,
  ReadReceipt,
  ReadSource,
  RecordReadReceiptRequest,
  RetryAttempt,
  UpdateDeliveryStatusRequest,
} from './tracking-types';

const logger = createLogger({ service: 'tracking-repository' });

// ============================================================================
// In-Memory Storage (for development/testing)
// In production, these would be database tables
// ============================================================================

const deliveryTrackingStore = new Map<UUID, DeliveryTrackingRecord>();
const readReceiptStore = new Map<UUID, ReadReceipt>();
const historyStore = new Map<UUID, NotificationHistoryEntry>();
const retryAttemptStore = new Map<UUID, RetryAttempt[]>();

// ============================================================================
// Delivery Tracking Operations
// ============================================================================

/**
 * Create a new delivery tracking record
 */
export async function createDeliveryTracking(
  request: CreateDeliveryTrackingRequest
): Promise<DeliveryTrackingRecord> {
  const trackingId = generateUUID();
  const now = new Date().toISOString();

  logger.debug('Creating delivery tracking record', {
    trackingId,
    notificationId: request.notificationId,
    channel: request.channel,
    recipientId: request.recipientId,
  });

  const record: DeliveryTrackingRecord = {
    trackingId,
    notificationId: request.notificationId,
    channel: request.channel,
    recipientId: request.recipientId,
    recipientAddress: request.recipientAddress,
    status: 'QUEUED',
    attemptCount: 0,
    maxAttempts: request.maxAttempts ?? 3,
    metadata: request.metadata,
    createdAt: now,
    updatedAt: now,
  };

  deliveryTrackingStore.set(trackingId, record);

  return record;
}

/**
 * Get delivery tracking record by ID
 */
export async function getDeliveryTracking(trackingId: UUID): Promise<DeliveryTrackingRecord | null> {
  logger.debug('Getting delivery tracking record', { trackingId });
  return deliveryTrackingStore.get(trackingId) ?? null;
}

/**
 * Get delivery tracking records by notification ID
 */
export async function getDeliveryTrackingByNotification(
  notificationId: UUID
): Promise<DeliveryTrackingRecord[]> {
  logger.debug('Getting delivery tracking by notification', { notificationId });

  const records: DeliveryTrackingRecord[] = [];
  for (const record of deliveryTrackingStore.values()) {
    if (record.notificationId === notificationId) {
      records.push(record);
    }
  }

  return records;
}

/**
 * Update delivery tracking status
 */
export async function updateDeliveryStatus(
  request: UpdateDeliveryStatusRequest
): Promise<DeliveryTrackingRecord | null> {
  logger.debug('Updating delivery status', {
    trackingId: request.trackingId,
    status: request.status,
  });

  const existing = deliveryTrackingStore.get(request.trackingId);
  if (!existing) {
    return null;
  }

  const updated: DeliveryTrackingRecord = {
    ...existing,
    status: request.status,
    providerMessageId: request.providerMessageId ?? existing.providerMessageId,
    providerResponse: request.providerResponse ?? existing.providerResponse,
    deliveredAt: request.deliveredAt ?? existing.deliveredAt,
    failureReason: request.failureReason ?? existing.failureReason,
    failureCode: request.failureCode ?? existing.failureCode,
    nextRetryAt: request.nextRetryAt ?? existing.nextRetryAt,
    lastAttemptAt: new Date().toISOString(),
    attemptCount: existing.attemptCount + 1,
    updatedAt: new Date().toISOString(),
  };

  deliveryTrackingStore.set(request.trackingId, updated);

  return updated;
}

/**
 * Get pending retries that are due
 */
export async function getPendingRetries(
  limit: number = 100
): Promise<PendingRetry[]> {
  logger.debug('Getting pending retries', { limit });

  const now = new Date().toISOString();
  const pending: PendingRetry[] = [];

  for (const record of deliveryTrackingStore.values()) {
    if (
      record.status === 'FAILED' &&
      record.attemptCount < record.maxAttempts &&
      record.nextRetryAt &&
      record.nextRetryAt <= now
    ) {
      pending.push({
        trackingId: record.trackingId,
        notificationId: record.notificationId,
        channel: record.channel,
        recipientId: record.recipientId,
        recipientAddress: record.recipientAddress,
        attemptCount: record.attemptCount,
        maxAttempts: record.maxAttempts,
        nextRetryAt: record.nextRetryAt,
        lastFailureReason: record.failureReason,
      });

      if (pending.length >= limit) {
        break;
      }
    }
  }

  return pending;
}

/**
 * Get delivery tracking records by status
 */
export async function getDeliveryTrackingByStatus(
  status: DeliveryStatus,
  limit: number = 100
): Promise<DeliveryTrackingRecord[]> {
  logger.debug('Getting delivery tracking by status', { status, limit });

  const records: DeliveryTrackingRecord[] = [];
  for (const record of deliveryTrackingStore.values()) {
    if (record.status === status) {
      records.push(record);
      if (records.length >= limit) {
        break;
      }
    }
  }

  return records;
}

// ============================================================================
// Read Receipt Operations
// ============================================================================

/**
 * Record a read receipt
 */
export async function recordReadReceipt(
  request: RecordReadReceiptRequest
): Promise<ReadReceipt> {
  const receiptId = generateUUID();
  const now = new Date().toISOString();

  logger.debug('Recording read receipt', {
    receiptId,
    notificationId: request.notificationId,
    recipientId: request.recipientId,
    readSource: request.readSource,
  });

  const receipt: ReadReceipt = {
    receiptId,
    notificationId: request.notificationId,
    recipientId: request.recipientId,
    channel: request.channel,
    readAt: now,
    readSource: request.readSource,
    deviceInfo: request.deviceInfo,
    metadata: request.metadata,
  };

  readReceiptStore.set(receiptId, receipt);

  return receipt;
}

/**
 * Get read receipt by notification ID
 */
export async function getReadReceiptByNotification(
  notificationId: UUID
): Promise<ReadReceipt | null> {
  logger.debug('Getting read receipt by notification', { notificationId });

  for (const receipt of readReceiptStore.values()) {
    if (receipt.notificationId === notificationId) {
      return receipt;
    }
  }

  return null;
}

/**
 * Get read receipts by recipient
 */
export async function getReadReceiptsByRecipient(
  recipientId: UUID,
  options?: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }
): Promise<ReadReceipt[]> {
  logger.debug('Getting read receipts by recipient', { recipientId, ...options });

  const receipts: ReadReceipt[] = [];
  const limit = options?.limit ?? 100;

  for (const receipt of readReceiptStore.values()) {
    if (receipt.recipientId === recipientId) {
      // Apply date filters if provided
      if (options?.fromDate && receipt.readAt < options.fromDate) {
        continue;
      }
      if (options?.toDate && receipt.readAt > options.toDate) {
        continue;
      }

      receipts.push(receipt);
      if (receipts.length >= limit) {
        break;
      }
    }
  }

  return receipts;
}

/**
 * Check if notification has been read
 */
export async function hasBeenRead(notificationId: UUID): Promise<boolean> {
  const receipt = await getReadReceiptByNotification(notificationId);
  return receipt !== null;
}

// ============================================================================
// Notification History Operations
// ============================================================================

/**
 * Create a notification history entry
 */
export async function createHistoryEntry(
  entry: Omit<NotificationHistoryEntry, 'historyId' | 'createdAt'>
): Promise<NotificationHistoryEntry> {
  const historyId = generateUUID();
  const now = new Date().toISOString();

  logger.debug('Creating notification history entry', {
    historyId,
    notificationId: entry.notificationId,
    recipientId: entry.recipientId,
    channel: entry.channel,
  });

  const historyEntry: NotificationHistoryEntry = {
    ...entry,
    historyId,
    createdAt: now,
  };

  historyStore.set(historyId, historyEntry);

  return historyEntry;
}

/**
 * Update notification history entry
 */
export async function updateHistoryEntry(
  historyId: UUID,
  updates: Partial<Pick<NotificationHistoryEntry, 'status' | 'deliveryStatus' | 'deliveredAt' | 'readAt' | 'failureReason' | 'attemptCount'>>
): Promise<NotificationHistoryEntry | null> {
  logger.debug('Updating notification history entry', { historyId, updates });

  const existing = historyStore.get(historyId);
  if (!existing) {
    return null;
  }

  const updated: NotificationHistoryEntry = {
    ...existing,
    ...updates,
  };

  historyStore.set(historyId, updated);

  return updated;
}

/**
 * Get notification history entry by notification ID
 */
export async function getHistoryByNotification(
  notificationId: UUID
): Promise<NotificationHistoryEntry | null> {
  logger.debug('Getting history by notification', { notificationId });

  for (const entry of historyStore.values()) {
    if (entry.notificationId === notificationId) {
      return entry;
    }
  }

  return null;
}

/**
 * Query notification history with filters
 */
export async function queryHistory(
  query: NotificationHistoryQuery
): Promise<NotificationHistoryResult> {
  logger.debug('Querying notification history', query);

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? 'desc';

  // Filter entries
  let entries: NotificationHistoryEntry[] = [];
  for (const entry of historyStore.values()) {
    if (query.recipientId && entry.recipientId !== query.recipientId) {
      continue;
    }
    if (query.channel && entry.channel !== query.channel) {
      continue;
    }
    if (query.eventType && entry.eventType !== query.eventType) {
      continue;
    }
    if (query.status && entry.status !== query.status) {
      continue;
    }
    if (query.deliveryStatus && entry.deliveryStatus !== query.deliveryStatus) {
      continue;
    }
    if (query.fromDate && entry.createdAt < query.fromDate) {
      continue;
    }
    if (query.toDate && entry.createdAt > query.toDate) {
      continue;
    }

    entries.push(entry);
  }

  // Sort entries
  entries.sort((a, b) => {
    const aValue = a[sortBy] ?? '';
    const bValue = b[sortBy] ?? '';
    const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Paginate
  const total = entries.length;
  const startIndex = (page - 1) * limit;
  const paginatedEntries = entries.slice(startIndex, startIndex + limit);

  return {
    entries: paginatedEntries,
    total,
    page,
    limit,
    hasMore: startIndex + limit < total,
  };
}

// ============================================================================
// Retry Attempt Operations
// ============================================================================

/**
 * Record a retry attempt
 */
export async function recordRetryAttempt(
  attempt: Omit<RetryAttempt, 'attemptId'>
): Promise<RetryAttempt> {
  const attemptId = generateUUID();

  logger.debug('Recording retry attempt', {
    attemptId,
    trackingId: attempt.trackingId,
    notificationId: attempt.notificationId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
  });

  const retryAttempt: RetryAttempt = {
    ...attempt,
    attemptId,
  };

  const existing = retryAttemptStore.get(attempt.trackingId) ?? [];
  existing.push(retryAttempt);
  retryAttemptStore.set(attempt.trackingId, existing);

  return retryAttempt;
}

/**
 * Get retry attempts for a tracking record
 */
export async function getRetryAttempts(trackingId: UUID): Promise<RetryAttempt[]> {
  logger.debug('Getting retry attempts', { trackingId });
  return retryAttemptStore.get(trackingId) ?? [];
}

// ============================================================================
// Statistics Operations
// ============================================================================

/**
 * Get delivery statistics for a time period
 */
export async function getDeliveryStatistics(
  fromDate: string,
  toDate: string
): Promise<{
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalBounced: number;
  totalPending: number;
  byChannel: Record<NotificationChannel, { sent: number; delivered: number; failed: number }>;
}> {
  logger.debug('Getting delivery statistics', { fromDate, toDate });

  const stats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    totalBounced: 0,
    totalPending: 0,
    byChannel: {
      EMAIL: { sent: 0, delivered: 0, failed: 0 },
      SMS: { sent: 0, delivered: 0, failed: 0 },
      PUSH: { sent: 0, delivered: 0, failed: 0 },
      IN_APP: { sent: 0, delivered: 0, failed: 0 },
    } as Record<NotificationChannel, { sent: number; delivered: number; failed: number }>,
  };

  for (const record of deliveryTrackingStore.values()) {
    if (record.createdAt < fromDate || record.createdAt > toDate) {
      continue;
    }

    stats.totalSent++;
    stats.byChannel[record.channel].sent++;

    switch (record.status) {
      case 'DELIVERED':
        stats.totalDelivered++;
        stats.byChannel[record.channel].delivered++;
        break;
      case 'FAILED':
      case 'REJECTED':
      case 'EXPIRED':
        stats.totalFailed++;
        stats.byChannel[record.channel].failed++;
        break;
      case 'BOUNCED':
        stats.totalBounced++;
        stats.byChannel[record.channel].failed++;
        break;
      case 'QUEUED':
      case 'SENDING':
      case 'SENT':
        stats.totalPending++;
        break;
    }
  }

  return stats;
}

/**
 * Get read statistics for a time period
 */
export async function getReadStatistics(
  fromDate: string,
  toDate: string
): Promise<{
  totalDelivered: number;
  totalRead: number;
  byChannel: Record<NotificationChannel, { delivered: number; read: number }>;
  bySource: Record<ReadSource, number>;
}> {
  logger.debug('Getting read statistics', { fromDate, toDate });

  const stats = {
    totalDelivered: 0,
    totalRead: 0,
    byChannel: {
      EMAIL: { delivered: 0, read: 0 },
      SMS: { delivered: 0, read: 0 },
      PUSH: { delivered: 0, read: 0 },
      IN_APP: { delivered: 0, read: 0 },
    } as Record<NotificationChannel, { delivered: number; read: number }>,
    bySource: {
      WEB_APP: 0,
      MOBILE_APP: 0,
      EMAIL_PIXEL: 0,
      EMAIL_LINK: 0,
      PUSH_OPEN: 0,
      API: 0,
      SYSTEM: 0,
    } as Record<ReadSource, number>,
  };

  // Count delivered notifications
  for (const record of deliveryTrackingStore.values()) {
    if (record.createdAt < fromDate || record.createdAt > toDate) {
      continue;
    }
    if (record.status === 'DELIVERED') {
      stats.totalDelivered++;
      stats.byChannel[record.channel].delivered++;
    }
  }

  // Count read receipts
  for (const receipt of readReceiptStore.values()) {
    if (receipt.readAt < fromDate || receipt.readAt > toDate) {
      continue;
    }
    stats.totalRead++;
    stats.byChannel[receipt.channel].read++;
    stats.bySource[receipt.readSource]++;
  }

  return stats;
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Delete old tracking records
 */
export async function deleteOldTrackingRecords(olderThanDays: number): Promise<number> {
  logger.debug('Deleting old tracking records', { olderThanDays });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffIso = cutoffDate.toISOString();

  let deleted = 0;

  for (const [trackingId, record] of deliveryTrackingStore.entries()) {
    if (record.createdAt < cutoffIso) {
      deliveryTrackingStore.delete(trackingId);
      retryAttemptStore.delete(trackingId);
      deleted++;
    }
  }

  return deleted;
}

/**
 * Delete old history entries
 */
export async function deleteOldHistoryEntries(olderThanDays: number): Promise<number> {
  logger.debug('Deleting old history entries', { olderThanDays });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffIso = cutoffDate.toISOString();

  let deleted = 0;

  for (const [historyId, entry] of historyStore.entries()) {
    if (entry.createdAt < cutoffIso) {
      historyStore.delete(historyId);
      deleted++;
    }
  }

  return deleted;
}

// ============================================================================
// Test Helpers (for clearing state in tests)
// ============================================================================

/**
 * Clear all tracking data (for testing)
 */
export function clearAllTrackingData(): void {
  deliveryTrackingStore.clear();
  readReceiptStore.clear();
  historyStore.clear();
  retryAttemptStore.clear();
}

// ============================================================================
// Helper Functions
// ============================================================================

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
