import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// Mock api-client used by admin-api so we can observe the requested URL.
let lastUrl: string | null = null;
vi.mock('../api-client', () => {
  class ApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly statusCode: number,
      public readonly requestId?: string
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }

  const apiClient = {
    get: vi.fn(async (url: string) => {
      lastUrl = url;
      return {
        success: true,
        data: { items: [], total: 0, page: 1, limit: 20 },
        requestId: 'req-1',
      };
    }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };

  return { apiClient, ApiError };
});

import { listBuildings } from '../admin-api';

describe('Feature: integrity-fixes, Property 1: Pagination request parameter conversion', () => {
  beforeEach(() => {
    lastUrl = null;
  });

  it('sends limit= and never pageSize= when pageSize is provided', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 500 }), async (pageSize) => {
        await listBuildings(undefined, { page: 1, pageSize });
        expect(lastUrl).toBeTruthy();
        expect(lastUrl!).toContain(`limit=${pageSize}`);
        expect(lastUrl!).not.toContain('pageSize=');
      }),
      { numRuns: 100 }
    );
  });
});

