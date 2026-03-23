import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listLinearAssets,
  updateSegment,
  type LinearAsset,
  type LinearSegment,
} from '../../services/eam-api';
import styles from '../Page.module.css';

export function LinearAssetsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<LinearAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listLinearAssets();
      setAssets(result);
    } catch {
      setError('Failed to load linear assets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const selectedAsset = assets.find((a) => a.linearAssetId === selectedAssetId);

  const handleUpdateSegment = async (linearAssetId: string, segment: LinearSegment) => {
    const newCondition = window.prompt(
      `Update condition for segment ${segment.segmentId} (good/fair/poor/critical):`,
      segment.condition
    );
    if (!newCondition || !['good', 'fair', 'poor', 'critical'].includes(newCondition)) return;
    try {
      await updateSegment(linearAssetId, segment.segmentId, {
        condition: newCondition as LinearSegment['condition'],
      });
      await fetchAssets();
    } catch {
      setError('Failed to update segment. Please try again.');
    }
  };

  const getConditionStyle = (condition: LinearSegment['condition']): React.CSSProperties => {
    const colors: Record<LinearSegment['condition'], string> = {
      critical: 'var(--color-error, #dc2626)',
      poor: 'var(--color-warning, #f59e0b)',
      fair: 'var(--color-info, #3b82f6)',
      good: 'var(--color-success, #16a34a)',
    };
    return { color: colors[condition], fontWeight: 600 };
  };

  return (
    <PageLayout
      title="Linear Assets"
      description="Manage linear assets and their segments"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Linear Assets' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchAssets }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading linear assets...</p>
          </div>
        )}

        {!isLoading && !error && assets.length === 0 && (
          <EmptyState
            title="No linear assets found"
            description="No linear assets have been created yet."
          />
        )}

        {!isLoading && !error && assets.length > 0 && !selectedAssetId && (
          <table className={styles.dataTable || ''} role="table" aria-label="Linear assets">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col">Total Length</th>
                <th scope="col">Unit</th>
                <th scope="col">Segments</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.linearAssetId}>
                  <td>{asset.name}</td>
                  <td>{asset.description}</td>
                  <td>{asset.totalLength}</td>
                  <td>{asset.unit}</td>
                  <td>{asset.segments.length}</td>
                  <td>
                    <button onClick={() => setSelectedAssetId(asset.linearAssetId)}>
                      View Segments
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedAsset && (
          <div>
            <button
              onClick={() => setSelectedAssetId(null)}
              style={{ marginBottom: 'var(--spacing-4)' }}
            >
              ← Back to list
            </button>
            <h2 style={{ margin: '0 0 var(--spacing-2) 0' }}>{selectedAsset.name}</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-4)' }}>
              {selectedAsset.totalLength} {selectedAsset.unit} — {selectedAsset.segments.length} segment(s)
            </p>

            {selectedAsset.segments.length === 0 ? (
              <EmptyState
                title="No segments"
                description="This linear asset has no segments defined."
              />
            ) : (
              <table className={styles.dataTable || ''} role="table" aria-label="Asset segments">
                <thead>
                  <tr>
                    <th scope="col">Segment ID</th>
                    <th scope="col">Start</th>
                    <th scope="col">End</th>
                    <th scope="col">Condition</th>
                    <th scope="col">Last Inspected</th>
                    <th scope="col">Notes</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAsset.segments.map((seg) => (
                    <tr key={seg.segmentId}>
                      <td>{seg.segmentId}</td>
                      <td>{seg.startPoint}</td>
                      <td>{seg.endPoint}</td>
                      <td style={getConditionStyle(seg.condition)}>{seg.condition}</td>
                      <td>{seg.lastInspected ? new Date(seg.lastInspected).toLocaleDateString() : '—'}</td>
                      <td>{seg.notes || '—'}</td>
                      <td>
                        <button onClick={() => handleUpdateSegment(selectedAsset.linearAssetId, seg)}>
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
