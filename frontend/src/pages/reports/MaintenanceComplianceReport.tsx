import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { MaintenanceComplianceReport as MaintenanceComplianceReportType, ReportFilters } from '../../types/report';
import { formatDateTime, formatDate, getComplianceColor } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

const EMPTY_REPORT_FILTERS: ReportFilters = {};

/**
 * Maintenance Compliance Report Component
 * Implements Task 18.1.9: Create MaintenanceComplianceReport.tsx
 * Validates: Requirements 20.2 - Maintenance plan adherence rates and overdue items
 */

export function MaintenanceComplianceReport() {
  const [report, setReport] = useState<MaintenanceComplianceReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filters = EMPTY_REPORT_FILTERS;
  const [activeTab, setActiveTab] = useState<'overdue' | 'upcoming'>('overdue');

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.maintenanceCompliance(EMPTY_REPORT_FILTERS);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const getComplianceBadge = (rate: number) => {
    if (rate >= 90) {
      return <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>Excellent</span>;
    }
    if (rate >= 75) {
      return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>Good</span>;
    }
    return <span className={`${styles.statusBadge} ${styles.statusError}`}>Needs Attention</span>;
  };

  const getOverdueSeverity = (daysOverdue: number) => {
    if (daysOverdue > 30) {
      return <span className={`${styles.statusBadge} ${styles.statusError}`}>Critical</span>;
    }
    if (daysOverdue > 14) {
      return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>High</span>;
    }
    return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>Medium</span>;
  };

  const getUpcomingUrgency = (daysUntilDue: number) => {
    if (daysUntilDue <= 3) {
      return <span className={`${styles.statusBadge} ${styles.statusError}`}>Urgent</span>;
    }
    if (daysUntilDue <= 7) {
      return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>Soon</span>;
    }
    return <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>Scheduled</span>;
  };

  if (isLoading) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.reportPage}>
        <div className={styles.errorState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.errorIcon}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className={styles.errorTitle}>Failed to Load Report</h3>
          <p className={styles.errorMessage}>{error}</p>
          <button type="button" className={styles.primaryButton} onClick={() => { void fetchReport(); }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Maintenance Compliance</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Maintenance Compliance Report</h1>
          <p className={styles.reportSubtitle}>
            Maintenance plan adherence rates and overdue/upcoming items
          </p>
        </div>
        <div className={styles.reportActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => { void fetchReport(); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
          <ReportExportButton reportType="maintenance-compliance" reportName="Maintenance Compliance" filters={filters} />
        </div>
      </div>

      {/* Report Content */}
      {report && (
        <div className={styles.reportContent}>
          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.totalPlans}</p>
              <p className={styles.statLabel}>Total Plans</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.activePlans}</p>
              <p className={styles.statLabel}>Active Plans</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue} style={{ color: getComplianceColor(report.complianceRate) }}>
                {report.complianceRate.toFixed(1)}%
              </p>
              <p className={styles.statLabel}>Compliance Rate</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue} style={{ color: report.overdueItems.length > 0 ? 'var(--color-error-500)' : 'var(--color-success-500)' }}>
                {report.overdueItems.length}
              </p>
              <p className={styles.statLabel}>Overdue Items</p>
            </div>
          </div>

          {/* Compliance Gauge */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Overall Compliance</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-6)' }}>
              <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                <svg viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                  {/* Background circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke="var(--color-gray-200)"
                    strokeWidth="12"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    fill="none"
                    stroke={getComplianceColor(report.complianceRate)}
                    strokeWidth="12"
                    strokeDasharray={`${(report.complianceRate / 100) * 440} 440`}
                    strokeLinecap="round"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                    {report.complianceRate.toFixed(0)}%
                  </p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                    Compliance
                  </p>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 'var(--spacing-4)' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: '0 0 var(--spacing-1) 0' }}>
                    Status
                  </p>
                  {getComplianceBadge(report.complianceRate)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-4)' }}>
                  <div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      On Schedule
                    </p>
                    <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', margin: 0, color: 'var(--color-success-600)' }}>
                      {report.activePlans - report.overdueItems.length}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                      Overdue
                    </p>
                    <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', margin: 0, color: 'var(--color-error-600)' }}>
                      {report.overdueItems.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
            <button
              type="button"
              className={activeTab === 'overdue' ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setActiveTab('overdue')}
            >
              Overdue Items ({report.overdueItems.length})
            </button>
            <button
              type="button"
              className={activeTab === 'upcoming' ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming Items ({report.upcomingItems.length})
            </button>
          </div>

          {/* Overdue Items Table */}
          {activeTab === 'overdue' && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Overdue Maintenance Items</h3>
              {report.overdueItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--color-text-secondary)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '48px', height: '48px', margin: '0 auto var(--spacing-4)', color: 'var(--color-success-500)' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p style={{ margin: 0 }}>No overdue maintenance items. Great job!</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Asset Tag</th>
                        <th>Due Date</th>
                        <th>Days Overdue</th>
                        <th>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.overdueItems.map((item, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: 'var(--font-weight-medium)' }}>{item.planName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                            {item.assetTag}
                          </td>
                          <td>{formatDate(item.dueDate)}</td>
                          <td style={{ color: 'var(--color-error-600)', fontWeight: 'var(--font-weight-medium)' }}>
                            {item.daysOverdue} days
                          </td>
                          <td>{getOverdueSeverity(item.daysOverdue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Upcoming Items Table */}
          {activeTab === 'upcoming' && (
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Upcoming Maintenance Items</h3>
              {report.upcomingItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--color-text-secondary)' }}>
                  <p style={{ margin: 0 }}>No upcoming maintenance items scheduled.</p>
                </div>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Asset Tag</th>
                        <th>Due Date</th>
                        <th>Days Until Due</th>
                        <th>Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.upcomingItems.map((item, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: 'var(--font-weight-medium)' }}>{item.planName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                            {item.assetTag}
                          </td>
                          <td>{formatDate(item.dueDate)}</td>
                          <td>{item.daysUntilDue} days</td>
                          <td>{getUpcomingUrgency(item.daysUntilDue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Generated At */}
          <p className={styles.generatedAt}>
            Report generated at: {formatDateTime(report.generatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

export default MaintenanceComplianceReport;

