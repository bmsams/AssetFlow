/**
 * Financial Report Service - Core financial report generation logic
 *
 * Implements financial report generation including depreciation schedules,
 * asset valuations, and budget utilization reports.
 *
 * Requirements:
 * - 16.6: Analytics Dashboard with asset cost trends, depreciation summaries, and budget utilization
 * - 16.8: Financial Report Service for depreciation schedules and asset valuation reports
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as reportRepository from '../report/report-repository';
import {
  generateUUID,
  escapeCSVField,
  formatNumber,
  formatDate,
  getDateMonthsAgo,
  formatDateRange,
} from '../utils/report-utils';
import type {
  AssetValuationReport,
  BudgetPeriodDetail,
  BudgetUtilizationReport,
  DepreciationScheduleReport,
  ExportFormat,
  FinancialReportFilters,
  FinancialReportResult,
  FiscalPeriodType,
  GenerateAssetValuationRequest,
  GenerateBudgetUtilizationRequest,
  GenerateDepreciationScheduleRequest,
  GenerateProcurementSpendingRequest,
  GenerateVendorSpendingAnalysisRequest,
  ProcurementSpendingReport,
  ReportMetadata,
  VendorSpendingAnalysisReport,
} from '../report/report-types';
import * as financialRepository from './financial-report-repository';

const logger = createLogger({ service: 'financial-report-service' });

// ============================================================================
// Depreciation Schedule Report
// ============================================================================

/**
 * Generate a depreciation schedule report
 *
 * Requirement 16.8: Generate depreciation schedules showing asset value over time
 *
 * @param request - The depreciation schedule report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateDepreciationScheduleReport(
  request: GenerateDepreciationScheduleRequest,
  userId: UUID
): Promise<FinancialReportResult> {
  logger.info('Generating depreciation schedule report', {
    format: request.format,
    fiscalYear: request.fiscalYear,
    userId,
  });

  // Validate request
  validateDepreciationScheduleRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  const fiscalYear = request.fiscalYear ?? financialRepository.getCurrentFiscalYear();
  const fiscalPeriodType = request.fiscalPeriodType ?? 'MONTHLY';

  try {
    // Get depreciation schedule data
    const filters: FinancialReportFilters = {
      ...request.filters,
      includeFullyDepreciated: request.includeFullyDepreciated ?? false,
    };

    const [scheduleData, summary] = await Promise.all([
      financialRepository.getDepreciationScheduleData(
        filters,
        fiscalYear,
        request.fiscalPeriod,
        fiscalPeriodType
      ),
      financialRepository.getDepreciationScheduleSummary(filters, fiscalYear),
    ]);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'DEPRECIATION_SCHEDULE',
      title: request.title ?? `Depreciation Schedule Report - FY${fiscalYear}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: filters,
      totalRecords: scheduleData.total,
    };

    // Build report data
    const reportData: DepreciationScheduleReport = {
      metadata,
      summary,
      rows: scheduleData.rows,
      fiscalYear,
      fiscalPeriod: request.fiscalPeriod,
      fiscalPeriodType,
    };

    // Export to requested format
    const content = await exportFinancialReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'DEPRECIATION_SCHEDULE',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Depreciation schedule report generated successfully', {
      reportId,
      fiscalYear,
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
    logger.error('Failed to generate depreciation schedule report', err, {
      reportId,
      fiscalYear,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'DEPRECIATION_SCHEDULE',
        title: request.title ?? `Depreciation Schedule Report - FY${fiscalYear}`,
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
// Asset Valuation Report
// ============================================================================

/**
 * Generate an asset valuation report
 *
 * Requirement 16.8: Generate asset valuation reports with current values and depreciation
 *
 * @param request - The asset valuation report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateAssetValuationReport(
  request: GenerateAssetValuationRequest,
  userId: UUID
): Promise<FinancialReportResult> {
  logger.info('Generating asset valuation report', {
    format: request.format,
    valuationDate: request.valuationDate,
    userId,
  });

  // Validate request
  validateAssetValuationRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  const valuationDate = request.valuationDate ?? now;

  try {
    // Get asset valuation data
    const filters: FinancialReportFilters = request.filters ?? {};

    const [valuationData, summary] = await Promise.all([
      financialRepository.getAssetValuationData(filters, valuationDate),
      financialRepository.getAssetValuationSummary(filters, valuationDate),
    ]);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_VALUATION',
      title: request.title ?? `Asset Valuation Report - ${formatDate(valuationDate)}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: valuationData.total,
    };

    // Build report data
    const reportData: AssetValuationReport = {
      metadata,
      summary,
      rows: valuationData.rows,
      valuationDate,
    };

    // Export to requested format
    const content = await exportFinancialReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_VALUATION',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Asset valuation report generated successfully', {
      reportId,
      valuationDate,
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
    logger.error('Failed to generate asset valuation report', err, {
      reportId,
      valuationDate,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_VALUATION',
        title: request.title ?? `Asset Valuation Report - ${formatDate(valuationDate)}`,
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
// Budget Utilization Report
// ============================================================================

/**
 * Generate a budget utilization report
 *
 * Requirement 16.6: Generate budget utilization reports showing spend vs budget by cost center
 *
 * @param request - The budget utilization report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateBudgetUtilizationReport(
  request: GenerateBudgetUtilizationRequest,
  userId: UUID
): Promise<FinancialReportResult> {
  logger.info('Generating budget utilization report', {
    format: request.format,
    fiscalYear: request.fiscalYear,
    userId,
  });

  // Validate request
  validateBudgetUtilizationRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  const fiscalYear = request.fiscalYear ?? financialRepository.getCurrentFiscalYear();

  try {
    // Get budget utilization data
    const filters: FinancialReportFilters = request.filters ?? {};

    const [utilizationData, summary] = await Promise.all([
      financialRepository.getBudgetUtilizationData(filters, fiscalYear),
      financialRepository.getBudgetUtilizationSummary(filters, fiscalYear),
    ]);

    // Get period details if requested
    let periodDetails: BudgetPeriodDetail[] | undefined;
    if (request.includePeriodDetails) {
      periodDetails = await financialRepository.getBudgetPeriodDetails(
        filters,
        fiscalYear,
        'MONTHLY'
      );
    }

    // Get projections if requested
    let projectedSummary = summary;
    if (request.includeProjections) {
      const projections = await financialRepository.getProjectedYearEndSpend(
        filters,
        fiscalYear,
        now
      );
      projectedSummary = {
        ...summary,
        projectedYearEndSpend: projections.projectedSpend,
        projectedYearEndVariance: projections.projectedVariance,
      };
    }

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'BUDGET_UTILIZATION',
      title: request.title ?? `Budget Utilization Report - FY${fiscalYear}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: utilizationData.total,
    };

    // Build report data
    const reportData: BudgetUtilizationReport = {
      metadata,
      summary: projectedSummary,
      rows: utilizationData.rows,
      periodDetails,
      fiscalYear,
      asOfDate: now,
    };

    // Export to requested format
    const content = await exportFinancialReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'BUDGET_UTILIZATION',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Budget utilization report generated successfully', {
      reportId,
      fiscalYear,
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
    logger.error('Failed to generate budget utilization report', err, {
      reportId,
      fiscalYear,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'BUDGET_UTILIZATION',
        title: request.title ?? `Budget Utilization Report - FY${fiscalYear}`,
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

/**
 * Export financial report to specified format
 */
async function exportFinancialReport(
  reportData: DepreciationScheduleReport | AssetValuationReport | BudgetUtilizationReport,
  format: ExportFormat
): Promise<string> {
  switch (format) {
    case 'CSV':
      return exportFinancialToCSV(reportData);
    case 'EXCEL':
      return exportFinancialToExcel(reportData);
    case 'PDF':
      return exportFinancialToPDF(reportData);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export financial report to CSV format
 */
export function exportFinancialToCSV(
  reportData: DepreciationScheduleReport | AssetValuationReport | BudgetUtilizationReport
): string {
  const rows = getFinancialReportRows(reportData);
  if (rows.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const firstRow = rows[0];

  // Add headers
  if (firstRow) {
    const headers = Object.keys(firstRow);
    lines.push(headers.map(h => escapeCSVField(h)).join(','));
  }

  // Add data rows
  for (const row of rows) {
    const values = Object.values(row).map(v => {
      if (v === null || v === undefined) {
        return '';
      }
      if (typeof v === 'number') {
        return formatNumber(v);
      }
      if (v instanceof Date) {
        return v.toISOString();
      }
      return escapeCSVField(String(v));
    });
    lines.push(values.join(','));
  }

  return lines.join('\n');
}

/**
 * Export financial report to Excel format
 */
export function exportFinancialToExcel(
  reportData: DepreciationScheduleReport | AssetValuationReport | BudgetUtilizationReport
): string {
  logger.debug('Exporting financial report to Excel', {
    reportType: reportData.metadata.reportType,
  });

  const rows = getFinancialReportRows(reportData);
  const firstRow = rows[0];
  const headers = firstRow ? Object.keys(firstRow) : [];

  // Build Excel data structure
  const excelData = {
    sheetName: reportData.metadata.title,
    headers,
    rows: rows.map(row => Object.values(row)),
    summary: reportData.summary,
    freezeHeaders: true,
    autoFilter: true,
    // Add financial-specific formatting
    currencyColumns: getCurrencyColumns(reportData.metadata.reportType),
    percentageColumns: getPercentageColumns(reportData.metadata.reportType),
  };

  // Return base64-encoded JSON as placeholder
  return Buffer.from(JSON.stringify(excelData)).toString('base64');
}

/**
 * Export financial report to PDF format
 */
export function exportFinancialToPDF(
  reportData: DepreciationScheduleReport | AssetValuationReport | BudgetUtilizationReport
): string {
  logger.debug('Exporting financial report to PDF', {
    reportType: reportData.metadata.reportType,
  });

  const rows = getFinancialReportRows(reportData);
  const firstRow = rows[0];
  const headers = firstRow ? Object.keys(firstRow) : [];

  // Build PDF data structure
  const pdfData = {
    title: reportData.metadata.title,
    generatedAt: reportData.metadata.generatedAt,
    pageSize: 'A4',
    orientation: 'LANDSCAPE',
    headers,
    rows: rows.map(row => Object.values(row)),
    summary: reportData.summary,
    includeCharts: true,
    includeHeader: true,
    includeFooter: true,
    // Add financial-specific sections
    fiscalYear: 'fiscalYear' in reportData ? reportData.fiscalYear : undefined,
    valuationDate: 'valuationDate' in reportData ? reportData.valuationDate : undefined,
    asOfDate: 'asOfDate' in reportData ? reportData.asOfDate : undefined,
  };

  // Return base64-encoded JSON as placeholder
  return Buffer.from(JSON.stringify(pdfData)).toString('base64');
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate depreciation schedule report request
 */
function validateDepreciationScheduleRequest(request: GenerateDepreciationScheduleRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  if (request.fiscalYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (request.fiscalYear < 2000 || request.fiscalYear > currentYear + 1) {
      throw new Error(`Invalid fiscal year: ${request.fiscalYear}. Must be between 2000 and ${currentYear + 1}`);
    }
  }

  if (request.fiscalPeriod !== undefined) {
    if (request.fiscalPeriod < 1 || request.fiscalPeriod > 12) {
      throw new Error(`Invalid fiscal period: ${request.fiscalPeriod}. Must be between 1 and 12`);
    }
  }

  if (request.fiscalPeriodType !== undefined) {
    const validPeriodTypes: FiscalPeriodType[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
    if (!validPeriodTypes.includes(request.fiscalPeriodType)) {
      throw new Error(`Invalid fiscal period type: ${request.fiscalPeriodType}`);
    }
  }

  if (request.filters) {
    validateFinancialFilters(request.filters);
  }
}

/**
 * Validate asset valuation report request
 */
function validateAssetValuationRequest(request: GenerateAssetValuationRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  if (request.valuationDate !== undefined) {
    const valuationDate = new Date(request.valuationDate);
    if (isNaN(valuationDate.getTime())) {
      throw new Error(`Invalid valuation date: ${request.valuationDate}`);
    }
    
    const now = new Date();
    if (valuationDate > now) {
      throw new Error('Valuation date cannot be in the future');
    }
  }

  if (request.groupBy !== undefined) {
    const validGroupBy = ['ASSET_TYPE', 'DEPARTMENT', 'COST_CENTER', 'STATUS'];
    if (!validGroupBy.includes(request.groupBy)) {
      throw new Error(`Invalid groupBy: ${request.groupBy}`);
    }
  }

  if (request.filters) {
    validateFinancialFilters(request.filters);
  }
}

/**
 * Validate budget utilization report request
 */
function validateBudgetUtilizationRequest(request: GenerateBudgetUtilizationRequest): void {
  if (!request.format) {
    throw new Error('Export format is required');
  }

  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid export format: ${request.format}. Valid formats are: ${validFormats.join(', ')}`);
  }

  if (request.fiscalYear !== undefined) {
    const currentYear = new Date().getFullYear();
    if (request.fiscalYear < 2000 || request.fiscalYear > currentYear + 1) {
      throw new Error(`Invalid fiscal year: ${request.fiscalYear}. Must be between 2000 and ${currentYear + 1}`);
    }
  }

  if (request.filters) {
    validateFinancialFilters(request.filters);
  }
}

/**
 * Validate financial report filters
 */
function validateFinancialFilters(filters: FinancialReportFilters): void {
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

  if (filters.depreciationMethod) {
    const validMethods = ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS_DIGITS', 'UNITS_OF_PRODUCTION'];
    if (!validMethods.includes(filters.depreciationMethod)) {
      throw new Error(`Invalid depreciation method filter: ${filters.depreciationMethod}`);
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
 * Get rows from financial report data for export
 */
function getFinancialReportRows(
  reportData: DepreciationScheduleReport | AssetValuationReport | BudgetUtilizationReport
): Record<string, unknown>[] {
  return reportData.rows as unknown as Record<string, unknown>[];
}

/**
 * Get currency columns for a report type
 */
function getCurrencyColumns(reportType: string): string[] {
  switch (reportType) {
    case 'DEPRECIATION_SCHEDULE':
      return [
        'purchasePrice',
        'residualValue',
        'periodDepreciation',
        'accumulatedDepreciation',
        'bookValue',
      ];
    case 'ASSET_VALUATION':
      return [
        'purchasePrice',
        'residualValue',
        'accumulatedDepreciation',
        'currentBookValue',
        'fairMarketValue',
      ];
    case 'BUDGET_UTILIZATION':
      return [
        'budgetAmount',
        'spentAmount',
        'committedAmount',
        'availableAmount',
        'varianceAmount',
        'assetPurchases',
        'maintenanceCosts',
        'licenseCosts',
        'otherCosts',
        'projectedYearEndSpend',
        'projectedVariance',
      ];
    default:
      return [];
  }
}

/**
 * Get percentage columns for a report type
 */
function getPercentageColumns(reportType: string): string[] {
  switch (reportType) {
    case 'ASSET_VALUATION':
      return ['depreciationPercentage'];
    case 'BUDGET_UTILIZATION':
      return ['utilizationPercentage', 'variancePercentage'];
    default:
      return [];
  }
}

// Helper functions imported from ../utils/report-utils:
// - escapeCSVField, formatNumber, formatDate, generateUUID, getDateMonthsAgo, formatDateRange


// ============================================================================
// Procurement Spending Report
// ============================================================================

/**
 * Generate a procurement spending report
 *
 * Requirement 19.2: Generate procurement spending reports with totals grouped by vendor, category, and time period
 *
 * @param request - The procurement spending report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateProcurementSpendingReport(
  request: GenerateProcurementSpendingRequest,
  userId: UUID
): Promise<FinancialReportResult> {
  logger.info('Generating procurement spending report', {
    format: request.format,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    userId,
  });

  // Validate request
  validateProcurementSpendingRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  
  // Default to last 12 months if no dates provided
  const dateTo = request.dateTo ?? now;
  const dateFrom = request.dateFrom ?? getDateMonthsAgo(12);

  try {
    // Get procurement spending data
    const filters: FinancialReportFilters = request.filters ?? {};

    const [spendingData, summary] = await Promise.all([
      financialRepository.getProcurementSpendingData(filters, dateFrom, dateTo),
      financialRepository.getProcurementSpendingSummary(filters, dateFrom, dateTo),
    ]);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'COST_ANALYSIS',
      title: request.title ?? `Procurement Spending Report - ${formatDateRange(dateFrom, dateTo)}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: spendingData.total,
    };

    // Build report data
    const reportData: ProcurementSpendingReport = {
      metadata,
      summary,
      rows: spendingData.rows,
    };

    // Export to requested format
    const content = await exportProcurementSpendingReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'COST_ANALYSIS',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Procurement spending report generated successfully', {
      reportId,
      dateFrom,
      dateTo,
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
    logger.error('Failed to generate procurement spending report', err, {
      reportId,
      dateFrom,
      dateTo,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'COST_ANALYSIS',
        title: request.title ?? 'Procurement Spending Report',
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
// Vendor Spending Analysis Report
// ============================================================================

/**
 * Generate a vendor spending analysis report
 *
 * Requirement 19.5: Generate vendor spending analysis with trend analysis
 *
 * @param request - The vendor spending analysis report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateVendorSpendingAnalysisReport(
  request: GenerateVendorSpendingAnalysisRequest,
  userId: UUID
): Promise<FinancialReportResult> {
  logger.info('Generating vendor spending analysis report', {
    format: request.format,
    dateFrom: request.dateFrom,
    dateTo: request.dateTo,
    includeTrendAnalysis: request.includeTrendAnalysis,
    userId,
  });

  // Validate request
  validateVendorSpendingAnalysisRequest(request);

  const reportId = generateUUID();
  const now = new Date().toISOString();
  
  // Default to last 12 months if no dates provided
  const dateTo = request.dateTo ?? now;
  const dateFrom = request.dateFrom ?? getDateMonthsAgo(12);

  try {
    // Get vendor spending analysis data
    const filters: FinancialReportFilters = request.filters ?? {};

    const [vendorData, summary] = await Promise.all([
      financialRepository.getVendorSpendingAnalysisData(
        filters, 
        dateFrom, 
        dateTo, 
        request.includeTrendAnalysis ?? true
      ),
      financialRepository.getVendorSpendingAnalysisSummary(filters, dateFrom, dateTo),
    ]);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'COST_ANALYSIS',
      title: request.title ?? `Vendor Spending Analysis - ${formatDateRange(dateFrom, dateTo)}`,
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters,
      totalRecords: vendorData.total,
    };

    // Build report data
    const reportData: VendorSpendingAnalysisReport = {
      metadata,
      summary,
      vendors: vendorData.vendors,
    };

    // Export to requested format
    const content = await exportVendorSpendingAnalysisReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'COST_ANALYSIS',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters,
    });

    logger.info('Vendor spending analysis report generated successfully', {
      reportId,
      dateFrom,
      dateTo,
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
    logger.error('Failed to generate vendor spending analysis report', err, {
      reportId,
      dateFrom,
      dateTo,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'COST_ANALYSIS',
        title: request.title ?? 'Vendor Spending Analysis Report',
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
// Procurement Report Export Functions
// ============================================================================

/**
 * Export procurement spending report to specified format
 */
async function exportProcurementSpendingReport(
  reportData: ProcurementSpendingReport,
  format: ExportFormat
): Promise<string> {
  switch (format) {
    case 'CSV':
      return exportProcurementSpendingToCSV(reportData);
    case 'EXCEL':
      return exportProcurementSpendingToExcel(reportData);
    case 'PDF':
      return exportProcurementSpendingToPDF(reportData);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export procurement spending report to CSV
 */
function exportProcurementSpendingToCSV(reportData: ProcurementSpendingReport): string {
  const lines: string[] = [];
  
  // Summary section
  lines.push('Procurement Spending Report');
  lines.push(`Period,${reportData.summary.period.from} to ${reportData.summary.period.to}`);
  lines.push(`Total Spending,${reportData.summary.totalSpending.toFixed(2)}`);
  lines.push(`Total PO Count,${reportData.summary.totalPOCount}`);
  lines.push(`Average Order Value,${reportData.summary.averageOrderValue.toFixed(2)}`);
  lines.push('');
  
  // By Vendor section
  lines.push('Spending by Vendor');
  lines.push('Vendor,Total Amount,PO Count,Average Order,Percentage');
  for (const vendor of reportData.summary.byVendor) {
    lines.push(`${escapeCSVField(vendor.vendorName)},${vendor.totalAmount.toFixed(2)},${vendor.poCount},${vendor.averageOrderValue.toFixed(2)},${vendor.percentage.toFixed(2)}%`);
  }
  lines.push('');
  
  // By Category section
  lines.push('Spending by Category');
  lines.push('Category,Total Amount,PO Count,Percentage');
  for (const category of reportData.summary.byCategory) {
    lines.push(`${escapeCSVField(category.category)},${category.totalAmount.toFixed(2)},${category.poCount},${category.percentage.toFixed(2)}%`);
  }
  lines.push('');
  
  // By Month section
  lines.push('Spending by Month');
  lines.push('Month,Total Amount,PO Count');
  for (const month of reportData.summary.byMonth) {
    lines.push(`${month.month},${month.totalAmount.toFixed(2)},${month.poCount}`);
  }
  
  return lines.join('\n');
}

/**
 * Export procurement spending report to Excel
 */
function exportProcurementSpendingToExcel(reportData: ProcurementSpendingReport): string {
  const excelData = {
    sheetName: reportData.metadata.title,
    summary: reportData.summary,
    rows: reportData.rows,
    freezeHeaders: true,
    autoFilter: true,
    currencyColumns: ['totalAmount', 'averageOrderValue'],
    percentageColumns: ['percentage'],
  };
  return Buffer.from(JSON.stringify(excelData)).toString('base64');
}

/**
 * Export procurement spending report to PDF
 */
function exportProcurementSpendingToPDF(reportData: ProcurementSpendingReport): string {
  const pdfData = {
    title: reportData.metadata.title,
    generatedAt: reportData.metadata.generatedAt,
    pageSize: 'A4',
    orientation: 'LANDSCAPE',
    summary: reportData.summary,
    rows: reportData.rows,
    includeCharts: true,
    includeHeader: true,
    includeFooter: true,
  };
  return Buffer.from(JSON.stringify(pdfData)).toString('base64');
}

/**
 * Export vendor spending analysis report to specified format
 */
async function exportVendorSpendingAnalysisReport(
  reportData: VendorSpendingAnalysisReport,
  format: ExportFormat
): Promise<string> {
  switch (format) {
    case 'CSV':
      return exportVendorSpendingAnalysisToCSV(reportData);
    case 'EXCEL':
      return exportVendorSpendingAnalysisToExcel(reportData);
    case 'PDF':
      return exportVendorSpendingAnalysisToPDF(reportData);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export vendor spending analysis report to CSV
 */
function exportVendorSpendingAnalysisToCSV(reportData: VendorSpendingAnalysisReport): string {
  const lines: string[] = [];
  
  // Summary section
  lines.push('Vendor Spending Analysis Report');
  lines.push(`Period,${reportData.summary.period.from} to ${reportData.summary.period.to}`);
  lines.push(`Total Vendors,${reportData.summary.totalVendors}`);
  lines.push(`Total Spending,${reportData.summary.totalSpending.toFixed(2)}`);
  lines.push(`Vendors with Increasing Trend,${reportData.summary.vendorsWithIncreasingTrend}`);
  lines.push(`Vendors with Decreasing Trend,${reportData.summary.vendorsWithDecreasingTrend}`);
  lines.push('');
  
  // Vendor details
  lines.push('Vendor Details');
  lines.push('Vendor,Type,Rating,Total Spending,PO Count,Avg Order Value,Trend,Trend %');
  for (const vendor of reportData.vendors) {
    lines.push(`${escapeCSVField(vendor.vendorName)},${vendor.vendorType ?? ''},${vendor.rating ?? ''},${vendor.totalSpending.toFixed(2)},${vendor.poCount},${vendor.averageOrderValue.toFixed(2)},${vendor.trend},${vendor.trendPercentage.toFixed(2)}%`);
  }
  
  return lines.join('\n');
}

/**
 * Export vendor spending analysis report to Excel
 */
function exportVendorSpendingAnalysisToExcel(reportData: VendorSpendingAnalysisReport): string {
  const excelData = {
    sheetName: reportData.metadata.title,
    summary: reportData.summary,
    vendors: reportData.vendors,
    freezeHeaders: true,
    autoFilter: true,
    currencyColumns: ['totalSpending', 'averageOrderValue'],
    percentageColumns: ['trendPercentage'],
  };
  return Buffer.from(JSON.stringify(excelData)).toString('base64');
}

/**
 * Export vendor spending analysis report to PDF
 */
function exportVendorSpendingAnalysisToPDF(reportData: VendorSpendingAnalysisReport): string {
  const pdfData = {
    title: reportData.metadata.title,
    generatedAt: reportData.metadata.generatedAt,
    pageSize: 'A4',
    orientation: 'LANDSCAPE',
    summary: reportData.summary,
    vendors: reportData.vendors,
    includeCharts: true,
    includeHeader: true,
    includeFooter: true,
  };
  return Buffer.from(JSON.stringify(pdfData)).toString('base64');
}

// ============================================================================
// Procurement Report Validation Functions
// ============================================================================

/**
 * Validate procurement spending report request
 */
function validateProcurementSpendingRequest(request: GenerateProcurementSpendingRequest): void {
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

  if (request.groupBy) {
    const validGroupBy = ['VENDOR', 'CATEGORY', 'COST_CENTER', 'MONTH'];
    if (!validGroupBy.includes(request.groupBy)) {
      throw new Error(`Invalid groupBy: ${request.groupBy}`);
    }
  }
}

/**
 * Validate vendor spending analysis report request
 */
function validateVendorSpendingAnalysisRequest(request: GenerateVendorSpendingAnalysisRequest): void {
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

// ============================================================================
// Procurement Report Helper Functions
// ============================================================================

// Note: getDateMonthsAgo and formatDateRange are imported from ../utils/report-utils
