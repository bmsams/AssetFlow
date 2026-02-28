import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../components/layout/PageLayout';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  listMaintenancePlans,
  checkDueMaintenance,
  updateMaintenancePlan,
  type MaintenancePlan,
  type DueMaintenanceResponse,
} from '../../services/eam-api';
import styles from '../Page.module.css';

type StatusFilter = 'all' | 'active' | 'paused';

export function MaintenancePlansPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [dueInfo, setDueInfo] = useState<DueMaintenanceResponse | null>(null);
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
      setDueInfo(dueResult);
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
      await updateMaintenancePlan(planId, { isActive: false });
      await fetchPlans();
    } catch {
      setError('Failed to pause maintenance plan. Please try again.');
    }
  };

  const handleResume = async (planId: string) => {
    try {
      await updateMaintenancePlan(planId, { isActive: true });
      await fetchPlans();
    } catch {
      setError('Failed to resume maintenance plan. Please try again.');
    }
  };

  const isDue = (planId: string) =>
    dueInfo?.due.some((d) => d.planId === planId) ?? false;

  const formatFrequency = (plan: MaintenancePlan): string => {
    if (plan.frequencyDays) return `Every ${plan.frequencyDays} days`;
    if (plan.frequencyHours) return `Every ${plan.frequencyHours} hours`;
    return plan.scheduleType;
  };

  return (
    <PageLayout
      title="Maintenance Plans"
      description="Manage scheduled maintenance plans for enterprise assets"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Maintenance Plans' }]}
      maxWidth="xl"
    >
      <div className={styles.pageContent}>
        {dueInfo && dueInfo.summary.totalDue > 0 && (
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
            <strong>{dueInfo.summary.totalDue} maintenance plan(s) due</strong>
            {dueInfo.summary.overdue > 0 && (
              <span style={{ marginLeft: 'var(--spacing-2)', color: 'var(--color-error, #ef4444)' }}>
                ({dueInfo.summary.overdue} overdue)
              </span>
            )}
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
                <th scope="col">Type</th>
                <th scope="col">Frequency</th>
                <th scope="col">Priority</th>
                <th scope="col">Next Due</th>
                <th scope="col">Executions</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.planId}>
                  <td>
                    {plan.planName}
                    {isDue(plan.planId) && (
                      <span style={{ color: 'var(--color-warning, #f59e0b)', marginLeft: 'var(--spacing-1)' }} title="Due for maintenance">
                        ⚠
                      </span>
                    )}
                  </td>
                  <td>{plan.maintenanceType}</td>
                  <td>{formatFrequency(plan)}</td>
                  <td>{plan.priority}</td>
                  <td>{plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString() : '—'}</td>
                  <td>{plan.executionCount}</td>
                  <td>
                    {plan.isActive ? (
                      <button onClick={() => handlePause(plan.planId)}>Pause</button>
                    ) : (
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
