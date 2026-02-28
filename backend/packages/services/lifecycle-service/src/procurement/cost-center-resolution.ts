/**
 * Cost Center Resolution Utility
 *
 * Implements Coupa-style cost center resolution:
 * line-level cost center takes precedence over header-level.
 *
 * Requirements: 6.3, 6.4, 8.1, 8.2, 8.3
 */

import type { UUID } from '@ams/types';

export interface CostCenterRef {
  readonly costCenterId: UUID | null;
  readonly costCenterCode: string | null;
}

/**
 * Resolve the effective cost center for a PO line.
 *
 * Precedence:
 *   1. Line-level cost center (if non-null)
 *   2. Header-level cost center (if non-null)
 *   3. null (unassigned)
 */
export function resolveEffectiveCostCenter(
  lineCostCenterId: UUID | null,
  lineCostCenterCode: string | null,
  headerCostCenterId: UUID | null,
  headerCostCenterCode: string | null
): CostCenterRef {
  if (lineCostCenterId) {
    return { costCenterId: lineCostCenterId, costCenterCode: lineCostCenterCode };
  }
  if (headerCostCenterId) {
    return { costCenterId: headerCostCenterId, costCenterCode: headerCostCenterCode };
  }
  return { costCenterId: null, costCenterCode: null };
}
