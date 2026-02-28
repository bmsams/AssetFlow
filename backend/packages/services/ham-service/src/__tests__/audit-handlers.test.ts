/**
 * Audit Handlers Unit Tests
 *
 * Tests for Lambda handlers:
 * - recordAuditScan (Requirement 3.4)
 * - getAuditDiscrepancies (Requirement 3.5)
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

// Mock dependencies
jest.mock('@ams/types', () => ({
  API_ERROR_CODES: {
    BAD_REQUEST: 'BAD_REQUEST',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500,
  },
  createApiResponse: jest.fn((data, requestId) => ({
    success: true,
    data,
    requestId,
  })),
  createErrorResponse: jest.fn((code, message, requestId, errors) => ({
    success: false,
    error: { code, message, errors },
    requestId,
  })),
  createLambdaResponse: jest.fn((statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  validateUUID: jest.fn((value, field) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!value || !uuidRegex.test(value)) {
      return { message: `${field} must be a valid UUID` };
    }
    return null;
  }),
}));

jest.mock('../audit/audit-service', () => ({
  recordAuditScan: jest.fn(),
  getAuditDiscrepancies: jest.fn(),
}));

import { createApiResponse, createErrorResponse, HTTP_STATUS } from '@ams/types';

import * as auditService from '../audit/audit-service';
import { handler as recordAuditScanHandler } from '../handlers/record-audit-scan';
import { handler as getAuditDiscrepanciesHandler } from '../handlers/get-audit-discrepancies';

/**
 * Create mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/audits',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      authorizer: {
        claims: {
          sub: 'user-001',
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
        userAgent: 'test',
        userArn: null,
      },
      path: '/audits',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/audits',
    },
    resource: '/audits',
    ...overrides,
  };
}

describe('recordAuditScan Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when auditId is missing', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: null,
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Audit ID is required',
      'test-request-id'
    );
  });

  it('should return 400 when auditId is invalid UUID', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'invalid-uuid' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      expect.stringContaining('UUID'),
      'test-request-id'
    );
  });

  it('should return 401 when user is not authenticated', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
      requestContext: {
        ...createMockEvent().requestContext,
        authorizer: {},
      },
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'UNAUTHORIZED',
      'User authentication required',
      'test-request-id'
    );
  });

  it('should return 400 when body is invalid JSON', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: 'invalid json',
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Invalid JSON in request body',
      'test-request-id'
    );
  });

  it('should return 400 when barcodeScanned is missing', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({}),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Validation failed',
      'test-request-id',
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('barcodeScanned') }),
      ])
    );
  });

  it('should return 400 when barcodeScanned is empty', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: '' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Validation failed',
      'test-request-id',
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('barcodeScanned') }),
      ])
    );
  });

  it('should return 400 when foundCondition is invalid', async () => {
    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456', foundCondition: 'INVALID' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      'Validation failed',
      'test-request-id',
      expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('foundCondition') }),
      ])
    );
  });

  it('should record scan successfully', async () => {
    const mockResult = {
      scan: {
        scanId: 'scan-001',
        auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        assetTag: 'AST-123456',
        barcodeScanned: 'AST-123456',
        isDiscrepancy: false,
      },
      asset: {
        assetId: 'asset-001',
        assetTag: 'AST-123456',
        serialNumber: 'SN001',
      },
      discrepancy: null,
      auditUpdated: {
        auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        itemsFound: 1,
        discrepancyCount: 0,
      },
    };

    (auditService.recordAuditScan as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(auditService.recordAuditScan).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'AST-123456',
      'user-001',
      {
        foundLocation: undefined,
        foundCondition: undefined,
        notes: undefined,
      }
    );
    expect(createApiResponse).toHaveBeenCalledWith(mockResult, 'test-request-id');
  });

  it('should record scan with optional fields', async () => {
    const mockResult = {
      scan: {
        scanId: 'scan-001',
        auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        assetTag: 'AST-123456',
        foundLocation: 'BIN-A1',
        foundCondition: 'GOOD',
        notes: 'Test note',
      },
      asset: null,
      discrepancy: null,
      auditUpdated: {},
    };

    (auditService.recordAuditScan as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({
        barcodeScanned: 'AST-123456',
        foundLocation: 'BIN-A1',
        foundCondition: 'GOOD',
        notes: 'Test note',
      }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(auditService.recordAuditScan).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'AST-123456',
      'user-001',
      {
        foundLocation: 'BIN-A1',
        foundCondition: 'GOOD',
        notes: 'Test note',
      }
    );
  });

  it('should return discrepancy when asset not expected', async () => {
    const mockResult = {
      scan: {
        scanId: 'scan-001',
        auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        assetTag: 'AST-999999',
        isDiscrepancy: true,
        discrepancyType: 'EXTRA',
      },
      asset: null,
      discrepancy: {
        type: 'EXTRA',
        description: 'Unknown asset scanned: AST-999999',
      },
      auditUpdated: {
        discrepancyCount: 1,
      },
    };

    (auditService.recordAuditScan as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-999999' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.CREATED);
    expect(createApiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        discrepancy: expect.objectContaining({ type: 'EXTRA' }),
      }),
      'test-request-id'
    );
  });

  it('should return 404 when audit not found', async () => {
    (auditService.recordAuditScan as jest.Mock).mockRejectedValue(
      new Error('Audit not found: a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    );

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'NOT_FOUND',
      expect.stringContaining('not found'),
      'test-request-id'
    );
  });

  it('should return 400 when audit not in progress', async () => {
    (auditService.recordAuditScan as jest.Mock).mockRejectedValue(
      new Error('Audit is not in progress. Current status: COMPLETED')
    );

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      expect.stringContaining('not in progress'),
      'test-request-id'
    );
  });

  it('should return 409 when asset already scanned', async () => {
    (auditService.recordAuditScan as jest.Mock).mockRejectedValue(
      new Error('Asset already scanned in this audit: AST-123456')
    );

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.CONFLICT);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'CONFLICT',
      expect.stringContaining('already scanned'),
      'test-request-id'
    );
  });

  it('should return 500 on unexpected error', async () => {
    (auditService.recordAuditScan as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const event = createMockEvent({
      httpMethod: 'POST',
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      body: JSON.stringify({ barcodeScanned: 'AST-123456' }),
    });

    const result = await recordAuditScanHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'INTERNAL_ERROR',
      'Failed to record audit scan',
      'test-request-id'
    );
  });
});

describe('getAuditDiscrepancies Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when auditId is missing', async () => {
    const event = createMockEvent({
      pathParameters: null,
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'BAD_REQUEST',
      'Audit ID is required',
      'test-request-id'
    );
  });

  it('should return 400 when auditId is invalid UUID', async () => {
    const event = createMockEvent({
      pathParameters: { auditId: 'invalid-uuid' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'VALIDATION_ERROR',
      expect.stringContaining('UUID'),
      'test-request-id'
    );
  });

  it('should return discrepancies with default pagination', async () => {
    const mockResult = {
      auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      stockroomId: 'stockroom-001',
      summary: {
        itemsExpected: 100,
        itemsScanned: 95,
        itemsMatched: 90,
        itemsMissing: 5,
        itemsExtra: 3,
        itemsDamaged: 2,
        totalDiscrepancies: 10,
        accuracyPercentage: 90.0,
      },
      discrepancies: {
        items: [
          {
            scanId: 'scan-001',
            assetTag: 'AST-001',
            discrepancyType: 'MISSING',
          },
        ],
        total: 10,
        page: 1,
        limit: 50,
        hasMore: false,
      },
    };

    (auditService.getAuditDiscrepancies as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(auditService.getAuditDiscrepancies).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      { page: 1, limit: 50 }
    );
    expect(createApiResponse).toHaveBeenCalledWith(mockResult, 'test-request-id');
  });

  it('should parse pagination parameters from query string', async () => {
    const mockResult = {
      auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      stockroomId: 'stockroom-001',
      summary: {
        itemsExpected: 100,
        itemsScanned: 95,
        itemsMatched: 90,
        itemsMissing: 5,
        itemsExtra: 3,
        itemsDamaged: 2,
        totalDiscrepancies: 10,
        accuracyPercentage: 90.0,
      },
      discrepancies: {
        items: [],
        total: 10,
        page: 2,
        limit: 25,
        hasMore: false,
      },
    };

    (auditService.getAuditDiscrepancies as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
      queryStringParameters: { page: '2', limit: '25' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(auditService.getAuditDiscrepancies).toHaveBeenCalledWith(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      { page: 2, limit: 25 }
    );
  });

  it('should return 404 when audit not found', async () => {
    (auditService.getAuditDiscrepancies as jest.Mock).mockRejectedValue(
      new Error('Audit not found: a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    );

    const event = createMockEvent({
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'NOT_FOUND',
      expect.stringContaining('not found'),
      'test-request-id'
    );
  });

  it('should return 500 on unexpected error', async () => {
    (auditService.getAuditDiscrepancies as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const event = createMockEvent({
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(createErrorResponse).toHaveBeenCalledWith(
      'INTERNAL_ERROR',
      'Failed to get audit discrepancies',
      'test-request-id'
    );
  });

  it('should handle audit with no discrepancies', async () => {
    const mockResult = {
      auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      stockroomId: 'stockroom-001',
      summary: {
        itemsExpected: 50,
        itemsScanned: 50,
        itemsMatched: 50,
        itemsMissing: 0,
        itemsExtra: 0,
        itemsDamaged: 0,
        totalDiscrepancies: 0,
        accuracyPercentage: 100.0,
      },
      discrepancies: {
        items: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
      },
    };

    (auditService.getAuditDiscrepancies as jest.Mock).mockResolvedValue(mockResult);

    const event = createMockEvent({
      pathParameters: { auditId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    });

    const result = await getAuditDiscrepanciesHandler(event);

    expect(result.statusCode).toBe(HTTP_STATUS.OK);
    expect(createApiResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          totalDiscrepancies: 0,
          accuracyPercentage: 100.0,
        }),
      }),
      'test-request-id'
    );
  });
});
