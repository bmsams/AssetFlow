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
import { createWorkOrder, listWorkOrders } from './eam-api';

describe('eam-api enum normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps UI status and priority filters to API enum values', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      success: true,
      data: [
        {
          workOrderId: 'wo-1',
          assetId: 'asset-1',
          assetTag: 'ASSET-001',
          title: 'Inspect fan motor',
          description: 'Routine check',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          createdBy: 'user-1',
          createdAt: '2026-02-22T00:00:00.000Z',
        },
      ],
    });

    const result = await listWorkOrders({
      status: 'in_progress',
      priority: 'high',
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/eam/work-orders?status=IN_PROGRESS&priority=HIGH'
    );
    expect(result[0]?.status).toBe('in_progress');
    expect(result[0]?.priority).toBe('high');
  });

  it('maps create payload and response enums between UI and API', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      data: {
        workOrderId: 'wo-2',
        assetId: 'asset-2',
        assetTag: 'ASSET-002',
        title: 'Replace pump seal',
        description: 'Urgent',
        status: 'OPEN',
        priority: 'CRITICAL',
        createdBy: 'user-2',
        createdAt: '2026-02-22T00:00:00.000Z',
      },
    });

    const result = await createWorkOrder({
      assetId: 'asset-2',
      title: 'Replace pump seal',
      description: 'Urgent',
      workType: 'corrective',
      priority: 'critical',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/eam/work-orders',
      expect.objectContaining({
        workType: 'CORRECTIVE',
        priority: 'CRITICAL',
      })
    );
    expect(result.status).toBe('open');
    expect(result.priority).toBe('critical');
  });
});
