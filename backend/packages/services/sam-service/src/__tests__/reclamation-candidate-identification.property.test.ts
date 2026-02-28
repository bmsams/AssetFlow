/**
 * Property Test: Reclamation Candidate Identification
 *
 * **Validates: Requirements 4.6**
 *
 * Property 11: For any software installation where (current_date - last_used_date) > reclamation_threshold_days
 * AND usageMinutes30Day <= minUsageMinutes30Day, the installation SHALL be identified as a reclamation candidate.
 * The set of candidates returned SHALL exactly match all installations meeting the configured inactivity threshold.
 *
 * Requirements:
 * - 4.6: THE Reclamation_Service SHALL identify software installations not used within configurable time periods
 *
 * Properties tested:
 * 1. Installations meeting threshold criteria are identified as candidates
 * 2. Installations NOT meeting threshold criteria are NOT identified
 * 3. Identification is deterministic - same inputs produce same outputs
 * 4. Candidates are not duplicated when multiple rules match the same installation
 * 5. All matching installations are identified (completeness)
 * 6. No non-matching installations are identified (soundness)
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Testing
// ============================================================================

/**
 * Simplified installation for testing reclamation logic
 */
interface TestInstallation {
  readonly installationId: string;
  readonly softwareProductId: string;
  readonly productName: string;
  readonly publisher: string;
  readonly productCategory: string | null;
  readonly lastUsedDate: Date | null;
  readonly usageMinutes30Day: number;
  readonly daysSinceLastUse: number;
}

/**
 * Simplified reclamation rule for testing
 */
interface TestReclamationRule {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly softwareProductId: string | null;
  readonly publisher: string | null;
  readonly productCategory: string | null;
  readonly daysSinceLastUse: number;
  readonly minUsageMinutes30Day: number;
  readonly priority: number;
}


/**
 * Result of candidate identification
 */
interface IdentificationResult {
  readonly installationId: string;
  readonly matchedRuleId: string;
  readonly daysSinceLastUse: number;
  readonly usageMinutes30Day: number;
}

// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Check if an installation matches a specific rule's criteria
 * This is the core logic extracted for property testing
 */
function installationMatchesRule(
  installation: TestInstallation,
  rule: TestReclamationRule
): boolean {
  // Check days since last use threshold
  const meetsInactivityThreshold = installation.daysSinceLastUse >= rule.daysSinceLastUse;

  // Check usage minutes threshold
  const meetUsageThreshold = installation.usageMinutes30Day <= rule.minUsageMinutes30Day;

  // Check product-specific filters
  const matchesProductFilter =
    rule.softwareProductId === null ||
    rule.softwareProductId === installation.softwareProductId;

  const matchesPublisherFilter =
    rule.publisher === null ||
    rule.publisher.toUpperCase() === installation.publisher.toUpperCase();

  const matchesCategoryFilter =
    rule.productCategory === null ||
    rule.productCategory === installation.productCategory;

  return (
    meetsInactivityThreshold &&
    meetUsageThreshold &&
    matchesProductFilter &&
    matchesPublisherFilter &&
    matchesCategoryFilter
  );
}

/**
 * Identify reclamation candidates from a list of installations using given rules
 * Returns unique candidates (no duplicates even if multiple rules match)
 */
function identifyReclamationCandidates(
  installations: TestInstallation[],
  rules: TestReclamationRule[]
): IdentificationResult[] {
  const candidates: IdentificationResult[] = [];
  const processedInstallationIds = new Set<string>();

  // Sort rules by priority (lower number = higher priority)
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    for (const installation of installations) {
      // Skip if already processed by a higher priority rule
      if (processedInstallationIds.has(installation.installationId)) {
        continue;
      }

      if (installationMatchesRule(installation, rule)) {
        candidates.push({
          installationId: installation.installationId,
          matchedRuleId: rule.ruleId,
          daysSinceLastUse: installation.daysSinceLastUse,
          usageMinutes30Day: installation.usageMinutes30Day,
        });
        processedInstallationIds.add(installation.installationId);
      }
    }
  }

  return candidates;
}


// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate a valid UUID-like string
 */
const uuidArb = fc.uuid();

/**
 * Generate a software publisher name
 */
const publisherArb = fc.constantFrom(
  'Microsoft',
  'Adobe',
  'Oracle',
  'Salesforce',
  'SAP',
  'Autodesk',
  'VMware',
  'Citrix'
);

/**
 * Generate a product category
 */
const productCategoryArb = fc.constantFrom(
  'PRODUCTIVITY',
  'DEVELOPMENT',
  'DATABASE',
  'SECURITY',
  'COLLABORATION',
  'DESIGN',
  'VIRTUALIZATION',
  null
);

/**
 * Generate days since last use (0 to 365 days)
 */
const daysSinceLastUseArb = fc.integer({ min: 0, max: 365 });

/**
 * Generate usage minutes in 30 days (0 to 10000 minutes)
 */
const usageMinutes30DayArb = fc.integer({ min: 0, max: 10000 });

/**
 * Generate a threshold for days since last use (typically 30-180 days)
 */
const thresholdDaysArb = fc.integer({ min: 1, max: 180 });

/**
 * Generate a threshold for minimum usage minutes (typically 0-60 minutes)
 */
const thresholdUsageMinutesArb = fc.integer({ min: 0, max: 120 });

/**
 * Generate a rule priority (1-10)
 */
const priorityArb = fc.integer({ min: 1, max: 10 });

/**
 * Generate a test installation
 */
const installationArb = fc.record({
  installationId: uuidArb,
  softwareProductId: uuidArb,
  productName: fc.string({ minLength: 1, maxLength: 50 }),
  publisher: publisherArb,
  productCategory: productCategoryArb,
  lastUsedDate: fc.option(fc.date(), { nil: null }),
  usageMinutes30Day: usageMinutes30DayArb,
  daysSinceLastUse: daysSinceLastUseArb,
});

/**
 * Generate a test reclamation rule (with optional filters)
 * Used for tests that need rules with product/publisher/category filters
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ruleWithFiltersArb = fc.record({
  ruleId: uuidArb,
  ruleName: fc.string({ minLength: 1, maxLength: 50 }),
  softwareProductId: fc.option(uuidArb, { nil: null }),
  publisher: fc.option(publisherArb, { nil: null }),
  productCategory: productCategoryArb,
  daysSinceLastUse: thresholdDaysArb,
  minUsageMinutes30Day: thresholdUsageMinutesArb,
  priority: priorityArb,
});
void ruleWithFiltersArb; // Suppress unused variable warning - available for future filtered rule tests


/**
 * Generate a generic rule (no product/publisher/category filters)
 */
const genericRuleArb = fc.record({
  ruleId: uuidArb,
  ruleName: fc.string({ minLength: 1, maxLength: 50 }),
  softwareProductId: fc.constant(null),
  publisher: fc.constant(null),
  productCategory: fc.constant(null),
  daysSinceLastUse: thresholdDaysArb,
  minUsageMinutes30Day: thresholdUsageMinutesArb,
  priority: priorityArb,
});

/**
 * Generate an installation that definitely matches a given rule
 */
function matchingInstallationArb(rule: TestReclamationRule): fc.Arbitrary<TestInstallation> {
  return fc.record({
    installationId: uuidArb,
    softwareProductId: rule.softwareProductId
      ? fc.constant(rule.softwareProductId)
      : uuidArb,
    productName: fc.string({ minLength: 1, maxLength: 50 }),
    publisher: rule.publisher ? fc.constant(rule.publisher) : publisherArb,
    productCategory: rule.productCategory
      ? fc.constant(rule.productCategory)
      : productCategoryArb,
    lastUsedDate: fc.option(fc.date(), { nil: null }),
    // Ensure days since last use meets or exceeds threshold
    usageMinutes30Day: fc.integer({ min: 0, max: rule.minUsageMinutes30Day }),
    daysSinceLastUse: fc.integer({ min: rule.daysSinceLastUse, max: 365 }),
  });
}

/**
 * Generate an installation that definitely does NOT match a given rule
 * (either too recent or too much usage)
 */
function nonMatchingInstallationArb(rule: TestReclamationRule): fc.Arbitrary<TestInstallation> {
  return fc.oneof(
    // Too recent (days since last use below threshold)
    fc.record({
      installationId: uuidArb,
      softwareProductId: rule.softwareProductId
        ? fc.constant(rule.softwareProductId)
        : uuidArb,
      productName: fc.string({ minLength: 1, maxLength: 50 }),
      publisher: rule.publisher ? fc.constant(rule.publisher) : publisherArb,
      productCategory: rule.productCategory
        ? fc.constant(rule.productCategory)
        : productCategoryArb,
      lastUsedDate: fc.option(fc.date(), { nil: null }),
      usageMinutes30Day: usageMinutes30DayArb,
      // Days since last use is below threshold
      daysSinceLastUse: fc.integer({ min: 0, max: Math.max(0, rule.daysSinceLastUse - 1) }),
    }),
    // Too much usage (usage minutes above threshold)
    fc.record({
      installationId: uuidArb,
      softwareProductId: rule.softwareProductId
        ? fc.constant(rule.softwareProductId)
        : uuidArb,
      productName: fc.string({ minLength: 1, maxLength: 50 }),
      publisher: rule.publisher ? fc.constant(rule.publisher) : publisherArb,
      productCategory: rule.productCategory
        ? fc.constant(rule.productCategory)
        : productCategoryArb,
      lastUsedDate: fc.option(fc.date(), { nil: null }),
      // Usage minutes exceeds threshold
      usageMinutes30Day: fc.integer({ min: rule.minUsageMinutes30Day + 1, max: 10000 }),
      daysSinceLastUse: daysSinceLastUseArb,
    })
  );
}


// ============================================================================
// Property Tests
// ============================================================================

describe('Property 11: Reclamation Candidate Identification', () => {
  /**
   * **Validates: Requirements 4.6**
   */

  describe('Threshold-Based Identification', () => {
    /**
     * Property: Installations with daysSinceLastUse >= threshold AND
     * usageMinutes30Day <= minUsageMinutes30Day should be identified as candidates.
     *
     * **Validates: Requirements 4.6**
     */
    it('should identify installations meeting both inactivity and usage thresholds', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(fc.constant(rule), matchingInstallationArb(rule))
          ),
          ([rule, installation]) => {
            const candidates = identifyReclamationCandidates([installation], [rule]);

            expect(candidates.length).toBe(1);
            expect(candidates[0]!.installationId).toBe(installation.installationId);
            expect(candidates[0]!.matchedRuleId).toBe(rule.ruleId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Installations NOT meeting threshold criteria should NOT be identified.
     *
     * **Validates: Requirements 4.6**
     */
    it('should NOT identify installations that do not meet threshold criteria', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(fc.constant(rule), nonMatchingInstallationArb(rule))
          ),
          ([rule, installation]) => {
            const candidates = identifyReclamationCandidates([installation], [rule]);

            expect(candidates.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Boundary condition - installation exactly at threshold should be identified.
     *
     * **Validates: Requirements 4.6**
     */
    it('should identify installations exactly at the threshold boundary', () => {
      fc.assert(
        fc.property(
          genericRuleArb,
          (rule) => {
            const installation: TestInstallation = {
              installationId: 'test-installation-id',
              softwareProductId: 'test-product-id',
              productName: 'Test Product',
              publisher: 'Microsoft',
              productCategory: 'PRODUCTIVITY',
              lastUsedDate: null,
              // Exactly at thresholds
              usageMinutes30Day: rule.minUsageMinutes30Day,
              daysSinceLastUse: rule.daysSinceLastUse,
            };

            const candidates = identifyReclamationCandidates([installation], [rule]);

            expect(candidates.length).toBe(1);
            expect(candidates[0]!.installationId).toBe(installation.installationId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('No Duplicate Candidates', () => {
    /**
     * Property: When multiple rules match the same installation,
     * only one candidate should be created (matched by highest priority rule).
     *
     * **Validates: Requirements 4.6**
     */
    it('should not create duplicate candidates when multiple rules match', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            // Two generic rules with different priorities
            fc.record({
              ruleId: fc.constant('rule-1'),
              ruleName: fc.constant('Rule 1'),
              softwareProductId: fc.constant(null),
              publisher: fc.constant(null),
              productCategory: fc.constant(null),
              daysSinceLastUse: fc.constant(30),
              minUsageMinutes30Day: fc.constant(60),
              priority: fc.constant(1),
            }),
            fc.record({
              ruleId: fc.constant('rule-2'),
              ruleName: fc.constant('Rule 2'),
              softwareProductId: fc.constant(null),
              publisher: fc.constant(null),
              productCategory: fc.constant(null),
              daysSinceLastUse: fc.constant(30),
              minUsageMinutes30Day: fc.constant(60),
              priority: fc.constant(2),
            })
          ),
          ([rule1, rule2]) => {
            // Installation that matches both rules
            const installation: TestInstallation = {
              installationId: 'test-installation',
              softwareProductId: 'test-product',
              productName: 'Test Product',
              publisher: 'Microsoft',
              productCategory: 'PRODUCTIVITY',
              lastUsedDate: null,
              usageMinutes30Day: 30,
              daysSinceLastUse: 60,
            };

            const candidates = identifyReclamationCandidates([installation], [rule1, rule2]);

            // Should only have one candidate
            expect(candidates.length).toBe(1);
            // Should be matched by the higher priority rule (lower number)
            expect(candidates[0]!.matchedRuleId).toBe('rule-1');
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Each installation appears at most once in the results.
     *
     * **Validates: Requirements 4.6**
     */
    it('should ensure each installation appears at most once in results', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(installationArb, { minLength: 1, maxLength: 20 }),
            fc.array(genericRuleArb, { minLength: 1, maxLength: 5 })
          ),
          ([installations, rules]) => {
            const candidates = identifyReclamationCandidates(installations, rules);

            // Check for duplicates
            const installationIds = candidates.map((c) => c.installationId);
            const uniqueIds = new Set(installationIds);

            expect(installationIds.length).toBe(uniqueIds.size);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Deterministic Identification', () => {
    /**
     * Property: Same inputs always produce the same outputs.
     *
     * **Validates: Requirements 4.6**
     */
    it('should produce deterministic results for same inputs', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(installationArb, { minLength: 0, maxLength: 10 }),
            fc.array(genericRuleArb, { minLength: 1, maxLength: 3 })
          ),
          ([installations, rules]) => {
            // Run identification twice
            const result1 = identifyReclamationCandidates(installations, rules);
            const result2 = identifyReclamationCandidates(installations, rules);

            // Results should be identical
            expect(result1.length).toBe(result2.length);

            for (let i = 0; i < result1.length; i++) {
              expect(result1[i]!.installationId).toBe(result2[i]!.installationId);
              expect(result1[i]!.matchedRuleId).toBe(result2[i]!.matchedRuleId);
              expect(result1[i]!.daysSinceLastUse).toBe(result2[i]!.daysSinceLastUse);
              expect(result1[i]!.usageMinutes30Day).toBe(result2[i]!.usageMinutes30Day);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Order of installations in input should not affect which candidates are identified.
     *
     * **Validates: Requirements 4.6**
     */
    it('should identify same candidates regardless of installation order', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(installationArb, { minLength: 2, maxLength: 10 }),
            fc.array(genericRuleArb, { minLength: 1, maxLength: 3 })
          ),
          ([installations, rules]) => {
            // Shuffle installations
            const shuffled = [...installations].reverse();

            const result1 = identifyReclamationCandidates(installations, rules);
            const result2 = identifyReclamationCandidates(shuffled, rules);

            // Same number of candidates
            expect(result1.length).toBe(result2.length);

            // Same installation IDs (order may differ)
            const ids1 = new Set(result1.map((c) => c.installationId));
            const ids2 = new Set(result2.map((c) => c.installationId));

            expect(ids1).toEqual(ids2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Completeness and Soundness', () => {
    /**
     * Property: All installations meeting criteria are identified (completeness).
     *
     * **Validates: Requirements 4.6**
     */
    it('should identify ALL installations that meet the criteria', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(
              fc.constant(rule),
              fc.array(matchingInstallationArb(rule), { minLength: 1, maxLength: 10 })
            )
          ),
          ([rule, matchingInstallations]) => {
            // Ensure unique installation IDs
            const uniqueInstallations = matchingInstallations.filter(
              (inst, idx, arr) =>
                arr.findIndex((i) => i.installationId === inst.installationId) === idx
            );

            const candidates = identifyReclamationCandidates(uniqueInstallations, [rule]);

            // All matching installations should be identified
            expect(candidates.length).toBe(uniqueInstallations.length);

            const candidateIds = new Set(candidates.map((c) => c.installationId));
            for (const installation of uniqueInstallations) {
              expect(candidateIds.has(installation.installationId)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: No installations that don't meet criteria are identified (soundness).
     *
     * **Validates: Requirements 4.6**
     */
    it('should NOT identify any installations that do not meet criteria', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(
              fc.constant(rule),
              fc.array(nonMatchingInstallationArb(rule), { minLength: 1, maxLength: 10 })
            )
          ),
          ([rule, nonMatchingInstallations]) => {
            const candidates = identifyReclamationCandidates(nonMatchingInstallations, [rule]);

            // No non-matching installations should be identified
            expect(candidates.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Mixed list correctly separates matching from non-matching.
     *
     * **Validates: Requirements 4.6**
     */
    it('should correctly separate matching from non-matching installations', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(
              fc.constant(rule),
              fc.array(matchingInstallationArb(rule), { minLength: 1, maxLength: 5 }),
              fc.array(nonMatchingInstallationArb(rule), { minLength: 1, maxLength: 5 })
            )
          ),
          ([rule, matching, nonMatching]) => {
            // Ensure unique IDs across both lists
            const allInstallations = [...matching, ...nonMatching].filter(
              (inst, idx, arr) =>
                arr.findIndex((i) => i.installationId === inst.installationId) === idx
            );

            const uniqueMatching = matching.filter(
              (inst, idx, arr) =>
                arr.findIndex((i) => i.installationId === inst.installationId) === idx
            );

            const candidates = identifyReclamationCandidates(allInstallations, [rule]);
            const candidateIds = new Set(candidates.map((c) => c.installationId));

            // All matching should be identified
            for (const inst of uniqueMatching) {
              if (installationMatchesRule(inst, rule)) {
                expect(candidateIds.has(inst.installationId)).toBe(true);
              }
            }

            // No non-matching should be identified
            for (const inst of nonMatching) {
              if (!installationMatchesRule(inst, rule)) {
                expect(candidateIds.has(inst.installationId)).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  describe('Rule Priority Handling', () => {
    /**
     * Property: Higher priority rules (lower number) take precedence.
     *
     * **Validates: Requirements 4.6**
     */
    it('should match installations to highest priority rule first', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 1, max: 5 }),
            fc.integer({ min: 6, max: 10 })
          ),
          ([highPriority, lowPriority]) => {
            const highPriorityRule: TestReclamationRule = {
              ruleId: 'high-priority-rule',
              ruleName: 'High Priority',
              softwareProductId: null,
              publisher: null,
              productCategory: null,
              daysSinceLastUse: 30,
              minUsageMinutes30Day: 60,
              priority: highPriority,
            };

            const lowPriorityRule: TestReclamationRule = {
              ruleId: 'low-priority-rule',
              ruleName: 'Low Priority',
              softwareProductId: null,
              publisher: null,
              productCategory: null,
              daysSinceLastUse: 30,
              minUsageMinutes30Day: 60,
              priority: lowPriority,
            };

            const installation: TestInstallation = {
              installationId: 'test-installation',
              softwareProductId: 'test-product',
              productName: 'Test Product',
              publisher: 'Microsoft',
              productCategory: 'PRODUCTIVITY',
              lastUsedDate: null,
              usageMinutes30Day: 30,
              daysSinceLastUse: 60,
            };

            // Test with rules in different orders
            const result1 = identifyReclamationCandidates(
              [installation],
              [highPriorityRule, lowPriorityRule]
            );
            const result2 = identifyReclamationCandidates(
              [installation],
              [lowPriorityRule, highPriorityRule]
            );

            // Both should match to high priority rule
            expect(result1[0]!.matchedRuleId).toBe('high-priority-rule');
            expect(result2[0]!.matchedRuleId).toBe('high-priority-rule');
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  describe('Product/Publisher/Category Filtering', () => {
    /**
     * Property: Rules with product filter only match specific products.
     *
     * **Validates: Requirements 4.6**
     */
    it('should only match installations with matching product ID when filter is set', () => {
      fc.assert(
        fc.property(
          fc.tuple(uuidArb, uuidArb),
          ([targetProductId, otherProductId]) => {
            fc.pre(targetProductId !== otherProductId);

            const rule: TestReclamationRule = {
              ruleId: 'product-specific-rule',
              ruleName: 'Product Specific',
              softwareProductId: targetProductId,
              publisher: null,
              productCategory: null,
              daysSinceLastUse: 30,
              minUsageMinutes30Day: 60,
              priority: 1,
            };

            const matchingInstallation: TestInstallation = {
              installationId: 'matching-installation',
              softwareProductId: targetProductId,
              productName: 'Target Product',
              publisher: 'Microsoft',
              productCategory: 'PRODUCTIVITY',
              lastUsedDate: null,
              usageMinutes30Day: 30,
              daysSinceLastUse: 60,
            };

            const nonMatchingInstallation: TestInstallation = {
              installationId: 'non-matching-installation',
              softwareProductId: otherProductId,
              productName: 'Other Product',
              publisher: 'Microsoft',
              productCategory: 'PRODUCTIVITY',
              lastUsedDate: null,
              usageMinutes30Day: 30,
              daysSinceLastUse: 60,
            };

            const candidates = identifyReclamationCandidates(
              [matchingInstallation, nonMatchingInstallation],
              [rule]
            );

            expect(candidates.length).toBe(1);
            expect(candidates[0]!.installationId).toBe('matching-installation');
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Rules with publisher filter only match specific publishers (case-insensitive).
     *
     * **Validates: Requirements 4.6**
     */
    it('should match publishers case-insensitively', () => {
      const rule: TestReclamationRule = {
        ruleId: 'publisher-rule',
        ruleName: 'Publisher Rule',
        softwareProductId: null,
        publisher: 'Microsoft',
        productCategory: null,
        daysSinceLastUse: 30,
        minUsageMinutes30Day: 60,
        priority: 1,
      };

      const installations: TestInstallation[] = [
        {
          installationId: 'inst-1',
          softwareProductId: 'prod-1',
          productName: 'Product 1',
          publisher: 'MICROSOFT',
          productCategory: 'PRODUCTIVITY',
          lastUsedDate: null,
          usageMinutes30Day: 30,
          daysSinceLastUse: 60,
        },
        {
          installationId: 'inst-2',
          softwareProductId: 'prod-2',
          productName: 'Product 2',
          publisher: 'microsoft',
          productCategory: 'PRODUCTIVITY',
          lastUsedDate: null,
          usageMinutes30Day: 30,
          daysSinceLastUse: 60,
        },
        {
          installationId: 'inst-3',
          softwareProductId: 'prod-3',
          productName: 'Product 3',
          publisher: 'Adobe',
          productCategory: 'PRODUCTIVITY',
          lastUsedDate: null,
          usageMinutes30Day: 30,
          daysSinceLastUse: 60,
        },
      ];

      const candidates = identifyReclamationCandidates(installations, [rule]);

      expect(candidates.length).toBe(2);
      const ids = candidates.map((c) => c.installationId);
      expect(ids).toContain('inst-1');
      expect(ids).toContain('inst-2');
      expect(ids).not.toContain('inst-3');
    });
  });


  describe('Edge Cases', () => {
    /**
     * Property: Empty installations list returns empty candidates.
     *
     * **Validates: Requirements 4.6**
     */
    it('should return empty candidates for empty installations list', () => {
      fc.assert(
        fc.property(
          fc.array(genericRuleArb, { minLength: 1, maxLength: 5 }),
          (rules) => {
            const candidates = identifyReclamationCandidates([], rules);
            expect(candidates.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Empty rules list returns empty candidates.
     *
     * **Validates: Requirements 4.6**
     */
    it('should return empty candidates for empty rules list', () => {
      fc.assert(
        fc.property(
          fc.array(installationArb, { minLength: 1, maxLength: 10 }),
          (installations) => {
            const candidates = identifyReclamationCandidates(installations, []);
            expect(candidates.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Zero threshold days means all installations with any inactivity match.
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle zero threshold days correctly', () => {
      const rule: TestReclamationRule = {
        ruleId: 'zero-threshold-rule',
        ruleName: 'Zero Threshold',
        softwareProductId: null,
        publisher: null,
        productCategory: null,
        daysSinceLastUse: 0,
        minUsageMinutes30Day: 10000, // High threshold to not filter by usage
        priority: 1,
      };

      fc.assert(
        fc.property(
          fc.array(installationArb, { minLength: 1, maxLength: 10 }),
          (installations) => {
            // Ensure unique installation IDs
            const uniqueInstallations = installations.filter(
              (inst, idx, arr) =>
                arr.findIndex((i) => i.installationId === inst.installationId) === idx
            );

            const candidates = identifyReclamationCandidates(uniqueInstallations, [rule]);

            // All installations with daysSinceLastUse >= 0 and usage <= 10000 should match
            const expectedMatches = uniqueInstallations.filter(
              (inst) => inst.daysSinceLastUse >= 0 && inst.usageMinutes30Day <= 10000
            );

            expect(candidates.length).toBe(expectedMatches.length);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Very high threshold means few or no installations match.
     *
     * **Validates: Requirements 4.6**
     */
    it('should handle very high threshold correctly', () => {
      const rule: TestReclamationRule = {
        ruleId: 'high-threshold-rule',
        ruleName: 'High Threshold',
        softwareProductId: null,
        publisher: null,
        productCategory: null,
        daysSinceLastUse: 9999,
        minUsageMinutes30Day: 0,
        priority: 1,
      };

      fc.assert(
        fc.property(
          fc.array(installationArb, { minLength: 1, maxLength: 10 }),
          (installations) => {
            const candidates = identifyReclamationCandidates(installations, [rule]);

            // Only installations with daysSinceLastUse >= 9999 should match
            // Given our generator max is 365, none should match
            expect(candidates.length).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });


  describe('Candidate Data Integrity', () => {
    /**
     * Property: Candidate data accurately reflects installation data.
     *
     * **Validates: Requirements 4.6**
     */
    it('should preserve installation data in candidate results', () => {
      fc.assert(
        fc.property(
          genericRuleArb.chain((rule) =>
            fc.tuple(fc.constant(rule), matchingInstallationArb(rule))
          ),
          ([rule, installation]) => {
            const candidates = identifyReclamationCandidates([installation], [rule]);

            expect(candidates.length).toBe(1);
            expect(candidates[0]!.daysSinceLastUse).toBe(installation.daysSinceLastUse);
            expect(candidates[0]!.usageMinutes30Day).toBe(installation.usageMinutes30Day);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Logical Consistency', () => {
    /**
     * Property: If an installation matches a rule, it must meet both thresholds.
     *
     * **Validates: Requirements 4.6**
     */
    it('should only identify candidates meeting BOTH thresholds', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(installationArb, { minLength: 1, maxLength: 20 }),
            fc.array(genericRuleArb, { minLength: 1, maxLength: 5 })
          ),
          ([installations, rules]) => {
            const candidates = identifyReclamationCandidates(installations, rules);

            for (const candidate of candidates) {
              const installation = installations.find(
                (i) => i.installationId === candidate.installationId
              );
              expect(installation).toBeDefined();

              // Find the rule that matched
              const matchedRule = rules.find((r) => r.ruleId === candidate.matchedRuleId);
              expect(matchedRule).toBeDefined();

              if (installation && matchedRule) {
                // Verify both thresholds are met
                expect(installation.daysSinceLastUse).toBeGreaterThanOrEqual(
                  matchedRule.daysSinceLastUse
                );
                expect(installation.usageMinutes30Day).toBeLessThanOrEqual(
                  matchedRule.minUsageMinutes30Day
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
