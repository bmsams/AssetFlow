import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listWorkOrders,
  createWorkOrder,
  assignWorkOrder,
  completeWorkOrder,
  type WorkOrder,
} from '../../services/eam-api';
import { adminApi } from '../../services/admin-api';
import { assetApi } from '../../services/asset-api';
import type { Building } from '../../types/admin';
import type { Asset } from '../../types/asset';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';
type WorkTypeOption =
  | 'corrective'
  | 'preventive'
  | 'emergency'
  | 'inspection'
  | 'calibration'
  | 'installation'
  | 'modification'
  | 'decommission'
  | 'project'
  | 'other';

export function WorkOrdersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingAssets, setBuildingAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkOrder, setNewWorkOrder] = useState<{
    assetId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    workType: WorkTypeOption;
    estimatedHours: string;
  }>({
    assetId: '',
    title: '',
    description: '',
    priority: 'medium',
    workType: 'corrective',
    estimatedHours: '',
  });

  const loadBuildings = useCallback(async () => {
    try {
      const response = await adminApi.buildings.list({ isActive: true }, { pageSize: 200, sortBy: 'name', sortOrder: 'asc' });
      setBuildings(response.items);
    } catch {
      // Keep work-order page usable even if building master data is temporarily unavailable.
      setBuildings([]);
    }
  }, []);

  const fetchWorkOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await listWorkOrders({
        status: statusFilter === 'all' ? undefined : statusFilter,
        priority: priorityFilter === 'all' ? undefined : priorityFilter,
        buildingId: buildingFilter === 'all' ? undefined : buildingFilter,
      });
      setWorkOrders(result);
    } catch {
      setError('Failed to load work orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter, buildingFilter]);

  const loadBuildingAssets = useCallback(async () => {
    if (buildingFilter === 'all') {
      setBuildingAssets([]);
      setNewWorkOrder((prev) => ({ ...prev, assetId: '' }));
      return;
    }

    try {
      setIsLoadingAssets(true);
      const response = await assetApi.list(
        { type: 'HARDWARE', buildingId: buildingFilter },
        { page: 1, pageSize: 200, sortBy: 'displayName', sortOrder: 'asc' }
      );
      const assets = response.items;
      setBuildingAssets(assets);

      setNewWorkOrder((prev) => {
        const assetStillValid = assets.some((asset) => asset.assetId === prev.assetId);
        return {
          ...prev,
          assetId: assetStillValid ? prev.assetId : assets[0]?.assetId ?? '',
        };
      });
    } catch {
      setBuildingAssets([]);
      setNewWorkOrder((prev) => ({ ...prev, assetId: '' }));
    } finally {
      setIsLoadingAssets(false);
    }
  }, [buildingFilter]);

  useEffect(() => {
    void loadBuildings();
  }, [loadBuildings]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

  useEffect(() => {
    void loadBuildingAssets();
  }, [loadBuildingAssets]);

  const handleCreateWorkOrder = async (event: FormEvent) => {
    event.preventDefault();

    if (buildingFilter === 'all') {
      setError('Select a building before creating a work order.');
      return;
    }
    if (!newWorkOrder.assetId) {
      setError('Select an asset for the new work order.');
      return;
    }
    if (!newWorkOrder.title.trim()) {
      setError('Work order title is required.');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const estimatedHours = newWorkOrder.estimatedHours.trim().length > 0
        ? Number(newWorkOrder.estimatedHours)
        : undefined;

      await createWorkOrder({
        assetId: newWorkOrder.assetId,
        buildingId: buildingFilter === 'all' ? undefined : buildingFilter,
        workType: newWorkOrder.workType,
        title: newWorkOrder.title.trim(),
        description: newWorkOrder.description.trim(),
        priority: newWorkOrder.priority,
        estimatedHours: Number.isFinite(estimatedHours ?? Number.NaN) ? estimatedHours : undefined,
      });

      setNewWorkOrder((prev) => ({
        ...prev,
        title: '',
        description: '',
        estimatedHours: '',
      }));
      await fetchWorkOrders();
    } catch {
      setError('Failed to create work order. Please verify required fields and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async (workOrderId: string) => {
    const assignee = window.prompt('Enter user ID to assign:');
    if (!assignee) return;
    try {
      await assignWorkOrder(workOrderId, assignee);
      await fetchWorkOrders();
    } catch {
      setError('Failed to assign work order. Please try again.');
    }
  };

  const handleComplete = async (workOrderId: string) => {
    try {
      await completeWorkOrder(workOrderId);
      await fetchWorkOrders();
    } catch {
      setError('Failed to complete work order. Please try again.');
    }
  };

  const getPriorityStyle = (priority: WorkOrder['priority']): React.CSSProperties => {
    const colors: Record<WorkOrder['priority'], string> = {
      critical: 'var(--color-error, #dc2626)',
      high: 'var(--color-warning, #f59e0b)',
      medium: 'var(--color-info, #3b82f6)',
      low: 'var(--color-text-secondary, #6b7280)',
    };
    return { color: colors[priority], fontWeight: 600 };
  };

  return (
    <PageLayout
      title="Work Orders"
      description="Manage enterprise asset work orders"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Work Orders' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        <form
          onSubmit={handleCreateWorkOrder}
          style={{
            marginBottom: 'var(--spacing-4)',
            padding: 'var(--spacing-4)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: 'var(--radius-md, 8px)',
            display: 'grid',
            gap: 'var(--spacing-3)',
          }}
        >
          <strong>Create Work Order</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-3)' }}>
            <label>
              Asset (Building scoped)
              <select
                value={newWorkOrder.assetId}
                onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, assetId: e.target.value }))}
                disabled={buildingFilter === 'all' || isLoadingAssets || isCreating}
                style={{ width: '100%' }}
              >
                <option value="">
                  {buildingFilter === 'all'
                    ? 'Select building first'
                    : isLoadingAssets
                      ? 'Loading assets...'
                      : 'Select asset'}
                </option>
                {buildingAssets.map((asset) => (
                  <option key={asset.assetId} value={asset.assetId}>
                    {asset.assetTag} - {asset.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Work Type
              <select
                value={newWorkOrder.workType}
                onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, workType: e.target.value as WorkTypeOption }))}
                disabled={isCreating}
                style={{ width: '100%' }}
              >
                <option value="corrective">Corrective</option>
                <option value="preventive">Preventive</option>
                <option value="emergency">Emergency</option>
                <option value="inspection">Inspection</option>
                <option value="calibration">Calibration</option>
                <option value="installation">Installation</option>
                <option value="modification">Modification</option>
                <option value="decommission">Decommission</option>
                <option value="project">Project</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={newWorkOrder.priority}
                onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, priority: e.target.value as WorkOrder['priority'] }))}
                disabled={isCreating}
                style={{ width: '100%' }}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Est. Hours
              <input
                type="number"
                min={0}
                step={0.5}
                value={newWorkOrder.estimatedHours}
                onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, estimatedHours: e.target.value }))}
                disabled={isCreating}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          <label>
            Title
            <input
              type="text"
              value={newWorkOrder.title}
              onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, title: e.target.value }))}
              disabled={isCreating}
              style={{ width: '100%' }}
              placeholder="Short work order title"
            />
          </label>
          <label>
            Description
            <textarea
              value={newWorkOrder.description}
              onChange={(e) => setNewWorkOrder((prev) => ({ ...prev, description: e.target.value }))}
              disabled={isCreating}
              style={{ width: '100%' }}
              rows={3}
              placeholder="Describe the issue or required work"
            />
          </label>
          <div>
            <button type="submit" disabled={isCreating || buildingFilter === 'all' || !newWorkOrder.assetId || !newWorkOrder.title.trim()}>
              {isCreating ? 'Creating...' : 'Create Work Order'}
            </button>
          </div>
        </form>

        <div style={{ marginBottom: 'var(--spacing-4)', display: 'flex', gap: 'var(--spacing-4)' }}>
          <div>
            <label htmlFor="status-filter" style={{ marginRight: 'var(--spacing-2)' }}>
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority-filter" style={{ marginRight: 'var(--spacing-2)' }}>
              Priority:
            </label>
            <select
              id="priority-filter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="building-filter" style={{ marginRight: 'var(--spacing-2)' }}>
              Building:
            </label>
            <select
              id="building-filter"
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
            >
              <option value="all">All</option>
              {buildings.map((building) => (
                <option key={building.buildingId} value={building.buildingId}>
                  {building.buildingCode} - {building.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchWorkOrders }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading work orders...</p>
          </div>
        )}

        {!isLoading && !error && workOrders.length === 0 && (
          <EmptyState
            title="No work orders found"
            description="No work orders match the current filters."
          />
        )}

        {!isLoading && !error && workOrders.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Work orders">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Title</th>
                <th scope="col">Asset Tag</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Assigned To</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workOrders.map((wo) => (
                <tr key={wo.workOrderId}>
                  <td>{wo.workOrderId}</td>
                  <td>{wo.title}</td>
                  <td>{wo.assetTag}</td>
                  <td style={getPriorityStyle(wo.priority)}>{wo.priority}</td>
                  <td>{wo.status}</td>
                  <td>{wo.assignedToName || wo.assignedTo || '—'}</td>
                  <td>{new Date(wo.createdAt).toLocaleDateString()}</td>
                  <td>
                    {wo.status === 'open' && (
                      <button onClick={() => handleAssign(wo.workOrderId)}>Assign</button>
                    )}
                    {(wo.status === 'assigned' || wo.status === 'in_progress') && (
                      <button onClick={() => handleComplete(wo.workOrderId)}>Complete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageLayout>
  );
}
