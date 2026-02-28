/**
 * Notification Service Types
 *
 * Type definitions for multi-channel notification delivery with template support.
 *
 * Requirements:
 * - 17.1: Support notification channels: email, in-app, SMS, and push notifications
 * - 17.7: Support notification templates with variable substitution
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Supported notification channels
 * Requirement 17.1: Support email, in-app, SMS, and push notifications
 */
export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'PUSH';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

/**
 * Notification delivery status
 */
export type NotificationStatus =
  | 'PENDING'      // Queued for delivery
  | 'SENDING'      // Currently being sent
  | 'DELIVERED'    // Successfully delivered
  | 'FAILED'       // Delivery failed
  | 'READ'         // Read by recipient (for in-app)
  | 'BOUNCED';     // Email bounced

/**
 * Notification event types that trigger notifications
 */
export type NotificationEventType =
  | 'CONTRACT_EXPIRING'
  | 'LOANER_OVERDUE'
  | 'STOCK_LOW'
  | 'COMPLIANCE_ALERT'
  | 'ASSET_STATE_CHANGED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'WORK_ORDER_ASSIGNED'
  | 'MAINTENANCE_DUE'
  | 'APPROVAL_REQUIRED'
  | 'SYSTEM_ALERT'
  | 'CUSTOM';

// ============================================================================
// Notification Types
// ============================================================================

/**
 * Base notification interface
 */
export interface Notification {
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly recipientEmail?: string;
  readonly recipientPhone?: string;
  readonly channel: NotificationChannel;
  readonly eventType: NotificationEventType;
  readonly templateId?: UUID;
  readonly subject: string;
  readonly body: string;
  readonly htmlBody?: string;
  readonly priority: NotificationPriority;
  readonly status: NotificationStatus;
  readonly metadata?: Record<string, unknown>;
  readonly sentAt?: ISODateString;
  readonly deliveredAt?: ISODateString;
  readonly readAt?: ISODateString;
  readonly failureReason?: string;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Request to send a notification
 */
export interface SendNotificationRequest {
  readonly recipientId: UUID;
  readonly recipientEmail?: string;
  readonly recipientPhone?: string;
  readonly channels: readonly NotificationChannel[];
  readonly eventType: NotificationEventType;
  readonly templateId?: UUID;
  readonly subject?: string;
  readonly body?: string;
  readonly htmlBody?: string;
  readonly variables?: Record<string, string | number | boolean>;
  readonly priority?: NotificationPriority;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
  readonly notificationId: UUID;
  readonly channel: NotificationChannel;
  readonly status: NotificationStatus;
  readonly sentAt?: ISODateString;
  readonly errorMessage?: string;
}

/**
 * Batch notification result
 */
export interface BatchNotificationResult {
  readonly totalRequested: number;
  readonly successful: number;
  readonly failed: number;
  readonly results: readonly SendNotificationResult[];
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Notification template
 * Requirement 17.7: Support notification templates with variable substitution
 */
export interface NotificationTemplate {
  readonly templateId: UUID;
  readonly name: string;
  readonly description?: string;
  readonly eventType: NotificationEventType;
  readonly channel: NotificationChannel;
  readonly subject: string;
  readonly body: string;
  readonly htmlBody?: string;
  readonly variables: readonly TemplateVariable[];
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly createdBy?: UUID;
  readonly updatedBy?: UUID;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly type: 'string' | 'number' | 'boolean' | 'date';
}

/**
 * Request to create a notification template
 */
export interface CreateTemplateRequest {
  readonly name: string;
  readonly description?: string;
  readonly eventType: NotificationEventType;
  readonly channel: NotificationChannel;
  readonly subject: string;
  readonly body: string;
  readonly htmlBody?: string;
  readonly variables?: readonly TemplateVariable[];
  readonly createdBy?: UUID;
}

/**
 * Request to update a notification template
 */
export interface UpdateTemplateRequest {
  readonly name?: string;
  readonly description?: string;
  readonly subject?: string;
  readonly body?: string;
  readonly htmlBody?: string;
  readonly variables?: readonly TemplateVariable[];
  readonly isActive?: boolean;
  readonly updatedBy?: UUID;
}

// ============================================================================
// Channel-Specific Types
// ============================================================================

/**
 * Email notification options
 */
export interface EmailOptions {
  readonly from?: string;
  readonly replyTo?: string;
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly attachments?: readonly EmailAttachment[];
}

/**
 * Email attachment
 */
export interface EmailAttachment {
  readonly filename: string;
  readonly content: string; // Base64 encoded
  readonly contentType: string;
}

/**
 * SMS notification options
 */
export interface SMSOptions {
  readonly senderId?: string;
  readonly messageType?: 'TRANSACTIONAL' | 'PROMOTIONAL';
}

/**
 * Push notification options
 */
export interface PushOptions {
  readonly title?: string;
  readonly icon?: string;
  readonly badge?: number;
  readonly sound?: string;
  readonly data?: Record<string, unknown>;
  readonly clickAction?: string;
}

/**
 * In-app notification options
 */
export interface InAppOptions {
  readonly actionUrl?: string;
  readonly actionLabel?: string;
  readonly dismissible?: boolean;
  readonly expiresAt?: ISODateString;
}

// ============================================================================
// Delivery Types
// ============================================================================

/**
 * Channel delivery configuration
 */
export interface ChannelConfig {
  readonly channel: NotificationChannel;
  readonly isEnabled: boolean;
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly rateLimitPerMinute?: number;
}

/**
 * Delivery attempt record
 */
export interface DeliveryAttempt {
  readonly attemptId: UUID;
  readonly notificationId: UUID;
  readonly channel: NotificationChannel;
  readonly attemptNumber: number;
  readonly status: 'SUCCESS' | 'FAILURE';
  readonly responseCode?: string;
  readonly responseMessage?: string;
  readonly attemptedAt: ISODateString;
  readonly durationMs: number;
}

/**
 * Channel delivery handler interface
 */
export interface ChannelDeliveryHandler {
  readonly channel: NotificationChannel;
  send(notification: Notification, options?: Record<string, unknown>): Promise<DeliveryResult>;
}

/**
 * Delivery result from channel handler
 */
export interface DeliveryResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Query Types
// ============================================================================

/**
 * Query parameters for listing notifications
 */
export interface NotificationQuery {
  readonly recipientId?: UUID;
  readonly channel?: NotificationChannel;
  readonly eventType?: NotificationEventType;
  readonly status?: NotificationStatus;
  readonly priority?: NotificationPriority;
  readonly fromDate?: ISODateString;
  readonly toDate?: ISODateString;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Notification statistics
 */
export interface NotificationStatistics {
  readonly totalSent: number;
  readonly totalDelivered: number;
  readonly totalFailed: number;
  readonly totalRead: number;
  readonly byChannel: Record<NotificationChannel, number>;
  readonly byEventType: Record<NotificationEventType, number>;
  readonly deliveryRate: number;
  readonly readRate: number;
}
