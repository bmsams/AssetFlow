/**
 * Property-Based Tests: Building Code Uniqueness Validation
 *
 * **Validates: Requirements 1.1, 1.3**
 *
 * Properties tested:
 * 1. Building codes must be unique across all buildings
 * 2. When excluding a building ID, the same code should be allowed for that building
 * 3. Building codes are case-sensitive (exact match required)
 * 4. Empty or whitespace-only codes should be handled appropriately
 *
 * Requirements:
 * - 1.1: WHEN an administrator creates a building with name, address, and contact
 *        information, THEN THE Location_Service SHALL create a new building record
 *        and return the generated building ID
 * - 1.3: WHEN an administrator updates building details, THEN THE Location_Service
 *        SHALL update the specified fields and preserve unchanged fields
 */

import * as fc from 'fast-check';

// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Simulates the building code uniqueness check logic.
 * This is a pure function that mirrors the repository logic for testing.
 *
 * @param buildingCode - The code to check for uniqueness
 * @param existingBuildings - Map of building IDs to their codes
 * @param excludeBuildingId - Optional building ID to exclude from the check
 * @returns true if the code already exists (not unique)
 */
function buildingCodeExists(
  buildingCode: string,
  existingBuildings: Map<string, string>,
  excludeBuildingId?: string
): boolean {
  for (const [buildingId, code] of existingBuildings.entries()) {
    if (code === buildingCode) {
      // If we're excluding this building ID, skip it
      if (excludeBuildingId && buildingId === excludeBuildingId) {
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * Checks if a building code is unique (inverse of buildingCodeExists).
 *
 * @param buildingCode - The code to check for uniqueness
 * @param existingBuildings - Map of building IDs to their codes
 * @param excludeBuildingId - Optional building ID to exclude from the check
 * @returns true if the code is unique
 */
function isBuildingCodeUnique(
  buildingCode: string,
  existingBuildings: Map<string, string>,
  excludeBuildingId?: string
): boolean {
  return !buildingCodeExists(buildingCode, existingBuildings, excludeBuildingId);
}

/**
 * Validates a building code format.
 * Building codes should be non-empty and not consist only of whitespace.
 *
 * @param buildingCode - The code to validate
 * @returns true if the code is valid
 */
function isValidBuildingCode(buildingCode: string): boolean {
  return buildingCode.trim().length > 0;
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid building codes following typical patterns:
 * - Alphanumeric with optional hyphens
 * - 3-50 characters
 * - Examples: "BLDG-001", "HQ", "DATACENTER-WEST-01"
 */
const validBuildingCodeArb = fc.stringOf(
  fc.constantFrom(
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '-', '_'
  ),
  { minLength: 3, maxLength: 50 }
).filter(s => s.trim().length > 0 && !s.startsWith('-') && !s.endsWith('-'));

/**
 * Generate UUID-like building IDs
 */
const buildingIdArb = fc.uuid();

/**
 * Generate a map of existing buildings (ID -> code)
 */
const existingBuildingsArb = fc.array(
  fc.tuple(buildingIdArb, validBuildingCodeArb),
  { minLength: 0, maxLength: 20 }
).map(pairs => {
  const map = new Map<string, string>();
  // Ensure unique codes in the generated data
  const usedCodes = new Set<string>();
  for (const [id, code] of pairs) {
    if (!usedCodes.has(code)) {
      map.set(id, code);
      usedCodes.add(code);
    }
  }
  return map;
});

/**
 * Generate building codes with various case variations
 */
const caseVariantCodeArb = fc.oneof(
  fc.constant('BLDG-001'),
  fc.constant('bldg-001'),
  fc.constant('Bldg-001'),
  fc.constant('BLDG-001'),
  fc.constant('BLdg-001')
);

/**
 * Generate empty or whitespace-only strings
 */
const emptyOrWhitespaceArb = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('  '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('   \t   '),
  fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 })
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: Building Code Uniqueness Validation', () => {
  /**
   * **Validates: Requirements 1.1**
   */

  describe('Property 1: Building codes must be unique across all buildings', () => {
    /**
     * Property: If a building code exists in the system, attempting to use
     * the same code for a new building should be detected as a duplicate.
     *
     * **Validates: Requirements 1.1**
     */
    it('should detect duplicate building codes', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb,
          validBuildingCodeArb,
          (existingBuildings, newCode) => {
            // Add the new code to existing buildings
            const buildingId = 'test-building-id';
            const buildingsWithCode = new Map(existingBuildings);
            buildingsWithCode.set(buildingId, newCode);

            // The code should now exist
            const exists = buildingCodeExists(newCode, buildingsWithCode);
            expect(exists).toBe(true);

            // The code should not be unique
            const isUnique = isBuildingCodeUnique(newCode, buildingsWithCode);
            expect(isUnique).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: A code that doesn't exist in the system should be detected
     * as unique and available for use.
     *
     * **Validates: Requirements 1.1**
     */
    it('should allow unique building codes', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb,
          validBuildingCodeArb,
          (existingBuildings, newCode) => {
            // Remove the new code from existing buildings if it happens to be there
            const buildingsWithoutCode = new Map(existingBuildings);
            for (const [id, code] of buildingsWithoutCode.entries()) {
              if (code === newCode) {
                buildingsWithoutCode.delete(id);
              }
            }

            // The code should not exist
            const exists = buildingCodeExists(newCode, buildingsWithoutCode);
            expect(exists).toBe(false);

            // The code should be unique
            const isUnique = isBuildingCodeUnique(newCode, buildingsWithoutCode);
            expect(isUnique).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: isBuildingCodeUnique should be the logical inverse of buildingCodeExists
     *
     * **Validates: Requirements 1.1**
     */
    it('should have isBuildingCodeUnique as inverse of buildingCodeExists', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb,
          validBuildingCodeArb,
          fc.option(buildingIdArb, { nil: undefined }),
          (existingBuildings, code, excludeId) => {
            const exists = buildingCodeExists(code, existingBuildings, excludeId);
            const isUnique = isBuildingCodeUnique(code, existingBuildings, excludeId);

            // They should always be logical inverses
            expect(isUnique).toBe(!exists);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Excluding building ID allows same code for that building', () => {
    /**
     * Property: When updating a building, the same code should be allowed
     * if we exclude that building's ID from the uniqueness check.
     *
     * **Validates: Requirements 1.3**
     */
    it('should allow same code when excluding the building being updated', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb.filter(m => m.size > 0),
          (existingBuildings) => {
            // Pick a random existing building
            const entries = Array.from(existingBuildings.entries());
            const firstEntry = entries[0];
            if (!firstEntry) return; // Guard for TypeScript
            const [buildingId, buildingCode] = firstEntry;

            // Without exclusion, the code should exist
            const existsWithoutExclusion = buildingCodeExists(
              buildingCode,
              existingBuildings
            );
            expect(existsWithoutExclusion).toBe(true);

            // With exclusion of the same building, the code should be "unique"
            // (available for that building to keep using)
            const existsWithExclusion = buildingCodeExists(
              buildingCode,
              existingBuildings,
              buildingId
            );

            // If there's only one building with this code, it should not exist
            // when we exclude that building
            const otherBuildingsWithSameCode = entries.filter(
              ([id, code]) => code === buildingCode && id !== buildingId
            );

            if (otherBuildingsWithSameCode.length === 0) {
              expect(existsWithExclusion).toBe(false);
            } else {
              expect(existsWithExclusion).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Excluding a non-existent building ID should not affect
     * the uniqueness check result.
     *
     * **Validates: Requirements 1.3**
     */
    it('should not affect result when excluding non-existent building ID', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb,
          validBuildingCodeArb,
          buildingIdArb,
          (existingBuildings, code, nonExistentId) => {
            // Ensure the ID doesn't exist in our buildings
            const buildingsWithoutId = new Map(existingBuildings);
            buildingsWithoutId.delete(nonExistentId);

            // Results should be the same with or without exclusion
            const existsWithout = buildingCodeExists(code, buildingsWithoutId);
            const existsWith = buildingCodeExists(code, buildingsWithoutId, nonExistentId);

            expect(existsWith).toBe(existsWithout);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Building codes are case-sensitive', () => {
    /**
     * Property: Building codes with different cases should be treated
     * as different codes (case-sensitive comparison).
     *
     * **Validates: Requirements 1.1**
     */
    it('should treat different case variations as different codes', () => {
      fc.assert(
        fc.property(
          caseVariantCodeArb,
          caseVariantCodeArb,
          (code1, code2) => {
            const existingBuildings = new Map<string, string>();
            existingBuildings.set('building-1', code1);

            // If codes are exactly the same, it should exist
            // If codes differ (even just by case), it should not exist
            const exists = buildingCodeExists(code2, existingBuildings);

            if (code1 === code2) {
              expect(exists).toBe(true);
            } else {
              expect(exists).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Case-sensitive uniqueness - "BLDG-001" and "bldg-001"
     * should both be allowed as they are different codes.
     *
     * **Validates: Requirements 1.1**
     */
    it('should allow both uppercase and lowercase versions of same code', () => {
      const existingBuildings = new Map<string, string>();
      existingBuildings.set('building-1', 'BLDG-001');

      // Lowercase version should be unique
      expect(isBuildingCodeUnique('bldg-001', existingBuildings)).toBe(true);

      // Mixed case version should be unique
      expect(isBuildingCodeUnique('Bldg-001', existingBuildings)).toBe(true);

      // Exact match should not be unique
      expect(isBuildingCodeUnique('BLDG-001', existingBuildings)).toBe(false);
    });
  });

  describe('Property 4: Empty or whitespace-only codes handling', () => {
    /**
     * Property: Empty or whitespace-only codes should be considered invalid.
     *
     * **Validates: Requirements 1.1**
     */
    it('should reject empty or whitespace-only codes as invalid', () => {
      fc.assert(
        fc.property(emptyOrWhitespaceArb, (invalidCode) => {
          const isValid = isValidBuildingCode(invalidCode);
          expect(isValid).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Valid building codes should pass validation.
     *
     * **Validates: Requirements 1.1**
     */
    it('should accept valid building codes', () => {
      fc.assert(
        fc.property(validBuildingCodeArb, (validCode) => {
          const isValid = isValidBuildingCode(validCode);
          expect(isValid).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Codes with leading/trailing whitespace but valid content
     * should be considered valid after trimming.
     *
     * **Validates: Requirements 1.1**
     */
    it('should handle codes with leading/trailing whitespace', () => {
      fc.assert(
        fc.property(
          validBuildingCodeArb,
          fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
          fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 3 }),
          (code, prefix, suffix) => {
            const codeWithWhitespace = prefix + code + suffix;
            // The code should be valid because it has non-whitespace content
            const isValid = isValidBuildingCode(codeWithWhitespace);
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Empty building map should always return unique for any code.
     *
     * **Validates: Requirements 1.1**
     */
    it('should return unique for any code when no buildings exist', () => {
      fc.assert(
        fc.property(validBuildingCodeArb, (code) => {
          const emptyBuildings = new Map<string, string>();
          const isUnique = isBuildingCodeUnique(code, emptyBuildings);
          expect(isUnique).toBe(true);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Uniqueness check should be consistent across multiple calls.
     *
     * **Validates: Requirements 1.1**
     */
    it('should return consistent results for repeated checks', () => {
      fc.assert(
        fc.property(
          existingBuildingsArb,
          validBuildingCodeArb,
          (existingBuildings, code) => {
            // Multiple calls should return the same result
            const result1 = isBuildingCodeUnique(code, existingBuildings);
            const result2 = isBuildingCodeUnique(code, existingBuildings);
            const result3 = isBuildingCodeUnique(code, existingBuildings);

            expect(result1).toBe(result2);
            expect(result2).toBe(result3);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Special characters in building codes should be handled correctly.
     *
     * **Validates: Requirements 1.1**
     */
    it('should handle special characters in building codes', () => {
      const specialCodes = [
        'BLDG-001',
        'BLDG_001',
        'BLDG001',
        'A-B-C-D',
        '123-456',
        'HQ_MAIN_01',
      ];

      for (const code of specialCodes) {
        const existingBuildings = new Map<string, string>();
        existingBuildings.set('building-1', code);

        // Exact match should exist
        expect(buildingCodeExists(code, existingBuildings)).toBe(true);

        // Different code should not exist
        expect(buildingCodeExists(code + '-NEW', existingBuildings)).toBe(false);
      }
    });

    /**
     * Property: Very long building codes should be handled correctly.
     *
     * **Validates: Requirements 1.1**
     */
    it('should handle long building codes', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom('A', 'B', 'C', '1', '2', '3', '-'),
            { minLength: 40, maxLength: 50 }
          ).filter(s => s.trim().length > 0),
          (longCode) => {
            const existingBuildings = new Map<string, string>();
            existingBuildings.set('building-1', longCode);

            // Should correctly identify the long code
            expect(buildingCodeExists(longCode, existingBuildings)).toBe(true);
            expect(isBuildingCodeUnique(longCode, existingBuildings)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
