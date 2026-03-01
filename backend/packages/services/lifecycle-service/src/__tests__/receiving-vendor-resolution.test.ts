/**
 * Unit Tests: Receiving uses effective vendor from PO line/header
 *
 * Validates: Requirements 6.1, 6.2
 */

jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn(async (fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
}));

jest.mock('../procurement/vendor-resolution', () => ({
  resolveEffectiveVendor: jest.fn(),
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

import * as db from '@ams/database';

import { resolveEffectiveVendor } from '../procurement/vendor-resolution';
import { createReceivingLineFromPO } from '../receiving/receiving-repository';

const mockQueryMany = db.queryMany as jest.Mock;
const mockWithTransaction = db.withTransaction as jest.Mock;
const mockResolveEffectiveVendor = resolveEffectiveVendor as jest.Mock;

const SCHEMA_ROWS = [
  { table_name: 'receiving_records', column_name: 'receiving_id' },
  { table_name: 'receiving_records', column_name: 'receiving_number' },
  { table_name: 'receiving_records', column_name: 'po_id' },
  { table_name: 'receiving_records', column_name: 'received_by' },
  { table_name: 'receiving_records', column_name: 'received_date' },
  { table_name: 'receiving_records', column_name: 'stockroom_id' },
  { table_name: 'receiving_records', column_name: 'status' },
  { table_name: 'receiving_lines', column_name: 'line_id' },
  { table_name: 'receiving_lines', column_name: 'receiving_id' },
  { table_name: 'receiving_lines', column_name: 'po_line_id' },
  { table_name: 'receiving_lines', column_name: 'line_number' },
  { table_name: 'receiving_lines', column_name: 'product_description' },
  { table_name: 'receiving_lines', column_name: 'quantity_expected' },
  { table_name: 'receiving_lines', column_name: 'quantity_received' },
  { table_name: 'purchase_orders', column_name: 'po_id' },
  { table_name: 'purchase_orders', column_name: 'po_number' },
  { table_name: 'purchase_orders', column_name: 'vendor_id' },
  { table_name: 'purchase_order_lines', column_name: 'line_id' },
  { table_name: 'purchase_order_lines', column_name: 'po_id' },
  { table_name: 'purchase_order_lines', column_name: 'product_id' },
  { table_name: 'purchase_order_lines', column_name: 'product_type' },
  { table_name: 'purchase_order_lines', column_name: 'product_description' },
  { table_name: 'purchase_order_lines', column_name: 'quantity' },
  { table_name: 'purchase_order_lines', column_name: 'received_quantity' },
  { table_name: 'purchase_order_lines', column_name: 'vendor_id' },
  { table_name: 'purchase_order_lines', column_name: 'vendor_name' },
];

describe('Receiving repository vendor resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryMany.mockResolvedValue(SCHEMA_ROWS);
  });

  it('uses line-level vendor when present', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'po-line-1',
        po_id: 'po-1',
        product_id: 'product-1',
        product_type: 'HARDWARE_MODEL',
        product_name: 'Laptop',
        quantity: 10,
        received_quantity: 2,
        vendor_id: 'line-vendor-1',
        vendor_name: 'Line Vendor 1',
        header_vendor_id: 'header-vendor-1',
        header_vendor_name: 'Header Vendor 1',
      })
      .mockResolvedValueOnce({ count: '0' })
      .mockResolvedValueOnce({
        line_id: 'recv-line-1',
        receiving_id: 'recv-1',
        po_line_id: 'po-line-1',
        line_number: 1,
        product_id: 'product-1',
        product_type: 'HARDWARE_MODEL',
        product_name: 'Laptop',
        quantity_expected: 8,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    mockResolveEffectiveVendor.mockReturnValue({
      vendorId: 'line-vendor-1',
      vendorName: 'Line Vendor 1',
    });

    const line = await createReceivingLineFromPO('recv-1', 'po-line-1');

    expect(mockResolveEffectiveVendor).toHaveBeenCalledWith(
      'line-vendor-1',
      'Line Vendor 1',
      'header-vendor-1',
      'Header Vendor 1'
    );
    expect(line.effectiveVendorId).toBe('line-vendor-1');
    expect(line.effectiveVendorName).toBe('Line Vendor 1');
    expect(line.quantityExpected).toBe(8);
  });

  it('falls back to header vendor when line-level vendor is missing', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'po-line-2',
        po_id: 'po-2',
        product_id: 'product-2',
        product_type: 'HARDWARE_MODEL',
        product_name: 'Dock',
        quantity: 4,
        received_quantity: 1,
        vendor_id: null,
        vendor_name: null,
        header_vendor_id: 'header-vendor-2',
        header_vendor_name: 'Header Vendor 2',
      })
      .mockResolvedValueOnce({ count: '1' })
      .mockResolvedValueOnce({
        line_id: 'recv-line-2',
        receiving_id: 'recv-2',
        po_line_id: 'po-line-2',
        line_number: 2,
        product_id: 'product-2',
        product_type: 'HARDWARE_MODEL',
        product_name: 'Dock',
        quantity_expected: 3,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    mockResolveEffectiveVendor.mockReturnValue({
      vendorId: 'header-vendor-2',
      vendorName: 'Header Vendor 2',
    });

    const line = await createReceivingLineFromPO('recv-2', 'po-line-2');

    expect(mockResolveEffectiveVendor).toHaveBeenCalledWith(
      null,
      null,
      'header-vendor-2',
      'Header Vendor 2'
    );
    expect(line.effectiveVendorId).toBe('header-vendor-2');
    expect(line.effectiveVendorName).toBe('Header Vendor 2');
    expect(line.quantityExpected).toBe(3);
  });
});
