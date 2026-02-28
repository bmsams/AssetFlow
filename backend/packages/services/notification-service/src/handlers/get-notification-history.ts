/**
 * Get Notification History Handler
 *
 * Lambda handler for querying notification history for audit purposes.
 *
 * Requirements:
 * - 17.8: Log notification history for audit
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import type { NotificationHistoryQuery } from '../tracking/tracking-types';
import * as trackingService from '../tracking/tracking-service';
import type { NotificationChannel, NotificationEventType, NotificationStatus } from '../notification/notification-types';
import type { DeliveryStatus } from '../tracking/tracking-types';

const logger = createLogger({ service: 'get-notification-history-handler' });

/**
 * Lambda handler for querying notification history
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Get notification history request received', {
    requestId,
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    // Parse query parameters
    const query = parseQueryParameters(event.queryStringParameters ?? {});

    // Validate query
    const validationError = validateQuery(query);
    if (validationError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, validationError, requestId)
      );
    }

    // Query notification history
    const result = await trackingService.queryNotificationHistory(query);

    logger.info('Notification history retrieved', {
      requestId,
      total: result.total,
      page: result.page,
      entriesReturned: result.entries.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get notification history', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Internal server error', requestId)
    );
  }
}

/**
 * Parse query string parameters into NotificationHistoryQuery
 */
function parseQueryParameters(
  params: Record<string, string | undefined>
): NotificationHistoryQuery {
  const query: NotificationHistoryQuery = {};

  if (params['recipientId']) {
    (query as { recipientId?: string }).recipientId = params['recipientId'];
  }
  if (params['channel']) {
    (query as { channel?: NotificationChannel }).channel = params['channel'] as NotificationChannel;
  }
  if (params['eventType']) {
    (query as { eventType?: NotificationEventType }).eventType = params['eventType'] as NotificationEventType;
  }
  if (params['status']) {
    (query as { status?: NotificationStatus }).status = params['status'] as NotificationStatus;
  }
  if (params['deliveryStatus']) {
    (query as { deliveryStatus?: DeliveryStatus }).deliveryStatus = params['deliveryStatus'] as DeliveryStatus;
  }
  if (params['fromDate']) {
    (query as { fromDate?: string }).fromDate = params['fromDate'];
  }
  if (params['toDate']) {
    (query as { toDate?: string }).toDate = params['toDate'];
  }
  if (params['page']) {
    (query as { page?: number }).page = parseInt(params['page'], 10);
  }
  if (params['limit']) {
    (query as { limit?: number }).limit = parseInt(params['limit'], 10);
  }
  if (params['sortBy']) {
    (query as { sortBy?: 'createdAt' | 'sentAt' | 'deliveredAt' | 'readAt' }).sortBy = params['sortBy'] as 'createdAt' | 'sentAt' | 'deliveredAt' | 'readAt';
  }
  if (params['sortOrder']) {
    (query as { sortOrder?: 'asc' | 'desc' }).sortOrder = params['sortOrder'] as 'asc' | 'desc';
  }

  return query;
}

/**
 * Validate the query parameters
 */
function validateQuery(query: NotificationHistoryQuery): string | null {
  // Validate channel if provided
  if (query.channel) {
    const validChannels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];
    if (!validChannels.includes(query.channel)) {
      return `Invalid channel. Must be one of: ${validChannels.join(', ')}`;
    }
  }

  // Validate status if provided
  if (query.status) {
    const validStatuses: NotificationStatus[] = [
      'PENDING',
      'SENDING',
      'DELIVERED',
      'FAILED',
      'READ',
      'BOUNCED',
    ];
    if (!validStatuses.includes(query.status)) {
      return `Invalid status. Must be one of: ${validStatuses.join(', ')}`;
    }
  }

  // Validate delivery status if provided
  if (query.deliveryStatus) {
    const validDeliveryStatuses: DeliveryStatus[] = [
      'QUEUED',
      'SENDING',
      'SENT',
      'DELIVERED',
      'FAILED',
      'BOUNCED',
      'REJECTED',
      'EXPIRED',
    ];
    if (!validDeliveryStatuses.includes(query.deliveryStatus)) {
      return `Invalid deliveryStatus. Must be one of: ${validDeliveryStatuses.join(', ')}`;
    }
  }

  // Validate sortBy if provided
  if (query.sortBy) {
    const validSortFields = ['createdAt', 'sentAt', 'deliveredAt', 'readAt'];
    if (!validSortFields.includes(query.sortBy)) {
      return `Invalid sortBy. Must be one of: ${validSortFields.join(', ')}`;
    }
  }

  // Validate sortOrder if provided
  if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) {
    return 'Invalid sortOrder. Must be "asc" or "desc"';
  }

  // Validate page and limit
  if (query.page !== undefined && (isNaN(query.page) || query.page < 1)) {
    return 'page must be a positive integer';
  }
  if (query.limit !== undefined && (isNaN(query.limit) || query.limit < 1 || query.limit > 100)) {
    return 'limit must be between 1 and 100';
  }

  // Validate date formats
  if (query.fromDate && !isValidISODate(query.fromDate)) {
    return 'fromDate must be a valid ISO 8601 date string';
  }
  if (query.toDate && !isValidISODate(query.toDate)) {
    return 'toDate must be a valid ISO 8601 date string';
  }

  return null;
}

/**
 * Check if a string is a valid ISO 8601 date
 */
function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

