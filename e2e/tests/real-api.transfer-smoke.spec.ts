import { test, expect, type Locator } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import { createApiPathMatcher } from '../helpers/real-api-audit';

const isRealApi = process.env.E2E_REAL_API === '1';

async function getSelectableOptions(select: Locator): Promise<string[]> {
  return select
    .locator('option')
    .evaluateAll((options) =>
      options
        .map((option) => option.getAttribute('value') ?? '')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    );
}

async function waitForSelectableOptions(
  select: Locator,
  timeoutMs = 15_000
): Promise<string[]> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const options = await getSelectableOptions(select);
    if (options.length > 0) {
      return options;
    }
    await select.page().waitForTimeout(500);
  }
  return [];
}

test.describe('real-api transfer smoke', () => {
  test.skip(!isRealApi, 'Runs only when E2E_REAL_API=1.');

  test('loads transfers with seeded stockrooms and no 5xx HAM responses', async ({ page }) => {
    const fromStockroomId = process.env.E2E_SEED_FROM_STOCKROOM_ID;
    const toStockroomId = process.env.E2E_SEED_TO_STOCKROOM_ID;

    if (fromStockroomId && toStockroomId) {
      expect(fromStockroomId).not.toBe(toStockroomId);
    }

    await setTestAuth(page, ['inventory_manager']);

    const hamResponseStatuses: number[] = [];
    const adminResponseStatuses: number[] = [];
    const hamPathMatcher = createApiPathMatcher('/ham/');
    const adminPathMatcher = createApiPathMatcher('/admin/');
    page.on('response', (response) => {
      if (hamPathMatcher(response.url())) {
        hamResponseStatuses.push(response.status());
      }
      if (adminPathMatcher(response.url())) {
        adminResponseStatuses.push(response.status());
      }
    });

    await page.goto('/ham/transfers', { waitUntil: 'domcontentloaded' });

    if (/\/login(\?|$)/.test(page.url())) {
      test.skip(
        true,
        'Real API redirected to /login. Configure real Cognito test-user auth for transfer smoke.'
      );
    }

    await expect(page.getByRole('heading', { name: 'Transfers' })).toBeVisible();

    const fromStockroomSelect = page.getByLabel('From Stockroom');
    const toStockroomSelect = page.getByLabel('To Stockroom');

    const fromOptions = await waitForSelectableOptions(fromStockroomSelect);
    const toOptions = await waitForSelectableOptions(toStockroomSelect);

    if (fromOptions.length === 0 || toOptions.length === 0) {
      const authFailureStatus = [...adminResponseStatuses, ...hamResponseStatuses].find(
        (status) => status === 401 || status === 403
      );
      if (authFailureStatus) {
        test.skip(
          true,
          `Transfer smoke requires authorized access to reference APIs; observed ${authFailureStatus}.`
        );
      }
    }

    expect(fromOptions.length, 'No selectable source stockroom options loaded').toBeGreaterThan(0);
    expect(toOptions.length, 'No selectable destination stockroom options loaded').toBeGreaterThan(0);

    const seededOptionsAvailable =
      typeof fromStockroomId === 'string' &&
      typeof toStockroomId === 'string' &&
      fromOptions.includes(fromStockroomId) &&
      toOptions.includes(toStockroomId);

    const selectedFromStockroomId = seededOptionsAvailable ? fromStockroomId : fromOptions[0];
    const selectedToStockroomId = seededOptionsAvailable
      ? toStockroomId
      : toOptions.find((candidate) => candidate !== selectedFromStockroomId);

    expect(selectedFromStockroomId, 'No selectable source stockroom option resolved').toBeTruthy();
    expect(selectedToStockroomId, 'No selectable destination stockroom option resolved').toBeTruthy();

    await fromStockroomSelect.selectOption(selectedFromStockroomId!);
    await toStockroomSelect.selectOption(selectedToStockroomId!);

    const itemSelector = page.getByLabel('Asset / Stock Item');
    await expect
      .poll(async () => itemSelector.locator('option').count(), { timeout: 15_000 })
      .toBeGreaterThan(1);

    const badStatus = hamResponseStatuses.find((status) => status >= 500);
    expect(badStatus, `HAM API returned 5xx status: ${badStatus ?? 'none'}`).toBeUndefined();
  });
});
