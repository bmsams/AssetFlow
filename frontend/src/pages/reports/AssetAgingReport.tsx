import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { AssetAgingReport as AssetAgingReportType, ReportFilters } from '../../types/report';
import { formatDateTime, formatCurrency, formatDate } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Asset Aging Report Component
 * Implements Task 18.1.3: Create AssetAgingReport.tsx
 * Validates: Requirements 18.2 - Assets grouped by age ranges with depreciation status
 */

const CHART_COLORS = [
  'var(--color-success-500)',
  'var(--color-primary-500)',
  'var(--color-warning-500)',
  'var(--color-orange-500)',
  'var(--color-error-500)',
];

export function AssetAgingReport() {
  const [report, setReport] = useState<AssetAgingReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.assetAging(filters);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const getDepreciationStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'FULLY_DEPRECIATED':
        return <span className={`${styles.statusBadge} ${styles.statusError}`}>Fully Depreciated</span>;
      case 'DEPRECIATING':
        return <span className={`${styles.statusBadge} ${styles.statusWarning}`}>Depreciating</span>;
      case 'NEW':
        return <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>New</span>;
      default:
        return <span className={styles.statusBadge}>{status}</span>;
    }
  };

  const renderAgeRangeChart = (ageRanges: AssetAgingReportType['ageRanges']) => {
    if (!ageRanges || ageRanges.length === 0) return null;

    const maxCount = Math.max(...ageRanges.map((r) => r.count));

    return (
      <div className={styles.barChart}>
        {ageRanges.map((range, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel}>{range.range}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(range.count / maxCount) * 100}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <span className={styles.barValue}>{range.count}</span>
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
          <button type="button" className={styles.primaryButton} onClick={fetchReport}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalOriginalValue = report?.ageRanges.reduce((sum, r) => sum + r.totalValue, 0) || 0;
  const totalDepreciatedValue = report?.ageRanges.reduce((sum, r) => sum + r.depreciatedValue, 0) || 0;
  const totalDepreciation = totalOriginalValue - totalDepreciatedValue;

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Asset Aging</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Asset Aging Report</h1>
          <p className={styles.reportSubtitle}>
            Assets grouped by age with depreciation status
          </p>
        </div>
        <div className={styles.reportActions}>
          <button type="button" className={styles.secondaryButton} onClick={fetchReport}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
          <ReportExportButton reportType="asset-aging" reportName="Asset Aging" filters={filters} />
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
              <p className={styles.statValue}>{report.assets.length.toLocaleString()}</p>
              <p className={styles.statLabel}>Total Assets</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalOriginalValue)}</p>
              <p className={styles.statLabel}>Original Value</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalDepreciatedValue)}</p>
              <p className={styles.statLabel}>Current Value</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(totalDepreciation)}</p>
              <p className={styles.statLabel}>Total Depreciation</p>
            </div>
          </div>

          {/* Age Range Chart */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Assets by Age Range</h3>
            {renderAgeRangeChart(report.ageRanges)}
          </div>

          {/* Age Range Summary Table */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Age Range Summary</h3>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Age Range</th>
                    <th>Count</th>
                    <th>Original Value</th>
                    <th>Current Value</th>
                    <th>Depreciation</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ageRanges.map((range, index) => (
                    <tr key={index}>
                      <td>{range.range}</td>
                      <td>{range.count.toLocaleString()}</td>
                      <td>{formatCurrency(range.totalValue)}</td>
                      <td>{formatCurrency(range.depreciatedValue)}</td>
                      <td>{formatCurrency(range.totalValue - range.depreciatedValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Asset Details Table */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Asset Details</h3>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Asset Tag</th>
                    <th>Type</th>
                    <th>Acquisition Date</th>
                    <th>Age (Days)</th>
                    <th>Original Value</th>
                    <th>Current Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.assets.slice(0, 50).map((asset, index) => (
                    <tr key={index}>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary-600)' }}>
                        {asset.assetTag}
                      </td>
                      <td>{asset.assetType}</td>
                      <td>{formatDate(asset.acquisitionDate)}</td>
                      <td>{asset.ageInDays.toLocaleString()}</td>
                      <td>{formatCurrency(asset.originalValue)}</td>
                      <td>{formatCurrency(asset.currentValue)}</td>
                      <td>{getDepreciationStatusBadge(asset.depreciationStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {report.assets.length > 50 && (
              <p style={{ marginTop: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Showing 50 of {report.assets.length} assets. Export the report to see all assets.
              </p>
            )}
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

export default AssetAgingReport;
