/**
 * Pagination mapping property tests.
 *
 * Feature: integrity-fixes
 * Property 1: Pagination request parameter conversion
 * Property 2: Pagination response mapping correctness
 */

import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

vi.mock('./api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    public code: string;
    public status: number;
    public requestId?: string;
    constructor(code: string, message: string, status: number, requestId?: string) {
      super(message);
      this.code = code;
      this.status = status;
      this.requestId = requestId;
    }
  },
}));

import { listBuildings, mapPaginatedResponse as mapAdminPaginatedResponse } from './admin-api';
import { mapPaginatedResponse as mapAssetPaginatedResponse } from './asset-api';
import { apiClient } from './api-client';

describe('Pagination Properties', () => {
  /**
   * Property 1: Pagination request parameter conversion
   * For any `pageSize`, the admin-api request must send `limit=` not `pageSize=`.
   */
  it('Property 1: Pagination request parameter conversion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          page: fc.integer({ min: 1, max: 50 }),
          pageSize: fc.integer({ min: 1, max: 200 }),
        }),
        async ({ page, pageSize }) => {
          vi.mocked(apiClient.get).mockClear();
          vi.mocked(apiClient.get).mockResolvedValueOnce({
            success: true,
            data: { items: [], total: 0, page, limit: pageSize },
            requestId: 'test',
          } as unknown as { success: true; data: unknown; requestId: string });

          await listBuildings(undefined, { page, pageSize });

          const [url] = vi.mocked(apiClient.get).mock.calls[0] ?? [];
          expect(String(url)).toContain('limit=');
          expect(String(url)).toContain(`limit=${pageSize}`);
          expect(String(url)).not.toContain('pageSize=');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Pagination response mapping correctness
   */
  it('Property 2: Pagination response mapping correctness (admin-api)', () => {
    fc.assert(
      fc.property(
        fc.record({
          total: fc.integer({ min: 0, max: 100000 }),
          page: fc.integer({ min: 1, max: 500 }),
          limit: fc.integer({ min: 1, max: 500 }),
        }),
        ({ total, page, limit }) => {
          const mapped = mapAdminPaginatedResponse<{ id: string }>({
            items: [],
            total,
            page,
            limit,
          });
          expect(mapped.page).toBe(page);
          expect(mapped.pageSize).toBe(limit);
          expect(mapped.total).toBe(total);
          expect(mapped.totalPages).toBe(Math.max(1, Math.ceil(total / Math.max(limit, 1))));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Pagination response mapping correctness (asset-api)', () => {
    fc.assert(
      fc.property(
        fc.record({
          total: fc.integer({ min: 0, max: 100000 }),
          page: fc.integer({ min: 1, max: 500 }),
          limit: fc.integer({ min: 1, max: 500 }),
        }),
        ({ total, page, limit }) => {
          const mapped = mapAssetPaginatedResponse<{ id: string }>({
            items: [],
            total,
            page,
            limit,
          });
          expect(mapped.page).toBe(page);
          expect(mapped.pageSize).toBe(limit);
          expect(mapped.total).toBe(total);
          expect(mapped.totalPages).toBe(Math.max(1, Math.ceil(total / Math.max(limit, 1))));
        }
      ),
      { numRuns: 100 }
    );
  });
});

