import { type HTMLAttributes } from 'react';
import styles from './Skeleton.module.css';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** The variant of the skeleton */
  variant?: SkeletonVariant;
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Whether to animate the skeleton */
  animation?: 'pulse' | 'wave' | 'none';
  /** Number of lines for text variant */
  lines?: number;
}

/**
 * Skeleton component for loading states
 * Displays placeholder content while data is being fetched
 * Implements Requirement 11.5: Loading states and skeleton screens
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  animation = 'pulse',
  lines = 1,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const classNames = [
    styles.skeleton,
    styles[variant],
    animation !== 'none' ? styles[animation] : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const computedStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  // For text variant with multiple lines
  if (variant === 'text' && lines > 1) {
    return (
      <div className={styles.textContainer} {...props}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={classNames}
            style={{
              ...computedStyle,
              // Make last line shorter for more natural appearance
              width: index === lines - 1 ? '80%' : computedStyle.width,
            }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={classNames}
      style={computedStyle}
      aria-hidden="true"
      {...props}
    />
  );
}

export interface SkeletonCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Whether to show an image placeholder */
  showImage?: boolean;
  /** Number of text lines */
  lines?: number;
}

/**
 * Pre-composed skeleton card for common card layouts
 */
export function SkeletonCard({
  showImage = false,
  lines = 3,
  className = '',
  ...props
}: SkeletonCardProps) {
  return (
    <div className={`${styles.card} ${className}`} {...props}>
      {showImage && (
        <Skeleton variant="rectangular" height={200} className={styles.cardImage} />
      )}
      <div className={styles.cardContent}>
        <Skeleton variant="text" width="60%" height={24} />
        <Skeleton variant="text" lines={lines} />
      </div>
    </div>
  );
}

export interface SkeletonTableProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of rows to display */
  rows?: number;
  /** Number of columns to display */
  columns?: number;
}

/**
 * Pre-composed skeleton table for data tables
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = '',
  ...props
}: SkeletonTableProps) {
  return (
    <div className={`${styles.table} ${className}`} role="presentation" {...props}>
      {/* Header row */}
      <div className={styles.tableRow}>
        {Array.from({ length: columns }).map((_, colIndex) => (
          <div key={`header-${colIndex}`} className={styles.tableCell}>
            <Skeleton variant="text" height={16} />
          </div>
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className={styles.tableRow}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={`cell-${rowIndex}-${colIndex}`} className={styles.tableCell}>
              <Skeleton variant="text" height={14} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SkeletonListProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of items to display */
  items?: number;
  /** Whether to show avatars */
  showAvatar?: boolean;
}

/**
 * Pre-composed skeleton list for list views
 */
export function SkeletonList({
  items = 5,
  showAvatar = false,
  className = '',
  ...props
}: SkeletonListProps) {
  return (
    <div className={`${styles.list} ${className}`} role="presentation" {...props}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className={styles.listItem}>
          {showAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className={styles.listItemContent}>
            <Skeleton variant="text" width="40%" height={16} />
            <Skeleton variant="text" width="70%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}
