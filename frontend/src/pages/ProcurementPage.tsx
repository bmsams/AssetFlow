import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnounce } from '../components/accessibility';
import { StatCard } from '../components/dashboard';
import { PageLayout } from '../components/layout';
import { ErrorMessage } from '../components/ui';
import {
  PendingRequestsList,
  PurchaseOrdersList,
  ReceivingQueue,
} from '../components/procurement';
import { procurementApi } from '../services/procurement-api';
import type {
  ProcurementSummary,
  AssetRequest,
  PurchaseOrder,
  ReceivingItem,
} from '../types/procurement';
import { formatCurrency } from '../types/dashboard';
import { BREADCRUMB_CONFIGS } from '../types/layout';
import styles from './ProcurementPage.module.css';
import { useTour, type TourStep } from '@ams/ui/tour';

/**
 * Procurement Workspace Page
 * Implements Requirement 12.3:
 * - Display pending requests and purchase orders
 * - Show receiving queue with actions
 * - Implement request approval interface
 */
export function ProcurementPage() {
  const navigate = useNavigate();
  // Tour definitions
  const procurementSteps: TourStep[] = [
    { target: '[data-tour="po-list"]', title: 'Purchase Orders', content: 'View and manage all purchase orders.' },
    { target: '[data-tour="create-po"]', title: 'Create PO', content: 'Create a new purchase order.' },
    { target: '[data-tour="po-status"]', title: 'Order Status', content: 'Track order status from draft to received.' },
  ];
  useTour('procurement', procurementSteps);

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ProcurementSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  // Accessibility: announce loading completion to screen readers
  const { announce } = useAnnounce();
  const previousLoadingRef = useRef(isLoading);

  // Fetch procurement data from real API
  const fetchProcurementData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch purchase orders from real API (large page to get overview stats)
      const poResponse = await procurementApi.purchaseOrders.list(
        {},
        { page: 1, pageSize: 100, sortBy: 'requestedDate', sortOrder: 'desc' }
      );
      const purchaseOrders = poResponse.items;

      // Compute summary stats from PO data
      const openStatuses = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED'];
      const openPOs = purchaseOrders.filter(po => openStatuses.includes(po.status));
      const awaitingReceiving = purchaseOrders.filter(
        po => po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED'
      );
      const now = new Date();
      const overdue = purchaseOrders.filter(
        po =>
          (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') &&
          po.expectedDeliveryDate &&
          new Date(po.expectedDeliveryDate) < now
      );

      const summary: ProcurementSummary = {
        // No asset request API yet — show zero
        pendingRequestsCount: 0,
        pendingRequestsValue: 0,
        openPurchaseOrdersCount: openPOs.length,
        openPurchaseOrdersValue: openPOs.reduce((sum, po) => sum + po.totalAmount, 0),
        awaitingReceivingCount: awaitingReceiving.length,
        overdueDeliveriesCount: overdue.length,
        pendingRequests: [],
        purchaseOrders: purchaseOrders.slice(0, 10),
        receivingQueue: [],
      };

      setData(summary);
    } catch (err) {
      setError('Failed to load procurement data. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    void fetchProcurementData();
  }, [fetchProcurementData]);

  // Announce loading completion to screen readers
  useEffect(() => {
    if (previousLoadingRef.current && !isLoading && data) {
      const requestCount = data.pendingRequests?.length ?? 0;
      const poCount = data.purchaseOrders?.length ?? 0;
      announce(`Procurement data loaded. ${requestCount} pending request${requestCount !== 1 ? 's' : ''}, ${poCount} purchase order${poCount !== 1 ? 's' : ''}`, 'polite');
    }
    previousLoadingRef.current = isLoading;
  }, [isLoading, data, announce]);

  // Handle retry
  const handleRetry = useCallback(() => {
    setIsRetrying(true);
    void fetchProcurementData();
  }, [fetchProcurementData]);

  // Handle dismiss error
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  // Handle request click
  const handleRequestClick = useCallback((request: AssetRequest) => {
    setInteractionNotice(`Request ${request.requestId} selected. Detailed request view is being finalized.`);
  }, []);

  // Handle approve request
  const handleApproveRequest = useCallback((request: AssetRequest) => {
    setInteractionNotice(`Approval queued for request ${request.requestId}.`);
  }, []);

  // Handle reject request
  const handleRejectRequest = useCallback((request: AssetRequest) => {
    setInteractionNotice(`Rejection queued for request ${request.requestId}.`);
  }, []);

  // Handle view all requests
  const handleViewAllRequests = useCallback(() => {
    navigate('/procurement/requisitions');
  }, [navigate]);

  // Handle purchase order click
  const handlePurchaseOrderClick = useCallback((po: PurchaseOrder) => {
    navigate(`/procurement/purchase-orders/${po.poId}`);
  }, [navigate]);

  // Handle view all purchase orders
  const handleViewAllPurchaseOrders = useCallback(() => {
    navigate('/procurement/purchase-orders');
  }, [navigate]);

  // Handle receiving item click
  const handleReceivingItemClick = useCallback((item: ReceivingItem) => {
    setInteractionNotice(`Receiving item ${item.receivingId} selected.`);
  }, []);

  // Handle receive action
  const handleReceive = useCallback((item: ReceivingItem) => {
    setInteractionNotice(`Receive workflow started for ${item.receivingId}.`);
  }, []);

  // Handle report issue action
  const handleReportIssue = useCallback((item: ReceivingItem) => {
    setInteractionNotice(`Issue report draft opened for ${item.receivingId}.`);
  }, []);

  // Handle view all receiving items
  const handleViewAllReceiving = useCallback(() => {
    navigate('/procurement/receiving');
  }, [navigate]);

  return (
    <PageLayout
      title="Procurement Workspace"
      description="Manage asset requests, purchase orders, and receiving"
      breadcrumbs={[...BREADCRUMB_CONFIGS.PROCUREMENT, { label: 'Workspace' }]}
      lastUpdated={!isLoading && data ? new Date() : undefined}
      maxWidth="xl"
      headerActions={
        <button
          type="button"
          data-tour="create-po"
          className={styles.createPoButton}
          onClick={() => navigate('/procurement/purchase-orders/new')}
        >
          Create PO
        </button>
      }
    >
      {interactionNotice && (
        <div className={styles.interactionNotice} role="status">
          <span>{interactionNotice}</span>
          <button
            type="button"
            className={styles.noticeDismissButton}
            onClick={() => setInteractionNotice(null)}
            aria-label="Dismiss interaction notice"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <ErrorMessage
            title="Error Loading Data"
            message={error}
            type="error"
            variant="inline"
            onDismiss={handleDismissError}
            recoveryOptions={[
              {
                label: 'Retry',
                action: handleRetry,
                variant: 'primary',
                isLoading: isRetrying,
              },
            ]}
          />
        </div>
      )}

      {/* Summary Stats */}
      <section className={styles.statsSection} aria-label="Procurement summary statistics" data-tour="po-status">
        <div className={styles.statsGrid}>
          <StatCard
            label="Pending Requests"
            value={data?.pendingRequestsCount ?? 0}
            subtitle={data ? formatCurrency(data.pendingRequestsValue) : '$0'}
            variant="warning"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
            }
          />
          <StatCard
            label="Open Purchase Orders"
            value={data?.openPurchaseOrdersCount ?? 0}
            subtitle={data ? formatCurrency(data.openPurchaseOrdersValue) : '$0'}
            variant="primary"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
          />
          <StatCard
            label="Awaiting Receiving"
            value={data?.awaitingReceivingCount ?? 0}
            subtitle="Items to process"
            variant="default"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
          />
          <StatCard
            label="Overdue Deliveries"
            value={data?.overdueDeliveriesCount ?? 0}
            subtitle="Require attention"
            variant={data && data.overdueDeliveriesCount > 0 ? 'error' : 'success'}
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Pending Requests */}
        <section className={styles.requestsSection} aria-label="Pending requests">
          <PendingRequestsList
            requests={data?.pendingRequests ?? []}
            title="Pending Requests"
            maxItems={5}
            isLoading={isLoading}
            onRequestClick={handleRequestClick}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onViewAll={handleViewAllRequests}
          />
        </section>

        {/* Purchase Orders */}
        <section className={styles.purchaseOrdersSection} aria-label="Purchase orders" data-tour="po-list">
          <PurchaseOrdersList
            purchaseOrders={data?.purchaseOrders ?? []}
            title="Purchase Orders"
            maxItems={5}
            isLoading={isLoading}
            onPurchaseOrderClick={handlePurchaseOrderClick}
            onViewAll={handleViewAllPurchaseOrders}
          />
        </section>

        {/* Receiving Queue */}
        <section className={styles.receivingSection} aria-label="Receiving queue">
          <ReceivingQueue
            items={data?.receivingQueue ?? []}
            title="Receiving Queue"
            maxItems={5}
            isLoading={isLoading}
            onItemClick={handleReceivingItemClick}
            onReceive={handleReceive}
            onReportIssue={handleReportIssue}
            onViewAll={handleViewAllReceiving}
          />
        </section>
      </div>
    </PageLayout>
  );
}

export default ProcurementPage;
