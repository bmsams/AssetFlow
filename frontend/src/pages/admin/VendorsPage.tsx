import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnounce } from '../../components/accessibility';
import { PageLayout } from '../../components/layout';
import { FilterToolbar, EmptyState, ErrorMessage, ResponsiveTable, StatusBadge, type FilterConfig, type FilterValues } from '../../components/ui';
import { BREADCRUMB_CONFIGS, type BreadcrumbItem } from '../../types/layout';
import { adminApi } from '../../services/admin-api';
import type { Vendor, VendorType } from '../../types/admin';
import { getVendorTypeLabel, getVendorRatingBadgeColors } from '../../types/admin';
import styles from './AdminPage.module.css';

/**
 * Vendors Administration Page
 * Implements Task 16.3.5: Create VendorsPage.tsx with search and filters
 * Refactored to use PageLayout component for consistent UI structure
 */
export function VendorsPage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  const fetchVendors = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRetrying(false);
      setError(null);
      const response = await adminApi.vendors.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined, vendorType: vendorTypeFilter || undefined },
        { pageSize: 100 }
      );
      setVendors(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setIsLoading(false);
    }
  }, [showInactive, searchQuery, vendorTypeFilter]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchVendors();
  }, [fetchVendors]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = vendors.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== vendors.length) {
      const message = vendors.length === 0
        ? 'No vendors match the current filters'
        : vendors.length === 1
          ? 'Showing 1 result'
          : `Showing ${vendors.length} results`;
      announce(message, 'polite');
      previousCountRef.current = vendors.length;
    }
  }, [vendors.length, isLoading, announce]);

  const handleDeactivate = async (vendor: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deactivate vendor "${vendor.vendorName}"?`)) return;
    try {
      await adminApi.vendors.deactivate(vendor.vendorId);
      fetchVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const vendorTypes: VendorType[] = ['MANUFACTURER', 'RESELLER', 'DISTRIBUTOR', 'SERVICE_PROVIDER', 'CONSULTANT', 'CONTRACTOR', 'LESSOR', 'OTHER'];

  // Filter configurations for FilterToolbar
  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      id: 'vendorType',
      type: 'select',
      label: 'Type',
      placeholder: 'All Types',
      options: vendorTypes.map(t => ({
        value: t,
        label: getVendorTypeLabel(t),
      })),
    },
    {
      id: 'showInactive',
      type: 'checkbox',
      label: 'Show inactive',
    },
  ], []);

  // Current filter values for FilterToolbar
  const filterValues: FilterValues = useMemo(() => ({
    vendorType: vendorTypeFilter,
    showInactive: showInactive,
  }), [vendorTypeFilter, showInactive]);

  // Handle filter changes from FilterToolbar
  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'vendorType') {
      setVendorTypeFilter(value as string);
    } else if (id === 'showInactive') {
      setShowInactive(value as boolean);
    }
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || vendorTypeFilter !== '' || showInactive;
  }, [searchQuery, vendorTypeFilter, showInactive]);

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setVendorTypeFilter('');
    setShowInactive(false);
  }, []);

  // Breadcrumbs for admin section with Vendors as current page
  const breadcrumbs: BreadcrumbItem[] = [
    ...BREADCRUMB_CONFIGS.ADMIN,
    { label: 'Vendors' }
  ];

  // Header action button for adding new vendor
  const headerActions = (
    <button 
      type="button" 
      className={styles.primaryButton} 
      onClick={() => navigate('/admin/vendors/new')}
      aria-label="Add new vendor"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Add Vendor
    </button>
  );

  return (
    <PageLayout
      title="Vendors"
      description="Manage suppliers and service providers"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
    >

      <FilterToolbar
        search={{
          placeholder: 'Search vendors...',
          value: searchQuery,
          onChange: setSearchQuery,
        }}
        filters={filterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
      />

      {error && (
        <ErrorMessage
          title="Failed to load vendors"
          message={error}
          type="error"
          variant="inline"
          recoveryOptions={[
            {
              label: 'Retry',
              action: handleRetry,
              isLoading: isRetrying,
            },
          ]}
        />
      )}

      {isLoading ? (
        <ResponsiveTable
          minWidth="900px"
          showScrollIndicator={true}
          aria-label="Vendors table loading"
        >
          <table className={styles.table}>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Contact</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3].map(i => <tr key={i}><td colSpan={7}><div className={`${styles.skeleton} ${styles.skeletonFull} ${styles.skeletonRow}`}/></td></tr>)}</tbody>
          </table>
        </ResponsiveTable>
      ) : error ? null : vendors.length === 0 ? (
        <EmptyState
          variant={hasActiveFilters ? 'filtered' : 'default'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
              <path d="M9 9v.01" />
              <path d="M9 12v.01" />
              <path d="M9 15v.01" />
              <path d="M9 18v.01" />
            </svg>
          }
          title={hasActiveFilters ? 'No vendors match your filters' : 'No vendors found'}
          description={
            hasActiveFilters
              ? 'Try adjusting your search or filter criteria to find vendors.'
              : 'Get started by adding your first vendor to manage suppliers and service providers.'
          }
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : { 
                  label: 'Add Vendor', 
                  onClick: () => navigate('/admin/vendors/new'),
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )
                }
          }
          secondaryAction={
            hasActiveFilters
              ? undefined
              : undefined
          }
        />
      ) : (
        <ResponsiveTable
          minWidth="900px"
          showScrollIndicator={true}
          aria-label="Vendors table"
        >
          <table className={styles.table}>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Contact</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {vendors.map(v => {
                const ratingInfo = getVendorRatingBadgeColors(v.rating);
                return (
                  <tr key={v.vendorId} onClick={() => navigate(`/admin/vendors/${v.vendorId}`)} className={styles.clickableRow}>
                    <td className={styles.codeCell}>{v.vendorCode || '-'}</td>
                    <td>{v.vendorName}</td>
                    <td>{v.vendorType ? getVendorTypeLabel(v.vendorType) : '-'}</td>
                    <td>{v.contactEmail || v.contactPhone || '-'}</td>
                    <td>
                      <StatusBadge 
                        label={ratingInfo.label} 
                        colors={{ background: ratingInfo.background, text: ratingInfo.text }}
                        size="sm"
                      />
                    </td>
                    <td><span className={`${styles.statusBadge} ${v.isActive ? styles.statusActive : styles.statusInactive}`}>{v.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className={styles.actionButtons}>
                        <button type="button" className={styles.iconButton} onClick={(e) => {e.stopPropagation(); navigate(`/admin/vendors/${v.vendorId}`);}} title="Edit" aria-label={`Edit ${v.vendorName}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        {v.isActive && <button type="button" className={`${styles.iconButton} ${styles.dangerButton}`} onClick={(e) => handleDeactivate(v, e)} title="Deactivate" aria-label={`Deactivate ${v.vendorName}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>}
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

export default VendorsPage;
