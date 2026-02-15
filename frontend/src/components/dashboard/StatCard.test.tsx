import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders label and value correctly', () => {
    render(<StatCard label="Total Assets" value="1,234" />);

    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard label="Total Assets" value="1,234" subtitle="Across all categories" />);

    expect(screen.getByText('Across all categories')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(<StatCard label="Total Assets" value="1,234" icon={<span data-testid="icon">📊</span>} />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('renders trend indicator with up direction', () => {
    render(
      <StatCard
        label="Total Assets"
        value="1,234"
        trend={{ value: 5.2, direction: 'up' }}
      />
    );

    const trend = screen.getByText(/5.2%/);
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveAttribute('aria-label', 'Increased by 5.2%');
  });

  it('renders trend indicator with down direction', () => {
    render(
      <StatCard
        label="Total Assets"
        value="1,234"
        trend={{ value: 3.1, direction: 'down' }}
      />
    );

    const trend = screen.getByText(/3.1%/);
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveAttribute('aria-label', 'Decreased by 3.1%');
  });

  it('renders trend indicator with neutral direction', () => {
    render(
      <StatCard
        label="Total Assets"
        value="1,234"
        trend={{ value: 0, direction: 'neutral' }}
      />
    );

    const trend = screen.getByText(/0%/);
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveAttribute('aria-label', 'No change by 0%');
  });

  it('renders loading state correctly', () => {
    const { container } = render(<StatCard label="Total Assets" value="1,234" isLoading />);

    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading statistic')).toBeInTheDocument();
  });

  it('applies variant class correctly', () => {
    const { container } = render(
      <StatCard label="Total Assets" value="1,234" variant="primary" />
    );

    // CSS modules add prefixes, so check for partial class match
    expect(container.firstChild?.className).toMatch(/primary/);
  });

  it('applies size class correctly', () => {
    const { container } = render(
      <StatCard label="Total Assets" value="1,234" size="lg" />
    );

    // CSS modules add prefixes, so check for partial class match
    expect(container.firstChild?.className).toMatch(/lg/);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <StatCard label="Total Assets" value="1,234" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders numeric value correctly', () => {
    render(<StatCard label="Total Assets" value={1234} />);

    expect(screen.getByText('1234')).toBeInTheDocument();
  });
});
