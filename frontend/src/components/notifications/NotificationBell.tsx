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
import { useAuth } from '../../hooks/useAuth';
import styles from './NotificationBell.module.css';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_POLL_INTERVAL_MS = 300_000; // 5 minutes max backoff
const MAX_CONSECUTIVE_ERRORS = 5;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuth();
  const consecutiveErrors = useRef(0);
  const currentInterval = useRef(POLL_INTERVAL_MS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getNotificationHistory();
      setNotifications(data);
      // Reset backoff on success
      consecutiveErrors.current = 0;
      currentInterval.current = POLL_INTERVAL_MS;
    } catch {
      // Exponential backoff: stop polling after too many consecutive failures
      consecutiveErrors.current += 1;
      if (consecutiveErrors.current <= MAX_CONSECUTIVE_ERRORS) {
        currentInterval.current = Math.min(
          POLL_INTERVAL_MS * Math.pow(2, consecutiveErrors.current),
          MAX_POLL_INTERVAL_MS
        );
      }
    }
  }, [isAuthenticated]);

  // Initial fetch + adaptive polling for Requirement 9.5
  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchNotifications();

    let timeoutId: ReturnType<typeof setTimeout>;
    function schedulePoll() {
      // Stop polling entirely after too many consecutive errors
      if (consecutiveErrors.current > MAX_CONSECUTIVE_ERRORS) return;
      timeoutId = setTimeout(() => {
        void fetchNotifications().finally(schedulePoll);
      }, currentInterval.current);
    }
    schedulePoll();

    return () => clearTimeout(timeoutId);
  }, [fetchNotifications, isAuthenticated]);

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
