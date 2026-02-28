/**
 * Unit tests for Shadow IT Handlers
 *
 * Tests the Lambda handlers for shadow IT detection:
 * - Analyzing network traffic logs (Requirement 4.8)
 * - Creating and managing alerts (Requirement 4.9)
 *
 * Requirements: 4.8, 4.9
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

import * as shadowITService from '../shadow-it/shadow-it-service';
import {
  handler as analyzeShadowITHandler,
  getDetectionsHandler,
  getDetectionHandler,
  updateDetectionStatusHandler,
  getAlertsHandler,
  updateAlertStatusHandler,
  getSummaryHandler,
} from '../handlers/analyze-shadow-it';

// Mock the service
jest.mock('../shadow-it/shadow-it-service');

const mockService = shadowITService as jest.Mocked<typeof shadowITService>;

// Helper to create mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/shadow-it',
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
        userAgent: 'test',
        userArn: null,
      },
      path: '/shadow-it',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/shadow-it',
    },
    resource: '/shadow-it',
    ...overrides,
  };
}

describe('Shadow IT Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeShadowITHandler', () => {
    const mockAnalysisResult: shadowITService.AnalyzeShadowITResult = {
      analysisId: 'analysis-1',
      startedAt: '2024-01-15T10:00:00Z',
      completedAt: '2024-01-15T10:01:00Z',
      logsAnalyzed: 100,
      uniqueDomainsFound: 5,
      shadowITDetected: 3,
      alertsGenerated: 10,
      detections: [],
      alerts: [],
    };

    it('should analyze traffic logs successfully', async () => {
      mockService.analyzeShadowIT.mockResolvedValue(mockAnalysisResult);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          trafficLogs: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              userId: 'user-1',
              sourceIp: '192.168.1.100',
              destinationDomain: 'dropbox.com',
              destinationUrl: 'https://dropbox.com/upload',
              bytesTransferred: 1024,
              protocol: 'HTTPS',
            },
          ],
        }),
      });

      const result = await analyzeShadowITHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.analysisId).toBe('analysis-1');
      expect(body.data.shadowITDetected).toBe(3);
      expect(mockService.analyzeShadowIT).toHaveBeenCalled();
    });

    it('should return 400 for missing request body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: null,
      });

      const result = await analyzeShadowITHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Request body is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: 'invalid json',
      });

      const result = await analyzeShadowITHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 400 for invalid trafficLogs format', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          trafficLogs: 'not an array',
        }),
      });

      const result = await analyzeShadowITHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('trafficLogs must be an array');
    });

    it('should return 400 for invalid traffic log entry', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          trafficLogs: [
            {
              timestamp: '2024-01-15T10:00:00Z',
              // Missing required fields
            },
          ],
        }),
      });

      const result = await analyzeShadowITHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('trafficLogs[0]');
    });
  });

  describe('getDetectionsHandler', () => {
    const mockDetections: shadowITService.ShadowITDetection[] = [
      {
        detectionId: 'detection-1',
        applicationName: 'Dropbox',
        applicationDomain: 'dropbox.com',
        category: 'FILE_SHARING',
        riskLevel: 'HIGH',
        usersAffected: ['user-1'],
        firstDetectedAt: '2024-01-15T10:00:00Z',
        lastSeenAt: '2024-01-15T10:00:00Z',
        totalBytesTransferred: 1024000,
        accessCount: 1,
        status: 'DETECTED',
        reviewedBy: null,
        reviewedAt: null,
        reviewNotes: null,
        knownApplicationId: null,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
    ];

    const mockSummary = {
      totalDetections: 1,
      byStatus: { DETECTED: 1 },
      byRiskLevel: { HIGH: 1 },
      byCategory: { FILE_SHARING: 1 },
      totalUsersAffected: 1,
      totalAlerts: 1,
      newAlerts: 1,
    };

    it('should return detections successfully', async () => {
      mockService.getDetections.mockResolvedValue(mockDetections);
      mockService.getShadowITSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent();

      const result = await getDetectionsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(1);
      expect(body.data.summary).toBeDefined();
    });

    it('should filter by status', async () => {
      mockService.getDetections.mockResolvedValue(mockDetections);
      mockService.getShadowITSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({
        queryStringParameters: { status: 'DETECTED' },
      });

      const result = await getDetectionsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getDetections).toHaveBeenCalledWith('DETECTED', 100);
    });

    it('should return 400 for invalid status', async () => {
      const event = createMockEvent({
        queryStringParameters: { status: 'INVALID' },
      });

      const result = await getDetectionsHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('status must be one of');
    });

    it('should return 400 for invalid limit', async () => {
      const event = createMockEvent({
        queryStringParameters: { limit: '0' },
      });

      const result = await getDetectionsHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('limit must be a number');
    });
  });

  describe('getDetectionHandler', () => {
    const mockDetection: shadowITService.ShadowITDetection = {
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      category: 'FILE_SHARING',
      riskLevel: 'HIGH',
      usersAffected: ['user-1'],
      firstDetectedAt: '2024-01-15T10:00:00Z',
      lastSeenAt: '2024-01-15T10:00:00Z',
      totalBytesTransferred: 1024000,
      accessCount: 1,
      status: 'DETECTED',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      knownApplicationId: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    it('should return detection by ID', async () => {
      mockService.getDetection.mockResolvedValue(mockDetection);
      mockService.getAlertsByDetection.mockResolvedValue([]);

      const event = createMockEvent({
        pathParameters: { detectionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await getDetectionHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.detection.detectionId).toBe('detection-1');
    });

    it('should return 404 for non-existent detection', async () => {
      mockService.getDetection.mockResolvedValue(null);

      const event = createMockEvent({
        pathParameters: { detectionId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await getDetectionHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for invalid UUID', async () => {
      const event = createMockEvent({
        pathParameters: { detectionId: 'invalid-uuid' },
      });

      const result = await getDetectionHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('updateDetectionStatusHandler', () => {
    const mockDetection: shadowITService.ShadowITDetection = {
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      category: 'FILE_SHARING',
      riskLevel: 'HIGH',
      usersAffected: ['user-1'],
      firstDetectedAt: '2024-01-15T10:00:00Z',
      lastSeenAt: '2024-01-15T10:00:00Z',
      totalBytesTransferred: 1024000,
      accessCount: 1,
      status: 'APPROVED',
      reviewedBy: 'reviewer-1',
      reviewedAt: '2024-01-16T10:00:00Z',
      reviewNotes: 'Approved for use',
      knownApplicationId: null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
    };

    it('should update detection status', async () => {
      mockService.updateDetectionStatus.mockResolvedValue(mockDetection);

      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { detectionId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          status: 'APPROVED',
          reviewNotes: 'Approved for use',
        }),
      });

      const result = await updateDetectionStatusHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('APPROVED');
    });

    it('should return 400 for invalid status', async () => {
      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { detectionId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          status: 'INVALID',
        }),
      });

      const result = await updateDetectionStatusHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('getAlertsHandler', () => {
    const mockAlerts: shadowITService.ShadowITAlert[] = [
      {
        alertId: 'alert-1',
        detectionId: 'detection-1',
        applicationName: 'Dropbox',
        applicationDomain: 'dropbox.com',
        userId: 'user-1',
        userEmail: 'user@example.com',
        riskLevel: 'HIGH',
        accessCount: 5,
        bytesTransferred: 1024000,
        firstAccessAt: '2024-01-15T10:00:00Z',
        lastAccessAt: '2024-01-15T12:00:00Z',
        status: 'NEW',
        acknowledgedBy: null,
        acknowledgedAt: null,
        resolvedBy: null,
        resolvedAt: null,
        notes: null,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:00:00Z',
      },
    ];

    it('should return alerts successfully', async () => {
      mockService.getAlertsByStatus.mockResolvedValue(mockAlerts);

      const event = createMockEvent();

      const result = await getAlertsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.items).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockService.getAlertsByStatus.mockResolvedValue(mockAlerts);

      const event = createMockEvent({
        queryStringParameters: { status: 'NEW' },
      });

      const result = await getAlertsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getAlertsByStatus).toHaveBeenCalledWith('NEW', 100);
    });

    it('should filter by userId', async () => {
      mockService.getAlertsByUser.mockResolvedValue(mockAlerts);

      const event = createMockEvent({
        queryStringParameters: { userId: '550e8400-e29b-41d4-a716-446655440000' },
      });

      const result = await getAlertsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.getAlertsByUser).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('updateAlertStatusHandler', () => {
    const mockAlert: shadowITService.ShadowITAlert = {
      alertId: 'alert-1',
      detectionId: 'detection-1',
      applicationName: 'Dropbox',
      applicationDomain: 'dropbox.com',
      userId: 'user-1',
      userEmail: null,
      riskLevel: 'HIGH',
      accessCount: 1,
      bytesTransferred: 1024000,
      firstAccessAt: '2024-01-15T10:00:00Z',
      lastAccessAt: '2024-01-15T10:00:00Z',
      status: 'ACKNOWLEDGED',
      acknowledgedBy: 'admin-1',
      acknowledgedAt: '2024-01-16T10:00:00Z',
      resolvedBy: null,
      resolvedAt: null,
      notes: 'Investigating',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-16T10:00:00Z',
    };

    it('should acknowledge alert', async () => {
      mockService.acknowledgeAlert.mockResolvedValue(mockAlert);

      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { alertId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          action: 'acknowledge',
          notes: 'Investigating',
        }),
      });

      const result = await updateAlertStatusHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('ACKNOWLEDGED');
    });

    it('should resolve alert', async () => {
      const resolvedAlert = { ...mockAlert, status: 'RESOLVED' as const };
      mockService.resolveAlert.mockResolvedValue(resolvedAlert);

      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { alertId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          action: 'resolve',
          notes: 'Issue resolved',
        }),
      });

      const result = await updateAlertStatusHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.resolveAlert).toHaveBeenCalled();
    });

    it('should ignore alert', async () => {
      const ignoredAlert = { ...mockAlert, status: 'IGNORED' as const };
      mockService.ignoreAlert.mockResolvedValue(ignoredAlert);

      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { alertId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          action: 'ignore',
          notes: 'False positive',
        }),
      });

      const result = await updateAlertStatusHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockService.ignoreAlert).toHaveBeenCalled();
    });

    it('should return 400 for invalid action', async () => {
      const event = createMockEvent({
        httpMethod: 'PATCH',
        pathParameters: { alertId: '550e8400-e29b-41d4-a716-446655440000' },
        body: JSON.stringify({
          action: 'invalid',
        }),
      });

      const result = await updateAlertStatusHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('action must be one of');
    });
  });

  describe('getSummaryHandler', () => {
    const mockSummary = {
      totalDetections: 10,
      byStatus: { DETECTED: 5, APPROVED: 3, BLOCKED: 2 },
      byRiskLevel: { LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 1 },
      byCategory: { FILE_SHARING: 5, COLLABORATION: 3, DEVELOPMENT: 2 },
      totalUsersAffected: 25,
      totalAlerts: 50,
      newAlerts: 15,
    };

    it('should return summary successfully', async () => {
      mockService.getShadowITSummary.mockResolvedValue(mockSummary);
      mockService.getKnownApplications.mockResolvedValue([]);
      mockService.getApprovedApplications.mockResolvedValue([]);
      mockService.getBlockedApplications.mockResolvedValue([]);

      const event = createMockEvent();

      const result = await getSummaryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.summary.totalDetections).toBe(10);
      expect(body.data.summary.newAlerts).toBe(15);
    });
  });
});
