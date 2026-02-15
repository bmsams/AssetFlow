import type { HTMLAttributes } from 'react';
import type { ComplianceIndicator, ComplianceStatus, ComplianceType } from '../../types/dashboard';
import styles from './ComplianceIndicators.module.css';

export interface ComplianceIndicatorsProps extends HTMLAttributes<HTMLDivElement> {
  /** List of compliance indicators */
  indicators: ComplianceIndicator[];
  /** Title for the section */
  title?: string;
  /** Whether the component is in loading state */
  isLoading?: boolean;
  /** Callback when an indicator is clicked */
  onIndicatorClick?: (indicator: ComplianceIndicator) => void;
}

/**
 * ComplianceIndicators component for displaying compliance risk indicators
 * Implements Requirement 12.2: Display compliance indicators
 */
export function ComplianceIndicators({
  indicators,
  title = 'Compliance Status',
  isLoading = false,
  onIndicatorClick,
  className = '',
  ...props
}: ComplianceIndicatorsProps) {
  const containerClasses = [styles.complianceIndicators, className].filter(Boolean).join(' ');

  // Group indicators by status for summary
  const statusCounts = indicators.reduce(
    (acc, indicator) => {
      acc[indicator.status]++;
      return acc;
    },
    { compliant: 0, at_risk: 0, non_compliant: 0 } as Record<ComplianceStatus, number>
  );

  if (isLoading) {
    return (
      <div className={containerClasses} aria-busy="true" {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.skeletonGrid} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={styles.skeletonCard} />
          ))}
        </div>
        <span className="sr-only">Loading compliance indicators</span>
      </div>
    );
  }

  if (indicators.length === 0) {
    return (
      <div className={containerClasses} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.emptyState}>
          <p>No compliance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <StatusSummary counts={statusCounts} />
      </div>

      <div className={styles.indicatorGrid} role="list" aria-label="Compliance indicators">
        {indicators.map((indicator) => (
          <IndicatorCard
            key={indicator.id}
            indicator={indicator}
            onClick={() => onIndicatorClick?.(indicator)}
          />
        ))}
      </div>
    </div>
  );
}

interface StatusSummaryProps {
  counts: Record<ComplianceStatus, number>;
}

function StatusSummary({ counts }: StatusSummaryProps) {
  return (
    <div className={styles.statusSummary} aria-label="Compliance summary">
      <span className={`${styles.summaryItem} ${styles.compliant}`}>
        <span className={styles.summaryDot} aria-hidden="true" />
        {counts.compliant} Compliant
      </span>
      <span className={`${styles.summaryItem} ${styles.atRisk}`}>
        <span className={styles.summaryDot} aria-hidden="true" />
        {counts.at_risk} At Risk
      </span>
      <span className={`${styles.summaryItem} ${styles.nonCompliant}`}>
        <span className={styles.summaryDot} aria-hidden="true" />
        {counts.non_compliant} Non-Compliant
      </span>
    </div>
  );
}

interface IndicatorCardProps {
  indicator: ComplianceIndicator;
  onClick?: () => void;
}

function IndicatorCard({ indicator, onClick }: IndicatorCardProps) {
  const cardClasses = [styles.indicatorCard, styles[indicator.status]].join(' ');
  const progressPercentage = Math.min((indicator.value / indicator.threshold) * 100, 100);

  return (
    <button
      type="button"
      className={cardClasses}
      onClick={onClick}
      role="listitem"
      aria-label={`${indicator.name}: ${getStatusLabel(indicator.status)}`}
    >
      <div className={styles.cardHeader}>
        <TypeIcon type={indicator.type} />
        <StatusBadge status={indicator.status} />
      </div>

      <h4 className={styles.cardTitle}>{indicator.name}</h4>
      <p className={styles.cardDescription}>{indicator.description}</p>

      <div className={styles.progressContainer}>
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{ width: `${progressPercentage}%` }}
            role="progressbar"
            aria-valuenow={indicator.value}
            aria-valuemin={0}
            aria-valuemax={indicator.threshold}
          />
        </div>
        <div className={styles.progressLabels}>
          <span>{indicator.value}</span>
          <span>/ {indicator.threshold}</span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <span className={styles.lastChecked}>
          Last checked: {formatLastChecked(indicator.lastChecked)}
        </span>
      </div>
    </button>
  );
}

interface TypeIconProps {
  type: ComplianceType;
}

function TypeIcon({ type }: TypeIconProps) {
  const icons: Record<ComplianceType, string> = {
    license: '📄',
    warranty: '🛡️',
    maintenance: '🔧',
    audit: '📋',
  };

  return (
    <span className={styles.typeIcon} aria-hidden="true">
      {icons[type]}
    </span>
  );
}

interface StatusBadgeProps {
  status: ComplianceStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const badgeClasses = [styles.statusBadge, styles[`badge${status.charAt(0).toUpperCase() + status.slice(1).replace('_', '')}`]].join(' ');

  return (
    <span className={badgeClasses}>
      {getStatusLabel(status)}
    </span>
  );
}

function getStatusLabel(status: ComplianceStatus): string {
  switch (status) {
    case 'compliant':
      return 'Compliant';
    case 'at_risk':
      return 'At Risk';
    case 'non_compliant':
      return 'Non-Compliant';
    default:
      return 'Unknown';
  }
}

function formatLastChecked(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default ComplianceIndicators;
