import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listMaintenancePlans,
  checkDueMaintenance,
  updateMaintenancePlan,
  type MaintenancePlan,
} from '../../services/eam-api';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'active' | 'paused' | 'completed';

export function MaintenancePlansPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [duePlans, setDuePlans] = useState<MaintenancePlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchPlans = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const [planResult, dueResult] = await Promise.all([
        listMaintenancePlans(status),
        checkDueMaintenance(),
      ]);
      setPlans(planResult);
      setDuePlans(dueResult);
    } catch {
      setError('Failed to load maintenance plans. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handlePause = async (planId: string) => {
    try {
      await updateMaintenancePlan(planId, { status: 'paused' });
      await fetchPlans();
    } catch {
      setError('Failed to pause maintenance plan. Please try again.');
    }
  };

  const handleResume = async (planId: string) => {
    try {
      await updateMaintenancePlan(planId, { status: 'active' });
      await fetchPlans();
    } catch {
      setError('Failed to resume maintenance plan. Please try again.');
    }
  };

  const isDue = (planId: string) => duePlans.some((p) => p.planId === planId);

  return (
    <PageLayout
      title="Maintenance Plans"
      description="Manage scheduled maintenance plans for enterprise assets"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Maintenance Plans' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        {duePlans.length > 0 && (
          <div
            role="alert"
            style={{
              padding: 'var(--spacing-3)',
              marginBottom: 'var(--spacing-4)',
              backgroundColor: 'var(--color-warning-bg, #fef3c7)',
              border: '1px solid var(--color-warning, #f59e0b)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong>{duePlans.length} maintenance plan(s) due</strong>
          </div>
        )}

        <div style={{ marginBottom: 'var(--spacing-4)' }}>
          <label htmlFor="status-filter" style={{ marginRight: 'var(--spacing-2)' }}>
            Status:
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {error && (
          <ErrorMessage
            title="Error"
            message={error}
            type="error"
            variant="inline"
            recoveryOptions={[{ label: 'Retry', action: fetchPlans }]}
          />
        )}

        {isLoading && (
          <div aria-live="polite" aria-busy="true">
            <p>Loading maintenance plans...</p>
          </div>
        )}

        {!isLoading && !error && plans.length === 0 && (
          <EmptyState
            title="No maintenance plans found"
            description="No maintenance plans match the current filter."
          />
        )}

        {!isLoading && !error && plans.length > 0 && (
          <table className={styles.dataTable || ''} role="table" aria-label="Maintenance plans">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Asset Tag</th>
                <th scope="col">Frequency</th>
                <th scope="col">Status</th>
                <th scope="col">Next Due</th>
                <th scope="col">Tasks</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.planId}>
                  <td>
                    {plan.name}
                    {isDue(plan.planId) && (
                      <span style={{ color: 'var(--color-warning, #f59e0b)', marginLeft: 'var(--spacing-1)' }} title="Due for maintenance">
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>{plan.assetTag}</td>
                  <td>{plan.frequency}</td>
                  <td>{plan.status}</td>
                  <td>{plan.nextDue ? new Date(plan.nextDue).toLocaleDateString() : '—'}</td>
                  <td>{plan.tasks.filter((t) => t.completed).length}/{plan.tasks.length}</td>
                  <td>
                    {plan.status === 'active' && (
                      <button onClick={() => handlePause(plan.planId)}>Pause</button>
                    )}
                    {plan.status === 'paused' && (
                      <button onClick={() => handleResume(plan.planId)}>Resume</button>
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
