/**
 * Unit tests for Event Handler and Router
 *
 * Tests the event routing functionality including:
 * - Handler registration
 * - Category-based handlers
 * - Middleware execution
 * - Event filtering
 * - Idempotent processing
 * - Attribute-based filter rules (Requirement 9.8)
 * - Subscription routing (Requirement 9.8)
 *
 * Validates: Requirements 9.3, 9.7, 9.8
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';

import type { DomainEvent, EventType } from '@ams/types';

import { InMemoryIdempotencyStore } from '../consumer';
import {
  andFilters,
  assetTypeFilter,
  createEventRouter,
  createLambdaHandler,
  EventRouter,
  loggingMiddleware,
  metricsMiddleware,
  orFilters,
  payloadFilter,
  retryTrackingMiddleware,
  sourceFilter,
  validationMiddleware,
} from '../event-handler';
import type { EventMiddleware } from '../event-handler';

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Event Handler', () => {
  // Helper to create a mock domain event
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

  // Helper to create a mock SQS record
  function createMockSQSRecord(
    event: DomainEvent,
    options: { messageId?: string; receiveCount?: number } = {}
  ): SQSRecord {
    const { messageId = 'msg-123', receiveCount = 1 } = options;

    return {
      messageId,
      receiptHandle: `receipt-${messageId}`,
      body: JSON.stringify({ Message: JSON.stringify(event) }),
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

  describe('EventRouter', () => {
    let router: EventRouter;

    beforeEach(() => {
      router = createEventRouter();
    });

    describe('handler registration', () => {
      it('should register handler for event type', () => {
        router.on('ASSET_CREATED', async () => {});

        expect(router.hasHandler('ASSET_CREATED')).toBe(true);
        expect(router.getRegisteredEventTypes()).toContain('ASSET_CREATED');
      });

      it('should register multiple handlers for same event type', () => {
        router
          .on('ASSET_CREATED', async () => {})
          .on('ASSET_CREATED', async () => {});

        const handlers = router.getHandlers('ASSET_CREATED');
        expect(handlers).toHaveLength(2);
      });

      it('should sort handlers by priority', () => {
        const executionOrder: number[] = [];

        router
          .on('ASSET_CREATED', async () => { executionOrder.push(2); }, { priority: 200 })
          .on('ASSET_CREATED', async () => { executionOrder.push(1); }, { priority: 100 })
          .on('ASSET_CREATED', async () => { executionOrder.push(3); }, { priority: 300 });

        const handlers = router.getHandlers('ASSET_CREATED');
        expect(handlers[0]?.options.priority).toBe(100);
        expect(handlers[1]?.options.priority).toBe(200);
        expect(handlers[2]?.options.priority).toBe(300);
      });

      it('should register category handler', () => {
        router.onCategory('ASSET', async () => {});

        expect(router.getRegisteredCategories()).toContain('ASSET');
      });

      it('should register default handler', () => {
        router.onDefault(async () => {});

        expect(router.hasHandler('UNKNOWN_EVENT' as EventType)).toBe(true);
      });
    });

    describe('event processing', () => {
      it('should route event to registered handler', async () => {
        const processedEvents: string[] = [];

        router.on('ASSET_CREATED', async (message) => {
          processedEvents.push(message.event.eventId);
        });

        const event = createMockEvent('ASSET_CREATED', 'event-1');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-1' }),
        ]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([]);
        expect(processedEvents).toEqual(['event-1']);
      });

      it('should execute handlers in priority order', async () => {
        const executionOrder: number[] = [];

        router
          .on('ASSET_CREATED', async () => { executionOrder.push(3); }, { priority: 300 })
          .on('ASSET_CREATED', async () => { executionOrder.push(1); }, { priority: 100 })
          .on('ASSET_CREATED', async () => { executionOrder.push(2); }, { priority: 200 });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executionOrder).toEqual([1, 2, 3]);
      });

      it('should execute category handlers along with type handlers', async () => {
        const executedHandlers: string[] = [];

        router
          .on('ASSET_CREATED', async () => { executedHandlers.push('type'); })
          .onCategory('ASSET', async () => { executedHandlers.push('category'); });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executedHandlers).toContain('type');
        expect(executedHandlers).toContain('category');
      });

      it('should use default handler for unregistered event types', async () => {
        const processedEvents: string[] = [];

        router.onDefault(async (message) => {
          processedEvents.push(message.event.eventType);
        });

        const event = createMockEvent('WORK_ORDER_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual(['WORK_ORDER_CREATED']);
      });

      it('should return batch failures for failed handlers', async () => {
        router.on('ASSET_CREATED', async () => {
          throw new Error('Handler failed');
        });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-1' }),
        ]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([
          { itemIdentifier: 'msg-1' },
        ]);
      });

      it('should continue to next handler when continueOnError is true', async () => {
        const executedHandlers: string[] = [];

        router
          .on('ASSET_CREATED', async () => {
            executedHandlers.push('first');
            throw new Error('First handler failed');
          }, { priority: 100, continueOnError: true })
          .on('ASSET_CREATED', async () => {
            executedHandlers.push('second');
          }, { priority: 200 });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executedHandlers).toEqual(['first', 'second']);
      });

      it('should stop on error when continueOnError is false', async () => {
        const executedHandlers: string[] = [];

        router
          .on('ASSET_CREATED', async () => {
            executedHandlers.push('first');
            throw new Error('First handler failed');
          }, { priority: 100, continueOnError: false })
          .on('ASSET_CREATED', async () => {
            executedHandlers.push('second');
          }, { priority: 200 });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executedHandlers).toEqual(['first']);
      });
    });

    describe('event filtering', () => {
      it('should skip handler when filter returns false', async () => {
        const processedEvents: string[] = [];

        router.on(
          'ASSET_CREATED',
          async (message) => {
            processedEvents.push(message.event.eventId);
          },
          {
            filter: (event) => {
              const payload = event.payload as { assetType?: string };
              return payload.assetType === 'SOFTWARE';
            },
          }
        );

        const event = createMockEvent('ASSET_CREATED', 'event-1', { assetType: 'HARDWARE' });
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual([]);
      });

      it('should execute handler when filter returns true', async () => {
        const processedEvents: string[] = [];

        router.on(
          'ASSET_CREATED',
          async (message) => {
            processedEvents.push(message.event.eventId);
          },
          {
            filter: (event) => {
              const payload = event.payload as { assetType?: string };
              return payload.assetType === 'HARDWARE';
            },
          }
        );

        const event = createMockEvent('ASSET_CREATED', 'event-1', { assetType: 'HARDWARE' });
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual(['event-1']);
      });
    });

    describe('middleware', () => {
      it('should execute middleware before handlers', async () => {
        const executionOrder: string[] = [];

        const middleware: EventMiddleware = async (_message, next) => {
          executionOrder.push('middleware-before');
          await next();
          executionOrder.push('middleware-after');
        };

        router
          .use(middleware)
          .on('ASSET_CREATED', async () => {
            executionOrder.push('handler');
          });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executionOrder).toEqual(['middleware-before', 'handler', 'middleware-after']);
      });

      it('should execute multiple middleware in order', async () => {
        const executionOrder: string[] = [];

        router
          .use(async (_message, next) => {
            executionOrder.push('mw1-before');
            await next();
            executionOrder.push('mw1-after');
          })
          .use(async (_message, next) => {
            executionOrder.push('mw2-before');
            await next();
            executionOrder.push('mw2-after');
          })
          .on('ASSET_CREATED', async () => {
            executionOrder.push('handler');
          });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(executionOrder).toEqual([
          'mw1-before',
          'mw2-before',
          'handler',
          'mw2-after',
          'mw1-after',
        ]);
      });

      it('should propagate errors from middleware', async () => {
        router
          .use(async () => {
            throw new Error('Middleware error');
          })
          .on('ASSET_CREATED', async () => {});

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-1' }),
        ]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([
          { itemIdentifier: 'msg-1' },
        ]);
      });
    });

    describe('idempotency', () => {
      it('should skip already processed messages', async () => {
        const store = new InMemoryIdempotencyStore();
        await store.markProcessed('event-1');

        const processedEvents: string[] = [];

        router
          .withIdempotency(store)
          .on('ASSET_CREATED', async (message) => {
            processedEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'event-1');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual([]);
      });

      it('should process new messages and mark them as processed', async () => {
        const store = new InMemoryIdempotencyStore();
        const processedEvents: string[] = [];

        router
          .withIdempotency(store)
          .on('ASSET_CREATED', async (message) => {
            processedEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'event-1');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual(['event-1']);
        expect(await store.isProcessed('event-1')).toBe(true);
      });
    });

    describe('clear', () => {
      it('should clear all handlers and middleware', () => {
        router
          .on('ASSET_CREATED', async () => {})
          .onCategory('ASSET', async () => {})
          .onDefault(async () => {})
          .use(async (_, next) => { await next(); });

        router.clear();

        expect(router.getRegisteredEventTypes()).toEqual([]);
        expect(router.getRegisteredCategories()).toEqual([]);
        expect(router.hasHandler('ASSET_CREATED')).toBe(false);
      });
    });
  });

  describe('createEventRouter', () => {
    it('should create a new EventRouter instance', () => {
      const router = createEventRouter();
      expect(router).toBeInstanceOf(EventRouter);
    });
  });

  describe('createLambdaHandler', () => {
    it('should create a Lambda handler from router', async () => {
      const processedEvents: string[] = [];

      const router = createEventRouter()
        .on('ASSET_CREATED', async (message) => {
          processedEvents.push(message.event.eventId);
        });

      const handler = createLambdaHandler(router);

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

      const response = await handler(sqsEvent);

      expect(response.batchItemFailures).toEqual([]);
      expect(processedEvents).toEqual(['event-1']);
    });
  });

  describe('Built-in Middleware', () => {
    describe('loggingMiddleware', () => {
      it('should execute without errors', async () => {
        const router = createEventRouter()
          .use(loggingMiddleware())
          .on('ASSET_CREATED', async () => {});

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([]);
      });
    });

    describe('metricsMiddleware', () => {
      it('should call onMetric callback with success', async () => {
        const metrics: { eventType: EventType; success: boolean; durationMs: number }[] = [];

        const router = createEventRouter()
          .use(metricsMiddleware((metric) => metrics.push(metric)))
          .on('ASSET_CREATED', async () => {});

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(metrics).toHaveLength(1);
        expect(metrics[0]?.eventType).toBe('ASSET_CREATED');
        expect(metrics[0]?.success).toBe(true);
        expect(metrics[0]?.durationMs).toBeGreaterThanOrEqual(0);
      });

      it('should call onMetric callback with failure', async () => {
        const metrics: { eventType: EventType; success: boolean; durationMs: number }[] = [];

        const router = createEventRouter()
          .use(metricsMiddleware((metric) => metrics.push(metric)))
          .on('ASSET_CREATED', async () => {
            throw new Error('Handler failed');
          });

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(metrics).toHaveLength(1);
        expect(metrics[0]?.success).toBe(false);
      });
    });

    describe('validationMiddleware', () => {
      it('should pass valid events', async () => {
        const processedEvents: string[] = [];

        const router = createEventRouter()
          .use(validationMiddleware((event) => event.eventId !== undefined))
          .on('ASSET_CREATED', async (message) => {
            processedEvents.push(message.event.eventId);
          });

        const event = createMockEvent('ASSET_CREATED', 'event-1');
        const sqsEvent = createMockSQSEvent([createMockSQSRecord(event)]);

        await router.process(sqsEvent);

        expect(processedEvents).toEqual(['event-1']);
      });

      it('should reject invalid events', async () => {
        const router = createEventRouter()
          .use(validationMiddleware(() => false))
          .on('ASSET_CREATED', async () => {});

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { messageId: 'msg-1' }),
        ]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([
          { itemIdentifier: 'msg-1' },
        ]);
      });
    });

    describe('retryTrackingMiddleware', () => {
      it('should execute without errors', async () => {
        const router = createEventRouter()
          .use(retryTrackingMiddleware(3))
          .on('ASSET_CREATED', async () => {});

        const event = createMockEvent('ASSET_CREATED');
        const sqsEvent = createMockSQSEvent([
          createMockSQSRecord(event, { receiveCount: 2 }),
        ]);

        const response = await router.process(sqsEvent);

        expect(response.batchItemFailures).toEqual([]);
      });
    });
  });

  describe('Event Filters', () => {
    describe('assetTypeFilter', () => {
      it('should filter by asset type', () => {
        const filter = assetTypeFilter(['HARDWARE', 'SOFTWARE']);

        const hardwareEvent = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const softwareEvent = createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' });
        const enterpriseEvent = createMockEvent('ASSET_CREATED', 'e3', { assetType: 'ENTERPRISE' });

        expect(filter(hardwareEvent)).toBe(true);
        expect(filter(softwareEvent)).toBe(true);
        expect(filter(enterpriseEvent)).toBe(false);
      });

      it('should allow events without assetType', () => {
        const filter = assetTypeFilter(['HARDWARE']);

        const eventWithoutAssetType = {
          eventId: 'e1',
          eventType: 'CONTRACT_EXPIRING',
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'test',
          payload: { contractId: 'c1' },
        } as DomainEvent;

        expect(filter(eventWithoutAssetType)).toBe(true);
      });
    });

    describe('sourceFilter', () => {
      it('should filter by source', () => {
        const filter = sourceFilter(['asset-service', 'ham-service']);

        const event1 = { ...createMockEvent(), source: 'asset-service' };
        const event2 = { ...createMockEvent(), source: 'sam-service' };

        expect(filter(event1)).toBe(true);
        expect(filter(event2)).toBe(false);
      });
    });

    describe('payloadFilter', () => {
      it('should filter by payload predicate', () => {
        const filter = payloadFilter((payload) => {
          return (payload['priority'] as string) === 'HIGH';
        });

        const highPriorityEvent = createMockEvent('WORK_ORDER_CREATED', 'e1', { priority: 'HIGH' });
        const lowPriorityEvent = createMockEvent('WORK_ORDER_CREATED', 'e2', { priority: 'LOW' });

        expect(filter(highPriorityEvent)).toBe(true);
        expect(filter(lowPriorityEvent)).toBe(false);
      });
    });

    describe('andFilters', () => {
      it('should combine filters with AND logic', () => {
        const filter = andFilters(
          assetTypeFilter(['HARDWARE']),
          sourceFilter(['asset-service'])
        );

        const matchingEvent = {
          ...createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' }),
          source: 'asset-service',
        };
        const nonMatchingEvent1 = {
          ...createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' }),
          source: 'asset-service',
        };
        const nonMatchingEvent2 = {
          ...createMockEvent('ASSET_CREATED', 'e3', { assetType: 'HARDWARE' }),
          source: 'sam-service',
        };

        expect(filter(matchingEvent)).toBe(true);
        expect(filter(nonMatchingEvent1)).toBe(false);
        expect(filter(nonMatchingEvent2)).toBe(false);
      });
    });

    describe('orFilters', () => {
      it('should combine filters with OR logic', () => {
        const filter = orFilters(
          assetTypeFilter(['HARDWARE']),
          sourceFilter(['sam-service'])
        );

        const matchingEvent1 = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const matchingEvent2 = {
          ...createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' }),
          source: 'sam-service',
        };
        const nonMatchingEvent = {
          ...createMockEvent('ASSET_CREATED', 'e3', { assetType: 'SOFTWARE' }),
          source: 'asset-service',
        };

        expect(filter(matchingEvent1)).toBe(true);
        expect(filter(matchingEvent2)).toBe(true);
        expect(filter(nonMatchingEvent)).toBe(false);
      });
    });
  });
});
