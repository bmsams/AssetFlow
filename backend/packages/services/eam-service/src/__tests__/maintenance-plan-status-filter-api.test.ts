import type { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@ams/utils', () => {
  const actual = jest.requireActual('@ams/utils');
  return {
    ...actual,
    createLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  };
});

jest.mock('../maintenance/maintenance-service', () => ({
  getMaintenancePlan: jest.fn(),
  getMaintenancePlansByAsset: jest.fn(),
  getActiveMaintenancePlans: jest.fn(),
  getMaintenancePlans: jest.fn(),
}));

import { getMaintenancePlanHandler } from '../handlers/maintenance-plan-handlers';
import * as maintenanceService from '../maintenance/maintenance-service';

const VALID_ASSET_ID = '550e8400-e29b-41d4-a716-446655440011';

function createMockEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/eam/maintenance-plans',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {},
      protocol: 'HTTP/1.1',
      httpMethod: 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/eam/maintenance-plans',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/eam/maintenance-plans',
    },
    resource: '/eam/maintenance-plans',
    ...overrides,
  };
}

describe('Maintenance Plan API status filter contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 for invalid status filter value', async () => {
    const event = createMockEvent({
      queryStringParameters: {
        status: 'invalid',
      },
    });

    const result = await getMaintenancePlanHandler(event);
    expect(result.statusCode).toBe(400);
    expect(maintenanceService.getActiveMaintenancePlans).not.toHaveBeenCalled();
    expect(maintenanceService.getMaintenancePlans).not.toHaveBeenCalled();
    expect(maintenanceService.getMaintenancePlansByAsset).not.toHaveBeenCalled();

    const body = JSON.parse(result.body) as { error?: { message?: string } };
    expect(body.error?.message).toContain('status must be one of: active, paused, all');
  });

  it('uses active-only service call for status=active without assetId', async () => {
    (maintenanceService.getActiveMaintenancePlans as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 2,
      limit: 25,
      hasMore: false,
    });

    const event = createMockEvent({
      queryStringParameters: {
        status: 'active',
        page: '2',
        limit: '25',
      },
    });

    const result = await getMaintenancePlanHandler(event);

    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getActiveMaintenancePlans).toHaveBeenCalledWith({
      page: 2,
      limit: 25,
    });
    expect(maintenanceService.getMaintenancePlans).not.toHaveBeenCalled();
  });

  it('uses inactive branch for status=paused without assetId', async () => {
    (maintenanceService.getMaintenancePlans as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });

    const event = createMockEvent({
      queryStringParameters: {
        status: 'paused',
      },
    });

    const result = await getMaintenancePlanHandler(event);

    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getMaintenancePlans).toHaveBeenCalledWith(
      { page: 1, limit: 50 },
      false
    );
    expect(maintenanceService.getActiveMaintenancePlans).not.toHaveBeenCalled();
  });

  it('uses unfiltered branch for status=all without assetId', async () => {
    (maintenanceService.getMaintenancePlans as jest.Mock).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      hasMore: false,
    });

    const event = createMockEvent({
      queryStringParameters: {
        status: 'all',
      },
    });

    const result = await getMaintenancePlanHandler(event);

    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getMaintenancePlans).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
    });
    expect(maintenanceService.getActiveMaintenancePlans).not.toHaveBeenCalled();
  });

  it('applies active filtering for asset scoped status=active', async () => {
    (maintenanceService.getMaintenancePlansByAsset as jest.Mock).mockResolvedValue([
      { planId: 'plan-active', isActive: true },
      { planId: 'plan-paused', isActive: false },
    ]);

    const event = createMockEvent({
      queryStringParameters: {
        assetId: VALID_ASSET_ID,
        status: 'active',
      },
    });

    const result = await getMaintenancePlanHandler(event);
    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getMaintenancePlansByAsset).toHaveBeenCalledWith(
      VALID_ASSET_ID,
      false
    );

    const body = JSON.parse(result.body) as {
      data?: { items?: Array<{ isActive?: boolean }> };
    };
    expect(body.data?.items).toHaveLength(1);
    expect(body.data?.items?.[0]?.isActive).toBe(true);
  });

  it('applies paused filtering for asset scoped status=paused', async () => {
    (maintenanceService.getMaintenancePlansByAsset as jest.Mock).mockResolvedValue([
      { planId: 'plan-active', isActive: true },
      { planId: 'plan-paused', isActive: false },
    ]);

    const event = createMockEvent({
      queryStringParameters: {
        assetId: VALID_ASSET_ID,
        status: 'paused',
      },
    });

    const result = await getMaintenancePlanHandler(event);
    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getMaintenancePlansByAsset).toHaveBeenCalledWith(
      VALID_ASSET_ID,
      true
    );

    const body = JSON.parse(result.body) as {
      data?: { items?: Array<{ isActive?: boolean }> };
    };
    expect(body.data?.items).toHaveLength(1);
    expect(body.data?.items?.[0]?.isActive).toBe(false);
  });

  it('returns full asset scoped set for status=all', async () => {
    (maintenanceService.getMaintenancePlansByAsset as jest.Mock).mockResolvedValue([
      { planId: 'plan-active', isActive: true },
      { planId: 'plan-paused', isActive: false },
    ]);

    const event = createMockEvent({
      queryStringParameters: {
        assetId: VALID_ASSET_ID,
        status: 'all',
      },
    });

    const result = await getMaintenancePlanHandler(event);
    expect(result.statusCode).toBe(200);
    expect(maintenanceService.getMaintenancePlansByAsset).toHaveBeenCalledWith(
      VALID_ASSET_ID,
      true
    );

    const body = JSON.parse(result.body) as {
      data?: { items?: unknown[]; total?: number };
    };
    expect(body.data?.items).toHaveLength(2);
    expect(body.data?.total).toBe(2);
  });
});
