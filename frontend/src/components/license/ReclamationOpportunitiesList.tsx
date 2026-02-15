import type { HTMLAttributes } from 'react';
import type { ReclamationOpportunity } from '../../types/license';
import {
  getReclamationStatusColor,
  formatReclamationStatus,
  formatLicenseCurrency,
  formatLicenseDate,
} from '../../types/license';
import styles from './ReclamationOpportunitiesList.module.css';

export interface ReclamationOpportunitiesListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of reclamation opportunities */
  opportunities: ReclamationOpportunity[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when an opportunity is clicked */
  onOpportunityClick?: (opportunity: ReclamationOpportunity) => void;
  /** Callback when initiate reclamation is clicked */
  onInitiateReclamation?: (opportunity: ReclamationOpportunity) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * ReclamationOpportunitiesList component for displaying reclamation opportunities
 * Implements Requirement 12.5: Show reclamation opportunities
 * Implements Requirement 4.10: Display optimization opportunities
 */
export function ReclamationOpportunitiesList({
  opportunities,
  title = 'Reclamation Opportunities',
  maxItems = 5,
  isLoading = false,
  onOpportunityClick,
  onInitiateReclamation,
  onViewAll,
  className = '',
  ...props
}: ReclamationOpportunitiesListProps) {
  const displayedOpportunities = opportunities.slice(0, maxItems);
  const hasMore = opportunities.length > maxItems;

  // Calculate total potential savings (excluding completed/cancelled)
  const totalSavings = opportunities
    .filter(o => o.reclamationStatus !== 'COMPLETED' && o.reclamationStatus !== 'CANCELLED')
    .reduce((sum, o) => sum + o.estimatedSavings, 0);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.list} aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonSubtitle} />
                <div className={styles.skeletonFooter} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
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
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
          <p>No reclamation opportunities found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.count}>{opportunities.length} opportunities</span>
        </div>
        <div className={styles.totalSavings}>
          <span className={styles.savingsLabel}>Potential Savings</span>
          <span className={styles.savingsValue}>{formatLicenseCurrency(totalSavings)}</span>
        </div>
      </div>
      <ul className={styles.list} role="list">
        {displayedOpportunities.map((opportunity) => (
          <li key={opportunity.opportunityId} className={styles.item}>
            <div className={styles.itemWrapper}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => onOpportunityClick?.(opportunity)}
                aria-label={`View ${opportunity.productName} reclamation details`}
              >
                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <div className={styles.productInfo}>
                      <span className={styles.publisher}>{opportunity.publisher}</span>
                      <span className={styles.productName}>{opportunity.productName}</span>
                    </div>
                    <span
                      className={styles.statusBadge}
                      style={{ backgroundColor: getReclamationStatusColor(opportunity.reclamationStatus) }}
                    >
                      {formatReclamationStatus(opportunity.reclamationStatus)}
                    </span>
                  </div>
                  <div className={styles.userInfo}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className={styles.assignedTo}>{opportunity.assignedTo}</span>
                    <span className={styles.deviceName}>{opportunity.deviceName}</span>
                  </div>
                  <div className={styles.usageInfo}>
                    <span className={styles.lastUsed}>
                      Last used: {formatLicenseDate(opportunity.lastUsedDate)}
                    </span>
                    <span className={styles.daysSince}>
                      ({opportunity.daysSinceLastUse} days ago)
                    </span>
                  </div>
                  <div className={styles.itemFooter}>
                    <span className={styles.savings}>
                      Savings: {formatLicenseCurrency(opportunity.estimatedSavings)}/year
                    </span>
                    <span className={styles.rule}>{opportunity.reclamationRuleName}</span>
                  </div>
                </div>
              </button>
              {opportunity.reclamationStatus === 'IDENTIFIED' && onInitiateReclamation && (
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.reclaimButton}
                    onClick={() => onInitiateReclamation(opportunity)}
                    aria-label={`Initiate reclamation for ${opportunity.productName}`}
                  >
                    Reclaim
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {opportunities.length} opportunities
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ReclamationOpportunitiesList;
