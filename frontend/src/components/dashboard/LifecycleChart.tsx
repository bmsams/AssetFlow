import type { HTMLAttributes } from 'react';
import type { LifecycleDistribution } from '../../types/dashboard';
import styles from './LifecycleChart.module.css';

export interface LifecycleChartProps extends HTMLAttributes<HTMLDivElement> {
  /** Distribution data for the chart */
  data: LifecycleDistribution[];
  /** Title for the chart */
  title?: string;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether the chart is in loading state */
  isLoading?: boolean;
  /** Callback when a segment is clicked (for drill-down navigation) */
  onSegmentClick?: (segment: LifecycleDistribution) => void;
}

/**
 * LifecycleChart component for displaying asset lifecycle distribution
 * Implements Requirement 12.1: Show lifecycle distribution charts
 * Implements Requirement 12.8: Drill-down navigation from summary to detail views
 */
export function LifecycleChart({
  data,
  title = 'Lifecycle Distribution',
  showLegend = true,
  isLoading = false,
  onSegmentClick,
  className = '',
  ...props
}: LifecycleChartProps) {
  const chartClasses = [styles.lifecycleChart, className].filter(Boolean).join(' ');

  const totalCount = data.reduce((sum, item) => sum + item.count, 0);

  if (isLoading) {
    return (
      <div className={chartClasses} aria-busy="true" {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.chartContainer}>
          <div className={styles.skeletonChart} aria-hidden="true" />
        </div>
        <span className="sr-only">Loading lifecycle chart</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={chartClasses} {...props}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
        </div>
        <div className={styles.emptyState}>
          <p>No lifecycle data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={chartClasses} {...props}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.totalCount}>{totalCount} total assets</span>
      </div>

      {/* Horizontal Bar Chart */}
      <div className={styles.chartContainer} role="img" aria-label={`Lifecycle distribution chart showing ${data.length} states`}>
        <div className={styles.barChart}>
          {data.map((item) => (
            <button
              key={item.status}
              type="button"
              className={`${styles.barRow} ${onSegmentClick ? styles.clickable : ''}`}
              onClick={() => onSegmentClick?.(item)}
              disabled={!onSegmentClick}
              aria-label={`${item.label}: ${item.count} assets (${item.percentage.toFixed(1)}%). ${onSegmentClick ? 'Click to view details.' : ''}`}
            >
              <div className={styles.barLabel}>
                <span className={styles.statusLabel}>{item.label}</span>
                <span className={styles.statusCount}>{item.count}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                  role="progressbar"
                  aria-valuenow={item.percentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <span className={styles.barPercentage}>{item.percentage.toFixed(1)}%</span>
            </button>
          ))}
        </div>
      </div>

      {/* Donut Chart Summary */}
      <div className={styles.donutContainer}>
        <svg viewBox="0 0 100 100" className={styles.donutChart} aria-hidden="true">
          {renderDonutSegments(data)}
          <circle cx="50" cy="50" r="30" className={styles.donutCenter} />
          <text x="50" y="47" className={styles.donutValue} textAnchor="middle">
            {totalCount}
          </text>
          <text x="50" y="58" className={styles.donutLabel} textAnchor="middle">
            Assets
          </text>
        </svg>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className={styles.legend} role="list" aria-label="Chart legend">
          {data.map((item) => (
            <div key={item.status} className={styles.legendItem} role="listitem">
              <span
                className={styles.legendColor}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Render donut chart segments
 */
function renderDonutSegments(data: LifecycleDistribution[]) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return data.map((item) => {
    const strokeDasharray = (item.percentage / 100) * circumference;
    const strokeDashoffset = -((cumulativePercentage / 100) * circumference);
    cumulativePercentage += item.percentage;

    return (
      <circle
        key={item.status}
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={item.color}
        strokeWidth="20"
        strokeDasharray={`${strokeDasharray} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 50 50)"
        className={styles.donutSegment}
      />
    );
  });
}

export default LifecycleChart;
