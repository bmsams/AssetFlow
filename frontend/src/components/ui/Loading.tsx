import { type HTMLAttributes } from 'react';
import styles from './Loading.module.css';

export type LoadingSize = 'sm' | 'md' | 'lg' | 'xl';
export type LoadingVariant = 'spinner' | 'dots' | 'bar';

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  /** Size of the loading indicator */
  size?: LoadingSize;
  /** Visual variant of the loading indicator */
  variant?: LoadingVariant;
  /** Loading message to display */
  message?: string;
  /** Whether to display as a full-page overlay */
  fullPage?: boolean;
  /** Whether to display inline with content */
  inline?: boolean;
}

/**
 * Loading component for displaying loading states
 * Implements Requirement 11.5: Loading states and skeleton screens
 */
export function Loading({
  size = 'md',
  variant = 'spinner',
  message,
  fullPage = false,
  inline = false,
  className = '',
  ...props
}: LoadingProps) {
  const containerClasses = [
    styles.container,
    fullPage ? styles.fullPage : '',
    inline ? styles.inline : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const indicatorClasses = [styles.indicator, styles[variant], styles[size]]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-busy="true"
      {...props}
    >
      <div className={indicatorClasses}>
        {variant === 'spinner' && (
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
              opacity="0.25"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="31.4 31.4"
              className={styles.spinnerArc}
            />
          </svg>
        )}
        {variant === 'dots' && (
          <>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </>
        )}
        {variant === 'bar' && <div className={styles.barInner} />}
      </div>
      {message && <p className={styles.message}>{message}</p>}
      <span className="sr-only">Loading{message ? `: ${message}` : '...'}</span>
    </div>
  );
}

export interface LoadingOverlayProps extends LoadingProps {
  /** Whether the overlay is visible */
  isVisible: boolean;
}

/**
 * Loading overlay that covers its parent container
 */
export function LoadingOverlay({
  isVisible,
  message = 'Loading...',
  ...props
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className={styles.overlay}>
      <Loading message={message} {...props} />
    </div>
  );
}

export interface LoadingButtonContentProps {
  /** Whether the button is in loading state */
  isLoading: boolean;
  /** Content to show when not loading */
  children: React.ReactNode;
  /** Loading text to show */
  loadingText?: string;
}

/**
 * Helper component for button loading states
 */
export function LoadingButtonContent({
  isLoading,
  children,
  loadingText = 'Loading...',
}: LoadingButtonContentProps) {
  if (isLoading) {
    return (
      <>
        <Loading size="sm" variant="spinner" inline />
        <span>{loadingText}</span>
      </>
    );
  }

  return <>{children}</>;
}
