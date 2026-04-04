import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAnnounce } from '../../components/accessibility';
import { PageLayout } from '../../components/layout';
import {
  FilterToolbar,
  EmptyState,
  ErrorMessage,
  StatusBadge,
  Modal,
  type FilterConfig,
  type FilterValues,
} from '../../components/ui';
import { BREADCRUMB_CONFIGS, type BreadcrumbItem } from '../../types/layout';
import { adminApi } from '../../services/admin-api';
import { useToast } from '../../components/ui';
import { useEntityOptions } from '../../hooks/useEntityOptions';
import type { Stockroom, BinLocation, Room } from '../../types/admin';
import styles from './AdminPage.module.css';
import locationStyles from './LocationsPage.module.css';

/**
 * Unified Storage Management Page
 * Manages Stockrooms → Bin Locations in a single tree view
 * Reduces navigation from 2 pages to 1 with inline actions
 * Refactored to use PageLayout pattern (Task 9.12)
 */

type ModalMode = 'stockroom' | 'bin' | null;

interface ModalState {
  mode: ModalMode;
  isEdit: boolean;
  parentId?: string;
  editItem?: Stockroom | BinLocation;
}

export function StoragePage() {
  const { success, error: showError } = useToast();

  const [stockrooms, setStockrooms] = useState<Stockroom[]>([]);
  const [binsMap, setBinsMap] = useState<Record<string, BinLocation[]>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<ModalState>({ mode: null, isEdit: false });
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Storage
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_STORAGE;

  // Room options for stockroom form — fetch only active rooms
  const fetchRooms = useCallback(
    () => adminApi.rooms.list(undefined, { isActive: true }, { pageSize: 100 }),
    []
  );
  const roomLabelFn = useCallback((r: Room) => `${r.roomNumber} — ${r.name}`, []);
  const roomValueFn = useCallback((r: Room) => r.roomId, []);
  const { options: roomOptions, isLoading: roomsLoading } = useEntityOptions<Room>(
    fetchRooms,
    roomLabelFn,
    roomValueFn
  );

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
    return showInactive || searchQuery !== '';
  }, [showInactive, searchQuery]);

  // Handle filter changes from FilterToolbar
  const handleFilterChange = useCallback((id: string, value: FilterValues[string]) => {
    if (id === 'showInactive') {
      setShowInactive(value as boolean);
    }
  }, []);

  // Handle clearing all filters
  const handleClearFilters = useCallback(() => {
    setShowInactive(false);
    setSearchQuery('');
  }, []);

  const fetchStockrooms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.stockrooms.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined },
        { pageSize: 100 }
      );
      setStockrooms(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stockrooms');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery]);

  useEffect(() => {
    void fetchStockrooms();
  }, [fetchStockrooms]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = stockrooms.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== stockrooms.length) {
      const message = stockrooms.length === 0
        ? 'No stockrooms match the current filters'
        : stockrooms.length === 1
          ? 'Showing 1 stockroom'
          : `Showing ${stockrooms.length} stockrooms`;
      announce(message, 'polite');
      previousCountRef.current = stockrooms.length;
    }
  }, [stockrooms.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchStockrooms();
  }, [fetchStockrooms]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const loadBins = async (stockroomId: string) => {
    if (binsMap[stockroomId]) return;
    try {
      const response = await adminApi.binLocations.list(stockroomId, { isActive: showInactive ? undefined : true }, { pageSize: 100 });
      setBinsMap(prev => ({ ...prev, [stockroomId]: response.items }));
    } catch (err) {
      showError('Failed to load bin locations');
    }
  };

  const toggleStockroom = async (stockroomId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(stockroomId)) {
      newExpanded.delete(stockroomId);
    } else {
      newExpanded.add(stockroomId);
      await loadBins(stockroomId);
    }
    setExpanded(newExpanded);
  };

  const openModal = (mode: ModalMode, parentId?: string, editItem?: Stockroom | BinLocation) => {
    setModal({ mode, isEdit: !!editItem, parentId, editItem });
    // Convert editItem to string record for form data
    if (editItem) {
      const stringData: Record<string, string> = {};
      Object.entries(editItem).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          stringData[key] = String(value);
        }
      });
      setFormData(stringData);
    } else {
      setFormData({});
    }
    setFormErrors({});
  };

  const closeModal = () => {
    setModal({ mode: null, isEdit: false });
    setFormData({});
    setFormErrors({});
  };

  const handleSave = async () => {
    const errors: Record<string, string> = {};

    if (modal.mode === 'stockroom') {
      if (!formData.stockroomCode?.trim()) errors.stockroomCode = 'Code required';
      if (!formData.name?.trim()) errors.name = 'Name required';
    } else if (modal.mode === 'bin') {
      if (!formData.binCode?.trim()) errors.binCode = 'Bin code required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSaving(true);

      if (modal.mode === 'stockroom') {
        if (modal.isEdit && modal.editItem) {
          await adminApi.stockrooms.update((modal.editItem as Stockroom).stockroomId, {
            name: formData.name,
            description: formData.description,
            roomId: formData.roomId || undefined,
          });
          success('Stockroom updated');
          announce('Stockroom updated successfully', 'polite');
        } else {
          await adminApi.stockrooms.create({
            stockroomCode: formData.stockroomCode,
            name: formData.name,
            description: formData.description,
            stockroomType: (formData.stockroomType || 'STANDARD') as Stockroom['stockroomType'],
            roomId: formData.roomId || undefined,
          });
          success('Stockroom created');
          announce('Stockroom created successfully', 'polite');
        }
        void fetchStockrooms();
      } else if (modal.mode === 'bin' && modal.parentId) {
        const parentId = modal.parentId;
        if (modal.isEdit && modal.editItem) {
          await adminApi.binLocations.update((modal.editItem as BinLocation).binId, {
            description: formData.description,
            maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity, 10) : undefined,
          });
          success('Bin location updated');
          announce('Bin location updated successfully', 'polite');
        } else {
          await adminApi.binLocations.create({
            stockroomId: parentId,
            binCode: formData.binCode,
            aisle: formData.aisle,
            shelf: formData.shelf,
            position: formData.position,
            description: formData.description,
            maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity, 10) : undefined,
          });
          success('Bin location created');
          announce('Bin location created successfully', 'polite');
        }
        setBinsMap(prev => ({ ...prev, [parentId]: undefined as unknown as BinLocation[] }));
        await loadBins(parentId);
      }

      closeModal();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (type: 'stockroom' | 'bin', id: string, name: string) => {
    if (!window.confirm(`Deactivate "${name}"?`)) return;

    try {
      if (type === 'stockroom') {
        await adminApi.stockrooms.deactivate(id);
        void fetchStockrooms();
      } else if (type === 'bin') {
        await adminApi.binLocations.deactivate(id);
        const bin = Object.values(binsMap).flat().find(b => b.binId === id);
        if (bin) {
          setBinsMap(prev => ({ ...prev, [bin.stockroomId]: undefined as unknown as BinLocation[] }));
          await loadBins(bin.stockroomId);
        }
      }
      success(`${type === 'stockroom' ? 'Stockroom' : 'Bin location'} deactivated`);
      announce(`${type === 'stockroom' ? 'Stockroom' : 'Bin location'} deactivated successfully`, 'polite');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  // Get modal title based on mode
  const getModalTitle = (): string => {
    if (!modal.mode) return '';
    const titles: Record<NonNullable<ModalMode>, string> = {
      stockroom: modal.isEdit ? 'Edit Stockroom' : 'Add Stockroom',
      bin: modal.isEdit ? 'Edit Bin Location' : 'Add Bin Location',
    };
    return titles[modal.mode];
  };

  // Render modal content based on mode
  const renderModalContent = () => {
    if (modal.mode === 'stockroom') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Stockroom Code</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.stockroomCode ? styles.error : ''}`}
              value={formData.stockroomCode || ''}
              onChange={e => setFormData(prev => ({ ...prev, stockroomCode: e.target.value.toUpperCase() }))}
              disabled={modal.isEdit}
              placeholder="WH-001"
              aria-invalid={!!formErrors.stockroomCode}
              aria-describedby={formErrors.stockroomCode ? 'stockroomCode-error' : undefined}
            />
            {formErrors.stockroomCode && <span id="stockroomCode-error" className={styles.errorText}>{formErrors.stockroomCode}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Name</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`}
              value={formData.name || ''}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Main Warehouse"
              aria-invalid={!!formErrors.name}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
            />
            {formErrors.name && <span id="name-error" className={styles.errorText}>{formErrors.name}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Type</label>
            <select
              className={styles.formSelect}
              value={formData.stockroomType || 'STANDARD'}
              onChange={e => setFormData(prev => ({ ...prev, stockroomType: e.target.value }))}
            >
              <option value="STANDARD">Standard</option>
              <option value="MAIN">Main</option>
              <option value="SATELLITE">Satellite</option>
              <option value="VIRTUAL">Virtual</option>
              <option value="RECEIVING">Receiving</option>
              <option value="LOANER">Loaner</option>
              <option value="REPAIR">Repair</option>
              <option value="SPARE_PARTS">Spare Parts</option>
              <option value="QUARANTINE">Quarantine</option>
              <option value="DISPOSAL">Disposal</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Room</label>
            <select
              className={styles.formSelect}
              value={formData.roomId || ''}
              onChange={e => setFormData(prev => ({ ...prev, roomId: e.target.value }))}
              disabled={roomsLoading}
            >
              <option value="">{roomsLoading ? 'Loading rooms…' : '— None —'}</option>
              {roomOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={styles.formTextarea}
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
            />
          </div>
        </>
      );
    }

    if (modal.mode === 'bin') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Bin Code</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.binCode ? styles.error : ''}`}
              value={formData.binCode || ''}
              onChange={e => setFormData(prev => ({ ...prev, binCode: e.target.value.toUpperCase() }))}
              disabled={modal.isEdit}
              placeholder="A-01-01"
              aria-invalid={!!formErrors.binCode}
              aria-describedby={formErrors.binCode ? 'binCode-error' : undefined}
            />
            {formErrors.binCode && <span id="binCode-error" className={styles.errorText}>{formErrors.binCode}</span>}
          </div>
          <div className={styles.gridThreeCol}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Aisle</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.aisle || ''}
                onChange={e => setFormData(prev => ({ ...prev, aisle: e.target.value }))}
                placeholder="A"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Shelf</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.shelf || ''}
                onChange={e => setFormData(prev => ({ ...prev, shelf: e.target.value }))}
                placeholder="01"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Position</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.position || ''}
                onChange={e => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="01"
              />
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Max Quantity</label>
            <input
              type="number"
              className={styles.formInput}
              value={formData.maxQuantity || ''}
              onChange={e => setFormData(prev => ({ ...prev, maxQuantity: e.target.value }))}
              placeholder="100"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </>
      );
    }

    return null;
  };

  // Modal footer with action buttons
  const modalFooter = (
    <>
      <button type="button" className={styles.secondaryButton} onClick={closeModal} disabled={isSaving}>
        Cancel
      </button>
      <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </>
  );

  // Icon components with aria-hidden for decorative icons
  const ChevronIcon = ({ expanded: isExpanded }: { expanded: boolean }) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`${locationStyles.chevron} ${isExpanded ? locationStyles.expanded : ''}`}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );

  const AddIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const EditIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  const DeactivateIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );

  // Render skeleton loading state
  const renderSkeleton = () => (
    <div className={styles.tableContainer}>
      {[1, 2, 3].map(i => (
        <div key={i} className={locationStyles.skeletonRow}>
          <div className={`${styles.skeleton} ${styles.skeletonXl} ${styles.skeletonRow}`} />
        </div>
      ))}
    </div>
  );

  // Header action button for PageLayout
  const headerActions = (
    <button
      type="button"
      className={styles.primaryButton}
      onClick={() => openModal('stockroom')}
      aria-label="Add new stockroom"
    >
      <AddIcon /> Add Stockroom
    </button>
  );

  return (
    <PageLayout
      title="Storage"
      description="Manage stockrooms and bin locations"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search stockrooms...',
          value: searchQuery,
          onChange: setSearchQuery,
          onSubmit: fetchStockrooms,
        }}
        filters={filterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <ErrorMessage
          title="Error Loading Storage"
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
      ) : error ? null : stockrooms.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 21V8l9-5 9 5v13" />
              <rect x="6" y="12" width="4" height="9" />
              <rect x="14" y="12" width="4" height="9" />
            </svg>
          }
          title="No stockrooms found"
          description={
            hasActiveFilters
              ? 'No stockrooms match the current filters. Try adjusting your filter criteria.'
              : 'Add your first stockroom to get started managing storage.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Stockroom',
                  onClick: () => openModal('stockroom'),
                  icon: <AddIcon />,
                }
          }
        />
      ) : (
        <div className={locationStyles.tree} role="tree" aria-label="Storage hierarchy">
          {stockrooms.map(stockroom => (
            <div key={stockroom.stockroomId} className={locationStyles.treeNode} role="treeitem" aria-expanded={expanded.has(stockroom.stockroomId)}>
              <div className={locationStyles.nodeRow}>
                <button
                  type="button"
                  className={locationStyles.expandButton}
                  onClick={() => toggleStockroom(stockroom.stockroomId)}
                  aria-label={expanded.has(stockroom.stockroomId) ? `Collapse ${stockroom.name}` : `Expand ${stockroom.name}`}
                >
                  <ChevronIcon expanded={expanded.has(stockroom.stockroomId)} />
                </button>
                <span className={locationStyles.nodeIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 21V8l9-5 9 5v13" />
                    <rect x="6" y="12" width="4" height="9" />
                    <rect x="14" y="12" width="4" height="9" />
                  </svg>
                </span>
                <span className={locationStyles.nodeLabel}>
                  <strong>{stockroom.stockroomCode}</strong> — {stockroom.name}
                </span>
                <span className={locationStyles.nodeType}>{stockroom.stockroomType.replace('_', ' ')}</span>
                <span className={locationStyles.nodeCount}>{stockroom.totalBins ?? stockroom.binCount} bins</span>
                {!stockroom.isActive && (
                  <StatusBadge label="Inactive" variant="inactive" size="sm" />
                )}
                <div className={locationStyles.nodeActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openModal('bin', stockroom.stockroomId)}
                    aria-label={`Add bin location to ${stockroom.name}`}
                  >
                    <AddIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openModal('stockroom', undefined, stockroom)}
                    aria-label={`Edit ${stockroom.name}`}
                  >
                    <EditIcon />
                  </button>
                  {stockroom.isActive && (
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerButton}`}
                      onClick={() => handleDeactivate('stockroom', stockroom.stockroomId, stockroom.name)}
                      aria-label={`Deactivate ${stockroom.name}`}
                    >
                      <DeactivateIcon />
                    </button>
                  )}
                </div>
              </div>

              {expanded.has(stockroom.stockroomId) && (
                <div className={locationStyles.children} role="group">
                  {(binsMap[stockroom.stockroomId] || []).map(bin => (
                    <div key={bin.binId} className={locationStyles.treeNode} role="treeitem">
                      <div className={locationStyles.nodeRow}>
                        <span className={locationStyles.expandPlaceholder} />
                        <span className={locationStyles.nodeIcon}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                          </svg>
                        </span>
                        <span className={locationStyles.nodeLabel}>
                          <strong>{bin.binCode}</strong>
                          {bin.description && ` — ${bin.description}`}
                        </span>
                        {bin.aisle && (
                          <span className={locationStyles.nodeDetail}>
                            {[bin.aisle, bin.shelf, bin.position].filter(Boolean).join('-')}
                          </span>
                        )}
                        <span className={locationStyles.nodeCount}>
                          {bin.currentQuantity ?? bin.currentCount}/{bin.maxQuantity ?? bin.capacity ?? '∞'}
                        </span>
                        {!bin.isActive && (
                          <StatusBadge label="Inactive" variant="inactive" size="sm" />
                        )}
                        <div className={locationStyles.nodeActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => openModal('bin', stockroom.stockroomId, bin)}
                            aria-label={`Edit bin ${bin.binCode}`}
                          >
                            <EditIcon />
                          </button>
                          {bin.isActive && (
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.dangerButton}`}
                              onClick={() => handleDeactivate('bin', bin.binId, bin.binCode)}
                              aria-label={`Deactivate bin ${bin.binCode}`}
                            >
                              <DeactivateIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(binsMap[stockroom.stockroomId] || []).length === 0 && (
                    <div className={locationStyles.emptyChildren}>
                      No bin locations — <button type="button" className={styles.linkButton} onClick={() => openModal('bin', stockroom.stockroomId)} aria-label={`Add bin location to ${stockroom.name}`}>Add one</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal using the shared Modal component */}
      <Modal
        isOpen={modal.mode !== null}
        onClose={closeModal}
        title={getModalTitle()}
        footer={modalFooter}
        size="md"
      >
        {renderModalContent()}
      </Modal>
    </PageLayout>
  );
}

export default StoragePage;
