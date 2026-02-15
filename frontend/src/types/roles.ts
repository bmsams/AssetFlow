/**
 * Role configuration types and constants for RBAC
 * Single source of truth for role priority, landing pages, and valid roles.
 */
import type { UserRole } from '../hooks/useAuth';

export type { UserRole } from '../hooks/useAuth';

/**
 * Role priority ordering (highest to lowest).
 * Used to determine landing page when a user has multiple roles.
 */
export const ROLE_PRIORITY: UserRole[] = [
  'admin',
  'asset_manager',
  'procurement_manager',
  'inventory_manager',
  'facilities_manager',
  'license_analyst',
  'auditor',
  'viewer',
];

/**
 * Landing page for each role. When a user has multiple roles,
 * the landing page of the highest-priority role wins.
 */
export const ROLE_LANDING_PAGES: Record<UserRole, string> = {
  admin: '/',
  asset_manager: '/',
  viewer: '/',
  inventory_manager: '/stockrooms',
  procurement_manager: '/procurement',
  license_analyst: '/licenses',
  facilities_manager: '/assets/enterprise',
  auditor: '/reports',
};

/**
 * Set of all valid role strings, used for filtering Cognito group claims.
 */
export const VALID_ROLES: Set<string> = new Set([
  'admin',
  'asset_manager',
  'inventory_manager',
  'procurement_manager',
  'license_analyst',
  'facilities_manager',
  'auditor',
  'viewer',
]);
