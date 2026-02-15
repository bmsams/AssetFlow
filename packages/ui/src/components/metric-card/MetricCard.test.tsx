import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Assets" value="1,247" />);
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('1,247')).toBeInTheDocument();
  });

  it('renders trend with direction and period', () => {
    render(
      <MetricCard
        label="Value"
        value="$2.4M"
        trend={{ value: 5.2, direction: 'up', period: 'vs last month' }}
      />
    );
    expect(screen.getByText(/5\.2%/)).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    render(
      <MetricCard label="Assets" value="100" sparkline={[10, 20, 30, 40, 50]} />
    );
    expect(document.querySelector('[data-testid="sparkline"]')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MetricCard label="Assets" value="100" onClick={onClick} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders loading skeleton', () => {
    render(<MetricCard label="Assets" value="0" isLoading />);
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <MetricCard label="Value" value="$100" icon={<span data-testid="metric-icon">$</span>} />
    );
    expect(screen.getByTestId('metric-icon')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<MetricCard label="Assets" value="100" subtitle="Across all categories" />);
    expect(screen.getByText('Across all categories')).toBeInTheDocument();
  });

  it('supports primary variant', () => {
    const { container } = render(<MetricCard label="Assets" value="100" variant="primary" />);
    expect(container.querySelector('[class*="primary"]')).toBeInTheDocument();
  });

  it('renders down trend', () => {
    render(
      <MetricCard label="Issues" value="3" trend={{ value: 12, direction: 'down' }} />
    );
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });
});
