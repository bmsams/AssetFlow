/**
 * Export Module
 *
 * Unified export functionality for reports in multiple formats.
 *
 * Requirements:
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 */

// CSV Exporter
export {
  buildCSVConfig,
  escapeCSVField,
  formatCSVValue,
  exportToCSV,
  exportReportToCSV,
  exportGroupedToCSV,
  parseCSV,
} from './csv-exporter';
export type { CSVExportConfig } from './csv-exporter';

// Excel Exporter
export {
  buildExcelConfig,
  detectDataType,
  inferColumns,
  formatExcelValue,
  createExcelSheet,
  createExcelWorkbook,
  exportToExcel,
  exportMultiSheetToExcel,
  exportReportToExcel,
  parseExcelWorkbook,
} from './excel-exporter';
export type {
  ExcelExportConfig,
  ExcelCellStyle,
  ExcelColumn,
  ExcelSheet,
  ExcelWorkbook,
} from './excel-exporter';

// PDF Exporter
export {
  buildPDFConfig,
  inferTableColumns,
  formatPDFValue,
  createPDFTable,
  createPDFDocument,
  exportToPDF,
  exportReportToPDF,
  createPDFChart,
  parsePDFDocument,
} from './pdf-exporter';
export type {
  PageSize,
  PageOrientation,
  PDFExportConfig,
  PDFMargins,
  PDFTextStyle,
  PDFTableColumn,
  PDFTable,
  PDFSection,
  PDFChart,
  PDFDocument,
} from './pdf-exporter';

// Export Service
export {
  getContentType,
  getFileExtension,
  generateFilename,
  exportData,
  exportReport,
  exportGroupedData,
  validateExportFormat,
  getSupportedFormats,
  estimateExportSize,
  isExportSizeWithinLimits,
} from './export-service';
export type {
  ExportOptions,
  ExportRequest,
  ExportResult,
} from './export-service';
