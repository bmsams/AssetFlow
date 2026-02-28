/**
 * Custom Report Service - Custom report generation logic
 *
 * Implements custom report generation with configurable columns, filters, and groupings.
 *
 * Requirements:
 * - 16.2: Support custom report creation with configurable columns, filters, and groupings
 * - 16.9: Log report access for audit purposes
 */

import type { UUID } from '@ams/types';
import { createLogger } from '@ams/utils';

import * as reportRepository from '../report/report-repository';
import * as customReportRepository from './custom-report-repository';
import type {
  AvailableField,
  AvailableFieldsResult,
  CustomReport,
  CustomReportColumn,
  CustomReportDataSource,
  CustomReportDefinition,
  CustomReportFilter,
  CustomReportGroup,
  CustomReportGrouping,
  CustomReportMetadata,
  CustomReportRow,
  ExportFormat,
  FilterOperator,
  GenerateCustomReportRequest,
  GenerateReportResult,
} from '../report/report-types';

const logger = createLogger({ service: 'custom-report-service' });

// ============================================================================
// Custom Report Generation
// ============================================================================

/**
 * Generate a custom report based on the definition
 *
 * Requirement 16.2: Support custom report creation with configurable columns, filters, and groupings
 * Requirement 16.9: Log report access for audit purposes
 */
export async function generateCustomReport(
  request: GenerateCustomReportRequest,
  userId: UUID
): Promise<GenerateReportResult> {
  logger.info('Generating custom report', {
    dataSource: request.definition.dataSource,
    columnCount: request.definition.columns.length,
    filterCount: request.definition.filters?.length ?? 0,
    groupingCount: request.definition.groupings?.length ?? 0,
    format: request.format,
    userId,
  });

  // Validate the definition
  validateCustomReportDefinition(request.definition);

  const reportId = generateUUID();
  const now = new Date().toISOString();

  try {
    // Fetch data based on definition
    const rawData = await customReportRepository.fetchCustomReportData(request.definition);

    // Apply groupings if specified
    let rows: CustomReportRow[] = rawData;
    let groupedData: CustomReportGroup[] | undefined;
    let totals: Record<string, number> | undefined;

    if (request.definition.groupings && request.definition.groupings.length > 0) {
      groupedData = applyGroupings(rawData, request.definition.groupings, request.definition.columns);
    }

    // Calculate totals if requested
    if (request.definition.includeGrandTotal) {
      totals = calculateTotals(rawData, request.definition.columns);
    }

    // Create metadata
    const metadata: CustomReportMetadata = {
      reportId,
      reportType: 'CUSTOM',
      title: request.title ?? 'Custom Report',
      description: request.description,
      generatedAt: now,
      generatedBy: userId,
      format: request.format,
      filters: {},
      totalRecords: rawData.length,
    };

    // Create report data
    const reportData: CustomReport = {
      metadata,
      definition: request.definition,
      rows,
      groupedData,
      totals,
    };

    // Export to requested format
    const content = await exportCustomReport(reportData, request.format);

    // Log report access
    await reportRepository.logReportAccess({
      reportId,
      reportType: 'ASSET_INVENTORY', // Using existing type for audit
      accessedBy: userId,
      accessedAt: now,
      action: 'GENERATED',
      format: request.format,
      filters: { customFilters: { dataSource: request.definition.dataSource } },
    });

    logger.info('Custom report generated successfully', {
      reportId,
      dataSource: request.definition.dataSource,
      rowCount: rawData.length,
      format: request.format,
    });

    return {
      reportId,
      status: 'COMPLETED',
      metadata,
      content,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Failed to generate custom report', err, {
      reportId,
      dataSource: request.definition.dataSource,
    });

    return {
      reportId,
      status: 'FAILED',
      metadata: {
        reportId,
        reportType: 'CUSTOM' as any,
        title: request.title ?? 'Custom Report',
        generatedAt: now,
        generatedBy: userId,
        format: request.format,
        filters: {},
        totalRecords: 0,
      },
      errorMessage: err.message,
    };
  }
}

// ============================================================================
// Available Fields
// ============================================================================

/**
 * Get available fields for a data source
 */
export function getAvailableFields(dataSource: CustomReportDataSource): AvailableFieldsResult {
  const fields = AVAILABLE_FIELDS[dataSource] ?? [];
  return { dataSource, fields };
}

/**
 * Available fields by data source
 */
const AVAILABLE_FIELDS: Record<CustomReportDataSource, AvailableField[]> = {
  ASSETS: [
    { fieldName: 'asset_id', displayName: 'Asset ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_type', displayName: 'Asset Type', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'display_name', displayName: 'Display Name', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'status', displayName: 'Status', dataType: 'STRING', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'created_at', displayName: 'Created Date', dataType: 'DATE', category: 'Audit', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'updated_at', displayName: 'Updated Date', dataType: 'DATE', category: 'Audit', filterable: true, sortable: true, aggregatable: false },
  ],
  HARDWARE_ASSETS: [
    { fieldName: 'asset_id', displayName: 'Asset ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'serial_number', displayName: 'Serial Number', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'manufacturer', displayName: 'Manufacturer', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'model', displayName: 'Model', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'status', displayName: 'Status', dataType: 'STRING', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'assigned_to', displayName: 'Assigned To', dataType: 'STRING', category: 'Ownership', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'department', displayName: 'Department', dataType: 'STRING', category: 'Ownership', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'location', displayName: 'Location', dataType: 'STRING', category: 'Location', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'purchase_price', displayName: 'Purchase Price', dataType: 'CURRENCY', category: 'Financial', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'current_value', displayName: 'Current Value', dataType: 'CURRENCY', category: 'Financial', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'purchase_date', displayName: 'Purchase Date', dataType: 'DATE', category: 'Procurement', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'warranty_expiration', displayName: 'Warranty Expiration', dataType: 'DATE', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
  ],
  SOFTWARE_ASSETS: [
    { fieldName: 'product_id', displayName: 'Product ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'publisher', displayName: 'Publisher', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'product_name', displayName: 'Product Name', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'version', displayName: 'Version', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'license_type', displayName: 'License Type', dataType: 'STRING', category: 'Licensing', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'quantity_purchased', displayName: 'Quantity Purchased', dataType: 'NUMBER', category: 'Licensing', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'quantity_available', displayName: 'Quantity Available', dataType: 'NUMBER', category: 'Licensing', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'unit_cost', displayName: 'Unit Cost', dataType: 'CURRENCY', category: 'Financial', filterable: true, sortable: true, aggregatable: true },
  ],
  ENTERPRISE_ASSETS: [
    { fieldName: 'asset_id', displayName: 'Asset ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'serial_number', displayName: 'Serial Number', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'manufacturer', displayName: 'Manufacturer', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'model', displayName: 'Model', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_class', displayName: 'Asset Class', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'criticality_level', displayName: 'Criticality Level', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'facility', displayName: 'Facility', dataType: 'STRING', category: 'Location', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'operating_hours', displayName: 'Operating Hours', dataType: 'NUMBER', category: 'Operations', filterable: true, sortable: true, aggregatable: true },
  ],
  CONTRACTS: [
    { fieldName: 'contract_id', displayName: 'Contract ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'contract_number', displayName: 'Contract Number', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'vendor_name', displayName: 'Vendor Name', dataType: 'STRING', category: 'Vendor', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'contract_type', displayName: 'Contract Type', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'start_date', displayName: 'Start Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'end_date', displayName: 'End Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'total_value', displayName: 'Total Value', dataType: 'CURRENCY', category: 'Financial', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'status', displayName: 'Status', dataType: 'STRING', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
  ],
  PURCHASE_ORDERS: [
    { fieldName: 'po_id', displayName: 'PO ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'po_number', displayName: 'PO Number', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'vendor_name', displayName: 'Vendor Name', dataType: 'STRING', category: 'Vendor', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'status', displayName: 'Status', dataType: 'STRING', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'order_date', displayName: 'Order Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'total_amount', displayName: 'Total Amount', dataType: 'CURRENCY', category: 'Financial', filterable: true, sortable: true, aggregatable: true },
  ],
  WORK_ORDERS: [
    { fieldName: 'work_order_id', displayName: 'Work Order ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING', category: 'Asset', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'work_type', displayName: 'Work Type', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'priority', displayName: 'Priority', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'status', displayName: 'Status', dataType: 'STRING', category: 'Lifecycle', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'scheduled_date', displayName: 'Scheduled Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'completed_date', displayName: 'Completed Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
  ],
  STOCKROOMS: [
    { fieldName: 'stockroom_id', displayName: 'Stockroom ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'name', displayName: 'Name', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'location', displayName: 'Location', dataType: 'STRING', category: 'Location', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'stockroom_type', displayName: 'Type', dataType: 'STRING', category: 'Classification', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'is_active', displayName: 'Is Active', dataType: 'BOOLEAN', category: 'Status', filterable: true, sortable: true, aggregatable: false },
  ],
  ENTITLEMENTS: [
    { fieldName: 'entitlement_id', displayName: 'Entitlement ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'product_name', displayName: 'Product Name', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'license_type', displayName: 'License Type', dataType: 'STRING', category: 'Licensing', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'quantity_purchased', displayName: 'Quantity Purchased', dataType: 'NUMBER', category: 'Licensing', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'quantity_available', displayName: 'Quantity Available', dataType: 'NUMBER', category: 'Licensing', filterable: true, sortable: true, aggregatable: true },
    { fieldName: 'start_date', displayName: 'Start Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'end_date', displayName: 'End Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
  ],
  INSTALLATIONS: [
    { fieldName: 'installation_id', displayName: 'Installation ID', dataType: 'STRING', category: 'Identity', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'product_name', displayName: 'Product Name', dataType: 'STRING', category: 'Product', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'asset_tag', displayName: 'Asset Tag', dataType: 'STRING', category: 'Asset', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'installed_date', displayName: 'Installed Date', dataType: 'DATE', category: 'Dates', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'last_used_date', displayName: 'Last Used Date', dataType: 'DATE', category: 'Usage', filterable: true, sortable: true, aggregatable: false },
    { fieldName: 'usage_minutes_30day', displayName: 'Usage (30 Day)', dataType: 'NUMBER', category: 'Usage', filterable: true, sortable: true, aggregatable: true },
  ],
};


// ============================================================================
// Validation
// ============================================================================

/**
 * Validate custom report definition
 */
function validateCustomReportDefinition(definition: CustomReportDefinition): void {
  // Validate data source
  const validDataSources: CustomReportDataSource[] = [
    'ASSETS', 'HARDWARE_ASSETS', 'SOFTWARE_ASSETS', 'ENTERPRISE_ASSETS',
    'CONTRACTS', 'PURCHASE_ORDERS', 'WORK_ORDERS', 'STOCKROOMS',
    'ENTITLEMENTS', 'INSTALLATIONS',
  ];

  if (!definition.dataSource) {
    throw new Error('Data source is required');
  }

  if (!validDataSources.includes(definition.dataSource)) {
    throw new Error(`Invalid data source: ${definition.dataSource}. Valid sources are: ${validDataSources.join(', ')}`);
  }

  // Validate columns
  if (!definition.columns || definition.columns.length === 0) {
    throw new Error('At least one column is required');
  }

  const availableFields = AVAILABLE_FIELDS[definition.dataSource] ?? [];
  const availableFieldNames = new Set(availableFields.map(f => f.fieldName));

  for (const column of definition.columns) {
    if (!column.fieldName) {
      throw new Error('Column fieldName is required');
    }
    if (!column.displayName) {
      throw new Error('Column displayName is required');
    }
    if (!availableFieldNames.has(column.fieldName)) {
      throw new Error(`Invalid column fieldName: ${column.fieldName} for data source ${definition.dataSource}`);
    }
  }

  // Validate filters
  if (definition.filters) {
    for (const filter of definition.filters) {
      validateFilter(filter, availableFieldNames);
    }
  }

  // Validate groupings
  if (definition.groupings) {
    for (const grouping of definition.groupings) {
      if (!grouping.fieldName) {
        throw new Error('Grouping fieldName is required');
      }
      if (!availableFieldNames.has(grouping.fieldName)) {
        throw new Error(`Invalid grouping fieldName: ${grouping.fieldName}`);
      }
    }
  }

  // Validate row limit
  if (definition.rowLimit !== undefined) {
    if (definition.rowLimit < 1 || definition.rowLimit > 100000) {
      throw new Error('Row limit must be between 1 and 100000');
    }
  }
}

/**
 * Validate a single filter
 */
function validateFilter(filter: CustomReportFilter, availableFieldNames: Set<string>): void {
  if (!filter.fieldName) {
    throw new Error('Filter fieldName is required');
  }

  if (!availableFieldNames.has(filter.fieldName)) {
    throw new Error(`Invalid filter fieldName: ${filter.fieldName}`);
  }

  const validOperators: FilterOperator[] = [
    'EQUALS', 'NOT_EQUALS', 'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH', 'ENDS_WITH',
    'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL',
    'BETWEEN', 'IN', 'NOT_IN', 'IS_NULL', 'IS_NOT_NULL',
  ];

  if (!filter.operator || !validOperators.includes(filter.operator)) {
    throw new Error(`Invalid filter operator: ${filter.operator}. Valid operators are: ${validOperators.join(', ')}`);
  }

  // Validate value based on operator
  if (!['IS_NULL', 'IS_NOT_NULL'].includes(filter.operator) && filter.value === undefined) {
    throw new Error(`Filter value is required for operator ${filter.operator}`);
  }

  if (filter.operator === 'BETWEEN') {
    if (!Array.isArray(filter.value) || filter.value.length !== 2) {
      throw new Error('BETWEEN operator requires an array of two values');
    }
  }

  if (['IN', 'NOT_IN'].includes(filter.operator)) {
    if (!Array.isArray(filter.value)) {
      throw new Error(`${filter.operator} operator requires an array of values`);
    }
  }
}

// ============================================================================
// Grouping and Aggregation
// ============================================================================

/**
 * Apply groupings to report data
 */
function applyGroupings(
  rows: CustomReportRow[],
  groupings: readonly CustomReportGrouping[],
  columns: readonly CustomReportColumn[]
): CustomReportGroup[] {
  if (groupings.length === 0) {
    return [];
  }

  const sortedGroupings = [...groupings].sort((a, b) => a.order - b.order);
  return groupByField(rows, sortedGroupings, 0, columns);
}

/**
 * Recursively group data by field
 */
function groupByField(
  rows: CustomReportRow[],
  groupings: CustomReportGrouping[],
  level: number,
  columns: readonly CustomReportColumn[]
): CustomReportGroup[] {
  if (level >= groupings.length) {
    return [];
  }

  const grouping = groupings[level]!;
  const groups = new Map<string, CustomReportRow[]>();

  // Group rows by field value
  for (const row of rows) {
    const value = row[grouping.fieldName];
    const key = String(value ?? 'null');
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(row);
  }

  // Convert to array and sort
  const result: CustomReportGroup[] = [];
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (grouping.sortDirection === 'DESC') {
      return b.localeCompare(a);
    }
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const groupRows = groups.get(key)!;
    const group: CustomReportGroup = {
      groupKey: grouping.fieldName,
      groupValue: key === 'null' ? null : key,
      rows: groupRows,
      subtotals: grouping.showSubtotals ? calculateTotals(groupRows, columns) : undefined,
      subgroups: level + 1 < groupings.length 
        ? groupByField(groupRows, groupings, level + 1, columns) 
        : undefined,
    };
    result.push(group);
  }

  return result;
}

/**
 * Calculate totals for aggregatable columns
 */
function calculateTotals(
  rows: CustomReportRow[],
  columns: readonly CustomReportColumn[]
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const column of columns) {
    if (column.aggregation && column.aggregation !== 'NONE') {
      const values = rows
        .map(row => row[column.fieldName])
        .filter((v): v is number => typeof v === 'number');

      if (values.length > 0) {
        switch (column.aggregation) {
          case 'SUM':
            totals[column.fieldName] = values.reduce((a, b) => a + b, 0);
            break;
          case 'AVG':
            totals[column.fieldName] = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case 'COUNT':
            totals[column.fieldName] = values.length;
            break;
          case 'MIN':
            totals[column.fieldName] = Math.min(...values);
            break;
          case 'MAX':
            totals[column.fieldName] = Math.max(...values);
            break;
        }
      }
    }
  }

  return totals;
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export custom report to specified format
 */
async function exportCustomReport(
  reportData: CustomReport,
  format: ExportFormat
): Promise<string> {
  switch (format) {
    case 'CSV':
      return exportCustomToCSV(reportData);
    case 'EXCEL':
      return exportCustomToExcel(reportData);
    case 'PDF':
      return exportCustomToPDF(reportData);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export custom report to CSV
 */
function exportCustomToCSV(reportData: CustomReport): string {
  const { columns } = reportData.definition;
  const visibleColumns = columns.filter(c => c.visible !== false);
  
  if (visibleColumns.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const firstColumn = visibleColumns[0]!;

  // Add headers
  const headers = visibleColumns.map(c => escapeCSVField(c.displayName));
  lines.push(headers.join(','));

  // Add data rows
  for (const row of reportData.rows) {
    const values = visibleColumns.map(col => {
      const value = row[col.fieldName];
      if (value === null || value === undefined) {
        return '';
      }
      return escapeCSVField(String(value));
    });
    lines.push(values.join(','));
  }

  // Add totals if present
  if (reportData.totals && Object.keys(reportData.totals).length > 0) {
    lines.push(''); // Empty line before totals
    const totalValues = visibleColumns.map(col => {
      if (reportData.totals && col.fieldName in reportData.totals) {
        return String(reportData.totals[col.fieldName]);
      }
      return col.fieldName === firstColumn.fieldName ? 'TOTAL' : '';
    });
    lines.push(totalValues.join(','));
  }

  return lines.join('\n');
}

/**
 * Export custom report to Excel (placeholder)
 */
function exportCustomToExcel(reportData: CustomReport): string {
  const excelData = {
    title: reportData.metadata.title,
    columns: reportData.definition.columns,
    rows: reportData.rows,
    groupedData: reportData.groupedData,
    totals: reportData.totals,
  };
  return Buffer.from(JSON.stringify(excelData)).toString('base64');
}

/**
 * Export custom report to PDF (placeholder)
 */
function exportCustomToPDF(reportData: CustomReport): string {
  const pdfData = {
    title: reportData.metadata.title,
    generatedAt: reportData.metadata.generatedAt,
    columns: reportData.definition.columns,
    rows: reportData.rows,
    groupedData: reportData.groupedData,
    totals: reportData.totals,
  };
  return Buffer.from(JSON.stringify(pdfData)).toString('base64');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Escape a field for CSV output
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('\n') || field.includes('"')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generate a UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
