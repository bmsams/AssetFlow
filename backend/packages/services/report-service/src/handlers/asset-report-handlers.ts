/**
 * Asset Report Handlers - Lambda handlers for asset inventory reports
 *
 * Implements HTTP endpoints for:
 * - GET /reports/assets/summary - Asset summary report
 * - GET /reports/assets/aging - Asset aging report
 * - GET /reports/assets/by-location - Asset by location report
 * - GET /reports/assets/by-department - Asset by department report
 *
 * Requirements:
 * - Requirement 18.1: Asset summary report
 * - Requirement 18.2: Asset aging report
 * - Requirement 18.3: Asset by location report
 * - Requirement 18.4: Asset by department report
 * - Requirement 18.5: Support filtering
 * - Requirement 18.6: Export in CSV, Excel, PDF formats
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

import type { ExportFormat } from '../report/report-types';
import type { AssetReportFilters } from '../asset-reports/asset-report-repository';
import * as assetReportService from '../asset-reports/asset-report-service';

const logger = createLogger({ service: 'asset-report-handlers' });

// ============================================================================
// Constants
// ============================================================================

const VALID_FORMATS: ExportFormat[] = ['CSV', 'EXCEL', 'PDF'];
const VALID_ASSET_TYPES = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE', 'ALL'];

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
 * Parse export format from query parameters
 */
function parseExportFormat(queryParams: Record<string, string | undefined>): ExportFormat {
  const format = (queryParams['format'] ?? 'CSV').toUpperCase() as ExportFormat;
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format: ${format}. Valid formats are: ${VALID_FORMATS.join(', ')}`);
  }
  return format;
}

/**
 * Parse common filters from query parameters
 */
function parseFilters(queryParams: Record<string, string | undefined>): AssetReportFilters {
  const filters: AssetReportFilters = {};

  if (queryParams['assetType']) {
    const assetType = queryParams['assetType'].toUpperCase();
    if (!VALID_ASSET_TYPES.includes(assetType)) {
      throw new Error(`Invalid assetType: ${assetType}. Valid types are: ${VALID_ASSET_TYPES.join(', ')}`);
    }
    Object.assign(filters, { assetType: assetType as AssetReportFilters['assetType'] });
  }

  if (queryParams['assetStatus']) {
    Object.assign(filters, { assetStatus: queryParams['assetStatus'] });
  }

  if (queryParams['departmentId']) {
    const uuidError = validateUUID(queryParams['departmentId'], 'departmentId');
    if (uuidError) {
      throw new Error(uuidError.message);
    }
    Object.assign(filters, { departmentId: queryParams['departmentId'] });
  }

  if (queryParams['costCenterId']) {
    const uuidError = validateUUID(queryParams['costCenterId'], 'costCenterId');
    if (uuidError) {
      throw new Error(uuidError.message);
    }
    Object.assign(filters, { costCenterId: queryParams['costCenterId'] });
  }

  if (queryParams['buildingId']) {
    const uuidError = validateUUID(queryParams['buildingId'], 'buildingId');
    if (uuidError) {
      throw new Error(uuidError.message);
    }
    Object.assign(filters, { buildingId: queryParams['buildingId'] });
  }

  if (queryParams['manufacturerId']) {
    const uuidError = validateUUID(queryParams['manufacturerId'], 'manufacturerId');
    if (uuidError) {
      throw new Error(uuidError.message);
    }
    Object.assign(filters, { manufacturerId: queryParams['manufacturerId'] });
  }

  if (queryParams['dateFrom']) {
    Object.assign(filters, { dateFrom: queryParams['dateFrom'] });
  }

  if (queryParams['dateTo']) {
    Object.assign(filters, { dateTo: queryParams['dateTo'] });
  }

  if (queryParams['includeInactive'] === 'true') {
    Object.assign(filters, { includeInactive: true });
  }

  return filters;
}

/**
 * Create error response for handler errors
 */
function handleError(
  error: unknown,
  requestId: string,
  operation: string
): APIGatewayProxyResult {
  const err = error as Error;
  
  // Check for validation errors
  if (err.message.includes('Invalid') || err.message.includes('required')) {
    logger.warn(`Validation error in ${operation}`, { requestId, error: err.message });
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
    );
  }

  logger.error(`Failed to ${operation}`, err, { requestId });
  return createLambdaResponse(
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, `Failed to ${operation}`, requestId)
  );
}

// ============================================================================
// Lambda Handlers
// ============================================================================

/**
 * Generate asset summary report
 * GET /reports/assets/summary
 *
 * Query Parameters:
 * - format: CSV | EXCEL | PDF (default: CSV)
 * - title: Report title (optional)
 * - assetType: HARDWARE | SOFTWARE | ENTERPRISE | ALL (optional)
 * - assetStatus: Asset status filter (optional)
 * - departmentId: Filter by department (optional)
 * - costCenterId: Filter by cost center (optional)
 * - dateFrom: Filter by acquisition date from (optional)
 * - dateTo: Filter by acquisition date to (optional)
 *
 * Requirement 18.1: Return aggregated counts by asset type, status, and location
 */
export async function generateAssetSummaryReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate asset summary report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseFilters(queryParams);

    const result = await assetReportService.generateAssetSummaryReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Asset summary report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Asset summary report generated successfully', {
      requestId,
      reportId: result.reportId,
      totalRecords: result.metadata.totalRecords,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        reportId: result.reportId,
        metadata: result.metadata,
        content: result.content,
      }, requestId)
    );
  } catch (error) {
    return handleError(error, requestId, 'generate asset summary report');
  }
}

/**
 * Generate asset aging report
 * GET /reports/assets/aging
 *
 * Query Parameters:
 * - format: CSV | EXCEL | PDF (default: CSV)
 * - title: Report title (optional)
 * - includeDetails: Include individual asset details (default: false)
 * - assetType: HARDWARE | SOFTWARE | ENTERPRISE | ALL (optional)
 * - assetStatus: Asset status filter (optional)
 * - departmentId: Filter by department (optional)
 * - costCenterId: Filter by cost center (optional)
 * - dateFrom: Filter by acquisition date from (optional)
 * - dateTo: Filter by acquisition date to (optional)
 *
 * Requirement 18.2: Return assets grouped by age ranges with depreciation status
 */
export async function generateAssetAgingReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate asset aging report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseFilters(queryParams);
    const includeDetails = queryParams['includeDetails'] === 'true';

    const result = await assetReportService.generateAssetAgingReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        includeDetails,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Asset aging report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Asset aging report generated successfully', {
      requestId,
      reportId: result.reportId,
      totalRecords: result.metadata.totalRecords,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        reportId: result.reportId,
        metadata: result.metadata,
        content: result.content,
      }, requestId)
    );
  } catch (error) {
    return handleError(error, requestId, 'generate asset aging report');
  }
}

/**
 * Generate asset by location report
 * GET /reports/assets/by-location
 *
 * Query Parameters:
 * - format: CSV | EXCEL | PDF (default: CSV)
 * - title: Report title (optional)
 * - buildingId: Filter by specific building (optional)
 * - assetType: HARDWARE | SOFTWARE | ENTERPRISE | ALL (optional)
 * - assetStatus: Asset status filter (optional)
 * - dateFrom: Filter by acquisition date from (optional)
 * - dateTo: Filter by acquisition date to (optional)
 *
 * Requirement 18.3: Return assets grouped by building, floor, and room hierarchy
 */
export async function generateAssetByLocationReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate asset by location report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseFilters(queryParams);
    const buildingId = queryParams['buildingId'];

    // Validate buildingId if provided
    if (buildingId) {
      const uuidError = validateUUID(buildingId, 'buildingId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    const result = await assetReportService.generateAssetByLocationReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        buildingId,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Asset by location report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Asset by location report generated successfully', {
      requestId,
      reportId: result.reportId,
      totalRecords: result.metadata.totalRecords,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        reportId: result.reportId,
        metadata: result.metadata,
        content: result.content,
      }, requestId)
    );
  } catch (error) {
    return handleError(error, requestId, 'generate asset by location report');
  }
}

/**
 * Generate asset by department report
 * GET /reports/assets/by-department
 *
 * Query Parameters:
 * - format: CSV | EXCEL | PDF (default: CSV)
 * - title: Report title (optional)
 * - departmentId: Filter by specific department (optional)
 * - assetType: HARDWARE | SOFTWARE | ENTERPRISE | ALL (optional)
 * - assetStatus: Asset status filter (optional)
 * - costCenterId: Filter by cost center (optional)
 * - dateFrom: Filter by acquisition date from (optional)
 * - dateTo: Filter by acquisition date to (optional)
 *
 * Requirement 18.4: Return assets grouped by department with cost allocation
 */
export async function generateAssetByDepartmentReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate asset by department report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseFilters(queryParams);
    const departmentId = queryParams['departmentId'];

    // Validate departmentId if provided
    if (departmentId) {
      const uuidError = validateUUID(departmentId, 'departmentId');
      if (uuidError) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
        );
      }
    }

    const result = await assetReportService.generateAssetByDepartmentReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        departmentId,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Asset by department report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Asset by department report generated successfully', {
      requestId,
      reportId: result.reportId,
      totalRecords: result.metadata.totalRecords,
    });

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse({
        reportId: result.reportId,
        metadata: result.metadata,
        content: result.content,
      }, requestId)
    );
  } catch (error) {
    return handleError(error, requestId, 'generate asset by department report');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

// Note: getContentType function removed as createLambdaResponse doesn't support custom headers
// If custom headers are needed in the future, the function can be restored:
// function getContentType(format: ExportFormat): string {
//   switch (format) {
//     case 'CSV': return 'text/csv';
//     case 'EXCEL': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
//     case 'PDF': return 'application/pdf';
//     default: return 'application/json';
//   }
// }
