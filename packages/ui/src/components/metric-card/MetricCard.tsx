import type { HTMLAttributes, ReactNode } from 'react';
import styles from './MetricCard.module.css';

export type MetricCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

export interface MetricCardTrend {
  value: number;
  direction: 'up' | 'down' | 'neutral';
  period?: string;
}

export interface MetricCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: MetricCardVariant;
  trend?: MetricCardTrend;
  sparkline?: number[];
  isLoading?: boolean;
  onClick?: () => void;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 32;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className={styles.sparklineContainer}>
      <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" data-testid="sparkline">
        <polygon points={areaPoints} fill="currentColor" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
  sparkline,
  isLoading = false,
  onClick,
  className = '',
  ...props
}: MetricCardProps) {
  const cardClasses = [
    styles.card,
    variant !== 'default' ? styles[variant] : '',
    onClick ? styles.interactive : '',
    className,
  ].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <div className={cardClasses} aria-label="Loading metric" aria-busy="true" {...props}>
        <div className={styles.skeleton}>
          <div className={styles.skeletonLabel} />
          <div className={styles.skeletonValue} />
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      </div>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span className={`${styles.trend} ${styles[`trend${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}`]}`}>
            {trend.direction === 'up' && '\u2191'}
            {trend.direction === 'down' && '\u2193'}
            {trend.direction === 'neutral' && '\u2192'}
            {Math.abs(trend.value)}%
            {trend.period && <span className={styles.trendPeriod}>{trend.period}</span>}
          </span>
        )}
      </div>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {sparkline && <Sparkline data={sparkline} />}
    </>
  );

  if (onClick) {
    return (
      <div
        className={cardClasses}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
        {...props}
      >
        {content}
      </div>
    );
  }

  return <div className={cardClasses} {...props}>{content}</div>;
}
