/**
 * Financial Report Service Unit Tests
 *
 * Tests for Financial Report Service:
 * - Depreciation schedule reports (Requirement 16.8)
 * - Asset valuation reports (Requirement 16.8)
 * - Budget utilization reports (Requirement 16.6)
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

// Mock the repositories
jest.mock('../report/report-repository');
jest.mock('../financial/financial-report-repository');

import * as financialReportService from '../financial/financial-report-service';
import * as financialRepository from '../financial/financial-report-repository';
import * as reportRepository from '../report/report-repository';

import type {
  AssetValuationRow,
  BudgetUtilizationRow,
  DepreciationScheduleRow,
  GenerateAssetValuationRequest,
  GenerateBudgetUtilizationRequest,
  GenerateDepreciationScheduleRequest,
} from '../report/report-types';

const mockFinancialRepository = financialRepository as jest.Mocked<typeof financialRepository>;
const mockReportRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('Financial Report Service', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getCurrentFiscalYear to return a consistent value
    mockFinancialRepository.getCurrentFiscalYear.mockReturnValue(2024);
  });

  // ============================================================================
  // Depreciation Schedule Report Tests
  // ============================================================================

  describe('generateDepreciationScheduleReport', () => {
    const mockDepreciationRows: DepreciationScheduleRow[] = [
      {
        assetId: 'asset-1',
        assetTag: 'AMS-HW-20240115-ABC123',
        displayName: 'Dell Laptop',
        assetType: 'HARDWARE',
        purchaseDate: '2023-01-15T00:00:00.000Z',
        purchasePrice: 1500,
        depreciationMethod: 'STRAIGHT_LINE',
        usefulLifeMonths: 36,
        residualValue: 150,
        depreciationStartDate: '2023-02-01T00:00:00.000Z',
        currentPeriod: 12,
        totalPeriods: 36,
        periodDepreciation: 37.5,
        accumulatedDepreciation: 450,
        bookValue: 1050,
        isFullyDepreciated: false,
        costCenterId: 'cc-1',
        costCenterName: 'Engineering',
        departmentId: 'dept-1',
        departmentName: 'IT',
      },
    ];

    const mockSummary = {
      totalAssets: 1,
      totalPurchaseValue: 1500,
      totalAccumulatedDepreciation: 450,
      totalBookValue: 1050,
      totalPeriodDepreciation: 37.5,
      fullyDepreciatedCount: 0,
      byMethod: {
        STRAIGHT_LINE: { count: 1, totalValue: 1500, totalDepreciation: 450 },
        DECLINING_BALANCE: { count: 0, totalValue: 0, totalDepreciation: 0 },
        SUM_OF_YEARS_DIGITS: { count: 0, totalValue: 0, totalDepreciation: 0 },
        UNITS_OF_PRODUCTION: { count: 0, totalValue: 0, totalDepreciation: 0 },
      },
      byAssetType: {
        HARDWARE: { count: 1, totalValue: 1500, totalDepreciation: 450 },
      },
    };

    beforeEach(() => {
      mockFinancialRepository.getDepreciationScheduleData.mockResolvedValue({
        rows: mockDepreciationRows,
        total: 1,
      });
      mockFinancialRepository.getDepreciationScheduleSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'DEPRECIATION_SCHEDULE',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = {
          format: '' as any,
        };

        await expect(
          financialReportService.generateDepreciationScheduleReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when format is invalid', async () => {
        const request = {
          format: 'INVALID' as any,
        };

        await expect(
          financialReportService.generateDepreciationScheduleReport(request, userId)
        ).rejects.toThrow('Invalid export format');
      });

      it('should throw error when fiscal year is invalid', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalYear: 1999,
        };

        await expect(
          financialReportService.generateDepreciationScheduleReport(request, userId)
        ).rejects.toThrow('Invalid fiscal year');
      });

      it('should throw error when fiscal period is invalid', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalPeriod: 13,
        };

        await expect(
          financialReportService.generateDepreciationScheduleReport(request, userId)
        ).rejects.toThrow('Invalid fiscal period');
      });
    });

    describe('successful generation', () => {
      it('should generate depreciation schedule report in CSV format', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateDepreciationScheduleReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('DEPRECIATION_SCHEDULE');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate depreciation schedule report in Excel format', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'EXCEL',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateDepreciationScheduleReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
        expect(result.content).toBeDefined();
      });

      it('should generate depreciation schedule report in PDF format', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'PDF',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateDepreciationScheduleReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
        expect(result.content).toBeDefined();
      });

      it('should use current fiscal year when not specified', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
        };

        await financialReportService.generateDepreciationScheduleReport(request, userId);

        expect(mockFinancialRepository.getDepreciationScheduleData).toHaveBeenCalledWith(
          expect.anything(),
          2024,
          undefined,
          'MONTHLY'
        );
      });

      it('should apply filters to depreciation schedule report', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalYear: 2024,
          filters: {
            assetType: 'HARDWARE',
            depreciationMethod: 'STRAIGHT_LINE',
            costCenterId: 'cc-1',
          },
        };

        await financialReportService.generateDepreciationScheduleReport(request, userId);

        expect(mockFinancialRepository.getDepreciationScheduleData).toHaveBeenCalledWith(
          expect.objectContaining({
            assetType: 'HARDWARE',
            depreciationMethod: 'STRAIGHT_LINE',
            costCenterId: 'cc-1',
          }),
          2024,
          undefined,
          'MONTHLY'
        );
      });

      it('should include fully depreciated assets when requested', async () => {
        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalYear: 2024,
          includeFullyDepreciated: true,
        };

        await financialReportService.generateDepreciationScheduleReport(request, userId);

        expect(mockFinancialRepository.getDepreciationScheduleData).toHaveBeenCalledWith(
          expect.objectContaining({
            includeFullyDepreciated: true,
          }),
          2024,
          undefined,
          'MONTHLY'
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockFinancialRepository.getDepreciationScheduleData.mockRejectedValue(
          new Error('Database error')
        );

        const request: GenerateDepreciationScheduleRequest = {
          format: 'CSV',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateDepreciationScheduleReport(
          request,
          userId
        );

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });


  // ============================================================================
  // Asset Valuation Report Tests
  // ============================================================================

  describe('generateAssetValuationReport', () => {
    const mockValuationRows: AssetValuationRow[] = [
      {
        assetId: 'asset-1',
        assetTag: 'AMS-HW-20240115-ABC123',
        displayName: 'Dell Laptop',
        assetType: 'HARDWARE',
        manufacturer: 'Dell',
        model: 'Latitude 5520',
        serialNumber: 'SN123456',
        status: 'DEPLOYED',
        purchaseDate: '2023-01-15T00:00:00.000Z',
        purchasePrice: 1500,
        depreciationMethod: 'STRAIGHT_LINE',
        usefulLifeMonths: 36,
        residualValue: 150,
        accumulatedDepreciation: 450,
        currentBookValue: 1050,
        fairMarketValue: 900,
        valuationDate: '2024-01-15T00:00:00.000Z',
        ageInMonths: 12,
        remainingLifeMonths: 24,
        depreciationPercentage: 30,
        costCenterId: 'cc-1',
        costCenterName: 'Engineering',
        departmentId: 'dept-1',
        departmentName: 'IT',
        assignedTo: 'John Doe',
        location: 'Building A',
      },
    ];

    const mockSummary = {
      totalAssets: 1,
      totalPurchaseValue: 1500,
      totalAccumulatedDepreciation: 450,
      totalBookValue: 1050,
      totalFairMarketValue: 900,
      averageAssetAge: 12,
      averageDepreciationPercentage: 30,
      byAssetType: [],
      byDepartment: [],
      byCostCenter: [],
      byStatus: [],
    };

    beforeEach(() => {
      mockFinancialRepository.getAssetValuationData.mockResolvedValue({
        rows: mockValuationRows,
        total: 1,
      });
      mockFinancialRepository.getAssetValuationSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'ASSET_VALUATION',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = {
          format: '' as any,
        };

        await expect(
          financialReportService.generateAssetValuationReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when valuation date is invalid', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
          valuationDate: 'invalid-date',
        };

        await expect(
          financialReportService.generateAssetValuationReport(request, userId)
        ).rejects.toThrow('Invalid valuation date');
      });

      it('should throw error when valuation date is in the future', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);

        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
          valuationDate: futureDate.toISOString(),
        };

        await expect(
          financialReportService.generateAssetValuationReport(request, userId)
        ).rejects.toThrow('Valuation date cannot be in the future');
      });

      it('should throw error when groupBy is invalid', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
          groupBy: 'INVALID' as any,
        };

        await expect(
          financialReportService.generateAssetValuationReport(request, userId)
        ).rejects.toThrow('Invalid groupBy');
      });
    });

    describe('successful generation', () => {
      it('should generate asset valuation report in CSV format', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
        };

        const result = await financialReportService.generateAssetValuationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('ASSET_VALUATION');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate asset valuation report in Excel format', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'EXCEL',
        };

        const result = await financialReportService.generateAssetValuationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
      });

      it('should generate asset valuation report in PDF format', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'PDF',
        };

        const result = await financialReportService.generateAssetValuationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
      });

      it('should use current date when valuation date not specified', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
        };

        await financialReportService.generateAssetValuationReport(request, userId);

        expect(mockFinancialRepository.getAssetValuationData).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String)
        );
      });

      it('should apply filters to asset valuation report', async () => {
        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
          filters: {
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            departmentId: 'dept-1',
          },
        };

        await financialReportService.generateAssetValuationReport(request, userId);

        expect(mockFinancialRepository.getAssetValuationData).toHaveBeenCalledWith(
          expect.objectContaining({
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            departmentId: 'dept-1',
          }),
          expect.any(String)
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockFinancialRepository.getAssetValuationData.mockRejectedValue(
          new Error('Database error')
        );

        const request: GenerateAssetValuationRequest = {
          format: 'CSV',
        };

        const result = await financialReportService.generateAssetValuationReport(
          request,
          userId
        );

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });


  // ============================================================================
  // Budget Utilization Report Tests
  // ============================================================================

  describe('generateBudgetUtilizationReport', () => {
    const mockBudgetRows: BudgetUtilizationRow[] = [
      {
        costCenterId: 'cc-1',
        costCenterCode: 'ENG-001',
        costCenterName: 'Engineering',
        departmentId: 'dept-1',
        departmentName: 'IT',
        fiscalYear: 2024,
        budgetAmount: 100000,
        spentAmount: 45000,
        committedAmount: 15000,
        availableAmount: 40000,
        utilizationPercentage: 45,
        varianceAmount: 55000,
        variancePercentage: 55,
        isOverBudget: false,
        assetPurchases: 30000,
        maintenanceCosts: 10000,
        licenseCosts: 5000,
        otherCosts: 0,
        projectedYearEndSpend: 90000,
        projectedVariance: 10000,
      },
    ];

    const mockSummary = {
      fiscalYear: 2024,
      totalBudget: 100000,
      totalSpent: 45000,
      totalCommitted: 15000,
      totalAvailable: 40000,
      overallUtilization: 45,
      costCentersOverBudget: 0,
      costCentersUnderBudget: 1,
      costCentersOnTrack: 0,
      totalAssetPurchases: 30000,
      totalMaintenanceCosts: 10000,
      totalLicenseCosts: 5000,
      totalOtherCosts: 0,
      byDepartment: [],
    };

    beforeEach(() => {
      mockFinancialRepository.getBudgetUtilizationData.mockResolvedValue({
        rows: mockBudgetRows,
        total: 1,
      });
      mockFinancialRepository.getBudgetUtilizationSummary.mockResolvedValue(mockSummary);
      mockFinancialRepository.getBudgetPeriodDetails.mockResolvedValue([]);
      mockFinancialRepository.getProjectedYearEndSpend.mockResolvedValue({
        projectedSpend: 90000,
        projectedVariance: 10000,
      });
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'BUDGET_UTILIZATION',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = {
          format: '' as any,
        };

        await expect(
          financialReportService.generateBudgetUtilizationReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when fiscal year is invalid', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 1999,
        };

        await expect(
          financialReportService.generateBudgetUtilizationReport(request, userId)
        ).rejects.toThrow('Invalid fiscal year');
      });
    });

    describe('successful generation', () => {
      it('should generate budget utilization report in CSV format', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateBudgetUtilizationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('BUDGET_UTILIZATION');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate budget utilization report in Excel format', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'EXCEL',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateBudgetUtilizationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
      });

      it('should generate budget utilization report in PDF format', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'PDF',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateBudgetUtilizationReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
      });

      it('should use current fiscal year when not specified', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
        };

        await financialReportService.generateBudgetUtilizationReport(request, userId);

        expect(mockFinancialRepository.getBudgetUtilizationData).toHaveBeenCalledWith(
          expect.anything(),
          2024
        );
      });

      it('should include period details when requested', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 2024,
          includePeriodDetails: true,
        };

        await financialReportService.generateBudgetUtilizationReport(request, userId);

        expect(mockFinancialRepository.getBudgetPeriodDetails).toHaveBeenCalledWith(
          expect.anything(),
          2024,
          'MONTHLY'
        );
      });

      it('should include projections when requested', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 2024,
          includeProjections: true,
        };

        const result = await financialReportService.generateBudgetUtilizationReport(
          request,
          userId
        );

        expect(mockFinancialRepository.getProjectedYearEndSpend).toHaveBeenCalled();
        expect(result.status).toBe('COMPLETED');
      });

      it('should apply filters to budget utilization report', async () => {
        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 2024,
          filters: {
            departmentId: 'dept-1',
            costCenterId: 'cc-1',
          },
        };

        await financialReportService.generateBudgetUtilizationReport(request, userId);

        expect(mockFinancialRepository.getBudgetUtilizationData).toHaveBeenCalledWith(
          expect.objectContaining({
            departmentId: 'dept-1',
            costCenterId: 'cc-1',
          }),
          2024
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockFinancialRepository.getBudgetUtilizationData.mockRejectedValue(
          new Error('Database error')
        );

        const request: GenerateBudgetUtilizationRequest = {
          format: 'CSV',
          fiscalYear: 2024,
        };

        const result = await financialReportService.generateBudgetUtilizationReport(
          request,
          userId
        );

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });


  // ============================================================================
  // Export Function Tests
  // ============================================================================

  describe('exportFinancialToCSV', () => {
    it('should export depreciation schedule to CSV format', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'DEPRECIATION_SCHEDULE' as const,
          title: 'Depreciation Schedule Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalPurchaseValue: 1500,
          totalAccumulatedDepreciation: 450,
          totalBookValue: 1050,
          totalPeriodDepreciation: 37.5,
          fullyDepreciatedCount: 0,
          byMethod: {
            STRAIGHT_LINE: { count: 1, totalValue: 1500, totalDepreciation: 450 },
            DECLINING_BALANCE: { count: 0, totalValue: 0, totalDepreciation: 0 },
            SUM_OF_YEARS_DIGITS: { count: 0, totalValue: 0, totalDepreciation: 0 },
            UNITS_OF_PRODUCTION: { count: 0, totalValue: 0, totalDepreciation: 0 },
          },
          byAssetType: {},
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            displayName: 'Dell Laptop',
            purchasePrice: 1500,
            bookValue: 1050,
          },
        ],
        fiscalYear: 2024,
        fiscalPeriodType: 'MONTHLY' as const,
      };

      // Cast to any to allow simplified test data
      const csv = financialReportService.exportFinancialToCSV(reportData as any);

      expect(csv).toContain('assetId');
      expect(csv).toContain('assetTag');
      expect(csv).toContain('AMS-HW-001');
      expect(csv).toContain('1500.00');
      expect(csv).toContain('1050.00');
    });

    it('should handle empty report data', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'DEPRECIATION_SCHEDULE' as const,
          title: 'Depreciation Schedule Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV' as const,
          filters: {},
          totalRecords: 0,
        },
        summary: {
          totalAssets: 0,
          totalPurchaseValue: 0,
          totalAccumulatedDepreciation: 0,
          totalBookValue: 0,
          totalPeriodDepreciation: 0,
          fullyDepreciatedCount: 0,
          byMethod: {
            STRAIGHT_LINE: { count: 0, totalValue: 0, totalDepreciation: 0 },
            DECLINING_BALANCE: { count: 0, totalValue: 0, totalDepreciation: 0 },
            SUM_OF_YEARS_DIGITS: { count: 0, totalValue: 0, totalDepreciation: 0 },
            UNITS_OF_PRODUCTION: { count: 0, totalValue: 0, totalDepreciation: 0 },
          },
          byAssetType: {},
        },
        rows: [],
        fiscalYear: 2024,
        fiscalPeriodType: 'MONTHLY' as const,
      };

      const csv = financialReportService.exportFinancialToCSV(reportData as any);

      expect(csv).toBe('');
    });

    it('should escape fields containing commas', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_VALUATION' as const,
          title: 'Asset Valuation Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalPurchaseValue: 1500,
          totalAccumulatedDepreciation: 450,
          totalBookValue: 1050,
          averageAssetAge: 12,
          averageDepreciationPercentage: 30,
          byAssetType: [],
          byDepartment: [],
          byCostCenter: [],
          byStatus: [],
        },
        rows: [
          {
            assetId: 'asset-1',
            displayName: 'Laptop, Dell Model',
            location: 'Building A, Floor 2',
          },
        ],
        valuationDate: '2024-01-15T00:00:00.000Z',
      };

      const csv = financialReportService.exportFinancialToCSV(reportData as any);

      expect(csv).toContain('"Laptop, Dell Model"');
      expect(csv).toContain('"Building A, Floor 2"');
    });
  });

  describe('exportFinancialToExcel', () => {
    it('should export financial report to Excel format (base64)', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'BUDGET_UTILIZATION' as const,
          title: 'Budget Utilization Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'EXCEL' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {
          fiscalYear: 2024,
          totalBudget: 100000,
          totalSpent: 45000,
          totalCommitted: 15000,
          totalAvailable: 40000,
          overallUtilization: 45,
          costCentersOverBudget: 0,
          costCentersUnderBudget: 1,
          costCentersOnTrack: 0,
          totalAssetPurchases: 30000,
          totalMaintenanceCosts: 10000,
          totalLicenseCosts: 5000,
          totalOtherCosts: 0,
          byDepartment: [],
        },
        rows: [
          {
            costCenterId: 'cc-1',
            costCenterName: 'Engineering',
            budgetAmount: 100000,
            spentAmount: 45000,
          },
        ],
        fiscalYear: 2024,
        asOfDate: '2024-01-15T00:00:00.000Z',
      };

      const excel = financialReportService.exportFinancialToExcel(reportData as any);

      // Should be base64 encoded
      expect(() => Buffer.from(excel, 'base64')).not.toThrow();
    });
  });

  describe('exportFinancialToPDF', () => {
    it('should export financial report to PDF format (base64)', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_VALUATION' as const,
          title: 'Asset Valuation Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'PDF' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {
          totalAssets: 1,
          totalPurchaseValue: 1500,
          totalAccumulatedDepreciation: 450,
          totalBookValue: 1050,
          averageAssetAge: 12,
          averageDepreciationPercentage: 30,
          byAssetType: [],
          byDepartment: [],
          byCostCenter: [],
          byStatus: [],
        },
        rows: [
          {
            assetId: 'asset-1',
            assetTag: 'AMS-HW-001',
            currentBookValue: 1050,
          },
        ],
        valuationDate: '2024-01-15T00:00:00.000Z',
      };

      const pdf = financialReportService.exportFinancialToPDF(reportData as any);

      // Should be base64 encoded
      expect(() => Buffer.from(pdf, 'base64')).not.toThrow();
    });
  });


  // ============================================================================
  // Procurement Spending Report Tests
  // ============================================================================

  describe('generateProcurementSpendingReport', () => {
    const mockProcurementRows = [
      {
        poId: 'po-1',
        poNumber: 'PO-2024-001',
        vendorId: 'vendor-1',
        vendorName: 'Dell Technologies',
        costCenterId: 'cc-1',
        costCenterCode: 'ENG-001',
        status: 'APPROVED',
        requestedDate: '2024-01-10T00:00:00.000Z',
        approvedDate: '2024-01-12T00:00:00.000Z',
        totalAmount: 5000,
        category: 'Hardware',
      },
    ];

    const mockSummary = {
      period: { from: '2023-01-15T00:00:00.000Z', to: '2024-01-15T00:00:00.000Z' },
      totalSpending: 5000,
      totalPOCount: 1,
      averageOrderValue: 5000,
      byVendor: [
        {
          vendorId: 'vendor-1',
          vendorName: 'Dell Technologies',
          vendorType: 'HARDWARE',
          totalAmount: 5000,
          poCount: 1,
          averageOrderValue: 5000,
          percentage: 100,
        },
      ],
      byCategory: [
        {
          category: 'Hardware',
          totalAmount: 5000,
          poCount: 1,
          percentage: 100,
        },
      ],
      byMonth: [
        {
          month: '2024-01',
          year: 2024,
          totalAmount: 5000,
          poCount: 1,
        },
      ],
    };

    beforeEach(() => {
      mockFinancialRepository.getProcurementSpendingData.mockResolvedValue({
        rows: mockProcurementRows,
        total: 1,
      });
      mockFinancialRepository.getProcurementSpendingSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'COST_ANALYSIS',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = {
          format: '' as any,
        };

        await expect(
          financialReportService.generateProcurementSpendingReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when format is invalid', async () => {
        const request = {
          format: 'INVALID' as any,
        };

        await expect(
          financialReportService.generateProcurementSpendingReport(request, userId)
        ).rejects.toThrow('Invalid export format');
      });

      it('should throw error when dateFrom is after dateTo', async () => {
        const request = {
          format: 'CSV' as const,
          dateFrom: '2024-06-01T00:00:00.000Z',
          dateTo: '2024-01-01T00:00:00.000Z',
        };

        await expect(
          financialReportService.generateProcurementSpendingReport(request, userId)
        ).rejects.toThrow('dateFrom must be before dateTo');
      });

      it('should throw error when groupBy is invalid', async () => {
        const request = {
          format: 'CSV' as const,
          groupBy: 'INVALID' as any,
        };

        await expect(
          financialReportService.generateProcurementSpendingReport(request, userId)
        ).rejects.toThrow('Invalid groupBy');
      });
    });

    describe('successful generation', () => {
      it('should generate procurement spending report in CSV format', async () => {
        const request = {
          format: 'CSV' as const,
        };

        const result = await financialReportService.generateProcurementSpendingReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('COST_ANALYSIS');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate procurement spending report in Excel format', async () => {
        const request = {
          format: 'EXCEL' as const,
        };

        const result = await financialReportService.generateProcurementSpendingReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
        expect(result.content).toBeDefined();
      });

      it('should generate procurement spending report in PDF format', async () => {
        const request = {
          format: 'PDF' as const,
        };

        const result = await financialReportService.generateProcurementSpendingReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
        expect(result.content).toBeDefined();
      });

      it('should use default date range when not specified', async () => {
        const request = {
          format: 'CSV' as const,
        };

        await financialReportService.generateProcurementSpendingReport(request, userId);

        expect(mockFinancialRepository.getProcurementSpendingData).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          expect.any(String)
        );
      });

      it('should apply filters to procurement spending report', async () => {
        const request = {
          format: 'CSV' as const,
          filters: {
            vendorId: 'vendor-1',
            costCenterId: 'cc-1',
          },
        };

        await financialReportService.generateProcurementSpendingReport(request, userId);

        expect(mockFinancialRepository.getProcurementSpendingData).toHaveBeenCalledWith(
          expect.objectContaining({
            vendorId: 'vendor-1',
            costCenterId: 'cc-1',
          }),
          expect.any(String),
          expect.any(String)
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockFinancialRepository.getProcurementSpendingData.mockRejectedValue(
          new Error('Database error')
        );

        const request = {
          format: 'CSV' as const,
        };

        const result = await financialReportService.generateProcurementSpendingReport(
          request,
          userId
        );

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });


  // ============================================================================
  // Vendor Spending Analysis Report Tests
  // ============================================================================

  describe('generateVendorSpendingAnalysisReport', () => {
    const mockVendorData = {
      vendors: [
        {
          vendorId: 'vendor-1',
          vendorName: 'Dell Technologies',
          vendorType: 'HARDWARE',
          rating: 'A',
          totalSpending: 50000,
          poCount: 10,
          averageOrderValue: 5000,
          trend: 'INCREASING' as const,
          trendPercentage: 15,
          previousPeriodSpending: 43500,
        },
        {
          vendorId: 'vendor-2',
          vendorName: 'Microsoft',
          vendorType: 'SOFTWARE',
          rating: 'A',
          totalSpending: 30000,
          poCount: 5,
          averageOrderValue: 6000,
          trend: 'STABLE' as const,
          trendPercentage: 2,
          previousPeriodSpending: 29400,
        },
      ],
      total: 2,
    };

    const mockSummary = {
      period: { from: '2023-01-15T00:00:00.000Z', to: '2024-01-15T00:00:00.000Z' },
      totalVendors: 2,
      totalSpending: 80000,
      topVendorsBySpending: mockVendorData.vendors,
      vendorsWithIncreasingTrend: 1,
      vendorsWithDecreasingTrend: 0,
    };

    beforeEach(() => {
      mockFinancialRepository.getVendorSpendingAnalysisData.mockResolvedValue(mockVendorData);
      mockFinancialRepository.getVendorSpendingAnalysisSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'COST_ANALYSIS',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = {
          format: '' as any,
        };

        await expect(
          financialReportService.generateVendorSpendingAnalysisReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when format is invalid', async () => {
        const request = {
          format: 'INVALID' as any,
        };

        await expect(
          financialReportService.generateVendorSpendingAnalysisReport(request, userId)
        ).rejects.toThrow('Invalid export format');
      });

      it('should throw error when dateFrom is after dateTo', async () => {
        const request = {
          format: 'CSV' as const,
          dateFrom: '2024-06-01T00:00:00.000Z',
          dateTo: '2024-01-01T00:00:00.000Z',
        };

        await expect(
          financialReportService.generateVendorSpendingAnalysisReport(request, userId)
        ).rejects.toThrow('dateFrom must be before dateTo');
      });
    });

    describe('successful generation', () => {
      it('should generate vendor spending analysis report in CSV format', async () => {
        const request = {
          format: 'CSV' as const,
        };

        const result = await financialReportService.generateVendorSpendingAnalysisReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('COST_ANALYSIS');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate vendor spending analysis report in Excel format', async () => {
        const request = {
          format: 'EXCEL' as const,
        };

        const result = await financialReportService.generateVendorSpendingAnalysisReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
        expect(result.content).toBeDefined();
      });

      it('should generate vendor spending analysis report in PDF format', async () => {
        const request = {
          format: 'PDF' as const,
        };

        const result = await financialReportService.generateVendorSpendingAnalysisReport(
          request,
          userId
        );

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
        expect(result.content).toBeDefined();
      });

      it('should include trend analysis by default', async () => {
        const request = {
          format: 'CSV' as const,
        };

        await financialReportService.generateVendorSpendingAnalysisReport(request, userId);

        expect(mockFinancialRepository.getVendorSpendingAnalysisData).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          expect.any(String),
          true
        );
      });

      it('should respect includeTrendAnalysis flag', async () => {
        const request = {
          format: 'CSV' as const,
          includeTrendAnalysis: false,
        };

        await financialReportService.generateVendorSpendingAnalysisReport(request, userId);

        expect(mockFinancialRepository.getVendorSpendingAnalysisData).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(String),
          expect.any(String),
          false
        );
      });

      it('should apply date range filters', async () => {
        const request = {
          format: 'CSV' as const,
          dateFrom: '2024-01-01T00:00:00.000Z',
          dateTo: '2024-06-30T00:00:00.000Z',
        };

        await financialReportService.generateVendorSpendingAnalysisReport(request, userId);

        expect(mockFinancialRepository.getVendorSpendingAnalysisData).toHaveBeenCalledWith(
          expect.anything(),
          '2024-01-01T00:00:00.000Z',
          '2024-06-30T00:00:00.000Z',
          expect.any(Boolean)
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockFinancialRepository.getVendorSpendingAnalysisData.mockRejectedValue(
          new Error('Database error')
        );

        const request = {
          format: 'CSV' as const,
        };

        const result = await financialReportService.generateVendorSpendingAnalysisReport(
          request,
          userId
        );

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });
});
