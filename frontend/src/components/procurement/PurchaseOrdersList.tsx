import type { HTMLAttributes } from 'react';
import type { PurchaseOrder } from '../../types/procurement';
import {
  formatStatus,
  getPurchaseOrderStatusColor,
} from '../../types/procurement';
import { formatCurrency } from '../../types/dashboard';
import styles from './PurchaseOrdersList.module.css';

export interface PurchaseOrdersListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of purchase orders */
  purchaseOrders: PurchaseOrder[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a purchase order is clicked */
  onPurchaseOrderClick?: (po: PurchaseOrder) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * PurchaseOrdersList component for displaying purchase orders
 * Implements Requirement 12.3: Display purchase orders
 */
export function PurchaseOrdersList({
  purchaseOrders,
  title = 'Purchase Orders',
  maxItems = 5,
  isLoading = false,
  onPurchaseOrderClick,
  onViewAll,
  className = '',
  ...props
}: PurchaseOrdersListProps) {
  const displayedOrders = purchaseOrders.slice(0, maxItems);
  const hasMore = purchaseOrders.length > maxItems;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getProgressPercentage = (po: PurchaseOrder) => {
    if (po.totalCount === 0) return 0;
    return Math.round((po.receivedCount / po.totalCount) * 100);
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

  if (purchaseOrders.length === 0) {
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
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>No purchase orders</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{purchaseOrders.length} orders</span>
      </div>
      <ul className={styles.list} role="list">
        {displayedOrders.map((po) => {
          const progress = getProgressPercentage(po);
          return (
            <li key={po.poId} className={styles.item}>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => onPurchaseOrderClick?.(po)}
                aria-label={`View purchase order ${po.poNumber} from ${po.vendorName}`}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.poNumber}>{po.poNumber}</span>
                  <span
                    className={styles.status}
                    style={{ 
                      color: getPurchaseOrderStatusColor(po.status),
                      backgroundColor: `color-mix(in srgb, ${getPurchaseOrderStatusColor(po.status)} 15%, transparent)`
                    }}
                  >
                    {formatStatus(po.status)}
                  </span>
                </div>
                <div className={styles.itemBody}>
                  <span className={styles.vendorName}>{po.vendorName}</span>
                  <span className={styles.amount}>{formatCurrency(po.totalAmount)}</span>
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.lineItems}>{po.lineItemCount} items</span>
                  <span className={styles.date}>
                    Expected: {formatDate(po.expectedDeliveryDate)}
                  </span>
                </div>
                {(po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${progress}%` }}
                        role="progressbar"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${progress}% received`}
                      />
                    </div>
                    <span className={styles.progressText}>
                      {po.receivedCount}/{po.totalCount} received
                    </span>
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {purchaseOrders.length} orders
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default PurchaseOrdersList;
