import { useState } from 'react';
import styles from './MockDataBanner.module.css';

export interface MockDataBannerProps {
  /** Feature name displayed in the banner message, e.g. "License Management" */
  featureName: string;
}

/**
 * MockDataBanner displays a dismissible info banner indicating that a page
 * is showing sample data because the backend is not yet implemented.
 *
 * Implements Requirement 10.5: pages using mock data display a visual indicator.
 */
export function MockDataBanner({ featureName }: MockDataBannerProps): JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className={styles.banner} role="status" aria-label="Sample data notice">
      <svg
        className={styles.icon}
        viewBox="0 0 20 20"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clipRule="evenodd"
        />
      </svg>
      <p className={styles.message}>
        This page shows sample data. {featureName} backend is pending.
      </p>
      <button
        type="button"
        className={styles.dismissButton}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss sample data notice"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M15 5L5 15M5 5L15 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
