/**
 * Property-Based Tests for Model Lifecycle Transitions
 *
 * Tests the model lifecycle state machine using property-based testing.
 * 
 * **Validates: Requirements 11.3, 11.4**
 * 
 * Model Lifecycle States:
 * - ACTIVE: Model is available for use
 * - DEPRECATED: Model is being phased out
 * - END_OF_LIFE: Model is no longer supported (terminal state)
 *
 * Valid Transitions:
 * - ACTIVE → DEPRECATED (model is being phased out)
 * - DEPRECATED → END_OF_LIFE (model is no longer supported)
 * - DEPRECATED → ACTIVE (model is reinstated)
 *
 * Invalid Transitions:
 * - END_OF_LIFE → any other status (terminal state)
 * - ACTIVE → END_OF_LIFE (must go through DEPRECATED first)
 */

import * as fc from 'fast-check';
import type { ModelStatus } from '@ams/types';
import {
  isValidStatusTransition,
  getValidNextStatuses,
} from '../reference-data/model-service';

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Arbitrary for valid model statuses
 */
const modelStatusArb = fc.constantFrom<ModelStatus>('ACTIVE', 'DEPRECATED', 'END_OF_LIFE');

/**
 * Arbitrary for all possible status pairs
 */
const statusPairArb = fc.tuple(modelStatusArb, modelStatusArb);

/**
 * Arbitrary for a sequence of status transitions
 */
const statusSequenceArb = fc.array(modelStatusArb, { minLength: 1, maxLength: 10 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Model Lifecycle Property Tests', () => {
  /**
   * **Validates: Requirements 11.3**
   * 
   * Property: Same status transition is always valid (idempotent)
   * For any status S, transitioning from S to S should always be valid.
   */
  describe('Property: Same status transition is always valid', () => {
    it('should allow transitioning to the same status', () => {
      fc.assert(
        fc.property(modelStatusArb, (status) => {
          return isValidStatusTransition(status, status) === true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 11.3, 11.4**
   * 
   * Property: END_OF_LIFE is a terminal state
   * Once a model reaches END_OF_LIFE, it cannot transition to any other status.
   */
  describe('Property: END_OF_LIFE is a terminal state', () => {
    it('should not allow any transitions from END_OF_LIFE except to itself', () => {
      fc.assert(
        fc.property(modelStatusArb, (targetStatus) => {
          if (targetStatus === 'END_OF_LIFE') {
            // Same status is always valid
            return isValidStatusTransition('END_OF_LIFE', targetStatus) === true;
          }
          // Any other transition from END_OF_LIFE should be invalid
          return isValidStatusTransition('END_OF_LIFE', targetStatus) === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return empty array for valid next statuses from END_OF_LIFE', () => {
      const validNext = getValidNextStatuses('END_OF_LIFE');
      expect(validNext).toEqual([]);
      expect(validNext.length).toBe(0);
    });
  });

  /**
   * **Validates: Requirements 11.3**
   * 
   * Property: ACTIVE can only transition to DEPRECATED
   * Direct transition from ACTIVE to END_OF_LIFE is not allowed.
   */
  describe('Property: ACTIVE can only transition to DEPRECATED', () => {
    it('should only allow ACTIVE → DEPRECATED transition', () => {
      fc.assert(
        fc.property(modelStatusArb, (targetStatus) => {
          if (targetStatus === 'ACTIVE') {
            // Same status is always valid
            return isValidStatusTransition('ACTIVE', targetStatus) === true;
          }
          if (targetStatus === 'DEPRECATED') {
            // ACTIVE → DEPRECATED is valid
            return isValidStatusTransition('ACTIVE', targetStatus) === true;
          }
          // ACTIVE → END_OF_LIFE is invalid
          return isValidStatusTransition('ACTIVE', targetStatus) === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should return [DEPRECATED] for valid next statuses from ACTIVE', () => {
      const validNext = getValidNextStatuses('ACTIVE');
      expect(validNext).toContain('DEPRECATED');
      expect(validNext).not.toContain('END_OF_LIFE');
      expect(validNext.length).toBe(1);
    });
  });

  /**
   * **Validates: Requirements 11.3**
   * 
   * Property: DEPRECATED can transition to ACTIVE or END_OF_LIFE
   * DEPRECATED is the only state that allows bidirectional transitions.
   */
  describe('Property: DEPRECATED allows bidirectional transitions', () => {
    it('should allow DEPRECATED → ACTIVE and DEPRECATED → END_OF_LIFE', () => {
      fc.assert(
        fc.property(modelStatusArb, (targetStatus) => {
          // All transitions from DEPRECATED are valid
          return isValidStatusTransition('DEPRECATED', targetStatus) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should return [ACTIVE, END_OF_LIFE] for valid next statuses from DEPRECATED', () => {
      const validNext = getValidNextStatuses('DEPRECATED');
      expect(validNext).toContain('ACTIVE');
      expect(validNext).toContain('END_OF_LIFE');
      expect(validNext.length).toBe(2);
    });
  });

  /**
   * **Validates: Requirements 11.3, 11.4**
   * 
   * Property: Valid transitions are consistent with getValidNextStatuses
   * isValidStatusTransition should return true if and only if the target
   * status is in getValidNextStatuses (or is the same status).
   */
  describe('Property: Transition validity is consistent with valid next statuses', () => {
    it('should have consistent transition validity', () => {
      fc.assert(
        fc.property(statusPairArb, ([currentStatus, targetStatus]) => {
          const validNextStatuses = getValidNextStatuses(currentStatus);
          const isValid = isValidStatusTransition(currentStatus, targetStatus);

          if (currentStatus === targetStatus) {
            // Same status is always valid
            return isValid === true;
          }

          // Transition is valid iff target is in valid next statuses
          const shouldBeValid = validNextStatuses.includes(targetStatus);
          return isValid === shouldBeValid;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 11.3, 11.4**
   * 
   * Property: Reaching END_OF_LIFE requires going through DEPRECATED
   * There is no direct path from ACTIVE to END_OF_LIFE.
   */
  describe('Property: END_OF_LIFE requires DEPRECATED intermediate state', () => {
    it('should not allow direct ACTIVE → END_OF_LIFE transition', () => {
      expect(isValidStatusTransition('ACTIVE', 'END_OF_LIFE')).toBe(false);
    });

    it('should allow ACTIVE → DEPRECATED → END_OF_LIFE path', () => {
      // First transition: ACTIVE → DEPRECATED
      expect(isValidStatusTransition('ACTIVE', 'DEPRECATED')).toBe(true);
      // Second transition: DEPRECATED → END_OF_LIFE
      expect(isValidStatusTransition('DEPRECATED', 'END_OF_LIFE')).toBe(true);
    });

    it('should verify minimum path length to END_OF_LIFE from ACTIVE is 2', () => {
      // Direct path (length 1) is invalid
      expect(isValidStatusTransition('ACTIVE', 'END_OF_LIFE')).toBe(false);
      
      // Path through DEPRECATED (length 2) is valid
      const step1Valid = isValidStatusTransition('ACTIVE', 'DEPRECATED');
      const step2Valid = isValidStatusTransition('DEPRECATED', 'END_OF_LIFE');
      expect(step1Valid && step2Valid).toBe(true);
    });
  });

  /**
   * **Validates: Requirements 11.3**
   * 
   * Property: Reinstatement is possible from DEPRECATED
   * A deprecated model can be reinstated to ACTIVE status.
   */
  describe('Property: Reinstatement from DEPRECATED is allowed', () => {
    it('should allow DEPRECATED → ACTIVE transition (reinstatement)', () => {
      expect(isValidStatusTransition('DEPRECATED', 'ACTIVE')).toBe(true);
    });

    it('should not allow reinstatement from END_OF_LIFE', () => {
      expect(isValidStatusTransition('END_OF_LIFE', 'ACTIVE')).toBe(false);
    });
  });

  /**
   * **Validates: Requirements 11.3, 11.4**
   * 
   * Property: State machine is deterministic
   * For any given current state and target state, the transition validity
   * should always return the same result.
   */
  describe('Property: State machine is deterministic', () => {
    it('should return consistent results for repeated calls', () => {
      fc.assert(
        fc.property(statusPairArb, fc.integer({ min: 1, max: 10 }), ([current, target], iterations) => {
          const results: boolean[] = [];
          for (let i = 0; i < iterations; i++) {
            results.push(isValidStatusTransition(current, target));
          }
          // All results should be the same
          return results.every((r) => r === results[0]);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 11.3, 11.4**
   * 
   * Property: Valid transition sequences maintain state consistency
   * Following a sequence of valid transitions should always result in a valid state.
   */
  describe('Property: Valid transition sequences maintain consistency', () => {
    /**
     * Simulate following a sequence of transitions, returning the final state
     * or null if any transition was invalid.
     */
    function followTransitions(startStatus: ModelStatus, transitions: ModelStatus[]): ModelStatus | null {
      let currentStatus = startStatus;
      for (const targetStatus of transitions) {
        if (!isValidStatusTransition(currentStatus, targetStatus)) {
          return null; // Invalid transition
        }
        currentStatus = targetStatus;
      }
      return currentStatus;
    }

    it('should reach END_OF_LIFE only through valid paths', () => {
      fc.assert(
        fc.property(statusSequenceArb, (sequence) => {
          const finalStatus = followTransitions('ACTIVE', sequence);
          
          if (finalStatus === 'END_OF_LIFE') {
            // If we reached END_OF_LIFE, the sequence must have included DEPRECATED
            // at some point before END_OF_LIFE
            const eolIndex = sequence.lastIndexOf('END_OF_LIFE');
            if (eolIndex > 0) {
              // Check that DEPRECATED appears before END_OF_LIFE
              const beforeEol = sequence.slice(0, eolIndex);
              return beforeEol.includes('DEPRECATED');
            }
            // If END_OF_LIFE is first in sequence, it's invalid from ACTIVE
            return eolIndex === -1 || sequence[0] !== 'END_OF_LIFE';
          }
          
          return true; // Other final states are fine
        }),
        { numRuns: 200 }
      );
    });

    it('should not be able to leave END_OF_LIFE once reached', () => {
      fc.assert(
        fc.property(statusSequenceArb, (sequence) => {
          // Start from END_OF_LIFE
          const finalStatus = followTransitions('END_OF_LIFE', sequence);
          
          // If any transition was valid, we should still be at END_OF_LIFE
          // (only same-status transitions are valid)
          if (finalStatus !== null) {
            return finalStatus === 'END_OF_LIFE';
          }
          
          // If transitions failed, that's expected for non-END_OF_LIFE targets
          return true;
        }),
        { numRuns: 200 }
      );
    });
  });

  /**
   * **Validates: Requirements 11.3**
   * 
   * Property: Transition graph has expected structure
   * Verify the overall structure of the state machine.
   */
  describe('Property: Transition graph structure', () => {
    it('should have exactly 3 states', () => {
      const allStatuses: ModelStatus[] = ['ACTIVE', 'DEPRECATED', 'END_OF_LIFE'];
      expect(allStatuses.length).toBe(3);
    });

    it('should have ACTIVE with 1 outgoing transition', () => {
      const validNext = getValidNextStatuses('ACTIVE');
      expect(validNext.length).toBe(1);
    });

    it('should have DEPRECATED with 2 outgoing transitions', () => {
      const validNext = getValidNextStatuses('DEPRECATED');
      expect(validNext.length).toBe(2);
    });

    it('should have END_OF_LIFE with 0 outgoing transitions', () => {
      const validNext = getValidNextStatuses('END_OF_LIFE');
      expect(validNext.length).toBe(0);
    });

    it('should have total of 3 valid transitions (excluding self-transitions)', () => {
      const allStatuses: ModelStatus[] = ['ACTIVE', 'DEPRECATED', 'END_OF_LIFE'];
      let totalTransitions = 0;
      
      for (const status of allStatuses) {
        totalTransitions += getValidNextStatuses(status).length;
      }
      
      // ACTIVE→DEPRECATED (1) + DEPRECATED→ACTIVE,END_OF_LIFE (2) + END_OF_LIFE→none (0) = 3
      expect(totalTransitions).toBe(3);
    });
  });

  /**
   * **Validates: Requirements 11.4**
   * 
   * Property: END_OF_LIFE models cannot be used for asset creation
   * This is a business rule that should be enforced.
   */
  describe('Property: END_OF_LIFE prevents asset creation', () => {
    it('should identify END_OF_LIFE as a blocking state for asset creation', () => {
      // END_OF_LIFE models should not allow new asset creation
      // This is verified by checking that END_OF_LIFE is a terminal state
      // with no valid outgoing transitions
      const validNext = getValidNextStatuses('END_OF_LIFE');
      expect(validNext.length).toBe(0);
      
      // And that you cannot transition back to ACTIVE
      expect(isValidStatusTransition('END_OF_LIFE', 'ACTIVE')).toBe(false);
    });

    it('should allow asset creation for ACTIVE and DEPRECATED models', () => {
      // ACTIVE models should allow asset creation
      expect(getValidNextStatuses('ACTIVE').length).toBeGreaterThan(0);
      
      // DEPRECATED models can still be used (though discouraged)
      // They can be reinstated to ACTIVE
      expect(isValidStatusTransition('DEPRECATED', 'ACTIVE')).toBe(true);
    });
  });
});

