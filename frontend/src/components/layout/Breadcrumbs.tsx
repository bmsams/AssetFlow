import { type ReactNode } from 'react';
import styles from './Breadcrumbs.module.css';

/**
 * Configuration for a single breadcrumb navigation item.
 *
 * @interface BreadcrumbItem
 * @see {@link BreadcrumbsProps} - Used in the items prop
 * @see {@link PageLayout} - PageLayout component also uses this interface
 *
 * @example
 * ```typescript
 * // Clickable ancestor breadcrumb
 * const homeCrumb: BreadcrumbItem = {
 *   label: 'Home',
 *   href: '/'
 * };
 *
 * // Current page (non-clickable)
 * const currentCrumb: BreadcrumbItem = {
 *   label: 'Asset Details'
 *   // No href = renders as current page
 * };
 * ```
 */
export interface BreadcrumbItem {
  /**
   * Display text for the breadcrumb.
   * Should be concise and clearly identify the page.
   */
  label: string;

  /**
   * Navigation URL for the breadcrumb link.
   * When undefined, the item renders as non-clickable text,
   * typically used for the current page (last item).
   * @default undefined
   */
  href?: string;
}

/**
 * Props for the Breadcrumbs component.
 *
 * @interface BreadcrumbsProps
 * @see {@link Breadcrumbs} - The component that uses these props
 * @see {@link BreadcrumbItem} - Configuration for individual breadcrumb items
 *
 * @example
 * ```typescript
 * const breadcrumbProps: BreadcrumbsProps = {
 *   items: [
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Admin', href: '/admin' },
 *     { label: 'Users' }
 *   ],
 *   separator: '/',
 *   maxItems: 4
 * };
 * ```
 */
export interface BreadcrumbsProps {
  /**
   * Array of breadcrumb items representing the navigation hierarchy.
   * Items are rendered in order from left to right.
   * The last item is automatically treated as the current page.
   * @see {@link BreadcrumbItem}
   */
  items: BreadcrumbItem[];

  /**
   * Separator element displayed between breadcrumb items.
   * Can be a string character or a React node (e.g., an icon).
   * @default '/'
   *
   * @example
   * ```tsx
   * // String separator
   * <Breadcrumbs items={items} separator=">" />
   *
   * // Icon separator
   * <Breadcrumbs items={items} separator={<ChevronIcon />} />
   * ```
   */
  separator?: ReactNode;

  /**
   * Maximum number of items to display before truncating.
   * When items exceed this limit, middle items are collapsed
   * and replaced with an ellipsis (…).
   * Minimum effective value is 2 (first and last items always shown).
   * @default 4
   *
   * @example
   * ```tsx
   * // With 6 items and maxItems=4:
   * // Renders: Home / ... / Parent / Current
   * <Breadcrumbs items={longPath} maxItems={4} />
   * ```
   */
  maxItems?: number;

  /**
   * Additional CSS class name(s) to apply to the nav container.
   * Useful for custom positioning or styling overrides.
   * @default undefined
   */
  className?: string;
}

/**
 * Breadcrumbs provides hierarchical navigation showing the user's current location
 * within the application structure.
 *
 * This component implements **Requirement 2: Breadcrumb Navigation Component** from the
 * frontend UI improvements specification. It helps users understand their location
 * and navigate back to parent pages easily.
 *
 * ## Features
 * - **Hierarchical path display** - Shows navigation from root to current page
 * - **Clickable ancestor links** - All items except the last are rendered as links
 * - **Visual distinction** - Current page is visually different from ancestor links
 * - **Customizable separator** - Use any character or React node as separator
 * - **Responsive truncation** - Collapses middle items with ellipsis when path is long
 * - **Full accessibility** - Proper ARIA attributes for screen readers
 *
 * ## Accessibility (WCAG 2.1 AA)
 * - Uses `<nav>` element with `aria-label="Breadcrumb"`
 * - Current page marked with `aria-current="page"`
 * - Separators hidden from screen readers with `aria-hidden="true"`
 * - Keyboard navigable links
 *
 * ## Truncation Behavior
 * When the number of items exceeds `maxItems`:
 * 1. First item is always shown (root/home)
 * 2. Middle items are replaced with ellipsis (…)
 * 3. Last N items are shown (where N = maxItems - 2)
 *
 * @param props - Component props
 * @param props.items - Array of breadcrumb items (required)
 * @param props.separator - Separator between items (default: '/')
 * @param props.maxItems - Max items before truncation (default: 4)
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element containing the breadcrumb navigation, or null if items is empty
 *
 * @see {@link PageLayout} - Often used together; PageLayout has built-in breadcrumb support
 * @see {@link BreadcrumbItem} - Configuration for individual items
 * @see {@link BREADCRUMB_CONFIGS} - Predefined breadcrumb configurations in types/layout.ts
 *
 * @example
 * Basic usage:
 * ```tsx
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Assets', href: '/assets' },
 *     { label: 'Asset Details' }
 *   ]}
 * />
 * ```
 *
 * @example
 * With custom separator:
 * ```tsx
 * <Breadcrumbs
 *   items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Products', href: '/products' },
 *     { label: 'Laptops' }
 *   ]}
 *   separator="›"
 * />
 * ```
 *
 * @example
 * Long path with truncation:
 * ```tsx
 * // Renders: Dashboard / ... / Buildings / Floor 3 / Room 301
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Admin', href: '/admin' },
 *     { label: 'Locations', href: '/admin/locations' },
 *     { label: 'Buildings', href: '/admin/buildings' },
 *     { label: 'Floor 3', href: '/admin/buildings/1/floors/3' },
 *     { label: 'Room 301' }
 *   ]}
 *   maxItems={4}
 * />
 * ```
 *
 * @example
 * Using predefined configurations:
 * ```tsx
 * import { BREADCRUMB_CONFIGS } from '@/types/layout';
 *
 * <Breadcrumbs items={BREADCRUMB_CONFIGS.assetDetail('AMS-HW-20250115-ABC123')} />
 * ```
 */
export function Breadcrumbs({
  items,
  separator = '/',
  maxItems = 4,
  className,
}: BreadcrumbsProps): JSX.Element | null {
  // Don't render if no items
  if (!items || items.length === 0) {
    return null;
  }

  // Determine which items to display based on maxItems
  // Ensure maxItems is at least 2 to show first and last
  const effectiveMaxItems = Math.max(maxItems, 2);
  const shouldTruncate = items.length > effectiveMaxItems;
  let displayItems: (BreadcrumbItem | { isEllipsis: true })[];

  if (shouldTruncate) {
    // Show first item, ellipsis, and last (maxItems - 2) items
    const lastItemsCount = Math.max(effectiveMaxItems - 2, 1);
    displayItems = [
      items[0],
      { isEllipsis: true },
      ...items.slice(-lastItemsCount),
    ];
  } else {
    displayItems = items;
  }

  const containerClasses = [styles.breadcrumbs, className]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label="Breadcrumb" className={containerClasses}>
      <ol className={styles.breadcrumbList}>
        {displayItems.map((item, index) => {
          // Handle ellipsis item
          if ('isEllipsis' in item) {
            return (
              <li key="ellipsis" className={styles.breadcrumbItem}>
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                  {separator}
                </span>
                <span className={styles.breadcrumbEllipsis} aria-hidden="true">
                  …
                </span>
              </li>
            );
          }

          // Determine if this is the last item (current page)
          const isLast = index === displayItems.length - 1;
          const isFirst = index === 0;

          return (
            <li key={`${item.label}-${index}`} className={styles.breadcrumbItem}>
              {!isFirst && (
                <span className={styles.breadcrumbSeparator} aria-hidden="true">
                  {separator}
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
                <a href={item.href} className={styles.breadcrumbLink}>
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
