/**
 * Approval Repository
 *
 * Data access layer for purchase order approval workflow.
 * Handles approval thresholds, delegations, and pending approvals.
 *
 * Requirements: 17.1-17.5
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'approval-repository' });

// ============================================================================
// Types
// ============================================================================

export interface ApprovalThreshold {
  readonly thresholdId: UUID;
  readonly minAmount: number;
  readonly maxAmount: number | null;
  readonly approverRoleId: UUID;
  readonly approverRoleName: string;
  readonly requiresMultipleApprovers: boolean;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApprovalDelegation {
  readonly delegationId: UUID;
  readonly delegatorId: UUID;
  readonly delegatorName: string;
  readonly delegateId: UUID;
  readonly delegateName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PendingApproval {
  readonly poId: UUID;
  readonly poNumber: string;
  readonly vendorName: string;
  readonly totalAmount: number;
  readonly requestedBy: string;
  readonly requestedByName: string;
  readonly requestedDate: string;
  readonly daysWaiting: number;
}

export interface ApprovalRecord {
  readonly approvalId: UUID;
  readonly poId: UUID;
  readonly approverId: UUID;
  readonly approverName: string;
  readonly action: 'APPROVED' | 'REJECTED';
  readonly comments: string | null;
  readonly approvedAt: string;
}

export interface CreateDelegationRequest {
  readonly delegatorId: UUID;
  readonly delegateId: UUID;
  readonly startDate: string;
  readonly endDate: string;
}

// ============================================================================
// Approval Thresholds
// ============================================================================

/**
 * Get approval threshold for a given amount
 * Requirement 17.1: Route PO to appropriate approver based on amount thresholds
 */
export async function getApprovalThresholdForAmount(
  amount: number
): Promise<ApprovalThreshold | null> {
  return queryOne<ApprovalThreshold>(
    `SELECT 
      threshold_id as "thresholdId",
      min_amount as "minAmount",
      max_amount as "maxAmount",
      approver_role_id as "approverRoleId",
      r.name as "approverRoleName",
      requires_multiple_approvers as "requiresMultipleApprovers",
      at.is_active as "isActive",
      at.created_at::text as "createdAt",
      at.updated_at::text as "updatedAt"
    FROM approval_thresholds at
    LEFT JOIN roles r ON at.approver_role_id = r.role_id
    WHERE at.is_active = true
      AND at.min_amount <= $1
      AND (at.max_amount IS NULL OR at.max_amount >= $1)
    ORDER BY at.min_amount DESC
    LIMIT 1`,
    [amount]
  );
}

/**
 * Get all active approval thresholds
 */
export async function getApprovalThresholds(): Promise<ApprovalThreshold[]> {
  return queryMany<ApprovalThreshold>(
    `SELECT 
      threshold_id as "thresholdId",
      min_amount as "minAmount",
      max_amount as "maxAmount",
      approver_role_id as "approverRoleId",
      r.name as "approverRoleName",
      requires_multiple_approvers as "requiresMultipleApprovers",
      at.is_active as "isActive",
      at.created_at::text as "createdAt",
      at.updated_at::text as "updatedAt"
    FROM approval_thresholds at
    LEFT JOIN roles r ON at.approver_role_id = r.role_id
    WHERE at.is_active = true
    ORDER BY at.min_amount ASC`,
    []
  );
}

/**
 * Get users with approval authority for a threshold
 */
export async function getApproversForThreshold(
  thresholdId: UUID
): Promise<Array<{ userId: UUID; userName: string; email: string }>> {
  return queryMany<{ userId: UUID; userName: string; email: string }>(
    `SELECT DISTINCT
      u.user_id as "userId",
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as "userName",
      u.email
    FROM users u
    INNER JOIN user_roles ur ON u.user_id = ur.user_id
    INNER JOIN approval_thresholds at ON ur.role_id = at.approver_role_id
    WHERE at.threshold_id = $1
      AND u.is_active = true`,
    [thresholdId]
  );
}


// ============================================================================
// Approval Delegations
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
  });

  const result = await queryOne<ApprovalDelegation>(
    `INSERT INTO approval_delegations (
      delegator_id, delegate_id, start_date, end_date, is_active
    ) VALUES ($1, $2, $3, $4, true)
    RETURNING 
      delegation_id as "delegationId",
      delegator_id as "delegatorId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = $1) as "delegatorName",
      delegate_id as "delegateId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = $2) as "delegateName",
      start_date::text as "startDate",
      end_date::text as "endDate",
      is_active as "isActive",
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"`,
    [request.delegatorId, request.delegateId, request.startDate, request.endDate]
  );

  if (!result) {
    throw new Error('Failed to create approval delegation');
  }

  return result;
}

/**
 * Get active delegation for a user
 */
export async function getActiveDelegation(
  delegatorId: UUID,
  asOfDate?: string
): Promise<ApprovalDelegation | null> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);

  return queryOne<ApprovalDelegation>(
    `SELECT 
      delegation_id as "delegationId",
      delegator_id as "delegatorId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = delegator_id) as "delegatorName",
      delegate_id as "delegateId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = delegate_id) as "delegateName",
      start_date::text as "startDate",
      end_date::text as "endDate",
      is_active as "isActive",
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"
    FROM approval_delegations
    WHERE delegator_id = $1
      AND is_active = true
      AND start_date <= $2
      AND end_date >= $2`,
    [delegatorId, checkDate]
  );
}

/**
 * Get delegations where user is the delegate
 */
export async function getDelegationsForDelegate(
  delegateId: UUID,
  asOfDate?: string
): Promise<ApprovalDelegation[]> {
  const checkDate = asOfDate ?? new Date().toISOString().slice(0, 10);

  return queryMany<ApprovalDelegation>(
    `SELECT 
      delegation_id as "delegationId",
      delegator_id as "delegatorId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = delegator_id) as "delegatorName",
      delegate_id as "delegateId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = delegate_id) as "delegateName",
      start_date::text as "startDate",
      end_date::text as "endDate",
      is_active as "isActive",
      created_at::text as "createdAt",
      updated_at::text as "updatedAt"
    FROM approval_delegations
    WHERE delegate_id = $1
      AND is_active = true
      AND start_date <= $2
      AND end_date >= $2`,
    [delegateId, checkDate]
  );
}

/**
 * Deactivate a delegation
 */
export async function deactivateDelegation(delegationId: UUID): Promise<boolean> {
  const result = await queryOne(
    `UPDATE approval_delegations 
     SET is_active = false, updated_at = NOW()
     WHERE delegation_id = $1`,
    [delegationId]
  );

  return result !== null;
}

// ============================================================================
// Pending Approvals
// ============================================================================

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovalsForUser(
  userId: UUID
): Promise<PendingApproval[]> {
  // Get user's roles
  const userRoles = await queryMany<{ roleId: UUID }>(
    `SELECT role_id as "roleId" FROM user_roles WHERE user_id = $1`,
    [userId]
  );

  if (userRoles.length === 0) {
    return [];
  }

  const roleIds = userRoles.map(r => r.roleId);

  // Get pending POs that match user's approval authority
  return queryMany<PendingApproval>(
    `SELECT 
      po.po_id as "poId",
      po.po_number as "poNumber",
      v.vendor_name as "vendorName",
      po.total_amount as "totalAmount",
      po.requested_by as "requestedBy",
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as "requestedByName",
      po.requested_date::text as "requestedDate",
      EXTRACT(DAY FROM NOW() - po.requested_date)::int as "daysWaiting"
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
    LEFT JOIN users u ON po.requested_by = u.user_id
    INNER JOIN approval_thresholds at ON 
      at.is_active = true
      AND at.min_amount <= po.total_amount
      AND (at.max_amount IS NULL OR at.max_amount >= po.total_amount)
      AND at.approver_role_id = ANY($1::uuid[])
    WHERE po.status = 'PENDING_APPROVAL'
    ORDER BY po.requested_date ASC`,
    [roleIds]
  );
}

/**
 * Get all pending approvals past reminder threshold
 * Requirement 17.5: Send reminder notifications to pending approvers
 */
export async function getPendingApprovalsForReminder(
  daysThreshold: number = 3
): Promise<PendingApproval[]> {
  return queryMany<PendingApproval>(
    `SELECT 
      po.po_id as "poId",
      po.po_number as "poNumber",
      v.vendor_name as "vendorName",
      po.total_amount as "totalAmount",
      po.requested_by as "requestedBy",
      COALESCE(u.first_name || ' ' || u.last_name, u.email) as "requestedByName",
      po.requested_date::text as "requestedDate",
      EXTRACT(DAY FROM NOW() - po.requested_date)::int as "daysWaiting"
    FROM purchase_orders po
    LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
    LEFT JOIN users u ON po.requested_by = u.user_id
    WHERE po.status = 'PENDING_APPROVAL'
      AND EXTRACT(DAY FROM NOW() - po.requested_date) >= $1
    ORDER BY po.requested_date ASC`,
    [daysThreshold]
  );
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
  const result = await queryOne<ApprovalRecord>(
    `INSERT INTO approval_records (
      po_id, approver_id, action, comments
    ) VALUES ($1, $2, $3, $4)
    RETURNING 
      approval_id as "approvalId",
      po_id as "poId",
      approver_id as "approverId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = $2) as "approverName",
      action,
      comments,
      created_at::text as "approvedAt"`,
    [poId, approverId, action, comments ?? null]
  );

  if (!result) {
    throw new Error('Failed to record approval');
  }

  return result;
}

/**
 * Get approval history for a PO
 */
export async function getApprovalHistory(poId: UUID): Promise<ApprovalRecord[]> {
  return queryMany<ApprovalRecord>(
    `SELECT 
      approval_id as "approvalId",
      po_id as "poId",
      approver_id as "approverId",
      (SELECT COALESCE(first_name || ' ' || last_name, email) FROM users WHERE user_id = approver_id) as "approverName",
      action,
      comments,
      created_at::text as "approvedAt"
    FROM approval_records
    WHERE po_id = $1
    ORDER BY created_at ASC`,
    [poId]
  );
}
