/**
 * Inspection Service Unit Tests
 *
 * Tests for Inspection Service:
 * - Mark for inspection (Requirement 13.1)
 * - Record inspection result (Requirement 13.2)
 * - Route to return workflow (Requirement 13.3)
 * - Track inspection history (Requirement 13.4)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
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
}));

// Mock the repository
jest.mock('../receiving/receiving-repository');

import * as receivingService from '../receiving/receiving-service';
import * as receivingRepository from '../receiving/receiving-repository';
import { publishEvent } from '@ams/events';

const mockReceivingRepository = receivingRepository as jest.Mocked<typeof receivingRepository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('Inspection Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('markForInspection', () => {
    const mockReceivingLine = {
      lineId: '123e4567-e89b-12d3-a456-426614174040',
      receivingId: '123e4567-e89b-12d3-a456-426614174020',
      poLineId: null,
      lineNumber: 1,
      productId: null,
      productType: 'HARDWARE',
      productName: 'MacBook Pro',
      quantityExpected: 5,
      quantityReceived: 0,
      condition: 'NEW' as const,
      assetIdsCreated: [],
      serialNumbersScanned: [],
      notes: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    const mockInspectionRecord = {
      inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
      assetId: null,
      serialNumber: 'SN12345',
      inspectionStatus: 'PENDING' as const,
      inspectedBy: null,
      inspectedByName: null,
      inspectedDate: null,
      result: null,
      notes: 'Requires quality check',
      failureReason: null,
      routedToReturn: false,
      returnOrderId: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    it('should mark item for inspection successfully', async () => {
      mockReceivingRepository.getReceivingLineById.mockResolvedValue(mockReceivingLine);
      mockReceivingRepository.createInspectionRecord.mockResolvedValue(mockInspectionRecord);

      const result = await receivingService.markForInspection({
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        serialNumber: 'SN12345',
        notes: 'Requires quality check',
        markedBy: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.inspectionRecord.inspectionId).toBe('123e4567-e89b-12d3-a456-426614174050');
      expect(result.inspectionRecord.inspectionStatus).toBe('PENDING');
      expect(mockPublishEvent).toHaveBeenCalledWith('INSPECTION_REQUIRED', expect.any(Object));
    });

    it('should throw error for non-existent receiving line', async () => {
      mockReceivingRepository.getReceivingLineById.mockResolvedValue(null);

      await expect(
        receivingService.markForInspection({
          receivingLineId: 'non-existent-line',
          markedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Receiving line not found');
    });
  });

  describe('recordInspectionResult', () => {
    const mockPendingInspection = {
      inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
      assetId: null,
      serialNumber: 'SN12345',
      inspectionStatus: 'PENDING' as const,
      inspectedBy: null,
      inspectedByName: null,
      inspectedDate: null,
      result: null,
      notes: null,
      failureReason: null,
      routedToReturn: false,
      returnOrderId: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    const mockReceivingLine = {
      lineId: '123e4567-e89b-12d3-a456-426614174040',
      receivingId: '123e4567-e89b-12d3-a456-426614174020',
      poLineId: null,
      lineNumber: 1,
      productId: null,
      productType: 'HARDWARE',
      productName: 'MacBook Pro',
      quantityExpected: 5,
      quantityReceived: 0,
      condition: 'NEW' as const,
      assetIdsCreated: [],
      serialNumbersScanned: [],
      notes: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    it('should record passed inspection and create asset', async () => {
      const passedInspection = {
        ...mockPendingInspection,
        inspectionStatus: 'PASSED' as const,
        result: 'PASSED' as const,
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        inspectedDate: '2024-01-15T10:00:00.000Z',
      };

      const mockAsset = {
        assetId: '123e4567-e89b-12d3-a456-426614174060',
        assetTag: 'AST-ABC123-XYZ',
        serialNumber: 'SN12345',
        productName: 'MacBook Pro',
        status: 'IN_STOCK' as const,
        receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
      };

      mockReceivingRepository.getInspectionRecordById.mockResolvedValue(mockPendingInspection);
      mockReceivingRepository.recordInspectionResult.mockResolvedValue(passedInspection);
      mockReceivingRepository.getReceivingLineById.mockResolvedValue(mockReceivingLine);
      mockReceivingRepository.recordAssetScan.mockResolvedValue(mockAsset);

      const result = await receivingService.recordInspectionResult({
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        result: 'PASSED',
        notes: 'All checks passed',
      });

      expect(result.inspectionRecord.result).toBe('PASSED');
      expect(result.assetCreated).toBeDefined();
      expect(result.assetCreated?.assetId).toBe('123e4567-e89b-12d3-a456-426614174060');
      expect(result.routedToReturn).toBe(false);
      expect(mockPublishEvent).toHaveBeenCalledWith('INSPECTION_PASSED', expect.any(Object));
    });

    it('should record failed inspection and route to return', async () => {
      const failedInspection = {
        ...mockPendingInspection,
        inspectionStatus: 'FAILED' as const,
        result: 'FAILED' as const,
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        inspectedDate: '2024-01-15T10:00:00.000Z',
        failureReason: 'Screen cracked',
      };

      mockReceivingRepository.getInspectionRecordById.mockResolvedValue(mockPendingInspection);
      mockReceivingRepository.recordInspectionResult.mockResolvedValue(failedInspection);
      mockReceivingRepository.getReceivingLineById.mockResolvedValue(mockReceivingLine);

      const result = await receivingService.recordInspectionResult({
        inspectionId: '123e4567-e89b-12d3-a456-426614174050',
        inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
        result: 'FAILED',
        failureReason: 'Screen cracked',
      });

      expect(result.inspectionRecord.result).toBe('FAILED');
      expect(result.assetCreated).toBeUndefined();
      expect(result.routedToReturn).toBe(true);
      expect(mockPublishEvent).toHaveBeenCalledWith('INSPECTION_FAILED', expect.any(Object));
    });

    it('should throw error for non-existent inspection', async () => {
      mockReceivingRepository.getInspectionRecordById.mockResolvedValue(null);

      await expect(
        receivingService.recordInspectionResult({
          inspectionId: 'non-existent-inspection',
          inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
          result: 'PASSED',
        })
      ).rejects.toThrow('Inspection record not found');
    });

    it('should throw error for already completed inspection', async () => {
      const completedInspection = {
        ...mockPendingInspection,
        inspectionStatus: 'PASSED' as const,
        result: 'PASSED' as const,
      };

      mockReceivingRepository.getInspectionRecordById.mockResolvedValue(completedInspection);

      await expect(
        receivingService.recordInspectionResult({
          inspectionId: '123e4567-e89b-12d3-a456-426614174050',
          inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
          result: 'FAILED',
        })
      ).rejects.toThrow('Inspection already completed');
    });
  });

  describe('routeInspectionToReturn', () => {
    const mockFailedInspection = {
      inspectionId: '123e4567-e89b-12d3-a456-426614174050',
      receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
      assetId: null,
      serialNumber: 'SN12345',
      inspectionStatus: 'FAILED' as const,
      inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
      inspectedByName: null,
      inspectedDate: '2024-01-15T10:00:00.000Z',
      result: 'FAILED' as const,
      notes: null,
      failureReason: 'Screen cracked',
      routedToReturn: false,
      returnOrderId: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    };

    it('should route failed inspection to return workflow', async () => {
      const routedInspection = {
        ...mockFailedInspection,
        routedToReturn: true,
        returnOrderId: '123e4567-e89b-12d3-a456-426614174070',
      };

      mockReceivingRepository.routeInspectionToReturn.mockResolvedValue(routedInspection);

      const result = await receivingService.routeInspectionToReturn(
        '123e4567-e89b-12d3-a456-426614174050',
        '123e4567-e89b-12d3-a456-426614174070',
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result.routedToReturn).toBe(true);
      expect(result.returnOrderId).toBe('123e4567-e89b-12d3-a456-426614174070');
      expect(mockPublishEvent).toHaveBeenCalledWith('INSPECTION_ROUTED_TO_RETURN', expect.any(Object));
    });

    it('should throw error for non-failed inspection', async () => {
      mockReceivingRepository.routeInspectionToReturn.mockRejectedValue(
        new Error('Cannot route non-failed inspection to return')
      );

      await expect(
        receivingService.routeInspectionToReturn(
          '123e4567-e89b-12d3-a456-426614174050',
          '123e4567-e89b-12d3-a456-426614174070',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).rejects.toThrow('Cannot route non-failed inspection');
    });

    it('should throw error for already routed inspection', async () => {
      mockReceivingRepository.routeInspectionToReturn.mockRejectedValue(
        new Error('Inspection already routed to return')
      );

      await expect(
        receivingService.routeInspectionToReturn(
          '123e4567-e89b-12d3-a456-426614174050',
          '123e4567-e89b-12d3-a456-426614174070',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).rejects.toThrow('Inspection already routed');
    });
  });

  describe('getInspectionHistoryByAsset', () => {
    it('should return inspection history for asset', async () => {
      const mockHistory = [
        {
          inspectionId: '123e4567-e89b-12d3-a456-426614174050',
          receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
          assetId: '123e4567-e89b-12d3-a456-426614174060',
          serialNumber: 'SN12345',
          inspectionStatus: 'PASSED' as const,
          inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
          inspectedByName: 'Test Inspector',
          inspectedDate: '2024-01-15T10:00:00.000Z',
          result: 'PASSED' as const,
          notes: 'All checks passed',
          failureReason: null,
          routedToReturn: false,
          returnOrderId: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockReceivingRepository.getInspectionHistoryByAsset.mockResolvedValue(mockHistory);

      const result = await receivingService.getInspectionHistoryByAsset(
        '123e4567-e89b-12d3-a456-426614174060'
      );

      expect(result.length).toBe(1);
      expect(result[0]?.assetId).toBe('123e4567-e89b-12d3-a456-426614174060');
    });
  });

  describe('getPendingInspectionsCount', () => {
    it('should return count of pending inspections', async () => {
      mockReceivingRepository.getPendingInspectionsCount.mockResolvedValue(3);

      const result = await receivingService.getPendingInspectionsCount(
        '123e4567-e89b-12d3-a456-426614174020'
      );

      expect(result).toBe(3);
    });
  });

  describe('getFailedInspections', () => {
    it('should return failed inspections for receiving', async () => {
      const mockFailed = [
        {
          inspectionId: '123e4567-e89b-12d3-a456-426614174050',
          receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
          assetId: null,
          serialNumber: 'SN12345',
          inspectionStatus: 'FAILED' as const,
          inspectedBy: '123e4567-e89b-12d3-a456-426614174000',
          inspectedByName: null,
          inspectedDate: '2024-01-15T10:00:00.000Z',
          result: 'FAILED' as const,
          notes: null,
          failureReason: 'Screen cracked',
          routedToReturn: false,
          returnOrderId: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      mockReceivingRepository.getFailedInspections.mockResolvedValue(mockFailed);

      const result = await receivingService.getFailedInspections(
        '123e4567-e89b-12d3-a456-426614174020'
      );

      expect(result.length).toBe(1);
      expect(result[0]?.result).toBe('FAILED');
    });
  });
});
