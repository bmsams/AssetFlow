import { execFileSync } from 'node:child_process';

import {
  closePool as closeDirectPool,
  query as directQuery,
} from '@ams/database';

type QueryResultRow = Record<string, unknown>;

interface QueryResultLike<T extends QueryResultRow = QueryResultRow> {
  readonly rows: T[];
  readonly rowCount: number | null;
}

interface SqlAdapter {
  readonly mode: 'direct' | 'data-api';
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResultLike<T>>;
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
  readonly numberOfRecordsUpdated?: number;
}

let cachedAdapter: SqlAdapter | null = null;

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
    clusterId,
    '--query',
    'DBClusters[0].DBClusterArn',
    '--output',
    'text',
  ]);
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toDataApiTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  // Data API TIMESTAMP expects "YYYY-MM-DD HH:MM:SS[.FFF]" format.
  return parsed.toISOString().replace('T', ' ').replace('Z', '');
}

function toParameterValue(value: unknown): {
  readonly value: Record<string, unknown>;
  readonly typeHint?: string;
} {
  if (value === null || value === undefined) {
    return { value: { isNull: true } };
  }
  if (typeof value === 'boolean') {
    return { value: { booleanValue: value } };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return { value: { longValue: value } };
    }
    return { value: { doubleValue: value } };
  }
  if (typeof value === 'string') {
    if (isUuid(value)) {
      return { value: { stringValue: value }, typeHint: 'UUID' };
    }
    if (isIsoTimestamp(value)) {
      return { value: { stringValue: toDataApiTimestamp(value) }, typeHint: 'TIMESTAMP' };
    }
    if (isIsoDate(value)) {
      return { value: { stringValue: value }, typeHint: 'DATE' };
    }
    return { value: { stringValue: value } };
  }
  return { value: { stringValue: JSON.stringify(value) }, typeHint: 'JSON' };
}

function compileDataApiSql(text: string, values: unknown[]): {
  readonly sql: string;
  readonly parameters: Array<Record<string, unknown>>;
} {
  if (values.length === 0) {
    return { sql: text, parameters: [] };
  }

  const sql = text.replace(/\$(\d+)/g, (_match, indexRaw: string) => {
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 1 || index > values.length) {
      throw new Error(`SQL parameter $${indexRaw} does not have a corresponding value`);
    }
    return `:p${indexRaw}`;
  });

  const parameters = values.map((value, index) => ({
    ...(() => {
      const parameter = toParameterValue(value);
      if (parameter.typeHint) {
        return {
          name: `p${String(index + 1)}`,
          value: parameter.value,
          typeHint: parameter.typeHint,
        };
      }
      return {
        name: `p${String(index + 1)}`,
        value: parameter.value,
      };
    })(),
  }));

  return { sql, parameters };
}

function dataFieldValue(field: DataApiField | undefined): unknown {
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

class DirectSqlAdapter implements SqlAdapter {
  public readonly mode = 'direct' as const;

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResultLike<T>> {
    const result = await directQuery<T>(text, values);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  public async close(): Promise<void> {
    await closeDirectPool();
  }
}

class DataApiSqlAdapter implements SqlAdapter {
  public readonly mode = 'data-api' as const;
  private readonly clusterArn: string;
  private readonly secretArn: string;
  private readonly database: string;

  public constructor() {
    const secretArn = process.env['DB_SECRET_ARN']?.trim();
    if (!secretArn) {
      throw new Error('Set DB_SECRET_ARN for Data API mode');
    }
    this.clusterArn = resolveClusterArn();
    this.secretArn = secretArn;
    this.database = process.env['DB_NAME']?.trim() || 'assetmgmt';
  }

  public async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResultLike<T>> {
    const compiled = compileDataApiSql(text, values);
    const args = [
      'rds-data',
      'execute-statement',
      '--resource-arn',
      this.clusterArn,
      '--secret-arn',
      this.secretArn,
      '--database',
      this.database,
      '--sql',
      compiled.sql,
      '--include-result-metadata',
      '--output',
      'json',
    ];

    if (compiled.parameters.length > 0) {
      args.push('--parameters', JSON.stringify(compiled.parameters));
    }

    const result = runAwsJson(args) as DataApiResult;
    const metadata = result.columnMetadata ?? [];
    const rows = (result.records ?? []).map((record) => {
      const row: Record<string, unknown> = {};
      for (let index = 0; index < record.length; index += 1) {
        const columnName = metadata[index]?.name ?? `column_${String(index + 1)}`;
        row[columnName] = dataFieldValue(record[index]);
      }
      return row as T;
    });

    return {
      rows,
      rowCount:
        typeof result.numberOfRecordsUpdated === 'number'
          ? result.numberOfRecordsUpdated
          : rows.length,
    };
  }

  public async close(): Promise<void> {
    return Promise.resolve();
  }
}

async function resolveAdapter(): Promise<SqlAdapter> {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  const forceDataApi = process.env['AUDIT_DB_FORCE_DATA_API'] === '1';
  const preferDataApi =
    process.env['AUDIT_DB_PREFER_DATA_API'] === '1' ||
    (typeof process.env['DB_SECRET_ARN'] === 'string' &&
      process.env['DB_SECRET_ARN'].trim().length > 0 &&
      (!process.env['DB_HOST'] || process.env['DB_HOST'].trim().length === 0));

  if (forceDataApi || preferDataApi) {
    cachedAdapter = new DataApiSqlAdapter();
    return cachedAdapter;
  }

  try {
    await directQuery('SELECT 1');
    cachedAdapter = new DirectSqlAdapter();
    return cachedAdapter;
  } catch (_error: unknown) {
    await closeDirectPool().catch(() => undefined);
    cachedAdapter = new DataApiSqlAdapter();
    return cachedAdapter;
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResultLike<T>> {
  const adapter = await resolveAdapter();
  return adapter.query<T>(text, values);
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<T | null> {
  const result = await query<T>(text, values);
  return result.rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  if (!cachedAdapter) {
    return;
  }
  await cachedAdapter.close();
  cachedAdapter = null;
}

export async function getAuditDbMode(): Promise<'direct' | 'data-api'> {
  const adapter = await resolveAdapter();
  return adapter.mode;
}
