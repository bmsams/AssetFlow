import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { AssetByDepartmentReport as AssetByDepartmentReportType, ReportFilters } from '../../types/report';
import { formatDateTime, formatCurrency } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Asset By Department Report Component
 * Implements Task 18.1.5: Create AssetByDepartmentReport.tsx
 * Validates: Requirements 18.4 - Assets grouped by department with cost allocation
 */

const CHART_COLORS = [
  'var(--color-primary-500)',
  'var(--color-success-500)',
  'var(--color-warning-500)',
  'var(--color-error-500)',
  'var(--color-purple-500)',
  'var(--color-cyan-500)',
  'var(--color-orange-500)',
  'var(--color-pink-500)',
];

export function AssetByDepartmentReport() {
  const [report, setReport] = useState<AssetByDepartmentReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [expandedDepartment, setExpandedDepartment] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.assetsByDepartment(filters);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const renderBarChart = (departments: AssetByDepartmentReportType['departments']) => {
    if (!departments || departments.length === 0) return null;

    const maxAssets = Math.max(...departments.map((d) => d.totalAssets));

    return (
      <div className={styles.barChart}>
        {departments.slice(0, 10).map((dept, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel}>{dept.departmentName}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(dept.totalAssets / maxAssets) * 100}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <span className={styles.barValue}>{dept.totalAssets}</span>
          </div>
        ))}
      </div>
    );
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
  const totalAssets = report?.departments.reduce((sum, d) => sum + d.totalAssets, 0) || 0;
  const totalValue = report?.departments.reduce((sum, d) => sum + d.totalValue, 0) || 0;
  const totalDepartments = report?.departments.length || 0;

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Assets by Department</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Assets by Department Report</h1>
          <p className={styles.reportSubtitle}>
            Assets grouped by department with cost allocation
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
          <ReportExportButton reportType="assets-by-department" reportName="Assets by Department" filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Asset Type</label>
            <select
              className={styles.filterSelect}
              value={filters.assetType || ''}
              onChange={(e) => handleFilterChange('assetType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="HARDWARE">Hardware</option>
              <option value="SOFTWARE">Software</option>
              <option value="ENTERPRISE">Enterprise</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Status</label>
            <select
              className={styles.filterSelect}
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
            </select>
          </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setFilters({})}
            >
              Clear Filters
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
              <p className={styles.statValue}>{totalAssets.toLocaleString()}</p>
              <p className={styles.statLabel}>Total Assets</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalValue)}</p>
              <p className={styles.statLabel}>Total Value</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalDepartments}</p>
              <p className={styles.statLabel}>Departments</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>
                {totalAssets > 0 ? formatCurrency(totalValue / totalAssets) : '$0'}
              </p>
              <p className={styles.statLabel}>Avg Value/Asset</p>
            </div>
          </div>

          {/* Bar Chart */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Assets by Department (Top 10)</h3>
            {renderBarChart(report.departments)}
          </div>

          {/* Department Table */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Department Details</h3>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Assets</th>
                    <th>Total Value</th>
                    <th>Avg Value</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {report.departments.map((dept, index) => (
                    <>
                      <tr key={index}>
                        <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                          {dept.departmentName}
                        </td>
                        <td>{dept.totalAssets.toLocaleString()}</td>
                        <td>{formatCurrency(dept.totalValue)}</td>
                        <td>
                          {dept.totalAssets > 0
                            ? formatCurrency(dept.totalValue / dept.totalAssets)
                            : '$0'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            style={{ padding: 'var(--spacing-1) var(--spacing-2)', fontSize: 'var(--font-size-xs)' }}
                            onClick={() =>
                              setExpandedDepartment(
                                expandedDepartment === dept.departmentName ? null : dept.departmentName
                              )
                            }
                          >
                            {expandedDepartment === dept.departmentName ? 'Hide' : 'Show'} Types
                          </button>
                        </td>
                      </tr>
                      {expandedDepartment === dept.departmentName && dept.byType.length > 0 && (
                        <tr>
                          <td colSpan={5} style={{ backgroundColor: 'var(--color-background)', padding: 'var(--spacing-4)' }}>
                            <table className={styles.table} style={{ marginBottom: 0 }}>
                              <thead>
                                <tr>
                                  <th>Asset Type</th>
                                  <th>Count</th>
                                  <th>Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {dept.byType.map((typeData, typeIndex) => (
                                  <tr key={typeIndex}>
                                    <td>{typeData.type}</td>
                                    <td>{typeData.count.toLocaleString()}</td>
                                    <td>{formatCurrency(typeData.value)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
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

export default AssetByDepartmentReport;

