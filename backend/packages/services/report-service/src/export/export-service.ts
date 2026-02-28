/**
 * Export Service
 *
 * Unified service for exporting report data to multiple formats.
 * Coordinates between CSV, Excel, and PDF exporters.
 *
 * Requirements:
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 */

import { createLogger } from '@ams/utils';

import type {
  CSVExportOptions,
  ExcelExportOptions,
  ExportFormat,
  PDFExportOptions,
  ReportMetadata,
} from '../report/report-types';
import { exportToCSV, exportReportToCSV, exportGroupedToCSV } from './csv-exporter';
import { exportToExcel, exportReportToExcel, exportMultiSheetToExcel } from './excel-exporter';
import { exportToPDF, exportReportToPDF } from './pdf-exporter';

const logger = createLogger({ service: 'export-service' });

export interface ExportOptions {
  readonly csv?: CSVExportOptions;
  readonly excel?: ExcelExportOptions;
  readonly pdf?: PDFExportOptions;
}

export interface ExportRequest {
  readonly format: ExportFormat;
  readonly title: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly options?: ExportOptions;
  readonly summary?: Record<string, unknown>;
  readonly metadata?: ReportMetadata;
}

export interface ExportResult {
  readonly format: ExportFormat;
  readonly content: string;
  readonly contentType: string;
  readonly filename: string;
  readonly size: number;
}

/**
 * Get content type for export format
 */
export function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'CSV':
      return 'text/csv';
    case 'EXCEL':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'PDF':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}


/**
 * Get file extension for export format
 */
export function getFileExtension(format: ExportFormat): string {
  switch (format) {
    case 'CSV':
      return 'csv';
    case 'EXCEL':
      return 'xlsx';
    case 'PDF':
      return 'pdf';
    default:
      return 'bin';
  }
}

/**
 * Generate filename for export
 */
export function generateFilename(title: string, format: ExportFormat): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = getFileExtension(format);
  return `${sanitized}-${timestamp}.${extension}`;
}

/**
 * Export data to the specified format
 */
export function exportData(
  format: ExportFormat,
  rows: readonly Record<string, unknown>[],
  options?: ExportOptions,
  title?: string,
  summary?: Record<string, unknown>
): string {
  switch (format) {
    case 'CSV':
      return exportToCSV(rows, options?.csv);
    case 'EXCEL':
      return exportToExcel(rows, options?.excel, title, summary);
    case 'PDF':
      return exportToPDF(rows, options?.pdf, title, summary);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export report with full metadata
 */
export async function exportReport(request: ExportRequest): Promise<ExportResult> {
  const { format, title, rows, options, summary, metadata } = request;

  logger.info('Exporting report', {
    format,
    title,
    rowCount: rows.length,
  });

  const generatedAt = metadata?.generatedAt ?? new Date().toISOString();
  const generatedBy = metadata?.generatedBy ?? 'system';

  let content: string;

  switch (format) {
    case 'CSV':
      content = exportReportToCSV(title, generatedAt, rows, options?.csv);
      break;
    case 'EXCEL':
      content = exportReportToExcel(title, generatedAt, generatedBy, rows, options?.excel, summary);
      break;
    case 'PDF':
      content = exportReportToPDF(title, generatedAt, generatedBy, rows, options?.pdf, summary);
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const filename = generateFilename(title, format);
  const contentType = getContentType(format);
  const size = format === 'CSV' ? content.length : Buffer.from(content, 'base64').length;

  logger.info('Report exported successfully', {
    format,
    filename,
    size,
  });

  return {
    format,
    content,
    contentType,
    filename,
    size,
  };
}


/**
 * Export grouped data
 */
export function exportGroupedData(
  format: ExportFormat,
  groups: readonly { groupKey: string; groupValue: unknown; rows: readonly Record<string, unknown>[] }[],
  options?: ExportOptions,
  title?: string
): string {
  switch (format) {
    case 'CSV':
      return exportGroupedToCSV(groups, options?.csv);
    case 'EXCEL':
      // Convert groups to sheets for Excel
      const sheets = groups.map(g => ({
        name: `${g.groupKey}: ${String(g.groupValue)}`.substring(0, 31), // Excel sheet name limit
        rows: g.rows,
      }));
      return exportMultiSheetToExcel(sheets, options?.excel, title);
    case 'PDF':
      // Flatten groups for PDF
      const allRows = groups.flatMap(g => g.rows);
      return exportToPDF(allRows, options?.pdf, title);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Validate export format
 */
export function validateExportFormat(format: string): format is ExportFormat {
  return ['CSV', 'EXCEL', 'PDF'].includes(format);
}

/**
 * Get supported export formats
 */
export function getSupportedFormats(): readonly ExportFormat[] {
  return ['CSV', 'EXCEL', 'PDF'] as const;
}

/**
 * Estimate export size (approximate)
 */
export function estimateExportSize(
  format: ExportFormat,
  rowCount: number,
  columnCount: number
): number {
  const avgCellSize = 20; // Average bytes per cell
  const baseSize = rowCount * columnCount * avgCellSize;

  switch (format) {
    case 'CSV':
      return baseSize;
    case 'EXCEL':
      return baseSize * 1.5; // XML overhead
    case 'PDF':
      return baseSize * 2; // PDF structure overhead
    default:
      return baseSize;
  }
}

/**
 * Check if export size is within limits
 */
export function isExportSizeWithinLimits(
  format: ExportFormat,
  rowCount: number,
  columnCount: number,
  maxSizeBytes: number = 50 * 1024 * 1024 // 50MB default
): boolean {
  const estimatedSize = estimateExportSize(format, rowCount, columnCount);
  return estimatedSize <= maxSizeBytes;
}
