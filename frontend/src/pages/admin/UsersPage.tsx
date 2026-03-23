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
import type { UserDetails, Department } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Users Administration Page
 * Implements Task 16.4.1: Create UsersPage.tsx with list and filters
 * Refactored to use PageLayout pattern (Task 9.8)
 */
export function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserDetails[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Users
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_USERS;

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
    return searchQuery !== '' || selectedDeptId !== '' || showInactive;
  }, [searchQuery, selectedDeptId, showInactive]);

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
    setSearchQuery('');
    setSelectedDeptId('');
    setShowInactive(false);
  }, []);

  // Handle search input change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.users.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined, departmentId: selectedDeptId || undefined },
        { pageSize: 100 }
      );
      setUsers(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery, selectedDeptId]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = users.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== users.length) {
      const message = users.length === 0
        ? 'No users match the current filters'
        : users.length === 1
          ? 'Showing 1 result'
          : `Showing ${users.length} results`;
      announce(message, 'polite');
      previousCountRef.current = users.length;
    }
  }, [users.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchUsers();
  }, [fetchUsers]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleDeactivate = async (user: UserDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate user "${user.email}"?`)) return;
    try {
      await adminApi.users.deactivate(user.userId);
      void fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const handleReactivate = async (user: UserDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await adminApi.users.reactivate(user.userId);
      void fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate');
    }
  };

  // Render skeleton loading state
  const renderSkeleton = () => (
    <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Loading users">
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Department</th>
            <th>Manager</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3].map((i) => (
            <tr key={i}>
              <td><div className={`${styles.skeleton} ${styles.skeletonLg}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonSm}`} /></td>
              <td><div className={`${styles.skeleton} ${styles.skeletonMd}`} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );

  // Header action button for PageLayout - Users are created through auth system, so no Add button
  const headerActions = null;

  return (
    <PageLayout
      title="Users"
      description="Manage user accounts and roles"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search users...',
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
          title="Error Loading Users"
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
      ) : error ? null : users.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="No users found"
          description={
            hasActiveFilters
              ? 'No users match the current filters. Try adjusting your search or filter criteria.'
              : 'Users are created through the authentication system.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : undefined
          }
        />
      ) : (
        <ResponsiveTable minWidth="900px" showScrollIndicator aria-label="Users list">
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.userId}
                  onClick={() => navigate(`/admin/users/${u.userId}`)}
                  className={styles.clickableRow}
                >
                  <td>{u.email}</td>
                  <td>{u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.firstName || u.lastName || '-'}</td>
                  <td>{u.departmentName || '-'}</td>
                  <td>{u.managerName || '-'}</td>
                  <td>{u.roles.length > 0 ? u.roles.join(', ') : '-'}</td>
                  <td>
                    <StatusBadge
                      label={u.isActive ? 'Active' : 'Inactive'}
                      variant={u.isActive ? 'active' : 'inactive'}
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
                          navigate(`/admin/users/${u.userId}/edit`);
                        }}
                        title="Edit"
                        aria-label={`Edit ${u.email}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {u.isActive ? (
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.dangerButton}`}
                          onClick={(e) => handleDeactivate(u, e)}
                          title="Deactivate"
                          aria-label={`Deactivate ${u.email}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`${styles.iconButton} ${styles.reactivateButton}`}
                          onClick={(e) => handleReactivate(u, e)}
                          title="Reactivate"
                          aria-label={`Reactivate ${u.email}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
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

export default UsersPage;
