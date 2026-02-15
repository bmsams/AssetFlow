import type { HTMLAttributes, ReactNode } from 'react';
import styles from './StatCard.module.css';

export type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
export type StatCardSize = 'sm' | 'md' | 'lg';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  /** The label/title of the stat */
  label: string;
  /** The main value to display */
  value: string | number;
  /** Optional subtitle or additional info */
  subtitle?: string;
  /** Optional icon to display */
  icon?: ReactNode;
  /** Visual variant */
  variant?: StatCardVariant;
  /** Size of the card */
  size?: StatCardSize;
  /** Trend indicator (positive/negative percentage) */
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Whether the card is in loading state */
  isLoading?: boolean;
}

/**
 * StatCard component for displaying key metrics
 * Implements Requirement 12.1: Display total asset value and counts by category
 */
export function StatCard({
  label,
  value,
  subtitle,
  icon,
  variant = 'default',
  size = 'md',
  trend,
  isLoading = false,
  className = '',
  ...props
}: StatCardProps) {
  const cardClasses = [
    styles.statCard,
    styles[variant],
    styles[size],
    isLoading ? styles.loading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (isLoading) {
    return (
      <div className={cardClasses} aria-busy="true" {...props}>
        <div className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonLabel} />
          <div className={styles.skeletonValue} />
        </div>
        <span className="sr-only">Loading statistic</span>
      </div>
    );
  }

  return (
    <div className={cardClasses} {...props}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
      </div>
      <div className={styles.content}>
        <span className={styles.value}>{value}</span>
        {trend && (
          <span
            className={`${styles.trend} ${styles[`trend${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)}`]}`}
            aria-label={`${trend.direction === 'up' ? 'Increased' : trend.direction === 'down' ? 'Decreased' : 'No change'} by ${Math.abs(trend.value)}%`}
          >
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.direction === 'neutral' && '→'}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}

export default StatCard;
