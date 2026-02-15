import type { HTMLAttributes } from 'react';
import type { AuditRisk } from '../../types/license';
import {
  getAuditRiskColor,
  formatLicenseCurrency,
  formatLicenseDate,
} from '../../types/license';
import styles from './AuditRisksList.module.css';

export interface AuditRisksListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of audit risks */
  risks: AuditRisk[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a risk is clicked */
  onRiskClick?: (risk: AuditRisk) => void;
  /** Callback when view details is clicked */
  onViewDetails?: (risk: AuditRisk) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * AuditRisksList component for displaying audit risks
 * Implements Requirement 12.5: Show audit risks
 * Implements Requirement 4.10: Display audit risks and optimization opportunities
 */
export function AuditRisksList({
  risks,
  title = 'Audit Risks',
  maxItems = 5,
  isLoading = false,
  onRiskClick,
  onViewDetails,
  onViewAll,
  className = '',
  ...props
}: AuditRisksListProps) {
  const displayedRisks = risks.slice(0, maxItems);
  const hasMore = risks.length > maxItems;

  // Calculate total exposure
  const totalExposure = risks.reduce((sum, risk) => sum + risk.estimatedExposure, 0);

  if (isLoading) {
    return (
      <div className={`${styles.container} ${className}`} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.list} aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonItem}>
              <div className={styles.skeletonBadge} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonTitle} />
                <div className={styles.skeletonDescription} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (risks.length === 0) {
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          <p>No audit risks identified</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.count}>{risks.length} risks</span>
        </div>
        <div className={styles.totalExposure}>
          <span className={styles.exposureLabel}>Total Exposure</span>
          <span className={styles.exposureValue}>{formatLicenseCurrency(totalExposure)}</span>
        </div>
      </div>
      <ul className={styles.list} role="list">
        {displayedRisks.map((risk) => (
          <li key={risk.riskId} className={styles.item}>
            <div className={styles.itemWrapper}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => onRiskClick?.(risk)}
                aria-label={`View ${risk.productName} risk details`}
              >
                <div className={styles.riskBadge} style={{ backgroundColor: getAuditRiskColor(risk.riskLevel) }}>
                  <span className={styles.riskLevel}>{risk.riskLevel}</span>
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <span className={styles.publisher}>{risk.publisher}</span>
                    <span className={styles.productName}>{risk.productName}</span>
                  </div>
                  <div className={styles.riskType}>{risk.riskType}</div>
                  <p className={styles.description}>{risk.description}</p>
                  <div className={styles.itemFooter}>
                    <span className={styles.exposure}>
                      Exposure: {formatLicenseCurrency(risk.estimatedExposure)}
                    </span>
                    <span className={styles.assessed}>
                      Assessed: {formatLicenseDate(risk.lastAssessedDate)}
                    </span>
                  </div>
                </div>
              </button>
              {onViewDetails && (
                <div className={styles.itemActions}>
                  <button
                    type="button"
                    className={styles.detailsButton}
                    onClick={() => onViewDetails(risk)}
                    aria-label={`View details for ${risk.productName}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {risks.length} audit risks
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default AuditRisksList;
