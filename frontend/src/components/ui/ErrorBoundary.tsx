import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorMessage, type ErrorRecoveryOption } from './ErrorMessage';

export interface ErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Custom fallback UI to render on error */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Custom recovery options */
  recoveryOptions?: ErrorRecoveryOption[];
  /** Whether to show the default error UI */
  showDefaultUI?: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for catching React errors
 * Implements Requirement 11.6: User-friendly error messages with recovery options
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, recoveryOptions, showDefaultUI = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Show default error UI
      if (showDefaultUI) {
        const defaultRecoveryOptions: ErrorRecoveryOption[] = recoveryOptions || [
          {
            label: 'Try Again',
            action: this.handleRetry,
            variant: 'primary',
          },
          {
            label: 'Go to Dashboard',
            action: this.handleGoHome,
            variant: 'secondary',
          },
        ];

        return (
          <ErrorMessage
            title="Something went wrong"
            message={error?.message || 'An unexpected error occurred. Please try again.'}
            type="error"
            recoveryOptions={defaultRecoveryOptions}
          />
        );
      }

      return null;
    }

    return children;
  }
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}
