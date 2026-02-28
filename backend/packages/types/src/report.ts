/**
 * Report types for the Asset Management System
 *
 * This module defines types for report generation and export:
 * Asset Reports, Financial Reports, Operational Reports
 */

import type { UUID, ISODateString } from './common';

// ============================================================================
// Report Format Types
// ============================================================================

/**
 * Supported report export formats
 */
export type ReportFormat = 'JSON' | 'CSV' | 'EXCEL' | 'PDF';

/**
 * Trend direction for analytics
 */
export type TrendDirection = 'INCREASING' | 'STABLE' | 'DECREASING';

// ============================================================================
// Report Request Interfaces
// ============================================================================

/**
 * Base report request
 */
export interface ReportRequest {
  readonly reportType: string;
  readonly filters?: ReportFilters;
  readonly format?: ReportFormat;
}

/**
 * Common filters for reports
 */
export interface ReportFilters {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly assetType?: string;
  readonly status?: string;
  readonly locationId?: UUID;
  readonly departmentId?: UUID;
  readonly vendorId?: UUID;
  readonly costCenterId?: UUID;
}

/**
 * Report period specification
 */
export interface ReportPeriod {
  readonly from: ISODateString;
  readonly to: ISODateString;
}

// ============================================================================
// Asset Inventory Report Interfaces
// ============================================================================

/**
 * Asset summary report response
 */
export interface AssetSummaryReport {
  readonly generatedAt: ISODateString;
  readonly totalAssets: number;
  readonly byType: readonly AssetTypeCount[];
  readonly byStatus: readonly AssetStatusCount[];
  readonly byLocation: readonly AssetLocationCount[];
}

/**
 * Asset count by type
 */
export interface AssetTypeCount {
  readonly type: string;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Asset count by status
 */
export interface AssetStatusCount {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Asset count by location
 */
export interface AssetLocationCount {
  readonly location: string;
  readonly count: number;
}

/**
 * Asset aging report response
 */
export interface AssetAgingReport {
  readonly generatedAt: ISODateString;
  readonly ageRanges: readonly AssetAgeRange[];
  readonly assets: readonly AssetAgingDetail[];
}

/**
 * Asset age range summary
 */
export interface AssetAgeRange {
  readonly range: string;
  readonly count: number;
  readonly totalValue: number;
  readonly depreciatedValue: number;
}

/**
 * Individual asset aging detail
 */
export interface AssetAgingDetail {
  readonly assetTag: string;
  readonly assetType: string;
  readonly acquisitionDate: ISODateString;
  readonly ageInDays: number;
  readonly originalValue: number;
  readonly currentValue: number;
  readonly depreciationStatus: string;
}

/**
 * Asset by location report response
 */
export interface AssetByLocationReport {
  readonly generatedAt: ISODateString;
  readonly buildings: readonly BuildingAssetSummary[];
}

/**
 * Building asset summary
 */
export interface BuildingAssetSummary {
  readonly buildingName: string;
  readonly totalAssets: number;
  readonly floors: readonly FloorAssetSummary[];
}

/**
 * Floor asset summary
 */
export interface FloorAssetSummary {
  readonly floorName: string;
  readonly totalAssets: number;
  readonly rooms: readonly RoomAssetSummary[];
}

/**
 * Room asset summary
 */
export interface RoomAssetSummary {
  readonly roomName: string;
  readonly assetCount: number;
}

/**
 * Asset by department report response
 */
export interface AssetByDepartmentReport {
  readonly generatedAt: ISODateString;
  readonly departments: readonly DepartmentAssetSummary[];
}

/**
 * Department asset summary
 */
export interface DepartmentAssetSummary {
  readonly departmentName: string;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly byType: readonly DepartmentAssetTypeBreakdown[];
}

/**
 * Department asset type breakdown
 */
export interface DepartmentAssetTypeBreakdown {
  readonly type: string;
  readonly count: number;
  readonly value: number;
}

// ============================================================================
// Financial Report Interfaces
// ============================================================================

/**
 * Cost center utilization report response
 */
export interface CostCenterUtilizationReport {
  readonly generatedAt: ISODateString;
  readonly fiscalYear: number;
  readonly costCenters: readonly CostCenterUtilization[];
}

/**
 * Cost center utilization detail
 */
export interface CostCenterUtilization {
  readonly costCenterCode: string;
  readonly costCenterName: string;
  readonly departmentName: string;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly availableAmount: number;
  readonly utilizationPercentage: number;
}

/**
 * Procurement spending report response
 */
export interface ProcurementSpendingReport {
  readonly generatedAt: ISODateString;
  readonly period: ReportPeriod;
  readonly totalSpending: number;
  readonly byVendor: readonly VendorSpending[];
  readonly byCategory: readonly CategorySpending[];
  readonly byMonth: readonly MonthlySpending[];
}

/**
 * Vendor spending summary
 */
export interface VendorSpending {
  readonly vendorName: string;
  readonly totalAmount: number;
  readonly poCount: number;
  readonly percentage: number;
}

/**
 * Category spending summary
 */
export interface CategorySpending {
  readonly category: string;
  readonly totalAmount: number;
  readonly percentage: number;
}

/**
 * Monthly spending summary
 */
export interface MonthlySpending {
  readonly month: string;
  readonly totalAmount: number;
}

/**
 * Depreciation report response
 */
export interface DepreciationReport {
  readonly generatedAt: ISODateString;
  readonly totalOriginalValue: number;
  readonly totalCurrentValue: number;
  readonly totalDepreciation: number;
  readonly assets: readonly DepreciationDetail[];
}

/**
 * Asset depreciation detail
 */
export interface DepreciationDetail {
  readonly assetTag: string;
  readonly assetType: string;
  readonly acquisitionDate: ISODateString;
  readonly originalValue: number;
  readonly currentValue: number;
  readonly depreciationMethod: string;
  readonly usefulLifeYears: number;
  readonly remainingLifeYears: number;
}

/**
 * Total cost of ownership report response
 */
export interface TotalCostOfOwnershipReport {
  readonly generatedAt: ISODateString;
  readonly assetTag: string;
  readonly assetType: string;
  readonly acquisitionCost: number;
  readonly maintenanceCosts: number;
  readonly operatingCosts: number;
  readonly totalCostToDate: number;
  readonly projectedDisposalValue: number;
  readonly projectedTotalCost: number;
  readonly costBreakdown: readonly CostBreakdownItem[];
}

/**
 * Cost breakdown item
 */
export interface CostBreakdownItem {
  readonly category: string;
  readonly amount: number;
  readonly percentage: number;
}

/**
 * Vendor spending analysis report response
 */
export interface VendorSpendingAnalysisReport {
  readonly generatedAt: ISODateString;
  readonly period: ReportPeriod;
  readonly vendors: readonly VendorSpendingAnalysis[];
}

/**
 * Vendor spending analysis detail
 */
export interface VendorSpendingAnalysis {
  readonly vendorId: UUID;
  readonly vendorName: string;
  readonly vendorType: string;
  readonly rating: string;
  readonly totalSpending: number;
  readonly poCount: number;
  readonly averageOrderValue: number;
  readonly trend: TrendDirection;
  readonly trendPercentage: number;
}

// ============================================================================
// Operational Report Interfaces
// ============================================================================

/**
 * Work order summary report response
 */
export interface WorkOrderSummaryReport {
  readonly generatedAt: ISODateString;
  readonly period: ReportPeriod;
  readonly totalWorkOrders: number;
  readonly byStatus: readonly WorkOrderStatusCount[];
  readonly byType: readonly WorkOrderTypeCount[];
  readonly byPriority: readonly WorkOrderPriorityCount[];
  readonly averageCompletionTimeHours: number;
  readonly overdueCount: number;
}

/**
 * Work order count by status
 */
export interface WorkOrderStatusCount {
  readonly status: string;
  readonly count: number;
}

/**
 * Work order count by type
 */
export interface WorkOrderTypeCount {
  readonly type: string;
  readonly count: number;
}

/**
 * Work order count by priority
 */
export interface WorkOrderPriorityCount {
  readonly priority: string;
  readonly count: number;
}

/**
 * Maintenance compliance report response
 */
export interface MaintenanceComplianceReport {
  readonly generatedAt: ISODateString;
  readonly totalPlans: number;
  readonly activePlans: number;
  readonly complianceRate: number;
  readonly overdueItems: readonly OverdueMaintenanceItem[];
  readonly upcomingItems: readonly UpcomingMaintenanceItem[];
}

/**
 * Overdue maintenance item
 */
export interface OverdueMaintenanceItem {
  readonly planId: UUID;
  readonly planName: string;
  readonly assetTag: string;
  readonly dueDate: ISODateString;
  readonly daysOverdue: number;
}

/**
 * Upcoming maintenance item
 */
export interface UpcomingMaintenanceItem {
  readonly planId: UUID;
  readonly planName: string;
  readonly assetTag: string;
  readonly dueDate: ISODateString;
  readonly daysUntilDue: number;
}

/**
 * Stockroom inventory report response
 */
export interface StockroomInventoryReport {
  readonly generatedAt: ISODateString;
  readonly stockrooms: readonly StockroomInventorySummary[];
}

/**
 * Stockroom inventory summary
 */
export interface StockroomInventorySummary {
  readonly stockroomName: string;
  readonly stockroomType: string;
  readonly totalItems: number;
  readonly totalValue: number;
  readonly utilizationPercentage: number;
  readonly reorderAlerts: readonly ReorderAlert[];
}

/**
 * Reorder alert item
 */
export interface ReorderAlert {
  readonly productDescription: string;
  readonly currentQuantity: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
}

/**
 * Transfer order report response
 */
export interface TransferOrderReport {
  readonly generatedAt: ISODateString;
  readonly period: ReportPeriod;
  readonly totalTransfers: number;
  readonly byStatus: readonly TransferStatusCount[];
  readonly averageFulfillmentDays: number;
  readonly topRoutes: readonly TransferRoute[];
}

/**
 * Transfer count by status
 */
export interface TransferStatusCount {
  readonly status: string;
  readonly count: number;
}

/**
 * Transfer route summary
 */
export interface TransferRoute {
  readonly fromStockroom: string;
  readonly toStockroom: string;
  readonly transferCount: number;
  readonly totalQuantity: number;
}

/**
 * Asset lifecycle report response
 */
export interface AssetLifecycleReport {
  readonly generatedAt: ISODateString;
  readonly byStage: readonly LifecycleStageCount[];
  readonly recentTransitions: readonly LifecycleTransition[];
}

/**
 * Lifecycle stage count
 */
export interface LifecycleStageCount {
  readonly stage: string;
  readonly count: number;
  readonly averageDaysInStage: number;
}

/**
 * Lifecycle transition record
 */
export interface LifecycleTransition {
  readonly assetTag: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly transitionDate: ISODateString;
  readonly daysInPreviousStatus: number;
}
