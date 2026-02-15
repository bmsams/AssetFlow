import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LeaseExpirationList } from './LeaseExpirationList';
import type { LeaseExpiration } from '../../types/dashboard';

const mockExpirations: LeaseExpiration[] = [
  {
    assetId: 'asset-001',
    assetTag: 'AMS-HW-20240115-ABC123',
    displayName: 'Dell PowerEdge R750 Server',
    leaseEndDate: '2025-02-15',
    daysUntilExpiration: 18,
    monthlyLeaseCost: 2500,
    severity: 'critical',
  },
  {
    assetId: 'asset-002',
    assetTag: 'AMS-HW-20240220-DEF456',
    displayName: 'HP ProLiant DL380 Gen10',
    leaseEndDate: '2025-02-28',
    daysUntilExpiration: 31,
    monthlyLeaseCost: 1800,
    severity: 'warning',
  },
  {
    assetId: 'asset-003',
    assetTag: 'AMS-HW-20240305-GHI789',
    displayName: 'Cisco Catalyst 9300 Switch',
    leaseEndDate: '2025-03-15',
    daysUntilExpiration: 46,
    monthlyLeaseCost: 950,
    severity: 'warning',
  },
];

describe('LeaseExpirationList', () => {
  it('renders title correctly', () => {
    render(<LeaseExpirationList expirations={mockExpirations} title="Lease Expirations" />);

    expect(screen.getByText('Lease Expirations')).toBeInTheDocument();
  });

  it('renders default title when not provided', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('Upcoming Lease Expirations')).toBeInTheDocument();
  });

  it('displays expiration count', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('3 expiring')).toBeInTheDocument();
  });

  it('renders all expiration items', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('Dell PowerEdge R750 Server')).toBeInTheDocument();
    expect(screen.getByText('HP ProLiant DL380 Gen10')).toBeInTheDocument();
    expect(screen.getByText('Cisco Catalyst 9300 Switch')).toBeInTheDocument();
  });

  it('renders asset tags', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('AMS-HW-20240115-ABC123')).toBeInTheDocument();
    expect(screen.getByText('AMS-HW-20240220-DEF456')).toBeInTheDocument();
  });

  it('renders days until expiration badges', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('18d')).toBeInTheDocument();
    expect(screen.getByText('31d')).toBeInTheDocument();
    expect(screen.getByText('46d')).toBeInTheDocument();
  });

  it('renders monthly lease costs', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByText('$2,500/mo')).toBeInTheDocument();
    expect(screen.getByText('$1,800/mo')).toBeInTheDocument();
    expect(screen.getByText('$950/mo')).toBeInTheDocument();
  });

  it('limits displayed items based on maxItems prop', () => {
    render(<LeaseExpirationList expirations={mockExpirations} maxItems={2} />);

    expect(screen.getByText('Dell PowerEdge R750 Server')).toBeInTheDocument();
    expect(screen.getByText('HP ProLiant DL380 Gen10')).toBeInTheDocument();
    expect(screen.queryByText('Cisco Catalyst 9300 Switch')).not.toBeInTheDocument();
  });

  it('shows View All button when there are more items than maxItems', () => {
    render(<LeaseExpirationList expirations={mockExpirations} maxItems={2} />);

    expect(screen.getByText('View All (3)')).toBeInTheDocument();
  });

  it('calls onItemClick when an item is clicked', () => {
    const handleClick = vi.fn();
    render(<LeaseExpirationList expirations={mockExpirations} onItemClick={handleClick} />);

    fireEvent.click(screen.getByText('Dell PowerEdge R750 Server'));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockExpirations[0]);
  });

  it('calls onViewAll when View All button is clicked', () => {
    const handleViewAll = vi.fn();
    render(
      <LeaseExpirationList
        expirations={mockExpirations}
        maxItems={2}
        onViewAll={handleViewAll}
      />
    );

    fireEvent.click(screen.getByText('View All (3)'));

    expect(handleViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders loading state correctly', () => {
    const { container } = render(<LeaseExpirationList expirations={[]} isLoading />);

    expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading lease expirations')).toBeInTheDocument();
  });

  it('renders empty state when no expirations', () => {
    render(<LeaseExpirationList expirations={[]} />);

    expect(screen.getByText('No upcoming lease expirations')).toBeInTheDocument();
  });

  it('applies severity classes to badges', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    const criticalBadge = screen.getByText('18d');
    const warningBadge = screen.getByText('31d');

    // CSS modules add prefixes, so check for partial class match
    expect(criticalBadge.className).toMatch(/critical/);
    expect(warningBadge.className).toMatch(/warning/);
  });

  it('accepts custom className', () => {
    const { container } = render(
      <LeaseExpirationList expirations={mockExpirations} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders list with correct aria-label', () => {
    render(<LeaseExpirationList expirations={mockExpirations} />);

    expect(screen.getByRole('list', { name: 'Lease expirations' })).toBeInTheDocument();
  });
});
