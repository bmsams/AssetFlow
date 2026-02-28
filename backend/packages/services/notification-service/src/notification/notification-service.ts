/**
 * Notification Service - Core notification delivery logic
 *
 * Implements multi-channel notification delivery with template support.
 *
 * Requirements:
 * - 17.1: Support notification channels: email, in-app, SMS, and push notifications
 * - 17.7: Support notification templates with variable substitution
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES, entityKey } from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  EmailChannelHandler,
  InAppChannelHandler,
  PushChannelHandler,
  SMSChannelHandler,
} from './channel-handlers';
import * as notificationRepository from './notification-repository';
import type {
  BatchNotificationResult,
  ChannelConfig,
  ChannelDeliveryHandler,
  DeliveryResult,
  Notification,
  NotificationChannel,
  NotificationEventType,
  NotificationPriority,
  NotificationQuery,
  NotificationStatistics,
  NotificationStatus,
  NotificationTemplate,
  SendNotificationRequest,
  SendNotificationResult,
} from './notification-types';
import { renderTemplate, renderString } from './template-engine';

const logger = createLogger({ service: 'notification-service' });

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
  readonly emailHandler?: EmailChannelHandler;
  readonly smsHandler?: SMSChannelHandler;
  readonly pushHandler?: PushChannelHandler;
  readonly inAppHandler?: InAppChannelHandler;
  readonly defaultMaxRetries?: number;
  readonly channelConfigs?: readonly ChannelConfig[];
}

/**
 * Channel handlers registry
 */
let channelHandlers: Map<NotificationChannel, ChannelDeliveryHandler> = new Map();

/**
 * Default channel configurations
 */
const defaultChannelConfigs: Record<NotificationChannel, ChannelConfig> = {
  EMAIL: {
    channel: 'EMAIL',
    isEnabled: true,
    maxRetries: 3,
    retryDelayMs: 1000,
    rateLimitPerMinute: 100,
  },
  SMS: {
    channel: 'SMS',
    isEnabled: true,
    maxRetries: 2,
    retryDelayMs: 500,
    rateLimitPerMinute: 50,
  },
  PUSH: {
    channel: 'PUSH',
    isEnabled: true,
    maxRetries: 2,
    retryDelayMs: 500,
    rateLimitPerMinute: 200,
  },
  IN_APP: {
    channel: 'IN_APP',
    isEnabled: true,
    maxRetries: 1,
    retryDelayMs: 100,
    rateLimitPerMinute: 500,
  },
};

let channelConfigs: Record<NotificationChannel, ChannelConfig> = { ...defaultChannelConfigs };

/**
 * Initialize the notification service with handlers
 */
export function initializeService(config: NotificationServiceConfig): void {
  channelHandlers = new Map();

  if (config.emailHandler) {
    channelHandlers.set('EMAIL', config.emailHandler);
  }
  if (config.smsHandler) {
    channelHandlers.set('SMS', config.smsHandler);
  }
  if (config.pushHandler) {
    channelHandlers.set('PUSH', config.pushHandler);
  }
  if (config.inAppHandler) {
    channelHandlers.set('IN_APP', config.inAppHandler);
  }

  // Apply custom channel configs
  if (config.channelConfigs) {
    for (const channelConfig of config.channelConfigs) {
      channelConfigs[channelConfig.channel] = channelConfig;
    }
  }

  logger.info('Notification service initialized', {
    enabledChannels: Array.from(channelHandlers.keys()),
  });
}

// ============================================================================
// Core Notification Operations
// ============================================================================

/**
 * Send a notification through specified channels
 *
 * Requirement 17.1: Support notification channels: email, in-app, SMS, and push notifications
 * Requirement 17.7: Support notification templates with variable substitution
 *
 * @param request - The notification request
 * @returns Batch result with status for each channel
 */
export async function sendNotification(
  request: SendNotificationRequest
): Promise<BatchNotificationResult> {
  logger.info('Sending notification', {
    recipientId: request.recipientId,
    channels: request.channels,
    eventType: request.eventType,
    templateId: request.templateId,
  });

  // Validate request
  validateSendRequest(request);

  // Resolve template if provided
  let subject = request.subject ?? '';
  let body = request.body ?? '';
  let htmlBody = request.htmlBody;

  if (request.templateId) {
    const templateResult = await resolveTemplate(
      request.templateId,
      request.eventType,
      request.channels[0], // Use first channel for template lookup
      request.variables ?? {}
    );

    if (templateResult) {
      subject = templateResult.subject;
      body = templateResult.body;
      htmlBody = templateResult.htmlBody;
    }
  } else if (request.variables && Object.keys(request.variables).length > 0) {
    // Apply variable substitution to provided subject/body
    subject = renderString(subject, request.variables);
    body = renderString(body, request.variables);
    if (htmlBody) {
      htmlBody = renderString(htmlBody, request.variables);
    }
  }

  const results: SendNotificationResult[] = [];
  let successful = 0;
  let failed = 0;

  // Send to each requested channel
  for (const channel of request.channels) {
    const result = await sendToChannel(channel, {
      recipientId: request.recipientId,
      recipientEmail: request.recipientEmail,
      recipientPhone: request.recipientPhone,
      eventType: request.eventType,
      subject,
      body,
      htmlBody,
      priority: request.priority ?? 'NORMAL',
      metadata: request.metadata,
    });

    results.push(result);

    if (result.status === 'DELIVERED' || result.status === 'PENDING') {
      successful++;
    } else {
      failed++;
    }
  }

  logger.info('Notification batch completed', {
    recipientId: request.recipientId,
    totalRequested: request.channels.length,
    successful,
    failed,
  });

  return {
    totalRequested: request.channels.length,
    successful,
    failed,
    results,
  };
}

/**
 * Send notification to a specific channel
 */
async function sendToChannel(
  channel: NotificationChannel,
  params: {
    recipientId: UUID;
    recipientEmail?: string;
    recipientPhone?: string;
    eventType: NotificationEventType;
    subject: string;
    body: string;
    htmlBody?: string;
    priority: NotificationPriority;
    metadata?: Record<string, unknown>;
  }
): Promise<SendNotificationResult> {
  const config = channelConfigs[channel];

  // Check if channel is enabled
  if (!config.isEnabled) {
    logger.warn('Channel is disabled', { channel });
    return {
      notificationId: '',
      channel,
      status: 'FAILED',
      errorMessage: `Channel ${channel} is disabled`,
    };
  }

  // Check if handler is available
  const handler = channelHandlers.get(channel);
  if (!handler) {
    logger.warn('No handler configured for channel', { channel });
    return {
      notificationId: '',
      channel,
      status: 'FAILED',
      errorMessage: `No handler configured for channel ${channel}`,
    };
  }

  // Create notification record
  const notification = await notificationRepository.createNotification({
    recipientId: params.recipientId,
    recipientEmail: params.recipientEmail,
    recipientPhone: params.recipientPhone,
    channel,
    eventType: params.eventType,
    subject: params.subject,
    body: params.body,
    htmlBody: params.htmlBody,
    priority: params.priority,
    status: 'PENDING',
    metadata: params.metadata,
    retryCount: 0,
    maxRetries: config.maxRetries,
  });

  // Attempt delivery
  const deliveryResult = await attemptDelivery(handler, notification, config);

  // Update notification status based on result
  const finalStatus: NotificationStatus = deliveryResult.success ? 'DELIVERED' : 'FAILED';
  const now = new Date().toISOString();

  await notificationRepository.updateNotificationStatus(notification.notificationId, finalStatus, {
    sentAt: now,
    deliveredAt: deliveryResult.success ? now : undefined,
    failureReason: deliveryResult.errorMessage,
  });

  // Record delivery attempt
  await notificationRepository.recordDeliveryAttempt({
    notificationId: notification.notificationId,
    channel,
    attemptNumber: 1,
    status: deliveryResult.success ? 'SUCCESS' : 'FAILURE',
    responseCode: deliveryResult.errorCode,
    responseMessage: deliveryResult.errorMessage,
    attemptedAt: now,
    durationMs: (deliveryResult.metadata?.['durationMs'] as number) ?? 0,
  });

  // Publish event for notification sent
  await publishEvent('NOTIFICATION_SENT', {
    notificationId: notification.notificationId,
    channel,
    status: finalStatus,
    recipientId: params.recipientId,
  });

  return {
    notificationId: notification.notificationId,
    channel,
    status: finalStatus,
    sentAt: now,
    errorMessage: deliveryResult.errorMessage,
  };
}

/**
 * Attempt to deliver notification through handler
 */
async function attemptDelivery(
  handler: ChannelDeliveryHandler,
  notification: Notification,
  _config: ChannelConfig
): Promise<DeliveryResult> {
  try {
    return await handler.send(notification);
  } catch (error) {
    const err = error as Error;
    logger.error('Delivery attempt failed', err, {
      notificationId: notification.notificationId,
      channel: notification.channel,
    });

    return {
      success: false,
      errorCode: 'DELIVERY_ERROR',
      errorMessage: err.message,
    };
  }
}

/**
 * Resolve template and render with variables
 */
async function resolveTemplate(
  templateId: UUID,
  eventType: NotificationEventType,
  channel: NotificationChannel | undefined,
  variables: Record<string, string | number | boolean>
): Promise<{ subject: string; body: string; htmlBody?: string } | null> {
  // Try to get template by ID first
  let template = await notificationRepository.getTemplateById(templateId);

  // If not found by ID, try by event type and channel
  if (!template && channel) {
    template = await notificationRepository.getTemplateByEventAndChannel(eventType, channel);
  }

  if (!template) {
    logger.warn('Template not found', { templateId, eventType, channel });
    return null;
  }

  // Render template with variables
  const renderResult = renderTemplate(template, variables);

  if (!renderResult.success) {
    logger.warn('Template rendering failed', {
      templateId: template.templateId,
      errors: renderResult.errors,
    });
  }

  return {
    subject: renderResult.subject,
    body: renderResult.body,
    htmlBody: renderResult.htmlBody,
  };
}

/**
 * Validate send notification request
 */
function validateSendRequest(request: SendNotificationRequest): void {
  if (!request.recipientId) {
    throw new Error('Recipient ID is required');
  }

  if (!request.channels || request.channels.length === 0) {
    throw new Error('At least one notification channel is required');
  }

  if (!request.eventType) {
    throw new Error('Event type is required');
  }

  // Validate channel-specific requirements
  for (const channel of request.channels) {
    if (channel === 'EMAIL' && !request.recipientEmail && !request.templateId) {
      throw new Error('Recipient email is required for email notifications');
    }
    if (channel === 'SMS' && !request.recipientPhone) {
      throw new Error('Recipient phone is required for SMS notifications');
    }
  }

  // Validate that either template or content is provided
  if (!request.templateId && !request.subject && !request.body) {
    throw new Error('Either templateId or subject/body content is required');
  }
}

// ============================================================================
// Notification Query Operations
// ============================================================================

/**
 * Get notification by ID
 */
export async function getNotification(notificationId: UUID): Promise<Notification | null> {
  const cacheKey = entityKey(CACHE_ENTITY_TYPES.NOTIFICATION, notificationId);
  return cache.getOrSet(
    cacheKey,
    () => notificationRepository.getNotificationById(notificationId),
    { ttl: cache.DEFAULT_TTL.SHORT }
  );
}

/**
 * Get notifications with filters
 */
export async function getNotifications(
  query: NotificationQuery
): Promise<{ notifications: Notification[]; total: number }> {
  return notificationRepository.getNotifications(query);
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(
  recipientId: UUID,
  channel?: NotificationChannel
): Promise<Notification[]> {
  return notificationRepository.getUnreadNotifications(recipientId, channel);
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: UUID): Promise<void> {
  logger.info('Marking notification as read', { notificationId });
  await notificationRepository.markNotificationAsRead(notificationId);

  // Invalidate cache
  const cacheKey = entityKey(CACHE_ENTITY_TYPES.NOTIFICATION, notificationId);
  await cache.del(cacheKey);

  // Publish event
  await publishEvent('NOTIFICATION_READ', { notificationId });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(
  recipientId: UUID,
  channel?: NotificationChannel
): Promise<number> {
  logger.info('Marking all notifications as read', { recipientId, channel });
  const count = await notificationRepository.markAllNotificationsAsRead(recipientId, channel);

  // Invalidate notification cache for this user
  await cache.deletePattern(`ams:${CACHE_ENTITY_TYPES.NOTIFICATION}:*`);

  // Publish event
  await publishEvent('NOTIFICATIONS_ALL_READ', { recipientId, channel, count });

  return count;
}

/**
 * Get notification statistics
 */
export async function getStatistics(
  filters?: {
    fromDate?: string;
    toDate?: string;
    channel?: NotificationChannel;
    eventType?: NotificationEventType;
  }
): Promise<NotificationStatistics> {
  return notificationRepository.getNotificationStatistics(filters);
}

// ============================================================================
// Template Operations
// ============================================================================

/**
 * Get template by ID
 */
export async function getTemplate(templateId: UUID): Promise<NotificationTemplate | null> {
  return notificationRepository.getTemplateById(templateId);
}

/**
 * Get all templates
 */
export async function getTemplates(
  filters?: {
    eventType?: NotificationEventType;
    channel?: NotificationChannel;
    isActive?: boolean;
  }
): Promise<NotificationTemplate[]> {
  return notificationRepository.getAllTemplates(filters);
}

/**
 * Create a new template
 */
export async function createTemplate(
  request: {
    name: string;
    description?: string;
    eventType: NotificationEventType;
    channel: NotificationChannel;
    subject: string;
    body: string;
    htmlBody?: string;
    variables?: Array<{
      name: string;
      description?: string;
      required: boolean;
      defaultValue?: string;
      type: 'string' | 'number' | 'boolean' | 'date';
    }>;
    createdBy?: UUID;
  }
): Promise<NotificationTemplate> {
  logger.info('Creating notification template', {
    name: request.name,
    eventType: request.eventType,
    channel: request.channel,
  });

  return notificationRepository.createTemplate({
    name: request.name,
    description: request.description,
    eventType: request.eventType,
    channel: request.channel,
    subject: request.subject,
    body: request.body,
    htmlBody: request.htmlBody,
    variables: request.variables,
    createdBy: request.createdBy,
  });
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: UUID,
  updates: {
    name?: string;
    description?: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    variables?: Array<{
      name: string;
      description?: string;
      required: boolean;
      defaultValue?: string;
      type: 'string' | 'number' | 'boolean' | 'date';
    }>;
    isActive?: boolean;
    updatedBy?: UUID;
  }
): Promise<NotificationTemplate | null> {
  logger.info('Updating notification template', { templateId });
  return notificationRepository.updateTemplate(templateId, updates);
}

/**
 * Delete a template (soft delete)
 */
export async function deleteTemplate(templateId: UUID): Promise<boolean> {
  logger.info('Deleting notification template', { templateId });
  return notificationRepository.deleteTemplate(templateId);
}

// ============================================================================
// Retry Operations
// ============================================================================

/**
 * Retry failed notifications
 */
export async function retryFailedNotifications(limit: number = 100): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  logger.info('Retrying failed notifications', { limit });

  const pendingNotifications = await notificationRepository.getPendingNotificationsForRetry(limit);

  let succeeded = 0;
  let failed = 0;

  for (const notification of pendingNotifications) {
    const handler = channelHandlers.get(notification.channel);
    if (!handler) {
      failed++;
      continue;
    }

    const config = channelConfigs[notification.channel];
    const result = await attemptDelivery(handler, notification, config);

    const newRetryCount = notification.retryCount + 1;
    const now = new Date().toISOString();

    if (result.success) {
      await notificationRepository.updateNotificationStatus(notification.notificationId, 'DELIVERED', {
        deliveredAt: now,
        retryCount: newRetryCount,
      });
      succeeded++;
    } else if (newRetryCount >= notification.maxRetries) {
      await notificationRepository.updateNotificationStatus(notification.notificationId, 'FAILED', {
        failureReason: result.errorMessage,
        retryCount: newRetryCount,
      });
      failed++;
    } else {
      await notificationRepository.updateNotificationStatus(notification.notificationId, 'PENDING', {
        retryCount: newRetryCount,
      });
      failed++;
    }

    // Record delivery attempt
    await notificationRepository.recordDeliveryAttempt({
      notificationId: notification.notificationId,
      channel: notification.channel,
      attemptNumber: newRetryCount,
      status: result.success ? 'SUCCESS' : 'FAILURE',
      responseCode: result.errorCode,
      responseMessage: result.errorMessage,
      attemptedAt: now,
      durationMs: (result.metadata?.['durationMs'] as number) ?? 0,
    });
  }

  logger.info('Retry batch completed', {
    processed: pendingNotifications.length,
    succeeded,
    failed,
  });

  return {
    processed: pendingNotifications.length,
    succeeded,
    failed,
  };
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * Delete old notifications
 */
export async function cleanupOldNotifications(olderThanDays: number): Promise<number> {
  logger.info('Cleaning up old notifications', { olderThanDays });
  return notificationRepository.deleteOldNotifications(olderThanDays);
}
