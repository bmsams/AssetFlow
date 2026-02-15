import { useCallback, useState } from 'react';
import type { Asset, AssetStatus } from '../../types/asset';
import styles from './BulkActions.module.css';

export interface BulkActionsProps {
  /** Selected assets */
  selectedAssets: Asset[];
  /** Callback when delete action is triggered */
  onDelete?: (assets: Asset[]) => void;
  /** Callback when export action is triggered */
  onExport?: (assets: Asset[], format: 'csv' | 'excel' | 'pdf') => void;
  /** Callback when status change action is triggered */
  onStatusChange?: (assets: Asset[], newStatus: AssetStatus) => void;
  /** Callback to clear selection */
  onClearSelection?: () => void;
  /** Disabled state */
  disabled?: boolean;
}

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'DEPLOYED', label: 'Deployed' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
];

/**
 * BulkActions component for performing actions on multiple selected assets
 * Implements Requirement 2.1: Bulk actions support for asset list
 */
export function BulkActions({
  selectedAssets,
  onDelete,
  onExport,
  onStatusChange,
  onClearSelection,
  disabled = false,
}: BulkActionsProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleDelete = useCallback(() => {
    if (onDelete && selectedAssets.length > 0) {
      onDelete(selectedAssets);
    }
  }, [onDelete, selectedAssets]);

  const handleExport = useCallback(
    (format: 'csv' | 'excel' | 'pdf') => {
      if (onExport && selectedAssets.length > 0) {
        onExport(selectedAssets, format);
        setShowExportMenu(false);
      }
    },
    [onExport, selectedAssets]
  );

  const handleStatusChange = useCallback(
    (status: AssetStatus) => {
      if (onStatusChange && selectedAssets.length > 0) {
        onStatusChange(selectedAssets, status);
        setShowStatusMenu(false);
      }
    },
    [onStatusChange, selectedAssets]
  );

  if (selectedAssets.length === 0) {
    return null;
  }

  return (
    <div className={styles.bulkActionsBar} role="toolbar" aria-label="Bulk actions">
      <div className={styles.selectionInfo}>
        <span className={styles.selectionCount}>
          {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''} selected
        </span>
        {onClearSelection && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={onClearSelection}
            disabled={disabled}
          >
            Clear selection
          </button>
        )}
      </div>

      <div className={styles.actions}>
        {/* Status Change */}
        {onStatusChange && (
          <div className={styles.actionDropdown}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={disabled}
              aria-expanded={showStatusMenu}
              aria-haspopup="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Change Status
              <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showStatusMenu && (
              <div className={styles.dropdownMenu} role="menu">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={styles.menuItem}
                    onClick={() => handleStatusChange(value)}
                    role="menuitem"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Export */}
        {onExport && (
          <div className={styles.actionDropdown}>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={disabled}
              aria-expanded={showExportMenu}
              aria-haspopup="true"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
              <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showExportMenu && (
              <div className={styles.dropdownMenu} role="menu">
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleExport('csv')}
                  role="menuitem"
                >
                  Export as CSV
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleExport('excel')}
                  role="menuitem"
                >
                  Export as Excel
                </button>
                <button
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleExport('pdf')}
                  role="menuitem"
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete */}
        {onDelete && (
          <button
            type="button"
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={handleDelete}
            disabled={disabled}
            aria-label={`Delete ${selectedAssets.length} selected assets`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default BulkActions;
