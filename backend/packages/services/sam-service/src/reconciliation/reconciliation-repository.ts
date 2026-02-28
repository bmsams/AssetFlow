/**
 * Reconciliation Repository - Data access layer for software license reconciliation
 *
 * Implements database operations for:
 * - Entitlement queries (licenses owned)
 * - Installation queries (software discovered)
 * - Reconciliation result storage
 *
 * Requirements: 4.1, 4.2
 */

import type { CompliancePosition, UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger, now } from '@ams/utils';

const logger = createLogger({ service: 'reconciliation-repository' });

/**
 * Software product entity
 */
export interface SoftwareProduct {
  readonly productId: UUID;
  readonly publisher: string;
  readonly productName: string;
  readonly version: string | null;
  readonly edition: string | null;
  readonly productCategory: string | null;
  readonly isSaas: boolean;
  readonly normalizationKey: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Entitlement entity (license owned)
 */
export interface Entitlement {
  readonly entitlementId: UUID;
  readonly softwareProductId: UUID;
  readonly licenseType: string;
  readonly quantityPurchased: number;
  readonly quantityAvailable: number;
  readonly unitCost: number | null;
  readonly contractId: UUID | null;
  readonly purchaseOrderId: UUID | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly renewalDate: string | null;
  readonly maintenanceIncluded: boolean;
  readonly metricType: string;
  readonly metricValue: number | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Software installation entity (discovered software)
 */
export interface SoftwareInstallation {
  readonly installationId: UUID;
  readonly softwareProductId: UUID;
  readonly hardwareAssetId: UUID;
  readonly installedDate: string | null;
  readonly lastUsedDate: string | null;
  readonly usageMinutes30Day: number;
  readonly discoverySource: string | null;
  readonly discoveryDate: string | null;
  readonly installPath: string | null;
  readonly versionDetected: string | null;
  readonly isAuthorized: boolean;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Reconciliation result entity
 */
export interface ReconciliationResult {
  readonly resultId: UUID;
  readonly softwareProductId: UUID;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly lastReconciledAt: string;
  readonly effectiveLicensePosition: number | null;
  readonly licenseDemand: number | null;
  readonly compliancePercentage: number | null;
  readonly reconciliationRunId: UUID | null;
  readonly reconciliationType: string;
  readonly createdAt: string;
}

/**
 * Entitlement summary for a product
 */
export interface EntitlementSummary {
  readonly softwareProductId: UUID;
  readonly totalQuantityPurchased: number;
  readonly totalQuantityAvailable: number;
  readonly activeEntitlementCount: number;
  readonly metricTypes: readonly string[];
}

/**
 * Installation summary for a product
 */
export interface InstallationSummary {
  readonly softwareProductId: UUID;
  readonly totalInstallations: number;
  readonly activeInstallations: number;
  readonly authorizedInstallations: number;
  readonly unauthorizedInstallations: number;
}

/**
 * Database row types
 */
interface SoftwareProductRow {
  product_id: string;
  publisher: string;
  product_name: string;
  version: string | null;
  edition: string | null;
  product_category: string | null;
  is_saas: boolean;
  normalization_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EntitlementRow {
  entitlement_id: string;
  software_product_id: string;
  license_type: string;
  quantity_purchased: number;
  quantity_available: number;
  unit_cost: string | null;
  contract_id: string | null;
  purchase_order_id: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  maintenance_included: boolean;
  metric_type: string;
  metric_value: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface InstallationRow {
  installation_id: string;
  software_product_id: string;
  hardware_asset_id: string;
  installed_date: string | null;
  last_used_date: string | null;
  usage_minutes_30day: number;
  discovery_source: string | null;
  discovery_date: string | null;
  install_path: string | null;
  version_detected: string | null;
  is_authorized: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ReconciliationResultRow {
  result_id: string;
  software_product_id: string;
  entitlements_owned: number;
  installations_found: number;
  compliance_position: CompliancePosition;
  over_under_licensed_count: number;
  last_reconciled_at: string;
  effective_license_position: number | null;
  license_demand: number | null;
  compliance_percentage: string | null;
  reconciliation_run_id: string | null;
  reconciliation_type: string;
  created_at: string;
}

interface EntitlementSummaryRow {
  software_product_id: string;
  total_quantity_purchased: string;
  total_quantity_available: string;
  active_entitlement_count: string;
  metric_types: string[];
}

interface InstallationSummaryRow {
  software_product_id: string;
  total_installations: string;
  active_installations: string;
  authorized_installations: string;
  unauthorized_installations: string;
}

/**
 * Map database row to SoftwareProduct entity
 */
function mapRowToProduct(row: SoftwareProductRow): SoftwareProduct {
  return {
    productId: row.product_id,
    publisher: row.publisher,
    productName: row.product_name,
    version: row.version,
    edition: row.edition,
    productCategory: row.product_category,
    isSaas: row.is_saas,
    normalizationKey: row.normalization_key,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to Entitlement entity
 */
function mapRowToEntitlement(row: EntitlementRow): Entitlement {
  return {
    entitlementId: row.entitlement_id,
    softwareProductId: row.software_product_id,
    licenseType: row.license_type,
    quantityPurchased: row.quantity_purchased,
    quantityAvailable: row.quantity_available,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    contractId: row.contract_id,
    purchaseOrderId: row.purchase_order_id,
    startDate: row.start_date,
    endDate: row.end_date,
    renewalDate: row.renewal_date,
    maintenanceIncluded: row.maintenance_included,
    metricType: row.metric_type,
    metricValue: row.metric_value,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to SoftwareInstallation entity
 */
function mapRowToInstallation(row: InstallationRow): SoftwareInstallation {
  return {
    installationId: row.installation_id,
    softwareProductId: row.software_product_id,
    hardwareAssetId: row.hardware_asset_id,
    installedDate: row.installed_date,
    lastUsedDate: row.last_used_date,
    usageMinutes30Day: row.usage_minutes_30day,
    discoverySource: row.discovery_source,
    discoveryDate: row.discovery_date,
    installPath: row.install_path,
    versionDetected: row.version_detected,
    isAuthorized: row.is_authorized,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ReconciliationResult entity
 */
function mapRowToReconciliationResult(row: ReconciliationResultRow): ReconciliationResult {
  return {
    resultId: row.result_id,
    softwareProductId: row.software_product_id,
    entitlementsOwned: row.entitlements_owned,
    installationsFound: row.installations_found,
    compliancePosition: row.compliance_position,
    overUnderCount: row.over_under_licensed_count,
    lastReconciledAt: row.last_reconciled_at,
    effectiveLicensePosition: row.effective_license_position,
    licenseDemand: row.license_demand,
    compliancePercentage: row.compliance_percentage ? parseFloat(row.compliance_percentage) : null,
    reconciliationRunId: row.reconciliation_run_id,
    reconciliationType: row.reconciliation_type,
    createdAt: row.created_at,
  };
}

/**
 * Get software product by ID
 */
export async function getProductById(productId: UUID): Promise<SoftwareProduct | null> {
  const result = await queryOne<SoftwareProductRow>(
    'SELECT * FROM software_products WHERE product_id = $1',
    [productId]
  );

  return result ? mapRowToProduct(result) : null;
}

/**
 * Get all active software products
 */
export async function getActiveProducts(): Promise<SoftwareProduct[]> {
  const rows = await queryMany<SoftwareProductRow>(
    'SELECT * FROM software_products WHERE is_active = TRUE ORDER BY publisher, product_name'
  );

  return rows.map(mapRowToProduct);
}

/**
 * Get entitlements for a software product
 * Requirement 4.1: Get entitlements owned
 */
export async function getEntitlementsByProduct(
  productId: UUID,
  activeOnly = true
): Promise<Entitlement[]> {
  const activeCondition = activeOnly ? 'AND is_active = TRUE' : '';
  const dateCondition = activeOnly ? 'AND (end_date IS NULL OR end_date >= CURRENT_DATE)' : '';

  const rows = await queryMany<EntitlementRow>(
    `SELECT * FROM entitlements 
     WHERE software_product_id = $1 ${activeCondition} ${dateCondition}
     ORDER BY created_at DESC`,
    [productId]
  );

  return rows.map(mapRowToEntitlement);
}

/**
 * Get entitlement summary for a product
 * Requirement 4.1: Calculate total entitlements owned
 */
export async function getEntitlementSummary(productId: UUID): Promise<EntitlementSummary | null> {
  const result = await queryOne<EntitlementSummaryRow>(
    `SELECT 
      software_product_id,
      COALESCE(SUM(quantity_purchased), 0) as total_quantity_purchased,
      COALESCE(SUM(quantity_available), 0) as total_quantity_available,
      COUNT(*) as active_entitlement_count,
      ARRAY_AGG(DISTINCT metric_type) as metric_types
     FROM entitlements
     WHERE software_product_id = $1 
       AND is_active = TRUE
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
     GROUP BY software_product_id`,
    [productId]
  );

  if (!result) {
    return null;
  }

  return {
    softwareProductId: result.software_product_id,
    totalQuantityPurchased: parseInt(result.total_quantity_purchased, 10),
    totalQuantityAvailable: parseInt(result.total_quantity_available, 10),
    activeEntitlementCount: parseInt(result.active_entitlement_count, 10),
    metricTypes: result.metric_types,
  };
}

/**
 * Get installations for a software product
 * Requirement 4.1: Get installations discovered
 */
export async function getInstallationsByProduct(
  productId: UUID,
  activeOnly = true
): Promise<SoftwareInstallation[]> {
  const statusCondition = activeOnly ? "AND status = 'ACTIVE'" : '';

  const rows = await queryMany<InstallationRow>(
    `SELECT * FROM software_installations 
     WHERE software_product_id = $1 ${statusCondition}
     ORDER BY discovery_date DESC`,
    [productId]
  );

  return rows.map(mapRowToInstallation);
}

/**
 * Get installation summary for a product
 * Requirement 4.1: Calculate total installations found
 */
export async function getInstallationSummary(productId: UUID): Promise<InstallationSummary | null> {
  const result = await queryOne<InstallationSummaryRow>(
    `SELECT 
      software_product_id,
      COUNT(*) as total_installations,
      COUNT(*) FILTER (WHERE status = 'ACTIVE') as active_installations,
      COUNT(*) FILTER (WHERE is_authorized = TRUE AND status = 'ACTIVE') as authorized_installations,
      COUNT(*) FILTER (WHERE is_authorized = FALSE AND status = 'ACTIVE') as unauthorized_installations
     FROM software_installations
     WHERE software_product_id = $1
     GROUP BY software_product_id`,
    [productId]
  );

  if (!result) {
    return null;
  }

  return {
    softwareProductId: result.software_product_id,
    totalInstallations: parseInt(result.total_installations, 10),
    activeInstallations: parseInt(result.active_installations, 10),
    authorizedInstallations: parseInt(result.authorized_installations, 10),
    unauthorizedInstallations: parseInt(result.unauthorized_installations, 10),
  };
}

/**
 * Get the latest reconciliation result for a product
 */
export async function getLatestReconciliationResult(
  productId: UUID
): Promise<ReconciliationResult | null> {
  const result = await queryOne<ReconciliationResultRow>(
    `SELECT * FROM reconciliation_results 
     WHERE software_product_id = $1 
     ORDER BY last_reconciled_at DESC 
     LIMIT 1`,
    [productId]
  );

  return result ? mapRowToReconciliationResult(result) : null;
}

/**
 * Get reconciliation results for multiple products
 */
export async function getReconciliationResults(
  productIds?: UUID[]
): Promise<ReconciliationResult[]> {
  let sql: string;
  let params: unknown[];

  if (productIds && productIds.length > 0) {
    sql = `SELECT DISTINCT ON (software_product_id) *
           FROM reconciliation_results 
           WHERE software_product_id = ANY($1)
           ORDER BY software_product_id, last_reconciled_at DESC`;
    params = [productIds];
  } else {
    sql = `SELECT DISTINCT ON (software_product_id) *
           FROM reconciliation_results 
           ORDER BY software_product_id, last_reconciled_at DESC`;
    params = [];
  }

  const rows = await queryMany<ReconciliationResultRow>(sql, params);
  return rows.map(mapRowToReconciliationResult);
}

/**
 * Save reconciliation result
 * Requirement 4.2: Store compliance position
 */
export async function saveReconciliationResult(
  result: Omit<ReconciliationResult, 'resultId' | 'createdAt'>
): Promise<ReconciliationResult> {
  const timestamp = now();

  const row = await queryOne<ReconciliationResultRow>(
    `INSERT INTO reconciliation_results (
      software_product_id, entitlements_owned, installations_found,
      compliance_position, over_under_licensed_count, last_reconciled_at,
      effective_license_position, license_demand, compliance_percentage,
      reconciliation_run_id, reconciliation_type, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      result.softwareProductId,
      result.entitlementsOwned,
      result.installationsFound,
      result.compliancePosition,
      result.overUnderCount,
      result.lastReconciledAt,
      result.effectiveLicensePosition,
      result.licenseDemand,
      result.compliancePercentage,
      result.reconciliationRunId,
      result.reconciliationType,
      timestamp,
    ]
  );

  if (!row) {
    throw new Error('Failed to save reconciliation result');
  }

  logger.info('Reconciliation result saved', {
    resultId: row.result_id,
    productId: result.softwareProductId,
    compliancePosition: result.compliancePosition,
  });

  return mapRowToReconciliationResult(row);
}

/**
 * Get products with compliance issues (under-licensed)
 */
export async function getProductsWithComplianceIssues(): Promise<ReconciliationResult[]> {
  const rows = await queryMany<ReconciliationResultRow>(
    `SELECT DISTINCT ON (software_product_id) *
     FROM reconciliation_results 
     WHERE compliance_position = 'UNDER_LICENSED'
     ORDER BY software_product_id, last_reconciled_at DESC`
  );

  return rows.map(mapRowToReconciliationResult);
}

/**
 * Get products needing reconciliation (no recent result or stale)
 */
export async function getProductsNeedingReconciliation(
  staleDays = 7
): Promise<SoftwareProduct[]> {
  const rows = await queryMany<SoftwareProductRow>(
    `SELECT sp.* FROM software_products sp
     LEFT JOIN (
       SELECT DISTINCT ON (software_product_id) software_product_id, last_reconciled_at
       FROM reconciliation_results
       ORDER BY software_product_id, last_reconciled_at DESC
     ) rr ON sp.product_id = rr.software_product_id
     WHERE sp.is_active = TRUE
       AND (rr.last_reconciled_at IS NULL 
            OR rr.last_reconciled_at < NOW() - INTERVAL '${staleDays} days')
     ORDER BY sp.publisher, sp.product_name`
  );

  return rows.map(mapRowToProduct);
}
