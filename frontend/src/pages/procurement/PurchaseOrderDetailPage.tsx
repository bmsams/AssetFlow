import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  procurementApi,
  type POCloseGuardResult,
  type PurchaseOrderDetail,
  type POStatusHistory,
} from '../../services/procurement-api';
import type { PurchaseOrderStatus } from '../../types/procurement';
import { formatStatus } from '../../types/procurement';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { POLineEditor, poLineToEditable } from './POLineEditor';
import { PageLayout } from '../../components/layout/PageLayout';
import { StatusBadge, type StatusVariant } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import styles from './PurchaseOrderDetailPage.module.css';

/**
 * Get available actions based on PO status
 */
function getAvailableActions(status: PurchaseOrderStatus): string[] {
  switch (status) {
    case 'DRAFT':
      return ['edit', 'submit', 'cancel'];
    case 'PENDING_APPROVAL':
      return ['approve', 'reject'];
    case 'APPROVED':
      return ['send', 'cancel'];
    case 'SENT':
      return ['receive', 'receiptAccounting', 'invoiceAccounting', 'closeGuard', 'close'];
    case 'PARTIALLY_RECEIVED':
      return ['receive', 'receiptAccounting', 'invoiceAccounting', 'closeGuard', 'close'];
    case 'RECEIVED':
      return ['invoiceAccounting', 'closeGuard', 'close'];
    case 'CLOSED':
    case 'CANCELLED':
    case 'REJECTED':
    default:
      return [];
  }
}

function canShowCloseWorkflow(status: PurchaseOrderStatus): boolean {
  return status === 'SENT' || status === 'PARTIALLY_RECEIVED' || status === 'RECEIVED';
}

/**
 * Maps a purchase order status to a StatusBadge variant
 */
function getStatusVariant(status: PurchaseOrderStatus): StatusVariant {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PENDING_APPROVAL':
      return 'pending_approval';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'SENT':
      return 'sent';
    case 'PARTIALLY_RECEIVED':
      return 'partially_received';
    case 'RECEIVED':
      return 'received';
    case 'CLOSED':
      return 'closed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'info';
  }
}

/**
 * Purchase Order Detail Page Component
 * Implements Task 17.1.4: Create PurchaseOrderDetailPage.tsx with status history
 *
 * Requirements from spec (Requirement 16):
 * - Display complete PO details including all line items, totals, and status history
 * - Show PO number, vendor, cost center, dates, amounts
 * - Display line items using POLineEditor in read-only mode
 * - Show status history timeline with who changed status and when
 * - Action buttons based on current status (submit, approve, reject, send, cancel)
 */
export function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();

  // State
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modal states for actions
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showReceiptAccountingModal, setShowReceiptAccountingModal] = useState(false);
  const [showInvoiceAccountingModal, setShowInvoiceAccountingModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actionNotes, setActionNotes] = useState('');
  const [receiptIdInput, setReceiptIdInput] = useState('');
  const [receiptNumberInput, setReceiptNumberInput] = useState('');
  const [invoiceIdInput, setInvoiceIdInput] = useState('');
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [closeNotesInput, setCloseNotesInput] = useState('');
  const [closeGuard, setCloseGuard] = useState<POCloseGuardResult | null>(null);
  const [isCloseGuardLoading, setIsCloseGuardLoading] = useState(false);

  const refreshCloseGuard = useCallback(
    async (targetPoId: string) => {
      if (!targetPoId) {
        return;
      }

      try {
        setIsCloseGuardLoading(true);
        const guard = await procurementApi.purchaseOrders.getCloseGuard(targetPoId);
        setCloseGuard(guard);
      } catch (err) {
        setCloseGuard(null);
        setError(err instanceof Error ? err.message : 'Failed to check close readiness');
      } finally {
        setIsCloseGuardLoading(false);
      }
    },
    []
  );

  /**
   * Load purchase order details
   */
  const loadPurchaseOrder = useCallback(async () => {
    if (!poId) return;

    try {
      setIsLoading(true);
      setError(null);
      const po = await procurementApi.purchaseOrders.get(poId);
      setPurchaseOrder(po);

      if (canShowCloseWorkflow(po.status)) {
        await refreshCloseGuard(po.poId);
      } else {
        setCloseGuard(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase order');
    } finally {
      setIsLoading(false);
    }
  }, [poId, refreshCloseGuard]);

  useEffect(() => {
    void loadPurchaseOrder();
  }, [loadPurchaseOrder]);

  /**
   * Handle submit for approval action
   */
  const handleSubmitForApproval = async () => {
    if (!poId) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.submitForApproval(poId);
      setPurchaseOrder(updatedPO);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit for approval');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handle approve action
   */
  const handleApprove = async () => {
    if (!poId) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.approve(poId, actionNotes || undefined);
      setPurchaseOrder(updatedPO);
      setShowApproveModal(false);
      setActionNotes('');
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
    if (!poId || !actionNotes.trim()) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.reject(poId, actionNotes);
      setPurchaseOrder(updatedPO);
      setShowRejectModal(false);
      setActionNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject purchase order');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handle send to vendor action
   */
  const handleSendToVendor = async () => {
    if (!poId) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.sendToVendor(poId);
      setPurchaseOrder(updatedPO);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send to vendor');
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handle cancel action
   */
  const handleCancel = async () => {
    if (!poId) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.cancel(poId, actionNotes || undefined);
      setPurchaseOrder(updatedPO);
      setShowCancelModal(false);
      setActionNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel purchase order');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePostReceiptAccounting = async () => {
    if (!poId || !receiptIdInput.trim()) {
      setError('Receipt ID is required');
      return;
    }

    try {
      setIsActionLoading(true);
      setError(null);
      await procurementApi.purchaseOrders.postReceiptAccounting(poId, {
        receiptId: receiptIdInput.trim(),
        receiptNumber: receiptNumberInput.trim() || undefined,
      });
      setShowReceiptAccountingModal(false);
      setReceiptIdInput('');
      setReceiptNumberInput('');
      await loadPurchaseOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post receipt accounting');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePostInvoiceAccounting = async () => {
    if (!poId || !invoiceIdInput.trim()) {
      setError('Invoice ID is required');
      return;
    }

    try {
      setIsActionLoading(true);
      setError(null);
      await procurementApi.purchaseOrders.postInvoiceAccounting(poId, {
        invoiceId: invoiceIdInput.trim(),
        invoiceNumber: invoiceNumberInput.trim() || undefined,
      });
      setShowInvoiceAccountingModal(false);
      setInvoiceIdInput('');
      setInvoiceNumberInput('');
      await loadPurchaseOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post invoice accounting');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefreshCloseGuard = async () => {
    if (!poId) return;
    await refreshCloseGuard(poId);
  };

  const handleClosePO = async () => {
    if (!poId) return;

    try {
      setIsActionLoading(true);
      setError(null);
      const updatedPO = await procurementApi.purchaseOrders.close(
        poId,
        closeNotesInput.trim() || undefined
      );
      setPurchaseOrder(updatedPO);
      setShowCloseModal(false);
      setCloseNotesInput('');
      setCloseGuard(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close purchase order');
      await handleRefreshCloseGuard();
    } finally {
      setIsActionLoading(false);
    }
  };

  /**
   * Handle dismissing error
   */
  const handleDismissError = () => {
    setError(null);
  };

  /**
   * Render loading skeleton
   */
  const renderSkeleton = () => (
    <div className={styles.detailCard}>
      <div className={styles.skeleton} style={{ height: '300px' }} />
    </div>
  );

  /**
   * Render status history timeline
   */
  const renderStatusHistory = (history: POStatusHistory[]) => {
    if (!history || history.length === 0) {
      return (
        <p className={styles.timelineEmpty}>
          No status history available
        </p>
      );
    }

    // Sort by date descending (most recent first)
    const sortedHistory = [...history].sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );

    return (
      <div className={styles.timeline}>
        {/* Timeline line */}
        <div className={styles.timelineLine} />
        
        {sortedHistory.map((entry, index) => (
          <div
            key={entry.historyId}
            className={styles.timelineItem}
            style={{
              paddingBottom: index === sortedHistory.length - 1 ? 0 : 'var(--spacing-4)',
            }}
          >
            {/* Timeline dot */}
            <div 
              className={styles.timelineDot} 
              style={{ 
                backgroundColor: getStatusColor(entry.status) 
              }} 
            />

            {/* Entry content */}
            <div className={styles.timelineContent}>
              <div className={styles.timelineHeader}>
                <StatusBadge
                  label={formatStatus(entry.status)}
                  variant={getStatusVariant(entry.status)}
                />
                <span className={styles.timelineTimestamp}>
                  {formatDateTime(entry.changedAt)}
                </span>
              </div>
              <p className={styles.timelineUser}>
                Changed by <strong>{entry.changedByName}</strong>
              </p>
              {entry.notes && (
                <p className={styles.timelineNotes}>
                  "{entry.notes}"
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Get status color for timeline dots
   */
  const getStatusColor = (status: PurchaseOrderStatus): string => {
    switch (status) {
      case 'DRAFT':
        return 'var(--color-gray-500)';
      case 'PENDING_APPROVAL':
        return 'var(--color-warning-500)';
      case 'APPROVED':
        return 'var(--color-primary-500)';
      case 'REJECTED':
        return 'var(--color-error-500)';
      case 'SENT':
        return 'var(--color-info-500)';
      case 'PARTIALLY_RECEIVED':
        return 'var(--color-warning-500)';
      case 'RECEIVED':
        return 'var(--color-success-500)';
      case 'CLOSED':
        return 'var(--color-success-500)';
      case 'CANCELLED':
        return 'var(--color-error-500)';
      default:
        return 'var(--color-gray-500)';
    }
  };

  /**
   * Render action buttons based on status
   */
  const renderActionButtons = () => {
    if (!purchaseOrder) return null;

    const actions = getAvailableActions(purchaseOrder.status);
    if (actions.length === 0) return null;

    return (
      <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
        {actions.includes('edit') && (
          <Button
            variant="secondary"
            onClick={() => navigate(`/procurement/purchase-orders/${poId}/edit`)}
            disabled={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            }
          >
            Edit
          </Button>
        )}

        {actions.includes('submit') && (
          <Button
            variant="primary"
            onClick={handleSubmitForApproval}
            disabled={isActionLoading}
            isLoading={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            }
          >
            Submit for Approval
          </Button>
        )}

        {actions.includes('approve') && (
          <Button
            variant="primary"
            onClick={() => setShowApproveModal(true)}
            disabled={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          >
            Approve
          </Button>
        )}

        {actions.includes('reject') && (
          <Button
            variant="outline"
            onClick={() => setShowRejectModal(true)}
            disabled={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            }
          >
            Reject
          </Button>
        )}

        {actions.includes('send') && (
          <Button
            variant="primary"
            onClick={handleSendToVendor}
            disabled={isActionLoading}
            isLoading={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            }
          >
            Send to Vendor
          </Button>
        )}

        {actions.includes('receive') && (
          <Button
            variant="primary"
            onClick={() => navigate(`/procurement/receiving?poId=${poId}`)}
            disabled={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
          >
            Receive Items
          </Button>
        )}

        {actions.includes('cancel') && (
          <Button
            variant="outline"
            onClick={() => setShowCancelModal(true)}
            disabled={isActionLoading}
            leftIcon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            }
          >
            Cancel Order
          </Button>
        )}

        {actions.includes('receiptAccounting') && (
          <Button
            variant="secondary"
            onClick={() => setShowReceiptAccountingModal(true)}
            disabled={isActionLoading}
          >
            Post Receipt Accounting
          </Button>
        )}

        {actions.includes('invoiceAccounting') && (
          <Button
            variant="secondary"
            onClick={() => setShowInvoiceAccountingModal(true)}
            disabled={isActionLoading}
          >
            Post Invoice Accounting
          </Button>
        )}

        {actions.includes('closeGuard') && (
          <Button
            variant="outline"
            onClick={handleRefreshCloseGuard}
            disabled={isActionLoading || isCloseGuardLoading}
            isLoading={isCloseGuardLoading}
          >
            Check Close Readiness
          </Button>
        )}

        {actions.includes('close') && (
          <Button
            variant="primary"
            onClick={() => setShowCloseModal(true)}
            disabled={isActionLoading || isCloseGuardLoading || (closeGuard !== null && !closeGuard.canClose)}
          >
            Close PO
          </Button>
        )}
      </div>
    );
  };

  // Convert lines to editable format for POLineEditor
  const editableLines = purchaseOrder?.lines?.map(poLineToEditable) || [];

  // For the error state
  if (error && !purchaseOrder) {
    return (
      <PageLayout
        title="Error"
        description="Failed to load purchase order details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Procurement', href: '/procurement' },
          { label: 'Purchase Orders', href: '/procurement/purchase-orders' },
          { label: 'Error' },
        ]}
      >
        <ErrorMessage
          title="Failed to load purchase order"
          message={error}
          type="error"
          recoveryOptions={[{ label: 'Retry', action: loadPurchaseOrder }]}
        />
      </PageLayout>
    );
  }

  // For the not-found state
  if (!purchaseOrder && !isLoading) {
    return (
      <PageLayout
        title="Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Procurement', href: '/procurement' },
          { label: 'Purchase Orders', href: '/procurement/purchase-orders' },
          { label: 'Not Found' },
        ]}
      >
        <EmptyState
          title="Purchase Order Not Found"
          description="The requested purchase order could not be found."
          primaryAction={{
            label: "Back to Purchase Orders",
            onClick: () => navigate('/procurement/purchase-orders')
          }}
          variant="error"
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isLoading ? 'Loading...' : purchaseOrder?.poNumber || ''}
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Procurement', href: '/procurement' },
        { label: 'Purchase Orders', href: '/procurement/purchase-orders' },
        { label: isLoading ? 'Loading...' : purchaseOrder?.poNumber || '' },
      ]}
      headerActions={!isLoading && renderActionButtons()}
    >
      {/* Loading skeleton */}
      {isLoading ? (
        renderSkeleton()
      ) : (
        <>
          {/* Error Message */}
          {error && (
            <ErrorMessage
              title="Action Failed"
              message={error}
              variant="inline"
              type="error"
              onDismiss={handleDismissError}
            />
          )}

          {/* Order Status */}
          <div className={styles.detailSubtitle}>
            <StatusBadge
              label={formatStatus(purchaseOrder!.status)}
              variant={getStatusVariant(purchaseOrder!.status)}
            />
            <span style={{ marginLeft: 'var(--spacing-2)' }}>
              Created on {formatDate(purchaseOrder!.orderDate)}
            </span>
          </div>

          {canShowCloseWorkflow(purchaseOrder!.status) && closeGuard && (
            <div className={styles.closeGuardPanel}>
              <div className={styles.closeGuardHeader}>
                <strong>Close Readiness:</strong>{' '}
                <span>{closeGuard.canClose ? 'Ready to close' : 'Not ready to close'}</span>
              </div>
              {!closeGuard.canClose && closeGuard.reasons.length > 0 && (
                <ul className={styles.closeGuardList}>
                  {closeGuard.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Order Details Card */}
          <div className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Order Details</h2>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Vendor</span>
                <span className={styles.detailValue}>{purchaseOrder!.vendorName}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cost Center</span>
                <span className={styles.detailValue}>{purchaseOrder!.costCenterCode}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Requested By</span>
                <span className={styles.detailValue}>{purchaseOrder!.requesterName}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Order Date</span>
                <span className={styles.detailValue}>{formatDate(purchaseOrder!.orderDate)}</span>
              </div>

              {purchaseOrder!.approverName && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Approved By</span>
                  <span className={styles.detailValue}>{purchaseOrder!.approverName}</span>
                </div>
              )}
              {purchaseOrder!.approvedDate && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Approved Date</span>
                  <span className={styles.detailValue}>{formatDate(purchaseOrder!.approvedDate)}</span>
                </div>
              )}
              {purchaseOrder!.sentDate && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Sent Date</span>
                  <span className={styles.detailValue}>{formatDate(purchaseOrder!.sentDate)}</span>
                </div>
              )}
              {purchaseOrder!.expectedDeliveryDate && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Expected Delivery</span>
                  <span className={styles.detailValue}>
                    {formatDate(purchaseOrder!.expectedDeliveryDate)}
                  </span>
                </div>
              )}
              {purchaseOrder!.notes && (
                <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                  <span className={styles.detailLabel}>Notes</span>
                  <span className={styles.detailValue}>{purchaseOrder!.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Card */}
          <div className={styles.detailCard}>
            <POLineEditor
              lines={editableLines}
              onAddLine={() => {}}
              onUpdateLine={() => {}}
              onRemoveLine={() => {}}
              readOnly={true}
              showQuantityReceived={true}
            />
          </div>

          {/* Totals Card */}
          <div className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Order Totals</h2>
            <div className={styles.totalsContainer}>
              <div className={styles.totalsRow}>
                <span className={styles.totalsLabel}>Subtotal</span>
                <span>{formatCurrency(purchaseOrder!.subtotal)}</span>
              </div>
              <div className={styles.totalsRow}>
                <span className={styles.totalsLabel}>Tax</span>
                <span>{formatCurrency(purchaseOrder!.taxAmount)}</span>
              </div>
              <div className={styles.totalsRow}>
                <span className={styles.totalsLabel}>Shipping</span>
                <span>{formatCurrency(purchaseOrder!.shippingAmount)}</span>
              </div>
              <div className={styles.totalsFinalRow}>
                <span>Total</span>
                <span>{formatCurrency(purchaseOrder!.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Status History Card */}
          <div className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Status History</h2>
            {renderStatusHistory(purchaseOrder!.statusHistory)}
          </div>

          {/* Modals */}
          <Modal
            isOpen={showApproveModal}
            onClose={() => {
              setShowApproveModal(false);
              setActionNotes('');
            }}
            title="Approve Purchase Order"
          >
            <p className={styles.modalDescription}>
              Are you sure you want to approve {purchaseOrder!.poNumber}?
            </p>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Add notes (optional)..."
              className={styles.formTextarea}
              style={{ marginBottom: 'var(--spacing-4)' }}
              rows={3}
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowApproveModal(false);
                  setActionNotes('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleApprove}
                disabled={isActionLoading}
                isLoading={isActionLoading}
              >
                Approve
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={showRejectModal}
            onClose={() => {
              setShowRejectModal(false);
              setActionNotes('');
            }}
            title="Reject Purchase Order"
          >
            <p className={styles.modalDescription}>
              Please provide a reason for rejecting {purchaseOrder!.poNumber}.
            </p>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Please provide a reason (required)..."
              className={styles.formTextarea}
              style={{ marginBottom: 'var(--spacing-4)' }}
              rows={3}
              required
              aria-required="true"
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setActionNotes('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={isActionLoading || !actionNotes.trim()}
                isLoading={isActionLoading}
              >
                Reject
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={showCancelModal}
            onClose={() => {
              setShowCancelModal(false);
              setActionNotes('');
            }}
            title="Cancel Purchase Order"
          >
            <p className={styles.modalDescription}>
              Are you sure you want to cancel {purchaseOrder!.poNumber}? This action cannot be undone.
            </p>
            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder="Add notes (optional)..."
              className={styles.formTextarea}
              style={{ marginBottom: 'var(--spacing-4)' }}
              rows={3}
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCancelModal(false);
                  setActionNotes('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleCancel}
                disabled={isActionLoading}
                isLoading={isActionLoading}
              >
                Cancel Order
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={showReceiptAccountingModal}
            onClose={() => {
              setShowReceiptAccountingModal(false);
              setReceiptIdInput('');
              setReceiptNumberInput('');
            }}
            title="Post Receipt Accounting"
          >
            <p className={styles.modalDescription}>
              Post receipt accrual entries for {purchaseOrder!.poNumber}.
            </p>
            <input
              type="text"
              value={receiptIdInput}
              onChange={(e) => setReceiptIdInput(e.target.value)}
              placeholder="Receipt ID (UUID)"
              className={styles.formInput}
              style={{ marginBottom: 'var(--spacing-3)' }}
            />
            <input
              type="text"
              value={receiptNumberInput}
              onChange={(e) => setReceiptNumberInput(e.target.value)}
              placeholder="Receipt Number (optional)"
              className={styles.formInput}
              style={{ marginBottom: 'var(--spacing-4)' }}
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowReceiptAccountingModal(false);
                  setReceiptIdInput('');
                  setReceiptNumberInput('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePostReceiptAccounting}
                disabled={isActionLoading || !receiptIdInput.trim()}
                isLoading={isActionLoading}
              >
                Post Receipt Accounting
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={showInvoiceAccountingModal}
            onClose={() => {
              setShowInvoiceAccountingModal(false);
              setInvoiceIdInput('');
              setInvoiceNumberInput('');
            }}
            title="Post Invoice Accounting"
          >
            <p className={styles.modalDescription}>
              Post invoice liability entries for {purchaseOrder!.poNumber}.
            </p>
            <input
              type="text"
              value={invoiceIdInput}
              onChange={(e) => setInvoiceIdInput(e.target.value)}
              placeholder="Invoice ID (UUID)"
              className={styles.formInput}
              style={{ marginBottom: 'var(--spacing-3)' }}
            />
            <input
              type="text"
              value={invoiceNumberInput}
              onChange={(e) => setInvoiceNumberInput(e.target.value)}
              placeholder="Invoice Number (optional)"
              className={styles.formInput}
              style={{ marginBottom: 'var(--spacing-4)' }}
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowInvoiceAccountingModal(false);
                  setInvoiceIdInput('');
                  setInvoiceNumberInput('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handlePostInvoiceAccounting}
                disabled={isActionLoading || !invoiceIdInput.trim()}
                isLoading={isActionLoading}
              >
                Post Invoice Accounting
              </Button>
            </div>
          </Modal>

          <Modal
            isOpen={showCloseModal}
            onClose={() => {
              setShowCloseModal(false);
              setCloseNotesInput('');
            }}
            title="Close Purchase Order"
          >
            <p className={styles.modalDescription}>
              Close {purchaseOrder!.poNumber} after accounting checks are complete.
            </p>
            <textarea
              value={closeNotesInput}
              onChange={(e) => setCloseNotesInput(e.target.value)}
              placeholder="Close notes (optional)..."
              className={styles.formTextarea}
              style={{ marginBottom: 'var(--spacing-4)' }}
              rows={3}
            />
            <div className={styles.modalActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCloseModal(false);
                  setCloseNotesInput('');
                }}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleClosePO}
                disabled={isActionLoading || isCloseGuardLoading || (closeGuard !== null && !closeGuard.canClose)}
                isLoading={isActionLoading}
              >
                Close PO
              </Button>
            </div>
          </Modal>
        </>
      )}
    </PageLayout>
  );
}

export default PurchaseOrderDetailPage;
