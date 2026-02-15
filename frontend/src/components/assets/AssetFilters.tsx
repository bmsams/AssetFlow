import { useCallback } from 'react';
import type { AssetType, AssetStatus } from '../../types/asset';
import styles from './AssetFilters.module.css';

export interface AssetFiltersState {
  search: string;
  types: AssetType[];
  statuses: AssetStatus[];
}

export interface AssetFiltersProps {
  /** Current filter state */
  filters: AssetFiltersState;
  /** Callback when filters change */
  onFiltersChange: (filters: AssetFiltersState) => void;
  /** Loading state */
  isLoading?: boolean;
}

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'DEPLOYED', label: 'Deployed' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

/**
 * AssetFilters component for filtering assets by type, status, and search
 * Implements Requirement 2.1: Asset filtering capabilities
 */
export function AssetFilters({
  filters,
  onFiltersChange,
  isLoading = false,
}: AssetFiltersProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, search: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleTypeToggle = useCallback(
    (type: AssetType) => {
      const newTypes = filters.types.includes(type)
        ? filters.types.filter((t) => t !== type)
        : [...filters.types, type];
      onFiltersChange({ ...filters, types: newTypes });
    },
    [filters, onFiltersChange]
  );

  const handleStatusToggle = useCallback(
    (status: AssetStatus) => {
      const newStatuses = filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status];
      onFiltersChange({ ...filters, statuses: newStatuses });
    },
    [filters, onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    onFiltersChange({ search: '', types: [], statuses: [] });
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search || filters.types.length > 0 || filters.statuses.length > 0;

  return (
    <div className={styles.filtersContainer} role="search" aria-label="Asset filters">
      {/* Search Input */}
      <div className={styles.searchWrapper}>
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search assets by name, tag, or description..."
          value={filters.search}
          onChange={handleSearchChange}
          disabled={isLoading}
          aria-label="Search assets"
        />
        {filters.search && (
          <button
            type="button"
            className={styles.clearSearchButton}
            onClick={() => onFiltersChange({ ...filters, search: '' })}
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Groups */}
      <div className={styles.filterGroups}>
        {/* Type Filter */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Type:</span>
          <div className={styles.filterChips} role="group" aria-label="Filter by asset type">
            {ASSET_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterChip} ${filters.types.includes(value) ? styles.filterChipActive : ''}`}
                onClick={() => handleTypeToggle(value)}
                disabled={isLoading}
                aria-pressed={filters.types.includes(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Status:</span>
          <div className={styles.filterChips} role="group" aria-label="Filter by asset status">
            {ASSET_STATUSES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterChip} ${filters.statuses.includes(value) ? styles.filterChipActive : ''}`}
                onClick={() => handleStatusToggle(value)}
                disabled={isLoading}
                aria-pressed={filters.statuses.includes(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          type="button"
          className={styles.clearFiltersButton}
          onClick={handleClearFilters}
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Clear all filters
        </button>
      )}
    </div>
  );
}

export default AssetFilters;
