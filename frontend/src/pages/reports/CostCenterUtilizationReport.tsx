import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { CostCenterUtilizationReport as CostCenterUtilizationReportType, ReportFilters } from '../../types/report';
import { formatDateTime, formatCurrency, getUtilizationColor } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Cost Center Utilization Report Component
 * Implements Task 18.1.6: Create CostCenterUtilizationReport.tsx
 * Validates: Requirements 19.1 - Budget vs actual spending for each cost center
 */

export function CostCenterUtilizationReport() {
  const [report, setReport] = useState<CostCenterUtilizationReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.costCenterUtilization(fiscalYear, filters);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [fiscalYear, filters]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getUtilizationBadge = (percentage: number) => {
    if (percentage >= 90) {
      return <span className={`${styles.statusBadge} ${styles.statusError}`}>Critical</span>;
    }
    if (percentage >= 75) {
      return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>High</span>;
    }
    if (percentage >= 50) {
      return <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>Normal</span>;
    }
    return <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>Low</span>;
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

  // Calculate totals
  const totalBudget = report?.costCenters.reduce((sum, cc) => sum + cc.budgetAmount, 0) || 0;
  const totalSpent = report?.costCenters.reduce((sum, cc) => sum + cc.spentAmount, 0) || 0;
  const totalAvailable = report?.costCenters.reduce((sum, cc) => sum + cc.availableAmount, 0) || 0;
  const overallUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Generate fiscal year options
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Cost Center Utilization</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Cost Center Utilization Report</h1>
          <p className={styles.reportSubtitle}>
            Budget vs actual spending for each cost center - FY {report?.fiscalYear || fiscalYear}
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
          <ReportExportButton reportType="cost-center-utilization" reportName="Cost Center Utilization" filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="fiscal-year-select" className={styles.filterLabel}>Fiscal Year</label>
            <select
              id="fiscal-year-select"
              className={styles.filterSelect}
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  FY {year}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setFilters({});
                setFiscalYear(currentYear);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      {report && (
        <div className={styles.reportContent}>
          {/* Stats */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalBudget)}</p>
              <p className={styles.statLabel}>Total Budget</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalSpent)}</p>
              <p className={styles.statLabel}>Total Spent</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalAvailable)}</p>
              <p className={styles.statLabel}>Available</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue} style={{ color: getUtilizationColor(overallUtilization) }}>
                {overallUtilization.toFixed(1)}%
              </p>
              <p className={styles.statLabel}>Overall Utilization</p>
            </div>
          </div>

          {/* Overall Progress */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Overall Budget Utilization</h3>
            <div className={styles.progressBar} style={{ height: '24px', marginBottom: 'var(--spacing-2)' }}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${Math.min(overallUtilization, 100)}%`,
                  backgroundColor: getUtilizationColor(overallUtilization),
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              <span>{formatCurrency(totalSpent)} spent</span>
              <span>{formatCurrency(totalAvailable)} remaining</span>
            </div>
          </div>

          {/* Cost Center Table */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Cost Center Details</h3>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Budget</th>
                    <th>Spent</th>
                    <th>Available</th>
                    <th>Utilization</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.costCenters.map((cc, index) => (
                    <tr key={index}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--font-weight-medium)' }}>
                        {cc.costCenterCode}
                      </td>
                      <td>{cc.costCenterName}</td>
                      <td>{cc.departmentName}</td>
                      <td>{formatCurrency(cc.budgetAmount)}</td>
                      <td>{formatCurrency(cc.spentAmount)}</td>
                      <td>{formatCurrency(cc.availableAmount)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
                          <div className={styles.progressBar} style={{ width: '80px', height: '8px' }}>
                            <div
                              className={styles.progressFill}
                              style={{
                                width: `${Math.min(cc.utilizationPercentage, 100)}%`,
                                backgroundColor: getUtilizationColor(cc.utilizationPercentage),
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 'var(--font-size-sm)', minWidth: '45px' }}>
                            {cc.utilizationPercentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td>{getUtilizationBadge(cc.utilizationPercentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Generated At */}
          <p className={styles.generatedAt}>
            Report generated at: {formatDateTime(report.generatedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

export default CostCenterUtilizationReport;

