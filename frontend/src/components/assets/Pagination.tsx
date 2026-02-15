import { useCallback, useMemo } from 'react';
import styles from './Pagination.module.css';

export interface PaginationProps {
  /** Current page (1-indexed) */
  currentPage: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Callback when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Pagination component for navigating through paginated data
 * Implements Requirement 2.1: Paginated asset list
 */
export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePageSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newSize = parseInt(e.target.value, 10);
      onPageSizeChange?.(newSize);
      // Reset to first page when changing page size
      onPageChange(1);
    },
    [onPageChange, onPageSizeChange]
  );

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={styles.pagination} role="navigation" aria-label="Pagination">
      {/* Items info */}
      <div className={styles.info}>
        <span className={styles.infoText}>
          Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of{' '}
          <strong>{totalItems}</strong> assets
        </span>
      </div>

      {/* Page size selector */}
      {onPageSizeChange && (
        <div className={styles.pageSizeSelector}>
          <label htmlFor="pageSize" className={styles.pageSizeLabel}>
            Show:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            disabled={disabled}
            className={styles.pageSizeSelect}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Page navigation */}
      <div className={styles.pageNav}>
        <button
          type="button"
          className={styles.navButton}
          onClick={handlePrevious}
          disabled={disabled || currentPage === 1}
          aria-label="Go to previous page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className={styles.pageNumbers}>
          {pageNumbers.map((page, index) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${index}`} className={styles.ellipsis}>
                …
              </span>
            ) : (
              <button
                key={page}
                type="button"
                className={`${styles.pageButton} ${page === currentPage ? styles.pageButtonActive : ''}`}
                onClick={() => onPageChange(page)}
                disabled={disabled}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className={styles.navButton}
          onClick={handleNext}
          disabled={disabled || currentPage === totalPages}
          aria-label="Go to next page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default Pagination;
