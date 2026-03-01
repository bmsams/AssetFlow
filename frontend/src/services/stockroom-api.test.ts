import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api-client', () => {
  class MockApiError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly requestId?: string;

    constructor(code: string, message: string, statusCode: number, requestId?: string) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.statusCode = statusCode;
      this.requestId = requestId;
    }
  }

  return {
    ApiError: MockApiError,
    apiClient: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { apiClient } from './api-client';
import { getStockroomInventory } from './stockroom-api';

describe('stockroom-api inventory response normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps canonical backend inventory fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            inventoryId: 'inv-1',
            stockroomId: 'sr-1',
            productId: 'prod-1',
            productType: 'HARDWARE_MODEL',
            productSku: 'SKU-1',
            productDescription: 'Router Chassis',
            quantityOnHand: 5,
            quantityAvailable: 3,
            reorderPoint: 2,
            reorderQuantity: 6,
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
        ],
        total: 1,
        stockroomId: 'sr-1',
      },
    });

    const result = await getStockroomInventory('sr-1');

    expect(apiClient.get).toHaveBeenCalledWith('/ham/stockrooms/sr-1/inventory');
    expect(result.total).toBe(1);
    expect(result.stockroomId).toBe('sr-1');
    expect(result.items[0]?.inventoryId).toBe('inv-1');
    expect(result.items[0]?.quantityOnHand).toBe(5);
    expect(result.items[0]?.quantityAvailable).toBe(3);
  });

  it('maps legacy inventory field aliases and derives availability fallback', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            itemId: 'legacy-1',
            productName: 'Legacy Item',
            quantity: 7,
            lastUpdated: '2026-03-01T01:00:00.000Z',
          },
        ],
      },
    });

    const result = await getStockroomInventory('sr-legacy', { page: 2, limit: 25 });

    expect(apiClient.get).toHaveBeenCalledWith('/ham/stockrooms/sr-legacy/inventory?page=2&limit=25');
    expect(result.stockroomId).toBe('sr-legacy');
    expect(result.total).toBe(1);
    expect(result.items[0]?.inventoryId).toBe('legacy-1');
    expect(result.items[0]?.productDescription).toBe('Legacy Item');
    expect(result.items[0]?.quantityOnHand).toBe(7);
    expect(result.items[0]?.quantityAvailable).toBe(7);
    expect(result.items[0]?.updatedAt).toBe('2026-03-01T01:00:00.000Z');
  });
});
