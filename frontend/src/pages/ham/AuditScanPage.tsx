import { useState } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  recordAuditScan,
  type AuditScan,
} from '../../services/ham-api';
import styles from '../Page.module.css';

export function AuditScanPage() {
  const [error, setError] = useState<string | null>(null);
  const [assetTag, setAssetTag] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<AuditScan[]>([]);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetTag.trim() || !locationId.trim()) return;
    try {
      setScanResult(null);
      setError(null);
      const scan = await recordAuditScan({ assetTag: assetTag.trim(), locationId: locationId.trim() });
      setScanResult(scan.matched ? 'Match confirmed' : 'Mismatch detected');
      setRecentScans((prev) => [scan, ...prev]);
      setAssetTag('');
      setLocationId('');
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
          />
        )}

        <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-3)' }}>Recent Scans</h2>

        {recentScans.length === 0 && (
          <EmptyState
            title="No scans recorded"
            description="Use the form above to scan an asset tag and verify its location."
          />
        )}

        {recentScans.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Recent audit scans">
            <thead>
              <tr>
                <th scope="col">Asset Tag</th>
                <th scope="col">Location</th>
                <th scope="col">Scanned By</th>
                <th scope="col">Scanned At</th>
                <th scope="col">Result</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((s) => (
                <tr key={s.scanId}>
                  <td>{s.assetTag}</td>
                  <td>{s.locationName}</td>
                  <td>{s.scannedBy}</td>
                  <td>{new Date(s.scannedAt).toLocaleString()}</td>
                  <td>{s.matched ? 'Matched' : 'Mismatch'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
