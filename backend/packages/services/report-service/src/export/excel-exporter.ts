/**
 * Excel Exporter
 *
 * Exports report data to Excel format with configurable options.
 * Uses a JSON-based intermediate format that can be processed by
 * a dedicated Excel generation service or library.
 *
 * Requirements:
 * - 16.3: Export reports in Excel format
 */

import type { ExcelExportOptions } from '../report/report-types';

export interface ExcelExportConfig {
  readonly sheetName: string;
  readonly includeCharts: boolean;
  readonly freezeHeaders: boolean;
  readonly autoFilter: boolean;
  readonly columnWidths: Record<string, number>;
  readonly defaultColumnWidth: number;
  readonly headerStyle: ExcelCellStyle;
  readonly dataStyle: ExcelCellStyle;
  readonly numberStyle: ExcelCellStyle;
  readonly dateStyle: ExcelCellStyle;
  readonly currencyStyle: ExcelCellStyle;
}

export interface ExcelCellStyle {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly fontSize?: number;
  readonly fontColor?: string;
  readonly backgroundColor?: string;
  readonly borderStyle?: 'thin' | 'medium' | 'thick' | 'none';
  readonly horizontalAlign?: 'left' | 'center' | 'right';
  readonly verticalAlign?: 'top' | 'middle' | 'bottom';
  readonly numberFormat?: string;
  readonly wrapText?: boolean;
}

export interface ExcelColumn {
  readonly header: string;
  readonly field: string;
  readonly width?: number;
  readonly dataType: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  readonly format?: string;
  readonly style?: ExcelCellStyle;
}


export interface ExcelSheet {
  readonly name: string;
  readonly columns: readonly ExcelColumn[];
  readonly rows: readonly Record<string, unknown>[];
  readonly freezeRow?: number;
  readonly freezeColumn?: number;
  readonly autoFilter?: boolean;
  readonly summary?: Record<string, unknown>;
}

export interface ExcelWorkbook {
  readonly title: string;
  readonly author?: string;
  readonly createdAt: string;
  readonly sheets: readonly ExcelSheet[];
  readonly metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: ExcelExportConfig = {
  sheetName: 'Report',
  includeCharts: false,
  freezeHeaders: true,
  autoFilter: true,
  columnWidths: {},
  defaultColumnWidth: 15,
  headerStyle: {
    bold: true,
    backgroundColor: '#4472C4',
    fontColor: '#FFFFFF',
    horizontalAlign: 'center',
    borderStyle: 'thin',
  },
  dataStyle: {
    borderStyle: 'thin',
    horizontalAlign: 'left',
  },
  numberStyle: {
    borderStyle: 'thin',
    horizontalAlign: 'right',
    numberFormat: '#,##0.00',
  },
  dateStyle: {
    borderStyle: 'thin',
    horizontalAlign: 'center',
    numberFormat: 'yyyy-mm-dd',
  },
  currencyStyle: {
    borderStyle: 'thin',
    horizontalAlign: 'right',
    numberFormat: '$#,##0.00',
  },
};

/**
 * Build Excel export configuration from options
 */
export function buildExcelConfig(options?: ExcelExportOptions): ExcelExportConfig {
  return {
    ...DEFAULT_CONFIG,
    sheetName: options?.sheetName ?? DEFAULT_CONFIG.sheetName,
    includeCharts: options?.includeCharts ?? DEFAULT_CONFIG.includeCharts,
    freezeHeaders: options?.freezeHeaders ?? DEFAULT_CONFIG.freezeHeaders,
    autoFilter: options?.autoFilter ?? DEFAULT_CONFIG.autoFilter,
    columnWidths: options?.columnWidths ?? DEFAULT_CONFIG.columnWidths,
  };
}


/**
 * Detect the data type of a value
 */
export function detectDataType(value: unknown): 'string' | 'number' | 'date' | 'boolean' | 'currency' {
  if (value === null || value === undefined) {
    return 'string';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (value instanceof Date) {
    return 'date';
  }

  if (typeof value === 'string') {
    // Check for ISO date string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return 'date';
    }
    // Check for currency (starts with $ or ends with currency code)
    if (/^\$[\d,]+\.?\d*$/.test(value) || /^[\d,]+\.?\d*\s*(USD|EUR|GBP)$/.test(value)) {
      return 'currency';
    }
  }

  return 'string';
}

/**
 * Infer columns from row data
 */
export function inferColumns(
  rows: readonly Record<string, unknown>[],
  config: ExcelExportConfig
): ExcelColumn[] {
  if (rows.length === 0) {
    return [];
  }

  const firstRow = rows[0];
  if (!firstRow) {
    return [];
  }

  const columns: ExcelColumn[] = [];

  for (const [field, value] of Object.entries(firstRow)) {
    const dataType = detectDataType(value);
    const header = formatHeaderName(field);
    const width = config.columnWidths[field] ?? config.defaultColumnWidth;

    columns.push({
      header,
      field,
      width,
      dataType,
    });
  }

  return columns;
}

/**
 * Format a field name as a header (camelCase to Title Case)
 */
function formatHeaderName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}


/**
 * Format a cell value for Excel
 */
export function formatExcelValue(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) {
    return '';
  }

  switch (dataType) {
    case 'boolean':
      return value ? 'Yes' : 'No';
    case 'date':
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    case 'number':
    case 'currency':
      if (typeof value === 'number') {
        return value;
      }
      const parsed = parseFloat(String(value).replace(/[$,]/g, ''));
      return isNaN(parsed) ? value : parsed;
    default:
      return String(value);
  }
}

/**
 * Create an Excel sheet from rows
 */
export function createExcelSheet(
  name: string,
  rows: readonly Record<string, unknown>[],
  config: ExcelExportConfig,
  summary?: Record<string, unknown>
): ExcelSheet {
  const columns = inferColumns(rows, config);

  return {
    name,
    columns,
    rows: rows.map(row => {
      const formattedRow: Record<string, unknown> = {};
      for (const col of columns) {
        formattedRow[col.field] = formatExcelValue(row[col.field], col.dataType);
      }
      return formattedRow;
    }),
    freezeRow: config.freezeHeaders ? 1 : undefined,
    autoFilter: config.autoFilter,
    summary,
  };
}

/**
 * Create an Excel workbook from report data
 */
export function createExcelWorkbook(
  title: string,
  rows: readonly Record<string, unknown>[],
  options?: ExcelExportOptions,
  summary?: Record<string, unknown>
): ExcelWorkbook {
  const config = buildExcelConfig(options);
  const sheet = createExcelSheet(config.sheetName, rows, config, summary);

  return {
    title,
    createdAt: new Date().toISOString(),
    sheets: [sheet],
  };
}


/**
 * Export rows to Excel format (returns base64-encoded JSON workbook)
 */
export function exportToExcel(
  rows: readonly Record<string, unknown>[],
  options?: ExcelExportOptions,
  title?: string,
  summary?: Record<string, unknown>
): string {
  if (rows.length === 0) {
    const emptyWorkbook: ExcelWorkbook = {
      title: title ?? 'Report',
      createdAt: new Date().toISOString(),
      sheets: [],
    };
    return Buffer.from(JSON.stringify(emptyWorkbook)).toString('base64');
  }

  const workbook = createExcelWorkbook(
    title ?? 'Report',
    rows,
    options,
    summary
  );

  return Buffer.from(JSON.stringify(workbook)).toString('base64');
}

/**
 * Export multiple sheets to Excel format
 */
export function exportMultiSheetToExcel(
  sheets: readonly { name: string; rows: readonly Record<string, unknown>[]; summary?: Record<string, unknown> }[],
  options?: ExcelExportOptions,
  title?: string
): string {
  const config = buildExcelConfig(options);

  const excelSheets: ExcelSheet[] = sheets.map(sheet =>
    createExcelSheet(sheet.name, sheet.rows, config, sheet.summary)
  );

  const workbook: ExcelWorkbook = {
    title: title ?? 'Report',
    createdAt: new Date().toISOString(),
    sheets: excelSheets,
  };

  return Buffer.from(JSON.stringify(workbook)).toString('base64');
}

/**
 * Export report with metadata to Excel format
 */
export function exportReportToExcel(
  title: string,
  generatedAt: string,
  generatedBy: string,
  rows: readonly Record<string, unknown>[],
  options?: ExcelExportOptions,
  summary?: Record<string, unknown>
): string {
  const config = buildExcelConfig(options);
  const sheet = createExcelSheet(config.sheetName, rows, config, summary);

  const workbook: ExcelWorkbook = {
    title,
    author: generatedBy,
    createdAt: generatedAt,
    sheets: [sheet],
    metadata: {
      reportTitle: title,
      generatedAt,
      generatedBy,
      totalRecords: rows.length,
    },
  };

  return Buffer.from(JSON.stringify(workbook)).toString('base64');
}

/**
 * Parse Excel workbook from base64 (for testing/validation)
 */
export function parseExcelWorkbook(base64Content: string): ExcelWorkbook {
  const json = Buffer.from(base64Content, 'base64').toString('utf-8');
  return JSON.parse(json) as ExcelWorkbook;
}
