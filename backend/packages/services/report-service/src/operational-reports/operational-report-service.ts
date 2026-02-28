/**
 * Operational Report Service - Core operational report generation logic
 *
 * Implements operational report generation including work order summaries,
 * maintenance compliance, stockroom inventory, and asset lifecycle reports.
 *
 * Requirements:
 * - 20.1: Work order summary report
 * - 20.2: Maintenance compliance report
 * - 20.3: Stockroom inventory report
 * - 20.4: Transfer order report
 * - 20.5: Asset lifecycle report
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as reportRepository from '../report/report-repository';
import {
  generateUUID,
  escapeCSVField,
  formatNumber,
  getDateMonthsAgo,
  formatDateRange,
} from '../utils/report-utils';
import type { ExportFormat, ReportMetadata } from '../report/report-types';
import * as operationalRepository from './operational-report-repository';
import type {
  AssetLifecycleReport,
  GenerateAssetLifecycleRequest,
  GenerateMaintenanceComplianceRequest,
  GenerateStockroomInventoryRequest,
  GenerateTransferOrderRequest,
  GenerateWorkOrderSummaryRequest,
  MaintenanceComplianceReport,
  OperationalReportFilters,
  OperationalReportResult,
  StockroomInventoryReport,
  TransferOrderReport,
  WorkOrderSummaryReport,
} from './operational-report-types';

const logger = createLogger({ service: 'operational-report-service' });

// ============================================================================
// Work Order Summary Report
// ============================================================================

/**
 * Generate a work order summary report
 *
 * Requirement 20.1: Work order counts by status, type, and priority with average completion times
 */
export async function generateWorkOrderSummaryReport(
  request: GenerateWorkOrderSummaryRequest,
  userId: UUID
): Promise<OperationalReportResult> {
  logger.info('Generating work order summary report', {
    format: request.format,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    userId,
  });

  validateWorkOrderSummaryRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  const dateTo = request.dateTo ?? now;
  const dateFrom = request.dateFrom ?? getDateMonthsAgo(3);

  try {
    const filters: OperationalReportFilters = request.filters ?? {};

    const [workOrderData, summary] = await Promise.all([
      operationalRepository.getWorkOrderSummaryData(filters, dateFrom, dateTo),
      operationalRepository.getWorkOrderSummarySummary(filters, dateFrom, dateTo),
    ]);

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'LIFECYCLE_STATUS',
      title: request.title ?? `Work Order Summary Report - ${formatDateRange(dateFrom, dateTo)}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: workOrderData.total,
    };

    const reportData: WorkOrderSummaryReport = {
      metadata,
      summary,
      rows: workOrderData.rows,
    };

    const content = await exportOperationalReport(reportData, request.format, 'WORK_ORDER_SUMMARY');

    await reportRepository.logReportAccess({
      reportId,
      reportType: 'LIFECYCLE_STATUS',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Work order summary report generated successfully', {
      reportId,
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
    logger.error('Failed to generate work order summary report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'LIFECYCLE_STATUS',
        title: request.title ?? 'Work Order Summary Report',
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

// ============================================================================
// Maintenance Compliance Report
// ============================================================================

/**
 * Generate a maintenance compliance report
 *
 * Requirement 20.2: Maintenance plan adherence rates and overdue maintenance items
 */
export async function generateMaintenanceComplianceReport(
  request: GenerateMaintenanceComplianceRequest,
  userId: UUID
): Promise<OperationalReportResult> {
  logger.info('Generating maintenance compliance report', {
    format: request.format,
    includeOverdueOnly: request.includeOverdueOnly,
    userId,
  });

  validateMaintenanceComplianceRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    const filters: OperationalReportFilters = request.filters ?? {};

    const [complianceData, summary] = await Promise.all([
      operationalRepository.getMaintenanceComplianceData(filters),
      operationalRepository.getMaintenanceComplianceSummary(filters),
    ]);

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'COMPLIANCE_SUMMARY',
      title: request.title ?? 'Maintenance Compliance Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: complianceData.total,
    };

    const reportData: MaintenanceComplianceReport = {
      metadata,
      summary,
      rows: complianceData.rows,
    };

    const content = await exportOperationalReport(reportData, request.format, 'MAINTENANCE_COMPLIANCE');

    await reportRepository.logReportAccess({
      reportId,
      reportType: 'COMPLIANCE_SUMMARY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Maintenance compliance report generated successfully', {
      reportId,
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
    logger.error('Failed to generate maintenance compliance report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'COMPLIANCE_SUMMARY',
        title: request.title ?? 'Maintenance Compliance Report',
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

// ============================================================================
// Stockroom Inventory Report
// ============================================================================

/**
 * Generate a stockroom inventory report
 *
 * Requirement 20.3: Current inventory levels with reorder alerts and utilization metrics
 */
export async function generateStockroomInventoryReport(
  request: GenerateStockroomInventoryRequest,
  userId: UUID
): Promise<OperationalReportResult> {
  logger.info('Generating stockroom inventory report', {
    format: request.format,
    includeReorderAlertsOnly: request.includeReorderAlertsOnly,
    userId,
  });

  validateStockroomInventoryRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    const filters: OperationalReportFilters = request.filters ?? {};

    const [inventoryData, summary] = await Promise.all([
      operationalRepository.getStockroomInventoryData(filters),
      operationalRepository.getStockroomInventorySummary(filters),
    ]);

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? 'Stockroom Inventory Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: inventoryData.total,
    };

    const reportData: StockroomInventoryReport = {
      metadata,
      summary,
      rows: inventoryData.rows,
    };

    const content = await exportOperationalReport(reportData, request.format, 'STOCKROOM_INVENTORY');

    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Stockroom inventory report generated successfully', {
      reportId,
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
    logger.error('Failed to generate stockroom inventory report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Stockroom Inventory Report',
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

// ============================================================================
// Transfer Order Report
// ============================================================================

/**
 * Generate a transfer order report
 *
 * Requirement 20.4: Transfer activity between stockrooms with average fulfillment times
 */
export async function generateTransferOrderReport(
  request: GenerateTransferOrderRequest,
  userId: UUID
): Promise<OperationalReportResult> {
  logger.info('Generating transfer order report', {
    format: request.format,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    userId,
  });

  validateTransferOrderRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  const dateTo = request.dateTo ?? now;
  const dateFrom = request.dateFrom ?? getDateMonthsAgo(3);

  try {
    const filters: OperationalReportFilters = request.filters ?? {};

    const [transferData, summary] = await Promise.all([
      operationalRepository.getTransferOrderData(filters, dateFrom, dateTo),
      operationalRepository.getTransferOrderSummary(filters, dateFrom, dateTo),
    ]);

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? `Transfer Order Report - ${formatDateRange(dateFrom, dateTo)}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: transferData.total,
    };

    const reportData: TransferOrderReport = {
      metadata,
      summary,
      rows: transferData.rows,
    };

    const content = await exportOperationalReport(reportData, request.format, 'TRANSFER_ORDER');

    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Transfer order report generated successfully', {
      reportId,
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
    logger.error('Failed to generate transfer order report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Transfer Order Report',
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

// ============================================================================
// Asset Lifecycle Report
// ============================================================================

/**
 * Generate an asset lifecycle report
 *
 * Requirement 20.5: Assets by lifecycle stage with average time in each stage
 */
export async function generateAssetLifecycleReport(
  request: GenerateAssetLifecycleRequest,
  userId: UUID
): Promise<OperationalReportResult> {
  logger.info('Generating asset lifecycle report', {
    format: request.format,
    userId,
  });

  validateAssetLifecycleRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    const filters: OperationalReportFilters = request.filters ?? {};

    const [lifecycleData, summary] = await Promise.all([
      operationalRepository.getAssetLifecycleData(filters),
      operationalRepository.getAssetLifecycleSummary(filters),
    ]);

    const metadata: ReportMetadata = {
      reportId,
      reportType: 'LIFECYCLE_STATUS',
      title: request.title ?? 'Asset Lifecycle Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: lifecycleData.total,
    };

    const reportData: AssetLifecycleReport = {
      metadata,
      summary,
      rows: lifecycleData.rows,
    };

    const content = await exportOperationalReport(reportData, request.format, 'ASSET_LIFECYCLE');

    await reportRepository.logReportAccess({
      reportId,
      reportType: 'LIFECYCLE_STATUS',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Asset lifecycle report generated successfully', {
      reportId,
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
    logger.error('Failed to generate asset lifecycle report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'LIFECYCLE_STATUS',
        title: request.title ?? 'Asset Lifecycle Report',
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

// ============================================================================
// Export Functions
// ============================================================================

type OperationalReportData = 
  | WorkOrderSummaryReport 
  | MaintenanceComplianceReport 
  | StockroomInventoryReport 
  | TransferOrderReport 
  | AssetLifecycleReport;

type OperationalReportType = 
  | 'WORK_ORDER_SUMMARY' 
  | 'MAINTENANCE_COMPLIANCE' 
  | 'STOCKROOM_INVENTORY' 
  | 'TRANSFER_ORDER' 
  | 'ASSET_LIFECYCLE';

async function exportOperationalReport(
  reportData: OperationalReportData,
  format: ExportFormat,
  reportType: OperationalReportType
): Promise<string> {
  switch (format) {
    case 'CSV':
      return exportOperationalToCSV(reportData, reportType);
    case 'EXCEL':
      return exportOperationalToExcel(reportData, reportType);
    case 'PDF':
      return exportOperationalToPDF(reportData, reportType);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

export function exportOperationalToCSV(
  reportData: OperationalReportData,
  _reportType: OperationalReportType
): string {
  const rows = getOperationalReportRows(reportData);
  if (rows.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const firstRow = rows[0];

  if (firstRow) {
    const headers = Object.keys(firstRow);
    lines.push(headers.map(h => escapeCSVField(h)).join(','));
  }

  for (const row of rows) {
    const values = Object.values(row).map(v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return formatNumber(v);
      if (typeof v === 'boolean') return v ? 'Yes' : 'No';
      if (v instanceof Date) return v.toISOString();
      return escapeCSVField(String(v));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

export function exportOperationalToExcel(
  reportData: OperationalReportData,
  reportType: OperationalReportType
): string {
  const rows = getOperationalReportRows(reportData);
  const firstRow = rows[0];
  const headers = firstRow ? Object.keys(firstRow) : [];

  const excelData = {
    sheetName: reportData.metadata.title,
    reportType,
    headers,
    rows: rows.map(row => Object.values(row)),
    summary: reportData.summary,
    freezeHeaders: true,
    autoFilter: true,
  };

  return Buffer.from(JSON.stringify(excelData)).toString('base64');
}

export function exportOperationalToPDF(
  reportData: OperationalReportData,
  reportType: OperationalReportType
): string {
  const rows = getOperationalReportRows(reportData);
  const firstRow = rows[0];
  const headers = firstRow ? Object.keys(firstRow) : [];

  const pdfData = {
    title: reportData.metadata.title,
    reportType,
    generatedAt: reportData.metadata.generatedAt,
    pageSize: 'A4',
    orientation: 'LANDSCAPE',
    headers,
    rows: rows.map(row => Object.values(row)),
    summary: reportData.summary,
    includeCharts: true,
    includeHeader: true,
    includeFooter: true,
  };

  return Buffer.from(JSON.stringify(pdfData)).toString('base64');
}

function getOperationalReportRows(reportData: OperationalReportData): Record<string, unknown>[] {
  return reportData.rows as unknown as Record<string, unknown>[];
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateWorkOrderSummaryRequest(request: GenerateWorkOrderSummaryRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  if (request.dateFrom && request.dateTo) {
    const fromDate = new Date(request.dateFrom);
    const toDate = new Date(request.dateTo);
    if (fromDate > toDate) {
      throw new Error('dateFrom must be before dateTo');
    }
  }
}

function validateMaintenanceComplianceRequest(request: GenerateMaintenanceComplianceRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }
}

function validateStockroomInventoryRequest(request: GenerateStockroomInventoryRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }
}

function validateTransferOrderRequest(request: GenerateTransferOrderRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  if (request.dateFrom && request.dateTo) {
    const fromDate = new Date(request.dateFrom);
    const toDate = new Date(request.dateTo);
    if (fromDate > toDate) {
      throw new Error('dateFrom must be before dateTo');
    }
  }
}

function validateAssetLifecycleRequest(request: GenerateAssetLifecycleRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// Helper functions imported from ../utils/report-utils:
// - escapeCSVField, formatNumber, getDateMonthsAgo, formatDateRange, generateUUID
