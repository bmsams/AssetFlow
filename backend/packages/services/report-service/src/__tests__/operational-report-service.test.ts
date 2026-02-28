/**
 * Operational Report Service Unit Tests
 *
 * Tests for Operational Report Service:
 * - Work order summary reports (Requirement 20.1)
 * - Maintenance compliance reports (Requirement 20.2)
 * - Stockroom inventory reports (Requirement 20.3)
 * - Transfer order reports (Requirement 20.4)
 * - Asset lifecycle reports (Requirement 20.5)
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
jest.mock('../operational-reports/operational-report-repository');

import * as operationalReportService from '../operational-reports/operational-report-service';
import * as operationalRepository from '../operational-reports/operational-report-repository';
import * as reportRepository from '../report/report-repository';

const mockOperationalRepository = operationalRepository as jest.Mocked<typeof operationalRepository>;
const mockReportRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('Operational Report Service', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });


  // ============================================================================
  // Work Order Summary Report Tests
  // ============================================================================

  describe('generateWorkOrderSummaryReport', () => {
    const mockWorkOrderRows = [
      {
        workOrderId: 'wo-1',
        workOrderNumber: 'WO-2024-001',
        assetId: 'asset-1',
        assetTag: 'AMS-HW-001',
        workType: 'PREVENTIVE',
        priority: 'MEDIUM',
        status: 'COMPLETED',
        title: 'Quarterly Maintenance',
        assignedTo: 'tech-1',
        assignedToName: 'John Technician',
        scheduledDate: '2024-01-10T00:00:00.000Z',
        dueDate: '2024-01-15T00:00:00.000Z',
        completedDate: '2024-01-14T00:00:00.000Z',
        estimatedDurationHours: 2,
        actualDurationHours: 1.5,
        completionTimeHours: 96,
        isOverdue: false,
      },
    ];

    const mockSummary = {
      period: { from: '2023-10-15T00:00:00.000Z', to: '2024-01-15T00:00:00.000Z' },
      totalWorkOrders: 1,
      byStatus: [{ category: 'COMPLETED', count: 1, percentage: 100 }],
      byType: [{ category: 'PREVENTIVE', count: 1, percentage: 100 }],
      byPriority: [{ category: 'MEDIUM', count: 1, percentage: 100 }],
      averageCompletionTimeHours: 96,
      overdueCount: 0,
      completedOnTimeCount: 1,
      completedLateCount: 0,
      completionRate: 100,
    };

    beforeEach(() => {
      mockOperationalRepository.getWorkOrderSummaryData.mockResolvedValue({
        rows: mockWorkOrderRows,
        total: 1,
      });
      mockOperationalRepository.getWorkOrderSummarySummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'LIFECYCLE_STATUS',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = { format: '' as any };
        await expect(
          operationalReportService.generateWorkOrderSummaryReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });

      it('should throw error when format is invalid', async () => {
        const request = { format: 'INVALID' as any };
        await expect(
          operationalReportService.generateWorkOrderSummaryReport(request, userId)
        ).rejects.toThrow('Invalid export format');
      });

      it('should throw error when dateFrom is after dateTo', async () => {
        const request = {
          format: 'CSV' as const,
          dateFrom: '2024-06-01T00:00:00.000Z',
          dateTo: '2024-01-01T00:00:00.000Z',
        };
        await expect(
          operationalReportService.generateWorkOrderSummaryReport(request, userId)
        ).rejects.toThrow('dateFrom must be before dateTo');
      });
    });

    describe('successful generation', () => {
      it('should generate work order summary report in CSV format', async () => {
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateWorkOrderSummaryReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('LIFECYCLE_STATUS');
        expect(result.metadata.format).toBe('CSV');
        expect(result.content).toBeDefined();
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate work order summary report in Excel format', async () => {
        const request = { format: 'EXCEL' as const };
        const result = await operationalReportService.generateWorkOrderSummaryReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
      });

      it('should generate work order summary report in PDF format', async () => {
        const request = { format: 'PDF' as const };
        const result = await operationalReportService.generateWorkOrderSummaryReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
      });

      it('should apply filters to work order summary report', async () => {
        const request = {
          format: 'CSV' as const,
          filters: {
            workOrderStatus: 'COMPLETED',
            priority: 'HIGH',
          },
        };
        await operationalReportService.generateWorkOrderSummaryReport(request, userId);

        expect(mockOperationalRepository.getWorkOrderSummaryData).toHaveBeenCalledWith(
          expect.objectContaining({
            workOrderStatus: 'COMPLETED',
            priority: 'HIGH',
          }),
          expect.any(String),
          expect.any(String)
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockOperationalRepository.getWorkOrderSummaryData.mockRejectedValue(
          new Error('Database error')
        );
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateWorkOrderSummaryReport(request, userId);

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });


  // ============================================================================
  // Maintenance Compliance Report Tests
  // ============================================================================

  describe('generateMaintenanceComplianceReport', () => {
    const mockComplianceRows = [
      {
        planId: 'plan-1',
        planName: 'Monthly Server Check',
        assetId: 'asset-1',
        assetTag: 'AMS-HW-001',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
        lastPerformedDate: '2024-01-01T00:00:00.000Z',
        nextDueDate: '2024-01-31T00:00:00.000Z',
        executionCount: 12,
        isActive: true,
        isOverdue: false,
        daysOverdue: 0,
        completedCount: 12,
        onTimeCount: 11,
        adherenceRate: 91.67,
      },
    ];

    const mockSummary = {
      totalPlans: 1,
      activePlans: 1,
      overdueCount: 0,
      dueSoonCount: 1,
      complianceRate: 100,
      averageAdherenceRate: 91.67,
      byMaintenanceType: [{ category: 'PREVENTIVE', totalPlans: 1, overdueCount: 0, complianceRate: 100 }],
      byAssetType: [{ category: 'HARDWARE', totalPlans: 1, overdueCount: 0, complianceRate: 100 }],
    };

    beforeEach(() => {
      mockOperationalRepository.getMaintenanceComplianceData.mockResolvedValue({
        rows: mockComplianceRows,
        total: 1,
      });
      mockOperationalRepository.getMaintenanceComplianceSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'COMPLIANCE_SUMMARY',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('validation', () => {
      it('should throw error when format is missing', async () => {
        const request = { format: '' as any };
        await expect(
          operationalReportService.generateMaintenanceComplianceReport(request, userId)
        ).rejects.toThrow('Export format is required');
      });
    });

    describe('successful generation', () => {
      it('should generate maintenance compliance report in CSV format', async () => {
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateMaintenanceComplianceReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('COMPLIANCE_SUMMARY');
        expect(result.content).toBeDefined();
      });

      it('should apply filters to maintenance compliance report', async () => {
        const request = {
          format: 'CSV' as const,
          filters: { maintenanceType: 'PREVENTIVE' },
        };
        await operationalReportService.generateMaintenanceComplianceReport(request, userId);

        expect(mockOperationalRepository.getMaintenanceComplianceData).toHaveBeenCalledWith(
          expect.objectContaining({ maintenanceType: 'PREVENTIVE' })
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockOperationalRepository.getMaintenanceComplianceData.mockRejectedValue(
          new Error('Database error')
        );
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateMaintenanceComplianceReport(request, userId);

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });

  // ============================================================================
  // Stockroom Inventory Report Tests
  // ============================================================================

  describe('generateStockroomInventoryReport', () => {
    const mockInventoryRows = [
      {
        stockroomId: 'sr-1',
        stockroomCode: 'SR-001',
        stockroomName: 'Main Warehouse',
        stockroomType: 'WAREHOUSE',
        capacityUnits: 1000,
        currentCount: 750,
        utilizationPercentage: 75,
        assetCount: 500,
        inStockCount: 450,
        reservedCount: 50,
        binCount: 100,
        binsBelowReorder: 5,
        hasReorderAlert: true,
      },
    ];

    const mockSummary = {
      totalStockrooms: 1,
      totalCapacity: 1000,
      totalCurrentCount: 750,
      overallUtilization: 75,
      stockroomsOverCapacity: 0,
      stockroomsUnderUtilized: 0,
      totalReorderAlerts: 5,
      byStockroomType: [{ stockroomType: 'WAREHOUSE', count: 1, totalCapacity: 1000, totalCurrentCount: 750, averageUtilization: 75 }],
    };

    beforeEach(() => {
      mockOperationalRepository.getStockroomInventoryData.mockResolvedValue({
        rows: mockInventoryRows,
        total: 1,
      });
      mockOperationalRepository.getStockroomInventorySummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'ASSET_INVENTORY',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('successful generation', () => {
      it('should generate stockroom inventory report in CSV format', async () => {
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateStockroomInventoryReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('ASSET_INVENTORY');
        expect(result.content).toBeDefined();
      });

      it('should apply stockroom filters', async () => {
        const request = {
          format: 'CSV' as const,
          filters: { stockroomId: 'sr-1', stockroomType: 'WAREHOUSE' },
        };
        await operationalReportService.generateStockroomInventoryReport(request, userId);

        expect(mockOperationalRepository.getStockroomInventoryData).toHaveBeenCalledWith(
          expect.objectContaining({ stockroomId: 'sr-1', stockroomType: 'WAREHOUSE' })
        );
      });
    });
  });


  // ============================================================================
  // Transfer Order Report Tests
  // ============================================================================

  describe('generateTransferOrderReport', () => {
    const mockTransferRows = [
      {
        transferId: 'tr-1',
        transferNumber: 'TR-2024-001',
        status: 'COMPLETED',
        sourceStockroomId: 'sr-1',
        sourceStockroomName: 'Main Warehouse',
        destinationStockroomId: 'sr-2',
        destinationStockroomName: 'Branch Office',
        requestedBy: 'user-1',
        requestedByName: 'John Doe',
        requestedDate: '2024-01-10T00:00:00.000Z',
        shippedDate: '2024-01-11T00:00:00.000Z',
        receivedDate: '2024-01-12T00:00:00.000Z',
        quantityRequested: 10,
        quantityShipped: 10,
        quantityReceived: 10,
        fulfillmentTimeHours: 48,
      },
    ];

    const mockSummary = {
      period: { from: '2023-10-15T00:00:00.000Z', to: '2024-01-15T00:00:00.000Z' },
      totalTransfers: 1,
      completedTransfers: 1,
      pendingTransfers: 0,
      cancelledTransfers: 0,
      totalQuantityTransferred: 10,
      averageFulfillmentTimeHours: 48,
      bySourceStockroom: [{ stockroomId: 'sr-1', stockroomName: 'Main Warehouse', transferCount: 1, totalQuantity: 10 }],
      byDestinationStockroom: [{ stockroomId: 'sr-2', stockroomName: 'Branch Office', transferCount: 1, totalQuantity: 10 }],
      byStatus: [{ status: 'COMPLETED', count: 1, percentage: 100 }],
    };

    beforeEach(() => {
      mockOperationalRepository.getTransferOrderData.mockResolvedValue({
        rows: mockTransferRows,
        total: 1,
      });
      mockOperationalRepository.getTransferOrderSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'ASSET_INVENTORY',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('successful generation', () => {
      it('should generate transfer order report in CSV format', async () => {
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateTransferOrderReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('ASSET_INVENTORY');
        expect(result.content).toBeDefined();
      });

      it('should apply date range filters', async () => {
        const request = {
          format: 'CSV' as const,
          dateFrom: '2024-01-01T00:00:00.000Z',
          dateTo: '2024-01-31T00:00:00.000Z',
        };
        await operationalReportService.generateTransferOrderReport(request, userId);

        expect(mockOperationalRepository.getTransferOrderData).toHaveBeenCalledWith(
          expect.anything(),
          '2024-01-01T00:00:00.000Z',
          '2024-01-31T00:00:00.000Z'
        );
      });
    });
  });

  // ============================================================================
  // Asset Lifecycle Report Tests
  // ============================================================================

  describe('generateAssetLifecycleReport', () => {
    const mockLifecycleRows = [
      {
        assetId: 'asset-1',
        assetTag: 'AMS-HW-001',
        assetType: 'HARDWARE',
        displayName: 'Dell Laptop',
        status: 'DEPLOYED',
        orderedDate: '2023-01-01T00:00:00.000Z',
        receivedDate: '2023-01-15T00:00:00.000Z',
        deployedDate: '2023-02-01T00:00:00.000Z',
        retiredDate: undefined,
        totalAgeDays: 380,
        daysInCurrentStatus: 348,
      },
    ];

    const mockSummary = {
      totalAssets: 1,
      byStatus: [{ status: 'DEPLOYED', count: 1, percentage: 100, averageDaysInStatus: 348 }],
      byAssetType: [{ assetType: 'HARDWARE', count: 1, averageLifecycleDays: 380 }],
      averageTimeInStage: {
        ORDERED: 14,
        RECEIVED: 17,
        IN_STOCK: 0,
        RESERVED: 0,
        DEPLOYED: 348,
        IN_MAINTENANCE: 0,
        RETIRED: 0,
        DISPOSED: 0,
      },
      averageTotalLifecycleDays: 380,
    };

    beforeEach(() => {
      mockOperationalRepository.getAssetLifecycleData.mockResolvedValue({
        rows: mockLifecycleRows,
        total: 1,
      });
      mockOperationalRepository.getAssetLifecycleSummary.mockResolvedValue(mockSummary);
      mockReportRepository.logReportAccess.mockResolvedValue({
        logId: 'log-1',
        reportId: 'report-1',
        reportType: 'LIFECYCLE_STATUS',
        accessedBy: userId,
        accessedAt: '2024-01-15T10:00:00.000Z',
        action: 'GENERATED',
        format: 'CSV',
      });
    });

    describe('successful generation', () => {
      it('should generate asset lifecycle report in CSV format', async () => {
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateAssetLifecycleReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.reportType).toBe('LIFECYCLE_STATUS');
        expect(result.content).toBeDefined();
      });

      it('should generate asset lifecycle report in all formats', async () => {
        for (const format of ['CSV', 'EXCEL', 'PDF'] as const) {
          const request = { format };
          const result = await operationalReportService.generateAssetLifecycleReport(request, userId);
          expect(result.status).toBe('COMPLETED');
          expect(result.metadata.format).toBe(format);
        }
      });

      it('should apply asset type filter', async () => {
        const request = {
          format: 'CSV' as const,
          filters: { assetType: 'HARDWARE' as const },
        };
        await operationalReportService.generateAssetLifecycleReport(request, userId);

        expect(mockOperationalRepository.getAssetLifecycleData).toHaveBeenCalledWith(
          expect.objectContaining({ assetType: 'HARDWARE' })
        );
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockOperationalRepository.getAssetLifecycleData.mockRejectedValue(
          new Error('Database error')
        );
        const request = { format: 'CSV' as const };
        const result = await operationalReportService.generateAssetLifecycleReport(request, userId);

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });

  // ============================================================================
  // Export Function Tests
  // ============================================================================

  describe('exportOperationalToCSV', () => {
    it('should export operational report to CSV format', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'LIFECYCLE_STATUS' as const,
          title: 'Work Order Summary',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {
          period: { from: '2023-10-15T00:00:00.000Z', to: '2024-01-15T00:00:00.000Z' },
          totalWorkOrders: 1,
          byStatus: [],
          byType: [],
          byPriority: [],
          averageCompletionTimeHours: 0,
          overdueCount: 0,
          completedOnTimeCount: 0,
          completedLateCount: 0,
          completionRate: 0,
        },
        rows: [
          { workOrderId: 'wo-1', workOrderNumber: 'WO-001', status: 'COMPLETED' },
        ],
      };

      const csv = operationalReportService.exportOperationalToCSV(reportData as any, 'WORK_ORDER_SUMMARY');

      expect(csv).toContain('workOrderId');
      expect(csv).toContain('workOrderNumber');
      expect(csv).toContain('WO-001');
    });

    it('should handle empty report data', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'LIFECYCLE_STATUS' as const,
          title: 'Empty Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'CSV' as const,
          filters: {},
          totalRecords: 0,
        },
        summary: {},
        rows: [],
      };

      const csv = operationalReportService.exportOperationalToCSV(reportData as any, 'WORK_ORDER_SUMMARY');
      expect(csv).toBe('');
    });
  });

  describe('exportOperationalToExcel', () => {
    it('should export operational report to Excel format (base64)', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'ASSET_INVENTORY' as const,
          title: 'Stockroom Inventory',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'EXCEL' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {},
        rows: [{ stockroomId: 'sr-1', stockroomName: 'Main Warehouse' }],
      };

      const excel = operationalReportService.exportOperationalToExcel(reportData as any, 'STOCKROOM_INVENTORY');
      expect(() => Buffer.from(excel, 'base64')).not.toThrow();
    });
  });

  describe('exportOperationalToPDF', () => {
    it('should export operational report to PDF format (base64)', () => {
      const reportData = {
        metadata: {
          reportId: 'report-1',
          reportType: 'LIFECYCLE_STATUS' as const,
          title: 'Asset Lifecycle',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: 'user-1',
          format: 'PDF' as const,
          filters: {},
          totalRecords: 1,
        },
        summary: {},
        rows: [{ assetId: 'asset-1', assetTag: 'AMS-HW-001' }],
      };

      const pdf = operationalReportService.exportOperationalToPDF(reportData as any, 'ASSET_LIFECYCLE');
      expect(() => Buffer.from(pdf, 'base64')).not.toThrow();
    });
  });
});
