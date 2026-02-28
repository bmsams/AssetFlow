/**
 * Property Test: Inventory Quantity Invariant
 *
 * **Validates: Requirements 3.2, 5.5, 2E.2**
 *
 * Property 6: For any stockroom inventory record, the quantity_available SHALL
 * always equal quantity_on_hand minus quantity_reserved. For any part reservation
 * on a work order, the sum of all reserved quantities for a part SHALL not exceed
 * the quantity_on_hand for that part.
 *
 * Invariants tested:
 * 1. quantityAvailable = quantityOnHand - quantityReserved (always)
 * 2. quantityOnHand >= 0 (never negative)
 * 3. quantityReserved >= 0 (never negative)
 * 4. quantityReserved <= quantityOnHand (can't reserve more than available)
 * 5. After any operation (reserve, release, adjust), these invariants must hold
 *
 * Requirements:
 * - 3.2: THE Stockroom_Manager SHALL track inventory quantities, locations, and
 *        stock levels across multiple stockrooms
 * - 5.5: WHEN a work order requires parts, THE Parts_Inventory_Service SHALL
 *        reserve parts and update availability
 * - 2E.2: THE Stockroom_Inventory entity SHALL include: stockroom_id, product_id,
 *         quantity_on_hand, quantity_reserved, quantity_available, reorder_point,
 *         reorder_quantity
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Inventory Simulation
// ============================================================================

/**
 * Represents an inventory item state
 */
interface InventoryState {
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
}

/**
 * Types of inventory operations
 */
type InventoryOperation =
  | { type: 'reserve'; quantity: number }
  | { type: 'release'; quantity: number }
  | { type: 'adjust'; quantity: number }
  | { type: 'receive'; quantity: number }
  | { type: 'issue'; quantity: number };


// ============================================================================
// Inventory State Machine (Pure Functions for Testing)
// ============================================================================

/**
 * Create initial inventory state
 */
function createInventoryState(quantityOnHand: number, quantityReserved: number = 0): InventoryState {
  return {
    quantityOnHand,
    quantityReserved,
    quantityAvailable: quantityOnHand - quantityReserved,
  };
}

/**
 * Check if the inventory invariants hold
 */
function checkInvariants(state: InventoryState): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Invariant 1: quantityAvailable = quantityOnHand - quantityReserved
  if (state.quantityAvailable !== state.quantityOnHand - state.quantityReserved) {
    violations.push(
      `Invariant 1 violated: quantityAvailable (${state.quantityAvailable}) !== ` +
      `quantityOnHand (${state.quantityOnHand}) - quantityReserved (${state.quantityReserved})`
    );
  }

  // Invariant 2: quantityOnHand >= 0
  if (state.quantityOnHand < 0) {
    violations.push(`Invariant 2 violated: quantityOnHand (${state.quantityOnHand}) < 0`);
  }

  // Invariant 3: quantityReserved >= 0
  if (state.quantityReserved < 0) {
    violations.push(`Invariant 3 violated: quantityReserved (${state.quantityReserved}) < 0`);
  }

  // Invariant 4: quantityReserved <= quantityOnHand
  if (state.quantityReserved > state.quantityOnHand) {
    violations.push(
      `Invariant 4 violated: quantityReserved (${state.quantityReserved}) > ` +
      `quantityOnHand (${state.quantityOnHand})`
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Apply a reserve operation to inventory state
 * Returns new state or null if operation is invalid
 */
function applyReserve(state: InventoryState, quantity: number): InventoryState | null {
  // Can't reserve negative quantity
  if (quantity < 0) {
    return null;
  }

  // Can't reserve more than available
  if (quantity > state.quantityAvailable) {
    return null;
  }

  return {
    quantityOnHand: state.quantityOnHand,
    quantityReserved: state.quantityReserved + quantity,
    quantityAvailable: state.quantityAvailable - quantity,
  };
}


/**
 * Apply a release operation to inventory state
 * Returns new state or null if operation is invalid
 */
function applyRelease(state: InventoryState, quantity: number): InventoryState | null {
  // Can't release negative quantity
  if (quantity < 0) {
    return null;
  }

  // Can't release more than reserved
  if (quantity > state.quantityReserved) {
    return null;
  }

  return {
    quantityOnHand: state.quantityOnHand,
    quantityReserved: state.quantityReserved - quantity,
    quantityAvailable: state.quantityAvailable + quantity,
  };
}

/**
 * Apply an adjustment operation to inventory state
 * Returns new state or null if operation is invalid
 */
function applyAdjust(state: InventoryState, quantity: number): InventoryState | null {
  const newQuantityOnHand = state.quantityOnHand + quantity;

  // Can't go negative
  if (newQuantityOnHand < 0) {
    return null;
  }

  // Can't have reserved more than on hand after adjustment
  if (state.quantityReserved > newQuantityOnHand) {
    return null;
  }

  return {
    quantityOnHand: newQuantityOnHand,
    quantityReserved: state.quantityReserved,
    quantityAvailable: newQuantityOnHand - state.quantityReserved,
  };
}

/**
 * Apply a receive operation (add to on-hand)
 */
function applyReceive(state: InventoryState, quantity: number): InventoryState | null {
  if (quantity < 0) {
    return null;
  }

  const newQuantityOnHand = state.quantityOnHand + quantity;

  return {
    quantityOnHand: newQuantityOnHand,
    quantityReserved: state.quantityReserved,
    quantityAvailable: newQuantityOnHand - state.quantityReserved,
  };
}

/**
 * Apply an issue operation (remove from on-hand)
 */
function applyIssue(state: InventoryState, quantity: number): InventoryState | null {
  if (quantity < 0) {
    return null;
  }

  // Can only issue from available (non-reserved) inventory
  if (quantity > state.quantityAvailable) {
    return null;
  }

  const newQuantityOnHand = state.quantityOnHand - quantity;

  return {
    quantityOnHand: newQuantityOnHand,
    quantityReserved: state.quantityReserved,
    quantityAvailable: newQuantityOnHand - state.quantityReserved,
  };
}


/**
 * Apply an operation to inventory state
 */
function applyOperation(state: InventoryState, operation: InventoryOperation): InventoryState | null {
  switch (operation.type) {
    case 'reserve':
      return applyReserve(state, operation.quantity);
    case 'release':
      return applyRelease(state, operation.quantity);
    case 'adjust':
      return applyAdjust(state, operation.quantity);
    case 'receive':
      return applyReceive(state, operation.quantity);
    case 'issue':
      return applyIssue(state, operation.quantity);
  }
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid initial inventory state
 */
const validInventoryStateArb = fc.integer({ min: 0, max: 10000 }).chain((quantityOnHand) =>
  fc.integer({ min: 0, max: quantityOnHand }).map((quantityReserved) =>
    createInventoryState(quantityOnHand, quantityReserved)
  )
);

/**
 * Generate inventory operations that are valid for a given state
 */
function validOperationArb(state: InventoryState): fc.Arbitrary<InventoryOperation> {
  const operations: fc.Arbitrary<InventoryOperation>[] = [];

  // Reserve: can reserve up to available quantity
  if (state.quantityAvailable > 0) {
    operations.push(
      fc.integer({ min: 1, max: state.quantityAvailable }).map((quantity) => ({
        type: 'reserve' as const,
        quantity,
      }))
    );
  }

  // Release: can release up to reserved quantity
  if (state.quantityReserved > 0) {
    operations.push(
      fc.integer({ min: 1, max: state.quantityReserved }).map((quantity) => ({
        type: 'release' as const,
        quantity,
      }))
    );
  }

  // Receive: can always receive more inventory
  operations.push(
    fc.integer({ min: 1, max: 1000 }).map((quantity) => ({
      type: 'receive' as const,
      quantity,
    }))
  );

  // Issue: can issue up to available quantity
  if (state.quantityAvailable > 0) {
    operations.push(
      fc.integer({ min: 1, max: state.quantityAvailable }).map((quantity) => ({
        type: 'issue' as const,
        quantity,
      }))
    );
  }

  // Adjust: can adjust within valid bounds
  const minAdjust = -(state.quantityOnHand - state.quantityReserved);
  const maxAdjust = 1000;
  if (minAdjust < maxAdjust) {
    operations.push(
      fc.integer({ min: minAdjust, max: maxAdjust }).map((quantity) => ({
        type: 'adjust' as const,
        quantity,
      }))
    );
  }

  // If no valid operations, just receive
  if (operations.length === 0) {
    return fc.integer({ min: 1, max: 100 }).map((quantity) => ({
      type: 'receive' as const,
      quantity,
    }));
  }

  return fc.oneof(...operations);
}


/**
 * Generate a sequence of valid operations for a given initial state
 */
function validOperationSequenceArb(
  initialState: InventoryState,
  length: number
): fc.Arbitrary<InventoryOperation[]> {
  if (length === 0) {
    return fc.constant([]);
  }

  return validOperationArb(initialState).chain((firstOp) => {
    const nextState = applyOperation(initialState, firstOp);
    if (!nextState) {
      // If operation fails, just return empty sequence
      return fc.constant([]);
    }

    return validOperationSequenceArb(nextState, length - 1).map((rest) => [firstOp, ...rest]);
  });
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 6: Inventory Quantity Invariant', () => {
  /**
   * **Validates: Requirements 3.2, 5.5, 2E.2**
   */

  describe('Invariant 1: quantityAvailable = quantityOnHand - quantityReserved', () => {
    /**
     * Property: For any valid inventory state, the available quantity must
     * equal on-hand minus reserved.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should maintain available = onHand - reserved for any initial state', () => {
      fc.assert(
        fc.property(validInventoryStateArb, (state) => {
          const result = checkInvariants(state);
          expect(result.valid).toBe(true);
          expect(result.violations).toHaveLength(0);
          expect(state.quantityAvailable).toBe(state.quantityOnHand - state.quantityReserved);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: After any valid reserve operation, the invariant holds.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should maintain invariant after reserve operations', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 0, max: 1000 }),
          (initialState, reserveAmount) => {
            const newState = applyReserve(initialState, reserveAmount);

            if (newState) {
              const result = checkInvariants(newState);
              expect(result.valid).toBe(true);
              expect(newState.quantityAvailable).toBe(
                newState.quantityOnHand - newState.quantityReserved
              );
            }
            // If operation was rejected, that's valid behavior
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Invariant 2: quantityOnHand >= 0', () => {
    /**
     * Property: On-hand quantity can never be negative.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should never allow negative on-hand quantity', () => {
      fc.assert(
        fc.property(validInventoryStateArb, (state) => {
          expect(state.quantityOnHand).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Adjustment operations that would make on-hand negative are rejected.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should reject adjustments that would make on-hand negative', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 1, max: 10000 }),
          (state, extraAmount) => {
            // Try to adjust by more than on-hand (negative direction)
            const invalidAdjustment = -(state.quantityOnHand + extraAmount);
            const result = applyAdjust(state, invalidAdjustment);

            // Operation should be rejected
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariant 3: quantityReserved >= 0', () => {
    /**
     * Property: Reserved quantity can never be negative.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should never allow negative reserved quantity', () => {
      fc.assert(
        fc.property(validInventoryStateArb, (state) => {
          expect(state.quantityReserved).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Release operations that would make reserved negative are rejected.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should reject releases that would make reserved negative', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 1, max: 10000 }),
          (state, extraAmount) => {
            // Try to release more than reserved
            const invalidRelease = state.quantityReserved + extraAmount;
            const result = applyRelease(state, invalidRelease);

            // Operation should be rejected
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariant 4: quantityReserved <= quantityOnHand', () => {
    /**
     * Property: Reserved quantity can never exceed on-hand quantity.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should never allow reserved to exceed on-hand', () => {
      fc.assert(
        fc.property(validInventoryStateArb, (state) => {
          expect(state.quantityReserved).toBeLessThanOrEqual(state.quantityOnHand);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Reserve operations that would exceed on-hand are rejected.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should reject reservations that would exceed on-hand', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 1, max: 10000 }),
          (state, extraAmount) => {
            // Try to reserve more than available
            const invalidReserve = state.quantityAvailable + extraAmount;
            const result = applyReserve(state, invalidReserve);

            // Operation should be rejected
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Invariant 5: Invariants hold after any sequence of operations', () => {
    /**
     * Property: After any sequence of valid operations, all invariants hold.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should maintain all invariants after a sequence of valid operations', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb.chain((initialState) =>
            fc.integer({ min: 1, max: 10 }).chain((length) =>
              validOperationSequenceArb(initialState, length).map((operations) => ({
                initialState,
                operations,
              }))
            )
          ),
          ({ initialState, operations }) => {
            let currentState = initialState;

            // Verify initial state
            let result = checkInvariants(currentState);
            expect(result.valid).toBe(true);

            // Apply each operation and verify invariants
            for (const operation of operations) {
              const newState = applyOperation(currentState, operation);

              if (newState) {
                result = checkInvariants(newState);
                expect(result.valid).toBe(true);
                expect(result.violations).toHaveLength(0);
                currentState = newState;
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Reserve followed by release returns to original available quantity.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should return to original available after reserve then release', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 1, max: 100 }),
          (initialState, amount) => {
            // Only test if we can reserve the amount
            if (amount > initialState.quantityAvailable) {
              return;
            }

            const afterReserve = applyReserve(initialState, amount);
            expect(afterReserve).not.toBeNull();

            if (afterReserve) {
              const afterRelease = applyRelease(afterReserve, amount);
              expect(afterRelease).not.toBeNull();

              if (afterRelease) {
                // Should return to original available
                expect(afterRelease.quantityAvailable).toBe(initialState.quantityAvailable);
                expect(afterRelease.quantityReserved).toBe(initialState.quantityReserved);
                expect(afterRelease.quantityOnHand).toBe(initialState.quantityOnHand);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Receive followed by issue of same amount returns to original state.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should return to original state after receive then issue of same amount', () => {
      fc.assert(
        fc.property(
          validInventoryStateArb,
          fc.integer({ min: 1, max: 100 }),
          (initialState, amount) => {
            const afterReceive = applyReceive(initialState, amount);
            expect(afterReceive).not.toBeNull();

            if (afterReceive) {
              const afterIssue = applyIssue(afterReceive, amount);
              expect(afterIssue).not.toBeNull();

              if (afterIssue) {
                // Should return to original state
                expect(afterIssue.quantityOnHand).toBe(initialState.quantityOnHand);
                expect(afterIssue.quantityReserved).toBe(initialState.quantityReserved);
                expect(afterIssue.quantityAvailable).toBe(initialState.quantityAvailable);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Edge Cases', () => {
    /**
     * Property: Zero quantities are valid and maintain invariants.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should handle zero quantities correctly', () => {
      // Zero on-hand, zero reserved
      const zeroState = createInventoryState(0, 0);
      const result = checkInvariants(zeroState);
      expect(result.valid).toBe(true);
      expect(zeroState.quantityAvailable).toBe(0);

      // Can't reserve from zero
      const reserveResult = applyReserve(zeroState, 1);
      expect(reserveResult).toBeNull();

      // Can't issue from zero
      const issueResult = applyIssue(zeroState, 1);
      expect(issueResult).toBeNull();

      // Can receive into zero
      const receiveResult = applyReceive(zeroState, 10);
      expect(receiveResult).not.toBeNull();
      expect(receiveResult?.quantityOnHand).toBe(10);
      expect(receiveResult?.quantityAvailable).toBe(10);
    });

    /**
     * Property: Maximum quantities maintain invariants.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should handle large quantities correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100000, max: 1000000 }),
          fc.integer({ min: 0, max: 100 }),
          (largeOnHand, reservedPercent) => {
            const reserved = Math.floor((largeOnHand * reservedPercent) / 100);
            const state = createInventoryState(largeOnHand, reserved);

            const result = checkInvariants(state);
            expect(result.valid).toBe(true);
            expect(state.quantityAvailable).toBe(largeOnHand - reserved);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Fully reserved inventory has zero available.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should have zero available when fully reserved', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (quantity) => {
          const state = createInventoryState(quantity, quantity);

          expect(state.quantityAvailable).toBe(0);
          expect(state.quantityOnHand).toBe(quantity);
          expect(state.quantityReserved).toBe(quantity);

          const result = checkInvariants(state);
          expect(result.valid).toBe(true);

          // Can't reserve more
          const reserveResult = applyReserve(state, 1);
          expect(reserveResult).toBeNull();

          // Can't issue (nothing available)
          const issueResult = applyIssue(state, 1);
          expect(issueResult).toBeNull();

          // Can release
          const releaseResult = applyRelease(state, 1);
          expect(releaseResult).not.toBeNull();
          expect(releaseResult?.quantityAvailable).toBe(1);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Adjustments that would violate reserved constraint are rejected.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should reject adjustments that would make reserved exceed on-hand', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          (onHand, reserved) => {
            // Ensure reserved <= onHand
            const actualReserved = Math.min(reserved, onHand);
            const state = createInventoryState(onHand, actualReserved);

            // Try to adjust down below reserved
            if (actualReserved > 0) {
              const invalidAdjustment = -(onHand - actualReserved + 1);
              const result = applyAdjust(state, invalidAdjustment);
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  describe('Multiple Reservations (Work Order Parts)', () => {
    /**
     * Property: Sum of all reservations cannot exceed on-hand quantity.
     * This validates the work order parts reservation constraint.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should ensure total reservations never exceed on-hand', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 1000 }),
          fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }),
          (onHand, reservationAmounts) => {
            let state = createInventoryState(onHand, 0);
            let totalReserved = 0;

            for (const amount of reservationAmounts) {
              const newState = applyReserve(state, amount);

              if (newState) {
                totalReserved += amount;
                state = newState;

                // Verify invariants after each reservation
                const result = checkInvariants(state);
                expect(result.valid).toBe(true);

                // Total reserved should match
                expect(state.quantityReserved).toBe(totalReserved);

                // Reserved should never exceed on-hand
                expect(state.quantityReserved).toBeLessThanOrEqual(state.quantityOnHand);
              } else {
                // Reservation was rejected - this is valid behavior
                // when trying to reserve more than available
                expect(amount).toBeGreaterThan(state.quantityAvailable);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Partial releases maintain invariants.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should handle partial releases correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 10, max: 50 }),
          fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }),
          (onHand, initialReserved, releaseAmounts) => {
            const actualReserved = Math.min(initialReserved, onHand);
            let state = createInventoryState(onHand, actualReserved);
            let currentReserved = actualReserved;

            for (const amount of releaseAmounts) {
              const newState = applyRelease(state, amount);

              if (newState) {
                currentReserved -= amount;
                state = newState;

                // Verify invariants
                const result = checkInvariants(state);
                expect(result.valid).toBe(true);
                expect(state.quantityReserved).toBe(currentReserved);
              } else {
                // Release was rejected - trying to release more than reserved
                expect(amount).toBeGreaterThan(state.quantityReserved);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Concurrent-like Operations', () => {
    /**
     * Property: Interleaved reserve/release operations maintain invariants.
     *
     * **Validates: Requirements 3.2, 5.5, 2E.2**
     */
    it('should maintain invariants with interleaved reserve and release', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.array(
            fc.record({
              type: fc.constantFrom('reserve', 'release'),
              amount: fc.integer({ min: 1, max: 20 }),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (onHand, operations) => {
            let state = createInventoryState(onHand, 0);

            for (const op of operations) {
              let newState: InventoryState | null = null;

              if (op.type === 'reserve') {
                newState = applyReserve(state, op.amount);
              } else {
                newState = applyRelease(state, op.amount);
              }

              if (newState) {
                state = newState;
                const result = checkInvariants(state);
                expect(result.valid).toBe(true);
              }
              // Invalid operations are silently rejected, which is correct
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
