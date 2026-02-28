/**
 * Channel Delivery Handlers
 *
 * Implements channel-specific delivery logic for email, SMS, push, and in-app notifications.
 * Uses AWS services: SES for email, SNS for SMS, and custom storage for in-app.
 *
 * Requirement 17.1: Support notification channels: email, in-app, SMS, and push notifications
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import type {
  ChannelDeliveryHandler,
  DeliveryResult,
  EmailOptions,
  InAppOptions,
  Notification,
  NotificationChannel,
  PushOptions,
  SMSOptions,
} from './notification-types';

const logger = createLogger({ service: 'notification-channel-handlers' });

// ============================================================================
// Email Channel Handler (AWS SES)
// ============================================================================

/**
 * Email delivery handler using AWS SES
 */
export class EmailChannelHandler implements ChannelDeliveryHandler {
  readonly channel: NotificationChannel = 'EMAIL';

  private readonly defaultFromAddress: string;
  private readonly sesClient: SESClientInterface;

  constructor(config: EmailChannelConfig) {
    this.defaultFromAddress = config.defaultFromAddress;
    this.sesClient = config.sesClient;
  }

  async send(notification: Notification, options?: EmailOptions): Promise<DeliveryResult> {
    const startTime = Date.now();

    if (!notification.recipientEmail) {
      return {
        success: false,
        errorCode: 'MISSING_EMAIL',
        errorMessage: 'Recipient email address is required for email notifications',
      };
    }

    try {
      logger.info('Sending email notification', {
        notificationId: notification.notificationId,
        recipientEmail: notification.recipientEmail,
        subject: notification.subject,
      });

      const params: SendEmailParams = {
        Source: options?.from ?? this.defaultFromAddress,
        Destination: {
          ToAddresses: [notification.recipientEmail],
          CcAddresses: options?.cc as string[] | undefined,
          BccAddresses: options?.bcc as string[] | undefined,
        },
        Message: {
          Subject: {
            Data: notification.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: notification.body,
              Charset: 'UTF-8',
            },
            ...(notification.htmlBody && {
              Html: {
                Data: notification.htmlBody,
                Charset: 'UTF-8',
              },
            }),
          },
        },
        ReplyToAddresses: options?.replyTo ? [options.replyTo] : undefined,
      };

      const result = await this.sesClient.sendEmail(params);

      logger.info('Email sent successfully', {
        notificationId: notification.notificationId,
        messageId: result.MessageId,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        messageId: result.MessageId,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send email', err, {
        notificationId: notification.notificationId,
        recipientEmail: notification.recipientEmail,
      });

      return {
        success: false,
        errorCode: 'SES_ERROR',
        errorMessage: err.message,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}

// ============================================================================
// SMS Channel Handler (AWS SNS)
// ============================================================================

/**
 * SMS delivery handler using AWS SNS
 */
export class SMSChannelHandler implements ChannelDeliveryHandler {
  readonly channel: NotificationChannel = 'SMS';

  private readonly snsClient: SNSClientInterface;
  private readonly defaultSenderId?: string;

  constructor(config: SMSChannelConfig) {
    this.snsClient = config.snsClient;
    this.defaultSenderId = config.defaultSenderId;
  }

  async send(notification: Notification, options?: SMSOptions): Promise<DeliveryResult> {
    const startTime = Date.now();

    if (!notification.recipientPhone) {
      return {
        success: false,
        errorCode: 'MISSING_PHONE',
        errorMessage: 'Recipient phone number is required for SMS notifications',
      };
    }

    try {
      logger.info('Sending SMS notification', {
        notificationId: notification.notificationId,
        recipientPhone: notification.recipientPhone,
      });

      // Truncate message to SMS limit (160 chars for single SMS)
      const message = notification.body.length > 160
        ? notification.body.substring(0, 157) + '...'
        : notification.body;

      const params: PublishSMSParams = {
        PhoneNumber: notification.recipientPhone,
        Message: message,
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: options?.senderId ?? this.defaultSenderId ?? 'AMS',
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: options?.messageType ?? 'TRANSACTIONAL',
          },
        },
      };

      const result = await this.snsClient.publish(params);

      logger.info('SMS sent successfully', {
        notificationId: notification.notificationId,
        messageId: result.MessageId,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        messageId: result.MessageId,
        metadata: {
          durationMs: Date.now() - startTime,
          truncated: notification.body.length > 160,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send SMS', err, {
        notificationId: notification.notificationId,
        recipientPhone: notification.recipientPhone,
      });

      return {
        success: false,
        errorCode: 'SNS_ERROR',
        errorMessage: err.message,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}

// ============================================================================
// Push Notification Channel Handler
// ============================================================================

/**
 * Push notification delivery handler
 * Uses SNS platform applications for mobile push
 */
export class PushChannelHandler implements ChannelDeliveryHandler {
  readonly channel: NotificationChannel = 'PUSH';

  private readonly snsClient: SNSClientInterface;
  private readonly deviceTokenStore: DeviceTokenStore;

  constructor(config: PushChannelConfig) {
    this.snsClient = config.snsClient;
    this.deviceTokenStore = config.deviceTokenStore;
  }

  async send(notification: Notification, options?: PushOptions): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Get device tokens for the recipient
      const deviceTokens = await this.deviceTokenStore.getTokensForUser(notification.recipientId);

      if (deviceTokens.length === 0) {
        return {
          success: false,
          errorCode: 'NO_DEVICE_TOKENS',
          errorMessage: 'No registered devices found for recipient',
        };
      }

      logger.info('Sending push notification', {
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
        deviceCount: deviceTokens.length,
      });

      const results: Array<{ token: string; success: boolean; messageId?: string; error?: string }> = [];

      for (const token of deviceTokens) {
        try {
          const message = buildPushMessage(notification, options);
          const result = await this.snsClient.publish({
            TargetArn: token.endpointArn,
            Message: JSON.stringify(message),
            MessageStructure: 'json',
          });

          results.push({
            token: token.deviceToken,
            success: true,
            messageId: result.MessageId,
          });
        } catch (error) {
          const err = error as Error;
          results.push({
            token: token.deviceToken,
            success: false,
            error: err.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const allSucceeded = successCount === results.length;

      logger.info('Push notifications sent', {
        notificationId: notification.notificationId,
        totalDevices: results.length,
        successCount,
        durationMs: Date.now() - startTime,
      });

      return {
        success: allSucceeded || successCount > 0,
        messageId: results.find(r => r.messageId)?.messageId,
        errorCode: allSucceeded ? undefined : 'PARTIAL_FAILURE',
        errorMessage: allSucceeded ? undefined : `${results.length - successCount} of ${results.length} devices failed`,
        metadata: {
          durationMs: Date.now() - startTime,
          deviceResults: results,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send push notification', err, {
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
      });

      return {
        success: false,
        errorCode: 'PUSH_ERROR',
        errorMessage: err.message,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}

/**
 * Build push notification message payload
 */
function buildPushMessage(notification: Notification, options?: PushOptions): Record<string, unknown> {
  const baseMessage = {
    title: options?.title ?? notification.subject,
    body: notification.body,
    data: {
      notificationId: notification.notificationId,
      eventType: notification.eventType,
      ...options?.data,
    },
  };

  // Format for different platforms
  return {
    default: notification.body,
    APNS: JSON.stringify({
      aps: {
        alert: {
          title: baseMessage.title,
          body: baseMessage.body,
        },
        badge: options?.badge,
        sound: options?.sound ?? 'default',
      },
      ...baseMessage.data,
    }),
    GCM: JSON.stringify({
      notification: {
        title: baseMessage.title,
        body: baseMessage.body,
        icon: options?.icon,
        click_action: options?.clickAction,
      },
      data: baseMessage.data,
    }),
  };
}

// ============================================================================
// In-App Notification Channel Handler
// ============================================================================

/**
 * In-app notification delivery handler
 * Stores notifications in database for retrieval by client
 */
export class InAppChannelHandler implements ChannelDeliveryHandler {
  readonly channel: NotificationChannel = 'IN_APP';

  private readonly notificationStore: InAppNotificationStore;

  constructor(config: InAppChannelConfig) {
    this.notificationStore = config.notificationStore;
  }

  async send(notification: Notification, options?: InAppOptions): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      logger.info('Storing in-app notification', {
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
      });

      await this.notificationStore.store({
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
        subject: notification.subject,
        body: notification.body,
        eventType: notification.eventType,
        priority: notification.priority,
        actionUrl: options?.actionUrl,
        actionLabel: options?.actionLabel,
        dismissible: options?.dismissible ?? true,
        expiresAt: options?.expiresAt,
        metadata: notification.metadata,
        createdAt: new Date().toISOString(),
      });

      logger.info('In-app notification stored', {
        notificationId: notification.notificationId,
        durationMs: Date.now() - startTime,
      });

      return {
        success: true,
        messageId: notification.notificationId,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to store in-app notification', err, {
        notificationId: notification.notificationId,
        recipientId: notification.recipientId,
      });

      return {
        success: false,
        errorCode: 'STORAGE_ERROR',
        errorMessage: err.message,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      };
    }
  }
}

// ============================================================================
// Type Definitions for External Dependencies
// ============================================================================

/**
 * SES client interface (subset of AWS SDK)
 */
export interface SESClientInterface {
  sendEmail(params: SendEmailParams): Promise<{ MessageId?: string }>;
}

/**
 * SNS client interface (subset of AWS SDK)
 */
export interface SNSClientInterface {
  publish(params: PublishSMSParams | PublishPushParams): Promise<{ MessageId?: string }>;
}

/**
 * SES send email parameters
 */
interface SendEmailParams {
  Source: string;
  Destination: {
    ToAddresses: string[];
    CcAddresses?: string[];
    BccAddresses?: string[];
  };
  Message: {
    Subject: { Data: string; Charset: string };
    Body: {
      Text: { Data: string; Charset: string };
      Html?: { Data: string; Charset: string };
    };
  };
  ReplyToAddresses?: string[];
}

/**
 * SNS publish SMS parameters
 */
interface PublishSMSParams {
  PhoneNumber: string;
  Message: string;
  MessageAttributes?: Record<string, { DataType: string; StringValue: string }>;
}

/**
 * SNS publish push parameters
 */
interface PublishPushParams {
  TargetArn: string;
  Message: string;
  MessageStructure: string;
}

/**
 * Device token for push notifications
 */
export interface DeviceToken {
  deviceToken: string;
  endpointArn: string;
  platform: 'APNS' | 'GCM';
  isActive: boolean;
}

/**
 * Device token store interface
 */
export interface DeviceTokenStore {
  getTokensForUser(userId: UUID): Promise<DeviceToken[]>;
}

/**
 * In-app notification data
 */
export interface InAppNotificationData {
  notificationId: UUID;
  recipientId: UUID;
  subject: string;
  body: string;
  eventType: string;
  priority: string;
  actionUrl?: string;
  actionLabel?: string;
  dismissible: boolean;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * In-app notification store interface
 */
export interface InAppNotificationStore {
  store(notification: InAppNotificationData): Promise<void>;
}

/**
 * Email channel configuration
 */
export interface EmailChannelConfig {
  defaultFromAddress: string;
  sesClient: SESClientInterface;
}

/**
 * SMS channel configuration
 */
export interface SMSChannelConfig {
  snsClient: SNSClientInterface;
  defaultSenderId?: string;
}

/**
 * Push channel configuration
 */
export interface PushChannelConfig {
  snsClient: SNSClientInterface;
  deviceTokenStore: DeviceTokenStore;
}

/**
 * In-app channel configuration
 */
export interface InAppChannelConfig {
  notificationStore: InAppNotificationStore;
}
