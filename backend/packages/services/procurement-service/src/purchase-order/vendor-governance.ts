import type { CreatePOLineRequest, POProductType, UUID } from '@ams/types';
import { queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'po-vendor-governance' });
let vendorModelPriceCountryCodeSupported: boolean | null = null;

const APPROVED_VENDOR_RATINGS = new Set(['PREFERRED', 'APPROVED']);

interface VendorRow {
  vendor_id: string;
  vendor_name: string;
  is_active: boolean;
  rating: string | null;
}

interface CostCenterRow {
  cost_center_id: string;
  code: string;
  is_active: boolean;
}

interface VendorModelPriceRow {
  unit_price: string;
  currency: string;
  country_code: string | null;
  is_active: boolean;
}

export interface GovernanceLineInput {
  readonly productType: POProductType;
  readonly productId?: UUID | null;
  readonly unitPrice: number;
  readonly vendorId?: UUID | null;
  readonly costCenterId?: UUID | null;
}

export interface PurchaseOrderGovernanceInput {
  readonly vendorId: UUID;
  readonly costCenterId: UUID;
  readonly currency?: string | null;
  readonly countryCode?: string | null;
  readonly lines?: readonly GovernanceLineInput[];
}

function normalizeCurrency(currency?: string | null): string {
  return (currency ?? 'USD').toUpperCase();
}

function normalizeCountryCode(countryCode?: string | null): string {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : 'GLOBAL';
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function hasVendorModelPriceCountryCode(): Promise<boolean> {
  // Re-check until supported=true so warm runtimes pick up live migrations.
  if (vendorModelPriceCountryCodeSupported === true) {
    return vendorModelPriceCountryCodeSupported;
  }

  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text as count
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'vendor_model_prices'
       AND column_name = 'country_code'`
  );

  vendorModelPriceCountryCodeSupported = Number(row?.count ?? '0') > 0;
  return vendorModelPriceCountryCodeSupported;
}

async function assertApprovedVendor(vendorId: UUID): Promise<VendorRow> {
  const vendor = await queryOne<VendorRow>(
    `SELECT vendor_id, vendor_name, is_active, rating
     FROM vendors
     WHERE vendor_id = $1`,
    [vendorId]
  );

  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorId}`);
  }

  if (!vendor.is_active) {
    throw new Error(`Vendor ${vendor.vendor_name} is inactive and cannot be used on purchase orders`);
  }

  const rating = (vendor.rating ?? '').toUpperCase();
  if (!APPROVED_VENDOR_RATINGS.has(rating)) {
    throw new Error(
      `Vendor ${vendor.vendor_name} is not approved for purchasing (rating must be PREFERRED or APPROVED)`
    );
  }

  return vendor;
}

async function assertActiveCostCenter(costCenterId: UUID, contextLabel: string): Promise<void> {
  const costCenter = await queryOne<CostCenterRow>(
    `SELECT cost_center_id, code, is_active
     FROM cost_centers
     WHERE cost_center_id = $1`,
    [costCenterId]
  );

  if (!costCenter) {
    throw new Error(`${contextLabel}: cost center not found (${costCenterId})`);
  }

  if (!costCenter.is_active) {
    throw new Error(`${contextLabel}: cost center ${costCenter.code} is inactive`);
  }
}

async function assertApprovedHardwareModelPrice(
  vendorId: UUID,
  poCurrency: string,
  countryCode: string,
  line: GovernanceLineInput,
  lineIndex: number
): Promise<void> {
  const lineLabel = `lines[${lineIndex}]`;

  if (line.productType !== 'HARDWARE_MODEL') {
    return;
  }

  if (!line.productId) {
    throw new Error(`${lineLabel}.productId is required for HARDWARE_MODEL pricing validation`);
  }

  const countryCodeSupported = await hasVendorModelPriceCountryCode();

  const approved = countryCodeSupported
    ? await queryOne<VendorModelPriceRow>(
        `SELECT unit_price::text as unit_price, currency, country_code, is_active
         FROM vendor_model_prices
         WHERE vendor_id = $1
           AND model_id = $2
           AND country_code IN ($3, 'GLOBAL')
         ORDER BY CASE WHEN country_code = $3 THEN 0 ELSE 1 END,
                  unit_price ASC
         LIMIT 1`,
        [vendorId, line.productId, countryCode]
      )
    : await queryOne<VendorModelPriceRow>(
        `SELECT unit_price::text as unit_price, currency, 'GLOBAL'::varchar as country_code, is_active
         FROM vendor_model_prices
         WHERE vendor_id = $1
           AND model_id = $2
         LIMIT 1`,
        [vendorId, line.productId]
      );

  if (!approved) {
    throw new Error(
      `${lineLabel}: vendor ${vendorId} is not in the approved vendor/model price list for model ${line.productId}`
    );
  }

  if (!approved.is_active) {
    throw new Error(
      `${lineLabel}: approved vendor/model price is inactive for vendor ${vendorId} and model ${line.productId}`
    );
  }

  const approvedCurrency = normalizeCurrency(approved.currency);
  if (approvedCurrency !== poCurrency) {
    throw new Error(
      `${lineLabel}: approved price currency ${approvedCurrency} does not match PO currency ${poCurrency}`
    );
  }

  const approvedPrice = Number(approved.unit_price);
  if (Number.isNaN(approvedPrice)) {
    throw new Error(
      `${lineLabel}: approved vendor/model price is invalid for vendor ${vendorId} and model ${line.productId}`
    );
  }

  if (roundMoney(approvedPrice) !== roundMoney(line.unitPrice)) {
    throw new Error(
      `${lineLabel}: unitPrice ${line.unitPrice} does not match approved vendor/model price ${approvedPrice} ${poCurrency}`
    );
  }
}

export async function validatePurchaseOrderGovernance(
  input: PurchaseOrderGovernanceInput
): Promise<void> {
  const poCurrency = normalizeCurrency(input.currency);
  const poCountryCode = normalizeCountryCode(input.countryCode);
  const approvedVendors = new Map<UUID, VendorRow>();
  const ensureApprovedVendor = async (vendorId: UUID): Promise<VendorRow> => {
    const cached = approvedVendors.get(vendorId);
    if (cached) {
      return cached;
    }

    const vendor = await assertApprovedVendor(vendorId);
    approvedVendors.set(vendorId, vendor);
    return vendor;
  };

  await ensureApprovedVendor(input.vendorId);
  await assertActiveCostCenter(input.costCenterId, 'costCenterId');

  const lines = input.lines ?? [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const effectiveVendorId = line.vendorId ?? input.vendorId;
    const effectiveCostCenterId = line.costCenterId ?? input.costCenterId;
    await ensureApprovedVendor(effectiveVendorId);
    await assertActiveCostCenter(effectiveCostCenterId, `lines[${index}].costCenterId`);
    await assertApprovedHardwareModelPrice(effectiveVendorId, poCurrency, poCountryCode, line, index);
  }

  logger.debug('PO governance validation passed', {
    vendorId: input.vendorId,
    costCenterId: input.costCenterId,
    currency: poCurrency,
    countryCode: poCountryCode,
    lineCount: lines.length,
  });
}

export function toGovernanceLineInput(
  line: Pick<CreatePOLineRequest, 'productType' | 'productId' | 'unitPrice' | 'vendorId' | 'costCenterId'>
): GovernanceLineInput {
  return {
    productType: line.productType,
    productId: line.productId ?? null,
    unitPrice: line.unitPrice,
    vendorId: line.vendorId ?? null,
    costCenterId: line.costCenterId ?? null,
  };
}
