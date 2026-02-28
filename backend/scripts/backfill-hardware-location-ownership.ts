#!/usr/bin/env npx ts-node
/**
 * WS4 backfill script for hardware location + ownership normalization.
 *
 * Safe defaults:
 * - Dry-run by default (all updates are rolled back).
 * - Use --apply to commit updates.
 *
 * Usage:
 *   npm run db:backfill:hardware-location-ownership
 *   npm run db:backfill:hardware-location-ownership -- --apply
 *   npm run db:backfill:hardware-location-ownership -- --apply --updated-by=<user-uuid>
 */

import type { PoolClient } from 'pg';

import { closePool, getClient } from '@ams/database';

interface ScriptOptions {
  readonly apply: boolean;
  readonly updatedBy: string | null;
  readonly sampleLimit: number;
}

interface HardwareMetrics {
  readonly totalHardwareAssets: number;
  readonly missingBuilding: number;
  readonly missingDepartment: number;
  readonly missingCostCenter: number;
  readonly missingOwnership: number;
}

interface RuleResult {
  readonly name: string;
  readonly updatedRows: number;
  readonly skipped: boolean;
  readonly reason?: string;
}

interface TouchedAssetSample {
  readonly asset_id: string;
  readonly asset_tag: string | null;
  readonly building: string | null;
  readonly stockroom_id: string | null;
  readonly assigned_to: string | null;
  readonly department_id: string | null;
  readonly cost_center_id: string | null;
}

interface SchemaInfo {
  readonly tables: Set<string>;
  readonly columnsByTable: Map<string, Set<string>>;
}

interface RuleDefinition {
  readonly name: string;
  readonly sql: string;
  readonly enabled: boolean;
  readonly skipReason?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function printUsage(): void {
  console.log('Usage:');
  console.log('  npm run db:backfill:hardware-location-ownership');
  console.log('  npm run db:backfill:hardware-location-ownership -- --apply');
  console.log(
    '  npm run db:backfill:hardware-location-ownership -- --apply --updated-by=<user-uuid>'
  );
  console.log('  npm run db:backfill:hardware-location-ownership -- --sample-limit=25');
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

function parseIntegerOption(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseOptions(argv: readonly string[]): ScriptOptions | null {
  let apply = false;
  let updatedBy: string | null = null;
  let sampleLimit = 20;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      return null;
    }
    if (arg === '--apply') {
      apply = true;
      continue;
    }
    if (arg.startsWith('--updated-by=')) {
      const raw = arg.slice('--updated-by='.length).trim();
      if (!raw) {
        throw new Error('Invalid --updated-by value: expected UUID');
      }
      if (!isValidUuid(raw)) {
        throw new Error(`Invalid --updated-by value: "${raw}" is not a UUID`);
      }
      updatedBy = raw;
      continue;
    }
    if (arg.startsWith('--sample-limit=')) {
      const raw = arg.slice('--sample-limit='.length).trim();
      sampleLimit = parseIntegerOption(raw, 20);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { apply, updatedBy, sampleLimit };
}

function hasTable(schema: SchemaInfo, tableName: string): boolean {
  return schema.tables.has(tableName);
}

function hasColumn(schema: SchemaInfo, tableName: string, columnName: string): boolean {
  const columns = schema.columnsByTable.get(tableName);
  if (!columns) {
    return false;
  }
  return columns.has(columnName);
}

async function loadSchemaInfo(client: PoolClient): Promise<SchemaInfo> {
  const expectedTables = [
    'assets',
    'hardware_assets',
    'users',
    'departments',
    'cost_centers',
    'stockrooms',
    'buildings',
  ];

  const result = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])`,
    [expectedTables]
  );

  const tables = new Set<string>();
  const columnsByTable = new Map<string, Set<string>>();

  for (const row of result.rows) {
    tables.add(row.table_name);
    const existing = columnsByTable.get(row.table_name);
    if (existing) {
      existing.add(row.column_name);
    } else {
      columnsByTable.set(row.table_name, new Set([row.column_name]));
    }
  }

  return { tables, columnsByTable };
}

function parseCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed;
}

async function queryHardwareMetrics(client: PoolClient): Promise<HardwareMetrics> {
  const result = await client.query<{
    total_hardware_assets: string;
    missing_building: string;
    missing_department: string;
    missing_cost_center: string;
    missing_ownership: string;
  }>(
    `SELECT
       COUNT(*)::text AS total_hardware_assets,
       COUNT(*) FILTER (WHERE building IS NULL OR BTRIM(building) = '')::text AS missing_building,
       COUNT(*) FILTER (WHERE department_id IS NULL)::text AS missing_department,
       COUNT(*) FILTER (WHERE cost_center_id IS NULL)::text AS missing_cost_center,
       COUNT(*) FILTER (WHERE department_id IS NULL AND cost_center_id IS NULL)::text AS missing_ownership
     FROM hardware_assets`
  );

  const row = result.rows[0];
  if (!row) {
    return {
      totalHardwareAssets: 0,
      missingBuilding: 0,
      missingDepartment: 0,
      missingCostCenter: 0,
      missingOwnership: 0,
    };
  }

  return {
    totalHardwareAssets: parseCount(row.total_hardware_assets),
    missingBuilding: parseCount(row.missing_building),
    missingDepartment: parseCount(row.missing_department),
    missingCostCenter: parseCount(row.missing_cost_center),
    missingOwnership: parseCount(row.missing_ownership),
  };
}

function printMetrics(label: string, metrics: HardwareMetrics): void {
  console.log(`${label}:`);
  console.log(`  total_hardware_assets: ${metrics.totalHardwareAssets}`);
  console.log(`  missing_building: ${metrics.missingBuilding}`);
  console.log(`  missing_department: ${metrics.missingDepartment}`);
  console.log(`  missing_cost_center: ${metrics.missingCostCenter}`);
  console.log(`  missing_ownership(dept+cc): ${metrics.missingOwnership}`);
}

async function runUpdateRule(
  client: PoolClient,
  definition: RuleDefinition
): Promise<RuleResult> {
  if (!definition.enabled) {
    return {
      name: definition.name,
      updatedRows: 0,
      skipped: true,
      reason: definition.skipReason ?? 'Rule prerequisites not satisfied',
    };
  }

  const result = await client.query<{ asset_id: string }>(definition.sql);
  const updatedRows = result.rows.length;

  if (updatedRows > 0) {
    await client.query(
      `INSERT INTO backfill_touched_assets (asset_id)
       SELECT DISTINCT UNNEST($1::uuid[])
       ON CONFLICT (asset_id) DO NOTHING`,
      [result.rows.map((row) => row.asset_id)]
    );
  }

  return {
    name: definition.name,
    updatedRows,
    skipped: false,
  };
}

function buildRuleDefinitions(schema: SchemaInfo): RuleDefinition[] {
  const canUseHardwareBuilding =
    hasTable(schema, 'hardware_assets') &&
    hasColumn(schema, 'hardware_assets', 'asset_id') &&
    hasColumn(schema, 'hardware_assets', 'stockroom_id') &&
    hasColumn(schema, 'hardware_assets', 'building');

  const canUseStockrooms =
    hasTable(schema, 'stockrooms') &&
    hasColumn(schema, 'stockrooms', 'stockroom_id');

  const canUseBuildings =
    hasTable(schema, 'buildings') &&
    hasColumn(schema, 'buildings', 'building_id') &&
    (hasColumn(schema, 'buildings', 'building_code') || hasColumn(schema, 'buildings', 'name'));

  const canUseUsersForDept =
    hasTable(schema, 'hardware_assets') &&
    hasColumn(schema, 'hardware_assets', 'asset_id') &&
    hasColumn(schema, 'hardware_assets', 'assigned_to') &&
    hasColumn(schema, 'hardware_assets', 'department_id') &&
    hasTable(schema, 'users') &&
    hasColumn(schema, 'users', 'user_id') &&
    hasColumn(schema, 'users', 'department_id');

  const canUseStockroomCostCenter =
    hasTable(schema, 'hardware_assets') &&
    hasColumn(schema, 'hardware_assets', 'asset_id') &&
    hasColumn(schema, 'hardware_assets', 'stockroom_id') &&
    hasColumn(schema, 'hardware_assets', 'cost_center_id') &&
    hasTable(schema, 'stockrooms') &&
    hasColumn(schema, 'stockrooms', 'stockroom_id') &&
    hasColumn(schema, 'stockrooms', 'cost_center_id');

  const canUseCostCenterDepartment =
    hasTable(schema, 'hardware_assets') &&
    hasColumn(schema, 'hardware_assets', 'asset_id') &&
    hasColumn(schema, 'hardware_assets', 'cost_center_id') &&
    hasColumn(schema, 'hardware_assets', 'department_id') &&
    hasTable(schema, 'cost_centers') &&
    hasColumn(schema, 'cost_centers', 'cost_center_id') &&
    hasColumn(schema, 'cost_centers', 'department_id');

  const canUseDepartmentCostCenterFallback =
    hasTable(schema, 'hardware_assets') &&
    hasColumn(schema, 'hardware_assets', 'asset_id') &&
    hasColumn(schema, 'hardware_assets', 'department_id') &&
    hasColumn(schema, 'hardware_assets', 'cost_center_id') &&
    hasTable(schema, 'cost_centers') &&
    hasColumn(schema, 'cost_centers', 'department_id') &&
    hasColumn(schema, 'cost_centers', 'cost_center_id');

  const rules: RuleDefinition[] = [
    {
      name: 'building from stockrooms.building_id -> buildings(building_code/name)',
      enabled:
        canUseHardwareBuilding &&
        canUseStockrooms &&
        canUseBuildings &&
        hasColumn(schema, 'stockrooms', 'building_id'),
      skipReason: 'Missing stockrooms/buildings linkage columns',
      sql: `
        UPDATE hardware_assets ha
        SET building = src.building_value
        FROM (
          SELECT
            s.stockroom_id,
            COALESCE(NULLIF(BTRIM(b.building_code), ''), NULLIF(BTRIM(b.name), '')) AS building_value
          FROM stockrooms s
          JOIN buildings b ON b.building_id = s.building_id
        ) src
        WHERE ha.stockroom_id = src.stockroom_id
          AND (ha.building IS NULL OR BTRIM(ha.building) = '')
          AND src.building_value IS NOT NULL
        RETURNING ha.asset_id`,
    },
    {
      name: 'building from stockrooms.building (fallback text source)',
      enabled:
        canUseHardwareBuilding &&
        canUseStockrooms &&
        hasColumn(schema, 'stockrooms', 'building'),
      skipReason: 'Missing stockrooms.building text column',
      sql: `
        UPDATE hardware_assets ha
        SET building = NULLIF(BTRIM(s.building), '')
        FROM stockrooms s
        WHERE ha.stockroom_id = s.stockroom_id
          AND (ha.building IS NULL OR BTRIM(ha.building) = '')
          AND s.building IS NOT NULL
          AND BTRIM(s.building) <> ''
        RETURNING ha.asset_id`,
    },
    {
      name: 'canonicalize hardware_assets.building to building master code/name',
      enabled: canUseHardwareBuilding && canUseBuildings,
      skipReason: 'Missing hardware_assets.building or buildings master data',
      sql: `
        WITH building_keys AS (
          SELECT DISTINCT ON (LOWER(BTRIM(key_name)))
            LOWER(BTRIM(key_name)) AS key_norm,
            COALESCE(NULLIF(BTRIM(b.building_code), ''), NULLIF(BTRIM(b.name), '')) AS canonical_building
          FROM buildings b
          CROSS JOIN LATERAL (VALUES (b.building_code), (b.name)) AS keys(key_name)
          WHERE key_name IS NOT NULL
            AND BTRIM(key_name) <> ''
            AND COALESCE(NULLIF(BTRIM(b.building_code), ''), NULLIF(BTRIM(b.name), '')) IS NOT NULL
          ORDER BY LOWER(BTRIM(key_name)), b.building_code NULLS LAST, b.name NULLS LAST
        )
        UPDATE hardware_assets ha
        SET building = bk.canonical_building
        FROM building_keys bk
        WHERE ha.building IS NOT NULL
          AND BTRIM(ha.building) <> ''
          AND LOWER(BTRIM(ha.building)) = bk.key_norm
          AND ha.building IS DISTINCT FROM bk.canonical_building
        RETURNING ha.asset_id`,
    },
    {
      name: 'department_id from assigned user',
      enabled: canUseUsersForDept,
      skipReason: 'Missing hardware_assets/users ownership columns',
      sql: `
        UPDATE hardware_assets ha
        SET department_id = u.department_id
        FROM users u
        WHERE ha.assigned_to = u.user_id
          AND ha.department_id IS NULL
          AND u.department_id IS NOT NULL
        RETURNING ha.asset_id`,
    },
    {
      name: 'cost_center_id from stockroom',
      enabled: canUseStockroomCostCenter,
      skipReason: 'Missing stockroom cost center linkage columns',
      sql: `
        UPDATE hardware_assets ha
        SET cost_center_id = s.cost_center_id
        FROM stockrooms s
        WHERE ha.stockroom_id = s.stockroom_id
          AND ha.cost_center_id IS NULL
          AND s.cost_center_id IS NOT NULL
        RETURNING ha.asset_id`,
    },
    {
      name: 'department_id from cost_center.department_id',
      enabled: canUseCostCenterDepartment,
      skipReason: 'Missing cost_center -> department linkage columns',
      sql: `
        UPDATE hardware_assets ha
        SET department_id = cc.department_id
        FROM cost_centers cc
        WHERE ha.cost_center_id = cc.cost_center_id
          AND ha.department_id IS NULL
          AND cc.department_id IS NOT NULL
        RETURNING ha.asset_id`,
    },
    {
      name: 'cost_center_id fallback from department (deterministic min uuid)',
      enabled: canUseDepartmentCostCenterFallback,
      skipReason: 'Missing department/cost_center fallback columns',
      sql: `
        WITH department_default_cost_center AS (
          SELECT
            cc.department_id,
            MIN(cc.cost_center_id) AS fallback_cost_center_id
          FROM cost_centers cc
          WHERE cc.department_id IS NOT NULL
          GROUP BY cc.department_id
        )
        UPDATE hardware_assets ha
        SET cost_center_id = dcc.fallback_cost_center_id
        FROM department_default_cost_center dcc
        WHERE ha.department_id = dcc.department_id
          AND ha.cost_center_id IS NULL
          AND dcc.fallback_cost_center_id IS NOT NULL
        RETURNING ha.asset_id`,
    },
  ];

  return rules;
}

async function syncAssetsTouchedTimestamp(
  client: PoolClient,
  schema: SchemaInfo,
  updatedBy: string | null
): Promise<number> {
  const hasAssets = hasTable(schema, 'assets') && hasColumn(schema, 'assets', 'asset_id');
  const hasUpdatedAt = hasColumn(schema, 'assets', 'updated_at');
  const hasUpdatedBy = hasColumn(schema, 'assets', 'updated_by');

  if (!hasAssets || !hasUpdatedAt) {
    return 0;
  }

  if (hasUpdatedBy) {
    const result = await client.query(
      `UPDATE assets a
       SET updated_at = NOW(),
           updated_by = COALESCE($1::uuid, a.updated_by)
       FROM backfill_touched_assets t
       WHERE a.asset_id = t.asset_id`,
      [updatedBy]
    );
    return result.rowCount ?? 0;
  }

  const result = await client.query(
    `UPDATE assets a
     SET updated_at = NOW()
     FROM backfill_touched_assets t
     WHERE a.asset_id = t.asset_id`
  );
  return result.rowCount ?? 0;
}

async function countTouchedAssets(client: PoolClient): Promise<number> {
  const result = await client.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM backfill_touched_assets'
  );
  return parseCount(result.rows[0]?.count ?? '0');
}

async function loadTouchedAssetSamples(
  client: PoolClient,
  sampleLimit: number
): Promise<readonly TouchedAssetSample[]> {
  const result = await client.query<TouchedAssetSample>(
    `SELECT
       ha.asset_id,
       a.asset_tag,
       ha.building,
       ha.stockroom_id::text AS stockroom_id,
       ha.assigned_to::text AS assigned_to,
       ha.department_id::text AS department_id,
       ha.cost_center_id::text AS cost_center_id
     FROM backfill_touched_assets t
     JOIN hardware_assets ha ON ha.asset_id = t.asset_id
     LEFT JOIN assets a ON a.asset_id = ha.asset_id
     ORDER BY a.asset_tag ASC NULLS LAST, ha.asset_id ASC
     LIMIT $1`,
    [sampleLimit]
  );
  return result.rows;
}

function printRuleSummary(ruleResults: readonly RuleResult[]): void {
  console.log('Rule summary:');
  for (const rule of ruleResults) {
    if (rule.skipped) {
      console.log(`  - ${rule.name}: skipped (${rule.reason})`);
    } else {
      console.log(`  - ${rule.name}: updated ${rule.updatedRows}`);
    }
  }
}

function printTouchedSamples(samples: readonly TouchedAssetSample[]): void {
  if (samples.length === 0) {
    console.log('Touched sample rows: none');
    return;
  }

  console.log('Touched sample rows:');
  for (const row of samples) {
    console.log(
      `  - asset_tag=${row.asset_tag ?? '<null>'}, asset_id=${row.asset_id}, building=${row.building ?? '<null>'}, department_id=${row.department_id ?? '<null>'}, cost_center_id=${row.cost_center_id ?? '<null>'}, stockroom_id=${row.stockroom_id ?? '<null>'}, assigned_to=${row.assigned_to ?? '<null>'}`
    );
  }
}

async function runBackfill(options: ScriptOptions): Promise<void> {
  const client = await getClient();
  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const schema = await loadSchemaInfo(client);
    if (!hasTable(schema, 'hardware_assets')) {
      console.log('hardware_assets table not found; no backfill actions performed.');
      if (options.apply) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }
      transactionOpen = false;
      return;
    }

    await client.query(
      'CREATE TEMP TABLE backfill_touched_assets (asset_id uuid PRIMARY KEY) ON COMMIT DROP'
    );

    const beforeMetrics = await queryHardwareMetrics(client);
    const rules = buildRuleDefinitions(schema);
    const ruleResults: RuleResult[] = [];

    for (const rule of rules) {
      const result = await runUpdateRule(client, rule);
      ruleResults.push(result);
    }

    const touchedCount = await countTouchedAssets(client);
    const touchedAssetRowsUpdated = await syncAssetsTouchedTimestamp(
      client,
      schema,
      options.updatedBy
    );
    const afterMetrics = await queryHardwareMetrics(client);
    const sampleRows = await loadTouchedAssetSamples(client, options.sampleLimit);

    printMetrics('Before', beforeMetrics);
    printMetrics('After', afterMetrics);
    printRuleSummary(ruleResults);
    console.log(`Touched hardware assets: ${touchedCount}`);
    console.log(`Assets timestamp rows updated: ${touchedAssetRowsUpdated}`);
    printTouchedSamples(sampleRows);

    if (options.apply) {
      await client.query('COMMIT');
      transactionOpen = false;
      console.log('Backfill committed (--apply set).');
    } else {
      await client.query('ROLLBACK');
      transactionOpen = false;
      console.log('Dry-run complete (transaction rolled back).');
      console.log('Re-run with --apply to persist these changes.');
    }
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    return;
  }

  console.log('='.repeat(72));
  console.log('WS4 Hardware Location/Ownership Backfill');
  console.log('='.repeat(72));
  console.log(`Mode: ${options.apply ? 'apply (commit)' : 'dry-run (rollback)'}`);
  console.log(`Sample limit: ${options.sampleLimit}`);
  console.log(`Updated by override: ${options.updatedBy ?? '<unchanged>'}`);

  await runBackfill(options);
}

main()
  .catch((error: unknown) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
