import { useState, useCallback } from 'react';
import type { ScanHistoryEntry } from '../../types/scanner';
import styles from './ScanHistory.module.css';

export interface ScanHistoryProps {
  /** List of scan history entries */
  history: ScanHistoryEntry[];
  /** Callback when user wants to view asset details */
  onViewAsset?: (assetId: string) => void;
  /** Callback when user wants to rescan a barcode */
  onRescan?: (barcodeValue: string) => void;
  /** Callback to clear history */
  onClearHistory?: () => void;
  /** Maximum number of entries to display */
  maxEntries?: number;
  /** Custom class name */
  className?: string;
}

/**
 * ScanHistory component displays recent scan history
 * Supports viewing asset details and rescanning
 */
export function ScanHistory({
  history,
  onViewAsset,
  onRescan,
  onClearHistory,
  maxEntries = 20,
  className,
}: ScanHistoryProps) {
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  const filteredHistory = history
    .filter((entry) => {
      if (filter === 'success') return entry.success;
      if (filter === 'failed') return !entry.success;
      return true;
    })
    .slice(0, maxEntries);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const groupByDate = useCallback((entries: ScanHistoryEntry[]) => {
    const groups: { [key: string]: ScanHistoryEntry[] } = {};
    
    entries.forEach((entry) => {
      const date = new Date(entry.scannedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
      }
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key]!.push(entry);
    });
    
    return groups;
  }, []);

  const groupedHistory = groupByDate(filteredHistory);

  const getAssetTypeIcon = (assetType?: string) => {
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
            <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="7" y1="12" x2="17" y2="12" />
          </svg>
        );
    }
  };

  const renderHistoryEntry = (entry: ScanHistoryEntry) => (
    <div
      key={entry.id}
      className={`${styles.historyItem} ${entry.success ? styles.success : styles.failed}`}
    >
      <div className={styles.itemIcon}>
        {entry.asset ? getAssetTypeIcon(entry.asset.assetType) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>
      
      <div className={styles.itemContent}>
        <div className={styles.itemHeader}>
          {entry.asset ? (
            <span className={styles.assetName}>{entry.asset.displayName}</span>
          ) : (
            <span className={styles.barcodeValue}>{entry.barcodeValue}</span>
          )}
          <span className={styles.scanTime}>{formatDate(entry.scannedAt)}</span>
        </div>
        
        {entry.asset && (
          <div className={styles.itemMeta}>
            <span className={styles.assetTag}>{entry.asset.assetTag}</span>
            <span className={`${styles.statusBadge} ${styles[`status${entry.asset.status.replace('_', '')}`]}`}>
              {entry.asset.status.replace('_', ' ')}
            </span>
          </div>
        )}
        
        {!entry.success && entry.error && (
          <span className={styles.errorMessage}>{entry.error}</span>
        )}
        
        <div className={styles.itemFooter}>
          <span className={styles.barcodeFormat}>{entry.barcodeFormat.replace('_', ' ')}</span>
          <div className={styles.itemActions}>
            {entry.asset && onViewAsset && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onViewAsset(entry.asset!.assetId)}
                aria-label={`View details for ${entry.asset.displayName}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View
              </button>
            )}
            {onRescan && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => onRescan(entry.barcodeValue)}
                aria-label={`Rescan ${entry.barcodeValue}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Rescan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (history.length === 0) {
    return (
      <div className={`${styles.historyContainer} ${styles.empty} ${className || ''}`}>
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p>No scan history</p>
          <span>Your recent scans will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${styles.historyContainer} ${className || ''}`}
      role="region"
      aria-label="Scan history"
    >
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Scan History
          <span className={styles.count}>{history.length}</span>
        </h3>
        {onClearHistory && history.length > 0 && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClearHistory}
          >
            Clear History
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className={styles.filterTabs} role="tablist">
        <button
          type="button"
          role="tab"
          className={`${styles.filterTab} ${filter === 'all' ? styles.active : ''}`}
          onClick={() => setFilter('all')}
          aria-selected={filter === 'all'}
        >
          All ({history.length})
        </button>
        <button
          type="button"
          role="tab"
          className={`${styles.filterTab} ${filter === 'success' ? styles.active : ''}`}
          onClick={() => setFilter('success')}
          aria-selected={filter === 'success'}
        >
          Found ({history.filter((e) => e.success).length})
        </button>
        <button
          type="button"
          role="tab"
          className={`${styles.filterTab} ${filter === 'failed' ? styles.active : ''}`}
          onClick={() => setFilter('failed')}
          aria-selected={filter === 'failed'}
        >
          Not Found ({history.filter((e) => !e.success).length})
        </button>
      </div>

      {/* History List */}
      <div className={styles.historyList}>
        {filteredHistory.length === 0 ? (
          <div className={styles.noResults}>
            <p>No {filter === 'success' ? 'successful' : filter === 'failed' ? 'failed' : ''} scans found</p>
          </div>
        ) : (
          Object.entries(groupedHistory).map(([date, entries]) => (
            <div key={date} className={styles.dateGroup}>
              <h4 className={styles.dateHeader}>{date}</h4>
              {entries.map(renderHistoryEntry)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ScanHistory;
