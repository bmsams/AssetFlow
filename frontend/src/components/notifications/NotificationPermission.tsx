/**
 * NotificationPermission Component
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 * 
 * Provides UI for requesting notification permission from users
 */

import { useState, useCallback } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import styles from './NotificationPermission.module.css';

export interface NotificationPermissionProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Text for the enable button */
  enableButtonText?: string;
  /** Text for the dismiss button */
  dismissButtonText?: string;
  /** Callback when permission is granted */
  onPermissionGranted?: () => void;
  /** Callback when permission is denied */
  onPermissionDenied?: () => void;
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void;
  /** Whether to show as a banner (default: false) */
  variant?: 'card' | 'banner' | 'modal';
  /** Custom class name */
  className?: string;
}

/**
 * NotificationPermission component for requesting notification permission
 * 
 * @example
 * ```tsx
 * <NotificationPermission
 *   onPermissionGranted={() => console.log('Notifications enabled!')}
 *   onDismiss={() => setShowPrompt(false)}
 * />
 * ```
 */
export function NotificationPermission({
  title = 'Enable Notifications',
  description = 'Stay updated with task assignments, alerts, and important updates. You can customize your notification preferences anytime.',
  enableButtonText = 'Enable Notifications',
  dismissButtonText = 'Not Now',
  onPermissionGranted,
  onPermissionDenied,
  onDismiss,
  variant = 'card',
  className = '',
}: NotificationPermissionProps) {
  const { isSupported, state, requestPermission, subscribe } = useNotifications({
    autoInitialize: true,
    autoNavigate: false,
  });

  const [isRequesting, setIsRequesting] = useState(false);
  const [showDeniedMessage, setShowDeniedMessage] = useState(false);

  const handleEnableClick = useCallback(async () => {
    setIsRequesting(true);
    setShowDeniedMessage(false);

    try {
      const permission = await requestPermission();

      if (permission === 'granted') {
        // Try to subscribe to push notifications
        await subscribe();
        onPermissionGranted?.();
      } else if (permission === 'denied') {
        setShowDeniedMessage(true);
        onPermissionDenied?.();
      }
    } finally {
      setIsRequesting(false);
    }
  }, [requestPermission, subscribe, onPermissionGranted, onPermissionDenied]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Don't render if notifications aren't supported
  if (!isSupported) {
    return null;
  }

  // Don't render if permission is already granted
  if (state.permission === 'granted') {
    return null;
  }

  // Show denied message if permission was denied
  if (state.permission === 'denied' || showDeniedMessage) {
    return (
      <div 
        className={`${styles.container} ${styles[variant]} ${styles.denied} ${className}`}
        role="alert"
        aria-live="polite"
      >
        <div className={styles.iconContainer}>
          <svg 
            className={styles.icon} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className={styles.content}>
          <h3 className={styles.title}>Notifications Blocked</h3>
          <p className={styles.description}>
            Notifications are blocked for this site. To enable them, please update your browser settings
            and allow notifications for this website.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            className={styles.dismissButton}
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${styles.container} ${styles[variant]} ${className}`}
      role="region"
      aria-label="Notification permission request"
    >
      <div className={styles.iconContainer}>
        <svg 
          className={styles.icon} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.enableButton}
          onClick={handleEnableClick}
          disabled={isRequesting}
          aria-busy={isRequesting}
        >
          {isRequesting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Requesting...
            </>
          ) : (
            enableButtonText
          )}
        </button>
        
        {onDismiss && (
          <button
            type="button"
            className={styles.dismissTextButton}
            onClick={handleDismiss}
            disabled={isRequesting}
          >
            {dismissButtonText}
          </button>
        )}
      </div>

      {variant !== 'banner' && onDismiss && (
        <button
          type="button"
          className={styles.dismissButton}
          onClick={handleDismiss}
          aria-label="Dismiss"
          disabled={isRequesting}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default NotificationPermission;
