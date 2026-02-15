/**
 * Navigation filtering utilities for role-based sidebar visibility.
 * Filters navigation groups so users only see items they have access to.
 */
import type { UserRole } from '../hooks/useAuth';

/** A navigation item that may carry an optional roles restriction. */
export interface RoleAwareNavItem {
  path: string;
  label: string;
  icon?: React.ReactNode;
  roles?: UserRole[];
}

/** A group of role-aware navigation items. */
export interface RoleAwareNavGroup {
  title: string;
  items: RoleAwareNavItem[];
}

/**
 * Filters navigation groups by the current user's roles.
 * - Items with no `roles` field are visible to all authenticated users.
 * - Items with a `roles` field are visible only if the user has at least one matching role.
 * - Groups with no remaining visible items are removed entirely.
 */
export function filterNavGroupsByRoles(
  groups: RoleAwareNavGroup[],
  userRoles: UserRole[]
): RoleAwareNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !item.roles || item.roles.some((role) => userRoles.includes(role))
      ),
    }))
    .filter((group) => group.items.length > 0);
}
