/**
 * Receiving Service Unit Tests
 *
 * Tests for Receiving Service:
 * - Recording receiving from PO (Requirement 6.4, 6.5)
 * - Recording manual receiving (Requirement 6.4)
 * - Scanning assets (Requirement 6.4, 6.5)
 */

// Mock the dependencies before importing service
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  ensureUserIdFromAuthClaims: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
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
import { queryOne, queryMany } from '@ams/database';

const mockReceivingRepository = receivingRepository as jest.Mocked<typeof receivingRepository>;
const mockPublishEvent = publishEvent as jest.Mock;
const mockQueryOne = queryOne as jest.Mock;
const mockQueryMany = queryMany as jest.Mock;

describe('Receiving Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordReceivingFromPO', () => {
    const mockPO = {
      po_id: '123e4567-e89b-12d3-a456-426614174001',
      status: 'APPROVED',
      po_number: 'PO-ABC123',
    };

    it('should create receiving record and lines for a receivable PO', async () => {
      const createdRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: mockPO.po_id,
        poNumber: mockPO.po_number,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: '123e4567-e89b-12d3-a456-426614174030',
        stockroomName: 'Main Stockroom',
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 0,
        totalLinesReceived: 0,
        totalQuantityExpected: 0,
        totalQuantityReceived: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      const line1 = {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: createdRecord.receivingId,
        poLineId: '123e4567-e89b-12d3-a456-426614174010',
        lineNumber: 1,
        productId: null,
        productType: 'HARDWARE',
        productName: 'Laptop',
        quantityExpected: 3,
        quantityReceived: 0,
        condition: 'NEW' as const,
        assetIdsCreated: [],
        serialNumbersScanned: [],
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };
      const line2 = {
        ...line1,
        lineId: '123e4567-e89b-12d3-a456-426614174041',
        poLineId: '123e4567-e89b-12d3-a456-426614174011',
        lineNumber: 2,
        quantityExpected: 2,
      };

      const refreshedRecord = {
        ...createdRecord,
        totalLinesExpected: 2,
        totalQuantityExpected: 5,
      };

      mockQueryOne.mockResolvedValueOnce(mockPO);
      mockQueryMany.mockResolvedValueOnce([
        { line_id: '123e4567-e89b-12d3-a456-426614174010', quantity: 3, received_quantity: 0 },
        { line_id: '123e4567-e89b-12d3-a456-426614174011', quantity: 2, received_quantity: 0 },
      ]);
      mockReceivingRepository.getReceivingRecordsByPO.mockResolvedValueOnce([]);
      mockReceivingRepository.createReceivingRecord.mockResolvedValueOnce(createdRecord);
      mockReceivingRepository.createReceivingLineFromPO
        .mockResolvedValueOnce(line1)
        .mockResolvedValueOnce(line2);
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce(refreshedRecord);

      const result = await receivingService.recordReceivingFromPO({
        poId: mockPO.po_id,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        stockroomId: '123e4567-e89b-12d3-a456-426614174030',
      });

      expect(mockReceivingRepository.createReceivingRecord).toHaveBeenCalledTimes(1);
      expect(mockReceivingRepository.createReceivingLineFromPO).toHaveBeenCalledTimes(2);
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'RECEIVING_STARTED',
        expect.objectContaining({
          receivingId: createdRecord.receivingId,
          poId: mockPO.po_id,
          lineCount: 2,
          totalQuantityExpected: 5,
        })
      );
      expect(result.receivingRecord.receivingId).toBe(createdRecord.receivingId);
      expect(result.lines).toHaveLength(2);
    });

    it('should throw error for non-existent PO', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      await expect(
        receivingService.recordReceivingFromPO({
          poId: 'non-existent-po',
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Purchase order not found');
    });

    it('should throw error for PO in non-receivable status', async () => {
      mockQueryOne.mockResolvedValueOnce({
        ...mockPO,
        status: 'DRAFT',
      });

      await expect(
        receivingService.recordReceivingFromPO({
          poId: mockPO.po_id,
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('cannot be received in status');
    });

    it('should throw error when no receivable lines found', async () => {
      mockQueryOne.mockResolvedValueOnce(mockPO);
      mockQueryMany.mockResolvedValueOnce([]); // No lines

      await expect(
        receivingService.recordReceivingFromPO({
          poId: mockPO.po_id,
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('No receivable lines found');

      const sql = mockQueryMany.mock.calls[0]?.[0] as string;
      expect(sql).toContain('received_quantity');
      expect(sql).not.toContain('quantity_received');
    });

    it('should reuse an active receiving record instead of creating a duplicate', async () => {
      const activeRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: mockPO.po_id,
        poNumber: mockPO.po_number,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: null,
        stockroomName: null,
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 1,
        totalLinesReceived: 0,
        totalQuantityExpected: 5,
        totalQuantityReceived: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };
      const existingLine = {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: activeRecord.receivingId,
        poLineId: '123e4567-e89b-12d3-a456-426614174010',
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

      mockQueryOne.mockResolvedValueOnce(mockPO);
      mockQueryMany.mockResolvedValueOnce([
        { line_id: '123e4567-e89b-12d3-a456-426614174010', quantity: 5, received_quantity: 0 },
      ]);
      mockReceivingRepository.getReceivingRecordsByPO.mockResolvedValueOnce([activeRecord]);
      mockReceivingRepository.getReceivingLines.mockResolvedValueOnce([existingLine]);
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce(activeRecord);

      const result = await receivingService.recordReceivingFromPO({
        poId: mockPO.po_id,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(mockReceivingRepository.createReceivingRecord).not.toHaveBeenCalled();
      expect(mockReceivingRepository.createReceivingLineFromPO).not.toHaveBeenCalled();
      expect(result.receivingRecord.receivingId).toBe(activeRecord.receivingId);
      expect(result.lines).toHaveLength(1);
      expect(mockPublishEvent).not.toHaveBeenCalledWith('RECEIVING_STARTED', expect.anything());
    });

    it('should add only missing lines when reusing an active receiving record', async () => {
      const activeRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: mockPO.po_id,
        poNumber: mockPO.po_number,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: null,
        stockroomName: null,
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 1,
        totalLinesReceived: 0,
        totalQuantityExpected: 5,
        totalQuantityReceived: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };
      const existingLine = {
        lineId: '123e4567-e89b-12d3-a456-426614174040',
        receivingId: activeRecord.receivingId,
        poLineId: '123e4567-e89b-12d3-a456-426614174010',
        lineNumber: 1,
        productId: null,
        productType: 'HARDWARE',
        productName: 'Line 1',
        quantityExpected: 5,
        quantityReceived: 0,
        condition: 'NEW' as const,
        assetIdsCreated: [],
        serialNumbersScanned: [],
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };
      const createdLine = {
        ...existingLine,
        lineId: '123e4567-e89b-12d3-a456-426614174041',
        poLineId: '123e4567-e89b-12d3-a456-426614174011',
        lineNumber: 2,
        productName: 'Line 2',
        quantityExpected: 3,
      };
      const finalLines = [existingLine, createdLine];

      mockQueryOne.mockResolvedValueOnce(mockPO);
      mockQueryMany.mockResolvedValueOnce([
        { line_id: '123e4567-e89b-12d3-a456-426614174010', quantity: 5, received_quantity: 0 },
        { line_id: '123e4567-e89b-12d3-a456-426614174011', quantity: 3, received_quantity: 0 },
      ]);
      mockReceivingRepository.getReceivingRecordsByPO.mockResolvedValueOnce([activeRecord]);
      mockReceivingRepository.getReceivingLines
        .mockResolvedValueOnce([existingLine])
        .mockResolvedValueOnce(finalLines);
      mockReceivingRepository.createReceivingLineFromPO.mockResolvedValueOnce(createdLine);
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce({
        ...activeRecord,
        totalLinesExpected: 2,
        totalQuantityExpected: 8,
      });

      const result = await receivingService.recordReceivingFromPO({
        poId: mockPO.po_id,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(mockReceivingRepository.createReceivingRecord).not.toHaveBeenCalled();
      expect(mockReceivingRepository.createReceivingLineFromPO).toHaveBeenCalledTimes(1);
      expect(mockReceivingRepository.createReceivingLineFromPO).toHaveBeenCalledWith(
        activeRecord.receivingId,
        '123e4567-e89b-12d3-a456-426614174011'
      );
      expect(result.lines).toHaveLength(2);
      expect(new Set(result.lines.map((line) => line.poLineId)).size).toBe(2);
    });

    it('should cancel newly-created receiving record when no lines can be created', async () => {
      const createdRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: mockPO.po_id,
        poNumber: mockPO.po_number,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: null,
        stockroomName: null,
        status: 'IN_PROGRESS' as const,
        notes: null,
        totalLinesExpected: 0,
        totalLinesReceived: 0,
        totalQuantityExpected: 0,
        totalQuantityReceived: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockQueryOne.mockResolvedValueOnce(mockPO);
      mockQueryMany.mockResolvedValueOnce([
        { line_id: '123e4567-e89b-12d3-a456-426614174010', quantity: 5, received_quantity: 4 },
      ]);
      mockReceivingRepository.getReceivingRecordsByPO.mockResolvedValueOnce([]);
      mockReceivingRepository.createReceivingRecord.mockResolvedValueOnce(createdRecord);
      mockReceivingRepository.createReceivingLineFromPO.mockRejectedValueOnce(
        new Error('Purchase order line has no remaining quantity to receive: 123e4567-e89b-12d3-a456-426614174010')
      );
      mockReceivingRepository.updateReceivingRecordStatus.mockResolvedValueOnce({
        ...createdRecord,
        status: 'CANCELLED',
      });

      await expect(
        receivingService.recordReceivingFromPO({
          poId: mockPO.po_id,
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('No receivable lines found');

      expect(mockReceivingRepository.updateReceivingRecordStatus).toHaveBeenCalledWith(
        createdRecord.receivingId,
        'CANCELLED'
      );
      expect(mockPublishEvent).not.toHaveBeenCalledWith('RECEIVING_STARTED', expect.anything());
    });
  });

  describe('recordReceivingManual', () => {
    it('should throw error for empty lines', async () => {
      await expect(
        receivingService.recordReceivingManual({
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          lines: [],
        })
      ).rejects.toThrow('At least one line is required');
    });

    it('should throw error for missing product name', async () => {
      await expect(
        receivingService.recordReceivingManual({
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          lines: [
            {
              productName: '',
              quantityExpected: 3,
            },
          ],
        })
      ).rejects.toThrow('Product name is required');
    });

    it('should throw error for invalid quantity', async () => {
      await expect(
        receivingService.recordReceivingManual({
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          lines: [
            {
              productName: 'Keyboard',
              quantityExpected: 0,
            },
          ],
        })
      ).rejects.toThrow('Quantity expected must be greater than 0');
    });
  });

  describe('scanAsset', () => {
    it('should throw error when all items already received', async () => {
      mockReceivingRepository.recordAssetScan.mockRejectedValueOnce(
        new Error('All items already received for this line: expected=3, received=3')
      );

      await expect(
        receivingService.scanAsset({
          receivingLineId: '123e4567-e89b-12d3-a456-426614174040',
          serialNumber: 'SN004',
        })
      ).rejects.toThrow('All items already received');
    });

    it('should throw error for non-existent receiving line', async () => {
      mockReceivingRepository.recordAssetScan.mockRejectedValueOnce(
        new Error('Receiving line not found: non-existent-line')
      );

      await expect(
        receivingService.scanAsset({
          receivingLineId: 'non-existent-line',
          serialNumber: 'SN001',
        })
      ).rejects.toThrow('Receiving line not found');
    });
  });

  describe('cancelReceiving', () => {
    it('should cancel receiving with no items received', async () => {
      const mockRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        poId: null,
        poNumber: null,
        vendorId: null,
        vendorName: null,
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        receivedByName: null,
        receivedDate: '2024-01-15T10:00:00.000Z',
        stockroomId: null,
        stockroomName: null,
        status: 'PENDING' as const,
        notes: null,
        totalLinesExpected: 1,
        totalLinesReceived: 0,
        totalQuantityExpected: 5,
        totalQuantityReceived: 0,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      };

      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce(mockRecord);
      mockReceivingRepository.updateReceivingRecordStatus.mockResolvedValueOnce({
        ...mockRecord,
        status: 'CANCELLED',
      });

      const result = await receivingService.cancelReceiving(
        mockRecord.receivingId,
        '123e4567-e89b-12d3-a456-426614174000',
        'No longer needed'
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockPublishEvent).toHaveBeenCalledWith('RECEIVING_CANCELLED', expect.any(Object));
    });

    it('should throw error when cancelling completed receiving', async () => {
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce({
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        status: 'COMPLETED' as const,
        totalQuantityReceived: 5,
      } as any);

      await expect(
        receivingService.cancelReceiving(
          '123e4567-e89b-12d3-a456-426614174020',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).rejects.toThrow('Cannot cancel a completed receiving record');
    });

    it('should throw error when items already received', async () => {
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce({
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        status: 'IN_PROGRESS' as const,
        totalQuantityReceived: 3,
      } as any);

      await expect(
        receivingService.cancelReceiving(
          '123e4567-e89b-12d3-a456-426614174020',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).rejects.toThrow('Cannot cancel receiving with 3 assets already received');
    });
  });

  describe('completeReceiving', () => {
    it('should return existing record if already completed', async () => {
      const completedRecord = {
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        status: 'COMPLETED' as const,
        totalQuantityReceived: 5,
      } as any;

      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce(completedRecord);

      const result = await receivingService.completeReceiving(
        completedRecord.receivingId,
        '123e4567-e89b-12d3-a456-426614174000'
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockPublishEvent).not.toHaveBeenCalled();
    });

    it('should throw error when completing cancelled receiving', async () => {
      mockReceivingRepository.getReceivingRecordById.mockResolvedValueOnce({
        receivingId: '123e4567-e89b-12d3-a456-426614174020',
        status: 'CANCELLED' as const,
      } as any);

      await expect(
        receivingService.completeReceiving(
          '123e4567-e89b-12d3-a456-426614174020',
          '123e4567-e89b-12d3-a456-426614174000'
        )
      ).rejects.toThrow('Cannot complete a cancelled receiving record');
    });
  });
});
