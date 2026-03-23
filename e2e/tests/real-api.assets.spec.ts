import { expect, test } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import {
  assertNoServerErrors,
  assertObserved,
  captureStatuses,
  createApiPathMatcher,
} from '../helpers/real-api-audit';

const isRealApi = process.env.E2E_REAL_API === '1';

test.describe('real-api assets', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('hardware assets page loads with real API and no 5xx', async ({ page }) => {
    await setTestAuth(page, ['admin']);
    const statuses = captureStatuses(page, createApiPathMatcher('/assets'));

    await page.goto('/assets/hardware', { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login(\?|$)/);

    await page.waitForTimeout(1500);
    assertObserved(statuses, 'asset API');
    assertNoServerErrors(statuses, 'asset API');
  });
});
