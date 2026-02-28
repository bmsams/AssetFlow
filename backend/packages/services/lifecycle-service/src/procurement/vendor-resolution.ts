/**
 * Vendor Resolution Utility
 *
 * Implements Coupa-style vendor resolution:
 * line-level vendor takes precedence over header-level.
 *
 * Requirements: 1.3, 5.2, 5.3
 */

import type { UUID } from '@ams/types';

export interface VendorRef {
  readonly vendorId: UUID | null;
  readonly vendorName: string | null;
}

/**
 * Resolve the effective vendor for a PO line.
 *
 * Precedence:
 *   1. Line-level vendor (if non-null)
 *   2. Header-level vendor (if non-null)
 *   3. null (unassigned)
 */
export function resolveEffectiveVendor(
  lineVendorId: UUID | null,
  lineVendorName: string | null,
  headerVendorId: UUID | null,
  headerVendorName: string | null
): VendorRef {
  if (lineVendorId) {
    return { vendorId: lineVendorId, vendorName: lineVendorName };
  }
  if (headerVendorId) {
    return { vendorId: headerVendorId, vendorName: headerVendorName };
  }
  return { vendorId: null, vendorName: null };
}
