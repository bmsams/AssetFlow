/**
 * NotificationBell Component
 *
 * Bell icon with unread count badge. On click, opens NotificationPanel dropdown.
 * Polls for new notifications to keep the unread count fresh.
 *
 * Implements Task 10.2
 * Validates: Requirements 9.1, 9.5
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getNotificationHistory, markNotificationRead } from '../../services/notification-api';
import type { Notification } from '../../services/notification-api';
import { NotificationPanel } from './NotificationPanel';
import styles from './NotificationBell.module.css';

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotificationHistory();
      setNotifications(data);
    } catch {
      // Silently fail — bell just shows stale count
    }
  }, []);

  // Initial fetch + polling for Requirement 9.5
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, read: true } : n
        )
      );
    } catch {
      // Silently fail
    }
  };

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        className={styles.button}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          onMarkRead={handleMarkRead}
        />
      )}
    </div>
  );
}
