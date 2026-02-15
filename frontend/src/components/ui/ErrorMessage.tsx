import { type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';
import styles from './ErrorMessage.module.css';

export type ErrorType = 'error' | 'warning' | 'info' | 'not-found' | 'network' | 'permission';

/** Display variant for ErrorMessage component */
export type ErrorMessageVariant = 'page' | 'inline';

export interface ErrorRecoveryOption {
  /** Label for the recovery button */
  label: string;
  /** Action to perform when clicked */
  action: () => void;
  /** Button variant */
  variant?: ButtonVariant;
  /** Whether the button is loading */
  isLoading?: boolean;
}

export interface ErrorMessageProps {
  /** Error title */
  title: string;
  /** Error message/description */
  message: string;
  /** Type of error for styling and icon */
  type?: ErrorType;
  /** Recovery options/actions */
  recoveryOptions?: ErrorRecoveryOption[];
  /** Additional details (e.g., error code, request ID) */
  details?: string;
  /** Custom icon to display */
  icon?: ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Display variant - 'page' for full-page errors, 'inline' for banner-style */
  variant?: ErrorMessageVariant;
  /** Callback when dismiss button is clicked (only for inline variant) */
  onDismiss?: () => void;
}

/**
 * Error icons for different error types
 */
const ErrorIcons: Record<ErrorType, ReactNode> = {
  error: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.64 1.55 19C1.55 19.36 1.64 19.7 1.82 20C2 20.3 2.26 20.56 2.56 20.74C2.86 20.92 3.21 21.01 3.56 21H20.44C20.79 21.01 21.14 20.92 21.44 20.74C21.74 20.56 22 20.3 22.18 20C22.36 19.7 22.45 19.36 22.45 19C22.45 18.64 22.36 18.3 22.18 18L13.71 3.86C13.53 3.56 13.27 3.32 12.97 3.15C12.67 2.98 12.34 2.89 12 2.89C11.66 2.89 11.33 2.98 11.03 3.15C10.73 3.32 10.47 3.56 10.29 3.86Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'not-found': (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 11H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M8.59 13.51L15.42 17.49M15.41 6.51L8.59 10.49M21 5C21 6.65685 19.6569 8 18 8C16.3431 8 15 6.65685 15 5C15 3.34315 16.3431 2 18 2C19.6569 2 21 3.34315 21 5ZM9 12C9 13.6569 7.65685 15 6 15C4.34315 15 3 13.6569 3 12C3 10.3431 4.34315 9 6 9C7.65685 9 9 10.3431 9 12ZM21 19C21 20.6569 19.6569 22 18 22C16.3431 22 15 20.6569 15 19C15 17.3431 16.3431 16 18 16C19.6569 16 21 17.3431 21 19Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M2 2L22 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  permission: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
};

/**
 * ErrorMessage component for displaying user-friendly error messages
 * Implements Requirement 11.6: User-friendly error messages with recovery options
 * Implements Requirement 4: Consistent Error Banner Component
 * 
 * @param variant - 'page' for full-page centered errors (default), 'inline' for banner-style
 * @param onDismiss - Callback for dismiss button (only shown in inline variant)
 */
export function ErrorMessage({
  title,
  message,
  type = 'error',
  recoveryOptions = [],
  details,
  icon,
  className = '',
  variant = 'page',
  onDismiss,
}: ErrorMessageProps) {
  const classNames = [
    styles.container,
    styles[type],
    variant === 'inline' ? styles.inline : '',
    className,
  ].filter(Boolean).join(' ');

  // Dismiss button icon (X)
  const DismissIcon = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <div className={classNames} role="alert" aria-live="polite">
      <div className={styles.iconContainer}>
        {icon || ErrorIcons[type]}
      </div>
      <div className={styles.content}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {details && (
          <p className={styles.details}>
            <code>{details}</code>
          </p>
        )}
        {recoveryOptions.length > 0 && (
          <div className={styles.actions}>
            {recoveryOptions.map((option, index) => (
              <Button
                key={index}
                variant={option.variant || (index === 0 ? 'primary' : 'secondary')}
                onClick={option.action}
                isLoading={option.isLoading}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {variant === 'inline' && onDismiss && (
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss error message"
        >
          {DismissIcon}
        </button>
      )}
    </div>
  );
}

/**
 * Pre-configured error message for network errors
 */
export function NetworkError({
  onRetry,
  isRetrying = false,
}: {
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  const recoveryOptions: ErrorRecoveryOption[] = onRetry
    ? [{ label: 'Retry', action: onRetry, variant: 'primary', isLoading: isRetrying }]
    : [];

  return (
    <ErrorMessage
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection and try again."
      type="network"
      recoveryOptions={recoveryOptions}
    />
  );
}

/**
 * Pre-configured error message for not found errors
 */
export function NotFoundError({
  resourceName = 'Resource',
  onGoBack,
  onGoHome,
}: {
  resourceName?: string;
  onGoBack?: () => void;
  onGoHome?: () => void;
}) {
  const recoveryOptions: ErrorRecoveryOption[] = [];
  
  if (onGoBack) {
    recoveryOptions.push({ label: 'Go Back', action: onGoBack, variant: 'primary' });
  }
  if (onGoHome) {
    recoveryOptions.push({ label: 'Go to Dashboard', action: onGoHome, variant: 'secondary' });
  }

  return (
    <ErrorMessage
      title={`${resourceName} Not Found`}
      message={`The ${resourceName.toLowerCase()} you're looking for doesn't exist or has been removed.`}
      type="not-found"
      recoveryOptions={recoveryOptions}
    />
  );
}

/**
 * Pre-configured error message for permission errors
 */
export function PermissionError({
  onGoBack,
  onRequestAccess,
}: {
  onGoBack?: () => void;
  onRequestAccess?: () => void;
}) {
  const recoveryOptions: ErrorRecoveryOption[] = [];
  
  if (onRequestAccess) {
    recoveryOptions.push({ label: 'Request Access', action: onRequestAccess, variant: 'primary' });
  }
  if (onGoBack) {
    recoveryOptions.push({ label: 'Go Back', action: onGoBack, variant: 'secondary' });
  }

  return (
    <ErrorMessage
      title="Access Denied"
      message="You don't have permission to access this resource. Contact your administrator if you believe this is an error."
      type="permission"
      recoveryOptions={recoveryOptions}
    />
  );
}
