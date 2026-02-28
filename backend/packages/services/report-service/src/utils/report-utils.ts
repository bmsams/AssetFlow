/**
 * Report Utilities - Shared utility functions for report generation
 *
 * Consolidates common functions used across report services to avoid duplication.
 */

import type { UUID } from '@ams/types';

/**
 * Generate a UUID v4
 * Note: In production, consider using crypto.randomUUID() for better randomness
 */
export function generateUUID(): UUID {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Escape a field for CSV output
 * Wraps field in quotes if it contains comma, newline, or quote characters
 */
export function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('\n') || field.includes('"')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Format a number for display with 2 decimal places
 */
export function formatNumber(value: number): string {
  return value.toFixed(2);
}

/**
 * Get ISO date string for N months ago
 */
export function getDateMonthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
}

/**
 * Format a date range for display
 */
export function formatDateRange(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short' };
  return `${fromDate.toLocaleDateString('en-US', options)} - ${toDate.toLocaleDateString('en-US', options)}`;
}

/**
 * Format a single date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Convert report rows to CSV format
 */
export function rowsToCSV(
  rows: Record<string, unknown>[],
  options?: {
    delimiter?: string;
    includeHeaders?: boolean;
  }
): string {
  if (rows.length === 0) {
    return '';
  }

  const delimiter = options?.delimiter ?? ',';
  const includeHeaders = options?.includeHeaders ?? true;
  const lines: string[] = [];
  const firstRow = rows[0];

  if (includeHeaders && firstRow) {
    const headers = Object.keys(firstRow);
    lines.push(headers.map(h => escapeCSVField(h)).join(delimiter));
  }

  for (const row of rows) {
    const values = Object.values(row).map(v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return formatNumber(v);
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      if (v instanceof Date) return v.toISOString();
      return escapeCSVField(String(v));
    });
    lines.push(values.join(delimiter));
  }

  return lines.join('\n');
}
