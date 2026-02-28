/**
 * Security Service Tests
 * 
 * Tests for the main security service combining IP allowlisting,
 * suspicious activity detection, and security alerts.
 * 
 * Implements Requirements 14.9 and 14.10
 */

import {
  type AuthContext,
  createSecurityService,
  DEFAULT_SECURITY_CONFIG,
  type IpAllowlistConfig,
  resetStores,
  ROLES,
  SecurityService,
  SUSPICIOUS_ACTIVITY_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS,
} from '../index';

// Reset stores before each test
beforeEach(() => {
  resetStores();
});

// Helper to create a mock auth context
function createMockAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    user: {
      sub: 'test-user-id',
      email: 'test@example.com',
      roles: [ROLES.VIEWER],
      permissions: [],
    },
    requestId: 'test-request-id',
    sourceIp: '192.168.1.100',
    userAgent: 'test-agent',
    tokenExpiration: Math.floor(Date.now() / 1000) + 3600,
    isAuthenticated: true,
    ...overrides,
  };
}

// Helper to create IP allowlist config
function createIpAllowlistConfig(overrides: Partial<IpAllowlistConfig> = {}): IpAllowlistConfig {
  return {
    enabled: true,
    entries: [
      {
        id: '1',
        ipAddress: '192.168.1.0/24',
        description: 'Office network',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
    ],
    allowWhenEmpty: false,
    protectedRoles: [ROLES.ADMIN],
    ...overrides,
  };
}

describe('SecurityService', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const service = new SecurityService();
      const config = service.getConfig();
      expect(config.ipAllowlist.enabled).toBe(DEFAULT_SECURITY_CONFIG.ipAllowlist.enabled);
      expect(config.suspiciousActivity.enabled).toBe(DEFAULT_SECURITY_CONFIG.suspiciousActivity.enabled);
    });

    it('should merge custom config with defaults', () => {
      const service = new SecurityService({
        ipAllowlist: { 
          enabled: true,
          entries: [],
          allowWhenEmpty: true,
          protectedRoles: [],
        },
      });
      const config = service.getConfig();
      expect(config.ipAllowlist.enabled).toBe(true);
      expect(config.suspiciousActivity.enabled).toBe(true);
    });
  });

  describe('performSecurityChecks', () => {
    it('should pass for non-admin user from any IP', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1', // Not in allowlist
        user: {
          sub: 'user-1',
          email: 'user@example.com',
          roles: [ROLES.VIEWER],
          permissions: [],
        },
      });

      const result = service.performSecurityChecks(context);
      expect(result.passed).toBe(true);
    });

    it('should pass for admin user from allowed IP', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '192.168.1.100', // In allowlist
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      const result = service.performSecurityChecks(context);
      expect(result.passed).toBe(true);
    });

    it('should fail for admin user from blocked IP', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1', // Not in allowlist
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      const result = service.performSecurityChecks(context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not in the allowlist');
      expect(result.alerts.length).toBeGreaterThan(0);
    });

    it('should detect suspicious activities', () => {
      const service = new SecurityService({
        ipAllowlist: { enabled: false } as IpAllowlistConfig,
        suspiciousActivity: {
          enabled: true,
          maxFailedLoginAttempts: 5,
          failedLoginWindowSeconds: 300,
          maxRequestsPerMinute: 100,
          normalAccessHours: { start: 9, end: 17 },
          detectUnusualTime: true,
          detectIpChanges: true,
        },
      });

      // First request establishes session
      const context1 = createMockAuthContext({ sourceIp: '192.168.1.1' });
      service.performSecurityChecks(context1);

      // Second request from different IP
      const context2 = createMockAuthContext({ sourceIp: '10.0.0.1' });
      const result = service.performSecurityChecks(context2);

      const ipChangeActivity = result.suspiciousActivities.find(
        a => a.activityType === SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION
      );
      expect(ipChangeActivity).toBeDefined();
    });

    it('should create alerts for suspicious activities', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      const result = service.performSecurityChecks(context);
      expect(result.alerts.length).toBeGreaterThan(0);
      expect(result.alerts[0]?.activityType).toBe(SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS);
    });
  });

  describe('validateIp', () => {
    it('should validate IP against allowlist', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const allowedResult = service.validateIp('192.168.1.100');
      expect(allowedResult.allowed).toBe(true);

      const blockedResult = service.validateIp('10.0.0.1');
      expect(blockedResult.allowed).toBe(false);
    });
  });

  describe('isIpAllowedForAdmin', () => {
    it('should return true for allowed IP with admin role', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      expect(service.isIpAllowedForAdmin('192.168.1.100', [ROLES.ADMIN])).toBe(true);
    });

    it('should return false for blocked IP with admin role', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      expect(service.isIpAllowedForAdmin('10.0.0.1', [ROLES.ADMIN])).toBe(false);
    });

    it('should return true for any IP with non-admin role', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      expect(service.isIpAllowedForAdmin('10.0.0.1', [ROLES.VIEWER])).toBe(true);
    });
  });

  describe('recordFailedLogin', () => {
    it('should record failed login and not block under threshold', () => {
      const service = new SecurityService({
        suspiciousActivity: {
          enabled: true,
          maxFailedLoginAttempts: 5,
          failedLoginWindowSeconds: 300,
          maxRequestsPerMinute: 100,
          normalAccessHours: { start: 6, end: 22 },
          detectUnusualTime: false,
          detectIpChanges: false,
        },
      });

      const result = service.recordFailedLogin(
        '192.168.1.1',
        'user@example.com',
        'Invalid password'
      );

      expect(result.blocked).toBe(false);
      expect(result.activity).toBeUndefined();
    });

    it('should block when threshold exceeded', () => {
      const service = new SecurityService({
        suspiciousActivity: {
          enabled: true,
          maxFailedLoginAttempts: 2,
          failedLoginWindowSeconds: 300,
          maxRequestsPerMinute: 100,
          normalAccessHours: { start: 6, end: 22 },
          detectUnusualTime: false,
          detectIpChanges: false,
        },
      });

      service.recordFailedLogin('192.168.1.1', 'user@example.com', 'Invalid password');
      const result = service.recordFailedLogin('192.168.1.1', 'user@example.com', 'Invalid password');

      expect(result.blocked).toBe(true);
      expect(result.activity).toBeDefined();
      expect(result.alert).toBeDefined();
    });
  });

  describe('onSuccessfulLogin', () => {
    it('should clear failed login attempts', () => {
      const service = new SecurityService({
        suspiciousActivity: {
          enabled: true,
          maxFailedLoginAttempts: 2,
          failedLoginWindowSeconds: 300,
          maxRequestsPerMinute: 100,
          normalAccessHours: { start: 6, end: 22 },
          detectUnusualTime: false,
          detectIpChanges: false,
        },
      });

      service.recordFailedLogin('192.168.1.1', 'user@example.com', 'Invalid password');
      service.onSuccessfulLogin('192.168.1.1');

      // Should not block after clearing
      const result = service.recordFailedLogin('192.168.1.1', 'user@example.com', 'Invalid password');
      expect(result.blocked).toBe(false);
    });
  });

  describe('getAlerts', () => {
    it('should return all recorded alerts', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      service.performSecurityChecks(context);
      const alerts = service.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('getActivities', () => {
    it('should return all recorded activities', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      service.performSecurityChecks(context);
      const activities = service.getActivities();
      expect(activities.length).toBeGreaterThan(0);
    });
  });

  describe('getAlertsBySeverity', () => {
    it('should filter alerts by severity', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      service.performSecurityChecks(context);
      const criticalAlerts = service.getAlertsBySeverity(ALERT_SEVERITY.CRITICAL);
      expect(criticalAlerts.every(a => a.severity === ALERT_SEVERITY.CRITICAL)).toBe(true);
    });
  });

  describe('getAlertsByStatus', () => {
    it('should filter alerts by status', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      service.performSecurityChecks(context);
      const newAlerts = service.getAlertsByStatus(ALERT_STATUS.NEW);
      expect(newAlerts.every(a => a.status === ALERT_STATUS.NEW)).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all internal state', () => {
      const service = new SecurityService({
        ipAllowlist: createIpAllowlistConfig(),
      });

      const context = createMockAuthContext({
        sourceIp: '10.0.0.1',
        user: {
          sub: 'admin-1',
          email: 'admin@example.com',
          roles: [ROLES.ADMIN],
          permissions: [],
        },
      });

      service.performSecurityChecks(context);
      expect(service.getAlerts().length).toBeGreaterThan(0);

      service.reset();
      expect(service.getAlerts()).toHaveLength(0);
      expect(service.getActivities()).toHaveLength(0);
    });
  });
});

describe('createSecurityService', () => {
  it('should create a security service instance', () => {
    const service = createSecurityService();
    expect(service).toBeInstanceOf(SecurityService);
  });

  it('should accept custom configuration', () => {
    const service = createSecurityService({
      ipAllowlist: { enabled: true } as IpAllowlistConfig,
    });
    const config = service.getConfig();
    expect(config.ipAllowlist.enabled).toBe(true);
  });
});

describe('DEFAULT_SECURITY_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_SECURITY_CONFIG.ipAllowlist.enabled).toBe(false);
    expect(DEFAULT_SECURITY_CONFIG.suspiciousActivity.enabled).toBe(true);
  });
});
