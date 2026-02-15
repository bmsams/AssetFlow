import type { HTMLAttributes } from 'react';
import type { LeaseExpiration, ExpirationSeverity } from '../../types/dashboard';
import { formatCurrency } from '../../types/dashboard';
import styles from './LeaseExpirationList.module.css';

export interface LeaseExpirationListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of lease expirations */
  expirations: LeaseExpiration[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Whether the list is in loading state */
  isLoading?: boolean;
  /** Callback when an item is clicked */
  onItemClick?: (expiration: LeaseExpiration) => void;
  /** Callback when "View All" is clicked */
  onViewAll?: () => void;
}

/**
 * LeaseExpirationList component for displaying upcoming lease expirations
 * Implements Requirement 12.2: Display lease expirations
 */
export function LeaseExpirationList({
  expirations,
  title = 'Upcoming Lease Expirations',
  maxItems = 5,
  isLoading = false,
  onItemClick,
  onViewAll,
  className = '',
  ...props
}: LeaseExpirationListProps) {
  const listClasses = [styles.leaseExpirationList, className].filter(Boolean).join(' ');

  const displayedExpirations = expirations.slice(0, maxItems);
  const hasMore = expirations.length > maxItems;

  if (isLoading) {
    return (
      <div className={listClasses} aria-busy="true" {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.listContainer}>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className={styles.skeletonItem} aria-hidden="true">
              <div className={styles.skeletonBadge} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonSubtitle} />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Loading lease expirations</span>
      </div>
    );
  }

  if (expirations.length === 0) {
    return (
      <div className={listClasses} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">✓</span>
          <p>No upcoming lease expirations</p>
        </div>
      </div>
    );
  }

  return (
    <div className={listClasses} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{expirations.length} expiring</span>
      </div>

      <ul className={styles.listContainer} role="list" aria-label="Lease expirations">
        {displayedExpirations.map((expiration) => (
          <li key={expiration.assetId} className={styles.listItem}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onItemClick?.(expiration)}
              aria-label={`${expiration.displayName}, expires in ${expiration.daysUntilExpiration} days`}
            >
              <SeverityBadge severity={expiration.severity} days={expiration.daysUntilExpiration} />
              <div className={styles.itemContent}>
                <span className={styles.itemName}>{expiration.displayName}</span>
                <span className={styles.itemTag}>{expiration.assetTag}</span>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.itemDate}>
                  {formatExpirationDate(expiration.leaseEndDate)}
                </span>
                <span className={styles.itemCost}>
                  {formatCurrency(expiration.monthlyLeaseCost)}/mo
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {(hasMore || onViewAll) && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.viewAllButton}
            onClick={onViewAll}
            aria-label={`View all ${expirations.length} lease expirations`}
          >
            View All ({expirations.length})
          </button>
        </div>
      )}
    </div>
  );
}

interface SeverityBadgeProps {
  severity: ExpirationSeverity;
  days: number;
}

function SeverityBadge({ severity, days }: SeverityBadgeProps) {
  const badgeClasses = [styles.severityBadge, styles[severity]].join(' ');

  return (
    <span className={badgeClasses} aria-label={`${severity} - ${days} days remaining`}>
      {days}d
    </span>
  );
}

function formatExpirationDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default LeaseExpirationList;
