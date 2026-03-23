import { expect, test } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import {
  assertNoServerErrors,
  assertObserved,
  captureStatuses,
  createApiPathMatcher,
} from '../helpers/real-api-audit';

const isRealApi = process.env.E2E_REAL_API === '1';

test.describe('real-api reports', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('asset summary report loads with real API and no 5xx', async ({ page }) => {
    await setTestAuth(page, ['admin']);
    const statuses = captureStatuses(
      page,
      createApiPathMatcher('/reports/', '/dashboard/')
    );

    await page.goto('/reports/asset-summary', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(\?|$)/);

    await page.waitForTimeout(1500);
    assertObserved(statuses, 'report API');
    assertNoServerErrors(statuses, 'report API');
  });
});
