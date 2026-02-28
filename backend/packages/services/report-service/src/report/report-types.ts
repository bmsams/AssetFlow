/**
 * Report Service Types
 *
 * Type definitions for report generation with multiple export formats.
 *
 * Requirements:
 * - 16.1: Generate standard reports: Asset Inventory, Compliance Summary, Cost Analysis, Lifecycle Status
 * - 16.3: Export reports in PDF, Excel, and CSV formats
 * - 16.9: Log report access for audit purposes
 */

import type { ISODateString, UUID } from '@ams/types';

/**
 * Standard report types
 * Requirement 16.1: Generate standard reports
 * Requirement 16.6: Analytics Dashboard with asset cost trends, depreciation summaries, and budget utilization
 * Requirement 16.8: Financial Report Service for depreciation schedules and asset valuation reports
 */
export type ReportType =
  | 'ASSET_INVENTORY'
  | 'COMPLIANCE_SUMMARY'
  | 'COST_ANALYSIS'
  | 'LIFECYCLE_STATUS'
  | 'DEPRECIATION_SCHEDULE'
  | 'ASSET_VALUATION'
  | 'BUDGET_UTILIZATION'
  | 'CUSTOM';

/**
 * Export format types
 * Requirement 16.3: Export reports in PDF, Excel, and CSV formats
 */
export type ExportFormat = 'PDF' | 'EXCEL' | 'CSV';

/**
 * Report status
 */
export type ReportStatus =
  | 'PENDING'
  | 'GENERATING'
  | 'COMPLETED'
  | 'FAILED';

/**
 * Asset type filter for reports
 */
export type AssetTypeFilter = 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE' | 'ALL';

/**
 * Asset status filter for reports
 */
export type AssetStatusFilter =
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'DEPLOYED'
  | 'IN_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED'
  | 'ALL';

// ============================================================================
// Report Definition Types
// ============================================================================

/**
 * Report metadata included in all reports
 */
export interface ReportMetadata {
  readonly reportId: UUID;
  readonly reportType: ReportType;
  readonly title: string;
  readonly description?: string;
  readonly generatedAt: ISODateString;
  readonly generatedBy: UUID;
  readonly format: ExportFormat;
  readonly filters: ReportFilters;
  readonly totalRecords: number;
  readonly pageCount?: number;
}

/**
 * Report filters applied during generation
 */
export interface ReportFilters {
  readonly assetType?: AssetTypeFilter;
  readonly assetStatus?: AssetStatusFilter;
  readonly departmentId?: UUID;
  readonly costCenterId?: UUID;
  readonly stockroomId?: UUID;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
  readonly customFilters?: Record<string, unknown>;
}

/**
 * Report generation request
 */
export interface GenerateReportRequest {
  readonly reportType: ReportType;
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: ReportFilters;
  readonly includeCharts?: boolean;
  readonly pageSize?: number;
}

/**
 * Report generation result
 */
export interface GenerateReportResult {
  readonly reportId: UUID;
  readonly status: ReportStatus;
  readonly metadata: ReportMetadata;
  readonly downloadUrl?: string;
  readonly content?: string; // Base64 encoded for binary formats
  readonly errorMessage?: string;
}

// ============================================================================
// Asset Inventory Report Types
// ============================================================================

/**
 * Asset inventory report row
 */
export interface AssetInventoryRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetType: string;
  readonly displayName: string;
  readonly status: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serialNumber?: string;
  readonly assignedTo?: string;
  readonly department?: string;
  readonly location?: string;
  readonly purchaseDate?: ISODateString;
  readonly purchasePrice?: number;
  readonly currentValue?: number;
}

/**
 * Asset inventory report data
 */
export interface AssetInventoryReport {
  readonly metadata: ReportMetadata;
  readonly summary: {
    readonly totalAssets: number;
    readonly totalValue: number;
    readonly byType: Record<string, number>;
    readonly byStatus: Record<string, number>;
    readonly byDepartment: Record<string, number>;
  };
  readonly rows: readonly AssetInventoryRow[];
}

// ============================================================================
// Compliance Summary Report Types
// ============================================================================

/**
 * Compliance position for a software product
 */
export interface CompliancePositionRow {
  readonly productId: UUID;
  readonly publisher: string;
  readonly productName: string;
  readonly version?: string;
  readonly licenseType: string;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';
  readonly variance: number;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly estimatedCost?: number;
  readonly lastReconciled?: ISODateString;
}

/**
 * Compliance summary report data
 */
export interface ComplianceSummaryReport {
  readonly metadata: ReportMetadata;
  readonly summary: {
    readonly totalProducts: number;
    readonly compliantCount: number;
    readonly overLicensedCount: number;
    readonly underLicensedCount: number;
    readonly totalEntitlements: number;
    readonly totalInstallations: number;
    readonly complianceRate: number;
    readonly estimatedRisk: number;
  };
  readonly rows: readonly CompliancePositionRow[];
}

// ============================================================================
// Cost Analysis Report Types
// ============================================================================

/**
 * Cost analysis row by category
 */
export interface CostAnalysisRow {
  readonly category: string;
  readonly categoryType: 'ASSET_TYPE' | 'DEPARTMENT' | 'COST_CENTER' | 'VENDOR';
  readonly assetCount: number;
  readonly totalPurchaseCost: number;
  readonly totalCurrentValue: number;
  readonly totalDepreciation: number;
  readonly monthlyMaintenanceCost: number;
  readonly annualLicenseCost: number;
  readonly totalCostOfOwnership: number;
}

/**
 * Cost trend data point
 */
export interface CostTrendPoint {
  readonly period: string;
  readonly purchaseCost: number;
  readonly maintenanceCost: number;
  readonly licenseCost: number;
  readonly totalCost: number;
}

/**
 * Cost analysis report data
 */
export interface CostAnalysisReport {
  readonly metadata: ReportMetadata;
  readonly summary: {
    readonly totalAssetValue: number;
    readonly totalDepreciation: number;
    readonly totalMaintenanceCost: number;
    readonly totalLicenseCost: number;
    readonly totalCostOfOwnership: number;
    readonly averageCostPerAsset: number;
  };
  readonly byCategory: readonly CostAnalysisRow[];
  readonly trends?: readonly CostTrendPoint[];
}

// ============================================================================
// Lifecycle Status Report Types
// ============================================================================

/**
 * Lifecycle status row
 */
export interface LifecycleStatusRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetType: string;
  readonly displayName: string;
  readonly currentStatus: string;
  readonly statusSince: ISODateString;
  readonly daysInStatus: number;
  readonly previousStatus?: string;
  readonly nextExpectedStatus?: string;
  readonly warrantyExpiration?: ISODateString;
  readonly leaseExpiration?: ISODateString;
  readonly endOfLife?: ISODateString;
  readonly actionRequired?: string;
}

/**
 * Lifecycle distribution summary
 */
export interface LifecycleDistribution {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
  readonly averageDaysInStatus: number;
}

/**
 * Lifecycle status report data
 */
export interface LifecycleStatusReport {
  readonly metadata: ReportMetadata;
  readonly summary: {
    readonly totalAssets: number;
    readonly distribution: readonly LifecycleDistribution[];
    readonly upcomingExpirations: number;
    readonly overdueActions: number;
    readonly averageLifecycleDays: number;
  };
  readonly rows: readonly LifecycleStatusRow[];
}

// ============================================================================
// Report Access Log Types
// ============================================================================

/**
 * Report access log entry
 * Requirement 16.9: Log report access for audit purposes
 */
export interface ReportAccessLog {
  readonly logId: UUID;
  readonly reportId: UUID;
  readonly reportType: ReportType;
  readonly accessedBy: UUID;
  readonly accessedAt: ISODateString;
  readonly action: 'GENERATED' | 'DOWNLOADED' | 'VIEWED';
  readonly format: ExportFormat;
  readonly filters?: ReportFilters;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

/**
 * Report access log query
 */
export interface ReportAccessLogQuery {
  readonly reportId?: UUID;
  readonly reportType?: ReportType;
  readonly accessedBy?: UUID;
  readonly fromDate?: ISODateString;
  readonly toDate?: ISODateString;
  readonly action?: 'GENERATED' | 'DOWNLOADED' | 'VIEWED';
  readonly page?: number;
  readonly limit?: number;
}

// ============================================================================
// Export Types
// ============================================================================

/**
 * CSV export options
 */
export interface CSVExportOptions {
  readonly delimiter?: string;
  readonly includeHeaders?: boolean;
  readonly dateFormat?: string;
  readonly numberFormat?: string;
}

/**
 * Excel export options
 */
export interface ExcelExportOptions {
  readonly sheetName?: string;
  readonly includeCharts?: boolean;
  readonly freezeHeaders?: boolean;
  readonly autoFilter?: boolean;
  readonly columnWidths?: Record<string, number>;
}

/**
 * PDF export options
 */
export interface PDFExportOptions {
  readonly pageSize?: 'A4' | 'LETTER' | 'LEGAL';
  readonly orientation?: 'PORTRAIT' | 'LANDSCAPE';
  readonly includeHeader?: boolean;
  readonly includeFooter?: boolean;
  readonly includeLogo?: boolean;
  readonly includeCharts?: boolean;
}

/**
 * Union type for all report data
 */
export type ReportData =
  | AssetInventoryReport
  | ComplianceSummaryReport
  | CostAnalysisReport
  | LifecycleStatusReport
  | CustomReport;

// ============================================================================
// Custom Report Builder Types
// ============================================================================

/**
 * Custom report column definition
 * Requirement 16.2: Support custom report creation with configurable columns
 */
export interface CustomReportColumn {
  readonly columnId: string;
  readonly fieldName: string;
  readonly displayName: string;
  readonly dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY';
  readonly width?: number;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'NONE';
  readonly format?: string;
  readonly visible?: boolean;
  readonly order?: number;
}

/**
 * Custom report filter definition
 * Requirement 16.2: Support custom report creation with configurable filters
 */
export interface CustomReportFilter {
  readonly filterId: string;
  readonly fieldName: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
  readonly logicalOperator?: 'AND' | 'OR';
}

/**
 * Filter operators for custom reports
 */
export type FilterOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'GREATER_THAN'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_THAN_OR_EQUAL'
  | 'BETWEEN'
  | 'IN'
  | 'NOT_IN'
  | 'IS_NULL'
  | 'IS_NOT_NULL';

/**
 * Custom report grouping definition
 * Requirement 16.2: Support custom report creation with configurable groupings
 */
export interface CustomReportGrouping {
  readonly groupId: string;
  readonly fieldName: string;
  readonly displayName: string;
  readonly order: number;
  readonly sortDirection?: 'ASC' | 'DESC';
  readonly showSubtotals?: boolean;
}

/**
 * Custom report sorting definition
 */
export interface CustomReportSorting {
  readonly fieldName: string;
  readonly direction: 'ASC' | 'DESC';
  readonly order: number;
}

/**
 * Data source for custom reports
 */
export type CustomReportDataSource =
  | 'ASSETS'
  | 'HARDWARE_ASSETS'
  | 'SOFTWARE_ASSETS'
  | 'ENTERPRISE_ASSETS'
  | 'CONTRACTS'
  | 'PURCHASE_ORDERS'
  | 'WORK_ORDERS'
  | 'STOCKROOMS'
  | 'ENTITLEMENTS'
  | 'INSTALLATIONS';

/**
 * Custom report definition
 * Requirement 16.2: Support custom report creation with configurable columns, filters, and groupings
 */
export interface CustomReportDefinition {
  readonly dataSource: CustomReportDataSource;
  readonly columns: readonly CustomReportColumn[];
  readonly filters?: readonly CustomReportFilter[];
  readonly groupings?: readonly CustomReportGrouping[];
  readonly sorting?: readonly CustomReportSorting[];
  readonly includeSubtotals?: boolean;
  readonly includeGrandTotal?: boolean;
  readonly rowLimit?: number;
}

/**
 * Custom report generation request
 */
export interface GenerateCustomReportRequest {
  readonly definition: CustomReportDefinition;
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly templateId?: UUID;
  readonly includeCharts?: boolean;
}

/**
 * Custom report row (dynamic structure)
 */
export interface CustomReportRow {
  readonly [key: string]: unknown;
}

/**
 * Custom report metadata
 */
export interface CustomReportMetadata {
  readonly reportId: UUID;
  readonly reportType: 'CUSTOM';
  readonly title: string;
  readonly description?: string;
  readonly generatedAt: ISODateString;
  readonly generatedBy: UUID;
  readonly format: ExportFormat;
  readonly filters: ReportFilters;
  readonly totalRecords: number;
  readonly pageCount?: number;
}

/**
 * Custom report data
 */
export interface CustomReport {
  readonly metadata: CustomReportMetadata;
  readonly definition: CustomReportDefinition;
  readonly rows: readonly CustomReportRow[];
  readonly groupedData?: readonly CustomReportGroup[];
  readonly totals?: Record<string, number>;
}

/**
 * Custom report group (for grouped reports)
 */
export interface CustomReportGroup {
  readonly groupKey: string;
  readonly groupValue: unknown;
  readonly rows: readonly CustomReportRow[];
  readonly subtotals?: Record<string, number>;
  readonly subgroups?: readonly CustomReportGroup[];
}

// ============================================================================
// Report Template Types
// ============================================================================

/**
 * Report template visibility
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export type TemplateVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

/**
 * Report template
 * Requirement 16.10: Support report templates that can be saved and shared across users
 */
export interface ReportTemplate {
  readonly templateId: UUID;
  readonly name: string;
  readonly description?: string;
  readonly definition: CustomReportDefinition;
  readonly defaultFormat: ExportFormat;
  readonly createdBy: UUID;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly visibility: TemplateVisibility;
  readonly sharedWith?: readonly UUID[];
  readonly tags?: readonly string[];
  readonly usageCount: number;
  readonly lastUsedAt?: ISODateString;
  readonly isDefault?: boolean;
}

/**
 * Create report template request
 */
export interface CreateTemplateRequest {
  readonly name: string;
  readonly description?: string;
  readonly definition: CustomReportDefinition;
  readonly defaultFormat?: ExportFormat;
  readonly visibility?: TemplateVisibility;
  readonly sharedWith?: readonly UUID[];
  readonly tags?: readonly string[];
}

/**
 * Update report template request
 */
export interface UpdateTemplateRequest {
  readonly name?: string;
  readonly description?: string;
  readonly definition?: CustomReportDefinition;
  readonly defaultFormat?: ExportFormat;
  readonly visibility?: TemplateVisibility;
  readonly sharedWith?: readonly UUID[];
  readonly tags?: readonly string[];
}

/**
 * Template query parameters
 */
export interface TemplateQuery {
  readonly createdBy?: UUID;
  readonly visibility?: TemplateVisibility;
  readonly tags?: readonly string[];
  readonly searchTerm?: string;
  readonly includeShared?: boolean;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount';
  readonly sortDirection?: 'ASC' | 'DESC';
}

/**
 * Template list result
 */
export interface TemplateListResult {
  readonly templates: readonly ReportTemplate[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

// ============================================================================
// Available Fields for Custom Reports
// ============================================================================

/**
 * Available field definition for custom report builder UI
 */
export interface AvailableField {
  readonly fieldName: string;
  readonly displayName: string;
  readonly dataType: 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'CURRENCY';
  readonly category: string;
  readonly description?: string;
  readonly filterable: boolean;
  readonly sortable: boolean;
  readonly aggregatable: boolean;
}

/**
 * Available fields by data source
 */
export interface AvailableFieldsResult {
  readonly dataSource: CustomReportDataSource;
  readonly fields: readonly AvailableField[];
}



// ============================================================================
// Report Scheduling Types
// ============================================================================

/**
 * Schedule frequency types
 * Requirement 16.4: Schedule automated report generation and distribution via email
 */
export type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

/**
 * Schedule status
 * Requirement 16.4: Support pausing and resuming schedules
 */
export type ScheduleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'FAILED';

/**
 * Day of week for weekly schedules
 */
export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/**
 * Report schedule definition
 * Requirement 16.4: Allow users to schedule reports to run automatically
 */
export interface ReportSchedule {
  readonly scheduleId: UUID;
  readonly name: string;
  readonly description?: string;
  readonly reportType: ReportType;
  readonly reportConfig: GenerateReportRequest | GenerateCustomReportRequest;
  readonly frequency: ScheduleFrequency;
  readonly cronExpression?: string;
  readonly dayOfWeek?: DayOfWeek;
  readonly dayOfMonth?: number;
  readonly timeOfDay: string; // HH:mm format in UTC
  readonly timezone: string;
  readonly recipients: readonly string[];
  readonly emailSubject?: string;
  readonly emailBody?: string;
  readonly status: ScheduleStatus;
  readonly createdBy: UUID;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
  readonly lastRunAt?: ISODateString;
  readonly nextRunAt?: ISODateString;
  readonly runCount: number;
  readonly failureCount: number;
  readonly lastError?: string;
}

/**
 * Create report schedule request
 * Requirement 16.4: Schedule automated report generation
 */
export interface CreateScheduleRequest {
  readonly name: string;
  readonly description?: string;
  readonly reportType: ReportType;
  readonly reportConfig: GenerateReportRequest | GenerateCustomReportRequest;
  readonly frequency: ScheduleFrequency;
  readonly cronExpression?: string;
  readonly dayOfWeek?: DayOfWeek;
  readonly dayOfMonth?: number;
  readonly timeOfDay: string;
  readonly timezone?: string;
  readonly recipients: readonly string[];
  readonly emailSubject?: string;
  readonly emailBody?: string;
}

/**
 * Update report schedule request
 */
export interface UpdateScheduleRequest {
  readonly name?: string;
  readonly description?: string;
  readonly reportConfig?: GenerateReportRequest | GenerateCustomReportRequest;
  readonly frequency?: ScheduleFrequency;
  readonly cronExpression?: string;
  readonly dayOfWeek?: DayOfWeek;
  readonly dayOfMonth?: number;
  readonly timeOfDay?: string;
  readonly timezone?: string;
  readonly recipients?: readonly string[];
  readonly emailSubject?: string;
  readonly emailBody?: string;
  readonly status?: ScheduleStatus;
}

/**
 * Schedule query parameters
 */
export interface ScheduleQuery {
  readonly createdBy?: UUID;
  readonly status?: ScheduleStatus;
  readonly reportType?: ReportType;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: 'name' | 'createdAt' | 'nextRunAt' | 'lastRunAt';
  readonly sortDirection?: 'ASC' | 'DESC';
}

/**
 * Schedule list result
 */
export interface ScheduleListResult {
  readonly schedules: readonly ReportSchedule[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/**
 * Schedule execution record
 * Requirement 16.4: Track schedule execution history
 */
export interface ScheduleExecution {
  readonly executionId: UUID;
  readonly scheduleId: UUID;
  readonly reportId?: UUID;
  readonly status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  readonly startedAt: ISODateString;
  readonly completedAt?: ISODateString;
  readonly duration?: number; // milliseconds
  readonly recipientCount: number;
  readonly deliveredCount: number;
  readonly failedCount: number;
  readonly errorMessage?: string;
  readonly reportUrl?: string;
}

/**
 * Schedule execution query
 */
export interface ScheduleExecutionQuery {
  readonly scheduleId?: UUID;
  readonly status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  readonly fromDate?: ISODateString;
  readonly toDate?: ISODateString;
  readonly page?: number;
  readonly limit?: number;
}

/**
 * Schedule execution list result
 */
export interface ScheduleExecutionListResult {
  readonly executions: readonly ScheduleExecution[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

/**
 * Email distribution result
 * Requirement 16.4: Distribute reports via email
 */
export interface EmailDistributionResult {
  readonly recipient: string;
  readonly status: 'SENT' | 'FAILED' | 'BOUNCED';
  readonly sentAt?: ISODateString;
  readonly errorMessage?: string;
}

/**
 * Process scheduled reports request (for CloudWatch Events trigger)
 */
export interface ProcessScheduledReportsRequest {
  readonly scheduleIds?: readonly UUID[];
  readonly dryRun?: boolean;
}

/**
 * Process scheduled reports result
 */
export interface ProcessScheduledReportsResult {
  readonly processedCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly skippedCount: number;
  readonly executions: readonly ScheduleExecution[];
}


// ============================================================================
// Financial Report Types
// ============================================================================

/**
 * Depreciation method types
 * Requirement 16.8: Support multiple depreciation methods
 */
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'SUM_OF_YEARS_DIGITS' | 'UNITS_OF_PRODUCTION';

/**
 * Fiscal period type
 */
export type FiscalPeriodType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

/**
 * Financial report filters extending base filters
 * Requirement 16.8: Include fiscal year and period filtering
 */
export interface FinancialReportFilters extends ReportFilters {
  readonly fiscalYear?: number;
  readonly fiscalPeriod?: number;
  readonly fiscalPeriodType?: FiscalPeriodType;
  readonly depreciationMethod?: DepreciationMethod;
  readonly includeFullyDepreciated?: boolean;
  readonly vendorId?: UUID;
}

// ============================================================================
// Depreciation Schedule Report Types
// ============================================================================

/**
 * Depreciation schedule row for a single asset
 * Requirement 16.8: Generate depreciation schedules
 */
export interface DepreciationScheduleRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly assetType: string;
  readonly purchaseDate: ISODateString;
  readonly purchasePrice: number;
  readonly depreciationMethod: DepreciationMethod;
  readonly usefulLifeMonths: number;
  readonly residualValue: number;
  readonly depreciationStartDate: ISODateString;
  readonly currentPeriod: number;
  readonly totalPeriods: number;
  readonly periodDepreciation: number;
  readonly accumulatedDepreciation: number;
  readonly bookValue: number;
  readonly isFullyDepreciated: boolean;
  readonly costCenterId?: UUID;
  readonly costCenterName?: string;
  readonly departmentId?: UUID;
  readonly departmentName?: string;
}

/**
 * Depreciation period detail
 * Requirement 16.8: Show asset value over time
 */
export interface DepreciationPeriodDetail {
  readonly periodNumber: number;
  readonly periodStart: ISODateString;
  readonly periodEnd: ISODateString;
  readonly beginningValue: number;
  readonly depreciationAmount: number;
  readonly endingValue: number;
  readonly accumulatedDepreciation: number;
}

/**
 * Depreciation schedule summary
 */
export interface DepreciationScheduleSummary {
  readonly totalAssets: number;
  readonly totalPurchaseValue: number;
  readonly totalAccumulatedDepreciation: number;
  readonly totalBookValue: number;
  readonly totalPeriodDepreciation: number;
  readonly fullyDepreciatedCount: number;
  readonly byMethod: Record<DepreciationMethod, {
    readonly count: number;
    readonly totalValue: number;
    readonly totalDepreciation: number;
  }>;
  readonly byAssetType: Record<string, {
    readonly count: number;
    readonly totalValue: number;
    readonly totalDepreciation: number;
  }>;
}

/**
 * Depreciation schedule report data
 * Requirement 16.8: Generate depreciation schedule reports
 */
export interface DepreciationScheduleReport {
  readonly metadata: ReportMetadata;
  readonly summary: DepreciationScheduleSummary;
  readonly rows: readonly DepreciationScheduleRow[];
  readonly fiscalYear: number;
  readonly fiscalPeriod?: number;
  readonly fiscalPeriodType: FiscalPeriodType;
}

// ============================================================================
// Asset Valuation Report Types
// ============================================================================

/**
 * Asset valuation row
 * Requirement 16.8: Generate asset valuation reports with current values and depreciation
 */
export interface AssetValuationRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly assetType: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly serialNumber?: string;
  readonly status: string;
  readonly purchaseDate: ISODateString;
  readonly purchasePrice: number;
  readonly depreciationMethod: DepreciationMethod;
  readonly usefulLifeMonths: number;
  readonly residualValue: number;
  readonly accumulatedDepreciation: number;
  readonly currentBookValue: number;
  readonly fairMarketValue?: number;
  readonly valuationDate: ISODateString;
  readonly ageInMonths: number;
  readonly remainingLifeMonths: number;
  readonly depreciationPercentage: number;
  readonly costCenterId?: UUID;
  readonly costCenterName?: string;
  readonly departmentId?: UUID;
  readonly departmentName?: string;
  readonly assignedTo?: string;
  readonly location?: string;
}

/**
 * Asset valuation summary by category
 */
export interface ValuationByCategory {
  readonly category: string;
  readonly categoryType: 'ASSET_TYPE' | 'DEPARTMENT' | 'COST_CENTER' | 'STATUS';
  readonly assetCount: number;
  readonly totalPurchaseValue: number;
  readonly totalAccumulatedDepreciation: number;
  readonly totalBookValue: number;
  readonly totalFairMarketValue?: number;
  readonly averageAge: number;
  readonly averageDepreciationPercentage: number;
}

/**
 * Asset valuation summary
 */
export interface AssetValuationSummary {
  readonly totalAssets: number;
  readonly totalPurchaseValue: number;
  readonly totalAccumulatedDepreciation: number;
  readonly totalBookValue: number;
  readonly totalFairMarketValue?: number;
  readonly averageAssetAge: number;
  readonly averageDepreciationPercentage: number;
  readonly byAssetType: readonly ValuationByCategory[];
  readonly byDepartment: readonly ValuationByCategory[];
  readonly byCostCenter: readonly ValuationByCategory[];
  readonly byStatus: readonly ValuationByCategory[];
}

/**
 * Asset valuation report data
 * Requirement 16.8: Generate asset valuation reports
 */
export interface AssetValuationReport {
  readonly metadata: ReportMetadata;
  readonly summary: AssetValuationSummary;
  readonly rows: readonly AssetValuationRow[];
  readonly valuationDate: ISODateString;
}

// ============================================================================
// Budget Utilization Report Types
// ============================================================================

/**
 * Budget utilization row by cost center
 * Requirement 16.6: Generate budget utilization reports showing spend vs budget by cost center
 */
export interface BudgetUtilizationRow {
  readonly costCenterId: UUID;
  readonly costCenterCode: string;
  readonly costCenterName: string;
  readonly departmentId?: UUID;
  readonly departmentName?: string;
  readonly fiscalYear: number;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly committedAmount: number;
  readonly availableAmount: number;
  readonly utilizationPercentage: number;
  readonly varianceAmount: number;
  readonly variancePercentage: number;
  readonly isOverBudget: boolean;
  readonly assetPurchases: number;
  readonly maintenanceCosts: number;
  readonly licenseCosts: number;
  readonly otherCosts: number;
  readonly projectedYearEndSpend?: number;
  readonly projectedVariance?: number;
}

/**
 * Budget utilization by period
 */
export interface BudgetPeriodDetail {
  readonly period: string;
  readonly periodStart: ISODateString;
  readonly periodEnd: ISODateString;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly utilizationPercentage: number;
  readonly cumulativeBudget: number;
  readonly cumulativeSpend: number;
  readonly cumulativeUtilization: number;
}

/**
 * Budget utilization summary
 */
export interface BudgetUtilizationSummary {
  readonly fiscalYear: number;
  readonly totalBudget: number;
  readonly totalSpent: number;
  readonly totalCommitted: number;
  readonly totalAvailable: number;
  readonly overallUtilization: number;
  readonly costCentersOverBudget: number;
  readonly costCentersUnderBudget: number;
  readonly costCentersOnTrack: number;
  readonly totalAssetPurchases: number;
  readonly totalMaintenanceCosts: number;
  readonly totalLicenseCosts: number;
  readonly totalOtherCosts: number;
  readonly projectedYearEndSpend?: number;
  readonly projectedYearEndVariance?: number;
  readonly byDepartment: readonly {
    readonly departmentId: UUID;
    readonly departmentName: string;
    readonly budget: number;
    readonly spent: number;
    readonly utilization: number;
  }[];
}

/**
 * Budget utilization report data
 * Requirement 16.6: Generate budget utilization reports
 */
export interface BudgetUtilizationReport {
  readonly metadata: ReportMetadata;
  readonly summary: BudgetUtilizationSummary;
  readonly rows: readonly BudgetUtilizationRow[];
  readonly periodDetails?: readonly BudgetPeriodDetail[];
  readonly fiscalYear: number;
  readonly asOfDate: ISODateString;
}

// ============================================================================
// Financial Report Request Types
// ============================================================================

/**
 * Generate depreciation schedule report request
 */
export interface GenerateDepreciationScheduleRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: FinancialReportFilters;
  readonly fiscalYear?: number;
  readonly fiscalPeriod?: number;
  readonly fiscalPeriodType?: FiscalPeriodType;
  readonly includeFullyDepreciated?: boolean;
  readonly includeProjections?: boolean;
}

/**
 * Generate asset valuation report request
 */
export interface GenerateAssetValuationRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: FinancialReportFilters;
  readonly valuationDate?: ISODateString;
  readonly includeFairMarketValue?: boolean;
  readonly groupBy?: 'ASSET_TYPE' | 'DEPARTMENT' | 'COST_CENTER' | 'STATUS';
}

/**
 * Generate budget utilization report request
 */
export interface GenerateBudgetUtilizationRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: FinancialReportFilters;
  readonly fiscalYear?: number;
  readonly includePeriodDetails?: boolean;
  readonly includeProjections?: boolean;
}

/**
 * Financial report result
 */
export interface FinancialReportResult {
  readonly reportId: UUID;
  readonly status: ReportStatus;
  readonly metadata: ReportMetadata;
  readonly downloadUrl?: string;
  readonly content?: string;
  readonly errorMessage?: string;
}


// ============================================================================
// Procurement Spending Report Types
// ============================================================================

/**
 * Procurement spending by vendor
 * Requirement 19.2: Procurement spending report with totals grouped by vendor, category, and time period
 */
export interface ProcurementSpendingByVendor {
  readonly vendorId: UUID;
  readonly vendorName: string;
  readonly vendorType?: string;
  readonly totalAmount: number;
  readonly poCount: number;
  readonly averageOrderValue: number;
  readonly percentage: number;
}

/**
 * Procurement spending by category
 */
export interface ProcurementSpendingByCategory {
  readonly category: string;
  readonly totalAmount: number;
  readonly poCount: number;
  readonly percentage: number;
}

/**
 * Procurement spending by month
 */
export interface ProcurementSpendingByMonth {
  readonly month: string;
  readonly year: number;
  readonly totalAmount: number;
  readonly poCount: number;
}

/**
 * Procurement spending summary
 */
export interface ProcurementSpendingSummary {
  readonly period: { from: ISODateString; to: ISODateString };
  readonly totalSpending: number;
  readonly totalPOCount: number;
  readonly averageOrderValue: number;
  readonly byVendor: readonly ProcurementSpendingByVendor[];
  readonly byCategory: readonly ProcurementSpendingByCategory[];
  readonly byMonth: readonly ProcurementSpendingByMonth[];
}

/**
 * Procurement spending report row
 */
export interface ProcurementSpendingRow {
  readonly poId: UUID;
  readonly poNumber: string;
  readonly vendorId: UUID;
  readonly vendorName: string;
  readonly costCenterId: UUID;
  readonly costCenterCode: string;
  readonly status: string;
  readonly requestedDate: ISODateString;
  readonly approvedDate?: ISODateString;
  readonly totalAmount: number;
  readonly category?: string;
}

/**
 * Procurement spending report data
 * Requirement 19.2: Procurement spending report
 */
export interface ProcurementSpendingReport {
  readonly metadata: ReportMetadata;
  readonly summary: ProcurementSpendingSummary;
  readonly rows: readonly ProcurementSpendingRow[];
}

/**
 * Generate procurement spending report request
 */
export interface GenerateProcurementSpendingRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: FinancialReportFilters;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
  readonly groupBy?: 'VENDOR' | 'CATEGORY' | 'COST_CENTER' | 'MONTH';
}

// ============================================================================
// Vendor Spending Analysis Report Types
// ============================================================================

/**
 * Vendor spending trend
 * Requirement 19.5: Vendor spending analysis with trend analysis
 */
export type SpendingTrend = 'INCREASING' | 'STABLE' | 'DECREASING';

/**
 * Vendor spending analysis row
 */
export interface VendorSpendingAnalysisRow {
  readonly vendorId: UUID;
  readonly vendorName: string;
  readonly vendorType?: string;
  readonly rating?: string;
  readonly totalSpending: number;
  readonly poCount: number;
  readonly averageOrderValue: number;
  readonly trend: SpendingTrend;
  readonly trendPercentage: number;
  readonly previousPeriodSpending?: number;
}

/**
 * Vendor spending analysis summary
 */
export interface VendorSpendingAnalysisSummary {
  readonly period: { from: ISODateString; to: ISODateString };
  readonly totalVendors: number;
  readonly totalSpending: number;
  readonly topVendorsBySpending: readonly VendorSpendingAnalysisRow[];
  readonly vendorsWithIncreasingTrend: number;
  readonly vendorsWithDecreasingTrend: number;
}

/**
 * Vendor spending analysis report data
 */
export interface VendorSpendingAnalysisReport {
  readonly metadata: ReportMetadata;
  readonly summary: VendorSpendingAnalysisSummary;
  readonly vendors: readonly VendorSpendingAnalysisRow[];
}

/**
 * Generate vendor spending analysis request
 */
export interface GenerateVendorSpendingAnalysisRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: FinancialReportFilters;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
  readonly includeTrendAnalysis?: boolean;
}
