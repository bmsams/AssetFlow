/**
 * Procurement accounting close-smoke runner for dev validation.
 *
 * Coverage:
 * - create PO -> submit -> approve -> send
 * - post receipt accounting
 * - post invoice accounting
 * - evaluate close guard
 * - close PO
 *
 * Required env vars:
 * - SMOKE_USERNAME
 * - SMOKE_PASSWORD
 *
 * Optional env vars:
 * - API_BASE_URL
 * - AWS_REGION (default: us-east-1)
 * - COGNITO_USER_POOL_CLIENT_ID
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface ApiCallResult<T = unknown> {
  readonly status: number;
  readonly body: T;
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
      Authorization: token,
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
    const payload = (parsed ?? {}) as { error?: { message?: string }; message?: string };
    const message = payload.error?.message ?? payload.message ?? `HTTP ${response.status}`;
    throw new Error(`${method} ${path} failed (${response.status}): ${message}`);
  }

  return { status: response.status, body: parsed as T };
}

function pickFixtureVendorAndCostCenter(region: string): { vendorId: string; costCenterId: string } {
  const clusterArn = runAwsText([
    'rds',
    'describe-db-clusters',
    '--region',
    region,
    '--db-cluster-identifier',
    'ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn',
    '--query',
    'DBClusters[0].DBClusterArn',
    '--output',
    'text',
  ]);

  const secretArn = runAwsText([
    'secretsmanager',
    'list-secrets',
    '--region',
    region,
    '--query',
    "SecretList[?Name=='ams-dev/database/credentials'].ARN | [0]",
    '--output',
    'text',
  ]);

  const sql = `
    WITH v AS (
      SELECT vendor_id::text AS vendor_id
      FROM vendors
      WHERE is_active = TRUE
        AND UPPER(COALESCE(rating, '')) IN ('APPROVED', 'PREFERRED')
      ORDER BY vendor_name ASC
      LIMIT 1
    ),
    cc AS (
      SELECT cost_center_id::text AS cost_center_id
      FROM cost_centers
      WHERE is_active = TRUE
      ORDER BY COALESCE(available_amount, 0) DESC NULLS LAST, code ASC
      LIMIT 1
    )
    SELECT v.vendor_id, cc.cost_center_id FROM v CROSS JOIN cc
  `;

  const result = runAwsJson([
    'rds-data',
    'execute-statement',
    '--region',
    region,
    '--resource-arn',
    clusterArn,
    '--secret-arn',
    secretArn,
    '--database',
    'assetmgmt',
    '--sql',
    sql,
    '--output',
    'json',
  ]) as {
    readonly records?: Array<Array<{ stringValue?: string }>>;
  };

  const row = result.records?.[0];
  const vendorId = row?.[0]?.stringValue ?? '';
  const costCenterId = row?.[1]?.stringValue ?? '';
  if (!vendorId || !costCenterId) {
    throw new Error('Failed to resolve vendor/cost center fixture');
  }
  return { vendorId, costCenterId };
}

function extractData<T>(payload: unknown): T {
  const record = (payload ?? {}) as { data?: unknown };
  return (record.data ?? payload) as T;
}

async function run(): Promise<void> {
  const region = getEnv('AWS_REGION') ?? 'us-east-1';
  const username = getEnv('SMOKE_USERNAME', true)!;
  const password = getEnv('SMOKE_PASSWORD', true)!;
  const baseUrl = resolveApiBaseUrl();
  const clientId = resolveCognitoClientId();
  const fixture = pickFixtureVendorAndCostCenter(region);
  const nowTag = new Date().toISOString().replace(/[:.]/g, '-');

  console.log('[accounting-close-smoke] start');
  console.log('[accounting-close-smoke] baseUrl=', baseUrl);
  console.log('[accounting-close-smoke] fixture vendor=', fixture.vendorId);
  console.log('[accounting-close-smoke] fixture costCenter=', fixture.costCenterId);

  const idToken = await authenticateWithCognito({
    region,
    clientId,
    username,
    password,
  });
  console.log('[accounting-close-smoke] auth ok');

  const poCreate = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/procurement/purchase-orders', {
    vendorId: fixture.vendorId,
    costCenterId: fixture.costCenterId,
    currency: 'USD',
    notes: `Accounting close smoke PO ${nowTag}`,
    lines: [
      {
        productType: 'OTHER',
        productDescription: `Accounting smoke line ${nowTag}`,
        quantity: 1,
        unitPrice: 1,
        vendorId: fixture.vendorId,
        costCenterId: fixture.costCenterId,
      },
    ],
  });
  const poData = extractData<Record<string, JsonValue>>(poCreate.body);
  const poId = String(poData['poId'] ?? '');
  if (!poId) {
    throw new Error('PO creation did not return poId');
  }
  console.log('[accounting-close-smoke] po created:', poId);

  await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/submit`);
  console.log('[accounting-close-smoke] po submitted');

  await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/approve`, {
    approvalNotes: 'Accounting close smoke approve',
  });
  console.log('[accounting-close-smoke] po approved');

  await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/send`);
  console.log('[accounting-close-smoke] po sent');

  const receiptId = randomUUID();
  await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/receipt-accounting`, {
    receiptId,
    receiptNumber: `RCPT-${nowTag}`,
  });
  console.log('[accounting-close-smoke] receipt accounting posted:', receiptId);

  const invoiceId = randomUUID();
  await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${poId}/invoice-accounting`, {
    invoiceId,
    invoiceNumber: `INV-${nowTag}`,
  });
  console.log('[accounting-close-smoke] invoice accounting posted:', invoiceId);

  const guardResult = await apiCall<Record<string, JsonValue>>(
    baseUrl,
    idToken,
    'GET',
    `/procurement/purchase-orders/${poId}/close-guard`
  );
  const guardData = extractData<Record<string, JsonValue>>(guardResult.body);
  const canClose = Boolean(guardData['canClose']);
  console.log('[accounting-close-smoke] close guard:', guardData);

  if (!canClose) {
    throw new Error(`Close guard failed for po ${poId}`);
  }

  const closeResult = await apiCall<Record<string, JsonValue>>(
    baseUrl,
    idToken,
    'POST',
    `/procurement/purchase-orders/${poId}/close`,
    { closeNotes: 'Accounting close smoke close' }
  );
  const closeData = extractData<Record<string, JsonValue>>(closeResult.body);
  const status = String(closeData['status'] ?? '');
  console.log('[accounting-close-smoke] po close result status:', status);

  if (status !== 'CLOSED') {
    throw new Error(`Expected CLOSED status, received ${status}`);
  }

  console.log('[accounting-close-smoke] complete');
}

run().catch((error: unknown) => {
  console.error('[accounting-close-smoke] failed', error);
  process.exitCode = 1;
});
