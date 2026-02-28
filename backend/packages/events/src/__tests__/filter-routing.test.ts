/**
 * Unit tests for Attribute-Based Filter Rules and Subscription Routing
 *
 * Tests the enhanced event filtering and routing functionality including:
 * - Attribute-based filter rules with various operators
 * - Composite filter rules (AND/OR logic)
 * - Subscription router with multiple subscribers
 * - Filter rule builder fluent API
 *
 * Validates: Requirements 9.3, 9.8
 * - THE Event_Bus SHALL support multiple subscribers per event type for extensibility
 * - THE Event_Bus SHALL support event filtering and routing based on event attributes
 */

import type { DomainEvent, EventType } from '@ams/types';

import type { ParsedMessage } from '../consumer';
import {
  createFilterFromRules,
  createSubscriptionRouter,
  evaluateAttributeRule,
  evaluateFilterRule,
  evaluateFilterRules,
  filterRules,
  FilterRuleBuilder,
  getNestedValue,
  isCompositeRule,
  SubscriptionRouter,
} from '../event-handler';
import type {
  AttributeFilterRule,
  CompositeFilterRule,
  FilterRule,
  SubscriptionConfig,
} from '../event-handler';

// Mock the logger
jest.mock('@ams/utils', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('Attribute-Based Filter Rules', () => {
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


  describe('getNestedValue', () => {
    it('should get top-level value', () => {
      const event = createMockEvent();
      expect(getNestedValue(event, 'eventId')).toBe('event-123');
      expect(getNestedValue(event, 'source')).toBe('test-service');
    });

    it('should get nested value using dot notation', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      expect(getNestedValue(event, 'payload.assetType')).toBe('HARDWARE');
      expect(getNestedValue(event, 'payload.assetId')).toBe('asset-123');
    });

    it('should return undefined for non-existent paths', () => {
      const event = createMockEvent();
      expect(getNestedValue(event, 'nonExistent')).toBeUndefined();
      expect(getNestedValue(event, 'payload.nonExistent')).toBeUndefined();
      expect(getNestedValue(event, 'payload.deep.nested.path')).toBeUndefined();
    });

    it('should handle null and undefined objects', () => {
      expect(getNestedValue(null, 'path')).toBeUndefined();
      expect(getNestedValue(undefined, 'path')).toBeUndefined();
    });

    it('should handle deeply nested values', () => {
      const obj = { a: { b: { c: { d: 'value' } } } };
      expect(getNestedValue(obj, 'a.b.c.d')).toBe('value');
    });
  });

  describe('isCompositeRule', () => {
    it('should identify composite rules', () => {
      const compositeRule: CompositeFilterRule = {
        logic: 'AND',
        rules: [{ attribute: 'source', operator: 'equals', value: 'test' }],
      };
      expect(isCompositeRule(compositeRule)).toBe(true);
    });

    it('should identify attribute rules', () => {
      const attributeRule: AttributeFilterRule = {
        attribute: 'source',
        operator: 'equals',
        value: 'test',
      };
      expect(isCompositeRule(attributeRule)).toBe(false);
    });
  });


  describe('evaluateAttributeRule', () => {
    describe('equals operator', () => {
      it('should match equal values', () => {
        const event = createMockEvent();
        const rule: AttributeFilterRule = { attribute: 'source', operator: 'equals', value: 'test-service' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match different values', () => {
        const event = createMockEvent();
        const rule: AttributeFilterRule = { attribute: 'source', operator: 'equals', value: 'other-service' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('notEquals operator', () => {
      it('should match different values', () => {
        const event = createMockEvent();
        const rule: AttributeFilterRule = { attribute: 'source', operator: 'notEquals', value: 'other-service' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match equal values', () => {
        const event = createMockEvent();
        const rule: AttributeFilterRule = { attribute: 'source', operator: 'notEquals', value: 'test-service' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('contains operator', () => {
      it('should match string containing substring', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'contains', value: 'HW' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match string not containing substring', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'contains', value: 'SW' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });

      it('should match array containing value', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { tags: ['important', 'hardware', 'new'] });
        const rule: AttributeFilterRule = { attribute: 'payload.tags', operator: 'contains', value: 'hardware' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });
    });


    describe('startsWith operator', () => {
      it('should match string starting with prefix', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'startsWith', value: 'AMS-HW' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match string not starting with prefix', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'startsWith', value: 'AMS-SW' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('endsWith operator', () => {
      it('should match string ending with suffix', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'endsWith', value: 'ABC123' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match string not ending with suffix', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'endsWith', value: 'XYZ789' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('greaterThan operator', () => {
      it('should match number greater than value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 50 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'greaterThan', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match number less than or equal to value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 25 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'greaterThan', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('lessThan operator', () => {
      it('should match number less than value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 10 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'lessThan', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match number greater than or equal to value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 25 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'lessThan', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });


    describe('greaterThanOrEqual operator', () => {
      it('should match number greater than or equal to value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 25 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'greaterThanOrEqual', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });
    });

    describe('lessThanOrEqual operator', () => {
      it('should match number less than or equal to value', () => {
        const event = createMockEvent('STOCK_LEVEL_ALERT', 'e1', { currentQuantity: 25 });
        const rule: AttributeFilterRule = { attribute: 'payload.currentQuantity', operator: 'lessThanOrEqual', value: 25 };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });
    });

    describe('in operator', () => {
      it('should match value in array', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'in', value: ['HARDWARE', 'SOFTWARE'] };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match value not in array', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'ENTERPRISE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'in', value: ['HARDWARE', 'SOFTWARE'] };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('notIn operator', () => {
      it('should match value not in array', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'ENTERPRISE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'notIn', value: ['HARDWARE', 'SOFTWARE'] };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match value in array', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'notIn', value: ['HARDWARE', 'SOFTWARE'] };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });


    describe('exists operator', () => {
      it('should match when attribute exists', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'exists' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match when attribute does not exist', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', {});
        const rule: AttributeFilterRule = { attribute: 'payload.nonExistent', operator: 'exists' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('notExists operator', () => {
      it('should match when attribute does not exist', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', {});
        const rule: AttributeFilterRule = { attribute: 'payload.nonExistent', operator: 'notExists' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match when attribute exists', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'notExists' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });

    describe('matches operator', () => {
      it('should match string matching regex pattern', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'AMS-HW-20250101-ABC123' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'matches', value: '^AMS-HW-\\d{8}-[A-Z0-9]+$' };
        expect(evaluateAttributeRule(event, rule)).toBe(true);
      });

      it('should not match string not matching regex pattern', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'INVALID-TAG' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'matches', value: '^AMS-HW-\\d{8}-[A-Z0-9]+$' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });

      it('should handle invalid regex gracefully', () => {
        const event = createMockEvent('ASSET_CREATED', 'e1', { assetTag: 'test' });
        const rule: AttributeFilterRule = { attribute: 'payload.assetTag', operator: 'matches', value: '[invalid(' };
        expect(evaluateAttributeRule(event, rule)).toBe(false);
      });
    });
  });


  describe('evaluateFilterRule', () => {
    it('should evaluate attribute rules', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rule: AttributeFilterRule = { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' };
      expect(evaluateFilterRule(event, rule)).toBe(true);
    });

    it('should evaluate composite AND rules', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rule: CompositeFilterRule = {
        logic: 'AND',
        rules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
          { attribute: 'source', operator: 'equals', value: 'test-service' },
        ],
      };
      expect(evaluateFilterRule(event, rule)).toBe(true);
    });

    it('should fail composite AND rules when one fails', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rule: CompositeFilterRule = {
        logic: 'AND',
        rules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
          { attribute: 'source', operator: 'equals', value: 'other-service' },
        ],
      };
      expect(evaluateFilterRule(event, rule)).toBe(false);
    });

    it('should evaluate composite OR rules', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rule: CompositeFilterRule = {
        logic: 'OR',
        rules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'SOFTWARE' },
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        ],
      };
      expect(evaluateFilterRule(event, rule)).toBe(true);
    });

    it('should fail composite OR rules when all fail', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'ENTERPRISE' });
      const rule: CompositeFilterRule = {
        logic: 'OR',
        rules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'SOFTWARE' },
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        ],
      };
      expect(evaluateFilterRule(event, rule)).toBe(false);
    });

    it('should handle nested composite rules', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE', priority: 'HIGH' });
      const rule: CompositeFilterRule = {
        logic: 'AND',
        rules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
          {
            logic: 'OR',
            rules: [
              { attribute: 'payload.priority', operator: 'equals', value: 'HIGH' },
              { attribute: 'payload.priority', operator: 'equals', value: 'CRITICAL' },
            ],
          },
        ],
      };
      expect(evaluateFilterRule(event, rule)).toBe(true);
    });
  });


  describe('evaluateFilterRules', () => {
    it('should pass when no rules are provided', () => {
      const event = createMockEvent();
      expect(evaluateFilterRules(event, [])).toBe(true);
    });

    it('should pass when all rules pass', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rules: FilterRule[] = [
        { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        { attribute: 'source', operator: 'equals', value: 'test-service' },
      ];
      expect(evaluateFilterRules(event, rules)).toBe(true);
    });

    it('should fail when any rule fails', () => {
      const event = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const rules: FilterRule[] = [
        { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        { attribute: 'source', operator: 'equals', value: 'other-service' },
      ];
      expect(evaluateFilterRules(event, rules)).toBe(false);
    });
  });

  describe('createFilterFromRules', () => {
    it('should create an EventFilter from rules', () => {
      const rules: FilterRule[] = [
        { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
      ];
      const filter = createFilterFromRules(rules);

      const matchingEvent = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const nonMatchingEvent = createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' });

      expect(filter(matchingEvent)).toBe(true);
      expect(filter(nonMatchingEvent)).toBe(false);
    });
  });
});


describe('SubscriptionRouter', () => {
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

  // Helper to create a mock parsed message
  function createMockMessage(event: DomainEvent): ParsedMessage<DomainEvent> {
    return {
      messageId: 'msg-123',
      receiptHandle: 'receipt-123',
      event,
      attributes: {
        ApproximateReceiveCount: '1',
        SentTimestamp: '1234567890',
        SenderId: 'sender-123',
        ApproximateFirstReceiveTimestamp: '1234567890',
      },
      approximateReceiveCount: 1,
    };
  }

  let router: SubscriptionRouter;

  beforeEach(() => {
    router = createSubscriptionRouter();
  });

  describe('subscription management', () => {
    it('should add a subscription', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Test Subscription',
        enabled: true,
      };

      router.addSubscription(config);

      expect(router.getSubscription('sub-1')).toEqual(config);
      expect(router.getSubscriptions()).toHaveLength(1);
    });

    it('should replace existing subscription with same ID', () => {
      const config1: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Original',
        enabled: true,
      };
      const config2: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Updated',
        enabled: false,
      };

      router.addSubscription(config1);
      router.addSubscription(config2);

      expect(router.getSubscription('sub-1')?.name).toBe('Updated');
      expect(router.getSubscriptions()).toHaveLength(1);
    });

    it('should remove a subscription', () => {
      router.addSubscription({
        subscriptionId: 'sub-1',
        name: 'Test',
        enabled: true,
      });

      const removed = router.removeSubscription('sub-1');

      expect(removed).toBe(true);
      expect(router.getSubscription('sub-1')).toBeUndefined();
    });

    it('should return false when removing non-existent subscription', () => {
      const removed = router.removeSubscription('non-existent');
      expect(removed).toBe(false);
    });


    it('should enable/disable a subscription', () => {
      router.addSubscription({
        subscriptionId: 'sub-1',
        name: 'Test',
        enabled: true,
      });

      router.setEnabled('sub-1', false);
      expect(router.getSubscription('sub-1')?.enabled).toBe(false);

      router.setEnabled('sub-1', true);
      expect(router.getSubscription('sub-1')?.enabled).toBe(true);
    });

    it('should return false when enabling non-existent subscription', () => {
      const result = router.setEnabled('non-existent', true);
      expect(result).toBe(false);
    });

    it('should clear all subscriptions', () => {
      router.addSubscription({ subscriptionId: 'sub-1', name: 'Test 1', enabled: true });
      router.addSubscription({ subscriptionId: 'sub-2', name: 'Test 2', enabled: true });

      router.clear();

      expect(router.getSubscriptions()).toHaveLength(0);
    });
  });

  describe('subscription matching', () => {
    it('should match subscription with no filters (matches all)', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'All Events',
        enabled: true,
      };
      router.addSubscription(config);

      const event = createMockEvent('ASSET_CREATED');
      expect(router.matchesSubscription(event, config)).toBe(true);
    });

    it('should not match disabled subscription', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Disabled',
        enabled: false,
      };
      router.addSubscription(config);

      const event = createMockEvent('ASSET_CREATED');
      expect(router.matchesSubscription(event, config)).toBe(false);
    });

    it('should match subscription by event type', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Asset Events',
        eventTypes: ['ASSET_CREATED', 'ASSET_UPDATED'],
        enabled: true,
      };
      router.addSubscription(config);

      const matchingEvent = createMockEvent('ASSET_CREATED');
      const nonMatchingEvent = createMockEvent('WORK_ORDER_CREATED');

      expect(router.matchesSubscription(matchingEvent, config)).toBe(true);
      expect(router.matchesSubscription(nonMatchingEvent, config)).toBe(false);
    });


    it('should match subscription by category', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'HAM Events',
        categories: ['HAM'],
        enabled: true,
      };
      router.addSubscription(config);

      const matchingEvent = createMockEvent('TRANSFER_ORDER_CREATED');
      const nonMatchingEvent = createMockEvent('RECONCILIATION_COMPLETED');

      expect(router.matchesSubscription(matchingEvent, config)).toBe(true);
      expect(router.matchesSubscription(nonMatchingEvent, config)).toBe(false);
    });

    it('should match subscription by filter rules', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Hardware Assets Only',
        filterRules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        ],
        enabled: true,
      };
      router.addSubscription(config);

      const matchingEvent = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const nonMatchingEvent = createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' });

      expect(router.matchesSubscription(matchingEvent, config)).toBe(true);
      expect(router.matchesSubscription(nonMatchingEvent, config)).toBe(false);
    });

    it('should match subscription with combined filters', () => {
      const config: SubscriptionConfig = {
        subscriptionId: 'sub-1',
        name: 'Hardware Asset Creation',
        eventTypes: ['ASSET_CREATED'],
        filterRules: [
          { attribute: 'payload.assetType', operator: 'equals', value: 'HARDWARE' },
        ],
        enabled: true,
      };
      router.addSubscription(config);

      const matchingEvent = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
      const wrongType = createMockEvent('ASSET_UPDATED', 'e2', { assetType: 'HARDWARE' });
      const wrongAsset = createMockEvent('ASSET_CREATED', 'e3', { assetType: 'SOFTWARE' });

      expect(router.matchesSubscription(matchingEvent, config)).toBe(true);
      expect(router.matchesSubscription(wrongType, config)).toBe(false);
      expect(router.matchesSubscription(wrongAsset, config)).toBe(false);
    });
  });


  describe('findMatchingSubscriptions', () => {
    it('should find all matching subscriptions', () => {
      router.addSubscription({
        subscriptionId: 'sub-1',
        name: 'All Events',
        enabled: true,
      });
      router.addSubscription({
        subscriptionId: 'sub-2',
        name: 'Asset Events',
        eventTypes: ['ASSET_CREATED'],
        enabled: true,
      });
      router.addSubscription({
        subscriptionId: 'sub-3',
        name: 'SAM Events',
        categories: ['SAM'],
        enabled: true,
      });

      const event = createMockEvent('ASSET_CREATED');
      const matching = router.findMatchingSubscriptions(event);

      expect(matching).toHaveLength(2);
      expect(matching.map(s => s.subscriptionId)).toContain('sub-1');
      expect(matching.map(s => s.subscriptionId)).toContain('sub-2');
    });

    it('should return subscriptions sorted by priority', () => {
      router.addSubscription({
        subscriptionId: 'sub-low',
        name: 'Low Priority',
        priority: 300,
        enabled: true,
      });
      router.addSubscription({
        subscriptionId: 'sub-high',
        name: 'High Priority',
        priority: 100,
        enabled: true,
      });
      router.addSubscription({
        subscriptionId: 'sub-medium',
        name: 'Medium Priority',
        priority: 200,
        enabled: true,
      });

      const event = createMockEvent('ASSET_CREATED');
      const matching = router.findMatchingSubscriptions(event);

      expect(matching[0]?.subscriptionId).toBe('sub-high');
      expect(matching[1]?.subscriptionId).toBe('sub-medium');
      expect(matching[2]?.subscriptionId).toBe('sub-low');
    });
  });


  describe('routeEvent', () => {
    it('should route event to matching subscription handlers', async () => {
      const handledEvents: string[] = [];

      router.addSubscription({
        subscriptionId: 'sub-1',
        name: 'Test',
        enabled: true,
      });
      router.setHandler('sub-1', async (message) => {
        handledEvents.push(message.event.eventId);
      });

      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const message = createMockMessage(event);
      const result = await router.routeEvent(message);

      expect(result.routed).toBe(true);
      expect(result.matchedSubscriptions).toContain('sub-1');
      expect(handledEvents).toContain('event-1');
    });

    it('should route event to multiple subscribers', async () => {
      const handledBy: string[] = [];

      router.addSubscription({ subscriptionId: 'sub-1', name: 'Sub 1', enabled: true });
      router.addSubscription({ subscriptionId: 'sub-2', name: 'Sub 2', enabled: true });

      router.setHandler('sub-1', async () => { handledBy.push('sub-1'); });
      router.setHandler('sub-2', async () => { handledBy.push('sub-2'); });

      const event = createMockEvent('ASSET_CREATED');
      const message = createMockMessage(event);
      const result = await router.routeEvent(message);

      expect(result.routed).toBe(true);
      expect(result.matchedSubscriptions).toHaveLength(2);
      expect(handledBy).toContain('sub-1');
      expect(handledBy).toContain('sub-2');
    });

    it('should not route to non-matching subscriptions', async () => {
      const handledBy: string[] = [];

      router.addSubscription({
        subscriptionId: 'sub-1',
        name: 'SAM Only',
        categories: ['SAM'],
        enabled: true,
      });
      router.setHandler('sub-1', async () => { handledBy.push('sub-1'); });

      const event = createMockEvent('ASSET_CREATED'); // ASSET category
      const message = createMockMessage(event);
      const result = await router.routeEvent(message);

      expect(result.routed).toBe(false);
      expect(result.matchedSubscriptions).toHaveLength(0);
      expect(result.unmatchedSubscriptions).toContain('sub-1');
      expect(handledBy).toHaveLength(0);
    });


    it('should throw error when handler fails', async () => {
      router.addSubscription({ subscriptionId: 'sub-1', name: 'Test', enabled: true });
      router.setHandler('sub-1', async () => {
        throw new Error('Handler failed');
      });

      const event = createMockEvent('ASSET_CREATED');
      const message = createMockMessage(event);

      await expect(router.routeEvent(message)).rejects.toThrow('Handler failed');
    });

    it('should throw error when setting handler for non-existent subscription', () => {
      expect(() => {
        router.setHandler('non-existent', async () => {});
      }).toThrow('Subscription not found: non-existent');
    });

    it('should return routing result with event details', async () => {
      router.addSubscription({ subscriptionId: 'sub-1', name: 'Test', enabled: true });

      const event = createMockEvent('ASSET_CREATED', 'event-123');
      const message = createMockMessage(event);
      const result = await router.routeEvent(message);

      expect(result.eventId).toBe('event-123');
      expect(result.eventType).toBe('ASSET_CREATED');
    });
  });

  describe('createMiddleware', () => {
    it('should create middleware that routes events', async () => {
      const handledEvents: string[] = [];

      router.addSubscription({ subscriptionId: 'sub-1', name: 'Test', enabled: true });
      router.setHandler('sub-1', async (message) => {
        handledEvents.push(message.event.eventId);
      });

      const middleware = router.createMiddleware();
      const event = createMockEvent('ASSET_CREATED', 'event-1');
      const message = createMockMessage(event);

      let nextCalled = false;
      await middleware(message, async () => { nextCalled = true; });

      expect(handledEvents).toContain('event-1');
      expect(nextCalled).toBe(true);
    });
  });
});


describe('FilterRuleBuilder', () => {
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

  it('should build equals rule', () => {
    const rules = filterRules()
      .whereEquals('source', 'test-service')
      .build();

    expect(rules).toHaveLength(1);
    expect(rules[0]).toEqual({
      attribute: 'source',
      operator: 'equals',
      value: 'test-service',
    });
  });

  it('should build multiple rules', () => {
    const rules = filterRules()
      .whereEquals('source', 'test-service')
      .whereIn('payload.assetType', ['HARDWARE', 'SOFTWARE'])
      .build();

    expect(rules).toHaveLength(2);
  });

  it('should build comparison rules', () => {
    const rules = filterRules()
      .whereGreaterThan('payload.quantity', 10)
      .whereLessThan('payload.quantity', 100)
      .whereGreaterThanOrEqual('payload.min', 5)
      .whereLessThanOrEqual('payload.max', 50)
      .build();

    expect(rules).toHaveLength(4);
  });


  it('should build string rules', () => {
    const rules = filterRules()
      .whereContains('payload.assetTag', 'HW')
      .whereStartsWith('payload.assetTag', 'AMS')
      .whereEndsWith('payload.assetTag', '123')
      .whereMatches('payload.assetTag', '^AMS-.*$')
      .build();

    expect(rules).toHaveLength(4);
  });

  it('should build existence rules', () => {
    const rules = filterRules()
      .whereExists('payload.assetType')
      .whereNotExists('payload.deletedAt')
      .build();

    expect(rules).toHaveLength(2);
  });

  it('should build composite OR rule', () => {
    const rules = filterRules()
      .or((b) => {
        b.whereEquals('payload.assetType', 'HARDWARE')
         .whereEquals('payload.assetType', 'SOFTWARE');
      })
      .build();

    expect(rules).toHaveLength(1);
    expect((rules[0] as CompositeFilterRule).logic).toBe('OR');
    expect((rules[0] as CompositeFilterRule).rules).toHaveLength(2);
  });

  it('should build composite AND rule', () => {
    const rules = filterRules()
      .and((b) => {
        b.whereEquals('source', 'test-service')
         .whereExists('payload.assetType');
      })
      .build();

    expect(rules).toHaveLength(1);
    expect((rules[0] as CompositeFilterRule).logic).toBe('AND');
  });

  it('should convert to EventFilter', () => {
    const filter = filterRules()
      .whereEquals('payload.assetType', 'HARDWARE')
      .toFilter();

    const matchingEvent = createMockEvent('ASSET_CREATED', 'e1', { assetType: 'HARDWARE' });
    const nonMatchingEvent = createMockEvent('ASSET_CREATED', 'e2', { assetType: 'SOFTWARE' });

    expect(filter(matchingEvent)).toBe(true);
    expect(filter(nonMatchingEvent)).toBe(false);
  });

  it('should create new instance with filterRules factory', () => {
    const builder = filterRules();
    expect(builder).toBeInstanceOf(FilterRuleBuilder);
  });
});
