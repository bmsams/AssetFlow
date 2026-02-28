/**
 * Property Test: Compliance Position Calculation
 *
 * **Validates: Requirements 4.1, 4.2**
 *
 * Property 10: For any software product, the compliance position SHALL be calculated as:
 * - COMPLIANT when entitlements >= installations AND entitlements == installations
 * - OVER_LICENSED when entitlements > installations
 * - UNDER_LICENSED when entitlements < installations
 *
 * Requirements:
 * - 4.1: THE Reconciliation_Engine SHALL calculate compliance position by comparing
 *        entitlements owned versus installations discovered
 * - 4.2: THE Reconciliation_Engine SHALL determine compliance status as compliant,
 *        over-licensed, or under-licensed based on the comparison
 *
 * Properties tested:
 * 1. Compliance status is COMPLIANT when entitlements equal installations
 * 2. Compliance status is OVER_LICENSED when entitlements exceed installations
 * 3. Compliance status is UNDER_LICENSED when installations exceed entitlements
 * 4. Over/under count is correctly calculated (entitlements - installations)
 * 5. Compliance percentage is correctly calculated
 * 6. Results are deterministic for same inputs
 */

import * as fc from 'fast-check';

import {
  calculateCompliancePercentage,
  calculateComplianceStatus,
  calculateOverUnderCount,
} from '../reconciliation/reconciliation-service';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a non-negative integer for entitlements/installations
 * Using reasonable bounds to avoid overflow issues
 */
const nonNegativeIntArb = fc.integer({ min: 0, max: 1_000_000 });

/**
 * Generate a positive integer (at least 1)
 */
const positiveIntArb = fc.integer({ min: 1, max: 1_000_000 });

/**
 * Generate a scenario where entitlements equal installations (COMPLIANT)
 */
const compliantScenarioArb = nonNegativeIntArb.map((value) => ({
  entitlements: value,
  installations: value,
}));

/**
 * Generate a scenario where entitlements exceed installations (OVER_LICENSED)
 */
const overLicensedScenarioArb = fc
  .tuple(nonNegativeIntArb, positiveIntArb)
  .map(([installations, excess]) => ({
    entitlements: installations + excess,
    installations,
  }));

/**
 * Generate a scenario where installations exceed entitlements (UNDER_LICENSED)
 */
const underLicensedScenarioArb = fc
  .tuple(nonNegativeIntArb, positiveIntArb)
  .map(([entitlements, excess]) => ({
    entitlements,
    installations: entitlements + excess,
  }));

/**
 * Generate any valid compliance scenario
 */
const anyScenarioArb = fc.record({
  entitlements: nonNegativeIntArb,
  installations: nonNegativeIntArb,
});

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 10: Compliance Position Calculation', () => {
  /**
   * **Validates: Requirements 4.1, 4.2**
   */

  describe('COMPLIANT Status Calculation', () => {
    /**
     * Property: Compliance status is COMPLIANT when entitlements equal installations.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return COMPLIANT when entitlements equal installations', () => {
      fc.assert(
        fc.property(compliantScenarioArb, ({ entitlements, installations }) => {
          const status = calculateComplianceStatus(entitlements, installations);
          expect(status).toBe('COMPLIANT');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When COMPLIANT, over/under count is always zero.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have zero over/under count when COMPLIANT', () => {
      fc.assert(
        fc.property(compliantScenarioArb, ({ entitlements, installations }) => {
          const overUnderCount = calculateOverUnderCount(entitlements, installations);
          expect(overUnderCount).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When COMPLIANT with non-zero values, compliance percentage is 100%.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have 100% compliance percentage when COMPLIANT with non-zero values', () => {
      fc.assert(
        fc.property(positiveIntArb, (value) => {
          const percentage = calculateCompliancePercentage(value, value);
          expect(percentage).toBe(100);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('OVER_LICENSED Status Calculation', () => {
    /**
     * Property: Compliance status is OVER_LICENSED when entitlements exceed installations.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return OVER_LICENSED when entitlements exceed installations', () => {
      fc.assert(
        fc.property(overLicensedScenarioArb, ({ entitlements, installations }) => {
          const status = calculateComplianceStatus(entitlements, installations);
          expect(status).toBe('OVER_LICENSED');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When OVER_LICENSED, over/under count is always positive.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have positive over/under count when OVER_LICENSED', () => {
      fc.assert(
        fc.property(overLicensedScenarioArb, ({ entitlements, installations }) => {
          const overUnderCount = calculateOverUnderCount(entitlements, installations);
          expect(overUnderCount).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When OVER_LICENSED with non-zero installations, compliance percentage >= 100%.
     * Note: Due to rounding to 2 decimal places, very small differences may round to exactly 100%.
     * The percentage is always >= 100% when over-licensed.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have compliance percentage >= 100% when OVER_LICENSED with non-zero installations', () => {
      fc.assert(
        fc.property(
          fc.tuple(positiveIntArb, positiveIntArb).map(([installations, excess]) => ({
            entitlements: installations + excess,
            installations,
          })),
          ({ entitlements, installations }) => {
            const percentage = calculateCompliancePercentage(entitlements, installations);
            expect(percentage).toBeGreaterThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When significantly OVER_LICENSED, compliance percentage > 100%.
     * Using a minimum excess that ensures the percentage difference is visible after rounding.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have compliance percentage > 100% when significantly OVER_LICENSED', () => {
      fc.assert(
        fc.property(
          // Ensure excess is at least 1% of installations to avoid rounding issues
          fc.tuple(
            fc.integer({ min: 1, max: 10000 }),
            fc.integer({ min: 1, max: 100 })
          ).map(([installations, excessPercent]) => ({
            entitlements: installations + Math.max(1, Math.ceil(installations * excessPercent / 100)),
            installations,
          })),
          ({ entitlements, installations }) => {
            const percentage = calculateCompliancePercentage(entitlements, installations);
            expect(percentage).toBeGreaterThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('UNDER_LICENSED Status Calculation', () => {
    /**
     * Property: Compliance status is UNDER_LICENSED when installations exceed entitlements.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return UNDER_LICENSED when installations exceed entitlements', () => {
      fc.assert(
        fc.property(underLicensedScenarioArb, ({ entitlements, installations }) => {
          const status = calculateComplianceStatus(entitlements, installations);
          expect(status).toBe('UNDER_LICENSED');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When UNDER_LICENSED, over/under count is always negative.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have negative over/under count when UNDER_LICENSED', () => {
      fc.assert(
        fc.property(underLicensedScenarioArb, ({ entitlements, installations }) => {
          const overUnderCount = calculateOverUnderCount(entitlements, installations);
          expect(overUnderCount).toBeLessThan(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When UNDER_LICENSED, compliance percentage <= 100%.
     * Note: Due to rounding to 2 decimal places, very small differences may round to exactly 100%.
     * The percentage is always <= 100% when under-licensed.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have compliance percentage <= 100% when UNDER_LICENSED', () => {
      fc.assert(
        fc.property(underLicensedScenarioArb, ({ entitlements, installations }) => {
          const percentage = calculateCompliancePercentage(entitlements, installations);
          expect(percentage).toBeLessThanOrEqual(100);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: When significantly UNDER_LICENSED, compliance percentage < 100%.
     * Using a minimum deficit that ensures the percentage difference is visible after rounding.
     *
     * **Validates: Requirements 4.1**
     */
    it('should have compliance percentage < 100% when significantly UNDER_LICENSED', () => {
      fc.assert(
        fc.property(
          // Ensure deficit is at least 1% of installations to avoid rounding issues
          fc.tuple(
            fc.integer({ min: 1, max: 10000 }),
            fc.integer({ min: 1, max: 100 })
          ).map(([entitlements, deficitPercent]) => ({
            entitlements,
            installations: entitlements + Math.max(1, Math.ceil(entitlements * deficitPercent / 100)),
          })),
          ({ entitlements, installations }) => {
            const percentage = calculateCompliancePercentage(entitlements, installations);
            expect(percentage).toBeLessThan(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Over/Under Count Calculation', () => {
    /**
     * Property: Over/under count equals entitlements minus installations.
     *
     * **Validates: Requirements 4.1**
     */
    it('should calculate over/under count as entitlements minus installations', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          const overUnderCount = calculateOverUnderCount(entitlements, installations);
          expect(overUnderCount).toBe(entitlements - installations);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Over/under count sign matches compliance status.
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should have over/under count sign consistent with compliance status', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          const status = calculateComplianceStatus(entitlements, installations);
          const overUnderCount = calculateOverUnderCount(entitlements, installations);

          if (status === 'COMPLIANT') {
            expect(overUnderCount).toBe(0);
          } else if (status === 'OVER_LICENSED') {
            expect(overUnderCount).toBeGreaterThan(0);
          } else if (status === 'UNDER_LICENSED') {
            expect(overUnderCount).toBeLessThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Compliance Percentage Calculation', () => {
    /**
     * Property: Compliance percentage equals (entitlements / installations) * 100
     * when installations > 0.
     *
     * **Validates: Requirements 4.1**
     */
    it('should calculate compliance percentage as (entitlements / installations) * 100', () => {
      fc.assert(
        fc.property(
          fc.record({
            entitlements: nonNegativeIntArb,
            installations: positiveIntArb,
          }),
          ({ entitlements, installations }) => {
            const percentage = calculateCompliancePercentage(entitlements, installations);
            const expected = Math.round((entitlements / installations) * 100 * 100) / 100;
            expect(percentage).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Compliance percentage is 100% when entitlements > 0 and installations = 0.
     *
     * **Validates: Requirements 4.1**
     */
    it('should return 100% when entitlements > 0 and installations = 0', () => {
      fc.assert(
        fc.property(positiveIntArb, (entitlements) => {
          const percentage = calculateCompliancePercentage(entitlements, 0);
          expect(percentage).toBe(100);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Compliance percentage is 0% when both entitlements and installations are 0.
     *
     * **Validates: Requirements 4.1**
     */
    it('should return 0% when both entitlements and installations are 0', () => {
      const percentage = calculateCompliancePercentage(0, 0);
      expect(percentage).toBe(0);
    });

    /**
     * Property: Compliance percentage is 0% when entitlements = 0 and installations > 0.
     *
     * **Validates: Requirements 4.1**
     */
    it('should return 0% when entitlements = 0 and installations > 0', () => {
      fc.assert(
        fc.property(positiveIntArb, (installations) => {
          const percentage = calculateCompliancePercentage(0, installations);
          expect(percentage).toBe(0);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Compliance percentage is always non-negative.
     *
     * **Validates: Requirements 4.1**
     */
    it('should always return non-negative compliance percentage', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          const percentage = calculateCompliancePercentage(entitlements, installations);
          expect(percentage).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Deterministic Results', () => {
    /**
     * Property: Same inputs always produce same outputs.
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should produce deterministic results for same inputs', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          // Calculate twice
          const status1 = calculateComplianceStatus(entitlements, installations);
          const status2 = calculateComplianceStatus(entitlements, installations);

          const overUnder1 = calculateOverUnderCount(entitlements, installations);
          const overUnder2 = calculateOverUnderCount(entitlements, installations);

          const percentage1 = calculateCompliancePercentage(entitlements, installations);
          const percentage2 = calculateCompliancePercentage(entitlements, installations);

          // Results should be identical
          expect(status1).toBe(status2);
          expect(overUnder1).toBe(overUnder2);
          expect(percentage1).toBe(percentage2);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Consistency Between Calculations', () => {
    /**
     * Property: All compliance calculations are consistent with each other.
     * Note: Due to rounding to 2 decimal places, very small differences may round to exactly 100%.
     * Therefore, we use >= 100 for OVER_LICENSED and <= 100 for UNDER_LICENSED.
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should have consistent results across all calculation functions', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          const status = calculateComplianceStatus(entitlements, installations);
          const overUnder = calculateOverUnderCount(entitlements, installations);
          const percentage = calculateCompliancePercentage(entitlements, installations);

          // Verify consistency
          if (status === 'COMPLIANT') {
            expect(overUnder).toBe(0);
            if (installations > 0) {
              expect(percentage).toBe(100);
            }
          } else if (status === 'OVER_LICENSED') {
            expect(overUnder).toBeGreaterThan(0);
            if (installations > 0) {
              // Due to rounding, very small differences may round to exactly 100%
              expect(percentage).toBeGreaterThanOrEqual(100);
            }
          } else if (status === 'UNDER_LICENSED') {
            expect(overUnder).toBeLessThan(0);
            // Due to rounding, very small differences may round to exactly 100%
            expect(percentage).toBeLessThanOrEqual(100);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Zero entitlements with zero installations is COMPLIANT.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return COMPLIANT for zero entitlements and zero installations', () => {
      const status = calculateComplianceStatus(0, 0);
      expect(status).toBe('COMPLIANT');
    });

    /**
     * Property: Zero entitlements with any installations is UNDER_LICENSED.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return UNDER_LICENSED for zero entitlements with any installations', () => {
      fc.assert(
        fc.property(positiveIntArb, (installations) => {
          const status = calculateComplianceStatus(0, installations);
          expect(status).toBe('UNDER_LICENSED');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Any entitlements with zero installations is OVER_LICENSED.
     *
     * **Validates: Requirements 4.2**
     */
    it('should return OVER_LICENSED for any entitlements with zero installations', () => {
      fc.assert(
        fc.property(positiveIntArb, (entitlements) => {
          const status = calculateComplianceStatus(entitlements, 0);
          expect(status).toBe('OVER_LICENSED');
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Large values are handled correctly without overflow.
     *
     * **Validates: Requirements 4.1, 4.2**
     */
    it('should handle large values correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            entitlements: fc.integer({ min: 100_000, max: 1_000_000 }),
            installations: fc.integer({ min: 100_000, max: 1_000_000 }),
          }),
          ({ entitlements, installations }) => {
            const status = calculateComplianceStatus(entitlements, installations);
            const overUnder = calculateOverUnderCount(entitlements, installations);
            const percentage = calculateCompliancePercentage(entitlements, installations);

            // Status should be valid
            expect(['COMPLIANT', 'OVER_LICENSED', 'UNDER_LICENSED']).toContain(status);

            // Over/under should be finite
            expect(Number.isFinite(overUnder)).toBe(true);

            // Percentage should be finite and non-negative
            expect(Number.isFinite(percentage)).toBe(true);
            expect(percentage).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Boundary Conditions', () => {
    /**
     * Property: Difference of 1 correctly determines status.
     *
     * **Validates: Requirements 4.2**
     */
    it('should correctly determine status for difference of 1', () => {
      fc.assert(
        fc.property(nonNegativeIntArb, (base) => {
          // Exactly equal
          expect(calculateComplianceStatus(base, base)).toBe('COMPLIANT');

          // One more entitlement
          expect(calculateComplianceStatus(base + 1, base)).toBe('OVER_LICENSED');

          // One more installation (only if base > 0 to avoid negative)
          if (base > 0) {
            expect(calculateComplianceStatus(base - 1, base)).toBe('UNDER_LICENSED');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Commutative Property (Negation)', () => {
    /**
     * Property: Swapping entitlements and installations negates the over/under count.
     * Note: Using == comparison to handle 0 === -0 edge case (0 == -0 is true).
     *
     * **Validates: Requirements 4.1**
     */
    it('should negate over/under count when swapping entitlements and installations', () => {
      fc.assert(
        fc.property(anyScenarioArb, ({ entitlements, installations }) => {
          const overUnder1 = calculateOverUnderCount(entitlements, installations);
          const overUnder2 = calculateOverUnderCount(installations, entitlements);

          // Handle 0 === -0 edge case: both should be equal when negated
          // eslint-disable-next-line eqeqeq
          expect(overUnder1 == -overUnder2).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
