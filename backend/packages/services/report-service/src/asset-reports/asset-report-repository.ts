/**
 * Asset Report Repository - Database operations for asset report data aggregation
 *
 * Handles data retrieval and aggregation for asset inventory reports including
 * asset summary, aging analysis, location-based, and department-based reports.
 *
 * Requirements:
 * - Requirement 18.1: Asset summary report with aggregated counts by type, status, and location
 * - Requirement 18.2: Asset aging report with assets grouped by age ranges
 * - Requirement 18.3: Asset by location report with building/floor/room hierarchy
 * - Requirement 18.4: Asset by department report with cost allocation
 * - Requirement 18.5: Support filtering by date range, asset type, status, location, department
 */

import type { UUID } from '@ams/types';
import { queryMany, queryOne } from '@ams/database';
import { createLogger } from '@ams/utils';

import type { AssetStatusFilter, AssetTypeFilter } from '../report/report-types';

const logger = createLogger({ service: 'asset-report-repository' });

// ============================================================================
// Types
// ============================================================================

/**
 * Asset report filters
 */
export interface AssetReportFilters {
  readonly assetType?: AssetTypeFilter;
  readonly assetStatus?: AssetStatusFilter;
  readonly departmentId?: UUID;
  readonly costCenterId?: UUID;
  readonly buildingId?: UUID;
  readonly floorId?: UUID;
  readonly roomId?: UUID;
  readonly stockroomId?: UUID;
  readonly manufacturerId?: UUID;
  readonly modelId?: UUID;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly includeInactive?: boolean;
}

/**
 * Asset summary data by category
 */
export interface AssetSummaryByCategory {
  readonly category: string;
  readonly count: number;
  readonly totalValue: number;
  readonly percentage?: number;
}

/**
 * Asset summary report data
 */
export interface AssetSummaryData {
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly byType: readonly AssetSummaryByCategory[];
  readonly byStatus: readonly AssetSummaryByCategory[];
  readonly byLocation: readonly AssetSummaryByCategory[];
}

/**
 * Asset aging bucket
 */
export interface AssetAgingBucket {
  readonly range: string;
  readonly minMonths: number;
  readonly maxMonths: number | null;
  readonly count: number;
  readonly totalValue: number;
  readonly depreciatedValue: number;
}

/**
 * Asset aging row for detailed listing
 */
export interface AssetAgingRow {
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly displayName: string;
  readonly assetType: string;
  readonly acquisitionDate: string;
  readonly ageInDays: number;
  readonly ageInMonths: number;
  readonly originalValue: number;
  readonly currentValue: number;
  readonly depreciationStatus: 'ACTIVE' | 'FULLY_DEPRECIATED' | 'NOT_DEPRECIATING';
  readonly remainingLifeMonths?: number;
  readonly department?: string;
  readonly location?: string;
}

/**
 * Asset by location building data
 */
export interface LocationBuildingData {
  readonly buildingId: UUID;
  readonly buildingName: string;
  readonly buildingCode: string;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly floors: readonly LocationFloorData[];
}

/**
 * Asset by location floor data
 */
export interface LocationFloorData {
  readonly floorId: UUID;
  readonly floorName: string;
  readonly floorNumber: number;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly rooms: readonly LocationRoomData[];
}

/**
 * Asset by location room data
 */
export interface LocationRoomData {
  readonly roomId: UUID;
  readonly roomName: string;
  readonly roomNumber: string;
  readonly assetCount: number;
  readonly totalValue: number;
}

/**
 * Asset by department data
 */
export interface DepartmentAssetData {
  readonly departmentId: UUID;
  readonly departmentCode: string;
  readonly departmentName: string;
  readonly totalAssets: number;
  readonly totalValue: number;
  readonly byType: readonly AssetSummaryByCategory[];
}

// ============================================================================
// Asset Summary Report Data
// ============================================================================

/**
 * Get asset summary report data
 * Requirement 18.1: Return aggregated counts by asset type, status, and location
 */
export async function getAssetSummaryData(
  filters: AssetReportFilters
): Promise<AssetSummaryData> {
  logger.debug('Getting asset summary data', { filters });

  // Build WHERE conditions
  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count and value
  const totalQuery = `
    SELECT 
      COUNT(*)::integer as total_assets,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
  `;

  const totalResult = await queryOne<{ total_assets: number; total_value: string }>(
    totalQuery,
    params
  );

  const totalAssets = totalResult?.total_assets ?? 0;
  const totalValue = parseFloat(totalResult?.total_value ?? '0');

  // Get counts by asset type
  const byTypeQuery = `
    SELECT 
      a.asset_type as category,
      COUNT(*)::integer as count,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
    GROUP BY a.asset_type
    ORDER BY count DESC
  `;

  const byTypeResults = await queryMany<{ category: string; count: number; total_value: string }>(
    byTypeQuery,
    params
  );

  const byType = byTypeResults.map(row => ({
    category: row.category,
    count: row.count,
    totalValue: parseFloat(row.total_value),
    percentage: totalAssets > 0 ? Math.round((row.count / totalAssets) * 10000) / 100 : 0,
  }));

  // Get counts by status
  const byStatusQuery = `
    SELECT 
      a.status as category,
      COUNT(*)::integer as count,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
    GROUP BY a.status
    ORDER BY count DESC
  `;

  const byStatusResults = await queryMany<{ category: string; count: number; total_value: string }>(
    byStatusQuery,
    params
  );

  const byStatus = byStatusResults.map(row => ({
    category: row.category,
    count: row.count,
    totalValue: parseFloat(row.total_value),
    percentage: totalAssets > 0 ? Math.round((row.count / totalAssets) * 10000) / 100 : 0,
  }));

  // Get counts by location (building level)
  const byLocationQuery = `
    SELECT 
      COALESCE(
        NULLIF(TRIM(CASE 
          WHEN a.asset_type = 'HARDWARE' THEN ha.building
          WHEN a.asset_type = 'ENTERPRISE' THEN ea.building
          ELSE NULL
        END), ''),
        'Unassigned'
      ) as category,
      COUNT(*)::integer as count,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
    GROUP BY COALESCE(
      NULLIF(TRIM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.building
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.building
        ELSE NULL
      END), ''),
      'Unassigned'
    )
    ORDER BY count DESC
  `;

  const byLocationResults = await queryMany<{ category: string; count: number; total_value: string }>(
    byLocationQuery,
    params
  );

  const byLocation = byLocationResults.map(row => ({
    category: row.category,
    count: row.count,
    totalValue: parseFloat(row.total_value),
    percentage: totalAssets > 0 ? Math.round((row.count / totalAssets) * 10000) / 100 : 0,
  }));

  logger.debug('Asset summary data retrieved', { totalAssets, totalValue });

  return {
    totalAssets,
    totalValue,
    byType,
    byStatus,
    byLocation,
  };
}

// ============================================================================
// Asset Aging Report Data
// ============================================================================

/**
 * Get asset aging data with buckets
 * Requirement 18.2: Return assets grouped by age ranges with depreciation status
 */
export async function getAssetAgingData(
  filters: AssetReportFilters,
  ageBuckets: readonly { minMonths: number; maxMonths: number | null; label: string }[] = DEFAULT_AGE_BUCKETS
): Promise<{ buckets: readonly AssetAgingBucket[]; rows: readonly AssetAgingRow[] }> {
  logger.debug('Getting asset aging data', { filters, bucketCount: ageBuckets.length });

  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get detailed asset aging rows
  const rowsQuery = `
    SELECT 
      a.asset_id,
      a.asset_tag,
      a.display_name,
      a.asset_type,
      COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date) as acquisition_date,
      EXTRACT(DAY FROM NOW() - COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date))::integer as age_in_days,
      EXTRACT(MONTH FROM AGE(NOW(), COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date)))::integer as age_in_months,
      COALESCE(ha.purchase_price, sa.purchase_cost, ea.purchase_cost, 0)::numeric as original_value,
      COALESCE(ha.purchase_price, sa.purchase_cost, ea.purchase_cost, 0)::numeric as current_value,
      CASE 
        WHEN ha.useful_life_months IS NOT NULL
          AND ha.depreciation_start_date IS NOT NULL
          AND EXTRACT(MONTH FROM AGE(NOW(), ha.depreciation_start_date))::integer >= ha.useful_life_months
          THEN 'FULLY_DEPRECIATED'
        WHEN ha.depreciation_method IS NOT NULL AND ha.depreciation_method <> 'NONE' THEN 'ACTIVE'
        ELSE 'NOT_DEPRECIATING'
      END as depreciation_status,
      CASE 
        WHEN ha.useful_life_months IS NOT NULL 
        THEN GREATEST(0, ha.useful_life_months - EXTRACT(MONTH FROM AGE(NOW(), ha.depreciation_start_date))::integer)
        ELSE NULL
      END as remaining_life_months,
      d.name as department,
      NULLIF(CONCAT_WS(' / ',
        NULLIF(TRIM(CASE 
          WHEN a.asset_type = 'HARDWARE' THEN ha.building
          WHEN a.asset_type = 'ENTERPRISE' THEN ea.building
          ELSE NULL
        END), ''),
        NULLIF(TRIM(CASE 
          WHEN a.asset_type = 'HARDWARE' THEN ha.floor
          WHEN a.asset_type = 'ENTERPRISE' THEN ea.floor
          ELSE NULL
        END), ''),
        NULLIF(TRIM(CASE 
          WHEN a.asset_type = 'HARDWARE' THEN ha.room
          WHEN a.asset_type = 'ENTERPRISE' THEN ea.zone
          ELSE NULL
        END), '')
      ), '') as location
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    LEFT JOIN departments d ON ha.department_id = d.department_id
    ${whereClause}
    AND COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date) IS NOT NULL
    ORDER BY age_in_days DESC
  `;

  const rowResults = await queryMany<{
    asset_id: string;
    asset_tag: string;
    display_name: string;
    asset_type: string;
    acquisition_date: string;
    age_in_days: number;
    age_in_months: number;
    original_value: string;
    current_value: string;
    depreciation_status: string;
    remaining_life_months: number | null;
    department: string | null;
    location: string | null;
  }>(rowsQuery, params);

  const rows: AssetAgingRow[] = rowResults.map(row => ({
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    displayName: row.display_name,
    assetType: row.asset_type,
    acquisitionDate: row.acquisition_date,
    ageInDays: row.age_in_days,
    ageInMonths: row.age_in_months,
    originalValue: parseFloat(row.original_value),
    currentValue: parseFloat(row.current_value),
    depreciationStatus: row.depreciation_status as AssetAgingRow['depreciationStatus'],
    remainingLifeMonths: row.remaining_life_months ?? undefined,
    department: row.department ?? undefined,
    location: row.location ?? undefined,
  }));

  // Calculate bucket aggregations
  const buckets: AssetAgingBucket[] = ageBuckets.map(bucket => {
    const assetsInBucket = rows.filter(row => {
      if (bucket.maxMonths === null) {
        return row.ageInMonths >= bucket.minMonths;
      }
      return row.ageInMonths >= bucket.minMonths && row.ageInMonths < bucket.maxMonths;
    });

    return {
      range: bucket.label,
      minMonths: bucket.minMonths,
      maxMonths: bucket.maxMonths,
      count: assetsInBucket.length,
      totalValue: assetsInBucket.reduce((sum, a) => sum + a.originalValue, 0),
      depreciatedValue: assetsInBucket.reduce((sum, a) => sum + a.currentValue, 0),
    };
  });

  logger.debug('Asset aging data retrieved', { totalRows: rows.length, bucketCount: buckets.length });

  return { buckets, rows };
}

/**
 * Default age buckets for aging reports
 */
const DEFAULT_AGE_BUCKETS: readonly { minMonths: number; maxMonths: number | null; label: string }[] = [
  { minMonths: 0, maxMonths: 12, label: '0-12 months' },
  { minMonths: 12, maxMonths: 24, label: '1-2 years' },
  { minMonths: 24, maxMonths: 36, label: '2-3 years' },
  { minMonths: 36, maxMonths: 48, label: '3-4 years' },
  { minMonths: 48, maxMonths: 60, label: '4-5 years' },
  { minMonths: 60, maxMonths: null, label: '5+ years' },
];

// ============================================================================
// Asset by Location Report Data
// ============================================================================

/**
 * Get assets grouped by location hierarchy
 * Requirement 18.3: Return assets grouped by building, floor, and room hierarchy
 */
export async function getAssetsByLocationData(
  filters: AssetReportFilters
): Promise<readonly LocationBuildingData[]> {
  logger.debug('Getting assets by location data', { filters });

  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Note: hardware_assets uses string location columns (building/floor/room) in V002.
  // For report stability, derive location hierarchy from those strings (and enterprise_assets building/floor/zone)
  // rather than joining normalized location tables.
  const query = `
    WITH loc AS (
      SELECT
        COALESCE(
          NULLIF(TRIM(CASE
            WHEN a.asset_type = 'HARDWARE' THEN ha.building
            WHEN a.asset_type = 'ENTERPRISE' THEN ea.building
            ELSE NULL
          END), ''),
          'Unassigned'
        ) AS building_name,
        COALESCE(
          NULLIF(TRIM(CASE
            WHEN a.asset_type = 'HARDWARE' THEN ha.floor
            WHEN a.asset_type = 'ENTERPRISE' THEN ea.floor
            ELSE NULL
          END), ''),
          'Unassigned'
        ) AS floor_name,
        COALESCE(
          NULLIF(TRIM(CASE
            WHEN a.asset_type = 'HARDWARE' THEN ha.room
            WHEN a.asset_type = 'ENTERPRISE' THEN ea.zone
            ELSE NULL
          END), ''),
          'Unassigned'
        ) AS room_name,
        CASE
          WHEN a.asset_type = 'HARDWARE' THEN COALESCE(ha.purchase_price, 0)
          WHEN a.asset_type = 'SOFTWARE' THEN COALESCE(sa.purchase_cost, 0)
          WHEN a.asset_type = 'ENTERPRISE' THEN COALESCE(ea.purchase_cost, 0)
          ELSE 0
        END::numeric AS asset_value
      FROM assets a
      LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
      LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
      LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
      ${whereClause}
    )
    SELECT
      building_name,
      floor_name,
      room_name,
      COUNT(*)::integer AS asset_count,
      COALESCE(SUM(asset_value), 0)::numeric AS total_value
    FROM loc
    GROUP BY building_name, floor_name, room_name
    ORDER BY building_name, floor_name, room_name
  `;

  const results = await queryMany<{
    building_name: string;
    floor_name: string;
    room_name: string;
    asset_count: number;
    total_value: string;
  }>(query, params);

  // Transform flat results into hierarchical structure
  const buildingsMap = new Map<string, LocationBuildingData>();

  for (const row of results) {
    const buildingKey = row.building_name;
    if (!buildingsMap.has(buildingKey)) {
      buildingsMap.set(buildingKey, {
        buildingId: `building-${buildingKey}`,
        buildingName: row.building_name,
        buildingCode: row.building_name,
        totalAssets: 0,
        totalValue: 0,
        floors: [],
      });
    }

    const building = buildingsMap.get(buildingKey)!;
    const floorKey = row.floor_name;

    let floor = (building.floors as LocationFloorData[]).find(f => f.floorName === floorKey);
    if (!floor) {
      floor = {
        floorId: `floor-${buildingKey}-${floorKey}`,
        floorName: floorKey,
        floorNumber: 0,
        totalAssets: 0,
        totalValue: 0,
        rooms: [],
      };
      (building.floors as LocationFloorData[]).push(floor);
    }

    (floor.rooms as LocationRoomData[]).push({
      roomId: `room-${buildingKey}-${floorKey}-${row.room_name}`,
      roomName: row.room_name,
      roomNumber: row.room_name,
      assetCount: row.asset_count,
      totalValue: parseFloat(row.total_value),
    });

    (floor as { totalAssets: number }).totalAssets += row.asset_count;
    (floor as { totalValue: number }).totalValue += parseFloat(row.total_value);
  }

  // Calculate building-level totals
  for (const building of buildingsMap.values()) {
    let totalAssets = 0;
    let totalValue = 0;
    for (const floor of building.floors) {
      totalAssets += floor.totalAssets;
      totalValue += floor.totalValue;
    }
    (building as { totalAssets: number }).totalAssets = totalAssets;
    (building as { totalValue: number }).totalValue = totalValue;
  }

  const buildings = Array.from(buildingsMap.values());

  logger.debug('Assets by location data retrieved', { buildingCount: buildings.length });

  return buildings;
}

// ============================================================================
// Asset by Department Report Data
// ============================================================================

/**
 * Get assets grouped by department
 * Requirement 18.4: Return assets grouped by department with cost allocation
 */
export async function getAssetsByDepartmentData(
  filters: AssetReportFilters
): Promise<readonly DepartmentAssetData[]> {
  logger.debug('Getting assets by department data', { filters });

  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get department-level summary
  const summaryQuery = `
    SELECT 
      d.department_id,
      d.code as department_code,
      d.name as department_name,
      COUNT(a.asset_id)::integer as total_assets,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM departments d
    LEFT JOIN hardware_assets ha ON d.department_id = ha.department_id
    LEFT JOIN assets a ON ha.asset_id = a.asset_id
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
    AND d.is_active = true
    GROUP BY d.department_id, d.code, d.name
    HAVING COUNT(a.asset_id) > 0
    ORDER BY total_assets DESC
  `;

  const summaryResults = await queryMany<{
    department_id: string;
    department_code: string;
    department_name: string;
    total_assets: number;
    total_value: string;
  }>(summaryQuery, params);

  // Get breakdown by asset type for each department
  const byTypeQuery = `
    SELECT 
      d.department_id,
      a.asset_type as category,
      COUNT(a.asset_id)::integer as count,
      COALESCE(SUM(CASE 
        WHEN a.asset_type = 'HARDWARE' THEN ha.purchase_price
        WHEN a.asset_type = 'SOFTWARE' THEN sa.purchase_cost
        WHEN a.asset_type = 'ENTERPRISE' THEN ea.purchase_cost
        ELSE 0
      END), 0)::numeric as total_value
    FROM departments d
    LEFT JOIN hardware_assets ha ON d.department_id = ha.department_id
    LEFT JOIN assets a ON ha.asset_id = a.asset_id
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
    AND d.is_active = true
    AND a.asset_id IS NOT NULL
    GROUP BY d.department_id, a.asset_type
    ORDER BY d.department_id, count DESC
  `;

  const byTypeResults = await queryMany<{
    department_id: string;
    category: string;
    count: number;
    total_value: string;
  }>(byTypeQuery, params);

  // Combine results
  const departments: DepartmentAssetData[] = summaryResults.map(dept => {
    const typeBreakdown = byTypeResults
      .filter(t => t.department_id === dept.department_id)
      .map(t => ({
        category: t.category,
        count: t.count,
        totalValue: parseFloat(t.total_value),
        percentage: dept.total_assets > 0 
          ? Math.round((t.count / dept.total_assets) * 10000) / 100 
          : 0,
      }));

    return {
      departmentId: dept.department_id,
      departmentCode: dept.department_code,
      departmentName: dept.department_name,
      totalAssets: dept.total_assets,
      totalValue: parseFloat(dept.total_value),
      byType: typeBreakdown,
    };
  });

  logger.debug('Assets by department data retrieved', { departmentCount: departments.length });

  return departments;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build filter conditions for queries
 */
function buildFilterConditions(
  filters: AssetReportFilters
): { conditions: string[]; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.assetType && filters.assetType !== 'ALL') {
    conditions.push(`a.asset_type = $${paramIndex++}`);
    params.push(filters.assetType);
  }

  if (filters.assetStatus && filters.assetStatus !== 'ALL') {
    conditions.push(`a.status = $${paramIndex++}`);
    params.push(filters.assetStatus);
  }

  if (filters.departmentId) {
    conditions.push(`ha.department_id = $${paramIndex++}`);
    params.push(filters.departmentId);
  }

  if (filters.costCenterId) {
    conditions.push(`ha.cost_center_id = $${paramIndex++}`);
    params.push(filters.costCenterId);
  }

  if (filters.manufacturerId) {
    conditions.push(`ha.manufacturer_id = $${paramIndex++}`);
    params.push(filters.manufacturerId);
  }

  if (filters.modelId) {
    conditions.push(`ha.model_id = $${paramIndex++}`);
    params.push(filters.modelId);
  }

  if (filters.dateFrom) {
    conditions.push(`COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date) >= $${paramIndex++}`);
    params.push(filters.dateFrom);
  }

  if (filters.dateTo) {
    conditions.push(`COALESCE(ha.received_date, sa.acquisition_date, ea.acquisition_date) <= $${paramIndex++}`);
    params.push(filters.dateTo);
  }

  if (!filters.includeInactive) {
    conditions.push("a.status != 'DISPOSED'");
  }

  return { conditions, params };
}

/**
 * Get total asset count with filters
 */
export async function getTotalAssetCount(filters: AssetReportFilters): Promise<number> {
  const { conditions, params } = buildFilterConditions(filters);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT COUNT(*)::integer as count
    FROM assets a
    LEFT JOIN hardware_assets ha ON a.asset_id = ha.asset_id AND a.asset_type = 'HARDWARE'
    LEFT JOIN software_assets sa ON a.asset_id = sa.asset_id AND a.asset_type = 'SOFTWARE'
    LEFT JOIN enterprise_assets ea ON a.asset_id = ea.asset_id AND a.asset_type = 'ENTERPRISE'
    ${whereClause}
  `;

  const result = await queryOne<{ count: number }>(query, params);
  return result?.count ?? 0;
}
