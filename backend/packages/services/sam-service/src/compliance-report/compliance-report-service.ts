/**
 * Compliance Report Service - Business logic for compliance reporting
 *
 * Implements:
 * - Generate audit-ready reports showing license ownership and usage evidence (Requirement 4.14)
 * - Support PDF, Excel, CSV export formats (Requirement 16.7)
 * - Include audit trail information for compliance
 *
 * Requirements: 4.14, 16.7
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { publishEvent } from '@ams/events';
import { createLogger, now } from '@ams/utils';
import { v4 as uuidv4 } from 'uuid';

import type {
  AuditTrailEntry,
  ComplianceReportSummary,
  ComplianceStatusFilter,
  EntitlementDetail,
  ExportFormat,
  InstallationDetail,
  LicenseOwnershipEvidence,
  ProductComplianceData,
  ReportFilterOptions,
} from './compliance-report-repository';
import * as repository from './compliance-report-repository';

const logger = createLogger({ service: 'compliance-report-service' });

/**
 * Cache keys
 */
function reportCacheKey(reportId: UUID): string {
  return `compliance-report:${reportId}`;
}

function summaryCacheKey(filterHash: string): string {
  return `compliance-report:summary:${filterHash}`;
}

/**
 * Product compliance detail with evidence
 */
export interface ProductComplianceDetail extends ProductComplianceData {
  readonly entitlements: readonly EntitlementDetail[];
  readonly installations: readonly InstallationDetail[];
  readonly ownershipEvidence: readonly LicenseOwnershipEvidence[];
  readonly auditTrail: readonly AuditTrailEntry[];
}

/**
 * Compliance report data structure
 */
export interface ComplianceReport {
  readonly reportId: UUID;
  readonly reportType: 'FULL' | 'SUMMARY' | 'BY_PUBLISHER' | 'AUDIT_PREP';
  readonly generatedAt: string;
  readonly generatedBy: UUID | null;
  readonly filters: ReportFilterOptions;
  readonly summary: ComplianceReportSummary;
  readonly products: readonly ProductComplianceDetail[];
  readonly metadata: ReportMetadata;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  readonly title: string;
  readonly description: string;
  readonly generationDurationMs: number;
  readonly productCount: number;
  readonly entitlementCount: number;
  readonly installationCount: number;
  readonly evidenceCount: number;
  readonly auditEntryCount: number;
}

/**
 * Report generation request
 */
export interface GenerateReportRequest {
  readonly reportType?: 'FULL' | 'SUMMARY' | 'BY_PUBLISHER' | 'AUDIT_PREP';
  readonly filters?: ReportFilterOptions;
  readonly generatedBy?: UUID;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  readonly reportId: UUID;
  readonly format: ExportFormat;
  readonly filename: string;
  readonly content: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly generatedAt: string;
}

/**
 * Generate a simple hash for filter options (for caching)
 */
function hashFilters(filters: ReportFilterOptions): string {
  return Buffer.from(JSON.stringify(filters)).toString('base64').slice(0, 32);
}

/**
 * Generate compliance report
 * Requirement 4.14: Generate audit-ready reports showing license ownership and usage evidence
 *
 * @param request - Report generation request
 * @returns Complete compliance report
 */
export async function generateComplianceReport(
  request: GenerateReportRequest = {}
): Promise<ComplianceReport> {
  const reportId = uuidv4();
  const startTime = Date.now();
  const generatedAt = now();

  const reportType = request.reportType ?? 'FULL';
  const filters = request.filters ?? {};

  logger.info('Generating compliance report', {
    reportId,
    reportType,
    filters,
  });

  // Get summary first
  const summary = await repository.getComplianceReportSummary(filters);

  // Get product compliance data
  const productData = await repository.getProductComplianceData(filters);

  // Build detailed product information
  const products: ProductComplianceDetail[] = [];
  let totalEntitlements = 0;
  let totalInstallations = 0;
  let totalEvidence = 0;
  let totalAuditEntries = 0;

  for (const product of productData) {
    // Get entitlements for this product
    const entitlements = await repository.getEntitlementDetails(product.productId);
    totalEntitlements += entitlements.length;

    // Get installations if requested
    let installations: InstallationDetail[] = [];
    if (filters.includeInstallations !== false) {
      installations = await repository.getInstallationDetails(product.productId);
      totalInstallations += installations.length;
    }

    // Get ownership evidence if requested
    let ownershipEvidence: LicenseOwnershipEvidence[] = [];
    if (filters.includeEvidence !== false && entitlements.length > 0) {
      const entitlementIds = entitlements.map((e) => e.entitlementId);
      ownershipEvidence = await repository.getLicenseOwnershipEvidence(entitlementIds);
      totalEvidence += ownershipEvidence.length;
    }

    // Get audit trail if requested
    let auditTrail: AuditTrailEntry[] = [];
    if (filters.includeAuditTrail === true && entitlements.length > 0) {
      const entitlementIds = entitlements.map((e) => e.entitlementId);
      auditTrail = await repository.getComplianceAuditTrail(
        'ENTITLEMENT',
        entitlementIds,
        filters.startDate,
        filters.endDate
      );
      totalAuditEntries += auditTrail.length;
    }

    products.push({
      ...product,
      entitlements,
      installations,
      ownershipEvidence,
      auditTrail,
    });
  }

  const generationDurationMs = Date.now() - startTime;

  const metadata: ReportMetadata = {
    title: request.title ?? `Software License Compliance Report - ${reportType}`,
    description: request.description ?? 'Audit-ready compliance report showing license ownership and usage evidence',
    generationDurationMs,
    productCount: products.length,
    entitlementCount: totalEntitlements,
    installationCount: totalInstallations,
    evidenceCount: totalEvidence,
    auditEntryCount: totalAuditEntries,
  };

  const report: ComplianceReport = {
    reportId,
    reportType,
    generatedAt,
    generatedBy: request.generatedBy ?? null,
    filters,
    summary,
    products,
    metadata,
  };

  // Cache the report
  await cache.set(reportCacheKey(reportId), report, cache.DEFAULT_TTL.LONG);

  // Publish report generated event
  await publishEvent('COMPLIANCE_REPORT_GENERATED', {
    reportId,
    reportType,
    generatedBy: request.generatedBy,
    productCount: products.length,
    complianceRate: summary.complianceRate,
    potentialRiskExposure: summary.potentialRiskExposure,
    generationDurationMs,
  });

  logger.info('Compliance report generated', {
    reportId,
    reportType,
    productCount: products.length,
    generationDurationMs,
  });

  return report;
}

/**
 * Get a previously generated report by ID
 */
export async function getReport(reportId: UUID): Promise<ComplianceReport | null> {
  const cacheKey = reportCacheKey(reportId);
  const cached = await cache.get<ComplianceReport>(cacheKey);
  return cached;
}

/**
 * Get compliance summary (cached)
 */
export async function getComplianceSummary(
  filters: ReportFilterOptions = {}
): Promise<ComplianceReportSummary> {
  const filterHash = hashFilters(filters);
  const cacheKey = summaryCacheKey(filterHash);

  // Try cache first
  const cached = await cache.get<ComplianceReportSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const summary = await repository.getComplianceReportSummary(filters);

  // Cache the result
  await cache.set(cacheKey, summary, cache.DEFAULT_TTL.SHORT);

  return summary;
}

/**
 * Export report to specified format
 * Requirement 16.7: Support PDF, Excel, CSV export formats
 *
 * @param reportId - Report ID to export
 * @param format - Export format (PDF, EXCEL, CSV)
 * @returns Export result with content
 */
export async function exportReport(
  reportId: UUID,
  format: ExportFormat
): Promise<ExportResult> {
  logger.info('Exporting compliance report', { reportId, format });

  // Get the report
  const report = await getReport(reportId);
  if (!report) {
    throw new Error(`Report not found: ${reportId}`);
  }

  let content: string;
  let contentType: string;
  let filename: string;

  switch (format) {
    case 'CSV':
      content = generateCSVContent(report);
      contentType = 'text/csv';
      filename = `compliance-report-${reportId}.csv`;
      break;

    case 'EXCEL':
      content = generateExcelContent(report);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `compliance-report-${reportId}.xlsx`;
      break;

    case 'PDF':
      content = generatePDFContent(report);
      contentType = 'application/pdf';
      filename = `compliance-report-${reportId}.pdf`;
      break;

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  const result: ExportResult = {
    reportId,
    format,
    filename,
    content,
    contentType,
    sizeBytes: Buffer.byteLength(content, 'utf8'),
    generatedAt: now(),
  };

  // Publish export event
  await publishEvent('COMPLIANCE_REPORT_EXPORTED', {
    reportId,
    format,
    filename,
    sizeBytes: result.sizeBytes,
  });

  logger.info('Compliance report exported', {
    reportId,
    format,
    filename,
    sizeBytes: result.sizeBytes,
  });

  return result;
}

/**
 * Generate CSV content from report
 */
function generateCSVContent(report: ComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push('Software License Compliance Report');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Report Type: ${report.reportType}`);
  lines.push('');

  // Summary section
  lines.push('SUMMARY');
  lines.push(`Total Products,${report.summary.totalProducts}`);
  lines.push(`Compliant Products,${report.summary.compliantProducts}`);
  lines.push(`Over-Licensed Products,${report.summary.overLicensedProducts}`);
  lines.push(`Under-Licensed Products,${report.summary.underLicensedProducts}`);
  lines.push(`Compliance Rate,${report.summary.complianceRate}%`);
  lines.push(`Total License Cost,$${report.summary.totalLicenseCost.toFixed(2)}`);
  lines.push(`Potential Risk Exposure,$${report.summary.potentialRiskExposure.toFixed(2)}`);
  lines.push('');

  // Product details header
  lines.push('PRODUCT COMPLIANCE DETAILS');
  lines.push('Publisher,Product Name,Version,Edition,Entitlements Owned,Installations Found,Compliance Position,Over/Under Count,Compliance %,Total Cost,Potential Risk');

  // Product rows
  for (const product of report.products) {
    const row = [
      escapeCSV(product.publisher),
      escapeCSV(product.productName),
      escapeCSV(product.version ?? ''),
      escapeCSV(product.edition ?? ''),
      product.entitlementsOwned.toString(),
      product.installationsFound.toString(),
      product.compliancePosition,
      product.overUnderCount.toString(),
      product.compliancePercentage.toFixed(1),
      product.totalLicenseCost.toFixed(2),
      product.potentialRisk.toFixed(2),
    ];
    lines.push(row.join(','));
  }

  lines.push('');

  // Entitlement details
  lines.push('ENTITLEMENT DETAILS');
  lines.push('Publisher,Product Name,License Type,Metric Type,Qty Purchased,Qty Available,Unit Cost,Start Date,End Date,Contract #,PO #,Vendor');

  for (const product of report.products) {
    for (const entitlement of product.entitlements) {
      const row = [
        escapeCSV(product.publisher),
        escapeCSV(product.productName),
        escapeCSV(entitlement.licenseType),
        escapeCSV(entitlement.metricType),
        entitlement.quantityPurchased.toString(),
        entitlement.quantityAvailable.toString(),
        entitlement.unitCost?.toFixed(2) ?? '',
        entitlement.startDate ?? '',
        entitlement.endDate ?? '',
        escapeCSV(entitlement.contractNumber ?? ''),
        escapeCSV(entitlement.purchaseOrderNumber ?? ''),
        escapeCSV(entitlement.vendorName ?? ''),
      ];
      lines.push(row.join(','));
    }
  }

  return lines.join('\n');
}

/**
 * Generate Excel content from report (simplified XML format)
 * In production, would use a library like exceljs
 */
function generateExcelContent(report: ComplianceReport): string {
  // Generate a simplified Excel XML format
  // In production, this would use a proper Excel library
  const xml: string[] = [];

  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push('<?mso-application progid="Excel.Sheet"?>');
  xml.push('<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">');

  // Summary worksheet
  xml.push('<Worksheet ss:Name="Summary">');
  xml.push('<Table>');
  xml.push('<Row><Cell><Data ss:Type="String">Software License Compliance Report</Data></Cell></Row>');
  xml.push(`<Row><Cell><Data ss:Type="String">Generated: ${report.generatedAt}</Data></Cell></Row>`);
  xml.push('<Row></Row>');
  xml.push(`<Row><Cell><Data ss:Type="String">Total Products</Data></Cell><Cell><Data ss:Type="Number">${report.summary.totalProducts}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Compliant Products</Data></Cell><Cell><Data ss:Type="Number">${report.summary.compliantProducts}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Over-Licensed Products</Data></Cell><Cell><Data ss:Type="Number">${report.summary.overLicensedProducts}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Under-Licensed Products</Data></Cell><Cell><Data ss:Type="Number">${report.summary.underLicensedProducts}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Compliance Rate</Data></Cell><Cell><Data ss:Type="Number">${report.summary.complianceRate}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Total License Cost</Data></Cell><Cell><Data ss:Type="Number">${report.summary.totalLicenseCost}</Data></Cell></Row>`);
  xml.push(`<Row><Cell><Data ss:Type="String">Potential Risk Exposure</Data></Cell><Cell><Data ss:Type="Number">${report.summary.potentialRiskExposure}</Data></Cell></Row>`);
  xml.push('</Table>');
  xml.push('</Worksheet>');

  // Products worksheet
  xml.push('<Worksheet ss:Name="Products">');
  xml.push('<Table>');
  xml.push('<Row>');
  xml.push('<Cell><Data ss:Type="String">Publisher</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Product Name</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Version</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Entitlements Owned</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Installations Found</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Compliance Position</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Over/Under Count</Data></Cell>');
  xml.push('<Cell><Data ss:Type="String">Total Cost</Data></Cell>');
  xml.push('</Row>');

  for (const product of report.products) {
    xml.push('<Row>');
    xml.push(`<Cell><Data ss:Type="String">${escapeXML(product.publisher)}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="String">${escapeXML(product.productName)}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="String">${escapeXML(product.version ?? '')}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="Number">${product.entitlementsOwned}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="Number">${product.installationsFound}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="String">${product.compliancePosition}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="Number">${product.overUnderCount}</Data></Cell>`);
    xml.push(`<Cell><Data ss:Type="Number">${product.totalLicenseCost}</Data></Cell>`);
    xml.push('</Row>');
  }

  xml.push('</Table>');
  xml.push('</Worksheet>');

  xml.push('</Workbook>');

  return xml.join('\n');
}

/**
 * Generate PDF content from report (simplified text format)
 * In production, would use a library like pdfkit
 */
function generatePDFContent(report: ComplianceReport): string {
  // Generate a simplified text representation
  // In production, this would use a proper PDF library
  const lines: string[] = [];

  lines.push('SOFTWARE LICENSE COMPLIANCE REPORT');
  lines.push('='.repeat(50));
  lines.push('');
  lines.push(`Report ID: ${report.reportId}`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Report Type: ${report.reportType}`);
  lines.push('');

  lines.push('EXECUTIVE SUMMARY');
  lines.push('-'.repeat(30));
  lines.push(`Total Software Products: ${report.summary.totalProducts}`);
  lines.push(`Compliant: ${report.summary.compliantProducts} (${report.summary.complianceRate}%)`);
  lines.push(`Over-Licensed: ${report.summary.overLicensedProducts}`);
  lines.push(`Under-Licensed: ${report.summary.underLicensedProducts}`);
  lines.push('');
  lines.push(`Total License Investment: $${report.summary.totalLicenseCost.toLocaleString()}`);
  lines.push(`Potential Risk Exposure: $${report.summary.potentialRiskExposure.toLocaleString()}`);
  lines.push('');

  lines.push('COMPLIANCE DETAILS BY PRODUCT');
  lines.push('-'.repeat(30));

  for (const product of report.products) {
    lines.push('');
    lines.push(`${product.publisher} - ${product.productName}`);
    if (product.version) {
      lines.push(`  Version: ${product.version}`);
    }
    lines.push(`  Compliance Status: ${product.compliancePosition}`);
    lines.push(`  Entitlements Owned: ${product.entitlementsOwned}`);
    lines.push(`  Installations Found: ${product.installationsFound}`);
    lines.push(`  Variance: ${product.overUnderCount > 0 ? '+' : ''}${product.overUnderCount}`);

    if (product.entitlements.length > 0) {
      lines.push('  License Evidence:');
      for (const ent of product.entitlements) {
        lines.push(`    - ${ent.licenseType} (${ent.metricType}): ${ent.quantityPurchased} licenses`);
        if (ent.contractNumber) {
          lines.push(`      Contract: ${ent.contractNumber}`);
        }
        if (ent.purchaseOrderNumber) {
          lines.push(`      PO: ${ent.purchaseOrderNumber}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('='.repeat(50));
  lines.push('END OF REPORT');

  return lines.join('\n');
}

/**
 * Escape CSV special characters
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Escape XML special characters
 */
function escapeXML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get available publishers for filtering
 */
export async function getAvailablePublishers(): Promise<string[]> {
  return repository.getDistinctPublishers();
}

/**
 * Get products with compliance issues
 */
export async function getComplianceIssues(
  status: ComplianceStatusFilter = 'UNDER_LICENSED'
): Promise<ProductComplianceData[]> {
  return repository.getProductComplianceData({
    complianceStatus: status,
  });
}

// Re-export types
export type {
  AuditTrailEntry,
  ComplianceReportSummary,
  ComplianceStatusFilter,
  EntitlementDetail,
  ExportFormat,
  InstallationDetail,
  LicenseOwnershipEvidence,
  ProductComplianceData,
  ReportFilterOptions,
} from './compliance-report-repository';
