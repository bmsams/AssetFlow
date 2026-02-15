/**
 * NotificationPanel Component
 *
 * Dropdown panel showing recent notifications.
 * Each item is clickable to mark as read and navigate to its link.
 *
 * Implements Task 10.2
 * Validates: Requirements 9.2, 9.3
 */

import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../services/notification-api';
import styles from './NotificationPanel.module.css';

interface NotificationPanelProps {
  notifications: Notification[];
  onMarkRead: (notificationId: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function NotificationPanel({ notifications, onMarkRead }: NotificationPanelProps) {
  const navigate = useNavigate();

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkRead(notification.notificationId);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <div className={styles.panel} role="menu" aria-label="Notifications">
      <div className={styles.header}>
        <h3 className={styles.headerTitle}>Notifications</h3>
      </div>
      {notifications.length === 0 ? (
        <p className={styles.empty}>No notifications</p>
      ) : (
        <ul className={styles.list}>
          {notifications.map((n) => (
            <li
              key={n.notificationId}
              className={`${styles.item} ${!n.read ? styles.unread : ''}`}
              onClick={() => handleClick(n)}
              role="menuitem"
            >
              <span
                className={`${styles.dot} ${!n.read ? styles.dotUnread : styles.dotRead}`}
                aria-hidden="true"
              />
              <div className={styles.content}>
                <p className={styles.title}>{n.title}</p>
                <p className={styles.message}>{n.message}</p>
                <span className={styles.time}>{formatTime(n.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
