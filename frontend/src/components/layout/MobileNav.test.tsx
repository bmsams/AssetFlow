import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { MobileNav, type MobileNavItem } from './MobileNav';

const mockNavItems: MobileNavItem[] = [
  {
    path: '/',
    label: 'Dashboard',
    icon: <span data-testid="dashboard-icon">D</span>,
  },
  {
    path: '/assets',
    label: 'Assets',
    icon: <span data-testid="assets-icon">A</span>,
  },
  {
    path: '/stockroom',
    label: 'Stockroom',
    icon: <span data-testid="stockroom-icon">S</span>,
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: <span data-testid="reports-icon">R</span>,
  },
];

function renderMobileNav(props: Partial<React.ComponentProps<typeof MobileNav>> = {}) {
  const defaultProps = {
    items: mockNavItems,
  };

  return render(
    <BrowserRouter>
      <MobileNav {...defaultProps} {...props} />
    </BrowserRouter>
  );
}

describe('MobileNav', () => {
  it('renders navigation items', () => {
    renderMobileNav();

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /assets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /stockroom/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
  });

  it('renders icons for navigation items', () => {
    renderMobileNav();

    expect(screen.getByTestId('dashboard-icon')).toBeInTheDocument();
    expect(screen.getByTestId('assets-icon')).toBeInTheDocument();
    expect(screen.getByTestId('stockroom-icon')).toBeInTheDocument();
    expect(screen.getByTestId('reports-icon')).toBeInTheDocument();
  });

  it('has correct href for navigation links', () => {
    renderMobileNav();

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /assets/i })).toHaveAttribute('href', '/assets');
    expect(screen.getByRole('link', { name: /stockroom/i })).toHaveAttribute('href', '/stockroom');
    expect(screen.getByRole('link', { name: /reports/i })).toHaveAttribute('href', '/reports');
  });

  it('has accessible navigation landmark', () => {
    renderMobileNav();

    expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
  });

  it('limits displayed items based on maxItems prop', () => {
    renderMobileNav({ maxItems: 2 });

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /assets/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /stockroom/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /reports/i })).not.toBeInTheDocument();
  });

  it('shows More button when onMoreClick is provided', () => {
    const onMoreClick = vi.fn();
    renderMobileNav({ onMoreClick });

    expect(screen.getByRole('button', { name: /more navigation options/i })).toBeInTheDocument();
  });

  it('calls onMoreClick when More button is clicked', async () => {
    const onMoreClick = vi.fn();
    const user = userEvent.setup();

    renderMobileNav({ onMoreClick });

    await user.click(screen.getByRole('button', { name: /more navigation options/i }));

    expect(onMoreClick).toHaveBeenCalledTimes(1);
  });

  it('shows More button when items exceed maxItems', () => {
    const manyItems: MobileNavItem[] = [
      ...mockNavItems,
      { path: '/extra', label: 'Extra', icon: <span>E</span> },
    ];

    renderMobileNav({ items: manyItems, maxItems: 4 });

    // Should show More button since we have 5 items but maxItems is 4
    expect(screen.getByRole('button', { name: /more navigation options/i })).toBeInTheDocument();
  });

  it('renders navigation list with correct structure', () => {
    renderMobileNav();

    const navList = screen.getByRole('list');
    expect(navList).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(4);
  });

  it('renders labels for each navigation item', () => {
    renderMobileNav();

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Stockroom')).toBeInTheDocument();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });
});
