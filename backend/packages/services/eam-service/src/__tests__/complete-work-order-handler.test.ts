import type { APIGatewayProxyEvent } from 'aws-lambda';

jest.mock('@ams/database', () => ({
  ensureUserIdFromAuthClaims: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(),
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
  getWorkOrder: jest.fn(),
  completeWorkOrder: jest.fn(),
}));

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import { handler } from '../handlers/complete-work-order';
import * as maintenanceService from '../maintenance/maintenance-service';

const WORK_ORDER_ID = '550e8400-e29b-41d4-a716-446655440010';
const AUTH_SUB = '550e8400-e29b-41d4-a716-446655440011';
const DB_USER_ID = '550e8400-e29b-41d4-a716-446655440012';

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: '{}',
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: `/eam/work-orders/${WORK_ORDER_ID}/complete`,
    pathParameters: { workOrderId: WORK_ORDER_ID },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: AUTH_SUB,
          email: 'testuser@example.com',
          given_name: 'Test',
          family_name: 'User',
        },
      },
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
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
      path: `/eam/work-orders/${WORK_ORDER_ID}/complete`,
      stage: 'test',
      requestId: 'request-123',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/eam/work-orders/{workOrderId}/complete',
    },
    resource: '/eam/work-orders/{workOrderId}/complete',
    ...overrides,
  };
}

describe('complete-work-order handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveUserIdFromAuthId as jest.Mock).mockResolvedValue(DB_USER_ID);
    (ensureUserIdFromAuthClaims as jest.Mock).mockResolvedValue(DB_USER_ID);
  });

  it('returns 401 when auth sub is missing', async () => {
    const event = createMockEvent({
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: { claims: {} },
      },
    });

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(maintenanceService.completeWorkOrder).not.toHaveBeenCalled();
  });

  it('passes resolved DB user id into completeWorkOrder', async () => {
    (maintenanceService.getWorkOrder as jest.Mock).mockResolvedValue({
      workOrderId: WORK_ORDER_ID,
      status: 'OPEN',
    });
    (maintenanceService.completeWorkOrder as jest.Mock).mockResolvedValue({
      workOrderId: WORK_ORDER_ID,
      workOrderNumber: 'WO-0001',
      completedDate: '2026-02-22T00:00:00.000Z',
      actualTotalCost: 0,
    });

    const event = createMockEvent();
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    expect(resolveUserIdFromAuthId).toHaveBeenCalledWith(AUTH_SUB);
    expect(maintenanceService.completeWorkOrder).toHaveBeenCalledWith(
      WORK_ORDER_ID,
      null,
      null,
      null,
      null,
      DB_USER_ID
    );
  });
});
