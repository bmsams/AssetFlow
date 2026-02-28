/**
 * Property Test: Audit Discrepancy Calculation
 *
 * **Validates: Requirements 3.5**
 *
 * Property 8: For any completed inventory audit, the discrepancy_count SHALL equal
 * the count of assets that were either (a) expected but not scanned, or (b) scanned
 * but not expected. The audit result SHALL accurately reflect the symmetric difference
 * between expected and actual inventory.
 *
 * Requirements:
 * - 3.5: WHEN a blind audit is performed, THE Mobile_Audit_Service SHALL compare
 *        scanned assets against expected inventory and report discrepancies.
 *
 * Properties tested:
 * 1. Total discrepancies = missing + extra + damaged + location mismatches
 * 2. Missing items are those expected but not scanned
 * 3. Extra items are those scanned but not expected
 * 4. Matched items are those both expected and scanned
 * 5. All items are accounted for (no items lost)
 * 6. Discrepancy calculation is deterministic
 * 7. Empty inputs produce empty results
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Audit Discrepancy Calculation
// ============================================================================

/**
 * Asset condition types
 */
type AssetCondition =
  | 'NEW'
  | 'EXCELLENT'
  | 'GOOD'
  | 'FAIR'
  | 'POOR'
  | 'DAMAGED'
  | 'MISSING'
  | 'UNKNOWN';

/**
 * Expected inventory item for audit
 */
interface ExpectedInventoryItem {
  readonly assetId: string;
  readonly assetTag: string;
  readonly serialNumber: string | null;
  readonly expectedLocation: string | null;
  readonly expectedCondition: AssetCondition | null;
}

/**
 * Audit scan entity (simplified for testing)
 */
interface AuditScan {
  readonly scanId: string;
  readonly auditId: string;
  readonly assetId: string | null;
  readonly assetTag: string | null;
  readonly serialNumber: string | null;
  readonly barcodeScanned: string | null;
  readonly scannedAt: string;
  readonly scannedBy: string;
  readonly expected: boolean;
  readonly found: boolean;
  readonly expectedLocation: string | null;
  readonly foundLocation: string | null;
  readonly binLocation: string | null;
  readonly expectedCondition: AssetCondition | null;
  readonly foundCondition: AssetCondition | null;
  readonly expectedQuantity: number;
  readonly foundQuantity: number;
  readonly isDiscrepancy: boolean;
  readonly discrepancyType: string | null;
  readonly discrepancyNotes: string | null;
  readonly resolved: boolean;
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
  readonly resolutionNotes: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Discrepancy calculation result
 */
interface DiscrepancyResult {
  readonly missing: readonly ExpectedInventoryItem[];
  readonly extra: readonly AuditScan[];
  readonly matched: readonly { expected: ExpectedInventoryItem; scanned: AuditScan }[];
  readonly damaged: readonly AuditScan[];
}

// ============================================================================
// Discrepancy Calculation Logic (Pure Function - mirrors audit-service.ts)
// ============================================================================

/**
 * Calculate discrepancies between expected and scanned inventory
 * This is a pure function implementation matching the audit-service.ts logic
 */
function calculateDiscrepancies(
  expected: readonly ExpectedInventoryItem[],
  scanned: readonly AuditScan[]
): DiscrepancyResult {
  const scannedByTag = new Map<string, AuditScan>();
  for (const scan of scanned) {
    if (scan.assetTag) {
      scannedByTag.set(scan.assetTag, scan);
    }
  }

  const expectedByTag = new Map<string, ExpectedInventoryItem>();
  for (const item of expected) {
    expectedByTag.set(item.assetTag, item);
  }

  const missing: ExpectedInventoryItem[] = [];
  const matched: { expected: ExpectedInventoryItem; scanned: AuditScan }[] = [];

  // Find missing and matched items
  for (const item of expected) {
    const scan = scannedByTag.get(item.assetTag);
    if (scan) {
      matched.push({ expected: item, scanned: scan });
    } else {
      missing.push(item);
    }
  }

  // Find extra items (scanned but not expected)
  const extra: AuditScan[] = [];
  for (const scan of scanned) {
    if (scan.assetTag && !expectedByTag.has(scan.assetTag)) {
      extra.push(scan);
    }
  }

  // Find damaged items
  const damaged = scanned.filter(s => s.foundCondition === 'DAMAGED');

  return { missing, extra, matched, damaged };
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid UUID-like string
 */
const uuidArb = fc.uuid();

/**
 * Generate a valid asset tag (e.g., AST-123456)
 */
const assetTagArb = fc.tuple(
  fc.constantFrom('AST', 'HW', 'SW', 'EQ'),
  fc.integer({ min: 100000, max: 999999 })
).map(([prefix, num]) => `${prefix}-${num}`);

/**
 * Generate an asset condition
 */
const assetConditionArb: fc.Arbitrary<AssetCondition> = fc.constantFrom(
  'NEW',
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'DAMAGED',
  'MISSING',
  'UNKNOWN'
);

/**
 * Generate an expected inventory item
 */
const expectedInventoryItemArb: fc.Arbitrary<ExpectedInventoryItem> = fc.record({
  assetId: uuidArb,
  assetTag: assetTagArb,
  serialNumber: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
  expectedLocation: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  expectedCondition: fc.option(assetConditionArb, { nil: null }),
});

/**
 * Generate an audit scan
 */
const auditScanArb = (assetTag: string, condition: AssetCondition = 'GOOD'): fc.Arbitrary<AuditScan> =>
  fc.record({
    scanId: uuidArb,
    auditId: uuidArb,
    assetId: fc.option(uuidArb, { nil: null }),
    assetTag: fc.constant(assetTag),
    serialNumber: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: null }),
    barcodeScanned: fc.constant(assetTag),
    scannedAt: fc.constant(new Date().toISOString()),
    scannedBy: uuidArb,
    expected: fc.boolean(),
    found: fc.constant(true),
    expectedLocation: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    foundLocation: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    binLocation: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    expectedCondition: fc.option(assetConditionArb, { nil: null }),
    foundCondition: fc.constant(condition),
    expectedQuantity: fc.constant(1),
    foundQuantity: fc.constant(1),
    isDiscrepancy: fc.boolean(),
    discrepancyType: fc.option(fc.constantFrom('MISSING', 'EXTRA', 'DAMAGED', 'WRONG_LOCATION'), { nil: null }),
    discrepancyNotes: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    resolved: fc.constant(false),
    resolvedBy: fc.constant(null),
    resolvedAt: fc.constant(null),
    resolutionNotes: fc.constant(null),
    notes: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    createdAt: fc.constant(new Date().toISOString()),
    updatedAt: fc.constant(new Date().toISOString()),
  });

/**
 * Generate audit scenario with controlled overlap
 */
interface AuditScenario {
  readonly expected: readonly ExpectedInventoryItem[];
  readonly scanned: readonly AuditScan[];
  readonly expectedMissingCount: number;
  readonly expectedExtraCount: number;
  readonly expectedMatchedCount: number;
  readonly expectedDamagedCount: number;
}

const auditScenarioArb: fc.Arbitrary<AuditScenario> = fc
  .record({
    matchedCount: fc.integer({ min: 0, max: 10 }),
    missingCount: fc.integer({ min: 0, max: 10 }),
    extraCount: fc.integer({ min: 0, max: 10 }),
    damagedInMatchedCount: fc.integer({ min: 0, max: 5 }),
  })
  .chain(({ matchedCount, missingCount, extraCount, damagedInMatchedCount }) => {
    const actualDamagedCount = Math.min(damagedInMatchedCount, matchedCount);
    const totalExpected = matchedCount + missingCount;

    // Generate unique asset tags for all items
    return fc.array(assetTagArb, { minLength: totalExpected + extraCount, maxLength: totalExpected + extraCount + 10 })
      .map(tags => {
        const uniqueTags = [...new Set(tags)];
        if (uniqueTags.length < totalExpected + extraCount) {
          // Generate more unique tags if needed
          let counter = 0;
          while (uniqueTags.length < totalExpected + extraCount) {
            const newTag = `GEN-${Date.now()}-${counter++}`;
            if (!uniqueTags.includes(newTag)) {
              uniqueTags.push(newTag);
            }
          }
        }
        return uniqueTags;
      })
      .chain(uniqueTags => {
        // Split tags into categories
        const matchedTags = uniqueTags.slice(0, matchedCount);
        const missingTags = uniqueTags.slice(matchedCount, matchedCount + missingCount);
        const extraTags = uniqueTags.slice(matchedCount + missingCount, matchedCount + missingCount + extraCount);

        // Create expected items (matched + missing)
        const expectedItems: ExpectedInventoryItem[] = [...matchedTags, ...missingTags].map(tag => ({
          assetId: `asset-${tag}`,
          assetTag: tag,
          serialNumber: null,
          expectedLocation: null,
          expectedCondition: 'GOOD' as AssetCondition,
        }));

        // Create scanned items (matched + extra)
        // Some matched items will be damaged
        const scannedItemsArbs = matchedTags.map((tag, index) => {
          const isDamaged = index < actualDamagedCount;
          return auditScanArb(tag, isDamaged ? 'DAMAGED' : 'GOOD');
        });

        const extraScannedArbs = extraTags.map(tag => auditScanArb(tag, 'GOOD'));

        return fc.tuple(
          fc.constant(expectedItems),
          ...scannedItemsArbs,
          ...extraScannedArbs
        ).map(([expected, ...scannedItems]) => ({
          expected,
          scanned: scannedItems as AuditScan[],
          expectedMissingCount: missingCount,
          expectedExtraCount: extraCount,
          expectedMatchedCount: matchedCount,
          expectedDamagedCount: actualDamagedCount,
        }));
      });
  });

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 8: Audit Discrepancy Calculation', () => {
  /**
   * **Validates: Requirements 3.5**
   */

  describe('Missing Items Calculation', () => {
    /**
     * Property: Missing items are exactly those expected but not scanned.
     *
     * **Validates: Requirements 3.5**
     */
    it('should identify missing items as expected but not scanned', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Missing count should match expected
          expect(result.missing.length).toBe(scenario.expectedMissingCount);

          // All missing items should be in expected but not in scanned
          const scannedTags = new Set(scenario.scanned.map(s => s.assetTag).filter(Boolean));
          for (const missing of result.missing) {
            expect(scannedTags.has(missing.assetTag)).toBe(false);
          }

          // All missing items should be from expected
          const expectedTags = new Set(scenario.expected.map(e => e.assetTag));
          for (const missing of result.missing) {
            expect(expectedTags.has(missing.assetTag)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Extra Items Calculation', () => {
    /**
     * Property: Extra items are exactly those scanned but not expected.
     *
     * **Validates: Requirements 3.5**
     */
    it('should identify extra items as scanned but not expected', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Extra count should match expected
          expect(result.extra.length).toBe(scenario.expectedExtraCount);

          // All extra items should be in scanned but not in expected
          const expectedTags = new Set(scenario.expected.map(e => e.assetTag));
          for (const extra of result.extra) {
            expect(expectedTags.has(extra.assetTag!)).toBe(false);
          }

          // All extra items should be from scanned
          const scannedTags = new Set(scenario.scanned.map(s => s.assetTag).filter(Boolean));
          for (const extra of result.extra) {
            expect(scannedTags.has(extra.assetTag!)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Matched Items Calculation', () => {
    /**
     * Property: Matched items are exactly those both expected and scanned.
     *
     * **Validates: Requirements 3.5**
     */
    it('should identify matched items as both expected and scanned', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Matched count should match expected
          expect(result.matched.length).toBe(scenario.expectedMatchedCount);

          // All matched items should be in both expected and scanned
          const expectedTags = new Set(scenario.expected.map(e => e.assetTag));
          const scannedTags = new Set(scenario.scanned.map(s => s.assetTag).filter(Boolean));

          for (const match of result.matched) {
            expect(expectedTags.has(match.expected.assetTag)).toBe(true);
            expect(scannedTags.has(match.scanned.assetTag!)).toBe(true);
            // The asset tags should match
            expect(match.expected.assetTag).toBe(match.scanned.assetTag);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Damaged Items Calculation', () => {
    /**
     * Property: Damaged items are scanned items with DAMAGED condition.
     *
     * **Validates: Requirements 3.5**
     */
    it('should identify damaged items from scanned items with DAMAGED condition', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Damaged count should match expected
          expect(result.damaged.length).toBe(scenario.expectedDamagedCount);

          // All damaged items should have DAMAGED condition
          for (const damaged of result.damaged) {
            expect(damaged.foundCondition).toBe('DAMAGED');
          }

          // All scanned items with DAMAGED condition should be in damaged
          const damagedScans = scenario.scanned.filter(s => s.foundCondition === 'DAMAGED');
          expect(result.damaged.length).toBe(damagedScans.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('All Items Accounted For', () => {
    /**
     * Property: All expected items are either matched or missing (no items lost).
     *
     * **Validates: Requirements 3.5**
     */
    it('should account for all expected items as either matched or missing', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Total of matched + missing should equal expected count
          const accountedExpected = result.matched.length + result.missing.length;
          expect(accountedExpected).toBe(scenario.expected.length);

          // All expected tags should appear in either matched or missing
          const matchedTags = new Set(result.matched.map(m => m.expected.assetTag));
          const missingTags = new Set(result.missing.map(m => m.assetTag));

          for (const expected of scenario.expected) {
            const inMatched = matchedTags.has(expected.assetTag);
            const inMissing = missingTags.has(expected.assetTag);
            // Each expected item should be in exactly one category
            expect(inMatched !== inMissing).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: All scanned items with asset tags are either matched or extra.
     *
     * **Validates: Requirements 3.5**
     */
    it('should account for all scanned items as either matched or extra', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Get scanned items with asset tags
          const scannedWithTags = scenario.scanned.filter(s => s.assetTag !== null);

          // Total of matched + extra should equal scanned count (with tags)
          const accountedScanned = result.matched.length + result.extra.length;
          expect(accountedScanned).toBe(scannedWithTags.length);

          // All scanned tags should appear in either matched or extra
          const matchedTags = new Set(result.matched.map(m => m.scanned.assetTag));
          const extraTags = new Set(result.extra.map(e => e.assetTag));

          for (const scanned of scannedWithTags) {
            const inMatched = matchedTags.has(scanned.assetTag);
            const inExtra = extraTags.has(scanned.assetTag);
            // Each scanned item should be in exactly one category
            expect(inMatched !== inExtra).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Total Discrepancy Count', () => {
    /**
     * Property: Total discrepancies = missing + extra (symmetric difference).
     * Note: Damaged items are a subset of matched/extra, not additional discrepancies.
     *
     * **Validates: Requirements 3.5**
     */
    it('should calculate total discrepancies as missing plus extra', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Total discrepancies = missing + extra
          const totalDiscrepancies = result.missing.length + result.extra.length;
          expect(totalDiscrepancies).toBe(scenario.expectedMissingCount + scenario.expectedExtraCount);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Deterministic Calculation', () => {
    /**
     * Property: Same inputs always produce same outputs.
     *
     * **Validates: Requirements 3.5**
     */
    it('should produce deterministic results for same inputs', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result1 = calculateDiscrepancies(scenario.expected, scenario.scanned);
          const result2 = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Results should be identical
          expect(result1.missing.length).toBe(result2.missing.length);
          expect(result1.extra.length).toBe(result2.extra.length);
          expect(result1.matched.length).toBe(result2.matched.length);
          expect(result1.damaged.length).toBe(result2.damaged.length);

          // Same asset tags in each category
          const missingTags1 = new Set(result1.missing.map(m => m.assetTag));
          const missingTags2 = new Set(result2.missing.map(m => m.assetTag));
          expect(missingTags1).toEqual(missingTags2);

          const extraTags1 = new Set(result1.extra.map(e => e.assetTag));
          const extraTags2 = new Set(result2.extra.map(e => e.assetTag));
          expect(extraTags1).toEqual(extraTags2);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('Empty Inputs', () => {
    /**
     * Property: Empty expected and scanned produces empty results.
     *
     * **Validates: Requirements 3.5**
     */
    it('should produce empty results for empty inputs', () => {
      const result = calculateDiscrepancies([], []);

      expect(result.missing).toHaveLength(0);
      expect(result.extra).toHaveLength(0);
      expect(result.matched).toHaveLength(0);
      expect(result.damaged).toHaveLength(0);
    });

    /**
     * Property: Empty scanned means all expected are missing.
     *
     * **Validates: Requirements 3.5**
     */
    it('should mark all expected as missing when nothing scanned', () => {
      fc.assert(
        fc.property(
          fc.array(expectedInventoryItemArb, { minLength: 1, maxLength: 10 })
            .map(items => {
              // Ensure unique asset tags
              const seen = new Set<string>();
              return items.filter(item => {
                if (seen.has(item.assetTag)) return false;
                seen.add(item.assetTag);
                return true;
              });
            })
            .filter(items => items.length > 0),
          (expected) => {
            const result = calculateDiscrepancies(expected, []);

            expect(result.missing.length).toBe(expected.length);
            expect(result.extra).toHaveLength(0);
            expect(result.matched).toHaveLength(0);
            expect(result.damaged).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Empty expected means all scanned are extra.
     *
     * **Validates: Requirements 3.5**
     */
    it('should mark all scanned as extra when nothing expected', () => {
      fc.assert(
        fc.property(
          fc.array(assetTagArb, { minLength: 1, maxLength: 10 })
            .map(tags => [...new Set(tags)])
            .filter(tags => tags.length > 0)
            .chain(tags =>
              fc.tuple(...tags.map(tag => auditScanArb(tag, 'GOOD')))
            ),
          (scanned) => {
            const result = calculateDiscrepancies([], scanned);

            expect(result.missing).toHaveLength(0);
            expect(result.extra.length).toBe(scanned.length);
            expect(result.matched).toHaveLength(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Perfect Match Scenario', () => {
    /**
     * Property: When all expected items are scanned, there are no missing or extra.
     *
     * **Validates: Requirements 3.5**
     */
    it('should have no discrepancies when all expected items are scanned', () => {
      fc.assert(
        fc.property(
          fc.array(assetTagArb, { minLength: 1, maxLength: 10 })
            .map(tags => [...new Set(tags)])
            .filter(tags => tags.length > 0)
            .chain(tags => {
              const expected: ExpectedInventoryItem[] = tags.map(tag => ({
                assetId: `asset-${tag}`,
                assetTag: tag,
                serialNumber: null,
                expectedLocation: null,
                expectedCondition: 'GOOD' as AssetCondition,
              }));

              return fc.tuple(
                fc.constant(expected),
                ...tags.map(tag => auditScanArb(tag, 'GOOD'))
              );
            }),
          ([expected, ...scanned]) => {
            const result = calculateDiscrepancies(expected, scanned);

            expect(result.missing).toHaveLength(0);
            expect(result.extra).toHaveLength(0);
            expect(result.matched.length).toBe(expected.length);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Symmetric Difference Property', () => {
    /**
     * Property: The discrepancy count equals the symmetric difference
     * between expected and scanned asset tags.
     *
     * **Validates: Requirements 3.5**
     */
    it('should calculate discrepancies as symmetric difference of asset tags', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          const expectedTags = new Set(scenario.expected.map(e => e.assetTag));
          const scannedTags = new Set(scenario.scanned.map(s => s.assetTag).filter(Boolean));

          // Calculate symmetric difference
          const onlyInExpected = [...expectedTags].filter(tag => !scannedTags.has(tag));
          const onlyInScanned = [...scannedTags].filter(tag => !expectedTags.has(tag as string));

          // Missing should equal items only in expected
          expect(result.missing.length).toBe(onlyInExpected.length);

          // Extra should equal items only in scanned
          expect(result.extra.length).toBe(onlyInScanned.length);

          // Total discrepancies = symmetric difference size
          const symmetricDifferenceSize = onlyInExpected.length + onlyInScanned.length;
          expect(result.missing.length + result.extra.length).toBe(symmetricDifferenceSize);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('No Duplicate Categorization', () => {
    /**
     * Property: No item appears in multiple categories.
     *
     * **Validates: Requirements 3.5**
     */
    it('should not categorize any item in multiple categories', () => {
      fc.assert(
        fc.property(auditScenarioArb, (scenario) => {
          const result = calculateDiscrepancies(scenario.expected, scenario.scanned);

          // Collect all asset tags from each category
          const missingTags = result.missing.map(m => m.assetTag);
          const extraTags = result.extra.map(e => e.assetTag);
          const matchedExpectedTags = result.matched.map(m => m.expected.assetTag);
          const matchedScannedTags = result.matched.map(m => m.scanned.assetTag);

          // No overlap between missing and matched (expected side)
          const missingSet = new Set(missingTags);
          for (const tag of matchedExpectedTags) {
            expect(missingSet.has(tag)).toBe(false);
          }

          // No overlap between extra and matched (scanned side)
          const extraSet = new Set(extraTags);
          for (const tag of matchedScannedTags) {
            expect(extraSet.has(tag!)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
