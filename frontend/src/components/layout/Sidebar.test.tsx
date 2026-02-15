import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar, type NavGroup } from './Sidebar';

const mockNavGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard' },
    ],
  },
  {
    title: 'Assets',
    items: [
      { path: '/assets', label: 'All Assets' },
      { path: '/assets/hardware', label: 'Hardware' },
    ],
  },
];

function renderSidebar(props: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
    navGroups: mockNavGroups,
  };

  return render(
    <BrowserRouter>
      <Sidebar {...defaultProps} {...props} />
    </BrowserRouter>
  );
}

describe('Sidebar', () => {
  it('renders navigation groups', () => {
    renderSidebar();

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /all assets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /hardware/i })).toBeInTheDocument();
  });

  it('has correct href for navigation links', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /all assets/i })).toHaveAttribute('href', '/assets');
    expect(screen.getByRole('link', { name: /hardware/i })).toHaveAttribute('href', '/assets/hardware');
  });

  it('shows overlay when sidebar is open', () => {
    renderSidebar({ isOpen: true });

    expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument();
  });

  it('does not show overlay when sidebar is closed', () => {
    renderSidebar({ isOpen: false });

    expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderSidebar({ isOpen: true, onClose });

    await user.click(screen.getByTestId('sidebar-overlay'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has accessible navigation landmark', () => {
    renderSidebar();

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('renders icons when provided', () => {
    const navGroupsWithIcons: NavGroup[] = [
      {
        title: 'Test',
        items: [
          {
            path: '/test',
            label: 'Test Item',
            icon: <span data-testid="test-icon">Icon</span>,
          },
        ],
      },
    ];

    renderSidebar({ navGroups: navGroupsWithIcons });

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
