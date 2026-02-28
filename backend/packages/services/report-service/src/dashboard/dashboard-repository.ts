/**
 * Dashboard Repository - Database operations for dashboard data aggregation
 *
 * Handles data retrieval for the Asset Estate Dashboard including:
 * - Asset summary with value and counts by type/status
 * - Lease expiration alerts
 * - Compliance indicator calculations
 *
 * Requirements:
 * - Requirement 12.1: Display total asset value and counts by category
 * - Requirement 12.2: Show lifecycle distribution and compliance indicators
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'dashboard-repository' });

// ============================================================================
// Types
// ============================================================================

export interface AssetTypeSummary {
  readonly type: string;
  readonly count: number;
  readonly value: number;
}

export interface AssetStatusSummary {
  readonly status: string;
  readonly count: number;
}

export interface DashboardSummaryData {
  readonly totalAssetValue: number;
  readonly totalAssetCount: number;
  readonly byType: readonly AssetTypeSummary[];
  readonly byStatus: readonly AssetStatusSummary[];
}

export interface LeaseExpirationRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly leaseEndDate: string;
  readonly daysUntilExpiration: number;
  readonly monthlyLeaseCost: number;
}

export interface ComplianceRow {
  readonly id: string;
  readonly name: string;
  readonly type: 'license' | 'warranty' | 'maintenance' | 'audit';
  readonly current: number;
  readonly threshold: number;
  readonly description: string;
  readonly lastChecked: string;
}

// ============================================================================
// Dashboard Summary Query
// ============================================================================

/**
 * Get aggregated dashboard summary data
 */
export async function getDashboardSummary(): Promise<DashboardSummaryData> {
  logger.debug('Fetching dashboard summary data');

  // Get total counts and value
  const totalsQuery = `
    SELECT
      COUNT(*)::integer AS total_count,
      COALESCE(SUM(ha.purchase_price), 0)::numeric AS total_value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE a.status NOT IN ('DISPOSED', 'RETIRED')
  `;

  const totals = await queryOne<{ total_count: number; total_value: number }>(totalsQuery);

  // Get counts by type with value
  const byTypeQuery = `
    SELECT
      a.asset_type AS type,
      COUNT(*)::integer AS count,
      COALESCE(SUM(ha.purchase_price), 0)::numeric AS value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE a.status NOT IN ('DISPOSED', 'RETIRED')
    GROUP BY a.asset_type
    ORDER BY count DESC
  `;

  const byTypeRows = await queryMany<{ type: string; count: number; value: number }>(byTypeQuery);

  // Get counts by status
  const byStatusQuery = `
    SELECT
      a.status,
      COUNT(*)::integer AS count
    FROM assets a
    WHERE a.status NOT IN ('DISPOSED')
    GROUP BY a.status
    ORDER BY
      CASE a.status
        WHEN 'DEPLOYED' THEN 1
        WHEN 'IN_STOCK' THEN 2
        WHEN 'ORDERED' THEN 3
        WHEN 'RECEIVED' THEN 4
        WHEN 'RESERVED' THEN 5
        WHEN 'IN_MAINTENANCE' THEN 6
        WHEN 'RETIRED' THEN 7
        ELSE 8
      END
  `;

  const byStatusRows = await queryMany<{ status: string; count: number }>(byStatusQuery);

  return {
    totalAssetValue: totals?.total_value ?? 0,
    totalAssetCount: totals?.total_count ?? 0,
    byType: byTypeRows.map((row) => ({
      type: row.type,
      count: row.count,
      value: Number(row.value),
    })),
    byStatus: byStatusRows.map((row) => ({
      status: row.status,
      count: row.count,
    })),
  };
}

// ============================================================================
// Lease Expiration Query
// ============================================================================

/**
 * Get assets with upcoming lease expirations
 * Returns assets where lease ends within the next 180 days
 */
export async function getLeaseExpirations(daysAhead: number = 180): Promise<readonly LeaseExpirationRow[]> {
  logger.debug('Fetching lease expirations', { daysAhead });

  const query = `
    SELECT
      a.asset_id,
      a.asset_tag,
      a.display_name,
      ha.lease_end_date::text AS lease_end_date,
      (ha.lease_end_date - CURRENT_DATE)::integer AS days_until_expiration,
      COALESCE(ha.monthly_lease_cost, 0)::numeric AS monthly_lease_cost
    FROM assets a
    INNER JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE ha.lease_end_date IS NOT NULL
      AND ha.lease_end_date >= CURRENT_DATE
      AND ha.lease_end_date <= CURRENT_DATE + $1::integer
      AND a.status NOT IN ('DISPOSED', 'RETIRED')
    ORDER BY ha.lease_end_date ASC
    LIMIT 20
  `;

  const rows = await queryMany<{
    asset_id: UUID;
    asset_tag: string;
    display_name: string;
    lease_end_date: string;
    days_until_expiration: number;
    monthly_lease_cost: number;
  }>(query, [daysAhead]);

  return rows.map((row) => ({
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    displayName: row.display_name,
    leaseEndDate: row.lease_end_date,
    daysUntilExpiration: row.days_until_expiration,
    monthlyLeaseCost: Number(row.monthly_lease_cost),
  }));
}

// ============================================================================
// Compliance Indicators Query
// ============================================================================

/**
 * Get compliance indicators for dashboard
 * Aggregates license usage, warranty status, maintenance compliance, and audit status
 */
export async function getComplianceIndicators(): Promise<readonly ComplianceRow[]> {
  logger.debug('Fetching compliance indicators');

  const indicators: ComplianceRow[] = [];

  // License compliance - count software assets vs license entitlements
  // This is a simplified query - real implementation would join with license tables
  const licenseQuery = `
    SELECT
      COUNT(*)::integer AS current_usage,
      (SELECT COUNT(*) FROM assets WHERE asset_type = 'SOFTWARE' AND status = 'DEPLOYED') AS threshold
    FROM assets
    WHERE asset_type = 'SOFTWARE'
      AND status IN ('DEPLOYED', 'IN_STOCK')
  `;

  const licenseData = await queryOne<{ current_usage: number; threshold: number }>(licenseQuery);
  if (licenseData) {
    indicators.push({
      id: 'software-licenses',
      name: 'Software Licenses',
      type: 'license',
      current: licenseData.current_usage,
      threshold: Math.max(licenseData.threshold, licenseData.current_usage),
      description: 'Software license utilization across deployed assets',
      lastChecked: new Date().toISOString(),
    });
  }

  // Warranty compliance - count assets with expired warranties
  const warrantyQuery = `
    SELECT
      COUNT(*) FILTER (WHERE ha.warranty_expiration < CURRENT_DATE)::integer AS expired,
      COUNT(*)::integer AS total
    FROM hardware_assets ha
    INNER JOIN assets a ON ha.asset_id = a.asset_id
    WHERE ha.warranty_expiration IS NOT NULL
      AND a.status NOT IN ('DISPOSED', 'RETIRED')
  `;

  const warrantyData = await queryOne<{ expired: number; total: number }>(warrantyQuery);
  if (warrantyData && warrantyData.total > 0) {
    indicators.push({
      id: 'hardware-warranties',
      name: 'Hardware Warranties',
      type: 'warranty',
      current: warrantyData.expired,
      threshold: Math.ceil(warrantyData.total * 0.1), // Alert if >10% expired
      description: `${warrantyData.expired} assets with expired warranties out of ${warrantyData.total}`,
      lastChecked: new Date().toISOString(),
    });
  }

  // Maintenance compliance - assets with overdue maintenance
  const maintenanceQuery = `
    SELECT
      COUNT(*) FILTER (WHERE a.status = 'IN_MAINTENANCE')::integer AS in_maintenance,
      COUNT(*)::integer AS total_assets
    FROM assets a
    WHERE a.asset_type = 'HARDWARE'
      AND a.status NOT IN ('DISPOSED', 'RETIRED')
  `;

  const maintenanceData = await queryOne<{ in_maintenance: number; total_assets: number }>(maintenanceQuery);
  if (maintenanceData && maintenanceData.total_assets > 0) {
    indicators.push({
      id: 'maintenance-compliance',
      name: 'Maintenance Status',
      type: 'maintenance',
      current: maintenanceData.in_maintenance,
      threshold: Math.ceil(maintenanceData.total_assets * 0.05), // Alert if >5% in maintenance
      description: `${maintenanceData.in_maintenance} assets currently in maintenance`,
      lastChecked: new Date().toISOString(),
    });
  }

  // Inventory audit status - based on last audit scan dates
  const auditQuery = `
    SELECT
      COUNT(*)::integer AS total_assets,
      COUNT(*) FILTER (
        WHERE a.updated_at > CURRENT_DATE - INTERVAL '90 days'
      )::integer AS recently_verified
    FROM assets a
    WHERE a.status NOT IN ('DISPOSED')
  `;

  const auditData = await queryOne<{ total_assets: number; recently_verified: number }>(auditQuery);
  if (auditData && auditData.total_assets > 0) {
    indicators.push({
      id: 'inventory-audit',
      name: 'Inventory Audit',
      type: 'audit',
      current: auditData.recently_verified,
      threshold: auditData.total_assets,
      description: `${auditData.recently_verified} of ${auditData.total_assets} assets verified in last 90 days`,
      lastChecked: new Date().toISOString(),
    });
  }

  return indicators;
}
