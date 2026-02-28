import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageLayout } from '../../components/layout/PageLayout';
import { Button } from '../../components/ui/Button';
import { StatusBadge, type StatusVariant } from '../../components/ui/StatusBadge';
import { procurementApi, type RequisitionStatus, type RequisitionSummary } from '../../services/procurement-api';
import { formatDate } from '../../utils/formatters';

import styles from './RequisitionsPage.module.css';

function getStatusVariant(status: RequisitionStatus): StatusVariant {
  switch (status) {
    case 'DRAFT':
      return 'draft';
    case 'PENDING_APPROVAL':
      return 'pending_approval';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'PARTIALLY_CONVERTED':
      return 'warning';
    case 'CONVERTED':
      return 'success';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'info';
  }
}

function formatStatus(status: RequisitionStatus): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

const STATUS_OPTIONS: Array<{ value: RequisitionStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'PARTIALLY_CONVERTED', label: 'Partially Converted' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function RequisitionsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RequisitionSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await procurementApi.requisitions.list(
        {
          status: statusFilter || undefined,
          search: search || undefined,
        },
        { page: 1, pageSize: 100, sortBy: 'createdAt', sortOrder: 'desc' }
      );

      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requisitions');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageLayout
      title="Requisitions"
      description="Create and manage procurement requisitions"
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Procurement', href: '/procurement' },
        { label: 'Requisitions' },
      ]}
      headerActions={
        <Button variant="primary" onClick={() => navigate('/procurement/requisitions/new')}>
          New Requisition
        </Button>
      }
    >
      <div className={styles.controls}>
        <input
          className={styles.input}
          type="text"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search requisition number"
          aria-label="Search requisitions"
        />
        <select
          className={styles.select}
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as RequisitionStatus | '')}
          aria-label="Filter requisitions by status"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <p>Loading requisitions...</p>
      ) : items.length === 0 ? (
        <p>No requisitions found.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Requisition</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Need By</th>
              <th>Currency</th>
              <th>Legal Entity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.requisitionId}>
                <td>{item.requisitionNumber}</td>
                <td>
                  <StatusBadge
                    label={formatStatus(item.status)}
                    variant={getStatusVariant(item.status)}
                  />
                </td>
                <td>{item.requestedDate ? formatDate(item.requestedDate) : '-'}</td>
                <td>{item.needByDate ? formatDate(item.needByDate) : '-'}</td>
                <td>{item.currency}</td>
                <td>{item.legalEntity || '-'}</td>
                <td className={styles.actions}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate(`/procurement/requisitions/${item.requisitionId}`)}
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageLayout>
  );
}

export default RequisitionsPage;
