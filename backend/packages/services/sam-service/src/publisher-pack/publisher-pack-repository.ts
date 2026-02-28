/**
 * Publisher Pack Repository - Data access layer for publisher-specific license calculations
 *
 * Implements database operations for:
 * - Publisher pack configurations
 * - Vendor-specific license rules
 * - Hardware asset details for license calculations
 *
 * Requirements: 4.3, 4.4, 4.5
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';

// Logger available for future use
// const logger = createLogger({ service: 'publisher-pack-repository' });

/**
 * Publisher pack configuration
 */
export interface PublisherPack {
  readonly packId: UUID;
  readonly publisher: string;
  readonly packName: string;
  readonly packVersion: string;
  readonly description: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Publisher license rule
 */
export interface PublisherLicenseRule {
  readonly ruleId: UUID;
  readonly packId: UUID;
  readonly productPattern: string;
  readonly licenseMetric: string;
  readonly calculationMethod: string;
  readonly multiplier: number;
  readonly minLicenses: number | null;
  readonly maxLicenses: number | null;
  readonly notes: string | null;
  readonly isActive: boolean;
}

/**
 * Hardware asset with technical details for license calculations
 */
export interface HardwareAssetDetails {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly cpu: string | null;
  readonly coreCount: number | null;
  readonly processorCount: number | null;
  readonly memoryGb: number | null;
  readonly isVirtual: boolean;
  readonly hypervisorType: string | null;
  readonly assignedToUserId: UUID | null;
  readonly status: string;
}

/**
 * Software installation with hardware details
 */
export interface InstallationWithHardware {
  readonly installationId: UUID;
  readonly softwareProductId: UUID;
  readonly hardwareAssetId: UUID;
  readonly installedDate: string | null;
  readonly lastUsedDate: string | null;
  readonly versionDetected: string | null;
  readonly status: string;
  readonly hardware: HardwareAssetDetails;
}

/**
 * Entitlement with license details
 */
export interface EntitlementDetails {
  readonly entitlementId: UUID;
  readonly softwareProductId: UUID;
  readonly licenseType: string;
  readonly quantityPurchased: number;
  readonly quantityAvailable: number;
  readonly metricType: string;
  readonly metricValue: number | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly isActive: boolean;
}

/**
 * Database row types
 */
interface PublisherPackRow {
  pack_id: string;
  publisher: string;
  pack_name: string;
  pack_version: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PublisherLicenseRuleRow {
  rule_id: string;
  pack_id: string;
  product_pattern: string;
  license_metric: string;
  calculation_method: string;
  multiplier: string;
  min_licenses: number | null;
  max_licenses: number | null;
  notes: string | null;
  is_active: boolean;
}

interface InstallationWithHardwareRow {
  installation_id: string;
  software_product_id: string;
  hardware_asset_id: string;
  installed_date: string | null;
  last_used_date: string | null;
  version_detected: string | null;
  status: string;
  asset_id: string;
  asset_tag: string;
  manufacturer: string | null;
  model: string | null;
  cpu: string | null;
  core_count: number | null;
  processor_count: number | null;
  memory_gb: number | null;
  is_virtual: boolean;
  hypervisor_type: string | null;
  assigned_to_user_id: string | null;
  asset_status: string;
}

interface EntitlementRow {
  entitlement_id: string;
  software_product_id: string;
  license_type: string;
  quantity_purchased: number;
  quantity_available: number;
  metric_type: string;
  metric_value: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

/**
 * Map database row to PublisherPack entity
 */
function mapRowToPublisherPack(row: PublisherPackRow): PublisherPack {
  return {
    packId: row.pack_id,
    publisher: row.publisher,
    packName: row.pack_name,
    packVersion: row.pack_version,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to PublisherLicenseRule entity
 */
function mapRowToLicenseRule(row: PublisherLicenseRuleRow): PublisherLicenseRule {
  return {
    ruleId: row.rule_id,
    packId: row.pack_id,
    productPattern: row.product_pattern,
    licenseMetric: row.license_metric,
    calculationMethod: row.calculation_method,
    multiplier: parseFloat(row.multiplier),
    minLicenses: row.min_licenses,
    maxLicenses: row.max_licenses,
    notes: row.notes,
    isActive: row.is_active,
  };
}

/**
 * Map database row to InstallationWithHardware entity
 */
function mapRowToInstallationWithHardware(row: InstallationWithHardwareRow): InstallationWithHardware {
  return {
    installationId: row.installation_id,
    softwareProductId: row.software_product_id,
    hardwareAssetId: row.hardware_asset_id,
    installedDate: row.installed_date,
    lastUsedDate: row.last_used_date,
    versionDetected: row.version_detected,
    status: row.status,
    hardware: {
      assetId: row.asset_id,
      assetTag: row.asset_tag,
      manufacturer: row.manufacturer,
      model: row.model,
      cpu: row.cpu,
      coreCount: row.core_count,
      processorCount: row.processor_count,
      memoryGb: row.memory_gb,
      isVirtual: row.is_virtual,
      hypervisorType: row.hypervisor_type,
      assignedToUserId: row.assigned_to_user_id,
      status: row.asset_status,
    },
  };
}

/**
 * Map database row to EntitlementDetails entity
 */
function mapRowToEntitlementDetails(row: EntitlementRow): EntitlementDetails {
  return {
    entitlementId: row.entitlement_id,
    softwareProductId: row.software_product_id,
    licenseType: row.license_type,
    quantityPurchased: row.quantity_purchased,
    quantityAvailable: row.quantity_available,
    metricType: row.metric_type,
    metricValue: row.metric_value,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active,
  };
}

/**
 * Get publisher pack by publisher name
 */
export async function getPublisherPackByPublisher(publisher: string): Promise<PublisherPack | null> {
  const normalizedPublisher = publisher.toUpperCase();
  
  const result = await queryOne<PublisherPackRow>(
    `SELECT * FROM publisher_packs 
     WHERE UPPER(publisher) = $1 AND is_active = TRUE
     ORDER BY pack_version DESC
     LIMIT 1`,
    [normalizedPublisher]
  );

  return result ? mapRowToPublisherPack(result) : null;
}

/**
 * Get license rules for a publisher pack
 */
export async function getLicenseRulesForPack(packId: UUID): Promise<PublisherLicenseRule[]> {
  const rows = await queryMany<PublisherLicenseRuleRow>(
    `SELECT * FROM publisher_license_rules 
     WHERE pack_id = $1 AND is_active = TRUE
     ORDER BY product_pattern`,
    [packId]
  );

  return rows.map(mapRowToLicenseRule);
}

/**
 * Get installations with hardware details for a product
 * Required for per-core and per-processor license calculations
 */
export async function getInstallationsWithHardware(
  productId: UUID
): Promise<InstallationWithHardware[]> {
  const rows = await queryMany<InstallationWithHardwareRow>(
    `SELECT 
      si.installation_id,
      si.software_product_id,
      si.hardware_asset_id,
      si.installed_date,
      si.last_used_date,
      si.version_detected,
      si.status,
      ha.asset_id,
      a.asset_tag,
      ha.manufacturer,
      ha.model,
      ha.cpu,
      COALESCE(ha.core_count, 4) as core_count,
      COALESCE(ha.processor_count, 1) as processor_count,
      ha.memory_gb,
      COALESCE(ha.is_virtual, FALSE) as is_virtual,
      ha.hypervisor_type,
      ha.assigned_to_user_id,
      a.status as asset_status
     FROM software_installations si
     JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
     JOIN assets a ON ha.asset_id = a.asset_id
     WHERE si.software_product_id = $1 
       AND si.status = 'ACTIVE'
       AND a.status = 'DEPLOYED'
     ORDER BY si.installed_date DESC`,
    [productId]
  );

  return rows.map(mapRowToInstallationWithHardware);
}

/**
 * Get entitlements for a product with full details
 */
export async function getEntitlementDetails(productId: UUID): Promise<EntitlementDetails[]> {
  const rows = await queryMany<EntitlementRow>(
    `SELECT 
      entitlement_id,
      software_product_id,
      license_type,
      quantity_purchased,
      quantity_available,
      metric_type,
      metric_value,
      start_date,
      end_date,
      is_active
     FROM entitlements
     WHERE software_product_id = $1 
       AND is_active = TRUE
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     ORDER BY created_at DESC`,
    [productId]
  );

  return rows.map(mapRowToEntitlementDetails);
}

/**
 * Get unique users with installations for a product
 * Required for per-user license calculations
 */
export async function getUniqueUsersWithInstallations(productId: UUID): Promise<UUID[]> {
  const rows = await queryMany<{ user_id: string }>(
    `SELECT DISTINCT ha.assigned_to_user_id as user_id
     FROM software_installations si
     JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
     JOIN assets a ON ha.asset_id = a.asset_id
     WHERE si.software_product_id = $1 
       AND si.status = 'ACTIVE'
       AND a.status = 'DEPLOYED'
       AND ha.assigned_to_user_id IS NOT NULL`,
    [productId]
  );

  return rows.map(r => r.user_id);
}

/**
 * Get software product by ID
 */
export async function getProductById(productId: UUID): Promise<{
  productId: UUID;
  publisher: string;
  productName: string;
  version: string | null;
  edition: string | null;
} | null> {
  const result = await queryOne<{
    product_id: string;
    publisher: string;
    product_name: string;
    version: string | null;
    edition: string | null;
  }>(
    'SELECT product_id, publisher, product_name, version, edition FROM software_products WHERE product_id = $1',
    [productId]
  );

  if (!result) return null;

  return {
    productId: result.product_id,
    publisher: result.publisher,
    productName: result.product_name,
    version: result.version,
    edition: result.edition,
  };
}

/**
 * Get products by publisher
 */
export async function getProductsByPublisher(publisher: string): Promise<Array<{
  productId: UUID;
  publisher: string;
  productName: string;
  version: string | null;
  edition: string | null;
}>> {
  const normalizedPublisher = publisher.toUpperCase();
  
  const rows = await queryMany<{
    product_id: string;
    publisher: string;
    product_name: string;
    version: string | null;
    edition: string | null;
  }>(
    `SELECT product_id, publisher, product_name, version, edition 
     FROM software_products 
     WHERE UPPER(publisher) = $1 AND is_active = TRUE
     ORDER BY product_name, version`,
    [normalizedPublisher]
  );

  return rows.map(r => ({
    productId: r.product_id,
    publisher: r.publisher,
    productName: r.product_name,
    version: r.version,
    edition: r.edition,
  }));
}

