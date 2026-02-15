/**
 * Defines all possible status variants used throughout the application
 */
export type StatusVariant = 
  | 'active'
  | 'inactive'
  | 'pending'
  | 'inProgress'
  | 'complete'
  | 'draft'
  | 'published'
  | 'approved'
  | 'rejected'
  | 'warning'
  | 'error'
  | 'success'
  | 'info'
  | 'critical'
  | 'onHold'
  | 'canceled'
  | 'scheduled'
  | 'expired';

/**
 * CSS color variable mappings for each status variant
 * These map to CSS variables defined in the application's theme
 */
export const STATUS_COLORS: Record<StatusVariant, string> = {
  // State statuses
  active: 'var(--color-success-600)',
  inactive: 'var(--color-neutral-500)',
  pending: 'var(--color-warning-500)',
  inProgress: 'var(--color-info-500)',
  complete: 'var(--color-success-600)',
  draft: 'var(--color-neutral-500)',
  published: 'var(--color-success-600)',
  approved: 'var(--color-success-600)',
  rejected: 'var(--color-error-600)',
  onHold: 'var(--color-warning-600)',
  canceled: 'var(--color-error-600)',
  scheduled: 'var(--color-info-500)',
  expired: 'var(--color-error-600)',
  
  // Alert/notification statuses
  warning: 'var(--color-warning-500)',
  error: 'var(--color-error-600)',
  success: 'var(--color-success-600)',
  info: 'var(--color-info-500)',
  critical: 'var(--color-error-700)'
};

/**
 * Background colors for status badges with proper contrast ratios
 */
export const STATUS_BACKGROUND_COLORS: Record<StatusVariant, string> = {
  active: 'var(--color-success-100)',
  inactive: 'var(--color-neutral-100)',
  pending: 'var(--color-warning-100)',
  inProgress: 'var(--color-info-100)',
  complete: 'var(--color-success-100)',
  draft: 'var(--color-neutral-100)',
  published: 'var(--color-success-100)',
  approved: 'var(--color-success-100)',
  rejected: 'var(--color-error-100)',
  onHold: 'var(--color-warning-100)',
  canceled: 'var(--color-error-100)',
  scheduled: 'var(--color-info-100)',
  expired: 'var(--color-error-100)',
  
  warning: 'var(--color-warning-100)',
  error: 'var(--color-error-100)',
  success: 'var(--color-success-100)',
  info: 'var(--color-info-100)',
  critical: 'var(--color-error-100)'
};

/**
 * Human-readable display text for each status variant
 */
export const STATUS_DISPLAY_TEXT: Record<StatusVariant, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  inProgress: 'In Progress',
  complete: 'Complete',
  draft: 'Draft',
  published: 'Published',
  approved: 'Approved',
  rejected: 'Rejected',
  onHold: 'On Hold',
  canceled: 'Canceled',
  scheduled: 'Scheduled',
  expired: 'Expired',
  
  warning: 'Warning',
  error: 'Error',
  success: 'Success',
  info: 'Info',
  critical: 'Critical'
};