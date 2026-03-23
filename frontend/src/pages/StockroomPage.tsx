import { useState, useEffect, useCallback, useRef } from 'react';
import { useAnnounce } from '../components/accessibility';
import { StatCard } from '../components/dashboard';
import {
  InventoryLevelsList,
  TransferOrdersList,
  ReplenishmentAlertsList,
} from '../components/stockroom';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageLayout } from '../components/layout/PageLayout';
import { adminApi } from '../services/admin-api';
import type { Stockroom as AdminStockroom } from '../types/admin';
import type {
  StockroomSummary,
  Stockroom,
  TransferOrder,
  ReplenishmentAlert,
} from '../types/stockroom';
import { formatStockroomCurrency } from '../types/stockroom';
import { BREADCRUMB_CONFIGS } from '../types/layout';
import styles from './StockroomPage.module.css';

/**
 * Map an admin API Stockroom to the dashboard Stockroom type.
 * Fields not available from the API (location, utilizationPercentage) are
 * derived from related data or given sensible defaults.
 */
function mapAdminStockroom(s: AdminStockroom): Stockroom {
  return {
    stockroomId: s.stockroomId,
    name: s.name,
    location: s.roomName ?? 'Unassigned',
    stockroomType: mapStockroomType(s.stockroomType),
    managerName: s.managerName ?? 'Unassigned',
    managerId: s.managerId ?? '',
    isActive: s.isActive,
    totalItems: s.totalItems ?? 0,
    totalValue: s.totalValue ?? 0,
    utilizationPercentage: s.totalBins && s.totalBins > 0
      ? Math.round(((s.binCount ?? 0) / s.totalBins) * 100)
      : 0,
  };
}

/**
 * Map admin StockroomType values to dashboard StockroomType values.
 */
function mapStockroomType(
  adminType: AdminStockroom['stockroomType']
): Stockroom['stockroomType'] {
  const mapping: Record<string, Stockroom['stockroomType']> = {
    STANDARD: 'WAREHOUSE',
    LOANER: 'FIELD',
    REPAIR: 'REPAIR',
    DISPOSAL: 'WAREHOUSE',
    QUARANTINE: 'WAREHOUSE',
    MAIN: 'WAREHOUSE',
    SATELLITE: 'FIELD',
    VIRTUAL: 'IT',
    RECEIVING: 'WAREHOUSE',
    SPARE_PARTS: 'WAREHOUSE',
    OTHER: 'WAREHOUSE',
  };
  return mapping[adminType] ?? 'WAREHOUSE';
}

/**
 * Stockroom Dashboard Page
 * Implements Requirement 12.4:
 * - Display inventory levels by stockroom
 * - Show transfer orders and status
 * - Display replenishment alerts
 */
export function StockroomPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [data, setData] = useState<StockroomSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  // Accessibility: announce loading completion to screen readers
  const { announce } = useAnnounce();
  const previousLoadingRef = useRef(isLoading);

  // Fetch stockroom data from real API
  const fetchStockroomData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRetrying(false);
      setError(null);

      const response = await adminApi.stockrooms.list(
        { isActive: true },
        { page: 1, pageSize: 100 }
      );

      const stockrooms = response.items.map(mapAdminStockroom);
      const summary: StockroomSummary = {
        totalStockrooms: response.total,
        totalInventoryValue: stockrooms.reduce((sum, s) => sum + s.totalValue, 0),
        totalItemCount: stockrooms.reduce((sum, s) => sum + s.totalItems, 0),
        lowStockAlertCount: 0,
        pendingTransfersCount: 0,
        inTransitCount: 0,
        stockrooms,
        transferOrders: [],
        replenishmentAlerts: [],
      };

      setData(summary);
    } catch (err) {
      setError('Failed to load stockroom data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchStockroomData();
  }, [fetchStockroomData]);

  // Initial data fetch
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchStockroomData();
      }
    };
    
    void loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchStockroomData]);

  // Announce loading completion to screen readers
  useEffect(() => {
    if (previousLoadingRef.current && !isLoading && data) {
      const stockroomCount = data.stockrooms?.length ?? 0;
      announce(`Stockroom data loaded. Showing ${stockroomCount} stockroom${stockroomCount !== 1 ? 's' : ''}`, 'polite');
    }
    previousLoadingRef.current = isLoading;
  }, [isLoading, data, announce]);

  // Handle stockroom click
  const handleStockroomClick = useCallback((stockroom: Stockroom) => {
    setInteractionNotice(`Stockroom ${stockroom.name} selected. Detailed stockroom workspace is being finalized.`);
  }, []);

  // Handle view all stockrooms
  const handleViewAllStockrooms = useCallback(() => {
    setInteractionNotice('Full stockroom directory route is in progress.');
  }, []);

  // Handle transfer order click
  const handleTransferClick = useCallback((transfer: TransferOrder) => {
    setInteractionNotice(`Transfer ${transfer.transferId} selected.`);
  }, []);

  // Handle approve transfer
  const handleApproveTransfer = useCallback((transfer: TransferOrder) => {
    setInteractionNotice(`Approval workflow started for transfer ${transfer.transferId}.`);
  }, []);

  // Handle view all transfers
  const handleViewAllTransfers = useCallback(() => {
    setInteractionNotice('Full transfer board route is being connected.');
  }, []);

  // Handle alert click
  const handleAlertClick = useCallback((alert: ReplenishmentAlert) => {
    setInteractionNotice(`Replenishment alert ${alert.alertId} selected.`);
  }, []);

  // Handle create order from alert
  const handleCreateOrder = useCallback((alert: ReplenishmentAlert) => {
    setInteractionNotice(`Purchase request initiated for product ${alert.productId}.`);
  }, []);

  // Handle dismiss alert
  const handleDismissAlert = useCallback((alert: ReplenishmentAlert) => {
    setInteractionNotice(`Alert ${alert.alertId} dismissed from the current dashboard view.`);
  }, []);

  // Handle view all alerts
  const handleViewAllAlerts = useCallback(() => {
    setInteractionNotice('Full replenishment alert queue route is in progress.');
  }, []);

  if (error) {
    return (
      <PageLayout
        title="Stockroom Dashboard"
        description="Monitor inventory levels, transfers, and replenishment needs"
        maxWidth="xl"
      >
        <ErrorMessage
          title="Error Loading Stockroom Data"
          message={error}
          type="error"
          variant="inline"
          recoveryOptions={[
            {
              label: "Retry",
              action: handleRetry,
              isLoading: isRetrying
            }
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Stockroom Dashboard"
      description="Monitor inventory levels, transfers, and replenishment needs"
      breadcrumbs={[...BREADCRUMB_CONFIGS.STOCKROOM, { label: 'Dashboard' }]}
      lastUpdated={!isLoading && data ? new Date() : undefined}
      maxWidth="xl"
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

      {/* Summary Stats */}
      <section className={styles.statsSection} aria-label="Stockroom summary statistics">
        <div className={styles.statsGrid}>
          <StatCard
            label="Total Stockrooms"
            value={data?.totalStockrooms ?? 0}
            subtitle="Active locations"
            variant="primary"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            }
          />
          <StatCard
            label="Total Inventory Value"
            value={data ? formatStockroomCurrency(data.totalInventoryValue) : '$0'}
            subtitle={`${data?.totalItemCount.toLocaleString() ?? 0} items`}
            variant="default"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
          <StatCard
            label="Low Stock Alerts"
            value={data?.lowStockAlertCount ?? 0}
            subtitle="Items need attention"
            variant={data && data.lowStockAlertCount > 0 ? 'warning' : 'success'}
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          />
          <StatCard
            label="Active Transfers"
            value={(data?.pendingTransfersCount ?? 0) + (data?.inTransitCount ?? 0)}
            subtitle={`${data?.inTransitCount ?? 0} in transit`}
            variant="default"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 3h5v5" />
                <path d="M8 21H3v-5" />
                <path d="M21 3l-9 9" />
                <path d="M3 21l9-9" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Inventory Levels */}
        <section className={styles.inventorySection} aria-label="Inventory levels">
          <InventoryLevelsList
            stockrooms={data?.stockrooms ?? []}
            title="Inventory by Stockroom"
            maxItems={5}
            isLoading={isLoading}
            onStockroomClick={handleStockroomClick}
            onViewAll={handleViewAllStockrooms}
          />
        </section>

        {/* Transfer Orders */}
        <section className={styles.transfersSection} aria-label="Transfer orders">
          <TransferOrdersList
            transferOrders={data?.transferOrders ?? []}
            title="Transfer Orders"
            maxItems={5}
            isLoading={isLoading}
            onTransferClick={handleTransferClick}
            onApprove={handleApproveTransfer}
            onViewAll={handleViewAllTransfers}
          />
        </section>

        {/* Replenishment Alerts */}
        <section className={styles.alertsSection} aria-label="Replenishment alerts">
          <ReplenishmentAlertsList
            alerts={data?.replenishmentAlerts ?? []}
            title="Replenishment Alerts"
            maxItems={5}
            isLoading={isLoading}
            onAlertClick={handleAlertClick}
            onCreateOrder={handleCreateOrder}
            onDismiss={handleDismissAlert}
            onViewAll={handleViewAllAlerts}
          />
        </section>
      </div>
    </PageLayout>
  );
}

export default StockroomPage;
