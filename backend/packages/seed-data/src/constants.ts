/**
 * Shared Constants for Seed Data
 */

/** Asset lifecycle states for distribution */
export const LIFECYCLE_STATES = [
  'ORDERED',
  'RECEIVED',
  'IN_STOCK',
  'RESERVED',
  'DEPLOYED',
  'IN_MAINTENANCE',
  'RETIRED',
  'DISPOSED',
] as const;

export type LifecycleState = typeof LIFECYCLE_STATES[number];

/** Asset counts by lifecycle state for hardware asset generation */
export const ASSET_COUNTS_BY_STATE: Record<string, number> = {
  DEPLOYED: 15,
  IN_STOCK: 10,
  DEFAULT: 5,
};

/** Department codes for asset assignment */
export const DEPARTMENT_CODES = ['IT', 'FIN', 'HR', 'OPS', 'ENG', 'SALES', 'MKT'] as const;

/** Stockroom codes for inventory */
export const STOCKROOM_CODES = ['MAIN-WH', 'IT-CLOSET', 'REMOTE-1', 'REPAIR-CTR'] as const;

/** Assignable user emails for deployed assets */
export const ASSIGNABLE_USERS = [
  'engineer1@example.com',
  'engineer2@example.com',
  'sales.rep@example.com',
  'marketing@example.com',
  'viewer@example.com',
] as const;

/** Warranty periods in months */
export const WARRANTY_PERIODS = [12, 24, 36, 48] as const;
