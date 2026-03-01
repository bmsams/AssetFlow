/**
 * Property Test: PO Vendor Resolution
 *
 * Tag: Feature: po-header-line-items, Property 1: Field resolution - line overrides header
 * Validates: Requirements 1.3, 3.3, 5.2, 5.3
 */

import * as fc from 'fast-check';

import { resolveEffectiveCostCenter } from '../procurement/cost-center-resolution';
import { resolveEffectiveVendor } from '../procurement/vendor-resolution';

describe('PO Vendor Resolution Property Tests', () => {
  it('line-level values override header-level values with symmetric behavior', () => {
    const idArb = fc.option(fc.uuid(), { nil: null });
    const valueArb = fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null });

    fc.assert(
      fc.property(idArb, valueArb, idArb, valueArb, (lineId, lineValue, headerId, headerValue) => {
        const resolvedVendor = resolveEffectiveVendor(lineId, lineValue, headerId, headerValue);
        const resolvedCostCenter = resolveEffectiveCostCenter(
          lineId,
          lineValue,
          headerId,
          headerValue
        );

        const expectedId = lineId ?? headerId ?? null;
        const expectedValue = lineId ? lineValue : headerId ? headerValue : null;

        return (
          resolvedVendor.vendorId === expectedId &&
          resolvedVendor.vendorName === expectedValue &&
          resolvedCostCenter.costCenterId === expectedId &&
          resolvedCostCenter.costCenterCode === expectedValue
        );
      }),
      { numRuns: 100 }
    );
  });
});

