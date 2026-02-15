import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PageLayout, type BreadcrumbItem } from './PageLayout';

function renderWithRouter(ui: JSX.Element) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('PageLayout', () => {
  describe('Basic Rendering', () => {
    it('renders the page title', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByRole('heading', { name: /test page/i, level: 1 })).toBeInTheDocument();
    });

    it('renders children content', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div data-testid="child-content">Child Content</div>
        </PageLayout>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
      renderWithRouter(
        <PageLayout title="Test Page" description="This is a test description">
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByText('This is a test description')).toBeInTheDocument();
    });

    it('does not render description when not provided', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      // Only the title should be in the header text area
      const heading = screen.getByRole('heading', { name: /test page/i });
      expect(heading.parentElement?.querySelectorAll('p')).toHaveLength(0);
    });
  });

  describe('Breadcrumb Navigation', () => {
    it('renders breadcrumbs when provided', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current Page' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Assets')).toBeInTheDocument();
      expect(screen.getByText('Current Page')).toBeInTheDocument();
    });

    it('renders clickable links for non-current breadcrumb items', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current Page' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      const homeLink = screen.getByRole('link', { name: /home/i });
      const assetsLink = screen.getByRole('link', { name: /assets/i });

      expect(homeLink).toHaveAttribute('href', '/');
      expect(assetsLink).toHaveAttribute('href', '/assets');
    });

    it('renders last breadcrumb item as non-clickable with aria-current', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current Page' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      const currentPage = screen.getByText('Current Page');
      expect(currentPage).toHaveAttribute('aria-current', 'page');
      expect(currentPage.tagName).toBe('SPAN');
    });

    it('does not render breadcrumbs when not provided', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
    });

    it('does not render breadcrumbs when empty array provided', () => {
      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={[]}>
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.queryByRole('navigation', { name: /breadcrumb/i })).not.toBeInTheDocument();
    });

    it('renders separators between breadcrumb items', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Current Page' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      // There should be 2 separators for 3 items
      const separators = screen.getAllByText('/');
      expect(separators).toHaveLength(2);
    });
  });

  describe('Header Actions', () => {
    it('renders header actions when provided', () => {
      renderWithRouter(
        <PageLayout
          title="Test Page"
          headerActions={<button data-testid="action-button">Add Item</button>}
        >
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByTestId('action-button')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument();
    });

    it('renders multiple header actions', () => {
      renderWithRouter(
        <PageLayout
          title="Test Page"
          headerActions={
            <>
              <button>Action 1</button>
              <button>Action 2</button>
            </>
          }
        >
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByRole('button', { name: /action 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /action 2/i })).toBeInTheDocument();
    });
  });

  describe('Last Updated Timestamp', () => {
    it('renders last updated timestamp when provided', () => {
      const testDate = new Date('2024-01-15T10:30:00');

      renderWithRouter(
        <PageLayout title="Test Page" lastUpdated={testDate}>
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    });

    it('does not render last updated when not provided', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.queryByText(/last updated:/i)).not.toBeInTheDocument();
    });
  });

  describe('Max Width Variants', () => {
    it('applies default xl max-width class', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('maxWidth-xl');
    });

    it('applies sm max-width class when specified', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" maxWidth="sm">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('maxWidth-sm');
    });

    it('applies md max-width class when specified', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" maxWidth="md">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('maxWidth-md');
    });

    it('applies lg max-width class when specified', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" maxWidth="lg">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('maxWidth-lg');
    });

    it('applies full max-width class when specified', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" maxWidth="full">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('maxWidth-full');
    });
  });

  describe('Custom Class Name', () => {
    it('applies custom className when provided', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" className="custom-class">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('custom-class');
    });

    it('combines custom className with default classes', () => {
      const { container } = renderWithRouter(
        <PageLayout title="Test Page" className="custom-class" maxWidth="lg">
          <div>Content</div>
        </PageLayout>
      );

      const layoutContainer = container.firstChild as HTMLElement;
      expect(layoutContainer.className).toContain('custom-class');
      expect(layoutContainer.className).toContain('maxWidth-lg');
    });
  });

  describe('Semantic HTML Structure', () => {
    it('renders page header as header element', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('renders title as h1 heading', () => {
      renderWithRouter(
        <PageLayout title="Test Page">
          <div>Content</div>
        </PageLayout>
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Test Page');
    });

    it('renders breadcrumbs in a nav element with proper aria-label', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    });

    it('renders breadcrumb items in an ordered list', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Home', href: '/' },
        { label: 'Current' },
      ];

      renderWithRouter(
        <PageLayout title="Test Page" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </PageLayout>
      );

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });
  });

  describe('Combined Features', () => {
    it('renders all features together correctly', () => {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Dashboard', href: '/' },
        { label: 'Assets', href: '/assets' },
        { label: 'Asset Details' },
      ];
      const testDate = new Date('2024-01-15T10:30:00');

      renderWithRouter(
        <PageLayout
          title="Asset Details"
          description="View and manage asset information"
          breadcrumbs={breadcrumbs}
          headerActions={<button>Edit Asset</button>}
          lastUpdated={testDate}
          maxWidth="lg"
          className="asset-page"
        >
          <div data-testid="asset-content">Asset Content Here</div>
        </PageLayout>
      );

      // Title
      expect(screen.getByRole('heading', { name: /asset details/i })).toBeInTheDocument();

      // Description
      expect(screen.getByText('View and manage asset information')).toBeInTheDocument();

      // Breadcrumbs
      expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();

      // Header actions
      expect(screen.getByRole('button', { name: /edit asset/i })).toBeInTheDocument();

      // Last updated
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();

      // Content
      expect(screen.getByTestId('asset-content')).toBeInTheDocument();
    });
  });
});
