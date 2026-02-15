/**
 * Determines the landing page for a user based on their highest-priority role.
 */
import type { UserRole } from '../hooks/useAuth';
import { ROLE_PRIORITY, ROLE_LANDING_PAGES } from '../types/roles';

export function getLandingPage(userRoles: UserRole[]): string {
  for (const role of ROLE_PRIORITY) {
    if (userRoles.includes(role)) {
      return ROLE_LANDING_PAGES[role];
    }
  }
  return '/';
}
