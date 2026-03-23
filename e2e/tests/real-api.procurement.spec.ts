import { expect, test } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import {
  assertNoServerErrors,
  assertObserved,
  captureStatuses,
  createApiPathMatcher,
} from '../helpers/real-api-audit';

const isRealApi = process.env.E2E_REAL_API === '1';

test.describe('real-api procurement', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('purchase orders page loads with real API and no 5xx', async ({ page }) => {
    await setTestAuth(page, ['admin']);
    const statuses = captureStatuses(
      page,
      createApiPathMatcher('/procurement/', '/lifecycle/')
    );

    await page.goto('/procurement/purchase-orders', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(\?|$)/);

    await page.waitForTimeout(1500);
    assertObserved(statuses, 'procurement API');
    assertNoServerErrors(statuses, 'procurement API');
  });
});
