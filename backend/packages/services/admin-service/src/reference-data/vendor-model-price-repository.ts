/**
 * Vendor Model Price Repository - Data access layer for vendor-specific model pricing.
 */

import type {
  UpsertVendorModelPriceRequest,
  UUID,
  VendorModelPrice,
  VendorModelPriceListFilters,
} from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'vendor-model-price-repository' });
let vendorModelPriceCountryCodeSupported: boolean | null = null;

interface VendorModelPriceRow {
  vendor_id: string;
  model_id: string;
  country_code: string | null;
  manufacturer_name: string;
  model_name: string;
  sku: string | null;
  unit_price: string;
  currency: string;
  vendor_sku: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapRowToVendorModelPrice(row: VendorModelPriceRow): VendorModelPrice {
  return {
    vendorId: row.vendor_id,
    modelId: row.model_id,
    countryCode: row.country_code ?? 'GLOBAL',
    manufacturerName: row.manufacturer_name,
    modelName: row.model_name,
    sku: row.sku,
    unitPrice: Number(row.unit_price),
    currency: row.currency,
    vendorSku: row.vendor_sku,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCountryCode(countryCode?: string): string {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized && normalized.length > 0 ? normalized : 'GLOBAL';
}

async function hasCountryCodeColumn(): Promise<boolean> {
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

export async function listVendorModelPrices(
  vendorId: UUID,
  filters: VendorModelPriceListFilters = {}
): Promise<VendorModelPrice[]> {
  const countryCodeSupported = await hasCountryCodeColumn();
  const params: unknown[] = [vendorId];
  const countrySelect = countryCodeSupported ? 'vmp.country_code' : `'GLOBAL'::varchar as country_code`;
  let sql = `
    SELECT
      vmp.vendor_id,
      vmp.model_id,
      ${countrySelect},
      mf.name as manufacturer_name,
      m.model_name,
      m.sku,
      vmp.unit_price,
      vmp.currency,
      vmp.vendor_sku,
      vmp.is_active,
      vmp.created_at,
      vmp.updated_at
    FROM vendor_model_prices vmp
    JOIN models m ON m.model_id = vmp.model_id
    JOIN manufacturers mf ON mf.manufacturer_id = m.manufacturer_id
    WHERE vmp.vendor_id = $1
  `;

  if (filters.modelId) {
    params.push(filters.modelId);
    sql += ` AND vmp.model_id = $${params.length}`;
  }

  if (filters.countryCode) {
    if (!countryCodeSupported) {
      const normalized = normalizeCountryCode(filters.countryCode);
      if (normalized !== 'GLOBAL') {
        return [];
      }
    } else {
      params.push(normalizeCountryCode(filters.countryCode));
      sql += ` AND vmp.country_code = $${params.length}`;
    }
  }

  if (filters.isActive !== undefined) {
    params.push(filters.isActive);
    sql += ` AND vmp.is_active = $${params.length}`;
  }

  sql += countryCodeSupported
    ? ` ORDER BY vmp.country_code ASC, mf.name ASC, m.model_name ASC`
    : ` ORDER BY mf.name ASC, m.model_name ASC`;

  const rows = await queryMany<VendorModelPriceRow>(sql, params);
  return rows.map(mapRowToVendorModelPrice);
}

export async function upsertVendorModelPrice(
  vendorId: UUID,
  modelId: UUID,
  request: UpsertVendorModelPriceRequest,
  userId?: UUID
): Promise<VendorModelPrice> {
  const countryCodeSupported = await hasCountryCodeColumn();
  const currency = (request.currency ?? 'USD').toUpperCase();
  const countryCode = normalizeCountryCode(request.countryCode);
  const vendorSku = request.vendorSku ?? null;
  const isActive = request.isActive ?? true;

  if (!countryCodeSupported && countryCode !== 'GLOBAL') {
    throw new Error(
      'Country-specific vendor model pricing requires V029 migration (vendor_model_prices.country_code)'
    );
  }

  const upsertSql = countryCodeSupported
    ? `
    WITH upserted AS (
      INSERT INTO vendor_model_prices (
        vendor_id, model_id, country_code, unit_price, currency, vendor_sku, is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      ON CONFLICT (vendor_id, model_id, country_code) DO UPDATE SET
        unit_price = EXCLUDED.unit_price,
        currency = EXCLUDED.currency,
        vendor_sku = EXCLUDED.vendor_sku,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING vendor_id, model_id, country_code
    )
    SELECT
      vmp.vendor_id,
      vmp.model_id,
      vmp.country_code,
      mf.name as manufacturer_name,
      m.model_name,
      m.sku,
      vmp.unit_price,
      vmp.currency,
      vmp.vendor_sku,
      vmp.is_active,
      vmp.created_at,
      vmp.updated_at
    FROM vendor_model_prices vmp
    JOIN models m ON m.model_id = vmp.model_id
    JOIN manufacturers mf ON mf.manufacturer_id = m.manufacturer_id
    JOIN upserted u
      ON u.vendor_id = vmp.vendor_id
     AND u.model_id = vmp.model_id
     AND u.country_code = vmp.country_code
    `
    : `
    WITH upserted AS (
      INSERT INTO vendor_model_prices (
        vendor_id, model_id, unit_price, currency, vendor_sku, is_active, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      ON CONFLICT (vendor_id, model_id) DO UPDATE SET
        unit_price = EXCLUDED.unit_price,
        currency = EXCLUDED.currency,
        vendor_sku = EXCLUDED.vendor_sku,
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING vendor_id, model_id
    )
    SELECT
      vmp.vendor_id,
      vmp.model_id,
      'GLOBAL'::varchar as country_code,
      mf.name as manufacturer_name,
      m.model_name,
      m.sku,
      vmp.unit_price,
      vmp.currency,
      vmp.vendor_sku,
      vmp.is_active,
      vmp.created_at,
      vmp.updated_at
    FROM vendor_model_prices vmp
    JOIN models m ON m.model_id = vmp.model_id
    JOIN manufacturers mf ON mf.manufacturer_id = m.manufacturer_id
    JOIN upserted u
      ON u.vendor_id = vmp.vendor_id
     AND u.model_id = vmp.model_id
    `;

  const upsertParams = countryCodeSupported
    ? [vendorId, modelId, countryCode, request.unitPrice, currency, vendorSku, isActive, userId ?? null]
    : [vendorId, modelId, request.unitPrice, currency, vendorSku, isActive, userId ?? null];

  const result = await queryOne<VendorModelPriceRow>(
    upsertSql,
    upsertParams
  );

  if (!result) {
    throw new Error('Failed to upsert vendor model price');
  }

  logger.info('Vendor model price upserted', {
    vendorId,
    modelId,
    countryCode,
    unitPrice: request.unitPrice,
    currency,
    userId,
  });
  return mapRowToVendorModelPrice(result);
}

export async function deactivateVendorModelPrice(
  vendorId: UUID,
  modelId: UUID,
  countryCode?: string,
  userId?: UUID
): Promise<void> {
  const countryCodeSupported = await hasCountryCodeColumn();
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  if (!countryCodeSupported && normalizedCountryCode !== 'GLOBAL') {
    throw new Error(
      'Country-specific vendor model pricing requires V029 migration (vendor_model_prices.country_code)'
    );
  }

  const deactivateSql = countryCodeSupported
    ? `
    UPDATE vendor_model_prices
    SET is_active = FALSE,
        updated_by = $4,
        updated_at = NOW()
    WHERE vendor_id = $1
      AND model_id = $2
      AND country_code = $3
    RETURNING vendor_id
    `
    : `
    UPDATE vendor_model_prices
    SET is_active = FALSE,
        updated_by = $3,
        updated_at = NOW()
    WHERE vendor_id = $1
      AND model_id = $2
    RETURNING vendor_id
    `;

  const deactivateParams = countryCodeSupported
    ? [vendorId, modelId, normalizedCountryCode, userId ?? null]
    : [vendorId, modelId, userId ?? null];

  const result = await queryOne<{ vendor_id: string }>(
    deactivateSql,
    deactivateParams
  );

  if (!result) {
    throw new Error(
      `Vendor model price not found for vendorId=${vendorId} modelId=${modelId} countryCode=${normalizedCountryCode}`
    );
  }

  logger.info('Vendor model price deactivated', {
    vendorId,
    modelId,
    countryCode: normalizedCountryCode,
    userId,
  });
}
