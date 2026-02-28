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
export type MessageHandler<T extends DomainEvent = DomainEvent> = (message: ParsedMessage<T>) => Promise<void>;
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
/**
 * In-memory idempotency store for testing and development
 * In production, use RedisIdempotencyStore
 */
export declare class InMemoryIdempotencyStore implements IdempotencyStore {
    private readonly processed;
    private readonly inProgress;
    isProcessed(eventId: string): Promise<boolean>;
    markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
    markInProgress(eventId: string, _ttlSeconds?: number): Promise<boolean>;
    clearInProgress(eventId: string): Promise<void>;
    /**
     * Clear all entries (for testing)
     */
    clear(): void;
}
/**
 * Redis-based idempotency store for production use
 * Provides distributed deduplication across Lambda instances
 */
export declare class RedisIdempotencyStore implements IdempotencyStore {
    private readonly keyPrefix;
    private readonly getClient;
    constructor(getClient: () => Promise<RedisLikeClient>, keyPrefix?: string);
    isProcessed(eventId: string): Promise<boolean>;
    markProcessed(eventId: string, ttlSeconds?: number): Promise<void>;
    markInProgress(eventId: string, ttlSeconds?: number): Promise<boolean>;
    clearInProgress(eventId: string): Promise<void>;
}
/**
 * Minimal Redis client interface for idempotency store
 */
export interface RedisLikeClient {
    exists(key: string): Promise<number>;
    setex(key: string, seconds: number, value: string): Promise<string>;
    set(key: string, value: string, expiryMode: string, time: number, setMode: string): Promise<string | null>;
    del(key: string): Promise<number>;
}
/**
 * Parse an SQS record to extract the domain event
 */
export declare function parseMessage<T extends DomainEvent = DomainEvent>(record: SQSRecord): ParsedMessage<T> | null;
/**
 * Parse all messages from an SQS event
 */
export declare function parseMessages<T extends DomainEvent = DomainEvent>(event: SQSEvent): ParsedMessage<T>[];
/**
 * Parse a dead-letter queue message
 */
export declare function parseDLQMessage<T extends DomainEvent = DomainEvent>(record: SQSRecord): DLQMessage<T> | null;
/**
 * Process messages with a handler function
 */
export declare function processMessages<T extends DomainEvent = DomainEvent>(event: SQSEvent, handler: MessageHandler<T>, config?: ConsumerConfig): Promise<ProcessingResult[]>;
/**
 * DLQ message handler type
 */
export type DLQMessageHandler<T extends DomainEvent = DomainEvent> = (message: DLQMessage<T>) => Promise<DLQHandlerResult>;
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
export declare function processDLQMessages(event: SQSEvent, config?: DLQProcessorConfig): Promise<ProcessingResult[]>;
/**
 * Get failed message IDs for partial batch failure response
 */
export declare function getFailedMessageIds(results: readonly ProcessingResult[]): string[];
/**
 * Build partial batch failure response for Lambda
 *
 * This allows successfully processed messages to be removed from the queue
 * while failed messages are retried.
 */
export declare function buildBatchItemFailures(failedMessageIds: readonly string[]): {
    batchItemFailures: {
        itemIdentifier: string;
    }[];
};
/**
 * Wrap a message handler with idempotency checking
 *
 * This is a convenience wrapper that adds idempotency to any handler.
 * For more control, use processMessages with ConsumerConfig.
 */
export declare function withIdempotency<T extends DomainEvent>(handler: MessageHandler<T>, store: IdempotencyStore, ttlSeconds?: number): MessageHandler<T>;
/**
 * Extract event metadata for logging
 */
export declare function extractMessageMetadata(message: ParsedMessage): Record<string, unknown>;
/**
 * Check if a message should be sent to DLQ based on receive count
 */
export declare function shouldMoveToDLQ(message: ParsedMessage, maxRetries?: number): boolean;
/**
 * Create a consumer that processes messages and returns batch failures
 */
export declare function createConsumer<T extends DomainEvent = DomainEvent>(handler: MessageHandler<T>, config?: ConsumerConfig): (event: SQSEvent) => Promise<{
    batchItemFailures: {
        itemIdentifier: string;
    }[];
}>;
/**
 * Create a DLQ consumer
 */
export declare function createDLQConsumer(config?: DLQProcessorConfig): (event: SQSEvent) => Promise<{
    batchItemFailures: {
        itemIdentifier: string;
    }[];
}>;
//# sourceMappingURL=consumer.d.ts.map