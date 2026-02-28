/**
 * Generate Financial Report Handler
 *
 * Lambda handler for generating financial reports including
 * depreciation schedules, asset valuations, and budget utilization.
 *
 * Requirements:
 * - 16.6: Analytics Dashboard with asset cost trends, depreciation summaries, and budget utilization
 * - 16.8: Financial Report Service for depreciation schedules and asset valuation reports
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as financialReportService from '../financial/financial-report-service';
import type {
  FinancialReportResult,
  GenerateAssetValuationRequest,
  GenerateBudgetUtilizationRequest,
  GenerateDepreciationScheduleRequest,
  GenerateProcurementSpendingRequest,
  GenerateVendorSpendingAnalysisRequest,
} from '../report/report-types';

const logger = createLogger({ service: 'generate-financial-report-handler' });

/**
 * Financial report type
 */
export type FinancialReportType = 
  | 'DEPRECIATION_SCHEDULE' 
  | 'ASSET_VALUATION' 
  | 'BUDGET_UTILIZATION'
  | 'PROCUREMENT_SPENDING'
  | 'VENDOR_SPENDING_ANALYSIS';

/**
 * Handler request for financial reports
 */
export interface GenerateFinancialReportHandlerRequest {
  readonly reportType: FinancialReportType;
  readonly request: 
    | GenerateDepreciationScheduleRequest 
    | GenerateAssetValuationRequest 
    | GenerateBudgetUtilizationRequest
    | GenerateProcurementSpendingRequest
    | GenerateVendorSpendingAnalysisRequest;
  readonly userId: UUID;
}

/**
 * Handler response
 */
export interface GenerateFinancialReportHandlerResponse {
  readonly statusCode: number;
  readonly body: string;
  readonly headers: Record<string, string>;
}

/**
 * Lambda handler for generating financial reports
 *
 * @param event - The Lambda event containing the report request
 * @returns The handler response with the generated report
 */
export async function handler(
  event: GenerateFinancialReportHandlerRequest
): Promise<GenerateFinancialReportHandlerResponse> {
  logger.info('Received financial report generation request', {
    reportType: event.reportType,
    userId: event.userId,
  });

  try {
    // Validate request
    if (!event.reportType) {
      return createErrorResponse(400, 'Report type is required');
    }

    if (!event.request) {
      return createErrorResponse(400, 'Report request is required');
    }

    if (!event.userId) {
      return createErrorResponse(400, 'User ID is required');
    }

    // Generate report based on type
    let result: FinancialReportResult;

    switch (event.reportType) {
      case 'DEPRECIATION_SCHEDULE':
        result = await financialReportService.generateDepreciationScheduleReport(
          event.request as GenerateDepreciationScheduleRequest,
          event.userId
        );
        break;

      case 'ASSET_VALUATION':
        result = await financialReportService.generateAssetValuationReport(
          event.request as GenerateAssetValuationRequest,
          event.userId
        );
        break;

      case 'BUDGET_UTILIZATION':
        result = await financialReportService.generateBudgetUtilizationReport(
          event.request as GenerateBudgetUtilizationRequest,
          event.userId
        );
        break;

      case 'PROCUREMENT_SPENDING':
        result = await financialReportService.generateProcurementSpendingReport(
          event.request as GenerateProcurementSpendingRequest,
          event.userId
        );
        break;

      case 'VENDOR_SPENDING_ANALYSIS':
        result = await financialReportService.generateVendorSpendingAnalysisReport(
          event.request as GenerateVendorSpendingAnalysisRequest,
          event.userId
        );
        break;

      default:
        return createErrorResponse(
          400,
          `Invalid financial report type: ${event.reportType}. Valid types are: DEPRECIATION_SCHEDULE, ASSET_VALUATION, BUDGET_UTILIZATION, PROCUREMENT_SPENDING, VENDOR_SPENDING_ANALYSIS`
        );
    }

    // Check if report generation failed
    if (result.status === 'FAILED') {
      logger.error('Financial report generation failed', new Error(result.errorMessage), {
        reportId: result.reportId,
        reportType: event.reportType,
      });

      return createErrorResponse(500, result.errorMessage ?? 'Report generation failed');
    }

    logger.info('Financial report generated successfully', {
      reportId: result.reportId,
      reportType: event.reportType,
      totalRecords: result.metadata.totalRecords,
    });

    return createSuccessResponse(result);
  } catch (error) {
    const err = error as Error;
    logger.error('Unexpected error generating financial report', err, {
      reportType: event.reportType,
    });

    // Check for validation errors
    if (err.message.includes('required') || err.message.includes('Invalid')) {
      return createErrorResponse(400, err.message);
    }

    return createErrorResponse(500, 'Internal server error');
  }
}

/**
 * Create a success response
 */
function createSuccessResponse(result: FinancialReportResult): GenerateFinancialReportHandlerResponse {
  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      data: {
        reportId: result.reportId,
        status: result.status,
        metadata: result.metadata,
        downloadUrl: result.downloadUrl,
        content: result.content,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Report-Id': result.reportId,
    },
  };
}

/**
 * Create an error response
 */
function createErrorResponse(
  statusCode: number,
  message: string
): GenerateFinancialReportHandlerResponse {
  return {
    statusCode,
    body: JSON.stringify({
      success: false,
      error: {
        code: getErrorCode(statusCode),
        message,
      },
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Get error code from status code
 */
function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 500:
      return 'INTERNAL_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}

/**
 * API Gateway event adapter
 * Converts API Gateway event to handler request
 */
export function parseApiGatewayEvent(event: {
  body?: string;
  pathParameters?: Record<string, string>;
  requestContext?: { authorizer?: { claims?: { sub?: string } } };
}): GenerateFinancialReportHandlerRequest {
  const body = event.body ? JSON.parse(event.body) : {};
  const reportType = event.pathParameters?.['reportType'] as FinancialReportType;
  const userId = event.requestContext?.authorizer?.claims?.sub ?? '';

  return {
    reportType,
    request: body,
    userId,
  };
}

/**
 * Lambda handler wrapper for API Gateway
 */
export async function apiGatewayHandler(event: {
  body?: string;
  pathParameters?: Record<string, string>;
  requestContext?: { authorizer?: { claims?: { sub?: string } } };
}): Promise<GenerateFinancialReportHandlerResponse> {
  try {
    const request = parseApiGatewayEvent(event);
    return handler(request);
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to parse API Gateway event', err);
    return createErrorResponse(400, 'Invalid request format');
  }
}
