/**
 * Send Notification Lambda Handler
 *
 * Sends notifications through multiple channels with template support.
 *
 * Requirements:
 * - 17.1: Support notification channels: email, in-app, SMS, and push notifications
 * - 17.7: Support notification templates with variable substitution
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { NotificationChannel, NotificationEventType, NotificationPriority, SendNotificationRequest } from '../notification/notification-types';
import * as notificationService from '../notification/notification-service';

const logger = createLogger({ service: 'send-notification-handler' });

/**
 * Valid notification channels
 */
const VALID_CHANNELS: NotificationChannel[] = ['EMAIL', 'IN_APP', 'SMS', 'PUSH'];

/**
 * Valid notification priorities
 */
const VALID_PRIORITIES: NotificationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

/**
 * Valid notification event types
 */
const VALID_EVENT_TYPES: NotificationEventType[] = [
  'CONTRACT_EXPIRING',
  'LOANER_OVERDUE',
  'STOCK_LOW',
  'COMPLIANCE_ALERT',
  'ASSET_STATE_CHANGED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'WORK_ORDER_ASSIGNED',
  'MAINTENANCE_DUE',
  'APPROVAL_REQUIRED',
  'SYSTEM_ALERT',
  'CUSTOM',
];

/**
 * Request body interface
 */
interface SendNotificationBody {
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channels: string[];
  eventType: string;
  templateId?: string;
  subject?: string;
  body?: string;
  htmlBody?: string;
  variables?: Record<string, string | number | boolean>;
  priority?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: SendNotificationRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as SendNotificationBody;
  const errors: string[] = [];

  // Validate recipientId (required)
  if (!request.recipientId) {
    errors.push('recipientId is required');
  } else if (typeof request.recipientId !== 'string') {
    errors.push('recipientId must be a string');
  } else {
    const uuidError = validateUUID(request.recipientId, 'recipientId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  // Validate channels (required)
  if (!request.channels) {
    errors.push('channels is required');
  } else if (!Array.isArray(request.channels)) {
    errors.push('channels must be an array');
  } else if (request.channels.length === 0) {
    errors.push('channels must contain at least one channel');
  } else {
    for (const channel of request.channels) {
      if (!VALID_CHANNELS.includes(channel as NotificationChannel)) {
        errors.push(`Invalid channel: ${channel}. Valid channels are: ${VALID_CHANNELS.join(', ')}`);
      }
    }
  }

  // Validate eventType (required)
  if (!request.eventType) {
    errors.push('eventType is required');
  } else if (typeof request.eventType !== 'string') {
    errors.push('eventType must be a string');
  } else if (!VALID_EVENT_TYPES.includes(request.eventType as NotificationEventType)) {
    errors.push(`Invalid eventType: ${request.eventType}. Valid types are: ${VALID_EVENT_TYPES.join(', ')}`);
  }

  // Validate templateId (optional UUID)
  if (request.templateId !== undefined && request.templateId !== null) {
    if (typeof request.templateId !== 'string') {
      errors.push('templateId must be a string');
    } else {
      const uuidError = validateUUID(request.templateId, 'templateId');
      if (uuidError) {
        errors.push(uuidError.message);
      }
    }
  }

  // Validate priority (optional)
  if (request.priority !== undefined && request.priority !== null) {
    if (typeof request.priority !== 'string') {
      errors.push('priority must be a string');
    } else if (!VALID_PRIORITIES.includes(request.priority as NotificationPriority)) {
      errors.push(`Invalid priority: ${request.priority}. Valid priorities are: ${VALID_PRIORITIES.join(', ')}`);
    }
  }

  // Validate optional string fields
  const optionalStringFields = ['recipientEmail', 'recipientPhone', 'subject', 'body', 'htmlBody'];
  for (const field of optionalStringFields) {
    const value = request[field as keyof SendNotificationBody];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  // Validate variables (optional object)
  if (request.variables !== undefined && request.variables !== null) {
    if (typeof request.variables !== 'object' || Array.isArray(request.variables)) {
      errors.push('variables must be an object');
    }
  }

  // Validate metadata (optional object)
  if (request.metadata !== undefined && request.metadata !== null) {
    if (typeof request.metadata !== 'object' || Array.isArray(request.metadata)) {
      errors.push('metadata must be an object');
    }
  }

  // Validate that either templateId or content is provided
  if (!request.templateId && !request.subject && !request.body) {
    errors.push('Either templateId or subject/body content is required');
  }

  // Validate channel-specific requirements
  if (request.channels && Array.isArray(request.channels)) {
    if (request.channels.includes('EMAIL') && !request.recipientEmail && !request.templateId) {
      errors.push('recipientEmail is required for email notifications when no template is provided');
    }
    if (request.channels.includes('SMS') && !request.recipientPhone) {
      errors.push('recipientPhone is required for SMS notifications');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      recipientId: request.recipientId,
      recipientEmail: request.recipientEmail,
      recipientPhone: request.recipientPhone,
      channels: request.channels as NotificationChannel[],
      eventType: request.eventType as NotificationEventType,
      templateId: request.templateId,
      subject: request.subject,
      body: request.body,
      htmlBody: request.htmlBody,
      variables: request.variables,
      priority: request.priority as NotificationPriority | undefined,
      metadata: request.metadata,
    },
  };
}

/**
 * Lambda handler for sending notifications
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Send notification request received', { requestId });

  try {
    // Validate user ID (optional for system notifications)
    if (!userId) {
      logger.warn('No user ID in request context', { requestId });
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Send the notification
    const result = await notificationService.sendNotification(validation.data);

    logger.info('Notification sent', {
      requestId,
      recipientId: validation.data.recipientId,
      channels: validation.data.channels,
      successful: result.successful,
      failed: result.failed,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send notification', err, { requestId });

    // Handle specific errors
    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to send notification', requestId)
    );
  }
}
