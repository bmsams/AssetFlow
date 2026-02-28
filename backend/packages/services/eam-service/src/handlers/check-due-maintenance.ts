/**
 * Check Due Maintenance Lambda Handler
 *
 * Checks for maintenance plans that are due and optionally generates work orders.
 * Requirements: 5.1, 5.2
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as maintenanceService from '../maintenance/maintenance-service';

const logger = createLogger({ service: 'check-due-maintenance-handler' });

export async function handler(event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Check due maintenance request received', { requestId });

  try {
    const asOfDate = event.queryStringParameters?.['asOfDate'];
    const generateWorkOrders = event.queryStringParameters?.['generateWorkOrders'] === 'true';
    const daysAhead = parseInt(event.queryStringParameters?.['daysAhead'] ?? '7', 10);

    // Validate asOfDate format if provided
    if (asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'asOfDate must be in YYYY-MM-DD format',
          requestId
        )
      );
    }

    if (generateWorkOrders) {
      // Generate work orders for due maintenance
      const result = await maintenanceService.generateWorkOrders(asOfDate, userId);

      logger.info('Work orders generated', {
        requestId,
        plansProcessed: result.plansProcessed,
        workOrdersCreated: result.workOrdersCreated.length,
        errors: result.errors.length,
      });

      return createLambdaResponse(
        HTTP_STATUS.OK,
        createApiResponse({
          plansProcessed: result.plansProcessed,
          workOrdersCreated: result.workOrdersCreated,
          errors: result.errors,
        }, requestId)
      );
    }

    // Just check for due maintenance without generating work orders
    const dueItems = await maintenanceService.checkDueMaintenance(asOfDate);
    const upcomingPlans = await maintenanceService.getUpcomingMaintenance(daysAhead);

    logger.info('Due maintenance check complete', {
      requestId,
      dueCount: dueItems.length,
      upcomingCount: upcomingPlans.length,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        due: dueItems,
        upcoming: upcomingPlans,
        summary: {
          totalDue: dueItems.length,
          overdue: dueItems.filter(i => i.isOverdue).length,
          critical: dueItems.filter(i => i.isCritical).length,
          upcomingCount: upcomingPlans.length,
        },
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check due maintenance', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check due maintenance', requestId)
    );
  }
}
