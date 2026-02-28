/**
 * Asset Report Service - Core asset report generation logic
 *
 * Implements asset inventory report generation including summary reports,
 * aging analysis, location-based, and department-based reports.
 *
 * Requirements:
 * - Requirement 18.1: Asset summary report with aggregated counts by type, status, and location
 * - Requirement 18.2: Asset aging report with assets grouped by age ranges
 * - Requirement 18.3: Asset by location report with building/floor/room hierarchy
 * - Requirement 18.4: Asset by department report with cost allocation
 * - Requirement 18.5: Support filtering by date range, asset type, status, location, department
 * - Requirement 18.6: Export reports in CSV, Excel, PDF formats
 */

import type { UUID } from '@ams/types';
import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { createLogger } from '@ams/utils';

import { generateUUID } from '../utils/report-utils';
import * as reportRepository from '../report/report-repository';
import type { ExportFormat, ReportMetadata, ReportStatus } from '../report/report-types';
import {
  exportReportToCSV,
  exportReportToExcel,
  exportReportToPDF,
} from '../export';
import * as assetReportRepository from './asset-report-repository';
import type {
  AssetAgingBucket,
  AssetAgingRow,
  AssetReportFilters,
  AssetSummaryByCategory,
  DepartmentAssetData,
  LocationBuildingData,
} from './asset-report-repository';

const logger = createLogger({ service: 'asset-report-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * Asset report type
 */
export type AssetReportType = 
  | 'ASSET_SUMMARY' 
  | 'ASSET_AGING' 
  | 'ASSET_BY_LOCATION' 
  | 'ASSET_BY_DEPARTMENT';

/**
 * Generate asset summary report request
 */
export interface GenerateAssetSummaryReportRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: AssetReportFilters;
}

/**
 * Generate asset aging report request
 */
export interface GenerateAssetAgingReportRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: AssetReportFilters;
  readonly ageBuckets?: readonly { minMonths: number; maxMonths: number | null; label: string }[];
  readonly includeDetails?: boolean;
}

/**
 * Generate asset by location report request
 */
export interface GenerateAssetByLocationReportRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: AssetReportFilters;
  readonly buildingId?: UUID;
}

/**
 * Generate asset by department report request
 */
export interface GenerateAssetByDepartmentReportRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: AssetReportFilters;
  readonly departmentId?: UUID;
}

/**
 * Asset summary report data
 */
export interface AssetSummaryReport {
  readonly metadata: ReportMetadata;
  readonly generatedAt: string;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly byType: readonly AssetSummaryByCategory[];
  readonly byStatus: readonly AssetSummaryByCategory[];
  readonly byLocation: readonly AssetSummaryByCategory[];
}

/**
 * Asset aging report data
 */
export interface AssetAgingReport {
  readonly metadata: ReportMetadata;
  readonly generatedAt: string;
  readonly ageRanges: readonly AssetAgingBucket[];
  readonly assets?: readonly AssetAgingRow[];
}

/**
 * Asset by location report data
 */
export interface AssetByLocationReport {
  readonly metadata: ReportMetadata;
  readonly generatedAt: string;
  readonly buildings: readonly LocationBuildingData[];
}

/**
 * Asset by department report data
 */
export interface AssetByDepartmentReport {
  readonly metadata: ReportMetadata;
  readonly generatedAt: string;
  readonly departments: readonly DepartmentAssetData[];
}

/**
 * Asset report result
 */
export interface AssetReportResult {
  readonly reportId: UUID;
  readonly status: ReportStatus;
  readonly metadata: ReportMetadata;
  readonly downloadUrl?: string;
  readonly content?: string;
  readonly errorMessage?: string;
}

// ============================================================================
// Asset Summary Report
// ============================================================================

/**
 * Generate an asset summary report
 *
 * Requirement 18.1: Return aggregated counts by asset type, status, and location
 *
 * @param request - The asset summary report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateAssetSummaryReport(
  request: GenerateAssetSummaryReportRequest,
  userId: UUID
): Promise<AssetReportResult> {
  logger.info('Generating asset summary report', {
    format: request.format,
    userId,
  });

  // Validate request
  validateExportFormat(request.format);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Get asset summary data
    const filters: AssetReportFilters = request.filters ?? {};
    const summaryData = await assetReportRepository.getAssetSummaryData(filters);
    const totalRecords = summaryData.totalAssets;

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? 'Asset Summary Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: {
        assetType: filters.assetType,
        assetStatus: filters.assetStatus,
        departmentId: filters.departmentId,
        costCenterId: filters.costCenterId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      totalRecords,
    };

    // Build report data
    const reportData: AssetSummaryReport = {
      metadata,
      generatedAt: now,
      totalAssets: summaryData.totalAssets,
      totalValue: summaryData.totalValue,
      byType: summaryData.byType,
      byStatus: summaryData.byStatus,
      byLocation: summaryData.byLocation,
    };

    // Export to requested format
    const content = await exportAssetReport(reportData, request.format, 'ASSET_SUMMARY');

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: metadata.filters,
    });

    logger.info('Asset summary report generated successfully', {
      reportId,
      totalRecords,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate asset summary report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Asset Summary Report',
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
// Asset Aging Report
// ============================================================================

/**
 * Generate an asset aging report
 *
 * Requirement 18.2: Return assets grouped by age ranges with depreciation status
 *
 * @param request - The asset aging report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateAssetAgingReport(
  request: GenerateAssetAgingReportRequest,
  userId: UUID
): Promise<AssetReportResult> {
  logger.info('Generating asset aging report', {
    format: request.format,
    includeDetails: request.includeDetails,
    userId,
  });

  // Validate request
  validateExportFormat(request.format);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Get asset aging data
    const filters: AssetReportFilters = request.filters ?? {};
    const agingData = await assetReportRepository.getAssetAgingData(filters, request.ageBuckets);
    const totalRecords = agingData.rows.length;

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? 'Asset Aging Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: {
        assetType: filters.assetType,
        assetStatus: filters.assetStatus,
        departmentId: filters.departmentId,
        costCenterId: filters.costCenterId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      totalRecords,
    };

    // Build report data
    const reportData: AssetAgingReport = {
      metadata,
      generatedAt: now,
      ageRanges: agingData.buckets,
      assets: request.includeDetails ? agingData.rows : undefined,
    };

    // Export to requested format
    const content = await exportAssetReport(reportData, request.format, 'ASSET_AGING');

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: metadata.filters,
    });

    logger.info('Asset aging report generated successfully', {
      reportId,
      totalRecords,
      bucketCount: agingData.buckets.length,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate asset aging report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Asset Aging Report',
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
// Asset by Location Report
// ============================================================================

/**
 * Generate an asset by location report
 *
 * Requirement 18.3: Return assets grouped by building, floor, and room hierarchy
 *
 * @param request - The asset by location report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateAssetByLocationReport(
  request: GenerateAssetByLocationReportRequest,
  userId: UUID
): Promise<AssetReportResult> {
  logger.info('Generating asset by location report', {
    format: request.format,
    buildingId: request.buildingId,
    userId,
  });

  // Validate request
  validateExportFormat(request.format);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Get asset by location data
    const filters: AssetReportFilters = {
      ...request.filters,
      buildingId: request.buildingId,
    };
    const locationData = await assetReportRepository.getAssetsByLocationData(filters);
    
    // Calculate total records
    const totalRecords = locationData.reduce((sum, b) => sum + b.totalAssets, 0);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? 'Asset by Location Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: {
        assetType: filters.assetType,
        assetStatus: filters.assetStatus,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        customFilters: filters.buildingId ? { buildingId: filters.buildingId } : undefined,
      },
      totalRecords,
    };

    // Build report data
    const reportData: AssetByLocationReport = {
      metadata,
      generatedAt: now,
      buildings: locationData,
    };

    // Export to requested format
    const content = await exportAssetReport(reportData, request.format, 'ASSET_BY_LOCATION');

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: metadata.filters,
    });

    logger.info('Asset by location report generated successfully', {
      reportId,
      totalRecords,
      buildingCount: locationData.length,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate asset by location report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Asset by Location Report',
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
// Asset by Department Report
// ============================================================================

/**
 * Generate an asset by department report
 *
 * Requirement 18.4: Return assets grouped by department with cost allocation
 *
 * @param request - The asset by department report request
 * @param userId - The user generating the report
 * @returns The generated report result
 */
export async function generateAssetByDepartmentReport(
  request: GenerateAssetByDepartmentReportRequest,
  userId: UUID
): Promise<AssetReportResult> {
  logger.info('Generating asset by department report', {
    format: request.format,
    departmentId: request.departmentId,
    userId,
  });

  // Validate request
  validateExportFormat(request.format);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Get asset by department data
    const filters: AssetReportFilters = {
      ...request.filters,
      departmentId: request.departmentId,
    };
    const departmentData = await assetReportRepository.getAssetsByDepartmentData(filters);
    
    // Calculate total records
    const totalRecords = departmentData.reduce((sum, d) => sum + d.totalAssets, 0);

    // Create metadata
    const metadata: ReportMetadata = {
      reportId,
      reportType: 'ASSET_INVENTORY',
      title: request.title ?? 'Asset by Department Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: {
        assetType: filters.assetType,
        assetStatus: filters.assetStatus,
        departmentId: filters.departmentId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      },
      totalRecords,
    };

    // Build report data
    const reportData: AssetByDepartmentReport = {
      metadata,
      generatedAt: now,
      departments: departmentData,
    };

    // Export to requested format
    const content = await exportAssetReport(reportData, request.format, 'ASSET_BY_DEPARTMENT');

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY',
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: metadata.filters,
    });

    logger.info('Asset by department report generated successfully', {
      reportId,
      totalRecords,
      departmentCount: departmentData.length,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate asset by department report', err, { reportId });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'ASSET_INVENTORY',
        title: request.title ?? 'Asset by Department Report',
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
 * Export asset report to specified format using the unified export module
 */
async function exportAssetReport(
  reportData: AssetSummaryReport | AssetAgingReport | AssetByLocationReport | AssetByDepartmentReport,
  format: ExportFormat,
  reportType: AssetReportType
): Promise<string> {
  // Convert report data to flat rows for export
  const rows = convertReportToRows(reportData, reportType);
  const title = reportData.metadata.title;
  const generatedAt = reportData.metadata.generatedAt;
  const generatedBy = reportData.metadata.generatedBy;
  const summary = extractSummary(reportData, reportType);

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

/**
 * Convert report data to flat rows for export
 */
function convertReportToRows(
  reportData: AssetSummaryReport | AssetAgingReport | AssetByLocationReport | AssetByDepartmentReport,
  reportType: AssetReportType
): Record<string, unknown>[] {
  switch (reportType) {
    case 'ASSET_SUMMARY': {
      const data = reportData as AssetSummaryReport;
      // Combine all category data into rows
      const rows: Record<string, unknown>[] = [];
      
      // Add type breakdown
      for (const item of data.byType) {
        rows.push({
          category: 'Asset Type',
          name: item.category,
          count: item.count,
          totalValue: item.totalValue,
          percentage: item.percentage,
        });
      }
      
      // Add status breakdown
      for (const item of data.byStatus) {
        rows.push({
          category: 'Status',
          name: item.category,
          count: item.count,
          totalValue: item.totalValue,
          percentage: item.percentage,
        });
      }
      
      // Add location breakdown
      for (const item of data.byLocation) {
        rows.push({
          category: 'Location',
          name: item.category,
          count: item.count,
          totalValue: item.totalValue,
          percentage: item.percentage,
        });
      }
      
      return rows;
    }

    case 'ASSET_AGING': {
      const data = reportData as AssetAgingReport;
      
      // If detailed assets are included, return those
      if (data.assets && data.assets.length > 0) {
        return data.assets.map(asset => ({
          assetTag: asset.assetTag,
          displayName: asset.displayName,
          assetType: asset.assetType,
          acquisitionDate: asset.acquisitionDate,
          ageInDays: asset.ageInDays,
          originalValue: asset.originalValue,
          currentValue: asset.currentValue,
          depreciationStatus: asset.depreciationStatus,
          department: asset.department ?? '',
          location: asset.location ?? '',
        }));
      }
      
      // Otherwise return age range summary
      return data.ageRanges.map(bucket => ({
        range: bucket.range,
        count: bucket.count,
        totalValue: bucket.totalValue,
        depreciatedValue: bucket.depreciatedValue,
      }));
    }

    case 'ASSET_BY_LOCATION': {
      const data = reportData as AssetByLocationReport;
      const rows: Record<string, unknown>[] = [];
      
      for (const building of data.buildings) {
        for (const floor of building.floors) {
          for (const room of floor.rooms) {
            rows.push({
              buildingName: building.buildingName,
              floorName: floor.floorName,
              roomName: room.roomName,
              assetCount: room.assetCount,
              totalValue: room.totalValue,
            });
          }
        }
      }
      
      return rows;
    }

    case 'ASSET_BY_DEPARTMENT': {
      const data = reportData as AssetByDepartmentReport;
      return data.departments.map(dept => ({
        departmentCode: dept.departmentCode,
        departmentName: dept.departmentName,
        totalAssets: dept.totalAssets,
        totalValue: dept.totalValue,
      }));
    }

    default:
      return [];
  }
}

/**
 * Extract summary data from report for export
 */
function extractSummary(
  reportData: AssetSummaryReport | AssetAgingReport | AssetByLocationReport | AssetByDepartmentReport,
  reportType: AssetReportType
): Record<string, unknown> {
  switch (reportType) {
    case 'ASSET_SUMMARY': {
      const data = reportData as AssetSummaryReport;
      return {
        totalAssets: data.totalAssets,
        totalValue: data.totalValue,
      };
    }

    case 'ASSET_AGING': {
      const data = reportData as AssetAgingReport;
      const totalCount = data.ageRanges.reduce((sum, b) => sum + b.count, 0);
      const totalValue = data.ageRanges.reduce((sum, b) => sum + b.totalValue, 0);
      return {
        totalAssets: totalCount,
        totalValue,
        ageRangeCount: data.ageRanges.length,
      };
    }

    case 'ASSET_BY_LOCATION': {
      const data = reportData as AssetByLocationReport;
      const totalAssets = data.buildings.reduce((sum, b) => sum + b.totalAssets, 0);
      const totalValue = data.buildings.reduce((sum, b) => sum + b.totalValue, 0);
      return {
        totalBuildings: data.buildings.length,
        totalAssets,
        totalValue,
      };
    }

    case 'ASSET_BY_DEPARTMENT': {
      const data = reportData as AssetByDepartmentReport;
      const totalAssets = data.departments.reduce((sum, d) => sum + d.totalAssets, 0);
      const totalValue = data.departments.reduce((sum, d) => sum + d.totalValue, 0);
      return {
        totalDepartments: data.departments.length,
        totalAssets,
        totalValue,
      };
    }

    default:
      return {};
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate export format
 */
function validateExportFormat(format: ExportFormat): void {
  const validFormats: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];
  if (!validFormats.includes(format)) {
    throw new Error(`Invalid export format: ${format}. Valid formats are: ${validFormats.join(', ')}`);
  }
}
