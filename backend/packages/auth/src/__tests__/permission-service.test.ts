/**
 * Permission Service Tests
 */

import {
  authorize,
  authorizeOperation,
  type AuthContext,
  AuthorizationError,
  createAuthorizationAuditEntry,
  getMissingPermissions,
  getOperationPermissions,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isValidPermission,
  PERMISSIONS,
  requireOperation,
  requirePermissions,
  ROLES,
} from '../index';

// Helper to create a mock auth context
function createMockAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    user: {
      sub: 'test-user-id',
      email: 'test@example.com',
      roles: [ROLES.VIEWER],
      permissions: [PERMISSIONS.ASSET_READ, PERMISSIONS.INVENTORY_READ],
    },
    requestId: 'test-request-id',
    sourceIp: '127.0.0.1',
    userAgent: 'test-agent',
    tokenExpiration: Math.floor(Date.now() / 1000) + 3600,
    isAuthenticated: true,
    ...overrides,
  };
}

describe('isValidPermission', () => {
  it('should return true for valid permissions', () => {
    expect(isValidPermission('asset:read')).toBe(true);
    expect(isValidPermission('asset:create')).toBe(true);
    expect(isValidPermission('admin:users')).toBe(true);
  });

  it('should return false for invalid permissions', () => {
    expect(isValidPermission('invalid:permission')).toBe(false);
    expect(isValidPermission('')).toBe(false);
    expect(isValidPermission('ASSET_READ')).toBe(false);
  });
});

describe('hasPermission', () => {
  it('should return true when user has permission', () => {
    const permissions = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE];
    expect(hasPermission(permissions, PERMISSIONS.ASSET_READ)).toBe(true);
  });

  it('should return false when user lacks permission', () => {
    const permissions = [PERMISSIONS.ASSET_READ];
    expect(hasPermission(permissions, PERMISSIONS.ASSET_CREATE)).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  it('should return true when user has all permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_UPDATE];
    const required = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE];
    expect(hasAllPermissions(userPermissions, required)).toBe(true);
  });

  it('should return false when user lacks any permission', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    const required = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE];
    expect(hasAllPermissions(userPermissions, required)).toBe(false);
  });

  it('should return true for empty required permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    expect(hasAllPermissions(userPermissions, [])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  it('should return true when user has any permission', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    const required = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE];
    expect(hasAnyPermission(userPermissions, required)).toBe(true);
  });

  it('should return false when user has none of the permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    const required = [PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_DELETE];
    expect(hasAnyPermission(userPermissions, required)).toBe(false);
  });

  it('should return true for empty required permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    expect(hasAnyPermission(userPermissions, [])).toBe(true);
  });
});

describe('getMissingPermissions', () => {
  it('should return missing permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ];
    const required = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_DELETE];
    const missing = getMissingPermissions(userPermissions, required);
    
    expect(missing).toContain(PERMISSIONS.ASSET_CREATE);
    expect(missing).toContain(PERMISSIONS.ASSET_DELETE);
    expect(missing).not.toContain(PERMISSIONS.ASSET_READ);
  });

  it('should return empty array when user has all permissions', () => {
    const userPermissions = [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE];
    const required = [PERMISSIONS.ASSET_READ];
    const missing = getMissingPermissions(userPermissions, required);
    
    expect(missing).toEqual([]);
  });
});

describe('authorize', () => {
  it('should allow authenticated user with required permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.ASSET_MANAGER],
        permissions: [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE],
      },
    });

    const result = authorize(context, [PERMISSIONS.ASSET_READ]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('User has required permissions');
  });

  it('should deny unauthenticated user', () => {
    const context = createMockAuthContext({ isAuthenticated: false });

    const result = authorize(context, [PERMISSIONS.ASSET_READ]);

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('User is not authenticated');
  });

  it('should deny user without required permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.VIEWER],
        permissions: [PERMISSIONS.ASSET_READ],
      },
    });

    const result = authorize(context, [PERMISSIONS.ASSET_CREATE]);

    expect(result.allowed).toBe(false);
    expect(result.missingPermissions).toContain(PERMISSIONS.ASSET_CREATE);
  });

  it('should allow admin to bypass permission checks', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'admin-user',
        email: 'admin@example.com',
        roles: [ROLES.ADMIN],
        permissions: [], // Even with no explicit permissions
      },
    });

    const result = authorize(context, [PERMISSIONS.ADMIN_USERS, PERMISSIONS.ADMIN_ROLES]);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('Admin role has full access');
  });

  it('should allow when no permissions required', () => {
    const context = createMockAuthContext();

    const result = authorize(context, []);

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('No permissions required');
  });

  it('should check any permission when requireAll is false', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.VIEWER],
        permissions: [PERMISSIONS.ASSET_READ],
      },
    });

    const result = authorize(
      context,
      [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE],
      { requireAll: false }
    );

    expect(result.allowed).toBe(true);
  });
});

describe('requirePermissions', () => {
  it('should not throw when user has permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.ASSET_MANAGER],
        permissions: [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE],
      },
    });

    expect(() => requirePermissions(context, [PERMISSIONS.ASSET_READ])).not.toThrow();
  });

  it('should throw AuthorizationError when user lacks permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.VIEWER],
        permissions: [PERMISSIONS.ASSET_READ],
      },
    });

    expect(() => requirePermissions(context, [PERMISSIONS.ADMIN_USERS])).toThrow(
      AuthorizationError
    );
  });
});

describe('createAuthorizationAuditEntry', () => {
  it('should create audit entry with all fields', () => {
    const context = createMockAuthContext();
    const entry = createAuthorizationAuditEntry(
      context,
      '/assets/123',
      'GET',
      [PERMISSIONS.ASSET_READ],
      'ALLOWED',
      'User has required permissions'
    );

    expect(entry.requestId).toBe('test-request-id');
    expect(entry.userId).toBe('test-user-id');
    expect(entry.userEmail).toBe('test@example.com');
    expect(entry.resource).toBe('/assets/123');
    expect(entry.action).toBe('GET');
    expect(entry.requiredPermissions).toContain(PERMISSIONS.ASSET_READ);
    expect(entry.decision).toBe('ALLOWED');
    expect(entry.reason).toBe('User has required permissions');
    expect(entry.sourceIp).toBe('127.0.0.1');
    expect(entry.timestamp).toBeDefined();
  });
});

describe('getOperationPermissions', () => {
  it('should return permissions for asset operations', () => {
    expect(getOperationPermissions('asset:list')).toContain(PERMISSIONS.ASSET_READ);
    expect(getOperationPermissions('asset:create')).toContain(PERMISSIONS.ASSET_CREATE);
    expect(getOperationPermissions('asset:update')).toContain(PERMISSIONS.ASSET_UPDATE);
    expect(getOperationPermissions('asset:delete')).toContain(PERMISSIONS.ASSET_DELETE);
  });

  it('should return permissions for admin operations', () => {
    expect(getOperationPermissions('admin:users:list')).toContain(PERMISSIONS.ADMIN_USERS);
    expect(getOperationPermissions('admin:roles:manage')).toContain(PERMISSIONS.ADMIN_ROLES);
  });
});

describe('authorizeOperation', () => {
  it('should authorize operation when user has permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.ASSET_MANAGER],
        permissions: [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE],
      },
    });

    const result = authorizeOperation(context, 'asset:create');

    expect(result.allowed).toBe(true);
  });

  it('should deny operation when user lacks permissions', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.VIEWER],
        permissions: [PERMISSIONS.ASSET_READ],
      },
    });

    const result = authorizeOperation(context, 'asset:create');

    expect(result.allowed).toBe(false);
  });
});

describe('requireOperation', () => {
  it('should not throw when user can perform operation', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.ASSET_MANAGER],
        permissions: [PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_CREATE],
      },
    });

    expect(() => requireOperation(context, 'asset:create')).not.toThrow();
  });

  it('should throw when user cannot perform operation', () => {
    const context = createMockAuthContext({
      user: {
        sub: 'test-user',
        email: 'test@example.com',
        roles: [ROLES.VIEWER],
        permissions: [PERMISSIONS.ASSET_READ],
      },
    });

    expect(() => requireOperation(context, 'admin:users:manage')).toThrow(
      AuthorizationError
    );
  });
});
