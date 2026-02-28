/**
 * Mark Notification Read Handler
 *
 * Lambda handler for marking notifications as read and recording read receipts.
 *
 * Requirements:
 * - 17.8: Track notification delivery status and read receipts
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { UUID } from '@ams/types';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { DeviceInfo, ReadSource } from '../tracking/tracking-types';
import * as trackingService from '../tracking/tracking-service';
import type { NotificationChannel } from '../notification/notification-types';

const logger = createLogger({ service: 'mark-notification-read-handler' });

/**
 * Request body for marking notification as read
 */
interface MarkReadRequest {
  readonly notificationId: UUID;
  readonly recipientId: UUID;
  readonly channel: NotificationChannel;
  readonly readSource: ReadSource;
  readonly deviceInfo?: DeviceInfo;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Lambda handler for marking a notification as read
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Mark notification read request received', {
    requestId,
    path: event.path,
    httpMethod: event.httpMethod,
  });

  try {
    // Parse request body
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    const request: MarkReadRequest = JSON.parse(event.body);

    // Validate required fields
    const validationError = validateRequest(request);
    if (validationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, validationError, requestId)
      );
    }

    // Record read receipt
    const receipt = await trackingService.recordReadReceipt(
      request.notificationId,
      request.recipientId,
      request.channel,
      request.readSource,
      request.deviceInfo,
      request.metadata
    );

    logger.info('Notification marked as read', {
      requestId,
      notificationId: request.notificationId,
      receiptId: receipt.receiptId,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(receipt, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to mark notification as read', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Internal server error', requestId)
    );
  }
}

/**
 * Validate the mark read request
 */
function validateRequest(request: MarkReadRequest): string | null {
  if (!request.notificationId) {
    return 'notificationId is required';
  }
  if (!request.recipientId) {
    return 'recipientId is required';
  }
  if (!request.channel) {
    return 'channel is required';
  }
  if (!request.readSource) {
    return 'readSource is required';
  }

  const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];
  if (!validChannels.includes(request.channel)) {
    return `Invalid channel. Must be one of: ${validChannels.join(', ')}`;
  }

  const validSources: ReadSource[] = [
    'WEB_APP',
    'MOBILE_APP',
    'EMAIL_PIXEL',
    'EMAIL_LINK',
    'PUSH_OPEN',
    'API',
    'SYSTEM',
  ];
  if (!validSources.includes(request.readSource)) {
    return `Invalid readSource. Must be one of: ${validSources.join(', ')}`;
  }

  return null;
}

