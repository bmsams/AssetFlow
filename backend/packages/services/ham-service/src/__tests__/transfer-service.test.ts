/**
 * Transfer Service Unit Tests
 *
 * Tests for Transfer Order Service:
 * - Transfer order creation (Requirement 3.10)
 * - Approval workflow (Requirement 3.10)
 * - Transfer completion and inventory updates (Requirement 3.10)
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
}));

// Mock the repositories
jest.mock('../transfer/transfer-repository');
jest.mock('../stockroom/stockroom-repository');

import * as transferService from '../transfer/transfer-service';
import * as transferRepository from '../transfer/transfer-repository';
import * as stockroomRepository from '../stockroom/stockroom-repository';
import { publishEvent } from '@ams/events';

const mockTransferRepository = transferRepository as jest.Mocked<typeof transferRepository>;
const mockStockroomRepository = stockroomRepository as jest.Mocked<typeof stockroomRepository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('Transfer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransfer', () => {
    const mockFromStockroom = {
      stockroomId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Main Stockroom',
      isActive: true,
    };

    const mockToStockroom = {
      stockroomId: '123e4567-e89b-12d3-a456-426614174002',
      name: 'Satellite Stockroom',
      isActive: true,
    };

    const mockTransfer = {
      transferId: '123e4567-e89b-12d3-a456-426614174003',
      transferNumber: 'TRF-ABC123-XYZ',
      fromStockroomId: mockFromStockroom.stockroomId,
      toStockroomId: mockToStockroom.stockroomId,
      status: 'PENDING_APPROVAL' as const,
      priority: 'NORMAL' as const,
      requestedBy: '123e4567-e89b-12d3-a456-426614174000',
      requestedDate: '2024-01-15T10:00:00.000Z',
      totalLineCount: 1,
      totalQuantity: 5,
      shippedQuantity: 0,
      receivedQuantity: 0,
    };

    const mockLines = [
      {
        lineId: '123e4567-e89b-12d3-a456-426614174004',
        transferId: mockTransfer.transferId,
        lineNumber: 1,
        productId: '123e4567-e89b-12d3-a456-426614174005',
        productType: 'HARDWARE_MODEL',
        quantity: 5,
        shippedQuantity: 0,
        receivedQuantity: 0,
        damagedQuantity: 0,
        status: 'PENDING' as const,
      },
    ];

    it('should create a transfer order successfully', async () => {
      mockStockroomRepository.getStockroomById
        .mockResolvedValueOnce(mockFromStockroom as any)
        .mockResolvedValueOnce(mockToStockroom as any);

      mockTransferRepository.createTransfer.mockResolvedValue({
        transfer: mockTransfer as any,
        lines: mockLines as any,
      });

      const request = {
        fromStockroomId: mockFromStockroom.stockroomId,
        toStockroomId: mockToStockroom.stockroomId,
        requestedBy: '123e4567-e89b-12d3-a456-426614174000',
        lines: [
          {
            productId: '123e4567-e89b-12d3-a456-426614174005',
            productType: 'HARDWARE_MODEL',
            quantity: 5,
          },
        ],
      };

      const result = await transferService.createTransfer(request);

      expect(result.transfer.transferId).toBe(mockTransfer.transferId);
      expect(result.transfer.status).toBe('PENDING_APPROVAL');
      expect(result.lines.length).toBe(1);
      expect(mockPublishEvent).toHaveBeenCalledWith('TRANSFER_ORDER_CREATED', expect.any(Object));
    });

    it('should throw error when source stockroom not found', async () => {
      mockStockroomRepository.getStockroomById.mockResolvedValueOnce(null);

      const request = {
        fromStockroomId: 'non-existent-id',
        toStockroomId: mockToStockroom.stockroomId,
        requestedBy: '123e4567-e89b-12d3-a456-426614174000',
        lines: [{ productId: 'test', quantity: 1 }],
      };

      await expect(transferService.createTransfer(request)).rejects.toThrow(
        'Source stockroom not found'
      );
    });

    it('should throw error when destination stockroom not found', async () => {
      mockStockroomRepository.getStockroomById
        .mockResolvedValueOnce(mockFromStockroom as any)
        .mockResolvedValueOnce(null);

      const request = {
        fromStockroomId: mockFromStockroom.stockroomId,
        toStockroomId: 'non-existent-id',
        requestedBy: '123e4567-e89b-12d3-a456-426614174000',
        lines: [{ productId: 'test', quantity: 1 }],
      };

      await expect(transferService.createTransfer(request)).rejects.toThrow(
        'Destination stockroom not found'
      );
    });

    it('should throw error when stockrooms are the same', async () => {
      mockStockroomRepository.getStockroomById
        .mockResolvedValueOnce(mockFromStockroom as any)
        .mockResolvedValueOnce(mockFromStockroom as any);

      const request = {
        fromStockroomId: mockFromStockroom.stockroomId,
        toStockroomId: mockFromStockroom.stockroomId,
        requestedBy: '123e4567-e89b-12d3-a456-426614174000',
        lines: [{ productId: 'test', quantity: 1 }],
      };

      await expect(transferService.createTransfer(request)).rejects.toThrow(
        'Source and destination stockrooms must be different'
      );
    });

    it('should throw error when no line items provided', async () => {
      mockStockroomRepository.getStockroomById
        .mockResolvedValueOnce(mockFromStockroom as any)
        .mockResolvedValueOnce(mockToStockroom as any);

      const request = {
        fromStockroomId: mockFromStockroom.stockroomId,
        toStockroomId: mockToStockroom.stockroomId,
        requestedBy: '123e4567-e89b-12d3-a456-426614174000',
        lines: [],
      };

      await expect(transferService.createTransfer(request)).rejects.toThrow(
        'Transfer order must have at least one line item'
      );
    });
  });

  describe('approveTransfer', () => {
    const mockTransfer = {
      transferId: '123e4567-e89b-12d3-a456-426614174003',
      transferNumber: 'TRF-ABC123-XYZ',
      fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
      toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING_APPROVAL' as const,
    };

    it('should approve a transfer order successfully', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.updateTransferStatus.mockResolvedValue({
        ...mockTransfer,
        status: 'APPROVED',
        approvedBy: '123e4567-e89b-12d3-a456-426614174000',
        approvedDate: '2024-01-15T10:00:00.000Z',
      } as any);

      const result = await transferService.approveTransfer(mockTransfer.transferId, {
        approvedBy: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.approved).toBe(true);
      expect(result.transfer.status).toBe('APPROVED');
      expect(mockPublishEvent).toHaveBeenCalledWith('TRANSFER_ORDER_APPROVED', expect.any(Object));
    });

    it('should throw error when transfer not found', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(null);

      await expect(
        transferService.approveTransfer('non-existent-id', {
          approvedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Transfer order not found');
    });

    it('should throw error when transfer is in invalid status', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
      } as any);

      await expect(
        transferService.approveTransfer(mockTransfer.transferId, {
          approvedBy: '123e4567-e89b-12d3-a456-426614174000',
        })
      ).rejects.toThrow('Cannot approve transfer in status: COMPLETED');
    });
  });

  describe('rejectTransfer', () => {
    const mockTransfer = {
      transferId: '123e4567-e89b-12d3-a456-426614174003',
      transferNumber: 'TRF-ABC123-XYZ',
      fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
      toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING_APPROVAL' as const,
    };

    it('should reject a transfer order successfully', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.updateTransferStatus.mockResolvedValue({
        ...mockTransfer,
        status: 'REJECTED',
        rejectionReason: 'Insufficient inventory',
      } as any);

      const result = await transferService.rejectTransfer(mockTransfer.transferId, {
        rejectedBy: '123e4567-e89b-12d3-a456-426614174000',
        rejectionReason: 'Insufficient inventory',
      });

      expect(result.approved).toBe(false);
      expect(result.transfer.status).toBe('REJECTED');
      expect(mockPublishEvent).toHaveBeenCalledWith('TRANSFER_ORDER_REJECTED', expect.any(Object));
    });

    it('should throw error when transfer not found', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(null);

      await expect(
        transferService.rejectTransfer('non-existent-id', {
          rejectedBy: '123e4567-e89b-12d3-a456-426614174000',
          rejectionReason: 'Test reason',
        })
      ).rejects.toThrow('Transfer order not found');
    });
  });

  describe('completeTransfer', () => {
    const mockTransfer = {
      transferId: '123e4567-e89b-12d3-a456-426614174003',
      transferNumber: 'TRF-ABC123-XYZ',
      fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
      toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'IN_TRANSIT' as const,
      totalQuantity: 5,
    };

    const mockLines = [
      {
        lineId: '123e4567-e89b-12d3-a456-426614174004',
        transferId: mockTransfer.transferId,
        lineNumber: 1,
        productId: '123e4567-e89b-12d3-a456-426614174005',
        productType: 'HARDWARE_MODEL',
        quantity: 5,
        shippedQuantity: 5,
        receivedQuantity: 0,
        damagedQuantity: 0,
        status: 'SHIPPED' as const,
      },
    ];

    it('should complete a transfer order successfully', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.getTransferLines.mockResolvedValue(mockLines as any);
      mockTransferRepository.updateTransferLine.mockResolvedValue({
        ...mockLines[0],
        receivedQuantity: 5,
        status: 'RECEIVED',
      } as any);
      mockTransferRepository.updateTransferStatus.mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
        receivedQuantity: 5,
        completedDate: '2024-01-15T10:00:00.000Z',
      } as any);

      // Mock inventory operations
      mockStockroomRepository.getInventoryByProduct.mockResolvedValue({
        inventoryId: 'inv-1',
        quantityOnHand: 10,
      } as any);
      mockStockroomRepository.adjustInventoryQuantity.mockResolvedValue({} as any);

      const firstLine = mockLines[0]!;
      const result = await transferService.completeTransfer(mockTransfer.transferId, {
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        lineReceipts: [
          {
            lineId: firstLine.lineId,
            receivedQuantity: 5,
          },
        ],
      });

      expect(result.transfer.status).toBe('COMPLETED');
      expect(result.inventoryUpdated).toBe(true);
      expect(mockPublishEvent).toHaveBeenCalledWith('TRANSFER_ORDER_COMPLETED', expect.any(Object));
    });

    it('should throw error when transfer not found', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(null);

      await expect(
        transferService.completeTransfer('non-existent-id', {
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          lineReceipts: [],
        })
      ).rejects.toThrow('Transfer order not found');
    });

    it('should throw error when transfer is in invalid status', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue({
        ...mockTransfer,
        status: 'PENDING_APPROVAL',
      } as any);

      await expect(
        transferService.completeTransfer(mockTransfer.transferId, {
          receivedBy: '123e4567-e89b-12d3-a456-426614174000',
          lineReceipts: [],
        })
      ).rejects.toThrow('Cannot complete transfer in status: PENDING_APPROVAL');
    });

    it('should handle partial receipt', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.getTransferLines.mockResolvedValue(mockLines as any);
      const firstLine = mockLines[0]!;
      mockTransferRepository.updateTransferLine.mockResolvedValue({
        ...firstLine,
        receivedQuantity: 3,
        status: 'PARTIALLY_RECEIVED',
      } as any);
      mockTransferRepository.updateTransferStatus.mockResolvedValue({
        ...mockTransfer,
        status: 'PARTIALLY_RECEIVED',
        receivedQuantity: 3,
      } as any);

      const result = await transferService.completeTransfer(mockTransfer.transferId, {
        receivedBy: '123e4567-e89b-12d3-a456-426614174000',
        lineReceipts: [
          {
            lineId: firstLine.lineId,
            receivedQuantity: 3, // Only 3 of 5 received
          },
        ],
      });

      expect(result.transfer.status).toBe('PARTIALLY_RECEIVED');
    });
  });

  describe('cancelTransfer', () => {
    const mockTransfer = {
      transferId: '123e4567-e89b-12d3-a456-426614174003',
      transferNumber: 'TRF-ABC123-XYZ',
      fromStockroomId: '123e4567-e89b-12d3-a456-426614174001',
      toStockroomId: '123e4567-e89b-12d3-a456-426614174002',
      status: 'PENDING_APPROVAL' as const,
    };

    it('should cancel a transfer order successfully', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.updateTransferStatus.mockResolvedValue({
        ...mockTransfer,
        status: 'CANCELLED',
        cancellationReason: 'No longer needed',
      } as any);
      mockTransferRepository.getTransferLines.mockResolvedValue([]);

      const result = await transferService.cancelTransfer(
        mockTransfer.transferId,
        '123e4567-e89b-12d3-a456-426614174000',
        'No longer needed'
      );

      expect(result.status).toBe('CANCELLED');
      expect(mockPublishEvent).toHaveBeenCalledWith('TRANSFER_ORDER_CANCELLED', expect.any(Object));
    });

    it('should throw error when transfer is already completed', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
      } as any);

      await expect(
        transferService.cancelTransfer(
          mockTransfer.transferId,
          '123e4567-e89b-12d3-a456-426614174000',
          'Test reason'
        )
      ).rejects.toThrow('Cannot cancel transfer in status: COMPLETED');
    });
  });

  describe('getTransfer', () => {
    it('should return transfer with lines', async () => {
      const mockTransfer = {
        transferId: '123e4567-e89b-12d3-a456-426614174003',
        transferNumber: 'TRF-ABC123-XYZ',
        status: 'PENDING_APPROVAL',
      };

      const mockLines = [
        { lineId: 'line-1', quantity: 5 },
      ];

      mockTransferRepository.getTransferById.mockResolvedValue(mockTransfer as any);
      mockTransferRepository.getTransferLines.mockResolvedValue(mockLines as any);

      const result = await transferService.getTransfer(mockTransfer.transferId);

      expect(result).not.toBeNull();
      expect(result?.transfer.transferId).toBe(mockTransfer.transferId);
      expect(result?.lines.length).toBe(1);
    });

    it('should return null when transfer not found', async () => {
      mockTransferRepository.getTransferById.mockResolvedValue(null);

      const result = await transferService.getTransfer('non-existent-id');

      expect(result).toBeNull();
    });
  });
});

