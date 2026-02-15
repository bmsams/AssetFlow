import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Loading, LoadingOverlay, LoadingButtonContent } from './Loading';

describe('Loading', () => {
  describe('Basic Loading', () => {
    it('renders with default props', () => {
      render(<Loading />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('has aria-busy attribute', () => {
      render(<Loading />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('has aria-live attribute for accessibility', () => {
      render(<Loading />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('renders screen reader text', () => {
      render(<Loading />);
      expect(screen.getByText(/loading/i, { selector: '.sr-only' })).toBeInTheDocument();
    });

    it('renders message when provided', () => {
      render(<Loading message="Fetching data..." />);
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });

    it('includes message in screen reader text', () => {
      render(<Loading message="Fetching data..." />);
      expect(screen.getByText(/loading: fetching data/i, { selector: '.sr-only' })).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('applies sm size', () => {
      render(<Loading size="sm" data-testid="loading" />);
      expect(screen.getByTestId('loading').querySelector('[class*="indicator"]')?.className).toMatch(/sm/);
    });

    it('applies md size by default', () => {
      render(<Loading data-testid="loading" />);
      expect(screen.getByTestId('loading').querySelector('[class*="indicator"]')?.className).toMatch(/md/);
    });

    it('applies lg size', () => {
      render(<Loading size="lg" data-testid="loading" />);
      expect(screen.getByTestId('loading').querySelector('[class*="indicator"]')?.className).toMatch(/lg/);
    });

    it('applies xl size', () => {
      render(<Loading size="xl" data-testid="loading" />);
      expect(screen.getByTestId('loading').querySelector('[class*="indicator"]')?.className).toMatch(/xl/);
    });
  });

  describe('Variants', () => {
    it('renders spinner variant by default', () => {
      render(<Loading data-testid="loading" />);
      const indicator = screen.getByTestId('loading').querySelector('[class*="indicator"]');
      expect(indicator?.className).toMatch(/spinner/);
      expect(indicator?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders dots variant', () => {
      render(<Loading variant="dots" data-testid="loading" />);
      const indicator = screen.getByTestId('loading').querySelector('[class*="indicator"]');
      expect(indicator?.className).toMatch(/dots/);
      const dots = indicator?.querySelectorAll('[class*="dot"]');
      expect(dots).toHaveLength(3);
    });

    it('renders bar variant', () => {
      render(<Loading variant="bar" data-testid="loading" />);
      const indicator = screen.getByTestId('loading').querySelector('[class*="indicator"]');
      expect(indicator?.className).toMatch(/bar/);
      expect(indicator?.querySelector('[class*="barInner"]')).toBeInTheDocument();
    });
  });

  describe('Layout Options', () => {
    it('applies fullPage class when fullPage is true', () => {
      render(<Loading fullPage data-testid="loading" />);
      expect(screen.getByTestId('loading').className).toMatch(/fullPage/);
    });

    it('applies inline class when inline is true', () => {
      render(<Loading inline data-testid="loading" />);
      expect(screen.getByTestId('loading').className).toMatch(/inline/);
    });

    it('applies custom className', () => {
      render(<Loading className="custom-loading" data-testid="loading" />);
      expect(screen.getByTestId('loading').className).toMatch(/custom-loading/);
    });
  });
});

describe('LoadingOverlay', () => {
  it('renders when isVisible is true', () => {
    render(<LoadingOverlay isVisible={true} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render when isVisible is false', () => {
    render(<LoadingOverlay isVisible={false} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders with default message', () => {
    render(<LoadingOverlay isVisible={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingOverlay isVisible={true} message="Saving changes..." />);
    expect(screen.getByText('Saving changes...')).toBeInTheDocument();
  });

  it('passes through loading props', () => {
    render(<LoadingOverlay isVisible={true} size="lg" variant="dots" />);
    const indicator = screen.getByRole('status').querySelector('[class*="indicator"]');
    expect(indicator?.className).toMatch(/lg/);
    expect(indicator?.className).toMatch(/dots/);
  });
});

describe('LoadingButtonContent', () => {
  it('renders children when not loading', () => {
    render(
      <LoadingButtonContent isLoading={false}>
        <span>Submit</span>
      </LoadingButtonContent>
    );
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('renders loading state when isLoading is true', () => {
    render(
      <LoadingButtonContent isLoading={true}>
        <span>Submit</span>
      </LoadingButtonContent>
    );
    // Use getAllByText since there are multiple "Loading..." texts (visible and sr-only)
    const loadingTexts = screen.getAllByText('Loading...');
    expect(loadingTexts.length).toBeGreaterThan(0);
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('renders custom loading text', () => {
    render(
      <LoadingButtonContent isLoading={true} loadingText="Submitting...">
        <span>Submit</span>
      </LoadingButtonContent>
    );
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('renders loading spinner when loading', () => {
    render(
      <LoadingButtonContent isLoading={true}>
        <span>Submit</span>
      </LoadingButtonContent>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
