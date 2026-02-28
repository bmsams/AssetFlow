/**
 * Vendor Integration Repository - Data access layer
 *
 * Implements database operations for:
 * - ASN (Advance Ship Notice) storage and retrieval
 * - Pre-created asset management
 * - Vendor catalog operations
 *
 * Requirements:
 * - 7.5: Receive Advance Ship Notices from resellers like CDW and Insight
 * - 7.6: Pre-create asset records with serial numbers before physical arrival
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

import type {
  AdvanceShipNotice,
  ASNLineItem,
  ASNLineStatus,
  ASNStatus,
  CatalogItemAvailability,
  PreCreatedAsset,
  VendorCatalogItem,
  VendorCatalogSearchRequest,
  VendorIntegrationConfig,
  VendorType,
} from './vendor-types';

const logger = createLogger({ service: 'vendor-repository' });

// ============================================================================
// Database Row Types
// ============================================================================

interface ASNRow {
  asn_id: string;
  vendor_type: VendorType;
  vendor_name: string;
  vendor_asn_number: string;
  purchase_order_number: string;
  purchase_order_id: string | null;
  ship_date: string;
  expected_delivery_date: string;
  carrier_name: string | null;
  tracking_number: string | null;
  ship_from_address: string | null;
  ship_to_address: string | null;
  status: ASNStatus;
  total_items: number;
  processed_items: number;
  failed_items: number;
  raw_data: string | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface ASNLineRow {
  line_id: string;
  asn_id: string;
  line_number: number;
  vendor_part_number: string;
  manufacturer_part_number: string | null;
  description: string;
  quantity: number;
  serial_numbers: string;
  manufacturer: string | null;
  model: string | null;
  unit_price: number | null;
  status: ASNLineStatus;
  created_asset_ids: string;
  linked_asset_ids: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface VendorCatalogItemRow {
  catalog_item_id: string;
  vendor_type: VendorType;
  vendor_part_number: string;
  manufacturer_part_number: string | null;
  manufacturer: string;
  model: string;
  description: string;
  category: string;
  subcategory: string | null;
  unit_price: number;
  currency: string;
  availability: CatalogItemAvailability;
  lead_time_days: number | null;
  minimum_order_quantity: number | null;
  specifications: string | null;
  image_url: string | null;
  product_url: string | null;
  last_updated_at: string;
  created_at: string;
}

interface VendorConfigRow {
  config_id: string;
  vendor_type: VendorType;
  vendor_name: string;
  is_active: boolean;
  auto_process_asn: boolean;
  auto_create_assets: boolean;
  default_stockroom_id: string | null;
  webhook_url: string | null;
  api_endpoint: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Mapping Functions
// ============================================================================

function mapRowToASN(row: ASNRow, lines: ASNLineItem[] = []): AdvanceShipNotice {
  return {
    asnId: row.asn_id,
    vendorType: row.vendor_type,
    vendorName: row.vendor_name,
    vendorAsnNumber: row.vendor_asn_number,
    purchaseOrderNumber: row.purchase_order_number,
    purchaseOrderId: row.purchase_order_id ?? undefined,
    shipDate: row.ship_date,
    expectedDeliveryDate: row.expected_delivery_date,
    carrierName: row.carrier_name ?? undefined,
    trackingNumber: row.tracking_number ?? undefined,
    shipFromAddress: row.ship_from_address ? JSON.parse(row.ship_from_address) : undefined,
    shipToAddress: row.ship_to_address ? JSON.parse(row.ship_to_address) : undefined,
    status: row.status,
    totalItems: row.total_items,
    processedItems: row.processed_items,
    failedItems: row.failed_items,
    lines,
    rawData: row.raw_data ? JSON.parse(row.raw_data) : undefined,
    processedAt: row.processed_at ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToASNLine(row: ASNLineRow): ASNLineItem {
  return {
    lineId: row.line_id,
    asnId: row.asn_id,
    lineNumber: row.line_number,
    vendorPartNumber: row.vendor_part_number,
    manufacturerPartNumber: row.manufacturer_part_number ?? undefined,
    description: row.description,
    quantity: row.quantity,
    serialNumbers: JSON.parse(row.serial_numbers),
    manufacturer: row.manufacturer ?? undefined,
    model: row.model ?? undefined,
    unitPrice: row.unit_price ?? undefined,
    status: row.status,
    createdAssetIds: JSON.parse(row.created_asset_ids),
    linkedAssetIds: JSON.parse(row.linked_asset_ids),
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToCatalogItem(row: VendorCatalogItemRow): VendorCatalogItem {
  return {
    catalogItemId: row.catalog_item_id,
    vendorType: row.vendor_type,
    vendorPartNumber: row.vendor_part_number,
    manufacturerPartNumber: row.manufacturer_part_number ?? undefined,
    manufacturer: row.manufacturer,
    model: row.model,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    unitPrice: row.unit_price,
    currency: row.currency,
    availability: row.availability,
    leadTimeDays: row.lead_time_days ?? undefined,
    minimumOrderQuantity: row.minimum_order_quantity ?? undefined,
    specifications: row.specifications ? JSON.parse(row.specifications) : undefined,
    imageUrl: row.image_url ?? undefined,
    productUrl: row.product_url ?? undefined,
    lastUpdatedAt: row.last_updated_at,
    createdAt: row.created_at,
  };
}

function mapRowToVendorConfig(row: VendorConfigRow): VendorIntegrationConfig {
  return {
    configId: row.config_id,
    vendorType: row.vendor_type,
    vendorName: row.vendor_name,
    isActive: row.is_active,
    autoProcessASN: row.auto_process_asn,
    autoCreateAssets: row.auto_create_assets,
    defaultStockroomId: row.default_stockroom_id ?? undefined,
    webhookUrl: row.webhook_url ?? undefined,
    apiEndpoint: row.api_endpoint ?? undefined,
    lastSyncAt: row.last_sync_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================================
// ASN Operations
// ============================================================================

/**
 * Create a new ASN record
 */
export async function createASN(
  asn: Omit<AdvanceShipNotice, 'asnId' | 'lines' | 'createdAt' | 'updatedAt'>
): Promise<AdvanceShipNotice> {
  logger.info('Creating ASN record', {
    vendorType: asn.vendorType,
    vendorAsnNumber: asn.vendorAsnNumber,
    purchaseOrderNumber: asn.purchaseOrderNumber,
  });

  const result = await queryOne<ASNRow>(
    `INSERT INTO vendor_asns (
      vendor_type, vendor_name, vendor_asn_number, purchase_order_number,
      purchase_order_id, ship_date, expected_delivery_date, carrier_name,
      tracking_number, ship_from_address, ship_to_address, status,
      total_items, processed_items, failed_items, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *`,
    [
      asn.vendorType,
      asn.vendorName,
      asn.vendorAsnNumber,
      asn.purchaseOrderNumber,
      asn.purchaseOrderId ?? null,
      asn.shipDate,
      asn.expectedDeliveryDate,
      asn.carrierName ?? null,
      asn.trackingNumber ?? null,
      asn.shipFromAddress ? JSON.stringify(asn.shipFromAddress) : null,
      asn.shipToAddress ? JSON.stringify(asn.shipToAddress) : null,
      asn.status,
      asn.totalItems,
      asn.processedItems,
      asn.failedItems,
      asn.rawData ? JSON.stringify(asn.rawData) : null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create ASN record');
  }

  return mapRowToASN(result);
}

/**
 * Create ASN line item
 */
export async function createASNLine(
  line: Omit<ASNLineItem, 'lineId' | 'createdAt' | 'updatedAt'>
): Promise<ASNLineItem> {
  const result = await queryOne<ASNLineRow>(
    `INSERT INTO vendor_asn_lines (
      asn_id, line_number, vendor_part_number, manufacturer_part_number,
      description, quantity, serial_numbers, manufacturer, model,
      unit_price, status, created_asset_ids, linked_asset_ids
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      line.asnId,
      line.lineNumber,
      line.vendorPartNumber,
      line.manufacturerPartNumber ?? null,
      line.description,
      line.quantity,
      JSON.stringify(line.serialNumbers),
      line.manufacturer ?? null,
      line.model ?? null,
      line.unitPrice ?? null,
      line.status,
      JSON.stringify(line.createdAssetIds),
      JSON.stringify(line.linkedAssetIds),
    ]
  );

  if (!result) {
    throw new Error('Failed to create ASN line');
  }

  return mapRowToASNLine(result);
}

/**
 * Get ASN by ID with lines
 */
export async function getASNById(asnId: UUID): Promise<AdvanceShipNotice | null> {
  const asnRow = await queryOne<ASNRow>(
    `SELECT * FROM vendor_asns WHERE asn_id = $1`,
    [asnId]
  );

  if (!asnRow) {
    return null;
  }

  const lineRows = await queryMany<ASNLineRow>(
    `SELECT * FROM vendor_asn_lines WHERE asn_id = $1 ORDER BY line_number`,
    [asnId]
  );

  const lines = lineRows.map(mapRowToASNLine);
  return mapRowToASN(asnRow, lines);
}

/**
 * Find ASN by vendor ASN number
 */
export async function findASNByVendorNumber(
  vendorType: VendorType,
  vendorAsnNumber: string
): Promise<AdvanceShipNotice | null> {
  const asnRow = await queryOne<ASNRow>(
    `SELECT * FROM vendor_asns WHERE vendor_type = $1 AND vendor_asn_number = $2`,
    [vendorType, vendorAsnNumber]
  );

  if (!asnRow) {
    return null;
  }

  const lineRows = await queryMany<ASNLineRow>(
    `SELECT * FROM vendor_asn_lines WHERE asn_id = $1 ORDER BY line_number`,
    [asnRow.asn_id]
  );

  const lines = lineRows.map(mapRowToASNLine);
  return mapRowToASN(asnRow, lines);
}

/**
 * Update ASN status
 */
export async function updateASNStatus(
  asnId: UUID,
  status: ASNStatus,
  processedItems: number,
  failedItems: number,
  errorMessage?: string
): Promise<void> {
  logger.info('Updating ASN status', { asnId, status, processedItems, failedItems });

  await queryOne(
    `UPDATE vendor_asns SET
      status = $2, processed_items = $3, failed_items = $4,
      processed_at = CASE WHEN $2 IN ('COMPLETED', 'PARTIAL', 'FAILED') THEN NOW() ELSE processed_at END,
      error_message = $5, updated_at = NOW()
     WHERE asn_id = $1`,
    [asnId, status, processedItems, failedItems, errorMessage ?? null]
  );
}

/**
 * Update ASN line status
 */
export async function updateASNLineStatus(
  lineId: UUID,
  status: ASNLineStatus,
  createdAssetIds: UUID[],
  linkedAssetIds: UUID[],
  errorMessage?: string
): Promise<void> {
  await queryOne(
    `UPDATE vendor_asn_lines SET
      status = $2, created_asset_ids = $3, linked_asset_ids = $4,
      error_message = $5, updated_at = NOW()
     WHERE line_id = $1`,
    [lineId, status, JSON.stringify(createdAssetIds), JSON.stringify(linkedAssetIds), errorMessage ?? null]
  );
}

/**
 * Get ASNs by vendor type
 */
export async function getASNsByVendor(
  vendorType: VendorType,
  limit = 100
): Promise<AdvanceShipNotice[]> {
  const rows = await queryMany<ASNRow>(
    `SELECT * FROM vendor_asns WHERE vendor_type = $1 ORDER BY created_at DESC LIMIT $2`,
    [vendorType, limit]
  );

  return rows.map(row => mapRowToASN(row));
}

/**
 * Get pending ASNs for processing
 */
export async function getPendingASNs(limit = 50): Promise<AdvanceShipNotice[]> {
  const rows = await queryMany<ASNRow>(
    `SELECT * FROM vendor_asns WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );

  // Load lines for each ASN
  const asns: AdvanceShipNotice[] = [];
  for (const row of rows) {
    const lineRows = await queryMany<ASNLineRow>(
      `SELECT * FROM vendor_asn_lines WHERE asn_id = $1 ORDER BY line_number`,
      [row.asn_id]
    );
    const lines = lineRows.map(mapRowToASNLine);
    asns.push(mapRowToASN(row, lines));
  }

  return asns;
}

// ============================================================================
// Pre-Created Asset Operations
// ============================================================================

/**
 * Generate a unique asset tag
 */
async function generateAssetTag(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AMS-HW-${dateStr}-${random}`;
}

/**
 * Pre-create a hardware asset from ASN data
 * Requirement 7.6: Pre-create asset records with serial numbers before physical arrival
 */
export async function preCreateAssetFromASN(
  serialNumber: string,
  asnId: UUID,
  asnLineId: UUID,
  purchaseOrderId: UUID | undefined,
  vendorType: VendorType,
  manufacturer: string | undefined,
  model: string | undefined,
  description: string,
  expectedDeliveryDate: string
): Promise<PreCreatedAsset> {
  logger.info('Pre-creating asset from ASN', {
    serialNumber,
    asnId,
    vendorType,
    manufacturer,
    model,
  });

  const assetTag = await generateAssetTag();

  // Create base asset record with ORDERED status
  const assetResult = await queryOne<{ asset_id: string }>(
    `INSERT INTO assets (
      asset_tag, asset_type, display_name, description, status, created_at, updated_at
    ) VALUES ($1, 'HARDWARE', $2, $3, 'ORDERED', NOW(), NOW())
    RETURNING asset_id`,
    [assetTag, description, `Pre-created from ASN: ${description}`]
  );

  if (!assetResult) {
    throw new Error('Failed to create base asset record');
  }

  const assetId = assetResult.asset_id;

  // Create hardware asset record
  await queryOne(
    `INSERT INTO hardware_assets (
      asset_id, serial_number, manufacturer, model, purchase_order_id, vendor_id
    ) VALUES ($1, $2, $3, $4, $5, NULL)`,
    [assetId, serialNumber, manufacturer ?? null, model ?? null, purchaseOrderId ?? null]
  );

  // Record the pre-creation in ASN tracking table
  await queryOne(
    `INSERT INTO vendor_asn_assets (
      asset_id, asn_id, asn_line_id, serial_number, vendor_type,
      expected_delivery_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'ORDERED')`,
    [assetId, asnId, asnLineId, serialNumber, vendorType, expectedDeliveryDate]
  );

  logger.info('Asset pre-created from ASN', { assetId, assetTag, serialNumber });

  return {
    assetId,
    assetTag,
    serialNumber,
    asnId,
    asnLineId,
    purchaseOrderId,
    vendorType,
    manufacturer,
    model,
    description,
    expectedDeliveryDate,
    status: 'ORDERED',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Find existing asset by serial number
 */
export async function findAssetBySerialNumber(
  serialNumber: string
): Promise<{ assetId: UUID; assetTag: string } | null> {
  const result = await queryOne<{ asset_id: string; asset_tag: string }>(
    `SELECT a.asset_id, a.asset_tag
     FROM assets a
     JOIN hardware_assets ha ON a.asset_id = ha.asset_id
     WHERE UPPER(TRIM(ha.serial_number)) = UPPER(TRIM($1))`,
    [serialNumber]
  );

  return result ? { assetId: result.asset_id, assetTag: result.asset_tag } : null;
}

/**
 * Link purchase order to ASN
 */
export async function linkPurchaseOrderToASN(
  asnId: UUID,
  purchaseOrderId: UUID
): Promise<void> {
  await queryOne(
    `UPDATE vendor_asns SET purchase_order_id = $2, updated_at = NOW() WHERE asn_id = $1`,
    [asnId, purchaseOrderId]
  );
}

/**
 * Find purchase order by PO number
 */
export async function findPurchaseOrderByNumber(
  poNumber: string
): Promise<{ poId: UUID; vendorId?: UUID } | null> {
  const result = await queryOne<{ po_id: string; vendor_id: string | null }>(
    `SELECT po_id, vendor_id FROM purchase_orders WHERE po_number = $1`,
    [poNumber]
  );

  return result ? { poId: result.po_id, vendorId: result.vendor_id ?? undefined } : null;
}

// ============================================================================
// Vendor Catalog Operations
// ============================================================================

/**
 * Get vendor catalog items
 */
export async function getVendorCatalogItems(
  request: VendorCatalogSearchRequest
): Promise<{ items: VendorCatalogItem[]; totalCount: number }> {
  const page = request.page ?? 1;
  const limit = Math.min(request.limit ?? 50, 100);
  const offset = (page - 1) * limit;

  let whereClause = '1=1';
  const params: (string | number | VendorType | CatalogItemAvailability)[] = [];
  let paramIndex = 1;

  if (request.vendorType) {
    whereClause += ` AND vendor_type = $${paramIndex}`;
    params.push(request.vendorType);
    paramIndex++;
  }

  if (request.searchTerm) {
    whereClause += ` AND (
      description ILIKE $${paramIndex} OR
      manufacturer ILIKE $${paramIndex} OR
      model ILIKE $${paramIndex} OR
      vendor_part_number ILIKE $${paramIndex}
    )`;
    params.push(`%${request.searchTerm}%`);
    paramIndex++;
  }

  if (request.category) {
    whereClause += ` AND category = $${paramIndex}`;
    params.push(request.category);
    paramIndex++;
  }

  if (request.manufacturer) {
    whereClause += ` AND manufacturer ILIKE $${paramIndex}`;
    params.push(`%${request.manufacturer}%`);
    paramIndex++;
  }

  if (request.minPrice !== undefined) {
    whereClause += ` AND unit_price >= $${paramIndex}`;
    params.push(request.minPrice);
    paramIndex++;
  }

  if (request.maxPrice !== undefined) {
    whereClause += ` AND unit_price <= $${paramIndex}`;
    params.push(request.maxPrice);
    paramIndex++;
  }

  if (request.availability) {
    whereClause += ` AND availability = $${paramIndex}`;
    params.push(request.availability);
    paramIndex++;
  }

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM vendor_catalog_items WHERE ${whereClause}`,
    params
  );
  const totalCount = parseInt(countResult?.count ?? '0', 10);

  // Get items
  const rows = await queryMany<VendorCatalogItemRow>(
    `SELECT * FROM vendor_catalog_items
     WHERE ${whereClause}
     ORDER BY manufacturer, model
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  return {
    items: rows.map(mapRowToCatalogItem),
    totalCount,
  };
}

/**
 * Get vendor catalog categories
 */
export async function getVendorCatalogCategories(
  vendorType?: VendorType
): Promise<string[]> {
  let query = `SELECT DISTINCT category FROM vendor_catalog_items`;
  const params: VendorType[] = [];

  if (vendorType) {
    query += ` WHERE vendor_type = $1`;
    params.push(vendorType);
  }

  query += ` ORDER BY category`;

  const rows = await queryMany<{ category: string }>(query, params);
  return rows.map(r => r.category);
}

/**
 * Upsert vendor catalog item
 */
export async function upsertVendorCatalogItem(
  item: Omit<VendorCatalogItem, 'catalogItemId' | 'createdAt'>
): Promise<VendorCatalogItem> {
  const existing = await queryOne<VendorCatalogItemRow>(
    `SELECT * FROM vendor_catalog_items
     WHERE vendor_type = $1 AND vendor_part_number = $2`,
    [item.vendorType, item.vendorPartNumber]
  );

  if (existing) {
    // Update existing
    const result = await queryOne<VendorCatalogItemRow>(
      `UPDATE vendor_catalog_items SET
        manufacturer_part_number = $3, manufacturer = $4, model = $5,
        description = $6, category = $7, subcategory = $8, unit_price = $9,
        currency = $10, availability = $11, lead_time_days = $12,
        minimum_order_quantity = $13, specifications = $14, image_url = $15,
        product_url = $16, last_updated_at = NOW()
       WHERE vendor_type = $1 AND vendor_part_number = $2
       RETURNING *`,
      [
        item.vendorType,
        item.vendorPartNumber,
        item.manufacturerPartNumber ?? null,
        item.manufacturer,
        item.model,
        item.description,
        item.category,
        item.subcategory ?? null,
        item.unitPrice,
        item.currency,
        item.availability,
        item.leadTimeDays ?? null,
        item.minimumOrderQuantity ?? null,
        item.specifications ? JSON.stringify(item.specifications) : null,
        item.imageUrl ?? null,
        item.productUrl ?? null,
      ]
    );

    if (!result) {
      throw new Error('Failed to update vendor catalog item');
    }

    return mapRowToCatalogItem(result);
  }

  // Insert new
  const result = await queryOne<VendorCatalogItemRow>(
    `INSERT INTO vendor_catalog_items (
      vendor_type, vendor_part_number, manufacturer_part_number, manufacturer,
      model, description, category, subcategory, unit_price, currency,
      availability, lead_time_days, minimum_order_quantity, specifications,
      image_url, product_url, last_updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
    RETURNING *`,
    [
      item.vendorType,
      item.vendorPartNumber,
      item.manufacturerPartNumber ?? null,
      item.manufacturer,
      item.model,
      item.description,
      item.category,
      item.subcategory ?? null,
      item.unitPrice,
      item.currency,
      item.availability,
      item.leadTimeDays ?? null,
      item.minimumOrderQuantity ?? null,
      item.specifications ? JSON.stringify(item.specifications) : null,
      item.imageUrl ?? null,
      item.productUrl ?? null,
    ]
  );

  if (!result) {
    throw new Error('Failed to create vendor catalog item');
  }

  return mapRowToCatalogItem(result);
}

// ============================================================================
// Vendor Configuration Operations
// ============================================================================

/**
 * Get vendor integration configuration
 */
export async function getVendorConfig(
  vendorType: VendorType
): Promise<VendorIntegrationConfig | null> {
  const result = await queryOne<VendorConfigRow>(
    `SELECT * FROM vendor_integration_configs WHERE vendor_type = $1 AND is_active = true`,
    [vendorType]
  );

  return result ? mapRowToVendorConfig(result) : null;
}

/**
 * Update vendor last sync timestamp
 */
export async function updateVendorLastSync(vendorType: VendorType): Promise<void> {
  await queryOne(
    `UPDATE vendor_integration_configs SET last_sync_at = NOW(), updated_at = NOW() WHERE vendor_type = $1`,
    [vendorType]
  );
}

/**
 * Get ASN statistics by vendor
 */
export async function getASNStatistics(
  vendorType?: VendorType
): Promise<{
  total: number;
  pending: number;
  completed: number;
  failed: number;
  assetsCreated: number;
}> {
  let query = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
      SUM(processed_items) as assets_created
    FROM vendor_asns
  `;
  const params: VendorType[] = [];

  if (vendorType) {
    query += ` WHERE vendor_type = $1`;
    params.push(vendorType);
  }

  const result = await queryOne<{
    total: string;
    pending: string;
    completed: string;
    failed: string;
    assets_created: string | null;
  }>(query, params);

  return {
    total: parseInt(result?.total ?? '0', 10),
    pending: parseInt(result?.pending ?? '0', 10),
    completed: parseInt(result?.completed ?? '0', 10),
    failed: parseInt(result?.failed ?? '0', 10),
    assetsCreated: parseInt(result?.assets_created ?? '0', 10),
  };
}

