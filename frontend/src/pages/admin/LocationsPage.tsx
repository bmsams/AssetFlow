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
import type { Building, Floor, Room, Rack } from '../../types/admin';
import styles from './AdminPage.module.css';
import locationStyles from './LocationsPage.module.css';
import { useTour, type TourStep } from '@ams/ui/tour';

/**
 * Unified Locations Management Page
 * Manages Buildings → Floors → Rooms → Racks in a single tree view
 * Reduces navigation from 4 pages to 1 with inline actions
 * Refactored to use PageLayout pattern (Task 9.11)
 */

interface ExpandedState {
  buildings: Set<string>;
  floors: Set<string>;
  rooms: Set<string>;
}

type ModalMode = 'building' | 'floor' | 'room' | 'rack' | null;

interface ModalState {
  mode: ModalMode;
  isEdit: boolean;
  parentId?: string;
  editItem?: Building | Floor | Room | Rack;
}

export function LocationsPage() {
  // Tour definitions
  const locationsSteps: TourStep[] = [
    { target: '[data-tour="location-list"]', title: 'Locations', content: "Manage your organization's physical locations." },
    { target: '[data-tour="add-location"]', title: 'Add Location', content: 'Create a new location for asset tracking.' },
  ];
  useTour('admin-locations', locationsSteps);

  const { success, error: showError } = useToast();

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floorsMap, setFloorsMap] = useState<Record<string, Floor[]>>({});
  const [roomsMap, setRoomsMap] = useState<Record<string, Room[]>>({});
  const [racksMap, setRacksMap] = useState<Record<string, Rack[]>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [expanded, setExpanded] = useState<ExpandedState>({
    buildings: new Set(),
    floors: new Set(),
    rooms: new Set(),
  });

  const [modal, setModal] = useState<ModalState>({ mode: null, isEdit: false });
  const [isSaving, setIsSaving] = useState(false);

  // Form state for quick add/edit
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Accessibility: announce filter results to screen readers
  const { announce } = useAnnounce();
  const previousCountRef = useRef<number | null>(null);
  const isInitialLoadRef = useRef(true);

  // Breadcrumbs for admin > Locations
  const breadcrumbs: BreadcrumbItem[] = BREADCRUMB_CONFIGS.ADMIN_LOCATIONS;

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

  const fetchBuildings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await adminApi.buildings.list(
        { isActive: showInactive ? undefined : true, search: searchQuery || undefined },
        { pageSize: 100 }
      );
      setBuildings(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buildings');
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [showInactive, searchQuery]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  // Announce filter results to screen readers when count changes
  useEffect(() => {
    // Skip announcement on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      previousCountRef.current = buildings.length;
      return;
    }

    // Only announce when the count actually changes and not during loading
    if (!isLoading && previousCountRef.current !== buildings.length) {
      const message = buildings.length === 0
        ? 'No locations match the current filters'
        : buildings.length === 1
          ? 'Showing 1 building'
          : `Showing ${buildings.length} buildings`;
      announce(message, 'polite');
      previousCountRef.current = buildings.length;
    }
  }, [buildings.length, isLoading, announce]);

  // Handle retry with loading state - preserves user filters
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchBuildings();
  }, [fetchBuildings]);

  // Handle dismissing the error banner
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const removeMapKey = <T,>(map: Record<string, T>, key: string): Record<string, T> => {
    const { [key]: _removed, ...rest } = map;
    return rest;
  };

  const loadFloors = async (buildingId: string, force = false) => {
    if (!force && floorsMap[buildingId]) return;
    try {
      const response = await adminApi.floors.list(buildingId, { isActive: showInactive ? undefined : true }, { pageSize: 100 });
      setFloorsMap(prev => ({ ...prev, [buildingId]: response.items }));
    } catch (err) {
      showError('Failed to load floors');
    }
  };

  const loadRooms = async (floorId: string, force = false) => {
    if (!force && roomsMap[floorId]) return;
    try {
      const response = await adminApi.rooms.list(floorId, { isActive: showInactive ? undefined : true }, { pageSize: 100 });
      setRoomsMap(prev => ({ ...prev, [floorId]: response.items }));
    } catch (err) {
      showError('Failed to load rooms');
    }
  };

  const loadRacks = async (roomId: string, force = false) => {
    if (!force && racksMap[roomId]) return;
    try {
      const response = await adminApi.racks.list(roomId, { isActive: showInactive ? undefined : true }, { pageSize: 100 });
      setRacksMap(prev => ({ ...prev, [roomId]: response.items }));
    } catch (err) {
      showError('Failed to load racks');
    }
  };

  const toggleBuilding = async (buildingId: string) => {
    const newExpanded = new Set(expanded.buildings);
    if (newExpanded.has(buildingId)) {
      newExpanded.delete(buildingId);
    } else {
      newExpanded.add(buildingId);
      await loadFloors(buildingId);
    }
    setExpanded(prev => ({ ...prev, buildings: newExpanded }));
  };

  const toggleFloor = async (floorId: string) => {
    const newExpanded = new Set(expanded.floors);
    if (newExpanded.has(floorId)) {
      newExpanded.delete(floorId);
    } else {
      newExpanded.add(floorId);
      await loadRooms(floorId);
    }
    setExpanded(prev => ({ ...prev, floors: newExpanded }));
  };

  const toggleRoom = async (roomId: string) => {
    const newExpanded = new Set(expanded.rooms);
    if (newExpanded.has(roomId)) {
      newExpanded.delete(roomId);
    } else {
      newExpanded.add(roomId);
      await loadRacks(roomId);
    }
    setExpanded(prev => ({ ...prev, rooms: newExpanded }));
  };

  const openModal = (mode: ModalMode, parentId?: string, editItem?: Building | Floor | Room | Rack) => {
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

    if (modal.mode === 'building') {
      if (!formData.buildingCode?.trim()) errors.buildingCode = 'Code required';
      if (!formData.name?.trim()) errors.name = 'Name required';
    } else if (modal.mode === 'floor') {
      if (!formData.floorNumber?.trim()) errors.floorNumber = 'Floor number required';
      if (!formData.name?.trim()) errors.name = 'Name required';
    } else if (modal.mode === 'room') {
      if (!formData.roomNumber?.trim()) errors.roomNumber = 'Room number required';
      if (!formData.name?.trim()) errors.name = 'Name required';
    } else if (modal.mode === 'rack') {
      if (!formData.rackName?.trim()) errors.rackName = 'Rack name required';
      if (!formData.totalUnits?.trim()) errors.totalUnits = 'Total units required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSaving(true);

      if (modal.mode === 'building') {
        if (modal.isEdit && modal.editItem) {
          await adminApi.buildings.update((modal.editItem as Building).buildingId, {
            name: formData.name,
            addressLine1: formData.addressLine1,
            city: formData.city,
            stateProvince: formData.stateProvince,
          });
          success('Building updated');
          announce('Building updated successfully', 'polite');
        } else {
          await adminApi.buildings.create({
            buildingCode: formData.buildingCode,
            name: formData.name,
            addressLine1: formData.addressLine1,
            city: formData.city,
            stateProvince: formData.stateProvince,
          });
          success('Building created');
          announce('Building created successfully', 'polite');
        }
        fetchBuildings();
      } else if (modal.mode === 'floor' && modal.parentId) {
        if (modal.isEdit && modal.editItem) {
          await adminApi.floors.update((modal.editItem as Floor).floorId, {
            name: formData.name,
            description: formData.description,
          });
          success('Floor updated');
          announce('Floor updated successfully', 'polite');
        } else {
          await adminApi.floors.create({
            buildingId: modal.parentId,
            floorNumber: parseInt(formData.floorNumber, 10),
            name: formData.name,
            description: formData.description,
          });
          success('Floor created');
          announce('Floor created successfully', 'polite');
        }
        setFloorsMap(prev => removeMapKey(prev, modal.parentId!));
        await loadFloors(modal.parentId, true);
      } else if (modal.mode === 'room' && modal.parentId) {
        if (modal.isEdit && modal.editItem) {
          await adminApi.rooms.update((modal.editItem as Room).roomId, {
            name: formData.name,
            roomType: formData.roomType as Room['roomType'],
          });
          success('Room updated');
          announce('Room updated successfully', 'polite');
        } else {
          await adminApi.rooms.create({
            floorId: modal.parentId,
            roomNumber: formData.roomNumber,
            name: formData.name,
            roomType: (formData.roomType || 'OFFICE') as Room['roomType'],
          });
          success('Room created');
          announce('Room created successfully', 'polite');
        }
        setRoomsMap(prev => removeMapKey(prev, modal.parentId!));
        await loadRooms(modal.parentId, true);
      } else if (modal.mode === 'rack' && modal.parentId) {
        if (modal.isEdit && modal.editItem) {
          await adminApi.racks.update((modal.editItem as Rack).rackId, {
            totalUnits: parseInt(formData.totalUnits, 10),
            description: formData.description,
          });
          success('Rack updated');
          announce('Rack updated successfully', 'polite');
        } else {
          await adminApi.racks.create({
            roomId: modal.parentId,
            rackName: formData.rackName,
            totalUnits: parseInt(formData.totalUnits, 10),
            description: formData.description,
          });
          success('Rack created');
          announce('Rack created successfully', 'polite');
        }
        setRacksMap(prev => removeMapKey(prev, modal.parentId!));
        await loadRacks(modal.parentId, true);
      }

      closeModal();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (type: 'building' | 'floor' | 'room' | 'rack', id: string, name: string) => {
    if (!window.confirm(`Deactivate "${name}"?`)) return;

    try {
      if (type === 'building') {
        await adminApi.buildings.deactivate(id);
        fetchBuildings();
      } else if (type === 'floor') {
        await adminApi.floors.deactivate(id);
        // Refresh parent building's floors
        const floor = Object.values(floorsMap).flat().find(f => f.floorId === id);
        if (floor) {
          setFloorsMap(prev => removeMapKey(prev, floor.buildingId));
          await loadFloors(floor.buildingId, true);
        }
      } else if (type === 'room') {
        await adminApi.rooms.deactivate(id);
        const room = Object.values(roomsMap).flat().find(r => r.roomId === id);
        if (room) {
          setRoomsMap(prev => removeMapKey(prev, room.floorId));
          await loadRooms(room.floorId, true);
        }
      } else if (type === 'rack') {
        await adminApi.racks.deactivate(id);
        const rack = Object.values(racksMap).flat().find(r => r.rackId === id);
        if (rack) {
          setRacksMap(prev => removeMapKey(prev, rack.roomId));
          await loadRacks(rack.roomId, true);
        }
      }
      success(`${type.charAt(0).toUpperCase() + type.slice(1)} deactivated`);
      announce(`${type.charAt(0).toUpperCase() + type.slice(1)} deactivated successfully`, 'polite');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  // Get modal title based on mode
  const getModalTitle = (): string => {
    if (!modal.mode) return '';
    const titles: Record<NonNullable<ModalMode>, string> = {
      building: modal.isEdit ? 'Edit Building' : 'Add Building',
      floor: modal.isEdit ? 'Edit Floor' : 'Add Floor',
      room: modal.isEdit ? 'Edit Room' : 'Add Room',
      rack: modal.isEdit ? 'Edit Rack' : 'Add Rack',
    };
    return titles[modal.mode];
  };

  // Render modal content based on mode
  const renderModalContent = () => {
    if (modal.mode === 'building') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Code</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.buildingCode ? styles.error : ''}`}
              value={formData.buildingCode || ''}
              onChange={e => setFormData(prev => ({ ...prev, buildingCode: e.target.value.toUpperCase() }))}
              disabled={modal.isEdit}
              placeholder="HQ-001"
              aria-invalid={!!formErrors.buildingCode}
              aria-describedby={formErrors.buildingCode ? 'buildingCode-error' : undefined}
            />
            {formErrors.buildingCode && <span id="buildingCode-error" className={styles.errorText}>{formErrors.buildingCode}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Name</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`}
              value={formData.name || ''}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Headquarters"
              aria-invalid={!!formErrors.name}
              aria-describedby={formErrors.name ? 'name-error' : undefined}
            />
            {formErrors.name && <span id="name-error" className={styles.errorText}>{formErrors.name}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Address</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.addressLine1 || ''}
              onChange={e => setFormData(prev => ({ ...prev, addressLine1: e.target.value }))}
              placeholder="123 Main St"
            />
          </div>
          <div className={styles.gridTwoCol}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>City</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.city || ''}
                onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>State</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.stateProvince || ''}
                onChange={e => setFormData(prev => ({ ...prev, stateProvince: e.target.value }))}
              />
            </div>
          </div>
        </>
      );
    }

    if (modal.mode === 'floor') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Floor Number</label>
            <input
              type="number"
              className={`${styles.formInput} ${formErrors.floorNumber ? styles.error : ''}`}
              value={formData.floorNumber || ''}
              onChange={e => setFormData(prev => ({ ...prev, floorNumber: e.target.value }))}
              disabled={modal.isEdit}
              placeholder="1"
              aria-invalid={!!formErrors.floorNumber}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Name</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`}
              value={formData.name || ''}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="First Floor"
              aria-invalid={!!formErrors.name}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Main lobby and reception"
            />
          </div>
        </>
      );
    }

    if (modal.mode === 'room') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Room Number</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.roomNumber ? styles.error : ''}`}
              value={formData.roomNumber || ''}
              onChange={e => setFormData(prev => ({ ...prev, roomNumber: e.target.value }))}
              disabled={modal.isEdit}
              placeholder="101"
              aria-invalid={!!formErrors.roomNumber}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Name</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.name ? styles.error : ''}`}
              value={formData.name || ''}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Server Room A"
              aria-invalid={!!formErrors.name}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Type</label>
            <select
              className={styles.formSelect}
              value={formData.roomType || 'OFFICE'}
              onChange={e => setFormData(prev => ({ ...prev, roomType: e.target.value }))}
            >
              <option value="OFFICE">Office</option>
              <option value="DATA_CENTER">Data Center</option>
              <option value="SERVER_ROOM">Server Room</option>
              <option value="STORAGE">Storage</option>
              <option value="LAB">Lab</option>
              <option value="CONFERENCE">Conference</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </>
      );
    }

    if (modal.mode === 'rack') {
      return (
        <>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Rack Name</label>
            <input
              type="text"
              className={`${styles.formInput} ${formErrors.rackName ? styles.error : ''}`}
              value={formData.rackName || ''}
              onChange={e => setFormData(prev => ({ ...prev, rackName: e.target.value }))}
              disabled={modal.isEdit}
              placeholder="Rack A01"
              aria-invalid={!!formErrors.rackName}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={`${styles.formLabel} ${styles.required}`}>Total Units (U)</label>
            <input
              type="number"
              className={`${styles.formInput} ${formErrors.totalUnits ? styles.error : ''}`}
              value={formData.totalUnits || ''}
              onChange={e => setFormData(prev => ({ ...prev, totalUnits: e.target.value }))}
              placeholder="42"
              aria-invalid={!!formErrors.totalUnits}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.description || ''}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Main server rack"
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
      onClick={() => openModal('building')}
      aria-label="Add new building"
      data-tour="add-location"
    >
      <AddIcon /> Add Building
    </button>
  );

  return (
    <PageLayout
      title="Locations"
      description="Manage buildings, floors, rooms, and racks"
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      className={styles.adminPage}
    >
      <FilterToolbar
        search={{
          placeholder: 'Search locations...',
          value: searchQuery,
          onChange: setSearchQuery,
          onSubmit: fetchBuildings,
        }}
        filters={filterConfigs}
        filterValues={filterValues}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {error && (
        <ErrorMessage
          title="Error Loading Locations"
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
      ) : error ? null : buildings.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 21h18" />
              <path d="M5 21V7l8-4v18" />
              <path d="M19 21V11l-6-4" />
            </svg>
          }
          title="No locations found"
          description={
            hasActiveFilters
              ? 'No locations match the current filters. Try adjusting your filter criteria.'
              : 'Add your first building to get started managing locations.'
          }
          variant={hasActiveFilters ? 'filtered' : 'default'}
          primaryAction={
            hasActiveFilters
              ? { label: 'Clear Filters', onClick: handleClearFilters }
              : {
                  label: 'Add Building',
                  onClick: () => openModal('building'),
                  icon: <AddIcon />,
                }
          }
        />
      ) : (
        <div className={locationStyles.tree} role="tree" aria-label="Location hierarchy" data-tour="location-list">
          {buildings.map(building => (
            <div key={building.buildingId} className={locationStyles.treeNode} role="treeitem" aria-expanded={expanded.buildings.has(building.buildingId)}>
              {/* Building Row */}
              <div className={locationStyles.nodeRow}>
                <button
                  type="button"
                  className={locationStyles.expandButton}
                  onClick={() => toggleBuilding(building.buildingId)}
                  aria-label={expanded.buildings.has(building.buildingId) ? `Collapse ${building.name}` : `Expand ${building.name}`}
                >
                  <ChevronIcon expanded={expanded.buildings.has(building.buildingId)} />
                </button>
                <span className={locationStyles.nodeIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
                  </svg>
                </span>
                <span className={locationStyles.nodeLabel}>
                  <strong>{building.buildingCode}</strong> — {building.name}
                </span>
                <span className={locationStyles.nodeCount}>{building.totalFloors} floors</span>
                {!building.isActive && (
                  <StatusBadge label="Inactive" variant="inactive" size="sm" />
                )}
                <div className={locationStyles.nodeActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openModal('floor', building.buildingId)}
                    aria-label={`Add floor to ${building.name}`}
                  >
                    <AddIcon />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => openModal('building', undefined, building)}
                    aria-label={`Edit ${building.name}`}
                  >
                    <EditIcon />
                  </button>
                  {building.isActive && (
                    <button
                      type="button"
                      className={`${styles.iconButton} ${styles.dangerButton}`}
                      onClick={() => handleDeactivate('building', building.buildingId, building.name)}
                      aria-label={`Deactivate ${building.name}`}
                    >
                      <DeactivateIcon />
                    </button>
                  )}
                </div>
              </div>

              {/* Floors */}
              {expanded.buildings.has(building.buildingId) && (
                <div className={locationStyles.children} role="group">
                  {(floorsMap[building.buildingId] || []).map(floor => (
                    <div key={floor.floorId} className={locationStyles.treeNode} role="treeitem" aria-expanded={expanded.floors.has(floor.floorId)}>
                      <div className={locationStyles.nodeRow}>
                        <button
                          type="button"
                          className={locationStyles.expandButton}
                          onClick={() => toggleFloor(floor.floorId)}
                          aria-label={expanded.floors.has(floor.floorId) ? `Collapse ${floor.name}` : `Expand ${floor.name}`}
                        >
                          <ChevronIcon expanded={expanded.floors.has(floor.floorId)} />
                        </button>
                        <span className={locationStyles.nodeIcon}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                          </svg>
                        </span>
                        <span className={locationStyles.nodeLabel}>
                          Floor {floor.floorNumber} — {floor.name}
                        </span>
                        <span className={locationStyles.nodeCount}>{floor.totalRooms} rooms</span>
                        {!floor.isActive && (
                          <StatusBadge label="Inactive" variant="inactive" size="sm" />
                        )}
                        <div className={locationStyles.nodeActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => openModal('room', floor.floorId)}
                            aria-label={`Add room to ${floor.name}`}
                          >
                            <AddIcon />
                          </button>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => openModal('floor', building.buildingId, floor)}
                            aria-label={`Edit ${floor.name}`}
                          >
                            <EditIcon />
                          </button>
                          {floor.isActive && (
                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.dangerButton}`}
                              onClick={() => handleDeactivate('floor', floor.floorId, floor.name)}
                              aria-label={`Deactivate ${floor.name}`}
                            >
                              <DeactivateIcon />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Rooms */}
                      {expanded.floors.has(floor.floorId) && (
                        <div className={locationStyles.children} role="group">
                          {(roomsMap[floor.floorId] || []).map(room => (
                            <div key={room.roomId} className={locationStyles.treeNode} role="treeitem" aria-expanded={expanded.rooms.has(room.roomId)}>
                              <div className={locationStyles.nodeRow}>
                                <button
                                  type="button"
                                  className={locationStyles.expandButton}
                                  onClick={() => toggleRoom(room.roomId)}
                                  aria-label={expanded.rooms.has(room.roomId) ? `Collapse ${room.name}` : `Expand ${room.name}`}
                                >
                                  <ChevronIcon expanded={expanded.rooms.has(room.roomId)} />
                                </button>
                                <span className={locationStyles.nodeIcon}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                  </svg>
                                </span>
                                <span className={locationStyles.nodeLabel}>
                                  {room.roomNumber} — {room.name}
                                </span>
                                <span className={locationStyles.nodeType}>{room.roomType.replace('_', ' ')}</span>
                                {!room.isActive && (
                                  <StatusBadge label="Inactive" variant="inactive" size="sm" />
                                )}
                                <div className={locationStyles.nodeActions}>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={() => openModal('rack', room.roomId)}
                                    aria-label={`Add rack to ${room.name}`}
                                  >
                                    <AddIcon />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={() => openModal('room', floor.floorId, room)}
                                    aria-label={`Edit ${room.name}`}
                                  >
                                    <EditIcon />
                                  </button>
                                  {room.isActive && (
                                    <button
                                      type="button"
                                      className={`${styles.iconButton} ${styles.dangerButton}`}
                                      onClick={() => handleDeactivate('room', room.roomId, room.name)}
                                      aria-label={`Deactivate ${room.name}`}
                                    >
                                      <DeactivateIcon />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Racks */}
                              {expanded.rooms.has(room.roomId) && (
                                <div className={locationStyles.children} role="group">
                                  {(racksMap[room.roomId] || []).map(rack => (
                                    <div key={rack.rackId} className={locationStyles.treeNode} role="treeitem">
                                      <div className={locationStyles.nodeRow}>
                                        <span className={locationStyles.expandPlaceholder} />
                                        <span className={locationStyles.nodeIcon}>
                                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                            <rect x="4" y="2" width="16" height="20" rx="2" />
                                            <line x1="8" y1="6" x2="16" y2="6" />
                                            <line x1="8" y1="10" x2="16" y2="10" />
                                            <line x1="8" y1="14" x2="16" y2="14" />
                                          </svg>
                                        </span>
                                        <span className={locationStyles.nodeLabel}>
                                          {rack.rackName}
                                        </span>
                                        <span className={locationStyles.nodeCount}>
                                          {rack.availableUnits}/{rack.totalUnits}U available
                                        </span>
                                        {!rack.isActive && (
                                          <StatusBadge label="Inactive" variant="inactive" size="sm" />
                                        )}
                                        <div className={locationStyles.nodeActions}>
                                          <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => openModal('rack', room.roomId, rack)}
                                            aria-label={`Edit rack ${rack.rackName}`}
                                          >
                                            <EditIcon />
                                          </button>
                                          {rack.isActive && (
                                            <button
                                              type="button"
                                              className={`${styles.iconButton} ${styles.dangerButton}`}
                                              onClick={() => handleDeactivate('rack', rack.rackId, rack.rackName)}
                                              aria-label={`Deactivate rack ${rack.rackName}`}
                                            >
                                              <DeactivateIcon />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {(racksMap[room.roomId] || []).length === 0 && (
                                    <div className={locationStyles.emptyChildren}>
                                      No racks — <button type="button" className={styles.linkButton} onClick={() => openModal('rack', room.roomId)} aria-label={`Add rack to ${room.name}`}>Add one</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {(roomsMap[floor.floorId] || []).length === 0 && (
                            <div className={locationStyles.emptyChildren}>
                              No rooms — <button type="button" className={styles.linkButton} onClick={() => openModal('room', floor.floorId)} aria-label={`Add room to ${floor.name}`}>Add one</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {(floorsMap[building.buildingId] || []).length === 0 && (
                    <div className={locationStyles.emptyChildren}>
                      No floors — <button type="button" className={styles.linkButton} onClick={() => openModal('floor', building.buildingId)} aria-label={`Add floor to ${building.name}`}>Add one</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal using the Modal component */}
      <Modal
        isOpen={modal.mode !== null}
        onClose={closeModal}
        title={getModalTitle()}
        footer={modalFooter}
        size="md"
      >
        <div className={locationStyles.modalBody}>
          {renderModalContent()}
        </div>
      </Modal>
    </PageLayout>
  );
}

export default LocationsPage;
