/**
 * Dashboard Service - Business logic for dashboard data aggregation
 *
 * Provides methods for retrieving dashboard summary, lease expirations,
 * and compliance indicators with percentage calculations.
 *
 * Requirements:
 * - Requirement 12.1: Display total asset value and counts by category
 * - Requirement 12.2: Show lifecycle distribution and compliance indicators
 */

import * as cache from '@ams/cache';
import { CACHE_ENTITY_TYPES } from '@ams/cache';
import { createLogger } from '@ams/utils';
import * as dashboardRepository from './dashboard-repository';

const logger = createLogger({ service: 'dashboard-service' });

// ============================================================================
// Types
// ============================================================================

export interface DashboardSummary {
  readonly totalAssetValue: number;
  readonly totalAssetCount: number;
  readonly byType: readonly TypeBreakdown[];
  readonly byStatus: readonly StatusBreakdown[];
}

export interface TypeBreakdown {
  readonly type: string;
  readonly count: number;
  readonly value: number;
  readonly percentage: number;
}

export interface StatusBreakdown {
  readonly status: string;
  readonly count: number;
  readonly percentage: number;
}

export interface LeaseExpiration {
  readonly assetId: string;
  readonly assetTag: string;
  readonly displayName: string;
  readonly leaseEndDate: string;
  readonly daysUntilExpiration: number;
  readonly monthlyLeaseCost: number;
}

export interface ComplianceIndicator {
  readonly id: string;
  readonly name: string;
  readonly type: 'license' | 'warranty' | 'maintenance' | 'audit';
  readonly current: number;
  readonly threshold: number;
  readonly description: string;
  readonly lastChecked: string;
}

// ============================================================================
// Dashboard Summary
// ============================================================================

/**
 * Get complete dashboard summary with calculated percentages
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  logger.info('Getting dashboard summary');

  const cacheKey = `ams:${CACHE_ENTITY_TYPES.DASHBOARD}:summary`;
  const cached = await cache.get<DashboardSummary>(cacheKey);
  if (cached) {
    return cached;
  }

  const data = await dashboardRepository.getDashboardSummary();

  // Calculate percentages for type breakdown
  const byType: TypeBreakdown[] = data.byType.map((item) => ({
    type: item.type,
    count: item.count,
    value: item.value,
    percentage: data.totalAssetCount > 0
      ? Number(((item.count / data.totalAssetCount) * 100).toFixed(1))
      : 0,
  }));

  // Calculate percentages for status breakdown
  const byStatus: StatusBreakdown[] = data.byStatus.map((item) => ({
    status: item.status,
    count: item.count,
    percentage: data.totalAssetCount > 0
      ? Number(((item.count / data.totalAssetCount) * 100).toFixed(1))
      : 0,
  }));

  logger.info('Dashboard summary retrieved', {
    totalAssets: data.totalAssetCount,
    totalValue: data.totalAssetValue,
    typeCount: byType.length,
    statusCount: byStatus.length,
  });

  const summary: DashboardSummary = {
    totalAssetValue: data.totalAssetValue,
    totalAssetCount: data.totalAssetCount,
    byType,
    byStatus,
  };

  // Cache with 60s TTL since dashboard is loaded frequently
  await cache.set(cacheKey, summary, { ttl: 60 });

  return summary;
}

// ============================================================================
// Lease Expirations
// ============================================================================

/**
 * Get upcoming lease expirations
 * @param daysAhead Number of days to look ahead (default 180)
 */
export async function getLeaseExpirations(daysAhead: number = 180): Promise<readonly LeaseExpiration[]> {
  logger.info('Getting lease expirations', { daysAhead });

  const expirations = await dashboardRepository.getLeaseExpirations(daysAhead);

  logger.info('Lease expirations retrieved', { count: expirations.length });

  return expirations;
}

// ============================================================================
// Compliance Indicators
// ============================================================================

/**
 * Get compliance indicators for dashboard
 */
export async function getComplianceIndicators(): Promise<readonly ComplianceIndicator[]> {
  logger.info('Getting compliance indicators');

  const indicators = await dashboardRepository.getComplianceIndicators();

  logger.info('Compliance indicators retrieved', { count: indicators.length });

  return indicators;
}
