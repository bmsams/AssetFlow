/**
 * CSV Exporter
 *
 * Exports report data to CSV format with configurable options.
 *
 * Requirements:
 * - 16.3: Export reports in CSV format
 */

import type { CSVExportOptions } from '../report/report-types';

export interface CSVExportConfig {
  readonly delimiter: string;
  readonly includeHeaders: boolean;
  readonly dateFormat: string;
  readonly numberFormat: string;
  readonly lineEnding: string;
  readonly quoteChar: string;
  readonly escapeChar: string;
}

const DEFAULT_CONFIG: CSVExportConfig = {
  delimiter: ',',
  includeHeaders: true,
  dateFormat: 'ISO',
  numberFormat: '2',
  lineEnding: '\n',
  quoteChar: '"',
  escapeChar: '"',
};

/**
 * Build CSV export configuration from options
 */
export function buildCSVConfig(options?: CSVExportOptions): CSVExportConfig {
  return {
    ...DEFAULT_CONFIG,
    delimiter: options?.delimiter ?? DEFAULT_CONFIG.delimiter,
    includeHeaders: options?.includeHeaders ?? DEFAULT_CONFIG.includeHeaders,
    dateFormat: options?.dateFormat ?? DEFAULT_CONFIG.dateFormat,
    numberFormat: options?.numberFormat ?? DEFAULT_CONFIG.numberFormat,
  };
}

/**
 * Escape a CSV field value
 */
export function escapeCSVField(value: string, config: CSVExportConfig): string {
  const { delimiter, quoteChar, escapeChar, lineEnding } = config;
  const needsQuoting =
    value.includes(delimiter) ||
    value.includes(quoteChar) ||
    value.includes(lineEnding) ||
    value.includes('\r');

  if (!needsQuoting) {
    return value;
  }

  const escaped = value.replace(
    new RegExp(escapeChar, 'g'),
    escapeChar + escapeChar
  );
  return `${quoteChar}${escaped}${quoteChar}`;
}

/**
 * Format a value for CSV export
 */
export function formatCSVValue(
  value: unknown,
  config: CSVExportConfig
): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    const decimals = parseInt(config.numberFormat, 10) || 2;
    return value.toFixed(decimals);
  }

  if (value instanceof Date) {
    return formatDate(value, config.dateFormat);
  }

  if (typeof value === 'string' && isISODateString(value)) {
    return formatDate(new Date(value), config.dateFormat);
  }

  if (Array.isArray(value)) {
    return value.map(v => String(v)).join('; ');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return escapeCSVField(String(value), config);
}

/**
 * Format a date according to the specified format
 */
function formatDate(date: Date, format: string): string {
  switch (format) {
    case 'ISO':
      return date.toISOString();
    case 'DATE_ONLY':
      return date.toISOString().split('T')[0] ?? '';
    case 'US':
      return date.toLocaleDateString('en-US');
    case 'EU':
      return date.toLocaleDateString('en-GB');
    default:
      return date.toISOString();
  }
}


/**
 * Check if a string is an ISO date string
 */
function isISODateString(value: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  return isoDateRegex.test(value);
}

/**
 * Export rows to CSV format
 */
export function exportToCSV(
  rows: readonly Record<string, unknown>[],
  options?: CSVExportOptions
): string {
  if (rows.length === 0) {
    return '';
  }

  const config = buildCSVConfig(options);
  const lines: string[] = [];
  const firstRow = rows[0];

  if (!firstRow) {
    return '';
  }

  const headers = Object.keys(firstRow);

  if (config.includeHeaders) {
    lines.push(
      headers.map(h => escapeCSVField(h, config)).join(config.delimiter)
    );
  }

  for (const row of rows) {
    const values = headers.map(header => {
      const value = row[header];
      return formatCSVValue(value, config);
    });
    lines.push(values.join(config.delimiter));
  }

  return lines.join(config.lineEnding);
}

/**
 * Export report data with metadata header
 */
export function exportReportToCSV(
  title: string,
  generatedAt: string,
  rows: readonly Record<string, unknown>[],
  options?: CSVExportOptions
): string {
  const config = buildCSVConfig(options);
  const lines: string[] = [];

  // Add report header
  lines.push(`Report: ${escapeCSVField(title, config)}`);
  lines.push(`Generated: ${generatedAt}`);
  lines.push(''); // Empty line separator

  // Add data
  const dataCSV = exportToCSV(rows, options);
  if (dataCSV) {
    lines.push(dataCSV);
  }

  return lines.join(config.lineEnding);
}


/**
 * Export grouped data to CSV with subtotals
 */
export function exportGroupedToCSV(
  groups: readonly { groupKey: string; groupValue: unknown; rows: readonly Record<string, unknown>[] }[],
  options?: CSVExportOptions
): string {
  if (groups.length === 0) {
    return '';
  }

  const config = buildCSVConfig(options);
  const lines: string[] = [];

  // Get headers from first group's first row
  const firstGroup = groups[0];
  const firstRow = firstGroup?.rows[0];
  if (!firstRow) {
    return '';
  }

  const headers = Object.keys(firstRow);

  if (config.includeHeaders) {
    lines.push(
      headers.map(h => escapeCSVField(h, config)).join(config.delimiter)
    );
  }

  for (const group of groups) {
    // Add group header
    lines.push(`--- ${group.groupKey}: ${String(group.groupValue)} ---`);

    // Add group rows
    for (const row of group.rows) {
      const values = headers.map(header => {
        const value = row[header];
        return formatCSVValue(value, config);
      });
      lines.push(values.join(config.delimiter));
    }

    lines.push(''); // Empty line between groups
  }

  return lines.join(config.lineEnding);
}

/**
 * Parse CSV content back to rows (for testing/validation)
 */
export function parseCSV(
  content: string,
  options?: CSVExportOptions
): Record<string, string>[] {
  const config = buildCSVConfig(options);
  const lines = content.split(config.lineEnding).filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0];
  if (!headerLine) {
    return [];
  }

  const headers = parseCSVLine(headerLine, config);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = parseCSVLine(line, config);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single CSV line into values
 */
function parseCSVLine(line: string, config: CSVExportConfig): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === config.quoteChar && nextChar === config.quoteChar) {
        current += config.quoteChar;
        i++; // Skip next quote
      } else if (char === config.quoteChar) {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === config.quoteChar) {
        inQuotes = true;
      } else if (char === config.delimiter) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  values.push(current);
  return values;
}
