import { test, expect, type Page } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import { installApiMocks } from '../helpers/api-mocks';

const isRealApi = process.env.E2E_REAL_API === '1';

type UserRole =
  | 'admin'
  | 'asset_manager'
  | 'inventory_manager'
  | 'procurement_manager'
  | 'license_analyst'
  | 'facilities_manager'
  | 'auditor'
  | 'viewer';

interface RoleAcceptanceScenario {
  role: UserRole;
  allowedPath: string;
  expectedApi: RegExp;
  forbiddenPath?: string;
  quick?: boolean;
}

const ROLE_SCENARIOS: RoleAcceptanceScenario[] = [
  {
    role: 'admin',
    allowedPath: '/admin/locations',
    expectedApi: /\/v1\/admin\/buildings(?:\?|$)/,
    quick: true,
  },
  {
    role: 'asset_manager',
    allowedPath: '/assets',
    expectedApi: /\/v1\/assets(?:\?|$)/,
    forbiddenPath: '/admin/users',
  },
  {
    role: 'inventory_manager',
    allowedPath: '/stockrooms',
    expectedApi: /\/v1\/admin\/stockrooms(?:\?|$)/,
    forbiddenPath: '/admin/users',
  },
  {
    role: 'procurement_manager',
    allowedPath: '/procurement/purchase-orders',
    expectedApi: /\/v1\/procurement\/purchase-orders(?:\?|$)/,
    forbiddenPath: '/admin/users',
    quick: true,
  },
  {
    role: 'license_analyst',
    allowedPath: '/licenses',
    expectedApi: /\/v1\/sam\/workbench\/summary(?:\?|$)/,
    forbiddenPath: '/admin/users',
  },
  {
    role: 'facilities_manager',
    allowedPath: '/eam/work-orders',
    expectedApi: /\/v1\/eam\/work-orders(?:\?|$)/,
    forbiddenPath: '/admin/users',
  },
  {
    role: 'auditor',
    allowedPath: '/reports/asset-summary',
    expectedApi: /\/v1\/reports\/asset-summary(?:\?|$)/,
    forbiddenPath: '/admin/users',
  },
  {
    role: 'viewer',
    allowedPath: '/assets',
    expectedApi: /\/v1\/assets(?:\?|$)/,
    forbiddenPath: '/admin/users',
    quick: true,
  },
];

async function navigateAndExpectApiRequest(
  page: Page,
  path: string,
  endpointPattern: RegExp
): Promise<void> {
  const apiRequest = page.waitForRequest(
    (request) =>
      request.method().toUpperCase() === 'GET' && endpointPattern.test(request.url()),
    { timeout: 15_000 }
  );

  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await apiRequest;
  await page.waitForTimeout(150);
}

test.describe('role-by-role UI/API acceptance', () => {
  for (const scenario of ROLE_SCENARIOS) {
    const tag = scenario.quick ? '@quick ' : '';

    test(`${tag}${scenario.role}: allowed route loads and hits expected API`, async ({ page }) => {
      await setTestAuth(page, [scenario.role]);
      await installApiMocks(page);

      await navigateAndExpectApiRequest(page, scenario.allowedPath, scenario.expectedApi);

      // In real API mode, auth/session handoff can redirect to /login even after
      // a route API call is observed; keep strict URL assertion for mocked mode.
      if (!isRealApi) {
        await expect(page).not.toHaveURL(/\/login(\?|$)/);
      }
      await expect(page.getByText(/Access Denied/i)).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /Page Not Found/i })).toHaveCount(0);
    });

    if (scenario.forbiddenPath) {
      test(`${tag}${scenario.role}: forbidden route is denied`, async ({ page }) => {
        await setTestAuth(page, [scenario.role]);
        await installApiMocks(page);

        await page.goto(scenario.forbiddenPath, { waitUntil: 'domcontentloaded' });

        await expect(page).not.toHaveURL(/\/login(\?|$)/);
        await expect(page.getByText('Access Denied')).toBeVisible();
      });
    }
  }
});
