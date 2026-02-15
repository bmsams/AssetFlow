import { type ReactNode } from 'react';
import { Button } from './Button';
import styles from './EmptyState.module.css';

/**
 * Visual variants for the EmptyState component.
 * Each variant provides appropriate default icons and styling.
 *
 * @type EmptyStateVariant
 * @see {@link EmptyStateProps} - Used in the variant prop
 *
 * - `'default'` - General empty state with a box/container icon
 * - `'search'` - No search results found, with magnifying glass icon
 * - `'error'` - Error occurred, with alert/warning icon
 * - `'filtered'` - No results match current filters, with filter icon
 */
export type EmptyStateVariant = 'default' | 'search' | 'error' | 'filtered';

/**
 * Configuration for the primary action button in EmptyState.
 *
 * @interface EmptyStatePrimaryAction
 * @see {@link EmptyStateProps} - Used in the primaryAction prop
 *
 * @example
 * ```typescript
 * const addAction: EmptyStatePrimaryAction = {
 *   label: 'Add Asset',
 *   onClick: () => navigate('/assets/new'),
 *   icon: <PlusIcon />
 * };
 * ```
 */
export interface EmptyStatePrimaryAction {
  /**
   * Text label displayed on the button.
   * Should be action-oriented (e.g., "Add Asset", "Clear Filters").
   */
  label: string;

  /**
   * Callback function invoked when the button is clicked.
   * Use for navigation, form opening, or filter clearing.
   */
  onClick: () => void;

  /**
   * Optional icon to display before the button label.
   * Typically a small SVG icon component.
   * @default undefined
   */
  icon?: ReactNode;
}

/**
 * Configuration for the secondary action link in EmptyState.
 *
 * @interface EmptyStateSecondaryAction
 * @see {@link EmptyStateProps} - Used in the secondaryAction prop
 *
 * @example
 * ```typescript
 * const learnMoreAction: EmptyStateSecondaryAction = {
 *   label: 'Learn more about assets',
 *   onClick: () => openHelpModal()
 * };
 * ```
 */
export interface EmptyStateSecondaryAction {
  /**
   * Text label displayed as a link.
   * Should describe the alternative action clearly.
   */
  label: string;

  /**
   * Callback function invoked when the link is clicked.
   * Use for secondary navigation or help content.
   */
  onClick: () => void;
}

/**
 * Props for the EmptyState component.
 *
 * @interface EmptyStateProps
 * @see {@link EmptyState} - The component that uses these props
 * @see {@link EmptyStatePrimaryAction} - Primary action configuration
 * @see {@link EmptyStateSecondaryAction} - Secondary action configuration
 * @see {@link EmptyStateVariant} - Available visual variants
 *
 * @example
 * ```typescript
 * const emptyStateProps: EmptyStateProps = {
 *   title: 'No assets found',
 *   description: 'Get started by adding your first asset.',
 *   variant: 'default',
 *   primaryAction: {
 *     label: 'Add Asset',
 *     onClick: handleAddAsset
 *   }
 * };
 * ```
 */
export interface EmptyStateProps {
  /**
   * Custom icon to display above the title.
   * If not provided, a default icon based on the variant is used.
   * Should be an SVG element or icon component.
   * @default undefined (uses variant default icon)
   */
  icon?: ReactNode;

  /**
   * Main heading text for the empty state.
   * Should clearly communicate what is empty or missing.
   */
  title: string;

  /**
   * Descriptive text explaining the empty state.
   * Should guide the user on what to do next.
   */
  description: string;

  /**
   * Primary call-to-action button configuration.
   * Rendered as a prominent button below the description.
   * @default undefined
   * @see {@link EmptyStatePrimaryAction}
   */
  primaryAction?: EmptyStatePrimaryAction;

  /**
   * Secondary action link configuration.
   * Rendered as a text link below the primary action.
   * @default undefined
   * @see {@link EmptyStateSecondaryAction}
   */
  secondaryAction?: EmptyStateSecondaryAction;

  /**
   * Visual variant that determines default icon and styling.
   * @default 'default'
   * @see {@link EmptyStateVariant}
   */
  variant?: EmptyStateVariant;

  /**
   * Additional CSS class name(s) to apply to the container.
   * @default ''
   */
  className?: string;
}

/**
 * Default icons for different empty state variants.
 * Each icon is an SVG element with appropriate visual metaphor.
 * @internal
 */
const VariantIcons: Record<EmptyStateVariant, ReactNode> = {
  default: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12V16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 14H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 8V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 11H14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 8V12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  ),
  filtered: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M22 3H2L10 12.46V19L14 21V12.46L22 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
};

/**
 * EmptyState displays a placeholder when no data exists in a view.
 *
 * This component implements **Requirement 3: Standardized Empty State Component** from the
 * frontend UI improvements specification. It provides consistent empty state displays
 * so users understand when no data exists and what actions they can take.
 *
 * ## Features
 * - **Configurable icon** - Custom or variant-based default icons
 * - **Clear messaging** - Title and description explain the empty state
 * - **Primary action** - Prominent button for the main action (e.g., "Add Item")
 * - **Secondary action** - Text link for alternative actions
 * - **Variant support** - Pre-styled variants for common scenarios
 * - **Centered layout** - Content centered vertically and horizontally
 * - **Consistent styling** - Uniform spacing, typography, and icon sizing
 *
 * ## Variants
 * - `default` - General empty state (box icon)
 * - `search` - No search results (magnifying glass icon)
 * - `error` - Error loading data (alert icon)
 * - `filtered` - No filter matches (filter icon with slash)
 *
 * ## Accessibility
 * - Uses `role="status"` for screen reader announcement
 * - Icons are decorative (`aria-hidden="true"`)
 * - Action buttons are keyboard accessible
 *
 * @param props - Component props
 * @param props.icon - Custom icon (optional, uses variant default)
 * @param props.title - Main heading text (required)
 * @param props.description - Explanatory text (required)
 * @param props.primaryAction - Primary button configuration
 * @param props.secondaryAction - Secondary link configuration
 * @param props.variant - Visual variant ('default' | 'search' | 'error' | 'filtered')
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element containing the empty state display
 *
 * @see {@link SearchEmptyState} - Pre-configured empty state for search results
 * @see {@link FilteredEmptyState} - Pre-configured empty state for filtered views
 * @see {@link PageLayout} - Often used within PageLayout for list pages
 * @see {@link FilterToolbar} - Often paired with EmptyState for filtered lists
 *
 * @example
 * Basic usage for an empty list:
 * ```tsx
 * <EmptyState
 *   title="No assets found"
 *   description="Get started by adding your first asset."
 *   primaryAction={{
 *     label: 'Add Asset',
 *     onClick: () => navigate('/assets/new')
 *   }}
 * />
 * ```
 *
 * @example
 * Filtered variant with clear filters action:
 * ```tsx
 * <EmptyState
 *   variant="filtered"
 *   title="No results match your filters"
 *   description="Try adjusting your search or filter criteria."
 *   primaryAction={{
 *     label: 'Clear Filters',
 *     onClick: handleClearFilters
 *   }}
 *   secondaryAction={{
 *     label: 'View all items',
 *     onClick: () => navigate('/items')
 *   }}
 * />
 * ```
 *
 * @example
 * Error variant with retry:
 * ```tsx
 * <EmptyState
 *   variant="error"
 *   title="Failed to load data"
 *   description="An error occurred while fetching the data. Please try again."
 *   primaryAction={{
 *     label: 'Retry',
 *     onClick: handleRetry
 *   }}
 * />
 * ```
 *
 * @example
 * Custom icon:
 * ```tsx
 * <EmptyState
 *   icon={<CustomIcon />}
 *   title="No notifications"
 *   description="You're all caught up! Check back later for updates."
 * />
 * ```
 */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
  className = '',
}: EmptyStateProps): JSX.Element {
  const classNames = [styles.container, styles[variant], className]
    .filter(Boolean)
    .join(' ');

  // Use provided icon or fall back to variant default
  const displayIcon = icon ?? VariantIcons[variant];

  return (
    <div className={classNames} role="status" aria-label={title}>
      {displayIcon && (
        <div className={styles.iconContainer}>
          {displayIcon}
        </div>
      )}
      <div className={styles.content}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
        {(primaryAction || secondaryAction) && (
          <div className={styles.actions}>
            {primaryAction && (
              <Button
                variant="primary"
                onClick={primaryAction.onClick}
                leftIcon={primaryAction.icon}
              >
                {primaryAction.label}
              </Button>
            )}
            {secondaryAction && (
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Pre-configured empty state for search results with no matches.
 *
 * A convenience component that wraps EmptyState with search-specific
 * messaging and styling. Use when a search query returns no results.
 *
 * @param props - Component props
 * @param props.searchTerm - The search term that yielded no results (optional)
 * @param props.onClearSearch - Callback to clear the search (optional)
 *
 * @returns JSX element with search-specific empty state
 *
 * @see {@link EmptyState} - Base component
 * @see {@link FilteredEmptyState} - For filter-based empty states
 *
 * @example
 * ```tsx
 * {searchResults.length === 0 && (
 *   <SearchEmptyState
 *     searchTerm={searchQuery}
 *     onClearSearch={() => setSearchQuery('')}
 *   />
 * )}
 * ```
 */
export function SearchEmptyState({
  searchTerm,
  onClearSearch,
}: {
  /** The search term that yielded no results */
  searchTerm?: string;
  /** Callback to clear the search input */
  onClearSearch?: () => void;
}): JSX.Element {
  return (
    <EmptyState
      variant="search"
      title="No results found"
      description={
        searchTerm
          ? `No items match "${searchTerm}". Try a different search term.`
          : 'No items match your search criteria.'
      }
      primaryAction={
        onClearSearch
          ? { label: 'Clear Search', onClick: onClearSearch }
          : undefined
      }
    />
  );
}

/**
 * Pre-configured empty state for filtered views with no matches.
 *
 * A convenience component that wraps EmptyState with filter-specific
 * messaging and styling. Use when applied filters result in no items.
 *
 * @param props - Component props
 * @param props.onClearFilters - Callback to clear all active filters (optional)
 *
 * @returns JSX element with filter-specific empty state
 *
 * @see {@link EmptyState} - Base component
 * @see {@link SearchEmptyState} - For search-based empty states
 * @see {@link FilterToolbar} - Often used together for filter management
 *
 * @example
 * ```tsx
 * {filteredItems.length === 0 && hasActiveFilters && (
 *   <FilteredEmptyState onClearFilters={handleClearAllFilters} />
 * )}
 * ```
 */
export function FilteredEmptyState({
  onClearFilters,
}: {
  /** Callback to clear all active filters */
  onClearFilters?: () => void;
}): JSX.Element {
  return (
    <EmptyState
      variant="filtered"
      title="No results match your filters"
      description="Try adjusting your filter criteria or clear all filters to see all items."
      primaryAction={
        onClearFilters
          ? { label: 'Clear Filters', onClick: onClearFilters }
          : undefined
      }
    />
  );
}
