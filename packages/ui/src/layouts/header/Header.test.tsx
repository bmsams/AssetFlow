import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { Header } from './Header';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('Header', () => {
  it('renders breadcrumbs', () => {
    wrap(
      <Header
        breadcrumbs={[
          { label: 'Dashboard', href: '/' },
          { label: 'Assets' },
        ]}
      />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('renders page title', () => {
    wrap(<Header title="Assets" />);
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    wrap(<Header title="Assets" actions={<button>Export</button>} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('renders notification bell', () => {
    wrap(<Header title="Assets" showNotifications notificationCount={3} />);
    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders user avatar', () => {
    wrap(<Header title="Assets" user={{ name: 'John', role: 'Admin' }} />);
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('renders subtitle/description', () => {
    wrap(<Header title="Assets" subtitle="Manage your hardware and software" />);
    expect(screen.getByText('Manage your hardware and software')).toBeInTheDocument();
  });
});
