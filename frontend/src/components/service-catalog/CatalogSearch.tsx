import { useCallback } from 'react';
import type { CatalogFilters, CatalogCategory, CatalogItemAvailability } from '../../types/service-catalog';
import { getCategoryName, getAvailabilityText } from '../../types/service-catalog';
import styles from './CatalogSearch.module.css';

export interface CatalogSearchProps {
  /** Current filter state */
  filters: CatalogFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: CatalogFilters) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Total results count */
  resultsCount?: number;
}

const CATEGORIES: CatalogCategory[] = [
  'LAPTOPS',
  'DESKTOPS',
  'MONITORS',
  'PERIPHERALS',
  'MOBILE_DEVICES',
  'SOFTWARE',
  'NETWORK_EQUIPMENT',
  'ACCESSORIES',
];

const AVAILABILITY_OPTIONS: CatalogItemAvailability[] = [
  'IN_STOCK',
  'LOW_STOCK',
  'BACKORDERED',
];

/**
 * CatalogSearch component for searching and filtering catalog items
 * Implements Requirement 6B.2: Service catalog shall support categories and search functionality
 */
export function CatalogSearch({
  filters,
  onFiltersChange,
  isLoading = false,
  resultsCount,
}: CatalogSearchProps) {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({ ...filters, search: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleCategoryToggle = useCallback(
    (category: CatalogCategory) => {
      const newCategories = filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category];
      onFiltersChange({ ...filters, categories: newCategories });
    },
    [filters, onFiltersChange]
  );

  const handleAvailabilityToggle = useCallback(
    (availability: CatalogItemAvailability) => {
      const newAvailability = filters.availability.includes(availability)
        ? filters.availability.filter((a) => a !== availability)
        : [...filters.availability, availability];
      onFiltersChange({ ...filters, availability: newAvailability });
    },
    [filters, onFiltersChange]
  );

  const handleInStockOnlyToggle = useCallback(() => {
    onFiltersChange({ ...filters, inStockOnly: !filters.inStockOnly });
  }, [filters, onFiltersChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      search: '',
      categories: [],
      availability: [],
      priceRange: { min: null, max: null },
      inStockOnly: false,
    });
  }, [onFiltersChange]);

  const hasActiveFilters =
    filters.search ||
    filters.categories.length > 0 ||
    filters.availability.length > 0 ||
    filters.inStockOnly;

  return (
    <div className={styles.searchContainer} role="search" aria-label="Catalog search and filters">
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
          placeholder="Search catalog items by name, description, or manufacturer..."
          value={filters.search}
          onChange={handleSearchChange}
          disabled={isLoading}
          aria-label="Search catalog"
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
        {/* Category Filter */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Category:</span>
          <div className={styles.filterChips} role="group" aria-label="Filter by category">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`${styles.filterChip} ${filters.categories.includes(category) ? styles.filterChipActive : ''}`}
                onClick={() => handleCategoryToggle(category)}
                disabled={isLoading}
                aria-pressed={filters.categories.includes(category)}
              >
                {getCategoryName(category)}
              </button>
            ))}
          </div>
        </div>

        {/* Availability Filter */}
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Availability:</span>
          <div className={styles.filterChips} role="group" aria-label="Filter by availability">
            {AVAILABILITY_OPTIONS.map((availability) => (
              <button
                key={availability}
                type="button"
                className={`${styles.filterChip} ${filters.availability.includes(availability) ? styles.filterChipActive : ''}`}
                onClick={() => handleAvailabilityToggle(availability)}
                disabled={isLoading}
                aria-pressed={filters.availability.includes(availability)}
              >
                {getAvailabilityText(availability)}
              </button>
            ))}
          </div>
        </div>

        {/* In Stock Only Toggle */}
        <div className={styles.filterGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={filters.inStockOnly}
              onChange={handleInStockOnlyToggle}
              disabled={isLoading}
              className={styles.checkbox}
            />
            <span>In stock only</span>
          </label>
        </div>
      </div>

      {/* Results Count and Clear */}
      <div className={styles.filterActions}>
        {resultsCount !== undefined && (
          <span className={styles.resultsCount}>
            {resultsCount} {resultsCount === 1 ? 'item' : 'items'} found
          </span>
        )}
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
    </div>
  );
}

export default CatalogSearch;
