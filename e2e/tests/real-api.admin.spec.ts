import { expect, test } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import {
  assertNoServerErrors,
  assertObserved,
  captureStatuses,
  createApiPathMatcher,
} from '../helpers/real-api-audit';

const isRealApi = process.env.E2E_REAL_API === '1';

test.describe('real-api admin', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('admin locations loads without 5xx responses', async ({ page }) => {
    await setTestAuth(page, ['admin']);

    const statuses = captureStatuses(page, createApiPathMatcher('/admin/'));

    await page.goto('/admin/locations', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(\?|$)/);

    await page.waitForTimeout(1500);
    assertObserved(statuses, 'admin API');
    assertNoServerErrors(statuses, 'admin API');
  });
});
