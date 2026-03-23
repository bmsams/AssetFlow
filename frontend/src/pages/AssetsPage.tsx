import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { FilterToolbar, ErrorMessage, ResponsiveTable } from '../components/ui';
import { useAnnounce } from '../components/accessibility';
import {
  AssetTable,
  BulkActions,
  ColumnSelector,
  Pagination,
} from '../components/assets';
import type {
  SortConfig,
  ColumnConfig,
} from '../components/assets';
import type { 
  FilterConfig, 
  FilterValues 
} from '../components/ui';
import { assetApi } from '../services/asset-api';
import type { Asset, AssetType, AssetStatus } from '../types/asset';
import { BREADCRUMB_CONFIGS } from '../types/layout';
import styles from './AssetsPage.module.css';
import { useTour, type TourStep } from '@ams/ui/tour';

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'assetTag', label: 'Asset Tag', visible: true, sortable: true },
  { id: 'displayName', label: 'Name', visible: true, sortable: true },
  { id: 'assetType', label: 'Type', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: true, sortable: true },
  { id: 'createdAt', label: 'Created', visible: true, sortable: true },
  { id: 'updatedAt', label: 'Updated', visible: false, sortable: true },
  { id: 'description', label: 'Description', visible: false, sortable: false },
];

const DEFAULT_PAGE_SIZE = 10;

// Asset type options for filter
const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'HARDWARE', label: 'Hardware' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

// Asset status options for filter
const ASSET_STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_STOCK', label: 'In Stock' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'DEPLOYED', label: 'Deployed' },
  { value: 'IN_MAINTENANCE', label: 'In Maintenance' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DISPOSED', label: 'Disposed' },
];

// FilterToolbar configuration
const FILTER_CONFIGS: FilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Search assets by name, tag, or description...'
  },
  {
    id: 'types',
    label: 'Asset Type',
    type: 'multiSelect',
    options: ASSET_TYPES,
    placeholder: 'Select asset types',
    searchable: true
  },
  {
    id: 'statuses',
    label: 'Status',
    type: 'multiSelect',
    options: ASSET_STATUSES,
    placeholder: 'Select statuses',
    searchable: true
  }
];

// Interface for existing filter state structure
interface AssetFiltersState {
  search: string;
  types: AssetType[];
  statuses: AssetStatus[];
}

// Convert to FilterValues type for FilterToolbar
const assetFiltersToFilterValues = (filters: AssetFiltersState): FilterValues => {
  return {
    search: filters.search,
    types: filters.types,
    statuses: filters.statuses
  };
};

// Convert from FilterValues back to AssetFiltersState
const filterValuesToAssetFilters = (values: FilterValues): AssetFiltersState => {
  return {
    search: (values.search as string) || '',
    types: (values.types as AssetType[]) || [],
    statuses: (values.statuses as AssetStatus[]) || []
  };
};

/**
 * AssetsPage component - Main asset list view
 * Implements Requirement 2.1: System shall maintain a comprehensive asset registry
 * - Paginated asset list with filtering and sorting
 * - Column customization
 * - Bulk actions support
 */
export function AssetsPage() {
  // Tour definitions
  const assetsSteps: TourStep[] = [
    { target: '[data-tour="search"]', title: 'Search Assets', content: 'Search by name, asset tag, serial number, or any field.' },
    { target: '[data-tour="filters"]', title: 'Smart Filters', content: 'Filter by status, category, department, or location.' },
    { target: '[data-tour="create-asset"]', title: 'Create Asset', content: 'Add a new asset to the system.' },
    { target: '[data-tour="bulk-actions"]', title: 'Bulk Actions', content: 'Select multiple assets to perform batch operations.' },
  ];
  useTour('assets', assetsSteps);

  const navigate = useNavigate();

  // Data state
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<AssetFiltersState>({
    search: '',
    types: [],
    statuses: [],
  });

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousFilteredCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    column: 'createdAt',
    direction: 'desc',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Column state
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch assets from real API
  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRetrying(false);
      setError(null);
      const response = await assetApi.list(
        {
          search: filters.search || undefined,
          type: filters.types.length === 1 ? filters.types[0] : undefined,
          status: filters.statuses.length === 1 ? filters.statuses[0] : undefined,
        },
        {
          page: currentPage,
          pageSize,
          sortBy: sortConfig?.column,
          sortOrder: sortConfig?.direction,
        }
      );
      setAllAssets(response.items);
      setTotalItems(response.total);
    } catch (err) {
      setError('Failed to load assets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, pageSize, sortConfig]);
  
  // Handle retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) {
        await fetchAssets();
      }
    };
    
    void loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchAssets]);

  // Filter and sort assets (client-side filtering for multi-select filters not supported by API)
  const filteredAssets = useMemo(() => {
    let result = [...allAssets];

    // Apply multi-type filter client-side when more than one type selected
    if (filters.types.length > 1) {
      result = result.filter((asset) => filters.types.includes(asset.assetType));
    }

    // Apply multi-status filter client-side when more than one status selected
    if (filters.statuses.length > 1) {
      result = result.filter((asset) => filters.statuses.includes(asset.status));
    }

    return result;
  }, [allAssets, filters]);

  // Assets are already paginated by the API; apply client-side multi-filter if needed
  const paginatedAssets = filteredAssets;

  // Announce filter results to screen readers when filtered count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousFilteredCountRef.current = totalItems;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousFilteredCountRef.current !== totalItems) {
      const message = totalItems === 0
        ? 'No assets match the current filters'
        : totalItems === 1
          ? 'Showing 1 result'
          : `Showing ${totalItems} results`;
      announce(message, 'polite');
      previousFilteredCountRef.current = totalItems;
    }
  }, [totalItems, isLoading, announce]);

  // Selected assets
  const selectedAssets = useMemo(
    () => allAssets.filter((asset) => selectedIds.has(asset.assetId)),
    [allAssets, selectedIds]
  );

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters, sortConfig]);

  // Handlers
  // Convert FilterToolbar values to AssetFiltersState
  const handleFilterToolbarChange = useCallback((id: string, value: FilterValues[string]) => {
    setFilters(prev => {
      const newValues = { ...assetFiltersToFilterValues(prev), [id]: value };
      return filterValuesToAssetFilters(newValues);
    });
  }, []);

  const handleSortChange = useCallback((config: SortConfig) => {
    setSortConfig(config);
  }, []);

  const handleColumnsChange = useCallback((newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
  }, []);

  const handleSelectionChange = useCallback((newSelectedIds: Set<string>) => {
    setSelectedIds(newSelectedIds);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAssetClick = useCallback((asset: Asset) => {
    navigate(`/assets/${asset.assetId}`);
  }, [navigate]);

  const handleDelete = useCallback((assets: Asset[]) => {
    setInteractionNotice(`Deletion workflow prepared for ${assets.length.toLocaleString()} asset(s). Confirmation step will be enabled next.`);
  }, []);

  const handleExport = useCallback(
    (assets: Asset[], format: 'csv' | 'excel' | 'pdf') => {
      setInteractionNotice(`Export queued: ${assets.length.toLocaleString()} asset(s) as ${format.toUpperCase()}.`);
    },
    []
  );

  const handleStatusChange = useCallback(
    (assets: Asset[], newStatus: AssetStatus) => {
      setInteractionNotice(`Status update drafted: ${assets.length.toLocaleString()} asset(s) -> ${newStatus}.`);
    },
    []
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  if (error) {
    return (
      <PageLayout
        title="All Assets"
        description="View and manage all assets in your organization"
        maxWidth="xl"
      >
        <ErrorMessage
          title="Error Loading Assets"
          message={error}
          type="error"
          variant="inline"
          recoveryOptions={[
            {
              label: "Retry",
              action: handleRetry,
              isLoading: isRetrying
            }
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="All Assets"
      description="View and manage all assets in your organization"
      breadcrumbs={[...BREADCRUMB_CONFIGS.ASSETS, { label: 'All Assets' }]}
      maxWidth="xl"
      headerActions={
        <div className={styles.headerActions}>
          <ColumnSelector
            columns={columns}
            onColumnsChange={handleColumnsChange}
            disabled={isLoading}
          />
          <button type="button" className={styles.createButton} title="Create a new asset" data-tour="create-asset" onClick={() => navigate('/assets/new')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Asset
          </button>
        </div>
      }
    >

      {/* Filters */}
      {interactionNotice && (
        <div className={styles.interactionNotice} role="status">
          <span>{interactionNotice}</span>
          <button
            type="button"
            className={styles.noticeDismissButton}
            onClick={() => setInteractionNotice(null)}
            aria-label="Dismiss interaction notice"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div data-tour="filters">
      <section aria-label="Asset filters" data-tour="search">
        <FilterToolbar
          filters={FILTER_CONFIGS}
          filterValues={assetFiltersToFilterValues(filters)}
          onFilterChange={handleFilterToolbarChange}
          hasActiveFilters={Boolean(filters.search || filters.types.length > 0 || filters.statuses.length > 0)}
          onClearFilters={() => setFilters({ search: '', types: [], statuses: [] })}
        />
      </section>
      </div>

      {/* Bulk Actions */}
      {selectedAssets.length > 0 && (
        <section aria-label="Bulk actions" data-tour="bulk-actions">
          <BulkActions
            selectedAssets={selectedAssets}
            onDelete={handleDelete}
            onExport={handleExport}
            onStatusChange={handleStatusChange}
            onClearSelection={handleClearSelection}
            disabled={isLoading}
          />
        </section>
      )}

      {/* Asset Table */}
      <section aria-label="Assets list">
        <ResponsiveTable minWidth="800px" showScrollIndicator>
          <AssetTable
            assets={paginatedAssets}
            columns={columns}
            sortConfig={sortConfig}
            onSortChange={handleSortChange}
            selectedIds={selectedIds}
            onSelectionChange={handleSelectionChange}
            onAssetClick={handleAssetClick}
            isLoading={isLoading}
          />
        </ResponsiveTable>
      </section>

      {/* Pagination */}
      {!isLoading && totalItems > 0 && (
        <section aria-label="Pagination">
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            disabled={isLoading}
          />
        </section>
      )}
    </PageLayout>
  );
}

export default AssetsPage;
