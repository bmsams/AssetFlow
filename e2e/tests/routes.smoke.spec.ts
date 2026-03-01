import { test, expect } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import { installApiMocks } from '../helpers/api-mocks';
import { STATIC_ROUTES } from '../routes';

const isRealApi = process.env.E2E_REAL_API === '1';

function isIgnorableRealApiConsoleError(message: string): boolean {
  if (!isRealApi) {
    return false;
  }

  // In real API mode we do not provision a signed Cognito JWT in test setup,
  // so API fetches can legitimately return 401 while still verifying route rendering.
  return (
    /Failed to load resource: the server responded with a status of 401/.test(message) ||
    /Session expired\. Please log in again\./.test(message) ||
    /has been blocked by CORS policy/.test(message) ||
    /Failed to load resource: net::ERR_FAILED/.test(message) ||
    /ApiError: Failed to fetch/.test(message)
  );
}

function countVisibleLoading(page: import('playwright/test').Page): Promise<number> {
  return page.$$eval(
    '[class*="loading"], [class*="Loading"], [class*="spinner"], [class*="Spinner"], [class*="skeleton"], [class*="Skeleton"]',
    (els) =>
      els.filter((el) => {
        const style = window.getComputedStyle(el as Element);
        return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetWidth > 0;
      }).length
  );
}

test.beforeEach(async ({ page }) => {
  await setTestAuth(page, ['admin']);
  await installApiMocks(page);
});

for (const r of STATIC_ROUTES) {
  test(`route loads: ${r.name} (${r.path})`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() !== 'error') {
        return;
      }

      const text = msg.text();
      if (isIgnorableRealApiConsoleError(text)) {
        return;
      }

      consoleErrors.push(text);
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(r.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);

    // Basic sanity: should not fall into the NotFound page for known routes.
    await expect(page.getByRole('heading', { name: /page not found/i })).toHaveCount(0);

    // Avoid the "infinite skeleton" class of bugs.
    const loadingCount = await countVisibleLoading(page);
    expect(loadingCount, 'loading/skeleton elements should not remain visible').toBe(0);

    expect(pageErrors, 'page errors').toEqual([]);
    expect(consoleErrors, 'console errors').toEqual([]);
  });
}
