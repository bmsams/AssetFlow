import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listLoaners,
  returnLoaner,
  type LoanerRecord,
} from '../../services/ham-api';
import styles from '../Page.module.css';

type Tab = 'active' | 'overdue';

export function LoanerManagementPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loaners, setLoaners] = useState<LoanerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('active');

  const fetchLoaners = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = activeTab === 'overdue'
        ? await listLoaners('OVERDUE')
        : await listLoaners('CHECKED_OUT');
      setLoaners(result);
    } catch {
      setError('Failed to load loaners. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    void fetchLoaners();
  }, [fetchLoaners]);

  const handleReturn = async (loanId: string) => {
    try {
      await returnLoaner(loanId);
      await fetchLoaners();
    } catch {
      setError('Failed to return loaner. Please try again.');
    }
  };

  return (
    <PageLayout
      title="Loaner Management"
      description="Track loaner asset checkouts, returns, and overdue items"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Loaners' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <div role="tablist" style={{ marginBottom: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-2)' }}>
          <button
            role="tab"
            aria-selected={activeTab === 'active'}
            onClick={() => setActiveTab('active')}
            style={{ fontWeight: activeTab === 'active' ? 'bold' : 'normal' }}
          >
            Active Loans
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'overdue'}
            onClick={() => setActiveTab('overdue')}
            style={{ fontWeight: activeTab === 'overdue' ? 'bold' : 'normal' }}
          >
            Overdue
          </button>
        </div>

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchLoaners }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading loaners...</p>
          </div>
        )}

        {!isLoading && !error && loaners.length === 0 && (
          <EmptyState
            title={activeTab === 'overdue' ? 'No overdue loans' : 'No active loans'}
            description={activeTab === 'overdue' ? 'All loans are within their return dates.' : 'No loaner assets are currently checked out.'}
          />
        )}

        {!isLoading && !error && loaners.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Loaner records">
            <thead>
              <tr>
                <th scope="col">Asset Tag</th>
                <th scope="col">Borrower</th>
                <th scope="col">Checkout Date</th>
                <th scope="col">Expected Return</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loaners.map((l) => (
                <tr key={l.loanId}>
                  <td>{l.assetTag}</td>
                  <td>{l.borrowerName}</td>
                  <td>{new Date(l.checkoutDate).toLocaleDateString()}</td>
                  <td>{new Date(l.expectedReturnDate).toLocaleDateString()}</td>
                  <td>{l.status}</td>
                  <td>
                    {(l.status === 'CHECKED_OUT' || l.status === 'OVERDUE') && (
                      <button onClick={() => handleReturn(l.loanId)}>Return</button>
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
