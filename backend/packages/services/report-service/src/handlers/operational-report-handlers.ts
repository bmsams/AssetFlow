/**
 * Operational Report Handlers - Lambda handlers for operational reports
 *
 * Implements HTTP endpoints for:
 * - GET /reports/operational/work-orders - Work order summary report
 * - GET /reports/operational/maintenance-compliance - Maintenance compliance report
 * - GET /reports/operational/stockroom-inventory - Stockroom inventory report
 * - GET /reports/operational/transfer-orders - Transfer order report
 * - GET /reports/operational/asset-lifecycle - Asset lifecycle report
 *
 * Requirements:
 * - Requirement 20.1: Work order summary report
 * - Requirement 20.2: Maintenance compliance report
 * - Requirement 20.3: Stockroom inventory report
 * - Requirement 20.4: Transfer order report
 * - Requirement 20.5: Asset lifecycle report
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
import type { OperationalReportFilters } from '../operational-reports/operational-report-types';
import * as operationalReportService from '../operational-reports/operational-report-service';

const logger = createLogger({ service: 'operational-report-handlers' });

// ============================================================================
// Constants
// ============================================================================

const VALID_FORMATS: ExportFormat[] = ['CSV', 'EXCEL', 'PDF'];

// ============================================================================
// Helper Functions
// ============================================================================

function getUserId(event: APIGatewayProxyEvent): UUID {
  return (event.requestContext.authorizer?.['claims']?.['sub'] as UUID) ?? 'system';
}

function parseExportFormat(queryParams: Record<string, string | undefined>): ExportFormat {
  const format = (queryParams['format'] ?? 'CSV').toUpperCase() as ExportFormat;
  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Invalid format: ${format}. Valid formats are: ${VALID_FORMATS.join(', ')}`);
  }
  return format;
}

function parseOperationalFilters(queryParams: Record<string, string | undefined>): OperationalReportFilters {
  const filters: OperationalReportFilters = {};

  if (queryParams['assetType']) {
    Object.assign(filters, { assetType: queryParams['assetType'].toUpperCase() });
  }

  if (queryParams['assetStatus']) {
    Object.assign(filters, { assetStatus: queryParams['assetStatus'] });
  }

  if (queryParams['departmentId']) {
    const uuidError = validateUUID(queryParams['departmentId'], 'departmentId');
    if (uuidError) throw new Error(uuidError.message);
    Object.assign(filters, { departmentId: queryParams['departmentId'] });
  }

  if (queryParams['stockroomId']) {
    const uuidError = validateUUID(queryParams['stockroomId'], 'stockroomId');
    if (uuidError) throw new Error(uuidError.message);
    Object.assign(filters, { stockroomId: queryParams['stockroomId'] });
  }

  if (queryParams['stockroomType']) {
    Object.assign(filters, { stockroomType: queryParams['stockroomType'] });
  }

  if (queryParams['assignedTo']) {
    const uuidError = validateUUID(queryParams['assignedTo'], 'assignedTo');
    if (uuidError) throw new Error(uuidError.message);
    Object.assign(filters, { assignedTo: queryParams['assignedTo'] });
  }

  if (queryParams['workOrderStatus']) {
    Object.assign(filters, { workOrderStatus: queryParams['workOrderStatus'] });
  }

  if (queryParams['workOrderType']) {
    Object.assign(filters, { workOrderType: queryParams['workOrderType'] });
  }

  if (queryParams['priority']) {
    Object.assign(filters, { priority: queryParams['priority'] });
  }

  if (queryParams['maintenanceType']) {
    Object.assign(filters, { maintenanceType: queryParams['maintenanceType'] });
  }

  if (queryParams['transferStatus']) {
    Object.assign(filters, { transferStatus: queryParams['transferStatus'] });
  }

  return filters;
}

function handleError(error: unknown, requestId: string, operation: string): APIGatewayProxyResult {
  const err = error as Error;
  
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
 * Generate work order summary report
 * GET /reports/operational/work-orders
 *
 * Requirement 20.1: Work order counts by status, type, and priority with average completion times
 */
export async function generateWorkOrderSummaryReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate work order summary report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseOperationalFilters(queryParams);

    const result = await operationalReportService.generateWorkOrderSummaryReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        dateFrom: queryParams['dateFrom'],
        dateTo: queryParams['dateTo'],
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Work order summary report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Work order summary report generated successfully', {
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
    return handleError(error, requestId, 'generate work order summary report');
  }
}

/**
 * Generate maintenance compliance report
 * GET /reports/operational/maintenance-compliance
 *
 * Requirement 20.2: Maintenance plan adherence rates and overdue maintenance items
 */
export async function generateMaintenanceComplianceReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate maintenance compliance report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseOperationalFilters(queryParams);
    const includeOverdueOnly = queryParams['includeOverdueOnly'] === 'true';

    const result = await operationalReportService.generateMaintenanceComplianceReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        includeOverdueOnly,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Maintenance compliance report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Maintenance compliance report generated successfully', {
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
    return handleError(error, requestId, 'generate maintenance compliance report');
  }
}

/**
 * Generate stockroom inventory report
 * GET /reports/operational/stockroom-inventory
 *
 * Requirement 20.3: Current inventory levels with reorder alerts and utilization metrics
 */
export async function generateStockroomInventoryReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate stockroom inventory report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseOperationalFilters(queryParams);
    const includeReorderAlertsOnly = queryParams['includeReorderAlertsOnly'] === 'true';

    const result = await operationalReportService.generateStockroomInventoryReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        includeReorderAlertsOnly,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Stockroom inventory report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Stockroom inventory report generated successfully', {
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
    return handleError(error, requestId, 'generate stockroom inventory report');
  }
}

/**
 * Generate transfer order report
 * GET /reports/operational/transfer-orders
 *
 * Requirement 20.4: Transfer activity between stockrooms with average fulfillment times
 */
export async function generateTransferOrderReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate transfer order report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseOperationalFilters(queryParams);

    const result = await operationalReportService.generateTransferOrderReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
        dateFrom: queryParams['dateFrom'],
        dateTo: queryParams['dateTo'],
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Transfer order report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Transfer order report generated successfully', {
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
    return handleError(error, requestId, 'generate transfer order report');
  }
}

/**
 * Generate asset lifecycle report
 * GET /reports/operational/asset-lifecycle
 *
 * Requirement 20.5: Assets by lifecycle stage with average time in each stage
 */
export async function generateAssetLifecycleReportHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = getUserId(event);

  logger.info('Generate asset lifecycle report request received', { requestId });

  try {
    const queryParams = event.queryStringParameters ?? {};
    const format = parseExportFormat(queryParams);
    const filters = parseOperationalFilters(queryParams);

    const result = await operationalReportService.generateAssetLifecycleReport(
      {
        format,
        title: queryParams['title'],
        description: queryParams['description'],
        filters,
      },
      userId
    );

    if (result.status === 'FAILED') {
      logger.error('Asset lifecycle report generation failed', new Error(result.errorMessage), {
        requestId,
        reportId: result.reportId,
      });
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, result.errorMessage ?? 'Report generation failed', requestId)
      );
    }

    logger.info('Asset lifecycle report generated successfully', {
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
    return handleError(error, requestId, 'generate asset lifecycle report');
  }
}
