import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  Children,
  isValidElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import {
  DataTableCtx,
  useDataTable,
  type ColumnDef,
  type SortState,
  type Density,
  type DataTableContextValue,
} from './DataTableContext';
import styles from './DataTable.module.css';

/* ================================================================
 *  Column — declarative column definition (not rendered to DOM)
 * ================================================================ */
interface ColumnProps {
  id: string;
  header: string;
  accessor?: string;
  width?: number | string;
  frozen?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: any) => ReactNode;
  children?: never;
}

function Column(_props: ColumnProps): ReactElement | null {
  return null; // introspected, never rendered
}
Column.displayName = 'DataTable.Column';

/* ================================================================
 *  Toolbar
 * ================================================================ */
interface ToolbarProps {
  children: ReactNode;
}

function Toolbar({ children }: ToolbarProps) {
  return <div className={styles.toolbar}>{children}</div>;
}
Toolbar.displayName = 'DataTable.Toolbar';

/* ================================================================
 *  Spacer
 * ================================================================ */
function Spacer() {
  return <div className={styles.spacer} />;
}
Spacer.displayName = 'DataTable.Spacer';

/* ================================================================
 *  Search
 * ================================================================ */
interface SearchProps {
  placeholder?: string;
}

function Search({ placeholder = 'Search...' }: SearchProps) {
  const { searchQuery, setSearchQuery } = useDataTable();

  return (
    <div className={styles.search}>
      <svg
        className={styles.searchIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        className={styles.searchInput}
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  );
}
Search.displayName = 'DataTable.Search';

/* ================================================================
 *  FilterGroup
 * ================================================================ */
interface FilterGroupProps {
  children: ReactNode;
}

function FilterGroup({ children }: FilterGroupProps) {
  return <div className={styles.filterGroup}>{children}</div>;
}
FilterGroup.displayName = 'DataTable.FilterGroup';

/* ================================================================
 *  Filter
 * ================================================================ */
interface FilterProps {
  label: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (value: string) => void;
}

function Filter({ label, options, value = '', onChange }: FilterProps) {
  return (
    <div className={styles.filter}>
      <select
        className={styles.filterSelect}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label}
      >
        <option value="">{label}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className={styles.filterChevron}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
Filter.displayName = 'DataTable.Filter';

/* ================================================================
 *  ColumnToggle
 * ================================================================ */
function ColumnToggle() {
  const { columns, visibleColumns, toggleColumnVisibility } = useDataTable();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={styles.columnToggle} ref={ref}>
      <button
        className={styles.columnToggleBtn}
        onClick={() => setOpen((p) => !p)}
        aria-label="Toggle columns"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
      {open && (
        <div className={styles.columnToggleDropdown}>
          {columns.map((col) => (
            <label key={col.id} className={styles.columnToggleItem}>
              <input
                type="checkbox"
                checked={visibleColumns.has(col.id)}
                onChange={() => toggleColumnVisibility(col.id)}
              />
              {col.header}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
ColumnToggle.displayName = 'DataTable.ColumnToggle';

/* ================================================================
 *  DensityToggle
 * ================================================================ */
function DensityToggle() {
  const { density, setDensity } = useDataTable();

  const densities: { value: Density; label: string; lines: number }[] = [
    { value: 'compact', label: 'Compact', lines: 4 },
    { value: 'comfortable', label: 'Comfortable', lines: 3 },
    { value: 'spacious', label: 'Spacious', lines: 2 },
  ];

  return (
    <div className={styles.densityToggle} role="group" aria-label="Table density">
      {densities.map((d) => {
        const btnClasses = [
          styles.densityBtn,
          density === d.value ? styles.densityBtnActive : '',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={d.value}
            className={btnClasses}
            onClick={() => setDensity(d.value)}
            aria-pressed={density === d.value}
            title={d.label}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              {Array.from({ length: d.lines }).map((_, i) => (
                <rect
                  key={i}
                  x="1"
                  y={1 + i * (12 / d.lines)}
                  width="12"
                  height={Math.max(1, 10 / d.lines - 1)}
                  rx="0.5"
                  fill="currentColor"
                />
              ))}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
DensityToggle.displayName = 'DataTable.DensityToggle';

/* ================================================================
 *  BulkActions
 * ================================================================ */
interface BulkActionsProps {
  children: ReactNode;
}

function BulkActions({ children }: BulkActionsProps) {
  const { selectedIds, clearSelection } = useDataTable();

  if (selectedIds.size === 0) return null;

  return (
    <div className={styles.bulkActions}>
      <span className={styles.bulkActionsCount}>
        {selectedIds.size} selected
      </span>
      <div className={styles.bulkActionsBtns}>{children}</div>
      <button className={styles.bulkClearBtn} onClick={clearSelection}>
        Clear selection
      </button>
    </div>
  );
}
BulkActions.displayName = 'DataTable.BulkActions';

/* ================================================================
 *  Pagination
 * ================================================================ */
interface PaginationProps {
  pageSize?: number;
  pageSizes?: number[];
  showTotal?: boolean;
}

function Pagination({
  pageSize: _externalPageSize,
  pageSizes = [10, 25, 50, 100],
  showTotal = false,
}: PaginationProps) {
  const {
    sortedData,
    currentPage,
    pageSize,
    totalPages,
    setCurrentPage,
    setPageSize,
  } = useDataTable();

  const totalItems = sortedData.length;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationInfo}>
        {showTotal && (
          <span className={styles.paginationTotal}>
            Showing {startItem}-{endItem} of {totalItems}
          </span>
        )}
        <span>Rows per page:</span>
        <select
          className={styles.pageSizeSelect}
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setCurrentPage(1);
          }}
        >
          {pageSizes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.paginationNav}>
        <button
          className={styles.pageBtn}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 4px' }}>
              ...
            </span>
          ) : (
            <button
              key={p}
              className={[
                styles.pageBtn,
                p === currentPage ? styles.pageBtnActive : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setCurrentPage(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className={styles.pageBtn}
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage(currentPage + 1)}
          aria-label="Next page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
Pagination.displayName = 'DataTable.Pagination';

/* ================================================================
 *  RowActions
 * ================================================================ */
interface RowActionsProps {
  children: ReactNode;
}

function RowActions({ children }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={styles.rowActions} ref={ref}>
      <button
        className={styles.rowActionsBtn}
        onClick={() => setOpen((p) => !p)}
        aria-label="Row actions"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>
      {open && (
        <div className={styles.rowActionsMenu} role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
RowActions.displayName = 'DataTable.RowActions';

/* ================================================================
 *  Sort indicator icon
 * ================================================================ */
function SortIcon({ direction }: { direction: 'asc' | 'desc' | null }) {
  if (direction === 'asc') {
    return (
      <span className={`${styles.sortIndicator} ${styles.sortActive}`}>
        <svg className={styles.sortArrow} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          <polygon points="5,2 9,8 1,8" />
        </svg>
      </span>
    );
  }
  if (direction === 'desc') {
    return (
      <span className={`${styles.sortIndicator} ${styles.sortActive}`}>
        <svg className={styles.sortArrow} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
          <polygon points="5,8 9,2 1,2" />
        </svg>
      </span>
    );
  }
  return (
    <span className={styles.sortIndicator}>
      <svg className={styles.sortArrow} viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
        <polygon points="5,1 8,5 2,5" />
        <polygon points="5,9 8,5 2,5" />
      </svg>
    </span>
  );
}

/* ================================================================
 *  Loading skeleton
 * ================================================================ */
function LoadingSkeleton({ columns, density }: { columns: ColumnDef[]; density: Density }) {
  const rowHeight = density === 'compact' ? 36 : density === 'comfortable' ? 44 : 52;

  return (
    <div className={styles.loadingContainer} aria-label="Loading table data" role="status">
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <div key={rowIdx} className={styles.skeletonRow} style={{ height: rowHeight }}>
          {columns.map((col) => (
            <div key={col.id} className={styles.skeletonCell} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ================================================================
 *  Helper: extract ColumnDefs from children
 * ================================================================ */
function extractColumns(children: ReactNode): ColumnDef[] {
  const cols: ColumnDef[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as any)?.displayName === 'DataTable.Column') {
      const p = child.props as ColumnProps;
      cols.push({
        id: p.id,
        header: p.header,
        accessor: p.accessor,
        width: p.width,
        frozen: p.frozen,
        sortable: p.sortable,
        filterable: p.filterable,
        render: p.render,
      });
    }
  });
  return cols;
}

/* ================================================================
 *  Helper: extract non-Column children by displayName
 * ================================================================ */
function extractChild(children: ReactNode, displayName: string): ReactElement | null {
  let found: ReactElement | null = null;
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as any)?.displayName === displayName) {
      found = child;
    }
  });
  return found;
}

function extractAllChildren(children: ReactNode, displayName: string): ReactElement[] {
  const result: ReactElement[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && (child.type as any)?.displayName === displayName) {
      result.push(child);
    }
  });
  return result;
}

/* ================================================================
 *  DataTableRoot — main container
 * ================================================================ */
export interface DataTableProps {
  data: any[];
  keyField: string;
  density?: Density;
  stickyHeader?: boolean;
  selectable?: false | 'single' | 'multi';
  loading?: boolean;
  children: ReactNode;
}

function DataTableRoot({
  data,
  keyField,
  density: initialDensity = 'comfortable',
  stickyHeader = false,
  selectable = false,
  loading = false,
  children,
}: DataTableProps) {
  /* ------- Column introspection ------- */
  const columns = useMemo(() => extractColumns(children), [children]);

  /* ------- State ------- */
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [density, setDensity] = useState<Density>(initialDensity);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(columns.map((c) => c.id))
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* Keep visibleColumns in sync if columns change */
  useEffect(() => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      for (const col of columns) {
        if (!next.has(col.id) && prev.size === 0) {
          next.add(col.id);
        }
      }
      // Add newly-appeared columns
      for (const col of columns) {
        if (![...prev].some((id) => columns.find((c) => c.id === id))) {
          next.add(col.id);
        }
      }
      return next;
    });
  }, [columns]);

  /* ------- Detect pagination child to know default pageSize ------- */
  const paginationChild = extractChild(children, 'DataTable.Pagination');
  const hasPagination = paginationChild !== null;
  const paginationPageSize = paginationChild
    ? (paginationChild.props as PaginationProps).pageSize
    : undefined;

  useEffect(() => {
    if (paginationPageSize !== undefined) {
      setPageSize(paginationPageSize);
    }
  }, [paginationPageSize]);

  /* ------- Derived data ------- */
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        if (!col.accessor) return false;
        const val = row[col.accessor];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, searchQuery, columns]);

  const sortedData = useMemo(() => {
    if (!sortState) return filteredData;
    const col = columns.find((c) => c.id === sortState.columnId);
    if (!col?.accessor) return filteredData;
    const accessor = col.accessor;
    const dir = sortState.direction === 'asc' ? 1 : -1;
    return [...filteredData].sort((a, b) => {
      const aVal = a[accessor];
      const bVal = b[accessor];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }, [filteredData, sortState, columns]);

  const totalPages = hasPagination ? Math.max(1, Math.ceil(sortedData.length / pageSize)) : 1;

  const paginatedData = useMemo(() => {
    if (!hasPagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize, hasPagination]);

  /* Reset page when filter/search changes */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, data]);

  /* ------- Actions ------- */
  const sort = useCallback(
    (columnId: string) => {
      setSortState((prev) => {
        if (prev?.columnId === columnId) {
          return prev.direction === 'asc'
            ? { columnId, direction: 'desc' }
            : null;
        }
        return { columnId, direction: 'asc' };
      });
    },
    []
  );

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (selectable === 'single') {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.clear();
            next.add(id);
          }
        } else {
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
        return next;
      });
    },
    [selectable]
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allIds = paginatedData.map((row) => String(row[keyField]));
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set<string>();
      }
      return new Set(allIds);
    });
  }, [paginatedData, keyField]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleColumnVisibility = useCallback((columnId: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        // Don't allow hiding all columns
        if (next.size > 1) next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  }, []);

  /* ------- Context ------- */
  const ctxValue: DataTableContextValue = useMemo(
    () => ({
      data,
      columns,
      sortState,
      selectedIds,
      density,
      loading,
      keyField,
      searchQuery,
      visibleColumns,
      filteredData,
      sortedData,
      paginatedData,
      currentPage,
      pageSize,
      totalPages,
      selectable,
      sort,
      toggleSelection,
      toggleSelectAll,
      clearSelection,
      setDensity,
      setSearchQuery,
      toggleColumnVisibility,
      setCurrentPage,
      setPageSize,
    }),
    [
      data, columns, sortState, selectedIds, density, loading, keyField,
      searchQuery, visibleColumns, filteredData, sortedData, paginatedData,
      currentPage, pageSize, totalPages, selectable,
      sort, toggleSelection, toggleSelectAll, clearSelection,
      setDensity, setSearchQuery, toggleColumnVisibility,
      setCurrentPage, setPageSize,
    ]
  );

  /* ------- Extract special children ------- */
  const toolbarChild = extractChild(children, 'DataTable.Toolbar');
  const bulkActionsChild = extractChild(children, 'DataTable.BulkActions');

  /* ------- Visible columns ------- */
  const displayColumns = columns.filter((c) => visibleColumns.has(c.id));

  /* ------- Select-all state ------- */
  const allPageIds = paginatedData.map((row) => String(row[keyField]));
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id)) && !allSelected;

  /* ------- Root classes ------- */
  const rootClasses = [
    styles.root,
    styles[density],
    stickyHeader ? styles.stickyHeader : '',
  ].filter(Boolean).join(' ');

  return (
    <DataTableCtx.Provider value={ctxValue}>
      <div className={rootClasses}>
        {/* Toolbar */}
        {toolbarChild}

        {/* Bulk actions */}
        {bulkActionsChild}

        {/* Loading */}
        {loading ? (
          <LoadingSkeleton columns={displayColumns} density={density} />
        ) : (
          <table className={styles.table} role="table">
            <thead className={styles.thead}>
              <tr>
                {selectable && (
                  <th className={`${styles.th} ${styles.checkboxCell}`}>
                    {selectable === 'multi' && (
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected;
                        }}
                        onChange={toggleSelectAll}
                        aria-label="Select all rows"
                      />
                    )}
                  </th>
                )}
                {displayColumns.map((col) => {
                  const isSorted = sortState?.columnId === col.id;
                  const dir = isSorted ? sortState!.direction : null;
                  const thClasses = [
                    styles.th,
                    col.sortable ? styles.thSortable : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <th
                      key={col.id}
                      className={thClasses}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={col.sortable ? () => sort(col.id) : undefined}
                      aria-sort={
                        isSorted
                          ? dir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      <span className={styles.thContent}>
                        {col.header}
                        {col.sortable && <SortIcon direction={dir} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={styles.tbody}>
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={displayColumns.length + (selectable ? 1 : 0)}
                    className={styles.emptyState}
                  >
                    <span className={styles.emptyStateText}>No data available</span>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const rowId = String(row[keyField]);
                  const isSelected = selectedIds.has(rowId);
                  const trClasses = [
                    styles.tr,
                    isSelected ? styles.trSelected : '',
                  ].filter(Boolean).join(' ');

                  return (
                    <tr key={rowId} className={trClasses}>
                      {selectable && (
                        <td className={`${styles.td} ${styles.checkboxCell}`}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={isSelected}
                            onChange={() => toggleSelection(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {displayColumns.map((col) => {
                        const value = col.accessor ? row[col.accessor] : undefined;
                        return (
                          <td key={col.id} className={styles.td}>
                            {col.render ? col.render(value, row) : value}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {paginationChild}
      </div>
    </DataTableCtx.Provider>
  );
}

/* ================================================================
 *  Assemble compound component
 * ================================================================ */
export const DataTable = Object.assign(DataTableRoot, {
  Column,
  Toolbar,
  Search,
  FilterGroup,
  Filter,
  Spacer,
  ColumnToggle,
  DensityToggle,
  BulkActions,
  Pagination,
  RowActions,
});
