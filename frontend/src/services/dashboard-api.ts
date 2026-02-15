/**
 * Dashboard API Service
 *
 * Aggregates data from multiple backend services to populate
 * the Asset Estate Dashboard with real data.
 *
 * Implements Requirements 12.1, 12.2: Asset Estate Dashboard
 */

import { apiClient, ApiError } from './api-client';
import type {
  AssetEstateSummary,
  CategoryCount,
  LifecycleDistribution,
  LeaseExpiration,
  ComplianceIndicator,
  ExpirationSeverity,
  ComplianceStatus,
} from '../types/dashboard';
import type { AssetType, AssetStatus } from '../types/asset';

// ============================================================================
// Response Types from Backend
// ============================================================================

interface DashboardSummaryResponse {
  totalAssetValue: number;
  totalAssetCount: number;
  byType: Array<{
    type: AssetType;
    count: number;
    value: number;
    percentage: number;
  }>;
  byStatus: Array<{
    status: AssetStatus;
    count: number;
    percentage: number;
  }>;
}

interface LeaseExpirationResponse {
  assetId: string;
  assetTag: string;
  displayName: string;
  leaseEndDate: string;
  daysUntilExpiration: number;
  monthlyLeaseCost: number;
}

interface ComplianceResponse {
  id: string;
  name: string;
  type: 'license' | 'warranty' | 'maintenance' | 'audit';
  current: number;
  threshold: number;
  description: string;
  lastChecked: string;
}

// ============================================================================
// Status Color Mapping
// ============================================================================

const STATUS_COLORS: Record<AssetStatus, string> = {
  ORDERED: '#8b5cf6',      // purple
  RECEIVED: '#06b6d4',     // cyan
  IN_STOCK: '#3b82f6',     // blue
  RESERVED: '#f59e0b',     // amber
  DEPLOYED: '#22c55e',     // green
  IN_MAINTENANCE: '#f97316', // orange
  RETIRED: '#6b7280',      // gray
  DISPOSED: '#ef4444',     // red
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
  IN_STOCK: 'In Stock',
  RESERVED: 'Reserved',
  DEPLOYED: 'Deployed',
  IN_MAINTENANCE: 'In Maintenance',
  RETIRED: 'Retired',
  DISPOSED: 'Disposed',
};

const TYPE_LABELS: Record<AssetType, string> = {
  HARDWARE: 'Hardware Assets',
  SOFTWARE: 'Software Licenses',
  ENTERPRISE: 'Enterprise Assets',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getExpirationSeverity(days: number): ExpirationSeverity {
  if (days <= 30) return 'critical';
  if (days <= 60) return 'warning';
  return 'info';
}

function getComplianceStatus(current: number, threshold: number): ComplianceStatus {
  const ratio = current / threshold;
  if (ratio > 1) return 'non_compliant';
  if (ratio >= 0.95) return 'at_risk';
  return 'compliant';
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch complete dashboard summary data
 * Aggregates from asset summary, lease, and compliance endpoints
 */
export async function getDashboardSummary(): Promise<AssetEstateSummary> {
  // Fetch all data in parallel
  const [summaryResult, leasesResult, complianceResult] = await Promise.allSettled([
    fetchAssetSummary(),
    fetchLeaseExpirations(),
    fetchComplianceIndicators(),
  ]);

  // Extract data with fallbacks
  const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const leases = leasesResult.status === 'fulfilled' ? leasesResult.value : [];
  const compliance = complianceResult.status === 'fulfilled' ? complianceResult.value : [];

  // Build response
  return {
    totalAssetValue: summary?.totalAssetValue ?? 0,
    totalAssetCount: summary?.totalAssetCount ?? 0,
    countsByCategory: summary?.countsByCategory ?? [],
    lifecycleDistribution: summary?.lifecycleDistribution ?? [],
    leaseExpirations: leases,
    complianceIndicators: compliance,
  };
}

/**
 * Fetch asset summary with counts by type and status
 */
async function fetchAssetSummary(): Promise<{
  totalAssetValue: number;
  totalAssetCount: number;
  countsByCategory: CategoryCount[];
  lifecycleDistribution: LifecycleDistribution[];
}> {
  const response = await apiClient.get<DashboardSummaryResponse>('/dashboard/summary');

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch dashboard summary',
      400,
      response.requestId
    );
  }

  const data = response.data;

  // Transform category counts
  const countsByCategory: CategoryCount[] = data.byType.map((item) => ({
    category: item.type,
    label: TYPE_LABELS[item.type] || item.type,
    count: item.count,
    value: item.value,
    percentageOfTotal: item.percentage,
  }));

  // Transform lifecycle distribution
  const lifecycleDistribution: LifecycleDistribution[] = data.byStatus.map((item) => ({
    status: item.status,
    label: STATUS_LABELS[item.status] || item.status,
    count: item.count,
    percentage: item.percentage,
    color: STATUS_COLORS[item.status] || '#6b7280',
  }));

  return {
    totalAssetValue: data.totalAssetValue,
    totalAssetCount: data.totalAssetCount,
    countsByCategory,
    lifecycleDistribution,
  };
}

/**
 * Fetch upcoming lease expirations
 */
async function fetchLeaseExpirations(): Promise<LeaseExpiration[]> {
  const response = await apiClient.get<LeaseExpirationResponse[]>('/dashboard/lease-expirations');

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch lease expirations',
      400,
      response.requestId
    );
  }

  return response.data.map((item) => ({
    assetId: item.assetId,
    assetTag: item.assetTag,
    displayName: item.displayName,
    leaseEndDate: item.leaseEndDate,
    daysUntilExpiration: item.daysUntilExpiration,
    monthlyLeaseCost: item.monthlyLeaseCost,
    severity: getExpirationSeverity(item.daysUntilExpiration),
  }));
}

/**
 * Fetch compliance indicators
 */
async function fetchComplianceIndicators(): Promise<ComplianceIndicator[]> {
  const response = await apiClient.get<ComplianceResponse[]>('/dashboard/compliance');

  if (!response.success || !response.data) {
    throw new ApiError(
      response.error?.code || 'FETCH_FAILED',
      response.error?.message || 'Failed to fetch compliance indicators',
      400,
      response.requestId
    );
  }

  return response.data.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    status: getComplianceStatus(item.current, item.threshold),
    value: item.current,
    threshold: item.threshold,
    description: item.description,
    lastChecked: item.lastChecked,
  }));
}

// ============================================================================
// Namespace Export
// ============================================================================

export const dashboardApi = {
  getSummary: getDashboardSummary,
};
