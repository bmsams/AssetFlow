/**
 * Operational Report Types
 *
 * Type definitions for operational reports including work order summaries,
 * maintenance compliance, stockroom inventory, and asset lifecycle reports.
 *
 * Requirements:
 * - 20.1: Work order summary report
 * - 20.2: Maintenance compliance report
 * - 20.3: Stockroom inventory report
 * - 20.4: Transfer order report
 * - 20.5: Asset lifecycle report
 */

import type { ISODateString, UUID } from '@ams/types';
import type { AssetStatusFilter, ExportFormat, ReportMetadata } from '../report/report-types';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Operational report filters
 */
export interface OperationalReportFilters {
  readonly assetType?: 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE' | 'ALL';
  readonly assetStatus?: AssetStatusFilter;
  readonly departmentId?: UUID;
  readonly stockroomId?: UUID;
  readonly stockroomType?: string;
  readonly assignedTo?: UUID;
  readonly workOrderStatus?: string;
  readonly workOrderType?: string;
  readonly priority?: string;
  readonly maintenanceType?: string;
  readonly transferStatus?: string;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
}

// ============================================================================
// Work Order Summary Report Types
// ============================================================================

/**
 * Work order summary row
 * Requirement 20.1: Work order counts by status, type, and priority
 */
export interface WorkOrderSummaryRow {
  readonly workOrderId: UUID;
  readonly workOrderNumber: string;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly workType: string;
  readonly priority: string;
  readonly status: string;
  readonly title: string;
  readonly assignedTo?: UUID;
  readonly assignedToName?: string;
  readonly scheduledDate?: ISODateString;
  readonly dueDate?: ISODateString;
  readonly completedDate?: ISODateString;
  readonly estimatedDurationHours?: number;
  readonly actualDurationHours?: number;
  readonly completionTimeHours?: number;
  readonly isOverdue: boolean;
}

/**
 * Work order count by category
 */
export interface WorkOrderCountByCategory {
  readonly category: string;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Work order summary statistics
 */
export interface WorkOrderSummarySummary {
  readonly period: { from: ISODateString; to: ISODateString };
  readonly totalWorkOrders: number;
  readonly byStatus: readonly WorkOrderCountByCategory[];
  readonly byType: readonly WorkOrderCountByCategory[];
  readonly byPriority: readonly WorkOrderCountByCategory[];
  readonly averageCompletionTimeHours: number;
  readonly overdueCount: number;
  readonly completedOnTimeCount: number;
  readonly completedLateCount: number;
  readonly completionRate: number;
}

/**
 * Work order summary report data
 */
export interface WorkOrderSummaryReport {
  readonly metadata: ReportMetadata;
  readonly summary: WorkOrderSummarySummary;
  readonly rows: readonly WorkOrderSummaryRow[];
}

/**
 * Generate work order summary report request
 */
export interface GenerateWorkOrderSummaryRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: OperationalReportFilters;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
}

// ============================================================================
// Maintenance Compliance Report Types
// ============================================================================

/**
 * Maintenance compliance row
 * Requirement 20.2: Maintenance plan adherence rates
 */
export interface MaintenanceComplianceRow {
  readonly planId: UUID;
  readonly planName: string;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly maintenanceType: string;
  readonly scheduleType: string;
  readonly frequencyDays?: number;
  readonly lastPerformedDate?: ISODateString;
  readonly nextDueDate?: ISODateString;
  readonly executionCount: number;
  readonly isActive: boolean;
  readonly isOverdue: boolean;
  readonly daysOverdue?: number;
  readonly completedCount: number;
  readonly onTimeCount: number;
  readonly adherenceRate: number;
}

/**
 * Maintenance compliance by category
 */
export interface MaintenanceComplianceByCategory {
  readonly category: string;
  readonly totalPlans: number;
  readonly overdueCount: number;
  readonly complianceRate: number;
}

/**
 * Maintenance compliance summary statistics
 */
export interface MaintenanceComplianceSummary {
  readonly totalPlans: number;
  readonly activePlans: number;
  readonly overdueCount: number;
  readonly dueSoonCount: number;
  readonly complianceRate: number;
  readonly averageAdherenceRate: number;
  readonly byMaintenanceType: readonly MaintenanceComplianceByCategory[];
  readonly byAssetType: readonly MaintenanceComplianceByCategory[];
}

/**
 * Maintenance compliance report data
 */
export interface MaintenanceComplianceReport {
  readonly metadata: ReportMetadata;
  readonly summary: MaintenanceComplianceSummary;
  readonly rows: readonly MaintenanceComplianceRow[];
}

/**
 * Generate maintenance compliance report request
 */
export interface GenerateMaintenanceComplianceRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: OperationalReportFilters;
  readonly includeOverdueOnly?: boolean;
}

// ============================================================================
// Stockroom Inventory Report Types
// ============================================================================

/**
 * Stockroom inventory row
 * Requirement 20.3: Current inventory levels with reorder alerts
 */
export interface StockroomInventoryRow {
  readonly stockroomId: UUID;
  readonly stockroomCode: string;
  readonly stockroomName: string;
  readonly stockroomType: string;
  readonly capacityUnits?: number;
  readonly currentCount: number;
  readonly utilizationPercentage: number;
  readonly assetCount: number;
  readonly inStockCount: number;
  readonly reservedCount: number;
  readonly binCount: number;
  readonly binsBelowReorder: number;
  readonly hasReorderAlert: boolean;
}

/**
 * Stockroom inventory by type
 */
export interface StockroomInventoryByType {
  readonly stockroomType: string;
  readonly count: number;
  readonly totalCapacity: number;
  readonly totalCurrentCount: number;
  readonly averageUtilization: number;
}

/**
 * Stockroom inventory summary statistics
 */
export interface StockroomInventorySummary {
  readonly totalStockrooms: number;
  readonly totalCapacity: number;
  readonly totalCurrentCount: number;
  readonly overallUtilization: number;
  readonly stockroomsOverCapacity: number;
  readonly stockroomsUnderUtilized: number;
  readonly totalReorderAlerts: number;
  readonly byStockroomType: readonly StockroomInventoryByType[];
}

/**
 * Stockroom inventory report data
 */
export interface StockroomInventoryReport {
  readonly metadata: ReportMetadata;
  readonly summary: StockroomInventorySummary;
  readonly rows: readonly StockroomInventoryRow[];
}

/**
 * Generate stockroom inventory report request
 */
export interface GenerateStockroomInventoryRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: OperationalReportFilters;
  readonly includeReorderAlertsOnly?: boolean;
}

// ============================================================================
// Transfer Order Report Types
// ============================================================================

/**
 * Transfer order row
 * Requirement 20.4: Transfer activity between stockrooms
 */
export interface TransferOrderRow {
  readonly transferId: UUID;
  readonly transferNumber: string;
  readonly status: string;
  readonly sourceStockroomId: UUID;
  readonly sourceStockroomName: string;
  readonly destinationStockroomId: UUID;
  readonly destinationStockroomName: string;
  readonly requestedBy?: UUID;
  readonly requestedByName?: string;
  readonly requestedDate: ISODateString;
  readonly shippedDate?: ISODateString;
  readonly receivedDate?: ISODateString;
  readonly quantityRequested: number;
  readonly quantityShipped: number;
  readonly quantityReceived: number;
  readonly fulfillmentTimeHours?: number;
}

/**
 * Transfer order by stockroom
 */
export interface TransferOrderByStockroom {
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly transferCount: number;
  readonly totalQuantity: number;
}

/**
 * Transfer order by status
 */
export interface TransferOrderByStatus {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Transfer order summary statistics
 */
export interface TransferOrderSummary {
  readonly period: { from: ISODateString; to: ISODateString };
  readonly totalTransfers: number;
  readonly completedTransfers: number;
  readonly pendingTransfers: number;
  readonly cancelledTransfers: number;
  readonly totalQuantityTransferred: number;
  readonly averageFulfillmentTimeHours: number;
  readonly bySourceStockroom: readonly TransferOrderByStockroom[];
  readonly byDestinationStockroom: readonly TransferOrderByStockroom[];
  readonly byStatus: readonly TransferOrderByStatus[];
}

/**
 * Transfer order report data
 */
export interface TransferOrderReport {
  readonly metadata: ReportMetadata;
  readonly summary: TransferOrderSummary;
  readonly rows: readonly TransferOrderRow[];
}

/**
 * Generate transfer order report request
 */
export interface GenerateTransferOrderRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: OperationalReportFilters;
  readonly dateFrom?: ISODateString;
  readonly dateTo?: ISODateString;
}

// ============================================================================
// Asset Lifecycle Report Types
// ============================================================================

/**
 * Asset lifecycle row
 * Requirement 20.5: Assets by lifecycle stage
 */
export interface AssetLifecycleRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetType: string;
  readonly displayName: string;
  readonly status: string;
  readonly orderedDate?: ISODateString;
  readonly receivedDate?: ISODateString;
  readonly deployedDate?: ISODateString;
  readonly retiredDate?: ISODateString;
  readonly totalAgeDays: number;
  readonly daysInCurrentStatus: number;
}

/**
 * Asset lifecycle by status
 */
export interface AssetLifecycleByStatus {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
  readonly averageDaysInStatus: number;
}

/**
 * Asset lifecycle by type
 */
export interface AssetLifecycleByType {
  readonly assetType: string;
  readonly count: number;
  readonly averageLifecycleDays: number;
}

/**
 * Average time in each lifecycle stage
 */
export interface AverageTimeInStage {
  readonly ORDERED: number;
  readonly RECEIVED: number;
  readonly IN_STOCK: number;
  readonly RESERVED: number;
  readonly DEPLOYED: number;
  readonly IN_MAINTENANCE: number;
  readonly RETIRED: number;
  readonly DISPOSED: number;
}

/**
 * Asset lifecycle summary statistics
 */
export interface AssetLifecycleSummary {
  readonly totalAssets: number;
  readonly byStatus: readonly AssetLifecycleByStatus[];
  readonly byAssetType: readonly AssetLifecycleByType[];
  readonly averageTimeInStage: AverageTimeInStage;
  readonly averageTotalLifecycleDays: number;
}

/**
 * Asset lifecycle report data
 */
export interface AssetLifecycleReport {
  readonly metadata: ReportMetadata;
  readonly summary: AssetLifecycleSummary;
  readonly rows: readonly AssetLifecycleRow[];
}

/**
 * Generate asset lifecycle report request
 */
export interface GenerateAssetLifecycleRequest {
  readonly format: ExportFormat;
  readonly title?: string;
  readonly description?: string;
  readonly filters?: OperationalReportFilters;
}

// ============================================================================
// Operational Report Result
// ============================================================================

/**
 * Operational report result
 */
export interface OperationalReportResult {
  readonly reportId: UUID;
  readonly status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  readonly metadata: ReportMetadata;
  readonly downloadUrl?: string;
  readonly content?: string;
  readonly errorMessage?: string;
}
