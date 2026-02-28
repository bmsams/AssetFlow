/**
 * Approval Service
 *
 * Business logic layer for purchase order approval workflow.
 * Handles threshold routing, delegations, and approval notifications.
 *
 * Requirements: 17.1-17.5
 */

import type { UUID } from '@ams/types';
import { publishEvent } from '@ams/events';
import { createLogger } from '@ams/utils';

import type {
  ApprovalDelegation,
  ApprovalRecord,
  ApprovalThreshold,
  CreateDelegationRequest,
  PendingApproval,
} from './approval-repository';
import * as repository from './approval-repository';

const logger = createLogger({ service: 'approval-service' });

// ============================================================================
// Threshold Routing
// ============================================================================

/**
 * Determine the approval threshold for a PO amount
 * Requirement 17.1: Route PO to appropriate approver based on amount thresholds
 */
export async function getApprovalThresholdForAmount(
  amount: number
): Promise<ApprovalThreshold | null> {
  logger.info('Getting approval threshold for amount', { amount });

  const threshold = await repository.getApprovalThresholdForAmount(amount);

  if (threshold) {
    logger.info('Found approval threshold', {
      thresholdId: threshold.thresholdId,
      minAmount: threshold.minAmount,
      maxAmount: threshold.maxAmount,
      approverRoleName: threshold.approverRoleName,
    });
  } else {
    logger.warn('No approval threshold found for amount', { amount });
  }

  return threshold;
}

/**
 * Get all approval thresholds
 */
export async function getApprovalThresholds(): Promise<ApprovalThreshold[]> {
  return repository.getApprovalThresholds();
}

/**
 * Get approvers for a specific threshold
 */
export async function getApproversForThreshold(
  thresholdId: UUID
): Promise<Array<{ userId: UUID; userName: string; email: string }>> {
  return repository.getApproversForThreshold(thresholdId);
}

/**
 * Get approvers for a PO amount
 * Combines threshold lookup with approver resolution
 */
export async function getApproversForAmount(
  amount: number
): Promise<Array<{ userId: UUID; userName: string; email: string }>> {
  const threshold = await getApprovalThresholdForAmount(amount);

  if (!threshold) {
    return [];
  }

  return repository.getApproversForThreshold(threshold.thresholdId);
}


// ============================================================================
// Delegation Management
// ============================================================================

/**
 * Create an approval delegation
 * Requirement 17.4: Allow delegate to approve on behalf of original approver
 */
export async function createDelegation(
  request: CreateDelegationRequest
): Promise<ApprovalDelegation> {
  logger.info('Creating approval delegation', {
    delegatorId: request.delegatorId,
    delegateId: request.delegateId,
    startDate: request.startDate,
    endDate: request.endDate,
  });

  // Validate dates
  const startDate = new Date(request.startDate);
  const endDate = new Date(request.endDate);

  if (endDate <= startDate) {
    throw new Error('End date must be after start date');
  }

  // Check for existing active delegation
  const existingDelegation = await repository.getActiveDelegation(request.delegatorId);
  if (existingDelegation) {
    throw new Error('User already has an active delegation');
  }

  const delegation = await repository.createDelegation(request);

  logger.info('Approval delegation created', {
    delegationId: delegation.delegationId,
    delegatorName: delegation.delegatorName,
    delegateName: delegation.delegateName,
  });

  return delegation;
}

/**
 * Get active delegation for a user
 */
export async function getActiveDelegation(
  delegatorId: UUID,
  asOfDate?: string
): Promise<ApprovalDelegation | null> {
  return repository.getActiveDelegation(delegatorId, asOfDate);
}

/**
 * Get delegations where user is the delegate
 */
export async function getDelegationsForDelegate(
  delegateId: UUID,
  asOfDate?: string
): Promise<ApprovalDelegation[]> {
  return repository.getDelegationsForDelegate(delegateId, asOfDate);
}

/**
 * Deactivate a delegation
 */
export async function deactivateDelegation(delegationId: UUID): Promise<boolean> {
  logger.info('Deactivating delegation', { delegationId });

  const result = await repository.deactivateDelegation(delegationId);

  if (result) {
    logger.info('Delegation deactivated', { delegationId });
  }

  return result;
}

/**
 * Check if a user can approve on behalf of another user
 */
export async function canApproveOnBehalf(
  delegateId: UUID,
  delegatorId: UUID,
  asOfDate?: string
): Promise<boolean> {
  const delegations = await repository.getDelegationsForDelegate(delegateId, asOfDate);

  return delegations.some(d => d.delegatorId === delegatorId);
}

// ============================================================================
// Pending Approvals
// ============================================================================

/**
 * Get pending approvals for a user
 * Includes both direct approvals and delegated approvals
 */
export async function getPendingApprovalsForUser(
  userId: UUID
): Promise<PendingApproval[]> {
  logger.info('Getting pending approvals for user', { userId });

  // Get direct pending approvals
  const directApprovals = await repository.getPendingApprovalsForUser(userId);

  // Get delegated approvals
  const delegations = await repository.getDelegationsForDelegate(userId);
  const delegatedApprovals: PendingApproval[] = [];

  for (const delegation of delegations) {
    const delegatorApprovals = await repository.getPendingApprovalsForUser(delegation.delegatorId);
    delegatedApprovals.push(...delegatorApprovals);
  }

  // Combine and deduplicate
  const allApprovals = [...directApprovals, ...delegatedApprovals];
  const uniqueApprovals = allApprovals.filter(
    (approval, index, self) =>
      index === self.findIndex(a => a.poId === approval.poId)
  );

  logger.info('Found pending approvals', {
    userId,
    directCount: directApprovals.length,
    delegatedCount: delegatedApprovals.length,
    totalCount: uniqueApprovals.length,
  });

  return uniqueApprovals;
}

// ============================================================================
// Approval Reminders
// ============================================================================

/**
 * Send reminders for pending approvals
 * Requirement 17.5: Send reminder notifications to pending approvers
 */
export async function sendApprovalReminders(
  daysThreshold: number = 3
): Promise<{ remindersSent: number; errors: string[] }> {
  logger.info('Sending approval reminders', { daysThreshold });

  const pendingApprovals = await repository.getPendingApprovalsForReminder(daysThreshold);
  let remindersSent = 0;
  const errors: string[] = [];

  for (const approval of pendingApprovals) {
    try {
      // Get approvers for this PO amount
      const approvers = await getApproversForAmount(approval.totalAmount);

      for (const approver of approvers) {
        // Publish reminder event
        await publishEvent('APPROVAL_REMINDER_SENT', {
          poId: approval.poId,
          poNumber: approval.poNumber,
          vendorName: approval.vendorName,
          totalAmount: approval.totalAmount,
          requestedByName: approval.requestedByName,
          daysWaiting: approval.daysWaiting,
          approverId: approver.userId,
          approverName: approver.userName,
          approverEmail: approver.email,
        });

        remindersSent++;
      }
    } catch (error) {
      const err = error as Error;
      logger.error('Failed to send reminder for PO', err, { poId: approval.poId });
      errors.push(`PO ${approval.poNumber}: ${err.message}`);
    }
  }

  logger.info('Approval reminders sent', { remindersSent, errorCount: errors.length });

  return { remindersSent, errors };
}

// ============================================================================
// Approval Records
// ============================================================================

/**
 * Record an approval action
 */
export async function recordApproval(
  poId: UUID,
  approverId: UUID,
  action: 'APPROVED' | 'REJECTED',
  comments?: string
): Promise<ApprovalRecord> {
  logger.info('Recording approval action', { poId, approverId, action });

  return repository.recordApproval(poId, approverId, action, comments);
}

/**
 * Get approval history for a PO
 */
export async function getApprovalHistory(poId: UUID): Promise<ApprovalRecord[]> {
  return repository.getApprovalHistory(poId);
}

// Re-export types
export type {
  ApprovalDelegation,
  ApprovalRecord,
  ApprovalThreshold,
  CreateDelegationRequest,
  PendingApproval,
} from './approval-repository';
