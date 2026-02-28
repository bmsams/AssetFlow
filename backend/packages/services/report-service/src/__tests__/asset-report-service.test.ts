/**
 * Asset Report Service Tests
 *
 * Tests for asset inventory report generation including summary, aging,
 * location-based, and department-based reports.
 *
 * Requirements:
 * - Requirement 18.1: Asset summary report
 * - Requirement 18.2: Asset aging report
 * - Requirement 18.3: Asset by location report
 * - Requirement 18.4: Asset by department report
 */

import type { UUID } from '@ams/types';

import * as assetReportService from '../asset-reports/asset-report-service';
import * as assetReportRepository from '../asset-reports/asset-report-repository';
import * as reportRepository from '../report/report-repository';
import { exportReportToCSV } from '../export';

// Mock dependencies
jest.mock('../asset-reports/asset-report-repository');
jest.mock('../report/report-repository');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockAssetReportRepository = assetReportRepository as jest.Mocked<typeof assetReportRepository>;
const mockReportRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('AssetReportService', () => {
  const testUserId: UUID = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    mockReportRepository.logReportAccess.mockResolvedValue({
      logId: '550e8400-e29b-41d4-a716-446655440099',
      reportId: '550e8400-e29b-41d4-a716-446655440098',
      reportType: 'ASSET_INVENTORY',
      accessedBy: testUserId,
      accessedAt: new Date().toISOString(),
      action: 'GENERATED',
      format: 'CSV',
      filters: {},
    });
  });

  describe('generateAssetSummaryReport', () => {
    const mockSummaryData: assetReportRepository.AssetSummaryData = {
      totalAssets: 150,
      totalValue: 500000,
      byType: [
        { category: 'HARDWARE', count: 100, totalValue: 400000, percentage: 66.67 },
        { category: 'SOFTWARE', count: 50, totalValue: 100000, percentage: 33.33 },
      ],
      byStatus: [
        { category: 'DEPLOYED', count: 120, totalValue: 450000, percentage: 80 },
        { category: 'IN_STOCK', count: 30, totalValue: 50000, percentage: 20 },
      ],
      byLocation: [
        { category: 'Building A', count: 80, totalValue: 300000, percentage: 53.33 },
        { category: 'Building B', count: 70, totalValue: 200000, percentage: 46.67 },
      ],
    };

    it('should generate asset summary report successfully', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.reportType).toBe('ASSET_INVENTORY');
      expect(result.metadata.totalRecords).toBe(150);
      expect(result.content).toBeDefined();
      expect(mockAssetReportRepository.getAssetSummaryData).toHaveBeenCalledWith({});
      expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
    });

    it('should apply filters when provided', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const filters: assetReportRepository.AssetReportFilters = {
        assetType: 'HARDWARE',
        departmentId: '550e8400-e29b-41d4-a716-446655440001',
      };

      await assetReportService.generateAssetSummaryReport(
        { format: 'CSV', filters },
        testUserId
      );

      expect(mockAssetReportRepository.getAssetSummaryData).toHaveBeenCalledWith(filters);
    });

    it('should generate CSV content correctly', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.content).toContain('Asset Summary Report');
      expect(result.content).toContain('HARDWARE');
      expect(result.content).toContain('Asset Type');
    });

    it('should handle Excel format', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'EXCEL' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.format).toBe('EXCEL');
      expect(result.content).toBeDefined();
    });

    it('should handle PDF format', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'PDF' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.format).toBe('PDF');
      expect(result.content).toBeDefined();
    });

    it('should return failed status on repository error', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Database connection failed');
    });

    it('should use custom title when provided', async () => {
      mockAssetReportRepository.getAssetSummaryData.mockResolvedValue(mockSummaryData);

      const result = await assetReportService.generateAssetSummaryReport(
        { format: 'CSV', title: 'Custom Report Title' },
        testUserId
      );

      expect(result.metadata.title).toBe('Custom Report Title');
    });
  });

  describe('generateAssetAgingReport', () => {
    const mockAgingData = {
      buckets: [
        { range: '0-12 months', minMonths: 0, maxMonths: 12, count: 50, totalValue: 200000, depreciatedValue: 180000 },
        { range: '1-2 years', minMonths: 12, maxMonths: 24, count: 40, totalValue: 150000, depreciatedValue: 120000 },
        { range: '2-3 years', minMonths: 24, maxMonths: 36, count: 30, totalValue: 100000, depreciatedValue: 60000 },
      ],
      rows: [
        {
          assetId: '550e8400-e29b-41d4-a716-446655440010',
          assetTag: 'AMS-HW-20240101-ABC123',
          displayName: 'Dell Laptop',
          assetType: 'HARDWARE',
          acquisitionDate: '2024-01-15',
          ageInDays: 365,
          ageInMonths: 12,
          originalValue: 1500,
          currentValue: 1200,
          depreciationStatus: 'ACTIVE' as const,
        },
      ],
    };

    it('should generate asset aging report successfully', async () => {
      mockAssetReportRepository.getAssetAgingData.mockResolvedValue(mockAgingData);

      const result = await assetReportService.generateAssetAgingReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.totalRecords).toBe(1);
      expect(mockAssetReportRepository.getAssetAgingData).toHaveBeenCalled();
    });

    it('should include details when requested', async () => {
      mockAssetReportRepository.getAssetAgingData.mockResolvedValue(mockAgingData);

      const result = await assetReportService.generateAssetAgingReport(
        { format: 'CSV', includeDetails: true },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.content).toContain('Asset Aging Report');
      expect(result.content).toContain('AMS-HW-20240101-ABC123');
    });

    it('should use custom age buckets when provided', async () => {
      mockAssetReportRepository.getAssetAgingData.mockResolvedValue(mockAgingData);

      const customBuckets = [
        { minMonths: 0, maxMonths: 6, label: '0-6 months' },
        { minMonths: 6, maxMonths: null, label: '6+ months' },
      ];

      await assetReportService.generateAssetAgingReport(
        { format: 'CSV', ageBuckets: customBuckets },
        testUserId
      );

      expect(mockAssetReportRepository.getAssetAgingData).toHaveBeenCalledWith(
        {},
        customBuckets
      );
    });

    it('should handle repository errors gracefully', async () => {
      mockAssetReportRepository.getAssetAgingData.mockRejectedValue(
        new Error('Query timeout')
      );

      const result = await assetReportService.generateAssetAgingReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Query timeout');
    });
  });

  describe('generateAssetByLocationReport', () => {
    const mockLocationData: assetReportRepository.LocationBuildingData[] = [
      {
        buildingId: '550e8400-e29b-41d4-a716-446655440020',
        buildingName: 'Headquarters',
        buildingCode: 'HQ',
        totalAssets: 100,
        totalValue: 400000,
        floors: [
          {
            floorId: '550e8400-e29b-41d4-a716-446655440021',
            floorName: 'Floor 1',
            floorNumber: 1,
            totalAssets: 60,
            totalValue: 250000,
            rooms: [
              {
                roomId: '550e8400-e29b-41d4-a716-446655440022',
                roomName: 'Server Room',
                roomNumber: '101',
                assetCount: 40,
                totalValue: 200000,
              },
            ],
          },
        ],
      },
    ];

    it('should generate asset by location report successfully', async () => {
      mockAssetReportRepository.getAssetsByLocationData.mockResolvedValue(mockLocationData);

      const result = await assetReportService.generateAssetByLocationReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.totalRecords).toBe(100);
      expect(mockAssetReportRepository.getAssetsByLocationData).toHaveBeenCalled();
    });

    it('should filter by building when provided', async () => {
      mockAssetReportRepository.getAssetsByLocationData.mockResolvedValue(mockLocationData);

      const buildingId = '550e8400-e29b-41d4-a716-446655440020';

      await assetReportService.generateAssetByLocationReport(
        { format: 'CSV', buildingId },
        testUserId
      );

      expect(mockAssetReportRepository.getAssetsByLocationData).toHaveBeenCalledWith(
        expect.objectContaining({ buildingId })
      );
    });

    it('should generate CSV with hierarchical data', async () => {
      mockAssetReportRepository.getAssetsByLocationData.mockResolvedValue(mockLocationData);

      const result = await assetReportService.generateAssetByLocationReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.content).toContain('Headquarters');
      expect(result.content).toContain('Floor 1');
      expect(result.content).toContain('Server Room');
    });

    it('should handle empty location data', async () => {
      mockAssetReportRepository.getAssetsByLocationData.mockResolvedValue([]);

      const result = await assetReportService.generateAssetByLocationReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.totalRecords).toBe(0);
    });
  });

  describe('generateAssetByDepartmentReport', () => {
    const mockDepartmentData: assetReportRepository.DepartmentAssetData[] = [
      {
        departmentId: '550e8400-e29b-41d4-a716-446655440030',
        departmentCode: 'IT',
        departmentName: 'Information Technology',
        totalAssets: 80,
        totalValue: 300000,
        byType: [
          { category: 'HARDWARE', count: 60, totalValue: 250000, percentage: 75 },
          { category: 'SOFTWARE', count: 20, totalValue: 50000, percentage: 25 },
        ],
      },
      {
        departmentId: '550e8400-e29b-41d4-a716-446655440031',
        departmentCode: 'HR',
        departmentName: 'Human Resources',
        totalAssets: 20,
        totalValue: 50000,
        byType: [
          { category: 'HARDWARE', count: 20, totalValue: 50000, percentage: 100 },
        ],
      },
    ];

    it('should generate asset by department report successfully', async () => {
      mockAssetReportRepository.getAssetsByDepartmentData.mockResolvedValue(mockDepartmentData);

      const result = await assetReportService.generateAssetByDepartmentReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('COMPLETED');
      expect(result.metadata.totalRecords).toBe(100);
      expect(mockAssetReportRepository.getAssetsByDepartmentData).toHaveBeenCalled();
    });

    it('should filter by department when provided', async () => {
      mockAssetReportRepository.getAssetsByDepartmentData.mockResolvedValue([mockDepartmentData[0]!]);

      const departmentId = '550e8400-e29b-41d4-a716-446655440030';

      await assetReportService.generateAssetByDepartmentReport(
        { format: 'CSV', departmentId },
        testUserId
      );

      expect(mockAssetReportRepository.getAssetsByDepartmentData).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId })
      );
    });

    it('should generate CSV with department breakdown', async () => {
      mockAssetReportRepository.getAssetsByDepartmentData.mockResolvedValue(mockDepartmentData);

      const result = await assetReportService.generateAssetByDepartmentReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.content).toContain('Information Technology');
      expect(result.content).toContain('Human Resources');
      expect(result.content).toContain('IT');
      expect(result.content).toContain('HR');
    });

    it('should handle repository errors gracefully', async () => {
      mockAssetReportRepository.getAssetsByDepartmentData.mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await assetReportService.generateAssetByDepartmentReport(
        { format: 'CSV' },
        testUserId
      );

      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toBe('Permission denied');
    });
  });

  describe('exportAssetReportToCSV', () => {
    it('should format CSV output correctly', () => {
      const mockData: assetReportService.AssetSummaryReport = {
        metadata: {
          reportId: '550e8400-e29b-41d4-a716-446655440040',
          reportType: 'ASSET_INVENTORY',
          title: 'Test Report',
          generatedAt: '2025-02-09T00:00:00Z',
          generatedBy: testUserId,
          format: 'CSV',
          filters: {},
          totalRecords: 1,
        },
        generatedAt: '2025-02-09T00:00:00Z',
        totalAssets: 1,
        totalValue: 1000,
        byType: [],
        byStatus: [],
        byLocation: [{ category: 'Building A', count: 1, totalValue: 1000, percentage: 100 }],
      };

      // Convert to rows for export
      const rows = mockData.byLocation.map(item => ({
        category: 'Location',
        name: item.category,
        count: item.count,
        totalValue: item.totalValue,
        percentage: item.percentage,
      }));
      const csv = exportReportToCSV(mockData.metadata.title, mockData.generatedAt, rows);

      expect(csv).toContain('Test Report');
      expect(csv).toContain('Building A');
    });

    it('should include all sections in summary report', () => {
      const mockData: assetReportService.AssetSummaryReport = {
        metadata: {
          reportId: '550e8400-e29b-41d4-a716-446655440041',
          reportType: 'ASSET_INVENTORY',
          title: 'Test Report',
          generatedAt: '2025-02-09T00:00:00Z',
          generatedBy: testUserId,
          format: 'CSV',
          filters: {},
          totalRecords: 1,
        },
        generatedAt: '2025-02-09T00:00:00Z',
        totalAssets: 1,
        totalValue: 1000,
        byType: [{ category: 'HARDWARE', count: 1, totalValue: 1000, percentage: 100 }],
        byStatus: [{ category: 'DEPLOYED', count: 1, totalValue: 1000, percentage: 100 }],
        byLocation: [{ category: 'Building Main', count: 1, totalValue: 1000, percentage: 100 }],
      };

      // Convert to rows for export
      const rows = [
        ...mockData.byType.map(item => ({ category: 'Asset Type', name: item.category, count: item.count, totalValue: item.totalValue, percentage: item.percentage })),
        ...mockData.byStatus.map(item => ({ category: 'Status', name: item.category, count: item.count, totalValue: item.totalValue, percentage: item.percentage })),
        ...mockData.byLocation.map(item => ({ category: 'Location', name: item.category, count: item.count, totalValue: item.totalValue, percentage: item.percentage })),
      ];
      const csv = exportReportToCSV(mockData.metadata.title, mockData.generatedAt, rows);

      expect(csv).toContain('Asset Type');
      expect(csv).toContain('Status');
      expect(csv).toContain('Location');
      expect(csv).toContain('HARDWARE');
      expect(csv).toContain('DEPLOYED');
    });
  });

  describe('validation', () => {
    it('should throw error for invalid export format', async () => {
      await expect(
        assetReportService.generateAssetSummaryReport(
          { format: 'INVALID' as any },
          testUserId
        )
      ).rejects.toThrow('Invalid export format');
    });
  });
});
