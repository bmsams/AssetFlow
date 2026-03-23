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
import type { Model, Manufacturer, ModelStatus } from '../../types/admin';
import { getModelStatusInfo } from '../../types/admin';
import styles from './AdminPage.module.css';

// Helper function to get lifecycle CSS class based on status
function getLifecycleClass(status: ModelStatus): string {
  switch (status) {
    case 'ACTIVE':
      return styles.lifecycleActive;
    case 'DEPRECATED':
      return styles.lifecycleDeprecated;
    case 'END_OF_LIFE':
      return styles.lifecycleEndOfLife;
    default:
      return styles.lifecycleDefault;
  }
}

/**
 * Models (Product Catalog) Administration Page
 * Implements Task 16.3.9: Create ModelsPage.tsx with search
 * Refactored to use PageLayout pattern (Task 9.7)
 */
export function ModelsPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [selectedMfrId, setSelectedMfrId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Models
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_MODELS;

  // Load manufacturers for filter dropdown
  useEffect(() => {
    adminApi.manufacturers.list({ isActive: true }, { pageSize: 100 })
      .then(res => setManufacturers(res.items))
      .catch(() => setManufacturers([]));
  }, []);

  // Filter configuration for FilterToolbar
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: 'manufacturerId',
      type: 'select',
      label: 'Manufacturer',
      placeholder: 'All Manufacturers',
      options: manufacturers.map(m => ({
        value: m.manufacturerId,
        label: m.name,
      })),
    },
    {
      id: 'showInactive',
      type: 'checkbox',
      label: 'Show inactive',
    },
  ], [manufacturers]);

  // Current filter values
  const filterValues: FilterValues = useMemo(() => ({
    manufacturerId: selectedMfrId,
    showInactive,
  }), [selectedMfrId, showInactive]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || selectedMfrId !== '' || showInactive;
  }, [searchQuery, selectedMfrId, showInactive]);

  // Handle filter changes from FilterToolbar
  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'manufacturerId') {
      setSelectedMfrId(value as string);
    } else if (id === 'showInactive') {
      setShowInactive(value as boolean);
    }
  }, []);

  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedMfrId('');
    setShowInactive(false);
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.models.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined, manufacturerId: selectedMfrId || undefined },
        { pageSize: 100 }
      );
      setModels(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery, selectedMfrId]);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = models.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== models.length) {
      const message = models.length === 0
        ? 'No models match the current filters'
        : models.length === 1
          ? 'Showing 1 result'
          : `Showing ${models.length} results`;
      announce(message, 'polite');
      previousCountRef.current = models.length;
    }
  }, [models.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchModels();
  }, [fetchModels]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDeactivate = async (model: Model, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate model "${model.modelName}"?`)) return;
    try {
      await adminApi.models.deactivate(model.modelId);
      void fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleCreateModel = () => {
    navigate('/admin/products/new');
  };

  // Render skeleton loading state
  const renderSkeleton = () => (
    <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Loading models">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Model</th>
            <th>Manufacturer</th>
            <th>Model #</th>
            <th>Category</th>
            <th>Assets</th>
            <th>Lifecycle</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              <td><div className={`${styles.skeleton} ${styles.skeletonLg}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonXs}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
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
      onClick={handleCreateModel}
      aria-label="Add new model"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon} aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Add Model
    </button>
  );

  return (
    <PageLayout
      title="Product Catalog"
      description="Manage product models and specifications"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search models...',
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
          title="Error Loading Models"
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
      ) : error ? null : models.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          }
          title="No models found"
          description={
            hasActiveFilters
              ? 'No models match the current filters. Try adjusting your search or filter criteria.'
              : 'Add models to the product catalog to get started.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Model',
                  onClick: handleCreateModel,
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
        <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Models list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Model</th>
                <th>Manufacturer</th>
                <th>Model #</th>
                <th>Category</th>
                <th>Assets</th>
                <th>Lifecycle</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const statusInfo = getModelStatusInfo(m.status);
                const lifecycleClass = getLifecycleClass(m.status);
                return (
                  <tr
                    key={m.modelId}
                    onClick={() => navigate(`/admin/products/${m.modelId}`)}
                    className={styles.clickableRow}
                  >
                    <td>{m.modelName}</td>
                    <td>{m.manufacturerName}</td>
                    <td className={styles.codeCell}>{m.modelNumber || '-'}</td>
                    <td>{m.category || '-'}</td>
                    <td>{m.assetCount}</td>
                    <td><span className={lifecycleClass}>{statusInfo.label}</span></td>
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
                            // `/admin/products/:modelId` is the edit form route.
                            navigate(`/admin/products/${m.modelId}`);
                          }}
                          title="Edit"
                          aria-label={`Edit ${m.modelName}`}
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
                            aria-label={`Deactivate ${m.modelName}`}
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
                );
              })}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </PageLayout>
  );
}

export default ModelsPage;
