import { useCallback } from 'react';
import type { AnyAssetDetail, AssetType, AssetStatus } from '../../types/asset';
import styles from './AssetHeader.module.css';

export interface AssetHeaderProps {
  /** Asset to display */
  asset: AnyAssetDetail;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Callback when back button is clicked */
  onBack?: () => void;
  /** Loading state */
  isLoading?: boolean;
}

const getAssetTypeLabel = (type: AssetType): string => {
  const labels: Record<AssetType, string> = {
    HARDWARE: 'Hardware',
    SOFTWARE: 'Software',
    ENTERPRISE: 'Enterprise',
  };
  return labels[type];
};

const getAssetStatusLabel = (status: AssetStatus): string => {
  const labels: Record<AssetStatus, string> = {
    ORDERED: 'Ordered',
    RECEIVED: 'Received',
    IN_STOCK: 'In Stock',
    RESERVED: 'Reserved',
    DEPLOYED: 'Deployed',
    IN_MAINTENANCE: 'In Maintenance',
    RETIRED: 'Retired',
    DISPOSED: 'Disposed',
  };
  return labels[status];
};

const getStatusVariant = (status: AssetStatus): string => {
  const variants: Record<AssetStatus, string> = {
    ORDERED: 'info',
    RECEIVED: 'info',
    IN_STOCK: 'success',
    RESERVED: 'warning',
    DEPLOYED: 'primary',
    IN_MAINTENANCE: 'warning',
    RETIRED: 'neutral',
    DISPOSED: 'neutral',
  };
  return variants[status];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * AssetHeader component displays the header section of the asset detail view
 * Shows asset name, tag, type badge, status, and action buttons
 * 
 * Implements Requirements:
 * - 2.1: Display asset with unique identifier
 */
export function AssetHeader({
  asset,
  onEdit,
  onBack,
  isLoading = false,
}: AssetHeaderProps) {
  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  const handleEdit = useCallback(() => {
    onEdit?.();
  }, [onEdit]);

  if (isLoading) {
    return (
      <header className={styles.header} aria-busy="true">
        <div className={styles.backButton}>
          <div className={styles.skeletonButton} />
        </div>
        <div className={styles.headerContent}>
          <div className={styles.titleRow}>
            <div className={styles.skeletonTitle} />
            <div className={styles.skeletonBadge} />
            <div className={styles.skeletonBadge} />
          </div>
          <div className={styles.skeletonSubtitle} />
        </div>
        <div className={styles.headerActions}>
          <div className={styles.skeletonButton} />
        </div>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      {/* Back Button */}
      <button
        type="button"
        className={styles.backButton}
        onClick={handleBack}
        aria-label="Go back to assets list"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <span>Back</span>
      </button>

      {/* Header Content */}
      <div className={styles.headerContent}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{asset.displayName}</h1>
          <span className={`${styles.typeBadge} ${styles[`type${asset.assetType}`]}`}>
            {getAssetTypeLabel(asset.assetType)}
          </span>
          <span className={`${styles.statusBadge} ${styles[`status${getStatusVariant(asset.status)}`]}`}>
            {getAssetStatusLabel(asset.status)}
          </span>
        </div>
        <div className={styles.subtitle}>
          <span className={styles.assetTag}>{asset.assetTag}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.lastUpdated}>
            Last updated: {formatDate(asset.updatedAt)}
          </span>
        </div>
      </div>

      {/* Header Actions */}
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.editButton}
          onClick={handleEdit}
          aria-label="Edit asset"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span>Edit</span>
        </button>
        <button
          type="button"
          className={styles.moreButton}
          aria-label="More actions"
          aria-haspopup="menu"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default AssetHeader;
