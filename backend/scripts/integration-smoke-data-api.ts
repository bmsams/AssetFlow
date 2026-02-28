/**
 * Integration smoke runner using Aurora Data API.
 *
 * Purpose:
 * - Provide a connectivity-safe smoke path when direct PostgreSQL TCP access
 *   from local/dev machines is blocked by VPC networking.
 *
 * Required env vars:
 * - DB_SECRET_ARN: Secrets Manager ARN for database credentials.
 * - DB_CLUSTER_ARN or DB_CLUSTER_ID: Aurora cluster ARN/identifier.
 *
 * Optional env vars:
 * - DB_NAME (default: assetmgmt)
 * - AWS_REGION (default AWS CLI region resolution)
 */

import { execFileSync } from 'node:child_process';

interface DataApiField {
  stringValue?: string;
  longValue?: number;
  doubleValue?: number;
  booleanValue?: boolean;
  isNull?: boolean;
}

interface DataApiResult {
  readonly records?: DataApiField[][];
  readonly numberOfRecordsUpdated?: number;
}

function runAwsJson(args: string[]): unknown {
  const output = execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output);
}

function runAwsText(args: string[]): string {
  return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function resolveClusterArn(): string {
  const clusterArn = process.env['DB_CLUSTER_ARN'];
  if (clusterArn) {
    return clusterArn;
  }

  const clusterId = process.env['DB_CLUSTER_ID'];
  if (!clusterId) {
    throw new Error('Set DB_CLUSTER_ARN or DB_CLUSTER_ID');
  }

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

function fieldToString(field: DataApiField | undefined): string | null {
  if (!field || field.isNull) {
    return null;
  }
  if (typeof field.stringValue === 'string') {
    return field.stringValue;
  }
  if (typeof field.longValue === 'number') {
    return String(field.longValue);
  }
  if (typeof field.doubleValue === 'number') {
    return String(field.doubleValue);
  }
  if (typeof field.booleanValue === 'boolean') {
    return String(field.booleanValue);
  }
  return null;
}

function executeSql(clusterArn: string, secretArn: string, database: string, sql: string): DataApiResult {
  const result = runAwsJson([
    'rds-data',
    'execute-statement',
    '--resource-arn',
    clusterArn,
    '--secret-arn',
    secretArn,
    '--database',
    database,
    '--sql',
    sql,
    '--output',
    'json',
  ]);
  return result as DataApiResult;
}

function firstRow(result: DataApiResult): DataApiField[] | null {
  if (!result.records || result.records.length === 0) {
    return null;
  }
  return result.records[0] ?? null;
}

async function main(): Promise<void> {
  const secretArn = process.env['DB_SECRET_ARN'];
  if (!secretArn) {
    throw new Error('Set DB_SECRET_ARN');
  }

  const clusterArn = resolveClusterArn();
  const database = process.env['DB_NAME'] ?? 'assetmgmt';

  console.log('[smoke:data-api] start');
  console.log(`[smoke:data-api] cluster=${clusterArn}`);
  console.log(`[smoke:data-api] database=${database}`);

  const nowResult = executeSql(clusterArn, secretArn, database, 'select now()::text, current_database()');
  const nowRow = firstRow(nowResult);
  console.log('[smoke:data-api] db time:', fieldToString(nowRow?.[0]), 'db:', fieldToString(nowRow?.[1]));

  const buildingResult = executeSql(
    clusterArn,
    secretArn,
    database,
    'select building_id::text, name from buildings order by created_at asc limit 1'
  );
  const buildingRow = firstRow(buildingResult);
  const buildingId = fieldToString(buildingRow?.[0]);
  const buildingName = fieldToString(buildingRow?.[1]);
  console.log('[smoke:data-api] location building:', { buildingId, buildingName });

  const poResult = executeSql(
    clusterArn,
    secretArn,
    database,
    'select po_id::text, po_number, status from purchase_orders order by created_at desc limit 1'
  );
  const poRow = firstRow(poResult);
  const poId = fieldToString(poRow?.[0]);
  const poNumber = fieldToString(poRow?.[1]);
  const poStatus = fieldToString(poRow?.[2]);

  let poLineCount: string | null = null;
  let receivingCount: string | null = null;
  if (poId) {
    const poLineResult = executeSql(
      clusterArn,
      secretArn,
      database,
      `select count(*)::text from purchase_order_lines where po_id = '${poId}'::uuid`
    );
    poLineCount = fieldToString(firstRow(poLineResult)?.[0]);

    const receivingResult = executeSql(
      clusterArn,
      secretArn,
      database,
      `select count(*)::text from receiving_records where po_id = '${poId}'::uuid`
    );
    receivingCount = fieldToString(firstRow(receivingResult)?.[0]);
  }
  console.log('[smoke:data-api] procurement summary:', {
    poId,
    poNumber,
    poStatus,
    poLineCount,
    receivingCount,
  });

  const woResult = executeSql(
    clusterArn,
    secretArn,
    database,
    `select wo.work_order_id::text, wo.title, a.asset_tag
       from work_orders wo
       left join assets a on a.asset_id = wo.asset_id
      order by wo.created_at desc
      limit 1`
  );
  const woRow = firstRow(woResult);
  const workOrderId = fieldToString(woRow?.[0]);
  const workOrderTitle = fieldToString(woRow?.[1]);
  const workOrderAssetTag = fieldToString(woRow?.[2]);
  console.log('[smoke:data-api] work-order summary:', {
    workOrderId,
    workOrderTitle,
    workOrderAssetTag,
  });

  console.log('[smoke:data-api] complete');
}

main().catch((error: unknown) => {
  console.error('[smoke:data-api] failed', error);
  process.exitCode = 1;
});
