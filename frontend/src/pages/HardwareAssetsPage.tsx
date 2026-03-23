import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { FilterToolbar, ErrorMessage, EmptyState, ResponsiveTable } from '../components/ui';
import { useAnnounce } from '../components/accessibility';
import { AssetTable, Pagination } from '../components/assets';
import type { SortConfig } from '../components/assets';
import type { FilterConfig, FilterValues } from '../components/ui';
import { assetApi } from '../services/asset-api';
import { BREADCRUMB_CONFIGS, type BreadcrumbItem } from '../types/layout';
import type { Asset, AssetStatus } from '../types/asset';
import styles from './AssetsPage.module.css';

const DEFAULT_PAGE_SIZE = 10;

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

const FILTER_CONFIGS: FilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'text',
    placeholder: 'Search hardware assets...',
  },
  {
    id: 'statuses',
    label: 'Status',
    type: 'multiSelect',
    options: ASSET_STATUSES,
    placeholder: 'Select statuses',
    searchable: true,
  },
];

const DEFAULT_COLUMNS = [
  { id: 'assetTag', label: 'Asset Tag', visible: true, sortable: true },
  { id: 'displayName', label: 'Name', visible: true, sortable: true },
  { id: 'status', label: 'Status', visible: true, sortable: true },
  { id: 'createdAt', label: 'Created', visible: true, sortable: true },
];

const breadcrumbs: BreadcrumbItem[] = [
  ...BREADCRUMB_CONFIGS.ASSETS,
  { label: 'Hardware' },
];

export function HardwareAssetsPage() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({
    column: 'createdAt',
    direction: 'desc',
  });

  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRetrying(false);
      setError(null);
      const response = await assetApi.list(
        {
          type: 'HARDWARE',
          search: searchQuery || undefined,
          status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        },
        {
          page: currentPage,
          pageSize,
          sortBy: sortConfig?.column,
          sortOrder: sortConfig?.direction,
        }
      );
      setAssets(response.items);
      setTotalItems(response.total);
    } catch (err) {
      setError('Failed to load hardware assets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, currentPage, pageSize, sortConfig]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = totalItems;
      return;
    }
    if (!isLoading && previousCountRef.current !== totalItems) {
      const message = totalItems === 0
        ? 'No hardware assets match the current filters'
        : `Showing ${totalItems} result${totalItems === 1 ? '' : 's'}`;
      announce(message, 'polite');
      previousCountRef.current = totalItems;
    }
  }, [totalItems, isLoading, announce]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const filterValues: FilterValues = { search: searchQuery, statuses: statusFilter };
  const hasActiveFilters = Boolean(searchQuery || statusFilter.length > 0);

  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'search') setSearchQuery(value as string);
    if (id === 'statuses') setStatusFilter(value as AssetStatus[]);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter([]);
  }, []);

  const headerActions = (
    <button
      type="button"
      className={styles.createButton}
      title="Create a new asset"
      onClick={() => navigate('/assets/new')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Create Asset
    </button>
  );

  if (error) {
    return (
      <PageLayout title="Hardware Assets" description="Manage physical IT equipment" breadcrumbs={breadcrumbs} maxWidth="xl">
        <ErrorMessage
          title="Error Loading Hardware Assets"
          message={error}
          type="error"
          variant="inline"
          recoveryOptions={[{ label: 'Retry', action: handleRetry, isLoading: isRetrying }]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Hardware Assets"
      description="Manage physical IT equipment including laptops, servers, and network devices"
      breadcrumbs={breadcrumbs}
      maxWidth="xl"
      headerActions={headerActions}
    >
      <section aria-label="Asset filters">
        <FilterToolbar
          filters={FILTER_CONFIGS}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        />
      </section>

      {!isLoading && assets.length === 0 ? (
        <EmptyState
          title="No hardware assets found"
          description={hasActiveFilters ? 'Try adjusting your filters.' : 'Create your first hardware asset to get started.'}
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : { label: 'Create Asset', onClick: () => navigate('/assets/new') }
          }
        />
      ) : (
        <>
          <section aria-label="Hardware assets list">
            <ResponsiveTable minWidth="700px" showScrollIndicator>
              <AssetTable
                assets={assets}
                columns={DEFAULT_COLUMNS}
                sortConfig={sortConfig}
                onSortChange={setSortConfig}
                selectedIds={new Set()}
                onSelectionChange={() => {}}
                onAssetClick={(asset) => navigate(`/assets/${asset.assetId}`)}
                isLoading={isLoading}
              />
            </ResponsiveTable>
          </section>

          {!isLoading && totalItems > 0 && (
            <section aria-label="Pagination">
              <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                disabled={isLoading}
              />
            </section>
          )}
        </>
      )}
    </PageLayout>
  );
}

export default HardwareAssetsPage;
