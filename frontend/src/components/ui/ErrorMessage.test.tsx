import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import {
  ErrorMessage,
  NetworkError,
  NotFoundError,
  PermissionError,
} from './ErrorMessage';

describe('ErrorMessage', () => {
  describe('Basic Rendering', () => {
    it('renders title and message', () => {
      render(
        <ErrorMessage
          title="Error Title"
          message="Error message description"
        />
      );
      expect(screen.getByText('Error Title')).toBeInTheDocument();
      expect(screen.getByText('Error message description')).toBeInTheDocument();
    });

    it('has alert role for accessibility', () => {
      render(<ErrorMessage title="Error" message="Something went wrong" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('has aria-live attribute', () => {
      render(<ErrorMessage title="Error" message="Something went wrong" />);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('renders details when provided', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          details="Error code: ERR_001"
        />
      );
      expect(screen.getByText('Error code: ERR_001')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          className="custom-error"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/custom-error/);
    });
  });

  describe('Error Types', () => {
    it('applies error type styling', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          type="error"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/error/);
    });

    it('applies warning type styling', () => {
      render(
        <ErrorMessage
          title="Warning"
          message="Please be careful"
          type="warning"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/warning/);
    });

    it('applies info type styling', () => {
      render(
        <ErrorMessage
          title="Info"
          message="For your information"
          type="info"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/info/);
    });

    it('applies not-found type styling', () => {
      render(
        <ErrorMessage
          title="Not Found"
          message="Resource not found"
          type="not-found"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/not-found/);
    });

    it('applies network type styling', () => {
      render(
        <ErrorMessage
          title="Network Error"
          message="Connection failed"
          type="network"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/network/);
    });

    it('applies permission type styling', () => {
      render(
        <ErrorMessage
          title="Access Denied"
          message="No permission"
          type="permission"
        />
      );
      expect(screen.getByRole('alert').className).toMatch(/permission/);
    });
  });

  describe('Recovery Options', () => {
    it('renders recovery buttons', () => {
      const onRetry = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          recoveryOptions={[
            { label: 'Retry', action: onRetry },
          ]}
        />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('calls action when recovery button is clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          recoveryOptions={[
            { label: 'Retry', action: onRetry },
          ]}
        />
      );

      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders multiple recovery options', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          recoveryOptions={[
            { label: 'Retry', action: vi.fn() },
            { label: 'Go Back', action: vi.fn() },
            { label: 'Contact Support', action: vi.fn() },
          ]}
        />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /contact support/i })).toBeInTheDocument();
    });

    it('applies button variants', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          recoveryOptions={[
            { label: 'Primary', action: vi.fn(), variant: 'primary' },
            { label: 'Secondary', action: vi.fn(), variant: 'secondary' },
          ]}
        />
      );
      expect(screen.getByRole('button', { name: /primary/i }).className).toMatch(/primary/);
      expect(screen.getByRole('button', { name: /secondary/i }).className).toMatch(/secondary/);
    });

    it('shows loading state on button', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          recoveryOptions={[
            { label: 'Retry', action: vi.fn(), isLoading: true },
          ]}
        />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Custom Icon', () => {
    it('renders custom icon when provided', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          icon={<span data-testid="custom-icon">🚨</span>}
        />
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });
  });
});

describe('NetworkError', () => {
  it('renders network error message', () => {
    render(<NetworkError />);
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/unable to connect/i)).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    render(<NetworkError onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<NetworkError />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<NetworkError onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isRetrying is true', () => {
    render(<NetworkError onRetry={vi.fn()} isRetrying={true} />);
    expect(screen.getByRole('button', { name: /retry/i })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('NotFoundError', () => {
  it('renders not found error message', () => {
    render(<NotFoundError />);
    expect(screen.getByText('Resource Not Found')).toBeInTheDocument();
  });

  it('renders with custom resource name', () => {
    render(<NotFoundError resourceName="Asset" />);
    expect(screen.getByText('Asset Not Found')).toBeInTheDocument();
    expect(screen.getByText(/the asset you're looking for/i)).toBeInTheDocument();
  });

  it('renders go back button when onGoBack is provided', () => {
    render(<NotFoundError onGoBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('renders go home button when onGoHome is provided', () => {
    render(<NotFoundError onGoHome={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go to dashboard/i })).toBeInTheDocument();
  });

  it('calls onGoBack when go back button is clicked', async () => {
    const user = userEvent.setup();
    const onGoBack = vi.fn();
    render(<NotFoundError onGoBack={onGoBack} />);

    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls onGoHome when go home button is clicked', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();
    render(<NotFoundError onGoHome={onGoHome} />);

    await user.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});

describe('PermissionError', () => {
  it('renders permission error message', () => {
    render(<PermissionError />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/don't have permission/i)).toBeInTheDocument();
  });

  it('renders request access button when onRequestAccess is provided', () => {
    render(<PermissionError onRequestAccess={vi.fn()} />);
    expect(screen.getByRole('button', { name: /request access/i })).toBeInTheDocument();
  });

  it('renders go back button when onGoBack is provided', () => {
    render(<PermissionError onGoBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('calls onRequestAccess when request access button is clicked', async () => {
    const user = userEvent.setup();
    const onRequestAccess = vi.fn();
    render(<PermissionError onRequestAccess={onRequestAccess} />);

    await user.click(screen.getByRole('button', { name: /request access/i }));
    expect(onRequestAccess).toHaveBeenCalledTimes(1);
  });

  it('calls onGoBack when go back button is clicked', async () => {
    const user = userEvent.setup();
    const onGoBack = vi.fn();
    render(<PermissionError onGoBack={onGoBack} />);

    await user.click(screen.getByRole('button', { name: /go back/i }));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorMessage Inline Variant', () => {
  describe('Variant Prop', () => {
    it('renders with page variant by default', () => {
      render(<ErrorMessage title="Error" message="Something went wrong" />);
      const alert = screen.getByRole('alert');
      expect(alert.className).not.toMatch(/inline/);
    });

    it('renders with page variant when explicitly set', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="page"
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).not.toMatch(/inline/);
    });

    it('renders with inline variant styling', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).toMatch(/inline/);
    });

    it('applies error type styling with inline variant', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          type="error"
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).toMatch(/inline/);
      expect(alert.className).toMatch(/error/);
    });

    it('applies warning type styling with inline variant', () => {
      render(
        <ErrorMessage
          title="Warning"
          message="Please be careful"
          variant="inline"
          type="warning"
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).toMatch(/inline/);
      expect(alert.className).toMatch(/warning/);
    });

    it('applies info type styling with inline variant', () => {
      render(
        <ErrorMessage
          title="Info"
          message="For your information"
          variant="inline"
          type="info"
        />
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).toMatch(/inline/);
      expect(alert.className).toMatch(/info/);
    });
  });

  describe('Dismiss Functionality', () => {
    it('does not render dismiss button for page variant', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="page"
          onDismiss={onDismiss}
        />
      );
      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('does not render dismiss button for inline variant without onDismiss', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
        />
      );
      expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
    });

    it('renders dismiss button for inline variant with onDismiss', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          onDismiss={onDismiss}
        />
      );
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('calls onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismiss button has accessible label', () => {
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          onDismiss={onDismiss}
        />
      );
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error message');
    });
  });

  describe('Inline Variant with Recovery Options', () => {
    it('renders recovery buttons in inline variant', () => {
      const onRetry = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          recoveryOptions={[{ label: 'Retry', action: onRetry }]}
        />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('renders both recovery buttons and dismiss button in inline variant', () => {
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          recoveryOptions={[{ label: 'Retry', action: onRetry }]}
          onDismiss={onDismiss}
        />
      );
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('calls correct callback when retry is clicked in inline variant', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          recoveryOptions={[{ label: 'Retry', action: onRetry }]}
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByRole('button', { name: /retry/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('calls correct callback when dismiss is clicked in inline variant', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          recoveryOptions={[{ label: 'Retry', action: onRetry }]}
          onDismiss={onDismiss}
        />
      );

      await user.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('inline variant maintains alert role', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
        />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('inline variant maintains aria-live attribute', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
        />
      );
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
    });

    it('inline variant renders title and message', () => {
      render(
        <ErrorMessage
          title="Connection Error"
          message="Unable to connect to server"
          variant="inline"
        />
      );
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText('Unable to connect to server')).toBeInTheDocument();
    });

    it('inline variant renders details when provided', () => {
      render(
        <ErrorMessage
          title="Error"
          message="Something went wrong"
          variant="inline"
          details="Error code: ERR_500"
        />
      );
      expect(screen.getByText('Error code: ERR_500')).toBeInTheDocument();
    });
  });
});
