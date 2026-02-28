/**
 * Loaner Service - Business logic layer for loaner asset management
 *
 * Implements:
 * - Loaner checkout and return operations (Requirement 3.8)
 * - Due date tracking and overdue detection (Requirement 3.8)
 * - Escalating notification triggers for overdue items (Requirement 3.9)
 */

import type { PaginatedResult, PaginationParams, UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  CreateLoanerCheckoutRequest,
  LoanerCheckout,
  LoanerStatus,
  OverdueLoanerInfo,
  ReturnLoanerRequest,
} from './loaner-repository';
import * as repository from './loaner-repository';

const logger = createLogger({ service: 'loaner-service' });

/**
 * Escalation level thresholds in days
 * Requirement 3.9: Send notifications at 1 day, 3 days, and 7 days past due
 */
export const ESCALATION_THRESHOLDS = {
  LEVEL_1: 1,  // 1 day overdue
  LEVEL_2: 3,  // 3 days overdue
  LEVEL_3: 7,  // 7 days overdue
} as const;

/**
 * Escalation level type
 */
export type EscalationLevel = 0 | 1 | 2 | 3;

/**
 * Overdue notification info
 */
export interface OverdueNotification {
  readonly checkoutId: UUID;
  readonly checkoutNumber: string;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetName: string | null;
  readonly borrowerId: UUID;
  readonly borrowerEmail: string | null;
  readonly borrowerName: string | null;
  readonly managerId: UUID | null;
  readonly managerEmail: string | null;
  readonly managerName: string | null;
  readonly dueDate: string;
  readonly daysOverdue: number;
  readonly escalationLevel: EscalationLevel;
  readonly previousEscalationLevel: EscalationLevel;
  readonly isNewEscalation: boolean;
}

/**
 * Checkout result with additional info
 */
export interface CheckoutResult {
  readonly checkout: LoanerCheckout;
  readonly assetTag?: string;
  readonly assetName?: string;
}

/**
 * Return result with additional info
 */
export interface ReturnResult {
  readonly checkout: LoanerCheckout;
  readonly wasOverdue: boolean;
  readonly daysOverdue: number;
  readonly totalCharges: number | null;
}

/**
 * Overdue loans result
 */
export interface OverdueLoansResult {
  readonly loans: PaginatedResult<OverdueLoanerInfo>;
  readonly summary: {
    readonly totalOverdue: number;
    readonly level1Count: number;
    readonly level2Count: number;
    readonly level3Count: number;
  };
}

/**
 * Calculate days overdue from due date
 * Requirement 3.8: Track due dates
 */
export function calculateOverdueDays(dueDate: string, currentDate?: Date): number {
  // Parse the due date - handle both YYYY-MM-DD and ISO formats
  const dueDateStr = dueDate.split('T')[0]!;
  const [year, month, day] = dueDateStr.split('-').map(Number);
  const due = new Date(year!, month! - 1, day!);
  due.setHours(0, 0, 0, 0);
  
  // Get current date at midnight
  const current = currentDate ? new Date(currentDate) : new Date();
  current.setHours(0, 0, 0, 0);
  
  const diffTime = current.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Determine escalation level based on days overdue
 * Requirement 3.9: Escalating notifications at 1, 3, and 7 days
 */
export function getEscalationLevel(daysOverdue: number): EscalationLevel {
  if (daysOverdue >= ESCALATION_THRESHOLDS.LEVEL_3) {
    return 3;
  }
  if (daysOverdue >= ESCALATION_THRESHOLDS.LEVEL_2) {
    return 2;
  }
  if (daysOverdue >= ESCALATION_THRESHOLDS.LEVEL_1) {
    return 1;
  }
  return 0;
}

/**
 * Check if a new escalation notification should be sent
 * Requirement 3.9: Send escalating notifications
 */
export function shouldSendEscalationNotification(
  daysOverdue: number,
  currentEscalationLevel: number
): boolean {
  const newLevel = getEscalationLevel(daysOverdue);
  return newLevel > currentEscalationLevel;
}

/**
 * Cache key for user's active checkouts
 */
function userCheckoutsCacheKey(userId: UUID): string {
  return `loaner:user:${userId}:active`;
}

/**
 * Cache key for asset checkout status
 */
function assetCheckoutCacheKey(assetId: UUID): string {
  return `loaner:asset:${assetId}:status`;
}

/**
 * Checkout a loaner asset to a user
 * Requirement 3.8: Track loaner checkouts with due dates
 */
export async function checkoutLoaner(
  request: CreateLoanerCheckoutRequest
): Promise<CheckoutResult> {
  logger.info('Processing loaner checkout', {
    assetId: request.assetId,
    checkedOutTo: request.checkedOutTo,
    dueDate: request.dueDate,
  });

  // Validate due date is in the future
  const dueDate = new Date(request.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (dueDate < today) {
    throw new Error('Due date must be today or in the future');
  }

  // Check if asset is available
  const isAvailable = await repository.isAssetAvailableForCheckout(request.assetId);
  if (!isAvailable) {
    throw new Error(`Asset ${request.assetId} is not available for checkout`);
  }

  // Create the checkout
  const checkout = await repository.createCheckout(request);

  // Invalidate caches
  await cache.del(userCheckoutsCacheKey(request.checkedOutTo));
  await cache.del(assetCheckoutCacheKey(request.assetId));

  // Publish checkout event
  await publishEvent('LOANER_CHECKED_OUT', {
    checkoutId: checkout.checkoutId,
    checkoutNumber: checkout.checkoutNumber,
    assetId: checkout.assetId,
    checkedOutTo: checkout.checkedOutTo,
    checkedOutBy: checkout.checkedOutBy,
    dueDate: checkout.dueDate,
    conditionOut: checkout.conditionOut,
  });

  logger.info('Loaner checkout completed', {
    checkoutId: checkout.checkoutId,
    checkoutNumber: checkout.checkoutNumber,
  });

  return { checkout };
}

/**
 * Return a loaner asset
 * Requirement 3.8: Track loaner returns
 */
export async function returnLoaner(
  checkoutId: UUID,
  request: ReturnLoanerRequest
): Promise<ReturnResult> {
  logger.info('Processing loaner return', { checkoutId });

  // Get current checkout
  const currentCheckout = await repository.getCheckoutById(checkoutId);
  if (!currentCheckout) {
    throw new Error(`Checkout not found: ${checkoutId}`);
  }

  if (currentCheckout.status !== 'CHECKED_OUT' && currentCheckout.status !== 'OVERDUE') {
    throw new Error(`Cannot return loaner with status: ${currentCheckout.status}`);
  }

  // Calculate overdue info before return
  const daysOverdue = calculateOverdueDays(currentCheckout.dueDate);
  const wasOverdue = daysOverdue > 0;

  // Process the return
  const checkout = await repository.returnLoaner(checkoutId, request);
  if (!checkout) {
    throw new Error(`Failed to return loaner: ${checkoutId}`);
  }

  // Invalidate caches
  await cache.del(userCheckoutsCacheKey(currentCheckout.checkedOutTo));
  await cache.del(assetCheckoutCacheKey(currentCheckout.assetId));

  // Publish return event
  await publishEvent('LOANER_RETURNED', {
    checkoutId: checkout.checkoutId,
    checkoutNumber: checkout.checkoutNumber,
    assetId: checkout.assetId,
    checkedOutTo: checkout.checkedOutTo,
    returnedBy: checkout.returnedBy,
    conditionIn: checkout.conditionIn,
    status: checkout.status,
    wasOverdue,
    daysOverdue,
    totalCharges: checkout.totalCharges,
  });

  logger.info('Loaner return completed', {
    checkoutId: checkout.checkoutId,
    status: checkout.status,
    wasOverdue,
    daysOverdue,
  });

  return {
    checkout,
    wasOverdue,
    daysOverdue,
    totalCharges: checkout.totalCharges,
  };
}

/**
 * Get all overdue loaner checkouts
 * Requirement 3.8: Track overdue items
 * Requirement 3.9: Support escalating notifications
 */
export async function getOverdueLoans(
  pagination: PaginationParams = {}
): Promise<OverdueLoansResult> {
  logger.info('Getting overdue loans', { pagination });

  const loans = await repository.getOverdueCheckouts(pagination);

  // Calculate summary counts by escalation level
  let level1Count = 0;
  let level2Count = 0;
  let level3Count = 0;

  for (const loan of loans.items) {
    const level = getEscalationLevel(loan.daysOverdue);
    if (level >= 3) {
      level3Count++;
    } else if (level >= 2) {
      level2Count++;
    } else if (level >= 1) {
      level1Count++;
    }
  }

  logger.info('Overdue loans retrieved', {
    totalOverdue: loans.total,
    level1Count,
    level2Count,
    level3Count,
  });

  return {
    loans,
    summary: {
      totalOverdue: loans.total,
      level1Count,
      level2Count,
      level3Count,
    },
  };
}

/**
 * Process overdue notifications and update escalation levels
 * Requirement 3.9: Send escalating notifications at 1, 3, and 7 days
 */
export async function processOverdueNotifications(): Promise<OverdueNotification[]> {
  logger.info('Processing overdue notifications');

  const overdueResult = await repository.getOverdueCheckouts({ page: 1, limit: 1000 });
  const notifications: OverdueNotification[] = [];

  for (const loan of overdueResult.items) {
    const { checkout, daysOverdue, borrowerEmail, borrowerName, managerEmail, managerName, assetTag, assetName } = loan;
    
    const newEscalationLevel = getEscalationLevel(daysOverdue);
    const previousLevel = checkout.escalationLevel as EscalationLevel;
    const isNewEscalation = newEscalationLevel > previousLevel;

    if (isNewEscalation) {
      // Update the checkout with new escalation level
      await repository.updateOverdueStatus(checkout.checkoutId, newEscalationLevel, true);

      const notification: OverdueNotification = {
        checkoutId: checkout.checkoutId,
        checkoutNumber: checkout.checkoutNumber,
        assetId: checkout.assetId,
        assetTag,
        assetName,
        borrowerId: checkout.checkedOutTo,
        borrowerEmail,
        borrowerName,
        managerId: null, // Would need to fetch from user record
        managerEmail,
        managerName,
        dueDate: checkout.dueDate,
        daysOverdue,
        escalationLevel: newEscalationLevel,
        previousEscalationLevel: previousLevel,
        isNewEscalation: true,
      };

      notifications.push(notification);

      // Publish notification event
      await publishEvent('LOANER_OVERDUE_NOTIFICATION', {
        checkoutId: checkout.checkoutId,
        checkoutNumber: checkout.checkoutNumber,
        assetId: checkout.assetId,
        assetTag,
        borrowerId: checkout.checkedOutTo,
        borrowerEmail,
        borrowerName,
        managerEmail,
        managerName,
        dueDate: checkout.dueDate,
        daysOverdue,
        escalationLevel: newEscalationLevel,
        notificationType: getNotificationType(newEscalationLevel),
      });

      logger.info('Overdue notification triggered', {
        checkoutId: checkout.checkoutId,
        daysOverdue,
        escalationLevel: newEscalationLevel,
      });
    } else if (checkout.escalationLevel < newEscalationLevel) {
      // Update escalation level without sending notification (already sent)
      await repository.updateOverdueStatus(checkout.checkoutId, newEscalationLevel, false);
    }
  }

  logger.info('Overdue notification processing complete', {
    totalOverdue: overdueResult.total,
    notificationsSent: notifications.length,
  });

  return notifications;
}

/**
 * Get notification type based on escalation level
 */
function getNotificationType(level: EscalationLevel): string {
  switch (level) {
    case 1:
      return 'REMINDER_1_DAY';
    case 2:
      return 'REMINDER_3_DAYS';
    case 3:
      return 'ESCALATION_7_DAYS';
    default:
      return 'INITIAL';
  }
}

/**
 * Get checkout by ID
 */
export async function getCheckout(checkoutId: UUID): Promise<LoanerCheckout | null> {
  return repository.getCheckoutById(checkoutId);
}

/**
 * Get checkout by number
 */
export async function getCheckoutByNumber(checkoutNumber: string): Promise<LoanerCheckout | null> {
  return repository.getCheckoutByNumber(checkoutNumber);
}

/**
 * Get active checkout for an asset
 */
export async function getActiveCheckoutForAsset(assetId: UUID): Promise<LoanerCheckout | null> {
  return repository.getActiveCheckoutForAsset(assetId);
}

/**
 * List all loaner checkouts with optional status filter
 */
export async function listCheckouts(
  pagination: PaginationParams = {},
  statusFilter?: LoanerStatus[]
): Promise<PaginatedResult<LoanerCheckout>> {
  return repository.listCheckouts(pagination, statusFilter);
}

/**
 * Get checkouts for a user
 */
export async function getCheckoutsByUser(
  userId: UUID,
  includeReturned = false,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LoanerCheckout>> {
  return repository.getCheckoutsByUser(userId, includeReturned, pagination);
}

/**
 * Get checkout history for an asset
 */
export async function getCheckoutHistoryForAsset(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<LoanerCheckout>> {
  return repository.getCheckoutHistoryForAsset(assetId, pagination);
}

/**
 * Check if asset is available for checkout
 */
export async function isAssetAvailable(assetId: UUID): Promise<boolean> {
  return repository.isAssetAvailableForCheckout(assetId);
}

/**
 * Extend due date for a checkout
 */
export async function extendDueDate(
  checkoutId: UUID,
  newDueDate: string,
  approvedBy: UUID
): Promise<LoanerCheckout> {
  logger.info('Extending due date', { checkoutId, newDueDate, approvedBy });

  // Validate new due date is in the future
  const newDate = new Date(newDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (newDate < today) {
    throw new Error('New due date must be today or in the future');
  }

  // Get current checkout
  const currentCheckout = await repository.getCheckoutById(checkoutId);
  if (!currentCheckout) {
    throw new Error(`Checkout not found: ${checkoutId}`);
  }

  // Validate new due date is after current due date
  const currentDueDate = new Date(currentCheckout.dueDate);
  if (newDate <= currentDueDate) {
    throw new Error('New due date must be after current due date');
  }

  const checkout = await repository.extendDueDate(checkoutId, newDueDate, approvedBy);
  if (!checkout) {
    throw new Error(`Failed to extend due date for checkout: ${checkoutId}`);
  }

  // Invalidate caches
  await cache.del(userCheckoutsCacheKey(checkout.checkedOutTo));

  // Publish extension event
  await publishEvent('LOANER_DUE_DATE_EXTENDED', {
    checkoutId: checkout.checkoutId,
    checkoutNumber: checkout.checkoutNumber,
    assetId: checkout.assetId,
    checkedOutTo: checkout.checkedOutTo,
    previousDueDate: currentCheckout.dueDate,
    newDueDate: checkout.dueDate,
    extensionCount: checkout.extensionCount,
    approvedBy,
  });

  logger.info('Due date extended', {
    checkoutId: checkout.checkoutId,
    previousDueDate: currentCheckout.dueDate,
    newDueDate: checkout.dueDate,
    extensionCount: checkout.extensionCount,
  });

  return checkout;
}

// Re-export types
export type {
  AssetCondition,
  CreateLoanerCheckoutRequest,
  LoanerCheckout,
  LoanerStatus,
  OverdueLoanerInfo,
  ReturnLoanerRequest,
} from './loaner-repository';
