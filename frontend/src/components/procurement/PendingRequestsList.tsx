import type { HTMLAttributes } from 'react';
import type { AssetRequest } from '../../types/procurement';
import {
  formatStatus,
  getPriorityColor,
} from '../../types/procurement';
import { formatCurrency } from '../../types/dashboard';
import styles from './PendingRequestsList.module.css';

export interface PendingRequestsListProps extends HTMLAttributes<HTMLDivElement> {
  /** List of pending requests */
  requests: AssetRequest[];
  /** Title for the list */
  title?: string;
  /** Maximum items to display */
  maxItems?: number;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when a request is clicked */
  onRequestClick?: (request: AssetRequest) => void;
  /** Callback when approve button is clicked */
  onApprove?: (request: AssetRequest) => void;
  /** Callback when reject button is clicked */
  onReject?: (request: AssetRequest) => void;
  /** Callback when view all is clicked */
  onViewAll?: () => void;
}

/**
 * PendingRequestsList component for displaying asset requests awaiting approval
 * Implements Requirement 12.3: Display pending requests
 */
export function PendingRequestsList({
  requests,
  title = 'Pending Requests',
  maxItems = 5,
  isLoading = false,
  onRequestClick,
  onApprove,
  onReject,
  onViewAll,
  className = '',
  ...props
}: PendingRequestsListProps) {
  const displayedRequests = requests.slice(0, maxItems);
  const hasMore = requests.length > maxItems;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

  if (requests.length === 0) {
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
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
          <p>No pending requests</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{requests.length} pending</span>
      </div>
      <ul className={styles.list} role="list">
        {displayedRequests.map((request) => (
          <li key={request.requestId} className={styles.item}>
            <button
              type="button"
              className={styles.itemButton}
              onClick={() => onRequestClick?.(request)}
              aria-label={`View request ${request.requestNumber} for ${request.itemName}`}
            >
              <div className={styles.itemHeader}>
                <span className={styles.requestNumber}>{request.requestNumber}</span>
                <span
                  className={styles.priority}
                  style={{ color: getPriorityColor(request.priority) }}
                >
                  {request.priority}
                </span>
              </div>
              <div className={styles.itemBody}>
                <span className={styles.itemName}>{request.itemName}</span>
                <span className={styles.quantity}>Qty: {request.quantity}</span>
              </div>
              <div className={styles.itemMeta}>
                <span className={styles.requester}>
                  {request.requesterName} • {request.requesterDepartment}
                </span>
                <span className={styles.price}>{formatCurrency(request.totalPrice)}</span>
              </div>
              <div className={styles.itemFooter}>
                <span className={styles.date}>Requested: {formatDate(request.requestedDate)}</span>
                <span className={styles.status}>{formatStatus(request.status)}</span>
              </div>
            </button>
            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.approveButton}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onApprove?.(request);
                }}
                aria-label={`Approve request ${request.requestNumber}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Approve
              </button>
              <button
                type="button"
                className={`${styles.actionButton} ${styles.rejectButton}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onReject?.(request);
                }}
                aria-label={`Reject request ${request.requestNumber}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && onViewAll && (
        <button type="button" className={styles.viewAllButton} onClick={onViewAll}>
          View all {requests.length} requests
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default PendingRequestsList;
