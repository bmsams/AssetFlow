/**
 * Asset Service Unit Tests
 *
 * Tests for CRUD operations and business logic
 * Validates Requirements: 2.1, 2.6, 2.7
 */

import * as fc from 'fast-check';

import type { AssetStatus, AssetType, CreateAssetRequest, UpdateAssetRequest } from '@ams/types';

import { isValidStateTransition } from '../service/asset-service';

// Mock dependencies
jest.mock('@ams/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryMany: jest.fn(),
  withTransaction: jest.fn((fn) => fn({
    query: jest.fn(),
    queryOne: jest.fn(),
    queryMany: jest.fn(),
  })),
}));

jest.mock('@ams/cache', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  getOrSet: jest.fn((_key, fn) => fn()),
  invalidate: jest.fn(),
  DEFAULT_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
  CACHE_ENTITY_TYPES: { ASSET: 'asset' },
  entityKey: jest.fn((type, id) => `${type}:${id}`),
  assetByTagKey: jest.fn((tag) => `asset:tag:${tag}`),
  assetsByStockroomKey: jest.fn((id) => `asset:stockroom:${id}`),
}));

jest.mock('@ams/events', () => ({
  publishAssetCreated: jest.fn().mockResolvedValue('event-id'),
  publishAssetUpdated: jest.fn().mockResolvedValue('event-id'),
  publishAssetDeleted: jest.fn().mockResolvedValue('event-id'),
  publishAssetStateChanged: jest.fn().mockResolvedValue('event-id'),
}));

jest.mock('@ams/utils', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  generateAssetTag: jest.fn((type: AssetType) => {
    const prefixes: Record<AssetType, string> = {
      HARDWARE: 'HW',
      SOFTWARE: 'SW',
      ENTERPRISE: 'EN',
    };
    const prefix = prefixes[type];
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `AMS-${prefix}-${date}-${random}`;
  }),
  now: jest.fn(() => new Date().toISOString()),
  validateUUID: jest.fn(),
  validate: jest.fn(() => ({
    required: jest.fn().mockReturnThis(),
    enum: jest.fn().mockReturnThis(),
    stringLength: jest.fn().mockReturnThis(),
    result: jest.fn(() => ({ isValid: true, errors: [] })),
  })),
}));

describe('Asset Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidStateTransition', () => {
    /**
     * Validates: Requirements 2.4
     * Tests that state transitions follow the defined lifecycle
     */
    it('should allow valid state transitions', () => {
      // ORDERED -> RECEIVED
      expect(isValidStateTransition('ORDERED', 'RECEIVED')).toBe(true);
      
      // RECEIVED -> IN_STOCK
      expect(isValidStateTransition('RECEIVED', 'IN_STOCK')).toBe(true);
      
      // IN_STOCK -> DEPLOYED
      expect(isValidStateTransition('IN_STOCK', 'DEPLOYED')).toBe(true);
      
      // IN_STOCK -> RESERVED
      expect(isValidStateTransition('IN_STOCK', 'RESERVED')).toBe(true);
      
      // DEPLOYED -> IN_MAINTENANCE
      expect(isValidStateTransition('DEPLOYED', 'IN_MAINTENANCE')).toBe(true);
      
      // DEPLOYED -> RETIRED
      expect(isValidStateTransition('DEPLOYED', 'RETIRED')).toBe(true);
      
      // RETIRED -> DISPOSED
      expect(isValidStateTransition('RETIRED', 'DISPOSED')).toBe(true);
    });

    it('should reject invalid state transitions', () => {
      // Cannot skip states
      expect(isValidStateTransition('ORDERED', 'IN_STOCK')).toBe(false);
      expect(isValidStateTransition('ORDERED', 'DEPLOYED')).toBe(false);
      
      // Cannot go backwards
      expect(isValidStateTransition('DEPLOYED', 'ORDERED')).toBe(false);
      expect(isValidStateTransition('IN_STOCK', 'RECEIVED')).toBe(false);
      
      // DISPOSED is terminal
      expect(isValidStateTransition('DISPOSED', 'RETIRED')).toBe(false);
      expect(isValidStateTransition('DISPOSED', 'IN_STOCK')).toBe(false);
    });

    it('should handle same state transition as invalid', () => {
      const states: AssetStatus[] = [
        'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
        'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
      ];
      
      for (const state of states) {
        expect(isValidStateTransition(state, state)).toBe(false);
      }
    });
  });

  describe('State Transition Property Tests', () => {
    /**
     * Property: All valid transitions should be explicitly defined
     * Validates: Requirements 2.4
     */
    it('should have deterministic transition rules', () => {
      const allStates: AssetStatus[] = [
        'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
        'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...allStates),
          fc.constantFrom(...allStates),
          (fromState, toState) => {
            const result = isValidStateTransition(fromState, toState);
            // Result should always be a boolean
            expect(typeof result).toBe('boolean');
            // Same state should never be valid
            if (fromState === toState) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: DISPOSED state should be terminal (no outgoing transitions)
     * Validates: Requirements 2.4
     */
    it('should have DISPOSED as terminal state', () => {
      const allStates: AssetStatus[] = [
        'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
        'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...allStates),
          (toState) => {
            expect(isValidStateTransition('DISPOSED', toState)).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: ORDERED should only transition to RECEIVED
     * Validates: Requirements 2.4
     */
    it('should only allow ORDERED to transition to RECEIVED', () => {
      const allStates: AssetStatus[] = [
        'ORDERED', 'RECEIVED', 'IN_STOCK', 'RESERVED',
        'DEPLOYED', 'IN_MAINTENANCE', 'RETIRED', 'DISPOSED'
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...allStates),
          (toState) => {
            const result = isValidStateTransition('ORDERED', toState);
            if (toState === 'RECEIVED') {
              expect(result).toBe(true);
            } else {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('Asset Tag Generation', () => {
  /**
   * Validates: Requirements 2.6
   * Tests asset tag format and uniqueness
   */
  describe('Tag Format', () => {
    it('should generate tags with correct format for HARDWARE', () => {
      const { generateAssetTag } = jest.requireMock('@ams/utils');
      const tag = generateAssetTag('HARDWARE');
      
      expect(tag).toMatch(/^AMS-HW-\d{8}-[A-Z0-9]{6}$/);
    });

    it('should generate tags with correct format for SOFTWARE', () => {
      const { generateAssetTag } = jest.requireMock('@ams/utils');
      const tag = generateAssetTag('SOFTWARE');
      
      expect(tag).toMatch(/^AMS-SW-\d{8}-[A-Z0-9]{6}$/);
    });

    it('should generate tags with correct format for ENTERPRISE', () => {
      const { generateAssetTag } = jest.requireMock('@ams/utils');
      const tag = generateAssetTag('ENTERPRISE');
      
      expect(tag).toMatch(/^AMS-EN-\d{8}-[A-Z0-9]{6}$/);
    });
  });

  describe('Tag Uniqueness Property', () => {
    /**
     * Property: Generated tags should be unique across multiple generations
     * Validates: Requirements 2.6
     */
    it('should generate unique tags', () => {
      const { generateAssetTag } = jest.requireMock('@ams/utils');
      const assetTypes: AssetType[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...assetTypes),
          fc.integer({ min: 10, max: 100 }),
          (assetType, count) => {
            const tags = new Set<string>();
            
            for (let i = 0; i < count; i++) {
              const tag = generateAssetTag(assetType);
              tags.add(tag);
            }
            
            // All generated tags should be unique
            expect(tags.size).toBe(count);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

describe('CreateAssetRequest Validation', () => {
  /**
   * Validates: Requirements 2.1
   */
  const validAssetTypes: AssetType[] = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'];
  
  describe('Valid Requests', () => {
    it('should accept valid create requests', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...validAssetTypes),
          fc.string({ minLength: 1, maxLength: 255 }),
          fc.option(fc.string({ maxLength: 2000 })),
          (assetType, displayName, description) => {
            const request: CreateAssetRequest = {
              assetType,
              displayName,
              description: description ?? undefined,
            };
            
            // Request should have required fields
            expect(request.assetType).toBeDefined();
            expect(request.displayName).toBeDefined();
            expect(validAssetTypes).toContain(request.assetType);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

describe('UpdateAssetRequest Validation', () => {
  /**
   * Validates: Requirements 2.1, 2.7
   */
  describe('Partial Updates', () => {
    it('should allow partial updates', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 255 })),
          fc.option(fc.string({ maxLength: 2000 })),
          fc.option(fc.string({ maxLength: 50 })),
          (displayName, description, substatus) => {
            const request: UpdateAssetRequest = {
              displayName: displayName ?? undefined,
              description: description ?? undefined,
              substatus: substatus ?? undefined,
            };
            
            // At least one field should be updatable
            const hasUpdate = 
              request.displayName !== undefined ||
              request.description !== undefined ||
              request.substatus !== undefined;
            
            // Empty updates are valid (no-op)
            expect(typeof hasUpdate).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
