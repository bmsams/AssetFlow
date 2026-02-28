/**
 * Schedule Handlers Unit Tests
 *
 * Tests for Report Schedule Handlers:
 * - scheduleReport handler (Requirement 16.4)
 * - getScheduledReports handler
 * - Pause/resume handlers
 * - processScheduledReports handler
 */

// Mock the dependencies before importing handlers
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
  validateUUID: jest.fn((value: string) => {
    // Accept valid UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: 'Invalid UUID format' };
    }
    return null;
  }),
}));

// Mock the schedule service
jest.mock('../schedule/schedule-service');

import type { APIGatewayProxyEvent } from 'aws-lambda';
import * as scheduleHandlers from '../handlers/schedule-handlers';
import * as scheduleService from '../schedule/schedule-service';
import type { ReportSchedule } from '../report/report-types';

const mockScheduleService = scheduleService as jest.Mocked<typeof scheduleService>;


// Helper to create mock API Gateway event
function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    body: null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'GET',
    isBase64Encoded: false,
    path: '/schedules',
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
      path: '/schedules',
      stage: 'test',
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      resourceId: 'resource-id',
      resourcePath: '/schedules',
    },
    resource: '/schedules',
    ...overrides,
  };
}

describe('Schedule Handlers', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174000';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleReportHandler', () => {
    const validRequestBody = {
      name: 'Daily Asset Report',
      reportType: 'ASSET_INVENTORY',
      reportConfig: {
        reportType: 'ASSET_INVENTORY',
        format: 'PDF',
      },
      frequency: 'DAILY',
      timeOfDay: '08:00',
      recipients: ['admin@example.com'],
    };

    it('should create a schedule successfully', async () => {
      const mockSchedule: ReportSchedule = {
        scheduleId: 'schedule-1',
        name: 'Daily Asset Report',
        reportType: 'ASSET_INVENTORY',
        reportConfig: {
          reportType: 'ASSET_INVENTORY' as const,
          format: 'PDF' as const,
        },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'ACTIVE',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleService.createSchedule.mockResolvedValue(mockSchedule);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify(validRequestBody),
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(201);
      const body = JSON.parse(result.body);
      expect(body.data.scheduleId).toBe('schedule-1');
      expect(body.data.name).toBe('Daily Asset Report');
    });

    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify(validRequestBody),
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(401);
    });

    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: 'invalid json',
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid JSON');
    });

    it('should return 400 when name is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ ...validRequestBody, name: undefined }),
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when frequency is invalid', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ ...validRequestBody, frequency: 'INVALID' }),
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when recipients is empty', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ ...validRequestBody, recipients: [] }),
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when email is invalid', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ ...validRequestBody, recipients: ['invalid-email'] }),
      });

      const result = await scheduleHandlers.scheduleReportHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('getScheduledReportsHandler', () => {
    it('should return list of schedules', async () => {
      mockScheduleService.listSchedules.mockResolvedValue({
        schedules: [],
        total: 0,
        page: 1,
        limit: 20,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.schedules).toEqual([]);
      expect(body.data.total).toBe(0);
    });

    it('should return 401 when user is not authenticated', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        requestContext: {
          ...createMockEvent().requestContext,
          authorizer: {},
        },
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(401);
    });

    it('should pass pagination parameters to service', async () => {
      mockScheduleService.listSchedules.mockResolvedValue({
        schedules: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          page: '2',
          limit: '10',
        },
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(200);
      expect(mockScheduleService.listSchedules).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10,
        })
      );
    });

    it('should return 400 for invalid page parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          page: '0',
        },
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          limit: '200',
        },
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 for invalid status filter', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        queryStringParameters: {
          status: 'INVALID',
        },
      });

      const result = await scheduleHandlers.getScheduledReportsHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('getScheduleHandler', () => {
    it('should return schedule when found', async () => {
      const mockSchedule: ReportSchedule = {
        scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Schedule',
        reportType: 'ASSET_INVENTORY',
        reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'ACTIVE',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleService.getSchedule.mockResolvedValue(mockSchedule);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.getScheduleHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.scheduleId).toBe('123e4567-e89b-12d3-a456-426614174001');
    });

    it('should return 404 when schedule not found', async () => {
      mockScheduleService.getSchedule.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.getScheduleHandler(event);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for invalid schedule ID', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          scheduleId: 'invalid-uuid',
        },
      });

      const result = await scheduleHandlers.getScheduleHandler(event);

      expect(result.statusCode).toBe(400);
    });
  });


  describe('pauseScheduleHandler', () => {
    it('should pause schedule successfully', async () => {
      const mockSchedule: ReportSchedule = {
        scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Schedule',
        reportType: 'ASSET_INVENTORY',
        reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'PAUSED',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleService.pauseSchedule.mockResolvedValue(mockSchedule);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.pauseScheduleHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('PAUSED');
    });

    it('should return 404 when schedule not found', async () => {
      mockScheduleService.pauseSchedule.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.pauseScheduleHandler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('resumeScheduleHandler', () => {
    it('should resume schedule successfully', async () => {
      const mockSchedule: ReportSchedule = {
        scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Schedule',
        reportType: 'ASSET_INVENTORY',
        reportConfig: { reportType: 'ASSET_INVENTORY', format: 'PDF' },
        frequency: 'DAILY',
        timeOfDay: '08:00',
        timezone: 'UTC',
        recipients: ['admin@example.com'],
        status: 'ACTIVE',
        createdBy: userId,
        createdAt: '2024-01-15T10:00:00.000Z',
        updatedAt: '2024-01-15T10:00:00.000Z',
        nextRunAt: '2024-01-16T08:00:00.000Z',
        runCount: 0,
        failureCount: 0,
      };

      mockScheduleService.resumeSchedule.mockResolvedValue(mockSchedule);

      const event = createMockEvent({
        httpMethod: 'POST',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.resumeScheduleHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.status).toBe('ACTIVE');
    });
  });

  describe('deleteScheduleHandler', () => {
    it('should delete schedule successfully', async () => {
      mockScheduleService.deleteSchedule.mockResolvedValue(true);

      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.deleteScheduleHandler(event);

      expect(result.statusCode).toBe(204);
    });

    it('should return 404 when schedule not found', async () => {
      mockScheduleService.deleteSchedule.mockResolvedValue(false);

      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.deleteScheduleHandler(event);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('getScheduleExecutionHistoryHandler', () => {
    it('should return execution history', async () => {
      mockScheduleService.getScheduleExecutionHistory.mockResolvedValue([
        {
          executionId: 'exec-1',
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
          status: 'COMPLETED',
          startedAt: '2024-01-15T08:00:00.000Z',
          completedAt: '2024-01-15T08:01:00.000Z',
          duration: 60000,
          recipientCount: 2,
          deliveredCount: 2,
          failedCount: 0,
        },
      ]);

      const event = createMockEvent({
        httpMethod: 'GET',
        pathParameters: {
          scheduleId: '123e4567-e89b-12d3-a456-426614174001',
        },
      });

      const result = await scheduleHandlers.getScheduleExecutionHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.executions).toHaveLength(1);
    });
  });
});
