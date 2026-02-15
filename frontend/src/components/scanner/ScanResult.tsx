import type { ScanResult as ScanResultType, ScannedAsset } from '../../types/scanner';
import styles from './ScanResult.module.css';

export interface ScanResultProps {
  /** The scan result to display */
  result: ScanResultType;
  /** Callback when user wants to view full asset details */
  onViewDetails?: (assetId: string) => void;
  /** Callback when user wants to dismiss the result */
  onDismiss?: () => void;
  /** Callback when user wants to scan again */
  onScanAgain?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * ScanResult component displays asset details after scanning
 * Implements Requirement 13.2: Display asset details after scanning
 */
export function ScanResult({
  result,
  onViewDetails,
  onDismiss,
  onScanAgain,
  className,
}: ScanResultProps) {
  const { asset, barcodeValue, barcodeFormat, scannedAt, isOffline, error } = result;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DEPLOYED':
        return styles.statusDeployed;
      case 'IN_STOCK':
        return styles.statusInStock;
      case 'IN_MAINTENANCE':
        return styles.statusMaintenance;
      case 'RETIRED':
      case 'DISPOSED':
        return styles.statusRetired;
      default:
        return styles.statusDefault;
    }
  };

  const getAssetTypeIcon = (assetType: string) => {
    switch (assetType) {
      case 'HARDWARE':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        );
      case 'SOFTWARE':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        );
      case 'ENTERPRISE':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 21h18" />
            <path d="M9 8h1" />
            <path d="M9 12h1" />
            <path d="M9 16h1" />
            <path d="M14 8h1" />
            <path d="M14 12h1" />
            <path d="M14 16h1" />
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          </svg>
        );
      default:
        return null;
    }
  };

  const renderAssetDetails = (asset: ScannedAsset) => (
    <div className={styles.assetDetails}>
      {/* Asset Header */}
      <div className={styles.assetHeader}>
        <div className={styles.assetIcon}>
          {getAssetTypeIcon(asset.assetType)}
        </div>
        <div className={styles.assetInfo}>
          <h3 className={styles.assetName}>{asset.displayName}</h3>
          <p className={styles.assetTag}>{asset.assetTag}</p>
        </div>
        <span className={`${styles.statusBadge} ${getStatusColor(asset.status)}`}>
          {asset.status.replace('_', ' ')}
        </span>
      </div>

      {/* Asset Attributes */}
      <div className={styles.attributeGrid}>
        {asset.serialNumber && (
          <div className={styles.attribute}>
            <span className={styles.attributeLabel}>Serial Number</span>
            <span className={styles.attributeValue}>{asset.serialNumber}</span>
          </div>
        )}
        {asset.manufacturer && (
          <div className={styles.attribute}>
            <span className={styles.attributeLabel}>Manufacturer</span>
            <span className={styles.attributeValue}>{asset.manufacturer}</span>
          </div>
        )}
        {asset.model && (
          <div className={styles.attribute}>
            <span className={styles.attributeLabel}>Model</span>
            <span className={styles.attributeValue}>{asset.model}</span>
          </div>
        )}
        {asset.assignedTo && (
          <div className={styles.attribute}>
            <span className={styles.attributeLabel}>Assigned To</span>
            <span className={styles.attributeValue}>{asset.assignedTo}</span>
          </div>
        )}
        {asset.location && (
          <div className={styles.attribute}>
            <span className={styles.attributeLabel}>Location</span>
            <span className={styles.attributeValue}>{asset.location}</span>
          </div>
        )}
        <div className={styles.attribute}>
          <span className={styles.attributeLabel}>Last Updated</span>
          <span className={styles.attributeValue}>{formatDate(asset.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );

  const renderNotFound = () => (
    <div className={styles.notFound}>
      <div className={styles.notFoundIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      </div>
      <h3 className={styles.notFoundTitle}>Asset Not Found</h3>
      <p className={styles.notFoundMessage}>
        No asset found with barcode: <code>{barcodeValue}</code>
      </p>
      {error && <p className={styles.errorMessage}>{error}</p>}
    </div>
  );

  const renderOfflinePending = () => (
    <div className={styles.offlinePending}>
      <div className={styles.offlineIcon}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h3 className={styles.offlineTitle}>Scan Saved Offline</h3>
      <p className={styles.offlineMessage}>
        Barcode <code>{barcodeValue}</code> has been saved and will be synced when you're back online.
      </p>
    </div>
  );

  return (
    <div 
      className={`${styles.resultContainer} ${className || ''}`}
      role="region"
      aria-label="Scan result"
    >
      {/* Scan Metadata */}
      <div className={styles.scanMeta}>
        <span className={styles.scanTime}>Scanned {formatDate(scannedAt)}</span>
        <span className={styles.barcodeFormat}>{barcodeFormat.replace('_', ' ')}</span>
        {isOffline && <span className={styles.offlineBadge}>Offline</span>}
      </div>

      {/* Result Content */}
      {isOffline && !asset ? (
        renderOfflinePending()
      ) : asset ? (
        renderAssetDetails(asset)
      ) : (
        renderNotFound()
      )}

      {/* Actions */}
      <div className={styles.actions}>
        {asset && onViewDetails && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => onViewDetails(asset.assetId)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            View Full Details
          </button>
        )}
        {onScanAgain && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onScanAgain}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
            Scan Another
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            className={styles.textButton}
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export default ScanResult;
