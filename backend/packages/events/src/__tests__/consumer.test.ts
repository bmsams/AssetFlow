/**
 * Unit tests for Event Consumer
 *
 * Tests the SQS message consumer functionality including:
 * - Message parsing
 * - Idempotent message handling
 * - Dead-letter queue processing
 * - Batch failure responses
 *
 * Validates: Requirements 9.3, 9.4, 9.5, 9.7
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';

import type { DomainEvent } from '@ams/types';

import {
  buildBatchItemFailures,
  createConsumer,
  createDLQConsumer,
  getFailedMessageIds,
  InMemoryIdempotencyStore,
  parseMessage,
  parseMessages,
  parseDLQMessage,
  processMessages,
  processDLQMessages,
  withIdempotency,
} from '../consumer';
import type { MessageHandler, ParsedMessage, ProcessingResult } from '../consumer';

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Event Consumer', () => {
  // Helper to create a mock SQS record
  function createMockSQSRecord(
    event: DomainEvent,
    options: {
      messageId?: string;
      receiveCount?: number;
      wrapInSNS?: boolean;
    } = {}
  ): SQSRecord {
    const {
      messageId = 'msg-123',
      receiveCount = 1,
      wrapInSNS = true,
    } = options;

    const body = wrapInSNS
      ? JSON.stringify({ Message: JSON.stringify(event) })
      : JSON.stringify(event);

    return {
      messageId,
      receiptHandle: `receipt-${messageId}`,
      body,
      attributes: {
        ApproximateReceiveCount: String(receiveCount),
        SentTimestamp: '1234567890',
        SenderId: 'sender-123',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      messageAttributes: {},
      md5OfBody: 'md5hash',
      eventSource: 'aws:sqs',
      eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
      awsRegion: 'us-east-1',
    };
  }

  // Helper to create a mock SQS event
  function createMockSQSEvent(records: SQSRecord[]): SQSEvent {
    return { Records: records };
  }

  // Helper to create a mock domain event
  function createMockEvent(
    eventType: string = 'ASSET_CREATED',
    eventId: string = 'event-123'
  ): DomainEvent {
    return {
      eventId,
      eventType,
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'test-service',
      payload: {
        assetId: 'asset-123',
        assetType: 'HARDWARE',
        assetTag: 'AMS-HW-20250101-ABC123',
        createdBy: 'user-456',
      },
    } as DomainEvent;
  }

  describe('parseMessage', () => {
    it('should parse SNS-wrapped SQS message correctly', () => {
      const event = createMockEvent();
      const record = createMockSQSRecord(event);

      const result = parseMessage(record);

      expect(result).not.toBeNull();
      expect(result?.messageId).toBe('msg-123');
      expect(result?.event.eventId).toBe('event-123');
      expect(result?.event.eventType).toBe('ASSET_CREATED');
      expect(result?.approximateReceiveCount).toBe(1);
    });

    it('should parse direct SQS message (not SNS-wrapped)', () => {
      const event = createMockEvent();
      const record = createMockSQSRecord(event, { wrapInSNS: false });

      const result = parseMessage(record);

      expect(result).not.toBeNull();
      expect(result?.event.eventId).toBe('event-123');
    });

    it('should return null for invalid JSON', () => {
      const record: SQSRecord = {
        ...createMockSQSRecord(createMockEvent()),
        body: 'invalid json',
      };

      const result = parseMessage(record);

      expect(result).toBeNull();
    });

    it('should extract receive count from attributes', () => {
      const event = createMockEvent();
      const record = createMockSQSRecord(event, { receiveCount: 3 });

      const result = parseMessage(record);

      expect(result?.approximateReceiveCount).toBe(3);
    });
  });

  describe('parseMessages', () => {
    it('should parse all valid messages from SQS event', () => {
      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const results = parseMessages(sqsEvent);

      expect(results).toHaveLength(2);
      expect(results[0]?.event.eventId).toBe('event-1');
      expect(results[1]?.event.eventId).toBe('event-2');
    });

    it('should skip invalid messages', () => {
      const validEvent = createMockEvent();
      const invalidRecord: SQSRecord = {
        ...createMockSQSRecord(validEvent),
        messageId: 'invalid-msg',
        body: 'invalid json',
      };

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(validEvent, { messageId: 'valid-msg' }),
        invalidRecord,
      ]);

      const results = parseMessages(sqsEvent);

      expect(results).toHaveLength(1);
      expect(results[0]?.messageId).toBe('valid-msg');
    });
  });

  describe('parseDLQMessage', () => {
    it('should parse DLQ message with additional metadata', () => {
      const event = createMockEvent();
      const record = createMockSQSRecord(event, { receiveCount: 4 });

      const result = parseDLQMessage(record);

      expect(result).not.toBeNull();
      expect(result?.messageId).toBe('msg-123');
      expect(result?.event.eventId).toBe('event-123');
      expect(result?.receiveCount).toBe(4);
      expect(result?.originalQueueArn).toBe('arn:aws:sqs:us-east-1:123456789012:test-queue');
    });
  });

  describe('processMessages', () => {
    it('should process all messages with handler', async () => {
      const processedEvents: string[] = [];
      const handler: MessageHandler = async (message) => {
        processedEvents.push(message.event.eventId);
      };

      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const results = await processMessages(sqsEvent, handler);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(processedEvents).toEqual(['event-1', 'event-2']);
    });

    it('should capture errors for failed messages', async () => {
      const handler: MessageHandler = async (message) => {
        if (message.event.eventId === 'event-2') {
          throw new Error('Processing failed');
        }
      };

      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const results = await processMessages(sqsEvent, handler);

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[1]?.success).toBe(false);
      expect(results[1]?.error?.message).toBe('Processing failed');
    });

    it('should skip already processed messages with idempotency store', async () => {
      const store = new InMemoryIdempotencyStore();
      await store.markProcessed('event-1');

      const processedEvents: string[] = [];
      const handler: MessageHandler = async (message) => {
        processedEvents.push(message.event.eventId);
      };

      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const results = await processMessages(sqsEvent, handler, {
        idempotencyStore: store,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.skipped).toBe(true);
      expect(results[1]?.success).toBe(true);
      expect(results[1]?.skipped).toBeUndefined();
      expect(processedEvents).toEqual(['event-2']);
    });

    it('should mark messages as processed after successful handling', async () => {
      const store = new InMemoryIdempotencyStore();
      const handler: MessageHandler = async () => {
        // Success
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1' }),
      ]);

      await processMessages(sqsEvent, handler, { idempotencyStore: store });

      expect(await store.isProcessed('event-1')).toBe(true);
    });

    it('should not mark messages as processed on failure', async () => {
      const store = new InMemoryIdempotencyStore();
      const handler: MessageHandler = async () => {
        throw new Error('Failed');
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1' }),
      ]);

      await processMessages(sqsEvent, handler, { idempotencyStore: store });

      expect(await store.isProcessed('event-1')).toBe(false);
    });

    it('should use distributed locking when enabled', async () => {
      const store = new InMemoryIdempotencyStore();
      // Simulate another instance processing
      await store.markInProgress('event-1');

      const processedEvents: string[] = [];
      const handler: MessageHandler = async (message) => {
        processedEvents.push(message.event.eventId);
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1' }),
      ]);

      const results = await processMessages(sqsEvent, handler, {
        idempotencyStore: store,
        useDistributedLocking: true,
      });

      expect(results[0]?.success).toBe(true);
      expect(results[0]?.skipped).toBe(true);
      expect(results[0]?.reason).toBe('Being processed by another instance');
      expect(processedEvents).toEqual([]);
    });
  });

  describe('InMemoryIdempotencyStore', () => {
    let store: InMemoryIdempotencyStore;

    beforeEach(() => {
      store = new InMemoryIdempotencyStore();
    });

    it('should track processed events', async () => {
      expect(await store.isProcessed('event-1')).toBe(false);

      await store.markProcessed('event-1');

      expect(await store.isProcessed('event-1')).toBe(true);
    });

    it('should respect TTL for processed events', async () => {
      // Mark with very short TTL (1ms)
      await store.markProcessed('event-1', 0.001);

      // Wait a bit for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be expired
      expect(await store.isProcessed('event-1')).toBe(false);
    });

    it('should track in-progress events', async () => {
      expect(await store.markInProgress('event-1')).toBe(true);
      expect(await store.markInProgress('event-1')).toBe(false); // Already in progress

      await store.clearInProgress('event-1');
      expect(await store.markInProgress('event-1')).toBe(true);
    });

    it('should clear in-progress when marked as processed', async () => {
      await store.markInProgress('event-1');
      await store.markProcessed('event-1');

      // Should be able to mark in-progress again (cleared by markProcessed)
      expect(await store.markInProgress('event-1')).toBe(true);
    });
  });

  describe('processDLQMessages', () => {
    it('should process DLQ messages and archive them', async () => {
      const archivedMessages: string[] = [];
      const archiveHandler = async (message: { messageId: string }) => {
        archivedMessages.push(message.messageId);
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1', receiveCount: 5 }),
      ]);

      const results = await processDLQMessages(sqsEvent, {
        archiveHandler,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(archivedMessages).toEqual(['msg-1']);
    });

    it('should attempt reprocessing for low receive count messages', async () => {
      const reprocessedEvents: string[] = [];
      const reprocessHandler: MessageHandler = async (message) => {
        reprocessedEvents.push(message.event.eventId);
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1', receiveCount: 2 }),
      ]);

      const results = await processDLQMessages(sqsEvent, {
        maxReceiveCount: 5,
        reprocessHandler,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.reason).toBe('Reprocessed successfully');
      expect(reprocessedEvents).toEqual(['event-1']);
    });

    it('should archive after failed reprocessing', async () => {
      const archivedMessages: string[] = [];
      const reprocessHandler: MessageHandler = async () => {
        throw new Error('Reprocessing failed');
      };
      const archiveHandler = async (message: { messageId: string }) => {
        archivedMessages.push(message.messageId);
      };

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1', receiveCount: 2 }),
      ]);

      const results = await processDLQMessages(sqsEvent, {
        maxReceiveCount: 5,
        reprocessHandler,
        archiveHandler,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.reason).toBe('Archived');
      expect(archivedMessages).toEqual(['msg-1']);
    });

    it('should discard events in discard list', async () => {
      const archivedMessages: string[] = [];
      const archiveHandler = async (message: { messageId: string }) => {
        archivedMessages.push(message.messageId);
      };

      const event = createMockEvent('INTEGRATION_ERROR', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1' }),
      ]);

      const results = await processDLQMessages(sqsEvent, {
        archiveHandler,
        discardEventTypes: ['INTEGRATION_ERROR'],
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(results[0]?.reason).toBe('Discarded - event type in discard list');
      expect(archivedMessages).toEqual([]);
    });
  });

  describe('getFailedMessageIds', () => {
    it('should return only failed message IDs', () => {
      const results: ProcessingResult[] = [
        { messageId: 'msg-1', success: true },
        { messageId: 'msg-2', success: false, error: new Error('Failed') },
        { messageId: 'msg-3', success: true },
        { messageId: 'msg-4', success: false, error: new Error('Failed') },
      ];

      const failedIds = getFailedMessageIds(results);

      expect(failedIds).toEqual(['msg-2', 'msg-4']);
    });

    it('should return empty array when all succeed', () => {
      const results: ProcessingResult[] = [
        { messageId: 'msg-1', success: true },
        { messageId: 'msg-2', success: true },
      ];

      const failedIds = getFailedMessageIds(results);

      expect(failedIds).toEqual([]);
    });
  });

  describe('buildBatchItemFailures', () => {
    it('should build correct batch failure response', () => {
      const failedIds = ['msg-1', 'msg-3'];

      const response = buildBatchItemFailures(failedIds);

      expect(response).toEqual({
        batchItemFailures: [
          { itemIdentifier: 'msg-1' },
          { itemIdentifier: 'msg-3' },
        ],
      });
    });

    it('should return empty array when no failures', () => {
      const response = buildBatchItemFailures([]);

      expect(response).toEqual({
        batchItemFailures: [],
      });
    });
  });

  describe('withIdempotency', () => {
    it('should wrap handler with idempotency checking', async () => {
      const store = new InMemoryIdempotencyStore();
      const processedEvents: string[] = [];

      const handler: MessageHandler = async (message) => {
        processedEvents.push(message.event.eventId);
      };

      const wrappedHandler = withIdempotency(handler, store);

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const message: ParsedMessage = {
        messageId: 'msg-1',
        receiptHandle: 'receipt-1',
        event,
        attributes: {} as SQSRecord['attributes'],
        approximateReceiveCount: 1,
      };

      // First call should process
      await wrappedHandler(message);
      expect(processedEvents).toEqual(['event-1']);

      // Second call should skip
      await wrappedHandler(message);
      expect(processedEvents).toEqual(['event-1']); // Still only one
    });
  });

  describe('createConsumer', () => {
    it('should create a Lambda handler that processes messages', async () => {
      const processedEvents: string[] = [];
      const handler: MessageHandler = async (message) => {
        processedEvents.push(message.event.eventId);
      };

      const consumer = createConsumer(handler);

      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const response = await consumer(sqsEvent);

      expect(response.batchItemFailures).toEqual([]);
      expect(processedEvents).toEqual(['event-1', 'event-2']);
    });

    it('should return batch failures for failed messages', async () => {
      const handler: MessageHandler = async (message) => {
        if (message.event.eventId === 'event-2') {
          throw new Error('Failed');
        }
      };

      const consumer = createConsumer(handler);

      const event1 = createMockEvent('ASSET_CREATED', 'event-1');
      const event2 = createMockEvent('ASSET_UPDATED', 'event-2');

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event1, { messageId: 'msg-1' }),
        createMockSQSRecord(event2, { messageId: 'msg-2' }),
      ]);

      const response = await consumer(sqsEvent);

      expect(response.batchItemFailures).toEqual([
        { itemIdentifier: 'msg-2' },
      ]);
    });
  });

  describe('createDLQConsumer', () => {
    it('should create a Lambda handler for DLQ processing', async () => {
      const archivedMessages: string[] = [];
      const archiveHandler = async (message: { messageId: string }) => {
        archivedMessages.push(message.messageId);
      };

      const consumer = createDLQConsumer({ archiveHandler });

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(event, { messageId: 'msg-1', receiveCount: 5 }),
      ]);

      const response = await consumer(sqsEvent);

      expect(response.batchItemFailures).toEqual([]);
      expect(archivedMessages).toEqual(['msg-1']);
    });
  });
});
