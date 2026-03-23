import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { EmptyState } from '../components/ui/EmptyState';
import { DataTable } from '@ams/ui';
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
    void fetchContracts();
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

        {!isLoading && !error && contracts.length === 0 && (
          <EmptyState
            title="No contracts found"
            description="Add your first contract to track vendor agreements."
          />
        )}

        {(isLoading || (!error && contracts.length > 0)) && (
          <DataTable data={contracts} keyField="contractId" loading={isLoading}>
            <DataTable.Toolbar>
              <DataTable.Search placeholder="Search contracts..." />
            </DataTable.Toolbar>
            <DataTable.Column
              id="contractNumber"
              header="Contract #"
              accessor="contractNumber"
              sortable
            />
            <DataTable.Column
              id="vendor"
              header="Vendor"
              accessor="vendorName"
              sortable
              render={(val: string | null, row: Contract) => val ?? row.vendorId}
            />
            <DataTable.Column
              id="contractType"
              header="Type"
              accessor="contractType"
              sortable
            />
            <DataTable.Column
              id="status"
              header="Status"
              accessor="status"
              sortable
            />
            <DataTable.Column
              id="startDate"
              header="Start Date"
              accessor="startDate"
              sortable
              render={(val: string) => new Date(val).toLocaleDateString()}
            />
            <DataTable.Column
              id="endDate"
              header="End Date"
              accessor="endDate"
              sortable
              render={(val: string) => new Date(val).toLocaleDateString()}
            />
            <DataTable.Column
              id="totalValue"
              header="Value"
              accessor="totalValue"
              sortable
              render={(val: number) => `$${val.toLocaleString()}`}
            />
            <DataTable.Pagination showTotal />
          </DataTable>
        )}
      </div>
    </PageLayout>
  );
}
