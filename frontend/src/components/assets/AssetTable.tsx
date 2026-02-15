import { useCallback, useMemo } from 'react';
import type { Asset, AssetType, AssetStatus } from '../../types/asset';
import type { ColumnConfig } from './ColumnSelector';
import styles from './AssetTable.module.css';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: string;
  direction: SortDirection;
}

export interface AssetTableProps {
  /** Assets to display */
  assets: Asset[];
  /** Column configuration */
  columns: ColumnConfig[];
  /** Current sort configuration */
  sortConfig: SortConfig | null;
  /** Callback when sort changes */
  onSortChange: (config: SortConfig) => void;
  /** Selected asset IDs */
  selectedIds: Set<string>;
  /** Callback when selection changes */
  onSelectionChange: (selectedIds: Set<string>) => void;
  /** Callback when an asset row is clicked */
  onAssetClick?: (asset: Asset) => void;
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
  });
};

/**
 * AssetTable component for displaying assets in a sortable, selectable table
 * Implements Requirement 2.1: Paginated asset list with sorting
 */
export function AssetTable({
  assets,
  columns,
  sortConfig,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onAssetClick,
  isLoading = false,
}: AssetTableProps) {
  const visibleColumns = useMemo(
    () => columns.filter((col) => col.visible),
    [columns]
  );

  const allSelected = useMemo(
    () => assets.length > 0 && assets.every((asset) => selectedIds.has(asset.assetId)),
    [assets, selectedIds]
  );

  const someSelected = useMemo(
    () => assets.some((asset) => selectedIds.has(asset.assetId)) && !allSelected,
    [assets, selectedIds, allSelected]
  );

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(assets.map((a) => a.assetId)));
    }
  }, [allSelected, assets, onSelectionChange]);

  const handleSelectOne = useCallback(
    (assetId: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(assetId)) {
        newSelection.delete(assetId);
      } else {
        newSelection.add(assetId);
      }
      onSelectionChange(newSelection);
    },
    [selectedIds, onSelectionChange]
  );

  const handleSort = useCallback(
    (columnId: string) => {
      const column = columns.find((c) => c.id === columnId);
      if (!column?.sortable) return;

      const newDirection: SortDirection =
        sortConfig?.column === columnId && sortConfig.direction === 'asc'
          ? 'desc'
          : 'asc';

      onSortChange({ column: columnId, direction: newDirection });
    },
    [columns, sortConfig, onSortChange]
  );

  const renderCellContent = (asset: Asset, columnId: string): React.ReactNode => {
    switch (columnId) {
      case 'assetTag':
        return <span className={styles.assetTag}>{asset.assetTag}</span>;
      case 'displayName':
        return asset.displayName;
      case 'assetType':
        return (
          <span className={`${styles.typeBadge} ${styles[`type${asset.assetType}`]}`}>
            {getAssetTypeLabel(asset.assetType)}
          </span>
        );
      case 'status':
        return (
          <span className={`${styles.statusBadge} ${styles[`status${getStatusVariant(asset.status)}`]}`}>
            {getAssetStatusLabel(asset.status)}
          </span>
        );
      case 'createdAt':
        return formatDate(asset.createdAt);
      case 'updatedAt':
        return formatDate(asset.updatedAt);
      case 'description':
        return asset.description || '—';
      default:
        return '—';
    }
  };

  if (isLoading) {
    return (
      <div className={styles.tableContainer}>
        <table className={styles.table} aria-busy="true">
          <thead>
            <tr>
              <th className={styles.checkboxCell}>
                <div className={styles.skeletonCheckbox} />
              </th>
              {visibleColumns.map((col) => (
                <th key={col.id}>
                  <div className={styles.skeletonHeader} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td className={styles.checkboxCell}>
                  <div className={styles.skeletonCheckbox} />
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.id}>
                    <div className={styles.skeletonCell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className={styles.emptyState}>
        <svg
          className={styles.emptyIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
        <p className={styles.emptyText}>No assets found</p>
        <p className={styles.emptySubtext}>
          Try adjusting your filters or create a new asset
        </p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table} role="grid" aria-label="Assets table">
        <thead>
          <tr>
            <th className={styles.checkboxCell}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleSelectAll}
                aria-label={allSelected ? 'Deselect all assets' : 'Select all assets'}
                className={styles.checkbox}
              />
            </th>
            {visibleColumns.map((col) => (
              <th
                key={col.id}
                className={`${styles.headerCell} ${col.sortable ? styles.sortable : ''}`}
                onClick={() => col.sortable && handleSort(col.id)}
                aria-sort={
                  sortConfig?.column === col.id
                    ? sortConfig.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <span className={styles.headerContent}>
                  {col.label}
                  {col.sortable && (
                    <span className={styles.sortIcon} aria-hidden="true">
                      {sortConfig?.column === col.id ? (
                        sortConfig.direction === 'asc' ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="7 10 12 5 17 10" />
                          <polyline points="7 14 12 19 17 14" />
                        </svg>
                      )}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr
              key={asset.assetId}
              className={`${styles.row} ${selectedIds.has(asset.assetId) ? styles.rowSelected : ''}`}
              onClick={() => onAssetClick?.(asset)}
            >
              <td className={styles.checkboxCell}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(asset.assetId)}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleSelectOne(asset.assetId);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${asset.displayName}`}
                  className={styles.checkbox}
                />
              </td>
              {visibleColumns.map((col) => (
                <td key={col.id} className={styles.cell}>
                  {renderCellContent(asset, col.id)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AssetTable;
