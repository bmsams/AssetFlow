import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listDisposals,
  recordDestruction,
  type DisposalRequest,
} from '../../services/ham-api';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'pending' | 'approved' | 'completed';

export function DisposalPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [disposals, setDisposals] = useState<DisposalRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchDisposals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const result = await listDisposals(status);
      setDisposals(result);
    } catch {
      setError('Failed to load disposal requests. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDisposals();
  }, [fetchDisposals]);

  const handleRecordDestruction = async (disposalId: string) => {
    try {
      await recordDestruction(disposalId);
      await fetchDisposals();
    } catch {
      setError('Failed to record destruction. Please try again.');
    }
  };

  return (
    <PageLayout
      title="Disposal"
      description="Manage asset disposal requests and destruction records"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Disposal' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="disposal-status-filter" style={{ marginRight: 'var(--spacing-2)' }}>
            Status:
          </label>
          <select
            id="disposal-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchDisposals }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading disposal requests...</p>
          </div>
        )}

        {!isLoading && !error && disposals.length === 0 && (
          <EmptyState
            title="No disposal requests"
            description="No disposal requests match the current filter."
          />
        )}

        {!isLoading && !error && disposals.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Disposal requests">
            <thead>
              <tr>
                <th scope="col">Asset Tag</th>
                <th scope="col">Reason</th>
                <th scope="col">Method</th>
                <th scope="col">Status</th>
                <th scope="col">Initiated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disposals.map((d) => (
                <tr key={d.disposalId}>
                  <td>{d.assetTag}</td>
                  <td>{d.reason}</td>
                  <td>{d.method}</td>
                  <td>{d.status}</td>
                  <td>{new Date(d.initiatedAt).toLocaleDateString()}</td>
                  <td>
                    {d.status === 'approved' && (
                      <button onClick={() => handleRecordDestruction(d.disposalId)}>
                        Record Destruction
                      </button>
                    )}
                    {d.status === 'completed' && d.certificateUrl && (
                      <a href={d.certificateUrl} target="_blank" rel="noopener noreferrer">
                        Certificate
                      </a>
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
