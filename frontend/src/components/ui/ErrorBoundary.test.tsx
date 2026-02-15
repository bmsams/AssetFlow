import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Normal content</div>;
}

// Component that can be toggled to throw
function ToggleableComponent({ error }: { error: Error | null }) {
  if (error) {
    throw error;
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests since we're testing error handling
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('Normal Operation', () => {
    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('catches errors and displays error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('displays default error message when error has no message', () => {
      const ComponentWithEmptyError = () => {
        throw new Error();
      };

      render(
        <ErrorBoundary>
          <ComponentWithEmptyError />
        </ErrorBoundary>
      );
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });

    it('calls onError callback when error occurs', () => {
      const onError = vi.fn();
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ componentStack: expect.any(String) })
      );
    });

    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error fallback</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('does not render anything when showDefaultUI is false and no fallback', () => {
      const { container } = render(
        <ErrorBoundary showDefaultUI={false}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('Recovery Options', () => {
    it('renders default recovery options', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
    });

    it('renders custom recovery options', () => {
      const customOptions = [
        { label: 'Custom Action', action: vi.fn(), variant: 'primary' as const },
      ];
      render(
        <ErrorBoundary recoveryOptions={customOptions}>
          <ThrowingComponent />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /custom action/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('resets error state when Try Again is clicked', async () => {
      const user = userEvent.setup();
      
      // Use a component that can be controlled
      let shouldThrow = true;
      const ControlledComponent = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Recovered content</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      );

      // Error should be shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Stop throwing and click retry
      shouldThrow = false;
      await user.click(screen.getByRole('button', { name: /try again/i }));

      // Re-render to trigger the reset
      rerender(
        <ErrorBoundary>
          <ControlledComponent />
        </ErrorBoundary>
      );

      // Should show recovered content
      expect(screen.getByText('Recovered content')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('wraps component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent);
    render(<WrappedComponent shouldThrow={false} />);
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('catches errors from wrapped component', () => {
    const WrappedComponent = withErrorBoundary(ThrowingComponent);
    render(<WrappedComponent shouldThrow={true} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('passes error boundary props', () => {
    const onError = vi.fn();
    const WrappedComponent = withErrorBoundary(ThrowingComponent, { onError });
    render(<WrappedComponent shouldThrow={true} />);
    expect(onError).toHaveBeenCalled();
  });

  it('sets displayName correctly', () => {
    const TestComponent = () => <div>Test</div>;
    TestComponent.displayName = 'TestComponent';
    const WrappedComponent = withErrorBoundary(TestComponent);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('uses component name when displayName is not set', () => {
    function NamedComponent() {
      return <div>Test</div>;
    }
    const WrappedComponent = withErrorBoundary(NamedComponent);
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(NamedComponent)');
  });
});

// Import afterEach for cleanup
import { afterEach } from 'vitest';
