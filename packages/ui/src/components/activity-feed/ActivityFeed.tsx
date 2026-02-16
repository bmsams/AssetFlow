import { useRef, useEffect, type HTMLAttributes } from 'react';
import styles from './ActivityFeed.module.css';

export interface ActivityItem {
  id: string;
  type:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'assigned'
    | 'transferred'
    | 'comment'
    | 'status_change'
    | 'checkout'
    | 'checkin';
  description: string;
  timestamp: string;
  user: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, string>;
}

export interface ActivityFeedProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  items: ActivityItem[];
  maxHeight?: number;
  autoScroll?: boolean;
  emptyMessage?: string;
  onItemClick?: (item: ActivityItem) => void;
  className?: string;
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const icons: Record<ActivityItem['type'], JSX.Element> = {
  created: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  updated: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  deleted: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4m2 0v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4h9.34z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  assigned: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 14c0-3.31 2.69-5 6-5s6 1.69 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  transferred: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 2l4 4-4 4M6 14l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6H6M2 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  comment: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M14 10a1.33 1.33 0 01-1.33 1.33H4.67L2 14V3.33A1.33 1.33 0 013.33 2h9.34A1.33 1.33 0 0114 3.33V10z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  status_change: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 8a7 7 0 0113.06-3.5M15 8a7 7 0 01-13.06 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 1v3.5h-3.5M2 15v-3.5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  checkout: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 11L11 5M11 5H6M11 5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  checkin: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M11 5L5 11M5 11h5M5 11V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const iconStyleMap: Record<ActivityItem['type'], string> = {
  created: styles.iconCreated,
  updated: styles.iconUpdated,
  deleted: styles.iconDeleted,
  assigned: styles.iconAssigned,
  transferred: styles.iconTransferred,
  comment: styles.iconComment,
  status_change: styles.iconStatusChange,
  checkout: styles.iconCheckout,
  checkin: styles.iconCheckin,
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function ActivityFeed({
  items,
  maxHeight = 400,
  autoScroll = true,
  emptyMessage = 'No activity yet',
  onItemClick,
  className = '',
  ...props
}: ActivityFeedProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const prevLengthRef = useRef(items.length);

  useEffect(() => {
    if (autoScroll && items.length > prevLengthRef.current && listRef.current) {
      const container = listRef.current.parentElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevLengthRef.current = items.length;
  }, [items.length, autoScroll]);

  const feedClasses = [styles.feed, className].filter(Boolean).join(' ');

  if (items.length === 0) {
    return (
      <div className={feedClasses} style={{ maxHeight }} {...props}>
        <p className={styles.empty}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={feedClasses} style={{ maxHeight }} {...props}>
      <ul className={styles.list} ref={listRef} role="list">
        {items.map((item) => {
          const itemClasses = [
            styles.item,
            onItemClick ? styles.clickable : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li
              key={item.id}
              className={itemClasses}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              role={onItemClick ? 'button' : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              onKeyDown={
                onItemClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onItemClick(item);
                      }
                    }
                  : undefined
              }
            >
              <span
                className={`${styles.iconWrapper} ${iconStyleMap[item.type]}`}
              >
                {icons[item.type]}
              </span>

              <div className={styles.body}>
                <p className={styles.description}>{item.description}</p>
                <div className={styles.meta}>
                  {item.user.avatar ? (
                    <img
                      src={item.user.avatar}
                      alt={item.user.name}
                      className={styles.avatar}
                    />
                  ) : (
                    <span className={styles.avatar} aria-hidden="true">
                      {getInitials(item.user.name)}
                    </span>
                  )}
                  <span className={styles.userName}>{item.user.name}</span>
                  <span aria-label="timestamp">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
