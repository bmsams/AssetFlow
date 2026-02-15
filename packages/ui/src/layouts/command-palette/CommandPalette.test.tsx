import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

const items = [
  { id: 'dash', label: 'Dashboard', path: '/', group: 'Pages', keywords: ['home'] },
  { id: 'assets', label: 'Assets', path: '/assets', group: 'Pages', keywords: ['hardware'] },
  { id: 'create', label: 'Create Asset', path: '/assets/create', group: 'Actions' },
  { id: 'reports', label: 'Reports', path: '/reports', group: 'Pages' },
];

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('CommandPalette', () => {
  it('is hidden by default', () => {
    wrap(<CommandPalette items={items} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on Ctrl+K', async () => {
    const user = userEvent.setup();
    wrap(<CommandPalette items={items} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('shows all items when no query', async () => {
    const user = userEvent.setup();
    wrap(<CommandPalette items={items} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Create Asset')).toBeInTheDocument();
  });

  it('filters results on typing', async () => {
    const user = userEvent.setup();
    wrap(<CommandPalette items={items} />);
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByPlaceholderText(/search/i), 'ass');
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    wrap(<CommandPalette items={items} />);
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('supports fuzzy matching', async () => {
    const user = userEvent.setup();
    wrap(<CommandPalette items={items} />);
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByPlaceholderText(/search/i), 'hw');
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('calls onSelect when item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    wrap(<CommandPalette items={items} onSelect={onSelect} />);
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByText('Dashboard'));
    expect(onSelect).toHaveBeenCalled();
  });
});
