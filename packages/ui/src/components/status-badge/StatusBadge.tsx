import type { HTMLAttributes } from 'react';
import styles from './StatusBadge.module.css';

export type StatusBadgeVariant = 'pill' | 'dot' | 'outline';
export type StatusBadgeSize = 'xs' | 'sm' | 'md';
export type StatusBadgeColor = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: string;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  color?: StatusBadgeColor;
  pulse?: boolean;
  label?: string;
}

function formatStatus(status: string): string {
  return status.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  variant = 'pill',
  size = 'md',
  color = 'neutral',
  pulse = false,
  label,
  className = '',
  ...props
}: StatusBadgeProps) {
  const classes = [
    styles.badge,
    styles[size],
    styles[variant],
    styles[color],
    pulse ? styles.pulse : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {label || formatStatus(status)}
    </span>
  );
}
