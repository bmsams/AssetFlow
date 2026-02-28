/**
 * User Admin module exports
 *
 * Provides user administration operations including:
 * - User listing with filters (Requirement 12.1)
 * - User details retrieval (Requirement 12.2)
 * - User department/manager updates (Requirement 12.3)
 * - User activation/deactivation (Requirement 12.4, 12.5)
 * - Role assignment management (Requirement 12.6, 12.7)
 */

// Re-export types from @ams/types for convenience
export type {
  // User types
  User,
  UserContext,
  // Role types
  Role,
  UserRole,
  SystemRole,
  // Permission types
  Permission,
  RolePermission,
  PermissionAction,
  ResourceType,
} from '@ams/types';

// Repository exports will be added when implemented
// export * from './user-admin-repository';

// Service exports will be added when implemented
// export * from './user-admin-service';
