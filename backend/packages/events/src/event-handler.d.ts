/**
 * Event handler registration and routing
 *
 * This module provides an event router for handling different event types
 * with registered handlers. It supports handler registration, default handlers,
 * middleware, and creates Lambda handlers for SQS event processing.
 *
 * Requirements: 9.3, 9.7, 9.8
 * - THE Event_Bus SHALL support multiple subscribers per event type for extensibility
 * - THE Event_Consumer SHALL implement idempotent message handling to support reprocessing
 * - THE Event_Bus SHALL support event filtering and routing based on event attributes
 */
import type { SQSEvent } from 'aws-lambda';
import type { DomainEvent, EventCategory, EventType } from '@ams/types';
import type { ConsumerConfig, IdempotencyStore, MessageHandler, ParsedMessage } from './consumer';
/**
 * Middleware function type
 */
export type EventMiddleware = (message: ParsedMessage<DomainEvent>, next: () => Promise<void>) => Promise<void>;
/**
 * Event filter function type
 */
export type EventFilter = (event: DomainEvent) => boolean;
/**
 * Handler registration options
 */
export interface HandlerOptions {
    /** Filter to apply before handler execution */
    readonly filter?: EventFilter;
    /** Priority for handler execution (lower = earlier, default: 100) */
    readonly priority?: number;
    /** Whether to continue to next handler on error (default: false) */
    readonly continueOnError?: boolean;
}
/**
 * Registered handler with metadata
 */
interface RegisteredHandler {
    readonly handler: MessageHandler<DomainEvent>;
    readonly options: HandlerOptions;
}
/**
 * Comparison operators for attribute-based filtering
 */
export type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'greaterThanOrEqual' | 'lessThanOrEqual' | 'in' | 'notIn' | 'exists' | 'notExists' | 'matches';
/**
 * Single attribute filter rule
 */
export interface AttributeFilterRule {
    /** Path to the attribute (supports dot notation for nested fields) */
    readonly attribute: string;
    /** Comparison operator */
    readonly operator: FilterOperator;
    /** Value to compare against (not required for exists/notExists) */
    readonly value?: unknown;
}
/**
 * Composite filter rule combining multiple rules
 */
export interface CompositeFilterRule {
    /** Logical operator to combine rules */
    readonly logic: 'AND' | 'OR';
    /** Child rules to combine */
    readonly rules: readonly FilterRule[];
}
/**
 * Filter rule - either a single attribute rule or a composite rule
 */
export type FilterRule = AttributeFilterRule | CompositeFilterRule;
/**
 * Subscription configuration for routing events to subscribers
 */
export interface SubscriptionConfig {
    /** Unique identifier for the subscription */
    readonly subscriptionId: string;
    /** Human-readable name for the subscription */
    readonly name: string;
    /** Event types this subscription handles (empty = all types) */
    readonly eventTypes?: readonly EventType[];
    /** Event categories this subscription handles (empty = all categories) */
    readonly categories?: readonly EventCategory[];
    /** Filter rules to apply to events */
    readonly filterRules?: readonly FilterRule[];
    /** Target queue URL or ARN for routing */
    readonly targetQueue?: string;
    /** Whether the subscription is enabled */
    readonly enabled: boolean;
    /** Priority for subscription evaluation (lower = earlier) */
    readonly priority?: number;
    /** Metadata for the subscription */
    readonly metadata?: Record<string, unknown>;
}
/**
 * Routing result for an event
 */
export interface RoutingResult {
    /** Event that was routed */
    readonly eventId: string;
    /** Event type */
    readonly eventType: EventType;
    /** Subscriptions that matched the event */
    readonly matchedSubscriptions: readonly string[];
    /** Subscriptions that were evaluated but didn't match */
    readonly unmatchedSubscriptions: readonly string[];
    /** Whether any subscription matched */
    readonly routed: boolean;
}
/**
 * Event router for handling different event types
 *
 * Supports:
 * - Multiple handlers per event type
 * - Category-based handlers
 * - Default handlers for unhandled events
 * - Middleware for cross-cutting concerns
 * - Event filtering
 * - Idempotent processing
 */
export declare class EventRouter {
    private readonly handlers;
    private readonly categoryHandlers;
    private readonly middleware;
    private defaultHandler?;
    private consumerConfig?;
    /**
     * Register a handler for a specific event type
     *
     * Multiple handlers can be registered for the same event type.
     * They will be executed in priority order.
     */
    on<T extends DomainEvent>(eventType: T['eventType'], handler: MessageHandler<T>, options?: HandlerOptions): this;
    /**
     * Register a handler for all events in a category
     */
    onCategory(category: EventCategory, handler: MessageHandler<DomainEvent>, options?: HandlerOptions): this;
    /**
     * Register a default handler for unhandled event types
     */
    onDefault(handler: MessageHandler<DomainEvent>): this;
    /**
     * Add middleware to the processing pipeline
     *
     * Middleware is executed in order for every message before handlers.
     */
    use(middleware: EventMiddleware): this;
    /**
     * Configure idempotency store for deduplication
     */
    withIdempotency(store: IdempotencyStore, config?: Partial<ConsumerConfig>): this;
    /**
     * Get all handlers for an event type (including category handlers)
     */
    getHandlers(eventType: EventType): RegisteredHandler[];
    /**
     * Check if any handler is registered for an event type
     */
    hasHandler(eventType: EventType): boolean;
    /**
     * Process an SQS event using registered handlers
     */
    process(event: SQSEvent): Promise<{
        batchItemFailures: {
            itemIdentifier: string;
        }[];
    }>;
    /**
     * Process a single message through middleware and handlers
     */
    private processMessage;
    /**
     * Process a single message and return result
     */
    private processMessageWithResult;
    /**
     * Execute all handlers for a message
     */
    private executeHandlers;
    /**
     * Get registered event types
     */
    getRegisteredEventTypes(): EventType[];
    /**
     * Get registered categories
     */
    getRegisteredCategories(): EventCategory[];
    /**
     * Clear all handlers (useful for testing)
     */
    clear(): void;
}
/**
 * Create a new event router
 */
export declare function createEventRouter(): EventRouter;
/**
 * Create a Lambda handler from an event router
 */
export declare function createLambdaHandler(router: EventRouter): (event: SQSEvent) => Promise<{
    batchItemFailures: {
        itemIdentifier: string;
    }[];
}>;
/**
 * Logging middleware - logs all events
 */
export declare function loggingMiddleware(): EventMiddleware;
/**
 * Metrics middleware - tracks processing metrics
 */
export declare function metricsMiddleware(onMetric: (metric: {
    eventType: EventType;
    success: boolean;
    durationMs: number;
}) => void): EventMiddleware;
/**
 * Validation middleware - validates event structure
 */
export declare function validationMiddleware(validator: (event: DomainEvent) => boolean): EventMiddleware;
/**
 * Retry tracking middleware - logs retry information
 */
export declare function retryTrackingMiddleware(maxRetries?: number): EventMiddleware;
/**
 * Create a filter for specific asset types
 */
export declare function assetTypeFilter(assetTypes: readonly string[]): EventFilter;
/**
 * Create a filter for specific sources
 */
export declare function sourceFilter(sources: readonly string[]): EventFilter;
/**
 * Create a filter based on event payload
 */
export declare function payloadFilter(predicate: (payload: Record<string, unknown>) => boolean): EventFilter;
/**
 * Combine multiple filters with AND logic
 */
export declare function andFilters(...filters: EventFilter[]): EventFilter;
/**
 * Combine multiple filters with OR logic
 */
export declare function orFilters(...filters: EventFilter[]): EventFilter;
/**
 * Get a nested value from an object using dot notation
 * @param obj - The object to get the value from
 * @param path - The path to the value (e.g., 'payload.assetType')
 * @returns The value at the path, or undefined if not found
 */
export declare function getNestedValue(obj: unknown, path: string): unknown;
/**
 * Check if a composite filter rule (type guard)
 */
export declare function isCompositeRule(rule: FilterRule): rule is CompositeFilterRule;
/**
 * Evaluate a single attribute filter rule against an event
 */
export declare function evaluateAttributeRule(event: DomainEvent, rule: AttributeFilterRule): boolean;
/**
 * Evaluate a filter rule (attribute or composite) against an event
 */
export declare function evaluateFilterRule(event: DomainEvent, rule: FilterRule): boolean;
/**
 * Evaluate multiple filter rules against an event (all must pass - AND logic)
 */
export declare function evaluateFilterRules(event: DomainEvent, rules: readonly FilterRule[]): boolean;
/**
 * Create an EventFilter from filter rules
 */
export declare function createFilterFromRules(rules: readonly FilterRule[]): EventFilter;
/**
 * Subscription router for routing events to multiple subscribers
 *
 * Supports:
 * - Multiple subscriptions per event type
 * - Attribute-based filtering
 * - Category-based subscriptions
 * - Priority-based evaluation
 * - Routing to target queues
 *
 * Validates: Requirements 9.3, 9.8
 */
export declare class SubscriptionRouter {
    private readonly subscriptions;
    private readonly handlers;
    /**
     * Add a subscription configuration
     */
    addSubscription(config: SubscriptionConfig): this;
    /**
     * Add a handler for a subscription
     */
    setHandler(subscriptionId: string, handler: MessageHandler<DomainEvent>): this;
    /**
     * Remove a subscription
     */
    removeSubscription(subscriptionId: string): boolean;
    /**
     * Enable or disable a subscription
     */
    setEnabled(subscriptionId: string, enabled: boolean): boolean;
    /**
     * Get all subscriptions
     */
    getSubscriptions(): readonly SubscriptionConfig[];
    /**
     * Get a subscription by ID
     */
    getSubscription(subscriptionId: string): SubscriptionConfig | undefined;
    /**
     * Check if an event matches a subscription's criteria
     */
    matchesSubscription(event: DomainEvent, subscription: SubscriptionConfig): boolean;
    /**
     * Find all matching subscriptions for an event
     */
    findMatchingSubscriptions(event: DomainEvent): readonly SubscriptionConfig[];
    /**
     * Route an event to all matching subscriptions
     */
    routeEvent(message: ParsedMessage<DomainEvent>): Promise<RoutingResult>;
    /**
     * Create an EventRouter middleware that routes events through subscriptions
     */
    createMiddleware(): EventMiddleware;
    /**
     * Clear all subscriptions (useful for testing)
     */
    clear(): void;
}
/**
 * Create a new subscription router
 */
export declare function createSubscriptionRouter(): SubscriptionRouter;
/**
 * Builder for creating filter rules with a fluent API
 */
export declare class FilterRuleBuilder {
    private rules;
    /**
     * Add an attribute equals rule
     */
    whereEquals(attribute: string, value: unknown): this;
    /**
     * Add an attribute not equals rule
     */
    whereNotEquals(attribute: string, value: unknown): this;
    /**
     * Add an attribute contains rule
     */
    whereContains(attribute: string, value: string): this;
    /**
     * Add an attribute starts with rule
     */
    whereStartsWith(attribute: string, value: string): this;
    /**
     * Add an attribute ends with rule
     */
    whereEndsWith(attribute: string, value: string): this;
    /**
     * Add an attribute greater than rule
     */
    whereGreaterThan(attribute: string, value: number | string): this;
    /**
     * Add an attribute less than rule
     */
    whereLessThan(attribute: string, value: number | string): this;
    /**
     * Add an attribute greater than or equal rule
     */
    whereGreaterThanOrEqual(attribute: string, value: number | string): this;
    /**
     * Add an attribute less than or equal rule
     */
    whereLessThanOrEqual(attribute: string, value: number | string): this;
    /**
     * Add an attribute in array rule
     */
    whereIn(attribute: string, values: readonly unknown[]): this;
    /**
     * Add an attribute not in array rule
     */
    whereNotIn(attribute: string, values: readonly unknown[]): this;
    /**
     * Add an attribute exists rule
     */
    whereExists(attribute: string): this;
    /**
     * Add an attribute not exists rule
     */
    whereNotExists(attribute: string): this;
    /**
     * Add an attribute matches regex rule
     */
    whereMatches(attribute: string, pattern: string): this;
    /**
     * Add a composite OR rule
     */
    or(buildFn: (builder: FilterRuleBuilder) => void): this;
    /**
     * Add a composite AND rule
     */
    and(buildFn: (builder: FilterRuleBuilder) => void): this;
    /**
     * Build the filter rules
     */
    build(): readonly FilterRule[];
    /**
     * Build and create an EventFilter
     */
    toFilter(): EventFilter;
}
/**
 * Create a new filter rule builder
 */
export declare function filterRules(): FilterRuleBuilder;
export {};
/**
 * Example usage:
 *
 * ```typescript
 * import { createEventRouter, createLambdaHandler, loggingMiddleware } from '@ams/events';
 * import { RedisIdempotencyStore } from '@ams/events';
 *
 * // Create idempotency store
 * const idempotencyStore = new RedisIdempotencyStore(
 *   async () => getRedisClient()
 * );
 *
 * // Create router with handlers
 * const router = createEventRouter()
 *   // Add middleware
 *   .use(loggingMiddleware())
 *
 *   // Configure idempotency
 *   .withIdempotency(idempotencyStore, {
 *     idempotencyTtlSeconds: 86400,
 *     useDistributedLocking: true,
 *   })
 *
 *   // Register event handlers
 *   .on('ASSET_CREATED', async (message) => {
 *     const { assetId, assetType } = message.event.payload;
 *     // Handle asset created
 *   })
 *
 *   .on('ASSET_STATE_CHANGED', async (message) => {
 *     const { assetId, previousState, newState } = message.event.payload;
 *     // Handle state change
 *   })
 *
 *   // Register category handler for all SAM events
 *   .onCategory('SAM', async (message) => {
 *     // Handle any SAM event
 *   })
 *
 *   // Register default handler
 *   .onDefault(async (message) => {
 *     logger.info('Unhandled event', { eventType: message.event.eventType });
 *   });
 *
 * // Export Lambda handler
 * export const handler = createLambdaHandler(router);
 * ```
 */
//# sourceMappingURL=event-handler.d.ts.map