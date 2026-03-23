/**
 * Notification Tracking Handlers Unit Tests
 *
 * Tests for tracking Lambda handlers:
 * - Mark notification read handler
 * - Get notification history handler
 * - Process retries handler
 *
 * Requirements:
 * - 17.8: Track notification delivery status and read receipts
 */

// Mock the dependencies before importing handlers
jest.mock('@ams/database', () => ({
  queryOne: jest.fn(),
  queryMany: jest.fn(),
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
  entityKey: jest.fn((entityType: string, id: string) => `${entityType}:${id}`),
  CACHE_ENTITY_TYPES: {
    NOTIFICATION_PREFERENCES: 'notification-prefs',
    NOTIFICATION: 'notification',
    REPORT: 'report',
  },
  DEFAULT_TTL: {
    MEDIUM: 300,
  },
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
  validateUUID: jest.fn().mockReturnValue(null),
}));

import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as markReadHandler } from '../handlers/mark-notification-read';
import { handler as getHistoryHandler } from '../handlers/get-notification-history';
import * as trackingRepository from '../tracking/tracking-repository';

describe('Tracking Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    trackingRepository.clearAllTrackingData();
  });

  describe('Mark Notification Read Handler', () => {
    const createEvent = (body: Record<string, unknown> | null): APIGatewayProxyEvent =>
      ({
        body: body ? JSON.stringify(body) : null,
        path: '/notifications/read',
        httpMethod: 'POST',
        headers: {},
        queryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      } as APIGatewayProxyEvent);

    it('should mark notification as read successfully', async () => {
      const event = createEvent({
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'EMAIL',
        readSource: 'WEB_APP',
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.receiptId).toBeDefined();
      expect(body.data.notificationId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(body.data.readSource).toBe('WEB_APP');
    });

    it('should include device info when provided', async () => {
      const event = createEvent({
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'IN_APP',
        readSource: 'MOBILE_APP',
        deviceInfo: {
          deviceType: 'mobile',
          platform: 'iOS',
          browser: 'Safari',
        },
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.deviceInfo.deviceType).toBe('mobile');
      expect(body.data.deviceInfo.platform).toBe('iOS');
    });

    it('should return 400 when body is missing', async () => {
      const event = createEvent(null);

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('Request body is required');
    });

    it('should return 400 when notificationId is missing', async () => {
      const event = createEvent({
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'EMAIL',
        readSource: 'WEB_APP',
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('notificationId is required');
    });

    it('should return 400 when recipientId is missing', async () => {
      const event = createEvent({
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        channel: 'EMAIL',
        readSource: 'WEB_APP',
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toBe('recipientId is required');
    });

    it('should return 400 when channel is invalid', async () => {
      const event = createEvent({
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'INVALID_CHANNEL',
        readSource: 'WEB_APP',
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid channel');
    });

    it('should return 400 when readSource is invalid', async () => {
      const event = createEvent({
        notificationId: '123e4567-e89b-12d3-a456-426614174001',
        recipientId: '123e4567-e89b-12d3-a456-426614174000',
        channel: 'EMAIL',
        readSource: 'INVALID_SOURCE',
      });

      const result = await markReadHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid readSource');
    });
  });

  describe('Get Notification History Handler', () => {
    const createEvent = (
      queryParams: Record<string, string> | null
    ): APIGatewayProxyEvent =>
      ({
        body: null,
        path: '/notifications/history',
        httpMethod: 'GET',
        headers: {},
        queryStringParameters: queryParams,
        pathParameters: null,
        stageVariables: null,
        requestContext: {} as any,
        resource: '',
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        isBase64Encoded: false,
      } as APIGatewayProxyEvent);

    beforeEach(async () => {
      // Create some history entries for testing
      await trackingRepository.createHistoryEntry({
        notificationId: 'notif-1',
        recipientId: 'user-1',
        channel: 'EMAIL',
        eventType: 'CONTRACT_EXPIRING',
        subject: 'Contract Expiring',
        priority: 'HIGH',
        status: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
        attemptCount: 1,
      });

      await trackingRepository.createHistoryEntry({
        notificationId: 'notif-2',
        recipientId: 'user-1',
        channel: 'SMS',
        eventType: 'LOANER_OVERDUE',
        subject: 'Loaner Overdue',
        priority: 'NORMAL',
        status: 'DELIVERED',
        deliveryStatus: 'DELIVERED',
        attemptCount: 1,
      });

      await trackingRepository.createHistoryEntry({
        notificationId: 'notif-3',
        recipientId: 'user-2',
        channel: 'EMAIL',
        eventType: 'STOCK_LOW',
        subject: 'Stock Alert',
        priority: 'NORMAL',
        status: 'FAILED',
        deliveryStatus: 'FAILED',
        attemptCount: 3,
      });
    });

    it('should return all history entries', async () => {
      const event = createEvent(null);

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(3);
      expect(body.data.total).toBe(3);
    });

    it('should filter by recipientId', async () => {
      const event = createEvent({ recipientId: 'user-1' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(2);
      expect(body.data.entries.every((e: any) => e.recipientId === 'user-1')).toBe(true);
    });

    it('should filter by channel', async () => {
      const event = createEvent({ channel: 'EMAIL' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(2);
      expect(body.data.entries.every((e: any) => e.channel === 'EMAIL')).toBe(true);
    });

    it('should filter by eventType', async () => {
      const event = createEvent({ eventType: 'CONTRACT_EXPIRING' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(1);
      expect(body.data.entries[0].eventType).toBe('CONTRACT_EXPIRING');
    });

    it('should filter by deliveryStatus', async () => {
      const event = createEvent({ deliveryStatus: 'FAILED' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(1);
      expect(body.data.entries[0].deliveryStatus).toBe('FAILED');
    });

    it('should paginate results', async () => {
      const event = createEvent({ page: '1', limit: '2' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data.entries.length).toBe(2);
      expect(body.data.total).toBe(3);
      expect(body.data.hasMore).toBe(true);
      expect(body.data.page).toBe(1);
      expect(body.data.limit).toBe(2);
    });

    it('should return 400 for invalid channel', async () => {
      const event = createEvent({ channel: 'INVALID' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid channel');
    });

    it('should return 400 for invalid deliveryStatus', async () => {
      const event = createEvent({ deliveryStatus: 'INVALID' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid deliveryStatus');
    });

    it('should return 400 for invalid sortBy', async () => {
      const event = createEvent({ sortBy: 'invalidField' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid sortBy');
    });

    it('should return 400 for invalid sortOrder', async () => {
      const event = createEvent({ sortOrder: 'invalid' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('Invalid sortOrder');
    });

    it('should return 400 for invalid page number', async () => {
      const event = createEvent({ page: '0' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('page must be a positive integer');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const event = createEvent({ limit: '101' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('limit must be between 1 and 100');
    });

    it('should return 400 for invalid date format', async () => {
      const event = createEvent({ fromDate: 'not-a-date' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error.message).toContain('fromDate must be a valid ISO 8601 date string');
    });

    it('should accept valid date range', async () => {
      const event = createEvent({
        fromDate: '2024-01-01T00:00:00.000Z',
        toDate: '2024-12-31T23:59:59.999Z',
      });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
    });

    it('should support sorting', async () => {
      const event = createEvent({ sortBy: 'createdAt', sortOrder: 'asc' });

      const result = await getHistoryHandler(event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.data).toBeDefined();
    });
  });
});
