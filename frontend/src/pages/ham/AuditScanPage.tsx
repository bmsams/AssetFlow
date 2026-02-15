import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  recordAuditScan,
  getAuditDiscrepancies,
  type AuditDiscrepancy,
} from '../../services/ham-api';
import styles from '../Page.module.css';

export function AuditScanPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<AuditDiscrepancy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assetTag, setAssetTag] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);

  const fetchDiscrepancies = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getAuditDiscrepancies();
      setDiscrepancies(result);
    } catch {
      setError('Failed to load discrepancies. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscrepancies();
  }, [fetchDiscrepancies]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetTag.trim() || !locationId.trim()) return;
    try {
      setScanResult(null);
      const scan = await recordAuditScan({ assetTag: assetTag.trim(), locationId: locationId.trim() });
      setScanResult(scan.matched ? 'Match confirmed' : 'Mismatch detected');
      setAssetTag('');
      setLocationId('');
      await fetchDiscrepancies();
    } catch {
      setError('Failed to record scan. Please try again.');
    }
  };

  return (
    <PageLayout
      title="Audit Scans"
      description="Record asset audit scans and review discrepancies"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Audit Scans' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <form onSubmit={handleScan} style={{ marginBottom: 'var(--spacing-6)', display: 'flex', gap: 'var(--spacing-2)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="asset-tag" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>Asset Tag</label>
            <input
              id="asset-tag"
              type="text"
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value)}
              placeholder="AMS-HW-..."
              required
            />
          </div>
          <div>
            <label htmlFor="location-id" style={{ display: 'block', marginBottom: 'var(--spacing-1)' }}>Location ID</label>
            <input
              id="location-id"
              type="text"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Location ID"
              required
            />
          </div>
          <button type="submit">Record Scan</button>
        </form>

        {scanResult && (
          <div role="status" style={{ marginBottom: 'var(--spacing-4)', padding: 'var(--spacing-2)', background: 'var(--color-background)', borderRadius: 'var(--radius-md)' }}>
            {scanResult}
          </div>
        )}

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchDiscrepancies }]}
          />
        )}

        <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-3)' }}>Discrepancies</h2>

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading discrepancies...</p>
          </div>
        )}

        {!isLoading && !error && discrepancies.length === 0 && (
          <EmptyState
            title="No discrepancies"
            description="All scanned assets match their expected locations."
          />
        )}

        {!isLoading && !error && discrepancies.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Audit discrepancies">
            <thead>
              <tr>
                <th scope="col">Asset Tag</th>
                <th scope="col">Expected Location</th>
                <th scope="col">Actual Location</th>
                <th scope="col">Type</th>
                <th scope="col">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map((d) => (
                <tr key={d.discrepancyId}>
                  <td>{d.assetTag}</td>
                  <td>{d.expectedLocationName}</td>
                  <td>{d.actualLocationName ?? '—'}</td>
                  <td>{d.type}</td>
                  <td>{d.resolvedAt ? new Date(d.resolvedAt).toLocaleDateString() : 'Unresolved'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
