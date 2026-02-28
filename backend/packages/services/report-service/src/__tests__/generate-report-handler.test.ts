/**
 * Generate Report Handler Unit Tests
 *
 * Tests for Generate Report Lambda Handler:
 * - Request validation
 * - Report generation
 * - Error handling
 */

// Mock the dependencies before importing handler
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${fieldName} must be a valid UUID` };
    }
    return null;
  }),
}));

// Mock the report service
jest.mock('../report/report-service');

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handlers/generate-report';
import * as reportService from '../report/report-service';

const mockReportService = reportService as jest.Mocked<typeof reportService>;

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/reports/generate',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
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
        userAgent: 'test-agent',
        userArn: null,
      },
      path: '/reports/generate',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/reports/generate',
    },
    resource: '/reports/generate',
    ...overrides,
  };
}

describe('Generate Report Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        }),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('request validation', () => {
    it('should return 400 when body is not valid JSON', async () => {
      const event = createMockEvent({
        body: 'invalid json',
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 400 when body is empty', async () => {
      const event = createMockEvent({
        body: null,
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when reportType is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('reportType is required') })
      );
    });

    it('should return 400 when reportType is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'INVALID_TYPE',
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('Invalid reportType') })
      );
    });

    it('should return 400 when format is missing', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('format is required') })
      );
    });

    it('should return 400 when format is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'INVALID_FORMAT',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('Invalid format') })
      );
    });

    it('should return 400 when title exceeds max length', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          title: 'a'.repeat(256),
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('title must be 255 characters or less') })
      );
    });

    it('should return 400 when filters.assetType is invalid', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            assetType: 'INVALID_TYPE',
          },
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('Invalid filters.assetType') })
      );
    });

    it('should return 400 when filters.dateFrom is after filters.dateTo', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            dateFrom: '2024-12-31T00:00:00.000Z',
            dateTo: '2024-01-01T00:00:00.000Z',
          },
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('dateFrom must be before') })
      );
    });

    it('should return 400 when filters.departmentId is not a valid UUID', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            departmentId: 'not-a-uuid',
          },
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when pageSize is out of range', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          pageSize: 20000,
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details).toContainEqual(
        expect.objectContaining({ message: expect.stringContaining('pageSize must be between 1 and 10000') })
      );
    });
  });

  describe('successful report generation', () => {
    beforeEach(() => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-123',
        status: 'COMPLETED',
        metadata: {
          reportId: 'report-123',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: '123e4567-e89b-12d3-a456-426614174000',
          format: 'CSV',
          filters: {},
          totalRecords: 100,
        },
        content: 'base64-encoded-content',
      });
    });

    it('should generate Asset Inventory report in CSV format', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('COMPLETED');
      expect(body.data.metadata.reportType).toBe('ASSET_INVENTORY');
      expect(body.data.metadata.format).toBe('CSV');
      expect(mockReportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        }),
        '123e4567-e89b-12d3-a456-426614174000'
      );
    });

    it('should generate Compliance Summary report in Excel format', async () => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-456',
        status: 'COMPLETED',
        metadata: {
          reportId: 'report-456',
          reportType: 'COMPLIANCE_SUMMARY',
          title: 'Compliance Summary Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: '123e4567-e89b-12d3-a456-426614174000',
          format: 'EXCEL',
          filters: {},
          totalRecords: 50,
        },
        content: 'base64-encoded-excel',
      });

      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'COMPLIANCE_SUMMARY',
          format: 'EXCEL',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.metadata.reportType).toBe('COMPLIANCE_SUMMARY');
      expect(body.data.metadata.format).toBe('EXCEL');
    });

    it('should generate Cost Analysis report in PDF format', async () => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-789',
        status: 'COMPLETED',
        metadata: {
          reportId: 'report-789',
          reportType: 'COST_ANALYSIS',
          title: 'Cost Analysis Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: '123e4567-e89b-12d3-a456-426614174000',
          format: 'PDF',
          filters: {},
          totalRecords: 25,
        },
        content: 'base64-encoded-pdf',
      });

      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'COST_ANALYSIS',
          format: 'PDF',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.metadata.reportType).toBe('COST_ANALYSIS');
      expect(body.data.metadata.format).toBe('PDF');
    });

    it('should generate Lifecycle Status report', async () => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-101',
        status: 'COMPLETED',
        metadata: {
          reportId: 'report-101',
          reportType: 'LIFECYCLE_STATUS',
          title: 'Lifecycle Status Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: '123e4567-e89b-12d3-a456-426614174000',
          format: 'CSV',
          filters: {},
          totalRecords: 200,
        },
        content: 'base64-encoded-content',
      });

      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'LIFECYCLE_STATUS',
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.metadata.reportType).toBe('LIFECYCLE_STATUS');
    });

    it('should pass filters to report service', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
          filters: {
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            dateFrom: '2024-01-01T00:00:00.000Z',
            dateTo: '2024-12-31T23:59:59.999Z',
          },
        }),
      });

      await handler(event);

      expect(mockReportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({
            assetType: 'HARDWARE',
            assetStatus: 'DEPLOYED',
            dateFrom: '2024-01-01T00:00:00.000Z',
            dateTo: '2024-12-31T23:59:59.999Z',
          }),
        }),
        expect.any(String)
      );
    });

    it('should pass optional parameters to report service', async () => {
      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'PDF',
          title: 'Custom Report Title',
          description: 'Custom description',
          includeCharts: true,
          pageSize: 500,
        }),
      });

      await handler(event);

      expect(mockReportService.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Custom Report Title',
          description: 'Custom description',
          includeCharts: true,
          pageSize: 500,
        }),
        expect.any(String)
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 when report generation fails', async () => {
      mockReportService.generateReport.mockResolvedValue({
        reportId: 'report-error',
        status: 'FAILED',
        metadata: {
          reportId: 'report-error',
          reportType: 'ASSET_INVENTORY',
          title: 'Asset Inventory Report',
          generatedAt: '2024-01-15T10:00:00.000Z',
          generatedBy: '123e4567-e89b-12d3-a456-426614174000',
          format: 'CSV',
          filters: {},
          totalRecords: 0,
        },
        errorMessage: 'Database connection failed',
      });

      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
      expect(body.error.message).toContain('Database connection failed');
    });

    it('should return 500 when service throws unexpected error', async () => {
      mockReportService.generateReport.mockRejectedValue(new Error('Unexpected error'));

      const event = createMockEvent({
        body: JSON.stringify({
          reportType: 'ASSET_INVENTORY',
          format: 'CSV',
        }),
      });

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});

