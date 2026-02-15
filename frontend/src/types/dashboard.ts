/**
 * Dashboard types for the Asset Management System
 * Implements Requirements 12.1, 12.2: Asset Estate Dashboard
 */

import type { AssetType, AssetStatus } from './asset';

/**
 * Summary statistics for the asset estate
 */
export interface AssetEstateSummary {
  totalAssetValue: number;
  totalAssetCount: number;
  countsByCategory: CategoryCount[];
  lifecycleDistribution: LifecycleDistribution[];
  leaseExpirations: LeaseExpiration[];
  complianceIndicators: ComplianceIndicator[];
}

/**
 * Asset count by category/type
 */
export interface CategoryCount {
  category: AssetType;
  label: string;
  count: number;
  value: number;
  percentageOfTotal: number;
}

/**
 * Distribution of assets across lifecycle states
 */
export interface LifecycleDistribution {
  status: AssetStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Lease expiration information
 */
export interface LeaseExpiration {
  assetId: string;
  assetTag: string;
  displayName: string;
  leaseEndDate: string;
  daysUntilExpiration: number;
  monthlyLeaseCost: number;
  severity: ExpirationSeverity;
}

export type ExpirationSeverity = 'critical' | 'warning' | 'info';

/**
 * Compliance risk indicator
 */
export interface ComplianceIndicator {
  id: string;
  name: string;
  type: ComplianceType;
  status: ComplianceStatus;
  value: number;
  threshold: number;
  description: string;
  lastChecked: string;
}

export type ComplianceType = 'license' | 'warranty' | 'maintenance' | 'audit';
export type ComplianceStatus = 'compliant' | 'at_risk' | 'non_compliant';

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  position: WidgetPosition;
  size: DashboardWidgetSize;
  config?: Record<string, unknown>;
}

export type DashboardWidgetType = 
  | 'stat_card'
  | 'lifecycle_chart'
  | 'lease_expirations'
  | 'compliance_indicators'
  | 'category_breakdown'
  | 'recent_activity';

export interface WidgetPosition {
  row: number;
  column: number;
}

export interface DashboardWidgetSize {
  width: number;
  height: number;
}

/**
 * Dashboard filter options
 */
export interface DashboardFilters {
  dateRange?: DateRange;
  categories?: AssetType[];
  statuses?: AssetStatus[];
}

export interface DateRange {
  start: string;
  end: string;
}

/**
 * Format currency value for display
 */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format large numbers with abbreviations
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Get severity color for expiration
 */
export function getExpirationSeverity(daysUntilExpiration: number): ExpirationSeverity {
  if (daysUntilExpiration <= 30) return 'critical';
  if (daysUntilExpiration <= 60) return 'warning';
  return 'info';
}

/**
 * Get status color for compliance
 */
export function getComplianceStatusColor(status: ComplianceStatus): string {
  switch (status) {
    case 'compliant':
      return 'var(--color-success-500)';
    case 'at_risk':
      return 'var(--color-warning-500)';
    case 'non_compliant':
      return 'var(--color-error-500)';
    default:
      return 'var(--color-gray-500)';
  }
}
