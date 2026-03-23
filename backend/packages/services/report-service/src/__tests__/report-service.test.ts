/**
 * Report Service Unit Tests
 *
 * Tests for Report Service:
 * - Standard report generation (Requirement 16.1)
 * - Multiple export formats (Requirement 16.3)
 * - Report access logging (Requirement 16.9)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  CACHE_ENTITY_TYPES: {
    REPORT: 'report',
  },
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
  validateUUID: jest.fn().mockReturnValue(null),
}));

// Mock the repository
jest.mock('../report/report-repository');

import * as reportService from '../report/report-service';
import * as reportRepository from '../report/report-repository';
import { exportToCSV, exportToExcel, exportToPDF } from '../export';
import type {
  AssetInventoryReport,
  AssetInventoryRow,
  CompliancePositionRow,
  CostAnalysisRow,
  GenerateReportRequest,
  LifecycleStatusRow,
} from '../report/report-types';

const mockRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('Report Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';

    describe('validation', () => {
      it('should throw error when reportType is missing', async () => {
        const request = {
          reportType: '' as any,
          format: 'CSV' as const,
        };

        await expect(reportService.generateReport(request, userId)).rejects.toThrow(
          'Report type is required'
        );
      });

      it('should throw error when reportType is invalid', async () => {
        const request = {
          reportType: 'INVALID_TYPE' as any,
          format: 'CSV' as const,
        };

        await expect(reportService.generateReport(request, userId)).rejects.toThrow(
          'Invalid report type'
        );
      });

      it('should throw error when format is missing', async () => {
        const request = {
          reportType: 'ASSET_INVENTORY' as const,
          format: '' as any,
        };

        await expect(reportService.generateReport(request, userId)).rejects.toThrow(
          'Export format is required'
        );
      });

      it('should throw error when format is invalid', async () => {
        const request = {
          reportType: 'ASSET_INVENTORY' as const,
          format: 'INVALID_FORMAT' as any,
        };

        await expect(reportService.generateReport(request, userId)).rejects.toThrow(
          'Invalid export format'
        );
      });

      it('should throw error when dateFrom is after dateTo', async () => {
        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            dateFrom: '2024-12-31T00:00:00.000Z',
            dateTo: '2024-01-01T00:00:00.000Z',
          },
        };

        await expect(reportService.generateReport(request, userId)).rejects.toThrow(
          'dateFrom must be before dateTo'
        );
      });
    });

    describe('Asset Inventory Report', () => {
      const mockInventoryRows: AssetInventoryRow[] = [
        {
          assetId: 'asset-1',
          assetTag: 'AMS-HW-20240115-ABC123',
          assetType: 'HARDWARE',
          displayName: 'Dell Laptop',
          status: 'DEPLOYED',
          manufacturer: 'Dell',
          model: 'Latitude 5520',
          serialNumber: 'SN123456',
          assignedTo: 'John Doe',
          department: 'Engineering',
          location: 'Building A',
          purchaseDate: '2024-01-01T00:00:00.000Z',
          purchasePrice: 1500,
          currentValue: 1200,
        },
      ];

      beforeEach(() => {
        mockRepository.getAssetInventoryData.mockResolvedValue({
          rows: mockInventoryRows,
          total: 1,
        });
        mockRepository.getAssetInventorySummary.mockResolvedValue({
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        });
        mockRepository.logReportAccess.mockResolvedValue({
          logId: 'log-1',
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          accessedBy: userId,
          accessedAt: '2024-01-15T10:00:00.000Z',
          action: 'GENERATED',
          format: 'CSV',
        });
      });

      it('should generate Asset Inventory report in CSV format', async () => {
        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('ASSET_INVENTORY');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate Asset Inventory report in Excel format', async () => {
        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'EXCEL',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
        expect(result.content).toBeDefined();
      });

      it('should generate Asset Inventory report in PDF format', async () => {
        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'PDF',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
        expect(result.content).toBeDefined();
      });

      it('should apply filters to Asset Inventory report', async () => {
        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            departmentId: 'dept-1',
          },
        };

        await reportService.generateReport(request, userId);

        expect(mockRepository.getAssetInventoryData).toHaveBeenCalledWith(
          expect.objectContaining({
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            departmentId: 'dept-1',
          })
        );
      });
    });

    describe('Compliance Summary Report', () => {
      const mockComplianceRows: CompliancePositionRow[] = [
        {
          productId: 'product-1',
          publisher: 'Microsoft',
          productName: 'Office 365',
          version: '2024',
          licenseType: 'SUBSCRIPTION',
          entitlementsOwned: 100,
          installationsFound: 95,
          compliancePosition: 'COMPLIANT',
          variance: 5,
          riskLevel: 'LOW',
          estimatedCost: 0,
          lastReconciled: '2024-01-15T00:00:00.000Z',
        },
      ];

      beforeEach(() => {
        mockRepository.getComplianceData.mockResolvedValue({
          rows: mockComplianceRows,
          total: 1,
        });
        mockRepository.getComplianceSummary.mockResolvedValue({
          totalProducts: 1,
          compliantCount: 1,
          overLicensedCount: 0,
          underLicensedCount: 0,
          totalEntitlements: 100,
          totalInstallations: 95,
          complianceRate: 100,
          estimatedRisk: 0,
        });
        mockRepository.logReportAccess.mockResolvedValue({
          logId: 'log-1',
          reportId: 'report-1',
          reportType: 'COMPLIANCE_SUMMARY',
          accessedBy: userId,
          accessedAt: '2024-01-15T10:00:00.000Z',
          action: 'GENERATED',
          format: 'CSV',
        });
      });

      it('should generate Compliance Summary report', async () => {
        const request: GenerateReportRequest = {
          reportType: 'COMPLIANCE_SUMMARY',
          format: 'CSV',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('COMPLIANCE_SUMMARY');
        expect(mockRepository.getComplianceData).toHaveBeenCalled();
        expect(mockRepository.getComplianceSummary).toHaveBeenCalled();
      });
    });

    describe('Cost Analysis Report', () => {
      const mockCostRows: CostAnalysisRow[] = [
        {
          category: 'HARDWARE',
          categoryType: 'ASSET_TYPE',
          assetCount: 100,
          totalPurchaseCost: 150000,
          totalCurrentValue: 120000,
          totalDepreciation: 30000,
          monthlyMaintenanceCost: 1000,
          annualLicenseCost: 0,
          totalCostOfOwnership: 162000,
        },
      ];

      beforeEach(() => {
        mockRepository.getCostAnalysisData.mockResolvedValue(mockCostRows);
        mockRepository.getCostTrendData.mockResolvedValue([]);
        mockRepository.getCostAnalysisSummary.mockResolvedValue({
          totalAssetValue: 150000,
          totalDepreciation: 30000,
          totalMaintenanceCost: 12000,
          totalLicenseCost: 0,
          totalCostOfOwnership: 162000,
          averageCostPerAsset: 1620,
        });
        mockRepository.logReportAccess.mockResolvedValue({
          logId: 'log-1',
          reportId: 'report-1',
          reportType: 'COST_ANALYSIS',
          accessedBy: userId,
          accessedAt: '2024-01-15T10:00:00.000Z',
          action: 'GENERATED',
          format: 'CSV',
        });
      });

      it('should generate Cost Analysis report', async () => {
        const request: GenerateReportRequest = {
          reportType: 'COST_ANALYSIS',
          format: 'CSV',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('COST_ANALYSIS');
        expect(mockRepository.getCostAnalysisData).toHaveBeenCalled();
        expect(mockRepository.getCostTrendData).toHaveBeenCalled();
        expect(mockRepository.getCostAnalysisSummary).toHaveBeenCalled();
      });
    });

    describe('Lifecycle Status Report', () => {
      const mockLifecycleRows: LifecycleStatusRow[] = [
        {
          assetId: 'asset-1',
          assetTag: 'AMS-HW-20240115-ABC123',
          assetType: 'HARDWARE',
          displayName: 'Dell Laptop',
          currentStatus: 'DEPLOYED',
          statusSince: '2024-01-01T00:00:00.000Z',
          daysInStatus: 14,
          previousStatus: 'IN_STOCK',
          nextExpectedStatus: 'IN_MAINTENANCE',
          warrantyExpiration: '2027-01-01T00:00:00.000Z',
        },
      ];

      beforeEach(() => {
        mockRepository.getLifecycleStatusData.mockResolvedValue({
          rows: mockLifecycleRows,
          total: 1,
        });
        mockRepository.getLifecycleSummary.mockResolvedValue({
          totalAssets: 1,
          distribution: [
            { status: 'DEPLOYED', count: 1, percentage: 100, averageDaysInStatus: 14 },
          ],
          upcomingExpirations: 0,
          overdueActions: 0,
          averageLifecycleDays: 365,
        });
        mockRepository.getLifecycleDistribution.mockResolvedValue([
          { status: 'DEPLOYED', count: 1, percentage: 100, averageDaysInStatus: 14 },
        ]);
        mockRepository.logReportAccess.mockResolvedValue({
          logId: 'log-1',
          reportId: 'report-1',
          reportType: 'LIFECYCLE_STATUS',
          accessedBy: userId,
          accessedAt: '2024-01-15T10:00:00.000Z',
          action: 'GENERATED',
          format: 'CSV',
        });
      });

      it('should generate Lifecycle Status report', async () => {
        const request: GenerateReportRequest = {
          reportType: 'LIFECYCLE_STATUS',
          format: 'CSV',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('LIFECYCLE_STATUS');
        expect(mockRepository.getLifecycleStatusData).toHaveBeenCalled();
        expect(mockRepository.getLifecycleSummary).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockRepository.getAssetInventoryData.mockRejectedValue(new Error('Database error'));
        mockRepository.getAssetInventorySummary.mockRejectedValue(new Error('Database error'));

        const request: GenerateReportRequest = {
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        };

        const result = await reportService.generateReport(request, userId);

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });

  describe('exportToCSV', () => {
    it('should export report data to CSV format', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV',
          filters: {},
          totalRecords: 2,
        },
        summary: {
          totalAssets: 2,
          totalValue: 3000,
          byType: { HARDWARE: 2 },
          byStatus: { DEPLOYED: 2 },
          byDepartment: { Engineering: 2 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop 1',
            status: 'DEPLOYED',
            purchasePrice: 1500,
          },
          {
            assetId: 'asset-2',
            assetTag: 'AMS-HW-002',
            assetType: 'HARDWARE',
            displayName: 'Laptop 2',
            status: 'DEPLOYED',
            purchasePrice: 1500,
          },
        ],
      };

      const csv = exportToCSV(reportData.rows as unknown as Record<string, unknown>[]);

      expect(csv).toContain('assetId');
      expect(csv).toContain('assetTag');
      expect(csv).toContain('AMS-HW-001');
      expect(csv).toContain('AMS-HW-002');
    });

    it('should handle empty report data', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV',
          filters: {},
          totalRecords: 0,
        },
        summary: {
          totalAssets: 0,
          totalValue: 0,
          byType: {},
          byStatus: {},
          byDepartment: {},
        },
        rows: [],
      };

      const csv = exportToCSV(reportData.rows as unknown as Record<string, unknown>[]);

      expect(csv).toBe('');
    });

    it('should escape fields containing commas', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV',
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop, Dell Model',
            status: 'DEPLOYED',
          },
        ],
      };

      const csv = exportToCSV(reportData.rows as unknown as Record<string, unknown>[]);

      expect(csv).toContain('"Laptop, Dell Model"');
    });

    it('should escape fields containing quotes', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV',
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop "Pro" Edition',
            status: 'DEPLOYED',
          },
        ],
      };

      const csv = exportToCSV(reportData.rows as unknown as Record<string, unknown>[]);

      expect(csv).toContain('"Laptop ""Pro"" Edition"');
    });

    it('should use custom delimiter when specified', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV',
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop',
            status: 'DEPLOYED',
          },
        ],
      };

      const csv = exportToCSV(reportData.rows as unknown as Record<string, unknown>[], { delimiter: ';' });

      expect(csv).toContain(';');
      expect(csv).not.toMatch(/(?<!"),(?!")/); // No unquoted commas as delimiters
    });
  });

  describe('exportToExcel', () => {
    it('should export report data to Excel format (base64)', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'EXCEL',
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop',
            status: 'DEPLOYED',
          },
        ],
      };

      const excel = exportToExcel(reportData.rows as unknown as Record<string, unknown>[]);

      // Should be base64 encoded
      expect(() => Buffer.from(excel, 'base64')).not.toThrow();
    });
  });

  describe('exportToPDF', () => {
    it('should export report data to PDF format (base64)', () => {
      const reportData: AssetInventoryReport = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'PDF',
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalValue: 1500,
          byType: { HARDWARE: 1 },
          byStatus: { DEPLOYED: 1 },
          byDepartment: { Engineering: 1 },
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            assetType: 'HARDWARE',
            displayName: 'Laptop',
            status: 'DEPLOYED',
          },
        ],
      };

      const pdf = exportToPDF(reportData.rows as unknown as Record<string, unknown>[]);

      // Should be base64 encoded
      expect(() => Buffer.from(pdf, 'base64')).not.toThrow();
    });
  });

  describe('getReportAccessLogs', () => {
    it('should return report access logs', async () => {
      const mockLogs = [
        {
          logId: 'log-1',
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY' as const,
          accessedBy: 'user-1',
          accessedAt: '2024-01-15T10:00:00.000Z',
          action: 'GENERATED' as const,
          format: 'CSV' as const,
        },
      ];

      mockRepository.getReportAccessLogs.mockResolvedValue({
        logs: mockLogs,
        total: 1,
      });

      const result = await reportService.getReportAccessLogs({
        reportType: 'ASSET_INVENTORY',
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(1);
    });
  });
});

