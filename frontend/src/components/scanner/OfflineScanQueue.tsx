import { useState, useCallback } from 'react';
import type { OfflineScan } from '../../types/scanner';
import styles from './OfflineScanQueue.module.css';

export interface OfflineScanQueueProps {
  /** List of offline scans pending sync */
  scans: OfflineScan[];
  /** Whether currently syncing */
  isSyncing?: boolean;
  /** Whether device is online */
  isOnline?: boolean;
  /** Callback to trigger sync */
  onSync?: () => void;
  /** Callback to retry a specific scan */
  onRetry?: (scanId: string) => void;
  /** Callback to remove a scan from queue */
  onRemove?: (scanId: string) => void;
  /** Callback to clear all synced scans */
  onClearSynced?: () => void;
  /** Custom class name */
  className?: string;
}

/**
 * OfflineScanQueue component displays and manages offline scans pending sync
 * Implements Requirement 13.3: Offline scanning with sync when online
 */
export function OfflineScanQueue({
  scans,
  isSyncing = false,
  isOnline = true,
  onSync,
  onRetry,
  onRemove,
  onClearSynced,
  className,
}: OfflineScanQueueProps) {
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  const pendingScans = scans.filter((s) => s.syncStatus === 'pending');
  const syncingScans = scans.filter((s) => s.syncStatus === 'syncing');
  const syncedScans = scans.filter((s) => s.syncStatus === 'synced');
  const failedScans = scans.filter((s) => s.syncStatus === 'failed');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const toggleExpand = useCallback((scanId: string) => {
    setExpandedScan((prev) => (prev === scanId ? null : scanId));
  }, []);

  const getStatusIcon = (status: OfflineScan['syncStatus']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className={styles.pendingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case 'syncing':
        return (
          <svg className={styles.syncingIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        );
      case 'synced':
        return (
          <svg className={styles.syncedIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'failed':
        return (
          <svg className={styles.failedIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
    }
  };

  const renderScanItem = (scan: OfflineScan) => {
    const isExpanded = expandedScan === scan.id;

    return (
      <div
        key={scan.id}
        className={`${styles.scanItem} ${styles[`status${scan.syncStatus.charAt(0).toUpperCase() + scan.syncStatus.slice(1)}`]}`}
      >
        <button
          type="button"
          className={styles.scanHeader}
          onClick={() => toggleExpand(scan.id)}
          aria-expanded={isExpanded}
        >
          <span className={styles.statusIcon}>{getStatusIcon(scan.syncStatus)}</span>
          <div className={styles.scanInfo}>
            <span className={styles.barcodeValue}>{scan.barcodeValue}</span>
            <span className={styles.scanTime}>{formatRelativeTime(scan.scannedAt)}</span>
          </div>
          <svg
            className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isExpanded && (
          <div className={styles.scanDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Barcode Format</span>
              <span className={styles.detailValue}>{scan.barcodeFormat.replace('_', ' ')}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Scanned At</span>
              <span className={styles.detailValue}>{formatDate(scan.scannedAt)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Sync Attempts</span>
              <span className={styles.detailValue}>{scan.syncAttempts}</span>
            </div>
            {scan.lastSyncAttempt && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Last Attempt</span>
                <span className={styles.detailValue}>{formatDate(scan.lastSyncAttempt)}</span>
              </div>
            )}
            {scan.syncError && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Error</span>
                <span className={`${styles.detailValue} ${styles.errorText}`}>{scan.syncError}</span>
              </div>
            )}
            {scan.resolvedAsset && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Asset</span>
                <span className={styles.detailValue}>{scan.resolvedAsset.displayName}</span>
              </div>
            )}

            <div className={styles.itemActions}>
              {scan.syncStatus === 'failed' && onRetry && (
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={() => onRetry(scan.id)}
                >
                  Retry
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => onRemove(scan.id)}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (scans.length === 0) {
    return (
      <div className={`${styles.queueContainer} ${styles.empty} ${className || ''}`}>
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p>No offline scans</p>
          <span>Scans made while offline will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${styles.queueContainer} ${className || ''}`}
      role="region"
      aria-label="Offline scan queue"
    >
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Offline Scans
          <span className={styles.count}>{scans.length}</span>
        </h3>
        <div className={styles.headerActions}>
          {syncedScans.length > 0 && onClearSynced && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={onClearSynced}
            >
              Clear Synced
            </button>
          )}
          {(pendingScans.length > 0 || failedScans.length > 0) && onSync && (
            <button
              type="button"
              className={styles.syncButton}
              onClick={onSync}
              disabled={isSyncing || !isOnline}
            >
              {isSyncing ? (
                <>
                  <svg className={styles.spinnerIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" />
                  </svg>
                  Syncing...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M23 4v6h-6" />
                    <path d="M1 20v-6h6" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Sync Now
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Connection Status */}
      {!isOnline && (
        <div className={styles.offlineWarning} role="alert">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span>You're offline. Scans will sync when connection is restored.</span>
        </div>
      )}

      {/* Summary */}
      <div className={styles.summary}>
        {pendingScans.length > 0 && (
          <span className={styles.summaryItem}>
            <span className={styles.summaryDot} data-status="pending" />
            {pendingScans.length} pending
          </span>
        )}
        {syncingScans.length > 0 && (
          <span className={styles.summaryItem}>
            <span className={styles.summaryDot} data-status="syncing" />
            {syncingScans.length} syncing
          </span>
        )}
        {failedScans.length > 0 && (
          <span className={styles.summaryItem}>
            <span className={styles.summaryDot} data-status="failed" />
            {failedScans.length} failed
          </span>
        )}
        {syncedScans.length > 0 && (
          <span className={styles.summaryItem}>
            <span className={styles.summaryDot} data-status="synced" />
            {syncedScans.length} synced
          </span>
        )}
      </div>

      {/* Scan List */}
      <div className={styles.scanList}>
        {scans.map(renderScanItem)}
      </div>
    </div>
  );
}

export default OfflineScanQueue;
