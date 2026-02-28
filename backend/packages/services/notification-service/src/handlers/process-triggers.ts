/**
 * Process Triggers Lambda Handler
 *
 * Scheduled Lambda handler for processing notification triggers.
 * Designed to be invoked by CloudWatch Events/EventBridge on a schedule.
 *
 * Requirements:
 * - 17.3: Contract expiration notifications at 90, 60, 30 days
 * - 17.4: Loaner overdue escalating reminders
 * - 17.5: Stock level alerts when inventory falls below threshold
 * - 17.6: Compliance alerts for license violations
 */

import type { ScheduledEvent, Context } from 'aws-lambda';
import { createLogger } from '@ams/utils';

import {
  initializeTriggerService,
  processAllTriggers,
  processContractExpirationTriggers,
  processLoanerOverdueTriggers,
  processStockLevelTriggers,
  processComplianceAlertTriggers,
} from '../triggers/trigger-service';
import type {
  TriggerCheckResponse,
  TriggerType,
} from '../triggers/trigger-types';

const logger = createLogger({ service: 'process-triggers-handler' });

// ============================================================================
// Types
// ============================================================================

/**
 * Custom event detail for trigger processing
 */
interface TriggerEventDetail {
  readonly triggerTypes?: TriggerType[];
  readonly limit?: number;
  readonly dryRun?: boolean;
}

/**
 * Handler response
 */
interface ProcessTriggersResponse {
  readonly statusCode: number;
  readonly body: TriggerCheckResponse;
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Main Lambda handler for processing notification triggers
 *
 * Can be invoked:
 * 1. On a schedule (CloudWatch Events) - processes all trigger types
 * 2. Manually with specific trigger types via event detail
 *
 * @param event - CloudWatch Scheduled Event or custom event
 * @param context - Lambda context
 * @returns Processing results
 */
export async function handler(
  event: ScheduledEvent | { detail?: TriggerEventDetail },
  context: Context
): Promise<ProcessTriggersResponse> {
  const requestId = context.awsRequestId;

  logger.info('Processing triggers started', {
    requestId,
    remainingTimeMs: context.getRemainingTimeInMillis(),
  });

  try {
    // Initialize service with environment configuration
    initializeTriggerService({
      dryRunMode: process.env['DRY_RUN_MODE'] === 'true',
      maxTriggersPerBatch: parseInt(process.env['MAX_TRIGGERS_PER_BATCH'] ?? '100', 10),
      stockLevelCooldownMinutes: parseInt(process.env['STOCK_COOLDOWN_MINUTES'] ?? '60', 10),
      complianceAlertCooldownMinutes: parseInt(process.env['COMPLIANCE_COOLDOWN_MINUTES'] ?? '240', 10),
    });

    // Extract trigger configuration from event detail if present
    const detail = (event as { detail?: TriggerEventDetail }).detail;
    const triggerTypes = detail?.triggerTypes;
    const limit = detail?.limit;
    const dryRun = detail?.dryRun;

    // Process triggers
    const result = await processAllTriggers({
      triggerTypes,
      limit,
      dryRun,
    });

    logger.info('Processing triggers completed', {
      requestId,
      totalNotificationsSent: result.totalNotificationsSent,
      totalErrors: result.totalErrors,
    });

    return {
      statusCode: 200,
      body: result,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Processing triggers failed', err, { requestId });

    return {
      statusCode: 500,
      body: {
        checkedAt: new Date().toISOString(),
        results: [],
        totalNotificationsSent: 0,
        totalErrors: 1,
      },
    };
  }
}

// ============================================================================
// Individual Trigger Handlers
// ============================================================================

/**
 * Handler for processing only contract expiration triggers
 */
export async function handleContractExpirations(
  event: { detail?: { limit?: number; dryRun?: boolean } },
  context: Context
): Promise<ProcessTriggersResponse> {
  const requestId = context.awsRequestId;

  logger.info('Processing contract expiration triggers', { requestId });

  try {
    initializeTriggerService({
      dryRunMode: process.env['DRY_RUN_MODE'] === 'true',
    });

    const result = await processContractExpirationTriggers(
      event.detail?.limit,
      event.detail?.dryRun
    );

    return {
      statusCode: 200,
      body: {
        checkedAt: new Date().toISOString(),
        results: [result],
        totalNotificationsSent: result.notificationsSent,
        totalErrors: result.errors,
      },
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Contract expiration processing failed', err, { requestId });

    return {
      statusCode: 500,
      body: {
        checkedAt: new Date().toISOString(),
        results: [],
        totalNotificationsSent: 0,
        totalErrors: 1,
      },
    };
  }
}

/**
 * Handler for processing only loaner overdue triggers
 */
export async function handleLoanerOverdues(
  event: { detail?: { limit?: number; dryRun?: boolean } },
  context: Context
): Promise<ProcessTriggersResponse> {
  const requestId = context.awsRequestId;

  logger.info('Processing loaner overdue triggers', { requestId });

  try {
    initializeTriggerService({
      dryRunMode: process.env['DRY_RUN_MODE'] === 'true',
    });

    const result = await processLoanerOverdueTriggers(
      event.detail?.limit,
      event.detail?.dryRun
    );

    return {
      statusCode: 200,
      body: {
        checkedAt: new Date().toISOString(),
        results: [result],
        totalNotificationsSent: result.notificationsSent,
        totalErrors: result.errors,
      },
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Loaner overdue processing failed', err, { requestId });

    return {
      statusCode: 500,
      body: {
        checkedAt: new Date().toISOString(),
        results: [],
        totalNotificationsSent: 0,
        totalErrors: 1,
      },
    };
  }
}

/**
 * Handler for processing only stock level triggers
 */
export async function handleStockLevels(
  event: { detail?: { limit?: number; dryRun?: boolean } },
  context: Context
): Promise<ProcessTriggersResponse> {
  const requestId = context.awsRequestId;

  logger.info('Processing stock level triggers', { requestId });

  try {
    initializeTriggerService({
      dryRunMode: process.env['DRY_RUN_MODE'] === 'true',
    });

    const result = await processStockLevelTriggers(
      event.detail?.limit,
      event.detail?.dryRun
    );

    return {
      statusCode: 200,
      body: {
        checkedAt: new Date().toISOString(),
        results: [result],
        totalNotificationsSent: result.notificationsSent,
        totalErrors: result.errors,
      },
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Stock level processing failed', err, { requestId });

    return {
      statusCode: 500,
      body: {
        checkedAt: new Date().toISOString(),
        results: [],
        totalNotificationsSent: 0,
        totalErrors: 1,
      },
    };
  }
}

/**
 * Handler for processing only compliance alert triggers
 */
export async function handleComplianceAlerts(
  event: { detail?: { limit?: number; dryRun?: boolean } },
  context: Context
): Promise<ProcessTriggersResponse> {
  const requestId = context.awsRequestId;

  logger.info('Processing compliance alert triggers', { requestId });

  try {
    initializeTriggerService({
      dryRunMode: process.env['DRY_RUN_MODE'] === 'true',
    });

    const result = await processComplianceAlertTriggers(
      event.detail?.limit,
      event.detail?.dryRun
    );

    return {
      statusCode: 200,
      body: {
        checkedAt: new Date().toISOString(),
        results: [result],
        totalNotificationsSent: result.notificationsSent,
        totalErrors: result.errors,
      },
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Compliance alert processing failed', err, { requestId });

    return {
      statusCode: 500,
      body: {
        checkedAt: new Date().toISOString(),
        results: [],
        totalNotificationsSent: 0,
        totalErrors: 1,
      },
    };
  }
}
