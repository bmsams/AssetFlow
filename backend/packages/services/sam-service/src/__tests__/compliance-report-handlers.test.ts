/**
 * Unit tests for Compliance Report Handlers
 *
 * Tests the Lambda handlers for compliance reporting:
 * - Generate compliance reports (POST /compliance/reports)
 * - Get existing reports (GET /compliance/reports/{reportId})
 * - Export reports (GET /compliance/reports/{reportId}/export)
 * - Get compliance summary (GET /compliance/summary)
 * - Get available publishers (GET /compliance/publishers)
 *
 * Requirements: 4.14, 16.7
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import { handler } from '../handlers/generate-compliance-report';
import * as complianceReportService from '../compliance-report/compliance-report-service';

// Mock the service
jest.mock('../compliance-report/compliance-report-service');

const mockService = complianceReportService as jest.Mocked<typeof complianceReportService>;

/**
 * Create a mock API Gateway event
 */
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/compliance/reports',
    pathParameters: null,
    queryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    requestContext: {
      requestId: 'test-request-id',
      authorizer: {
        claims: {
          sub: 'user-123',
        },
      },
      accountId: '123456789012',
      apiId: 'api-id',
      httpMethod: 'GET',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
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
        user: null,
        userArn: null,
      },
      path: '/compliance/reports',
      protocol: 'HTTP/1.1',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/compliance/reports',
      stage: 'test',
    },
    resource: '/compliance/reports',
    stageVariables: null,
    multiValueQueryStringParameters: null,
    ...overrides,
  };
}

describe('Compliance Report Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /compliance/reports - Generate Report', () => {
    const mockReport: complianceReportService.ComplianceReport = {
      reportId: 'report-123',
      reportType: 'FULL',
      generatedAt: '2024-06-15T10:00:00Z',
      generatedBy: 'user-123',
      filters: {},
      summary: {
        totalProducts: 10,
        compliantProducts: 7,
        overLicensedProducts: 2,
        underLicensedProducts: 1,
        totalEntitlements: 25,
        totalInstallations: 150,
        totalLicenseCost: 50000,
        potentialRiskExposure: 5000,
        complianceRate: 70,
      },
      products: [],
      metadata: {
        title: 'Test Report',
        description: 'Test description',
        generationDurationMs: 100,
        productCount: 10,
        entitlementCount: 25,
        installationCount: 150,
        evidenceCount: 10,
        auditEntryCount: 5,
      },
    };

    it('should generate a compliance report', async () => {
      mockService.generateComplianceReport.mockResolvedValue(mockReport);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          reportType: 'FULL',
          title: 'Q2 2024 Compliance Report',
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.reportId).toBe('report-123');
      expect(body.data.reportType).toBe('FULL');
    });

    it('should generate report with filters', async () => {
      mockService.generateComplianceReport.mockResolvedValue(mockReport);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          reportType: 'FULL',
          filters: {
            publishers: ['Microsoft', 'Adobe'],
            complianceStatus: 'UNDER_LICENSED',
            includeEvidence: true,
          },
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(201);
      expect(mockService.generateComplianceReport).toHaveBeenCalledWith(
        expect.objectContaining({
          reportType: 'FULL',
          filters: expect.objectContaining({
            publishers: ['Microsoft', 'Adobe'],
            complianceStatus: 'UNDER_LICENSED',
            includeEvidence: true,
          }),
        })
      );
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: 'invalid json',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 400 for invalid compliance status', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          filters: {
            complianceStatus: 'INVALID_STATUS',
          },
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid compliance status');
    });

    it('should return 400 for invalid product ID', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          filters: {
            productIds: ['not-a-uuid'],
          },
        }),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /compliance/reports/{reportId} - Get Report', () => {
    const mockReport: complianceReportService.ComplianceReport = {
      reportId: 'report-123',
      reportType: 'FULL',
      generatedAt: '2024-06-15T10:00:00Z',
      generatedBy: 'user-123',
      filters: {},
      summary: {
        totalProducts: 10,
        compliantProducts: 7,
        overLicensedProducts: 2,
        underLicensedProducts: 1,
        totalEntitlements: 25,
        totalInstallations: 150,
        totalLicenseCost: 50000,
        potentialRiskExposure: 5000,
        complianceRate: 70,
      },
      products: [],
      metadata: {
        title: 'Test Report',
        description: 'Test description',
        generationDurationMs: 100,
        productCount: 10,
        entitlementCount: 25,
        installationCount: 150,
        evidenceCount: 10,
        auditEntryCount: 5,
      },
    };

    it('should return existing report', async () => {
      mockService.getReport.mockResolvedValue(mockReport);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.reportId).toBe('report-123');
    });

    it('should return 404 for non-existent report', async () => {
      mockService.getReport.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('not found');
    });

    it('should return 400 for invalid report ID', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/invalid-uuid',
        pathParameters: { reportId: 'invalid-uuid' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /compliance/reports/{reportId}/export - Export Report', () => {
    const mockExportResult: complianceReportService.ExportResult = {
      reportId: 'report-123',
      format: 'CSV',
      filename: 'compliance-report-report-123.csv',
      content: 'CSV content here',
      contentType: 'text/csv',
      sizeBytes: 1024,
      generatedAt: '2024-06-15T10:00:00Z',
    };

    it('should export report as CSV', async () => {
      mockService.exportReport.mockResolvedValue(mockExportResult);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: { format: 'CSV' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.format).toBe('CSV');
      expect(body.data.filename).toContain('.csv');
    });

    it('should export report as Excel', async () => {
      const excelExport = { ...mockExportResult, format: 'EXCEL' as const, filename: 'report.xlsx' };
      mockService.exportReport.mockResolvedValue(excelExport);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: { format: 'EXCEL' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.exportReport).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'EXCEL'
      );
    });

    it('should export report as PDF', async () => {
      const pdfExport = { ...mockExportResult, format: 'PDF' as const, filename: 'report.pdf' };
      mockService.exportReport.mockResolvedValue(pdfExport);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: { format: 'PDF' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.exportReport).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'PDF'
      );
    });

    it('should default to CSV format', async () => {
      mockService.exportReport.mockResolvedValue(mockExportResult);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: null,
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.exportReport).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'CSV'
      );
    });

    it('should return 400 for invalid export format', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: { format: 'INVALID' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid export format');
    });

    it('should return 404 when report not found for export', async () => {
      mockService.exportReport.mockRejectedValue(new Error('Report not found: report-123'));

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/reports/550e8400-e29b-41d4-a716-446655440000/export',
        pathParameters: { reportId: '550e8400-e29b-41d4-a716-446655440000' },
        queryStringParameters: { format: 'CSV' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('GET /compliance/summary - Get Summary', () => {
    const mockSummary: complianceReportService.ComplianceReportSummary = {
      totalProducts: 10,
      compliantProducts: 7,
      overLicensedProducts: 2,
      underLicensedProducts: 1,
      totalEntitlements: 25,
      totalInstallations: 150,
      totalLicenseCost: 50000,
      potentialRiskExposure: 5000,
      complianceRate: 70,
    };

    it('should return compliance summary', async () => {
      mockService.getComplianceSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/summary',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.totalProducts).toBe(10);
      expect(body.data.complianceRate).toBe(70);
    });

    it('should apply publisher filter to summary', async () => {
      mockService.getComplianceSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/summary',
        queryStringParameters: { publishers: 'Microsoft,Adobe' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getComplianceSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          publishers: ['Microsoft', 'Adobe'],
        })
      );
    });

    it('should apply compliance status filter to summary', async () => {
      mockService.getComplianceSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/summary',
        queryStringParameters: { complianceStatus: 'UNDER_LICENSED' },
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getComplianceSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          complianceStatus: 'UNDER_LICENSED',
        })
      );
    });
  });

  describe('GET /compliance/publishers - Get Publishers', () => {
    it('should return list of publishers', async () => {
      mockService.getAvailablePublishers.mockResolvedValue([
        'Adobe',
        'Microsoft',
        'Oracle',
        'Salesforce',
      ]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/compliance/publishers',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.publishers).toHaveLength(4);
      expect(body.data.total).toBe(4);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockService.generateComplianceReport.mockRejectedValue(new Error('Database connection failed'));

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(500);
      const body = JSON.parse(result.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });

    it('should return 400 for invalid request method', async () => {
      const event = createMockEvent({
        httpMethod: 'DELETE',
        path: '/compliance/reports',
      });

      const result = await handler(event);

      expect(result.statusCode).toBe(400);
    });
  });
});
