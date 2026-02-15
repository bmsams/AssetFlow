import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { mapPaginatedResponse as mapAdmin } from '../admin-api';
import { mapPaginatedResponse as mapAsset } from '../asset-api';

describe('Feature: integrity-fixes, Property 2: Pagination response mapping correctness', () => {
  it('maps limit -> pageSize and computes totalPages >= 1 (admin-api)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 500 }),
        (total, page, limit) => {
          const mapped = mapAdmin<{ id: string }>({ items: [], total, page, limit });
          expect(mapped.pageSize).toBe(limit);
          expect(mapped.totalPages).toBe(Math.max(1, Math.ceil(total / limit)));
          expect(mapped.totalPages).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('maps limit -> pageSize and computes totalPages >= 1 (asset-api)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 500 }),
        (total, page, limit) => {
          const mapped = mapAsset<{ id: string }>({ items: [], total, page, limit });
          expect(mapped.pageSize).toBe(limit);
          expect(mapped.totalPages).toBe(Math.max(1, Math.ceil(total / limit)));
          expect(mapped.totalPages).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

