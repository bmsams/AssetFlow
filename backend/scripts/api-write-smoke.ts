/**
 * API write-smoke runner for dev validation.
 *
 * Coverage:
 * - Requisition create -> submit -> approve -> convert (and cancel converted PO)
 * - Purchase order create -> update line -> submit -> reject -> cancel
 * - Receiving create-from-PO -> cancel (against an existing receivable PO)
 * - Work order create -> assign -> complete
 *
 * Auth:
 * - Uses Cognito USER_PASSWORD_AUTH to obtain an ID token.
 *
 * Required env vars:
 * - SMOKE_USERNAME
 * - SMOKE_PASSWORD
 *
 * Optional env vars:
 * - API_BASE_URL (default: from `ams-dev-api` stack output)
 * - AWS_REGION (default: us-east-1)
 * - COGNITO_USER_POOL_CLIENT_ID (default: from `ams-dev-auth` stack output)
 * - DB_SECRET_ARN + DB_CLUSTER_ARN/DB_CLUSTER_ID (used for fixture selection via Data API)
 */

import { execFileSync } from 'node:child_process';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface ApiCallResult<T = unknown> {
  readonly status: number;
  readonly body: T;
}

interface FixtureData {
  readonly vendorId: string;
  readonly vendorName: string;
  readonly costCenterId: string;
  readonly costCenterCode: string;
  readonly stockroomId: string;
  readonly stockroomName: string;
  readonly receivablePoId: string;
  readonly receivablePoNumber: string;
}

interface BuildingAssetFixture {
  readonly buildingId: string;
  readonly buildingName: string;
  readonly assetId: string;
  readonly assetTag: string;
}

function runAwsText(args: string[]): string {
  return execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function runAwsJson(args: string[]): unknown {
  const out = execFileSync('aws', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out) as unknown;
}

function getEnv(name: string, required = false): string | undefined {
  const value = process.env[name]?.trim();
  if (required && !value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function resolveApiBaseUrl(): string {
  const explicit = getEnv('API_BASE_URL');
  if (explicit) {
    return explicit.endsWith('/') ? explicit.slice(0, -1) : explicit;
  }

  const fromCfn = runAwsText([
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    'ams-dev-api',
    '--query',
    "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue | [0]",
    '--output',
    'text',
  ]);
  return fromCfn.endsWith('/') ? fromCfn.slice(0, -1) : fromCfn;
}

function resolveCognitoClientId(): string {
  const explicit = getEnv('COGNITO_USER_POOL_CLIENT_ID');
  if (explicit) {
    return explicit;
  }

  return runAwsText([
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    'ams-dev-auth',
    '--query',
    "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue | [0]",
    '--output',
    'text',
  ]);
}

function resolveClusterArn(region: string): string {
  const explicitArn = getEnv('DB_CLUSTER_ARN');
  if (explicitArn) {
    return explicitArn;
  }

  const clusterId = getEnv('DB_CLUSTER_ID') ?? 'ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn';
  return runAwsText([
    'rds',
    'describe-db-clusters',
    '--region',
    region,
    '--db-cluster-identifier',
    clusterId,
    '--query',
    'DBClusters[0].DBClusterArn',
    '--output',
    'text',
  ]);
}

function resolveSecretArn(region: string): string {
  const explicit = getEnv('DB_SECRET_ARN');
  if (explicit) {
    return explicit;
  }

  return runAwsText([
    'secretsmanager',
    'list-secrets',
    '--region',
    region,
    '--query',
    "SecretList[?Name=='ams-dev/database/credentials'].ARN | [0]",
    '--output',
    'text',
  ]);
}

function extractData<T>(payload: unknown): T {
  const record = (payload ?? {}) as { data?: unknown };
  return (record.data ?? payload) as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(value: unknown): Record<string, JsonValue> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  return {};
}

function readFieldAsString(row: unknown, field: string): string {
  const record = asRecord(row);
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing expected field "${field}" in fixture row`);
  }
  return value;
}

function getItemsFromListPayload(payload: unknown): Record<string, JsonValue>[] {
  const data = asRecord(extractData<unknown>(payload));
  const items = data['items'];
  return asArray<Record<string, JsonValue>>(items);
}

function getDataApiRows(
  sql: string,
  opts: {
    readonly region: string;
    readonly clusterArn: string;
    readonly secretArn: string;
    readonly database: string;
  }
): Array<Record<string, JsonValue>> {
  const raw = runAwsJson([
    'rds-data',
    'execute-statement',
    '--region',
    opts.region,
    '--resource-arn',
    opts.clusterArn,
    '--secret-arn',
    opts.secretArn,
    '--database',
    opts.database,
    '--sql',
    sql,
    '--include-result-metadata',
    '--output',
    'json',
  ]) as {
    readonly records?: Array<Array<Record<string, JsonValue>>>;
    readonly columnMetadata?: Array<{ readonly name?: string }>;
  };

  const columns = asArray<{ name?: string }>(raw.columnMetadata).map((c) => c.name ?? '');
  const rows = asArray<Array<Record<string, JsonValue>>>(raw.records);

  return rows.map((row) => {
    const out: Record<string, JsonValue> = {};
    for (let i = 0; i < row.length; i++) {
      const field = row[i] ?? {};
      const col = columns[i] ?? `col_${i}`;
      if ('stringValue' in field && typeof field['stringValue'] === 'string') {
        out[col] = field['stringValue'];
      } else if ('longValue' in field && typeof field['longValue'] === 'number') {
        out[col] = String(field['longValue']);
      } else if ('doubleValue' in field && typeof field['doubleValue'] === 'number') {
        out[col] = String(field['doubleValue']);
      } else if ('booleanValue' in field && typeof field['booleanValue'] === 'boolean') {
        out[col] = String(field['booleanValue']);
      } else if ('isNull' in field && field['isNull'] === true) {
        out[col] = null;
      } else {
        out[col] = JSON.stringify(field);
      }
    }
    return out;
  });
}

async function apiCall<T = unknown>(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<ApiCallResult<T>> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let parsed: unknown = {};
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = { raw: text };
    }
  }

  if (!response.ok) {
    const payload = asRecord(parsed);
    const err = asRecord(payload['error']);
    const message =
      (typeof err['message'] === 'string' && err['message']) ||
      (typeof payload['message'] === 'string' && payload['message']) ||
      `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }

  return { status: response.status, body: parsed as T };
}

async function authenticateWithCognito(params: {
  readonly region: string;
  readonly clientId: string;
  readonly username: string;
  readonly password: string;
}): Promise<string> {
  const result = runAwsJson([
    'cognito-idp',
    'initiate-auth',
    '--region',
    params.region,
    '--auth-flow',
    'USER_PASSWORD_AUTH',
    '--client-id',
    params.clientId,
    '--auth-parameters',
    `USERNAME=${params.username},PASSWORD=${params.password}`,
    '--output',
    'json',
  ]) as {
    readonly AuthenticationResult?: { readonly IdToken?: string };
  };

  const idToken = result.AuthenticationResult?.IdToken;
  if (!idToken) {
    throw new Error('Cognito auth succeeded but no IdToken was returned');
  }
  return idToken;
}

function pickFixtures(opts: {
  readonly region: string;
  readonly clusterArn: string;
  readonly secretArn: string;
  readonly database: string;
}): FixtureData {
  const vendorRows = getDataApiRows(
    `
      SELECT v.vendor_id::text AS vendor_id, v.vendor_name
      FROM vendors v
      WHERE v.is_active = TRUE
        AND UPPER(COALESCE(v.rating, '')) IN ('APPROVED', 'PREFERRED')
      ORDER BY v.vendor_name ASC
      LIMIT 1
    `,
    opts
  );
  if (vendorRows.length === 0) {
    throw new Error('No approved active vendor found for smoke fixture');
  }

  const ccRows = getDataApiRows(
    `
      SELECT cost_center_id::text AS cost_center_id, code
      FROM cost_centers
      WHERE is_active = TRUE
      ORDER BY code ASC
      LIMIT 1
    `,
    opts
  );
  if (ccRows.length === 0) {
    throw new Error('No active cost center found for smoke fixture');
  }

  const poRows = getDataApiRows(
    `
      SELECT po.po_id::text AS po_id, po.po_number
      FROM purchase_orders po
      JOIN purchase_order_lines pol ON pol.po_id = po.po_id
      WHERE po.status IN ('APPROVED', 'SENT', 'PARTIALLY_RECEIVED')
        AND pol.received_quantity < pol.quantity
      GROUP BY po.po_id, po.po_number, po.created_at
      ORDER BY po.created_at DESC
      LIMIT 1
    `,
    opts
  );
  if (poRows.length === 0) {
    throw new Error('No receivable PO found (APPROVED/SENT/PARTIALLY_RECEIVED)');
  }

  const stockroomRows = getDataApiRows(
    `
      SELECT stockroom_id::text AS stockroom_id, name
      FROM stockrooms
      WHERE is_active = TRUE
      ORDER BY name ASC
      LIMIT 1
    `,
    opts
  );
  if (stockroomRows.length === 0) {
    throw new Error('No active stockroom found for smoke fixture');
  }

  return {
    vendorId: readFieldAsString(vendorRows[0], 'vendor_id'),
    vendorName: readFieldAsString(vendorRows[0], 'vendor_name'),
    costCenterId: readFieldAsString(ccRows[0], 'cost_center_id'),
    costCenterCode: readFieldAsString(ccRows[0], 'code'),
    stockroomId: readFieldAsString(stockroomRows[0], 'stockroom_id'),
    stockroomName: readFieldAsString(stockroomRows[0], 'name'),
    receivablePoId: readFieldAsString(poRows[0], 'po_id'),
    receivablePoNumber: readFieldAsString(poRows[0], 'po_number'),
  };
}

async function pickBuildingAssetViaApi(baseUrl: string, token: string): Promise<BuildingAssetFixture> {
  const buildingsResp = await apiCall(baseUrl, token, 'GET', '/admin/buildings?isActive=true&page=1&limit=200&sortBy=name&order=asc');
  const buildings = getItemsFromListPayload(buildingsResp.body);
  if (buildings.length === 0) {
    throw new Error('No active buildings returned by API');
  }

  for (const b of buildings) {
    const buildingId = typeof b['buildingId'] === 'string' ? b['buildingId'] : '';
    const buildingName = typeof b['name'] === 'string' ? b['name'] : '';
    if (!buildingId) {
      continue;
    }

    const assetsResp = await apiCall(
      baseUrl,
      token,
      'GET',
      `/assets?assetType=HARDWARE&buildingId=${encodeURIComponent(buildingId)}&page=1&limit=1`
    );
    const assets = getItemsFromListPayload(assetsResp.body);
    if (assets.length === 0) {
      continue;
    }

    const first = assets[0] ?? {};
    const assetId = typeof first['assetId'] === 'string' ? first['assetId'] : '';
    const assetTag = typeof first['assetTag'] === 'string' ? first['assetTag'] : '';
    if (assetId) {
      return {
        buildingId,
        buildingName,
        assetId,
        assetTag,
      };
    }
  }

  throw new Error('No building-scoped HARDWARE asset found through API');
}

function getCreatedByFromWorkOrder(payload: unknown): string | null {
  const wo = asRecord(extractData<unknown>(payload));
  const createdBy = wo['createdBy'];
  return typeof createdBy === 'string' && createdBy.length > 0 ? createdBy : null;
}

async function run(): Promise<void> {
  const region = getEnv('AWS_REGION') ?? 'us-east-1';
  const username = getEnv('SMOKE_USERNAME', true)!;
  const password = getEnv('SMOKE_PASSWORD', true)!;
  const database = getEnv('DB_NAME') ?? 'assetmgmt';
  const nowTag = new Date().toISOString().replace(/[:.]/g, '-');

  const baseUrl = resolveApiBaseUrl();
  const clientId = resolveCognitoClientId();
  const clusterArn = resolveClusterArn(region);
  const secretArn = resolveSecretArn(region);
  const fixtures = pickFixtures({ region, clusterArn, secretArn, database });

  console.log('[api-write-smoke] start');
  console.log('[api-write-smoke] baseUrl=', baseUrl);
  console.log('[api-write-smoke] fixture vendor=', fixtures.vendorName, fixtures.vendorId);
  console.log('[api-write-smoke] fixture costCenter=', fixtures.costCenterCode, fixtures.costCenterId);
  console.log('[api-write-smoke] fixture stockroom=', fixtures.stockroomName, fixtures.stockroomId);
  console.log('[api-write-smoke] fixture receivablePO=', fixtures.receivablePoNumber, fixtures.receivablePoId);

  const idToken = await authenticateWithCognito({
    region,
    clientId,
    username,
    password,
  });
  console.log('[api-write-smoke] auth ok');

  const buildingAsset = await pickBuildingAssetViaApi(baseUrl, idToken);
  console.log('[api-write-smoke] fixture building=', buildingAsset.buildingName, buildingAsset.buildingId);
  console.log('[api-write-smoke] fixture asset=', buildingAsset.assetTag, buildingAsset.assetId);

  const cleanup: Array<() => Promise<void>> = [];
  const failures: string[] = [];

  try {
    // Requisition flow
    const requisitionCreate = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/procurement/requisitions', {
      costCenterId: fixtures.costCenterId,
      shipToBuildingId: buildingAsset.buildingId,
      notes: `API smoke requisition ${nowTag}`,
      lines: [
        {
          productType: 'OTHER',
          productDescription: `API smoke req line ${nowTag}`,
          quantity: 1,
          unitPrice: 1,
          currency: 'USD',
          vendorId: fixtures.vendorId,
          costCenterId: fixtures.costCenterId,
        },
      ],
    });
    const requisitionCreated = asRecord(extractData<unknown>(requisitionCreate.body));
    const requisitionId = String(requisitionCreated['requisitionId'] ?? '');
    console.log('[api-write-smoke] requisition created:', requisitionId);

    await apiCall(baseUrl, idToken, 'POST', `/procurement/requisitions/${requisitionId}/submit`);
    console.log('[api-write-smoke] requisition submitted');

    await apiCall(baseUrl, idToken, 'POST', `/procurement/requisitions/${requisitionId}/approve`, {
      notes: 'API smoke approve',
    });
    console.log('[api-write-smoke] requisition approved');

    const converted = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', `/procurement/requisitions/${requisitionId}/convert`);
    const convertedData = asRecord(extractData<unknown>(converted.body));
    const convertedPos = asArray<Record<string, JsonValue>>(convertedData['purchaseOrders']);
    console.log('[api-write-smoke] requisition converted -> po count:', convertedPos.length);

    for (const po of convertedPos) {
      const poId = typeof po['poId'] === 'string' ? po['poId'] : '';
      if (!poId) {
        continue;
      }
      cleanup.push(async () => {
        try {
          await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/cancel`, {
            cancellationReason: 'API smoke cleanup for converted requisition PO',
          });
          console.log('[api-write-smoke] cleanup cancelled converted po:', poId);
        } catch (error) {
          console.warn('[api-write-smoke] cleanup warning (converted po):', poId, String(error));
        }
      });
    }

    // Purchase order lifecycle flow
    const poCreate = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/procurement/purchase-orders', {
      vendorId: fixtures.vendorId,
      costCenterId: fixtures.costCenterId,
      currency: 'USD',
      notes: `API smoke PO ${nowTag}`,
      lines: [
        {
          productType: 'OTHER',
          productDescription: `API smoke po line ${nowTag}`,
          quantity: 1,
          unitPrice: 1,
          vendorId: fixtures.vendorId,
          costCenterId: fixtures.costCenterId,
        },
      ],
    });
    const poCreated = asRecord(extractData<unknown>(poCreate.body));
    const smokePoId = String(poCreated['poId'] ?? '');
    const poLines = asArray<Record<string, JsonValue>>(poCreated['lines']);
    const smokeLineId = poLines.length > 0 && typeof poLines[0]?.['lineId'] === 'string'
      ? (poLines[0]?.['lineId'] as string)
      : '';
    console.log('[api-write-smoke] po created:', smokePoId);

    if (smokeLineId) {
      await apiCall(baseUrl, idToken, 'PUT', `/procurement/purchase-orders/${smokePoId}/lines/${smokeLineId}`, {
        quantity: 2,
        unitPrice: 1,
        notes: 'API smoke update line',
      });
      console.log('[api-write-smoke] po line updated:', smokeLineId);
    }

    await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${smokePoId}/submit`);
    console.log('[api-write-smoke] po submitted');

    let poStatusAfterReject: string | null = null;
    try {
      const rejectResult = await apiCall<Record<string, JsonValue>>(
        baseUrl,
        idToken,
        'POST',
        `/procurement/purchase-orders/${smokePoId}/reject`,
        {
        rejectionReason: 'API smoke reject for lifecycle validation',
        }
      );
      const rejectedPo = asRecord(extractData<unknown>(rejectResult.body));
      poStatusAfterReject = typeof rejectedPo['status'] === 'string' ? String(rejectedPo['status']) : null;
      console.log('[api-write-smoke] po rejected');
    } catch (error) {
      console.warn('[api-write-smoke] po reject warning:', String(error));
    }

    if (poStatusAfterReject === 'CANCELLED') {
      console.log('[api-write-smoke] po cancel skipped (already CANCELLED after reject)');
    } else {
      await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${smokePoId}/cancel`, {
        cancellationReason: 'API smoke cancel after reject',
      });
      console.log('[api-write-smoke] po cancelled');
    }

    // Receiving flow (existing receivable PO)
    try {
      const receivingCreate = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/lifecycle/receiving/from-po', {
        poId: fixtures.receivablePoId,
        stockroomId: fixtures.stockroomId,
        notes: `API smoke receiving ${nowTag}`,
      });
      const receivingData = asRecord(extractData<unknown>(receivingCreate.body));
      const receivingRecord = asRecord(receivingData['receivingRecord']);
      const receivingId = String(receivingRecord['receivingId'] ?? '');
      console.log('[api-write-smoke] receiving created:', receivingId);

      await apiCall(baseUrl, idToken, 'POST', `/lifecycle/receiving/${receivingId}/cancel`, {
        reason: 'API smoke cancel receiving',
      });
      console.log('[api-write-smoke] receiving cancelled');
    } catch (error) {
      const message = String(error);
      failures.push(`receiving flow failed: ${message}`);
      console.warn('[api-write-smoke] receiving warning:', message);
    }

    // EAM work order flow
    const woCreate = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/eam/work-orders', {
      assetId: buildingAsset.assetId,
      buildingId: buildingAsset.buildingId,
      workType: 'CORRECTIVE',
      title: `API smoke WO ${nowTag}`,
      description: 'API write-smoke work order validation',
      priority: 'MEDIUM',
      estimatedHours: 1,
    });
    const woData = asRecord(extractData<unknown>(woCreate.body));
    const workOrderId = String(woData['workOrderId'] ?? '');
    console.log('[api-write-smoke] work order created:', workOrderId);

    const assignTo = getCreatedByFromWorkOrder(woCreate.body);
    if (assignTo) {
      try {
        await apiCall(baseUrl, idToken, 'POST', `/eam/work-orders/${workOrderId}/assign`, {
          assignedTo: assignTo,
        });
        console.log('[api-write-smoke] work order assigned to:', assignTo);
      } catch (error) {
        const message = String(error);
        failures.push(`work-order assign failed: ${message}`);
        console.warn('[api-write-smoke] work-order assign warning:', message);
      }
    } else {
      console.warn('[api-write-smoke] work order assign skipped (createdBy not found)');
    }

    try {
      await apiCall(baseUrl, idToken, 'POST', `/eam/work-orders/${workOrderId}/complete`, {
        actualHours: 1,
      });
      console.log('[api-write-smoke] work order completed');
    } catch (error) {
      const message = String(error);
      failures.push(`work-order complete failed: ${message}`);
      console.warn('[api-write-smoke] work-order complete warning:', message);
    }

    if (failures.length > 0) {
      throw new Error(failures.join(' | '));
    }
    console.log('[api-write-smoke] complete');
  } finally {
    for (const fn of cleanup) {
      await fn();
    }
  }
}

run().catch((error: unknown) => {
  console.error('[api-write-smoke] failed', error);
  process.exitCode = 1;
});
