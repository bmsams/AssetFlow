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
import { approveTransfer, createTransfer, listTransfers } from './ham-api';

describe('ham-api transfer contract normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes status filter and maps list response fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            transferId: 'trf-1',
            transferNumber: 'TRF-001',
            fromStockroomId: 'sr-a',
            toStockroomId: 'sr-b',
            fromStockroom: 'Main Stockroom',
            toStockroom: 'DC Stockroom',
            status: 'pending',
            requestedAt: '2026-03-01T00:00:00.000Z',
            lines: [
              {
                lineId: 'line-1',
                lineNumber: 1,
                quantity: 1,
                shippedQuantity: 1,
                status: 'SHIPPED',
              },
            ],
          },
        ],
      },
    });

    const result = await listTransfers('pending');

    expect(apiClient.get).toHaveBeenCalledWith('/ham/transfers?status=PENDING_APPROVAL');
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('PENDING_APPROVAL');
    expect(result[0]?.fromStockroomName).toBe('Main Stockroom');
    expect(result[0]?.toStockroomName).toBe('DC Stockroom');
    expect(result[0]?.lines?.[0]?.lineId).toBe('line-1');
    expect(result[0]?.lines?.[0]?.quantity).toBe(1);
  });

  it('converts legacy create payload to transfer-order lines contract', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        transfer: {
          transferId: 'trf-2',
          transferNumber: 'TRF-002',
          fromStockroomId: 'sr-a',
          toStockroomId: 'sr-b',
          status: 'PENDING_APPROVAL',
        },
      },
    });

    await createTransfer({
      assetId: 'asset-1',
      fromStockroomId: 'sr-a',
      toStockroomId: 'sr-b',
      notes: 'Move one asset',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/ham/transfers',
      expect.objectContaining({
        fromStockroomId: 'sr-a',
        toStockroomId: 'sr-b',
        notes: 'Move one asset',
        lines: [
          {
            assetId: 'asset-1',
            quantity: 1,
            notes: 'Move one asset',
          },
        ],
      })
    );
  });

  it('accepts approve response in flat transfer shape and normalizes status', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        transferId: 'trf-3',
        fromStockroomId: 'sr-a',
        toStockroomId: 'sr-b',
        status: 'approved',
      },
    });

    const result = await approveTransfer('trf-3');

    expect(apiClient.post).toHaveBeenCalledWith('/ham/transfers/trf-3/approve');
    expect(result.transferId).toBe('trf-3');
    expect(result.status).toBe('APPROVED');
  });
});
