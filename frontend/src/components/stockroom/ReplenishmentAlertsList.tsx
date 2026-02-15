import type { HTMLAttributes } from 'react';
import type { ReplenishmentAlert } from '../../types/stockroom';
import { getAlertSeverityColor } from '../../types/stockroom';
import styles from './ReplenishmentAlertsList.module.css';

export interface ReplenishmentAlertsListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of replenishment alerts */
  alerts: ReplenishmentAlert[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when an alert is clicked */
  onAlertClick?: (alert: ReplenishmentAlert) => void;
  /** Callback when create order button is clicked */
  onCreateOrder?: (alert: ReplenishmentAlert) => void;
  /** Callback when dismiss button is clicked */
  onDismiss?: (alert: ReplenishmentAlert) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * ReplenishmentAlertsList component for displaying replenishment alerts
 * Implements Requirement 12.4: Display replenishment alerts
 */
export function ReplenishmentAlertsList({
  alerts,
  title = 'Replenishment Alerts',
  maxItems = 5,
  isLoading = false,
  onAlertClick,
  onCreateOrder,
  onDismiss,
  onViewAll,
  className = '',
  ...props
}: ReplenishmentAlertsListProps) {
  const displayedAlerts = alerts.slice(0, maxItems);
  const hasMore = alerts.length > maxItems;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      case 'warning':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    }
    if (diffHours > 0) {
      return `${diffHours}h ago`;
    }
    return 'Just now';
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
              <div className={styles.skeletonFooter} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
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
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p>All stock levels are healthy</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.badges}>
          {criticalCount > 0 && (
            <span className={`${styles.badge} ${styles.criticalBadge}`}>
              {criticalCount} critical
            </span>
          )}
          {warningCount > 0 && (
            <span className={`${styles.badge} ${styles.warningBadge}`}>
              {warningCount} warning
            </span>
          )}
        </div>
      </div>
      <ul className={styles.list} role="list">
        {displayedAlerts.map((alert) => (
          <li 
            key={alert.alertId} 
            className={`${styles.item} ${styles[`${alert.severity}Item`]}`}
          >
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onAlertClick?.(alert)}
              aria-label={`View alert for ${alert.productName}`}
            >
              <div className={styles.itemHeader}>
                <div 
                  className={styles.severityIcon}
                  style={{ color: getAlertSeverityColor(alert.severity) }}
                >
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className={styles.productInfo}>
                  <span className={styles.productName}>{alert.productName}</span>
                  <span className={styles.productCategory}>{alert.productCategory}</span>
                </div>
                <span className={styles.timeAgo}>{formatTimeAgo(alert.createdAt)}</span>
              </div>
              <div className={styles.stockInfo}>
                <div className={styles.stockLevel}>
                  <span className={styles.stockLabel}>Current Stock</span>
                  <span 
                    className={styles.stockValue}
                    style={{ color: getAlertSeverityColor(alert.severity) }}
                  >
                    {alert.currentQuantity}
                  </span>
                </div>
                <div className={styles.stockDivider}>/</div>
                <div className={styles.stockLevel}>
                  <span className={styles.stockLabel}>Reorder Point</span>
                  <span className={styles.stockValue}>{alert.reorderPoint}</span>
                </div>
                <div className={styles.stockDivider}>→</div>
                <div className={styles.stockLevel}>
                  <span className={styles.stockLabel}>Order Qty</span>
                  <span className={styles.stockValue}>{alert.reorderQuantity}</span>
                </div>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.stockroom}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                  {alert.stockroomName}
                </span>
                <span 
                  className={styles.stockoutWarning}
                  style={{ color: getAlertSeverityColor(alert.severity) }}
                >
                  {alert.daysUntilStockout <= 3 
                    ? `Stockout in ${alert.daysUntilStockout} days!`
                    : `~${alert.daysUntilStockout} days until stockout`
                  }
                </span>
              </div>
              <div className={styles.suggestion}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>{alert.suggestedAction}</span>
              </div>
            </button>
            {(alert.severity === 'critical' || alert.severity === 'warning') && (
              <div className={styles.actions}>
                {onCreateOrder && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.orderButton}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateOrder(alert);
                    }}
                    aria-label={`Create purchase order for ${alert.productName}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    Create Order
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    className={`${styles.actionButton} ${styles.dismissButton}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(alert);
                    }}
                    aria-label={`Dismiss alert for ${alert.productName}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {alerts.length} alerts
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default ReplenishmentAlertsList;
