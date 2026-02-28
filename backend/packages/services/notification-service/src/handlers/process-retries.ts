/**
 * Process Retries Handler
 *
 * Lambda handler for processing failed notification deliveries with retry logic.
 *
 * Requirements:
 * - 17.8: Implement retry for failed deliveries
 */

import type { ScheduledEvent, Context } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import * as trackingService from '../tracking/tracking-service';
import * as notificationService from '../notification/notification-service';

const logger = createLogger({ service: 'process-retries-handler' });

/**
 * Result of retry processing
 */
interface ProcessRetryResult {
  readonly processed: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Lambda handler for processing pending retries
 * Triggered by CloudWatch Events on a schedule (e.g., every 5 minutes)
 */
export async function handler(
  event: ScheduledEvent,
  _context: Context
): Promise<ProcessRetryResult> {
  logger.info('Processing notification retries', {
    time: event.time,
    source: event.source,
  });

  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Get pending retries (limit to prevent timeout)
    const pendingRetries = await trackingService.getPendingRetries(50);

    logger.info('Found pending retries', { count: pendingRetries.length });

    for (const retry of pendingRetries) {
      processed++;

      try {
        // Check if we should retry based on channel config
        if (!trackingService.isRetryableStatus(retry.channel, 'FAILED')) {
          logger.debug('Skipping non-retryable notification', {
            trackingId: retry.trackingId,
            channel: retry.channel,
          });
          skipped++;
          continue;
        }

        // Check if max attempts reached
        if (retry.attemptCount >= retry.maxAttempts) {
          logger.debug('Max attempts reached', {
            trackingId: retry.trackingId,
            attemptCount: retry.attemptCount,
            maxAttempts: retry.maxAttempts,
          });
          skipped++;
          continue;
        }

        logger.info('Retrying notification delivery', {
          trackingId: retry.trackingId,
          notificationId: retry.notificationId,
          channel: retry.channel,
          attemptNumber: retry.attemptCount + 1,
        });

        // Attempt to resend the notification
        const retryStartTime = Date.now();
        const result = await attemptRetry(retry);
        const responseTime = Date.now() - retryStartTime;

        // Record the retry attempt
        await trackingService.processRetryAttempt(
          retry.trackingId,
          result.success,
          result.errorCode,
          result.errorMessage,
          responseTime
        );

        if (result.success) {
          succeeded++;
          logger.info('Retry succeeded', {
            trackingId: retry.trackingId,
            notificationId: retry.notificationId,
          });
        } else {
          failed++;
          logger.warn('Retry failed', {
            trackingId: retry.trackingId,
            notificationId: retry.notificationId,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          });
        }
      } catch (error) {
        const err = error as Error;
        failed++;
        logger.error('Error processing retry', err, {
          trackingId: retry.trackingId,
          notificationId: retry.notificationId,
        });

        // Record the failed attempt
        try {
          await trackingService.processRetryAttempt(
            retry.trackingId,
            false,
            'RETRY_ERROR',
            err.message
          );
        } catch (recordError) {
          logger.error('Failed to record retry attempt', recordError as Error);
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Retry processing completed', {
      processed,
      succeeded,
      failed,
      skipped,
      durationMs: duration,
    });

    return { processed, succeeded, failed, skipped };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process retries', err);
    throw err;
  }
}

/**
 * Attempt to retry a failed notification delivery
 */
async function attemptRetry(retry: {
  trackingId: string;
  notificationId: string;
  channel: string;
  recipientId: string;
  recipientAddress: string;
}): Promise<{
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    // Get the original notification details
    const notification = await notificationService.getNotification(retry.notificationId);

    if (!notification) {
      return {
        success: false,
        errorCode: 'NOTIFICATION_NOT_FOUND',
        errorMessage: `Original notification not found: ${retry.notificationId}`,
      };
    }

    // Resend the notification
    const result = await notificationService.sendNotification({
      recipientId: notification.recipientId,
      recipientEmail: notification.recipientEmail,
      recipientPhone: notification.recipientPhone,
      channels: [notification.channel],
      eventType: notification.eventType,
      subject: notification.subject,
      body: notification.body,
      htmlBody: notification.htmlBody,
      priority: notification.priority,
      metadata: {
        ...notification.metadata,
        isRetry: true,
        originalNotificationId: retry.notificationId,
        retryTrackingId: retry.trackingId,
      },
    });

    // Check if the send was successful
    const channelResult = result.results.find((r) => r.channel === notification.channel);

    if (channelResult && (channelResult.status === 'DELIVERED' || channelResult.status === 'PENDING')) {
      return { success: true };
    }

    return {
      success: false,
      errorCode: 'DELIVERY_FAILED',
      errorMessage: channelResult?.errorMessage ?? 'Unknown delivery error',
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      errorCode: 'RETRY_EXCEPTION',
      errorMessage: err.message,
    };
  }
}

/**
 * Handler for manual retry of a specific notification
 */
export async function retryNotification(
  notificationId: string
): Promise<{
  success: boolean;
  trackingId?: string;
  errorMessage?: string;
}> {
  logger.info('Manual retry requested', { notificationId });

  try {
    // Get tracking records for this notification
    const trackingRecords = await trackingService.getDeliveryTrackingByNotification(notificationId);

    if (trackingRecords.length === 0) {
      return {
        success: false,
        errorMessage: 'No tracking record found for notification',
      };
    }

    // Find the failed tracking record
    const failedTracking = trackingRecords.find((t) => t.status === 'FAILED');

    if (!failedTracking) {
      return {
        success: false,
        errorMessage: 'No failed delivery found for notification',
      };
    }

    // Check if max attempts reached
    if (failedTracking.attemptCount >= failedTracking.maxAttempts) {
      return {
        success: false,
        errorMessage: `Max retry attempts (${failedTracking.maxAttempts}) already reached`,
      };
    }

    // Attempt the retry
    const result = await attemptRetry({
      trackingId: failedTracking.trackingId,
      notificationId: failedTracking.notificationId,
      channel: failedTracking.channel,
      recipientId: failedTracking.recipientId,
      recipientAddress: failedTracking.recipientAddress,
    });

    // Record the attempt
    await trackingService.processRetryAttempt(
      failedTracking.trackingId,
      result.success,
      result.errorCode,
      result.errorMessage
    );

    return {
      success: result.success,
      trackingId: failedTracking.trackingId,
      errorMessage: result.errorMessage,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Manual retry failed', err, { notificationId });
    return {
      success: false,
      errorMessage: err.message,
    };
  }
}
