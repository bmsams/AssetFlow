/**
 * Asset Repository - Data access layer for assets
 *
 * Implements CRUD operations for assets with:
 * - Asset tag generation with uniqueness guarantee (Requirement 2.6)
 * - Audit logging via database triggers (Requirement 2.7)
 */

import type {
  Asset,
  AssetSearchQuery,
  AssetStatus,
  AssetType,
  CreateAssetRequest,
  PaginatedResult,
  PaginationParams,
  UpdateAssetRequest,
  UUID,
} from '@ams/types';
import { query, queryMany, queryOne, withTransaction } from '@ams/database';
import type { TransactionContext } from '@ams/database';
import { createLogger, generateAssetTag, now } from '@ams/utils';

const logger = createLogger({ service: 'asset-repository' });

/**
 * Maximum retry attempts for asset tag generation
 */
const MAX_TAG_GENERATION_RETRIES = 5;

/**
 * Database row type for assets
 */
interface AssetRow {
  asset_id: string;
  asset_tag: string;
  asset_type: AssetType;
  display_name: string;
  description: string | null;
  status: AssetStatus;
  substatus: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * Map database row to Asset entity
 */
function mapRowToAsset(row: AssetRow): Asset {
  return {
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    assetType: row.asset_type,
    displayName: row.display_name,
    description: row.description ?? undefined,
    status: row.status,
    substatus: row.substatus ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by ?? undefined,
    updatedBy: row.updated_by ?? undefined,
  };
}

type AssetAttributes = Record<string, unknown>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasAttribute(attributes: AssetAttributes, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(attributes, key);
}

function asAttributes(value: unknown): AssetAttributes {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as AssetAttributes;
  }
  return {};
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toUuidOrNull(value: unknown): UUID | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed as UUID;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIntegerOrNull(value: unknown): number | null {
  const numeric = toNumberOrNull(value);
  if (numeric === null) {
    return null;
  }
  return Number.isInteger(numeric) ? numeric : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return null;
}

function toDateStringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

function isUndefinedTableError(error: unknown): boolean {
  const pgError = error as { code?: string; message?: string };
  return pgError.code === '42P01' || pgError.message?.includes('does not exist') === true;
}

async function resolveBuildingLabel(
  ctx: TransactionContext,
  attributes: AssetAttributes
): Promise<string | null> {
  const buildingId = toUuidOrNull(attributes['buildingId']);
  if (buildingId) {
    const row = await ctx.queryOne<{ building_code: string | null; name: string }>(
      'SELECT building_code, name FROM buildings WHERE building_id = $1',
      [buildingId]
    );
    if (row) {
      return row.building_code ?? row.name;
    }
  }

  return toStringOrNull(attributes['building']);
}

async function resolveManufacturerId(
  ctx: TransactionContext,
  attributes: AssetAttributes
): Promise<UUID | null> {
  const byId = toUuidOrNull(attributes['manufacturerId']);
  if (byId) {
    return byId;
  }

  const byName = toStringOrNull(attributes['manufacturer']);
  if (!byName) {
    return null;
  }

  const row = await ctx.queryOne<{ manufacturer_id: UUID }>(
    `SELECT manufacturer_id
     FROM manufacturers
     WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
     ORDER BY is_active DESC, created_at DESC
     LIMIT 1`,
    [byName]
  );

  return row?.manufacturer_id ?? null;
}

async function resolveModelId(
  ctx: TransactionContext,
  attributes: AssetAttributes,
  manufacturerId: UUID | null
): Promise<UUID | null> {
  const byId = toUuidOrNull(attributes['modelId']);
  if (byId) {
    return byId;
  }

  const modelName = toStringOrNull(attributes['model']);
  if (!modelName) {
    return null;
  }

  const row = await ctx.queryOne<{ model_id: UUID }>(
    `SELECT model_id
     FROM models
     WHERE LOWER(TRIM(model_name)) = LOWER(TRIM($1))
       AND ($2::uuid IS NULL OR manufacturer_id = $2)
     ORDER BY is_active DESC, created_at DESC
     LIMIT 1`,
    [modelName, manufacturerId]
  );

  return row?.model_id ?? null;
}

async function resolveSoftwareProductId(
  ctx: TransactionContext,
  attributes: AssetAttributes,
  dbUserId: UUID | null,
  timestamp: string
): Promise<UUID | null> {
  const byId = toUuidOrNull(attributes['softwareProductId']);
  if (byId) {
    return byId;
  }

  const publisher = toStringOrNull(attributes['publisher']);
  const productName = toStringOrNull(attributes['productName']);
  if (!publisher || !productName) {
    return null;
  }

  const version = toStringOrNull(attributes['version']);
  const edition = toStringOrNull(attributes['edition']);
  const isSaas = toBooleanOrNull(attributes['isSaas']) ?? false;
  const normalizedPublisher = publisher.toLowerCase();
  const normalizedProductName = productName.toLowerCase();
  const normalizationKey = `${normalizedPublisher}|${normalizedProductName}|${(version ?? '').toLowerCase()}|${(edition ?? '').toLowerCase()}`;

  const existing = await ctx.queryOne<{ product_id: UUID }>(
    `SELECT product_id
     FROM software_products
     WHERE LOWER(TRIM(publisher)) = LOWER(TRIM($1))
       AND LOWER(TRIM(product_name)) = LOWER(TRIM($2))
       AND COALESCE(version, '') = COALESCE($3, '')
       AND COALESCE(edition, '') = COALESCE($4, '')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [publisher, productName, version, edition]
  );

  if (existing) {
    return existing.product_id;
  }

  const inserted = await ctx.queryOne<{ product_id: UUID }>(
    `INSERT INTO software_products (
      publisher,
      product_name,
      version,
      edition,
      is_saas,
      normalization_key,
      normalized_publisher,
      normalized_product_name,
      created_at,
      updated_at,
      created_by,
      updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $10)
    RETURNING product_id`,
    [
      publisher,
      productName,
      version,
      edition,
      isSaas,
      normalizationKey,
      normalizedPublisher,
      normalizedProductName,
      timestamp,
      dbUserId,
    ]
  );

  return inserted?.product_id ?? null;
}

async function upsertHardwareAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes
): Promise<void> {
  await ctx.queryOne(
    'INSERT INTO hardware_assets (asset_id) VALUES ($1) ON CONFLICT (asset_id) DO NOTHING',
    [assetId]
  );

  const building = await resolveBuildingLabel(ctx, attributes);
  const manufacturerId = await resolveManufacturerId(ctx, attributes);
  const modelId = await resolveModelId(ctx, attributes, manufacturerId);

  await ctx.queryOne(
    `UPDATE hardware_assets
     SET serial_number = $1,
         manufacturer_id = $2,
         model_id = $3,
         model_category = $4,
         stockroom_id = $5,
         building = $6,
         floor = $7,
         room = $8,
         rack = $9,
         rack_unit = $10,
         assigned_to = $11,
         department_id = $12,
         cost_center_id = $13,
         purchase_price = $14,
         warranty_expiration = $15,
         cpu = $16,
         memory_gb = $17,
         storage_gb = $18,
         operating_system = $19,
         ip_address = $20,
         mac_address = $21
     WHERE asset_id = $22`,
    [
      toStringOrNull(attributes['serialNumber']),
      manufacturerId,
      modelId,
      toStringOrNull(attributes['modelCategory']),
      toUuidOrNull(attributes['stockroomId']),
      building,
      toStringOrNull(attributes['floor']),
      toStringOrNull(attributes['room']),
      toStringOrNull(attributes['rack']),
      toIntegerOrNull(attributes['rackUnit']),
      toUuidOrNull(attributes['assignedTo']),
      toUuidOrNull(attributes['departmentId']),
      toUuidOrNull(attributes['costCenterId']),
      toNumberOrNull(attributes['purchasePrice']),
      toDateStringOrNull(attributes['warrantyExpiration']),
      toStringOrNull(attributes['cpu']),
      toIntegerOrNull(attributes['memoryGb']),
      toIntegerOrNull(attributes['storageGb']),
      toStringOrNull(attributes['operatingSystem']),
      toStringOrNull(attributes['ipAddress']),
      toStringOrNull(attributes['macAddress']),
      assetId,
    ]
  );
}

async function patchHardwareAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const push = (column: string, value: unknown): void => {
    updates.push(`${column} = $${paramIndex++}`);
    values.push(value);
  };

  if (hasAttribute(attributes, 'serialNumber')) push('serial_number', toStringOrNull(attributes['serialNumber']));
  if (hasAttribute(attributes, 'modelCategory')) push('model_category', toStringOrNull(attributes['modelCategory']));
  if (hasAttribute(attributes, 'stockroomId')) push('stockroom_id', toUuidOrNull(attributes['stockroomId']));
  if (hasAttribute(attributes, 'floor')) push('floor', toStringOrNull(attributes['floor']));
  if (hasAttribute(attributes, 'room')) push('room', toStringOrNull(attributes['room']));
  if (hasAttribute(attributes, 'rack')) push('rack', toStringOrNull(attributes['rack']));
  if (hasAttribute(attributes, 'rackUnit')) push('rack_unit', toIntegerOrNull(attributes['rackUnit']));
  if (hasAttribute(attributes, 'assignedTo')) push('assigned_to', toUuidOrNull(attributes['assignedTo']));
  if (hasAttribute(attributes, 'departmentId')) push('department_id', toUuidOrNull(attributes['departmentId']));
  if (hasAttribute(attributes, 'costCenterId')) push('cost_center_id', toUuidOrNull(attributes['costCenterId']));
  if (hasAttribute(attributes, 'purchasePrice')) push('purchase_price', toNumberOrNull(attributes['purchasePrice']));
  if (hasAttribute(attributes, 'warrantyExpiration')) push('warranty_expiration', toDateStringOrNull(attributes['warrantyExpiration']));
  if (hasAttribute(attributes, 'cpu')) push('cpu', toStringOrNull(attributes['cpu']));
  if (hasAttribute(attributes, 'memoryGb')) push('memory_gb', toIntegerOrNull(attributes['memoryGb']));
  if (hasAttribute(attributes, 'storageGb')) push('storage_gb', toIntegerOrNull(attributes['storageGb']));
  if (hasAttribute(attributes, 'operatingSystem')) push('operating_system', toStringOrNull(attributes['operatingSystem']));
  if (hasAttribute(attributes, 'ipAddress')) push('ip_address', toStringOrNull(attributes['ipAddress']));
  if (hasAttribute(attributes, 'macAddress')) push('mac_address', toStringOrNull(attributes['macAddress']));

  if (hasAttribute(attributes, 'buildingId') || hasAttribute(attributes, 'building')) {
    push('building', await resolveBuildingLabel(ctx, attributes));
  }

  if (hasAttribute(attributes, 'manufacturerId') || hasAttribute(attributes, 'manufacturer')) {
    push('manufacturer_id', await resolveManufacturerId(ctx, attributes));
  }

  if (
    hasAttribute(attributes, 'modelId') ||
    hasAttribute(attributes, 'model') ||
    hasAttribute(attributes, 'manufacturerId') ||
    hasAttribute(attributes, 'manufacturer')
  ) {
    const manufacturerId = await resolveManufacturerId(ctx, attributes);
    push('model_id', await resolveModelId(ctx, attributes, manufacturerId));
  }

  if (updates.length === 0) {
    return;
  }

  values.push(assetId);
  await ctx.queryOne(
    `UPDATE hardware_assets
     SET ${updates.join(', ')}
     WHERE asset_id = $${paramIndex}`,
    values
  );
}

async function upsertSoftwareAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes,
  dbUserId: UUID | null,
  timestamp: string
): Promise<void> {
  const softwareProductId = await resolveSoftwareProductId(ctx, attributes, dbUserId, timestamp);

  await ctx.queryOne(
    `INSERT INTO software_assets (
      asset_id,
      software_product_id,
      acquisition_date,
      purchase_cost,
      license_key,
      vendor_id,
      created_at,
      updated_at,
      created_by,
      updated_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $8)
    ON CONFLICT (asset_id) DO UPDATE
    SET software_product_id = EXCLUDED.software_product_id,
        acquisition_date = EXCLUDED.acquisition_date,
        purchase_cost = EXCLUDED.purchase_cost,
        license_key = EXCLUDED.license_key,
        vendor_id = EXCLUDED.vendor_id,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by`,
    [
      assetId,
      softwareProductId,
      toDateStringOrNull(attributes['acquisitionDate']),
      toNumberOrNull(attributes['purchasePrice']) ?? 0,
      toStringOrNull(attributes['licenseKey']),
      toUuidOrNull(attributes['vendorId']),
      timestamp,
      dbUserId,
    ]
  );
}

async function patchSoftwareAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes,
  dbUserId: UUID | null,
  timestamp: string
): Promise<void> {
  await ctx.queryOne(
    `INSERT INTO software_assets (asset_id, purchase_cost, created_at, updated_at, created_by, updated_by)
     VALUES ($1, 0, $2, $2, $3, $3)
     ON CONFLICT (asset_id) DO NOTHING`,
    [assetId, timestamp, dbUserId]
  );

  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  const push = (column: string, value: unknown): void => {
    updates.push(`${column} = $${paramIndex++}`);
    values.push(value);
  };

  if (
    hasAttribute(attributes, 'softwareProductId') ||
    hasAttribute(attributes, 'publisher') ||
    hasAttribute(attributes, 'productName') ||
    hasAttribute(attributes, 'version') ||
    hasAttribute(attributes, 'edition') ||
    hasAttribute(attributes, 'isSaas')
  ) {
    push(
      'software_product_id',
      await resolveSoftwareProductId(ctx, attributes, dbUserId, timestamp)
    );
  }

  if (hasAttribute(attributes, 'acquisitionDate')) {
    push('acquisition_date', toDateStringOrNull(attributes['acquisitionDate']));
  }

  if (hasAttribute(attributes, 'purchasePrice')) {
    push('purchase_cost', toNumberOrNull(attributes['purchasePrice']) ?? 0);
  }

  if (hasAttribute(attributes, 'licenseKey')) {
    push('license_key', toStringOrNull(attributes['licenseKey']));
  }

  if (hasAttribute(attributes, 'vendorId')) {
    push('vendor_id', toUuidOrNull(attributes['vendorId']));
  }

  if (updates.length === 0) {
    return;
  }

  push('updated_at', timestamp);
  push('updated_by', dbUserId);

  values.push(assetId);
  await ctx.queryOne(
    `UPDATE software_assets
     SET ${updates.join(', ')}
     WHERE asset_id = $${paramIndex}`,
    values
  );
}

async function upsertEnterpriseAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes
): Promise<void> {
  await ctx.queryOne(
    'INSERT INTO enterprise_assets (asset_id) VALUES ($1) ON CONFLICT (asset_id) DO NOTHING',
    [assetId]
  );

  const building = await resolveBuildingLabel(ctx, attributes);

  await ctx.queryOne(
    `UPDATE enterprise_assets
     SET serial_number = $1,
         manufacturer = $2,
         model = $3,
         asset_class = $4,
         criticality_level = $5,
         facility_id = $6,
         building = $7,
         floor = $8,
         zone = $9,
         operating_hours = COALESCE($10, operating_hours),
         meter_reading = $11
     WHERE asset_id = $12`,
    [
      toStringOrNull(attributes['serialNumber']),
      toStringOrNull(attributes['manufacturer']),
      toStringOrNull(attributes['model']),
      toStringOrNull(attributes['assetClass']),
      toStringOrNull(attributes['criticalityLevel']),
      toUuidOrNull(attributes['facilityId']),
      building,
      toStringOrNull(attributes['floor']),
      toStringOrNull(attributes['zone']),
      toIntegerOrNull(attributes['operatingHours']),
      toNumberOrNull(attributes['meterReading']),
      assetId,
    ]
  );
}

async function patchEnterpriseAttributes(
  ctx: TransactionContext,
  assetId: UUID,
  attributes: AssetAttributes
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  const push = (column: string, value: unknown): void => {
    updates.push(`${column} = $${paramIndex++}`);
    values.push(value);
  };

  if (hasAttribute(attributes, 'serialNumber')) push('serial_number', toStringOrNull(attributes['serialNumber']));
  if (hasAttribute(attributes, 'manufacturer')) push('manufacturer', toStringOrNull(attributes['manufacturer']));
  if (hasAttribute(attributes, 'model')) push('model', toStringOrNull(attributes['model']));
  if (hasAttribute(attributes, 'assetClass')) push('asset_class', toStringOrNull(attributes['assetClass']));
  if (hasAttribute(attributes, 'criticalityLevel')) push('criticality_level', toStringOrNull(attributes['criticalityLevel']));
  if (hasAttribute(attributes, 'facilityId')) push('facility_id', toUuidOrNull(attributes['facilityId']));
  if (hasAttribute(attributes, 'floor')) push('floor', toStringOrNull(attributes['floor']));
  if (hasAttribute(attributes, 'zone')) push('zone', toStringOrNull(attributes['zone']));
  if (hasAttribute(attributes, 'operatingHours')) push('operating_hours', toIntegerOrNull(attributes['operatingHours']) ?? 0);
  if (hasAttribute(attributes, 'meterReading')) push('meter_reading', toNumberOrNull(attributes['meterReading']));

  if (hasAttribute(attributes, 'buildingId') || hasAttribute(attributes, 'building')) {
    push('building', await resolveBuildingLabel(ctx, attributes));
  }

  if (updates.length === 0) {
    return;
  }

  values.push(assetId);
  await ctx.queryOne(
    `UPDATE enterprise_assets
     SET ${updates.join(', ')}
     WHERE asset_id = $${paramIndex}`,
    values
  );
}

async function insertSubtypeAttributes(
  ctx: TransactionContext,
  asset: Pick<AssetRow, 'asset_id' | 'asset_type'>,
  request: CreateAssetRequest,
  dbUserId: UUID | null,
  timestamp: string
): Promise<void> {
  const attributes = asAttributes(request.attributes);

  if (asset.asset_type === 'HARDWARE') {
    await upsertHardwareAttributes(ctx, asset.asset_id as UUID, attributes);
    return;
  }

  if (asset.asset_type === 'SOFTWARE') {
    try {
      await upsertSoftwareAttributes(ctx, asset.asset_id as UUID, attributes, dbUserId, timestamp);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        logger.warn('Skipping software subtype persistence: software_assets table missing');
      } else {
        throw error;
      }
    }
    return;
  }

  if (asset.asset_type === 'ENTERPRISE') {
    await upsertEnterpriseAttributes(ctx, asset.asset_id as UUID, attributes);
  }
}

async function patchSubtypeAttributes(
  ctx: TransactionContext,
  asset: Pick<AssetRow, 'asset_id' | 'asset_type'>,
  request: UpdateAssetRequest,
  dbUserId: UUID | null,
  timestamp: string
): Promise<void> {
  const attributes = asAttributes(request.attributes);
  if (Object.keys(attributes).length === 0) {
    return;
  }

  if (asset.asset_type === 'HARDWARE') {
    await ctx.queryOne(
      'INSERT INTO hardware_assets (asset_id) VALUES ($1) ON CONFLICT (asset_id) DO NOTHING',
      [asset.asset_id]
    );
    await patchHardwareAttributes(ctx, asset.asset_id as UUID, attributes);
    return;
  }

  if (asset.asset_type === 'SOFTWARE') {
    try {
      await patchSoftwareAttributes(ctx, asset.asset_id as UUID, attributes, dbUserId, timestamp);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        logger.warn('Skipping software subtype patch: software_assets table missing');
      } else {
        throw error;
      }
    }
    return;
  }

  if (asset.asset_type === 'ENTERPRISE') {
    await ctx.queryOne(
      'INSERT INTO enterprise_assets (asset_id) VALUES ($1) ON CONFLICT (asset_id) DO NOTHING',
      [asset.asset_id]
    );
    await patchEnterpriseAttributes(ctx, asset.asset_id as UUID, attributes);
  }
}


/**
 * Generate a unique asset tag with retry mechanism
 * Ensures uniqueness by checking against existing tags and retrying if collision occurs
 *
 * @param assetType - The type of asset
 * @returns A unique asset tag string
 * @throws Error if unable to generate unique tag after max retries
 */
async function generateUniqueAssetTag(assetType: AssetType): Promise<string> {
  for (let attempt = 0; attempt < MAX_TAG_GENERATION_RETRIES; attempt++) {
    const tag = generateAssetTag(assetType);

    // Check if tag already exists
    const exists = await assetTagExists(tag);
    if (!exists) {
      logger.debug('Generated unique asset tag', { tag, attempt: attempt + 1 });
      return tag;
    }

    logger.warn('Asset tag collision detected, retrying', { tag, attempt: attempt + 1 });
  }

  // If we've exhausted retries, throw an error
  throw new Error(
    'Failed to generate unique asset tag after ' + MAX_TAG_GENERATION_RETRIES + ' attempts'
  );
}

/**
 * Resolve a Cognito sub to a database user_id.
 * Returns null if the user doesn't exist in the users table.
 */
export async function resolveUserId(cognitoSub: string): Promise<UUID | null> {
  const result = await queryOne<{ user_id: UUID }>(
    'SELECT user_id FROM users WHERE cognito_sub = $1',
    [cognitoSub]
  );
  return result?.user_id ?? null;
}

/**
 * Create a new asset with unique tag guarantee
 *
 * Implements Requirement 2.6: Generate unique asset tag and barcode identifier
 * Audit logging is handled automatically by database triggers (Requirement 2.7)
 */
export async function createAsset(
  request: CreateAssetRequest,
  userId?: UUID
): Promise<Asset> {
  // Generate unique asset tag with retry mechanism
  const assetTag = await generateUniqueAssetTag(request.assetType);
  const timestamp = now();

  // If userId is a Cognito sub, resolve to database user_id
  let dbUserId: UUID | null = null;
  if (userId) {
    dbUserId = await resolveUserId(userId);
  }

  const result = await withTransaction(async (ctx) => {
    const createdAsset = await ctx.queryOne<AssetRow>(
      'INSERT INTO assets (asset_tag, asset_type, display_name, description, status, created_at, updated_at, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7) RETURNING *',
      [
        assetTag,
        request.assetType,
        request.displayName,
        request.description ?? null,
        request.status ?? 'ORDERED',
        timestamp,
        dbUserId,
      ]
    );

    if (!createdAsset) {
      throw new Error('Failed to create asset');
    }

    await insertSubtypeAttributes(
      ctx,
      { asset_id: createdAsset.asset_id, asset_type: createdAsset.asset_type },
      request,
      dbUserId,
      timestamp
    );

    return createdAsset;
  });

  logger.info('Asset created', { assetId: result.asset_id, assetTag });
  return mapRowToAsset(result);
}

/**
 * Get asset by ID
 */
export async function getAssetById(assetId: UUID): Promise<Asset | null> {
  const result = await queryOne<AssetRow>(
    'SELECT * FROM assets WHERE asset_id = $1',
    [assetId]
  );

  return result ? mapRowToAsset(result) : null;
}

/**
 * Get asset by tag
 */
export async function getAssetByTag(assetTag: string): Promise<Asset | null> {
  const result = await queryOne<AssetRow>(
    'SELECT * FROM assets WHERE asset_tag = $1',
    [assetTag]
  );

  return result ? mapRowToAsset(result) : null;
}


/**
 * Update an asset
 *
 * Audit logging is handled automatically by database triggers (Requirement 2.7)
 */
export async function updateAsset(
  assetId: UUID,
  request: UpdateAssetRequest,
  userId?: UUID
): Promise<Asset | null> {
  const dbUserId = userId ? await resolveUserId(userId) : null;
  const timestamp = now();

  const result = await withTransaction(async (ctx) => {
    const existing = await ctx.queryOne<AssetRow>(
      'SELECT * FROM assets WHERE asset_id = $1',
      [assetId]
    );

    if (!existing) {
      return null;
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (request.displayName !== undefined) {
      updates.push('display_name = $' + paramIndex++);
      values.push(request.displayName);
    }

    if (request.description !== undefined) {
      updates.push('description = $' + paramIndex++);
      values.push(request.description);
    }

    if (request.substatus !== undefined) {
      updates.push('substatus = $' + paramIndex++);
      values.push(request.substatus);
    }

    let updatedAsset = existing;

    if (updates.length > 0) {
      updates.push('updated_at = $' + paramIndex++);
      values.push(timestamp);

      updates.push('updated_by = $' + paramIndex++);
      values.push(dbUserId);

      values.push(assetId);

      const sql =
        'UPDATE assets SET ' + updates.join(', ') + ' WHERE asset_id = $' + paramIndex + ' RETURNING *';
      const row = await ctx.queryOne<AssetRow>(sql, values);
      if (!row) {
        throw new Error(`Failed to update asset: ${assetId}`);
      }
      updatedAsset = row;
    }

    await patchSubtypeAttributes(
      ctx,
      { asset_id: updatedAsset.asset_id, asset_type: updatedAsset.asset_type },
      request,
      dbUserId,
      timestamp
    );

    if (updates.length === 0 && request.attributes) {
      await ctx.queryOne(
        'UPDATE assets SET updated_at = $1, updated_by = $2 WHERE asset_id = $3',
        [timestamp, dbUserId, assetId]
      );
      const refreshed = await ctx.queryOne<AssetRow>(
        'SELECT * FROM assets WHERE asset_id = $1',
        [assetId]
      );
      return refreshed ?? updatedAsset;
    }

    return updatedAsset;
  });

  if (!result) {
    return null;
  }

  logger.info('Asset updated', { assetId });
  return mapRowToAsset(result);
}

/**
 * Delete an asset
 *
 * Audit logging is handled automatically by database triggers (Requirement 2.7)
 */
export async function deleteAsset(assetId: UUID): Promise<boolean> {
  const result = await query(
    'DELETE FROM assets WHERE asset_id = $1',
    [assetId]
  );

  const deleted = (result.rowCount ?? 0) > 0;
  if (deleted) {
    logger.info('Asset deleted', { assetId });
  }

  return deleted;
}

/**
 * Update asset status
 *
 * Audit logging is handled automatically by database triggers (Requirement 2.7)
 */
export async function updateAssetStatus(
  assetId: UUID,
  newStatus: AssetStatus,
  userId?: UUID
): Promise<Asset | null> {
  const dbUserId = userId ? await resolveUserId(userId) : null;
  const result = await queryOne<AssetRow>(
    'UPDATE assets SET status = $1, updated_at = $2, updated_by = $3 WHERE asset_id = $4 RETURNING *',
    [newStatus, now(), dbUserId, assetId]
  );

  if (result) {
    logger.info('Asset status updated', { assetId, newStatus });
  }

  return result ? mapRowToAsset(result) : null;
}


/**
 * List assets with pagination and filtering
 */
export async function listAssets(
  searchQuery: AssetSearchQuery = {},
  pagination: PaginationParams = {}
): Promise<PaginatedResult<Asset>> {
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (searchQuery.assetType) {
    conditions.push('a.asset_type = $' + paramIndex++);
    values.push(searchQuery.assetType);
  }

  if (searchQuery.status) {
    conditions.push('a.status = $' + paramIndex++);
    values.push(searchQuery.status);
  }

  if (searchQuery.query) {
    conditions.push('(a.display_name ILIKE $' + paramIndex + ' OR a.asset_tag ILIKE $' + paramIndex + ')');
    values.push('%' + searchQuery.query + '%');
    paramIndex++;
  }

  if (searchQuery.buildingId) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM hardware_assets ha
        JOIN buildings b ON b.building_id = $${paramIndex}
        WHERE ha.asset_id = a.asset_id
          AND (
            LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.building_code, '')))
            OR LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM(COALESCE(b.name, '')))
          )
      )`
    );
    values.push(searchQuery.buildingId);
    paramIndex++;
  }

  if (searchQuery.building) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM hardware_assets ha
        WHERE ha.asset_id = a.asset_id
          AND LOWER(TRIM(COALESCE(ha.building, ''))) = LOWER(TRIM($${paramIndex}))
      )`
    );
    values.push(searchQuery.building);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM assets a ' + whereClause,
    values
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const limitParam = paramIndex++;
  const offsetParam = paramIndex;
  values.push(limit, offset);
  
  const rows = await queryMany<AssetRow>(
    'SELECT a.* FROM assets a ' + whereClause + ' ORDER BY a.created_at DESC LIMIT $' + limitParam + ' OFFSET $' + offsetParam,
    values
  );

  return {
    items: rows.map(mapRowToAsset),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Check if asset tag exists
 */
export async function assetTagExists(assetTag: string): Promise<boolean> {
  const result = await queryOne<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM assets WHERE asset_tag = $1) as exists',
    [assetTag]
  );

  return result?.exists ?? false;
}

/**
 * Get assets by stockroom (for hardware assets)
 */
export async function getAssetsByStockroom(stockroomId: UUID): Promise<Asset[]> {
  const rows = await queryMany<AssetRow>(
    'SELECT a.* FROM assets a JOIN hardware_assets ha ON a.asset_id = ha.asset_id WHERE ha.stockroom_id = $1 ORDER BY a.created_at DESC',
    [stockroomId]
  );

  return rows.map(mapRowToAsset);
}


/**
 * Bulk create assets within a transaction
 *
 * Uses unique tag generation with retry for each asset
 * Audit logging is handled automatically by database triggers (Requirement 2.7)
 */
export async function bulkCreateAssets(
  requests: readonly CreateAssetRequest[],
  userId?: UUID
): Promise<Asset[]> {
  // Resolve Cognito sub to DB user_id once for the batch
  const dbUserId = userId ? await resolveUserId(userId) : null;

  return withTransaction(async (ctx) => {
    const assets: Asset[] = [];
    const generatedTags = new Set<string>();

    for (const request of requests) {
      // Generate unique tag, also checking against tags generated in this batch
      let assetTag: string;
      let attempts = 0;

      do {
        assetTag = generateAssetTag(request.assetType);
        attempts++;

        if (attempts > MAX_TAG_GENERATION_RETRIES) {
          throw new Error('Failed to generate unique asset tag after ' + MAX_TAG_GENERATION_RETRIES + ' attempts');
        }

        // Check both database and current batch
        const existsInDb = await assetTagExists(assetTag);
        if (!existsInDb && !generatedTags.has(assetTag)) {
          break;
        }
      } while (true);

      generatedTags.add(assetTag);
      const timestamp = now();

      const result = await ctx.queryOne<AssetRow>(
        'INSERT INTO assets (asset_tag, asset_type, display_name, description, status, created_at, updated_at, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $7) RETURNING *',
        [
          assetTag,
          request.assetType,
          request.displayName,
          request.description ?? null,
          request.status ?? 'ORDERED',
          timestamp,
          dbUserId,
        ]
      );

      if (result) {
        assets.push(mapRowToAsset(result));
      }
    }

    logger.info('Bulk assets created', { count: assets.length });
    return assets;
  });
}

/**
 * Get audit log entries for an asset
 *
 * Retrieves the complete audit history for a specific asset (Requirement 2.5, 2.7)
 */
export async function getAssetAuditLog(
  assetId: UUID,
  pagination: PaginationParams = {}
): Promise<PaginatedResult<AuditLogEntry>> {
  const { page = 1, limit = 50 } = pagination;
  const offset = (page - 1) * limit;

  // Get total count
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM audit_log WHERE resource_type = $1 AND resource_id = $2',
    ['ASSET', assetId]
  );
  const total = parseInt(countResult?.count ?? '0', 10);

  // Get paginated results
  const rows = await queryMany<AuditLogRow>(
    'SELECT * FROM audit_log WHERE resource_type = $1 AND resource_id = $2 ORDER BY timestamp DESC LIMIT $3 OFFSET $4',
    ['ASSET', assetId, limit, offset]
  );

  return {
    items: rows.map(mapRowToAuditLogEntry),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}

/**
 * Audit log row type
 */
interface AuditLogRow {
  log_id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  timestamp: string;
}

/**
 * Audit log entry type
 */
export interface AuditLogEntry {
  readonly logId: string;
  readonly userId?: string;
  readonly actionType: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly oldValues?: Record<string, unknown>;
  readonly newValues?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly timestamp: string;
}

/**
 * Map audit log row to entry
 */
function mapRowToAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    logId: row.log_id,
    userId: row.user_id ?? undefined,
    actionType: row.action_type,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? undefined,
    oldValues: row.old_values ?? undefined,
    newValues: row.new_values ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    timestamp: row.timestamp,
  };
}
