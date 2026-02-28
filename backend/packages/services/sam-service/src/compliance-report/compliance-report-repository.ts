/**
 * Compliance Report Repository - Data access layer for compliance reporting
 *
 * Implements database operations for:
 * - Fetching compliance data for reports
 * - License ownership evidence (purchase orders, contracts)
 * - Installation and entitlement data aggregation
 *
 * Requirements: 4.14, 16.7
 */

import type { CompliancePosition, UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'compliance-report-repository' });

/**
 * Export format types
 */
export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV';

/**
 * Compliance status filter
 */
export type ComplianceStatusFilter = 'ALL' | 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';

/**
 * License ownership evidence entity
 */
export interface LicenseOwnershipEvidence {
  readonly evidenceId: UUID;
  readonly entitlementId: UUID;
  readonly evidenceType: 'PURCHASE_ORDER' | 'CONTRACT' | 'INVOICE' | 'LICENSE_KEY';
  readonly documentNumber: string;
  readonly documentDate: string;
  readonly vendorName: string;
  readonly description: string | null;
  readonly quantity: number;
  readonly unitCost: number | null;
  readonly totalCost: number | null;
  readonly documentUrl: string | null;
  readonly createdAt: string;
}

/**
 * Software product compliance data
 */
export interface ProductComplianceData {
  readonly productId: UUID;
  readonly publisher: string;
  readonly productName: string;
  readonly version: string | null;
  readonly edition: string | null;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly compliancePercentage: number;
  readonly lastReconciledAt: string | null;
  readonly totalLicenseCost: number;
  readonly potentialRisk: number;
}

/**
 * Entitlement detail for reports
 */
export interface EntitlementDetail {
  readonly entitlementId: UUID;
  readonly softwareProductId: UUID;
  readonly licenseType: string;
  readonly metricType: string;
  readonly quantityPurchased: number;
  readonly quantityAvailable: number;
  readonly unitCost: number | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly contractNumber: string | null;
  readonly purchaseOrderNumber: string | null;
  readonly vendorName: string | null;
}

/**
 * Installation detail for reports
 */
export interface InstallationDetail {
  readonly installationId: UUID;
  readonly softwareProductId: UUID;
  readonly hardwareAssetId: UUID;
  readonly assetTag: string | null;
  readonly hostname: string | null;
  readonly assignedUser: string | null;
  readonly department: string | null;
  readonly installedDate: string | null;
  readonly lastUsedDate: string | null;
  readonly usageMinutes30Day: number;
  readonly discoverySource: string | null;
  readonly isAuthorized: boolean;
}

/**
 * Compliance report summary
 */
export interface ComplianceReportSummary {
  readonly totalProducts: number;
  readonly compliantProducts: number;
  readonly overLicensedProducts: number;
  readonly underLicensedProducts: number;
  readonly totalEntitlements: number;
  readonly totalInstallations: number;
  readonly totalLicenseCost: number;
  readonly potentialRiskExposure: number;
  readonly complianceRate: number;
}

/**
 * Audit trail entry
 */
export interface AuditTrailEntry {
  readonly auditId: UUID;
  readonly entityType: string;
  readonly entityId: UUID;
  readonly action: string;
  readonly performedBy: string | null;
  readonly performedAt: string;
  readonly previousValue: Record<string, unknown> | null;
  readonly newValue: Record<string, unknown> | null;
  readonly ipAddress: string | null;
}

/**
 * Report filter options
 */
export interface ReportFilterOptions {
  readonly productIds?: UUID[];
  readonly publishers?: string[];
  readonly complianceStatus?: ComplianceStatusFilter;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly includeEvidence?: boolean;
  readonly includeInstallations?: boolean;
  readonly includeAuditTrail?: boolean;
}

/**
 * Database row types
 */
interface ProductComplianceRow {
  product_id: string;
  publisher: string;
  product_name: string;
  version: string | null;
  edition: string | null;
  entitlements_owned: string;
  installations_found: string;
  compliance_position: CompliancePosition;
  over_under_count: string;
  compliance_percentage: string | null;
  last_reconciled_at: string | null;
  total_license_cost: string;
  potential_risk: string;
}

interface EntitlementDetailRow {
  entitlement_id: string;
  software_product_id: string;
  license_type: string;
  metric_type: string;
  quantity_purchased: number;
  quantity_available: number;
  unit_cost: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_number: string | null;
  purchase_order_number: string | null;
  vendor_name: string | null;
}

interface InstallationDetailRow {
  installation_id: string;
  software_product_id: string;
  hardware_asset_id: string;
  asset_tag: string | null;
  hostname: string | null;
  assigned_user: string | null;
  department: string | null;
  installed_date: string | null;
  last_used_date: string | null;
  usage_minutes_30day: number;
  discovery_source: string | null;
  is_authorized: boolean;
}

interface EvidenceRow {
  evidence_id: string;
  entitlement_id: string;
  evidence_type: 'PURCHASE_ORDER' | 'CONTRACT' | 'INVOICE' | 'LICENSE_KEY';
  document_number: string;
  document_date: string;
  vendor_name: string;
  description: string | null;
  quantity: number;
  unit_cost: string | null;
  total_cost: string | null;
  document_url: string | null;
  created_at: string;
}

interface AuditTrailRow {
  audit_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  performed_by: string | null;
  performed_at: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
}

interface SummaryRow {
  total_products: string;
  compliant_products: string;
  over_licensed_products: string;
  under_licensed_products: string;
  total_entitlements: string;
  total_installations: string;
  total_license_cost: string;
  potential_risk_exposure: string;
}

/**
 * Map database row to ProductComplianceData entity
 */
function mapRowToProductCompliance(row: ProductComplianceRow): ProductComplianceData {
  return {
    productId: row.product_id,
    publisher: row.publisher,
    productName: row.product_name,
    version: row.version,
    edition: row.edition,
    entitlementsOwned: parseInt(row.entitlements_owned, 10),
    installationsFound: parseInt(row.installations_found, 10),
    compliancePosition: row.compliance_position,
    overUnderCount: parseInt(row.over_under_count, 10),
    compliancePercentage: row.compliance_percentage ? parseFloat(row.compliance_percentage) : 0,
    lastReconciledAt: row.last_reconciled_at,
    totalLicenseCost: parseFloat(row.total_license_cost) || 0,
    potentialRisk: parseFloat(row.potential_risk) || 0,
  };
}

/**
 * Map database row to EntitlementDetail entity
 */
function mapRowToEntitlementDetail(row: EntitlementDetailRow): EntitlementDetail {
  return {
    entitlementId: row.entitlement_id,
    softwareProductId: row.software_product_id,
    licenseType: row.license_type,
    metricType: row.metric_type,
    quantityPurchased: row.quantity_purchased,
    quantityAvailable: row.quantity_available,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    contractNumber: row.contract_number,
    purchaseOrderNumber: row.purchase_order_number,
    vendorName: row.vendor_name,
  };
}

/**
 * Map database row to InstallationDetail entity
 */
function mapRowToInstallationDetail(row: InstallationDetailRow): InstallationDetail {
  return {
    installationId: row.installation_id,
    softwareProductId: row.software_product_id,
    hardwareAssetId: row.hardware_asset_id,
    assetTag: row.asset_tag,
    hostname: row.hostname,
    assignedUser: row.assigned_user,
    department: row.department,
    installedDate: row.installed_date,
    lastUsedDate: row.last_used_date,
    usageMinutes30Day: row.usage_minutes_30day,
    discoverySource: row.discovery_source,
    isAuthorized: row.is_authorized,
  };
}

/**
 * Map database row to LicenseOwnershipEvidence entity
 */
function mapRowToEvidence(row: EvidenceRow): LicenseOwnershipEvidence {
  return {
    evidenceId: row.evidence_id,
    entitlementId: row.entitlement_id,
    evidenceType: row.evidence_type,
    documentNumber: row.document_number,
    documentDate: row.document_date,
    vendorName: row.vendor_name,
    description: row.description,
    quantity: row.quantity,
    unitCost: row.unit_cost ? parseFloat(row.unit_cost) : null,
    totalCost: row.total_cost ? parseFloat(row.total_cost) : null,
    documentUrl: row.document_url,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to AuditTrailEntry entity
 */
function mapRowToAuditTrail(row: AuditTrailRow): AuditTrailEntry {
  return {
    auditId: row.audit_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    previousValue: row.previous_value,
    newValue: row.new_value,
    ipAddress: row.ip_address,
  };
}

/**
 * Get compliance data for all products
 * Requirement 4.14: Generate audit-ready reports showing license ownership and usage evidence
 */
export async function getProductComplianceData(
  filters: ReportFilterOptions = {}
): Promise<ProductComplianceData[]> {
  logger.info('Fetching product compliance data', { filters });

  let sql = `
    SELECT 
      sp.product_id,
      sp.publisher,
      sp.product_name,
      sp.version,
      sp.edition,
      COALESCE(rr.entitlements_owned, 0) as entitlements_owned,
      COALESCE(rr.installations_found, 0) as installations_found,
      COALESCE(rr.compliance_position, 'COMPLIANT') as compliance_position,
      COALESCE(rr.over_under_licensed_count, 0) as over_under_count,
      COALESCE(rr.compliance_percentage, 100) as compliance_percentage,
      rr.last_reconciled_at,
      COALESCE(e.total_cost, 0) as total_license_cost,
      CASE 
        WHEN rr.compliance_position = 'UNDER_LICENSED' 
        THEN ABS(rr.over_under_licensed_count) * COALESCE(e.avg_unit_cost, 0)
        ELSE 0 
      END as potential_risk
    FROM software_products sp
    LEFT JOIN (
      SELECT DISTINCT ON (software_product_id) *
      FROM reconciliation_results
      ORDER BY software_product_id, last_reconciled_at DESC
    ) rr ON sp.product_id = rr.software_product_id
    LEFT JOIN (
      SELECT 
        software_product_id,
        SUM(quantity_purchased * COALESCE(unit_cost, 0)) as total_cost,
        AVG(unit_cost) as avg_unit_cost
      FROM entitlements
      WHERE is_active = TRUE
      GROUP BY software_product_id
    ) e ON sp.product_id = e.software_product_id
    WHERE sp.is_active = TRUE
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  // Apply filters
  if (filters.productIds && filters.productIds.length > 0) {
    sql += ` AND sp.product_id = ANY($${paramIndex++})`;
    params.push(filters.productIds);
  }

  if (filters.publishers && filters.publishers.length > 0) {
    sql += ` AND sp.publisher = ANY($${paramIndex++})`;
    params.push(filters.publishers);
  }

  if (filters.complianceStatus && filters.complianceStatus !== 'ALL') {
    sql += ` AND rr.compliance_position = $${paramIndex++}`;
    params.push(filters.complianceStatus);
  }

  sql += ' ORDER BY sp.publisher, sp.product_name';

  const rows = await queryMany<ProductComplianceRow>(sql, params);
  return rows.map(mapRowToProductCompliance);
}

/**
 * Get entitlement details for a product
 * Requirement 4.14: Show license ownership evidence
 */
export async function getEntitlementDetails(
  productId: UUID
): Promise<EntitlementDetail[]> {
  logger.info('Fetching entitlement details', { productId });

  const rows = await queryMany<EntitlementDetailRow>(
    `SELECT 
      e.entitlement_id,
      e.software_product_id,
      e.license_type,
      e.metric_type,
      e.quantity_purchased,
      e.quantity_available,
      e.unit_cost,
      e.start_date,
      e.end_date,
      c.contract_number,
      po.po_number as purchase_order_number,
      v.vendor_name
    FROM entitlements e
    LEFT JOIN contracts c ON e.contract_id = c.contract_id
    LEFT JOIN purchase_orders po ON e.purchase_order_id = po.po_id
    LEFT JOIN vendors v ON po.vendor_id = v.vendor_id OR c.vendor_id = v.vendor_id
    WHERE e.software_product_id = $1
      AND e.is_active = TRUE
    ORDER BY e.start_date DESC`,
    [productId]
  );

  return rows.map(mapRowToEntitlementDetail);
}

/**
 * Get installation details for a product
 * Requirement 4.14: Show usage evidence
 */
export async function getInstallationDetails(
  productId: UUID
): Promise<InstallationDetail[]> {
  logger.info('Fetching installation details', { productId });

  const rows = await queryMany<InstallationDetailRow>(
    `SELECT 
      si.installation_id,
      si.software_product_id,
      si.hardware_asset_id,
      ha.asset_tag,
      ha.hostname,
      u.display_name as assigned_user,
      d.name as department,
      si.installed_date,
      si.last_used_date,
      si.usage_minutes_30day,
      si.discovery_source,
      si.is_authorized
    FROM software_installations si
    LEFT JOIN hardware_assets ha ON si.hardware_asset_id = ha.asset_id
    LEFT JOIN users u ON ha.assigned_to = u.user_id
    LEFT JOIN departments d ON ha.department_id = d.department_id
    WHERE si.software_product_id = $1
      AND si.status = 'ACTIVE'
    ORDER BY si.last_used_date DESC NULLS LAST`,
    [productId]
  );

  return rows.map(mapRowToInstallationDetail);
}

/**
 * Get license ownership evidence for entitlements
 * Requirement 4.14: Generate audit-ready reports with license ownership evidence
 */
export async function getLicenseOwnershipEvidence(
  entitlementIds: UUID[]
): Promise<LicenseOwnershipEvidence[]> {
  if (entitlementIds.length === 0) {
    return [];
  }

  logger.info('Fetching license ownership evidence', { entitlementCount: entitlementIds.length });

  const rows = await queryMany<EvidenceRow>(
    `SELECT 
      loe.evidence_id,
      loe.entitlement_id,
      loe.evidence_type,
      loe.document_number,
      loe.document_date,
      v.vendor_name,
      loe.description,
      loe.quantity,
      loe.unit_cost,
      loe.total_cost,
      loe.document_url,
      loe.created_at
    FROM license_ownership_evidence loe
    LEFT JOIN vendors v ON loe.vendor_id = v.vendor_id
    WHERE loe.entitlement_id = ANY($1)
    ORDER BY loe.document_date DESC`,
    [entitlementIds]
  );

  return rows.map(mapRowToEvidence);
}

/**
 * Get audit trail for compliance-related entities
 * Requirement 4.14: Include audit trail information
 */
export async function getComplianceAuditTrail(
  entityType: 'ENTITLEMENT' | 'INSTALLATION' | 'RECONCILIATION',
  entityIds: UUID[],
  startDate?: string,
  endDate?: string
): Promise<AuditTrailEntry[]> {
  if (entityIds.length === 0) {
    return [];
  }

  logger.info('Fetching compliance audit trail', { entityType, entityCount: entityIds.length });

  let sql = `
    SELECT 
      audit_id,
      entity_type,
      entity_id,
      action,
      performed_by,
      performed_at,
      previous_value,
      new_value,
      ip_address
    FROM audit_log
    WHERE entity_type = $1
      AND entity_id = ANY($2)
  `;

  const params: unknown[] = [entityType, entityIds];
  let paramIndex = 3;

  if (startDate) {
    sql += ` AND performed_at >= $${paramIndex++}`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND performed_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  sql += ' ORDER BY performed_at DESC';

  const rows = await queryMany<AuditTrailRow>(sql, params);
  return rows.map(mapRowToAuditTrail);
}

/**
 * Get compliance report summary
 * Requirement 16.7: Generate audit-ready reports for software license compliance
 */
export async function getComplianceReportSummary(
  filters: ReportFilterOptions = {}
): Promise<ComplianceReportSummary> {
  logger.info('Fetching compliance report summary', { filters });

  let sql = `
    SELECT 
      COUNT(DISTINCT sp.product_id) as total_products,
      COUNT(DISTINCT sp.product_id) FILTER (
        WHERE COALESCE(rr.compliance_position, 'COMPLIANT') = 'COMPLIANT'
      ) as compliant_products,
      COUNT(DISTINCT sp.product_id) FILTER (
        WHERE rr.compliance_position = 'OVER_LICENSED'
      ) as over_licensed_products,
      COUNT(DISTINCT sp.product_id) FILTER (
        WHERE rr.compliance_position = 'UNDER_LICENSED'
      ) as under_licensed_products,
      COALESCE(SUM(e.entitlement_count), 0) as total_entitlements,
      COALESCE(SUM(i.installation_count), 0) as total_installations,
      COALESCE(SUM(e.total_cost), 0) as total_license_cost,
      COALESCE(SUM(
        CASE 
          WHEN rr.compliance_position = 'UNDER_LICENSED' 
          THEN ABS(rr.over_under_licensed_count) * COALESCE(e.avg_unit_cost, 0)
          ELSE 0 
        END
      ), 0) as potential_risk_exposure
    FROM software_products sp
    LEFT JOIN (
      SELECT DISTINCT ON (software_product_id) *
      FROM reconciliation_results
      ORDER BY software_product_id, last_reconciled_at DESC
    ) rr ON sp.product_id = rr.software_product_id
    LEFT JOIN (
      SELECT 
        software_product_id,
        COUNT(*) as entitlement_count,
        SUM(quantity_purchased * COALESCE(unit_cost, 0)) as total_cost,
        AVG(unit_cost) as avg_unit_cost
      FROM entitlements
      WHERE is_active = TRUE
      GROUP BY software_product_id
    ) e ON sp.product_id = e.software_product_id
    LEFT JOIN (
      SELECT 
        software_product_id,
        COUNT(*) as installation_count
      FROM software_installations
      WHERE status = 'ACTIVE'
      GROUP BY software_product_id
    ) i ON sp.product_id = i.software_product_id
    WHERE sp.is_active = TRUE
  `;

  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.productIds && filters.productIds.length > 0) {
    sql += ` AND sp.product_id = ANY($${paramIndex++})`;
    params.push(filters.productIds);
  }

  if (filters.publishers && filters.publishers.length > 0) {
    sql += ` AND sp.publisher = ANY($${paramIndex++})`;
    params.push(filters.publishers);
  }

  const row = await queryOne<SummaryRow>(sql, params);

  const totalProducts = parseInt(row?.total_products ?? '0', 10);
  const compliantProducts = parseInt(row?.compliant_products ?? '0', 10);

  return {
    totalProducts,
    compliantProducts,
    overLicensedProducts: parseInt(row?.over_licensed_products ?? '0', 10),
    underLicensedProducts: parseInt(row?.under_licensed_products ?? '0', 10),
    totalEntitlements: parseInt(row?.total_entitlements ?? '0', 10),
    totalInstallations: parseInt(row?.total_installations ?? '0', 10),
    totalLicenseCost: parseFloat(row?.total_license_cost ?? '0'),
    potentialRiskExposure: parseFloat(row?.potential_risk_exposure ?? '0'),
    complianceRate: totalProducts > 0 ? Math.round((compliantProducts / totalProducts) * 100) : 100,
  };
}

/**
 * Get distinct publishers for filtering
 */
export async function getDistinctPublishers(): Promise<string[]> {
  const rows = await queryMany<{ publisher: string }>(
    `SELECT DISTINCT publisher 
     FROM software_products 
     WHERE is_active = TRUE 
     ORDER BY publisher`
  );

  return rows.map((r) => r.publisher);
}
