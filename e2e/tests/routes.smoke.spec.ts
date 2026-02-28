import { test, expect } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import { installApiMocks } from '../helpers/api-mocks';
import { STATIC_ROUTES } from '../routes';

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
      if (msg.type() === 'error') consoleErrors.push(msg.text());
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

