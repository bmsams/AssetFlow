/**
 * Property-Based Tests: Rack Unit Calculations
 *
 * **Validates: Requirements 4.6**
 *
 * Properties tested:
 * 1. Invariant Property: For any valid rack, availableUnits = totalUnits - usedUnits
 * 2. Non-negative Property: availableUnits is always >= 0 when usedUnits <= totalUnits
 * 3. Boundary Property: When usedUnits = totalUnits, availableUnits = 0
 * 4. Boundary Property: When usedUnits = 0, availableUnits = totalUnits
 * 5. Update Property: After updating usedUnits, availableUnits is recalculated correctly
 * 6. Constraint Property: Attempting to set usedUnits > totalUnits should fail
 *
 * Requirements:
 * - 4.6: Calculate available units as totalUnits - usedUnits
 *        Validate that usedUnits cannot exceed totalUnits
 *        Validate that usedUnits cannot be negative
 */

import * as fc from 'fast-check';

// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Calculates available rack units.
 * This is a pure function that mirrors the rack service logic for testing.
 *
 * **Validates: Requirements 4.6**
 *
 * @param totalUnits - Total rack units available
 * @param usedUnits - Number of units currently in use
 * @returns Available units (totalUnits - usedUnits)
 */
function calculateAvailableUnits(totalUnits: number, usedUnits: number): number {
  return totalUnits - usedUnits;
}

/**
 * Validates that usedUnits is within valid bounds.
 * usedUnits must be >= 0 and <= totalUnits.
 *
 * **Validates: Requirements 4.6**
 *
 * @param totalUnits - Total rack units available
 * @param usedUnits - Number of units to validate
 * @returns true if usedUnits is valid
 */
function isValidUsedUnits(totalUnits: number, usedUnits: number): boolean {
  return usedUnits >= 0 && usedUnits <= totalUnits;
}

/**
 * Validates that a new usedUnits value can be set.
 * Returns an error message if invalid, null if valid.
 *
 * **Validates: Requirements 4.6**
 *
 * @param totalUnits - Total rack units available
 * @param newUsedUnits - New usedUnits value to set
 * @returns Error message or null if valid
 */
function validateUsedUnitsUpdate(
  totalUnits: number,
  newUsedUnits: number
): string | null {
  if (newUsedUnits < 0) {
    return 'Used units cannot be negative';
  }
  if (newUsedUnits > totalUnits) {
    return `Used units (${newUsedUnits}) cannot exceed total units (${totalUnits})`;
  }
  return null;
}

/**
 * Validates that totalUnits can be reduced to a new value.
 * totalUnits cannot be reduced below current usedUnits.
 *
 * **Validates: Requirements 4.6**
 *
 * @param currentUsedUnits - Current used units
 * @param newTotalUnits - New total units value
 * @returns Error message or null if valid
 */
function validateTotalUnitsReduction(
  currentUsedUnits: number,
  newTotalUnits: number
): string | null {
  if (newTotalUnits < currentUsedUnits) {
    return `Cannot reduce total units to ${newTotalUnits}: ${currentUsedUnits} units are in use`;
  }
  return null;
}

/**
 * Simulates a rack state with unit calculations.
 */
interface RackState {
  totalUnits: number;
  usedUnits: number;
  availableUnits: number;
}

/**
 * Creates a valid rack state with calculated availableUnits.
 *
 * @param totalUnits - Total rack units
 * @param usedUnits - Used rack units
 * @returns RackState with calculated availableUnits
 */
function createRackState(totalUnits: number, usedUnits: number): RackState {
  return {
    totalUnits,
    usedUnits,
    availableUnits: calculateAvailableUnits(totalUnits, usedUnits),
  };
}

/**
 * Updates usedUnits and recalculates availableUnits.
 *
 * @param rack - Current rack state
 * @param newUsedUnits - New used units value
 * @returns Updated rack state or null if invalid
 */
function updateRackUsedUnits(
  rack: RackState,
  newUsedUnits: number
): RackState | null {
  const error = validateUsedUnitsUpdate(rack.totalUnits, newUsedUnits);
  if (error) {
    return null;
  }
  return createRackState(rack.totalUnits, newUsedUnits);
}

/**
 * Updates totalUnits and recalculates availableUnits.
 *
 * @param rack - Current rack state
 * @param newTotalUnits - New total units value
 * @returns Updated rack state or null if invalid
 */
function updateRackTotalUnits(
  rack: RackState,
  newTotalUnits: number
): RackState | null {
  const error = validateTotalUnitsReduction(rack.usedUnits, newTotalUnits);
  if (error) {
    return null;
  }
  return createRackState(newTotalUnits, rack.usedUnits);
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid total units (positive integers representing rack capacity).
 * Standard rack sizes are typically 42U, 45U, 48U, but can vary.
 * We use a range of 1-100 for testing purposes.
 */
const totalUnitsArb = fc.integer({ min: 1, max: 100 });

/**
 * Generate valid used units given a total units value.
 * usedUnits must be >= 0 and <= totalUnits.
 */
const validUsedUnitsArb = (totalUnits: number) =>
  fc.integer({ min: 0, max: totalUnits });

/**
 * Generate a valid rack state with consistent unit calculations.
 */
const validRackStateArb = totalUnitsArb.chain((totalUnits) =>
  validUsedUnitsArb(totalUnits).map((usedUnits) =>
    createRackState(totalUnits, usedUnits)
  )
);

/**
 * Generate invalid used units (negative or exceeding total).
 */
const invalidUsedUnitsArb = (totalUnits: number) =>
  fc.oneof(
    // Negative values
    fc.integer({ min: -100, max: -1 }),
    // Values exceeding total
    fc.integer({ min: totalUnits + 1, max: totalUnits + 100 })
  );

/**
 * Generate a pair of (totalUnits, invalidUsedUnits) for constraint testing.
 */
const invalidUsedUnitsPairArb = totalUnitsArb.chain((totalUnits) =>
  invalidUsedUnitsArb(totalUnits).map((usedUnits) => ({
    totalUnits,
    usedUnits,
  }))
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Rack Unit Calculations', () => {
  /**
   * **Validates: Requirements 4.6**
   */

  describe('Property 1: Invariant - availableUnits = totalUnits - usedUnits', () => {
    /**
     * Property: For any valid rack configuration, the available units
     * must always equal totalUnits minus usedUnits.
     *
     * **Validates: Requirements 4.6**
     */
    it('should always calculate availableUnits as totalUnits - usedUnits', () => {
      fc.assert(
        fc.property(validRackStateArb, (rack) => {
          // The invariant must hold
          expect(rack.availableUnits).toBe(rack.totalUnits - rack.usedUnits);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The calculation function should be consistent with
     * the rack state creation.
     *
     * **Validates: Requirements 4.6**
     */
    it('should have consistent calculation between function and state', () => {
      fc.assert(
        fc.property(
          totalUnitsArb,
          fc.integer({ min: 0, max: 100 }),
          (totalUnits, usedUnits) => {
            // Only test valid combinations
            if (usedUnits > totalUnits) return;

            const calculated = calculateAvailableUnits(totalUnits, usedUnits);
            const rackState = createRackState(totalUnits, usedUnits);

            expect(calculated).toBe(rackState.availableUnits);
            expect(calculated).toBe(totalUnits - usedUnits);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The sum of usedUnits and availableUnits should equal totalUnits.
     *
     * **Validates: Requirements 4.6**
     */
    it('should satisfy usedUnits + availableUnits = totalUnits', () => {
      fc.assert(
        fc.property(validRackStateArb, (rack) => {
          expect(rack.usedUnits + rack.availableUnits).toBe(rack.totalUnits);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Non-negative - availableUnits >= 0 when valid', () => {
    /**
     * Property: When usedUnits is within valid bounds (0 <= usedUnits <= totalUnits),
     * availableUnits must always be non-negative.
     *
     * **Validates: Requirements 4.6**
     */
    it('should always have non-negative availableUnits for valid inputs', () => {
      fc.assert(
        fc.property(validRackStateArb, (rack) => {
          expect(rack.availableUnits).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The validation function should correctly identify valid usedUnits.
     *
     * **Validates: Requirements 4.6**
     */
    it('should validate usedUnits correctly', () => {
      fc.assert(
        fc.property(
          totalUnitsArb,
          fc.integer({ min: 0, max: 100 }),
          (totalUnits, usedUnits) => {
            const isValid = isValidUsedUnits(totalUnits, usedUnits);
            const expectedValid = usedUnits >= 0 && usedUnits <= totalUnits;

            expect(isValid).toBe(expectedValid);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Boundary - When usedUnits = totalUnits, availableUnits = 0', () => {
    /**
     * Property: When a rack is fully utilized (usedUnits equals totalUnits),
     * there should be zero available units.
     *
     * **Validates: Requirements 4.6**
     */
    it('should have zero availableUnits when rack is fully utilized', () => {
      fc.assert(
        fc.property(totalUnitsArb, (totalUnits) => {
          const rack = createRackState(totalUnits, totalUnits);

          expect(rack.usedUnits).toBe(rack.totalUnits);
          expect(rack.availableUnits).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Full utilization should be a valid state.
     *
     * **Validates: Requirements 4.6**
     */
    it('should allow full utilization as a valid state', () => {
      fc.assert(
        fc.property(totalUnitsArb, (totalUnits) => {
          const isValid = isValidUsedUnits(totalUnits, totalUnits);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Boundary - When usedUnits = 0, availableUnits = totalUnits', () => {
    /**
     * Property: When a rack is empty (usedUnits is zero),
     * all units should be available.
     *
     * **Validates: Requirements 4.6**
     */
    it('should have all units available when rack is empty', () => {
      fc.assert(
        fc.property(totalUnitsArb, (totalUnits) => {
          const rack = createRackState(totalUnits, 0);

          expect(rack.usedUnits).toBe(0);
          expect(rack.availableUnits).toBe(totalUnits);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty rack should be a valid state.
     *
     * **Validates: Requirements 4.6**
     */
    it('should allow empty rack as a valid state', () => {
      fc.assert(
        fc.property(totalUnitsArb, (totalUnits) => {
          const isValid = isValidUsedUnits(totalUnits, 0);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Update - availableUnits recalculated after usedUnits update', () => {
    /**
     * Property: After updating usedUnits to a valid value,
     * availableUnits should be correctly recalculated.
     *
     * **Validates: Requirements 4.6**
     */
    it('should recalculate availableUnits after valid usedUnits update', () => {
      fc.assert(
        fc.property(
          validRackStateArb,
          fc.integer({ min: 0, max: 100 }),
          (rack, newUsedUnits) => {
            // Only test valid updates
            if (newUsedUnits > rack.totalUnits || newUsedUnits < 0) return;

            const updated = updateRackUsedUnits(rack, newUsedUnits);

            expect(updated).not.toBeNull();
            expect(updated!.usedUnits).toBe(newUsedUnits);
            expect(updated!.availableUnits).toBe(rack.totalUnits - newUsedUnits);
            // Invariant should still hold
            expect(updated!.availableUnits).toBe(
              updated!.totalUnits - updated!.usedUnits
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: After updating totalUnits to a valid value,
     * availableUnits should be correctly recalculated.
     *
     * **Validates: Requirements 4.6**
     */
    it('should recalculate availableUnits after valid totalUnits update', () => {
      fc.assert(
        fc.property(
          validRackStateArb,
          fc.integer({ min: 1, max: 200 }),
          (rack, newTotalUnits) => {
            // Only test valid updates (newTotalUnits >= usedUnits)
            if (newTotalUnits < rack.usedUnits) return;

            const updated = updateRackTotalUnits(rack, newTotalUnits);

            expect(updated).not.toBeNull();
            expect(updated!.totalUnits).toBe(newTotalUnits);
            expect(updated!.usedUnits).toBe(rack.usedUnits);
            expect(updated!.availableUnits).toBe(newTotalUnits - rack.usedUnits);
            // Invariant should still hold
            expect(updated!.availableUnits).toBe(
              updated!.totalUnits - updated!.usedUnits
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Multiple sequential updates should maintain the invariant.
     *
     * **Validates: Requirements 4.6**
     */
    it('should maintain invariant through multiple updates', () => {
      fc.assert(
        fc.property(
          validRackStateArb,
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }),
          (initialRack, updates) => {
            let rack = initialRack;

            for (const newUsedUnits of updates) {
              // Only apply valid updates
              if (newUsedUnits >= 0 && newUsedUnits <= rack.totalUnits) {
                const updated = updateRackUsedUnits(rack, newUsedUnits);
                if (updated) {
                  rack = updated;
                  // Invariant should hold after each update
                  expect(rack.availableUnits).toBe(rack.totalUnits - rack.usedUnits);
                }
              }
            }

            // Final state should still satisfy invariant
            expect(rack.availableUnits).toBe(rack.totalUnits - rack.usedUnits);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: Constraint - usedUnits > totalUnits should fail', () => {
    /**
     * Property: Attempting to set usedUnits greater than totalUnits
     * should be rejected.
     *
     * **Validates: Requirements 4.6**
     */
    it('should reject usedUnits exceeding totalUnits', () => {
      fc.assert(
        fc.property(
          totalUnitsArb,
          fc.integer({ min: 1, max: 100 }),
          (totalUnits, excess) => {
            const invalidUsedUnits = totalUnits + excess;

            const error = validateUsedUnitsUpdate(totalUnits, invalidUsedUnits);

            expect(error).not.toBeNull();
            expect(error).toContain('cannot exceed total units');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Attempting to set negative usedUnits should be rejected.
     *
     * **Validates: Requirements 4.6**
     */
    it('should reject negative usedUnits', () => {
      fc.assert(
        fc.property(
          totalUnitsArb,
          fc.integer({ min: -100, max: -1 }),
          (totalUnits, negativeUsedUnits) => {
            const error = validateUsedUnitsUpdate(totalUnits, negativeUsedUnits);

            expect(error).not.toBeNull();
            expect(error).toContain('cannot be negative');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Attempting to reduce totalUnits below usedUnits should be rejected.
     *
     * **Validates: Requirements 4.6**
     */
    it('should reject reducing totalUnits below usedUnits', () => {
      fc.assert(
        fc.property(validRackStateArb, fc.integer({ min: 1, max: 50 }), (rack, reduction) => {
          // Only test when there are used units to protect
          if (rack.usedUnits === 0) return;

          const newTotalUnits = rack.usedUnits - reduction;
          if (newTotalUnits < 0) return; // Skip if would be negative

          const error = validateTotalUnitsReduction(rack.usedUnits, newTotalUnits);

          expect(error).not.toBeNull();
          expect(error).toContain('units are in use');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Update function should return null for invalid usedUnits.
     *
     * **Validates: Requirements 4.6**
     */
    it('should return null when updating to invalid usedUnits', () => {
      fc.assert(
        fc.property(invalidUsedUnitsPairArb, ({ totalUnits, usedUnits }) => {
          const rack = createRackState(totalUnits, 0);
          const updated = updateRackUsedUnits(rack, usedUnits);

          expect(updated).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Update function should return null when reducing totalUnits below usedUnits.
     *
     * **Validates: Requirements 4.6**
     */
    it('should return null when reducing totalUnits below usedUnits', () => {
      fc.assert(
        fc.property(
          validRackStateArb.filter((r) => r.usedUnits > 0),
          fc.integer({ min: 1, max: 50 }),
          (rack, reduction) => {
            const newTotalUnits = Math.max(0, rack.usedUnits - reduction);
            if (newTotalUnits >= rack.usedUnits) return; // Skip valid reductions

            const updated = updateRackTotalUnits(rack, newTotalUnits);

            expect(updated).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Minimum valid rack (1 unit total, 0 used).
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle minimum rack size correctly', () => {
      const rack = createRackState(1, 0);

      expect(rack.totalUnits).toBe(1);
      expect(rack.usedUnits).toBe(0);
      expect(rack.availableUnits).toBe(1);
    });

    /**
     * Property: Minimum valid rack fully utilized (1 unit total, 1 used).
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle minimum rack fully utilized', () => {
      const rack = createRackState(1, 1);

      expect(rack.totalUnits).toBe(1);
      expect(rack.usedUnits).toBe(1);
      expect(rack.availableUnits).toBe(0);
    });

    /**
     * Property: Large rack sizes should work correctly.
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle large rack sizes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (totalUnits, usedUnits) => {
            if (usedUnits > totalUnits) return;

            const rack = createRackState(totalUnits, usedUnits);

            expect(rack.availableUnits).toBe(totalUnits - usedUnits);
            expect(rack.availableUnits).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Calculation should be deterministic.
     *
     * **Validates: Requirements 4.6**
     */
    it('should produce deterministic results', () => {
      fc.assert(
        fc.property(validRackStateArb, (rack) => {
          const result1 = calculateAvailableUnits(rack.totalUnits, rack.usedUnits);
          const result2 = calculateAvailableUnits(rack.totalUnits, rack.usedUnits);
          const result3 = calculateAvailableUnits(rack.totalUnits, rack.usedUnits);

          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Standard rack sizes (42U, 45U, 48U) should work correctly.
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle standard rack sizes', () => {
      const standardSizes = [42, 45, 48];

      for (const totalUnits of standardSizes) {
        fc.assert(
          fc.property(fc.integer({ min: 0, max: totalUnits }), (usedUnits) => {
            const rack = createRackState(totalUnits, usedUnits);

            expect(rack.availableUnits).toBe(totalUnits - usedUnits);
            expect(rack.usedUnits + rack.availableUnits).toBe(totalUnits);
          }),
          { numRuns: 20 }
        );
      }
    });
  });

  describe('Commutativity and Associativity', () => {
    /**
     * Property: Order of updates should not affect final state
     * when updates are independent.
     *
     * **Validates: Requirements 4.6**
     */
    it('should reach same state regardless of update order for same final values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 0, max: 10 }),
          fc.integer({ min: 0, max: 10 }),
          (totalUnits, usedUnits1, usedUnits2) => {
            // Start from same initial state
            const initial = createRackState(totalUnits, 0);

            // Path 1: 0 -> usedUnits1 -> usedUnits2
            let path1 = updateRackUsedUnits(initial, usedUnits1);
            if (path1) {
              path1 = updateRackUsedUnits(path1, usedUnits2);
            }

            // Path 2: 0 -> usedUnits2 directly
            const path2 = updateRackUsedUnits(initial, usedUnits2);

            // Both paths should reach the same final state
            if (path1 && path2) {
              expect(path1.usedUnits).toBe(path2.usedUnits);
              expect(path1.availableUnits).toBe(path2.availableUnits);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
