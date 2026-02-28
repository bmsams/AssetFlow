/**
 * Generate Report Lambda Handler
 *
 * Generates standard reports with multiple export formats.
 *
 * Requirements:
 * - 16.1: Generate standard reports: Asset Inventory, Compliance Summary, Cost Analysis, Lifecycle Status
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 * - 16.9: Log report access for audit purposes
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type {
  AssetStatusFilter,
  AssetTypeFilter,
  ExportFormat,
  GenerateReportRequest,
  ReportFilters,
  ReportType,
} from '../report/report-types';
import * as reportService from '../report/report-service';

const logger = createLogger({ service: 'generate-report-handler' });

/**
 * Valid report types
 */
const VALID_REPORT_TYPES: ReportType[] = [
  'ASSET_INVENTORY',
  'COMPLIANCE_SUMMARY',
  'COST_ANALYSIS',
  'LIFECYCLE_STATUS',
];

/**
 * Valid export formats
 */
const VALID_EXPORT_FORMATS: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];

/**
 * Valid asset types for filtering
 */
const VALID_ASSET_TYPES: AssetTypeFilter[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE', 'ALL'];

/**
 * Valid asset statuses for filtering
 */
const VALID_ASSET_STATUSES: AssetStatusFilter[] = [
  'ORDERED',
  'RECEIVED',
  'IN_STOCK',
  'RESERVED',
  'DEPLOYED',
  'IN_MAINTENANCE',
  'RETIRED',
  'DISPOSED',
  'ALL',
];

/**
 * Request body interface
 */
interface GenerateReportBody {
  reportType: string;
  format: string;
  title?: string;
  description?: string;
  filters?: {
    assetType?: string;
    assetStatus?: string;
    departmentId?: string;
    costCenterId?: string;
    stockroomId?: string;
    dateFrom?: string;
    dateTo?: string;
    customFilters?: Record<string, unknown>;
  };
  includeCharts?: boolean;
  pageSize?: number;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: GenerateReportRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as GenerateReportBody;
  const errors: string[] = [];

  // Validate reportType (required)
  if (!request.reportType) {
    errors.push('reportType is required');
  } else if (typeof request.reportType !== 'string') {
    errors.push('reportType must be a string');
  } else if (!VALID_REPORT_TYPES.includes(request.reportType as ReportType)) {
    errors.push(`Invalid reportType: ${request.reportType}. Valid types are: ${VALID_REPORT_TYPES.join(', ')}`);
  }

  // Validate format (required)
  if (!request.format) {
    errors.push('format is required');
  } else if (typeof request.format !== 'string') {
    errors.push('format must be a string');
  } else if (!VALID_EXPORT_FORMATS.includes(request.format as ExportFormat)) {
    errors.push(`Invalid format: ${request.format}. Valid formats are: ${VALID_EXPORT_FORMATS.join(', ')}`);
  }

  // Validate title (optional)
  if (request.title !== undefined && request.title !== null) {
    if (typeof request.title !== 'string') {
      errors.push('title must be a string');
    } else if (request.title.length > 255) {
      errors.push('title must be 255 characters or less');
    }
  }

  // Validate description (optional)
  if (request.description !== undefined && request.description !== null) {
    if (typeof request.description !== 'string') {
      errors.push('description must be a string');
    } else if (request.description.length > 1000) {
      errors.push('description must be 1000 characters or less');
    }
  }

  // Validate filters (optional)
  let validatedFilters: ReportFilters | undefined;
  if (request.filters) {
    if (typeof request.filters !== 'object' || Array.isArray(request.filters)) {
      errors.push('filters must be an object');
    } else {
      const filterErrors = validateFilters(request.filters);
      errors.push(...filterErrors);

      if (filterErrors.length === 0) {
        validatedFilters = {
          assetType: request.filters.assetType as AssetTypeFilter | undefined,
          assetStatus: request.filters.assetStatus as AssetStatusFilter | undefined,
          departmentId: request.filters.departmentId,
          costCenterId: request.filters.costCenterId,
          stockroomId: request.filters.stockroomId,
          dateFrom: request.filters.dateFrom,
          dateTo: request.filters.dateTo,
          customFilters: request.filters.customFilters,
        };
      }
    }
  }

  // Validate includeCharts (optional)
  if (request.includeCharts !== undefined && request.includeCharts !== null) {
    if (typeof request.includeCharts !== 'boolean') {
      errors.push('includeCharts must be a boolean');
    }
  }

  // Validate pageSize (optional)
  if (request.pageSize !== undefined && request.pageSize !== null) {
    if (typeof request.pageSize !== 'number') {
      errors.push('pageSize must be a number');
    } else if (request.pageSize < 1 || request.pageSize > 10000) {
      errors.push('pageSize must be between 1 and 10000');
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      reportType: request.reportType as ReportType,
      format: request.format as ExportFormat,
      title: request.title,
      description: request.description,
      filters: validatedFilters,
      includeCharts: request.includeCharts,
      pageSize: request.pageSize,
    },
  };
}

/**
 * Validate filter parameters
 */
function validateFilters(filters: GenerateReportBody['filters']): string[] {
  const errors: string[] = [];

  if (!filters) {
    return errors;
  }

  // Validate assetType
  if (filters.assetType !== undefined && filters.assetType !== null) {
    if (typeof filters.assetType !== 'string') {
      errors.push('filters.assetType must be a string');
    } else if (!VALID_ASSET_TYPES.includes(filters.assetType as AssetTypeFilter)) {
      errors.push(`Invalid filters.assetType: ${filters.assetType}. Valid types are: ${VALID_ASSET_TYPES.join(', ')}`);
    }
  }

  // Validate assetStatus
  if (filters.assetStatus !== undefined && filters.assetStatus !== null) {
    if (typeof filters.assetStatus !== 'string') {
      errors.push('filters.assetStatus must be a string');
    } else if (!VALID_ASSET_STATUSES.includes(filters.assetStatus as AssetStatusFilter)) {
      errors.push(`Invalid filters.assetStatus: ${filters.assetStatus}. Valid statuses are: ${VALID_ASSET_STATUSES.join(', ')}`);
    }
  }

  // Validate UUID fields
  const uuidFields = ['departmentId', 'costCenterId', 'stockroomId'] as const;
  for (const field of uuidFields) {
    const value = filters[field];
    if (value !== undefined && value !== null) {
      if (typeof value !== 'string') {
        errors.push(`filters.${field} must be a string`);
      } else {
        const uuidError = validateUUID(value, `filters.${field}`);
        if (uuidError) {
          errors.push(uuidError.message);
        }
      }
    }
  }

  // Validate date fields
  if (filters.dateFrom !== undefined && filters.dateFrom !== null) {
    if (typeof filters.dateFrom !== 'string') {
      errors.push('filters.dateFrom must be a string');
    } else {
      const date = new Date(filters.dateFrom);
      if (isNaN(date.getTime())) {
        errors.push('filters.dateFrom must be a valid ISO date string');
      }
    }
  }

  if (filters.dateTo !== undefined && filters.dateTo !== null) {
    if (typeof filters.dateTo !== 'string') {
      errors.push('filters.dateTo must be a string');
    } else {
      const date = new Date(filters.dateTo);
      if (isNaN(date.getTime())) {
        errors.push('filters.dateTo must be a valid ISO date string');
      }
    }
  }

  // Validate date range
  if (filters.dateFrom && filters.dateTo) {
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate > toDate) {
      errors.push('filters.dateFrom must be before filters.dateTo');
    }
  }

  // Validate customFilters
  if (filters.customFilters !== undefined && filters.customFilters !== null) {
    if (typeof filters.customFilters !== 'object' || Array.isArray(filters.customFilters)) {
      errors.push('filters.customFilters must be an object');
    }
  }

  return errors;
}

/**
 * Lambda handler for generating reports
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Generate report request received', { requestId });

  try {
    // Validate user ID
    if (!userId) {
      return createLambdaResponse(
        HTTP_STATUS.UNAUTHORIZED,
        createErrorResponse(API_ERROR_CODES.UNAUTHORIZED, 'User authentication required', requestId)
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = event.body ? JSON.parse(event.body) : null;
    } catch {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, 'Invalid JSON in request body', requestId)
      );
    }

    // Validate request
    const validation = validateRequest(body);
    if (!validation.valid) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(
          API_ERROR_CODES.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors.map(msg => ({ field: '', message: msg, code: 'VALIDATION_ERROR' }))
        )
      );
    }

    // Generate the report
    const result = await reportService.generateReport(validation.data, userId);

    logger.info('Report generated', {
      requestId,
      reportId: result.reportId,
      reportType: validation.data.reportType,
      format: validation.data.format,
      status: result.status,
    });

    // Return appropriate response based on status
    if (result.status === 'FAILED') {
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(
          API_ERROR_CODES.INTERNAL_ERROR,
          result.errorMessage ?? 'Failed to generate report',
          requestId
        )
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.OK,
      createApiResponse(result, requestId)
    );
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate report', err, { requestId });

    // Handle specific errors
    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to generate report', requestId)
    );
  }
}

