/**
 * Get User Preferences Lambda Handler
 *
 * Retrieves notification preferences for a user.
 *
 * Requirements:
 * - 17.2: Allow users to configure notification preferences per event type
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import * as preferencesService from '../preferences/preferences-service';

const logger = createLogger({ service: 'get-preferences-handler' });

/**
 * Lambda handler for getting user notification preferences
 *
 * GET /users/{userId}/notification-preferences
 *
 * Returns the user's notification preferences, creating defaults if none exist.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const authenticatedUserId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Get preferences request received', { requestId });

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

    // Authorization check: users can only access their own preferences
    // unless they have admin role
    const isAdmin = event.requestContext.authorizer?.['claims']?.['custom:role'] === 'ADMIN';
    if (!isAdmin && authenticatedUserId !== userId) {
      logger.warn('Unauthorized access attempt to preferences', {
        requestId,
        authenticatedUserId,
        requestedUserId: userId,
      });

      return createLambdaResponse(
        HTTP_STATUS.FORBIDDEN,
        createErrorResponse(
          API_ERROR_CODES.FORBIDDEN,
          'You can only access your own notification preferences',
          requestId
        )
      );
    }

    // Get preferences
    const preferences = await preferencesService.getUserPreferences(userId);

    logger.info('Preferences retrieved successfully', {
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
    logger.error('Failed to get preferences', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to retrieve notification preferences',
        requestId
      )
    );
  }
}
