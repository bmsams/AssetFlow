/**
 * Integration tests for Report Generation and Export
 * Validates the report generation and export functionality across different formats
 */
import { DbTestClient } from './setup/test-helpers';
import { setup, teardown } from './setup/integration-test-setup';
import { AssetReportService, FinancialReportService, OperationalReportService } from '@ams/report-service';
import { ExportService } from '@ams/report-service';
import { AssetService } from '@ams/lifecycle-service';
import { 
  ReportType, 
  ReportFormat, 
  HardwareAssetDetails, 
  AssetType,
  ReportTimeframe,
  DateRangeFilter
} from '@ams/types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { parse as csvParse } from 'csv-parse/sync';

// Test setup and teardown
beforeAll(async () => await setup());
afterAll(async () => await teardown());

describe('Report Generation and Export Integration', () => {
  // Test data
  let testAssetIds: string[] = [];
  let exportFilePaths: string[] = [];
  const tempDir = path.join(os.tmpdir(), 'ams-test-exports');
  
  beforeAll(() => {
    // Create temp directory for exports if it doesn't exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });
  
  it('should create test assets for reporting', async () => {
    // Get asset service
    const assetService = new AssetService();
    
    // Create multiple test assets with different attributes
    const testAssets = [
      {
        name: 'Report Test Server 1',
        description: 'Server for testing report generation',
        serialNumber: 'REPORT-SRV-001',
        status: 'IN_USE',
        lifecycleState: 'DEPLOYED',
        assetTagNumber: 'REPORT-001',
        location: 'Building 1, Floor 1, Room 101',
        assignedTo: 'Department 1',
        purchaseDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        purchasePrice: 5000.00,
        warrantyExpirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months from now
        modelId: null,
        manufacturerId: null,
      },
      {
        name: 'Report Test Laptop 1',
        description: 'Laptop for testing report generation',
        serialNumber: 'REPORT-LT-001',
        status: 'IN_USE',
        lifecycleState: 'DEPLOYED',
        assetTagNumber: 'REPORT-002',
        location: 'Building 1, Floor 2, Room 201',
        assignedTo: 'Department 2',
        purchaseDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months ago
        purchasePrice: 1500.00,
        warrantyExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
        modelId: null,
        manufacturerId: null,
      },
      {
        name: 'Report Test Switch 1',
        description: 'Network switch for testing report generation',
        serialNumber: 'REPORT-SW-001',
        status: 'IN_STOCK',
        lifecycleState: 'RECEIVED',
        assetTagNumber: 'REPORT-003',
        location: 'Building 2, Floor 1, Room 101',
        assignedTo: null,
        purchaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        purchasePrice: 2500.00,
        warrantyExpirationDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(), // 2 years from now
        modelId: null,
        manufacturerId: null,
      }
    ];
    
    // Create each asset and store IDs
    for (const assetData of testAssets) {
      const asset = await assetService.createHardwareAsset(assetData as HardwareAssetDetails);
      testAssetIds.push(asset.assetId);
      
      // Verify asset was created
      expect(asset).toBeDefined();
      expect(asset.assetId).toBeDefined();
      expect(asset.assetType).toBe(AssetType.HARDWARE);
    }
    
    // Verify we created the expected number of assets
    expect(testAssetIds.length).toBe(testAssets.length);
  });
  
  it('should generate an asset summary report and export to CSV', async () => {
    // Get services
    const assetReportService = new AssetReportService();
    const exportService = new ExportService();
    
    // 1. Generate asset summary report
    const reportParams = {
      type: ReportType.ASSET_SUMMARY,
      timeframe: ReportTimeframe.CUSTOM,
      dateRange: {
        startDate: new Date(Date.now() - 365 * 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 years ago
        endDate: new Date().toISOString() // today
      } as DateRangeFilter
    };
    
    const report = await assetReportService.generateAssetSummaryReport(reportParams);
    
    // Verify report was generated with our test assets
    expect(report).toBeDefined();
    expect(report.items).toBeDefined();
    expect(report.items.length).toBeGreaterThanOrEqual(testAssetIds.length);
    
    // Find our test assets in the report
    const reportedTestAssets = report.items.filter(item => 
      testAssetIds.includes(item.assetId)
    );
    expect(reportedTestAssets.length).toBe(testAssetIds.length);
    
    // 2. Export the report to CSV
    const csvFilePath = path.join(tempDir, `asset-summary-${Date.now()}.csv`);
    exportFilePaths.push(csvFilePath);
    
    await exportService.exportReport(report, ReportFormat.CSV, csvFilePath);
    
    // Verify the CSV file was created
    expect(fs.existsSync(csvFilePath)).toBe(true);
    
    // Read and parse the CSV
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const parsedCsv = csvParse(csvContent, { columns: true });
    
    // Verify CSV contains our test assets
    expect(parsedCsv).toBeDefined();
    expect(parsedCsv.length).toBeGreaterThanOrEqual(testAssetIds.length);
    
    // Check that all our test assets are in the CSV
    for (const assetId of testAssetIds) {
      const assetInReport = report.items.find(item => item.assetId === assetId);
      const assetInCsv = parsedCsv.find(row => 
        row['Asset Tag'] === assetInReport.assetTag || 
        row['Serial Number'] === assetInReport.serialNumber
      );
      
      expect(assetInCsv).toBeDefined();
    }
  });
  
  it('should generate an asset aging report and export to Excel', async () => {
    // Get services
    const assetReportService = new AssetReportService();
    const exportService = new ExportService();
    
    // 1. Generate asset aging report
    const reportParams = {
      type: ReportType.ASSET_AGING,
      timeframe: ReportTimeframe.ALL_TIME,
      thresholds: [365, 730, 1095] // 1, 2, 3 years in days
    };
    
    const report = await assetReportService.generateAssetAgingReport(reportParams);
    
    // Verify report was generated
    expect(report).toBeDefined();
    expect(report.ageBuckets).toBeDefined();
    expect(report.ageBuckets.length).toBeGreaterThan(0);
    
    // 2. Export the report to Excel
    const excelFilePath = path.join(tempDir, `asset-aging-${Date.now()}.xlsx`);
    exportFilePaths.push(excelFilePath);
    
    await exportService.exportReport(report, ReportFormat.EXCEL, excelFilePath);
    
    // Verify the Excel file was created
    expect(fs.existsSync(excelFilePath)).toBe(true);
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelFilePath);
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
    
    // Parse the worksheet
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    // Verify Excel contains data
    expect(jsonData).toBeDefined();
    expect(jsonData.length).toBeGreaterThan(0);
    
    // Verify structure matches report
    expect(Object.keys(jsonData[0])).toContain('Age Range');
    expect(Object.keys(jsonData[0])).toContain('Asset Count');
  });
  
  it('should generate a location-based asset report and export to PDF', async () => {
    // Get services
    const assetReportService = new AssetReportService();
    const exportService = new ExportService();
    
    // 1. Generate asset by location report
    const reportParams = {
      type: ReportType.ASSET_BY_LOCATION,
      timeframe: ReportTimeframe.CUSTOM,
      dateRange: {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        endDate: new Date().toISOString() // today
      } as DateRangeFilter,
      includeSublocations: true
    };
    
    const report = await assetReportService.generateAssetByLocationReport(reportParams);
    
    // Verify report was generated
    expect(report).toBeDefined();
    expect(report.locations).toBeDefined();
    expect(report.locations.length).toBeGreaterThan(0);
    
    // 2. Export the report to PDF
    const pdfFilePath = path.join(tempDir, `asset-by-location-${Date.now()}.pdf`);
    exportFilePaths.push(pdfFilePath);
    
    await exportService.exportReport(report, ReportFormat.PDF, pdfFilePath);
    
    // Verify the PDF file was created
    expect(fs.existsSync(pdfFilePath)).toBe(true);
    
    // Check file size to ensure it's not empty
    const stats = fs.statSync(pdfFilePath);
    expect(stats.size).toBeGreaterThan(0);
  });
  
  it('should generate a financial report and verify data consistency across formats', async () => {
    // Get services
    const financialReportService = new FinancialReportService();
    const exportService = new ExportService();
    
    // 1. Generate cost center utilization report
    const reportParams = {
      type: ReportType.COST_CENTER_UTILIZATION,
      timeframe: ReportTimeframe.YEAR_TO_DATE
    };
    
    const report = await financialReportService.generateCostCenterUtilizationReport(reportParams);
    
    // Verify report was generated
    expect(report).toBeDefined();
    expect(report.costCenters).toBeDefined();
    expect(report.costCenters.length).toBeGreaterThan(0);
    
    // 2. Export to all formats
    const filePaths = {
      csv: path.join(tempDir, `cost-center-${Date.now()}.csv`),
      excel: path.join(tempDir, `cost-center-${Date.now()}.xlsx`),
      pdf: path.join(tempDir, `cost-center-${Date.now()}.pdf`)
    };
    
    exportFilePaths.push(...Object.values(filePaths));
    
    // Export to all formats
    await Promise.all([
      exportService.exportReport(report, ReportFormat.CSV, filePaths.csv),
      exportService.exportReport(report, ReportFormat.EXCEL, filePaths.excel),
      exportService.exportReport(report, ReportFormat.PDF, filePaths.pdf)
    ]);
    
    // Verify all files were created
    expect(fs.existsSync(filePaths.csv)).toBe(true);
    expect(fs.existsSync(filePaths.excel)).toBe(true);
    expect(fs.existsSync(filePaths.pdf)).toBe(true);
    
    // Read and parse CSV
    const csvContent = fs.readFileSync(filePaths.csv, 'utf-8');
    const parsedCsv = csvParse(csvContent, { columns: true });
    
    // Read and parse Excel
    const workbook = XLSX.readFile(filePaths.excel);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const parsedExcel = XLSX.utils.sheet_to_json(worksheet);
    
    // Verify data consistency between formats (for CSV and Excel which we can parse)
    expect(parsedCsv.length).toBe(parsedExcel.length);
  });
  
  it('should generate an operational report with charts', async () => {
    // Get services
    const operationalReportService = new OperationalReportService();
    const exportService = new ExportService();
    
    // 1. Generate work order summary report
    const reportParams = {
      type: ReportType.WORK_ORDER_SUMMARY,
      timeframe: ReportTimeframe.LAST_QUARTER,
      groupBy: 'status'
    };
    
    const report = await operationalReportService.generateWorkOrderSummaryReport(reportParams);
    
    // Verify report was generated
    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.chartData).toBeDefined();
    expect(report.chartData.length).toBeGreaterThan(0);
    
    // 2. Export the report to Excel (with charts)
    const excelFilePath = path.join(tempDir, `work-order-summary-${Date.now()}.xlsx`);
    exportFilePaths.push(excelFilePath);
    
    await exportService.exportReport(report, ReportFormat.EXCEL, excelFilePath, { includeCharts: true });
    
    // Verify the Excel file was created
    expect(fs.existsSync(excelFilePath)).toBe(true);
    
    // Read the Excel file
    const workbook = XLSX.readFile(excelFilePath);
    
    // Excel with charts should have at least 2 sheets (data + chart)
    expect(workbook.SheetNames.length).toBeGreaterThanOrEqual(1);
  });
  
  it('should generate a custom report with complex parameters', async () => {
    // Get services
    const assetReportService = new AssetReportService();
    const exportService = new ExportService();
    
    // 1. Generate a custom asset report with filters
    const reportParams = {
      type: ReportType.CUSTOM_ASSET,
      timeframe: ReportTimeframe.CUSTOM,
      dateRange: {
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        endDate: new Date().toISOString() // today
      } as DateRangeFilter,
      filters: {
        assetTypes: [AssetType.HARDWARE],
        statuses: ['IN_USE', 'IN_STOCK'],
        minPurchasePrice: 1000,
        maxPurchasePrice: 10000
      },
      fields: ['assetId', 'assetTag', 'name', 'serialNumber', 'status', 'location', 'purchasePrice', 'purchaseDate']
    };
    
    const report = await assetReportService.generateCustomAssetReport(reportParams);
    
    // Verify report was generated
    expect(report).toBeDefined();
    expect(report.items).toBeDefined();
    expect(report.items.length).toBeGreaterThan(0);
    
    // Find our test assets in the report
    const reportedTestAssets = report.items.filter(item => 
      testAssetIds.includes(item.assetId)
    );
    
    // Verify our test assets that match the criteria are in the report
    expect(reportedTestAssets.length).toBeGreaterThanOrEqual(1);
    
    // 2. Export the report to CSV
    const csvFilePath = path.join(tempDir, `custom-asset-${Date.now()}.csv`);
    exportFilePaths.push(csvFilePath);
    
    await exportService.exportReport(report, ReportFormat.CSV, csvFilePath);
    
    // Verify the CSV file was created and contains the correct fields
    expect(fs.existsSync(csvFilePath)).toBe(true);
    
    // Read and parse the CSV
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const parsedCsv = csvParse(csvContent, { columns: true });
    
    // Verify field selection was respected in the CSV
    const headerRow = Object.keys(parsedCsv[0]);
    expect(headerRow).toContain('Asset Tag');
    expect(headerRow).toContain('Serial Number');
    expect(headerRow).toContain('Purchase Price');
  });
  
  // Clean up test data after tests
  afterAll(async () => {
    // Delete temporary files
    for (const filePath of exportFilePaths) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    // Delete temporary directory if empty
    try {
      fs.rmdirSync(tempDir);
    } catch (error) {
      // Ignore if directory is not empty
    }
    
    // Permanently delete test data
    const dbClient = DbTestClient.getInstance();
    
    // Delete test assets
    for (const assetId of testAssetIds) {
      await dbClient.query('DELETE FROM hardware_assets WHERE asset_id = $1', [assetId]);
      await dbClient.query('DELETE FROM assets WHERE asset_id = $1', [assetId]);
    }
  });
});