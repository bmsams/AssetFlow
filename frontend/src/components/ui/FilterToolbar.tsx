import { useCallback, type FormEvent, type ChangeEvent, type KeyboardEvent } from 'react';
import { Button } from './Button';
import styles from './FilterToolbar.module.css';

/**
 * Configuration for a single option in a select-type filter.
 *
 * @interface FilterOption
 * @see {@link FilterConfig} - Used in the options property
 *
 * @example
 * ```typescript
 * const statusOptions: FilterOption[] = [
 *   { value: 'active', label: 'Active' },
 *   { value: 'inactive', label: 'Inactive' },
 *   { value: 'pending', label: 'Pending' }
 * ];
 * ```
 */
export interface FilterOption {
  /**
   * The value submitted when this option is selected.
   * Should be a unique identifier within the filter's options.
   */
  value: string;

  /**
   * Human-readable label displayed in the dropdown.
   */
  label: string;
}

/**
 * Configuration for a single filter control in the toolbar.
 *
 * @interface FilterConfig
 * @see {@link FilterToolbarProps} - Used in the filters prop
 * @see {@link FilterOption} - Options for select-type filters
 *
 * @example
 * ```typescript
 * const filters: FilterConfig[] = [
 *   {
 *     id: 'status',
 *     type: 'select',
 *     label: 'Status',
 *     options: [
 *       { value: 'active', label: 'Active' },
 *       { value: 'inactive', label: 'Inactive' }
 *     ],
 *     placeholder: 'All Statuses'
 *   },
 *   {
 *     id: 'createdDate',
 *     type: 'date',
 *     label: 'Created Date'
 *   },
 *   {
 *     id: 'dateRange',
 *     type: 'dateRange',
 *     label: 'Date Range'
 *   },
 *   {
 *     id: 'showArchived',
 *     type: 'checkbox',
 *     label: 'Show Archived'
 *   }
 * ];
 * ```
 */
export interface FilterConfig {
  /**
   * Unique identifier for the filter.
   * Used as the key in FilterValues and for form element IDs.
   */
  id: string;

  /**
   * Type of filter control to render.
   * - `'select'` - Dropdown with predefined options
   * - `'text'` - Text input field
   * - `'multiSelect'` - Multi-select dropdown
   * - `'date'` - Single date picker
   * - `'dateRange'` - From/to date range picker
   * - `'checkbox'` - Boolean toggle
   */
  type: 'select' | 'text' | 'multiSelect' | 'date' | 'dateRange' | 'checkbox';

  /**
   * Human-readable label for the filter.
   * Displayed above or beside the filter control.
   */
  label: string;

  /**
   * Options for select-type filters.
   * Required when type is 'select' or 'multiSelect'.
   * @see {@link FilterOption}
   */
  options?: FilterOption[];

  /**
   * Placeholder text for the filter control.
   * For select: shown as the default "All X" option.
   * @default `All ${label}` for select type
   */
  placeholder?: string;

  /**
   * Whether the filter supports search/filtering of options.
   * Only applicable for multiSelect type.
   * @default false
   */
  searchable?: boolean;
}

/**
 * Object containing current filter values, keyed by filter ID.
 *
 * @interface FilterValues
 * @see {@link FilterToolbarProps} - Used in the filterValues prop
 *
 * @example
 * ```typescript
 * const filterValues: FilterValues = {
 *   status: 'active',           // select filter
 *   createdDate: '2025-01-15',  // date filter
 *   dateRange: {                // dateRange filter
 *     from: '2025-01-01',
 *     to: '2025-01-31'
 *   },
 *   showArchived: true          // checkbox filter
 * };
 * ```
 */
export interface FilterValues {
  /**
   * Filter values indexed by filter ID.
   * Value type depends on the filter type:
   * - select: string
   * - date: string (ISO date format)
   * - dateRange: { from?: string; to?: string }
   * - checkbox: boolean
   */
  [key: string]: string | string[] | boolean | { from?: string; to?: string };
}

/**
 * Configuration for the search input in the toolbar.
 *
 * @interface SearchConfig
 * @see {@link FilterToolbarProps} - Used in the search prop
 *
 * @example
 * ```typescript
 * const searchConfig: SearchConfig = {
 *   placeholder: 'Search assets by name or tag...',
 *   value: searchQuery,
 *   onChange: setSearchQuery,
 *   onSubmit: handleSearch
 * };
 * ```
 */
export interface SearchConfig {
  /**
   * Placeholder text displayed when the search input is empty.
   * Should describe what can be searched.
   */
  placeholder: string;

  /**
   * Current value of the search input.
   * Controlled component pattern.
   */
  value: string;

  /**
   * Callback invoked when the search input value changes.
   * Called on every keystroke for real-time filtering.
   */
  onChange: (value: string) => void;

  /**
   * Optional callback invoked when search is submitted.
   * Called when user presses Enter in the search input.
   * @default undefined
   */
  onSubmit?: () => void;
}

/**
 * Props for the FilterToolbar component.
 *
 * @interface FilterToolbarProps
 * @see {@link FilterToolbar} - The component that uses these props
 * @see {@link SearchConfig} - Search input configuration
 * @see {@link FilterConfig} - Individual filter configuration
 * @see {@link FilterValues} - Current filter values
 *
 * @example
 * ```typescript
 * const toolbarProps: FilterToolbarProps = {
 *   search: {
 *     placeholder: 'Search...',
 *     value: searchQuery,
 *     onChange: setSearchQuery
 *   },
 *   filters: [
 *     { id: 'status', type: 'select', label: 'Status', options: statusOptions }
 *   ],
 *   filterValues: { status: 'active' },
 *   onFilterChange: (id, value) => setFilters({ ...filters, [id]: value }),
 *   onClearFilters: () => setFilters({}),
 *   hasActiveFilters: Object.keys(filters).length > 0,
 *   actions: <Button onClick={handleAdd}>Add New</Button>
 * };
 * ```
 */
export interface FilterToolbarProps {
  /**
   * Configuration for the search input.
   * If not provided, no search input is rendered.
   * @default undefined
   * @see {@link SearchConfig}
   */
  search?: SearchConfig;

  /**
   * Array of filter configurations.
   * Each filter is rendered as a control in the toolbar.
   * @default undefined
   * @see {@link FilterConfig}
   */
  filters?: FilterConfig[];

  /**
   * Current values for all filters, keyed by filter ID.
   * @default {}
   * @see {@link FilterValues}
   */
  filterValues?: FilterValues;

  /**
   * Callback invoked when a filter value changes.
   * @param id - The filter's unique identifier
   * @param value - The new filter value
   * @default undefined
   */
  onFilterChange?: (id: string, value: FilterValues[string]) => void;

  /**
   * Callback invoked when the "Clear Filters" button is clicked.
   * Should reset all filter values to their defaults.
   * @default undefined
   */
  onClearFilters?: () => void;

  /**
   * Whether any filters are currently active.
   * When true, the "Clear Filters" button is displayed.
   * @default false
   */
  hasActiveFilters?: boolean;

  /**
   * Additional action elements to render on the right side.
   * Typically contains primary action buttons like "Add New".
   * @default undefined
   */
  actions?: React.ReactNode;

  /**
   * Additional CSS class name(s) to apply to the toolbar container.
   * @default ''
   */
  className?: string;
}

/**
 * Search icon SVG component for the search input.
 *
 * @returns SVG element representing a magnifying glass
 * @internal
 */
function SearchIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={styles.searchIcon}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

/**
 * Clear/close icon SVG component for clear buttons.
 *
 * @returns SVG element representing an X/close icon
 * @internal
 */
function ClearIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * FilterToolbar provides a unified interface for search and filter controls above data tables.
 *
 * This component implements **Requirement 7: Unified Filter Toolbar Component** from the
 * frontend UI improvements specification. It provides consistent filter controls so users
 * can efficiently search and filter data across all list views.
 *
 * ## Features
 * - **Search input** - Text search with clear button and Enter key submission
 * - **Multiple filter types** - Select dropdowns, date pickers, date ranges, checkboxes
 * - **Clear filters button** - Shown when filters are active
 * - **Action buttons area** - Space for primary actions like "Add New"
 * - **Responsive layout** - Stacks vertically on mobile viewports
 * - **CSS variable theming** - No inline styles, full dark mode support
 *
 * ## Filter Types
 * - `select` - Dropdown with predefined options
 * - `date` - Single date picker input
 * - `dateRange` - From/to date range with two inputs
 * - `checkbox` - Boolean toggle for flags
 *
 * ## Accessibility
 * - Uses `role="search"` and `aria-label` for the toolbar
 * - All inputs have associated labels
 * - Clear buttons have descriptive aria-labels
 * - Keyboard accessible (Tab navigation, Enter to submit)
 *
 * @param props - Component props
 * @param props.search - Search input configuration
 * @param props.filters - Array of filter configurations
 * @param props.filterValues - Current filter values object
 * @param props.onFilterChange - Callback when a filter value changes
 * @param props.onClearFilters - Callback to clear all filters
 * @param props.hasActiveFilters - Whether to show "Clear Filters" button
 * @param props.actions - Additional action buttons
 * @param props.className - Additional CSS classes
 *
 * @returns JSX element containing the filter toolbar
 *
 * @see {@link SearchConfig} - Search input configuration
 * @see {@link FilterConfig} - Individual filter configuration
 * @see {@link FilterValues} - Filter values object structure
 * @see {@link PageLayout} - Often used together for list pages
 * @see {@link EmptyState} - Often paired for empty filter results
 *
 * @example
 * Basic usage with search only:
 * ```tsx
 * <FilterToolbar
 *   search={{
 *     placeholder: 'Search assets...',
 *     value: searchValue,
 *     onChange: setSearchValue,
 *   }}
 * />
 * ```
 *
 * @example
 * Full-featured toolbar with filters and actions:
 * ```tsx
 * <FilterToolbar
 *   search={{
 *     placeholder: 'Search by name or tag...',
 *     value: search,
 *     onChange: setSearch,
 *     onSubmit: handleSearch,
 *   }}
 *   filters={[
 *     {
 *       id: 'status',
 *       type: 'select',
 *       label: 'Status',
 *       options: [
 *         { value: 'active', label: 'Active' },
 *         { value: 'inactive', label: 'Inactive' },
 *       ],
 *     },
 *     {
 *       id: 'createdDate',
 *       type: 'dateRange',
 *       label: 'Created',
 *     },
 *     {
 *       id: 'showArchived',
 *       type: 'checkbox',
 *       label: 'Show Archived',
 *     },
 *   ]}
 *   filterValues={filterValues}
 *   onFilterChange={(id, value) => {
 *     setFilterValues(prev => ({ ...prev, [id]: value }));
 *   }}
 *   onClearFilters={() => setFilterValues({})}
 *   hasActiveFilters={Object.keys(filterValues).length > 0}
 *   actions={
 *     <Button variant="primary" onClick={handleAddNew}>
 *       Add Asset
 *     </Button>
 *   }
 * />
 * ```
 *
 * @example
 * Within a PageLayout:
 * ```tsx
 * <PageLayout title="Assets" description="Manage your assets">
 *   <FilterToolbar
 *     search={searchConfig}
 *     filters={filterConfigs}
 *     filterValues={filters}
 *     onFilterChange={handleFilterChange}
 *     hasActiveFilters={hasFilters}
 *     onClearFilters={clearFilters}
 *   />
 *   {assets.length > 0 ? (
 *     <ResponsiveTable>
 *       <AssetTable data={assets} />
 *     </ResponsiveTable>
 *   ) : (
 *     <EmptyState
 *       variant={hasFilters ? 'filtered' : 'default'}
 *       title="No assets found"
 *       description="..."
 *     />
 *   )}
 * </PageLayout>
 * ```
 */
export function FilterToolbar({
  search,
  filters,
  filterValues = {},
  onFilterChange,
  onClearFilters,
  hasActiveFilters = false,
  actions,
  className = '',
}: FilterToolbarProps): JSX.Element {
  const classNames = [styles.toolbar, className].filter(Boolean).join(' ');

  // Handle search input change
  const handleSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      search?.onChange(e.target.value);
    },
    [search]
  );

  // Handle search form submit
  const handleSearchSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      search?.onSubmit?.();
    },
    [search]
  );

  // Handle search input keydown for Enter key
  const handleSearchKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        search?.onSubmit?.();
      }
    },
    [search]
  );

  // Handle clearing search
  const handleClearSearch = useCallback(() => {
    search?.onChange('');
  }, [search]);

  // Handle select filter change
  const handleSelectChange = useCallback(
    (id: string, e: ChangeEvent<HTMLSelectElement>) => {
      onFilterChange?.(id, e.target.value);
    },
    [onFilterChange]
  );

  // Handle date filter change
  const handleDateChange = useCallback(
    (id: string, e: ChangeEvent<HTMLInputElement>) => {
      onFilterChange?.(id, e.target.value);
    },
    [onFilterChange]
  );

  // Handle date range filter change
  const handleDateRangeChange = useCallback(
    (id: string, field: 'from' | 'to', e: ChangeEvent<HTMLInputElement>) => {
      const currentValue = filterValues[id] as { from?: string; to?: string } | undefined;
      const newValue = {
        from: currentValue?.from ?? '',
        to: currentValue?.to ?? '',
        [field]: e.target.value,
      };
      onFilterChange?.(id, newValue);
    },
    [filterValues, onFilterChange]
  );

  // Handle checkbox filter change
  const handleCheckboxChange = useCallback(
    (id: string, e: ChangeEvent<HTMLInputElement>) => {
      onFilterChange?.(id, e.target.checked);
    },
    [onFilterChange]
  );

  // Render a single filter based on its type
  const renderFilter = (filter: FilterConfig): JSX.Element => {
    const value = filterValues[filter.id];

    switch (filter.type) {
      case 'select':
        return (
          <div key={filter.id} className={styles.filterItem}>
            <label htmlFor={`filter-${filter.id}`} className={styles.filterLabel}>
              {filter.label}
            </label>
            <select
              id={`filter-${filter.id}`}
              className={styles.filterSelect}
              value={(value as string) ?? ''}
              onChange={(e) => handleSelectChange(filter.id, e)}
              aria-label={filter.label}
            >
              <option value="">{filter.placeholder ?? `All ${filter.label}`}</option>
              {filter.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'date':
        return (
          <div key={filter.id} className={styles.filterItem}>
            <label htmlFor={`filter-${filter.id}`} className={styles.filterLabel}>
              {filter.label}
            </label>
            <input
              id={`filter-${filter.id}`}
              type="date"
              className={styles.filterDate}
              value={(value as string) ?? ''}
              onChange={(e) => handleDateChange(filter.id, e)}
              aria-label={filter.label}
            />
          </div>
        );

      case 'dateRange': {
        const rangeValue = value as { from?: string; to?: string } | undefined;
        return (
          <div key={filter.id} className={styles.filterItem}>
            <span className={styles.filterLabel}>{filter.label}</span>
            <div className={styles.dateRangeInputs}>
              <input
                id={`filter-${filter.id}-from`}
                type="date"
                className={styles.filterDate}
                value={rangeValue?.from ?? ''}
                onChange={(e) => handleDateRangeChange(filter.id, 'from', e)}
                aria-label={`${filter.label} from`}
              />
              <span className={styles.dateRangeSeparator}>to</span>
              <input
                id={`filter-${filter.id}-to`}
                type="date"
                className={styles.filterDate}
                value={rangeValue?.to ?? ''}
                onChange={(e) => handleDateRangeChange(filter.id, 'to', e)}
                aria-label={`${filter.label} to`}
              />
            </div>
          </div>
        );
      }

      case 'checkbox':
        return (
          <div key={filter.id} className={styles.filterItem}>
            <label htmlFor={`filter-${filter.id}`} className={styles.checkboxLabel}>
              <input
                id={`filter-${filter.id}`}
                type="checkbox"
                className={styles.filterCheckbox}
                checked={(value as boolean) ?? false}
                onChange={(e) => handleCheckboxChange(filter.id, e)}
                aria-label={filter.label}
              />
              <span>{filter.label}</span>
            </label>
          </div>
        );

      case 'text':
        return (
          <div key={filter.id} className={styles.filterItem}>
            <label htmlFor={`filter-${filter.id}`} className={styles.filterLabel}>
              {filter.label}
            </label>
            <input
              id={`filter-${filter.id}`}
              type="text"
              className={styles.filterText}
              placeholder={filter.placeholder ?? ''}
              value={(value as string) ?? ''}
              onChange={(e) => onFilterChange?.(filter.id, e.target.value)}
              aria-label={filter.placeholder ?? filter.label}
            />
          </div>
        );

      case 'multiSelect': {
        const selectedValues = (value as string[]) ?? [];
        return (
          <div key={filter.id} className={styles.filterItem}>
            <label htmlFor={`filter-${filter.id}`} className={styles.filterLabel}>
              {filter.label}
            </label>
            <select
              id={`filter-${filter.id}`}
              className={styles.filterSelect}
              multiple
              value={selectedValues}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                onFilterChange?.(filter.id, selected);
              }}
              aria-label={filter.label}
            >
              {filter.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );
      }

      default:
        return <div key={filter.id} />;
    }
  };

  return (
    <div className={classNames} role="search" aria-label="Filter toolbar">
      <div className={styles.toolbarContent}>
        {/* Search Input */}
        {search && (
          <form className={styles.searchWrapper} onSubmit={handleSearchSubmit}>
            <SearchIcon />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={search.placeholder}
              value={search.value}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              aria-label={search.placeholder}
            />
            {search.value && (
              <button
                type="button"
                className={styles.clearSearchButton}
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                <ClearIcon />
              </button>
            )}
          </form>
        )}

        {/* Filters */}
        {filters && filters.length > 0 && (
          <div className={styles.filtersGroup}>
            {filters.map(renderFilter)}
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && onClearFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className={styles.clearFiltersButton}
            aria-label="Clear all filters"
          >
            <ClearIcon />
            <span>Clear Filters</span>
          </Button>
        )}
      </div>

      {/* Actions */}
      {actions && <div className={styles.actionsGroup}>{actions}</div>}
    </div>
  );
}

FilterToolbar.displayName = 'FilterToolbar';
