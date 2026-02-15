/**
 * Report types for the Asset Management System
 * Implements Task 18: Frontend - Reports Pages
 *
 * Note: These types align with @ams/types/report.ts from the backend.
 * Frontend-specific extensions (UI helpers, display types) are defined here.
 */

import type { AssetStatus, AssetType } from './asset';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOCALE = 'en-US';
const DEFAULT_CURRENCY = 'USD';

/**
 * Threshold constants for utilization coloring
 */
export const UTILIZATION_THRESHOLDS = {
  CRITICAL: 90,
  WARNING: 75,
  MODERATE: 50,
} as const;

/**
 * Threshold constants for compliance coloring
 */
export const COMPLIANCE_THRESHOLDS = {
  GOOD: 90,
  WARNING: 75,
} as const;

// ============================================================================
// CSS Color Types (for type-safe styling)
// ============================================================================

/**
 * CSS color variable names used in the application
 */
export type CssColorVariable =
  | 'var(--color-error-500)'
  | 'var(--color-warning-500)'
  | 'var(--color-primary-500)'
  | 'var(--color-success-500)';

// ============================================================================
// Common Types
// ============================================================================

/**
 * Report format for export (aligned with @ams/types ReportFormat)
 */
export type ReportFormat = 'JSON' | 'CSV' | 'EXCEL' | 'PDF';

/**
 * Report category for UI grouping
 */
export type ReportCategory = 'asset' | 'financial' | 'operational';

/**
 * Valid report icon names for UI
 */
export type ReportIcon =
  | 'chart-pie'
  | 'clock'
  | 'map-pin'
  | 'users'
  | 'dollar-sign'
  | 'shopping-cart'
  | 'tool'
  | 'check-circle';

/**
 * Work order status for reports (aligned with @ams/types)
 */
export type WorkOrderStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Work order type for reports (aligned with @ams/types)
 */
export type WorkOrderType =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'INSPECTION'
  | 'CALIBRATION'
  | 'EMERGENCY';

/**
 * Work order priority for reports (aligned with @ams/types)
 */
export type WorkOrderPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Depreciation status for aging reports
 */
export type DepreciationStatus =
  | 'ACTIVE'
  | 'FULLY_DEPRECIATED'
  | 'NOT_DEPRECIABLE';

/**
 * Report filters (aligned with @ams/types ReportFilters)
 */
export interface ReportFilters {
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly assetType?: AssetType;
  readonly status?: AssetStatus;
  readonly locationId?: string;
  readonly departmentId?: string;
  readonly vendorId?: string;
  readonly costCenterId?: string;
}

/**
 * Report period specification (aligned with @ams/types ReportPeriod)
 */
export interface ReportPeriod {
  readonly from: string;
  readonly to: string;
}

// ============================================================================
// Asset Inventory Reports
// ============================================================================

/**
 * Asset type breakdown item
 */
export interface AssetTypeBreakdown {
  readonly type: AssetType;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Asset status breakdown item
 */
export interface AssetStatusBreakdown {
  readonly status: AssetStatus;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Location breakdown item
 */
export interface LocationBreakdown {
  readonly location: string;
  readonly count: number;
}

/**
 * Asset summary report
 */
export interface AssetSummaryReport {
  readonly generatedAt: string;
  readonly totalAssets: number;
  readonly byType: readonly AssetTypeBreakdown[];
  readonly byStatus: readonly AssetStatusBreakdown[];
  readonly byLocation: readonly LocationBreakdown[];
}

/**
 * Asset aging item
 */
export interface AssetAgingItem {
  readonly assetTag: string;
  readonly assetType: AssetType;
  readonly acquisitionDate: string;
  readonly ageInDays: number;
  readonly originalValue: number;
  readonly currentValue: number;
  readonly depreciationStatus: DepreciationStatus;
}

/**
 * Age range summary
 */
export interface AgeRangeSummary {
  readonly range: string;
  readonly count: number;
  readonly totalValue: number;
  readonly depreciatedValue: number;
}

/**
 * Asset aging report
 */
export interface AssetAgingReport {
  readonly generatedAt: string;
  readonly ageRanges: readonly AgeRangeSummary[];
  readonly assets: readonly AssetAgingItem[];
}

/**
 * Room asset count
 */
export interface RoomAssetCount {
  readonly roomName: string;
  readonly assetCount: number;
}

/**
 * Floor asset summary
 */
export interface FloorAssetSummary {
  readonly floorName: string;
  readonly totalAssets: number;
  readonly rooms: readonly RoomAssetCount[];
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
 * Asset by location report
 */
export interface AssetByLocationReport {
  readonly generatedAt: string;
  readonly buildings: readonly BuildingAssetSummary[];
}

/**
 * Department type breakdown
 */
export interface DepartmentTypeBreakdown {
  readonly type: AssetType;
  readonly count: number;
  readonly value: number;
}

/**
 * Department asset summary
 */
export interface DepartmentAssetSummary {
  readonly departmentName: string;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly byType: readonly DepartmentTypeBreakdown[];
}

/**
 * Asset by department report
 */
export interface AssetByDepartmentReport {
  readonly generatedAt: string;
  readonly departments: readonly DepartmentAssetSummary[];
}

// ============================================================================
// Financial Reports
// ============================================================================

/**
 * Cost center utilization item
 */
export interface CostCenterUtilizationItem {
  readonly costCenterCode: string;
  readonly costCenterName: string;
  readonly departmentName: string;
  readonly budgetAmount: number;
  readonly spentAmount: number;
  readonly availableAmount: number;
  readonly utilizationPercentage: number;
}

/**
 * Cost center utilization report
 */
export interface CostCenterUtilizationReport {
  readonly generatedAt: string;
  readonly fiscalYear: number;
  readonly costCenters: readonly CostCenterUtilizationItem[];
}

/**
 * Vendor spending summary
 */
export interface VendorSpendingSummary {
  readonly vendorName: string;
  readonly totalAmount: number;
  readonly poCount: number;
  readonly percentage: number;
}

/**
 * Category spending summary
 */
export interface CategorySpendingSummary {
  readonly category: string;
  readonly totalAmount: number;
  readonly percentage: number;
}

/**
 * Monthly spending summary
 */
export interface MonthlySpendingSummary {
  readonly month: string;
  readonly totalAmount: number;
}

/**
 * Procurement spending report (aligned with @ams/types ProcurementSpendingReport)
 */
export interface ProcurementSpendingReport {
  readonly generatedAt: string;
  readonly period: ReportPeriod;
  readonly totalSpending: number;
  readonly byVendor: readonly VendorSpendingSummary[];
  readonly byCategory: readonly CategorySpendingSummary[];
  readonly byMonth: readonly MonthlySpendingSummary[];
}

// ============================================================================
// Operational Reports
// ============================================================================

/**
 * Work order status breakdown
 */
export interface WorkOrderStatusBreakdown {
  readonly status: WorkOrderStatus;
  readonly count: number;
}

/**
 * Work order type breakdown
 */
export interface WorkOrderTypeBreakdown {
  readonly type: WorkOrderType;
  readonly count: number;
}

/**
 * Work order priority breakdown
 */
export interface WorkOrderPriorityBreakdown {
  readonly priority: WorkOrderPriority;
  readonly count: number;
}

/**
 * Work order summary report (aligned with @ams/types WorkOrderSummaryReport)
 */
export interface WorkOrderSummaryReport {
  readonly generatedAt: string;
  readonly period: ReportPeriod;
  readonly totalWorkOrders: number;
  readonly byStatus: readonly WorkOrderStatusBreakdown[];
  readonly byType: readonly WorkOrderTypeBreakdown[];
  readonly byPriority: readonly WorkOrderPriorityBreakdown[];
  readonly averageCompletionTimeHours: number;
  readonly overdueCount: number;
}

/**
 * Base maintenance item shared between overdue and upcoming items
 * Reduces duplication and ensures consistency
 */
export interface BaseMaintenanceItem {
  readonly planId: string;
  readonly planName: string;
  readonly assetTag: string;
  readonly dueDate: string;
}

/**
 * Overdue maintenance item (extends base with days overdue)
 */
export interface OverdueMaintenanceItem extends BaseMaintenanceItem {
  readonly daysOverdue: number;
}

/**
 * Upcoming maintenance item (extends base with days until due)
 */
export interface UpcomingMaintenanceItem extends BaseMaintenanceItem {
  readonly daysUntilDue: number;
}

/**
 * Maintenance compliance report
 */
export interface MaintenanceComplianceReport {
  readonly generatedAt: string;
  readonly totalPlans: number;
  readonly activePlans: number;
  readonly complianceRate: number;
  readonly overdueItems: readonly OverdueMaintenanceItem[];
  readonly upcomingItems: readonly UpcomingMaintenanceItem[];
}

// ============================================================================
// Report Definition Types
// ============================================================================

/**
 * Report type definitions for the report selection page
 */
export interface ReportDefinition {
  readonly id: ReportId;
  readonly name: string;
  readonly description: string;
  readonly category: ReportCategory;
  readonly icon: ReportIcon;
  readonly path: string;
}

/**
 * Available report IDs
 */
export type ReportId =
  | 'asset-summary'
  | 'asset-aging'
  | 'assets-by-location'
  | 'assets-by-department'
  | 'cost-center-utilization'
  | 'procurement-spending'
  | 'work-order-summary'
  | 'maintenance-compliance';

/**
 * Available reports configuration
 */
export const AVAILABLE_REPORTS: readonly ReportDefinition[] = [
  {
    id: 'asset-summary',
    name: 'Asset Summary',
    description: 'Overview of all assets by type, status, and location',
    category: 'asset',
    icon: 'chart-pie',
    path: '/reports/asset-summary',
  },
  {
    id: 'asset-aging',
    name: 'Asset Aging',
    description: 'Assets grouped by age with depreciation status',
    category: 'asset',
    icon: 'clock',
    path: '/reports/asset-aging',
  },
  {
    id: 'assets-by-location',
    name: 'Assets by Location',
    description: 'Assets organized by building, floor, and room',
    category: 'asset',
    icon: 'map-pin',
    path: '/reports/assets-by-location',
  },
  {
    id: 'assets-by-department',
    name: 'Assets by Department',
    description: 'Assets grouped by department with cost allocation',
    category: 'asset',
    icon: 'users',
    path: '/reports/assets-by-department',
  },
  {
    id: 'cost-center-utilization',
    name: 'Cost Center Utilization',
    description: 'Budget vs actual spending for each cost center',
    category: 'financial',
    icon: 'dollar-sign',
    path: '/reports/cost-center-utilization',
  },
  {
    id: 'procurement-spending',
    name: 'Procurement Spending',
    description: 'Purchase order totals by vendor, category, and time',
    category: 'financial',
    icon: 'shopping-cart',
    path: '/reports/procurement-spending',
  },
  {
    id: 'work-order-summary',
    name: 'Work Order Summary',
    description: 'Work orders by status, type, and priority',
    category: 'operational',
    icon: 'tool',
    path: '/reports/work-order-summary',
  },
  {
    id: 'maintenance-compliance',
    name: 'Maintenance Compliance',
    description: 'Maintenance plan adherence and overdue items',
    category: 'operational',
    icon: 'check-circle',
    path: '/reports/maintenance-compliance',
  },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Memoized Intl.DateTimeFormat instances for performance
 * Avoids recreating formatters on every call
 */
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Get or create a memoized date formatter
 */
function getDateFormatter(locale: string, includeTime: boolean): Intl.DateTimeFormat {
  const key = `${locale}-${includeTime ? 'datetime' : 'date'}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = includeTime
      ? {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        };
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

// Re-export formatCurrency from dashboard to avoid duplicate definitions
export { formatCurrency } from './dashboard';

/**
 * Format percentage value
 * @returns Formatted percentage string (e.g., "75.5%")
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format date for display with null safety
 * Uses memoized formatters for performance
 * @returns Formatted date string (e.g., "Jan 15, 2025")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return getDateFormatter(DEFAULT_LOCALE, false).format(date);
}

/**
 * Format date and time for display with null safety
 * Uses memoized formatters for performance
 * @returns Formatted datetime string (e.g., "Jan 15, 2025, 02:30 PM")
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return getDateFormatter(DEFAULT_LOCALE, true).format(date);
}

/**
 * Get color for utilization percentage based on thresholds
 * @returns CSS color variable for styling
 */
export function getUtilizationColor(percentage: number): CssColorVariable {
  if (percentage >= UTILIZATION_THRESHOLDS.CRITICAL) {
    return 'var(--color-error-500)';
  }
  if (percentage >= UTILIZATION_THRESHOLDS.WARNING) {
    return 'var(--color-warning-500)';
  }
  if (percentage >= UTILIZATION_THRESHOLDS.MODERATE) {
    return 'var(--color-primary-500)';
  }
  return 'var(--color-success-500)';
}

/**
 * Get color for compliance rate based on thresholds
 * @returns CSS color variable for styling
 */
export function getComplianceColor(rate: number): CssColorVariable {
  if (rate >= COMPLIANCE_THRESHOLDS.GOOD) {
    return 'var(--color-success-500)';
  }
  if (rate >= COMPLIANCE_THRESHOLDS.WARNING) {
    return 'var(--color-warning-500)';
  }
  return 'var(--color-error-500)';
}

/**
 * Get report definition by ID
 */
export function getReportById(id: ReportId): ReportDefinition | undefined {
  return AVAILABLE_REPORTS.find((report) => report.id === id);
}

/**
 * Get reports by category
 */
export function getReportsByCategory(category: ReportCategory): readonly ReportDefinition[] {
  return AVAILABLE_REPORTS.filter((report) => report.category === category);
}
