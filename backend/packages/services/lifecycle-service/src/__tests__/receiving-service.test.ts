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
