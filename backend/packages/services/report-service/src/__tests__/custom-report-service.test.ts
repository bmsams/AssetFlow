/**
 * Custom Report Service Unit Tests
 *
 * Tests for Custom Report Service:
 * - Custom report generation (Requirement 16.2)
 * - Configurable columns, filters, groupings (Requirement 16.2)
 * - Report access logging (Requirement 16.9)
 */

// Mock dependencies before importing service
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

// Mock repositories
jest.mock('../report/report-repository');
jest.mock('../custom/custom-report-repository');

import * as customReportService from '../custom/custom-report-service';
import * as customReportRepository from '../custom/custom-report-repository';
import * as reportRepository from '../report/report-repository';
import type {
  CustomReportDefinition,
  CustomReportRow,
  GenerateCustomReportRequest,
} from '../report/report-types';

const mockCustomRepository = customReportRepository as jest.Mocked<typeof customReportRepository>;
const mockReportRepository = reportRepository as jest.Mocked<typeof reportRepository>;

describe('Custom Report Service', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });


  describe('generateCustomReport', () => {
    const validDefinition: CustomReportDefinition = {
      dataSource: 'HARDWARE_ASSETS',
      columns: [
        { columnId: 'col-1', fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING' },
        { columnId: 'col-2', fieldName: 'manufacturer', displayName: 'Manufacturer', dataType: 'STRING' },
        { columnId: 'col-3', fieldName: 'purchase_price', displayName: 'Purchase Price', dataType: 'CURRENCY', aggregation: 'SUM' },
      ],
    };

    const mockRows: CustomReportRow[] = [
      { asset_tag: 'AMS-HW-001', manufacturer: 'Dell', purchase_price: 1500 },
      { asset_tag: 'AMS-HW-002', manufacturer: 'HP', purchase_price: 1200 },
      { asset_tag: 'AMS-HW-003', manufacturer: 'Dell', purchase_price: 1800 },
    ];

    beforeEach(() => {
      mockCustomRepository.fetchCustomReportData.mockResolvedValue(mockRows);
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

    describe('validation', () => {
      it('should throw error when dataSource is missing', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: '' as any,
            columns: validDefinition.columns,
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'Data source is required'
        );
      });

      it('should throw error when dataSource is invalid', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: 'INVALID_SOURCE' as any,
            columns: validDefinition.columns,
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'Invalid data source'
        );
      });

      it('should throw error when columns are missing', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: 'HARDWARE_ASSETS',
            columns: [],
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'At least one column is required'
        );
      });

      it('should throw error when column fieldName is invalid', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: 'HARDWARE_ASSETS',
            columns: [
              { columnId: 'col-1', fieldName: 'invalid_field', displayName: 'Invalid', dataType: 'STRING' },
            ],
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'Invalid column fieldName'
        );
      });

      it('should throw error when filter operator is invalid', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: 'HARDWARE_ASSETS',
            columns: validDefinition.columns,
            filters: [
              { filterId: 'f1', fieldName: 'manufacturer', operator: 'INVALID_OP' as any, value: 'Dell' },
            ],
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'Invalid filter operator'
        );
      });

      it('should throw error when BETWEEN filter has invalid value', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            dataSource: 'HARDWARE_ASSETS',
            columns: validDefinition.columns,
            filters: [
              { filterId: 'f1', fieldName: 'purchase_price', operator: 'BETWEEN', value: 1000 },
            ],
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'BETWEEN operator requires an array of two values'
        );
      });

      it('should throw error when rowLimit is out of range', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            ...validDefinition,
            rowLimit: 200000,
          },
          format: 'CSV',
        };

        await expect(customReportService.generateCustomReport(request, userId)).rejects.toThrow(
          'Row limit must be between 1 and 100000'
        );
      });
    });

    describe('successful generation', () => {
      it('should generate custom report in CSV format', async () => {
        const request: GenerateCustomReportRequest = {
          definition: validDefinition,
          format: 'CSV',
          title: 'Hardware Assets Report',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.title).toBe('Hardware Assets Report');
        expect(result.content).toBeDefined();
        expect(mockCustomRepository.fetchCustomReportData).toHaveBeenCalledWith(validDefinition);
        expect(mockReportRepository.logReportAccess).toHaveBeenCalled();
      });

      it('should generate custom report in Excel format', async () => {
        const request: GenerateCustomReportRequest = {
          definition: validDefinition,
          format: 'EXCEL',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('EXCEL');
        expect(result.content).toBeDefined();
      });

      it('should generate custom report in PDF format', async () => {
        const request: GenerateCustomReportRequest = {
          definition: validDefinition,
          format: 'PDF',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('COMPLETED');
        expect(result.metadata.format).toBe('PDF');
        expect(result.content).toBeDefined();
      });

      it('should apply filters to custom report', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            ...validDefinition,
            filters: [
              { filterId: 'f1', fieldName: 'manufacturer', operator: 'EQUALS', value: 'Dell' },
            ],
          },
          format: 'CSV',
        };

        await customReportService.generateCustomReport(request, userId);

        expect(mockCustomRepository.fetchCustomReportData).toHaveBeenCalledWith(
          expect.objectContaining({
            filters: expect.arrayContaining([
              expect.objectContaining({ fieldName: 'manufacturer', operator: 'EQUALS' }),
            ]),
          })
        );
      });

      it('should apply groupings to custom report', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            ...validDefinition,
            groupings: [
              { groupId: 'g1', fieldName: 'manufacturer', displayName: 'Manufacturer', order: 1, showSubtotals: true },
            ],
          },
          format: 'CSV',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('COMPLETED');
      });

      it('should calculate grand totals when requested', async () => {
        const request: GenerateCustomReportRequest = {
          definition: {
            ...validDefinition,
            includeGrandTotal: true,
          },
          format: 'CSV',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('COMPLETED');
      });
    });

    describe('error handling', () => {
      it('should return FAILED status when repository throws error', async () => {
        mockCustomRepository.fetchCustomReportData.mockRejectedValue(new Error('Database error'));

        const request: GenerateCustomReportRequest = {
          definition: validDefinition,
          format: 'CSV',
        };

        const result = await customReportService.generateCustomReport(request, userId);

        expect(result.status).toBe('FAILED');
        expect(result.errorMessage).toBe('Database error');
      });
    });
  });

  describe('getAvailableFields', () => {
    it('should return available fields for HARDWARE_ASSETS', () => {
      const result = customReportService.getAvailableFields('HARDWARE_ASSETS');

      expect(result.dataSource).toBe('HARDWARE_ASSETS');
      expect(result.fields.length).toBeGreaterThan(0);
      expect(result.fields.some(f => f.fieldName === 'asset_tag')).toBe(true);
      expect(result.fields.some(f => f.fieldName === 'manufacturer')).toBe(true);
      expect(result.fields.some(f => f.fieldName === 'purchase_price')).toBe(true);
    });

    it('should return available fields for SOFTWARE_ASSETS', () => {
      const result = customReportService.getAvailableFields('SOFTWARE_ASSETS');

      expect(result.dataSource).toBe('SOFTWARE_ASSETS');
      expect(result.fields.some(f => f.fieldName === 'publisher')).toBe(true);
      expect(result.fields.some(f => f.fieldName === 'product_name')).toBe(true);
    });

    it('should return available fields for CONTRACTS', () => {
      const result = customReportService.getAvailableFields('CONTRACTS');

      expect(result.dataSource).toBe('CONTRACTS');
      expect(result.fields.some(f => f.fieldName === 'contract_number')).toBe(true);
      expect(result.fields.some(f => f.fieldName === 'total_value')).toBe(true);
    });

    it('should include field metadata', () => {
      const result = customReportService.getAvailableFields('HARDWARE_ASSETS');
      const priceField = result.fields.find(f => f.fieldName === 'purchase_price');

      expect(priceField).toBeDefined();
      expect(priceField?.dataType).toBe('CURRENCY');
      expect(priceField?.aggregatable).toBe(true);
      expect(priceField?.filterable).toBe(true);
      expect(priceField?.sortable).toBe(true);
    });
  });
});
