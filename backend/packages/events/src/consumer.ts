/**
 * SQS message consumer utilities
 *
 * This module provides utilities for consuming and processing SQS messages
 * containing domain events. It implements idempotent message handling,
 * dead-letter queue processing, and partial batch failure responses.
 *
 * Requirements: 9.3, 9.4, 9.5, 9.7
 * - THE Event_Bus SHALL support multiple subscribers per event type for extensibility
 * - THE Message_Queue SHALL implement dead-letter queues for failed message processing
 * - WHEN a message fails processing after configured retries, THE Message_Queue SHALL move it to the dead-letter queue
 * - THE Event_Consumer SHALL implement idempotent message handling to support reprocessing
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';

import type { DomainEvent, EventType } from '@ams/types';
import { createLogger } from '@ams/utils';

const logger = createLogger({ service: 'event-consumer' });

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Parsed SQS message with event data
 */
export interface ParsedMessage<T extends DomainEvent = DomainEvent> {
  readonly messageId: string;
  readonly receiptHandle: string;
  readonly event: T;
  readonly attributes: SQSRecord['attributes'];
  readonly approximateReceiveCount: number;
}

/**
 * Message processing result
 */
export interface ProcessingResult {
  readonly messageId: string;
  readonly success: boolean;
  readonly error?: Error;
  readonly skipped?: boolean;
  readonly reason?: string;
}

/**
 * Dead-letter queue message with additional metadata
 */
export interface DLQMessage<T extends DomainEvent = DomainEvent> {
  readonly messageId: string;
  readonly event: T;
  readonly originalQueueArn?: string;
  readonly failureReason?: string;
  readonly receiveCount: number;
  readonly firstReceivedAt?: string;
  readonly sentAt?: string;
}

/**
 * Message handler function type
 */
export type MessageHandler<T extends DomainEvent = DomainEvent> = (
  message: ParsedMessage<T>
) => Promise<void>;

/**
 * Idempotency store interface for tracking processed messages
 */
export interface IdempotencyStore {
  /**
   * Check if an event has been processed
   */
  isProcessed(eventId: string): Promise<boolean>;

  /**
   * Mark an event as processed
   */
  markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;

  /**
   * Mark an event as in-progress (for distributed locking)
   */
  markInProgress(eventId: string, ttlSeconds?: number): Promise<boolean>;

  /**
   * Clear in-progress status (on failure)
   */
  clearInProgress(eventId: string): Promise<void>;
}

/**
 * Consumer configuration options
 */
export interface ConsumerConfig {
  /** Idempotency store for deduplication */
  readonly idempotencyStore?: IdempotencyStore;
  /** TTL for idempotency records in seconds (default: 24 hours) */
  readonly idempotencyTtlSeconds?: number;
  /** Whether to use distributed locking for processing */
  readonly useDistributedLocking?: boolean;
  /** Lock TTL in seconds (default: 5 minutes) */
  readonly lockTtlSeconds?: number;
}

// ============================================================================
// In-Memory Idempotency Store (for testing/development)
// ============================================================================

/**
 * In-memory idempotency store for testing and development
 * In production, use RedisIdempotencyStore
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly processed = new Map<string, number>();
  private readonly inProgress = new Set<string>();

  async isProcessed(eventId: string): Promise<boolean> {
    const expiresAt = this.processed.get(eventId);
    if (expiresAt === undefined) {
      return false;
    }
    if (Date.now() > expiresAt) {
      this.processed.delete(eventId);
      return false;
    }
    return true;
  }

  async markProcessed(eventId: string, ttlSeconds: number = 86400): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.processed.set(eventId, expiresAt);
    this.inProgress.delete(eventId);
  }

  async markInProgress(eventId: string, _ttlSeconds: number = 300): Promise<boolean> {
    if (this.inProgress.has(eventId)) {
      return false; // Already being processed
    }
    this.inProgress.add(eventId);
    return true;
  }

  async clearInProgress(eventId: string): Promise<void> {
    this.inProgress.delete(eventId);
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.processed.clear();
    this.inProgress.clear();
  }
}

// ============================================================================
// Redis Idempotency Store
// ============================================================================

/**
 * Redis-based idempotency store for production use
 * Provides distributed deduplication across Lambda instances
 */
export class RedisIdempotencyStore implements IdempotencyStore {
  private readonly keyPrefix: string;
  private readonly getClient: () => Promise<RedisLikeClient>;

  constructor(
    getClient: () => Promise<RedisLikeClient>,
    keyPrefix: string = 'event:processed:'
  ) {
    this.getClient = getClient;
    this.keyPrefix = keyPrefix;
  }

  async isProcessed(eventId: string): Promise<boolean> {
    try {
      const client = await this.getClient();
      const key = `${this.keyPrefix}${eventId}`;
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Failed to check idempotency', error as Error, { eventId });
      // On error, assume not processed to avoid data loss
      return false;
    }
  }

  async markProcessed(eventId: string, ttlSeconds: number = 86400): Promise<void> {
    try {
      const client = await this.getClient();
      const key = `${this.keyPrefix}${eventId}`;
      await client.setex(key, ttlSeconds, 'processed');
      // Clear any in-progress lock
      await client.del(`${this.keyPrefix}lock:${eventId}`);
    } catch (error) {
      logger.error('Failed to mark as processed', error as Error, { eventId });
      // Don't throw - message was processed, just tracking failed
    }
  }

  async markInProgress(eventId: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const client = await this.getClient();
      const key = `${this.keyPrefix}lock:${eventId}`;
      // Use SET NX EX for atomic lock acquisition
      const result = await client.set(key, 'processing', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      logger.error('Failed to acquire processing lock', error as Error, { eventId });
      // On error, allow processing to proceed
      return true;
    }
  }

  async clearInProgress(eventId: string): Promise<void> {
    try {
      const client = await this.getClient();
      const key = `${this.keyPrefix}lock:${eventId}`;
      await client.del(key);
    } catch (error) {
      logger.error('Failed to clear processing lock', error as Error, { eventId });
    }
  }
}

/**
 * Minimal Redis client interface for idempotency store
 */
export interface RedisLikeClient {
  exists(key: string): Promise<number>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  set(
    key: string,
    value: string,
    expiryMode: string,
    time: number,
    setMode: string
  ): Promise<string | null>;
  del(key: string): Promise<number>;
}

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Parse an SQS record to extract the domain event
 */
export function parseMessage<T extends DomainEvent = DomainEvent>(
  record: SQSRecord
): ParsedMessage<T> | null {
  try {
    // SNS wraps the message in another JSON envelope
    const snsMessage = JSON.parse(record.body) as { Message?: string };
    const eventBody = snsMessage.Message ?? record.body;
    const event = JSON.parse(eventBody) as T;

    // Extract receive count from attributes
    const receiveCount = parseInt(
      record.attributes.ApproximateReceiveCount ?? '1',
      10
    );

    return {
      messageId: record.messageId,
      receiptHandle: record.receiptHandle,
      event,
      attributes: record.attributes,
      approximateReceiveCount: receiveCount,
    };
  } catch (error) {
    logger.error('Failed to parse SQS message', error as Error, {
      messageId: record.messageId,
      body: record.body.substring(0, 200), // Log first 200 chars for debugging
    });
    return null;
  }
}

/**
 * Parse all messages from an SQS event
 */
export function parseMessages<T extends DomainEvent = DomainEvent>(
  event: SQSEvent
): ParsedMessage<T>[] {
  const messages: ParsedMessage<T>[] = [];

  for (const record of event.Records) {
    const parsed = parseMessage<T>(record);
    if (parsed) {
      messages.push(parsed);
    }
  }

  return messages;
}

/**
 * Parse a dead-letter queue message
 */
export function parseDLQMessage<T extends DomainEvent = DomainEvent>(
  record: SQSRecord
): DLQMessage<T> | null {
  const parsed = parseMessage<T>(record);
  if (!parsed) {
    return null;
  }

  return {
    messageId: parsed.messageId,
    event: parsed.event,
    originalQueueArn: record.eventSourceARN,
    receiveCount: parsed.approximateReceiveCount,
    firstReceivedAt: record.attributes.ApproximateFirstReceiveTimestamp,
    sentAt: record.attributes.SentTimestamp,
  };
}

// ============================================================================
// Message Processing
// ============================================================================

/**
 * Process messages with a handler function
 */
export async function processMessages<T extends DomainEvent = DomainEvent>(
  event: SQSEvent,
  handler: MessageHandler<T>,
  config?: ConsumerConfig
): Promise<ProcessingResult[]> {
  const messages = parseMessages<T>(event);
  const results: ProcessingResult[] = [];
  const idempotencyStore = config?.idempotencyStore;
  const idempotencyTtl = config?.idempotencyTtlSeconds ?? 86400; // 24 hours default
  const useDistributedLocking = config?.useDistributedLocking ?? false;
  const lockTtl = config?.lockTtlSeconds ?? 300; // 5 minutes default

  for (const message of messages) {
    const eventId = message.event.eventId;

    try {
      // Check idempotency if store is configured
      if (idempotencyStore) {
        const alreadyProcessed = await idempotencyStore.isProcessed(eventId);
        if (alreadyProcessed) {
          logger.info('Message already processed, skipping', {
            messageId: message.messageId,
            eventId,
          });
          results.push({
            messageId: message.messageId,
            success: true,
            skipped: true,
            reason: 'Already processed',
          });
          continue;
        }

        // Acquire distributed lock if enabled
        if (useDistributedLocking) {
          const lockAcquired = await idempotencyStore.markInProgress(eventId, lockTtl);
          if (!lockAcquired) {
            logger.info('Message being processed by another instance, skipping', {
              messageId: message.messageId,
              eventId,
            });
            results.push({
              messageId: message.messageId,
              success: true,
              skipped: true,
              reason: 'Being processed by another instance',
            });
            continue;
          }
        }
      }

      logger.info('Processing message', {
        messageId: message.messageId,
        eventType: message.event.eventType,
        eventId,
        receiveCount: message.approximateReceiveCount,
      });

      // Process the message
      await handler(message);

      // Mark as processed
      if (idempotencyStore) {
        await idempotencyStore.markProcessed(eventId, idempotencyTtl);
      }

      results.push({
        messageId: message.messageId,
        success: true,
      });

      logger.info('Message processed successfully', {
        messageId: message.messageId,
        eventId,
      });
    } catch (error) {
      logger.error('Failed to process message', error as Error, {
        messageId: message.messageId,
        eventId,
        receiveCount: message.approximateReceiveCount,
      });

      // Clear in-progress lock on failure
      if (idempotencyStore && useDistributedLocking) {
        await idempotencyStore.clearInProgress(eventId);
      }

      results.push({
        messageId: message.messageId,
        success: false,
        error: error as Error,
      });
    }
  }

  return results;
}

// ============================================================================
// Dead-Letter Queue Processing
// ============================================================================

/**
 * DLQ message handler type
 */
export type DLQMessageHandler<T extends DomainEvent = DomainEvent> = (
  message: DLQMessage<T>
) => Promise<DLQHandlerResult>;

/**
 * Result of DLQ message handling
 */
export interface DLQHandlerResult {
  /** Whether the message was successfully handled */
  readonly success: boolean;
  /** Action taken on the message */
  readonly action: 'reprocessed' | 'archived' | 'discarded' | 'failed';
  /** Optional reason for the action */
  readonly reason?: string;
}

/**
 * DLQ processing configuration
 */
export interface DLQProcessorConfig {
  /** Maximum receive count before archiving (default: 5) */
  readonly maxReceiveCount?: number;
  /** Handler for reprocessing messages */
  readonly reprocessHandler?: MessageHandler<DomainEvent>;
  /** Handler for archiving messages (e.g., to S3) */
  readonly archiveHandler?: (message: DLQMessage<DomainEvent>) => Promise<void>;
  /** Event types that should be discarded instead of archived */
  readonly discardEventTypes?: readonly EventType[];
}

/**
 * Process dead-letter queue messages
 *
 * This function handles messages that have failed processing multiple times.
 * It can reprocess, archive, or discard messages based on configuration.
 *
 * Validates: Requirements 9.4, 9.5
 */
export async function processDLQMessages(
  event: SQSEvent,
  config: DLQProcessorConfig = {}
): Promise<ProcessingResult[]> {
  const {
    maxReceiveCount = 5,
    reprocessHandler,
    archiveHandler,
    discardEventTypes = [],
  } = config;

  const results: ProcessingResult[] = [];

  for (const record of event.Records) {
    const dlqMessage = parseDLQMessage(record);

    if (!dlqMessage) {
      logger.error('Failed to parse DLQ message', undefined, {
        messageId: record.messageId,
      });
      results.push({
        messageId: record.messageId,
        success: false,
        error: new Error('Failed to parse DLQ message'),
      });
      continue;
    }

    try {
      const eventType = dlqMessage.event.eventType;

      logger.info('Processing DLQ message', {
        messageId: dlqMessage.messageId,
        eventType,
        eventId: dlqMessage.event.eventId,
        receiveCount: dlqMessage.receiveCount,
      });

      // Check if event type should be discarded
      if (discardEventTypes.includes(eventType)) {
        logger.info('Discarding DLQ message (event type in discard list)', {
          messageId: dlqMessage.messageId,
          eventType,
        });
        results.push({
          messageId: dlqMessage.messageId,
          success: true,
          reason: 'Discarded - event type in discard list',
        });
        continue;
      }

      // If receive count is low and we have a reprocess handler, try reprocessing
      if (dlqMessage.receiveCount < maxReceiveCount && reprocessHandler) {
        try {
          const parsedMessage: ParsedMessage = {
            messageId: dlqMessage.messageId,
            receiptHandle: record.receiptHandle,
            event: dlqMessage.event,
            attributes: record.attributes,
            approximateReceiveCount: dlqMessage.receiveCount,
          };

          await reprocessHandler(parsedMessage);

          logger.info('DLQ message reprocessed successfully', {
            messageId: dlqMessage.messageId,
            eventId: dlqMessage.event.eventId,
          });

          results.push({
            messageId: dlqMessage.messageId,
            success: true,
            reason: 'Reprocessed successfully',
          });
          continue;
        } catch (reprocessError) {
          logger.warn('DLQ message reprocessing failed, will archive', {
            messageId: dlqMessage.messageId,
            error: (reprocessError as Error).message,
          });
        }
      }

      // Archive the message if handler is provided
      if (archiveHandler) {
        await archiveHandler(dlqMessage);
        logger.info('DLQ message archived', {
          messageId: dlqMessage.messageId,
          eventId: dlqMessage.event.eventId,
        });
        results.push({
          messageId: dlqMessage.messageId,
          success: true,
          reason: 'Archived',
        });
      } else {
        // No archive handler, just log and acknowledge
        logger.warn('DLQ message acknowledged without archiving (no archive handler)', {
          messageId: dlqMessage.messageId,
          eventId: dlqMessage.event.eventId,
        });
        results.push({
          messageId: dlqMessage.messageId,
          success: true,
          reason: 'Acknowledged without archiving',
        });
      }
    } catch (error) {
      logger.error('Failed to process DLQ message', error as Error, {
        messageId: dlqMessage.messageId,
        eventId: dlqMessage.event.eventId,
      });
      results.push({
        messageId: dlqMessage.messageId,
        success: false,
        error: error as Error,
      });
    }
  }

  return results;
}

// ============================================================================
// Batch Failure Response
// ============================================================================

/**
 * Get failed message IDs for partial batch failure response
 */
export function getFailedMessageIds(results: readonly ProcessingResult[]): string[] {
  return results.filter((r) => !r.success).map((r) => r.messageId);
}

/**
 * Build partial batch failure response for Lambda
 *
 * This allows successfully processed messages to be removed from the queue
 * while failed messages are retried.
 */
export function buildBatchItemFailures(
  failedMessageIds: readonly string[]
): { batchItemFailures: { itemIdentifier: string }[] } {
  return {
    batchItemFailures: failedMessageIds.map((id) => ({
      itemIdentifier: id,
    })),
  };
}

// ============================================================================
// Idempotent Handler Wrapper
// ============================================================================

/**
 * Wrap a message handler with idempotency checking
 *
 * This is a convenience wrapper that adds idempotency to any handler.
 * For more control, use processMessages with ConsumerConfig.
 */
export function withIdempotency<T extends DomainEvent>(
  handler: MessageHandler<T>,
  store: IdempotencyStore,
  ttlSeconds: number = 86400
): MessageHandler<T> {
  return async (message: ParsedMessage<T>): Promise<void> => {
    const eventId = message.event.eventId;

    // Check if already processed
    if (await store.isProcessed(eventId)) {
      logger.info('Message already processed, skipping', { eventId });
      return;
    }

    // Process the message
    await handler(message);

    // Mark as processed
    await store.markProcessed(eventId, ttlSeconds);
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract event metadata for logging
 */
export function extractMessageMetadata(message: ParsedMessage): Record<string, unknown> {
  return {
    messageId: message.messageId,
    eventId: message.event.eventId,
    eventType: message.event.eventType,
    source: message.event.source,
    timestamp: message.event.timestamp,
    receiveCount: message.approximateReceiveCount,
  };
}

/**
 * Check if a message should be sent to DLQ based on receive count
 */
export function shouldMoveToDLQ(
  message: ParsedMessage,
  maxRetries: number = 3
): boolean {
  return message.approximateReceiveCount >= maxRetries;
}

/**
 * Create a consumer that processes messages and returns batch failures
 */
export function createConsumer<T extends DomainEvent = DomainEvent>(
  handler: MessageHandler<T>,
  config?: ConsumerConfig
): (event: SQSEvent) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
  return async (event: SQSEvent) => {
    logger.info('Processing SQS event', { recordCount: event.Records.length });
    const results = await processMessages<T>(event, handler, config);
    const failedIds = getFailedMessageIds(results);
    return buildBatchItemFailures(failedIds);
  };
}

/**
 * Create a DLQ consumer
 */
export function createDLQConsumer(
  config: DLQProcessorConfig = {}
): (event: SQSEvent) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
  return async (event: SQSEvent) => {
    logger.info('Processing DLQ event', { recordCount: event.Records.length });
    const results = await processDLQMessages(event, config);
    const failedIds = getFailedMessageIds(results);
    return buildBatchItemFailures(failedIds);
  };
}
