import { test, expect } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';

const isRealApi = process.env.E2E_REAL_API === '1';

test.describe('real-api transfer smoke', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('loads transfers with seeded stockrooms and no 5xx HAM responses', async ({ page }) => {
    const fromStockroomId = process.env.E2E_SEED_FROM_STOCKROOM_ID;
    const toStockroomId = process.env.E2E_SEED_TO_STOCKROOM_ID;

    expect(fromStockroomId, 'Set E2E_SEED_FROM_STOCKROOM_ID for deterministic real-API smoke').toBeTruthy();
    expect(toStockroomId, 'Set E2E_SEED_TO_STOCKROOM_ID for deterministic real-API smoke').toBeTruthy();
    expect(fromStockroomId).not.toBe(toStockroomId);

    await setTestAuth(page, ['inventory_manager']);

    const hamResponseStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/v1/ham/')) {
        hamResponseStatuses.push(response.status());
      }
    });

    await page.goto('/ham/transfers', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Transfers' })).toBeVisible();

    const fromStockroomSelect = page.getByLabel('From Stockroom');
    const toStockroomSelect = page.getByLabel('To Stockroom');

    await expect(fromStockroomSelect.locator(`option[value="${fromStockroomId}"]`)).toHaveCount(1);
    await expect(toStockroomSelect.locator(`option[value="${toStockroomId}"]`)).toHaveCount(1);

    await fromStockroomSelect.selectOption(fromStockroomId!);
    await toStockroomSelect.selectOption(toStockroomId!);

    const itemSelector = page.getByLabel('Asset / Stock Item');
    await expect
      .poll(async () => itemSelector.locator('option').count(), { timeout: 15_000 })
      .toBeGreaterThan(1);

    const badStatus = hamResponseStatuses.find((status) => status >= 500);
    expect(badStatus, `HAM API returned 5xx status: ${badStatus ?? 'none'}`).toBeUndefined();
  });
});
