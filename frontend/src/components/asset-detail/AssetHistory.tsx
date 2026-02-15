import type { AuditEntry, AuditAction } from '../../types/asset';
import styles from './AssetHistory.module.css';

export interface AssetHistoryProps {
  /** Audit history entries to display */
  history: AuditEntry[];
  /** Loading state */
  isLoading?: boolean;
}

const getActionLabel = (action: AuditAction): string => {
  const labels: Record<AuditAction, string> = {
    CREATE: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
    STATUS_CHANGE: 'Status Changed',
    ASSIGNMENT: 'Assignment',
    RELATIONSHIP: 'Relationship',
  };
  return labels[action];
};

const getActionIcon = (action: AuditAction): React.ReactNode => {
  switch (action) {
    case 'CREATE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      );
    case 'UPDATE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case 'DELETE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'STATUS_CHANGE':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      );
    case 'ASSIGNMENT':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'RELATIONSHIP':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="12" r="3" />
          <path d="M9 12h6" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

const getActionVariant = (action: AuditAction): string => {
  const variants: Record<AuditAction, string> = {
    CREATE: 'success',
    UPDATE: 'info',
    DELETE: 'danger',
    STATUS_CHANGE: 'warning',
    ASSIGNMENT: 'primary',
    RELATIONSHIP: 'neutral',
  };
  return variants[action];
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes === 0) {
        return 'Just now';
      }
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

/**
 * AssetHistory component displays the audit trail of asset changes
 * Shows all changes with timestamp, user, and previous/new values
 * 
 * Implements Requirements:
 * - 2.5: System shall maintain complete audit trail of all asset changes
 */
export function AssetHistory({
  history,
  isLoading = false,
}: AssetHistoryProps) {
  if (isLoading) {
    return (
      <div className={styles.historyContainer} aria-busy="true">
        <div className={styles.header}>
          <div className={styles.skeletonTitle} />
        </div>
        <div className={styles.timeline}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.skeletonIcon} />
              <div className={styles.skeletonContent}>
                <div className={styles.skeletonDescription} />
                <div className={styles.skeletonMeta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.historyContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          Audit History
          <span className={styles.count}>({history.length})</span>
        </h3>
      </div>

      {/* Empty State */}
      {history.length === 0 && (
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <p className={styles.emptyText}>No history available</p>
          <p className={styles.emptySubtext}>
            Changes to this asset will appear here
          </p>
        </div>
      )}

      {/* Timeline */}
      {history.length > 0 && (
        <ol className={styles.timeline} aria-label="Asset audit history">
          {history.map((entry, index) => (
            <li key={entry.auditId} className={styles.timelineItem}>
              {/* Timeline Line */}
              {index < history.length - 1 && (
                <div className={styles.timelineLine} aria-hidden="true" />
              )}

              {/* Icon */}
              <div
                className={`${styles.timelineIcon} ${styles[`icon${getActionVariant(entry.action)}`]}`}
                aria-hidden="true"
              >
                {getActionIcon(entry.action)}
              </div>

              {/* Content */}
              <div className={styles.timelineContent}>
                <div className={styles.entryHeader}>
                  <span className={`${styles.actionBadge} ${styles[`action${getActionVariant(entry.action)}`]}`}>
                    {getActionLabel(entry.action)}
                  </span>
                  <time
                    className={styles.timestamp}
                    dateTime={entry.timestamp}
                    title={formatDateTime(entry.timestamp)}
                  >
                    {formatRelativeTime(entry.timestamp)}
                  </time>
                </div>

                <p className={styles.description}>{entry.description}</p>

                {/* Field Change Details */}
                {entry.fieldName && (entry.previousValue || entry.newValue) && (
                  <div className={styles.changeDetails}>
                    <span className={styles.fieldName}>{entry.fieldName}:</span>
                    {entry.previousValue && (
                      <span className={styles.previousValue}>
                        <span className={styles.changeLabel}>From:</span>
                        {entry.previousValue}
                      </span>
                    )}
                    {entry.newValue && (
                      <span className={styles.newValue}>
                        <span className={styles.changeLabel}>To:</span>
                        {entry.newValue}
                      </span>
                    )}
                  </div>
                )}

                <div className={styles.entryFooter}>
                  <span className={styles.userName}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {entry.userName}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default AssetHistory;
