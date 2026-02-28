/**
 * Generate Compliance Report Lambda Handler
 *
 * Generates audit-ready compliance reports showing license ownership
 * and usage evidence. Supports multiple export formats (PDF, Excel, CSV).
 *
 * Requirements: 4.14, 16.7
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import {
  API_ERROR_CODES,
  createApiResponse,
  createErrorResponse,
  createLambdaResponse,
  HTTP_STATUS,
} from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type {
  ComplianceStatusFilter,
  ExportFormat,
  ReportFilterOptions,
} from '../compliance-report/compliance-report-repository';
import * as complianceReportService from '../compliance-report/compliance-report-service';

const logger = createLogger({ service: 'generate-compliance-report-handler' });

/**
 * Request body for report generation
 */
interface GenerateReportRequestBody {
  readonly reportType?: 'FULL' | 'SUMMARY' | 'BY_PUBLISHER' | 'AUDIT_PREP';
  readonly title?: string;
  readonly description?: string;
  readonly filters?: {
    readonly productIds?: string[];
    readonly publishers?: string[];
    readonly complianceStatus?: ComplianceStatusFilter;
    readonly startDate?: string;
    readonly endDate?: string;
    readonly includeEvidence?: boolean;
    readonly includeInstallations?: boolean;
    readonly includeAuditTrail?: boolean;
  };
}

/**
 * Validate export format
 */
function isValidExportFormat(format: string): format is ExportFormat {
  return ['PDF', 'EXCEL', 'CSV'].includes(format.toUpperCase());
}

/**
 * Validate compliance status filter
 */
function isValidComplianceStatus(status: string): status is ComplianceStatusFilter {
  return ['ALL', 'COMPLIANT', 'OVER_LICENSED', 'UNDER_LICENSED'].includes(status.toUpperCase());
}

/**
 * Lambda handler for generating compliance reports
 *
 * POST /compliance/reports
 * Generates a new compliance report with the specified options.
 *
 * GET /compliance/reports/{reportId}
 * Retrieves a previously generated report.
 *
 * GET /compliance/reports/{reportId}/export?format=PDF|EXCEL|CSV
 * Exports a report in the specified format.
 *
 * GET /compliance/summary
 * Returns compliance summary statistics.
 *
 * GET /compliance/publishers
 * Returns list of available publishers for filtering.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const httpMethod = event.httpMethod;
  const path = event.path;
  const reportId = event.pathParameters?.['reportId'];
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Compliance report request received', {
    requestId,
    httpMethod,
    path,
    reportId,
  });

  try {
    // Handle different endpoints
    if (path.endsWith('/summary') && httpMethod === 'GET') {
      return await handleGetSummary(event, requestId);
    }

    if (path.endsWith('/publishers') && httpMethod === 'GET') {
      return await handleGetPublishers(requestId);
    }

    if (path.includes('/export') && httpMethod === 'GET') {
      return await handleExportReport(event, requestId);
    }

    if (reportId && httpMethod === 'GET') {
      return await handleGetReport(reportId, requestId);
    }

    if (httpMethod === 'POST') {
      return await handleGenerateReport(event, requestId, userId);
    }

    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'Invalid request method or path',
        requestId
      )
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to process compliance report request', err, { requestId });

    if (err.message.includes('not found')) {
      return createLambdaResponse(
        HTTP_STATUS.NOT_FOUND,
        createErrorResponse(API_ERROR_CODES.NOT_FOUND, err.message, requestId)
      );
    }

    if (err.message.includes('Unsupported')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(
        API_ERROR_CODES.INTERNAL_ERROR,
        'Failed to process compliance report request',
        requestId
      )
    );
  }
}

/**
 * Handle POST /compliance/reports - Generate new report
 */
async function handleGenerateReport(
  event: APIGatewayProxyEvent,
  requestId: string,
  userId?: string
): Promise<APIGatewayProxyResult> {
  logger.info('Generating compliance report', { requestId, userId });

  let requestBody: GenerateReportRequestBody = {};

  if (event.body) {
    try {
      requestBody = JSON.parse(event.body) as GenerateReportRequestBody;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Invalid JSON in request body',
          requestId
        )
      );
    }
  }

  // Validate filters
  const filters: ReportFilterOptions = {};

  if (requestBody.filters) {
    // Validate product IDs
    if (requestBody.filters.productIds) {
      for (const productId of requestBody.filters.productIds) {
        const uuidError = validateUUID(productId, 'productId');
        if (uuidError) {
          return createLambdaResponse(
            HTTP_STATUS.BAD_REQUEST,
            createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
          );
        }
      }
      (filters as { productIds?: string[] }).productIds = requestBody.filters.productIds;
    }

    // Validate compliance status
    if (requestBody.filters.complianceStatus) {
      if (!isValidComplianceStatus(requestBody.filters.complianceStatus)) {
        return createLambdaResponse(
          HTTP_STATUS.BAD_REQUEST,
          createErrorResponse(
            API_ERROR_CODES.VALIDATION_ERROR,
            'Invalid compliance status. Must be one of: ALL, COMPLIANT, OVER_LICENSED, UNDER_LICENSED',
            requestId
          )
        );
      }
      (filters as { complianceStatus?: ComplianceStatusFilter }).complianceStatus =
        requestBody.filters.complianceStatus;
    }

    // Copy other filter options
    if (requestBody.filters.publishers) {
      (filters as { publishers?: string[] }).publishers = requestBody.filters.publishers;
    }
    if (requestBody.filters.startDate) {
      (filters as { startDate?: string }).startDate = requestBody.filters.startDate;
    }
    if (requestBody.filters.endDate) {
      (filters as { endDate?: string }).endDate = requestBody.filters.endDate;
    }
    if (requestBody.filters.includeEvidence !== undefined) {
      (filters as { includeEvidence?: boolean }).includeEvidence = requestBody.filters.includeEvidence;
    }
    if (requestBody.filters.includeInstallations !== undefined) {
      (filters as { includeInstallations?: boolean }).includeInstallations =
        requestBody.filters.includeInstallations;
    }
    if (requestBody.filters.includeAuditTrail !== undefined) {
      (filters as { includeAuditTrail?: boolean }).includeAuditTrail =
        requestBody.filters.includeAuditTrail;
    }
  }

  const report = await complianceReportService.generateComplianceReport({
    reportType: requestBody.reportType,
    title: requestBody.title,
    description: requestBody.description,
    filters,
    generatedBy: userId,
  });

  logger.info('Compliance report generated', {
    requestId,
    reportId: report.reportId,
    productCount: report.metadata.productCount,
    complianceRate: report.summary.complianceRate,
  });

  return createLambdaResponse(HTTP_STATUS.CREATED, createApiResponse(report, requestId));
}

/**
 * Handle GET /compliance/reports/{reportId} - Get existing report
 */
async function handleGetReport(
  reportId: string,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const uuidError = validateUUID(reportId, 'reportId');
  if (uuidError) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
    );
  }

  logger.info('Getting compliance report', { requestId, reportId });

  const report = await complianceReportService.getReport(reportId);

  if (!report) {
    return createLambdaResponse(
      HTTP_STATUS.NOT_FOUND,
      createErrorResponse(
        API_ERROR_CODES.NOT_FOUND,
        `Report not found: ${reportId}`,
        requestId
      )
    );
  }

  return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(report, requestId));
}

/**
 * Handle GET /compliance/reports/{reportId}/export - Export report
 */
async function handleExportReport(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  const reportId = event.pathParameters?.['reportId'];
  const format = event.queryStringParameters?.['format']?.toUpperCase() ?? 'CSV';

  if (!reportId) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Report ID is required', requestId)
    );
  }

  const uuidError = validateUUID(reportId, 'reportId');
  if (uuidError) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(API_ERROR_CODES.VALIDATION_ERROR, uuidError.message, requestId)
    );
  }

  if (!isValidExportFormat(format)) {
    return createLambdaResponse(
      HTTP_STATUS.BAD_REQUEST,
      createErrorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'Invalid export format. Must be one of: PDF, EXCEL, CSV',
        requestId
      )
    );
  }

  logger.info('Exporting compliance report', { requestId, reportId, format });

  const exportResult = await complianceReportService.exportReport(
    reportId,
    format as ExportFormat
  );

  logger.info('Compliance report exported', {
    requestId,
    reportId,
    format,
    filename: exportResult.filename,
    sizeBytes: exportResult.sizeBytes,
  });

  // Return the export result with content
  return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(exportResult, requestId));
}

/**
 * Handle GET /compliance/summary - Get compliance summary
 */
async function handleGetSummary(
  event: APIGatewayProxyEvent,
  requestId: string
): Promise<APIGatewayProxyResult> {
  logger.info('Getting compliance summary', { requestId });

  const filters: ReportFilterOptions = {};

  // Parse query parameters for filters
  const queryParams = event.queryStringParameters ?? {};

  if (queryParams['publishers']) {
    (filters as { publishers?: string[] }).publishers = queryParams['publishers'].split(',');
  }

  if (queryParams['complianceStatus']) {
    if (isValidComplianceStatus(queryParams['complianceStatus'])) {
      (filters as { complianceStatus?: ComplianceStatusFilter }).complianceStatus =
        queryParams['complianceStatus'] as ComplianceStatusFilter;
    }
  }

  const summary = await complianceReportService.getComplianceSummary(filters);

  logger.info('Compliance summary retrieved', {
    requestId,
    totalProducts: summary.totalProducts,
    complianceRate: summary.complianceRate,
  });

  return createLambdaResponse(HTTP_STATUS.OK, createApiResponse(summary, requestId));
}

/**
 * Handle GET /compliance/publishers - Get available publishers
 */
async function handleGetPublishers(requestId: string): Promise<APIGatewayProxyResult> {
  logger.info('Getting available publishers', { requestId });

  const publishers = await complianceReportService.getAvailablePublishers();

  return createLambdaResponse(
    HTTP_STATUS.OK,
    createApiResponse({ publishers, total: publishers.length }, requestId)
  );
}
