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
import { createReceivingFromPO, scanAsset } from './receiving-api';

describe('receiving-api contract normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps backend receiving payload fields to frontend contract', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        receivingRecord: {
          receivingId: 'recv-1',
          poId: 'po-1',
          poNumber: 'PO-123',
          vendorName: 'Acme Supplies',
          status: 'IN_PROGRESS',
          receivedDate: '2026-02-28T00:00:00.000Z',
          stockroomId: 'sr-1',
          stockroomName: 'Main Stockroom',
          createdAt: '2026-02-28T00:00:00.000Z',
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
        lines: [
          {
            lineId: 'line-1',
            lineNumber: 7,
            receivingId: 'recv-1',
            poLineId: 'po-line-1',
            productName: 'Widget A',
            quantityExpected: '3',
            quantityReceived: 1,
          },
        ],
      },
    });

    const result = await createReceivingFromPO({ poId: 'po-1' });

    expect(result.receivingRecord.receivingId).toBe('recv-1');
    expect(result.receivingRecord.receivedAt).toBe('2026-02-28T00:00:00.000Z');
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.receivingLineId).toBe('line-1');
    expect((result.lines[0] as { lineNumber?: number }).lineNumber).toBe(7);
    expect(result.lines[0]?.productDescription).toBe('Widget A');
    expect(result.lines[0]?.expectedQuantity).toBe(3);
    expect(result.lines[0]?.receivedQuantity).toBe(1);
    expect(result.lines[0]?.pendingQuantity).toBe(2);
    expect(result.lines[0]?.inspectionRequired).toBe(false);
  });

  it('maps scan response line fields and derives pending quantities safely', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        asset: {
          assetId: 'asset-1',
          assetTag: 'AST-1',
          serialNumber: 'SN-1',
          status: 'IN_STOCK',
          receivingLineId: 'line-1',
          receivingId: 'recv-1',
          createdAt: '2026-02-28T00:00:00.000Z',
        },
        receivingLine: {
          lineId: 'line-1',
          receivingId: 'recv-1',
          productName: 'Widget A',
          quantityExpected: 3,
          quantityReceived: 2,
        },
        receivingRecord: {
          receivingId: 'recv-1',
          poId: 'po-1',
          poNumber: 'PO-123',
          status: 'IN_PROGRESS',
          createdAt: '2026-02-28T00:00:00.000Z',
          updatedAt: '2026-02-28T00:00:00.000Z',
        },
      },
    });

    const result = await scanAsset('recv-1', {
      receivingLineId: 'line-1',
      serialNumber: 'SN-1',
    });

    expect(result.asset.assetId).toBe('asset-1');
    expect(result.receivingLine.receivingLineId).toBe('line-1');
    expect(result.receivingLine.pendingQuantity).toBe(1);
    expect(result.isLineComplete).toBe(false);
  });
});
