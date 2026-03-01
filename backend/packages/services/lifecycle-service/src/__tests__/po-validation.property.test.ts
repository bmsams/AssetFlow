/**
 * Property Test: PO Validation Rejects Invalid Pricing
 *
 * Tag: Feature: po-header-line-items, Property 4: Validation rejects invalid pricing
 * Validates: Requirements 2.1, 2.5
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';
import * as fc from 'fast-check';

jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  resolveUserIdFromAuthId: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  ensureUserIdFromAuthClaims: jest.fn(async () => '123e4567-e89b-12d3-a456-426614174000'),
  withTransaction: jest.fn((fn) =>
    fn({
      queryOne: jest.fn(),
      queryMany: jest.fn(),
    })
  ),
}));

jest.mock('@ams/cache', () => ({
  del: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/events', () => ({
  publishEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
  now: () => '2024-01-15T10:00:00.000Z',
  validateUUID: jest.fn((value: string, fieldName: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  }),
}));

jest.mock('../procurement/procurement-service', () => ({
  createPurchaseOrder: jest.fn(),
}));

import { handler as createPurchaseOrderHandler } from '../handlers/create-purchase-order';
import * as procurementService from '../procurement/procurement-service';

const mockProcurementService = procurementService as jest.Mocked<typeof procurementService>;

function createMockEvent(body: unknown): APIGatewayProxyEvent {
  return {
    body: JSON.stringify(body),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/procurement/purchase-orders',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api',
      authorizer: {
        claims: {
          sub: '123e4567-e89b-12d3-a456-426614174000',
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
        userAgent: 'test',
        userArn: null,
      },
      path: '/procurement/purchase-orders',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/procurement/purchase-orders',
    },
    resource: '/procurement/purchase-orders',
  };
}

function extractValidationMessages(body: string): string[] {
  const parsed = JSON.parse(body) as {
    error?: {
      details?: ReadonlyArray<{ message?: string }>;
    };
  };
  return (parsed.error?.details ?? []).map((d) => d.message ?? '');
}

describe('PO Validation Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects negative unitPrice values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: -10000, max: -0.000001, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 1000 }),
        async (unitPrice, quantity) => {
          const event = createMockEvent({
            vendorName: 'Vendor A',
            lines: [
              {
                productName: 'Test Product',
                quantity,
                unitPrice,
              },
            ],
          });

          const response = await createPurchaseOrderHandler(event);
          const messages = extractValidationMessages(response.body);

          return (
            response.statusCode === 400 &&
            messages.some((msg) => msg.includes('unitPrice cannot be negative')) &&
            !mockProcurementService.createPurchaseOrder.mock.calls.length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects non-positive quantity values', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: -1000, max: 0 }), async (quantity) => {
        const event = createMockEvent({
          vendorName: 'Vendor A',
          lines: [
            {
              productName: 'Test Product',
              quantity,
              unitPrice: 10,
            },
          ],
        });

        const response = await createPurchaseOrderHandler(event);
        const messages = extractValidationMessages(response.body);

        return (
          response.statusCode === 400 &&
          messages.some((msg) => msg.includes('quantity must be greater than 0')) &&
          !mockProcurementService.createPurchaseOrder.mock.calls.length
        );
      }),
      { numRuns: 100 }
    );
  });
});
