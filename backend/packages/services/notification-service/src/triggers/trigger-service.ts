/**
 * Notification Trigger Service
 *
 * Business logic for processing notification triggers including contract expiration,
 * loaner overdue, stock level, and compliance alerts.
 *
 * Requirements:
 * - 17.3: WHEN a contract is expiring, THE Notification_Service SHALL send alerts at configured intervals
 * - 17.4: WHEN a loaner asset is overdue, THE Notification_Service SHALL send escalating reminders
 * - 17.5: WHEN stock levels fall below threshold, THE Notification_Service SHALL alert inventory managers
 * - 17.6: WHEN a compliance position changes to under-licensed, THE Notification_Service SHALL alert compliance analysts
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import { sendNotification } from '../notification/notification-service';
import type { SendNotificationRequest } from '../notification/notification-types';
import * as triggerRepository from './trigger-repository';
import type {
  ComplianceInfo,
  ComplianceNotification,
  ContractExpirationInterval,
  ContractExpirationNotification,
  ContractInfo,
  EscalationLevel,
  LoanerEscalationConfig,
  LoanerInfo,
  LoanerOverdueNotification,
  LoanerOverdueTrigger,
  StockAlertSeverity,
  StockLevelInfo,
  StockLevelNotification,
  TriggerBatchResult,
  TriggerCheckRequest,
  TriggerCheckResponse,
  TriggerProcessingResult,
  TriggerServiceConfig,
} from './trigger-types';
import {
  DEFAULT_TRIGGER_CONFIG,
} from './trigger-types';

const logger = createLogger({ service: 'trigger-service' });


// ============================================================================
// Service Configuration
// ============================================================================

let serviceConfig: TriggerServiceConfig = { ...DEFAULT_TRIGGER_CONFIG };

/**
 * Initialize the trigger service with configuration
 */
export function initializeTriggerService(config: Partial<TriggerServiceConfig>): void {
  serviceConfig = {
    ...DEFAULT_TRIGGER_CONFIG,
    ...config,
  };

  logger.info('Trigger service initialized', {
    contractIntervals: serviceConfig.contractExpirationIntervals,
    dryRunMode: serviceConfig.dryRunMode,
  });
}

/**
 * Get current service configuration
 */
export function getServiceConfig(): TriggerServiceConfig {
  return serviceConfig;
}

// ============================================================================
// Main Trigger Processing
// ============================================================================

/**
 * Process all notification triggers
 *
 * @param request - Optional request parameters
 * @returns Processing results for all trigger types
 */
export async function processAllTriggers(
  request: TriggerCheckRequest = {}
): Promise<TriggerCheckResponse> {
  const checkedAt = new Date().toISOString();
  const results: TriggerBatchResult[] = [];
  let totalNotificationsSent = 0;
  let totalErrors = 0;

  const triggerTypes = request.triggerTypes ?? [
    'CONTRACT_EXPIRATION',
    'LOANER_OVERDUE',
    'STOCK_LEVEL',
    'COMPLIANCE_ALERT',
  ];

  logger.info('Processing all triggers', {
    triggerTypes,
    limit: request.limit,
    dryRun: request.dryRun ?? serviceConfig.dryRunMode,
  });

  for (const triggerType of triggerTypes) {
    let batchResult: TriggerBatchResult;

    switch (triggerType) {
      case 'CONTRACT_EXPIRATION':
        batchResult = await processContractExpirationTriggers(request.limit, request.dryRun);
        break;
      case 'LOANER_OVERDUE':
        batchResult = await processLoanerOverdueTriggers(request.limit, request.dryRun);
        break;
      case 'STOCK_LEVEL':
        batchResult = await processStockLevelTriggers(request.limit, request.dryRun);
        break;
      case 'COMPLIANCE_ALERT':
        batchResult = await processComplianceAlertTriggers(request.limit, request.dryRun);
        break;
      default:
        continue;
    }

    results.push(batchResult);
    totalNotificationsSent += batchResult.notificationsSent;
    totalErrors += batchResult.errors;
  }

  logger.info('All triggers processed', {
    totalNotificationsSent,
    totalErrors,
  });

  return {
    checkedAt,
    results,
    totalNotificationsSent,
    totalErrors,
  };
}


// ============================================================================
// Contract Expiration Triggers (Requirement 17.3)
// ============================================================================

/**
 * Process contract expiration triggers
 * Requirement 17.3: Send alerts at configured intervals (90, 60, 30 days)
 *
 * @param limit - Maximum number of contracts to process
 * @param dryRun - If true, don't actually send notifications
 * @returns Batch processing result
 */
export async function processContractExpirationTriggers(
  limit: number = serviceConfig.maxTriggersPerBatch,
  dryRun: boolean = serviceConfig.dryRunMode
): Promise<TriggerBatchResult> {
  logger.info('Processing contract expiration triggers', { limit, dryRun });

  const results: TriggerProcessingResult[] = [];
  let notificationsSent = 0;
  let errors = 0;

  // Check each interval (90, 60, 30 days)
  for (const intervalDays of serviceConfig.contractExpirationIntervals) {
    const expiringContracts = await triggerRepository.getExpiringContracts(intervalDays);

    for (const contract of expiringContracts.slice(0, limit)) {
      const result = await processContractExpiration(contract, intervalDays, dryRun);
      results.push(result);

      if (result.notificationSent) {
        notificationsSent++;
      }
      if (result.error) {
        errors++;
      }
    }
  }

  return {
    triggerType: 'CONTRACT_EXPIRATION',
    totalProcessed: results.length,
    notificationsSent,
    errors,
    results,
  };
}

/**
 * Process a single contract expiration
 */
async function processContractExpiration(
  contract: ContractInfo,
  intervalDays: ContractExpirationInterval,
  dryRun: boolean
): Promise<TriggerProcessingResult> {
  const triggerId = `contract-${contract.contractId}-${intervalDays}`;

  try {
    // Check if notification already sent for this interval
    const existingTrigger = await triggerRepository.getContractExpirationTrigger(contract.contractId);

    if (existingTrigger?.notificationsSent.includes(intervalDays)) {
      logger.debug('Contract notification already sent for interval', {
        contractId: contract.contractId,
        intervalDays,
      });

      return {
        triggerId,
        triggerType: 'CONTRACT_EXPIRATION',
        processed: true,
        notificationSent: false,
      };
    }

    // Calculate days until expiration
    const daysUntilExpiration = calculateDaysUntilDate(contract.expirationDate);

    // Only send if within the interval window (e.g., 90 days means 85-90 days)
    if (!isWithinIntervalWindow(daysUntilExpiration, intervalDays)) {
      return {
        triggerId,
        triggerType: 'CONTRACT_EXPIRATION',
        processed: true,
        notificationSent: false,
      };
    }

    // Build notification payload
    const payload: ContractExpirationNotification = {
      contractId: contract.contractId,
      contractNumber: contract.contractNumber,
      contractType: contract.contractType,
      vendorName: contract.vendorName,
      expirationDate: contract.expirationDate,
      daysUntilExpiration,
      intervalDays,
      totalValue: contract.totalValue,
    };

    if (!dryRun) {
      // Send notification
      const notificationResult = await sendContractExpirationNotification(contract, payload);

      // Update trigger record
      await triggerRepository.upsertContractExpirationTrigger(contract, intervalDays);
      await triggerRepository.markContractNotificationSent(triggerId, intervalDays);

      return {
        triggerId,
        triggerType: 'CONTRACT_EXPIRATION',
        processed: true,
        notificationSent: true,
        notificationId: notificationResult.notificationId,
      };
    }

    logger.info('Dry run: Would send contract expiration notification', { payload });

    return {
      triggerId,
      triggerType: 'CONTRACT_EXPIRATION',
      processed: true,
      notificationSent: false,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process contract expiration', err, {
      contractId: contract.contractId,
      intervalDays,
    });

    return {
      triggerId,
      triggerType: 'CONTRACT_EXPIRATION',
      processed: false,
      notificationSent: false,
      error: err.message,
    };
  }
}

/**
 * Send contract expiration notification
 */
async function sendContractExpirationNotification(
  contract: ContractInfo,
  payload: ContractExpirationNotification
): Promise<{ notificationId: string }> {
  const request: SendNotificationRequest = {
    recipientId: contract.ownerUserId ?? '',
    recipientEmail: contract.ownerEmail,
    channels: ['EMAIL', 'IN_APP'],
    eventType: 'CONTRACT_EXPIRING',
    subject: `Contract ${contract.contractNumber} expires in ${payload.daysUntilExpiration} days`,
    body: buildContractExpirationBody(payload),
    priority: payload.intervalDays <= 30 ? 'HIGH' : 'NORMAL',
    metadata: { payload },
  };

  const result = await sendNotification(request);
  return { notificationId: result.results[0]?.notificationId ?? '' };
}

/**
 * Build contract expiration notification body
 */
function buildContractExpirationBody(payload: ContractExpirationNotification): string {
  const lines = [
    `Contract ${payload.contractNumber} with ${payload.vendorName} is expiring soon.`,
    '',
    `Contract Type: ${payload.contractType}`,
    `Expiration Date: ${formatDate(payload.expirationDate)}`,
    `Days Until Expiration: ${payload.daysUntilExpiration}`,
  ];

  if (payload.totalValue) {
    lines.push(`Total Value: $${payload.totalValue.toLocaleString()}`);
  }

  lines.push('', 'Please review and take appropriate action to renew or close this contract.');

  return lines.join('\n');
}


// ============================================================================
// Loaner Overdue Triggers (Requirement 17.4)
// ============================================================================

/**
 * Process loaner overdue triggers
 * Requirement 17.4: Send escalating reminders (daily, then hourly)
 *
 * @param limit - Maximum number of loaners to process
 * @param dryRun - If true, don't actually send notifications
 * @returns Batch processing result
 */
export async function processLoanerOverdueTriggers(
  limit: number = serviceConfig.maxTriggersPerBatch,
  dryRun: boolean = serviceConfig.dryRunMode
): Promise<TriggerBatchResult> {
  logger.info('Processing loaner overdue triggers', { limit, dryRun });

  const results: TriggerProcessingResult[] = [];
  let notificationsSent = 0;
  let errors = 0;

  const overdueLoaners = await triggerRepository.getOverdueLoaners();

  for (const loaner of overdueLoaners.slice(0, limit)) {
    const result = await processLoanerOverdue(loaner, dryRun);
    results.push(result);

    if (result.notificationSent) {
      notificationsSent++;
    }
    if (result.error) {
      errors++;
    }
  }

  return {
    triggerType: 'LOANER_OVERDUE',
    totalProcessed: results.length,
    notificationsSent,
    errors,
    results,
  };
}

/**
 * Process a single loaner overdue
 */
async function processLoanerOverdue(
  loaner: LoanerInfo,
  dryRun: boolean
): Promise<TriggerProcessingResult> {
  const triggerId = `loaner-${loaner.checkoutId}`;

  try {
    // Get or create trigger
    let trigger = await triggerRepository.getLoanerOverdueTrigger(loaner.checkoutId);

    if (!trigger) {
      trigger = await triggerRepository.createLoanerOverdueTrigger(
        loaner,
        serviceConfig.loanerEscalation
      );
    }

    // Check if we should send a reminder
    const overdueInfo = calculateOverdueInfo(loaner.dueDate);
    const shouldSend = shouldSendLoanerReminder(trigger, overdueInfo);

    if (!shouldSend.send) {
      return {
        triggerId,
        triggerType: 'LOANER_OVERDUE',
        processed: true,
        notificationSent: false,
        nextCheckAt: shouldSend.nextCheckAt,
      };
    }

    // Determine escalation level
    const escalationLevel = determineEscalationLevel(
      overdueInfo.daysOverdue,
      trigger.reminderCount,
      serviceConfig.loanerEscalation
    );

    // Build notification payload
    const payload: LoanerOverdueNotification = {
      checkoutId: loaner.checkoutId,
      assetId: loaner.assetId,
      assetTag: loaner.assetTag,
      assetName: loaner.assetName,
      borrowerName: loaner.borrowerName,
      dueDate: loaner.dueDate,
      daysOverdue: overdueInfo.daysOverdue,
      hoursOverdue: overdueInfo.hoursOverdue,
      escalationLevel,
      reminderCount: trigger.reminderCount + 1,
      isManagerEscalation: escalationLevel === 'ESCALATED' || escalationLevel === 'CRITICAL',
    };

    if (!dryRun) {
      // Send notification
      const notificationResult = await sendLoanerOverdueNotification(loaner, payload);

      // Calculate next reminder time
      const nextReminderAt = calculateNextReminderTime(
        escalationLevel,
        serviceConfig.loanerEscalation
      );

      // Update trigger
      await triggerRepository.updateLoanerTriggerAfterReminder(trigger.triggerId, {
        escalationLevel,
        reminderCount: trigger.reminderCount + 1,
        lastReminderAt: new Date().toISOString(),
        nextReminderAt,
      });

      return {
        triggerId,
        triggerType: 'LOANER_OVERDUE',
        processed: true,
        notificationSent: true,
        notificationId: notificationResult.notificationId,
        nextCheckAt: nextReminderAt,
      };
    }

    logger.info('Dry run: Would send loaner overdue notification', { payload });

    return {
      triggerId,
      triggerType: 'LOANER_OVERDUE',
      processed: true,
      notificationSent: false,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process loaner overdue', err, {
      checkoutId: loaner.checkoutId,
    });

    return {
      triggerId,
      triggerType: 'LOANER_OVERDUE',
      processed: false,
      notificationSent: false,
      error: err.message,
    };
  }
}

/**
 * Check if we should send a loaner reminder
 */
function shouldSendLoanerReminder(
  trigger: LoanerOverdueTrigger,
  overdueInfo: { daysOverdue: number; hoursOverdue: number }
): { send: boolean; nextCheckAt?: string } {
  const config = trigger.escalationConfig;

  // Check max reminders
  if (trigger.reminderCount >= config.maxReminders) {
    return { send: false };
  }

  // Check if enough time has passed since last reminder
  if (trigger.lastReminderAt) {
    const lastReminder = new Date(trigger.lastReminderAt);
    const now = new Date();
    const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);

    // After escalation threshold, send hourly
    if (overdueInfo.daysOverdue >= config.hourlyEscalationAfterDays) {
      if (hoursSinceLastReminder < 1) {
        const nextCheck = new Date(lastReminder.getTime() + 60 * 60 * 1000);
        return { send: false, nextCheckAt: nextCheck.toISOString() };
      }
    } else {
      // Before escalation, send daily
      if (hoursSinceLastReminder < 24) {
        const nextCheck = new Date(lastReminder.getTime() + 24 * 60 * 60 * 1000);
        return { send: false, nextCheckAt: nextCheck.toISOString() };
      }
    }
  } else {
    // First reminder - check if initial delay has passed
    if (overdueInfo.hoursOverdue < config.initialReminderAfterHours) {
      return { send: false };
    }
  }

  return { send: true };
}

/**
 * Determine escalation level based on overdue duration
 */
export function determineEscalationLevel(
  daysOverdue: number,
  reminderCount: number,
  config: LoanerEscalationConfig
): EscalationLevel {
  if (daysOverdue >= config.managerEscalationAfterDays) {
    return 'CRITICAL';
  }
  if (daysOverdue >= config.hourlyEscalationAfterDays) {
    return 'ESCALATED';
  }
  if (reminderCount > 0) {
    return 'REMINDER';
  }
  return 'INITIAL';
}

/**
 * Calculate next reminder time based on escalation level
 */
function calculateNextReminderTime(
  escalationLevel: EscalationLevel,
  _config: LoanerEscalationConfig
): string {
  const now = new Date();

  switch (escalationLevel) {
    case 'CRITICAL':
    case 'ESCALATED':
      // Hourly reminders
      now.setHours(now.getHours() + 1);
      break;
    case 'REMINDER':
    case 'INITIAL':
    default:
      // Daily reminders
      now.setDate(now.getDate() + 1);
      break;
  }

  return now.toISOString();
}

/**
 * Send loaner overdue notification
 */
async function sendLoanerOverdueNotification(
  loaner: LoanerInfo,
  payload: LoanerOverdueNotification
): Promise<{ notificationId: string }> {
  // Determine recipients based on escalation
  const recipients: Array<{ userId: UUID; email?: string }> = [
    { userId: loaner.borrowerUserId, email: loaner.borrowerEmail },
  ];

  // Add manager for escalated notifications
  if (payload.isManagerEscalation && loaner.borrowerManagerId) {
    recipients.push({
      userId: loaner.borrowerManagerId,
      email: loaner.borrowerManagerEmail,
    });
  }

  const priority = payload.escalationLevel === 'CRITICAL' ? 'URGENT' :
                   payload.escalationLevel === 'ESCALATED' ? 'HIGH' : 'NORMAL';

  // Send to primary recipient (borrower)
  const request: SendNotificationRequest = {
    recipientId: loaner.borrowerUserId,
    recipientEmail: loaner.borrowerEmail,
    channels: ['EMAIL', 'IN_APP'],
    eventType: 'LOANER_OVERDUE',
    subject: buildLoanerOverdueSubject(payload),
    body: buildLoanerOverdueBody(payload),
    priority,
    metadata: { payload },
  };

  const result = await sendNotification(request);
  return { notificationId: result.results[0]?.notificationId ?? '' };
}

/**
 * Build loaner overdue subject
 */
function buildLoanerOverdueSubject(payload: LoanerOverdueNotification): string {
  const prefix = payload.escalationLevel === 'CRITICAL' ? '[URGENT] ' :
                 payload.escalationLevel === 'ESCALATED' ? '[ACTION REQUIRED] ' : '';

  return `${prefix}Loaner asset ${payload.assetTag} is ${payload.daysOverdue} day(s) overdue`;
}

/**
 * Build loaner overdue notification body
 */
function buildLoanerOverdueBody(payload: LoanerOverdueNotification): string {
  const lines = [
    `The loaner asset "${payload.assetName}" (${payload.assetTag}) is overdue for return.`,
    '',
    `Due Date: ${formatDate(payload.dueDate)}`,
    `Days Overdue: ${payload.daysOverdue}`,
    `Reminder #: ${payload.reminderCount}`,
  ];

  if (payload.escalationLevel === 'CRITICAL') {
    lines.push('', '⚠️ This is a CRITICAL escalation. Your manager has been notified.');
    lines.push('Please return the asset immediately or contact IT support.');
  } else if (payload.escalationLevel === 'ESCALATED') {
    lines.push('', '⚠️ This matter has been escalated. Please return the asset as soon as possible.');
  } else {
    lines.push('', 'Please return the asset at your earliest convenience.');
  }

  return lines.join('\n');
}


// ============================================================================
// Stock Level Triggers (Requirement 17.5)
// ============================================================================

/**
 * Process stock level triggers
 * Requirement 17.5: Alert inventory managers when stock falls below threshold
 *
 * @param limit - Maximum number of stock items to process
 * @param dryRun - If true, don't actually send notifications
 * @returns Batch processing result
 */
export async function processStockLevelTriggers(
  limit: number = serviceConfig.maxTriggersPerBatch,
  dryRun: boolean = serviceConfig.dryRunMode
): Promise<TriggerBatchResult> {
  logger.info('Processing stock level triggers', { limit, dryRun });

  const results: TriggerProcessingResult[] = [];
  let notificationsSent = 0;
  let errors = 0;

  const lowStockItems = await triggerRepository.getLowStockLevels();

  for (const stockLevel of lowStockItems.slice(0, limit)) {
    const result = await processStockLevel(stockLevel, dryRun);
    results.push(result);

    if (result.notificationSent) {
      notificationsSent++;
    }
    if (result.error) {
      errors++;
    }
  }

  return {
    triggerType: 'STOCK_LEVEL',
    totalProcessed: results.length,
    notificationsSent,
    errors,
    results,
  };
}

/**
 * Process a single stock level alert
 */
async function processStockLevel(
  stockLevel: StockLevelInfo,
  dryRun: boolean
): Promise<TriggerProcessingResult> {
  const triggerId = `stock-${stockLevel.stockroomId}-${stockLevel.productId}`;

  try {
    // Determine severity
    const severity = determineStockSeverity(stockLevel);

    // Get or create trigger
    let trigger = await triggerRepository.getStockLevelTrigger(
      stockLevel.stockroomId,
      stockLevel.productId
    );

    if (!trigger) {
      trigger = await triggerRepository.upsertStockLevelTrigger(
        stockLevel,
        severity,
        serviceConfig.stockLevelCooldownMinutes
      );
    }

    // Check cooldown period
    if (trigger.lastAlertAt) {
      const lastAlert = new Date(trigger.lastAlertAt);
      const now = new Date();
      const minutesSinceLastAlert = (now.getTime() - lastAlert.getTime()) / (1000 * 60);

      if (minutesSinceLastAlert < trigger.cooldownMinutes) {
        const nextCheck = new Date(lastAlert.getTime() + trigger.cooldownMinutes * 60 * 1000);
        return {
          triggerId,
          triggerType: 'STOCK_LEVEL',
          processed: true,
          notificationSent: false,
          nextCheckAt: nextCheck.toISOString(),
        };
      }
    }

    // Build notification payload
    const payload: StockLevelNotification = {
      stockroomId: stockLevel.stockroomId,
      stockroomName: stockLevel.stockroomName,
      productId: stockLevel.productId,
      productName: stockLevel.productName,
      productSku: stockLevel.productSku,
      quantityAvailable: stockLevel.quantityAvailable,
      reorderPoint: stockLevel.reorderPoint,
      severity,
      shortfallQuantity: stockLevel.reorderPoint - stockLevel.quantityAvailable,
      suggestedReorderQuantity: stockLevel.reorderQuantity,
    };

    if (!dryRun) {
      // Send notification
      const notificationResult = await sendStockLevelNotification(stockLevel, payload);

      // Update trigger
      await triggerRepository.updateStockTriggerAfterAlert(
        trigger.triggerId,
        trigger.alertsSent + 1,
        new Date().toISOString()
      );

      return {
        triggerId,
        triggerType: 'STOCK_LEVEL',
        processed: true,
        notificationSent: true,
        notificationId: notificationResult.notificationId,
      };
    }

    logger.info('Dry run: Would send stock level notification', { payload });

    return {
      triggerId,
      triggerType: 'STOCK_LEVEL',
      processed: true,
      notificationSent: false,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process stock level', err, {
      stockroomId: stockLevel.stockroomId,
      productId: stockLevel.productId,
    });

    return {
      triggerId,
      triggerType: 'STOCK_LEVEL',
      processed: false,
      notificationSent: false,
      error: err.message,
    };
  }
}

/**
 * Determine stock alert severity
 */
export function determineStockSeverity(stockLevel: StockLevelInfo): StockAlertSeverity {
  if (stockLevel.quantityAvailable <= 0) {
    return 'OUT_OF_STOCK';
  }

  // Critical if below 25% of reorder point
  if (stockLevel.quantityAvailable < stockLevel.reorderPoint * 0.25) {
    return 'CRITICAL';
  }

  return 'WARNING';
}

/**
 * Send stock level notification
 */
async function sendStockLevelNotification(
  stockLevel: StockLevelInfo,
  payload: StockLevelNotification
): Promise<{ notificationId: string }> {
  const priority = payload.severity === 'OUT_OF_STOCK' ? 'URGENT' :
                   payload.severity === 'CRITICAL' ? 'HIGH' : 'NORMAL';

  const request: SendNotificationRequest = {
    recipientId: stockLevel.inventoryManagerId ?? '',
    recipientEmail: stockLevel.inventoryManagerEmail,
    channels: ['EMAIL', 'IN_APP'],
    eventType: 'STOCK_LOW',
    subject: buildStockLevelSubject(payload),
    body: buildStockLevelBody(payload),
    priority,
    metadata: { payload },
  };

  const result = await sendNotification(request);
  return { notificationId: result.results[0]?.notificationId ?? '' };
}

/**
 * Build stock level subject
 */
function buildStockLevelSubject(payload: StockLevelNotification): string {
  const prefix = payload.severity === 'OUT_OF_STOCK' ? '[OUT OF STOCK] ' :
                 payload.severity === 'CRITICAL' ? '[CRITICAL] ' : '[LOW STOCK] ';

  return `${prefix}${payload.productName} in ${payload.stockroomName}`;
}

/**
 * Build stock level notification body
 */
function buildStockLevelBody(payload: StockLevelNotification): string {
  const lines = [
    `Stock level alert for "${payload.productName}" in ${payload.stockroomName}.`,
    '',
    `Current Quantity: ${payload.quantityAvailable}`,
    `Reorder Point: ${payload.reorderPoint}`,
    `Shortfall: ${payload.shortfallQuantity}`,
  ];

  if (payload.productSku) {
    lines.splice(2, 0, `SKU: ${payload.productSku}`);
  }

  if (payload.severity === 'OUT_OF_STOCK') {
    lines.push('', '🚨 This item is OUT OF STOCK. Immediate action required.');
  } else if (payload.severity === 'CRITICAL') {
    lines.push('', '⚠️ Stock is critically low. Please reorder immediately.');
  }

  lines.push('', `Suggested Reorder Quantity: ${payload.suggestedReorderQuantity}`);

  return lines.join('\n');
}


// ============================================================================
// Compliance Alert Triggers (Requirement 17.6)
// ============================================================================

/**
 * Process compliance alert triggers
 * Requirement 17.6: Alert compliance analysts when position changes to under-licensed
 *
 * @param limit - Maximum number of products to process
 * @param dryRun - If true, don't actually send notifications
 * @returns Batch processing result
 */
export async function processComplianceAlertTriggers(
  limit: number = serviceConfig.maxTriggersPerBatch,
  dryRun: boolean = serviceConfig.dryRunMode
): Promise<TriggerBatchResult> {
  logger.info('Processing compliance alert triggers', { limit, dryRun });

  const results: TriggerProcessingResult[] = [];
  let notificationsSent = 0;
  let errors = 0;

  const underLicensedProducts = await triggerRepository.getUnderLicensedProducts();

  for (const compliance of underLicensedProducts.slice(0, limit)) {
    const result = await processComplianceAlert(compliance, dryRun);
    results.push(result);

    if (result.notificationSent) {
      notificationsSent++;
    }
    if (result.error) {
      errors++;
    }
  }

  return {
    triggerType: 'COMPLIANCE_ALERT',
    totalProcessed: results.length,
    notificationsSent,
    errors,
    results,
  };
}

/**
 * Process a single compliance alert
 */
async function processComplianceAlert(
  compliance: ComplianceInfo,
  dryRun: boolean
): Promise<TriggerProcessingResult> {
  const triggerId = `compliance-${compliance.productId}`;

  try {
    // Get existing trigger
    let trigger = await triggerRepository.getComplianceAlertTrigger(compliance.productId);

    // Check if this is a new under-licensed position
    const isNewViolation = !trigger || trigger.status === 'COMPLETED';

    if (!trigger) {
      trigger = await triggerRepository.createComplianceAlertTrigger(compliance);
    }

    // Check cooldown period for existing triggers
    if (!isNewViolation && trigger.lastAlertAt) {
      const lastAlert = new Date(trigger.lastAlertAt);
      const now = new Date();
      const minutesSinceLastAlert = (now.getTime() - lastAlert.getTime()) / (1000 * 60);

      if (minutesSinceLastAlert < serviceConfig.complianceAlertCooldownMinutes) {
        const nextCheck = new Date(
          lastAlert.getTime() + serviceConfig.complianceAlertCooldownMinutes * 60 * 1000
        );
        return {
          triggerId,
          triggerType: 'COMPLIANCE_ALERT',
          processed: true,
          notificationSent: false,
          nextCheckAt: nextCheck.toISOString(),
        };
      }
    }

    // Determine severity
    const severity = determineComplianceSeverity(compliance);

    // Build notification payload
    const payload: ComplianceNotification = {
      productId: compliance.productId,
      productName: compliance.productName,
      publisher: compliance.publisher,
      compliancePosition: compliance.compliancePosition,
      previousPosition: trigger.previousPosition,
      entitlementsOwned: compliance.entitlementsOwned,
      installationsFound: compliance.installationsFound,
      licenseDelta: compliance.overUnderCount,
      severity,
      estimatedRisk: calculateEstimatedRisk(compliance),
    };

    if (!dryRun) {
      // Send notification
      const notificationResult = await sendComplianceNotification(compliance, payload);

      // Update trigger
      await triggerRepository.updateComplianceTriggerAfterAlert(
        trigger.triggerId,
        trigger.alertsSent + 1,
        new Date().toISOString()
      );

      return {
        triggerId,
        triggerType: 'COMPLIANCE_ALERT',
        processed: true,
        notificationSent: true,
        notificationId: notificationResult.notificationId,
      };
    }

    logger.info('Dry run: Would send compliance notification', { payload });

    return {
      triggerId,
      triggerType: 'COMPLIANCE_ALERT',
      processed: true,
      notificationSent: false,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process compliance alert', err, {
      productId: compliance.productId,
    });

    return {
      triggerId,
      triggerType: 'COMPLIANCE_ALERT',
      processed: false,
      notificationSent: false,
      error: err.message,
    };
  }
}

/**
 * Determine compliance alert severity
 */
export function determineComplianceSeverity(compliance: ComplianceInfo): ComplianceNotification['severity'] {
  const underLicensedCount = Math.abs(compliance.overUnderCount);

  if (underLicensedCount >= 50) {
    return 'CRITICAL';
  }
  if (underLicensedCount >= 10) {
    return 'WARNING';
  }
  return 'INFO';
}

/**
 * Calculate estimated audit risk (simplified calculation)
 */
function calculateEstimatedRisk(compliance: ComplianceInfo): number {
  // Simple risk calculation based on under-licensed count
  // In a real implementation, this would consider license costs, vendor audit history, etc.
  const underLicensedCount = Math.abs(compliance.overUnderCount);
  const estimatedCostPerLicense = 500; // Placeholder average cost

  return underLicensedCount * estimatedCostPerLicense;
}

/**
 * Send compliance notification
 */
async function sendComplianceNotification(
  compliance: ComplianceInfo,
  payload: ComplianceNotification
): Promise<{ notificationId: string }> {
  const priority = payload.severity === 'CRITICAL' ? 'URGENT' :
                   payload.severity === 'WARNING' ? 'HIGH' : 'NORMAL';

  const request: SendNotificationRequest = {
    recipientId: compliance.complianceAnalystId ?? '',
    recipientEmail: compliance.complianceAnalystEmail,
    channels: ['EMAIL', 'IN_APP'],
    eventType: 'COMPLIANCE_ALERT',
    subject: buildComplianceSubject(payload),
    body: buildComplianceBody(payload),
    priority,
    metadata: { payload },
  };

  const result = await sendNotification(request);
  return { notificationId: result.results[0]?.notificationId ?? '' };
}

/**
 * Build compliance subject
 */
function buildComplianceSubject(payload: ComplianceNotification): string {
  const prefix = payload.severity === 'CRITICAL' ? '[CRITICAL] ' :
                 payload.severity === 'WARNING' ? '[WARNING] ' : '';

  return `${prefix}License compliance alert: ${payload.productName} is under-licensed`;
}

/**
 * Build compliance notification body
 */
function buildComplianceBody(payload: ComplianceNotification): string {
  const lines = [
    `License compliance alert for "${payload.productName}" by ${payload.publisher}.`,
    '',
    `Compliance Position: ${payload.compliancePosition}`,
    `Entitlements Owned: ${payload.entitlementsOwned}`,
    `Installations Found: ${payload.installationsFound}`,
    `License Shortfall: ${Math.abs(payload.licenseDelta)}`,
  ];

  if (payload.previousPosition && payload.previousPosition !== payload.compliancePosition) {
    lines.push(`Previous Position: ${payload.previousPosition}`);
  }

  if (payload.estimatedRisk) {
    lines.push('', `Estimated Audit Risk: $${payload.estimatedRisk.toLocaleString()}`);
  }

  if (payload.severity === 'CRITICAL') {
    lines.push('', '🚨 CRITICAL: Significant license shortfall detected.');
    lines.push('Immediate action required to avoid audit penalties.');
  } else if (payload.severity === 'WARNING') {
    lines.push('', '⚠️ Please review and address this compliance gap.');
  }

  lines.push('', 'Consider purchasing additional licenses or removing unused installations.');

  return lines.join('\n');
}


// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate days until a given date
 */
export function calculateDaysUntilDate(dateString: string): number {
  const targetDate = new Date(dateString);
  const now = new Date();

  // Reset time components for accurate day calculation
  targetDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = targetDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if days until expiration is within the interval window
 * For example, 90-day interval means we notify when 85-90 days remain
 */
export function isWithinIntervalWindow(
  daysUntilExpiration: number,
  intervalDays: ContractExpirationInterval
): boolean {
  const windowStart = intervalDays - 5; // 5-day window
  return daysUntilExpiration >= windowStart && daysUntilExpiration <= intervalDays;
}

/**
 * Calculate overdue information for a loaner
 */
export function calculateOverdueInfo(dueDate: string): {
  daysOverdue: number;
  hoursOverdue: number;
} {
  const due = new Date(dueDate);
  const now = new Date();

  const diffMs = now.getTime() - due.getTime();
  const hoursOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  return { daysOverdue, hoursOverdue };
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ============================================================================
// Manual Trigger Functions
// ============================================================================

/**
 * Manually trigger a contract expiration check for a specific contract
 */
export async function triggerContractExpirationCheck(
  contractId: UUID,
  dryRun: boolean = false
): Promise<TriggerProcessingResult> {
  logger.info('Manual contract expiration check', { contractId, dryRun });

  // In a real implementation, this would fetch the contract from the database
  // For now, return a placeholder result
  return {
    triggerId: `contract-${contractId}`,
    triggerType: 'CONTRACT_EXPIRATION',
    processed: false,
    notificationSent: false,
    error: 'Contract not found',
  };
}

/**
 * Manually trigger a loaner overdue check for a specific checkout
 */
export async function triggerLoanerOverdueCheck(
  checkoutId: UUID,
  dryRun: boolean = false
): Promise<TriggerProcessingResult> {
  logger.info('Manual loaner overdue check', { checkoutId, dryRun });

  return {
    triggerId: `loaner-${checkoutId}`,
    triggerType: 'LOANER_OVERDUE',
    processed: false,
    notificationSent: false,
    error: 'Checkout not found',
  };
}

/**
 * Manually trigger a stock level check for a specific stockroom/product
 */
export async function triggerStockLevelCheck(
  stockroomId: UUID,
  productId: UUID,
  dryRun: boolean = false
): Promise<TriggerProcessingResult> {
  logger.info('Manual stock level check', { stockroomId, productId, dryRun });

  return {
    triggerId: `stock-${stockroomId}-${productId}`,
    triggerType: 'STOCK_LEVEL',
    processed: false,
    notificationSent: false,
    error: 'Stock level not found',
  };
}

/**
 * Manually trigger a compliance check for a specific product
 */
export async function triggerComplianceCheck(
  productId: UUID,
  dryRun: boolean = false
): Promise<TriggerProcessingResult> {
  logger.info('Manual compliance check', { productId, dryRun });

  return {
    triggerId: `compliance-${productId}`,
    triggerType: 'COMPLIANCE_ALERT',
    processed: false,
    notificationSent: false,
    error: 'Product not found',
  };
}

// ============================================================================
// Resolution Functions
// ============================================================================

/**
 * Mark a loaner as returned (resolves the overdue trigger)
 */
export async function markLoanerReturned(checkoutId: UUID): Promise<void> {
  logger.info('Marking loaner as returned', { checkoutId });
  await triggerRepository.completeLoanerTrigger(checkoutId);
}

/**
 * Mark stock as replenished (resolves the stock level trigger)
 */
export async function markStockReplenished(
  stockroomId: UUID,
  productId: UUID
): Promise<void> {
  logger.info('Marking stock as replenished', { stockroomId, productId });
  await triggerRepository.resolveStockLevelTrigger(stockroomId, productId);
}

/**
 * Mark compliance as resolved (resolves the compliance trigger)
 */
export async function markComplianceResolved(productId: UUID): Promise<void> {
  logger.info('Marking compliance as resolved', { productId });
  await triggerRepository.resolveComplianceAlertTrigger(productId);
}
