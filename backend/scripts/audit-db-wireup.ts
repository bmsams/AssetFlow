/**
 * Enterprise audit DB reconciliation harness.
 *
 * - Executes SQL checks under scripts/sql/audit.
 * - Uses direct PostgreSQL query path first.
 * - Falls back to Aurora Data API when direct connectivity is unavailable.
 *
 * Usage:
 *   AUDIT_RUN_ID=<id> npm --prefix backend run audit:db:wiring
 *   npm --prefix backend run audit:db:wiring
 *
 * Optional:
 *   AUDIT_DB_FORCE_DATA_API=1      Force Data API mode
 *   DB_SECRET_ARN                  Data API secret ARN
 *   DB_CLUSTER_ARN or DB_CLUSTER_ID Data API cluster
 *   DB_NAME                        Database name (default assetmgmt)
 *   AWS_REGION                     Region for AWS CLI commands
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { closePool, query } from '@ams/database';

import { resolveExistingRunContext, writeAuditArtifact } from './audit-run-context';

type QueryRow = Record<string, unknown>;

interface SqlExecutor {
  readonly mode: 'direct' | 'data-api';
  execute(sql: string): Promise<QueryRow[]>;
  close(): Promise<void>;
}

interface DataApiField {
  readonly stringValue?: string;
  readonly longValue?: number;
  readonly doubleValue?: number;
  readonly booleanValue?: boolean;
  readonly isNull?: boolean;
}

interface DataApiColumn {
  readonly name?: string;
}

interface DataApiResult {
  readonly records?: DataApiField[][];
  readonly columnMetadata?: DataApiColumn[];
}

interface ReconciliationCheckResult {
  readonly file: string;
  readonly checkName: string;
  readonly pass: boolean;
  readonly detail: string;
  readonly row: QueryRow;
}

function runAwsJson(args: string[]): unknown {
  const output = execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  return JSON.parse(output);
}

function runAwsText(args: string[]): string {
  return execFileSync('aws', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  }).trim();
}

function resolveClusterArn(): string {
  const explicitArn = process.env['DB_CLUSTER_ARN'];
  if (typeof explicitArn === 'string' && explicitArn.trim().length > 0) {
    return explicitArn.trim();
  }

  const clusterId =
    process.env['DB_CLUSTER_ID']?.trim() ||
    'ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn';

  return runAwsText([
    'rds',
    'describe-db-clusters',
    '--db-cluster-identifier',
    clusterId.trim(),
    '--query',
    'DBClusters[0].DBClusterArn',
    '--output',
    'text',
  ]);
}

function fieldValue(field: DataApiField | undefined): unknown {
  if (!field || field.isNull) {
    return null;
  }
  if (typeof field.stringValue === 'string') {
    return field.stringValue;
  }
  if (typeof field.longValue === 'number') {
    return field.longValue;
  }
  if (typeof field.doubleValue === 'number') {
    return field.doubleValue;
  }
  if (typeof field.booleanValue === 'boolean') {
    return field.booleanValue;
  }
  return null;
}

class DirectExecutor implements SqlExecutor {
  public readonly mode = 'direct' as const;

  public async execute(sql: string): Promise<QueryRow[]> {
    const result = await query(sql);
    return result.rows as QueryRow[];
  }

  public async close(): Promise<void> {
    await closePool();
  }
}

class DataApiExecutor implements SqlExecutor {
  public readonly mode = 'data-api' as const;
  private readonly clusterArn: string;
  private readonly secretArn: string;
  private readonly database: string;

  public constructor() {
    const secretArn = process.env['DB_SECRET_ARN'];
    if (typeof secretArn !== 'string' || secretArn.trim().length === 0) {
      throw new Error('Set DB_SECRET_ARN to enable Data API mode');
    }

    this.clusterArn = resolveClusterArn();
    this.secretArn = secretArn.trim();
    this.database = process.env['DB_NAME']?.trim() || 'assetmgmt';
  }

  public async execute(sql: string): Promise<QueryRow[]> {
    const result = runAwsJson([
      'rds-data',
      'execute-statement',
      '--resource-arn',
      this.clusterArn,
      '--secret-arn',
      this.secretArn,
      '--database',
      this.database,
      '--sql',
      sql,
      '--include-result-metadata',
      '--output',
      'json',
    ]) as DataApiResult;

    const records = result.records ?? [];
    const metadata = result.columnMetadata ?? [];
    return records.map((record) => {
      const row: QueryRow = {};
      for (let index = 0; index < record.length; index += 1) {
        const columnName = metadata[index]?.name ?? `column_${String(index + 1)}`;
        row[columnName] = fieldValue(record[index]);
      }
      return row;
    });
  }

  public async close(): Promise<void> {
    return Promise.resolve();
  }
}

function escapeSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderSqlTemplate(rawSql: string, context: {
  readonly auditRunId: string;
  readonly auditRunKey: string;
  readonly marker: string;
  readonly auditRunUuid: string;
}): string {
  return rawSql
    .replace(/\{\{AUDIT_RUN_ID\}\}/g, escapeSqlLiteral(context.auditRunId))
    .replace(/\{\{AUDIT_RUN_KEY\}\}/g, escapeSqlLiteral(context.auditRunKey))
    .replace(/\{\{AUDIT_RUN_UUID\}\}/g, escapeSqlLiteral(context.auditRunUuid))
    .replace(/\{\{AUDIT_MARKER\}\}/g, escapeSqlLiteral(context.marker));
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return ['true', 't', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }
  return false;
}

async function resolveExecutor(): Promise<SqlExecutor> {
  const forceDataApi = process.env['AUDIT_DB_FORCE_DATA_API'] === '1';
  const preferDataApi =
    process.env['AUDIT_DB_PREFER_DATA_API'] === '1' ||
    (typeof process.env['DB_SECRET_ARN'] === 'string' &&
      process.env['DB_SECRET_ARN'].trim().length > 0 &&
      (!process.env['DB_HOST'] || process.env['DB_HOST'].trim().length === 0));

  if (forceDataApi || preferDataApi) {
    return new DataApiExecutor();
  }

  try {
    await query('SELECT 1');
    return new DirectExecutor();
  } catch (directError: unknown) {
    await closePool().catch(() => undefined);
    console.warn('[audit-db-wireup] direct DB access unavailable, trying Data API fallback');
    try {
      return new DataApiExecutor();
    } catch (fallbackError: unknown) {
      const directMessage = directError instanceof Error ? directError.message : String(directError);
      const fallbackMessage =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(
        `Unable to create SQL executor. direct=${directMessage}; data-api=${fallbackMessage}`
      );
    }
  }
}

async function runChecks(executor: SqlExecutor, sqlDir: string, context: {
  readonly auditRunId: string;
  readonly auditRunKey: string;
  readonly marker: string;
  readonly auditRunUuid: string;
}): Promise<ReconciliationCheckResult[]> {
  const sqlFiles = fs
    .readdirSync(sqlDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (sqlFiles.length === 0) {
    throw new Error(`No SQL checks found in ${sqlDir}`);
  }

  const results: ReconciliationCheckResult[] = [];
  for (const file of sqlFiles) {
    const sqlPath = path.resolve(sqlDir, file);
    const rawSql = fs.readFileSync(sqlPath, 'utf8');
    const renderedSql = renderSqlTemplate(rawSql, context);

    try {
      const rows = await executor.execute(renderedSql);
      const row = rows[0] ?? {};
      const checkName = String(row['check_name'] ?? file.replace(/\.sql$/i, ''));
      const pass = toBoolean(row['check_pass']);
      const detail = String(row['detail'] ?? JSON.stringify(row));
      results.push({
        file,
        checkName,
        pass,
        detail,
        row,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        file,
        checkName: file.replace(/\.sql$/i, ''),
        pass: false,
        detail: `execution_error: ${message}`,
        row: {},
      });
    }
  }

  return results;
}

async function main(): Promise<void> {
  const context = resolveExistingRunContext();
  const executor = await resolveExecutor();
  const sqlDir = path.resolve(__dirname, 'sql', 'audit');

  let results: ReconciliationCheckResult[] = [];
  try {
    results = await runChecks(executor, sqlDir, context);
  } finally {
    await executor.close();
  }

  const failed = results.filter((entry) => !entry.pass);
  const passed = results.filter((entry) => entry.pass);

  const report = {
    generatedAt: new Date().toISOString(),
    auditRunId: context.auditRunId,
    auditRunKey: context.auditRunKey,
    auditRunUuid: context.auditRunUuid,
    marker: context.marker,
    dbMode: executor.mode,
    totalChecks: results.length,
    passedChecks: passed.length,
    failedChecks: failed.length,
    checks: results,
  };

  const artifacts = writeAuditArtifact('wireup', report, context.auditRunKey);
  console.log(
    `[audit-db-wireup] completed checks=${results.length} passed=${passed.length} failed=${failed.length} mode=${executor.mode}`
  );
  if (artifacts.byRunPath) {
    console.log(`[audit-db-wireup] artifact: ${artifacts.byRunPath}`);
  }

  if (failed.length > 0) {
    throw new Error(`DB reconciliation failed (${failed.length} checks failed)`);
  }
}

main().catch((error: unknown) => {
  console.error('[audit-db-wireup] failed', error);
  process.exitCode = 1;
});
