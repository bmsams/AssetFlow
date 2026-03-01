/**
 * Unit Tests: Receiving reconciliation snapshot
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

import { getReceivingReconciliation } from '../receiving/receiving-repository';

const mockQueryMany = db.queryMany as jest.Mock;

describe('Receiving repository reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns per-product reconciliation with sync flags', async () => {
    mockQueryMany.mockResolvedValueOnce([
      {
        product_id: 'product-1',
        product_type: 'HARDWARE_MODEL',
        receiving_expected_quantity: 5,
        receiving_received_quantity: 4,
        po_received_quantity: 4,
        stockroom_on_hand_quantity: 10,
        stockroom_reserved_quantity: 1,
      },
      {
        product_id: 'product-2',
        product_type: 'SOFTWARE_PRODUCT',
        receiving_expected_quantity: 3,
        receiving_received_quantity: 2,
        po_received_quantity: 1,
        stockroom_on_hand_quantity: 1,
        stockroom_reserved_quantity: 0,
      },
    ]);

    const result = await getReceivingReconciliation('recv-1');

    expect(mockQueryMany).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQueryMany.mock.calls[0] as [string, string[]];
    expect(sql).toContain('WITH line_items AS');
    expect(sql).toContain('normalized_lines');
    expect(sql).toContain('stockroom_inventory');
    expect(params).toEqual(['recv-1']);

    expect(result).toEqual([
      {
        productId: 'product-1',
        productType: 'HARDWARE_MODEL',
        receivingExpectedQuantity: 5,
        receivingReceivedQuantity: 4,
        poReceivedQuantity: 4,
        stockroomOnHandQuantity: 10,
        stockroomReservedQuantity: 1,
        poInSync: true,
        stockroomCoversReceived: true,
      },
      {
        productId: 'product-2',
        productType: 'SOFTWARE_PRODUCT',
        receivingExpectedQuantity: 3,
        receivingReceivedQuantity: 2,
        poReceivedQuantity: 1,
        stockroomOnHandQuantity: 1,
        stockroomReservedQuantity: 0,
        poInSync: false,
        stockroomCoversReceived: false,
      },
    ]);
  });
});
