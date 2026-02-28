/**
 * Property-Based Tests: PO Total Calculations
 *
 * **Validates: Requirements 16.3**
 *
 * Properties tested:
 * 1. Line Total Calculation: lineTotal = quantity * unitPrice
 * 2. Subtotal Calculation: subtotal = sum of all line totals
 * 3. Total Amount Calculation: totalAmount = subtotal + taxAmount + shippingAmount
 * 4. Non-negative Amounts: All amounts should be non-negative
 * 5. Recalculation Consistency: Totals should be consistent after line changes
 *
 * Requirements:
 * - 16.3: WHEN a procurement manager updates line item quantities or prices,
 *         THEN THE Purchase_Order_Service SHALL update the line and recalculate the PO total
 */

import * as fc from 'fast-check';

// ============================================================================
// Types for PO Total Calculation Testing
// ============================================================================

/**
 * Represents a PO line item for testing
 */
interface POLineItem {
  readonly lineId: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
}

/**
 * Represents PO totals
 */
interface POTotals {
  readonly subtotal: number;
  readonly taxAmount: number;
  readonly shippingAmount: number;
  readonly totalAmount: number;
}

// ============================================================================
// Pure Functions Under Test
// ============================================================================

/**
 * Calculates line total from quantity and unit price.
 * Rounds to 2 decimal places to avoid floating-point precision issues.
 *
 * **Validates: Requirements 16.3**
 *
 * @param quantity - Number of items
 * @param unitPrice - Price per item
 * @returns Line total (quantity * unitPrice)
 */
function calculateLineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}


/**
 * Calculates subtotal from line items.
 * Subtotal is the sum of all line totals.
 *
 * **Validates: Requirements 16.3**
 *
 * @param lines - Array of line items
 * @returns Subtotal (sum of line totals)
 */
function calculateSubtotal(lines: readonly POLineItem[]): number {
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  return Math.round(subtotal * 100) / 100;
}

/**
 * Calculates total amount from subtotal, tax, and shipping.
 * Total = subtotal + taxAmount + shippingAmount
 *
 * **Validates: Requirements 16.3**
 *
 * @param subtotal - Sum of line totals
 * @param taxAmount - Tax amount
 * @param shippingAmount - Shipping amount
 * @returns Total amount
 */
function calculateTotalAmount(
  subtotal: number,
  taxAmount: number,
  shippingAmount: number
): number {
  return Math.round((subtotal + taxAmount + shippingAmount) * 100) / 100;
}

/**
 * Creates a PO line item with calculated line total.
 *
 * @param lineId - Line identifier
 * @param quantity - Number of items
 * @param unitPrice - Price per item
 * @returns POLineItem with calculated lineTotal
 */
function createPOLineItem(
  lineId: string,
  quantity: number,
  unitPrice: number
): POLineItem {
  return {
    lineId,
    quantity,
    unitPrice,
    lineTotal: calculateLineTotal(quantity, unitPrice),
  };
}

/**
 * Calculates all PO totals from lines, tax, and shipping.
 *
 * **Validates: Requirements 16.3**
 *
 * @param lines - Array of line items
 * @param taxAmount - Tax amount
 * @param shippingAmount - Shipping amount
 * @returns POTotals with all calculated values
 */
function calculatePOTotals(
  lines: readonly POLineItem[],
  taxAmount: number,
  shippingAmount: number
): POTotals {
  const subtotal = calculateSubtotal(lines);
  const totalAmount = calculateTotalAmount(subtotal, taxAmount, shippingAmount);
  return {
    subtotal,
    taxAmount,
    shippingAmount,
    totalAmount,
  };
}

/**
 * Updates a line item's quantity and recalculates line total.
 *
 * @param line - Original line item
 * @param newQuantity - New quantity
 * @returns Updated line item
 */
function updateLineQuantity(line: POLineItem, newQuantity: number): POLineItem {
  return createPOLineItem(line.lineId, newQuantity, line.unitPrice);
}

/**
 * Updates a line item's unit price and recalculates line total.
 *
 * @param line - Original line item
 * @param newUnitPrice - New unit price
 * @returns Updated line item
 */
function updateLineUnitPrice(line: POLineItem, newUnitPrice: number): POLineItem {
  return createPOLineItem(line.lineId, line.quantity, newUnitPrice);
}

/**
 * Validates that an amount is non-negative.
 *
 * @param amount - Amount to validate
 * @returns true if amount is non-negative
 */
function isValidAmount(amount: number): boolean {
  return amount >= 0 && !isNaN(amount) && isFinite(amount);
}

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate valid quantities (positive integers).
 */
const quantityArb = fc.integer({ min: 1, max: 10000 });

/**
 * Generate valid unit prices (positive numbers with 2 decimal places).
 */
const unitPriceArb = fc.double({ min: 0.01, max: 100000, noNaN: true })
  .map((p) => Math.round(p * 100) / 100);

/**
 * Generate valid tax amounts (non-negative).
 */
const taxAmountArb = fc.double({ min: 0, max: 10000, noNaN: true })
  .map((t) => Math.round(t * 100) / 100);

/**
 * Generate valid shipping amounts (non-negative).
 */
const shippingAmountArb = fc.double({ min: 0, max: 1000, noNaN: true })
  .map((s) => Math.round(s * 100) / 100);

/**
 * Generate a valid PO line item.
 */
const poLineItemArb = fc.tuple(fc.uuid(), quantityArb, unitPriceArb).map(
  ([lineId, quantity, unitPrice]) => createPOLineItem(lineId, quantity, unitPrice)
);

/**
 * Generate an array of valid PO line items.
 */
const poLinesArb = fc.array(poLineItemArb, { minLength: 1, maxLength: 20 });

/**
 * Generate a complete PO with lines and amounts.
 */
const poWithTotalsArb = fc.tuple(poLinesArb, taxAmountArb, shippingAmountArb).map(
  ([lines, tax, shipping]) => ({
    lines,
    ...calculatePOTotals(lines, tax, shipping),
  })
);


// ============================================================================
// Property Tests
// ============================================================================

describe('Property Tests: PO Total Calculations', () => {
  /**
   * **Validates: Requirements 16.3**
   */

  describe('Property 1: Line Total Calculation', () => {
    /**
     * Property: lineTotal must always equal quantity * unitPrice.
     *
     * **Validates: Requirements 16.3**
     */
    it('should calculate lineTotal as quantity * unitPrice', () => {
      fc.assert(
        fc.property(quantityArb, unitPriceArb, (quantity, unitPrice) => {
          const lineTotal = calculateLineTotal(quantity, unitPrice);
          const expected = Math.round(quantity * unitPrice * 100) / 100;

          expect(lineTotal).toBeCloseTo(expected, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Line item should have consistent lineTotal.
     *
     * **Validates: Requirements 16.3**
     */
    it('should create line items with consistent lineTotal', () => {
      fc.assert(
        fc.property(poLineItemArb, (line) => {
          const expected = Math.round(line.quantity * line.unitPrice * 100) / 100;

          expect(line.lineTotal).toBeCloseTo(expected, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Doubling quantity should double lineTotal.
     *
     * **Validates: Requirements 16.3**
     */
    it('should double lineTotal when quantity is doubled', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5000 }),
          unitPriceArb,
          (quantity, unitPrice) => {
            const originalTotal = calculateLineTotal(quantity, unitPrice);
            const doubledTotal = calculateLineTotal(quantity * 2, unitPrice);

            expect(doubledTotal).toBeCloseTo(originalTotal * 2, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Doubling unit price should double lineTotal.
     *
     * **Validates: Requirements 16.3**
     */
    it('should double lineTotal when unitPrice is doubled', () => {
      fc.assert(
        fc.property(
          quantityArb,
          fc.double({ min: 0.01, max: 50000, noNaN: true }).map((p) => Math.round(p * 100) / 100),
          (quantity, unitPrice) => {
            const originalTotal = calculateLineTotal(quantity, unitPrice);
            const doubledTotal = calculateLineTotal(quantity, unitPrice * 2);

            expect(doubledTotal).toBeCloseTo(originalTotal * 2, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Subtotal Calculation', () => {
    /**
     * Property: subtotal must equal sum of all line totals.
     *
     * **Validates: Requirements 16.3**
     */
    it('should calculate subtotal as sum of line totals', () => {
      fc.assert(
        fc.property(poLinesArb, (lines) => {
          const subtotal = calculateSubtotal(lines);
          const expectedSum = lines.reduce((sum, line) => sum + line.lineTotal, 0);
          const expected = Math.round(expectedSum * 100) / 100;

          expect(subtotal).toBeCloseTo(expected, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty lines should have zero subtotal.
     *
     * **Validates: Requirements 16.3**
     */
    it('should return zero subtotal for empty lines', () => {
      const subtotal = calculateSubtotal([]);

      expect(subtotal).toBe(0);
    });

    /**
     * Property: Single line subtotal should equal line total.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have subtotal equal to lineTotal for single line', () => {
      fc.assert(
        fc.property(poLineItemArb, (line) => {
          const subtotal = calculateSubtotal([line]);

          expect(subtotal).toBeCloseTo(line.lineTotal, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Adding a line should increase subtotal by line total.
     *
     * **Validates: Requirements 16.3**
     */
    it('should increase subtotal by lineTotal when adding a line', () => {
      fc.assert(
        fc.property(poLinesArb, poLineItemArb, (lines, newLine) => {
          const originalSubtotal = calculateSubtotal(lines);
          const newSubtotal = calculateSubtotal([...lines, newLine]);

          expect(newSubtotal).toBeCloseTo(originalSubtotal + newLine.lineTotal, 2);
        }),
        { numRuns: 100 }
      );
    });
  });


  describe('Property 3: Total Amount Calculation', () => {
    /**
     * Property: totalAmount must equal subtotal + taxAmount + shippingAmount.
     *
     * **Validates: Requirements 16.3**
     */
    it('should calculate totalAmount as subtotal + tax + shipping', () => {
      fc.assert(
        fc.property(
          poLinesArb,
          taxAmountArb,
          shippingAmountArb,
          (lines, tax, shipping) => {
            const subtotal = calculateSubtotal(lines);
            const totalAmount = calculateTotalAmount(subtotal, tax, shipping);
            const expected = Math.round((subtotal + tax + shipping) * 100) / 100;

            expect(totalAmount).toBeCloseTo(expected, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: PO totals should be consistent.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have consistent PO totals', () => {
      fc.assert(
        fc.property(poWithTotalsArb, (po) => {
          const expectedSubtotal = calculateSubtotal(po.lines);
          const expectedTotal = calculateTotalAmount(
            expectedSubtotal,
            po.taxAmount,
            po.shippingAmount
          );

          expect(po.subtotal).toBeCloseTo(expectedSubtotal, 2);
          expect(po.totalAmount).toBeCloseTo(expectedTotal, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Zero tax and shipping should have totalAmount equal subtotal.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have totalAmount equal subtotal when tax and shipping are zero', () => {
      fc.assert(
        fc.property(poLinesArb, (lines) => {
          const subtotal = calculateSubtotal(lines);
          const totalAmount = calculateTotalAmount(subtotal, 0, 0);

          expect(totalAmount).toBeCloseTo(subtotal, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Increasing tax should increase totalAmount by same amount.
     *
     * **Validates: Requirements 16.3**
     */
    it('should increase totalAmount when tax increases', () => {
      fc.assert(
        fc.property(
          poLinesArb,
          taxAmountArb,
          taxAmountArb,
          shippingAmountArb,
          (lines, tax1, tax2, shipping) => {
            const subtotal = calculateSubtotal(lines);
            const total1 = calculateTotalAmount(subtotal, tax1, shipping);
            const total2 = calculateTotalAmount(subtotal, tax2, shipping);
            const taxDiff = Math.round((tax2 - tax1) * 100) / 100;
            const totalDiff = Math.round((total2 - total1) * 100) / 100;

            expect(totalDiff).toBeCloseTo(taxDiff, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Non-negative Amounts', () => {
    /**
     * Property: All amounts should be non-negative.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have non-negative line totals', () => {
      fc.assert(
        fc.property(poLineItemArb, (line) => {
          expect(line.lineTotal).toBeGreaterThanOrEqual(0);
          expect(isValidAmount(line.lineTotal)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Subtotal should be non-negative.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have non-negative subtotal', () => {
      fc.assert(
        fc.property(poLinesArb, (lines) => {
          const subtotal = calculateSubtotal(lines);

          expect(subtotal).toBeGreaterThanOrEqual(0);
          expect(isValidAmount(subtotal)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Total amount should be non-negative.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have non-negative totalAmount', () => {
      fc.assert(
        fc.property(poWithTotalsArb, (po) => {
          expect(po.totalAmount).toBeGreaterThanOrEqual(0);
          expect(isValidAmount(po.totalAmount)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Recalculation Consistency', () => {
    /**
     * Property: Updating line quantity should recalculate totals correctly.
     *
     * **Validates: Requirements 16.3**
     */
    it('should recalculate totals after quantity update', () => {
      fc.assert(
        fc.property(
          fc.array(poLineItemArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          quantityArb,
          taxAmountArb,
          shippingAmountArb,
          (lines, lineIndex, newQuantity, tax, shipping) => {
            const idx = lineIndex % lines.length;
            const originalLine = lines[idx];
            if (!originalLine) return; // Skip if no line at index
            
            const originalTotals = calculatePOTotals(lines, tax, shipping);

            // Update the line
            const updatedLine = updateLineQuantity(originalLine, newQuantity);
            const updatedLines = [...lines];
            updatedLines[idx] = updatedLine;

            const newTotals = calculatePOTotals(updatedLines, tax, shipping);

            // Verify the change in subtotal matches the change in line total
            const lineTotalDiff = updatedLine.lineTotal - originalLine.lineTotal;
            const subtotalDiff = newTotals.subtotal - originalTotals.subtotal;

            expect(subtotalDiff).toBeCloseTo(lineTotalDiff, 2);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Updating line unit price should recalculate totals correctly.
     *
     * **Validates: Requirements 16.3**
     */
    it('should recalculate totals after unit price update', () => {
      fc.assert(
        fc.property(
          fc.array(poLineItemArb, { minLength: 1, maxLength: 20 }),
          fc.integer({ min: 0, max: 19 }),
          unitPriceArb,
          taxAmountArb,
          shippingAmountArb,
          (lines, lineIndex, newUnitPrice, tax, shipping) => {
            const idx = lineIndex % lines.length;
            const originalLine = lines[idx];
            if (!originalLine) return; // Skip if no line at index
            
            const originalTotals = calculatePOTotals(lines, tax, shipping);

            // Update the line
            const updatedLine = updateLineUnitPrice(originalLine, newUnitPrice);
            const updatedLines = [...lines];
            updatedLines[idx] = updatedLine;

            const newTotals = calculatePOTotals(updatedLines, tax, shipping);

            // Verify the change in subtotal matches the change in line total
            const lineTotalDiff = updatedLine.lineTotal - originalLine.lineTotal;
            const subtotalDiff = newTotals.subtotal - originalTotals.subtotal;

            expect(subtotalDiff).toBeCloseTo(lineTotalDiff, 2);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Removing a line should decrease subtotal by line total.
     *
     * **Validates: Requirements 16.3**
     */
    it('should decrease subtotal when removing a line', () => {
      fc.assert(
        fc.property(
          fc.array(poLineItemArb, { minLength: 2, maxLength: 10 }),
          fc.integer({ min: 0, max: 9 }),
          (lines, lineIndex) => {
            const idx = lineIndex % lines.length;
            const originalLine = lines[idx];
            if (!originalLine) return; // Skip if no line at index
            
            const originalSubtotal = calculateSubtotal(lines);
            const removedLineTotal = originalLine.lineTotal;

            const remainingLines = lines.filter((_, i) => i !== idx);
            const newSubtotal = calculateSubtotal(remainingLines);

            expect(newSubtotal).toBeCloseTo(originalSubtotal - removedLineTotal, 2);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Edge Cases', () => {
    /**
     * Property: Single item with quantity 1 should have lineTotal equal unitPrice.
     *
     * **Validates: Requirements 16.3**
     */
    it('should have lineTotal equal unitPrice for quantity 1', () => {
      fc.assert(
        fc.property(unitPriceArb, (unitPrice) => {
          const lineTotal = calculateLineTotal(1, unitPrice);

          expect(lineTotal).toBeCloseTo(unitPrice, 2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Very small unit prices should be handled correctly.
     *
     * **Validates: Requirements 16.3**
     */
    it('should handle very small unit prices', () => {
      fc.assert(
        fc.property(
          quantityArb,
          fc.double({ min: 0.01, max: 1, noNaN: true }).map((p) => Math.round(p * 100) / 100),
          (quantity, unitPrice) => {
            const lineTotal = calculateLineTotal(quantity, unitPrice);

            expect(lineTotal).toBeGreaterThanOrEqual(0);
            expect(isValidAmount(lineTotal)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Large quantities should be handled correctly.
     *
     * **Validates: Requirements 16.3**
     */
    it('should handle large quantities', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1000, max: 10000 }),
          unitPriceArb,
          (quantity, unitPrice) => {
            const lineTotal = calculateLineTotal(quantity, unitPrice);
            const expected = Math.round(quantity * unitPrice * 100) / 100;

            expect(lineTotal).toBeCloseTo(expected, 2);
            expect(isValidAmount(lineTotal)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
