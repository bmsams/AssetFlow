/**
 * Sync SaaS Usage Lambda Handler
 *
 * Syncs usage data from vendor portals (Adobe, Salesforce) for SaaS subscriptions.
 * Tracks subscription details including seats, costs, and user activity.
 *
 * Requirements: 4.11, 4.12, 4.13
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type { CreateSubscriptionRequest, SubscriptionStatus, VendorName } from '../saas-license/saas-license-repository';
import * as saasLicenseService from '../saas-license/saas-license-service';

const logger = createLogger({ service: 'sync-saas-usage-handler' });

/**
 * Lambda handler for syncing SaaS usage data from vendor portal
 *
 * POST /saas-licenses/{subscriptionId}/sync
 *
 * Requirement 4.11: Connect to vendor portals to sync subscription usage data
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const subscriptionId = event.pathParameters?.['subscriptionId'];

  logger.info('Sync SaaS usage request received', { requestId, subscriptionId });

  try {
    if (!subscriptionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'subscriptionId is required', requestId)
      );
    }

    const uuidError = validateUUID(subscriptionId, 'subscriptionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }


    logger.info('Syncing SaaS usage from vendor portal', {
      requestId,
      subscriptionId,
    });

    const result = await saasLicenseService.syncSaaSUsage(subscriptionId);

    logger.info('SaaS usage sync completed', {
      requestId,
      subscriptionId,
      syncId: result.syncId,
      usersProcessed: result.usersProcessed,
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(result, requestId));
  } catch (error) {
    const err = error as Error;

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('no vendor portal ID')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    logger.error('Failed to sync SaaS usage', err, { requestId, subscriptionId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to sync SaaS usage',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for creating a new SaaS subscription
 *
 * POST /saas-licenses
 * Body: CreateSubscriptionRequest
 */
export async function createSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Create SaaS subscription request received', { requestId });

  try {
    if (!event.body) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Request body is required', requestId)
      );
    }

    let request: CreateSubscriptionRequest;
    try {
      request = JSON.parse(event.body) as CreateSubscriptionRequest;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }


    // Validate required fields
    const validVendors: VendorName[] = ['ADOBE', 'SALESFORCE', 'MICROSOFT', 'GOOGLE', 'OTHER'];
    if (!request.vendorName || !validVendors.includes(request.vendorName)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `vendorName must be one of: ${validVendors.join(', ')}`,
          requestId
        )
      );
    }

    if (!request.productName || typeof request.productName !== 'string') {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'productName is required', requestId)
      );
    }

    const validTypes = ['ANNUAL', 'MONTHLY', 'MULTI_YEAR'];
    if (!request.subscriptionType || !validTypes.includes(request.subscriptionType)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `subscriptionType must be one of: ${validTypes.join(', ')}`,
          requestId
        )
      );
    }

    if (typeof request.totalSeats !== 'number' || request.totalSeats < 1) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'totalSeats must be a positive number', requestId)
      );
    }

    if (typeof request.costPerSeat !== 'number' || request.costPerSeat < 0) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'costPerSeat must be a non-negative number', requestId)
      );
    }

    if (!request.startDate || !request.renewalDate) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'startDate and renewalDate are required', requestId)
      );
    }

    logger.info('Creating SaaS subscription', {
      requestId,
      vendorName: request.vendorName,
      productName: request.productName,
    });

    const subscription = await saasLicenseService.createSubscription(request);

    logger.info('SaaS subscription created', {
      requestId,
      subscriptionId: subscription.subscriptionId,
    });

    return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(subscription, requestId));
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to create SaaS subscription', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to create SaaS subscription',
        requestId
      )
    );
  }
}


/**
 * Lambda handler for getting a SaaS subscription
 *
 * GET /saas-licenses/{subscriptionId}
 */
export async function getSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const subscriptionId = event.pathParameters?.['subscriptionId'];

  logger.info('Get SaaS subscription request received', { requestId, subscriptionId });

  try {
    if (!subscriptionId) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'subscriptionId is required', requestId)
      );
    }

    const uuidError = validateUUID(subscriptionId, 'subscriptionId');
    if (uuidError) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
      );
    }

    const subscription = await saasLicenseService.getSubscription(subscriptionId);

    if (!subscription) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          `SaaS subscription not found: ${subscriptionId}`,
          requestId
        )
      );
    }

    // Get usage records and notifications
    const usageRecords = await saasLicenseService.getUsageRecords(subscriptionId);
    const notifications = await saasLicenseService.getNotificationsBySubscription(subscriptionId);

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          subscription,
          usageRecords,
          notifications,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to get SaaS subscription', err, { requestId, subscriptionId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to get SaaS subscription',
        requestId
      )
    );
  }
}


/**
 * Lambda handler for listing SaaS subscriptions
 *
 * GET /saas-licenses
 * Query params: vendorName (optional), status (optional), limit (optional)
 */
export async function listSubscriptionsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('List SaaS subscriptions request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const vendorName = queryParams['vendorName'] as VendorName | undefined;
    const status = queryParams['status'] as SubscriptionStatus | undefined;
    const limit = queryParams['limit'] ? parseInt(queryParams['limit'], 10) : 100;

    // Validate vendorName if provided
    const validVendors: VendorName[] = ['ADOBE', 'SALESFORCE', 'MICROSOFT', 'GOOGLE', 'OTHER'];
    if (vendorName && !validVendors.includes(vendorName)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `vendorName must be one of: ${validVendors.join(', ')}`,
          requestId
        )
      );
    }

    // Validate status if provided
    const validStatuses: SubscriptionStatus[] = ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'CANCELLED'];
    if (status && !validStatuses.includes(status)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          `status must be one of: ${validStatuses.join(', ')}`,
          requestId
        )
      );
    }

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'limit must be a number between 1 and 1000',
          requestId
        )
      );
    }

    const subscriptions = await saasLicenseService.getSubscriptions(vendorName, status, limit);
    const summary = await saasLicenseService.getSubscriptionSummary();

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          items: subscriptions,
          count: subscriptions.length,
          summary,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to list SaaS subscriptions', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to list SaaS subscriptions',
        requestId
      )
    );
  }
}


/**
 * Lambda handler for checking and generating renewal notifications
 *
 * POST /saas-licenses/check-renewals
 *
 * Requirement 4.13: Track subscription renewal dates and send advance notifications
 */
export async function checkRenewalsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check renewals request received', { requestId });

  try {
    const notifications = await saasLicenseService.checkRenewalNotifications();

    logger.info('Renewal check completed', {
      requestId,
      notificationsGenerated: notifications.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          notificationsGenerated: notifications.length,
          notifications,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check renewals', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to check renewals',
        requestId
      )
    );
  }
}

/**
 * Lambda handler for sending pending renewal notifications
 *
 * POST /saas-licenses/send-notifications
 *
 * Requirement 4.13: Send advance notifications
 */
export async function sendNotificationsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Send notifications request received', { requestId });

  try {
    const sentNotifications = await saasLicenseService.sendPendingNotifications();

    logger.info('Notifications sent', {
      requestId,
      notificationsSent: sentNotifications.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(
        {
          notificationsSent: sentNotifications.length,
          notifications: sentNotifications,
        },
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to send notifications', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to send notifications',
        requestId
      )
    );
  }
}