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
import { EVENT_CATEGORIES } from '@ams/types';
import { createLogger } from '@ams/utils';

import type {
  ConsumerConfig,
  IdempotencyStore,
  MessageHandler,
  ParsedMessage,
  ProcessingResult,
} from './consumer';
import {
  buildBatchItemFailures,
  getFailedMessageIds,
  parseMessages,
  processMessages,
} from './consumer';

const logger = createLogger({ service: 'event-handler' });

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Middleware function type
 */
export type EventMiddleware = (
  message: ParsedMessage<DomainEvent>,
  next: () => Promise<void>
) => Promise<void>;

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

// ============================================================================
// Filter Rule Types (Requirement 9.8)
// ============================================================================

/**
 * Comparison operators for attribute-based filtering
 */
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'in'
  | 'notIn'
  | 'exists'
  | 'notExists'
  | 'matches'; // regex match

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

// ============================================================================
// Event Router
// ============================================================================

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
export class EventRouter {
  private readonly handlers: Map<EventType, RegisteredHandler[]> = new Map();
  private readonly categoryHandlers: Map<EventCategory, RegisteredHandler[]> = new Map();
  private readonly middleware: EventMiddleware[] = [];
  private defaultHandler?: MessageHandler<DomainEvent>;
  private consumerConfig?: ConsumerConfig;

  /**
   * Register a handler for a specific event type
   *
   * Multiple handlers can be registered for the same event type.
   * They will be executed in priority order.
   */
  on<T extends DomainEvent>(
    eventType: T['eventType'],
    handler: MessageHandler<T>,
    options: HandlerOptions = {}
  ): this {
    const registeredHandler: RegisteredHandler = {
      handler: handler as MessageHandler<DomainEvent>,
      options: { priority: 100, continueOnError: false, ...options },
    };

    const existing = this.handlers.get(eventType) ?? [];
    existing.push(registeredHandler);
    // Sort by priority
    existing.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));
    this.handlers.set(eventType, existing);

    logger.debug('Handler registered', { eventType, priority: options.priority ?? 100 });
    return this;
  }

  /**
   * Register a handler for all events in a category
   */
  onCategory(
    category: EventCategory,
    handler: MessageHandler<DomainEvent>,
    options: HandlerOptions = {}
  ): this {
    const registeredHandler: RegisteredHandler = {
      handler,
      options: { priority: 100, continueOnError: false, ...options },
    };

    const existing = this.categoryHandlers.get(category) ?? [];
    existing.push(registeredHandler);
    existing.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));
    this.categoryHandlers.set(category, existing);

    logger.debug('Category handler registered', { category, priority: options.priority ?? 100 });
    return this;
  }

  /**
   * Register a default handler for unhandled event types
   */
  onDefault(handler: MessageHandler<DomainEvent>): this {
    this.defaultHandler = handler;
    logger.debug('Default handler registered');
    return this;
  }

  /**
   * Add middleware to the processing pipeline
   *
   * Middleware is executed in order for every message before handlers.
   */
  use(middleware: EventMiddleware): this {
    this.middleware.push(middleware);
    logger.debug('Middleware added', { middlewareCount: this.middleware.length });
    return this;
  }

  /**
   * Configure idempotency store for deduplication
   */
  withIdempotency(store: IdempotencyStore, config?: Partial<ConsumerConfig>): this {
    this.consumerConfig = {
      idempotencyStore: store,
      ...config,
    };
    logger.debug('Idempotency configured');
    return this;
  }

  /**
   * Get all handlers for an event type (including category handlers)
   */
  getHandlers(eventType: EventType): RegisteredHandler[] {
    const typeHandlers = this.handlers.get(eventType) ?? [];
    const category = EVENT_CATEGORIES[eventType];
    const catHandlers = this.categoryHandlers.get(category) ?? [];

    // Merge and sort by priority
    const allHandlers = [...typeHandlers, ...catHandlers];
    allHandlers.sort((a, b) => (a.options.priority ?? 100) - (b.options.priority ?? 100));

    return allHandlers;
  }

  /**
   * Check if any handler is registered for an event type
   */
  hasHandler(eventType: EventType): boolean {
    const typeHandlers = this.handlers.get(eventType) ?? [];
    const category = EVENT_CATEGORIES[eventType];
    const catHandlers = this.categoryHandlers.get(category) ?? [];

    return typeHandlers.length > 0 || catHandlers.length > 0 || this.defaultHandler !== undefined;
  }

  /**
   * Process an SQS event using registered handlers
   */
  async process(event: SQSEvent): Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
    // If idempotency is configured, use processMessages with config
    if (this.consumerConfig) {
      const results = await processMessages(
        event,
        (message) => this.processMessage(message),
        this.consumerConfig
      );
      const failedIds = getFailedMessageIds(results);
      return buildBatchItemFailures(failedIds);
    }

    // Otherwise, process directly
    const messages = parseMessages(event);
    const results: ProcessingResult[] = [];

    for (const message of messages) {
      const result = await this.processMessageWithResult(message);
      results.push(result);
    }

    const failedIds = getFailedMessageIds(results);
    return buildBatchItemFailures(failedIds);
  }

  /**
   * Process a single message through middleware and handlers
   */
  private async processMessage(message: ParsedMessage<DomainEvent>): Promise<void> {
    // Build middleware chain
    const executeHandlers = async (): Promise<void> => {
      await this.executeHandlers(message);
    };

    // Execute middleware chain
    let index = 0;
    const executeMiddleware = async (): Promise<void> => {
      if (index < this.middleware.length) {
        const mw = this.middleware[index++];
        if (mw) {
          await mw(message, executeMiddleware);
        }
      } else {
        await executeHandlers();
      }
    };

    await executeMiddleware();
  }

  /**
   * Process a single message and return result
   */
  private async processMessageWithResult(
    message: ParsedMessage<DomainEvent>
  ): Promise<ProcessingResult> {
    try {
      await this.processMessage(message);
      return {
        messageId: message.messageId,
        success: true,
      };
    } catch (error) {
      logger.error('Handler failed', error as Error, {
        eventType: message.event.eventType,
        eventId: message.event.eventId,
      });
      return {
        messageId: message.messageId,
        success: false,
        error: error as Error,
      };
    }
  }

  /**
   * Execute all handlers for a message
   */
  private async executeHandlers(message: ParsedMessage<DomainEvent>): Promise<void> {
    const { eventType } = message.event;
    const handlers = this.getHandlers(eventType);

    if (handlers.length === 0) {
      // No specific handlers, try default
      if (this.defaultHandler) {
        logger.debug('Using default handler', { eventType });
        await this.defaultHandler(message);
      } else {
        logger.warn('No handler registered for event type', { eventType });
      }
      return;
    }

    logger.info('Routing event to handlers', {
      eventType,
      eventId: message.event.eventId,
      handlerCount: handlers.length,
    });

    // Execute handlers in priority order
    for (const { handler, options } of handlers) {
      // Apply filter if present
      if (options.filter && !options.filter(message.event)) {
        logger.debug('Handler skipped by filter', { eventType });
        continue;
      }

      try {
        await handler(message);
      } catch (error) {
        logger.error('Handler execution failed', error as Error, {
          eventType,
          eventId: message.event.eventId,
        });

        if (!options.continueOnError) {
          throw error;
        }
        // Continue to next handler if continueOnError is true
        logger.warn('Continuing to next handler after error', { eventType });
      }
    }
  }

  /**
   * Get registered event types
   */
  getRegisteredEventTypes(): EventType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get registered categories
   */
  getRegisteredCategories(): EventCategory[] {
    return Array.from(this.categoryHandlers.keys());
  }

  /**
   * Clear all handlers (useful for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.categoryHandlers.clear();
    this.middleware.length = 0;
    this.defaultHandler = undefined;
    this.consumerConfig = undefined;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new event router
 */
export function createEventRouter(): EventRouter {
  return new EventRouter();
}

/**
 * Create a Lambda handler from an event router
 */
export function createLambdaHandler(
  router: EventRouter
): (event: SQSEvent) => Promise<{ batchItemFailures: { itemIdentifier: string }[] }> {
  return async (event: SQSEvent) => {
    logger.info('Processing SQS event', { recordCount: event.Records.length });
    return router.process(event);
  };
}

// ============================================================================
// Built-in Middleware
// ============================================================================

/**
 * Logging middleware - logs all events
 */
export function loggingMiddleware(): EventMiddleware {
  return async (message, next) => {
    const startTime = Date.now();
    logger.info('Event received', {
      eventType: message.event.eventType,
      eventId: message.event.eventId,
      source: message.event.source,
    });

    try {
      await next();
      const duration = Date.now() - startTime;
      logger.info('Event processed', {
        eventType: message.event.eventType,
        eventId: message.event.eventId,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Event processing failed', error as Error, {
        eventType: message.event.eventType,
        eventId: message.event.eventId,
        durationMs: duration,
      });
      throw error;
    }
  };
}

/**
 * Metrics middleware - tracks processing metrics
 */
export function metricsMiddleware(
  onMetric: (metric: {
    eventType: EventType;
    success: boolean;
    durationMs: number;
  }) => void
): EventMiddleware {
  return async (message, next) => {
    const startTime = Date.now();
    let success = true;

    try {
      await next();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const durationMs = Date.now() - startTime;
      onMetric({
        eventType: message.event.eventType,
        success,
        durationMs,
      });
    }
  };
}

/**
 * Validation middleware - validates event structure
 */
export function validationMiddleware(
  validator: (event: DomainEvent) => boolean
): EventMiddleware {
  return async (message, next) => {
    if (!validator(message.event)) {
      throw new Error(`Invalid event structure for type: ${message.event.eventType}`);
    }
    await next();
  };
}

/**
 * Retry tracking middleware - logs retry information
 */
export function retryTrackingMiddleware(maxRetries: number = 3): EventMiddleware {
  return async (message, next) => {
    const receiveCount = message.approximateReceiveCount;

    if (receiveCount > 1) {
      logger.warn('Processing retry', {
        eventType: message.event.eventType,
        eventId: message.event.eventId,
        receiveCount,
        maxRetries,
      });
    }

    if (receiveCount >= maxRetries) {
      logger.error('Max retries reached, message will go to DLQ', undefined, {
        eventType: message.event.eventType,
        eventId: message.event.eventId,
        receiveCount,
      });
    }

    await next();
  };
}

// ============================================================================
// Event Filters
// ============================================================================

/**
 * Create a filter for specific asset types
 */
export function assetTypeFilter(assetTypes: readonly string[]): EventFilter {
  return (event) => {
    if ('assetType' in event.payload) {
      return assetTypes.includes(event.payload.assetType as string);
    }
    return true; // Allow events without assetType
  };
}

/**
 * Create a filter for specific sources
 */
export function sourceFilter(sources: readonly string[]): EventFilter {
  return (event) => sources.includes(event.source);
}

/**
 * Create a filter based on event payload
 */
export function payloadFilter(
  predicate: (payload: Record<string, unknown>) => boolean
): EventFilter {
  return (event) => predicate(event.payload as Record<string, unknown>);
}

/**
 * Combine multiple filters with AND logic
 */
export function andFilters(...filters: EventFilter[]): EventFilter {
  return (event) => filters.every((f) => f(event));
}

/**
 * Combine multiple filters with OR logic
 */
export function orFilters(...filters: EventFilter[]): EventFilter {
  return (event) => filters.some((f) => f(event));
}

// ============================================================================
// Attribute-Based Filter Rule Evaluation (Requirement 9.8)
// ============================================================================

/**
 * Get a nested value from an object using dot notation
 * @param obj - The object to get the value from
 * @param path - The path to the value (e.g., 'payload.assetType')
 * @returns The value at the path, or undefined if not found
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a composite filter rule (type guard)
 */
export function isCompositeRule(rule: FilterRule): rule is CompositeFilterRule {
  return 'logic' in rule && 'rules' in rule;
}

/**
 * Evaluate a single attribute filter rule against an event
 */
export function evaluateAttributeRule(
  event: DomainEvent,
  rule: AttributeFilterRule
): boolean {
  const value = getNestedValue(event, rule.attribute);

  switch (rule.operator) {
    case 'exists':
      return value !== undefined && value !== null;

    case 'notExists':
      return value === undefined || value === null;

    case 'equals':
      return value === rule.value;

    case 'notEquals':
      return value !== rule.value;

    case 'contains':
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value.includes(rule.value);
      }
      if (Array.isArray(value)) {
        return value.includes(rule.value);
      }
      return false;

    case 'startsWith':
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value.startsWith(rule.value);
      }
      return false;

    case 'endsWith':
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value.endsWith(rule.value);
      }
      return false;

    case 'greaterThan':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        return value > rule.value;
      }
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value > rule.value;
      }
      return false;

    case 'lessThan':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        return value < rule.value;
      }
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value < rule.value;
      }
      return false;

    case 'greaterThanOrEqual':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        return value >= rule.value;
      }
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value >= rule.value;
      }
      return false;

    case 'lessThanOrEqual':
      if (typeof value === 'number' && typeof rule.value === 'number') {
        return value <= rule.value;
      }
      if (typeof value === 'string' && typeof rule.value === 'string') {
        return value <= rule.value;
      }
      return false;

    case 'in':
      if (Array.isArray(rule.value)) {
        return rule.value.includes(value);
      }
      return false;

    case 'notIn':
      if (Array.isArray(rule.value)) {
        return !rule.value.includes(value);
      }
      return true;

    case 'matches':
      if (typeof value === 'string' && typeof rule.value === 'string') {
        try {
          const regex = new RegExp(rule.value);
          return regex.test(value);
        } catch {
          logger.warn('Invalid regex pattern in filter rule', { pattern: rule.value });
          return false;
        }
      }
      return false;

    default:
      logger.warn('Unknown filter operator', { operator: rule.operator });
      return false;
  }
}

/**
 * Evaluate a filter rule (attribute or composite) against an event
 */
export function evaluateFilterRule(event: DomainEvent, rule: FilterRule): boolean {
  if (isCompositeRule(rule)) {
    if (rule.logic === 'AND') {
      return rule.rules.every((r) => evaluateFilterRule(event, r));
    } else {
      return rule.rules.some((r) => evaluateFilterRule(event, r));
    }
  }

  return evaluateAttributeRule(event, rule);
}

/**
 * Evaluate multiple filter rules against an event (all must pass - AND logic)
 */
export function evaluateFilterRules(
  event: DomainEvent,
  rules: readonly FilterRule[]
): boolean {
  if (rules.length === 0) {
    return true; // No rules means all events pass
  }

  return rules.every((rule) => evaluateFilterRule(event, rule));
}

/**
 * Create an EventFilter from filter rules
 */
export function createFilterFromRules(rules: readonly FilterRule[]): EventFilter {
  return (event) => evaluateFilterRules(event, rules);
}

// ============================================================================
// Subscription Router (Requirement 9.8)
// ============================================================================

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
export class SubscriptionRouter {
  private readonly subscriptions: Map<string, SubscriptionConfig> = new Map();
  private readonly handlers: Map<string, MessageHandler<DomainEvent>> = new Map();

  /**
   * Add a subscription configuration
   */
  addSubscription(config: SubscriptionConfig): this {
    if (this.subscriptions.has(config.subscriptionId)) {
      logger.warn('Subscription already exists, replacing', {
        subscriptionId: config.subscriptionId,
      });
    }

    this.subscriptions.set(config.subscriptionId, config);
    logger.debug('Subscription added', {
      subscriptionId: config.subscriptionId,
      name: config.name,
      eventTypes: config.eventTypes,
      categories: config.categories,
      enabled: config.enabled,
    });

    return this;
  }

  /**
   * Add a handler for a subscription
   */
  setHandler(subscriptionId: string, handler: MessageHandler<DomainEvent>): this {
    if (!this.subscriptions.has(subscriptionId)) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    this.handlers.set(subscriptionId, handler);
    logger.debug('Handler set for subscription', { subscriptionId });

    return this;
  }

  /**
   * Remove a subscription
   */
  removeSubscription(subscriptionId: string): boolean {
    const removed = this.subscriptions.delete(subscriptionId);
    this.handlers.delete(subscriptionId);

    if (removed) {
      logger.debug('Subscription removed', { subscriptionId });
    }

    return removed;
  }

  /**
   * Enable or disable a subscription
   */
  setEnabled(subscriptionId: string, enabled: boolean): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.subscriptions.set(subscriptionId, { ...subscription, enabled });
    logger.debug('Subscription enabled state changed', { subscriptionId, enabled });

    return true;
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(): readonly SubscriptionConfig[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get a subscription by ID
   */
  getSubscription(subscriptionId: string): SubscriptionConfig | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  /**
   * Check if an event matches a subscription's criteria
   */
  matchesSubscription(event: DomainEvent, subscription: SubscriptionConfig): boolean {
    // Check if subscription is enabled
    if (!subscription.enabled) {
      return false;
    }

    // Check event type filter
    if (subscription.eventTypes && subscription.eventTypes.length > 0) {
      if (!subscription.eventTypes.includes(event.eventType)) {
        return false;
      }
    }

    // Check category filter
    if (subscription.categories && subscription.categories.length > 0) {
      const eventCategory = EVENT_CATEGORIES[event.eventType];
      if (!subscription.categories.includes(eventCategory)) {
        return false;
      }
    }

    // Check filter rules
    if (subscription.filterRules && subscription.filterRules.length > 0) {
      if (!evaluateFilterRules(event, subscription.filterRules)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find all matching subscriptions for an event
   */
  findMatchingSubscriptions(event: DomainEvent): readonly SubscriptionConfig[] {
    const matching: SubscriptionConfig[] = [];

    // Get all subscriptions sorted by priority
    const sortedSubscriptions = Array.from(this.subscriptions.values()).sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );

    for (const subscription of sortedSubscriptions) {
      if (this.matchesSubscription(event, subscription)) {
        matching.push(subscription);
      }
    }

    return matching;
  }

  /**
   * Route an event to all matching subscriptions
   */
  async routeEvent(message: ParsedMessage<DomainEvent>): Promise<RoutingResult> {
    const event = message.event;
    const matchedSubscriptions: string[] = [];
    const unmatchedSubscriptions: string[] = [];

    // Get all subscriptions sorted by priority
    const sortedSubscriptions = Array.from(this.subscriptions.values()).sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );

    for (const subscription of sortedSubscriptions) {
      if (this.matchesSubscription(event, subscription)) {
        matchedSubscriptions.push(subscription.subscriptionId);

        // Execute handler if registered
        const handler = this.handlers.get(subscription.subscriptionId);
        if (handler) {
          try {
            await handler(message);
            logger.debug('Event routed to subscription handler', {
              eventId: event.eventId,
              eventType: event.eventType,
              subscriptionId: subscription.subscriptionId,
            });
          } catch (error) {
            logger.error('Subscription handler failed', error as Error, {
              eventId: event.eventId,
              eventType: event.eventType,
              subscriptionId: subscription.subscriptionId,
            });
            throw error;
          }
        }
      } else {
        unmatchedSubscriptions.push(subscription.subscriptionId);
      }
    }

    const result: RoutingResult = {
      eventId: event.eventId,
      eventType: event.eventType,
      matchedSubscriptions,
      unmatchedSubscriptions,
      routed: matchedSubscriptions.length > 0,
    };

    logger.info('Event routing completed', {
      eventId: event.eventId,
      eventType: event.eventType,
      matchedCount: matchedSubscriptions.length,
      unmatchedCount: unmatchedSubscriptions.length,
    });

    return result;
  }

  /**
   * Create an EventRouter middleware that routes events through subscriptions
   */
  createMiddleware(): EventMiddleware {
    return async (message, next) => {
      // Route to subscriptions first
      await this.routeEvent(message);
      // Then continue to regular handlers
      await next();
    };
  }

  /**
   * Clear all subscriptions (useful for testing)
   */
  clear(): void {
    this.subscriptions.clear();
    this.handlers.clear();
  }
}

/**
 * Create a new subscription router
 */
export function createSubscriptionRouter(): SubscriptionRouter {
  return new SubscriptionRouter();
}

// ============================================================================
// Filter Rule Builder (Fluent API)
// ============================================================================

/**
 * Builder for creating filter rules with a fluent API
 */
export class FilterRuleBuilder {
  private rules: FilterRule[] = [];

  /**
   * Add an attribute equals rule
   */
  whereEquals(attribute: string, value: unknown): this {
    this.rules.push({ attribute, operator: 'equals', value });
    return this;
  }

  /**
   * Add an attribute not equals rule
   */
  whereNotEquals(attribute: string, value: unknown): this {
    this.rules.push({ attribute, operator: 'notEquals', value });
    return this;
  }

  /**
   * Add an attribute contains rule
   */
  whereContains(attribute: string, value: string): this {
    this.rules.push({ attribute, operator: 'contains', value });
    return this;
  }

  /**
   * Add an attribute starts with rule
   */
  whereStartsWith(attribute: string, value: string): this {
    this.rules.push({ attribute, operator: 'startsWith', value });
    return this;
  }

  /**
   * Add an attribute ends with rule
   */
  whereEndsWith(attribute: string, value: string): this {
    this.rules.push({ attribute, operator: 'endsWith', value });
    return this;
  }

  /**
   * Add an attribute greater than rule
   */
  whereGreaterThan(attribute: string, value: number | string): this {
    this.rules.push({ attribute, operator: 'greaterThan', value });
    return this;
  }

  /**
   * Add an attribute less than rule
   */
  whereLessThan(attribute: string, value: number | string): this {
    this.rules.push({ attribute, operator: 'lessThan', value });
    return this;
  }

  /**
   * Add an attribute greater than or equal rule
   */
  whereGreaterThanOrEqual(attribute: string, value: number | string): this {
    this.rules.push({ attribute, operator: 'greaterThanOrEqual', value });
    return this;
  }

  /**
   * Add an attribute less than or equal rule
   */
  whereLessThanOrEqual(attribute: string, value: number | string): this {
    this.rules.push({ attribute, operator: 'lessThanOrEqual', value });
    return this;
  }

  /**
   * Add an attribute in array rule
   */
  whereIn(attribute: string, values: readonly unknown[]): this {
    this.rules.push({ attribute, operator: 'in', value: [...values] });
    return this;
  }

  /**
   * Add an attribute not in array rule
   */
  whereNotIn(attribute: string, values: readonly unknown[]): this {
    this.rules.push({ attribute, operator: 'notIn', value: [...values] });
    return this;
  }

  /**
   * Add an attribute exists rule
   */
  whereExists(attribute: string): this {
    this.rules.push({ attribute, operator: 'exists' });
    return this;
  }

  /**
   * Add an attribute not exists rule
   */
  whereNotExists(attribute: string): this {
    this.rules.push({ attribute, operator: 'notExists' });
    return this;
  }

  /**
   * Add an attribute matches regex rule
   */
  whereMatches(attribute: string, pattern: string): this {
    this.rules.push({ attribute, operator: 'matches', value: pattern });
    return this;
  }

  /**
   * Add a composite OR rule
   */
  or(buildFn: (builder: FilterRuleBuilder) => void): this {
    const subBuilder = new FilterRuleBuilder();
    buildFn(subBuilder);
    this.rules.push({ logic: 'OR', rules: subBuilder.build() });
    return this;
  }

  /**
   * Add a composite AND rule
   */
  and(buildFn: (builder: FilterRuleBuilder) => void): this {
    const subBuilder = new FilterRuleBuilder();
    buildFn(subBuilder);
    this.rules.push({ logic: 'AND', rules: subBuilder.build() });
    return this;
  }

  /**
   * Build the filter rules
   */
  build(): readonly FilterRule[] {
    return [...this.rules];
  }

  /**
   * Build and create an EventFilter
   */
  toFilter(): EventFilter {
    return createFilterFromRules(this.build());
  }
}

/**
 * Create a new filter rule builder
 */
export function filterRules(): FilterRuleBuilder {
  return new FilterRuleBuilder();
}

// ============================================================================
// Example Usage
// ============================================================================

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
