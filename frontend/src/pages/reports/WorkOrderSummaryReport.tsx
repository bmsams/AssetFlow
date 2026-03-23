import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { WorkOrderSummaryReport as WorkOrderSummaryReportType, ReportFilters } from '../../types/report';
import { formatDateTime } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Work Order Summary Report Component
 * Implements Task 18.1.8: Create WorkOrderSummaryReport.tsx
 * Validates: Requirements 20.1 - Work order counts by status, type, and priority
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

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'var(--color-primary-500)',
  ASSIGNED: 'var(--color-cyan-500)',
  IN_PROGRESS: 'var(--color-warning-500)',
  ON_HOLD: 'var(--color-orange-500)',
  PENDING_PARTS: 'var(--color-purple-500)',
  PENDING_APPROVAL: 'var(--color-pink-500)',
  COMPLETED: 'var(--color-success-500)',
  CANCELLED: 'var(--color-gray-500)',
  CLOSED: 'var(--color-gray-600)',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'var(--color-error-600)',
  HIGH: 'var(--color-error-500)',
  MEDIUM: 'var(--color-warning-500)',
  LOW: 'var(--color-success-500)',
};

export function WorkOrderSummaryReport() {
  const [report, setReport] = useState<WorkOrderSummaryReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.workOrderSummary(filters);
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

  const renderStatusChart = (byStatus: WorkOrderSummaryReportType['byStatus']) => {
    if (!byStatus || byStatus.length === 0) return null;

    const total = byStatus.reduce((sum, s) => sum + s.count, 0);

    return (
      <div className={styles.barChart}>
        {byStatus.map((item, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel}>{item.status.replace(/_/g, ' ')}</span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(item.count / total) * 100}%`,
                  backgroundColor: STATUS_COLORS[item.status] || CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <span className={styles.barValue}>{item.count}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderTypeChart = (byType: WorkOrderSummaryReportType['byType']) => {
    if (!byType || byType.length === 0) return null;

    const maxCount = Math.max(...byType.map((t) => t.count));

    return (
      <div className={styles.barChart}>
        {byType.map((item, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel}>{item.type.replace(/_/g, ' ')}</span>
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

  const renderPriorityPieChart = (byPriority: WorkOrderSummaryReportType['byPriority']) => {
    if (!byPriority || byPriority.length === 0) return null;

    const total = byPriority.reduce((sum, p) => sum + p.count, 0);

    // Calculate pie chart segments
    let currentAngle = 0;
    const segments = byPriority.map((item) => {
      const percentage = (item.count / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      return {
        ...item,
        percentage,
        startAngle,
        endAngle: currentAngle,
        color: PRIORITY_COLORS[item.priority] || 'var(--color-gray-500)',
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
              <span className={styles.legendLabel}>{segment.priority}</span>
              <span className={styles.legendValue}>{segment.count} ({segment.percentage.toFixed(1)}%)</span>
            </div>
          ))}
        </div>
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

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Work Order Summary</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Work Order Summary Report</h1>
          <p className={styles.reportSubtitle}>
            Work orders by status, type, and priority with completion metrics
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
          <ReportExportButton reportType="work-order-summary" reportName="Work Order Summary" filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="workorder-date-from" className={styles.filterLabel}>From Date</label>
            <input
              id="workorder-date-from"
              type="date"
              className={styles.filterInput}
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="workorder-date-to" className={styles.filterLabel}>To Date</label>
            <input
              id="workorder-date-to"
              type="date"
              className={styles.filterInput}
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
          <div className={styles.filterActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setFilters({
                  dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  dateTo: new Date().toISOString().split('T')[0],
                })
              }
            >
              Last 30 Days
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
              <p className={styles.statValue}>{report.totalWorkOrders.toLocaleString()}</p>
              <p className={styles.statLabel}>Total Work Orders</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.averageCompletionTimeHours.toFixed(1)}h</p>
              <p className={styles.statLabel}>Avg Completion Time</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue} style={{ color: report.overdueCount > 0 ? 'var(--color-error-500)' : 'var(--color-success-500)' }}>
                {report.overdueCount}
              </p>
              <p className={styles.statLabel}>Overdue</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.byType.length}</p>
              <p className={styles.statLabel}>Work Types</p>
            </div>
          </div>

          {/* Charts */}
          <div className={styles.chartsSection}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Work Orders by Status</h3>
              {renderStatusChart(report.byStatus)}
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Work Orders by Priority</h3>
              {renderPriorityPieChart(report.byPriority)}
            </div>
          </div>

          {/* Type Breakdown */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Work Orders by Type</h3>
            {renderTypeChart(report.byType)}
          </div>

          {/* Summary Tables */}
          <div className={styles.chartsSection}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Status Breakdown</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byStatus.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-2)',
                            }}
                          >
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: STATUS_COLORS[item.status] || 'var(--color-gray-500)',
                              }}
                            />
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{item.count.toLocaleString()}</td>
                        <td>{((item.count / report.totalWorkOrders) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Priority Breakdown</h3>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Priority</th>
                      <th>Count</th>
                      <th>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byPriority.map((item, index) => (
                      <tr key={index}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--spacing-2)',
                            }}
                          >
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: PRIORITY_COLORS[item.priority] || 'var(--color-gray-500)',
                              }}
                            />
                            {item.priority}
                          </span>
                        </td>
                        <td>{item.count.toLocaleString()}</td>
                        <td>{((item.count / report.totalWorkOrders) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Generated At */}
          <p className={styles.generatedAt}>
            Report generated at: {formatDateTime(report.generatedAt)} | Period: {report.period.from} to {report.period.to}
          </p>
        </div>
      )}
    </div>
  );
}

export default WorkOrderSummaryReport;

