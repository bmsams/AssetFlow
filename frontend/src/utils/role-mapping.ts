/**
 * Extracts user roles from a Cognito ID token's group claims.
 * Filters to valid AMS roles and defaults to ['viewer'] when no valid roles are found.
 */
import type { UserRole } from '../hooks/useAuth';
import { VALID_ROLES } from '../types/roles';

export function extractRolesFromToken(idToken: string | null): UserRole[] {
  if (!idToken) return ['viewer'];

  try {
    const base64Url = idToken.split('.')[1];
    if (!base64Url) return ['viewer'];

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );

    const groups: string[] = payload['cognito:groups'] || [];
    const roles = groups.filter((g) => VALID_ROLES.has(g)) as UserRole[];
    return roles.length > 0 ? roles : ['viewer'];
  } catch {
    return ['viewer'];
  }
}
