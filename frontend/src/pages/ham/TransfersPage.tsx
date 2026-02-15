import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listTransfers,
  approveTransfer,
  completeTransfer,
  type TransferOrder,
} from '../../services/ham-api';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';

export function TransfersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [transfers, setTransfers] = useState<TransferOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchTransfers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const result = await listTransfers(status);
      setTransfers(result);
    } catch {
      setError('Failed to load transfers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleApprove = async (transferId: string) => {
    try {
      await approveTransfer(transferId);
      await fetchTransfers();
    } catch {
      setError('Failed to approve transfer. Please try again.');
    }
  };

  const handleComplete = async (transferId: string) => {
    try {
      await completeTransfer(transferId);
      await fetchTransfers();
    } catch {
      setError('Failed to complete transfer. Please try again.');
    }
  };

  return (
    <PageLayout
      title="Transfers"
      description="Manage asset transfer orders between stockrooms"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Transfers' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="status-filter" style={{ marginRight: 'var(--spacing-2)' }}>
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="in_transit">In Transit</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchTransfers }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading transfers...</p>
          </div>
        )}

        {!isLoading && !error && transfers.length === 0 && (
          <EmptyState
            title="No transfers found"
            description="No transfer orders match the current filter."
          />
        )}

        {!isLoading && !error && transfers.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Transfer orders">
            <thead>
              <tr>
                <th scope="col">Transfer ID</th>
                <th scope="col">Asset Tag</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Status</th>
                <th scope="col">Requested</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.transferId}>
                  <td>{t.transferId}</td>
                  <td>{t.assetTag}</td>
                  <td>{t.fromStockroomName}</td>
                  <td>{t.toStockroomName}</td>
                  <td>{t.status}</td>
                  <td>{new Date(t.requestedAt).toLocaleDateString()}</td>
                  <td>
                    {t.status === 'pending' && (
                      <button onClick={() => handleApprove(t.transferId)}>Approve</button>
                    )}
                    {(t.status === 'approved' || t.status === 'in_transit') && (
                      <button onClick={() => handleComplete(t.transferId)}>Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
