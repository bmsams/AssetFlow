import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../services/report-api';
import type { ProcurementSpendingReport as ProcurementSpendingReportType, ReportFilters } from '../../types/report';
import { formatDateTime, formatCurrency, formatPercentage } from '../../types/report';
import { ReportExportButton } from './ReportExportButton';
import styles from './ReportsPage.module.css';

/**
 * Procurement Spending Report Component
 * Implements Task 18.1.7: Create ProcurementSpendingReport.tsx
 * Validates: Requirements 19.2 - Purchase order totals by vendor, category, and time period
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

export function ProcurementSpendingReport() {
  const [report, setReport] = useState<ProcurementSpendingReportType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await reportApi.procurementSpending(filters);
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

  const renderVendorChart = (vendors: ProcurementSpendingReportType['byVendor']) => {
    if (!vendors || vendors.length === 0) return null;

    const maxAmount = Math.max(...vendors.map((v) => v.totalAmount));

    return (
      <div className={styles.barChart}>
        {vendors.slice(0, 8).map((vendor, index) => (
          <div key={index} className={styles.barItem}>
            <span className={styles.barLabel} title={vendor.vendorName}>
              {vendor.vendorName.length > 15 ? `${vendor.vendorName.substring(0, 15)}...` : vendor.vendorName}
            </span>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${(vendor.totalAmount / maxAmount) * 100}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
            <span className={styles.barValue}>{formatCurrency(vendor.totalAmount)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCategoryPieChart = (categories: ProcurementSpendingReportType['byCategory']) => {
    if (!categories || categories.length === 0) return null;

    // Calculate pie chart segments
    let currentAngle = 0;
    const segments = categories.map((item, index) => {
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
              <span className={styles.legendLabel}>{segment.category}</span>
              <span className={styles.legendValue}>{formatPercentage(segment.percentage)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthlyTrend = (byMonth: ProcurementSpendingReportType['byMonth']) => {
    if (!byMonth || byMonth.length === 0) return null;

    const maxAmount = Math.max(...byMonth.map((m) => m.totalAmount));

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-2)', height: '200px', padding: 'var(--spacing-4) 0' }}>
        {byMonth.map((month, index) => {
          const height = maxAmount > 0 ? (month.totalAmount / maxAmount) * 160 : 0;
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                gap: 'var(--spacing-1)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {formatCurrency(month.totalAmount)}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: '40px',
                  height: `${Math.max(height, 4)}px`,
                  backgroundColor: 'var(--color-primary-500)',
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  transition: 'height 0.3s ease',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                {month.month}
              </span>
            </div>
          );
        })}
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
  const totalPOs = report?.byVendor.reduce((sum, v) => sum + v.poCount, 0) || 0;
  const avgPOValue = totalPOs > 0 ? (report?.totalSpending || 0) / totalPOs : 0;

  return (
    <div className={styles.reportPage}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb}>
        <Link to="/reports" className={styles.breadcrumbLink}>Reports</Link>
        <span className={styles.breadcrumbSeparator}>/</span>
        <span className={styles.breadcrumbCurrent}>Procurement Spending</span>
      </nav>

      {/* Header */}
      <div className={styles.reportHeader}>
        <div className={styles.reportHeaderLeft}>
          <h1 className={styles.reportTitle}>Procurement Spending Report</h1>
          <p className={styles.reportSubtitle}>
            Purchase order totals by vendor, category, and time period
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
          <ReportExportButton reportType="procurement-spending" reportName="Procurement Spending" filters={filters} />
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersSection}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label htmlFor="procurement-date-from" className={styles.filterLabel}>From Date</label>
            <input
              id="procurement-date-from"
              type="date"
              className={styles.filterInput}
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <label htmlFor="procurement-date-to" className={styles.filterLabel}>To Date</label>
            <input
              id="procurement-date-to"
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
                  dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
                  dateTo: new Date().toISOString().split('T')[0],
                })
              }
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
              <p className={styles.statValue}>{formatCurrency(report.totalSpending)}</p>
              <p className={styles.statLabel}>Total Spending</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{totalPOs.toLocaleString()}</p>
              <p className={styles.statLabel}>Purchase Orders</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{report.byVendor.length}</p>
              <p className={styles.statLabel}>Vendors</p>
            </div>
            <div className={styles.statCard}>
              <p className={styles.statValue}>{formatCurrency(avgPOValue)}</p>
              <p className={styles.statLabel}>Avg PO Value</p>
            </div>
          </div>

          {/* Charts */}
          <div className={styles.chartsSection}>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Spending by Vendor (Top 8)</h3>
              {renderVendorChart(report.byVendor)}
            </div>
            <div className={styles.chartCard}>
              <h3 className={styles.chartTitle}>Spending by Category</h3>
              {renderCategoryPieChart(report.byCategory)}
            </div>
          </div>

          {/* Monthly Trend */}
          <div className={styles.chartCard} style={{ marginBottom: 'var(--spacing-6)' }}>
            <h3 className={styles.chartTitle}>Monthly Spending Trend</h3>
            {renderMonthlyTrend(report.byMonth)}
          </div>

          {/* Vendor Details Table */}
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Vendor Details</h3>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>PO Count</th>
                    <th>Total Amount</th>
                    <th>% of Total</th>
                    <th>Avg PO Value</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byVendor.map((vendor, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: 'var(--font-weight-medium)' }}>{vendor.vendorName}</td>
                      <td>{vendor.poCount.toLocaleString()}</td>
                      <td>{formatCurrency(vendor.totalAmount)}</td>
                      <td>{formatPercentage(vendor.percentage)}</td>
                      <td>{formatCurrency(vendor.poCount > 0 ? vendor.totalAmount / vendor.poCount : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

export default ProcurementSpendingReport;

