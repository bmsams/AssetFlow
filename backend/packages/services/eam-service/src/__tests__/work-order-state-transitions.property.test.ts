/**
 * Property-Based Tests for Work Order State Transitions
 *
 * **Validates: Requirements 14.5**
 *
 * Tests the work order state machine using property-based testing to verify:
 * - Valid state transitions are allowed
 * - Invalid state transitions are rejected
 * - Terminal states have no outgoing transitions
 * - State transition consistency
 */

import * as fc from 'fast-check';

import {
  VALID_STATE_TRANSITIONS,
  isValidStateTransition,
  canAssign,
  canComplete,
} from '../work-order/work-order-service';
import type { WorkOrderStatus } from '../work-order/work-order-service';

/**
 * All valid work order statuses
 */
const ALL_STATUSES: WorkOrderStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'PENDING_PARTS',
  'PENDING_APPROVAL',
  'COMPLETED',
  'CANCELLED',
  'CLOSED',
];

/**
 * Terminal states that have no outgoing transitions
 */
const TERMINAL_STATES: WorkOrderStatus[] = ['CANCELLED', 'CLOSED'];

/**
 * Active states that can be cancelled
 */
const CANCELLABLE_STATES: WorkOrderStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'PENDING_PARTS',
  'PENDING_APPROVAL',
];

/**
 * Arbitrary for generating valid work order statuses
 */
const statusArbitrary = fc.constantFrom(...ALL_STATUSES);

/**
 * Arbitrary for generating non-terminal statuses
 */
const nonTerminalStatusArbitrary = fc.constantFrom(
  ...ALL_STATUSES.filter(s => !TERMINAL_STATES.includes(s))
);

/**
 * Arbitrary for generating terminal statuses
 */
const terminalStatusArbitrary = fc.constantFrom(...TERMINAL_STATES);

/**
 * Arbitrary for generating cancellable statuses
 */
const cancellableStatusArbitrary = fc.constantFrom(...CANCELLABLE_STATES);

describe('Work Order State Transitions Property Tests', () => {
  /**
   * **Validates: Requirements 14.5**
   * Property: Terminal states have no valid outgoing transitions
   */
  describe('Property: Terminal states have no outgoing transitions', () => {
    it('should not allow any transition from terminal states', () => {
      fc.assert(
        fc.property(
          terminalStatusArbitrary,
          statusArbitrary,
          (terminalStatus, targetStatus) => {
            // Terminal states should never have valid transitions to any status
            const result = isValidStateTransition(terminalStatus, targetStatus);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: All cancellable states can transition to CANCELLED
   */
  describe('Property: Cancellable states can be cancelled', () => {
    it('should allow transition to CANCELLED from all cancellable states', () => {
      fc.assert(
        fc.property(
          cancellableStatusArbitrary,
          (status) => {
            // All cancellable states should be able to transition to CANCELLED
            return isValidStateTransition(status, 'CANCELLED') === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: VALID_STATE_TRANSITIONS is consistent with isValidStateTransition
   */
  describe('Property: State transition map consistency', () => {
    it('should have isValidStateTransition consistent with VALID_STATE_TRANSITIONS map', () => {
      fc.assert(
        fc.property(
          statusArbitrary,
          statusArbitrary,
          (fromStatus, toStatus) => {
            const validTransitions = VALID_STATE_TRANSITIONS[fromStatus];
            const expectedResult = validTransitions.includes(toStatus);
            const actualResult = isValidStateTransition(fromStatus, toStatus);
            return expectedResult === actualResult;
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: Non-terminal states have at least one valid transition
   */
  describe('Property: Non-terminal states have outgoing transitions', () => {
    it('should have at least one valid transition from non-terminal states', () => {
      fc.assert(
        fc.property(
          nonTerminalStatusArbitrary,
          (status) => {
            const validTransitions = VALID_STATE_TRANSITIONS[status];
            // Non-terminal states should have at least one valid transition
            return validTransitions.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: COMPLETED can only transition to CLOSED
   */
  describe('Property: COMPLETED state transitions', () => {
    it('should only allow COMPLETED to transition to CLOSED', () => {
      fc.assert(
        fc.property(
          statusArbitrary,
          (targetStatus) => {
            const result = isValidStateTransition('COMPLETED', targetStatus);
            // COMPLETED should only transition to CLOSED
            if (targetStatus === 'CLOSED') {
              return result === true;
            }
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: Standard workflow path is always valid
   */
  describe('Property: Standard workflow path validity', () => {
    it('should allow the standard workflow: OPEN → ASSIGNED → IN_PROGRESS → COMPLETED → CLOSED', () => {
      const standardPath: [WorkOrderStatus, WorkOrderStatus][] = [
        ['OPEN', 'ASSIGNED'],
        ['ASSIGNED', 'IN_PROGRESS'],
        ['IN_PROGRESS', 'COMPLETED'],
        ['COMPLETED', 'CLOSED'],
      ];

      fc.assert(
        fc.property(
          fc.constantFrom(...standardPath),
          ([from, to]) => {
            return isValidStateTransition(from, to) === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.2**
   * Property: Assignment is only allowed from OPEN or ASSIGNED states
   */
  describe('Property: Assignment state constraints', () => {
    it('should only allow assignment from OPEN or ASSIGNED states', () => {
      fc.assert(
        fc.property(
          statusArbitrary,
          (status) => {
            const canAssignResult = canAssign(status);
            const expectedResult = status === 'OPEN' || status === 'ASSIGNED';
            return canAssignResult === expectedResult;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.4**
   * Property: Completion is not allowed from terminal or completed states
   */
  describe('Property: Completion state constraints', () => {
    it('should not allow completion from COMPLETED, CANCELLED, or CLOSED states', () => {
      const nonCompletableStates: WorkOrderStatus[] = ['COMPLETED', 'CANCELLED', 'CLOSED'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...nonCompletableStates),
          (status) => {
            return canComplete(status) === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should allow completion from all active states', () => {
      const completableStates: WorkOrderStatus[] = [
        'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL'
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...completableStates),
          (status) => {
            return canComplete(status) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: Hold states can resume to IN_PROGRESS
   */
  describe('Property: Hold state resumption', () => {
    it('should allow ON_HOLD and PENDING_PARTS to resume to IN_PROGRESS', () => {
      const holdStates: WorkOrderStatus[] = ['ON_HOLD', 'PENDING_PARTS'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...holdStates),
          (status) => {
            return isValidStateTransition(status, 'IN_PROGRESS') === true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: IN_PROGRESS can transition to multiple states
   */
  describe('Property: IN_PROGRESS state flexibility', () => {
    it('should allow IN_PROGRESS to transition to hold, pending, or completion states', () => {
      const validTargets: WorkOrderStatus[] = [
        'ON_HOLD', 'PENDING_PARTS', 'PENDING_APPROVAL', 'COMPLETED', 'CANCELLED'
      ];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...validTargets),
          (targetStatus) => {
            return isValidStateTransition('IN_PROGRESS', targetStatus) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: Self-transitions are not allowed
   */
  describe('Property: No self-transitions', () => {
    it('should not allow transitioning to the same state', () => {
      fc.assert(
        fc.property(
          statusArbitrary,
          (status) => {
            // Self-transitions should not be in the valid transitions list
            const validTransitions = VALID_STATE_TRANSITIONS[status];
            return !validTransitions.includes(status);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Validates: Requirements 14.5**
   * Property: Backward transitions are limited
   */
  describe('Property: Limited backward transitions', () => {
    it('should only allow specific backward transitions', () => {
      // Define the only allowed backward transitions
      const allowedBackwardTransitions: [WorkOrderStatus, WorkOrderStatus][] = [
        ['ASSIGNED', 'OPEN'],  // Unassign
        ['ON_HOLD', 'IN_PROGRESS'],  // Resume from hold
        ['PENDING_PARTS', 'IN_PROGRESS'],  // Resume after parts received
        ['PENDING_PARTS', 'ON_HOLD'],  // Put on hold while waiting for parts
        ['PENDING_APPROVAL', 'IN_PROGRESS'],  // Return for more work
      ];

      // Status order for determining "backward"
      const statusOrder: Record<WorkOrderStatus, number> = {
        'OPEN': 0,
        'ASSIGNED': 1,
        'IN_PROGRESS': 2,
        'ON_HOLD': 2,  // Same level as IN_PROGRESS
        'PENDING_PARTS': 2,  // Same level as IN_PROGRESS
        'PENDING_APPROVAL': 3,
        'COMPLETED': 4,
        'CANCELLED': 5,
        'CLOSED': 6,
      };

      fc.assert(
        fc.property(
          statusArbitrary,
          statusArbitrary,
          (fromStatus, toStatus) => {
            const isBackward = statusOrder[toStatus] < statusOrder[fromStatus];
            const isValid = isValidStateTransition(fromStatus, toStatus);
            
            if (isBackward && isValid) {
              // If it's a valid backward transition, it must be in the allowed list
              return allowedBackwardTransitions.some(
                ([from, to]) => from === fromStatus && to === toStatus
              );
            }
            return true;  // Forward transitions or invalid transitions are fine
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
