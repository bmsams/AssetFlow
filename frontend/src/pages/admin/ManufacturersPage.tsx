import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnounce } from '../../components/accessibility';
import { PageLayout } from '../../components/layout';
import {
  FilterToolbar,
  EmptyState,
  ErrorMessage,
  ResponsiveTable,
  StatusBadge,
  type FilterConfig,
  type FilterValues,
} from '../../components/ui';
import { BREADCRUMB_CONFIGS, type BreadcrumbItem } from '../../types/layout';
import { adminApi } from '../../services/admin-api';
import type { Manufacturer } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Manufacturers Administration Page
 * Implements Task 16.3.7: Create ManufacturersPage.tsx with list
 * Refactored to use PageLayout pattern (Task 9.6)
 */
export function ManufacturersPage() {
  const navigate = useNavigate();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Manufacturers
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_MANUFACTURERS;

  // Filter configuration for FilterToolbar
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: 'showInactive',
      type: 'checkbox',
      label: 'Show inactive',
    },
  ], []);

  // Current filter values
  const filterValues: FilterValues = useMemo(() => ({
    showInactive,
  }), [showInactive]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || showInactive;
  }, [searchQuery, showInactive]);

  // Handle filter changes from FilterToolbar
  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'showInactive') {
      setShowInactive(value as boolean);
    }
  }, []);

  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setShowInactive(false);
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const fetchManufacturers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.manufacturers.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined },
        { pageSize: 100 }
      );
      setManufacturers(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manufacturers');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery]);

  useEffect(() => {
    fetchManufacturers();
  }, [fetchManufacturers]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = manufacturers.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== manufacturers.length) {
      const message = manufacturers.length === 0
        ? 'No manufacturers match the current filters'
        : manufacturers.length === 1
          ? 'Showing 1 result'
          : `Showing ${manufacturers.length} results`;
      announce(message, 'polite');
      previousCountRef.current = manufacturers.length;
    }
  }, [manufacturers.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchManufacturers();
  }, [fetchManufacturers]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDeactivate = async (mfr: Manufacturer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate manufacturer "${mfr.name}"?`)) return;
    try {
      await adminApi.manufacturers.deactivate(mfr.manufacturerId);
      fetchManufacturers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleCreateManufacturer = () => {
    navigate('/admin/manufacturers/new');
  };

  // Render skeleton loading state
  const renderSkeleton = () => (
    <ResponsiveTable minWidth="700px" showScrollIndicator aria-label="Loading manufacturers">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Website</th>
            <th>Models</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              <td><div className={`${styles.skeleton} ${styles.skeletonLg}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonXs}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );

  // Header action button for PageLayout
  const headerActions = (
    <button
      type="button"
      className={styles.primaryButton}
      onClick={handleCreateManufacturer}
      aria-label="Add new manufacturer"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon} aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Add Manufacturer
    </button>
  );

  return (
    <PageLayout
      title="Manufacturers"
      description="Manage product manufacturers"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search manufacturers...',
          value: searchQuery,
          onChange: handleSearchChange,
        }}
        filters={filterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <ErrorMessage
          title="Error Loading Manufacturers"
          message={error}
          type="error"
          variant="inline"
          onDismiss={handleDismissError}
          recoveryOptions={[
            {
              label: 'Retry',
              action: handleRetry,
              variant: 'primary',
              isLoading: isRetrying,
            },
          ]}
        />
      )}

      {isLoading ? (
        renderSkeleton()
      ) : error ? null : manufacturers.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          }
          title="No manufacturers found"
          description={
            hasActiveFilters
              ? 'No manufacturers match the current filters. Try adjusting your search or filter criteria.'
              : 'Add manufacturers to the product catalog to get started.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Manufacturer',
                  onClick: handleCreateManufacturer,
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  ),
                }
          }
        />
      ) : (
        <ResponsiveTable minWidth="700px" showScrollIndicator aria-label="Manufacturers list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Website</th>
                <th>Models</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {manufacturers.map((m) => (
                <tr
                  key={m.manufacturerId}
                  onClick={() => navigate(`/admin/manufacturers/${m.manufacturerId}`)}
                  className={styles.clickableRow}
                >
                  <td>{m.name}</td>
                  <td>
                    {m.website ? (
                      <a
                        href={m.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Visit ${m.name} website (opens in new tab)`}
                      >
                        {m.website}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{m.modelCount}</td>
                  <td>
                    <StatusBadge
                      label={m.isActive ? 'Active' : 'Inactive'}
                      variant={m.isActive ? 'active' : 'inactive'}
                      size="sm"
                    />
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/manufacturers/${m.manufacturerId}/edit`);
                        }}
                        title="Edit"
                        aria-label={`Edit ${m.name}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {m.isActive && (
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.dangerButton}`}
                          onClick={(e) => handleDeactivate(m, e)}
                          title="Deactivate"
                          aria-label={`Deactivate ${m.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </PageLayout>
  );
}

export default ManufacturersPage;
