import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import type { Department } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Departments Administration Page
 * Implements Task 16.3.1: Create DepartmentsPage.tsx with hierarchical view
 * Refactored to use PageLayout pattern (Task 9.4)
 */
export function DepartmentsPage() {
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Departments
  const breadcrumbs: BreadcrumbItem[] = [
    ...BREADCRUMB_CONFIGS.ADMIN,
    { label: 'Departments' }
  ];

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

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setShowInactive(false);
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.departments.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined },
        { pageSize: 100 }
      );
      setDepartments(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery]);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = departments.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== departments.length) {
      const message = departments.length === 0
        ? 'No departments match the current filters'
        : departments.length === 1
          ? 'Showing 1 result'
          : `Showing ${departments.length} results`;
      announce(message, 'polite');
      previousCountRef.current = departments.length;
    }
  }, [departments.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchDepartments();
  }, [fetchDepartments]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDeactivate = async (dept: Department, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate department "${dept.name}"? This will also affect child departments.`)) return;
    try {
      await adminApi.departments.deactivate(dept.departmentId);
      void fetchDepartments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate department');
    }
  };

  const handleCreateDepartment = () => {
    navigate('/admin/departments/new');
  };

  // Build hierarchical structure - preserves parent-child relationships
  const buildHierarchy = (depts: Department[]): Department[] => {
    const map = new Map<string, Department>();
    const roots: Department[] = [];

    depts.forEach(d => map.set(d.departmentId, { ...d, childDepartments: [] }));

    depts.forEach(d => {
      const dept = map.get(d.departmentId);
      if (!dept) return;

      if (d.parentDepartmentId) {
        const parent = map.get(d.parentDepartmentId);
        if (!parent) {
          roots.push(dept);
          return;
        }
        parent.childDepartments = parent.childDepartments || [];
        parent.childDepartments.push(dept);
      } else {
        roots.push(dept);
      }
    });

    return roots;
  };

  // Render department row with hierarchical indentation
  const renderDepartment = (dept: Department, level: number = 0): React.ReactNode => {
    const indentStyle = { paddingLeft: `${level * 24 + 12}px` };
    return (
      <React.Fragment key={dept.departmentId}>
        <tr
          onClick={() => navigate(`/admin/departments/${dept.departmentId}`)}
          className={styles.clickableRow}
        >
          <td className={styles.codeCell} style={indentStyle}>
            {level > 0 && <span className={styles.hierarchyBranch} aria-hidden="true">└</span>}
            {dept.code}
          </td>
          <td>{dept.name}</td>
          <td>{dept.parentDepartmentName || '-'}</td>
          <td>
            <StatusBadge
              label={dept.isActive ? 'Active' : 'Inactive'}
              variant={dept.isActive ? 'active' : 'inactive'}
              size="sm"
            />
          </td>
          <td>
            <div className={styles.actionButtons}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/departments/${dept.departmentId}/edit`); }}
                title="Edit"
                aria-label={`Edit ${dept.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              {dept.isActive && (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.dangerButton}`}
                  onClick={(e) => handleDeactivate(dept, e)}
                  title="Deactivate"
                  aria-label={`Deactivate ${dept.name}`}
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
        {dept.childDepartments?.map(child => renderDepartment(child, level + 1))}
      </React.Fragment>
    );
  };

  const hierarchicalDepts = buildHierarchy(departments);

  // Render skeleton loading state
  const renderSkeleton = () => (
    <ResponsiveTable minWidth="700px" showScrollIndicator aria-label="Loading departments">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Parent</th>
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
      onClick={handleCreateDepartment}
      aria-label="Add new department"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon} aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Add Department
    </button>
  );

  return (
    <PageLayout
      title="Departments"
      description="Manage organizational departments"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search departments...',
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
          title="Error Loading Departments"
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
      ) : error ? null : departments.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="No departments found"
          description={
            hasActiveFilters
              ? 'No departments match the current filters. Try adjusting your filter criteria.'
              : 'Create departments to organize your organization.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Department',
                  onClick: handleCreateDepartment,
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
        <ResponsiveTable minWidth="700px" showScrollIndicator aria-label="Departments list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Parent</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{hierarchicalDepts.map(dept => renderDepartment(dept))}</tbody>
          </table>
        </ResponsiveTable>
      )}
    </PageLayout>
  );
}

export default DepartmentsPage;
