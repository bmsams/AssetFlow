/**
 * Purchase Order Total Calculations Property-Based Tests
 *
 * Property-based tests for PO total calculations.
 * Validates: Requirements 16.2, 16.3, 16.4
 *
 * **Validates: Requirements 16.2, 16.3, 16.4**
 */

import * as fc from 'fast-check';
import { calculateLineTotal, calculatePOTotals } from '../purchase-order/po-repository';

// Helper to generate valid price values (positive, rounded to 2 decimals)
const priceArb = fc.double({ min: 0.01, max: 100000, noNaN: true })
  .map(p => Math.round(p * 100) / 100);

const nonNegativePriceArb = fc.double({ min: 0, max: 100000, noNaN: true })
  .map(p => Math.round(p * 100) / 100);

const taxArb = fc.double({ min: 0, max: 1000, noNaN: true })
  .map(t => Math.round(t * 100) / 100);

const shippingArb = fc.double({ min: 0, max: 500, noNaN: true })
  .map(s => Math.round(s * 100) / 100);

describe('PO Total Calculations - Property Tests', () => {
  // ============================================================================
  // Line Total Calculations
  // ============================================================================

  describe('calculateLineTotal', () => {
    /**
     * Property 16.2.1: Line total equals quantity times unit price
     * **Validates: Requirements 16.2**
     */
    it('should calculate line total as quantity * unitPrice', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          priceArb,
          (quantity, unitPrice) => {
            const lineTotal = calculateLineTotal(quantity, unitPrice);
            const expected = Math.round(quantity * unitPrice * 100) / 100;
            return Math.abs(lineTotal - expected) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.2.2: Line total is always non-negative
     * **Validates: Requirements 16.2**
     */
    it('should always produce non-negative line totals', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          nonNegativePriceArb,
          (quantity, unitPrice) => {
            const lineTotal = calculateLineTotal(quantity, unitPrice);
            return lineTotal >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.2.3: Zero quantity results in zero total
     * **Validates: Requirements 16.2**
     */
    it('should return zero when quantity is zero', () => {
      fc.assert(
        fc.property(
          priceArb,
          (unitPrice) => {
            const lineTotal = calculateLineTotal(0, unitPrice);
            return lineTotal === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 16.2.4: Zero unit price results in zero total
     * **Validates: Requirements 16.2**
     */
    it('should return zero when unit price is zero', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (quantity) => {
            const lineTotal = calculateLineTotal(quantity, 0);
            return lineTotal === 0;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================================
  // PO Total Calculations
  // ============================================================================

  describe('calculatePOTotals', () => {
    const lineArb = fc.record({
      quantity: fc.integer({ min: 1, max: 100 }),
      unitPrice: priceArb,
    });

    /**
     * Property 16.3.1: Subtotal equals sum of all line totals
     * **Validates: Requirements 16.3**
     */
    it('should calculate subtotal as sum of line totals', () => {
      fc.assert(
        fc.property(
          fc.array(lineArb, { minLength: 1, maxLength: 10 }),
          (lines) => {
            const { subtotal } = calculatePOTotals(lines, 0, 0);
            const expectedSubtotal = lines.reduce((sum, line) => {
              return sum + calculateLineTotal(line.quantity, line.unitPrice);
            }, 0);
            return Math.abs(subtotal - Math.round(expectedSubtotal * 100) / 100) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.3.2: Total equals subtotal + tax + shipping
     * **Validates: Requirements 16.3**
     */
    it('should calculate total as subtotal + tax + shipping', () => {
      fc.assert(
        fc.property(
          fc.array(lineArb, { minLength: 1, maxLength: 10 }),
          taxArb,
          shippingArb,
          (lines, taxAmount, shippingAmount) => {
            const { subtotal, totalAmount } = calculatePOTotals(lines, taxAmount, shippingAmount);
            const expectedTotal = Math.round((subtotal + taxAmount + shippingAmount) * 100) / 100;
            return Math.abs(totalAmount - expectedTotal) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.3.3: Empty lines result in zero subtotal
     * **Validates: Requirements 16.3**
     */
    it('should return zero subtotal for empty lines', () => {
      fc.assert(
        fc.property(
          taxArb,
          shippingArb,
          (taxAmount, shippingAmount) => {
            const { subtotal, totalAmount } = calculatePOTotals([], taxAmount, shippingAmount);
            return subtotal === 0 && Math.abs(totalAmount - (taxAmount + shippingAmount)) < 0.01;
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property 16.3.4: Total is always >= subtotal (when tax and shipping are non-negative)
     * **Validates: Requirements 16.3**
     */
    it('should have total >= subtotal when tax and shipping are non-negative', () => {
      fc.assert(
        fc.property(
          fc.array(lineArb, { minLength: 0, maxLength: 10 }),
          taxArb,
          shippingArb,
          (lines, taxAmount, shippingAmount) => {
            const { subtotal, totalAmount } = calculatePOTotals(lines, taxAmount, shippingAmount);
            return totalAmount >= subtotal - 0.01; // Allow for floating point precision
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.3.5: Adding a line increases subtotal
     * **Validates: Requirements 16.4**
     */
    it('should increase subtotal when adding a line with positive values', () => {
      fc.assert(
        fc.property(
          fc.array(lineArb, { minLength: 0, maxLength: 9 }),
          lineArb,
          (existingLines, newLine) => {
            const { subtotal: beforeSubtotal } = calculatePOTotals(existingLines, 0, 0);
            const { subtotal: afterSubtotal } = calculatePOTotals([...existingLines, newLine], 0, 0);
            return afterSubtotal > beforeSubtotal;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 16.3.6: Removing a line decreases subtotal
     * **Validates: Requirements 16.4**
     */
    it('should decrease subtotal when removing a line', () => {
      fc.assert(
        fc.property(
          fc.array(lineArb, { minLength: 2, maxLength: 10 }),
          (lines) => {
            const { subtotal: beforeSubtotal } = calculatePOTotals(lines, 0, 0);
            const { subtotal: afterSubtotal } = calculatePOTotals(lines.slice(0, -1), 0, 0);
            return afterSubtotal < beforeSubtotal;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
