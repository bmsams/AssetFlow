import type { Page, Route } from 'playwright/test';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function json(route: Route, status: number, body: Json): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function paginatedEmpty(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    ...overrides,
  };
}

export async function installApiMocks(page: Page): Promise<void> {
  if (process.env.E2E_REAL_API === '1') return;

  await page.route('**/v1/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    const url = new URL(req.url());

    const idx = url.pathname.indexOf('/v1/');
    const apiPath = idx >= 0 ? url.pathname.slice(idx + 3) : url.pathname; // "/assets", "/dashboard/summary", etc.

    // Minimal mocks that keep the UI responsive/deterministic for E2E.
    if (method === 'GET' && apiPath === '/dashboard/summary') {
      return json(route, 200, {
        totalAssetValue: 0,
        totalAssetCount: 0,
        countsByCategory: [],
        lifecycleDistribution: [],
        leaseExpirations: [],
        complianceIndicators: [],
      });
    }

    if (method === 'GET' && apiPath.startsWith('/assets')) {
      // /assets, /assets/search, /assets/:id, etc.
      if (apiPath === '/assets' || apiPath.startsWith('/assets?')) {
        return json(route, 200, paginatedEmpty());
      }
      if (apiPath.startsWith('/assets/search')) {
        return json(route, 200, paginatedEmpty());
      }
      return json(route, 200, {
        assetId: 'asset-1',
        assetType: 'HARDWARE',
        displayName: 'Test Asset',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (method === 'GET' && apiPath.startsWith('/admin/')) {
      // Most admin lists are paginated.
      if (apiPath.includes('/model-prices')) {
        return json(route, 200, { items: [], total: 0 });
      }
      return json(route, 200, paginatedEmpty());
    }

    if (method === 'GET' && apiPath.startsWith('/lifecycle/contracts')) {
      return json(route, 200, { contracts: [], total: 0 });
    }

    if (method === 'GET' && apiPath.startsWith('/lifecycle/catalog/items')) {
      return json(route, 200, { items: [], total: 0 });
    }

    if (method === 'GET' && apiPath.startsWith('/lifecycle/catalog/search')) {
      return json(route, 200, { items: [], total: 0 });
    }

    if (method === 'GET' && apiPath === '/notifications/history') {
      return json(route, 200, []);
    }

    if (method === 'GET' && apiPath === '/notifications/preferences') {
      return json(route, 200, {
        pushEnabled: false,
        inAppEnabled: true,
        emailEnabled: true,
        showBadges: true,
        playSound: false,
        quietHoursStart: undefined,
        quietHoursEnd: undefined,
        typePreferences: [],
      });
    }

    if (method === 'GET' && apiPath.startsWith('/reports/')) {
      const now = new Date().toISOString();
      if (apiPath.startsWith('/reports/asset-summary')) {
        return json(route, 200, {
          generatedAt: now,
          totalAssets: 0,
          byType: [],
          byStatus: [],
          byLocation: [],
        });
      }
      if (apiPath.startsWith('/reports/asset-aging')) {
        return json(route, 200, {
          generatedAt: now,
          ageRanges: [],
          assets: [],
        });
      }
      if (apiPath.startsWith('/reports/assets-by-location')) {
        return json(route, 200, { generatedAt: now, buildings: [] });
      }
      if (apiPath.startsWith('/reports/assets-by-department')) {
        return json(route, 200, { generatedAt: now, departments: [] });
      }
      if (apiPath.startsWith('/reports/cost-center-utilization')) {
        return json(route, 200, { generatedAt: now, fiscalYear: 2026, costCenters: [] });
      }
      if (apiPath.startsWith('/reports/procurement-spending')) {
        return json(route, 200, {
          generatedAt: now,
          period: { from: '2026-01-01', to: '2026-12-31' },
          totalSpending: 0,
          byVendor: [],
          byCategory: [],
          byMonth: [],
        });
      }
      if (apiPath.startsWith('/reports/work-order-summary')) {
        return json(route, 200, {
          generatedAt: now,
          period: { from: '2026-01-01', to: '2026-12-31' },
          totalWorkOrders: 0,
          byStatus: [],
          byType: [],
          byPriority: [],
          averageCompletionTimeHours: 0,
          overdueCount: 0,
        });
      }
      if (apiPath.startsWith('/reports/maintenance-compliance')) {
        return json(route, 200, {
          generatedAt: now,
          totalPlans: 0,
          activePlans: 0,
          complianceRate: 0,
          overdueItems: [],
          upcomingItems: [],
        });
      }

      return json(route, 200, { generatedAt: now });
    }

    if (method === 'GET' && apiPath.startsWith('/procurement/')) {
      return json(route, 200, paginatedEmpty());
    }

    if (method === 'GET' && apiPath.startsWith('/eam/')) {
      // EAM endpoints are mostly array responses in this frontend.
      if (apiPath === '/eam/linear-assets') return json(route, 200, []);
      if (apiPath === '/eam/parts/levels') return json(route, 200, []);
      if (apiPath.startsWith('/eam/work-orders')) return json(route, 200, []);
      if (apiPath.startsWith('/eam/maintenance-plans')) return json(route, 200, []);
      return json(route, 200, []);
    }

    if (method === 'GET' && apiPath.startsWith('/ham/')) {
      // HAM pages in this repo are currently UI-heavy; keep data endpoints empty.
      return json(route, 200, []);
    }

    if (apiPath.includes('/notification-preferences')) {
      // /users/:id/notification-preferences
      if (method === 'GET' || method === 'PUT') {
        return json(route, 200, {
          emailEnabled: true,
          pushEnabled: false,
          categories: {
            asset: true,
            procurement: true,
            maintenance: true,
            compliance: true,
            system: true,
          },
        });
      }
    }

    // Default: succeed with empty JSON so pages can render empty/error states quickly.
    return json(route, 200, {});
  });
}
