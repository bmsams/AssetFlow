import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

describe('Breadcrumbs', () => {
  describe('Basic Rendering', () => {
    it('renders breadcrumb navigation with items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={items} />);

      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Current Page')).toBeInTheDocument();
    });

    it('returns null when items array is empty', () => {
      const { container } = render(<Breadcrumbs items={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('returns null when items is undefined', () => {
      const { container } = render(<Breadcrumbs items={undefined as unknown as BreadcrumbItem[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders single item as current page', () => {
      const items: BreadcrumbItem[] = [{ label: 'Dashboard' }];

      render(<Breadcrumbs items={items} />);

      const currentPage = screen.getByText('Dashboard');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('Link Rendering', () => {
    it('renders non-current items with href as clickable links', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={items} />);

      const homeLink = screen.getByRole('link', { name: /home/i });
      const assetsLink = screen.getByRole('link', { name: /assets/i });

      expect(homeLink).toHaveAttribute('href', '/');
      expect(assetsLink).toHaveAttribute('href', '/assets');
    });

    it('renders last item as non-clickable span', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={items} />);

      const currentPage = screen.getByText('Current Page');
      expect(currentPage.tagName).toBe('SPAN');
      expect(screen.queryByRole('link', { name: /current page/i })).not.toBeInTheDocument();
    });

    it('renders item without href as non-clickable even if not last', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Middle' }, // No href
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={items} />);

      const middleItem = screen.getByText('Middle');
      expect(middleItem.tagName).toBe('SPAN');
    });
  });

  describe('ARIA Attributes', () => {
    it('has aria-label="Breadcrumb" on nav element', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      const nav = screen.getByRole('navigation');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('has aria-current="page" only on the last item', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current Page' },
      ];

      render(<Breadcrumbs items={items} />);

      const currentPage = screen.getByText('Current Page');
      expect(currentPage).toHaveAttribute('aria-current', 'page');

      // Other items should not have aria-current
      expect(screen.getByText('Home')).not.toHaveAttribute('aria-current');
      expect(screen.getByText('Assets')).not.toHaveAttribute('aria-current');
    });

    it('renders breadcrumb items in an ordered list', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('Separator', () => {
    it('renders default separator "/" between items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      // There should be 2 separators for 3 items
      const separators = screen.getAllByText('/');
      expect(separators).toHaveLength(2);
    });

    it('renders custom separator when provided', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} separator=">" />);

      expect(screen.getByText('>')).toBeInTheDocument();
    });

    it('renders custom React node as separator', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(
        <Breadcrumbs
          items={items}
          separator={<span data-testid="custom-separator">→</span>}
        />
      );

      expect(screen.getByTestId('custom-separator')).toBeInTheDocument();
    });

    it('separators have aria-hidden="true"', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      const separator = screen.getByText('/');
      expect(separator).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Truncation (maxItems)', () => {
    it('shows all items when count is less than or equal to maxItems', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} maxItems={4} />);

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Level 1')).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.queryByText('…')).not.toBeInTheDocument();
    });

    it('truncates middle items with ellipsis when count exceeds maxItems', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Level 3', href: '/level3' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} maxItems={4} />);

      // Should show: Home, ..., Level 3, Current
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('…')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();

      // Middle items should be hidden
      expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
    });

    it('uses default maxItems of 4', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Level 3', href: '/level3' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      // With default maxItems=4, should truncate 5 items
      expect(screen.getByText('…')).toBeInTheDocument();
    });

    it('ellipsis has aria-hidden="true"', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Level 3', href: '/level3' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} maxItems={3} />);

      const ellipsis = screen.getByText('…');
      expect(ellipsis).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Custom className', () => {
    it('applies custom className when provided', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} className="custom-breadcrumbs" />);

      const nav = screen.getByRole('navigation');
      expect(nav.className).toContain('custom-breadcrumbs');
    });

    it('combines custom className with default classes', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} className="custom-class" />);

      const nav = screen.getByRole('navigation');
      expect(nav.className).toContain('custom-class');
      expect(nav.className).toContain('breadcrumbs');
    });
  });

  describe('Edge Cases', () => {
    it('handles items with special characters in labels', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home & Dashboard', href: '/' },
        { label: 'Assets <Test>', href: '/assets' },
        { label: 'Current "Page"' },
      ];

      render(<Breadcrumbs items={items} />);

      expect(screen.getByText('Home & Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Assets <Test>')).toBeInTheDocument();
      expect(screen.getByText('Current "Page"')).toBeInTheDocument();
    });

    it('handles very long labels', () => {
      const longLabel = 'This is a very long breadcrumb label that might need truncation';
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: longLabel },
      ];

      render(<Breadcrumbs items={items} />);

      expect(screen.getByText(longLabel)).toBeInTheDocument();
    });

    it('handles maxItems of 2 with many items', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} maxItems={2} />);

      // With maxItems=2, should show: Home, ..., Current (at least 1 last item)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('…')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
    });

    it('handles maxItems of 3 correctly', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Level 1', href: '/level1' },
        { label: 'Level 2', href: '/level2' },
        { label: 'Level 3', href: '/level3' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} maxItems={3} />);

      // Should show: Home, ..., Current (maxItems - 2 = 1 last item)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('…')).toBeInTheDocument();
      expect(screen.getByText('Current')).toBeInTheDocument();
      expect(screen.queryByText('Level 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Level 3')).not.toBeInTheDocument();
    });
  });

  describe('Semantic HTML Structure', () => {
    it('renders as nav element with proper structure', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav.tagName).toBe('NAV');

      const list = screen.getByRole('list');
      expect(list.tagName).toBe('OL');
    });

    it('renders links with proper href attributes', () => {
      const items: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets?filter=active' },
        { label: 'Current' },
      ];

      render(<Breadcrumbs items={items} />);

      expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
      expect(screen.getByRole('link', { name: /assets/i })).toHaveAttribute('href', '/assets?filter=active');
    });
  });
});
