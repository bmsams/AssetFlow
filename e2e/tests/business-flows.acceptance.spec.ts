import { test, expect } from 'playwright/test';
import { setTestAuth } from '../helpers/auth';
import { installApiMocks } from '../helpers/api-mocks';
import { installBusinessFlowMocks } from '../helpers/business-flow-mocks';

const isRealApi = process.env.E2E_REAL_API === '1';

test.skip(isRealApi, 'Business flow assertions are deterministic in mocked API mode only.');

test.beforeEach(async ({ page }) => {
  await setTestAuth(page, ['admin']);
  await installApiMocks(page);
  await installBusinessFlowMocks(page);
});

test('procurement flow connects requisition -> PO -> receiving', async ({ page }) => {
  await page.goto('/procurement/requisitions/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'New Requisition' })).toBeVisible();

  await page.getByLabel('Ship to building').selectOption('bldg-hq');
  await expect(page.getByLabel('Ship to address')).toHaveValue(/100 Innovation Way/);
  await page.getByLabel('Header cost center').selectOption('cc-100');

  const lineCard = page.locator('[class*="lineCard"]').first();
  await lineCard.locator('input[type="text"]').first().fill('Rugged Laptop Bundle');
  await lineCard.locator('input[type="number"]').nth(0).fill('2');
  await lineCard.locator('input[type="number"]').nth(1).fill('1200');
  await lineCard.locator('select').nth(1).selectOption('vendor-100');

  await page.getByRole('button', { name: 'Create requisition' }).click();
  await expect(page).toHaveURL(/\/procurement\/requisitions\/req-1001$/);
  await expect(page.getByRole('heading', { name: 'Requisition REQ-2026-0001' })).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('button', { name: 'Convert to PO(s)' })).toBeVisible();

  await page.getByRole('button', { name: 'Convert to PO(s)' }).click();
  const poLink = page.getByRole('link', { name: 'po-converted-001' }).first();
  await expect(poLink).toBeVisible();
  await poLink.click();

  await expect(page).toHaveURL(/\/procurement\/purchase-orders\/po-converted-001$/);
  await expect(page.getByRole('button', { name: 'Receive Items' })).toBeVisible();

  await page.getByRole('button', { name: 'Receive Items' }).click();
  await expect(page).toHaveURL(/\/procurement\/receiving\?poId=po-converted-001/);
  await expect(page.getByRole('heading', { name: 'Receive Items' })).toBeVisible();

  await page.getByRole('button', { name: 'Single Entry' }).first().click();
  await page.getByPlaceholder('Enter or scan serial number...').fill('SN-POC-001');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('SN-POC-001')).toBeVisible();

  await page.getByRole('button', { name: /Complete Receiving/i }).click();
  await expect(page).toHaveURL(/\/procurement\/receiving$/);
  await expect(page.getByText('No items to receive')).toBeVisible();
});

test('ham transfer flow supports create, approve, and complete', async ({ page }) => {
  await page.goto('/ham/transfers', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Transfers' })).toBeVisible();

  await page.getByLabel('From Building').selectOption('bldg-hq');
  await page.getByLabel('From Stockroom').selectOption('sr-main');
  await page.getByLabel('To Building').selectOption('bldg-dc');
  await page.getByLabel('To Stockroom').selectOption('sr-dc');
  await page.getByLabel('Asset / Stock Item').selectOption('asset:asset-hq-01');
  await page.getByLabel('Quantity').fill('1');
  await page.getByRole('button', { name: 'Create Transfer' }).click();

  await expect(page.getByText('Transfer request created successfully.')).toBeVisible();

  const pendingRow = page.getByRole('row', { name: /TRF-1002/i });
  await expect(pendingRow).toContainText(/pending/i);
  await pendingRow.getByRole('button', { name: 'Approve' }).click();

  const approvedRow = page.getByRole('row', { name: /TRF-1002/i });
  await expect(approvedRow).toContainText(/approved/i);
  await approvedRow.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog', { name: 'Complete transfer' })).toBeVisible();
  await page.getByRole('button', { name: 'Complete Transfer' }).click();

  const completedRow = page.getByRole('row', { name: /TRF-1002/i });
  await expect(completedRow).toContainText(/completed/i);
  await expect(completedRow.getByRole('button', { name: 'Complete' })).toHaveCount(0);
});

test('ham transfer edge validation blocks invalid create and invalid completion receipts', async ({ page }) => {
  await page.goto('/ham/transfers', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Transfers' })).toBeVisible();

  // Create validation: same source/destination stockroom is rejected.
  await page.getByLabel('From Building').selectOption('bldg-hq');
  await page.getByLabel('From Stockroom').selectOption('sr-main');
  await page.getByLabel('To Building').selectOption('bldg-hq');
  await page.getByLabel('To Stockroom').selectOption('sr-main');
  await page.getByLabel('Asset / Stock Item').selectOption('asset:asset-hq-01');
  await page.getByLabel('Quantity').fill('1');
  await page.getByRole('button', { name: 'Create Transfer' }).click();
  await expect(page.getByText('Source and destination stockrooms must be different.')).toBeVisible();

  // Create validation: requested quantity cannot exceed source availability.
  await page.getByLabel('To Building').selectOption('bldg-dc');
  await page.getByLabel('To Stockroom').selectOption('sr-dc');
  await page.getByLabel('Asset / Stock Item').selectOption('inventory:inv-main-router');
  await page.getByLabel('Quantity').fill('99');
  await page.getByRole('button', { name: 'Create Transfer' }).click();
  await expect(page.getByText('Quantity exceeds available stock in the source stockroom.')).toBeVisible();
  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByRole('row', { name: /TRF-1001/i })).toBeVisible();

  // Completion validation: damaged quantity cannot exceed received quantity.
  const pendingRow = page.getByRole('row', { name: /TRF-1001/i });
  await pendingRow.getByRole('button', { name: 'Approve' }).click();

  const approvedRow = page.getByRole('row', { name: /TRF-1001/i });
  await approvedRow.getByRole('button', { name: 'Complete' }).click();
  await expect(page.getByRole('dialog', { name: 'Complete transfer' })).toBeVisible();

  const completionLinesTable = page.getByRole('table', { name: 'Transfer completion lines' });
  await completionLinesTable.locator('input[type="number"]').nth(0).fill('1'); // received
  await completionLinesTable.locator('input[type="number"]').nth(1).fill('2'); // damaged
  await page.getByRole('button', { name: 'Complete Transfer' }).click();

  await expect(
    page.getByText(/Damaged quantity cannot exceed received quantity/i)
  ).toBeVisible();
});

test('eam work orders supports building switch and building-scoped asset creation', async ({ page }) => {
  await page.goto('/eam/work-orders', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^Work Orders$/ })).toBeVisible();

  const buildingFilter = page.getByLabel('Building:');
  const assetSelect = page.getByLabel('Asset (Building scoped)');

  await buildingFilter.selectOption('bldg-hq');
  await expect(assetSelect).toContainText('AST-HQ-01 - HQ Router');

  await buildingFilter.selectOption('bldg-dc');
  await expect(assetSelect).toContainText('AST-DC-01 - Data Center UPS');
  await expect(assetSelect).not.toContainText('AST-HQ-01 - HQ Router');

  await page.getByPlaceholder('Short work order title').fill('Generator battery inspection');
  await page.getByPlaceholder('Describe the issue or required work').fill('Routine inspection after transfer');
  await page.getByRole('button', { name: 'Create Work Order' }).click();

  await expect(page.getByRole('table', { name: 'Work orders' })).toContainText('Generator battery inspection');
  await expect(page.getByRole('table', { name: 'Work orders' })).toContainText('AST-DC-01');
});
