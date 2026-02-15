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
import type { CostCenter, Department } from '../../types/admin';
import { formatCurrency, getCostCenterUtilization } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Cost Centers Administration Page
 * Implements Task 16.3.3: Create CostCentersPage.tsx with budget tracking
 * Refactored to use PageLayout pattern (Task 9.5)
 */
export function CostCentersPage() {
  const navigate = useNavigate();
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Cost Centers
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_COST_CENTERS;

  // Load departments for filter dropdown
  useEffect(() => {
    adminApi.departments.list({ isActive: true }, { pageSize: 100 })
      .then(res => setDepartments(res.items))
      .catch(() => setDepartments([]));
  }, []);

  // Filter configuration for FilterToolbar
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: 'departmentId',
      type: 'select',
      label: 'Department',
      placeholder: 'All Departments',
      options: departments.map(d => ({
        value: d.departmentId,
        label: d.name,
      })),
    },
    {
      id: 'showInactive',
      type: 'checkbox',
      label: 'Show inactive',
    },
  ], [departments]);

  // Current filter values
  const filterValues: FilterValues = useMemo(() => ({
    departmentId: selectedDeptId,
    showInactive,
  }), [selectedDeptId, showInactive]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return selectedDeptId !== '' || showInactive;
  }, [selectedDeptId, showInactive]);

  // Handle filter changes from FilterToolbar
  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'departmentId') {
      setSelectedDeptId(value as string);
    } else if (id === 'showInactive') {
      setShowInactive(value as boolean);
    }
  }, []);

  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    setSelectedDeptId('');
    setShowInactive(false);
  }, []);

  const fetchCostCenters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.costCenters.list(
        { isActive: showInactive ? undefined : true, departmentId: selectedDeptId || undefined },
        { pageSize: 100 }
      );
      setCostCenters(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost centers');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, selectedDeptId]);

  useEffect(() => {
    fetchCostCenters();
  }, [fetchCostCenters]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = costCenters.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== costCenters.length) {
      const message = costCenters.length === 0
        ? 'No cost centers match the current filters'
        : costCenters.length === 1
          ? 'Showing 1 result'
          : `Showing ${costCenters.length} results`;
      announce(message, 'polite');
      previousCountRef.current = costCenters.length;
    }
  }, [costCenters.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchCostCenters();
  }, [fetchCostCenters]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDeactivate = async (cc: CostCenter, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate cost center "${cc.name}"?`)) return;
    try {
      await adminApi.costCenters.deactivate(cc.costCenterId);
      fetchCostCenters();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleCreateCostCenter = () => {
    navigate('/admin/cost-centers/new');
  };

  // Render skeleton loading state
  const renderSkeleton = () => (
    <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Loading cost centers">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Department</th>
            <th>Budget</th>
            <th>Spent</th>
            <th>Available</th>
            <th>Utilization</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonLg}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
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
      onClick={handleCreateCostCenter}
      aria-label="Add new cost center"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon} aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Add Cost Center
    </button>
  );

  return (
    <PageLayout
      title="Cost Centers"
      description="Manage budgets and cost allocation"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        filters={filterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <ErrorMessage
          title="Error Loading Cost Centers"
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
      ) : error ? null : costCenters.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
          title="No cost centers found"
          description={
            hasActiveFilters
              ? 'No cost centers match the current filters. Try adjusting your filter criteria.'
              : 'Create cost centers to track budgets and cost allocation.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Cost Center',
                  onClick: handleCreateCostCenter,
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
        <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Cost centers list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Budget</th>
                <th>Spent</th>
                <th>Available</th>
                <th>Utilization</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {costCenters.map((cc) => {
                const util = getCostCenterUtilization(cc);
                const utilizationClass = util > 90 ? styles.utilizationHigh : util > 75 ? styles.utilizationMedium : styles.utilizationLow;
                const departmentName =
                  cc.departmentName ??
                  departments.find((d) => d.departmentId === cc.departmentId)?.name ??
                  '-';
                return (
                  <tr
                    key={cc.costCenterId}
                    onClick={() => navigate(`/admin/cost-centers/${cc.costCenterId}`)}
                    className={styles.clickableRow}
                  >
                    <td className={styles.codeCell}>{cc.code}</td>
                    <td>{cc.name}</td>
                    <td>{departmentName}</td>
                    <td>{formatCurrency(cc.budgetAmount)}</td>
                    <td>{formatCurrency(cc.spentAmount)}</td>
                    <td>{formatCurrency(cc.availableAmount)}</td>
                    <td><span className={utilizationClass}>{util}%</span></td>
                    <td>
                      <StatusBadge
                        label={cc.isActive ? 'Active' : 'Inactive'}
                        variant={cc.isActive ? 'active' : 'inactive'}
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
                            navigate(`/admin/cost-centers/${cc.costCenterId}/edit`);
                          }}
                          title="Edit"
                          aria-label={`Edit ${cc.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {cc.isActive && (
                          <button
                            type="button"
                            className={`${styles.iconButton} ${styles.dangerButton}`}
                            onClick={(e) => handleDeactivate(cc, e)}
                            title="Deactivate"
                            aria-label={`Deactivate ${cc.name}`}
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

export default CostCentersPage;
