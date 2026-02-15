import type { HTMLAttributes } from 'react';
import type { Stockroom } from '../../types/stockroom';
import {
  getStockroomTypeLabel,
  formatStockroomCurrency,
} from '../../types/stockroom';
import styles from './InventoryLevelsList.module.css';

export interface InventoryLevelsListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of stockrooms with inventory levels */
  stockrooms: Stockroom[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a stockroom is clicked */
  onStockroomClick?: (stockroom: Stockroom) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * InventoryLevelsList component for displaying inventory levels by stockroom
 * Implements Requirement 12.4: Display inventory levels by stockroom
 */
export function InventoryLevelsList({
  stockrooms,
  title = 'Inventory Levels',
  maxItems = 5,
  isLoading = false,
  onStockroomClick,
  onViewAll,
  className = '',
  ...props
}: InventoryLevelsListProps) {
  const displayedStockrooms = stockrooms.slice(0, maxItems);
  const hasMore = stockrooms.length > maxItems;

  const getUtilizationColor = (percentage: number): string => {
    if (percentage >= 80) return 'var(--color-error-500)';
    if (percentage >= 60) return 'var(--color-warning-500)';
    return 'var(--color-success-500)';
  };

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.list} aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonHeader} />
              <div className={styles.skeletonBody} />
              <div className={styles.skeletonProgress} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (stockrooms.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <p>No stockrooms configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{stockrooms.length} locations</span>
      </div>
      <ul className={styles.list} role="list">
        {displayedStockrooms.map((stockroom) => (
          <li key={stockroom.stockroomId} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onStockroomClick?.(stockroom)}
              aria-label={`View ${stockroom.name} inventory details`}
            >
              <div className={styles.itemHeader}>
                <span className={styles.stockroomName}>{stockroom.name}</span>
                <span className={styles.stockroomType}>
                  {getStockroomTypeLabel(stockroom.stockroomType)}
                </span>
              </div>
              <div className={styles.itemBody}>
                <span className={styles.location}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {stockroom.location}
                </span>
                <span className={styles.value}>
                  {formatStockroomCurrency(stockroom.totalValue)}
                </span>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.itemCount}>
                  {stockroom.totalItems.toLocaleString()} items
                </span>
                <span className={styles.manager}>
                  Managed by {stockroom.managerName}
                </span>
              </div>
              <div className={styles.utilizationContainer}>
                <div className={styles.utilizationHeader}>
                  <span className={styles.utilizationLabel}>Capacity Utilization</span>
                  <span 
                    className={styles.utilizationValue}
                    style={{ color: getUtilizationColor(stockroom.utilizationPercentage) }}
                  >
                    {stockroom.utilizationPercentage}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ 
                      width: `${stockroom.utilizationPercentage}%`,
                      backgroundColor: getUtilizationColor(stockroom.utilizationPercentage)
                    }}
                    role="progressbar"
                    aria-valuenow={stockroom.utilizationPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${stockroom.utilizationPercentage}% capacity utilized`}
                  />
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {stockrooms.length} stockrooms
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default InventoryLevelsList;
