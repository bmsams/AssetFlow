import { useRef, useState, useEffect, useCallback, type ReactNode } from 'react';
import styles from './ResponsiveTable.module.css';

/**
 * Props for the ResponsiveTable component.
 *
 * @interface ResponsiveTableProps
 * @see {@link ResponsiveTable} - The component that uses these props
 *
 * @example
 * ```typescript
 * const tableProps: ResponsiveTableProps = {
 *   minWidth: '800px',
 *   showScrollIndicator: true,
 *   'aria-label': 'Assets table',
 *   children: (
 *     <table>
 *       <thead>...</thead>
 *       <tbody>...</tbody>
 *     </table>
 *   )
 * };
 * ```
 */
export interface ResponsiveTableProps {
  /**
   * Table content to render inside the scrollable container.
   * Should typically be a `<table>` element with thead and tbody.
   */
  children: ReactNode;

  /**
   * Minimum width of the table before horizontal scrolling is enabled.
   * When the container is narrower than this value, horizontal scroll appears.
   * Use CSS length values (px, rem, em, etc.).
   * @default '600px'
   *
   * @example
   * ```tsx
   * // Wide table with many columns
   * <ResponsiveTable minWidth="1200px">...</ResponsiveTable>
   *
   * // Narrow table
   * <ResponsiveTable minWidth="400px">...</ResponsiveTable>
   * ```
   */
  minWidth?: string;

  /**
   * Whether to show scroll indicator buttons when content overflows.
   * When true, arrow buttons appear on the sides to indicate scrollability.
   * @default true
   */
  showScrollIndicator?: boolean;

  /**
   * Additional CSS class name(s) to apply to the wrapper element.
   * @default ''
   */
  className?: string;

  /**
   * Accessible label for the scrollable table region.
   * Announced by screen readers to describe the table content.
   * @default 'Scrollable table'
   */
  'aria-label'?: string;
}

/**
 * Scroll indicator arrow icon component.
 *
 * Renders a chevron/arrow icon used in the scroll indicator buttons.
 * The icon points right; CSS transforms rotate it for the left button.
 *
 * @returns SVG element representing a right-pointing chevron
 * @internal
 */
function ScrollIndicatorIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={styles.scrollIcon}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * ResponsiveTable provides a scrollable container for tables on smaller screens.
 *
 * This component implements **Requirement 9: Mobile Responsive Tables** from the
 * frontend UI improvements specification. It ensures users on mobile devices can
 * view table data without horizontal overflow issues.
 *
 * ## Features
 * - **Horizontal scrolling** - Enables scroll when table exceeds viewport width
 * - **Scroll indicators** - Visual arrow buttons show when content overflows
 * - **Smooth touch scrolling** - Optimized for mobile touch interactions
 * - **Keyboard accessible** - Container is focusable for keyboard scrolling
 * - **CSS variable theming** - Full dark mode support
 * - **ResizeObserver** - Automatically updates scroll state on resize
 *
 * ## Scroll Behavior
 * - Left/right arrow buttons appear when content overflows in that direction
 * - Clicking arrows scrolls 200px in the indicated direction
 * - Scroll state updates automatically on scroll and resize events
 * - Touch scrolling works smoothly on mobile devices
 *
 * ## Accessibility
 * - Uses `role="region"` with descriptive aria-label
 * - Container has `tabIndex={0}` for keyboard focus
 * - Scroll buttons have descriptive aria-labels
 * - Works with keyboard arrow keys when focused
 *
 * ## Performance
 * - Scroll event listener uses `{ passive: true }` for smooth scrolling
 * - ResizeObserver for efficient resize detection
 * - Scroll state updates are debounced via React state batching
 *
 * @param props - Component props
 * @param props.children - Table content (typically a `<table>` element)
 * @param props.minWidth - Minimum table width before scroll (default: '600px')
 * @param props.showScrollIndicator - Show scroll arrow buttons (default: true)
 * @param props.className - Additional CSS classes
 * @param props.aria-label - Accessible label for the region
 *
 * @returns JSX element containing the scrollable table wrapper
 *
 * @see {@link PageLayout} - Often used within PageLayout for list pages
 * @see {@link FilterToolbar} - Often paired above ResponsiveTable
 * @see {@link EmptyState} - Alternative when table has no data
 *
 * @example
 * Basic usage with a table:
 * ```tsx
 * <ResponsiveTable>
 *   <table>
 *     <thead>
 *       <tr>
 *         <th>Name</th>
 *         <th>Status</th>
 *         <th>Created</th>
 *         <th>Actions</th>
 *       </tr>
 *     </thead>
 *     <tbody>
 *       {items.map(item => (
 *         <tr key={item.id}>
 *           <td>{item.name}</td>
 *           <td><StatusBadge label={item.status} /></td>
 *           <td>{item.createdAt}</td>
 *           <td><Button>Edit</Button></td>
 *         </tr>
 *       ))}
 *     </tbody>
 *   </table>
 * </ResponsiveTable>
 * ```
 *
 * @example
 * With custom minimum width for wide tables:
 * ```tsx
 * <ResponsiveTable
 *   minWidth="1000px"
 *   aria-label="Purchase orders table"
 * >
 *   <table>
 *     {/* Table with many columns *\/}
 *   </table>
 * </ResponsiveTable>
 * ```
 *
 * @example
 * Without scroll indicators:
 * ```tsx
 * <ResponsiveTable showScrollIndicator={false}>
 *   <table>...</table>
 * </ResponsiveTable>
 * ```
 *
 * @example
 * Within a PageLayout with FilterToolbar:
 * ```tsx
 * <PageLayout title="Assets">
 *   <FilterToolbar search={searchConfig} />
 *   {assets.length > 0 ? (
 *     <ResponsiveTable aria-label="Assets list">
 *       <table className={styles.assetsTable}>
 *         <thead>...</thead>
 *         <tbody>
 *           {assets.map(asset => (
 *             <AssetRow key={asset.id} asset={asset} />
 *           ))}
 *         </tbody>
 *       </table>
 *     </ResponsiveTable>
 *   ) : (
 *     <EmptyState title="No assets" description="..." />
 *   )}
 * </PageLayout>
 * ```
 */
export function ResponsiveTable({
  children,
  minWidth = '600px',
  showScrollIndicator = true,
  className = '',
  'aria-label': ariaLabel,
}: ResponsiveTableProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state and update indicators
  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth;

    setCanScrollLeft(hasOverflow && scrollLeft > 1);
    setCanScrollRight(hasOverflow && scrollLeft < scrollWidth - clientWidth - 1);
  }, []);

  // Set up scroll and resize listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial check
    updateScrollState();

    // Listen for scroll events
    container.addEventListener('scroll', updateScrollState, { passive: true });

    // Listen for resize events (debounced via ResizeObserver)
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  // Handle scroll indicator click
  const handleScrollRight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollBy({
      left: 200,
      behavior: 'smooth',
    });
  }, []);

  const handleScrollLeft = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollBy({
      left: -200,
      behavior: 'smooth',
    });
  }, []);

  const classNames = [styles.wrapper, className].filter(Boolean).join(' ');

  const showLeftIndicator = showScrollIndicator && canScrollLeft;
  const showRightIndicator = showScrollIndicator && canScrollRight;

  return (
    <div className={classNames}>
      {/* Left scroll indicator */}
      {showLeftIndicator && (
        <button
          type="button"
          className={`${styles.scrollIndicator} ${styles.scrollIndicatorLeft}`}
          onClick={handleScrollLeft}
          aria-label="Scroll table left"
        >
          <ScrollIndicatorIcon />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={containerRef}
        className={styles.container}
        style={{ '--table-min-width': minWidth } as React.CSSProperties}
        role="region"
        aria-label={ariaLabel ?? 'Scrollable table'}
        tabIndex={0}
      >
        {children}
      </div>

      {/* Right scroll indicator */}
      {showRightIndicator && (
        <button
          type="button"
          className={`${styles.scrollIndicator} ${styles.scrollIndicatorRight}`}
          onClick={handleScrollRight}
          aria-label="Scroll table right"
        >
          <ScrollIndicatorIcon />
        </button>
      )}
    </div>
  );
}

ResponsiveTable.displayName = 'ResponsiveTable';
