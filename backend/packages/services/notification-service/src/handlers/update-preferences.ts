/**
 * Update User Preferences Lambda Handler
 *
 * Updates notification preferences for a user.
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 * - 17.9: Implement notification batching to prevent alert fatigue
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { NotificationChannel, NotificationEventType } from '../notification/notification-types';
import type {
  BatchingConfigUpdate,
  ChannelPreferenceUpdate,
  DigestFormat,
  EventTypePreferenceUpdate,
  NotificationFrequency,
  QuietHoursUpdate,
  UpdatePreferencesRequest,
} from '../preferences/preferences-types';
import * as preferencesService from '../preferences/preferences-service';

const logger = createLogger({ service: 'update-preferences-handler' });

/**
 * Valid notification frequencies
 */
const VALID_FREQUENCIES: NotificationFrequency[] = [
  'IMMEDIATE',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'DISABLED',
];

/**
 * Valid notification channels
 */
const VALID_CHANNELS: NotificationChannel[] = ['EMAIL', 'IN_APP', 'SMS', 'PUSH'];

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
 * Valid digest formats
 */
const VALID_DIGEST_FORMATS: DigestFormat[] = ['SUMMARY', 'DETAILED', 'COMPACT'];

/**
 * Request body interface
 */
interface UpdatePreferencesBody {
  globalEnabled?: boolean;
  defaultFrequency?: string;
  defaultChannels?: string[];
  eventPreferences?: Array<{
    eventType: string;
    enabled?: boolean;
    channels?: Array<{
      channel: string;
      enabled?: boolean;
      frequency?: string;
    }>;
  }>;
  quietHours?: {
    enabled?: boolean;
    startTime?: string;
    endTime?: string;
    timezone?: string;
    daysOfWeek?: number[];
  };
  batchingConfig?: {
    enabled?: boolean;
    maxBatchSize?: number;
    maxBatchWaitMinutes?: number;
    groupByEventType?: boolean;
    digestFormat?: string;
  };
}

/**
 * Validate request body
 */
function validateRequest(
  userId: string,
  body: unknown
): { valid: true; data: UpdatePreferencesRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as UpdatePreferencesBody;
  const errors: string[] = [];

  // Validate globalEnabled
  if (request.globalEnabled !== undefined && typeof request.globalEnabled !== 'boolean') {
    errors.push('globalEnabled must be a boolean');
  }

  // Validate defaultFrequency
  if (request.defaultFrequency !== undefined) {
    if (typeof request.defaultFrequency !== 'string') {
      errors.push('defaultFrequency must be a string');
    } else if (!VALID_FREQUENCIES.includes(request.defaultFrequency as NotificationFrequency)) {
      errors.push(`Invalid defaultFrequency: ${request.defaultFrequency}. Valid values: ${VALID_FREQUENCIES.join(', ')}`);
    }
  }

  // Validate defaultChannels
  if (request.defaultChannels !== undefined) {
    if (!Array.isArray(request.defaultChannels)) {
      errors.push('defaultChannels must be an array');
    } else {
      for (const channel of request.defaultChannels) {
        if (!VALID_CHANNELS.includes(channel as NotificationChannel)) {
          errors.push(`Invalid channel in defaultChannels: ${channel}. Valid values: ${VALID_CHANNELS.join(', ')}`);
        }
      }
    }
  }

  // Validate eventPreferences
  const eventPreferences: EventTypePreferenceUpdate[] = [];
  if (request.eventPreferences !== undefined) {
    if (!Array.isArray(request.eventPreferences)) {
      errors.push('eventPreferences must be an array');
    } else {
      for (let i = 0; i < request.eventPreferences.length; i++) {
        const ep = request.eventPreferences[i];
        if (!ep) continue;

        if (!ep.eventType) {
          errors.push(`eventPreferences[${i}].eventType is required`);
          continue;
        }

        if (!VALID_EVENT_TYPES.includes(ep.eventType as NotificationEventType)) {
          errors.push(`Invalid eventType at eventPreferences[${i}]: ${ep.eventType}`);
          continue;
        }

        if (ep.enabled !== undefined && typeof ep.enabled !== 'boolean') {
          errors.push(`eventPreferences[${i}].enabled must be a boolean`);
        }

        const channels: ChannelPreferenceUpdate[] = [];
        if (ep.channels !== undefined) {
          if (!Array.isArray(ep.channels)) {
            errors.push(`eventPreferences[${i}].channels must be an array`);
          } else {
            for (let j = 0; j < ep.channels.length; j++) {
              const cp = ep.channels[j];
              if (!cp) continue;

              if (!cp.channel) {
                errors.push(`eventPreferences[${i}].channels[${j}].channel is required`);
                continue;
              }

              if (!VALID_CHANNELS.includes(cp.channel as NotificationChannel)) {
                errors.push(`Invalid channel at eventPreferences[${i}].channels[${j}]: ${cp.channel}`);
                continue;
              }

              if (cp.enabled !== undefined && typeof cp.enabled !== 'boolean') {
                errors.push(`eventPreferences[${i}].channels[${j}].enabled must be a boolean`);
              }

              if (cp.frequency !== undefined) {
                if (!VALID_FREQUENCIES.includes(cp.frequency as NotificationFrequency)) {
                  errors.push(`Invalid frequency at eventPreferences[${i}].channels[${j}]: ${cp.frequency}`);
                }
              }

              channels.push({
                channel: cp.channel as NotificationChannel,
                enabled: cp.enabled,
                frequency: cp.frequency as NotificationFrequency | undefined,
              });
            }
          }
        }

        eventPreferences.push({
          eventType: ep.eventType as NotificationEventType,
          enabled: ep.enabled,
          channels: channels.length > 0 ? channels : undefined,
        });
      }
    }
  }

  // Validate quietHours
  let quietHours: QuietHoursUpdate | undefined;
  if (request.quietHours !== undefined) {
    if (typeof request.quietHours !== 'object' || request.quietHours === null) {
      errors.push('quietHours must be an object');
    } else {
      const qh = request.quietHours;

      if (qh.enabled !== undefined && typeof qh.enabled !== 'boolean') {
        errors.push('quietHours.enabled must be a boolean');
      }

      if (qh.startTime !== undefined) {
        if (typeof qh.startTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(qh.startTime)) {
          errors.push('quietHours.startTime must be in HH:MM format (24-hour)');
        }
      }

      if (qh.endTime !== undefined) {
        if (typeof qh.endTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(qh.endTime)) {
          errors.push('quietHours.endTime must be in HH:MM format (24-hour)');
        }
      }

      if (qh.timezone !== undefined && typeof qh.timezone !== 'string') {
        errors.push('quietHours.timezone must be a string');
      }

      if (qh.daysOfWeek !== undefined) {
        if (!Array.isArray(qh.daysOfWeek)) {
          errors.push('quietHours.daysOfWeek must be an array');
        } else {
          for (const day of qh.daysOfWeek) {
            if (typeof day !== 'number' || day < 0 || day > 6) {
              errors.push('quietHours.daysOfWeek must contain numbers 0-6 (Sunday-Saturday)');
              break;
            }
          }
        }
      }

      quietHours = {
        enabled: qh.enabled,
        startTime: qh.startTime,
        endTime: qh.endTime,
        timezone: qh.timezone,
        daysOfWeek: qh.daysOfWeek,
      };
    }
  }

  // Validate batchingConfig
  let batchingConfig: BatchingConfigUpdate | undefined;
  if (request.batchingConfig !== undefined) {
    if (typeof request.batchingConfig !== 'object' || request.batchingConfig === null) {
      errors.push('batchingConfig must be an object');
    } else {
      const bc = request.batchingConfig;

      if (bc.enabled !== undefined && typeof bc.enabled !== 'boolean') {
        errors.push('batchingConfig.enabled must be a boolean');
      }

      if (bc.maxBatchSize !== undefined) {
        if (typeof bc.maxBatchSize !== 'number' || bc.maxBatchSize < 1) {
          errors.push('batchingConfig.maxBatchSize must be a positive number');
        }
      }

      if (bc.maxBatchWaitMinutes !== undefined) {
        if (typeof bc.maxBatchWaitMinutes !== 'number' || bc.maxBatchWaitMinutes < 1) {
          errors.push('batchingConfig.maxBatchWaitMinutes must be a positive number');
        }
      }

      if (bc.groupByEventType !== undefined && typeof bc.groupByEventType !== 'boolean') {
        errors.push('batchingConfig.groupByEventType must be a boolean');
      }

      if (bc.digestFormat !== undefined) {
        if (!VALID_DIGEST_FORMATS.includes(bc.digestFormat as DigestFormat)) {
          errors.push(`Invalid batchingConfig.digestFormat: ${bc.digestFormat}. Valid values: ${VALID_DIGEST_FORMATS.join(', ')}`);
        }
      }

      batchingConfig = {
        enabled: bc.enabled,
        maxBatchSize: bc.maxBatchSize,
        maxBatchWaitMinutes: bc.maxBatchWaitMinutes,
        groupByEventType: bc.groupByEventType,
        digestFormat: bc.digestFormat as DigestFormat | undefined,
      };
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      userId,
      globalEnabled: request.globalEnabled,
      defaultFrequency: request.defaultFrequency as NotificationFrequency | undefined,
      defaultChannels: request.defaultChannels as NotificationChannel[] | undefined,
      eventPreferences: eventPreferences.length > 0 ? eventPreferences : undefined,
      quietHours,
      batchingConfig,
    },
  };
}

/**
 * Lambda handler for updating user notification preferences
 *
 * PUT /users/{userId}/notification-preferences
 *
 * Updates the user's notification preferences with the provided values.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const authenticatedUserId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Update preferences request received', { requestId });

  try {
    // Get userId from path parameters
    const userId = event.pathParameters?.['userId'];

    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'userId path parameter is required',
          requestId
        )
      );
    }

    // Validate userId format
    const uuidError = validateUUID(userId, 'userId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          uuidError.message,
          requestId
        )
      );
    }

    // Authorization check: users can only update their own preferences
    // unless they have admin role
    const isAdmin = event.requestContext.authorizer?.['claims']?.['custom:role'] === 'ADMIN';
    if (!isAdmin && authenticatedUserId !== userId) {
      logger.warn('Unauthorized update attempt to preferences', {
        requestId,
        authenticatedUserId,
        requestedUserId: userId,
      });

      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          'You can only update your own notification preferences',
          requestId
        )
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          'Invalid JSON in request body',
          requestId
        )
      );
    }

    // Validate request
    const validation = validateRequest(userId, body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map((msg) => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Update preferences
    const preferences = await preferencesService.updatePreferences(validation.data);

    logger.info('Preferences updated successfully', {
      requestId,
      userId,
      preferencesId: preferences.preferencesId,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(preferences, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to update preferences', err, { requestId });

    // Handle validation errors from service
    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          err.message,
          requestId
        )
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to update notification preferences',
        requestId
      )
    );
  }
}
