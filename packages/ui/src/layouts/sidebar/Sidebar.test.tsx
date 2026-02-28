import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Sidebar } from './Sidebar';

const navGroups = [
  {
    title: 'Main',
    items: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/assets', label: 'Assets', icon: '📦', badge: 42 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { path: '/admin/users', label: 'Users', icon: '👥' },
    ],
  },
];

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Sidebar', () => {
  it('renders app name', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    expect(screen.getByText('AMS')).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders group titles', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders badge count', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders collapse toggle button', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    expect(screen.getByRole('button', { name: /collapse/i })).toBeInTheDocument();
  });

  it('renders user info when provided', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} user={{ name: 'John', role: 'Admin' }} />);
    expect(screen.getByText('John')).toBeInTheDocument();
    // 'Admin' appears as both a group title and user role
    const adminTexts = screen.getAllByText('Admin');
    expect(adminTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders custom logo', () => {
    wrap(<Sidebar appName="AMS" navGroups={navGroups} logo={<span data-testid="logo">L</span>} />);
    expect(screen.getByTestId('logo')).toBeInTheDocument();
  });

  it('collapses groups on group title click', async () => {
    const user = userEvent.setup();
    wrap(<Sidebar appName="AMS" navGroups={navGroups} />);
    // Click the group header to collapse it - use getAllByText since 'Admin' appears as both group title and user role
    const adminElements = screen.getAllByText('Admin');
    // The group title is the first one in the document
    await user.click(adminElements[0]);
    // After collapse, the items list should have the hidden class (jsdom doesn't evaluate CSS, so check class)
    const usersLink = screen.getByText('Users');
    const itemsList = usersLink.closest('ul');
    expect(itemsList?.className).toContain('hidden');
  });
});
