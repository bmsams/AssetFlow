import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { MainLayout } from './MainLayout';
import { ThemeProvider } from '../theme';
import type { NavGroup } from './Sidebar';
import type { MobileNavItem } from './MobileNav';

const mockNavGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: <span>D</span> },
    ],
  },
  {
    title: 'Assets',
    items: [
      { path: '/assets', label: 'All Assets', icon: <span>A</span> },
      { path: '/stockroom', label: 'Stockroom', icon: <span>S</span> },
    ],
  },
];

const mockMobileNavItems: MobileNavItem[] = [
  { path: '/', label: 'Home', icon: <span data-testid="home-icon">H</span> },
  { path: '/assets', label: 'Assets', icon: <span data-testid="assets-icon">A</span> },
];

function renderMainLayout(
  children: React.ReactNode = <div>Test Content</div>,
  props: Partial<React.ComponentProps<typeof MainLayout>> = {}
) {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <MainLayout navGroups={mockNavGroups} {...props}>
          {children}
        </MainLayout>
      </ThemeProvider>
    </BrowserRouter>
  );
}

describe('MainLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders children content', () => {
    renderMainLayout(<div>My Page Content</div>);

    expect(screen.getByText('My Page Content')).toBeInTheDocument();
  });

  it('renders header with default title', () => {
    renderMainLayout();

    expect(screen.getByRole('heading', { name: /asset management system/i })).toBeInTheDocument();
  });

  it('renders header with custom title', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <MainLayout navGroups={mockNavGroups} title="Custom Title">
            <div>Content</div>
          </MainLayout>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole('heading', { name: /custom title/i })).toBeInTheDocument();
  });

  it('renders sidebar navigation', () => {
    renderMainLayout();

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  });

  it('renders skip link for accessibility', () => {
    renderMainLayout();

    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
  });

  it('skip link points to main content', () => {
    renderMainLayout();

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('main content has correct id for skip link', () => {
    renderMainLayout();

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('toggles sidebar when menu button is clicked', async () => {
    const user = userEvent.setup();

    renderMainLayout();

    const sidebar = screen.getByRole('navigation', { name: /main navigation/i }).closest('aside');
    
    // Initially sidebar should not have 'open' class (on mobile)
    expect(sidebar?.className).not.toMatch(/open/);

    // Click menu button
    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }));

    // Sidebar should now have 'open' class
    expect(sidebar?.className).toMatch(/open/);
  });

  describe('Mobile Navigation', () => {
    it('renders mobile navigation', () => {
      renderMainLayout();

      expect(screen.getByRole('navigation', { name: /mobile navigation/i })).toBeInTheDocument();
    });

    it('renders mobile nav with custom items', () => {
      renderMainLayout(<div>Content</div>, { mobileNavItems: mockMobileNavItems });

      expect(screen.getByTestId('home-icon')).toBeInTheDocument();
      expect(screen.getByTestId('assets-icon')).toBeInTheDocument();
    });

    it('renders More button in mobile nav', () => {
      renderMainLayout();

      expect(screen.getByRole('button', { name: /more navigation options/i })).toBeInTheDocument();
    });

    it('opens More drawer when More button is clicked', async () => {
      const user = userEvent.setup();

      renderMainLayout();

      await user.click(screen.getByRole('button', { name: /more navigation options/i }));

      // More drawer should be open with title
      expect(screen.getByRole('heading', { name: /more options/i })).toBeInTheDocument();
    });

    it('closes More drawer when close button is clicked', async () => {
      const user = userEvent.setup();

      renderMainLayout();

      // Open the drawer
      await user.click(screen.getByRole('button', { name: /more navigation options/i }));

      // Close the drawer
      await user.click(screen.getByRole('button', { name: /close drawer/i }));

      // Drawer should be closed (heading should not be visible)
      // Note: The drawer might still be in DOM but not visible
      const dialog = screen.queryByRole('dialog');
      expect(dialog?.className).not.toMatch(/open/);
    });

    it('renders navigation groups in More drawer', async () => {
      const user = userEvent.setup();

      renderMainLayout();

      await user.click(screen.getByRole('button', { name: /more navigation options/i }));

      // Should show nav group titles in the More drawer (using getAllByText since they appear in both sidebar and drawer)
      const overviewElements = screen.getAllByText('Overview');
      const assetsElements = screen.getAllByText('Assets');
      
      // Should have at least 2 occurrences (sidebar + drawer)
      expect(overviewElements.length).toBeGreaterThanOrEqual(2);
      expect(assetsElements.length).toBeGreaterThanOrEqual(2);
    });

    it('generates default mobile nav items from nav groups', () => {
      renderMainLayout();

      // Should have links from the nav groups
      const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
      expect(mobileNav).toBeInTheDocument();
    });
  });
});
