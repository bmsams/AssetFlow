import type { HTMLAttributes } from 'react';
import type { TransferOrder } from '../../types/stockroom';
import {
  getTransferStatusColor,
  formatTransferStatus,
  formatStockroomCurrency,
} from '../../types/stockroom';
import styles from './TransferOrdersList.module.css';

export interface TransferOrdersListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of transfer orders */
  transferOrders: TransferOrder[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a transfer order is clicked */
  onTransferClick?: (transfer: TransferOrder) => void;
  /** Callback when approve button is clicked */
  onApprove?: (transfer: TransferOrder) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * TransferOrdersList component for displaying transfer orders and status
 * Implements Requirement 12.4: Show transfer orders and status
 */
export function TransferOrdersList({
  transferOrders,
  title = 'Transfer Orders',
  maxItems = 5,
  isLoading = false,
  onTransferClick,
  onApprove,
  onViewAll,
  className = '',
  ...props
}: TransferOrdersListProps) {
  const displayedOrders = transferOrders.slice(0, maxItems);
  const hasMore = transferOrders.length > maxItems;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const pendingCount = transferOrders.filter(
    t => t.status === 'PENDING_APPROVAL' || t.status === 'IN_TRANSIT'
  ).length;

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

  if (transferOrders.length === 0) {
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
            <path d="M16 3h5v5" />
            <path d="M8 21H3v-5" />
            <path d="M21 3l-9 9" />
            <path d="M3 21l9-9" />
          </svg>
          <p>No transfer orders</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{pendingCount} active</span>
      </div>
      <ul className={styles.list} role="list">
        {displayedOrders.map((transfer) => (
          <li key={transfer.transferId} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onTransferClick?.(transfer)}
              aria-label={`View transfer order ${transfer.transferNumber}`}
            >
              <div className={styles.itemHeader}>
                <span className={styles.transferNumber}>{transfer.transferNumber}</span>
                <span
                  className={styles.status}
                  style={{ 
                    color: getTransferStatusColor(transfer.status),
                    backgroundColor: `color-mix(in srgb, ${getTransferStatusColor(transfer.status)} 15%, transparent)`
                  }}
                >
                  {formatTransferStatus(transfer.status)}
                </span>
              </div>
              <div className={styles.transferRoute}>
                <div className={styles.routePoint}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8" />
                    <path d="M8 12h8" />
                  </svg>
                  <span>{transfer.fromStockroomName}</span>
                </div>
                <div className={styles.routeArrow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
                <div className={styles.routePoint}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{transfer.toStockroomName}</span>
                </div>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.itemCount}>{transfer.itemCount} items</span>
                <span className={styles.value}>{formatStockroomCurrency(transfer.totalValue)}</span>
              </div>
              <div className={styles.itemFooter}>
                <span className={styles.requester}>
                  Requested by {transfer.requestedBy}
                </span>
                <span className={styles.date}>
                  {formatDate(transfer.requestedDate)}
                </span>
              </div>
              {transfer.expectedDeliveryDate && transfer.status === 'IN_TRANSIT' && (
                <div className={styles.deliveryInfo}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="1" y="3" width="15" height="13" />
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                  Expected: {formatDate(transfer.expectedDeliveryDate)}
                </div>
              )}
              {transfer.notes && (
                <div className={styles.notes}>
                  <span className={styles.notesText}>{transfer.notes}</span>
                </div>
              )}
            </button>
            {transfer.status === 'PENDING_APPROVAL' && onApprove && (
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.approveButton}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onApprove(transfer);
                  }}
                  aria-label={`Approve transfer ${transfer.transferNumber}`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Approve Transfer
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {transferOrders.length} transfers
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default TransferOrdersList;
