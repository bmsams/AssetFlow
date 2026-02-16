import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ActivityFeed } from './ActivityFeed';

describe('ActivityFeed', () => {
  const items = [
    {
      id: '1',
      type: 'created' as const,
      description: 'Asset LAPTOP-001 was created',
      timestamp: new Date().toISOString(),
      user: { name: 'John Doe' },
    },
    {
      id: '2',
      type: 'updated' as const,
      description: 'Asset LAPTOP-001 status changed to Active',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      user: { name: 'Jane Smith' },
    },
    {
      id: '3',
      type: 'assigned' as const,
      description: 'Asset LAPTOP-001 assigned to Bob',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      user: { name: 'Alice Brown' },
    },
  ];

  it('renders all activity items', () => {
    render(<ActivityFeed items={items} />);
    expect(screen.getByText('Asset LAPTOP-001 was created')).toBeInTheDocument();
    expect(screen.getByText(/status changed/)).toBeInTheDocument();
    expect(screen.getByText(/assigned to Bob/)).toBeInTheDocument();
  });

  it('shows user names', () => {
    render(<ActivityFeed items={items} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows empty message when no items', () => {
    render(<ActivityFeed items={[]} emptyMessage="No recent activity" />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('supports item click handler', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ActivityFeed items={items} onItemClick={onClick} />);
    await user.click(screen.getByText('Asset LAPTOP-001 was created'));
    expect(onClick).toHaveBeenCalledWith(items[0]);
  });

  it('renders user initials as avatar fallback', () => {
    render(<ActivityFeed items={items} />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });
});
