/**
 * Property Test: Normalization Idempotence
 *
 * **Validates: Requirements 3.1**
 *
 * Property 5: For any manufacturer name input, applying the normalization
 * function once SHALL produce the same result as applying it multiple times.
 * normalize(normalize(x)) == normalize(x) for all valid manufacturer name strings.
 *
 * This property also extends to model normalization:
 * normalizeModel(normalizeModel(x, mfg).value, mfg) === normalizeModel(x, mfg).value
 *
 * Requirements:
 * - 3.1: WHEN discovery data is ingested, THE Normalization_Engine SHALL
 *        standardize manufacturer names, model numbers, and specifications
 *        to canonical forms.
 */

import * as fc from 'fast-check';

import {
  normalizeManufacturer,
  normalizeModel,
  getKnownManufacturers,
} from '../normalization';

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate random manufacturer strings including:
 * - Known manufacturer names and aliases
 * - Random strings with various characters
 * - Edge cases (empty, whitespace, special characters)
 */
const manufacturerStringArb = fc.oneof(
  // Known manufacturers (exact matches)
  fc.constantFrom(
    'Dell',
    'HP',
    'Lenovo',
    'Apple',
    'Cisco',
    'IBM',
    'Microsoft',
    'Dell Inc.',
    'Hewlett-Packard',
    'Hewlett Packard Enterprise',
    'Lenovo Group',
    'Apple Inc',
    'Cisco Systems, Inc.'
  ),
  // Random alphanumeric strings
  fc.string({ minLength: 1, maxLength: 100 }),
  // Strings with special characters
  fc.stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      ' ', '-', '_', '.', ',', '&', '(', ')'
    ),
    { minLength: 1, maxLength: 50 }
  ),
  // Strings with leading/trailing whitespace
  fc.tuple(
    fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 5 }),
    fc.string({ minLength: 1, maxLength: 30 }),
    fc.stringOf(fc.constant(' '), { minLength: 0, maxLength: 5 })
  ).map(([prefix, middle, suffix]) => prefix + middle + suffix),
  // Typos of known manufacturers
  fc.constantFrom(
    'Dellll',
    'Hewlet Packard',
    'Lennovo',
    'Aple',
    'Microsft',
    'Ciscoo'
  )
);

/**
 * Generate random model strings including:
 * - Known model names
 * - Random strings
 * - Model-like patterns (letters + numbers)
 */
const modelStringArb = fc.oneof(
  // Known models
  fc.constantFrom(
    'Latitude 5520',
    'EliteBook 840 G8',
    'ThinkPad T14 Gen 2',
    'MacBook Pro 14',
    'PowerEdge R750',
    'lat 5520',
    'eb 840 g8',
    'mbp 14'
  ),
  // Random alphanumeric strings
  fc.string({ minLength: 1, maxLength: 100 }),
  // Model-like patterns (e.g., "Model 1234", "XPS 15")
  fc.tuple(
    fc.stringOf(
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
        'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'),
      { minLength: 1, maxLength: 10 }
    ),
    fc.constant(' '),
    fc.stringOf(
      fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
      { minLength: 1, maxLength: 6 }
    )
  ).map(([letters, space, numbers]) => letters + space + numbers),
  // Strings with special characters
  fc.stringOf(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      ' ', '-', '_', '.', 'G', 'e', 'n'
    ),
    { minLength: 1, maxLength: 50 }
  )
);

/**
 * Generate known manufacturer canonical names for model normalization context
 */
const knownManufacturerArb = fc.constantFrom(
  'DELL',
  'HP',
  'HPE',
  'LENOVO',
  'APPLE',
  'CISCO',
  'IBM',
  'MICROSOFT',
  'VMWARE',
  'SAMSUNG',
  'ASUS',
  'ACER'
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 5: Normalization Idempotence', () => {
  /**
   * **Validates: Requirements 3.1**
   */

  describe('Manufacturer Normalization Idempotence', () => {
    /**
     * Property: Normalizing a manufacturer name twice produces the same result
     * as normalizing it once.
     *
     * normalize(normalize(x).value) === normalize(x).value
     *
     * **Validates: Requirements 3.1**
     */
    it('should produce same result when manufacturer normalization is applied multiple times', () => {
      fc.assert(
        fc.property(manufacturerStringArb, (rawManufacturer) => {
          // First normalization
          const firstResult = normalizeManufacturer(rawManufacturer);
          const normalizedValue = firstResult.value;

          // Second normalization (applying to the already normalized value)
          const secondResult = normalizeManufacturer(normalizedValue);
          const doubleNormalizedValue = secondResult.value;

          // Property: The normalized value should be the same after second normalization
          expect(doubleNormalizedValue).toBe(normalizedValue);

          // Additional property: Third normalization should also be the same
          const thirdResult = normalizeManufacturer(doubleNormalizedValue);
          expect(thirdResult.value).toBe(normalizedValue);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The confidence of a normalized value should be high (exact match)
     * when normalizing an already normalized value.
     *
     * **Validates: Requirements 3.1**
     */
    it('should have high confidence when normalizing an already normalized value', () => {
      fc.assert(
        fc.property(manufacturerStringArb, (rawManufacturer) => {
          // First normalization
          const firstResult = normalizeManufacturer(rawManufacturer);
          const normalizedValue = firstResult.value;

          // Skip if the first normalization resulted in UNKNOWN
          if (normalizedValue === 'UNKNOWN') {
            return;
          }

          // Second normalization
          const secondResult = normalizeManufacturer(normalizedValue);

          // Property: Second normalization should have high confidence
          // (either exact match or alias match)
          expect(secondResult.confidence).toBeGreaterThanOrEqual(firstResult.confidence);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Known manufacturers should always normalize to themselves
     *
     * **Validates: Requirements 3.1**
     */
    it('should normalize known canonical manufacturers to themselves', () => {
      const knownManufacturers = getKnownManufacturers();

      fc.assert(
        fc.property(
          fc.constantFrom(...knownManufacturers),
          (canonicalManufacturer) => {
            const result = normalizeManufacturer(canonicalManufacturer);

            // Property: Known canonical names should normalize to themselves
            expect(result.value).toBe(canonicalManufacturer);
            expect(result.confidence).toBe(1.0);
            expect(result.exactMatch).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Model Normalization Idempotence', () => {
    /**
     * Property: Normalizing a model name twice (with the same manufacturer context)
     * produces the same result as normalizing it once.
     *
     * normalizeModel(normalizeModel(x, mfg).value, mfg) === normalizeModel(x, mfg).value
     *
     * **Validates: Requirements 3.1**
     */
    it('should produce same result when model normalization is applied multiple times', () => {
      fc.assert(
        fc.property(
          modelStringArb,
          knownManufacturerArb,
          (rawModel, manufacturerCanonical) => {
            // First normalization
            const firstResult = normalizeModel(rawModel, manufacturerCanonical);
            const normalizedValue = firstResult.value;

            // Second normalization (applying to the already normalized value)
            const secondResult = normalizeModel(normalizedValue, manufacturerCanonical);
            const doubleNormalizedValue = secondResult.value;

            // Property: The normalized value should be the same after second normalization
            expect(doubleNormalizedValue).toBe(normalizedValue);

            // Additional property: Third normalization should also be the same
            const thirdResult = normalizeModel(doubleNormalizedValue, manufacturerCanonical);
            expect(thirdResult.value).toBe(normalizedValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: The confidence of a normalized model value should be high
     * when normalizing an already normalized value.
     *
     * **Validates: Requirements 3.1**
     */
    it('should have high confidence when normalizing an already normalized model value', () => {
      fc.assert(
        fc.property(
          modelStringArb,
          knownManufacturerArb,
          (rawModel, manufacturerCanonical) => {
            // First normalization
            const firstResult = normalizeModel(rawModel, manufacturerCanonical);
            const normalizedValue = firstResult.value;

            // Skip if the first normalization resulted in UNKNOWN
            if (normalizedValue === 'UNKNOWN') {
              return;
            }

            // Second normalization
            const secondResult = normalizeModel(normalizedValue, manufacturerCanonical);

            // Property: Second normalization should have confidence >= first
            expect(secondResult.confidence).toBeGreaterThanOrEqual(firstResult.confidence);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Combined Manufacturer and Model Idempotence', () => {
    /**
     * Property: When normalizing both manufacturer and model together,
     * the combined normalization should be idempotent.
     *
     * **Validates: Requirements 3.1**
     */
    it('should produce idempotent results for combined manufacturer and model normalization', () => {
      fc.assert(
        fc.property(
          manufacturerStringArb,
          modelStringArb,
          (rawManufacturer, rawModel) => {
            // First pass: normalize manufacturer, then model with that context
            const mfgResult1 = normalizeManufacturer(rawManufacturer);
            const modelResult1 = normalizeModel(rawModel, mfgResult1.value);

            // Second pass: normalize the already normalized values
            const mfgResult2 = normalizeManufacturer(mfgResult1.value);
            const modelResult2 = normalizeModel(modelResult1.value, mfgResult2.value);

            // Property: Both manufacturer and model should be stable
            expect(mfgResult2.value).toBe(mfgResult1.value);
            expect(modelResult2.value).toBe(modelResult1.value);

            // Third pass: verify stability continues
            const mfgResult3 = normalizeManufacturer(mfgResult2.value);
            const modelResult3 = normalizeModel(modelResult2.value, mfgResult3.value);

            expect(mfgResult3.value).toBe(mfgResult1.value);
            expect(modelResult3.value).toBe(modelResult1.value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Empty strings should normalize consistently
     *
     * **Validates: Requirements 3.1**
     */
    it('should handle empty manufacturer strings idempotently', () => {
      const emptyInputs = ['', '   ', '\t', '\n', '  \t  '];

      for (const input of emptyInputs) {
        const firstResult = normalizeManufacturer(input);
        const secondResult = normalizeManufacturer(firstResult.value);

        expect(secondResult.value).toBe(firstResult.value);
        expect(firstResult.value).toBe('UNKNOWN');
      }
    });

    /**
     * Property: Empty model strings should normalize consistently
     *
     * **Validates: Requirements 3.1**
     */
    it('should handle empty model strings idempotently', () => {
      const emptyInputs = ['', '   ', '\t', '\n', '  \t  '];

      for (const input of emptyInputs) {
        const firstResult = normalizeModel(input, 'DELL');
        const secondResult = normalizeModel(firstResult.value, 'DELL');

        expect(secondResult.value).toBe(firstResult.value);
        expect(firstResult.value).toBe('UNKNOWN');
      }
    });

    /**
     * Property: Special characters should be handled consistently
     *
     * **Validates: Requirements 3.1**
     */
    it('should handle special characters in manufacturer names idempotently', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom(
              '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '=',
              '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '.',
              '?', '/', '~', '`', ' '
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (specialChars) => {
            const firstResult = normalizeManufacturer(specialChars);
            const secondResult = normalizeManufacturer(firstResult.value);

            expect(secondResult.value).toBe(firstResult.value);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Unicode characters should be handled consistently
     *
     * **Validates: Requirements 3.1**
     */
    it('should handle unicode characters in manufacturer names idempotently', () => {
      fc.assert(
        fc.property(fc.unicodeString({ minLength: 1, maxLength: 50 }), (unicodeStr) => {
          const firstResult = normalizeManufacturer(unicodeStr);
          const secondResult = normalizeManufacturer(firstResult.value);

          expect(secondResult.value).toBe(firstResult.value);
        }),
        { numRuns: 50 }
      );
    });
  });
});
