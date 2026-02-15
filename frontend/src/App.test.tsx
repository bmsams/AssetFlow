import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from './App';

// Helper to get the main sidebar navigation
const getSidebarNav = () => screen.getByRole('navigation', { name: /main navigation/i });

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // Reset URL to root
    window.history.pushState({}, '', '/');
  });

  it('renders the application', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /asset management system/i })).toBeInTheDocument();
  });

  it('renders dashboard page by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('renders sidebar navigation', () => {
    render(<App />);

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('navigates to assets page when clicking All Assets link', async () => {
    const user = userEvent.setup();

    render(<App />);

    // Use the sidebar navigation to avoid duplicate links
    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /all assets/i }));

    expect(screen.getByRole('heading', { name: /all assets/i })).toBeInTheDocument();
  });

  it('navigates to hardware assets page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /^hardware$/i }));

    expect(screen.getByRole('heading', { name: /hardware assets/i })).toBeInTheDocument();
  });

  it('navigates to software assets page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /^software$/i }));

    expect(screen.getByRole('heading', { name: /software assets/i })).toBeInTheDocument();
  });

  it('navigates to enterprise assets page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /^enterprise$/i }));

    expect(screen.getByRole('heading', { name: /enterprise assets/i })).toBeInTheDocument();
  });

  it('navigates to stockrooms page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /stockrooms/i }));

    // The page title is "Stockroom Dashboard"
    expect(screen.getByRole('heading', { name: /stockroom dashboard/i })).toBeInTheDocument();
  });

  it('navigates to contracts page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /contracts/i }));

    expect(screen.getByRole('heading', { name: /contracts/i })).toBeInTheDocument();
  });

  it('navigates to reports page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /reports/i }));

    // The page has an h1 with "Reports" as the page title
    expect(screen.getByRole('heading', { level: 1, name: /reports/i })).toBeInTheDocument();
  });

  it('navigates to settings page', async () => {
    const user = userEvent.setup();

    render(<App />);

    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /settings/i }));

    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows 404 page for unknown routes', () => {
    window.history.pushState({}, '', '/unknown-route');

    render(<App />);

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('can navigate back to dashboard from 404 page', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/unknown-route');

    render(<App />);

    await user.click(screen.getByRole('link', { name: /go to dashboard/i }));

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('supports browser history navigation', async () => {
    const user = userEvent.setup();

    render(<App />);

    // Navigate to assets page using sidebar
    const sidebar = getSidebarNav();
    await user.click(within(sidebar).getByRole('link', { name: /all assets/i }));
    expect(screen.getByRole('heading', { name: /all assets/i })).toBeInTheDocument();

    // Navigate to hardware page
    await user.click(within(sidebar).getByRole('link', { name: /^hardware$/i }));
    expect(screen.getByRole('heading', { name: /hardware assets/i })).toBeInTheDocument();

    // Go back in history
    window.history.back();
    
    // Wait for navigation to complete
    await screen.findByRole('heading', { name: /all assets/i });
  });
});
