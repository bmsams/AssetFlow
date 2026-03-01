/**
 * Procurement Service Unit Tests
 *
 * Tests for Procurement Service:
 * - Stock availability checking (Requirement 6.2)
 * - Inventory reservation (Requirement 6.2)
 * - Purchase order generation (Requirement 6.2, 6.3)
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

// Mock the repository
jest.mock('../procurement/procurement-repository');

import * as procurementService from '../procurement/procurement-service';
import * as procurementRepository from '../procurement/procurement-repository';
import { publishEvent } from '@ams/events';

const mockProcurementRepository = procurementRepository as jest.Mocked<typeof procurementRepository>;
const mockPublishEvent = publishEvent as jest.Mock;

describe('Procurement Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkStock', () => {
    const mockStockAvailability = [
      {
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        productName: 'MacBook Pro 16"',
        stockroomId: '123e4567-e89b-12d3-a456-426614174010',
        stockroomName: 'Main Stockroom',
        quantityOnHand: 10,
        quantityReserved: 2,
        quantityAvailable: 8,
        unitCost: 1500,
      },
      {
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        productName: 'MacBook Pro 16"',
        stockroomId: '123e4567-e89b-12d3-a456-426614174011',
        stockroomName: 'Satellite Stockroom',
        quantityOnHand: 5,
        quantityReserved: 1,
        quantityAvailable: 4,
        unitCost: 1500,
      },
    ];

    it('should return available when sufficient stock exists', async () => {
      mockProcurementRepository.checkStockAvailability.mockResolvedValue(mockStockAvailability);

      const result = await procurementService.checkStock(
        '123e4567-e89b-12d3-a456-426614174001',
        'HARDWARE_MODEL',
        5
      );

      expect(result.isAvailable).toBe(true);
      expect(result.quantityAvailable).toBe(12); // 8 + 4
      expect(result.shortfall).toBe(0);
      expect(result.stockrooms.length).toBe(2);
    });

    it('should return not available when insufficient stock', async () => {
      mockProcurementRepository.checkStockAvailability.mockResolvedValue(mockStockAvailability);

      const result = await procurementService.checkStock(
        '123e4567-e89b-12d3-a456-426614174001',
        'HARDWARE_MODEL',
        15
      );

      expect(result.isAvailable).toBe(false);
      expect(result.quantityAvailable).toBe(12);
      expect(result.shortfall).toBe(3);
    });

    it('should return not available when no stock exists', async () => {
      mockProcurementRepository.checkStockAvailability.mockResolvedValue([]);

      const result = await procurementService.checkStock(
        '123e4567-e89b-12d3-a456-426614174001',
        'HARDWARE_MODEL',
        5
      );

      expect(result.isAvailable).toBe(false);
      expect(result.quantityAvailable).toBe(0);
      expect(result.shortfall).toBe(5);
      expect(result.stockrooms.length).toBe(0);
    });

    it('should filter by stockroom when specified', async () => {
      const singleStockroom = [mockStockAvailability[0]!];
      mockProcurementRepository.checkStockAvailability.mockResolvedValue(singleStockroom);

      const result = await procurementService.checkStock(
        '123e4567-e89b-12d3-a456-426614174001',
        'HARDWARE_MODEL',
        5,
        '123e4567-e89b-12d3-a456-426614174010'
      );

      expect(mockProcurementRepository.checkStockAvailability).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174001',
        'HARDWARE_MODEL',
        '123e4567-e89b-12d3-a456-426614174010'
      );
      expect(result.quantityAvailable).toBe(8);
    });
  });

  describe('checkBulkStock', () => {
    it('should check multiple items and return aggregate results', async () => {
      mockProcurementRepository.checkStockAvailability
        .mockResolvedValueOnce([
          {
            productId: 'product-1',
            productType: 'HARDWARE_MODEL',
            productName: 'Laptop',
            stockroomId: 'stockroom-1',
            stockroomName: 'Main',
            quantityOnHand: 10,
            quantityReserved: 0,
            quantityAvailable: 10,
            unitCost: 1000,
          },
        ])
        .mockResolvedValueOnce([
          {
            productId: 'product-2',
            productType: 'HARDWARE_MODEL',
            productName: 'Monitor',
            stockroomId: 'stockroom-1',
            stockroomName: 'Main',
            quantityOnHand: 2,
            quantityReserved: 0,
            quantityAvailable: 2,
            unitCost: 500,
          },
        ]);

      const result = await procurementService.checkBulkStock([
        { productId: 'product-1', productType: 'HARDWARE_MODEL', quantityNeeded: 5 },
        { productId: 'product-2', productType: 'HARDWARE_MODEL', quantityNeeded: 5 },
      ]);

      expect(result.items.length).toBe(2);
      expect(result.allAvailable).toBe(false);
      expect(result.itemsWithShortfall).toBe(1);
      expect(result.totalShortfall).toBe(3);
    });

    it('should return allAvailable=true when all items have sufficient stock', async () => {
      mockProcurementRepository.checkStockAvailability.mockResolvedValue([
        {
          productId: 'product-1',
          productType: 'HARDWARE_MODEL',
          productName: 'Laptop',
          stockroomId: 'stockroom-1',
          stockroomName: 'Main',
          quantityOnHand: 10,
          quantityReserved: 0,
          quantityAvailable: 10,
          unitCost: 1000,
        },
      ]);

      const result = await procurementService.checkBulkStock([
        { productId: 'product-1', productType: 'HARDWARE_MODEL', quantityNeeded: 5 },
      ]);

      expect(result.allAvailable).toBe(true);
      expect(result.itemsWithShortfall).toBe(0);
      expect(result.totalShortfall).toBe(0);
    });
  });

  describe('createPurchaseOrder', () => {
    const mockPurchaseOrder = {
      poId: '123e4567-e89b-12d3-a456-426614174020',
      poNumber: 'PO-ABC123-XYZ',
      vendorId: '123e4567-e89b-12d3-a456-426614174030',
      vendorName: 'Tech Supplier Inc',
      requesterId: '123e4567-e89b-12d3-a456-426614174000',
      requesterName: 'John Doe',
      approverId: null,
      approverName: null,
      status: 'DRAFT' as const,
      orderDate: null,
      expectedDeliveryDate: '2024-02-01',
      actualDeliveryDate: null,
      shippingAddress: '123 Main St',
      shippingMethod: 'Standard',
      paymentTerms: 'Net 30',
      currency: 'USD',
      subtotal: 3000,
      taxAmount: 0,
      shippingCost: 0,
      totalAmount: 3000,
      notes: null,
      internalNotes: null,
      sourceRequestId: null,
      erpReferenceId: null,
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
      createdBy: '123e4567-e89b-12d3-a456-426614174000',
      updatedBy: null,
    };

    const mockLines = [
      {
        lineId: '123e4567-e89b-12d3-a456-426614174021',
        poId: mockPurchaseOrder.poId,
        lineNumber: 1,
        productId: '123e4567-e89b-12d3-a456-426614174001',
        productType: 'HARDWARE_MODEL',
        productName: 'MacBook Pro 16"',
        productDescription: 'Apple laptop',
        productSku: 'MBP16-2024',
        quantity: 2,
        receivedQuantity: 0,
        unitPrice: 1500,
        totalPrice: 3000,
        status: 'PENDING' as const,
        costCenterId: null,
        costCenterCode: null,
        vendorId: null,
        vendorName: null,
        effectiveVendorId: mockPurchaseOrder.vendorId,
        effectiveVendorName: mockPurchaseOrder.vendorName,
        effectiveCostCenterId: null,
        effectiveCostCenterCode: null,
        requestLineId: null,
        notes: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
      },
    ];

    it('should create a purchase order successfully', async () => {
      mockProcurementRepository.createPurchaseOrder.mockResolvedValue({
        purchaseOrder: mockPurchaseOrder,
        lines: mockLines,
      });

      const input = {
        vendorId: mockPurchaseOrder.vendorId!,
        vendorName: mockPurchaseOrder.vendorName!,
        requesterId: mockPurchaseOrder.requesterId,
        expectedDeliveryDate: mockPurchaseOrder.expectedDeliveryDate!,
        shippingAddress: mockPurchaseOrder.shippingAddress!,
        lines: [
          {
            productId: mockLines[0]!.productId!,
            productType: mockLines[0]!.productType!,
            productName: mockLines[0]!.productName!,
            quantity: mockLines[0]!.quantity,
            unitPrice: mockLines[0]!.unitPrice,
          },
        ],
      };

      const result = await procurementService.createPurchaseOrder(
        input,
        mockPurchaseOrder.requesterId
      );

      expect(result.purchaseOrder.poId).toBe(mockPurchaseOrder.poId);
      expect(result.purchaseOrder.poNumber).toBe(mockPurchaseOrder.poNumber);
      expect(result.purchaseOrder.status).toBe('DRAFT');
      expect(result.lines.length).toBe(1);
      expect(mockPublishEvent).toHaveBeenCalledWith('PURCHASE_ORDER_CREATED', expect.any(Object));
    });

    it('should throw error when lines is empty', async () => {
      const input = {
        requesterId: mockPurchaseOrder.requesterId,
        lines: [],
      };

      await expect(
        procurementService.createPurchaseOrder(input, mockPurchaseOrder.requesterId)
      ).rejects.toThrow('Purchase order must have at least one line');
    });

    it('should throw error when line has missing productName', async () => {
      const input = {
        requesterId: mockPurchaseOrder.requesterId,
        lines: [
          {
            productName: '',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      };

      await expect(
        procurementService.createPurchaseOrder(input, mockPurchaseOrder.requesterId)
      ).rejects.toThrow('Line 1: Product name is required');
    });

    it('should throw error when line has invalid quantity', async () => {
      const input = {
        requesterId: mockPurchaseOrder.requesterId,
        lines: [
          {
            productName: 'Test Product',
            quantity: 0,
            unitPrice: 100,
          },
        ],
      };

      await expect(
        procurementService.createPurchaseOrder(input, mockPurchaseOrder.requesterId)
      ).rejects.toThrow('Line 1: Quantity must be greater than 0');
    });

    it('should throw error when line has negative unitPrice', async () => {
      const input = {
        requesterId: mockPurchaseOrder.requesterId,
        lines: [
          {
            productName: 'Test Product',
            quantity: 1,
            unitPrice: -100,
          },
        ],
      };

      await expect(
        procurementService.createPurchaseOrder(input, mockPurchaseOrder.requesterId)
      ).rejects.toThrow('Line 1: Unit price cannot be negative');
    });
  });

  describe('getPurchaseOrder', () => {
    it('should return purchase order with lines', async () => {
      const mockPO = {
        poId: 'po-1',
        poNumber: 'PO-001',
        status: 'DRAFT',
      };
      const mockLines = [{ lineId: 'line-1', quantity: 1 }];

      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(mockPO as any);
      mockProcurementRepository.getPurchaseOrderLines.mockResolvedValue(mockLines as any);

      const result = await procurementService.getPurchaseOrder('po-1');

      expect(result).not.toBeNull();
      expect(result?.purchaseOrder.poId).toBe('po-1');
      expect(result?.lines.length).toBe(1);
    });

    it('should return null when purchase order not found', async () => {
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(null);

      const result = await procurementService.getPurchaseOrder('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('submitPurchaseOrder', () => {
    it('should submit purchase order for approval', async () => {
      const mockPO = {
        poId: 'po-1',
        poNumber: 'PO-001',
        status: 'DRAFT' as const,
        totalAmount: 1000,
      };

      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(mockPO as any);
      mockProcurementRepository.getPurchaseOrderLines.mockResolvedValue([
        { lineId: 'line-1', lineNumber: 1, effectiveVendorId: 'vendor-1', effectiveVendorName: 'Acme Corp' },
      ] as any);
      mockProcurementRepository.updatePurchaseOrderStatus.mockResolvedValue({
        ...mockPO,
        status: 'PENDING_APPROVAL',
      } as any);

      const result = await procurementService.submitPurchaseOrder('po-1', 'user-1');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(mockPublishEvent).toHaveBeenCalledWith('PURCHASE_ORDER_SUBMITTED', expect.any(Object));
    });

    it('should throw error when purchase order not found', async () => {
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(null);

      await expect(procurementService.submitPurchaseOrder('non-existent', 'user-1')).rejects.toThrow(
        'Purchase order not found'
      );
    });

    it('should throw error when purchase order is not in DRAFT status', async () => {
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue({
        poId: 'po-1',
        status: 'APPROVED',
      } as any);

      await expect(procurementService.submitPurchaseOrder('po-1', 'user-1')).rejects.toThrow(
        'Cannot submit purchase order in status: APPROVED'
      );
    });
  });

  describe('approvePurchaseOrder', () => {
    it('should approve purchase order', async () => {
      const mockPO = {
        poId: 'po-1',
        poNumber: 'PO-001',
        status: 'PENDING_APPROVAL' as const,
        totalAmount: 1000,
      };

      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(mockPO as any);
      mockProcurementRepository.updatePurchaseOrderStatus.mockResolvedValue({
        ...mockPO,
        status: 'APPROVED',
        approverId: 'approver-1',
        approverName: 'Jane Manager',
        orderDate: '2024-01-15T10:00:00.000Z',
      } as any);

      const result = await procurementService.approvePurchaseOrder(
        'po-1',
        'approver-1',
        'Jane Manager'
      );

      expect(result.status).toBe('APPROVED');
      expect(mockPublishEvent).toHaveBeenCalledWith('PURCHASE_ORDER_APPROVED', expect.any(Object));
    });

    it('should throw error when purchase order not found', async () => {
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(null);

      await expect(
        procurementService.approvePurchaseOrder('non-existent', 'approver-1')
      ).rejects.toThrow('Purchase order not found');
    });

    it('should throw error when purchase order is not in PENDING_APPROVAL status', async () => {
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue({
        poId: 'po-1',
        status: 'DRAFT',
      } as any);

      await expect(procurementService.approvePurchaseOrder('po-1', 'approver-1')).rejects.toThrow(
        'Cannot approve purchase order in status: DRAFT'
      );
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation successfully', async () => {
      const mockReservation = {
        reservationId: 'res-1',
        inventoryId: 'inv-1',
        productId: 'product-1',
        productType: 'HARDWARE_MODEL',
        quantityReserved: 5,
        status: 'RELEASED' as const,
      };

      mockProcurementRepository.releaseReservation.mockResolvedValue(mockReservation as any);

      const result = await procurementService.releaseReservation('res-1');

      expect(result.status).toBe('RELEASED');
      expect(mockPublishEvent).toHaveBeenCalledWith('RESERVATION_RELEASED', expect.any(Object));
    });

    it('should throw error when reservation not found', async () => {
      mockProcurementRepository.releaseReservation.mockResolvedValue(null);

      await expect(procurementService.releaseReservation('non-existent')).rejects.toThrow(
        'Reservation not found'
      );
    });
  });

  describe('fulfillReservation', () => {
    it('should fulfill reservation successfully', async () => {
      const mockReservation = {
        reservationId: 'res-1',
        inventoryId: 'inv-1',
        productId: 'product-1',
        productType: 'HARDWARE_MODEL',
        quantityReserved: 5,
        status: 'FULFILLED' as const,
      };

      mockProcurementRepository.fulfillReservation.mockResolvedValue(mockReservation as any);

      const result = await procurementService.fulfillReservation('res-1');

      expect(result.status).toBe('FULFILLED');
      expect(mockPublishEvent).toHaveBeenCalledWith('RESERVATION_FULFILLED', expect.any(Object));
    });

    it('should throw error when reservation not found', async () => {
      mockProcurementRepository.fulfillReservation.mockResolvedValue(null);

      await expect(procurementService.fulfillReservation('non-existent')).rejects.toThrow(
        'Reservation not found'
      );
    });
  });

  describe('end-to-end PO creation with mixed line vendors', () => {
    it('resolves mixed effective vendors, preserves total consistency, and allows submit', async () => {
      const requesterId = '123e4567-e89b-12d3-a456-426614174000';
      const headerVendorId = '123e4567-e89b-12d3-a456-426614174030';
      const headerVendorName = 'Header Vendor';
      const lineVendorAId = '123e4567-e89b-12d3-a456-426614174031';
      const lineVendorAName = 'Line Vendor A';
      const lineVendorBId = '123e4567-e89b-12d3-a456-426614174032';
      const lineVendorBName = 'Line Vendor B';

      const lines = [
        {
          lineId: 'line-1',
          poId: 'po-mixed-1',
          lineNumber: 1,
          productId: 'product-1',
          productType: 'HARDWARE_MODEL',
          productName: 'Laptop',
          productDescription: 'Laptop',
          productSku: null,
          quantity: 2,
          receivedQuantity: 0,
          unitPrice: 100,
          totalPrice: 200,
          status: 'PENDING' as const,
          costCenterId: null,
          costCenterCode: null,
          vendorId: lineVendorAId,
          vendorName: lineVendorAName,
          effectiveVendorId: lineVendorAId,
          effectiveVendorName: lineVendorAName,
          effectiveCostCenterId: null,
          effectiveCostCenterCode: null,
          requestLineId: null,
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        {
          lineId: 'line-2',
          poId: 'po-mixed-1',
          lineNumber: 2,
          productId: 'product-2',
          productType: 'HARDWARE_MODEL',
          productName: 'Dock',
          productDescription: 'Dock',
          productSku: null,
          quantity: 1,
          receivedQuantity: 0,
          unitPrice: 50,
          totalPrice: 50,
          status: 'PENDING' as const,
          costCenterId: null,
          costCenterCode: null,
          vendorId: null,
          vendorName: null,
          effectiveVendorId: headerVendorId,
          effectiveVendorName: headerVendorName,
          effectiveCostCenterId: null,
          effectiveCostCenterCode: null,
          requestLineId: null,
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
        {
          lineId: 'line-3',
          poId: 'po-mixed-1',
          lineNumber: 3,
          productId: 'product-3',
          productType: 'HARDWARE_MODEL',
          productName: 'Monitor',
          productDescription: 'Monitor',
          productSku: null,
          quantity: 3,
          receivedQuantity: 0,
          unitPrice: 75,
          totalPrice: 225,
          status: 'PENDING' as const,
          costCenterId: null,
          costCenterCode: null,
          vendorId: lineVendorBId,
          vendorName: lineVendorBName,
          effectiveVendorId: lineVendorBId,
          effectiveVendorName: lineVendorBName,
          effectiveCostCenterId: null,
          effectiveCostCenterCode: null,
          requestLineId: null,
          notes: null,
          createdAt: '2024-01-15T10:00:00.000Z',
          updatedAt: '2024-01-15T10:00:00.000Z',
        },
      ];

      const subtotal = lines.reduce((sum, line) => sum + line.totalPrice, 0);
      const createdPO = {
        poId: 'po-mixed-1',
        poNumber: 'PO-MIXED-001',
        vendorId: headerVendorId,
        vendorName: headerVendorName,
        requesterId,
        requesterName: 'Requester',
        approverId: null,
        approverName: null,
        status: 'DRAFT' as const,
        orderDate: null,
        expectedDeliveryDate: null,
        actualDeliveryDate: null,
        shippingAddress: null,
        shippingMethod: null,
        paymentTerms: null,
        currency: 'USD',
        subtotal,
        taxAmount: 0,
        shippingCost: 0,
        totalAmount: subtotal,
        notes: null,
        internalNotes: null,
        sourceRequestId: null,
        erpReferenceId: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        createdBy: requesterId,
        updatedBy: null,
      };

      mockProcurementRepository.createPurchaseOrder.mockResolvedValue({
        purchaseOrder: createdPO,
        lines,
      } as any);
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue(createdPO as any);
      mockProcurementRepository.getPurchaseOrderLines.mockResolvedValue(lines as any);
      mockProcurementRepository.updatePurchaseOrderStatus.mockResolvedValue({
        ...createdPO,
        status: 'PENDING_APPROVAL',
      } as any);

      const createResult = await procurementService.createPurchaseOrder(
        {
          vendorId: headerVendorId,
          vendorName: headerVendorName,
          requesterId,
          lines: [
            { productName: 'Laptop', quantity: 2, unitPrice: 100, vendorId: lineVendorAId, vendorName: lineVendorAName },
            { productName: 'Dock', quantity: 1, unitPrice: 50 },
            { productName: 'Monitor', quantity: 3, unitPrice: 75, vendorId: lineVendorBId, vendorName: lineVendorBName },
          ],
        },
        requesterId
      );

      expect(createResult.lines.map((line) => line.effectiveVendorId)).toEqual([
        lineVendorAId,
        headerVendorId,
        lineVendorBId,
      ]);
      expect(
        createResult.lines.every((line) => line.totalPrice === line.quantity * line.unitPrice)
      ).toBe(true);
      expect(createResult.purchaseOrder.subtotal).toBe(
        createResult.lines.reduce((sum, line) => sum + line.totalPrice, 0)
      );

      const submitted = await procurementService.submitPurchaseOrder(createdPO.poId, requesterId);
      expect(submitted.status).toBe('PENDING_APPROVAL');
    });

    it('blocks submit when one line has no effective vendor', async () => {
      const poId = 'po-mixed-2';
      mockProcurementRepository.getPurchaseOrderById.mockResolvedValue({
        poId,
        poNumber: 'PO-MIXED-002',
        status: 'DRAFT',
      } as any);
      mockProcurementRepository.getPurchaseOrderLines.mockResolvedValue([
        { lineId: 'line-1', lineNumber: 1, effectiveVendorId: 'vendor-1', effectiveVendorName: 'Vendor 1' },
        { lineId: 'line-2', lineNumber: 2, effectiveVendorId: null, effectiveVendorName: null },
      ] as any);

      await expect(procurementService.submitPurchaseOrder(poId, 'user-1')).rejects.toThrow(
        'Cannot submit: line 2 has no vendor assigned'
      );
      expect(mockProcurementRepository.updatePurchaseOrderStatus).not.toHaveBeenCalled();
    });
  });
});
