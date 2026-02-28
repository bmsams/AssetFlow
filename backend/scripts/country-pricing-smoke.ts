/**
 * Country pricing smoke runner.
 *
 * Validates:
 * 1) Vendor-model price selection prefers ship-to building country over GLOBAL.
 * 2) Requisition -> PO conversion uses grouped line currency (not header currency).
 *
 * Required env vars:
 * - SMOKE_USERNAME
 * - SMOKE_PASSWORD
 *
 * Optional env vars:
 * - API_BASE_URL
 * - AWS_REGION (default us-east-1)
 * - COGNITO_USER_POOL_CLIENT_ID
 * - DB_SECRET_ARN
 * - DB_CLUSTER_ARN / DB_CLUSTER_ID
 * - DB_NAME (default assetmgmt)
 */

import { execFileSync } from 'node:child_process';

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

function asRecord(value: unknown): Record<string, JsonValue> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  return {};
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function extractData<T>(payload: unknown): T {
  const record = asRecord(payload);
  return (record['data'] ?? payload) as T;
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
  ]) as { readonly AuthenticationResult?: { readonly IdToken?: string } };

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
  const requestBody = body === undefined ? undefined : JSON.stringify(body);

  const callWithHeader = async (authorization: string): Promise<Response> =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: requestBody,
    });

  let response = await callWithHeader(`Bearer ${token}`);
  let text = await response.text();

  if (
    response.status === 403 &&
    (text.includes('IncompleteSignature') || text.includes('Invalid key=value pair'))
  ) {
    response = await callWithHeader(token);
    text = await response.text();
  }

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

function getDataApiRows(
  sql: string,
  opts: {
    readonly region: string;
    readonly clusterArn: string;
    readonly secretArn: string;
    readonly database: string;
  }
): Array<Record<string, string | null>> {
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
    const out: Record<string, string | null> = {};
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
      } else {
        out[col] = null;
      }
    }
    return out;
  });
}

function requiredField(row: Record<string, string | null>, field: string): string {
  const value = row[field];
  if (!value) {
    throw new Error(`Missing required fixture field: ${field}`);
  }
  return value;
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

  console.log('[country-pricing-smoke] start');
  console.log('[country-pricing-smoke] baseUrl=', baseUrl);

  const idToken = await authenticateWithCognito({
    region,
    clientId,
    username,
    password,
  });
  console.log('[country-pricing-smoke] auth ok');

  const vendorRows = getDataApiRows(
    `
    SELECT vendor_id::text as vendor_id, vendor_name
    FROM vendors
    WHERE is_active = TRUE
      AND UPPER(COALESCE(rating, '')) IN ('APPROVED', 'PREFERRED')
    ORDER BY vendor_name ASC
    LIMIT 1
    `,
    { region, clusterArn, secretArn, database }
  );
  const ccRows = getDataApiRows(
    `
    SELECT cost_center_id::text as cost_center_id, code
    FROM cost_centers
    WHERE is_active = TRUE
    ORDER BY code ASC
    LIMIT 1
    `,
    { region, clusterArn, secretArn, database }
  );
  const buildingRows = getDataApiRows(
    `
    SELECT building_id::text as building_id, UPPER(COALESCE(country, 'USA')) as country
    FROM buildings
    WHERE is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1
    `,
    { region, clusterArn, secretArn, database }
  );
  const modelRows = getDataApiRows(
    `
    SELECT model_id::text as model_id
    FROM models
    WHERE is_active = TRUE
    ORDER BY created_at ASC
    LIMIT 1
    `,
    { region, clusterArn, secretArn, database }
  );

  if (vendorRows.length === 0 || ccRows.length === 0 || buildingRows.length === 0 || modelRows.length === 0) {
    throw new Error('Missing required fixtures (vendor/cost center/building/model)');
  }

  const vendorId = requiredField(vendorRows[0]!, 'vendor_id');
  const vendorName = requiredField(vendorRows[0]!, 'vendor_name');
  const costCenterId = requiredField(ccRows[0]!, 'cost_center_id');
  const buildingId = requiredField(buildingRows[0]!, 'building_id');
  const buildingCountry = requiredField(buildingRows[0]!, 'country');
  const modelId = requiredField(modelRows[0]!, 'model_id');

  const testCountry = buildingCountry;
  const globalCurrency = 'CAD';
  const globalPrice = 11.11;
  const localCurrency = 'USD';
  const localPrice = 22.22;

  console.log('[country-pricing-smoke] fixture vendor=', vendorName, vendorId);
  console.log('[country-pricing-smoke] fixture building country=', testCountry, buildingId);
  console.log('[country-pricing-smoke] fixture model=', modelId);

  await apiCall(baseUrl, idToken, 'PUT', `/admin/vendors/${vendorId}/model-prices/${modelId}`, {
    unitPrice: globalPrice,
    currency: globalCurrency,
    countryCode: 'GLOBAL',
    isActive: true,
  });
  console.log('[country-pricing-smoke] upserted GLOBAL price');

  await apiCall(baseUrl, idToken, 'PUT', `/admin/vendors/${vendorId}/model-prices/${modelId}`, {
    unitPrice: localPrice,
    currency: localCurrency,
    countryCode: testCountry,
    isActive: true,
  });
  console.log('[country-pricing-smoke] upserted country price', testCountry);

  const createResult = await apiCall<Record<string, JsonValue>>(baseUrl, idToken, 'POST', '/procurement/requisitions', {
    currency: globalCurrency,
    costCenterId,
    shipToBuildingId: buildingId,
    notes: `country-pricing-smoke ${nowTag}`,
    lines: [
      {
        productType: 'HARDWARE_MODEL',
        productId: modelId,
        productDescription: `country-pricing-smoke line ${nowTag}`,
        quantity: 1,
        vendorId,
      },
    ],
  });

  const createdReq = asRecord(extractData<unknown>(createResult.body));
  const requisitionId = String(createdReq['requisitionId'] ?? '');
  const lines = asArray<Record<string, JsonValue>>(createdReq['lines']);
  const line = lines[0] ?? {};
  const resolvedUnitPrice = Number(line['unitPrice'] ?? 0);
  const resolvedCurrency = String(line['currency'] ?? '');
  const sourceSnapshot = asRecord(line['sourceSnapshot']);
  const resolvedCountryCode = String(sourceSnapshot['countryCode'] ?? '');
  const resolvedPriceId = String(line['vendorModelPriceId'] ?? '');

  console.log('[country-pricing-smoke] requisition created:', requisitionId);
  console.log('[country-pricing-smoke] resolved line unitPrice/currency=', resolvedUnitPrice, resolvedCurrency);
  console.log('[country-pricing-smoke] resolved source country=', resolvedCountryCode);

  if (Math.abs(resolvedUnitPrice - localPrice) > 0.001) {
    throw new Error(`Expected local price ${localPrice}, got ${resolvedUnitPrice}`);
  }
  if (resolvedCurrency !== localCurrency) {
    throw new Error(`Expected local currency ${localCurrency}, got ${resolvedCurrency}`);
  }
  if (resolvedCountryCode !== testCountry) {
    throw new Error(`Expected source country ${testCountry}, got ${resolvedCountryCode}`);
  }

  if (!resolvedPriceId) {
    throw new Error('Expected vendorModelPriceId to be populated on requisition line');
  }

  const priceRows = getDataApiRows(
    `
    SELECT country_code
    FROM vendor_model_prices
    WHERE vendor_model_price_id = '${resolvedPriceId}'::uuid
    LIMIT 1
    `,
    { region, clusterArn, secretArn, database }
  );
  const dbCountry = requiredField(priceRows[0] ?? {}, 'country_code');
  if (dbCountry !== testCountry) {
    throw new Error(`Resolved vendor_model_price_id points to ${dbCountry}, expected ${testCountry}`);
  }

  await apiCall(baseUrl, idToken, 'POST', `/procurement/requisitions/${requisitionId}/submit`);
  await apiCall(baseUrl, idToken, 'POST', `/procurement/requisitions/${requisitionId}/approve`, {
    notes: 'country-pricing-smoke approve',
  });
  const convertResult = await apiCall<Record<string, JsonValue>>(
    baseUrl,
    idToken,
    'POST',
    `/procurement/requisitions/${requisitionId}/convert`
  );
  const convertData = asRecord(extractData<unknown>(convertResult.body));
  const purchaseOrders = asArray<Record<string, JsonValue>>(convertData['purchaseOrders']);
  if (purchaseOrders.length === 0) {
    throw new Error('Expected at least one converted purchase order');
  }

  const convertedCurrency = String(purchaseOrders[0]?.['currency'] ?? '');
  const convertedPoId = String(purchaseOrders[0]?.['poId'] ?? '');
  console.log('[country-pricing-smoke] converted po:', convertedPoId, 'currency=', convertedCurrency);

  if (convertedCurrency !== localCurrency) {
    throw new Error(
      `Expected converted PO currency ${localCurrency} (line/group currency), got ${convertedCurrency}`
    );
  }

  if (convertedPoId) {
    try {
      await apiCall(baseUrl, idToken, 'POST', `/procurement/purchase-orders/${convertedPoId}/cancel`, {
        cancellationReason: 'country-pricing-smoke cleanup',
      });
      console.log('[country-pricing-smoke] cleanup cancelled converted po:', convertedPoId);
    } catch (error) {
      console.warn('[country-pricing-smoke] cleanup warning:', String(error));
    }
  }

  console.log('[country-pricing-smoke] complete');
}

run().catch((error: unknown) => {
  console.error('[country-pricing-smoke] failed', error);
  process.exitCode = 1;
});
