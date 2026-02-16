import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { KPIBanner } from './KPIBanner';

describe('KPIBanner', () => {
  const items = [
    { label: 'Total Assets', value: '2,847' },
    { label: 'Active', value: '2,156', trend: { direction: 'up' as const, value: '+12%', period: 'vs last month' } },
    { label: 'Pending', value: '142', sparkline: [10, 15, 12, 18, 22, 20, 25] },
  ];

  it('renders all KPI items', () => {
    render(<KPIBanner items={items} />);
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('2,847')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders trend indicator', () => {
    render(<KPIBanner items={items} />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('supports click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<KPIBanner items={[{ label: 'Test', value: 100, onClick }]} />);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('renders sparkline SVG when sparkline data provided', () => {
    const { container } = render(<KPIBanner items={items} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
