/**
 * Unit Tests: Receiving scan posts quantity into stockroom inventory
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

import { recordAssetScan } from '../receiving/receiving-repository';

const mockWithTransaction = db.withTransaction as jest.Mock;

describe('Receiving repository inventory posting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('posts to stockroom inventory on asset scan when stockroom and product are present', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'line-1',
        receiving_id: 'recv-1',
        po_line_id: null,
        line_number: 1,
        product_id: 'product-1',
        product_type: 'HARDWARE',
        product_name: 'Laptop',
        product_description: 'Laptop',
        quantity_expected: 2,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        po_id: null,
        stockroom_id: 'stockroom-1',
      })
      .mockResolvedValueOnce({
        asset_id: 'asset-1',
        asset_tag: 'AST-0001',
        serial_number: null,
        display_name: 'Laptop',
        status: 'IN_STOCK',
        created_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    await recordAssetScan({
      receivingLineId: 'line-1',
      serialNumber: 'SN-100',
    });

    const inventoryCall = ctxQueryOne.mock.calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('INSERT INTO stockroom_inventory')
    );

    expect(inventoryCall).toBeDefined();
    expect(inventoryCall?.[0]).toContain('ON CONFLICT (stockroom_id, product_id, product_type)');
    expect(inventoryCall?.[1]).toEqual([
      'stockroom-1',
      'product-1',
      'HARDWARE_MODEL',
      'Laptop',
      '2024-01-15T10:00:00.000Z',
    ]);
  });

  it('does not post to stockroom inventory when receiving line has no product_id', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'line-2',
        receiving_id: 'recv-2',
        po_line_id: null,
        line_number: 1,
        product_id: null,
        product_type: 'HARDWARE',
        product_name: 'Laptop',
        product_description: 'Laptop',
        quantity_expected: 2,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        po_id: null,
        stockroom_id: 'stockroom-1',
      })
      .mockResolvedValueOnce({
        asset_id: 'asset-2',
        asset_tag: 'AST-0002',
        serial_number: null,
        display_name: 'Laptop',
        status: 'IN_STOCK',
        created_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    await recordAssetScan({
      receivingLineId: 'line-2',
      serialNumber: 'SN-200',
    });

    const inventoryCall = ctxQueryOne.mock.calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('stockroom_inventory')
    );

    expect(inventoryCall).toBeUndefined();
  });

  it('updates PO line received quantity and marks PO partially received when lines remain', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'line-3',
        receiving_id: 'recv-3',
        po_line_id: 'po-line-3',
        line_number: 1,
        product_id: 'product-3',
        product_type: 'HARDWARE',
        product_name: 'Dock',
        product_description: 'Dock',
        quantity_expected: 2,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        po_id: 'po-3',
        stockroom_id: 'stockroom-3',
      })
      .mockResolvedValueOnce({
        asset_id: 'asset-3',
        asset_tag: 'AST-0003',
        serial_number: null,
        display_name: 'Dock',
        status: 'IN_STOCK',
        created_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ all_received: false })
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    await recordAssetScan({
      receivingLineId: 'line-3',
      serialNumber: 'SN-300',
    });

    const poLineUpdate = ctxQueryOne.mock.calls.find(([sql]) =>
      typeof sql === 'string' && sql.includes('UPDATE purchase_order_lines SET')
    );
    const poPartialUpdate = ctxQueryOne.mock.calls.find(([sql]) =>
      typeof sql === 'string' &&
      sql.includes('UPDATE purchase_orders SET') &&
      sql.includes("status = 'PARTIALLY_RECEIVED'")
    );

    expect(poLineUpdate).toBeDefined();
    expect(poPartialUpdate).toBeDefined();
  });

  it('marks PO received when all PO lines are fully received', async () => {
    const ctxQueryOne = jest
      .fn()
      .mockResolvedValueOnce({
        line_id: 'line-4',
        receiving_id: 'recv-4',
        po_line_id: 'po-line-4',
        line_number: 1,
        product_id: 'product-4',
        product_type: 'HARDWARE',
        product_name: 'Keyboard',
        product_description: 'Keyboard',
        quantity_expected: 1,
        quantity_received: 0,
        condition: 'NEW',
        asset_ids_created: [],
        serial_numbers_scanned: [],
        notes: null,
        created_at: '2024-01-15T10:00:00.000Z',
        updated_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        po_id: 'po-4',
        stockroom_id: 'stockroom-4',
      })
      .mockResolvedValueOnce({
        asset_id: 'asset-4',
        asset_tag: 'AST-0004',
        serial_number: null,
        display_name: 'Keyboard',
        status: 'IN_STOCK',
        created_at: '2024-01-15T10:00:00.000Z',
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ all_received: true })
      .mockResolvedValueOnce({});

    mockWithTransaction.mockImplementation(async (fn) =>
      fn({
        queryOne: ctxQueryOne,
        queryMany: jest.fn(),
      })
    );

    await recordAssetScan({
      receivingLineId: 'line-4',
      serialNumber: 'SN-400',
    });

    const poReceivedUpdate = ctxQueryOne.mock.calls.find(([sql]) =>
      typeof sql === 'string' &&
      sql.includes('UPDATE purchase_orders SET') &&
      sql.includes("status = 'RECEIVED'") &&
      sql.includes('actual_delivery_date = $1')
    );

    expect(poReceivedUpdate).toBeDefined();
  });
});
