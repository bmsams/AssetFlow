/**
 * Report Handlers - Unified Lambda handlers for all report endpoints
 *
 * This handler routes requests to the appropriate report service based on the path.
 * Returns data in the format expected by the frontend.
 *
 * Implements HTTP endpoints for:
 * - GET /reports/asset-summary - Asset summary report
 * - GET /reports/asset-aging - Asset aging report
 * - GET /reports/assets-by-location - Asset by location report
 * - GET /reports/assets-by-department - Asset by department report
 * - GET /reports/cost-center-utilization - Cost center utilization report
 * - GET /reports/procurement-spending - Procurement spending report
 * - GET /reports/work-order-summary - Work order summary report
 * - GET /reports/maintenance-compliance - Maintenance compliance report
 * - GET /reports/{reportType}/export - Export report data as CSV
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { UUID } from '@ams/types';
import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

// Import repositories directly to get raw data (not converted to export format)
import * as assetReportRepository from '../asset-reports/asset-report-repository';
import * as financialReportRepository from '../financial/financial-report-repository';
import * as operationalReportRepository from '../operational-reports/operational-report-repository';
import type { AssetReportFilters } from '../asset-reports/asset-report-repository';

const logger = createLogger({ service: 'report-handlers' });

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get user ID from event context
 */
function getUserId(event: APIGatewayProxyEvent): UUID {
  return (event.requestContext.authorizer?.['claims']?.['sub'] as UUID) ?? 'system';
}

/**
 * Parse common filters from query parameters
 */
function parseFilters(queryParams: Record<string, string | undefined>): AssetReportFilters {
  const filters: AssetReportFilters = {};

  if (queryParams['assetType']) {
    Object.assign(filters, { assetType: queryParams['assetType'].toUpperCase() });
  }
  if (queryParams['status']) {
    Object.assign(filters, { assetStatus: queryParams['status'] });
  }
  if (queryParams['departmentId']) {
    const uuidError = validateUUID(queryParams['departmentId'], 'departmentId');
    if (!uuidError) {
      Object.assign(filters, { departmentId: queryParams['departmentId'] });
    }
  }
  if (queryParams['costCenterId']) {
    const uuidError = validateUUID(queryParams['costCenterId'], 'costCenterId');
    if (!uuidError) {
      Object.assign(filters, { costCenterId: queryParams['costCenterId'] });
    }
  }
  if (queryParams['locationId']) {
    const uuidError = validateUUID(queryParams['locationId'], 'locationId');
    if (!uuidError) {
      Object.assign(filters, { buildingId: queryParams['locationId'] });
    }
  }
  if (queryParams['dateFrom']) {
    Object.assign(filters, { dateFrom: queryParams['dateFrom'] });
  }
  if (queryParams['dateTo']) {
    Object.assign(filters, { dateTo: queryParams['dateTo'] });
  }

  return filters;
}

/**
 * Handle errors consistently
 */
function handleError(
  error: unknown,
  requestId: string,
  operation: string
): APIGatewayProxyResult {
  const err = error as Error;
  logger.error(`Failed to ${operation}`, err, { requestId });
  return createLambdaResponse(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, `Failed to ${operation}`, requestId)
  );
}

// ============================================================================
// Export Helper Functions
// ============================================================================

/**
 * Map of report type slugs to their data fetcher and CSV column definitions
 */
const REPORT_EXPORTERS: Record<string, {
  fetch: (event: APIGatewayProxyEvent) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>;
}> = {
  'asset-summary': {
    fetch: async (event) => {
      const filters = parseFilters(event.queryStringParameters ?? {});
      const data = await assetReportRepository.getAssetSummaryData(filters);
      const rows: Record<string, unknown>[] = [
        ...data.byType.map(item => ({ category: 'Type', name: item.category, count: item.count, percentage: item.percentage ?? 0 })),
        ...data.byStatus.map(item => ({ category: 'Status', name: item.category, count: item.count, percentage: item.percentage ?? 0 })),
      ];
      return { columns: ['category', 'name', 'count', 'percentage'], rows };
    },
  },
  'asset-aging': {
    fetch: async (event) => {
      const filters = parseFilters(event.queryStringParameters ?? {});
      const data = await assetReportRepository.getAssetAgingData(filters);
      const rows = data.rows.map(asset => ({
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        acquisitionDate: asset.acquisitionDate,
        ageInDays: asset.ageInDays,
        originalValue: asset.originalValue,
        currentValue: asset.currentValue,
        depreciationStatus: asset.depreciationStatus,
      }));
      return { columns: ['assetTag', 'assetType', 'acquisitionDate', 'ageInDays', 'originalValue', 'currentValue', 'depreciationStatus'], rows };
    },
  },
  'assets-by-location': {
    fetch: async (event) => {
      const filters = parseFilters(event.queryStringParameters ?? {});
      const data = await assetReportRepository.getAssetsByLocationData(filters);
      const rows: Record<string, unknown>[] = [];
      for (const building of data) {
        for (const floor of building.floors) {
          for (const room of floor.rooms) {
            rows.push({ building: building.buildingName, floor: floor.floorName, room: room.roomName, assetCount: room.assetCount });
          }
        }
      }
      return { columns: ['building', 'floor', 'room', 'assetCount'], rows };
    },
  },
  'assets-by-department': {
    fetch: async (event) => {
      const filters = parseFilters(event.queryStringParameters ?? {});
      const data = await assetReportRepository.getAssetsByDepartmentData(filters);
      const rows: Record<string, unknown>[] = [];
      for (const dept of data) {
        for (const item of dept.byType) {
          rows.push({ department: dept.departmentName, type: item.category, count: item.count, value: item.totalValue });
        }
      }
      return { columns: ['department', 'type', 'count', 'value'], rows };
    },
  },
  'cost-center-utilization': {
    fetch: async (event) => {
      const queryParams = event.queryStringParameters ?? {};
      const fiscalYear = queryParams['fiscalYear'] ? parseInt(queryParams['fiscalYear'], 10) : new Date().getFullYear();
      const data = await financialReportRepository.getBudgetUtilizationData({}, fiscalYear);
      const rows = data.rows.map(row => ({
        costCenterCode: row.costCenterCode,
        costCenterName: row.costCenterName,
        departmentName: row.departmentName,
        budgetAmount: row.budgetAmount,
        spentAmount: row.spentAmount,
        availableAmount: row.availableAmount,
        utilizationPercentage: row.utilizationPercentage,
      }));
      return { columns: ['costCenterCode', 'costCenterName', 'departmentName', 'budgetAmount', 'spentAmount', 'availableAmount', 'utilizationPercentage'], rows };
    },
  },
  'procurement-spending': {
    fetch: async (event) => {
      const queryParams = event.queryStringParameters ?? {};
      const defaultDateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;
      const defaultDateTo = new Date().toISOString().split('T')[0] as string;
      const dateFrom = queryParams['dateFrom'] ?? defaultDateFrom;
      const dateTo = queryParams['dateTo'] ?? defaultDateTo;
      const data = await financialReportRepository.getProcurementSpendingSummary({}, dateFrom, dateTo);
      const rows = data.byVendor.map(v => ({
        vendorName: v.vendorName,
        totalAmount: v.totalAmount,
        poCount: v.poCount,
      }));
      return { columns: ['vendorName', 'totalAmount', 'poCount'], rows };
    },
  },
  'work-order-summary': {
    fetch: async (event) => {
      const queryParams = event.queryStringParameters ?? {};
      const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;
      const defaultDateTo = new Date().toISOString().split('T')[0] as string;
      const dateFrom = queryParams['dateFrom'] ?? defaultDateFrom;
      const dateTo = queryParams['dateTo'] ?? defaultDateTo;
      const data = await operationalReportRepository.getWorkOrderSummarySummary({}, dateFrom, dateTo);
      const rows: Record<string, unknown>[] = [
        ...data.byStatus.map(s => ({ grouping: 'Status', name: s.category, count: s.count })),
        ...data.byType.map(t => ({ grouping: 'Type', name: t.category, count: t.count })),
        ...data.byPriority.map(p => ({ grouping: 'Priority', name: p.category, count: p.count })),
      ];
      return { columns: ['grouping', 'name', 'count'], rows };
    },
  },
  'maintenance-compliance': {
    fetch: async () => {
      const complianceData = await operationalReportRepository.getMaintenanceComplianceData({});
      const rows = complianceData.rows.map(row => ({
        planName: row.planName,
        assetTag: row.assetTag,
        nextDueDate: row.nextDueDate ?? '',
        isOverdue: row.isOverdue,
        daysOverdue: row.daysOverdue ?? 0,
      }));
      return { columns: ['planName', 'assetTag', 'nextDueDate', 'isOverdue', 'daysOverdue'], rows };
    },
  },
};

/**
 * Escape a CSV field value — wraps in quotes if it contains commas, quotes, or newlines
 */
function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert rows to CSV string
 */
function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(escapeCsvField).join(',');
  const body = rows.map(row => columns.map(col => escapeCsvField(row[col])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Handle export requests — extracts report type from path, fetches data, returns CSV
 */
async function handleExportReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  // Extract report type: /reports/{reportType}/export → reportType
  const match = path.match(/\/reports\/([^/]+)\/export$/);
  const reportType = match?.[1];

  if (!reportType || !REPORT_EXPORTERS[reportType]) {
    return createLambdaResponse(
      HTTP_STATUS.NOT_FOUND,
      createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Unknown export report type: ${reportType ?? path}`, requestId)
    );
  }

  logger.info('Generating report export', { requestId, reportType });

  try {
    const { columns, rows } = await REPORT_EXPORTERS[reportType].fetch(event);
    const csv = toCsv(columns, rows);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${reportType}-export.csv"`,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: csv,
    };
  } catch (error) {
    return handleError(error, requestId, `export ${reportType} report`);
  }
}

// ============================================================================
// Main Handler - Routes to appropriate report handler
// ============================================================================

/**
 * Main handler that routes to the appropriate report based on path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const path = event.path;

  logger.info('Report request received', { requestId, path });

  try {
    // Handle export requests (paths ending in /export)
    if (path.endsWith('/export')) {
      return await handleExportReport(event);
    }

    // Route based on path
    if (path.endsWith('/asset-summary')) {
      return await handleAssetSummaryReport(event);
    } else if (path.endsWith('/asset-aging')) {
      return await handleAssetAgingReport(event);
    } else if (path.endsWith('/assets-by-location')) {
      return await handleAssetsByLocationReport(event);
    } else if (path.endsWith('/assets-by-department')) {
      return await handleAssetsByDepartmentReport(event);
    } else if (path.endsWith('/cost-center-utilization')) {
      return await handleCostCenterUtilizationReport(event);
    } else if (path.endsWith('/procurement-spending')) {
      return await handleProcurementSpendingReport(event);
    } else if (path.endsWith('/work-order-summary')) {
      return await handleWorkOrderSummaryReport(event);
    } else if (path.endsWith('/maintenance-compliance')) {
      return await handleMaintenanceComplianceReport(event);
    }

    // Unknown report type
    return createLambdaResponse(
      HTTP_STATUS.NOT_FOUND,
      createErrorResponse(API_ERROR_CODES.NOT_FOUND, `Unknown report type: ${path}`, requestId)
    );
  } catch (error) {
    return handleError(error, requestId, 'process report request');
  }
}

// ============================================================================
// Asset Reports
// ============================================================================

/**
 * Handle asset summary report
 * Returns: { generatedAt, totalAssets, byType, byStatus, byLocation }
 */
async function handleAssetSummaryReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};
  const filters = parseFilters(queryParams);

  logger.info('Generating asset summary report', { requestId, userId, filters });

  try {
    // Get raw data directly from repository
    const summaryData = await assetReportRepository.getAssetSummaryData(filters);

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalAssets: summaryData.totalAssets,
      byType: summaryData.byType.map(item => ({
        type: item.category,
        count: item.count,
        percentage: item.percentage ?? 0,
      })),
      byStatus: summaryData.byStatus.map(item => ({
        status: item.category,
        count: item.count,
        percentage: item.percentage ?? 0,
      })),
      byLocation: summaryData.byLocation.map(item => ({
        location: item.category,
        count: item.count,
      })),
    };

    logger.info('Asset summary report generated', { requestId, totalAssets: summaryData.totalAssets });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate asset summary report');
  }
}

/**
 * Handle asset aging report
 * Returns: { generatedAt, ageRanges, assets }
 */
async function handleAssetAgingReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};
  const filters = parseFilters(queryParams);

  logger.info('Generating asset aging report', { requestId, userId, filters });

  try {
    // Get raw data directly from repository
    const agingData = await assetReportRepository.getAssetAgingData(filters);

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      ageRanges: agingData.buckets.map(bucket => ({
        range: bucket.range,
        count: bucket.count,
        totalValue: bucket.totalValue,
        depreciatedValue: bucket.depreciatedValue,
      })),
      assets: agingData.rows.map(asset => ({
        assetTag: asset.assetTag,
        assetType: asset.assetType,
        acquisitionDate: asset.acquisitionDate,
        ageInDays: asset.ageInDays,
        originalValue: asset.originalValue,
        currentValue: asset.currentValue,
        depreciationStatus: asset.depreciationStatus,
      })),
    };

    logger.info('Asset aging report generated', { requestId, assetCount: agingData.rows.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate asset aging report');
  }
}

/**
 * Handle assets by location report
 * Returns: { generatedAt, buildings }
 */
async function handleAssetsByLocationReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};
  const filters = parseFilters(queryParams);

  logger.info('Generating assets by location report', { requestId, userId, filters });

  try {
    // Get raw data directly from repository
    const locationData = await assetReportRepository.getAssetsByLocationData(filters);

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      buildings: locationData.map(building => ({
        buildingName: building.buildingName,
        totalAssets: building.totalAssets,
        floors: building.floors.map(floor => ({
          floorName: floor.floorName,
          totalAssets: floor.totalAssets,
          rooms: floor.rooms.map(room => ({
            roomName: room.roomName,
            assetCount: room.assetCount,
          })),
        })),
      })),
    };

    logger.info('Assets by location report generated', { requestId, buildingCount: locationData.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate assets by location report');
  }
}

/**
 * Handle assets by department report
 * Returns: { generatedAt, departments }
 */
async function handleAssetsByDepartmentReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};
  const filters = parseFilters(queryParams);

  logger.info('Generating assets by department report', { requestId, userId, filters });

  try {
    // Get raw data directly from repository
    const departmentData = await assetReportRepository.getAssetsByDepartmentData(filters);

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      departments: departmentData.map(dept => ({
        departmentName: dept.departmentName,
        totalAssets: dept.totalAssets,
        totalValue: dept.totalValue,
        byType: dept.byType.map(item => ({
          type: item.category,
          count: item.count,
          value: item.totalValue,
        })),
      })),
    };

    logger.info('Assets by department report generated', { requestId, departmentCount: departmentData.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate assets by department report');
  }
}

// ============================================================================
// Financial Reports
// ============================================================================

/**
 * Handle cost center utilization report
 * Returns: { generatedAt, fiscalYear, costCenters }
 */
async function handleCostCenterUtilizationReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};

  logger.info('Generating cost center utilization report', { requestId, userId });

  try {
    const fiscalYear = queryParams['fiscalYear'] 
      ? parseInt(queryParams['fiscalYear'], 10) 
      : new Date().getFullYear();

    // Get raw data directly from repository
    const utilizationData = await financialReportRepository.getBudgetUtilizationData(
      {},
      fiscalYear
    );

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      fiscalYear,
      costCenters: utilizationData.rows.map(row => ({
        costCenterCode: row.costCenterCode,
        costCenterName: row.costCenterName,
        departmentName: row.departmentName,
        budgetAmount: row.budgetAmount,
        spentAmount: row.spentAmount,
        availableAmount: row.availableAmount,
        utilizationPercentage: row.utilizationPercentage,
      })),
    };

    logger.info('Cost center utilization report generated', { requestId, costCenterCount: utilizationData.rows.length });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate cost center utilization report');
  }
}

/**
 * Handle procurement spending report
 * Returns: { generatedAt, period, totalSpending, byVendor, byCategory, byMonth }
 */
async function handleProcurementSpendingReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};

  logger.info('Generating procurement spending report', { requestId, userId });

  try {
    const defaultDateFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;
    const defaultDateTo = new Date().toISOString().split('T')[0] as string;
    const dateFrom = queryParams['dateFrom'] ?? defaultDateFrom;
    const dateTo = queryParams['dateTo'] ?? defaultDateTo;

    // Get raw data directly from repository
    const spendingSummary = await financialReportRepository.getProcurementSpendingSummary(
      {},
      dateFrom,
      dateTo
    );

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      period: { from: dateFrom, to: dateTo },
      totalSpending: spendingSummary.totalSpending,
      byVendor: spendingSummary.byVendor.map(v => ({
        vendorName: v.vendorName,
        totalAmount: v.totalAmount,
        poCount: v.poCount,
        percentage: spendingSummary.totalSpending > 0 
          ? Math.round((v.totalAmount / spendingSummary.totalSpending) * 10000) / 100 
          : 0,
      })),
      byCategory: spendingSummary.byCategory.map(c => ({
        category: c.category,
        totalAmount: c.totalAmount,
        percentage: spendingSummary.totalSpending > 0 
          ? Math.round((c.totalAmount / spendingSummary.totalSpending) * 10000) / 100 
          : 0,
      })),
      byMonth: spendingSummary.byMonth.map(m => ({
        month: m.month,
        totalAmount: m.totalAmount,
      })),
    };

    logger.info('Procurement spending report generated', { requestId, totalSpending: spendingSummary.totalSpending });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate procurement spending report');
  }
}

// ============================================================================
// Operational Reports
// ============================================================================

/**
 * Handle work order summary report
 * Returns: { generatedAt, period, totalWorkOrders, byStatus, byType, byPriority, averageCompletionTimeHours, overdueCount }
 */
async function handleWorkOrderSummaryReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);
  const queryParams = event.queryStringParameters ?? {};

  logger.info('Generating work order summary report', { requestId, userId });

  try {
    const defaultDateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string;
    const defaultDateTo = new Date().toISOString().split('T')[0] as string;
    const dateFrom = queryParams['dateFrom'] ?? defaultDateFrom;
    const dateTo = queryParams['dateTo'] ?? defaultDateTo;

    // Get raw data directly from repository
    const workOrderSummary = await operationalReportRepository.getWorkOrderSummarySummary(
      {},
      dateFrom,
      dateTo
    );

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      period: { from: dateFrom, to: dateTo },
      totalWorkOrders: workOrderSummary.totalWorkOrders,
      byStatus: workOrderSummary.byStatus.map(s => ({
        status: s.category,
        count: s.count,
      })),
      byType: workOrderSummary.byType.map(t => ({
        type: t.category,
        count: t.count,
      })),
      byPriority: workOrderSummary.byPriority.map(p => ({
        priority: p.category,
        count: p.count,
      })),
      averageCompletionTimeHours: workOrderSummary.averageCompletionTimeHours,
      overdueCount: workOrderSummary.overdueCount,
    };

    logger.info('Work order summary report generated', { requestId, totalWorkOrders: workOrderSummary.totalWorkOrders });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate work order summary report');
  }
}

/**
 * Handle maintenance compliance report
 * Returns: { generatedAt, totalPlans, activePlans, complianceRate, overdueItems, upcomingItems }
 */
async function handleMaintenanceComplianceReport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generating maintenance compliance report', { requestId, userId });

  try {
    // Get raw data directly from repository
    const complianceSummary = await operationalReportRepository.getMaintenanceComplianceSummary({});
    const complianceData = await operationalReportRepository.getMaintenanceComplianceData({});

    // Separate overdue and upcoming items
    const overdueItems = complianceData.rows
      .filter(row => row.isOverdue)
      .map(row => ({
        planId: row.planId,
        planName: row.planName,
        assetTag: row.assetTag,
        dueDate: row.nextDueDate ?? '',
        daysOverdue: row.daysOverdue ?? 0,
      }));

    const upcomingItems = complianceData.rows
      .filter(row => !row.isOverdue && row.nextDueDate)
      .slice(0, 10) // Limit to 10 upcoming items
      .map(row => ({
        planId: row.planId,
        planName: row.planName,
        assetTag: row.assetTag,
        dueDate: row.nextDueDate ?? '',
        daysUntilDue: row.nextDueDate 
          ? Math.max(0, Math.ceil((new Date(row.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0,
      }));

    // Transform to frontend expected format
    const reportData = {
      generatedAt: new Date().toISOString(),
      totalPlans: complianceSummary.totalPlans,
      activePlans: complianceSummary.activePlans,
      complianceRate: complianceSummary.complianceRate,
      overdueItems,
      upcomingItems,
    };

    logger.info('Maintenance compliance report generated', { 
      requestId, 
      totalPlans: complianceSummary.totalPlans,
      overdueCount: overdueItems.length 
    });

    return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(reportData, requestId));
  } catch (error) {
    return handleError(error, requestId, 'generate maintenance compliance report');
  }
}

export default handler;
