/**
 * Report Service - Core report generation logic
 *
 * Implements report generation with multiple export formats.
 *
 * Requirements:
 * - 16.1: Generate standard reports: Asset Inventory, Compliance Summary, Cost Analysis, Lifecycle Status
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 * - 16.9: Log report access for audit purposes
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { createLogger } from '@ams/utils';

import * as reportRepository from './report-repository';
import { generateUUID } from '../utils/report-utils';
import {
  exportReportToCSV,
  exportReportToExcel,
  exportReportToPDF,
} from '../export';

import type {
  AssetInventoryReport,
  ComplianceSummaryReport,
  CostAnalysisReport,
  ExportFormat,
  GenerateReportRequest,
  GenerateReportResult,
  LifecycleStatusReport,
  ReportAccessLog,
  ReportAccessLogQuery,
  ReportData,
  ReportFilters,
  ReportMetadata,
  ReportType,
} from './report-types';

const logger = createLogger({ service: 'report-service' });

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Generate a report based on the request
 *
 * Requirement 16.1: Generate standard reports
 * Requirement 16.3: Export reports in PDF, Excel, and CSV formats
 * Requirement 16.9: Log report access for audit purposes
 *
 * @param request - The report generation request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateReport(
  request: GenerateReportRequest,
  userId: UUID
): Promise<GenerateReportResult> {
  logger.info('Generating report', {
    reportType: request.reportType,
    format: request.format,
    userId,
  });

  // Validate request
  validateGenerateRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Generate report data based on type
    const reportData = await generateReportData(request.reportType, request.filters ?? {});

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: request.reportType,
      title: request.title ?? getDefaultTitle(request.reportType),
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: request.filters ?? {},
      totalRecords: getRecordCount(reportData),
    };

    // Export to requested format
    const content = await exportReport(reportData, request.format, {
      includeCharts: request.includeCharts,
    });

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: request.reportType,
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: request.filters,
    });

    logger.info('Report generated successfully', {
      reportId,
      reportType: request.reportType,
      format: request.format,
      totalRecords: metadata.totalRecords,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate report', err, {
      reportId,
      reportType: request.reportType,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: request.reportType,
        title: request.title ?? getDefaultTitle(request.reportType),
        generatedAt: now,
        generatedBy: userId,
        format: request.format,
        filters: request.filters ?? {},
        totalRecords: 0,
      },
      errorMessage: err.message,
    };
  }
}

/**
 * Generate report data based on report type
 */
async function generateReportData(
  reportType: ReportType,
  filters: ReportFilters
): Promise<ReportData> {
  // Check cache for report data (5 min TTL)
  const filterKey = JSON.stringify(filters);
  const cacheKey = `ams:${CACHE_ENTITY_TYPES.REPORT}:${reportType}:${filterKey}`;
  const cached = await cache.get<ReportData>(cacheKey);
  if (cached) {
    return cached;
  }

  let result: ReportData;
  switch (reportType) {
    case 'ASSET_INVENTORY':
      result = await generateAssetInventoryReport(filters);
      break;
    case 'COMPLIANCE_SUMMARY':
      result = await generateComplianceSummaryReport(filters);
      break;
    case 'COST_ANALYSIS':
      result = await generateCostAnalysisReport(filters);
      break;
    case 'LIFECYCLE_STATUS':
      result = await generateLifecycleStatusReport(filters);
      break;
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }

  // Cache report data with 5 min TTL
  await cache.set(cacheKey, result, { ttl: 300 });
  return result;
}

// ============================================================================
// Report Type Generators
// ============================================================================

/**
 * Generate Asset Inventory Report
 * Requirement 16.1: Asset Inventory report
 */
async function generateAssetInventoryReport(
  filters: ReportFilters
): Promise<AssetInventoryReport> {
  logger.debug('Generating asset inventory report', { filters });

  const [inventoryData, summary] = await Promise.all([
    reportRepository.getAssetInventoryData(filters),
    reportRepository.getAssetInventorySummary(filters),
  ]);

  const now = new Date().toISOString();

  return {
    metadata: {
      reportId: generateUUID(),
      reportType: 'ASSET_INVENTORY',
      title: 'Asset Inventory Report',
      generatedAt: now,
      generatedBy: '',
      format: 'CSV',
      filters,
      totalRecords: inventoryData.total,
    },
    summary,
    rows: inventoryData.rows,
  };
}

/**
 * Generate Compliance Summary Report
 * Requirement 16.1: Compliance Summary report
 */
async function generateComplianceSummaryReport(
  filters: ReportFilters
): Promise<ComplianceSummaryReport> {
  logger.debug('Generating compliance summary report', { filters });

  const [complianceData, summary] = await Promise.all([
    reportRepository.getComplianceData(filters),
    reportRepository.getComplianceSummary(filters),
  ]);

  const now = new Date().toISOString();

  return {
    metadata: {
      reportId: generateUUID(),
      reportType: 'COMPLIANCE_SUMMARY',
      title: 'Compliance Summary Report',
      generatedAt: now,
      generatedBy: '',
      format: 'CSV',
      filters,
      totalRecords: complianceData.total,
    },
    summary,
    rows: complianceData.rows,
  };
}

/**
 * Generate Cost Analysis Report
 * Requirement 16.1: Cost Analysis report
 */
async function generateCostAnalysisReport(
  filters: ReportFilters
): Promise<CostAnalysisReport> {
  logger.debug('Generating cost analysis report', { filters });

  const [costData, trendData, summary] = await Promise.all([
    reportRepository.getCostAnalysisData(filters),
    reportRepository.getCostTrendData(filters),
    reportRepository.getCostAnalysisSummary(filters),
  ]);

  const now = new Date().toISOString();

  return {
    metadata: {
      reportId: generateUUID(),
      reportType: 'COST_ANALYSIS',
      title: 'Cost Analysis Report',
      generatedAt: now,
      generatedBy: '',
      format: 'CSV',
      filters,
      totalRecords: costData.length,
    },
    summary,
    byCategory: costData,
    trends: trendData,
  };
}

/**
 * Generate Lifecycle Status Report
 * Requirement 16.1: Lifecycle Status report
 */
async function generateLifecycleStatusReport(
  filters: ReportFilters
): Promise<LifecycleStatusReport> {
  logger.debug('Generating lifecycle status report', { filters });

  const [lifecycleData, summary] = await Promise.all([
    reportRepository.getLifecycleStatusData(filters),
    reportRepository.getLifecycleSummary(filters),
  ]);

  const now = new Date().toISOString();

  return {
    metadata: {
      reportId: generateUUID(),
      reportType: 'LIFECYCLE_STATUS',
      title: 'Lifecycle Status Report',
      generatedAt: now,
      generatedBy: '',
      format: 'CSV',
      filters,
      totalRecords: lifecycleData.total,
    },
    summary,
    rows: lifecycleData.rows,
  };
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export report to specified format using the unified export module
 * Requirement 16.3: Export reports in PDF, Excel, and CSV formats
 */
async function exportReport(
  reportData: ReportData,
  format: ExportFormat,
  _options?: { includeCharts?: boolean }
): Promise<string> {
  const rows = getReportRows(reportData);
  const title = reportData.metadata.title;
  const generatedAt = reportData.metadata.generatedAt;
  const generatedBy = reportData.metadata.generatedBy;
  const summary = 'summary' in reportData ? reportData.summary as Record<string, unknown> : undefined;

  switch (format) {
    case 'CSV':
      return exportReportToCSV(title, generatedAt, rows);
    case 'EXCEL':
      return exportReportToExcel(title, generatedAt, generatedBy, rows, undefined, summary);
    case 'PDF':
      return exportReportToPDF(title, generatedAt, generatedBy, rows, undefined, summary);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ============================================================================
// Report Access Logging
// ============================================================================

/**
 * Log report download
 * Requirement 16.9: Log report access for audit purposes
 */
export async function logReportDownload(
  reportId: UUID,
  userId: UUID,
  format: ExportFormat,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await reportRepository.logReportAccess({
    reportId,
    reportType: 'ASSET_INVENTORY', // Would be retrieved from report metadata
    accessedBy: userId,
    accessedAt: new Date().toISOString(),
    action: 'DOWNLOADED',
    format,
    ipAddress,
    userAgent,
  });
}

/**
 * Log report view
 * Requirement 16.9: Log report access for audit purposes
 */
export async function logReportView(
  reportId: UUID,
  userId: UUID,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await reportRepository.logReportAccess({
    reportId,
    reportType: 'ASSET_INVENTORY', // Would be retrieved from report metadata
    accessedBy: userId,
    accessedAt: new Date().toISOString(),
    action: 'VIEWED',
    format: 'PDF', // Default format for viewing
    ipAddress,
    userAgent,
  });
}

/**
 * Get report access logs
 */
export async function getReportAccessLogs(
  query: ReportAccessLogQuery
): Promise<{ logs: ReportAccessLog[]; total: number }> {
  return reportRepository.getReportAccessLogs(query);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate generate report request
 */
function validateGenerateRequest(request: GenerateReportRequest): void {
  if (!request.reportType) {
    throw new Error('Report type is required');
  }

  const validReportTypes: ReportType[] = [
    'ASSET_INVENTORY',
    'COMPLIANCE_SUMMARY',
    'COST_ANALYSIS',
    'LIFECYCLE_STATUS',
  ];

  if (!validReportTypes.includes(request.reportType)) {
    throw new Error(`Invalid report type: ${request.reportType}. Valid types are: ${validReportTypes.join(', ')}`);
  }

  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];

  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  // Validate filters if provided
  if (request.filters) {
    validateFilters(request.filters);
  }
}

/**
 * Validate report filters
 */
function validateFilters(filters: ReportFilters): void {
  if (filters.assetType && !['HARDWARE', 'SOFTWARE', 'ENTERPRISE', 'ALL'].includes(filters.assetType)) {
    throw new Error(`Invalid asset type filter: ${filters.assetType}`);
  }

  if (filters.assetStatus) {
    const validStatuses = [
      'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
      'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED', 'ALL'
    ];
    if (!validStatuses.includes(filters.assetStatus)) {
      throw new Error(`Invalid asset status filter: ${filters.assetStatus}`);
    }
  }

  if (filters.dateFrom && filters.dateTo) {
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);
    if (fromDate > toDate) {
      throw new Error('dateFrom must be before dateTo');
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default title for report type
 */
function getDefaultTitle(reportType: ReportType): string {
  const titles: Record<ReportType, string> = {
    ASSET_INVENTORY: 'Asset Inventory Report',
    COMPLIANCE_SUMMARY: 'Compliance Summary Report',
    COST_ANALYSIS: 'Cost Analysis Report',
    LIFECYCLE_STATUS: 'Lifecycle Status Report',
    DEPRECIATION_SCHEDULE: 'Depreciation Schedule Report',
    ASSET_VALUATION: 'Asset Valuation Report',
    BUDGET_UTILIZATION: 'Budget Utilization Report',
    CUSTOM: 'Custom Report',
  };
  return titles[reportType];
}

/**
 * Get record count from report data
 */
function getRecordCount(reportData: ReportData): number {
  if ('rows' in reportData) {
    return reportData.rows.length;
  }
  if ('byCategory' in reportData) {
    return reportData.byCategory.length;
  }
  return 0;
}

/**
 * Get rows from report data for export
 */
function getReportRows(reportData: ReportData): Record<string, unknown>[] {
  if ('rows' in reportData) {
    return reportData.rows as unknown as Record<string, unknown>[];
  }
  if ('byCategory' in reportData) {
    return reportData.byCategory as unknown as Record<string, unknown>[];
  }
  return [];
}

