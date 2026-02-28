/**
 * PDF Exporter
 *
 * Exports report data to PDF format with configurable options.
 * Uses a JSON-based intermediate format that can be processed by
 * a dedicated PDF generation service or library.
 *
 * Requirements:
 * - 16.3: Export reports in PDF format
 */

import type { PDFExportOptions } from '../report/report-types';

export type PageSize = 'A4' | 'LETTER' | 'LEGAL';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';

export interface PDFExportConfig {
  readonly pageSize: PageSize;
  readonly orientation: PageOrientation;
  readonly includeHeader: boolean;
  readonly includeFooter: boolean;
  readonly includeLogo: boolean;
  readonly includeCharts: boolean;
  readonly margins: PDFMargins;
  readonly headerStyle: PDFTextStyle;
  readonly titleStyle: PDFTextStyle;
  readonly tableHeaderStyle: PDFTextStyle;
  readonly tableDataStyle: PDFTextStyle;
  readonly footerStyle: PDFTextStyle;
}

export interface PDFMargins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface PDFTextStyle {
  readonly fontSize: number;
  readonly fontWeight: 'normal' | 'bold';
  readonly fontStyle: 'normal' | 'italic';
  readonly color: string;
  readonly backgroundColor?: string;
  readonly alignment: 'left' | 'center' | 'right';
}

export interface PDFTableColumn {
  readonly header: string;
  readonly field: string;
  readonly width?: number;
  readonly alignment?: 'left' | 'center' | 'right';
  readonly format?: string;
}


export interface PDFTable {
  readonly columns: readonly PDFTableColumn[];
  readonly rows: readonly Record<string, unknown>[];
  readonly headerStyle?: PDFTextStyle;
  readonly dataStyle?: PDFTextStyle;
  readonly alternateRowColor?: string;
  readonly borderColor?: string;
}

export interface PDFSection {
  readonly type: 'title' | 'subtitle' | 'text' | 'table' | 'chart' | 'spacer' | 'pageBreak';
  readonly content?: string | PDFTable | PDFChart;
  readonly style?: PDFTextStyle;
  readonly height?: number;
}

export interface PDFChart {
  readonly type: 'bar' | 'line' | 'pie' | 'doughnut';
  readonly title?: string;
  readonly data: readonly { label: string; value: number; color?: string }[];
  readonly width?: number;
  readonly height?: number;
}

export interface PDFDocument {
  readonly title: string;
  readonly author?: string;
  readonly createdAt: string;
  readonly config: PDFExportConfig;
  readonly sections: readonly PDFSection[];
  readonly metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: PDFExportConfig = {
  pageSize: 'A4',
  orientation: 'PORTRAIT',
  includeHeader: true,
  includeFooter: true,
  includeLogo: false,
  includeCharts: false,
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  headerStyle: {
    fontSize: 10,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#666666',
    alignment: 'right',
  },
  titleStyle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#333333',
    alignment: 'center',
  },
  tableHeaderStyle: {
    fontSize: 10,
    fontWeight: 'bold',
    fontStyle: 'normal',
    color: '#FFFFFF',
    backgroundColor: '#4472C4',
    alignment: 'center',
  },
  tableDataStyle: {
    fontSize: 9,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#333333',
    alignment: 'left',
  },
  footerStyle: {
    fontSize: 8,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#999999',
    alignment: 'center',
  },
};


/**
 * Build PDF export configuration from options
 */
export function buildPDFConfig(options?: PDFExportOptions): PDFExportConfig {
  return {
    ...DEFAULT_CONFIG,
    pageSize: options?.pageSize ?? DEFAULT_CONFIG.pageSize,
    orientation: options?.orientation ?? DEFAULT_CONFIG.orientation,
    includeHeader: options?.includeHeader ?? DEFAULT_CONFIG.includeHeader,
    includeFooter: options?.includeFooter ?? DEFAULT_CONFIG.includeFooter,
    includeLogo: options?.includeLogo ?? DEFAULT_CONFIG.includeLogo,
    includeCharts: options?.includeCharts ?? DEFAULT_CONFIG.includeCharts,
  };
}

/**
 * Infer table columns from row data
 */
export function inferTableColumns(
  rows: readonly Record<string, unknown>[]
): PDFTableColumn[] {
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  if (!firstRow) {
    return [];
  }

  return Object.keys(firstRow).map(field => ({
    header: formatHeaderName(field),
    field,
    alignment: detectAlignment(firstRow[field]),
  }));
}

/**
 * Format a field name as a header
 */
function formatHeaderName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Detect alignment based on value type
 */
function detectAlignment(value: unknown): 'left' | 'center' | 'right' {
  if (typeof value === 'number') {
    return 'right';
  }
  if (typeof value === 'boolean') {
    return 'center';
  }
  if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return 'center';
  }
  return 'left';
}


/**
 * Format a cell value for PDF
 */
export function formatPDFValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  if (value instanceof Date) {
    return value.toLocaleDateString('en-US');
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString('en-US');
  }

  return String(value);
}

/**
 * Create a PDF table from rows
 */
export function createPDFTable(
  rows: readonly Record<string, unknown>[],
  config: PDFExportConfig
): PDFTable {
  const columns = inferTableColumns(rows);

  const formattedRows = rows.map(row => {
    const formatted: Record<string, unknown> = {};
    for (const col of columns) {
      formatted[col.field] = formatPDFValue(row[col.field]);
    }
    return formatted;
  });

  return {
    columns,
    rows: formattedRows,
    headerStyle: config.tableHeaderStyle,
    dataStyle: config.tableDataStyle,
    alternateRowColor: '#F5F5F5',
    borderColor: '#CCCCCC',
  };
}

/**
 * Create a PDF document from report data
 */
export function createPDFDocument(
  title: string,
  rows: readonly Record<string, unknown>[],
  options?: PDFExportOptions,
  summary?: Record<string, unknown>
): PDFDocument {
  const config = buildPDFConfig(options);
  const sections: PDFSection[] = [];

  // Add title
  sections.push({
    type: 'title',
    content: title,
    style: config.titleStyle,
  });

  sections.push({ type: 'spacer', height: 20 });

  // Add summary if provided
  if (summary && Object.keys(summary).length > 0) {
    sections.push({
      type: 'subtitle',
      content: 'Summary',
      style: { ...config.titleStyle, fontSize: 14 },
    });

    const summaryText = Object.entries(summary)
      .map(([key, value]) => `${formatHeaderName(key)}: ${formatPDFValue(value)}`)
      .join('\n');

    sections.push({
      type: 'text',
      content: summaryText,
      style: config.tableDataStyle,
    });

    sections.push({ type: 'spacer', height: 20 });
  }

  // Add data table
  if (rows.length > 0) {
    const table = createPDFTable(rows, config);
    sections.push({
      type: 'table',
      content: table,
    });
  }

  return {
    title,
    createdAt: new Date().toISOString(),
    config,
    sections,
  };
}


/**
 * Export rows to PDF format (returns base64-encoded JSON document)
 */
export function exportToPDF(
  rows: readonly Record<string, unknown>[],
  options?: PDFExportOptions,
  title?: string,
  summary?: Record<string, unknown>
): string {
  const document = createPDFDocument(
    title ?? 'Report',
    rows,
    options,
    summary
  );

  return Buffer.from(JSON.stringify(document)).toString('base64');
}

/**
 * Export report with metadata to PDF format
 */
export function exportReportToPDF(
  title: string,
  generatedAt: string,
  generatedBy: string,
  rows: readonly Record<string, unknown>[],
  options?: PDFExportOptions,
  summary?: Record<string, unknown>
): string {
  const config = buildPDFConfig(options);
  const sections: PDFSection[] = [];

  // Add title
  sections.push({
    type: 'title',
    content: title,
    style: config.titleStyle,
  });

  // Add generation info
  sections.push({
    type: 'text',
    content: `Generated: ${new Date(generatedAt).toLocaleString('en-US')}`,
    style: { ...config.footerStyle, alignment: 'center' },
  });

  sections.push({ type: 'spacer', height: 20 });

  // Add summary if provided
  if (summary && Object.keys(summary).length > 0) {
    sections.push({
      type: 'subtitle',
      content: 'Summary',
      style: { ...config.titleStyle, fontSize: 14 },
    });

    const summaryText = Object.entries(summary)
      .map(([key, value]) => `${formatHeaderName(key)}: ${formatPDFValue(value)}`)
      .join('\n');

    sections.push({
      type: 'text',
      content: summaryText,
      style: config.tableDataStyle,
    });

    sections.push({ type: 'spacer', height: 20 });
  }

  // Add data table
  if (rows.length > 0) {
    const table = createPDFTable(rows, config);
    sections.push({
      type: 'table',
      content: table,
    });
  }

  const document: PDFDocument = {
    title,
    author: generatedBy,
    createdAt: generatedAt,
    config,
    sections,
    metadata: {
      reportTitle: title,
      generatedAt,
      generatedBy,
      totalRecords: rows.length,
    },
  };

  return Buffer.from(JSON.stringify(document)).toString('base64');
}

/**
 * Add a chart to PDF document
 */
export function createPDFChart(
  type: 'bar' | 'line' | 'pie' | 'doughnut',
  data: readonly { label: string; value: number; color?: string }[],
  title?: string
): PDFChart {
  return {
    type,
    title,
    data,
    width: 400,
    height: 300,
  };
}

/**
 * Parse PDF document from base64 (for testing/validation)
 */
export function parsePDFDocument(base64Content: string): PDFDocument {
  const json = Buffer.from(base64Content, 'base64').toString('utf-8');
  return JSON.parse(json) as PDFDocument;
}
