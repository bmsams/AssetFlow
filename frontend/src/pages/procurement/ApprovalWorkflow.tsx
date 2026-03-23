/**
 * ApprovalWorkflow Component
 *
 * A reusable React component for purchase order approval workflow actions.
 * Can be embedded in PurchaseOrderDetailPage or used standalone.
 *
 * Implements Task 17.1.5: Create ApprovalWorkflow.tsx for approval actions
 *
 * Requirements from spec (Requirement 17):
 * - Route PO to appropriate approver based on amount thresholds
 * - Track approval status for each required approver
 * - Allow delegates to approve on behalf of original approver
 * - Send reminder notifications for pending approvals
 */

import { useState, useEffect, useCallback } from 'react';
import type { PurchaseOrderStatus } from '../../types/procurement';
import { getPurchaseOrderStatusColor, formatStatus } from '../../types/procurement';
import { apiClient, ApiError } from '../../services/api-client';
import styles from '../admin/AdminPage.module.css';

// ============================================================================
// Types
// ============================================================================

/**
 * Approval threshold configuration
 */
export interface ApprovalThreshold {
  thresholdId: string;
  minAmount: number;
  maxAmount: number | null;
  approverRoleId: string;
  approverRoleName: string;
  requiresMultipleApprovers: boolean;
  isActive: boolean;
}

/**
 * Approver information
 */
export interface Approver {
  userId: string;
  userName: string;
  email: string;
}


/**
 * Approval record for history
 */
export interface ApprovalRecord {
  recordId: string;
  poId: string;
  approverId: string;
  approverName: string;
  action: 'APPROVED' | 'REJECTED';
  comments?: string;
  createdAt: string;
}

/**
 * Approval delegation
 */
export interface ApprovalDelegation {
  delegationId: string;
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/**
 * Props for the ApprovalWorkflow component
 */
export interface ApprovalWorkflowProps {
  /** Purchase order ID */
  poId: string;
  /** Current PO status */
  currentStatus: PurchaseOrderStatus;
  /** Total amount for threshold determination */
  totalAmount: number;
  /** Callback when status changes after an action */
  onStatusChange?: (newStatus: PurchaseOrderStatus) => void;
  /** Whether the component is in read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get approval thresholds
 */
async function getApprovalThresholds(): Promise<ApprovalThreshold[]> {
  const response = await apiClient.get<{ items: ApprovalThreshold[] }>(
    '/procurement/approvals/thresholds'
  );
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch approval thresholds',
      400,
      response.requestId
    );
  }
  return response.data.items;
}

/**
 * Get approvers for a specific amount
 */
async function getApproversForAmount(amount: number): Promise<Approver[]> {
  const response = await apiClient.get<{ items: Approver[] }>(
    `/procurement/approvals/approvers?amount=${amount}`
  );
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch approvers',
      400,
      response.requestId
    );
  }
  return response.data.items;
}

/**
 * Get approval history for a PO
 */
async function getApprovalHistory(poId: string): Promise<ApprovalRecord[]> {
  const response = await apiClient.get<{ items: ApprovalRecord[] }>(
    `/procurement/approvals/history/${poId}`
  );
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch approval history',
      400,
      response.requestId
    );
  }
  return response.data.items;
}

/**
 * Approve a purchase order
 */
async function approvePurchaseOrder(
  poId: string,
  notes?: string
): Promise<{ status: PurchaseOrderStatus }> {
  const response = await apiClient.post<{ status: PurchaseOrderStatus }>(
    `/procurement/purchase-orders/${poId}/approve`,
    { approvalNotes: notes }
  );
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'APPROVE_FAILED',
      response.error?.message || 'Failed to approve purchase order',
      400,
      response.requestId
    );
  }
  return response.data;
}

/**
 * Reject a purchase order
 */
async function rejectPurchaseOrder(
  poId: string,
  reason: string
): Promise<{ status: PurchaseOrderStatus }> {
  const response = await apiClient.post<{ status: PurchaseOrderStatus }>(
    `/procurement/purchase-orders/${poId}/reject`,
    { rejectionReason: reason }
  );
  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REJECT_FAILED',
      response.error?.message || 'Failed to reject purchase order',
      400,
      response.requestId
    );
  }
  return response.data;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format date for display
 */
function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Determine if approval actions are available based on status
 */
function canTakeApprovalAction(status: PurchaseOrderStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

/**
 * Get the applicable threshold for an amount
 */
function getThresholdForAmount(
  thresholds: ApprovalThreshold[],
  amount: number
): ApprovalThreshold | null {
  return thresholds.find(
    (t) =>
      t.isActive &&
      amount >= t.minAmount &&
      (t.maxAmount === null || amount <= t.maxAmount)
  ) || null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ApprovalWorkflow Component
 *
 * Displays approval status, required approvers, and provides
 * approve/reject actions with confirmation dialogs.
 */
export function ApprovalWorkflow({
  poId,
  currentStatus,
  totalAmount,
  onStatusChange,
  readOnly = false,
}: ApprovalWorkflowProps) {
  // State
  const [thresholds, setThresholds] = useState<ApprovalThreshold[]>([]);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');

  /**
   * Load approval workflow data
   */
  const loadApprovalData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load thresholds, approvers, and history in parallel
      const [thresholdsData, approversData, historyData] = await Promise.all([
        getApprovalThresholds().catch(() => [] as ApprovalThreshold[]),
        getApproversForAmount(totalAmount).catch(() => [] as Approver[]),
        getApprovalHistory(poId).catch(() => [] as ApprovalRecord[]),
      ]);

      setThresholds(thresholdsData);
      setApprovers(approversData);
      setApprovalHistory(historyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load approval data');
    } finally {
      setIsLoading(false);
    }
  }, [poId, totalAmount]);

  useEffect(() => {
    void loadApprovalData();
  }, [loadApprovalData]);

  /**
   * Handle approve action
   */
  const handleApprove = async () => {
    try {
      setIsActionLoading(true);
      setError(null);
      const result = await approvePurchaseOrder(poId, actionNotes || undefined);
      setShowApproveModal(false);
      setActionNotes('');
      
      // Reload approval history
      await loadApprovalData();
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(result.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve purchase order');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handle reject action
   */
  const handleReject = async () => {
    if (!actionNotes.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    try {
      setIsActionLoading(true);
      setError(null);
      const result = await rejectPurchaseOrder(poId, actionNotes);
      setShowRejectModal(false);
      setActionNotes('');
      
      // Reload approval history
      await loadApprovalData();
      
      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(result.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject purchase order');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Get the applicable threshold for this PO amount
  const applicableThreshold = getThresholdForAmount(thresholds, totalAmount);
  const canApprove = canTakeApprovalAction(currentStatus) && !readOnly;

  /**
   * Render loading skeleton
   */
  if (isLoading) {
    return (
      <div className={styles.detailCard}>
        <h3 className={styles.detailCardTitle}>Approval Workflow</h3>
        <div className={styles.skeleton} style={{ height: '120px' }} />
      </div>
    );
  }

  return (
    <div className={styles.detailCard}>
      <h3 className={styles.detailCardTitle}>Approval Workflow</h3>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner} style={{ marginBottom: 'var(--spacing-4)' }}>
          <p>{error}</p>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Current Status */}
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Current Status</span>
          <span
            className={styles.statusBadge}
            style={{
              backgroundColor: `color-mix(in srgb, ${getPurchaseOrderStatusColor(currentStatus)} 15%, transparent)`,
              color: getPurchaseOrderStatusColor(currentStatus),
              marginTop: 'var(--spacing-1)',
            }}
          >
            {formatStatus(currentStatus)}
          </span>
        </div>
      </div>

      {/* Approval Threshold Info */}
      {applicableThreshold && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Approval Level Required</span>
            <span className={styles.detailValue}>
              {applicableThreshold.approverRoleName}
              {applicableThreshold.requiresMultipleApprovers && (
                <span style={{ color: 'var(--color-warning-600)', marginLeft: 'var(--spacing-2)' }}>
                  (Multiple approvers required)
                </span>
              )}
            </span>
          </div>
          <div className={styles.detailItem} style={{ marginTop: 'var(--spacing-2)' }}>
            <span className={styles.detailLabel}>Amount Threshold</span>
            <span className={styles.detailValue}>
              {formatCurrency(applicableThreshold.minAmount)}
              {applicableThreshold.maxAmount
                ? ` - ${formatCurrency(applicableThreshold.maxAmount)}`
                : '+'}
            </span>
          </div>
        </div>
      )}

      {/* Required Approvers */}
      {approvers.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <span className={styles.detailLabel}>Required Approvers</span>
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            {approvers.map((approver) => (
              <div
                key={approver.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-2)',
                  padding: 'var(--spacing-2) 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-100)',
                    color: 'var(--color-primary-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)',
                  }}
                >
                  {approver.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                    {approver.userName}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {approver.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval History */}
      {approvalHistory.length > 0 && (
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <span className={styles.detailLabel}>Approval History</span>
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            {approvalHistory.map((record) => (
              <div
                key={record.recordId}
                style={{
                  padding: 'var(--spacing-3)',
                  backgroundColor: record.action === 'APPROVED'
                    ? 'var(--color-success-50)'
                    : 'var(--color-error-50)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--spacing-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                    <span
                      className={styles.statusBadge}
                      style={{
                        backgroundColor: record.action === 'APPROVED'
                          ? 'var(--color-success-100)'
                          : 'var(--color-error-100)',
                        color: record.action === 'APPROVED'
                          ? 'var(--color-success-700)'
                          : 'var(--color-error-700)',
                      }}
                    >
                      {record.action}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' }}>
                      by {record.approverName}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                    {formatDateTime(record.createdAt)}
                  </span>
                </div>
                {record.comments && (
                  <p style={{
                    margin: 'var(--spacing-2) 0 0 0',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    fontStyle: 'italic',
                  }}>
                    "{record.comments}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {canApprove && (
        <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setShowApproveModal(true)}
            disabled={isActionLoading}
            style={{ backgroundColor: 'var(--color-success-500)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setShowRejectModal(true)}
            disabled={isActionLoading}
            style={{ borderColor: 'var(--color-error-300)', color: 'var(--color-error-600)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Reject
          </button>
        </div>
      )}

      {/* No Approval Required Message */}
      {!canApprove && currentStatus !== 'PENDING_APPROVAL' && (
        <div style={{
          padding: 'var(--spacing-3)',
          backgroundColor: 'var(--color-gray-50)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--font-size-sm)',
        }}>
          {currentStatus === 'APPROVED' && 'This purchase order has been approved.'}
          {currentStatus === 'CANCELLED' && 'This purchase order has been rejected.'}
          {currentStatus === 'DRAFT' && 'This purchase order has not been submitted for approval yet.'}
          {!['APPROVED', 'CANCELLED', 'DRAFT', 'PENDING_APPROVAL'].includes(currentStatus) &&
            'No approval action required for current status.'}
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowApproveModal(false);
            setActionNotes('');
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-6)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: 'var(--font-size-lg)' }}>
              Approve Purchase Order
            </h3>
            <p style={{ margin: '0 0 var(--spacing-4) 0', color: 'var(--color-text-secondary)' }}>
              Are you sure you want to approve this purchase order for {formatCurrency(totalAmount)}?
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Notes (optional)</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add approval notes..."
                className={styles.formTextarea}
                rows={3}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setShowApproveModal(false);
                  setActionNotes('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleApprove}
                disabled={isActionLoading}
                style={{ backgroundColor: 'var(--color-success-500)' }}
              >
                {isActionLoading ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => {
            setShowRejectModal(false);
            setActionNotes('');
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-6)',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 var(--spacing-2) 0', fontSize: 'var(--font-size-lg)' }}>
              Reject Purchase Order
            </h3>
            <p style={{ margin: '0 0 var(--spacing-4) 0', color: 'var(--color-text-secondary)' }}>
              Please provide a reason for rejecting this purchase order.
            </p>
            <div className={styles.formGroup}>
              <label className={`${styles.formLabel} required`}>Rejection Reason</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Please provide a reason for rejection (required)..."
                className={styles.formTextarea}
                rows={3}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setShowRejectModal(false);
                  setActionNotes('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleReject}
                disabled={isActionLoading || !actionNotes.trim()}
                style={{ backgroundColor: 'var(--color-error-500)' }}
              >
                {isActionLoading ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalWorkflow;
