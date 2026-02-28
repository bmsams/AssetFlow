/**
 * Property Test: Receiving Quantities Validation
 *
 * **Validates: Requirements 13.4**
 *
 * Property: For any receiving line, quantityReceived SHALL always be less than or equal to quantityExpected.
 * The system SHALL reject any attempt to receive more items than expected.
 *
 * Requirements:
 * - 13.4: Record partial receiving and maintain pending quantities
 * - 6.4: Record receiving of assets
 *
 * Properties tested:
 * 1. quantityReceived is always <= quantityExpected after any valid scan operation
 * 2. Scanning is rejected when quantityReceived would exceed quantityExpected
 * 3. Partial receiving correctly tracks remaining quantities
 * 4. Multiple scans accumulate correctly up to the expected quantity
 * 5. Receiving line status transitions correctly based on quantities
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for Testing
// ============================================================================

/**
 * Simplified receiving line for testing quantity logic
 */
interface TestReceivingLine {
  readonly lineId: string;
  readonly quantityExpected: number;
  readonly quantityReceived: number;
}

/**
 * Result of a scan operation
 */
interface ScanResult {
  readonly success: boolean;
  readonly newQuantityReceived: number;
  readonly isLineComplete: boolean;
  readonly errorMessage?: string;
}

/**
 * Receiving line status based on quantities
 */
type ReceivingLineStatus = 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED';

// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Validate if a scan operation is allowed
 * Core logic: quantityReceived must not exceed quantityExpected
 */
function canScanItem(line: TestReceivingLine): boolean {
  return line.quantityReceived < line.quantityExpected;
}

/**
 * Process a scan operation and return the result
 * This is the core logic extracted for property testing
 */
function processScan(line: TestReceivingLine): ScanResult {
  // Check if we can scan
  if (!canScanItem(line)) {
    return {
      success: false,
      newQuantityReceived: line.quantityReceived,
      isLineComplete: true,
      errorMessage: `All items already received for this line: expected=${line.quantityExpected}, received=${line.quantityReceived}`,
    };
  }

  // Process the scan
  const newQuantityReceived = line.quantityReceived + 1;
  const isLineComplete = newQuantityReceived >= line.quantityExpected;

  return {
    success: true,
    newQuantityReceived,
    isLineComplete,
  };
}

/**
 * Process multiple scans and return the final state
 */
function processMultipleScans(
  line: TestReceivingLine,
  scanCount: number
): { finalLine: TestReceivingLine; successfulScans: number; failedScans: number } {
  let currentLine = { ...line };
  let successfulScans = 0;
  let failedScans = 0;

  for (let i = 0; i < scanCount; i++) {
    const result = processScan(currentLine);
    if (result.success) {
      currentLine = {
        ...currentLine,
        quantityReceived: result.newQuantityReceived,
      };
      successfulScans++;
    } else {
      failedScans++;
    }
  }

  return { finalLine: currentLine, successfulScans, failedScans };
}

/**
 * Calculate remaining quantity to receive
 */
function calculateRemainingQuantity(line: TestReceivingLine): number {
  return Math.max(0, line.quantityExpected - line.quantityReceived);
}

/**
 * Determine receiving line status based on quantities
 */
function determineLineStatus(line: TestReceivingLine): ReceivingLineStatus {
  if (line.quantityReceived === 0) {
    return 'PENDING';
  }
  if (line.quantityReceived >= line.quantityExpected) {
    return 'RECEIVED';
  }
  return 'PARTIALLY_RECEIVED';
}

/**
 * Validate quantity invariants
 */
function validateQuantityInvariants(line: TestReceivingLine): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (line.quantityExpected < 0) {
    errors.push('quantityExpected cannot be negative');
  }

  if (line.quantityReceived < 0) {
    errors.push('quantityReceived cannot be negative');
  }

  if (line.quantityReceived > line.quantityExpected) {
    errors.push('quantityReceived cannot exceed quantityExpected');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Arbitraries (Test Data Generators)
// ============================================================================

/**
 * Generate a valid UUID-like string
 */
const uuidArb = fc.uuid();

/**
 * Generate a valid quantity expected (1 to 100)
 */
const quantityExpectedArb = fc.integer({ min: 1, max: 100 });

/**
 * Generate a valid quantity received (0 to quantityExpected)
 */
function quantityReceivedArb(quantityExpected: number): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: quantityExpected });
}

/**
 * Generate a valid receiving line with consistent quantities
 */
const validReceivingLineArb: fc.Arbitrary<TestReceivingLine> = quantityExpectedArb.chain(
  (quantityExpected) =>
    fc.record({
      lineId: uuidArb,
      quantityExpected: fc.constant(quantityExpected),
      quantityReceived: quantityReceivedArb(quantityExpected),
    })
);

/**
 * Generate a receiving line with no items received yet
 */
const emptyReceivingLineArb: fc.Arbitrary<TestReceivingLine> = fc.record({
  lineId: uuidArb,
  quantityExpected: quantityExpectedArb,
  quantityReceived: fc.constant(0),
});

/**
 * Generate a receiving line that is fully received
 */
const fullyReceivedLineArb: fc.Arbitrary<TestReceivingLine> = quantityExpectedArb.chain(
  (quantityExpected) =>
    fc.record({
      lineId: uuidArb,
      quantityExpected: fc.constant(quantityExpected),
      quantityReceived: fc.constant(quantityExpected),
    })
);

/**
 * Generate a number of scans to attempt (0 to 150, allowing over-scanning attempts)
 */
const scanCountArb = fc.integer({ min: 0, max: 150 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Receiving Quantities Property Tests', () => {
  describe('Property 1: quantityReceived <= quantityExpected invariant', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * For any valid receiving line, quantityReceived must always be
     * less than or equal to quantityExpected.
     */
    it('quantityReceived is always <= quantityExpected for valid lines', () => {
      fc.assert(
        fc.property(validReceivingLineArb, (line) => {
          const validation = validateQuantityInvariants(line);
          return validation.valid && line.quantityReceived <= line.quantityExpected;
        }),
        { numRuns: 1000 }
      );
    });

    it('remaining quantity is always non-negative', () => {
      fc.assert(
        fc.property(validReceivingLineArb, (line) => {
          const remaining = calculateRemainingQuantity(line);
          return remaining >= 0;
        }),
        { numRuns: 1000 }
      );
    });

    it('remaining quantity equals expected minus received', () => {
      fc.assert(
        fc.property(validReceivingLineArb, (line) => {
          const remaining = calculateRemainingQuantity(line);
          return remaining === line.quantityExpected - line.quantityReceived;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 2: Scan rejection when at capacity', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * When quantityReceived equals quantityExpected, any additional
     * scan attempt must be rejected.
     */
    it('scanning is rejected when line is fully received', () => {
      fc.assert(
        fc.property(fullyReceivedLineArb, (line) => {
          const result = processScan(line);
          return (
            result.success === false &&
            result.newQuantityReceived === line.quantityReceived &&
            result.isLineComplete === true &&
            result.errorMessage !== undefined
          );
        }),
        { numRuns: 500 }
      );
    });

    it('canScanItem returns false when line is fully received', () => {
      fc.assert(
        fc.property(fullyReceivedLineArb, (line) => {
          return canScanItem(line) === false;
        }),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 3: Successful scan increments quantity by exactly 1', () => {
    /**
     * **Validates: Requirements 6.4**
     *
     * Each successful scan operation increments quantityReceived by exactly 1.
     */
    it('successful scan increments quantity by 1', () => {
      fc.assert(
        fc.property(
          validReceivingLineArb.filter((line) => line.quantityReceived < line.quantityExpected),
          (line) => {
            const result = processScan(line);
            return (
              result.success === true &&
              result.newQuantityReceived === line.quantityReceived + 1
            );
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 4: Multiple scans accumulate correctly', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * Multiple scan operations accumulate correctly, never exceeding
     * the expected quantity.
     */
    it('multiple scans never exceed expected quantity', () => {
      fc.assert(
        fc.property(emptyReceivingLineArb, scanCountArb, (line, scanCount) => {
          const { finalLine } = processMultipleScans(line, scanCount);
          return finalLine.quantityReceived <= finalLine.quantityExpected;
        }),
        { numRuns: 1000 }
      );
    });

    it('successful scans equal min(scanCount, quantityExpected) for empty line', () => {
      fc.assert(
        fc.property(emptyReceivingLineArb, scanCountArb, (line, scanCount) => {
          const { successfulScans } = processMultipleScans(line, scanCount);
          const expectedSuccessful = Math.min(scanCount, line.quantityExpected);
          return successfulScans === expectedSuccessful;
        }),
        { numRuns: 1000 }
      );
    });

    it('failed scans equal max(0, scanCount - quantityExpected) for empty line', () => {
      fc.assert(
        fc.property(emptyReceivingLineArb, scanCountArb, (line, scanCount) => {
          const { failedScans } = processMultipleScans(line, scanCount);
          const expectedFailed = Math.max(0, scanCount - line.quantityExpected);
          return failedScans === expectedFailed;
        }),
        { numRuns: 1000 }
      );
    });

    it('total scans equals successful + failed', () => {
      fc.assert(
        fc.property(validReceivingLineArb, scanCountArb, (line, scanCount) => {
          const { successfulScans, failedScans } = processMultipleScans(line, scanCount);
          return successfulScans + failedScans === scanCount;
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 5: Line status transitions correctly', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * Line status correctly reflects the relationship between
     * quantityReceived and quantityExpected.
     */
    it('status is PENDING when quantityReceived is 0', () => {
      fc.assert(
        fc.property(emptyReceivingLineArb, (line) => {
          return determineLineStatus(line) === 'PENDING';
        }),
        { numRuns: 500 }
      );
    });

    it('status is RECEIVED when quantityReceived equals quantityExpected', () => {
      fc.assert(
        fc.property(fullyReceivedLineArb, (line) => {
          return determineLineStatus(line) === 'RECEIVED';
        }),
        { numRuns: 500 }
      );
    });

    it('status is PARTIALLY_RECEIVED when 0 < quantityReceived < quantityExpected', () => {
      fc.assert(
        fc.property(
          validReceivingLineArb.filter(
            (line) => line.quantityReceived > 0 && line.quantityReceived < line.quantityExpected
          ),
          (line) => {
            return determineLineStatus(line) === 'PARTIALLY_RECEIVED';
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 6: Line completion detection', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * isLineComplete is true if and only if quantityReceived >= quantityExpected.
     */
    it('line is complete when quantityReceived >= quantityExpected', () => {
      fc.assert(
        fc.property(fullyReceivedLineArb, (line) => {
          const result = processScan(line);
          return result.isLineComplete === true;
        }),
        { numRuns: 500 }
      );
    });

    it('line becomes complete on final successful scan', () => {
      fc.assert(
        fc.property(
          quantityExpectedArb.chain((expected) =>
            fc.record({
              lineId: uuidArb,
              quantityExpected: fc.constant(expected),
              quantityReceived: fc.constant(expected - 1), // One away from complete
            })
          ),
          (line) => {
            const result = processScan(line);
            return result.success === true && result.isLineComplete === true;
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 7: Idempotency of validation', () => {
    /**
     * **Validates: Requirements 13.4**
     *
     * Validation results are deterministic and consistent.
     */
    it('validation is deterministic', () => {
      fc.assert(
        fc.property(validReceivingLineArb, (line) => {
          const result1 = validateQuantityInvariants(line);
          const result2 = validateQuantityInvariants(line);
          return result1.valid === result2.valid && result1.errors.length === result2.errors.length;
        }),
        { numRuns: 500 }
      );
    });

    it('canScanItem is deterministic', () => {
      fc.assert(
        fc.property(validReceivingLineArb, (line) => {
          const result1 = canScanItem(line);
          const result2 = canScanItem(line);
          return result1 === result2;
        }),
        { numRuns: 500 }
      );
    });
  });
});
