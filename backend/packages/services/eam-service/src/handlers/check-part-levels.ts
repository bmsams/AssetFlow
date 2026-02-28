/**
 * Check Part Levels Lambda Handler
 *
 * Checks spare parts inventory levels and generates replenishment alerts
 * for parts that are at or below their reorder point.
 * Requirements: 5.4, 5.5
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as partsInventoryService from '../parts-inventory/parts-inventory-service';

const logger = createLogger({ service: 'check-part-levels-handler' });

/**
 * Lambda handler for checking part levels
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  logger.info('Check part levels request received', { requestId });

  try {
    // Check query parameters for filtering options
    const criticalOnly = event.queryStringParameters?.['criticalOnly'] === 'true';

    let alerts;
    if (criticalOnly) {
      // Get only critical parts with low stock
      const criticalParts = await partsInventoryService.getCriticalPartsLowStock();
      alerts = criticalParts.map((part, index) => ({
        alertId: `REPL-${Date.now()}-${index}`,
        partId: part.partId,
        partNumber: part.partNumber,
        partName: part.partName,
        currentQuantity: part.quantityAvailable,
        reorderPoint: part.reorderPoint,
        quantityBelowReorder: part.reorderPoint - part.quantityAvailable,
        suggestedOrderQuantity: part.reorderQuantity ?? part.reorderPoint,
        unitCost: part.unitCost,
        estimatedOrderCost: part.unitCost 
          ? part.unitCost * (part.reorderQuantity ?? part.reorderPoint) 
          : null,
        isCritical: part.isCritical,
        preferredVendorId: part.preferredVendorId,
        createdAt: new Date().toISOString(),
      }));
    } else {
      // Get all parts below reorder point
      alerts = await partsInventoryService.checkPartLevels();
    }

    // Calculate summary statistics
    const summary = {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.isCritical).length,
      totalEstimatedCost: alerts.reduce((sum, a) => sum + (a.estimatedOrderCost ?? 0), 0),
      partsNeedingAttention: alerts.map(a => ({
        partId: a.partId,
        partNumber: a.partNumber,
        currentQuantity: a.currentQuantity,
        reorderPoint: a.reorderPoint,
        isCritical: a.isCritical,
      })),
    };

    logger.info('Part levels checked successfully', {
      requestId,
      totalAlerts: alerts.length,
      criticalAlerts: summary.criticalAlerts,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        alerts,
        summary,
        checkedAt: new Date().toISOString(),
      }, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to check part levels', err, { requestId });

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to check part levels', requestId)
    );
  }
}

/**
 * Scheduled handler for automated part level checks
 * Can be triggered by CloudWatch Events/EventBridge
 */
export async function scheduledHandler(): Promise<void> {
  logger.info('Scheduled part level check started');

  try {
    const alerts = await partsInventoryService.checkPartLevels();

    if (alerts.length > 0) {
      logger.warn('Parts below reorder point detected', {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.isCritical).length,
        parts: alerts.map(a => ({
          partNumber: a.partNumber,
          currentQuantity: a.currentQuantity,
          reorderPoint: a.reorderPoint,
          isCritical: a.isCritical,
        })),
      });

      // The service already publishes PARTS_REPLENISHMENT_NEEDED event
      // which can trigger notifications via SNS/SQS
    } else {
      logger.info('All parts above reorder point');
    }
  } catch (error) {
    const err = error as Error;
    logger.error('Scheduled part level check failed', err);
    throw err;
  }
}
