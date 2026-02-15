import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { AppShell } from './AppShell';

const navGroups = [
  { title: 'Main', items: [{ path: '/', label: 'Dashboard' }] },
];

describe('AppShell', () => {
  it('renders sidebar, header, and content', () => {
    render(
      <MemoryRouter>
        <AppShell appName="Test App" navGroups={navGroups} user={{ name: 'John', role: 'Admin', avatar: '' }}>
          <p>Page content</p>
        </AppShell>
      </MemoryRouter>
    );
    // appName appears in both sidebar brand and header title
    const appNameElements = screen.getAllByText('Test App');
    expect(appNameElements.length).toBeGreaterThanOrEqual(1);
    // Verify the header renders an h1 with the app name
    expect(screen.getByRole('heading', { level: 1, name: 'Test App' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('renders without sidebar when sidebar=false', () => {
    render(
      <MemoryRouter>
        <AppShell appName="App" navGroups={navGroups} sidebar={false}>
          <p>Content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('renders without header when header=false', () => {
    render(
      <MemoryRouter>
        <AppShell appName="Hidden Header" navGroups={navGroups} header={false}>
          <p>Body</p>
        </AppShell>
      </MemoryRouter>
    );
    // With header=false, no h1 heading should be rendered
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('supports custom logo', () => {
    render(
      <MemoryRouter>
        <AppShell appName="App" navGroups={navGroups} logo={<span data-testid="custom-logo">L</span>}>
          <p>Content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByTestId('custom-logo')).toBeInTheDocument();
  });

  it('renders header actions when provided', () => {
    render(
      <MemoryRouter>
        <AppShell appName="App" navGroups={navGroups} headerActions={<button>Save</button>}>
          <p>Content</p>
        </AppShell>
      </MemoryRouter>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
