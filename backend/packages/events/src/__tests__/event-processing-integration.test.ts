/**
 * Integration tests for Event Processing
 *
 * Tests the complete event processing flow including:
 * - Event publishing to SNS topics
 * - Event consumption from SQS queues
 * - Dead-letter queue handling for failed messages
 * - Idempotent message processing
 * - Event filtering and routing
 *
 * Validates: Requirements 9.1-9.8
 * - 9.1: THE Event_Bus SHALL publish domain events for all significant asset state changes
 * - 9.2: WHEN an asset is created, updated, or deleted, THE Event_Bus SHALL publish corresponding events
 * - 9.3: THE Event_Bus SHALL support multiple subscribers per event type for extensibility
 * - 9.4: THE Message_Queue SHALL implement dead-letter queues for failed message processing
 * - 9.5: WHEN a message fails processing after configured retries, THE Message_Queue SHALL move it to DLQ
 * - 9.6: THE Event_Bus SHALL guarantee at-least-once delivery for all published events
 * - 9.7: THE Event_Consumer SHALL implement idempotent message handling to support reprocessing
 * - 9.8: THE Event_Bus SHALL support event filtering and routing based on event attributes
 */

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import { mockClient } from 'aws-sdk-client-mock';
import type { SQSEvent, SQSRecord } from 'aws-lambda';

import type { Asset, DomainEvent, EventType } from '@ams/types';

import {
  publishAssetCreated,
  publishAssetUpdated,
  publishAssetStateChanged,
  publishAssetDeleted,
  publishEvents,
} from '../publisher';
import {
  processMessages,
  processDLQMessages,
  InMemoryIdempotencyStore,
  createDLQConsumer,
  buildBatchItemFailures,
  getFailedMessageIds,
} from '../consumer';
import type { MessageHandler, ParsedMessage } from '../consumer';
import {
  createEventRouter,
  createLambdaHandler,
  SubscriptionRouter,
  evaluateFilterRules,
  createFilterFromRules,
} from '../event-handler';
import type { FilterRule, SubscriptionConfig } from '../event-handler';


// Mock the SNS client
const snsMock = mockClient(SNSClient);

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Event Processing Integration Tests', () => {
  const mockTopicArn = 'arn:aws:sns:us-east-1:123456789012:asset-events';
  const mockMessageId = 'mock-message-id-12345';

  beforeEach(() => {
    snsMock.reset();
    snsMock.on(PublishCommand).resolves({ MessageId: mockMessageId });
    process.env['EVENTS_TOPIC_ARN'] = mockTopicArn;
    process.env['SERVICE_NAME'] = 'test-service';
  });

  afterEach(() => {
    delete process.env['EVENTS_TOPIC_ARN'];
    delete process.env['SERVICE_NAME'];
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createMockEvent(
    eventType: EventType = 'ASSET_CREATED',
    eventId: string = 'event-123',
    payload: Record<string, unknown> = {}
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
        ...payload,
      },
    } as DomainEvent;
  }

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

  function createMockSQSEvent(records: SQSRecord[]): SQSEvent {
    return { Records: records };
  }

  const mockAsset: Asset = {
    assetId: 'asset-123',
    assetTag: 'AMS-HW-20250101-ABC123',
    assetType: 'HARDWARE',
    displayName: 'Test Laptop',
    status: 'IN_STOCK',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };


  // ============================================================================
  // Section 1: Event Publishing Integration Tests
  // Validates: Requirements 9.1, 9.2
  // ============================================================================

  describe('Event Publishing Integration', () => {
    describe('publishing asset lifecycle events', () => {
      /**
       * Validates: Requirement 9.1
       * THE Event_Bus SHALL publish domain events for all significant asset state changes
       */
      it('should publish complete event chain for asset lifecycle', async () => {
        // Simulate complete asset lifecycle: create -> update -> state change -> delete
        const assetId = 'asset-lifecycle-test';
        const assetTag = 'AMS-HW-20250101-LIFE01';
        const userId = 'user-lifecycle';

        // 1. Asset Created
        const createResult = await publishAssetCreated(
          assetId,
          'HARDWARE',
          assetTag,
          userId,
          { ...mockAsset, assetId, assetTag }
        );
        expect(createResult.eventType).toBe('ASSET_CREATED');

        // 2. Asset Updated
        const updateResult = await publishAssetUpdated(
          assetId,
          'HARDWARE',
          userId,
          [{ field: 'displayName', oldValue: 'Old Name', newValue: 'New Name' }]
        );
        expect(updateResult.eventType).toBe('ASSET_UPDATED');

        // 3. Asset State Changed
        const stateResult = await publishAssetStateChanged(
          assetId,
          'HARDWARE',
          'IN_STOCK',
          'DEPLOYED',
          userId,
          'Deployed to user workstation'
        );
        expect(stateResult.eventType).toBe('ASSET_STATE_CHANGED');

        // 4. Asset Deleted
        const deleteResult = await publishAssetDeleted(
          assetId,
          'HARDWARE',
          assetTag,
          userId
        );
        expect(deleteResult.eventType).toBe('ASSET_DELETED');

        // Verify all 4 events were published
        const calls = snsMock.commandCalls(PublishCommand);
        expect(calls).toHaveLength(4);

        // Verify each event has unique eventId
        const eventIds = calls.map((call) => {
          const message = JSON.parse(call.args[0].input.Message as string);
          return message.eventId;
        });
        const uniqueEventIds = new Set(eventIds);
        expect(uniqueEventIds.size).toBe(4);
      });

      /**
       * Validates: Requirement 9.2
       * WHEN an asset is created, updated, or deleted, THE Event_Bus SHALL publish
       * corresponding events with full payload
       */
      it('should include full payload in published events', async () => {
        await publishAssetCreated(
          'asset-full-payload',
          'HARDWARE',
          'AMS-HW-20250101-FULL01',
          'user-123',
          mockAsset
        );

        const calls = snsMock.commandCalls(PublishCommand);
        const message = JSON.parse(calls[0]!.args[0].input.Message as string);

        // Verify full payload structure
        expect(message.payload).toBeDefined();
        expect(message.payload.assetId).toBe('asset-full-payload');
        expect(message.payload.assetType).toBe('HARDWARE');
        expect(message.payload.assetTag).toBe('AMS-HW-20250101-FULL01');
        expect(message.payload.createdBy).toBe('user-123');
        expect(message.payload.asset).toEqual(mockAsset);

        // Verify event envelope
        expect(message.eventId).toBeDefined();
        expect(message.eventType).toBe('ASSET_CREATED');
        expect(message.timestamp).toBeDefined();
        expect(message.version).toBe('1.0');
        expect(message.source).toBe('test-service');
      });
    });

    describe('batch event publishing', () => {
      it('should publish multiple events maintaining order and integrity', async () => {
        const events = [
          { eventType: 'ASSET_CREATED' as const, payload: { assetId: 'asset-1', assetType: 'HARDWARE' } },
          { eventType: 'ASSET_UPDATED' as const, payload: { assetId: 'asset-2', assetType: 'SOFTWARE' } },
          { eventType: 'ASSET_STATE_CHANGED' as const, payload: { assetId: 'asset-3', previousState: 'IN_STOCK', newState: 'DEPLOYED' } },
        ];

        const results = await publishEvents(events);

        expect(results).toHaveLength(3);
        expect(results[0]?.eventType).toBe('ASSET_CREATED');
        expect(results[1]?.eventType).toBe('ASSET_UPDATED');
        expect(results[2]?.eventType).toBe('ASSET_STATE_CHANGED');

        // Verify all events were published to SNS
        const calls = snsMock.commandCalls(PublishCommand);
        expect(calls).toHaveLength(3);
      });
    });
  });


  // ============================================================================
  // Section 2: Event Consumption Integration Tests
  // Validates: Requirements 9.3, 9.6
  // ============================================================================

  describe('Event Consumption Integration', () => {
    /**
     * Validates: Requirement 9.3
     * THE Event_Bus SHALL support multiple subscribers per event type for extensibility
     */
    describe('multiple subscribers per event type', () => {
      it('should deliver events to multiple handlers for same event type', async () => {
        const handler1Events: string[] = [];
        const handler2Events: string[] = [];
        const handler3Events: string[] = [];

        const router = createEventRouter()
          .on('ASSET_CREATED', async (message) => {
            handler1Events.push(message.event.eventId);
          }, { priority: 100 })
          .on('ASSET_CREATED', async (message) => {
            handler2Events.push(message.event.eventId);
          }, { priority: 200 })
          .on('ASSET_CREATED', async (message) => {
            handler3Events.push(message.event.eventId);
          }, { priority: 300 });

        const event = createMockEvent('ASSET_CREATED', 'multi-subscriber-event');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        // All three handlers should receive the event
        expect(handler1Events).toEqual(['multi-subscriber-event']);
        expect(handler2Events).toEqual(['multi-subscriber-event']);
        expect(handler3Events).toEqual(['multi-subscriber-event']);
      });

      it('should support category-based and type-based handlers together', async () => {
        const typeHandlerEvents: string[] = [];
        const categoryHandlerEvents: string[] = [];

        const router = createEventRouter()
          .on('ASSET_CREATED', async (message) => {
            typeHandlerEvents.push(message.event.eventId);
          })
          .onCategory('ASSET', async (message) => {
            categoryHandlerEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'category-type-event');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(typeHandlerEvents).toEqual(['category-type-event']);
        expect(categoryHandlerEvents).toEqual(['category-type-event']);
      });
    });

    /**
     * Validates: Requirement 9.6
     * THE Event_Bus SHALL guarantee at-least-once delivery for all published events
     */
    describe('at-least-once delivery guarantee', () => {
      it('should process same message multiple times when not using idempotency', async () => {
        const processedEvents: string[] = [];
        const handler: MessageHandler = async (message) => {
          processedEvents.push(message.event.eventId);
        };

        const event = createMockEvent('ASSET_CREATED', 'redelivered-event');
        
        // Simulate message being delivered twice (at-least-once)
        const sqsEvent1 = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-1', receiveCount: 1 }),
        ]);
        const sqsEvent2 = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-2', receiveCount: 2 }),
        ]);

        await processMessages(sqsEvent1, handler);
        await processMessages(sqsEvent2, handler);

        // Without idempotency, event is processed twice
        expect(processedEvents).toEqual(['redelivered-event', 'redelivered-event']);
      });

      it('should return partial batch failures for failed messages', async () => {
        const handler: MessageHandler = async (message) => {
          if (message.event.eventId === 'fail-event') {
            throw new Error('Processing failed');
          }
        };

        const successEvent = createMockEvent('ASSET_CREATED', 'success-event');
        const failEvent = createMockEvent('ASSET_UPDATED', 'fail-event');

        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(successEvent, { messageId: 'msg-success' }),
          createMockSQSRecord(failEvent, { messageId: 'msg-fail' }),
        ]);

        const results = await processMessages(sqsEvent, handler);
        const failedIds = getFailedMessageIds(results);
        const response = buildBatchItemFailures(failedIds);

        // Only failed message should be in batch failures
        expect(response.batchItemFailures).toEqual([
          { itemIdentifier: 'msg-fail' },
        ]);
      });
    });
  });


  // ============================================================================
  // Section 3: Dead-Letter Queue Handling Integration Tests
  // Validates: Requirements 9.4, 9.5
  // ============================================================================

  describe('Dead-Letter Queue Handling Integration', () => {
    /**
     * Validates: Requirement 9.4
     * THE Message_Queue SHALL implement dead-letter queues for failed message processing
     */
    describe('DLQ message processing', () => {
      it('should archive messages that exceed max receive count', async () => {
        const archivedMessages: Array<{ messageId: string; eventId: string; receiveCount: number }> = [];
        const archiveHandler = async (message: { messageId: string; event: DomainEvent; receiveCount: number }) => {
          archivedMessages.push({
            messageId: message.messageId,
            eventId: message.event.eventId,
            receiveCount: message.receiveCount,
          });
        };

        const event = createMockEvent('ASSET_CREATED', 'dlq-archive-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'dlq-msg-1', receiveCount: 6 }),
        ]);

        const results = await processDLQMessages(sqsEvent, {
          maxReceiveCount: 5,
          archiveHandler,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(archivedMessages).toHaveLength(1);
        expect(archivedMessages[0]?.eventId).toBe('dlq-archive-event');
        expect(archivedMessages[0]?.receiveCount).toBe(6);
      });

      /**
       * Validates: Requirement 9.5
       * WHEN a message fails processing after configured retries, THE Message_Queue SHALL move it to DLQ
       */
      it('should attempt reprocessing for messages below max receive count', async () => {
        const reprocessedEvents: string[] = [];
        const archivedEvents: string[] = [];

        const reprocessHandler: MessageHandler = async (message) => {
          reprocessedEvents.push(message.event.eventId);
        };
        const archiveHandler = async (message: { event: DomainEvent }) => {
          archivedEvents.push(message.event.eventId);
        };

        const event = createMockEvent('ASSET_CREATED', 'dlq-reprocess-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'dlq-msg-2', receiveCount: 2 }),
        ]);

        const results = await processDLQMessages(sqsEvent, {
          maxReceiveCount: 5,
          reprocessHandler,
          archiveHandler,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(results[0]?.reason).toBe('Reprocessed successfully');
        expect(reprocessedEvents).toEqual(['dlq-reprocess-event']);
        expect(archivedEvents).toEqual([]); // Should not archive if reprocessing succeeds
      });

      it('should archive after failed reprocessing attempt', async () => {
        const reprocessAttempts: string[] = [];
        const archivedEvents: string[] = [];

        const reprocessHandler: MessageHandler = async (message) => {
          reprocessAttempts.push(message.event.eventId);
          throw new Error('Reprocessing still fails');
        };
        const archiveHandler = async (message: { event: DomainEvent }) => {
          archivedEvents.push(message.event.eventId);
        };

        const event = createMockEvent('ASSET_CREATED', 'dlq-fail-reprocess');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'dlq-msg-3', receiveCount: 3 }),
        ]);

        const results = await processDLQMessages(sqsEvent, {
          maxReceiveCount: 5,
          reprocessHandler,
          archiveHandler,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(results[0]?.reason).toBe('Archived');
        expect(reprocessAttempts).toEqual(['dlq-fail-reprocess']);
        expect(archivedEvents).toEqual(['dlq-fail-reprocess']);
      });

      it('should discard events in the discard list without archiving', async () => {
        const archivedEvents: string[] = [];
        const archiveHandler = async (message: { event: DomainEvent }) => {
          archivedEvents.push(message.event.eventId);
        };

        // INTEGRATION_ERROR events should be discarded
        const event = createMockEvent('INTEGRATION_ERROR', 'discard-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'dlq-discard' }),
        ]);

        const results = await processDLQMessages(sqsEvent, {
          archiveHandler,
          discardEventTypes: ['INTEGRATION_ERROR'],
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(results[0]?.reason).toBe('Discarded - event type in discard list');
        expect(archivedEvents).toEqual([]); // Should not archive discarded events
      });
    });

    describe('DLQ consumer Lambda handler', () => {
      it('should create functional DLQ consumer with archive handler', async () => {
        const archivedMessages: string[] = [];
        const archiveHandler = async (message: { messageId: string }) => {
          archivedMessages.push(message.messageId);
        };

        const consumer = createDLQConsumer({ archiveHandler });

        const event = createMockEvent('ASSET_CREATED', 'dlq-consumer-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'dlq-consumer-msg', receiveCount: 5 }),
        ]);

        const response = await consumer(sqsEvent);

        expect(response.batchItemFailures).toEqual([]);
        expect(archivedMessages).toEqual(['dlq-consumer-msg']);
      });
    });
  });


  // ============================================================================
  // Section 4: Idempotent Message Processing Integration Tests
  // Validates: Requirement 9.7
  // ============================================================================

  describe('Idempotent Message Processing Integration', () => {
    /**
     * Validates: Requirement 9.7
     * THE Event_Consumer SHALL implement idempotent message handling to support reprocessing
     */
    describe('idempotency with InMemoryIdempotencyStore', () => {
      it('should process message only once even when delivered multiple times', async () => {
        const store = new InMemoryIdempotencyStore();
        const processedEvents: string[] = [];

        const handler: MessageHandler = async (message) => {
          processedEvents.push(message.event.eventId);
        };

        const event = createMockEvent('ASSET_CREATED', 'idempotent-event-1');

        // First delivery
        const sqsEvent1 = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-delivery-1' }),
        ]);
        await processMessages(sqsEvent1, handler, { idempotencyStore: store });

        // Second delivery (redelivery)
        const sqsEvent2 = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-delivery-2' }),
        ]);
        await processMessages(sqsEvent2, handler, { idempotencyStore: store });

        // Third delivery (another redelivery)
        const sqsEvent3 = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-delivery-3' }),
        ]);
        await processMessages(sqsEvent3, handler, { idempotencyStore: store });

        // Event should only be processed once
        expect(processedEvents).toEqual(['idempotent-event-1']);
      });

      it('should mark skipped messages as successful with skip reason', async () => {
        const store = new InMemoryIdempotencyStore();
        await store.markProcessed('already-processed-event');

        const handler: MessageHandler = async () => {
          // Should not be called
        };

        const event = createMockEvent('ASSET_CREATED', 'already-processed-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-skip' }),
        ]);

        const results = await processMessages(sqsEvent, handler, { idempotencyStore: store });

        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(results[0]?.skipped).toBe(true);
        expect(results[0]?.reason).toBe('Already processed');
      });

      it('should not mark failed messages as processed', async () => {
        const store = new InMemoryIdempotencyStore();

        const handler: MessageHandler = async () => {
          throw new Error('Processing failed');
        };

        const event = createMockEvent('ASSET_CREATED', 'fail-no-mark-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-fail' }),
        ]);

        await processMessages(sqsEvent, handler, { idempotencyStore: store });

        // Event should NOT be marked as processed
        expect(await store.isProcessed('fail-no-mark-event')).toBe(false);
      });

      it('should support distributed locking to prevent concurrent processing', async () => {
        const store = new InMemoryIdempotencyStore();
        const processedEvents: string[] = [];

        // Simulate another instance already processing this event
        await store.markInProgress('concurrent-event');

        const handler: MessageHandler = async (message) => {
          processedEvents.push(message.event.eventId);
        };

        const event = createMockEvent('ASSET_CREATED', 'concurrent-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-concurrent' }),
        ]);

        const results = await processMessages(sqsEvent, handler, {
          idempotencyStore: store,
          useDistributedLocking: true,
        });

        expect(results[0]?.success).toBe(true);
        expect(results[0]?.skipped).toBe(true);
        expect(results[0]?.reason).toBe('Being processed by another instance');
        expect(processedEvents).toEqual([]); // Should not process
      });

      it('should clear in-progress lock on processing failure', async () => {
        const store = new InMemoryIdempotencyStore();

        const handler: MessageHandler = async () => {
          throw new Error('Processing failed');
        };

        const event = createMockEvent('ASSET_CREATED', 'lock-clear-event');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-lock-clear' }),
        ]);

        await processMessages(sqsEvent, handler, {
          idempotencyStore: store,
          useDistributedLocking: true,
        });

        // Lock should be cleared, allowing retry
        const canAcquireLock = await store.markInProgress('lock-clear-event');
        expect(canAcquireLock).toBe(true);
      });
    });

    describe('idempotency with EventRouter', () => {
      it('should integrate idempotency with event router', async () => {
        const store = new InMemoryIdempotencyStore();
        const processedEvents: string[] = [];

        const router = createEventRouter()
          .withIdempotency(store)
          .on('ASSET_CREATED', async (message) => {
            processedEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'router-idempotent-event');

        // Process twice
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);
        await router.process(sqsEvent);
        await router.process(sqsEvent);

        // Should only process once
        expect(processedEvents).toEqual(['router-idempotent-event']);
      });
    });
  });


  // ============================================================================
  // Section 5: Event Filtering and Routing Integration Tests
  // Validates: Requirement 9.8
  // ============================================================================

  describe('Event Filtering and Routing Integration', () => {
    /**
     * Validates: Requirement 9.8
     * THE Event_Bus SHALL support event filtering and routing based on event attributes
     */
    describe('attribute-based filter rules', () => {
      it('should filter events by eventType using equals operator', () => {
        const rules: FilterRule[] = [
          { attribute: 'eventType', operator: 'equals', value: 'ASSET_CREATED' },
        ];

        const matchingEvent = createMockEvent('ASSET_CREATED', 'filter-match');
        const nonMatchingEvent = createMockEvent('ASSET_UPDATED', 'filter-no-match');

        expect(evaluateFilterRules(matchingEvent, rules)).toBe(true);
        expect(evaluateFilterRules(nonMatchingEvent, rules)).toBe(false);
      });

      it('should filter events by payload attributes using nested path', () => {
        const rules: FilterRule[] = [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        ];

        const hardwareEvent = createMockEvent('ASSET_CREATED', 'hw-event', { assetType: 'HARDWARE' });
        const softwareEvent = createMockEvent('ASSET_CREATED', 'sw-event', { assetType: 'SOFTWARE' });

        expect(evaluateFilterRules(hardwareEvent, rules)).toBe(true);
        expect(evaluateFilterRules(softwareEvent, rules)).toBe(false);
      });

      it('should support in operator for multiple values', () => {
        const rules: FilterRule[] = [
          { attribute: 'payload.assetType', operator: 'in', value: ['HARDWARE', 'SOFTWARE'] },
        ];

        const hardwareEvent = createMockEvent('ASSET_CREATED', 'hw', { assetType: 'HARDWARE' });
        const softwareEvent = createMockEvent('ASSET_CREATED', 'sw', { assetType: 'SOFTWARE' });
        const enterpriseEvent = createMockEvent('ASSET_CREATED', 'ent', { assetType: 'ENTERPRISE' });

        expect(evaluateFilterRules(hardwareEvent, rules)).toBe(true);
        expect(evaluateFilterRules(softwareEvent, rules)).toBe(true);
        expect(evaluateFilterRules(enterpriseEvent, rules)).toBe(false);
      });

      it('should support exists operator for optional fields', () => {
        const rules: FilterRule[] = [
          { attribute: 'payload.reason', operator: 'exists' },
        ];

        const eventWithReason = createMockEvent('ASSET_STATE_CHANGED', 'with-reason', { reason: 'Deployed' });
        const eventWithoutReason = createMockEvent('ASSET_STATE_CHANGED', 'no-reason', {});

        expect(evaluateFilterRules(eventWithReason, rules)).toBe(true);
        expect(evaluateFilterRules(eventWithoutReason, rules)).toBe(false);
      });

      it('should support composite AND rules', () => {
        const rules: FilterRule[] = [
          {
            logic: 'AND',
            rules: [
              { attribute: 'eventType', operator: 'equals', value: 'ASSET_CREATED' },
              { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
            ],
          },
        ];

        const matchingEvent = createMockEvent('ASSET_CREATED', 'match', { assetType: 'HARDWARE' });
        const wrongType = createMockEvent('ASSET_UPDATED', 'wrong-type', { assetType: 'HARDWARE' });
        const wrongAsset = createMockEvent('ASSET_CREATED', 'wrong-asset', { assetType: 'SOFTWARE' });

        expect(evaluateFilterRules(matchingEvent, rules)).toBe(true);
        expect(evaluateFilterRules(wrongType, rules)).toBe(false);
        expect(evaluateFilterRules(wrongAsset, rules)).toBe(false);
      });

      it('should support composite OR rules', () => {
        const rules: FilterRule[] = [
          {
            logic: 'OR',
            rules: [
              { attribute: 'eventType', operator: 'equals', value: 'ASSET_CREATED' },
              { attribute: 'eventType', operator: 'equals', value: 'ASSET_DELETED' },
            ],
          },
        ];

        const createdEvent = createMockEvent('ASSET_CREATED', 'created');
        const deletedEvent = createMockEvent('ASSET_DELETED', 'deleted');
        const updatedEvent = createMockEvent('ASSET_UPDATED', 'updated');

        expect(evaluateFilterRules(createdEvent, rules)).toBe(true);
        expect(evaluateFilterRules(deletedEvent, rules)).toBe(true);
        expect(evaluateFilterRules(updatedEvent, rules)).toBe(false);
      });

      it('should support numeric comparison operators', () => {
        const greaterThanRules: FilterRule[] = [
          { attribute: 'payload.quantity', operator: 'greaterThan', value: 10 },
        ];

        const highQtyEvent = createMockEvent('STOCK_LEVEL_ALERT', 'high', { quantity: 15 });
        const lowQtyEvent = createMockEvent('STOCK_LEVEL_ALERT', 'low', { quantity: 5 });

        expect(evaluateFilterRules(highQtyEvent, greaterThanRules)).toBe(true);
        expect(evaluateFilterRules(lowQtyEvent, greaterThanRules)).toBe(false);
      });

      it('should support string pattern matching with contains', () => {
        const rules: FilterRule[] = [
          { attribute: 'payload.assetTag', operator: 'contains', value: 'HW' },
        ];

        const hwEvent = createMockEvent('ASSET_CREATED', 'hw', { assetTag: 'AMS-HW-20250101-ABC' });
        const swEvent = createMockEvent('ASSET_CREATED', 'sw', { assetTag: 'AMS-SW-20250101-XYZ' });

        expect(evaluateFilterRules(hwEvent, rules)).toBe(true);
        expect(evaluateFilterRules(swEvent, rules)).toBe(false);
      });
    });


    describe('subscription-based routing', () => {
      it('should route events to matching subscriptions', async () => {
        const router = new SubscriptionRouter();
        const receivedBySubscription1: string[] = [];
        const receivedBySubscription2: string[] = [];

        // Subscription 1: Only ASSET_CREATED events
        const sub1: SubscriptionConfig = {
          subscriptionId: 'sub-asset-created',
          name: 'Asset Created Subscription',
          eventTypes: ['ASSET_CREATED'],
          enabled: true,
          priority: 100,
        };

        // Subscription 2: Only HARDWARE assets
        const sub2: SubscriptionConfig = {
          subscriptionId: 'sub-hardware',
          name: 'Hardware Assets Subscription',
          filterRules: [
            { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
          ],
          enabled: true,
          priority: 200,
        };

        router
          .addSubscription(sub1)
          .addSubscription(sub2)
          .setHandler('sub-asset-created', async (message) => {
            receivedBySubscription1.push(message.event.eventId);
          })
          .setHandler('sub-hardware', async (message) => {
            receivedBySubscription2.push(message.event.eventId);
          });

        // Event that matches both subscriptions
        const hwCreatedEvent = createMockEvent('ASSET_CREATED', 'hw-created', { assetType: 'HARDWARE' });
        const hwCreatedMessage: ParsedMessage = {
          messageId: 'msg-hw-created',
          receiptHandle: 'receipt-1',
          event: hwCreatedEvent,
          attributes: {} as SQSRecord['attributes'],
          approximateReceiveCount: 1,
        };

        const result1 = await router.routeEvent(hwCreatedMessage);
        expect(result1.matchedSubscriptions).toContain('sub-asset-created');
        expect(result1.matchedSubscriptions).toContain('sub-hardware');
        expect(receivedBySubscription1).toEqual(['hw-created']);
        expect(receivedBySubscription2).toEqual(['hw-created']);

        // Event that matches only subscription 2
        const hwUpdatedEvent = createMockEvent('ASSET_UPDATED', 'hw-updated', { assetType: 'HARDWARE' });
        const hwUpdatedMessage: ParsedMessage = {
          messageId: 'msg-hw-updated',
          receiptHandle: 'receipt-2',
          event: hwUpdatedEvent,
          attributes: {} as SQSRecord['attributes'],
          approximateReceiveCount: 1,
        };

        const result2 = await router.routeEvent(hwUpdatedMessage);
        expect(result2.matchedSubscriptions).not.toContain('sub-asset-created');
        expect(result2.matchedSubscriptions).toContain('sub-hardware');
      });

      it('should respect subscription enabled state', async () => {
        const router = new SubscriptionRouter();
        const receivedEvents: string[] = [];

        const subscription: SubscriptionConfig = {
          subscriptionId: 'sub-disabled',
          name: 'Disabled Subscription',
          eventTypes: ['ASSET_CREATED'],
          enabled: false, // Disabled
        };

        router
          .addSubscription(subscription)
          .setHandler('sub-disabled', async (message) => {
            receivedEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'disabled-test');
        const message: ParsedMessage = {
          messageId: 'msg-disabled',
          receiptHandle: 'receipt',
          event,
          attributes: {} as SQSRecord['attributes'],
          approximateReceiveCount: 1,
        };

        const result = await router.routeEvent(message);

        expect(result.matchedSubscriptions).toEqual([]);
        expect(result.routed).toBe(false);
        expect(receivedEvents).toEqual([]);
      });

      it('should support category-based subscriptions', async () => {
        const router = new SubscriptionRouter();
        const receivedEvents: string[] = [];

        const subscription: SubscriptionConfig = {
          subscriptionId: 'sub-asset-category',
          name: 'All Asset Events',
          categories: ['ASSET'],
          enabled: true,
        };

        router
          .addSubscription(subscription)
          .setHandler('sub-asset-category', async (message) => {
            receivedEvents.push(message.event.eventType);
          });

        // Test various ASSET category events
        const events = [
          createMockEvent('ASSET_CREATED', 'e1'),
          createMockEvent('ASSET_UPDATED', 'e2'),
          createMockEvent('ASSET_DELETED', 'e3'),
          createMockEvent('ASSET_STATE_CHANGED', 'e4'),
        ];

        for (const event of events) {
          const message: ParsedMessage = {
            messageId: `msg-${event.eventId}`,
            receiptHandle: 'receipt',
            event,
            attributes: {} as SQSRecord['attributes'],
            approximateReceiveCount: 1,
          };
          await router.routeEvent(message);
        }

        expect(receivedEvents).toEqual([
          'ASSET_CREATED',
          'ASSET_UPDATED',
          'ASSET_DELETED',
          'ASSET_STATE_CHANGED',
        ]);
      });

      it('should evaluate subscriptions in priority order', async () => {
        const router = new SubscriptionRouter();
        const executionOrder: string[] = [];

        router
          .addSubscription({
            subscriptionId: 'sub-low-priority',
            name: 'Low Priority',
            eventTypes: ['ASSET_CREATED'],
            enabled: true,
            priority: 300,
          })
          .addSubscription({
            subscriptionId: 'sub-high-priority',
            name: 'High Priority',
            eventTypes: ['ASSET_CREATED'],
            enabled: true,
            priority: 100,
          })
          .addSubscription({
            subscriptionId: 'sub-medium-priority',
            name: 'Medium Priority',
            eventTypes: ['ASSET_CREATED'],
            enabled: true,
            priority: 200,
          })
          .setHandler('sub-low-priority', async () => { executionOrder.push('low'); })
          .setHandler('sub-high-priority', async () => { executionOrder.push('high'); })
          .setHandler('sub-medium-priority', async () => { executionOrder.push('medium'); });

        const event = createMockEvent('ASSET_CREATED', 'priority-test');
        const message: ParsedMessage = {
          messageId: 'msg-priority',
          receiptHandle: 'receipt',
          event,
          attributes: {} as SQSRecord['attributes'],
          approximateReceiveCount: 1,
        };

        await router.routeEvent(message);

        expect(executionOrder).toEqual(['high', 'medium', 'low']);
      });
    });


    describe('filter-based event routing with EventRouter', () => {
      it('should route events based on filter rules', async () => {
        const hardwareEvents: string[] = [];
        const softwareEvents: string[] = [];
        const allAssetEvents: string[] = [];

        const router = createEventRouter()
          .on('ASSET_CREATED', async (message) => {
            hardwareEvents.push(message.event.eventId);
          }, {
            filter: (event) => {
              const payload = event.payload as { assetType?: string };
              return payload.assetType === 'HARDWARE';
            },
          })
          .on('ASSET_CREATED', async (message) => {
            softwareEvents.push(message.event.eventId);
          }, {
            filter: (event) => {
              const payload = event.payload as { assetType?: string };
              return payload.assetType === 'SOFTWARE';
            },
          })
          .onCategory('ASSET', async (message) => {
            allAssetEvents.push(message.event.eventId);
          });

        const hwEvent = createMockEvent('ASSET_CREATED', 'hw-filter', { assetType: 'HARDWARE' });
        const swEvent = createMockEvent('ASSET_CREATED', 'sw-filter', { assetType: 'SOFTWARE' });

        await router.process(createMockSQSEvent([createMockSQSRecord(hwEvent)]));
        await router.process(createMockSQSEvent([createMockSQSRecord(swEvent)]));

        expect(hardwareEvents).toEqual(['hw-filter']);
        expect(softwareEvents).toEqual(['sw-filter']);
        expect(allAssetEvents).toEqual(['hw-filter', 'sw-filter']);
      });

      it('should create filter from filter rules', async () => {
        const rules: FilterRule[] = [
          {
            logic: 'AND',
            rules: [
              { attribute: 'eventType', operator: 'in', value: ['ASSET_CREATED', 'ASSET_UPDATED'] },
              { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
            ],
          },
        ];

        const filter = createFilterFromRules(rules);
        const processedEvents: string[] = [];

        const router = createEventRouter()
          .on('ASSET_CREATED', async (message) => {
            processedEvents.push(message.event.eventId);
          }, { filter })
          .on('ASSET_UPDATED', async (message) => {
            processedEvents.push(message.event.eventId);
          }, { filter });

        // Should match: ASSET_CREATED + HARDWARE
        const matchEvent1 = createMockEvent('ASSET_CREATED', 'match-1', { assetType: 'HARDWARE' });
        await router.process(createMockSQSEvent([createMockSQSRecord(matchEvent1)]));

        // Should match: ASSET_UPDATED + HARDWARE
        const matchEvent2 = createMockEvent('ASSET_UPDATED', 'match-2', { assetType: 'HARDWARE' });
        await router.process(createMockSQSEvent([createMockSQSRecord(matchEvent2)]));

        // Should NOT match: ASSET_CREATED + SOFTWARE
        const noMatchEvent = createMockEvent('ASSET_CREATED', 'no-match', { assetType: 'SOFTWARE' });
        await router.process(createMockSQSEvent([createMockSQSRecord(noMatchEvent)]));

        expect(processedEvents).toEqual(['match-1', 'match-2']);
      });
    });
  });


  // ============================================================================
  // Section 6: End-to-End Event Processing Flow Tests
  // Validates: Requirements 9.1-9.8 (Integration)
  // ============================================================================

  describe('End-to-End Event Processing Flow', () => {
    it('should handle complete publish-consume-process flow', async () => {
      // Step 1: Publish an event
      const publishResult = await publishAssetCreated(
        'e2e-asset-123',
        'HARDWARE',
        'AMS-HW-20250101-E2E01',
        'user-e2e',
        mockAsset
      );

      expect(publishResult.eventType).toBe('ASSET_CREATED');
      expect(publishResult.eventId).toBeDefined();

      // Step 2: Simulate the event being received by SQS consumer
      const publishedMessage = JSON.parse(
        snsMock.commandCalls(PublishCommand)[0]!.args[0].input.Message as string
      );

      const sqsEvent = createMockSQSEvent([
        createMockSQSRecord(publishedMessage as DomainEvent, { messageId: 'e2e-msg' }),
      ]);

      // Step 3: Process with idempotency
      const store = new InMemoryIdempotencyStore();
      const processedEvents: Array<{ eventId: string; eventType: string }> = [];

      const router = createEventRouter()
        .withIdempotency(store)
        .on('ASSET_CREATED', async (message) => {
          processedEvents.push({
            eventId: message.event.eventId,
            eventType: message.event.eventType,
          });
        });

      const response = await router.process(sqsEvent);

      // Verify successful processing
      expect(response.batchItemFailures).toEqual([]);
      expect(processedEvents).toHaveLength(1);
      expect(processedEvents[0]?.eventType).toBe('ASSET_CREATED');

      // Step 4: Verify idempotency - reprocessing should skip
      await router.process(sqsEvent);
      expect(processedEvents).toHaveLength(1); // Still only 1
    });

    it('should handle mixed success and failure in batch processing', async () => {
      const store = new InMemoryIdempotencyStore();
      const successfulEvents: string[] = [];
      const failedEventIds = new Set(['fail-event-1', 'fail-event-3']);

      const router = createEventRouter()
        .withIdempotency(store)
        .on('ASSET_CREATED', async (message) => {
          if (failedEventIds.has(message.event.eventId)) {
            throw new Error(`Simulated failure for ${message.event.eventId}`);
          }
          successfulEvents.push(message.event.eventId);
        });

      const events = [
        createMockEvent('ASSET_CREATED', 'success-event-1'),
        createMockEvent('ASSET_CREATED', 'fail-event-1'),
        createMockEvent('ASSET_CREATED', 'success-event-2'),
        createMockEvent('ASSET_CREATED', 'fail-event-3'),
        createMockEvent('ASSET_CREATED', 'success-event-3'),
      ];

      const sqsEvent = createMockSQSEvent(
        events.map((e, i) => createMockSQSRecord(e, { messageId: `msg-${i}` }))
      );

      const response = await router.process(sqsEvent);

      // Verify partial batch failures
      expect(response.batchItemFailures).toHaveLength(2);
      expect(response.batchItemFailures.map((f) => f.itemIdentifier)).toEqual(['msg-1', 'msg-3']);

      // Verify successful events were processed
      expect(successfulEvents).toEqual(['success-event-1', 'success-event-2', 'success-event-3']);

      // Verify only successful events are marked as processed
      expect(await store.isProcessed('success-event-1')).toBe(true);
      expect(await store.isProcessed('fail-event-1')).toBe(false);
      expect(await store.isProcessed('success-event-2')).toBe(true);
      expect(await store.isProcessed('fail-event-3')).toBe(false);
      expect(await store.isProcessed('success-event-3')).toBe(true);
    });

    it('should support middleware chain in event processing', async () => {
      const executionLog: string[] = [];

      const router = createEventRouter()
        .use(async (message, next) => {
          executionLog.push(`pre-validation: ${message.event.eventId}`);
          await next();
          executionLog.push(`post-validation: ${message.event.eventId}`);
        })
        .use(async (message, next) => {
          executionLog.push(`pre-logging: ${message.event.eventId}`);
          await next();
          executionLog.push(`post-logging: ${message.event.eventId}`);
        })
        .on('ASSET_CREATED', async (message) => {
          executionLog.push(`handler: ${message.event.eventId}`);
        });

      const event = createMockEvent('ASSET_CREATED', 'middleware-test');
      const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

      await router.process(sqsEvent);

      expect(executionLog).toEqual([
        'pre-validation: middleware-test',
        'pre-logging: middleware-test',
        'handler: middleware-test',
        'post-logging: middleware-test',
        'post-validation: middleware-test',
      ]);
    });

    it('should create functional Lambda handler from router', async () => {
      const processedEvents: string[] = [];

      const router = createEventRouter()
        .on('ASSET_CREATED', async (message) => {
          processedEvents.push(message.event.eventId);
        })
        .on('ASSET_UPDATED', async (message) => {
          processedEvents.push(message.event.eventId);
        });

      const lambdaHandler = createLambdaHandler(router);

      const events = [
        createMockEvent('ASSET_CREATED', 'lambda-event-1'),
        createMockEvent('ASSET_UPDATED', 'lambda-event-2'),
      ];

      const sqsEvent = createMockSQSEvent(
        events.map((e, i) => createMockSQSRecord(e, { messageId: `lambda-msg-${i}` }))
      );

      const response = await lambdaHandler(sqsEvent);

      expect(response.batchItemFailures).toEqual([]);
      expect(processedEvents).toEqual(['lambda-event-1', 'lambda-event-2']);
    });
  });
});
