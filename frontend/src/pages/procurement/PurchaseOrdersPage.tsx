import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { procurementApi, type POListFilters } from '../../services/procurement-api';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../types/procurement';
import { formatStatus } from '../../types/procurement';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { StatCard } from '../../components/dashboard';
import { PageLayout } from '../../components/layout/PageLayout';
import { FilterToolbar, type FilterOption } from '../../components/ui/FilterToolbar';
import { ResponsiveTable } from '../../components/ui/ResponsiveTable';
import { StatusBadge, type StatusVariant } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Button } from '../../components/ui/Button';
import styles from './PurchaseOrdersPage.module.css';

const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SENT', label: 'Sent to Vendor' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially Received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function getStatusVariant(status: PurchaseOrderStatus): StatusVariant {
  switch (status) {
    case 'DRAFT': return 'draft';
    case 'PENDING_APPROVAL': return 'pending_approval';
    case 'APPROVED': return 'approved';
    case 'REJECTED': return 'rejected';
    case 'SENT': return 'sent';
    case 'PARTIALLY_RECEIVED': return 'partially_received';
    case 'RECEIVED': return 'received';
    case 'CLOSED': return 'closed';
    case 'CANCELLED': return 'cancelled';
    default: return 'info';
  }
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [openOrdersValue, setOpenOrdersValue] = useState(0);

  const fetchPurchaseOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setIsRetrying(false);
      const filters: POListFilters = {};
      if (searchQuery) filters.search = searchQuery;
      if (statusFilter) filters.status = statusFilter;
      if (fromDate) filters.fromDate = fromDate;
      if (toDate) filters.toDate = toDate;
      const response = await procurementApi.purchaseOrders.list(filters, { page: currentPage, pageSize: 20, sortBy: 'requestedDate', sortOrder: 'desc' });
      setPurchaseOrders(response.items);
      setTotalPages(response.totalPages);
      setTotalOrders(response.total);
      const drafts = response.items.filter((po) => po.status === 'DRAFT');
      const pending = response.items.filter((po) => po.status === 'PENDING_APPROVAL');
      const openOrders = response.items.filter((po) => !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status));
      setDraftCount(drafts.length);
      setPendingApprovalCount(pending.length);
      setOpenOrdersValue(openOrders.reduce((sum, po) => sum + po.totalAmount, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchPurchaseOrders(); }, [fetchPurchaseOrders]);
  const handleSearchChange = useCallback((value: string) => { setSearchQuery(value); }, []);
  const handleSearchSubmit = useCallback(() => { setCurrentPage(1); fetchPurchaseOrders(); }, [fetchPurchaseOrders]);
  const handlePOClick = (po: PurchaseOrder) => { navigate(`/procurement/purchase-orders/${po.poId}`); };
  const handleCreatePO = () => { navigate('/procurement/purchase-orders/new'); };
  const handleClearFilters = () => { setSearchQuery(''); setStatusFilter(''); setFromDate(''); setToDate(''); setCurrentPage(1); fetchPurchaseOrders(); };
  const handleFilterChange = (id: string, value: unknown) => {
    if (id === 'status') setStatusFilter(value as PurchaseOrderStatus | '');
    else if (id === 'fromDate') setFromDate(value as string);
    else if (id === 'toDate') setToDate(value as string);
    setCurrentPage(1);
    fetchPurchaseOrders();
  };
  const handleRetry = () => { setIsRetrying(true); fetchPurchaseOrders(); };
  const handleDismissError = () => { setError(null); };
  const filterValues = { status: statusFilter, fromDate: fromDate, toDate: toDate };
  const hasActiveFilters = Boolean(searchQuery || statusFilter || fromDate || toDate);
  const headerActions = (<Button variant="primary" onClick={handleCreatePO}>Create Purchase Order</Button>);

  return (
    <PageLayout title="Purchase Orders" description="Manage purchase orders" headerActions={headerActions} breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Procurement', href: '/procurement' }, { label: 'Purchase Orders' }]}>
      <div className={styles.statsGrid}>
        <StatCard label="Total Orders" value={totalOrders} subtitle="All purchase orders" variant="primary" isLoading={isLoading} />
        <StatCard label="Draft Orders" value={draftCount} subtitle="Not yet submitted" variant="default" isLoading={isLoading} />
        <StatCard label="Pending Approval" value={pendingApprovalCount} subtitle="Awaiting review" variant="warning" isLoading={isLoading} />
        <StatCard label="Open Orders Value" value={formatCurrency(openOrdersValue)} subtitle="Total pending value" variant="success" isLoading={isLoading} />
      </div>
      <FilterToolbar search={{ placeholder: "Search...", value: searchQuery, onChange: handleSearchChange, onSubmit: handleSearchSubmit }} filters={[{ id: 'status', type: 'select', label: 'Status', options: STATUS_OPTIONS, placeholder: 'All Statuses' }, { id: 'fromDate', type: 'date', label: 'From Date' }, { id: 'toDate', type: 'date', label: 'To Date' }]} filterValues={filterValues} onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} hasActiveFilters={hasActiveFilters} className={styles.filterToolbar} />
      {error && <ErrorMessage title="Failed to load purchase orders" message={error} variant="inline" type="error" recoveryOptions={[{ label: "Retry", action: handleRetry, isLoading: isRetrying }]} onDismiss={handleDismissError} />}
      {isLoading ? (<div className={styles.tableContainer}><p>Loading...</p></div>) : error ? null : purchaseOrders.length === 0 ? (hasActiveFilters ? <EmptyState variant="filtered" title="No purchase orders match" description="Try adjusting filters." primaryAction={{ label: "Clear Filters", onClick: handleClearFilters }} /> : <EmptyState title="No purchase orders" description="Create your first purchase order." primaryAction={{ label: "Create Purchase Order", onClick: handleCreatePO }} />) : (
        <ResponsiveTable aria-label="Purchase orders table">
          <table className={styles.table}>
            <thead><tr><th>PO Number</th><th>Vendor</th><th>Status</th><th>Total Amount</th><th>Items</th><th>Requested Date</th><th>Expected Delivery</th><th>Actions</th></tr></thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr key={po.poId} onClick={() => handlePOClick(po)} className={styles.clickableRow}>
                  <td className={styles.codeCell}>{po.poNumber}</td>
                  <td>{po.vendorName}</td>
                  <td><StatusBadge label={formatStatus(po.status)} variant={getStatusVariant(po.status)} /></td>
                  <td className={styles.amountCell}>{formatCurrency(po.totalAmount)}</td>
                  <td>{po.receivedCount}/{po.totalCount}</td>
                  <td>{formatDate(po.orderDate)}</td>
                  <td>{po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : '-'}</td>
                  <td><button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); navigate(`/procurement/purchase-orders/${po.poId}`); }} aria-label="View">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
      {totalPages > 1 && (<div className={styles.pagination}><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className={styles.paginationButton}>Previous</button><span className={styles.paginationInfo}>Page {currentPage} of {totalPages}</span><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className={styles.paginationButton}>Next</button></div>)}
    </PageLayout>
  );
}

export default PurchaseOrdersPage;

