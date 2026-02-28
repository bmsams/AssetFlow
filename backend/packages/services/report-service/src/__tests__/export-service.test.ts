/**
 * Export Service Unit Tests
 *
 * Tests for Export Service:
 * - CSV export (Requirement 16.3)
 * - Excel export (Requirement 16.3)
 * - PDF export (Requirement 16.3)
 * - Export service coordination
 */

import {
  exportToCSV,
  exportReportToCSV,
  exportGroupedToCSV,
  parseCSV,
  escapeCSVField,
  formatCSVValue,
  buildCSVConfig,
} from '../export/csv-exporter';

import {
  exportToExcel,
  exportReportToExcel,
  exportMultiSheetToExcel,
  parseExcelWorkbook,
  detectDataType,
  inferColumns,
  buildExcelConfig,
} from '../export/excel-exporter';

import {
  exportToPDF,
  exportReportToPDF,
  parsePDFDocument,
  buildPDFConfig,
  inferTableColumns,
  formatPDFValue,
} from '../export/pdf-exporter';

import {
  exportData,
  exportReport,
  getContentType,
  getFileExtension,
  generateFilename,
  validateExportFormat,
  getSupportedFormats,
  estimateExportSize,
} from '../export/export-service';

describe('Export Service', () => {
  const sampleRows = [
    { id: '1', name: 'Asset One', value: 1500.50, active: true, createdAt: '2024-01-15T10:00:00.000Z' },
    { id: '2', name: 'Asset Two', value: 2500.75, active: false, createdAt: '2024-02-20T14:30:00.000Z' },
    { id: '3', name: 'Asset, Special', value: 3000, active: true, createdAt: '2024-03-10T09:15:00.000Z' },
  ];


  // ============================================================================
  // CSV Exporter Tests
  // ============================================================================

  describe('CSV Exporter', () => {
    describe('buildCSVConfig', () => {
      it('should return default config when no options provided', () => {
        const config = buildCSVConfig();
        expect(config.delimiter).toBe(',');
        expect(config.includeHeaders).toBe(true);
        expect(config.dateFormat).toBe('ISO');
      });

      it('should override defaults with provided options', () => {
        const config = buildCSVConfig({ delimiter: ';', includeHeaders: false });
        expect(config.delimiter).toBe(';');
        expect(config.includeHeaders).toBe(false);
      });
    });

    describe('escapeCSVField', () => {
      it('should not escape simple strings', () => {
        const config = buildCSVConfig();
        expect(escapeCSVField('simple', config)).toBe('simple');
      });

      it('should escape strings with commas', () => {
        const config = buildCSVConfig();
        expect(escapeCSVField('has, comma', config)).toBe('"has, comma"');
      });

      it('should escape strings with quotes', () => {
        const config = buildCSVConfig();
        expect(escapeCSVField('has "quotes"', config)).toBe('"has ""quotes"""');
      });

      it('should escape strings with newlines', () => {
        const config = buildCSVConfig();
        expect(escapeCSVField('has\nnewline', config)).toBe('"has\nnewline"');
      });
    });

    describe('formatCSVValue', () => {
      it('should format null as empty string', () => {
        const config = buildCSVConfig();
        expect(formatCSVValue(null, config)).toBe('');
      });

      it('should format boolean as Yes/No', () => {
        const config = buildCSVConfig();
        expect(formatCSVValue(true, config)).toBe('Yes');
        expect(formatCSVValue(false, config)).toBe('No');
      });

      it('should format numbers with decimals', () => {
        const config = buildCSVConfig();
        expect(formatCSVValue(1500.5, config)).toBe('1500.50');
      });

      it('should format arrays as semicolon-separated', () => {
        const config = buildCSVConfig();
        expect(formatCSVValue(['a', 'b', 'c'], config)).toBe('a; b; c');
      });
    });

    describe('exportToCSV', () => {
      it('should return empty string for empty rows', () => {
        const result = exportToCSV([]);
        expect(result).toBe('');
      });

      it('should export rows with headers', () => {
        const result = exportToCSV(sampleRows);
        expect(result).toContain('id,name,value,active,createdAt');
        expect(result).toContain('Asset One');
        expect(result).toContain('1500.50');
      });

      it('should escape special characters', () => {
        const result = exportToCSV(sampleRows);
        expect(result).toContain('"Asset, Special"');
      });

      it('should export without headers when configured', () => {
        const result = exportToCSV(sampleRows, { includeHeaders: false });
        expect(result).not.toContain('id,name,value');
        expect(result).toContain('Asset One');
      });
    });

    describe('exportReportToCSV', () => {
      it('should include report header', () => {
        const result = exportReportToCSV('Test Report', '2024-01-15T10:00:00.000Z', sampleRows);
        expect(result).toContain('Report: Test Report');
        expect(result).toContain('Generated: 2024-01-15T10:00:00.000Z');
      });
    });

    describe('exportGroupedToCSV', () => {
      it('should export grouped data with separators', () => {
        const groups = [
          { groupKey: 'Type', groupValue: 'Hardware', rows: [sampleRows[0]!] },
          { groupKey: 'Type', groupValue: 'Software', rows: [sampleRows[1]!] },
        ];
        const result = exportGroupedToCSV(groups);
        expect(result).toContain('--- Type: Hardware ---');
        expect(result).toContain('--- Type: Software ---');
      });
    });

    describe('parseCSV', () => {
      it('should parse CSV back to rows', () => {
        const csv = exportToCSV(sampleRows);
        const parsed = parseCSV(csv);
        expect(parsed.length).toBe(3);
        expect(parsed[0]?.['id']).toBe('1');
        expect(parsed[0]?.['name']).toBe('Asset One');
      });
    });
  });


  // ============================================================================
  // Excel Exporter Tests
  // ============================================================================

  describe('Excel Exporter', () => {
    describe('buildExcelConfig', () => {
      it('should return default config when no options provided', () => {
        const config = buildExcelConfig();
        expect(config.sheetName).toBe('Report');
        expect(config.freezeHeaders).toBe(true);
        expect(config.autoFilter).toBe(true);
      });

      it('should override defaults with provided options', () => {
        const config = buildExcelConfig({ sheetName: 'Custom', freezeHeaders: false });
        expect(config.sheetName).toBe('Custom');
        expect(config.freezeHeaders).toBe(false);
      });
    });

    describe('detectDataType', () => {
      it('should detect string type', () => {
        expect(detectDataType('hello')).toBe('string');
      });

      it('should detect number type', () => {
        expect(detectDataType(123)).toBe('number');
      });

      it('should detect boolean type', () => {
        expect(detectDataType(true)).toBe('boolean');
      });

      it('should detect date type from Date object', () => {
        expect(detectDataType(new Date())).toBe('date');
      });

      it('should detect date type from ISO string', () => {
        expect(detectDataType('2024-01-15T10:00:00.000Z')).toBe('date');
      });

      it('should detect currency type', () => {
        expect(detectDataType('$1,500.00')).toBe('currency');
      });
    });

    describe('inferColumns', () => {
      it('should infer columns from rows', () => {
        const config = buildExcelConfig();
        const columns = inferColumns(sampleRows, config);
        expect(columns.length).toBe(5);
        expect(columns[0]?.field).toBe('id');
        expect(columns[1]?.field).toBe('name');
        expect(columns[2]?.dataType).toBe('number');
      });

      it('should return empty array for empty rows', () => {
        const config = buildExcelConfig();
        const columns = inferColumns([], config);
        expect(columns.length).toBe(0);
      });
    });

    describe('exportToExcel', () => {
      it('should return base64 encoded workbook', () => {
        const result = exportToExcel(sampleRows);
        expect(() => Buffer.from(result, 'base64')).not.toThrow();
      });

      it('should handle empty rows', () => {
        const result = exportToExcel([]);
        const workbook = parseExcelWorkbook(result);
        expect(workbook.sheets.length).toBe(0);
      });

      it('should include summary when provided', () => {
        const summary = { totalAssets: 3, totalValue: 7001.25 };
        const result = exportToExcel(sampleRows, undefined, 'Test', summary);
        const workbook = parseExcelWorkbook(result);
        expect(workbook.sheets[0]?.summary).toEqual(summary);
      });
    });

    describe('exportReportToExcel', () => {
      it('should include metadata in workbook', () => {
        const result = exportReportToExcel(
          'Test Report',
          '2024-01-15T10:00:00.000Z',
          'user-1',
          sampleRows
        );
        const workbook = parseExcelWorkbook(result);
        expect(workbook.title).toBe('Test Report');
        expect(workbook.author).toBe('user-1');
        expect(workbook.metadata?.['totalRecords']).toBe(3);
      });
    });

    describe('exportMultiSheetToExcel', () => {
      it('should create multiple sheets', () => {
        const sheets = [
          { name: 'Sheet1', rows: [sampleRows[0]!] },
          { name: 'Sheet2', rows: [sampleRows[1]!] },
        ];
        const result = exportMultiSheetToExcel(sheets);
        const workbook = parseExcelWorkbook(result);
        expect(workbook.sheets.length).toBe(2);
        expect(workbook.sheets[0]?.name).toBe('Sheet1');
        expect(workbook.sheets[1]?.name).toBe('Sheet2');
      });
    });
  });


  // ============================================================================
  // PDF Exporter Tests
  // ============================================================================

  describe('PDF Exporter', () => {
    describe('buildPDFConfig', () => {
      it('should return default config when no options provided', () => {
        const config = buildPDFConfig();
        expect(config.pageSize).toBe('A4');
        expect(config.orientation).toBe('PORTRAIT');
        expect(config.includeHeader).toBe(true);
      });

      it('should override defaults with provided options', () => {
        const config = buildPDFConfig({ pageSize: 'LETTER', orientation: 'LANDSCAPE' });
        expect(config.pageSize).toBe('LETTER');
        expect(config.orientation).toBe('LANDSCAPE');
      });
    });

    describe('inferTableColumns', () => {
      it('should infer columns from rows', () => {
        const columns = inferTableColumns(sampleRows);
        expect(columns.length).toBe(5);
        expect(columns[0]?.field).toBe('id');
        expect(columns[2]?.alignment).toBe('right'); // number
      });

      it('should return empty array for empty rows', () => {
        const columns = inferTableColumns([]);
        expect(columns.length).toBe(0);
      });
    });

    describe('formatPDFValue', () => {
      it('should format null as empty string', () => {
        expect(formatPDFValue(null)).toBe('');
      });

      it('should format boolean as Yes/No', () => {
        expect(formatPDFValue(true)).toBe('Yes');
        expect(formatPDFValue(false)).toBe('No');
      });

      it('should format numbers with locale', () => {
        expect(formatPDFValue(1500.5)).toContain('1,500');
      });

      it('should format ISO date strings', () => {
        const result = formatPDFValue('2024-01-15T10:00:00.000Z');
        expect(result).toMatch(/2024|1\/15/);
      });
    });

    describe('exportToPDF', () => {
      it('should return base64 encoded document', () => {
        const result = exportToPDF(sampleRows);
        expect(() => Buffer.from(result, 'base64')).not.toThrow();
      });

      it('should include title section', () => {
        const result = exportToPDF(sampleRows, undefined, 'Test Report');
        const doc = parsePDFDocument(result);
        expect(doc.title).toBe('Test Report');
        expect(doc.sections.some(s => s.type === 'title')).toBe(true);
      });

      it('should include summary when provided', () => {
        const summary = { totalAssets: 3 };
        const result = exportToPDF(sampleRows, undefined, 'Test', summary);
        const doc = parsePDFDocument(result);
        expect(doc.sections.some(s => s.type === 'subtitle' && s.content === 'Summary')).toBe(true);
      });
    });

    describe('exportReportToPDF', () => {
      it('should include metadata in document', () => {
        const result = exportReportToPDF(
          'Test Report',
          '2024-01-15T10:00:00.000Z',
          'user-1',
          sampleRows
        );
        const doc = parsePDFDocument(result);
        expect(doc.title).toBe('Test Report');
        expect(doc.author).toBe('user-1');
        expect(doc.metadata?.['totalRecords']).toBe(3);
      });
    });
  });


  // ============================================================================
  // Export Service Tests
  // ============================================================================

  describe('Export Service Coordination', () => {
    describe('getContentType', () => {
      it('should return correct content type for CSV', () => {
        expect(getContentType('CSV')).toBe('text/csv');
      });

      it('should return correct content type for Excel', () => {
        expect(getContentType('EXCEL')).toContain('spreadsheetml');
      });

      it('should return correct content type for PDF', () => {
        expect(getContentType('PDF')).toBe('application/pdf');
      });
    });

    describe('getFileExtension', () => {
      it('should return csv for CSV format', () => {
        expect(getFileExtension('CSV')).toBe('csv');
      });

      it('should return xlsx for Excel format', () => {
        expect(getFileExtension('EXCEL')).toBe('xlsx');
      });

      it('should return pdf for PDF format', () => {
        expect(getFileExtension('PDF')).toBe('pdf');
      });
    });

    describe('generateFilename', () => {
      it('should generate sanitized filename', () => {
        const filename = generateFilename('Test Report 2024', 'CSV');
        expect(filename).toMatch(/^test-report-2024-\d{4}-\d{2}-\d{2}\.csv$/);
      });

      it('should handle special characters', () => {
        const filename = generateFilename('Report: Special & Chars!', 'PDF');
        expect(filename).toMatch(/^report-special-chars-\d{4}-\d{2}-\d{2}\.pdf$/);
      });
    });

    describe('validateExportFormat', () => {
      it('should return true for valid formats', () => {
        expect(validateExportFormat('CSV')).toBe(true);
        expect(validateExportFormat('EXCEL')).toBe(true);
        expect(validateExportFormat('PDF')).toBe(true);
      });

      it('should return false for invalid formats', () => {
        expect(validateExportFormat('INVALID')).toBe(false);
        expect(validateExportFormat('xml')).toBe(false);
      });
    });

    describe('getSupportedFormats', () => {
      it('should return all supported formats', () => {
        const formats = getSupportedFormats();
        expect(formats).toContain('CSV');
        expect(formats).toContain('EXCEL');
        expect(formats).toContain('PDF');
        expect(formats.length).toBe(3);
      });
    });

    describe('estimateExportSize', () => {
      it('should estimate size based on rows and columns', () => {
        const size = estimateExportSize('CSV', 100, 10);
        expect(size).toBeGreaterThan(0);
      });

      it('should estimate larger size for Excel', () => {
        const csvSize = estimateExportSize('CSV', 100, 10);
        const excelSize = estimateExportSize('EXCEL', 100, 10);
        expect(excelSize).toBeGreaterThan(csvSize);
      });

      it('should estimate larger size for PDF', () => {
        const csvSize = estimateExportSize('CSV', 100, 10);
        const pdfSize = estimateExportSize('PDF', 100, 10);
        expect(pdfSize).toBeGreaterThan(csvSize);
      });
    });

    describe('exportData', () => {
      it('should export to CSV format', () => {
        const result = exportData('CSV', sampleRows);
        expect(result).toContain('id,name,value');
      });

      it('should export to Excel format', () => {
        const result = exportData('EXCEL', sampleRows);
        expect(() => Buffer.from(result, 'base64')).not.toThrow();
      });

      it('should export to PDF format', () => {
        const result = exportData('PDF', sampleRows);
        expect(() => Buffer.from(result, 'base64')).not.toThrow();
      });

      it('should throw for unsupported format', () => {
        expect(() => exportData('INVALID' as any, sampleRows)).toThrow('Unsupported export format');
      });
    });

    describe('exportReport', () => {
      it('should export report with metadata', async () => {
        const result = await exportReport({
          format: 'CSV',
          title: 'Test Report',
          rows: sampleRows,
        });

        expect(result.format).toBe('CSV');
        expect(result.filename).toContain('test-report');
        expect(result.contentType).toBe('text/csv');
        expect(result.size).toBeGreaterThan(0);
      });

      it('should include summary in Excel export', async () => {
        const result = await exportReport({
          format: 'EXCEL',
          title: 'Test Report',
          rows: sampleRows,
          summary: { totalAssets: 3 },
        });

        const workbook = parseExcelWorkbook(result.content);
        expect(workbook.sheets[0]?.summary).toEqual({ totalAssets: 3 });
      });

      it('should generate correct filename for each format', async () => {
        for (const format of ['CSV', 'EXCEL', 'PDF'] as const) {
          const result = await exportReport({
            format,
            title: 'Test',
            rows: sampleRows,
          });
          expect(result.filename).toContain(getFileExtension(format));
        }
      });
    });
  });
});
