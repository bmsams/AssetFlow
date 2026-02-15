import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  checkPartLevels,
  reserveParts,
  consumeParts,
  type PartLevel,
} from '../../services/eam-api';
import styles from '../Page.module.css';

export function PartsInventoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [parts, setParts] = useState<PartLevel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchParts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await checkPartLevels();
      setParts(result);
    } catch {
      setError('Failed to load parts inventory. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const handleReserve = async (partId: string) => {
    const qty = window.prompt('Quantity to reserve:');
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;
    try {
      await reserveParts({ partId, quantity: Number(qty) });
      await fetchParts();
    } catch {
      setError('Failed to reserve parts. Please try again.');
    }
  };

  const handleConsume = async (partId: string) => {
    const qty = window.prompt('Quantity to consume:');
    if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;
    try {
      await consumeParts({ partId, quantity: Number(qty) });
      await fetchParts();
    } catch {
      setError('Failed to consume parts. Please try again.');
    }
  };

  const isLowStock = (part: PartLevel) => part.currentQuantity <= part.minQuantity;
  const lowStockCount = parts.filter(isLowStock).length;

  return (
    <PageLayout
      title="Parts Inventory"
      description="Manage parts levels, reservations, and consumption"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Parts Inventory' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        {lowStockCount > 0 && (
          <div
            role="alert"
            style={{
              padding: 'var(--spacing-3)',
              marginBottom: 'var(--spacing-4)',
              backgroundColor: 'var(--color-error-bg, #fef2f2)',
              border: '1px solid var(--color-error, #dc2626)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>{lowStockCount} part(s) at or below minimum stock level</strong>
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchParts }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading parts inventory...</p>
          </div>
        )}

        {!isLoading && !error && parts.length === 0 && (
          <EmptyState
            title="No parts found"
            description="No parts have been added to inventory yet."
          />
        )}

        {!isLoading && !error && parts.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Parts inventory">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Part Number</th>
                <th scope="col">Current Qty</th>
                <th scope="col">Min / Max</th>
                <th scope="col">Unit Cost</th>
                <th scope="col">Location</th>
                <th scope="col">Last Restocked</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr key={part.partId}>
                  <td>
                    {part.name}
                    {isLowStock(part) && (
                      <span
                        style={{ color: 'var(--color-error, #dc2626)', marginLeft: 'var(--spacing-1)' }}
                        title="Low stock"
                      >
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>{part.partNumber}</td>
                  <td style={isLowStock(part) ? { color: 'var(--color-error, #dc2626)', fontWeight: 600 } : undefined}>
                    {part.currentQuantity}
                  </td>
                  <td>{part.minQuantity} / {part.maxQuantity}</td>
                  <td>${part.unitCost.toFixed(2)}</td>
                  <td>{part.location}</td>
                  <td>{part.lastRestocked ? new Date(part.lastRestocked).toLocaleDateString() : '—'}</td>
                  <td style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <button onClick={() => handleReserve(part.partId)}>Reserve</button>
                    <button onClick={() => handleConsume(part.partId)}>Consume</button>
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
