import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LifecycleChart } from './LifecycleChart';
import type { LifecycleDistribution } from '../../types/dashboard';

const mockData: LifecycleDistribution[] = [
  { status: 'DEPLOYED', label: 'Deployed', count: 100, percentage: 50, color: '#22c55e' },
  { status: 'IN_STOCK', label: 'In Stock', count: 60, percentage: 30, color: '#3b82f6' },
  { status: 'RETIRED', label: 'Retired', count: 40, percentage: 20, color: '#6b7280' },
];

describe('LifecycleChart', () => {
  it('renders title correctly', () => {
    render(<LifecycleChart data={mockData} title="Asset Lifecycle" />);

    expect(screen.getByText('Asset Lifecycle')).toBeInTheDocument();
  });

  it('renders default title when not provided', () => {
    render(<LifecycleChart data={mockData} />);

    expect(screen.getByText('Lifecycle Distribution')).toBeInTheDocument();
  });

  it('displays total asset count', () => {
    render(<LifecycleChart data={mockData} />);

    expect(screen.getByText('200 total assets')).toBeInTheDocument();
  });

  it('renders all lifecycle status labels', () => {
    render(<LifecycleChart data={mockData} />);

    // Use getAllByText since labels appear in both chart and legend
    expect(screen.getAllByText('Deployed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('In Stock').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Retired').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status counts', () => {
    render(<LifecycleChart data={mockData} />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders percentages', () => {
    render(<LifecycleChart data={mockData} />);

    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('30.0%')).toBeInTheDocument();
    expect(screen.getByText('20.0%')).toBeInTheDocument();
  });

  it('renders legend when showLegend is true', () => {
    render(<LifecycleChart data={mockData} showLegend />);

    const legend = screen.getByRole('list', { name: 'Chart legend' });
    expect(legend).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('hides legend when showLegend is false', () => {
    render(<LifecycleChart data={mockData} showLegend={false} />);

    expect(screen.queryByRole('list', { name: 'Chart legend' })).not.toBeInTheDocument();
  });

  it('renders loading state correctly', () => {
    const { container } = render(<LifecycleChart data={[]} isLoading />);

    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading lifecycle chart')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<LifecycleChart data={[]} />);

    expect(screen.getByText('No lifecycle data available')).toBeInTheDocument();
  });

  it('renders progress bars with correct aria attributes', () => {
    render(<LifecycleChart data={mockData} />);

    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars).toHaveLength(3);

    // Check first progress bar
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '50');
    expect(progressBars[0]).toHaveAttribute('aria-valuemin', '0');
    expect(progressBars[0]).toHaveAttribute('aria-valuemax', '100');
  });

  it('accepts custom className', () => {
    const { container } = render(
      <LifecycleChart data={mockData} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders donut chart with total count', () => {
    render(<LifecycleChart data={mockData} />);

    // The donut chart should show total count
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });
});
