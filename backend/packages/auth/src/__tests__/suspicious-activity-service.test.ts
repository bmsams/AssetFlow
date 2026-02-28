/**
 * Suspicious Activity Service Tests
 * 
 * Tests for suspicious activity detection functionality (Requirement 14.10)
 */

import {
  type AuthContext,
  checkFailedLoginThreshold,
  checkIpChangeDuringSession,
  checkRateLimit,
  clearFailedLoginAttempts,
  clearSessionIp,
  createSecurityAlert,
  createSuspiciousActivity,
  DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
  detectSuspiciousActivity,
  getFailedLoginAttempts,
  getRecommendedActions,
  getSeverityForActivityType,
  isFailedLoginThresholdExceeded,
  isRateLimitExceeded,
  isUnusualAccessTime,
  recordFailedLoginAttempt,
  recordRequest,
  resetStores,
  ROLES,
  SUSPICIOUS_ACTIVITY_TYPES,
  SuspiciousActivityBlockedError,
  type SuspiciousActivityConfig,
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

describe('recordFailedLoginAttempt', () => {
  it('should record a failed login attempt', () => {
    const attempt = recordFailedLoginAttempt(
      '192.168.1.1',
      'user@example.com',
      'Invalid password',
      'Mozilla/5.0'
    );

    expect(attempt.sourceIp).toBe('192.168.1.1');
    expect(attempt.attemptedIdentity).toBe('user@example.com');
    expect(attempt.reason).toBe('Invalid password');
    expect(attempt.userAgent).toBe('Mozilla/5.0');
    expect(attempt.timestamp).toBeDefined();
  });
});

describe('getFailedLoginAttempts', () => {
  it('should return attempts within time window', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');

    const attempts = getFailedLoginAttempts('192.168.1.1', 300);
    expect(attempts).toHaveLength(2);
  });

  it('should return empty array for unknown IP', () => {
    const attempts = getFailedLoginAttempts('10.0.0.1', 300);
    expect(attempts).toHaveLength(0);
  });
});

describe('clearFailedLoginAttempts', () => {
  it('should clear attempts for an IP', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    expect(getFailedLoginAttempts('192.168.1.1', 300)).toHaveLength(1);

    clearFailedLoginAttempts('192.168.1.1');
    expect(getFailedLoginAttempts('192.168.1.1', 300)).toHaveLength(0);
  });
});

describe('isFailedLoginThresholdExceeded', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    maxFailedLoginAttempts: 3,
    failedLoginWindowSeconds: 300,
  };

  it('should return false when under threshold', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');

    expect(isFailedLoginThresholdExceeded('192.168.1.1', config)).toBe(false);
  });

  it('should return true when at or over threshold', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');

    expect(isFailedLoginThresholdExceeded('192.168.1.1', config)).toBe(true);
  });
});

describe('checkFailedLoginThreshold', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    maxFailedLoginAttempts: 2,
    failedLoginWindowSeconds: 300,
  };

  it('should not throw when under threshold', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    expect(() => checkFailedLoginThreshold('192.168.1.1', config)).not.toThrow();
  });

  it('should throw SuspiciousActivityBlockedError when threshold exceeded', () => {
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');

    expect(() => checkFailedLoginThreshold('192.168.1.1', config)).toThrow(
      SuspiciousActivityBlockedError
    );
  });

  it('should not throw when detection is disabled', () => {
    const disabledConfig = { ...config, enabled: false };
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');
    recordFailedLoginAttempt('192.168.1.1', 'user@example.com', 'Invalid password');

    expect(() => checkFailedLoginThreshold('192.168.1.1', disabledConfig)).not.toThrow();
  });
});

describe('recordRequest', () => {
  it('should return request count', () => {
    expect(recordRequest('192.168.1.1')).toBe(1);
    expect(recordRequest('192.168.1.1')).toBe(2);
    expect(recordRequest('192.168.1.1')).toBe(3);
  });

  it('should track different IPs separately', () => {
    expect(recordRequest('192.168.1.1')).toBe(1);
    expect(recordRequest('192.168.1.2')).toBe(1);
    expect(recordRequest('192.168.1.1')).toBe(2);
  });
});

describe('isRateLimitExceeded', () => {
  it('should return false when under limit', () => {
    recordRequest('192.168.1.1');
    recordRequest('192.168.1.1');
    expect(isRateLimitExceeded('192.168.1.1', 100)).toBe(false);
  });

  it('should return true when over limit', () => {
    for (let i = 0; i < 101; i++) {
      recordRequest('192.168.1.1');
    }
    expect(isRateLimitExceeded('192.168.1.1', 100)).toBe(true);
  });
});

describe('checkRateLimit', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    maxRequestsPerMinute: 5,
  };

  it('should not throw when under limit', () => {
    for (let i = 0; i < 5; i++) {
      recordRequest('192.168.1.1');
    }
    expect(() => checkRateLimit('192.168.1.1', config)).not.toThrow();
  });

  it('should throw SuspiciousActivityBlockedError when limit exceeded', () => {
    for (let i = 0; i < 6; i++) {
      recordRequest('192.168.1.1');
    }
    expect(() => checkRateLimit('192.168.1.1', config)).toThrow(SuspiciousActivityBlockedError);
  });
});

describe('isUnusualAccessTime', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    normalAccessHours: { start: 9, end: 17 },
    detectUnusualTime: true,
  };

  it('should return false during normal hours', () => {
    const normalTime = new Date();
    normalTime.setHours(12, 0, 0, 0);
    expect(isUnusualAccessTime(config, normalTime)).toBe(false);
  });

  it('should return true outside normal hours', () => {
    const earlyMorning = new Date();
    earlyMorning.setHours(3, 0, 0, 0);
    expect(isUnusualAccessTime(config, earlyMorning)).toBe(true);

    const lateNight = new Date();
    lateNight.setHours(23, 0, 0, 0);
    expect(isUnusualAccessTime(config, lateNight)).toBe(true);
  });

  it('should return false when detection is disabled', () => {
    const disabledConfig = { ...config, detectUnusualTime: false };
    const lateNight = new Date();
    lateNight.setHours(23, 0, 0, 0);
    expect(isUnusualAccessTime(disabledConfig, lateNight)).toBe(false);
  });
});

describe('checkIpChangeDuringSession', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    detectIpChanges: true,
  };

  it('should return changed: false for first request', () => {
    const result = checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    expect(result.changed).toBe(false);
    expect(result.previousIp).toBeUndefined();
  });

  it('should return changed: false when IP is same', () => {
    checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    const result = checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    expect(result.changed).toBe(false);
  });

  it('should return changed: true when IP changes', () => {
    checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    const result = checkIpChangeDuringSession('user-1', '10.0.0.1', config);
    expect(result.changed).toBe(true);
    expect(result.previousIp).toBe('192.168.1.1');
  });

  it('should track different users separately', () => {
    checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    const result = checkIpChangeDuringSession('user-2', '10.0.0.1', config);
    expect(result.changed).toBe(false);
  });

  it('should return changed: false when detection is disabled', () => {
    const disabledConfig = { ...config, detectIpChanges: false };
    checkIpChangeDuringSession('user-1', '192.168.1.1', disabledConfig);
    const result = checkIpChangeDuringSession('user-1', '10.0.0.1', disabledConfig);
    expect(result.changed).toBe(false);
  });
});

describe('clearSessionIp', () => {
  const config: SuspiciousActivityConfig = {
    ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
    detectIpChanges: true,
  };

  it('should clear session IP tracking', () => {
    checkIpChangeDuringSession('user-1', '192.168.1.1', config);
    clearSessionIp('user-1');
    
    // After clearing, first request should not show as changed
    const result = checkIpChangeDuringSession('user-1', '10.0.0.1', config);
    expect(result.changed).toBe(false);
  });
});

describe('createSuspiciousActivity', () => {
  it('should create a suspicious activity record', () => {
    const activity = createSuspiciousActivity(
      SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS,
      '192.168.1.1',
      { attemptCount: 5 },
      {
        userId: 'user-1',
        userEmail: 'user@example.com',
        requestId: 'req-123',
      }
    );

    expect(activity.id).toBeDefined();
    expect(activity.activityType).toBe(SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS);
    expect(activity.sourceIp).toBe('192.168.1.1');
    expect(activity.details).toEqual({ attemptCount: 5 });
    expect(activity.userId).toBe('user-1');
    expect(activity.userEmail).toBe('user@example.com');
    expect(activity.requestId).toBe('req-123');
    expect(activity.timestamp).toBeDefined();
  });
});

describe('getSeverityForActivityType', () => {
  it('should return CRITICAL for privilege escalation', () => {
    expect(getSeverityForActivityType(SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION)).toBe(
      ALERT_SEVERITY.CRITICAL
    );
  });

  it('should return HIGH for failed login attempts', () => {
    expect(getSeverityForActivityType(SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS)).toBe(
      ALERT_SEVERITY.HIGH
    );
  });

  it('should return MEDIUM for rate limit exceeded', () => {
    expect(getSeverityForActivityType(SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED)).toBe(
      ALERT_SEVERITY.MEDIUM
    );
  });

  it('should return LOW for unusual time', () => {
    expect(getSeverityForActivityType(SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME)).toBe(
      ALERT_SEVERITY.LOW
    );
  });
});

describe('getRecommendedActions', () => {
  it('should return actions for failed login attempts', () => {
    const actions = getRecommendedActions(SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.includes('failed login'))).toBe(true);
  });

  it('should return actions for privilege escalation', () => {
    const actions = getRecommendedActions(SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some(a => a.includes('investigate'))).toBe(true);
  });
});

describe('createSecurityAlert', () => {
  it('should create a security alert from activity', () => {
    const activity = createSuspiciousActivity(
      SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS,
      '192.168.1.1',
      { attemptCount: 5 },
      { userId: 'user-1', userEmail: 'user@example.com' }
    );

    const alert = createSecurityAlert(
      activity,
      'Multiple Failed Logins',
      'Too many failed login attempts detected'
    );

    expect(alert.id).toBeDefined();
    expect(alert.title).toBe('Multiple Failed Logins');
    expect(alert.description).toBe('Too many failed login attempts detected');
    expect(alert.severity).toBe(ALERT_SEVERITY.HIGH);
    expect(alert.status).toBe(ALERT_STATUS.NEW);
    expect(alert.activityType).toBe(SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS);
    expect(alert.relatedActivityIds).toContain(activity.id);
    expect(alert.userId).toBe('user-1');
    expect(alert.userEmail).toBe('user@example.com');
    expect(alert.sourceIp).toBe('192.168.1.1');
    expect(alert.recommendedActions.length).toBeGreaterThan(0);
  });
});

describe('detectSuspiciousActivity', () => {
  it('should return empty array when detection is disabled', () => {
    const config: SuspiciousActivityConfig = {
      ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
      enabled: false,
    };
    const context = createMockAuthContext();
    const activities = detectSuspiciousActivity(context, config);
    expect(activities).toHaveLength(0);
  });

  it('should detect unusual access time', () => {
    const config: SuspiciousActivityConfig = {
      ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
      normalAccessHours: { start: 9, end: 17 },
      detectUnusualTime: true,
    };

    // Mock Date to return a time outside normal hours (3 AM)
    const mockDate = new Date('2025-01-15T03:00:00Z');
    const originalDateNow = Date.now;
    const OriginalDate = Date;
    
    // Mock Date constructor and Date.now
    jest.spyOn(global, 'Date').mockImplementation((arg?: string | number | Date) => {
      if (arg === undefined) {
        return mockDate;
      }
      return new OriginalDate(arg);
    });
    (global.Date.now as jest.Mock) = jest.fn(() => mockDate.getTime());
    
    const context = createMockAuthContext();
    const activities = detectSuspiciousActivity(context, config);
    
    // Restore Date
    jest.restoreAllMocks();
    Date.now = originalDateNow;
    
    const unusualTimeActivity = activities.find(
      a => a.activityType === SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME
    );
    expect(unusualTimeActivity).toBeDefined();
  });

  it('should detect IP change during session', () => {
    const config: SuspiciousActivityConfig = {
      ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
      detectIpChanges: true,
      detectUnusualTime: false,
    };

    // Reset stores to ensure clean state
    resetStores();

    const context1 = createMockAuthContext({ sourceIp: '192.168.1.1' });
    detectSuspiciousActivity(context1, config);

    const context2 = createMockAuthContext({ sourceIp: '10.0.0.1' });
    const activities = detectSuspiciousActivity(context2, config);

    const ipChangeActivity = activities.find(
      a => a.activityType === SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION
    );
    expect(ipChangeActivity).toBeDefined();
    expect(ipChangeActivity?.details['previousIp']).toBe('192.168.1.1');
  });
});

describe('DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.enabled).toBe(true);
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.maxFailedLoginAttempts).toBe(5);
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.failedLoginWindowSeconds).toBe(300);
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.maxRequestsPerMinute).toBe(100);
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.normalAccessHours.start).toBe(6);
    expect(DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG.normalAccessHours.end).toBe(22);
  });
});
