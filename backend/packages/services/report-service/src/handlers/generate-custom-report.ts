/**
 * Generate Custom Report Lambda Handler
 *
 * Generates custom reports with configurable columns, filters, and groupings.
 *
 * Requirements:
 * - 16.2: Support custom report creation with configurable columns, filters, and groupings
 * - 16.9: Log report access for audit purposes
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { API_ERROR_CODES, createApiResponse, createErrorResponse, createLambdaResponse, HTTP_STATUS } from '@ams/types';
import { createLogger, validateUUID } from '@ams/utils';

import type {
  CustomReportColumn,
  CustomReportDataSource,
  CustomReportDefinition,
  CustomReportFilter,
  ExportFormat,
  GenerateCustomReportRequest,
} from '../report/report-types';
import * as customReportService from '../custom/custom-report-service';

const logger = createLogger({ service: 'generate-custom-report-handler' });

/**
 * Valid data sources
 */
const VALID_DATA_SOURCES: CustomReportDataSource[] = [
  'ASSETS', 'HARDWARE_ASSETS', 'SOFTWARE_ASSETS', 'ENTERPRISE_ASSETS',
  'CONTRACTS', 'PURCHASE_ORDERS', 'WORK_ORDERS', 'STOCKROOMS',
  'ENTITLEMENTS', 'INSTALLATIONS',
];

/**
 * Valid export formats
 */
const VALID_EXPORT_FORMATS: ExportFormat[] = ['PDF', 'EXCEL', 'CSV'];

/**
 * Request body interface
 */
interface GenerateCustomReportBody {
  definition: {
    dataSource: string;
    columns: Array<{
      columnId?: string;
      fieldName: string;
      displayName: string;
      dataType?: string;
      width?: number;
      sortable?: boolean;
      filterable?: boolean;
      aggregation?: string;
      format?: string;
      visible?: boolean;
      order?: number;
    }>;
    filters?: Array<{
      filterId?: string;
      fieldName: string;
      operator: string;
      value?: unknown;
      logicalOperator?: string;
    }>;
    groupings?: Array<{
      groupId?: string;
      fieldName: string;
      displayName: string;
      order: number;
      sortDirection?: string;
      showSubtotals?: boolean;
    }>;
    sorting?: Array<{
      fieldName: string;
      direction: string;
      order: number;
    }>;
    includeSubtotals?: boolean;
    includeGrandTotal?: boolean;
    rowLimit?: number;
  };
  format: string;
  title?: string;
  description?: string;
  templateId?: string;
  includeCharts?: boolean;
}

/**
 * Validate request body
 */
function validateRequest(body: unknown): { valid: true; data: GenerateCustomReportRequest } | { valid: false; errors: string[] } {
  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const request = body as GenerateCustomReportBody;
  const errors: string[] = [];

  // Validate definition
  if (!request.definition) {
    errors.push('definition is required');
  } else {
    // Validate dataSource
    if (!request.definition.dataSource) {
      errors.push('definition.dataSource is required');
    } else if (!VALID_DATA_SOURCES.includes(request.definition.dataSource as CustomReportDataSource)) {
      errors.push(`Invalid dataSource: ${request.definition.dataSource}. Valid sources are: ${VALID_DATA_SOURCES.join(', ')}`);
    }

    // Validate columns
    if (!request.definition.columns || !Array.isArray(request.definition.columns)) {
      errors.push('definition.columns is required and must be an array');
    } else if (request.definition.columns.length === 0) {
      errors.push('At least one column is required');
    } else {
      for (let i = 0; i < request.definition.columns.length; i++) {
        const col = request.definition.columns[i];
        if (!col) continue;
        if (!col.fieldName) {
          errors.push(`definition.columns[${i}].fieldName is required`);
        }
        if (!col.displayName) {
          errors.push(`definition.columns[${i}].displayName is required`);
        }
      }
    }

    // Validate filters if provided
    if (request.definition.filters) {
      if (!Array.isArray(request.definition.filters)) {
        errors.push('definition.filters must be an array');
      } else {
        for (let i = 0; i < request.definition.filters.length; i++) {
          const filter = request.definition.filters[i];
          if (!filter) continue;
          if (!filter.fieldName) {
            errors.push(`definition.filters[${i}].fieldName is required`);
          }
          if (!filter.operator) {
            errors.push(`definition.filters[${i}].operator is required`);
          }
        }
      }
    }

    // Validate groupings if provided
    if (request.definition.groupings) {
      if (!Array.isArray(request.definition.groupings)) {
        errors.push('definition.groupings must be an array');
      } else {
        for (let i = 0; i < request.definition.groupings.length; i++) {
          const grouping = request.definition.groupings[i];
          if (!grouping) continue;
          if (!grouping.fieldName) {
            errors.push(`definition.groupings[${i}].fieldName is required`);
          }
          if (grouping.order === undefined) {
            errors.push(`definition.groupings[${i}].order is required`);
          }
        }
      }
    }

    // Validate rowLimit
    if (request.definition.rowLimit !== undefined) {
      if (typeof request.definition.rowLimit !== 'number' || request.definition.rowLimit < 1 || request.definition.rowLimit > 100000) {
        errors.push('definition.rowLimit must be a number between 1 and 100000');
      }
    }
  }

  // Validate format
  if (!request.format) {
    errors.push('format is required');
  } else if (!VALID_EXPORT_FORMATS.includes(request.format as ExportFormat)) {
    errors.push(`Invalid format: ${request.format}. Valid formats are: ${VALID_EXPORT_FORMATS.join(', ')}`);
  }

  // Validate title
  if (request.title !== undefined && request.title !== null) {
    if (typeof request.title !== 'string' || request.title.length > 255) {
      errors.push('title must be a string of 255 characters or less');
    }
  }

  // Validate templateId
  if (request.templateId) {
    const uuidError = validateUUID(request.templateId, 'templateId');
    if (uuidError) {
      errors.push(uuidError.message);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Build validated request
  const validatedDefinition: CustomReportDefinition = {
    dataSource: request.definition.dataSource as CustomReportDataSource,
    columns: request.definition.columns.map((col, i) => ({
      columnId: col.columnId ?? `col-${i}`,
      fieldName: col.fieldName,
      displayName: col.displayName,
      dataType: (col.dataType as CustomReportColumn['dataType']) ?? 'STRING',
      width: col.width,
      sortable: col.sortable,
      filterable: col.filterable,
      aggregation: col.aggregation as CustomReportColumn['aggregation'],
      format: col.format,
      visible: col.visible ?? true,
      order: col.order ?? i,
    })),
    filters: request.definition.filters?.map((f, i) => ({
      filterId: f.filterId ?? `filter-${i}`,
      fieldName: f.fieldName,
      operator: f.operator as CustomReportFilter['operator'],
      value: f.value,
      logicalOperator: f.logicalOperator as 'AND' | 'OR' | undefined,
    })),
    groupings: request.definition.groupings?.map((g, i) => ({
      groupId: g.groupId ?? `group-${i}`,
      fieldName: g.fieldName,
      displayName: g.displayName ?? g.fieldName,
      order: g.order,
      sortDirection: g.sortDirection as 'ASC' | 'DESC' | undefined,
      showSubtotals: g.showSubtotals,
    })),
    sorting: request.definition.sorting?.map(s => ({
      fieldName: s.fieldName,
      direction: s.direction as 'ASC' | 'DESC',
      order: s.order,
    })),
    includeSubtotals: request.definition.includeSubtotals,
    includeGrandTotal: request.definition.includeGrandTotal,
    rowLimit: request.definition.rowLimit,
  };

  return {
    valid: true,
    data: {
      definition: validatedDefinition,
      format: request.format as ExportFormat,
      title: request.title,
      description: request.description,
      templateId: request.templateId,
      includeCharts: request.includeCharts,
    },
  };
}

/**
 * Lambda handler for generating custom reports
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.requestContext.authorizer?.['claims']?.['sub'] as string | undefined;

  logger.info('Generate custom report request received', { requestId });

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

    // Generate the custom report
    const result = await customReportService.generateCustomReport(validation.data, userId);

    logger.info('Custom report generated', {
      requestId,
      reportId: result.reportId,
      dataSource: validation.data.definition.dataSource,
      format: validation.data.format,
      status: result.status,
    });

    // Return appropriate response based on status
    if (result.status === 'FAILED') {
      return createLambdaResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        createErrorResponse(
          API_ERROR_CODES.INTERNAL_ERROR,
          result.errorMessage ?? 'Failed to generate custom report',
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
    logger.error('Failed to generate custom report', err, { requestId });

    if (err.message.includes('is required') || err.message.includes('must be') || err.message.includes('Invalid')) {
      return createLambdaResponse(
        HTTP_STATUS.BAD_REQUEST,
        createErrorResponse(API_ERROR_CODES.BAD_REQUEST, err.message, requestId)
      );
    }

    return createLambdaResponse(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      createErrorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Failed to generate custom report', requestId)
    );
  }
}
