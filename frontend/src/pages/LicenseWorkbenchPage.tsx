import { useState, useEffect, useCallback, useRef } from 'react';
import { useAnnounce } from '../components/accessibility';
import { StatCard } from '../components/dashboard';
import {
  CompliancePositionsList,
  AuditRisksList,
  ReclamationOpportunitiesList,
} from '../components/license';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { PageLayout } from '../components/layout/PageLayout';
import { useAuth } from '../hooks/useAuth';
import {
  getLicenseWorkbenchSummary,
  runReconciliation,
  initiateReclamation,
  analyzeShadowIt,
  generateComplianceReport,
  syncSaasUsage,
  applyPublisherRules,
  getUnusedSubscriptions,
} from '../services/sam-api';
import type {
  LicenseWorkbenchSummary,
  CompliancePosition,
  AuditRisk,
  ReclamationOpportunity,
} from '../types/license';
import { formatLicenseCurrency } from '../types/license';
import { BREADCRUMB_CONFIGS } from '../types/layout';
import styles from './LicenseWorkbenchPage.module.css';

/** Action definitions for the SAM toolbar */
const SAM_ACTIONS = [
  { key: 'reconciliation', label: 'Run Reconciliation', fn: runReconciliation, formatResult: (r: Record<string, unknown>) => `Reconciled: ${r.reconciled}, Unreconciled: ${r.unreconciled}, New discrepancies: ${r.newDiscrepancies}` },
  { key: 'reclamation', label: 'Initiate Reclamation', fn: initiateReclamation, formatResult: (r: Record<string, unknown>) => `Initiated: ${r.initiated}, Est. savings: $${Number(r.estimatedSavings).toLocaleString()}` },
  { key: 'shadowIt', label: 'Analyze Shadow IT', fn: analyzeShadowIt, formatResult: (r: Record<string, unknown>) => `Detected: ${r.detectedApplications} apps, Risk: ${r.riskLevel}` },
  { key: 'compliance', label: 'Generate Compliance Report', fn: generateComplianceReport, formatResult: (r: Record<string, unknown>) => `Compliant: ${r.compliant}/${r.totalTitles}, Non-compliant: ${r.nonCompliant}` },
  { key: 'saasSync', label: 'Sync SaaS Usage', fn: syncSaasUsage, formatResult: (r: Record<string, unknown>) => `Synced: ${r.synced}, Errors: ${r.errors}` },
  { key: 'publisherRules', label: 'Apply Publisher Rules', fn: applyPublisherRules, formatResult: (r: Record<string, unknown>) => `Applied: ${r.applied}, Updated: ${r.updated}, Errors: ${r.errors}` },
  { key: 'unusedSubs', label: 'Get Unused Subscriptions', fn: getUnusedSubscriptions, formatResult: (r: unknown) => `Found ${Array.isArray(r) ? r.length : 0} unused subscription(s)` },
] as const;

/**
 * License Workbench Page
 * Implements Requirement 12.5:
 * - Display compliance positions by software title
 * - Show audit risks and reclamation opportunities
 * - Implement drill-down to detailed records
 * Implements Requirement 4.10:
 * - Display compliance positions, audit risks, and optimization opportunities
 */
export function LicenseWorkbenchPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [data, setData] = useState<LicenseWorkbenchSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // SAM action toolbar state
  const { hasAnyRole } = useAuth();
  const canRunActions = hasAnyRole(['license_analyst', 'admin']);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionResults, setActionResults] = useState<Record<string, string>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  const handleAction = useCallback(async (key: string, fn: () => Promise<unknown>, formatResult: (r: never) => string) => {
    setActionLoading(prev => ({ ...prev, [key]: true }));
    setActionResults(prev => { const next = { ...prev }; delete next[key]; return next; });
    setActionErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    try {
      const result = await fn();
      setActionResults(prev => ({ ...prev, [key]: formatResult(result as never) }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionErrors(prev => ({ ...prev, [key]: message }));
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  }, []);

  // Accessibility: announce loading completion to screen readers
  const { announce } = useAnnounce();
  const previousLoadingRef = useRef(isLoading);

  // Fetch license workbench data
  const fetchLicenseData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsRetrying(false);
      setError(null);
      const result = await getLicenseWorkbenchSummary();
      setData(result);
    } catch (err) {
      setError('Failed to load license data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await fetchLicenseData();
  }, [fetchLicenseData]);

  // Initial data fetch
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (isMounted) {
        await fetchLicenseData();
      }
    };
    
    loadData();

    return () => {
      isMounted = false;
    };
  }, [fetchLicenseData]);

  // Announce loading completion to screen readers
  useEffect(() => {
    if (previousLoadingRef.current && !isLoading && data) {
      const titleCount = data.totalSoftwareTitles ?? 0;
      announce(`License data loaded. Showing ${titleCount} software title${titleCount !== 1 ? 's' : ''}`, 'polite');
    }
    previousLoadingRef.current = isLoading;
  }, [isLoading, data, announce]);

  // Handle compliance position click - drill-down to detailed records
  const handlePositionClick = useCallback((position: CompliancePosition) => {
    console.log('Navigate to compliance position details:', position.productId);
    // In a real app, this would navigate to a detailed view
  }, []);

  // Handle view all compliance positions
  const handleViewAllPositions = useCallback(() => {
    console.log('Navigate to all compliance positions');
  }, []);

  // Handle audit risk click - drill-down to detailed records
  const handleRiskClick = useCallback((risk: AuditRisk) => {
    console.log('Navigate to audit risk details:', risk.riskId);
  }, []);

  // Handle view risk details
  const handleViewRiskDetails = useCallback((risk: AuditRisk) => {
    console.log('View risk details:', risk.riskId);
    // In a real app, this would open a modal or navigate to details
  }, []);

  // Handle view all audit risks
  const handleViewAllRisks = useCallback(() => {
    console.log('Navigate to all audit risks');
  }, []);

  // Handle reclamation opportunity click - drill-down to detailed records
  const handleOpportunityClick = useCallback((opportunity: ReclamationOpportunity) => {
    console.log('Navigate to reclamation opportunity details:', opportunity.opportunityId);
  }, []);

  // Handle initiate reclamation
  const handleInitiateReclamation = useCallback((opportunity: ReclamationOpportunity) => {
    console.log('Initiate reclamation for:', opportunity.opportunityId);
    // In a real app, this would trigger a reclamation workflow
  }, []);

  // Handle view all reclamation opportunities
  const handleViewAllOpportunities = useCallback(() => {
    console.log('Navigate to all reclamation opportunities');
  }, []);

  if (error) {
    return (
      <PageLayout
        title="License Workbench"
        description="Monitor software compliance, audit risks, and optimization opportunities"
        maxWidth="xl"
      >
        <ErrorMessage
          title="Error Loading License Data"
          message={error}
          type="error"
          variant="inline"
          recoveryOptions={[
            {
              label: "Retry",
              action: handleRetry,
              isLoading: isRetrying
            }
          ]}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="License Workbench"
      description="Monitor software compliance, audit risks, and optimization opportunities"
      breadcrumbs={[...BREADCRUMB_CONFIGS.LICENSE_WORKBENCH]}
      lastUpdated={!isLoading && data ? new Date() : undefined}
      maxWidth="xl"
    >

      {/* Summary Stats */}
      <section className={styles.statsSection} aria-label="License summary statistics">
        <div className={styles.statsGrid}>
          <StatCard
            label="Software Titles"
            value={data?.totalSoftwareTitles ?? 0}
            subtitle={`${data?.compliantCount ?? 0} compliant`}
            variant="primary"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 17l6-6-6-6" />
                <path d="M12 19h8" />
              </svg>
            }
          />
          <StatCard
            label="Under-Licensed"
            value={data?.underLicensedCount ?? 0}
            subtitle={data ? formatLicenseCurrency(data.totalPotentialExposure) + ' exposure' : '$0'}
            variant={data && data.underLicensedCount > 0 ? 'error' : 'success'}
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            }
          />
          <StatCard
            label="Audit Risks"
            value={(data?.criticalRisksCount ?? 0) + (data?.highRisksCount ?? 0)}
            subtitle={`${data?.criticalRisksCount ?? 0} critical`}
            variant={data && data.criticalRisksCount > 0 ? 'error' : 'warning'}
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            }
          />
          <StatCard
            label="Reclamation Savings"
            value={data ? formatLicenseCurrency(data.totalReclamationSavings) : '$0'}
            subtitle={`${data?.reclamationOpportunitiesCount ?? 0} opportunities`}
            variant="success"
            isLoading={isLoading}
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            }
          />
        </div>
      </section>

      {/* Entitlement Value Summary */}
      <section className={styles.valueSection} aria-label="Entitlement value summary">
        <div className={styles.valueCard}>
          <div className={styles.valueItem}>
            <span className={styles.valueLabel}>Total Entitlement Value</span>
            <span className={styles.valueAmount}>
              {data ? formatLicenseCurrency(data.totalEntitlementValue) : '$0'}
            </span>
          </div>
          <div className={styles.valueDivider} />
          <div className={styles.valueItem}>
            <span className={styles.valueLabel}>Over-Licensed</span>
            <span className={styles.valueAmountWarning}>
              {data?.overLicensedCount ?? 0} titles
            </span>
          </div>
          <div className={styles.valueDivider} />
          <div className={styles.valueItem}>
            <span className={styles.valueLabel}>Potential Exposure</span>
            <span className={styles.valueAmountDanger}>
              {data ? formatLicenseCurrency(data.totalPotentialExposure) : '$0'}
            </span>
          </div>
        </div>
      </section>

      {/* SAM Actions Toolbar - only for license_analyst or admin */}
      {canRunActions && (
        <section className={styles.actionsSection} aria-label="SAM actions">
          <h3 className={styles.actionsSectionTitle}>Actions</h3>
          <div className={styles.actionsToolbar} role="toolbar" aria-label="SAM action buttons">
            {SAM_ACTIONS.map(action => (
              <button
                key={action.key}
                className={styles.actionButton}
                onClick={() => handleAction(action.key, action.fn, action.formatResult as (r: never) => string)}
                disabled={!!actionLoading[action.key]}
                aria-busy={!!actionLoading[action.key]}
              >
                {actionLoading[action.key] ? 'Running…' : action.label}
              </button>
            ))}
          </div>
          {/* Action results / errors */}
          {SAM_ACTIONS.map(action => {
            const result = actionResults[action.key];
            const actionError = actionErrors[action.key];
            if (!result && !actionError) return null;
            return (
              <div key={action.key} className={result ? styles.actionResult : styles.actionError} role={actionError ? 'alert' : 'status'}>
                <span className={styles.actionResultLabel}>{action.label}:</span>{' '}
                {result && <span>{result}</span>}
                {actionError && (
                  <>
                    <span>{actionError}</span>
                    <button
                      className={styles.actionRetryButton}
                      onClick={() => handleAction(action.key, action.fn, action.formatResult as (r: never) => string)}
                    >
                      Retry
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Main Content Grid */}
      <div className={styles.contentGrid}>
        {/* Compliance Positions */}
        <section className={styles.complianceSection} aria-label="Compliance positions">
          <CompliancePositionsList
            positions={data?.compliancePositions ?? []}
            title="Compliance Positions"
            maxItems={5}
            isLoading={isLoading}
            onPositionClick={handlePositionClick}
            onViewAll={handleViewAllPositions}
          />
        </section>

        {/* Audit Risks */}
        <section className={styles.risksSection} aria-label="Audit risks">
          <AuditRisksList
            risks={data?.auditRisks ?? []}
            title="Audit Risks"
            maxItems={5}
            isLoading={isLoading}
            onRiskClick={handleRiskClick}
            onViewDetails={handleViewRiskDetails}
            onViewAll={handleViewAllRisks}
          />
        </section>

        {/* Reclamation Opportunities */}
        <section className={styles.reclamationSection} aria-label="Reclamation opportunities">
          <ReclamationOpportunitiesList
            opportunities={data?.reclamationOpportunities ?? []}
            title="Reclamation Opportunities"
            maxItems={5}
            isLoading={isLoading}
            onOpportunityClick={handleOpportunityClick}
            onInitiateReclamation={handleInitiateReclamation}
            onViewAll={handleViewAllOpportunities}
          />
        </section>
      </div>
    </PageLayout>
  );
}

export default LicenseWorkbenchPage;
