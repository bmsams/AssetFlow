import { useParams, useNavigate } from 'react-router-dom';
import { AssetDetailPage } from '../components/asset-detail';
import styles from './Page.module.css';

/**
 * AssetDetailPageWrapper - Wrapper component for AssetDetailPage
 * Handles routing parameters and navigation
 * 
 * Implements Requirements:
 * - 2.1: Display asset with unique identifier
 * - 2.3: Show asset relationships
 * - 2.5: Display audit history
 */
export function AssetDetailPageWrapper() {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/assets');
  };

  const handleEdit = () => {
    navigate(`/assets/${assetId}/edit`);
  };

  const handleAssetClick = (relatedAssetId: string) => {
    navigate(`/assets/${relatedAssetId}`);
  };

  if (!assetId) {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <p>Asset ID is required</p>
          <button type="button" onClick={handleBack}>
            Go to Assets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-4, 1rem)' }}>
        <button
          type="button"
          onClick={handleEdit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-primary-500, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md, 0.375rem)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 500,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
      </div>
      <AssetDetailPage
        assetId={assetId}
        onBack={handleBack}
        onAssetClick={handleAssetClick}
      />
    </div>
  );
}

export default AssetDetailPageWrapper;
