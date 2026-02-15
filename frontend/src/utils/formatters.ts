/**
 * Shared formatting utilities for the Asset Management System
 * 
 * Consolidates common formatting functions to avoid duplication
 * across components.
 */

/**
 * Format a number as USD currency
 * @param value - The numeric value to format
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a date string for display (short format)
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date string with time for display
 * @param dateString - ISO date string
 * @returns Formatted date and time string (e.g., "Jan 15, 2025, 2:30 PM")
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a number with thousands separators
 * @param value - The numeric value to format
 * @returns Formatted number string (e.g., "1,234")
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format a percentage value
 * @param value - The numeric value (0-100 or 0-1)
 * @param isDecimal - Whether the value is a decimal (0-1) or percentage (0-100)
 * @returns Formatted percentage string (e.g., "75.5%")
 */
export function formatPercentage(value: number, isDecimal = false): string {
  const percentValue = isDecimal ? value * 100 : value;
  return `${percentValue.toFixed(1)}%`;
}

/**
 * Format a file size in bytes to human-readable format
 * @param bytes - The size in bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format a duration in hours to human-readable format
 * @param hours - The duration in hours
 * @returns Formatted duration string (e.g., "2h 30m" or "3d 4h")
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Format a status string for display (capitalize, replace underscores)
 * @param status - The status string (e.g., "PENDING_APPROVAL")
 * @returns Formatted status string (e.g., "Pending Approval")
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) {
    return '-';
  }
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
