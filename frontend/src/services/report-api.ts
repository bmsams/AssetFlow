/**
 * Report API Service
 *
 * Provides methods for interacting with the Report Service API.
 * Handles fetching reports and exporting them in various formats.
 *
 * Implements Task 18: Frontend - Reports Pages
 */

import { apiClient, ApiError, getAccessToken } from './api-client';
import type {
  ReportFilters,
  ReportFormat,
  AssetSummaryReport,
  AssetAgingReport,
  AssetByLocationReport,
  AssetByDepartmentReport,
  CostCenterUtilizationReport,
  ProcurementSpendingReport,
  WorkOrderSummaryReport,
  MaintenanceComplianceReport,
} from '../types/report';

function getApiBaseUrl(): string {
  const env = import.meta.env as Record<string, unknown>;
  const configuredUrl = env['VITE_API_URL'];
  const baseUrl =
    typeof configuredUrl === 'string' && configuredUrl.length > 0
      ? configuredUrl
      : 'http://localhost:3001/v1';
  return baseUrl.replace(/\/$/, '');
}

/**
 * Build query string from filters
 */
function buildQueryString(filters?: ReportFilters): string {
  if (!filters) return '';

  const params = new URLSearchParams();

  if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.append('dateTo', filters.dateTo);
  if (filters.assetType) params.append('assetType', filters.assetType);
  if (filters.status) params.append('status', filters.status);
  if (filters.locationId) params.append('locationId', filters.locationId);
  if (filters.departmentId) params.append('departmentId', filters.departmentId);
  if (filters.vendorId) params.append('vendorId', filters.vendorId);
  if (filters.costCenterId) params.append('costCenterId', filters.costCenterId);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================================================
// Asset Inventory Reports
// ============================================================================

/**
 * Get asset summary report
 */
export async function getAssetSummaryReport(filters?: ReportFilters): Promise<AssetSummaryReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<AssetSummaryReport>(`/reports/asset-summary${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate asset summary report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get asset aging report
 */
export async function getAssetAgingReport(filters?: ReportFilters): Promise<AssetAgingReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<AssetAgingReport>(`/reports/asset-aging${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate asset aging report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get assets by location report
 */
export async function getAssetsByLocationReport(filters?: ReportFilters): Promise<AssetByLocationReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<AssetByLocationReport>(`/reports/assets-by-location${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate assets by location report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get assets by department report
 */
export async function getAssetsByDepartmentReport(filters?: ReportFilters): Promise<AssetByDepartmentReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<AssetByDepartmentReport>(`/reports/assets-by-department${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate assets by department report',
      400,
      response.requestId
    );
  }

  return response.data;
}

// ============================================================================
// Financial Reports
// ============================================================================

/**
 * Get cost center utilization report
 */
export async function getCostCenterUtilizationReport(
  fiscalYear?: number,
  filters?: ReportFilters
): Promise<CostCenterUtilizationReport> {
  const params = new URLSearchParams();
  if (fiscalYear) params.append('fiscalYear', fiscalYear.toString());

  // Add other filters
  if (filters?.departmentId) params.append('departmentId', filters.departmentId);
  if (filters?.costCenterId) params.append('costCenterId', filters.costCenterId);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const response = await apiClient.get<CostCenterUtilizationReport>(`/reports/cost-center-utilization${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate cost center utilization report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get procurement spending report
 */
export async function getProcurementSpendingReport(filters?: ReportFilters): Promise<ProcurementSpendingReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<ProcurementSpendingReport>(`/reports/procurement-spending${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate procurement spending report',
      400,
      response.requestId
    );
  }

  return response.data;
}

// ============================================================================
// Operational Reports
// ============================================================================

/**
 * Get work order summary report
 */
export async function getWorkOrderSummaryReport(filters?: ReportFilters): Promise<WorkOrderSummaryReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<WorkOrderSummaryReport>(`/reports/work-order-summary${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate work order summary report',
      400,
      response.requestId
    );
  }

  return response.data;
}

/**
 * Get maintenance compliance report
 */
export async function getMaintenanceComplianceReport(filters?: ReportFilters): Promise<MaintenanceComplianceReport> {
  const queryString = buildQueryString(filters);
  const response = await apiClient.get<MaintenanceComplianceReport>(`/reports/maintenance-compliance${queryString}`);

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'REPORT_FAILED',
      response.error?.message || 'Failed to generate maintenance compliance report',
      400,
      response.requestId
    );
  }

  return response.data;
}

// ============================================================================
// Report Export
// ============================================================================

/**
 * Export report in specified format
 */
export async function exportReport(
  reportType: string,
  format: ReportFormat,
  filters?: ReportFilters
): Promise<Blob> {
  const params = new URLSearchParams();
  params.append('format', format);

  // Add filters
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  if (filters?.assetType) params.append('assetType', filters.assetType);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.locationId) params.append('locationId', filters.locationId);
  if (filters?.departmentId) params.append('departmentId', filters.departmentId);
  if (filters?.vendorId) params.append('vendorId', filters.vendorId);
  if (filters?.costCenterId) params.append('costCenterId', filters.costCenterId);

  const queryString = params.toString();
  const url = `/reports/${reportType}/export?${queryString}`;

  // For file downloads, we need to handle the response differently
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  const response = await fetch(`${baseUrl}${url}`, {
    method: 'GET',
    headers: {
      'Accept': getContentType(format),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(
      'EXPORT_FAILED',
      `Failed to export report: ${response.statusText}`,
      response.status
    );
  }

  return response.blob();
}

/**
 * Get content type for format
 */
function getContentType(format: ReportFormat): string {
  switch (format) {
    case 'CSV':
      return 'text/csv';
    case 'EXCEL':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'PDF':
      return 'application/pdf';
    case 'JSON':
    default:
      return 'application/json';
  }
}

/**
 * Get file extension for format
 */
export function getFileExtension(format: ReportFormat): string {
  switch (format) {
    case 'CSV':
      return 'csv';
    case 'EXCEL':
      return 'xlsx';
    case 'PDF':
      return 'pdf';
    case 'JSON':
    default:
      return 'json';
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ============================================================================
// Namespace Export
// ============================================================================

export const reportApi = {
  assetSummary: getAssetSummaryReport,
  assetAging: getAssetAgingReport,
  assetsByLocation: getAssetsByLocationReport,
  assetsByDepartment: getAssetsByDepartmentReport,
  costCenterUtilization: getCostCenterUtilizationReport,
  procurementSpending: getProcurementSpendingReport,
  workOrderSummary: getWorkOrderSummaryReport,
  maintenanceCompliance: getMaintenanceComplianceReport,
  export: exportReport,
  downloadBlob,
  getFileExtension,
};
