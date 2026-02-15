import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listWorkOrders,
  assignWorkOrder,
  completeWorkOrder,
  type WorkOrder,
} from '../../services/eam-api';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
type PriorityFilter = 'all' | 'low' | 'medium' | 'high' | 'critical';

export function WorkOrdersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');

  const fetchWorkOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const priority = priorityFilter === 'all' ? undefined : priorityFilter;
      const result = await listWorkOrders(status, priority);
      setWorkOrders(result);
    } catch {
      setError('Failed to load work orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchWorkOrders();
  }, [fetchWorkOrders]);

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
