/**
 * Send Notification Handler Unit Tests
 *
 * Tests for Send Notification Lambda Handler:
 * - Request validation
 * - Multi-channel notification delivery (Requirement 17.1)
 * - Template variable substitution (Requirement 17.7)
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
  validateUUID: jest.fn((value: string, field: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      return { message: `${field} must be a valid UUID` };
    }
    return null;
  }),
}));

// Mock the notification service
jest.mock('../notification/notification-service');

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../handlers/send-notification';
import * as notificationService from '../notification/notification-service';

const mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;


/**
 * Create a mock API Gateway event
 */
function createMockEvent(body: unknown, userId?: string): APIGatewayProxyEvent {
  return {
    body: body ? JSON.stringify(body) : null,
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/notifications',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {
      requestId: 'test-request-id',
      authorizer: userId ? { claims: { sub: userId } } : undefined,
      accountId: '123456789012',
      apiId: 'test-api',
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
      path: '/notifications',
      protocol: 'HTTP/1.1',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: '/notifications',
      stage: 'test',
    },
    resource: '/notifications',
  };
}

describe('Send Notification Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const event = createMockEvent(null, 'user-123');
      event.body = 'invalid json';

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid JSON in request body');
    });

    it('should return 400 when recipientId is missing', async () => {
      const event = createMockEvent({
        channels: ['EMAIL'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when recipientId is not a valid UUID', async () => {
      const event = createMockEvent({
        recipientId: 'not-a-uuid',
        channels: ['EMAIL'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
        recipientEmail: 'test@example.com',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });


    it('should return 400 when channels is empty', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: [],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid channel', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['INVALID_CHANNEL'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when eventType is missing', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid eventType', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        eventType: 'INVALID_EVENT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when neither templateId nor content is provided', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        eventType: 'SYSTEM_ALERT',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when EMAIL channel requires recipientEmail', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['EMAIL'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when SMS channel requires recipientPhone', async () => {
      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['SMS'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });


  describe('Successful Notification', () => {
    it('should send notification successfully', async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        totalRequested: 1,
        successful: 1,
        failed: 0,
        results: [
          {
            notificationId: 'notif-123',
            channel: 'IN_APP',
            status: 'DELIVERED',
            sentAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      });

      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test Subject',
        body: 'Test Body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.successful).toBe(1);
      expect(body.data.failed).toBe(0);
    });

    it('should send notification with template', async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        totalRequested: 1,
        successful: 1,
        failed: 0,
        results: [
          {
            notificationId: 'notif-123',
            channel: 'EMAIL',
            status: 'DELIVERED',
            sentAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      });

      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        recipientEmail: 'test@example.com',
        channels: ['EMAIL'],
        eventType: 'SYSTEM_ALERT',
        templateId: '123e4567-e89b-12d3-a456-426614174001',
        variables: {
          userName: 'John',
          assetName: 'Laptop-001',
        },
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: '123e4567-e89b-12d3-a456-426614174001',
          variables: { userName: 'John', assetName: 'Laptop-001' },
        })
      );
    });

    it('should send notification to multiple channels', async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        totalRequested: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            notificationId: 'notif-123',
            channel: 'EMAIL',
            status: 'DELIVERED',
            sentAt: '2024-01-15T10:00:00.000Z',
          },
          {
            notificationId: 'notif-124',
            channel: 'IN_APP',
            status: 'DELIVERED',
            sentAt: '2024-01-15T10:00:00.000Z',
          },
        ],
      });

      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        recipientEmail: 'test@example.com',
        channels: ['EMAIL', 'IN_APP'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test Subject',
        body: 'Test Body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalRequested).toBe(2);
      expect(body.data.successful).toBe(2);
    });

    it('should include priority when provided', async () => {
      mockNotificationService.sendNotification.mockResolvedValue({
        totalRequested: 1,
        successful: 1,
        failed: 0,
        results: [],
      });

      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Urgent Alert',
        body: 'This is urgent!',
        priority: 'URGENT',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(200);
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'URGENT',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockNotificationService.sendNotification.mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createMockEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channels: ['IN_APP'],
        eventType: 'SYSTEM_ALERT',
        subject: 'Test',
        body: 'Test body',
      }, 'user-123');

      const response = await handler(event);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
