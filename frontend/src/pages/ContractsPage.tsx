import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EmptyState } from '../components/ui/EmptyState';
import { getContracts } from '../services/contracts-api';
import type { Contract } from '../services/contracts-api';
import styles from './Page.module.css';

export function ContractsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getContracts();
      setContracts(result.contracts);
    } catch (err) {
      setError('Failed to load contracts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  return (
    <PageLayout
      title="Contracts"
      description="Manage vendor contracts, warranties, and service agreements"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Contracts' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        {error && (
          <ErrorMessage
            title="Error Loading Contracts"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[
              { label: 'Retry', action: fetchContracts }
            ]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading contracts...</p>
          </div>
        )}

        {!isLoading && !error && contracts.length === 0 && (
          <EmptyState
            title="No contracts found"
            description="Add your first contract to track vendor agreements."
          />
        )}

        {!isLoading && !error && contracts.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Contracts list">
            <thead>
              <tr>
                <th scope="col">Contract #</th>
                <th scope="col">Vendor</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Start Date</th>
                <th scope="col">End Date</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.contractId}>
                  <td>{contract.contractNumber}</td>
                  <td>{contract.vendorName ?? contract.vendorId}</td>
                  <td>{contract.contractType}</td>
                  <td>{contract.status}</td>
                  <td>{new Date(contract.startDate).toLocaleDateString()}</td>
                  <td>{new Date(contract.endDate).toLocaleDateString()}</td>
                  <td>${contract.totalValue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
