import type { HTMLAttributes } from 'react';
import type { CompliancePosition } from '../../types/license';
import {
  getCompliancePositionColor,
  formatComplianceStatus,
  formatLicenseMetricType,
  formatLicenseCurrency,
  formatLicenseDate,
} from '../../types/license';
import styles from './CompliancePositionsList.module.css';

export interface CompliancePositionsListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of compliance positions */
  positions: CompliancePosition[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a position is clicked */
  onPositionClick?: (position: CompliancePosition) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * CompliancePositionsList component for displaying software compliance positions
 * Implements Requirement 12.5: Display compliance positions by software title
 * Implements Requirement 4.10: Display compliance positions
 */
export function CompliancePositionsList({
  positions,
  title = 'Compliance Positions',
  maxItems = 5,
  isLoading = false,
  onPositionClick,
  onViewAll,
  className = '',
  ...props
}: CompliancePositionsListProps) {
  const displayedPositions = positions.slice(0, maxItems);
  const hasMore = positions.length > maxItems;

  // Group by status for summary
  const statusCounts = positions.reduce(
    (acc, pos) => {
      acc[pos.compliancePosition]++;
      return acc;
    },
    { COMPLIANT: 0, OVER_LICENSED: 0, UNDER_LICENSED: 0 } as Record<string, number>
  );

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
              <div className={styles.skeletonFooter} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
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
            <path d="M9 12l2 2 4-4" />
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>No compliance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.statusSummary}>
          <span className={styles.summaryItem} data-status="compliant">
            <span className={styles.summaryDot} style={{ backgroundColor: 'var(--color-success-500)' }} />
            {statusCounts.COMPLIANT}
          </span>
          <span className={styles.summaryItem} data-status="over">
            <span className={styles.summaryDot} style={{ backgroundColor: 'var(--color-warning-500)' }} />
            {statusCounts.OVER_LICENSED}
          </span>
          <span className={styles.summaryItem} data-status="under">
            <span className={styles.summaryDot} style={{ backgroundColor: 'var(--color-error-500)' }} />
            {statusCounts.UNDER_LICENSED}
          </span>
        </div>
      </div>
      <ul className={styles.list} role="list">
        {displayedPositions.map((position) => (
          <li key={position.productId} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onPositionClick?.(position)}
              aria-label={`View ${position.productName} compliance details`}
            >
              <div className={styles.itemHeader}>
                <div className={styles.productInfo}>
                  <span className={styles.publisher}>{position.publisher}</span>
                  <span className={styles.productName}>{position.productName}</span>
                  {position.edition && (
                    <span className={styles.edition}>{position.edition}</span>
                  )}
                </div>
                <span
                  className={styles.statusBadge}
                  style={{ backgroundColor: getCompliancePositionColor(position.compliancePosition) }}
                >
                  {formatComplianceStatus(position.compliancePosition)}
                </span>
              </div>
              <div className={styles.itemBody}>
                <div className={styles.licenseInfo}>
                  <span className={styles.metricType}>
                    {formatLicenseMetricType(position.licenseMetricType)}
                  </span>
                  <span className={styles.licenseCounts}>
                    <span className={styles.owned}>
                      <strong>{position.entitlementsOwned}</strong> owned
                    </span>
                    <span className={styles.separator}>vs</span>
                    <span className={styles.found}>
                      <strong>{position.installationsFound}</strong> found
                    </span>
                  </span>
                </div>
                <div className={styles.variance}>
                  <span
                    className={styles.varianceValue}
                    data-positive={position.overUnderCount >= 0}
                  >
                    {position.overUnderCount >= 0 ? '+' : ''}{position.overUnderCount}
                  </span>
                </div>
              </div>
              <div className={styles.itemFooter}>
                <span className={styles.value}>
                  Value: {formatLicenseCurrency(position.totalEntitlementValue)}
                </span>
                {position.potentialExposure > 0 && (
                  <span className={styles.exposure}>
                    Exposure: {formatLicenseCurrency(position.potentialExposure)}
                  </span>
                )}
                <span className={styles.lastReconciled}>
                  Reconciled: {formatLicenseDate(position.lastReconciledDate)}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {positions.length} software titles
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default CompliancePositionsList;
