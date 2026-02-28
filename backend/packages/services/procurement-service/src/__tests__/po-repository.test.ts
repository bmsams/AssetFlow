/**
 * Purchase Order Repository Unit Tests
 *
 * Tests for the PO Repository data access layer.
 * Requirements:
 * - Requirement 16.1: Create PO with vendor, cost center, and line items
 * - Requirement 16.2: Create PO line records with product details
 * - Requirement 16.3: Update line item quantities or prices
 * - Requirement 16.4: Delete line and recalculate PO total
 * - Requirement 16.9: Return complete PO details including all line items
 * - Requirement 16.10: Return paginated list matching filter criteria
 * - Requirement 16.11: Return matching orders using partial text matching
 */

// Mock the dependencies before importing repository
jest.mock('@ams/database');
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
}));

import { queryMany, queryOne } from '@ams/database';
import * as repository from '../purchase-order/po-repository';

const mockQueryMany = jest.mocked(queryMany);
const mockQueryOne = jest.mocked(queryOne);

// ============================================================================
// Test Data
// ============================================================================

const mockPORow = {
  poId: '111e4567-e89b-12d3-a456-426614174000',
  poNumber: 'PO-20240115-0001',
  vendorId: '222e4567-e89b-12d3-a456-426614174000',
  vendorName: 'Acme Corporation',
  costCenterId: '333e4567-e89b-12d3-a456-426614174000',
  costCenterCode: 'CC-001',
  status: 'DRAFT',
  requestedBy: '444e4567-e89b-12d3-a456-426614174000',
  requestedByName: 'John Doe',
  requestedDate: '2024-01-15',
  approvedBy: null,
  approvedByName: null,
  approvedDate: null,
  rejectedBy: null,
  rejectedByName: null,
  rejectedDate: null,
  rejectionReason: null,
  sentDate: null,
  expectedDeliveryDate: '2024-02-15',
  subtotal: 1000.00,
  taxAmount: 80.00,
  shippingAmount: 20.00,
  totalAmount: 1100.00,
  notes: 'Test PO',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

const mockPOLineRow = {
  lineId: '555e4567-e89b-12d3-a456-426614174000',
  poId: '111e4567-e89b-12d3-a456-426614174000',
  lineNumber: 1,
  productType: 'HARDWARE_MODEL',
  productId: '666e4567-e89b-12d3-a456-426614174000',
  productDescription: 'Dell Laptop XPS 15',
  sku: 'DELL-XPS-15',
  quantity: 10,
  unitPrice: 100.00,
  lineTotal: 1000.00,
  quantityReceived: 0,
  notes: 'Line item notes',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
};

describe('PO Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // calculateLineTotal Tests
  // ============================================================================

  describe('calculateLineTotal', () => {
    it('should calculate line total correctly', () => {
      expect(repository.calculateLineTotal(10, 100)).toBe(1000);
      expect(repository.calculateLineTotal(5, 25.50)).toBe(127.5);
      expect(repository.calculateLineTotal(3, 33.33)).toBe(99.99);
    });

    it('should round to 2 decimal places', () => {
      expect(repository.calculateLineTotal(3, 10.333)).toBe(31);
    });
  });

  // ============================================================================
  // calculatePOTotals Tests
  // ============================================================================

  describe('calculatePOTotals', () => {
    it('should calculate subtotal from lines', () => {
      const lines = [
        { quantity: 10, unitPrice: 100 },
        { quantity: 5, unitPrice: 50 },
      ];
      const result = repository.calculatePOTotals(lines);
      expect(result.subtotal).toBe(1250);
      expect(result.totalAmount).toBe(1250);
    });

    it('should include tax and shipping in total', () => {
      const lines = [{ quantity: 10, unitPrice: 100 }];
      const result = repository.calculatePOTotals(lines, 80, 20);
      expect(result.subtotal).toBe(1000);
      expect(result.totalAmount).toBe(1100);
    });

    it('should handle empty lines', () => {
      const result = repository.calculatePOTotals([]);
      expect(result.subtotal).toBe(0);
      expect(result.totalAmount).toBe(0);
    });
  });

  // ============================================================================
  // getPurchaseOrderById Tests (Requirement 16.9)
  // ============================================================================

  describe('getPurchaseOrderById', () => {
    it('should return PO details (Requirement 16.9)', async () => {
      mockQueryOne.mockResolvedValue(mockPORow);

      const result = await repository.getPurchaseOrderById(mockPORow.poId);

      expect(result).not.toBeNull();
      expect(result?.poId).toBe(mockPORow.poId);
      expect(result?.poNumber).toBe(mockPORow.poNumber);
      // vendorName is part of the returned data
      expect((result as any)?.vendorName).toBe(mockPORow.vendorName);
    });

    it('should return null for non-existent PO', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await repository.getPurchaseOrderById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getPurchaseOrderWithLines Tests
  // ============================================================================

  describe('getPurchaseOrderWithLines', () => {
    it('should return PO with lines', async () => {
      mockQueryOne.mockResolvedValue(mockPORow);
      mockQueryMany.mockResolvedValue([mockPOLineRow]);

      const result = await repository.getPurchaseOrderWithLines(mockPORow.poId);

      expect(result).not.toBeNull();
      expect(result?.poId).toBe(mockPORow.poId);
      expect(result?.lines).toHaveLength(1);
      expect(result?.lines?.[0]?.productDescription).toBe('Dell Laptop XPS 15');
    });

    it('should return null for non-existent PO', async () => {
      mockQueryOne.mockResolvedValue(null);

      const result = await repository.getPurchaseOrderWithLines('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getPOLines Tests
  // ============================================================================

  describe('getPOLines', () => {
    it('should return lines for a PO', async () => {
      mockQueryMany.mockResolvedValue([mockPOLineRow]);

      const result = await repository.getPOLines(mockPORow.poId);

      expect(result).toHaveLength(1);
      expect(result[0]?.lineId).toBe(mockPOLineRow.lineId);
      expect(result[0]?.productDescription).toBe('Dell Laptop XPS 15');
    });

    it('should return empty array for PO with no lines', async () => {
      mockQueryMany.mockResolvedValue([]);

      const result = await repository.getPOLines(mockPORow.poId);

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // listPurchaseOrders Tests (Requirement 16.10)
  // ============================================================================

  describe('listPurchaseOrders', () => {
    it('should return paginated list (Requirement 16.10)', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockPORow]);

      const result = await repository.listPurchaseOrders({}, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by status', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockPORow]);

      await repository.listPurchaseOrders({ status: 'DRAFT' });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('po.status = $1'),
        expect.arrayContaining(['DRAFT'])
      );
    });

    it('should filter by vendor', async () => {
      mockQueryOne.mockResolvedValue({ count: '1' });
      mockQueryMany.mockResolvedValue([mockPORow]);

      await repository.listPurchaseOrders({ vendorId: mockPORow.vendorId });

      expect(mockQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('po.vendor_id = $1'),
        expect.arrayContaining([mockPORow.vendorId])
      );
    });
  });

  describe('rejectPurchaseOrder', () => {
    it('falls back to CANCELLED when valid_po_status does not include REJECTED', async () => {
      const rejectionReason = 'Budget denied';
      const rejectedBy = '444e4567-e89b-12d3-a456-426614174000';

      mockQueryOne
        .mockResolvedValueOnce({ userId: rejectedBy })
        .mockResolvedValueOnce({
          definition:
            "CHECK ((status IS NULL OR (status = ANY (ARRAY['DRAFT'::character varying, 'PENDING_APPROVAL'::character varying, 'CANCELLED'::character varying]))))",
        })
        .mockResolvedValueOnce({ poId: mockPORow.poId })
        .mockResolvedValueOnce({
          ...mockPORow,
          status: 'CANCELLED',
          rejectedBy,
          rejectionReason,
        });

      const result = await repository.rejectPurchaseOrder(mockPORow.poId, rejectedBy, rejectionReason);

      expect(mockQueryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('SET status = $2'),
        [mockPORow.poId, 'CANCELLED', rejectedBy, rejectionReason]
      );
      expect(result?.status).toBe('CANCELLED');
    });
  });
});
