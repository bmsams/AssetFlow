import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './PageLayout.module.css';

/**
 * Configuration for a single breadcrumb navigation item.
 *
 * @interface BreadcrumbItem
 * @see {@link PageLayoutProps} - Used in the breadcrumbs prop
 * @see {@link Breadcrumbs} - Standalone breadcrumb component
 *
 * @example
 * ```typescript
 * // Clickable breadcrumb (ancestor page)
 * const dashboardCrumb: BreadcrumbItem = { label: 'Dashboard', href: '/' };
 *
 * // Non-clickable breadcrumb (current page)
 * const currentCrumb: BreadcrumbItem = { label: 'Asset Details' };
 * ```
 */
export interface BreadcrumbItem {
  /**
   * Display label for the breadcrumb.
   * Should be concise and descriptive of the page.
   */
  label: string;

  /**
   * Navigation URL for the breadcrumb link.
   * If undefined, the item renders as non-clickable text (typically the current page).
   * @default undefined
   */
  href?: string;
}

/**
 * Props for the PageLayout component.
 *
 * @interface PageLayoutProps
 * @see {@link PageLayout} - The component that uses these props
 * @see {@link BreadcrumbItem} - Configuration for breadcrumb items
 *
 * @example
 * ```typescript
 * const pageProps: PageLayoutProps = {
 *   title: 'Assets',
 *   description: 'Manage your organization\'s assets',
 *   breadcrumbs: [
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Assets' }
 *   ],
 *   maxWidth: 'xl',
 *   children: <AssetTable />
 * };
 * ```
 */
export interface PageLayoutProps {
  /**
   * Page title displayed prominently in the header.
   * Rendered as an h1 element for proper document structure.
   */
  title: string;

  /**
   * Optional descriptive text displayed below the title.
   * Use to provide context about the page's purpose.
   * @default undefined
   */
  description?: string;

  /**
   * Array of breadcrumb items for hierarchical navigation.
   * The last item is automatically rendered as the current page (non-clickable).
   * @default undefined
   * @see {@link BreadcrumbItem}
   */
  breadcrumbs?: BreadcrumbItem[];

  /**
   * React nodes to render in the header actions area.
   * Typically contains action buttons like "Add", "Export", etc.
   * @default undefined
   */
  headerActions?: ReactNode;

  /**
   * Timestamp to display as "Last updated" in the header.
   * Formatted using the user's locale settings.
   * @default undefined
   */
  lastUpdated?: Date;

  /**
   * Main page content to render within the layout.
   * Wrapped in a content container with appropriate spacing.
   */
  children: ReactNode;

  /**
   * Maximum width constraint for the content area.
   * - 'sm': 640px - Narrow content like forms
   * - 'md': 768px - Medium content
   * - 'lg': 1024px - Standard content
   * - 'xl': 1280px - Wide content (default)
   * - 'full': 100% - Full width
   * @default 'xl'
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';

  /**
   * Additional CSS class name(s) to apply to the container.
   * Useful for page-specific styling overrides.
   * @default undefined
   */
  className?: string;
}

/**
 * Formats a Date object for display in the "last updated" area.
 *
 * @param date - The date to format
 * @returns Formatted date string in the user's locale (e.g., "Jan 15, 2025, 2:30 PM")
 *
 * @internal
 */
function formatLastUpdated(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * PageLayout provides a unified wrapper for all page content with consistent structure.
 *
 * This component implements **Requirement 1: Unified Page Layout Component** from the
 * frontend UI improvements specification. It ensures all pages have consistent structure
 * and styling without code duplication.
 *
 * ## Features
 * - **Configurable max-width container** - Control content width with preset sizes
 * - **Page header** - Title, description, and optional action buttons
 * - **Breadcrumb navigation** - Hierarchical path navigation support
 * - **Last updated timestamp** - Display data freshness information
 * - **Responsive design** - Mobile-first approach with stacked header on small screens
 * - **Semantic HTML** - Proper heading hierarchy and landmark regions
 *
 * ## Accessibility
 * - Uses semantic HTML elements (header, nav, main content areas)
 * - Breadcrumb navigation includes proper ARIA attributes
 * - Page title rendered as h1 for document structure
 *
 * @param props - Component props
 * @param props.title - Page title displayed in header (required)
 * @param props.description - Optional page description
 * @param props.breadcrumbs - Optional breadcrumb navigation items
 * @param props.headerActions - Optional action buttons for header
 * @param props.lastUpdated - Optional timestamp for data freshness
 * @param props.children - Page content (required)
 * @param props.maxWidth - Content width constraint ('sm' | 'md' | 'lg' | 'xl' | 'full')
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element containing the page layout structure
 *
 * @see {@link Breadcrumbs} - Standalone breadcrumb component
 * @see {@link BreadcrumbItem} - Breadcrumb item configuration
 * @see {@link FilterToolbar} - Often used within PageLayout for list pages
 * @see {@link EmptyState} - Often used within PageLayout for empty data states
 *
 * @example
 * Basic usage with title only:
 * ```tsx
 * <PageLayout title="Dashboard">
 *   <DashboardContent />
 * </PageLayout>
 * ```
 *
 * @example
 * Full-featured usage with all options:
 * ```tsx
 * <PageLayout
 *   title="Assets"
 *   description="Manage your organization's hardware and software assets"
 *   breadcrumbs={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Assets' }
 *   ]}
 *   headerActions={
 *     <>
 *       <Button variant="secondary">Export</Button>
 *       <Button variant="primary">Add Asset</Button>
 *     </>
 *   }
 *   lastUpdated={new Date()}
 *   maxWidth="xl"
 * >
 *   <FilterToolbar search={searchConfig} />
 *   <AssetTable data={assets} />
 * </PageLayout>
 * ```
 *
 * @example
 * Narrow form layout:
 * ```tsx
 * <PageLayout
 *   title="Create Asset"
 *   breadcrumbs={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Assets', href: '/assets' },
 *     { label: 'Create' }
 *   ]}
 *   maxWidth="md"
 * >
 *   <AssetForm onSubmit={handleSubmit} />
 * </PageLayout>
 * ```
 */
export function PageLayout({
  title,
  description,
  breadcrumbs,
  headerActions,
  lastUpdated,
  children,
  maxWidth = 'xl',
  className,
}: PageLayoutProps): JSX.Element {
  const containerClasses = [
    styles.container,
    styles[`maxWidth-${maxWidth}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClasses}>
      {/* Breadcrumb Navigation */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
          <ol className={styles.breadcrumbList}>
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li key={`${item.label}-${index}`} className={styles.breadcrumbItem}>
                  {index > 0 && (
                    <span className={styles.breadcrumbSeparator} aria-hidden="true">
                      /
                    </span>
                  )}
                  {isLast || !item.href ? (
                    <span
                      className={styles.breadcrumbCurrent}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {item.label}
                    </span>
                  ) : (
                    <Link to={item.href} className={styles.breadcrumbLink}>
                      {item.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Page Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>{title}</h1>
            {description && <p className={styles.description}>{description}</p>}
          </div>
          <div className={styles.headerActions}>
            {lastUpdated && (
              <span className={styles.lastUpdated}>
                Last updated: {formatLastUpdated(lastUpdated)}
              </span>
            )}
            {headerActions}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className={styles.content}>{children}</div>
    </div>
  );
}
