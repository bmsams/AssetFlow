import type { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@ams/database', () => ({
  ensureUserIdFromAuthClaims: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(),
  queryOne: jest.fn(),
}));

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
  createWorkOrder: jest.fn(),
}));

jest.mock('../work-order/work-order-service', () => ({
  listWorkOrders: jest.fn(),
}));

import { ensureUserIdFromAuthClaims, queryOne, resolveUserIdFromAuthId } from '@ams/database';
import { handler as createWorkOrderHandler } from '../handlers/create-work-order';
import { listWorkOrdersHandler } from '../handlers/work-order-handlers';
import * as maintenanceService from '../maintenance/maintenance-service';
import * as workOrderService from '../work-order/work-order-service';

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/eam/work-orders',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: '550e8400-e29b-41d4-a716-4466554400aa',
          email: 'test@example.com',
          given_name: 'Test',
          family_name: 'User',
        },
      },
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
      path: '/eam/work-orders',
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/eam/work-orders',
    },
    resource: '/eam/work-orders',
    ...overrides,
  };
}

const VALID_ASSET_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_BUILDING_ID = '550e8400-e29b-41d4-a716-446655440002';
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440003';

describe('Work Order API Building Scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (resolveUserIdFromAuthId as jest.Mock).mockResolvedValue(VALID_USER_ID);
    (ensureUserIdFromAuthClaims as jest.Mock).mockResolvedValue(VALID_USER_ID);
  });

  describe('create-work-order handler', () => {
    it('returns 400 when buildingId format is invalid', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          workType: 'CORRECTIVE',
          title: 'Inspect pump',
          buildingId: 'not-a-uuid',
        }),
      });

      const result = await createWorkOrderHandler(event);
      expect(result.statusCode).toBe(400);
      expect(maintenanceService.createWorkOrder).not.toHaveBeenCalled();
    });

    it('returns 400 when asset does not belong to provided buildingId', async () => {
      (queryOne as jest.Mock).mockResolvedValue({ matches: false });

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          workType: 'CORRECTIVE',
          title: 'Inspect pump',
          buildingId: VALID_BUILDING_ID,
        }),
      });

      const result = await createWorkOrderHandler(event);

      expect(result.statusCode).toBe(400);
      expect(queryOne).toHaveBeenCalledTimes(1);
      expect(maintenanceService.createWorkOrder).not.toHaveBeenCalled();

      const body = JSON.parse(result.body) as { error?: { message?: string } };
      expect(body.error?.message).toContain('assetId does not belong');
    });

    it('creates work order when asset matches building scope', async () => {
      (queryOne as jest.Mock).mockResolvedValue({ matches: true });
      (maintenanceService.createWorkOrder as jest.Mock).mockResolvedValue({
        workOrderId: '550e8400-e29b-41d4-a716-446655440099',
        workOrderNumber: 'WO-TEST-0001',
        assetId: VALID_ASSET_ID,
        maintenancePlanId: null,
        workType: 'CORRECTIVE',
        priority: 'MEDIUM',
        status: 'OPEN',
        title: 'Inspect pump',
        description: null,
        instructions: null,
        assignedTo: null,
        assignedBy: null,
        assignedDate: null,
        scheduledDate: null,
        dueDate: null,
        startedDate: null,
        completedDate: null,
        completionNotes: null,
        estimatedDurationHours: null,
        actualDurationHours: null,
        estimatedCost: null,
        actualLaborCost: null,
        actualPartsCost: null,
        actualTotalCost: null,
        workLocation: null,
        facilityId: null,
        requiresApproval: false,
        approvedBy: null,
        approvedDate: null,
        parentWorkOrderId: null,
        createdAt: '2026-02-22T00:00:00.000Z',
        updatedAt: '2026-02-22T00:00:00.000Z',
        createdBy: VALID_USER_ID,
        updatedBy: VALID_USER_ID,
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          assetId: VALID_ASSET_ID,
          workType: 'CORRECTIVE',
          title: 'Inspect pump',
          buildingId: VALID_BUILDING_ID,
        }),
      });

      const result = await createWorkOrderHandler(event);

      expect(result.statusCode).toBe(201);
      expect(queryOne).toHaveBeenCalledTimes(1);
      expect(maintenanceService.createWorkOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: VALID_ASSET_ID,
          workType: 'CORRECTIVE',
          title: 'Inspect pump',
          createdBy: VALID_USER_ID,
        })
      );
      expect((maintenanceService.createWorkOrder as jest.Mock).mock.calls[0][0]).not.toHaveProperty(
        'buildingId'
      );
    });
  });

  describe('list-work-orders handler', () => {
    it('returns 400 for invalid buildingId query parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          buildingId: 'not-a-uuid',
        },
      });

      const result = await listWorkOrdersHandler(event);
      expect(result.statusCode).toBe(400);
      expect(workOrderService.listWorkOrders).not.toHaveBeenCalled();
    });

    it('returns 400 when building query value is blank/whitespace', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          building: '   ',
        },
      });

      const result = await listWorkOrdersHandler(event);
      expect(result.statusCode).toBe(400);
      expect(workOrderService.listWorkOrders).not.toHaveBeenCalled();
    });

    it('passes buildingId filter to service when query is valid', async () => {
      (workOrderService.listWorkOrders as jest.Mock).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          buildingId: VALID_BUILDING_ID,
          status: 'OPEN',
          page: '1',
          limit: '25',
        },
      });

      const result = await listWorkOrdersHandler(event);

      expect(result.statusCode).toBe(200);
      expect(workOrderService.listWorkOrders).toHaveBeenCalledWith(
        expect.objectContaining({
          buildingId: VALID_BUILDING_ID,
          status: 'OPEN',
        }),
        expect.objectContaining({
          page: 1,
          limit: 25,
        })
      );
    });
  });
});
