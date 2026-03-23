import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { AssetSummaryReport as AssetSummaryReportType, ReportFilters } from '../../types/report';
import { formatDateTime } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Asset Summary Report Component
 * Implements Task 18.1.2: Create AssetSummaryReport.tsx
 * Validates: Requirements 18.1 - Asset summary report with aggregated counts by type, status, and location
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

export function AssetSummaryReport() {
  const [report, setReport] = useState<AssetSummaryReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({});
  const [timedOut, setTimedOut] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setTimedOut(false);
      const data = await reportApi.assetSummary(filters);
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

  useEffect(() => {
    if (!isLoading) return;

    const timer = window.setTimeout(() => {
      setTimedOut(true);
      setError('Report request timed out. Please try again.');
      setIsLoading(false);
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [isLoading]);

  const handleFilterChange = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  };

  const renderPieChart = (data: readonly { type?: string; status?: string; count: number; percentage: number }[], labelKey: 'type' | 'status') => {
    if (!data || data.length === 0) return null;

    // Calculate pie chart segments
    let currentAngle = 0;
    const segments = data.map((item, index) => {
      const angle = (item.percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return {
        ...item,
        startAngle,
        endAngle: currentAngle,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });

    // Create SVG path for each segment
    const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;
      const x1 = 80 + radius * Math.cos(startRad);
      const y1 = 80 + radius * Math.sin(startRad);
      const x2 = 80 + radius * Math.cos(endRad);
      const y2 = 80 + radius * Math.sin(endRad);
      const largeArc = endAngle - startAngle > 180 ? 1 : 0;
      return `M 80 80 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    };

    return (
      <div className={styles.pieChartContainer}>
        <svg viewBox="0 0 160 160" className={styles.pieChart}>
          {segments.map((segment, index) => (
            <path
              key={index}
              d={createArcPath(segment.startAngle, segment.endAngle, 70)}
              fill={segment.color}
            />
          ))}
          <circle cx="80" cy="80" r="35" fill="var(--color-surface)" />
        </svg>
        <div className={styles.pieLegend}>
          {segments.map((segment, index) => (
            <div key={index} className={styles.legendItem}>
              <div className={styles.legendColor} style={{ backgroundColor: segment.color }} />
              <span className={styles.legendLabel}>{segment[labelKey]}</span>
              <span className={styles.legendValue}>{segment.count} ({segment.percentage.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = (data: readonly { location: string; count: number }[]) => {
    if (!data || data.length === 0) return null;

    const maxCount = Math.max(...data.map((d) => d.count));

    return (
      <div className={styles.barChart}>
        {data.slice(0, 10).map((item, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel}>{item.location}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <span className={styles.barValue}>{item.count}</span>
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
          <p>{timedOut ? 'Loading timed out.' : 'Loading report...'}</p>
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
        <Link to="/" className={styles.breadcrumbLink}>Dashboard</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Asset Summary</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Asset Summary Report</h1>
          <p className={styles.reportSubtitle}>
            Overview of all assets by type, status, and location
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
          <ReportExportButton reportType="asset-summary" reportName="Asset Summary" filters={filters} />
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
              <option value="ORDERED">Ordered</option>
              <option value="RECEIVED">Received</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="DEPLOYED">Deployed</option>
              <option value="IN_MAINTENANCE">In Maintenance</option>
              <option value="RETIRED">Retired</option>
              <option value="DISPOSED">Disposed</option>
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
              <p className={styles.statValue}>{report.totalAssets.toLocaleString()}</p>
              <p className={styles.statLabel}>Total Assets</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.byType.length}</p>
              <p className={styles.statLabel}>Asset Types</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.byStatus.length}</p>
              <p className={styles.statLabel}>Status Categories</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.byLocation.length}</p>
              <p className={styles.statLabel}>Locations</p>
            </div>
          </div>

          {/* Charts */}
          <div className={styles.chartsSection}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Assets by Type</h3>
              {renderPieChart(report.byType, 'type')}
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Assets by Status</h3>
              {renderPieChart(report.byStatus, 'status')}
            </div>
          </div>

          {/* Location Breakdown */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Assets by Location (Top 10)</h3>
            {renderBarChart(report.byLocation)}
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

export default AssetSummaryReport;

