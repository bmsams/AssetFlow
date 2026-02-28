/**
 * Suspicious Activity Detection Service
 * 
 * Implements detection and blocking of suspicious activity patterns.
 * Based on Requirement 14.10: THE Security_Service SHALL detect and block suspicious activity patterns
 */

import { createLogger } from '@ams/utils';

import type { AuthContext } from './auth-types';
import {
  ALERT_SEVERITY,
  type AlertSeverity,
  type FailedLoginAttempt,
  type SecurityAlert,
  type SuspiciousActivity,
  type SuspiciousActivityConfig,
  SUSPICIOUS_ACTIVITY_TYPES,
  type SuspiciousActivityType,
  SuspiciousActivityBlockedError,
  ALERT_STATUS,
} from './security-types';

const logger = createLogger({ service: 'suspicious-activity-service' });

/**
 * Default configuration for suspicious activity detection
 */
export const DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG: SuspiciousActivityConfig = {
  enabled: true,
  maxFailedLoginAttempts: 5,
  failedLoginWindowSeconds: 300, // 5 minutes
  maxRequestsPerMinute: 100,
  normalAccessHours: {
    start: 6, // 6 AM
    end: 22, // 10 PM
  },
  detectUnusualTime: true,
  detectIpChanges: true,
};

/**
 * In-memory store for failed login attempts (in production, use Redis)
 * Key: IP address, Value: array of attempts
 */
const failedLoginAttempts = new Map<string, FailedLoginAttempt[]>();

/**
 * In-memory store for request counts (in production, use Redis)
 * Key: IP address, Value: { count, windowStart }
 */
const requestCounts = new Map<string, { count: number; windowStart: number }>();

/**
 * In-memory store for session IPs (in production, use Redis)
 * Key: user ID, Value: last known IP
 */
const sessionIps = new Map<string, string>();

/**
 * Record a failed login attempt
 */
export function recordFailedLoginAttempt(
  sourceIp: string,
  attemptedIdentity: string,
  reason: string,
  userAgent?: string
): FailedLoginAttempt {
  const attempt: FailedLoginAttempt = {
    sourceIp,
    attemptedIdentity,
    timestamp: new Date().toISOString(),
    reason,
    userAgent,
  };

  const attempts = failedLoginAttempts.get(sourceIp) ?? [];
  attempts.push(attempt);
  failedLoginAttempts.set(sourceIp, attempts);

  logger.warn('Failed login attempt recorded', {
    sourceIp,
    attemptedIdentity,
    reason,
    totalAttempts: attempts.length,
  });

  return attempt;
}

/**
 * Get failed login attempts for an IP within the time window
 */
export function getFailedLoginAttempts(
  sourceIp: string,
  windowSeconds: number
): FailedLoginAttempt[] {
  const attempts = failedLoginAttempts.get(sourceIp) ?? [];
  const cutoff = new Date(Date.now() - windowSeconds * 1000);

  return attempts.filter(attempt => new Date(attempt.timestamp) > cutoff);
}

/**
 * Clear failed login attempts for an IP (e.g., after successful login)
 */
export function clearFailedLoginAttempts(sourceIp: string): void {
  failedLoginAttempts.delete(sourceIp);
  logger.debug('Cleared failed login attempts', { sourceIp });
}

/**
 * Check if failed login threshold is exceeded
 */
export function isFailedLoginThresholdExceeded(
  sourceIp: string,
  config: SuspiciousActivityConfig
): boolean {
  const attempts = getFailedLoginAttempts(sourceIp, config.failedLoginWindowSeconds);
  return attempts.length >= config.maxFailedLoginAttempts;
}

/**
 * Record a request for rate limiting
 */
export function recordRequest(sourceIp: string): number {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // Start of current minute

  const current = requestCounts.get(sourceIp);

  if (!current || current.windowStart !== windowStart) {
    // New window
    requestCounts.set(sourceIp, { count: 1, windowStart });
    return 1;
  }

  // Same window, increment
  current.count++;
  return current.count;
}

/**
 * Check if rate limit is exceeded
 */
export function isRateLimitExceeded(
  sourceIp: string,
  maxRequestsPerMinute: number
): boolean {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000;

  const current = requestCounts.get(sourceIp);
  if (!current || current.windowStart !== windowStart) {
    return false;
  }

  return current.count > maxRequestsPerMinute;
}

/**
 * Check if access is during unusual hours
 */
export function isUnusualAccessTime(
  config: SuspiciousActivityConfig,
  timestamp?: Date
): boolean {
  if (!config.detectUnusualTime) {
    return false;
  }

  const date = timestamp ?? new Date();
  const hour = date.getHours();

  return hour < config.normalAccessHours.start || hour >= config.normalAccessHours.end;
}

/**
 * Check for IP change during session
 */
export function checkIpChangeDuringSession(
  userId: string,
  currentIp: string,
  config: SuspiciousActivityConfig
): { changed: boolean; previousIp?: string } {
  if (!config.detectIpChanges) {
    return { changed: false };
  }

  const previousIp = sessionIps.get(userId);

  if (!previousIp) {
    // First request in session
    sessionIps.set(userId, currentIp);
    return { changed: false };
  }

  if (previousIp !== currentIp) {
    // IP changed during session
    sessionIps.set(userId, currentIp);
    return { changed: true, previousIp };
  }

  return { changed: false };
}

/**
 * Clear session IP tracking for a user (e.g., on logout)
 */
export function clearSessionIp(userId: string): void {
  sessionIps.delete(userId);
}

/**
 * Create a suspicious activity record
 */
export function createSuspiciousActivity(
  activityType: SuspiciousActivityType,
  sourceIp: string,
  details: Record<string, unknown>,
  options: {
    userId?: string;
    userEmail?: string;
    userAgent?: string;
    requestPath?: string;
    httpMethod?: string;
    requestId?: string;
  } = {}
): SuspiciousActivity {
  const activity: SuspiciousActivity = {
    id: crypto.randomUUID(),
    activityType,
    sourceIp,
    timestamp: new Date().toISOString(),
    details,
    ...options,
  };

  logger.warn('Suspicious activity detected', {
    activityId: activity.id,
    activityType,
    sourceIp,
    userId: options.userId,
    details,
  });

  return activity;
}

/**
 * Get severity for an activity type
 */
export function getSeverityForActivityType(activityType: SuspiciousActivityType): AlertSeverity {
  switch (activityType) {
    case SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
    case SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
      return ALERT_SEVERITY.CRITICAL;
    case SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
    case SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
      return ALERT_SEVERITY.HIGH;
    case SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
    case SUSPICIOUS_ACTIVITY_TYPES.SENSITIVE_RESOURCE_ACCESS:
    case SUSPICIOUS_ACTIVITY_TYPES.CONCURRENT_SESSIONS:
      return ALERT_SEVERITY.MEDIUM;
    case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_LOCATION:
    case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
      return ALERT_SEVERITY.LOW;
    default:
      return ALERT_SEVERITY.MEDIUM;
  }
}

/**
 * Get recommended actions for an activity type
 */
export function getRecommendedActions(activityType: SuspiciousActivityType): string[] {
  switch (activityType) {
    case SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
      return [
        'Review failed login attempts for the IP address',
        'Consider temporarily blocking the IP if attacks continue',
        'Verify if the user account exists and is active',
        'Check for credential stuffing patterns',
      ];
    case SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
      return [
        'Immediately investigate the user account',
        'Review recent permission changes',
        'Check for unauthorized role assignments',
        'Consider disabling the account pending investigation',
      ];
    case SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
      return [
        'Verify if the user is using a VPN or mobile network',
        'Contact the user to confirm the access is legitimate',
        'Review session activity for suspicious actions',
      ];
    case SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
      return [
        'Check if the requests are from a legitimate automation',
        'Review the request patterns for potential abuse',
        'Consider implementing stricter rate limits',
      ];
    case SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
      return [
        'Verify the IP block is still appropriate',
        'Check if a legitimate user is affected',
        'Review the original reason for blocking',
      ];
    case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
      return [
        'Verify if the user is in a different timezone',
        'Check if the access pattern is consistent with user behavior',
        'Contact the user to confirm the access',
      ];
    default:
      return [
        'Review the activity details',
        'Investigate the source IP and user',
        'Monitor for additional suspicious activity',
      ];
  }
}

/**
 * Create a security alert from suspicious activity
 */
export function createSecurityAlert(
  activity: SuspiciousActivity,
  title: string,
  description: string
): SecurityAlert {
  const severity = getSeverityForActivityType(activity.activityType);
  const recommendedActions = getRecommendedActions(activity.activityType);

  const alert: SecurityAlert = {
    id: crypto.randomUUID(),
    title,
    description,
    severity,
    status: ALERT_STATUS.NEW,
    activityType: activity.activityType,
    relatedActivityIds: [activity.id],
    userId: activity.userId,
    userEmail: activity.userEmail,
    sourceIp: activity.sourceIp,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recommendedActions,
  };

  logger.warn('Security alert created', {
    alertId: alert.id,
    title,
    severity,
    activityType: activity.activityType,
    sourceIp: activity.sourceIp,
    userId: activity.userId,
  });

  return alert;
}

/**
 * Detect suspicious activity from an auth context
 */
export function detectSuspiciousActivity(
  context: AuthContext,
  config: SuspiciousActivityConfig,
  options: {
    requestPath?: string;
    httpMethod?: string;
  } = {}
): SuspiciousActivity[] {
  if (!config.enabled) {
    return [];
  }

  const activities: SuspiciousActivity[] = [];
  const sourceIp = context.sourceIp ?? 'unknown';

  // Check for unusual access time
  if (isUnusualAccessTime(config)) {
    activities.push(
      createSuspiciousActivity(
        SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME,
        sourceIp,
        {
          accessTime: new Date().toISOString(),
          normalHours: config.normalAccessHours,
        },
        {
          userId: context.user.sub,
          userEmail: context.user.email,
          userAgent: context.userAgent,
          requestPath: options.requestPath,
          httpMethod: options.httpMethod,
          requestId: context.requestId,
        }
      )
    );
  }

  // Check for IP change during session
  if (context.user.sub && sourceIp !== 'unknown') {
    const ipCheck = checkIpChangeDuringSession(context.user.sub, sourceIp, config);
    if (ipCheck.changed) {
      activities.push(
        createSuspiciousActivity(
          SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION,
          sourceIp,
          {
            previousIp: ipCheck.previousIp,
            currentIp: sourceIp,
          },
          {
            userId: context.user.sub,
            userEmail: context.user.email,
            userAgent: context.userAgent,
            requestPath: options.requestPath,
            httpMethod: options.httpMethod,
            requestId: context.requestId,
          }
        )
      );
    }
  }

  // Check rate limit
  if (sourceIp !== 'unknown') {
    const requestCount = recordRequest(sourceIp);
    if (requestCount > config.maxRequestsPerMinute) {
      activities.push(
        createSuspiciousActivity(
          SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED,
          sourceIp,
          {
            requestCount,
            limit: config.maxRequestsPerMinute,
          },
          {
            userId: context.user.sub,
            userEmail: context.user.email,
            userAgent: context.userAgent,
            requestPath: options.requestPath,
            httpMethod: options.httpMethod,
            requestId: context.requestId,
          }
        )
      );
    }
  }

  return activities;
}

/**
 * Check and block if failed login threshold is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
export function checkFailedLoginThreshold(
  sourceIp: string,
  config: SuspiciousActivityConfig
): void {
  if (!config.enabled) {
    return;
  }

  if (isFailedLoginThresholdExceeded(sourceIp, config)) {
    const attempts = getFailedLoginAttempts(sourceIp, config.failedLoginWindowSeconds);
    
    logger.warn('Failed login threshold exceeded, blocking access', {
      sourceIp,
      attemptCount: attempts.length,
      threshold: config.maxFailedLoginAttempts,
      windowSeconds: config.failedLoginWindowSeconds,
    });

    throw new SuspiciousActivityBlockedError(
      `Too many failed login attempts from IP ${sourceIp}. Please try again later.`,
      SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS
    );
  }
}

/**
 * Check and block if rate limit is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
export function checkRateLimit(
  sourceIp: string,
  config: SuspiciousActivityConfig
): void {
  if (!config.enabled) {
    return;
  }

  if (isRateLimitExceeded(sourceIp, config.maxRequestsPerMinute)) {
    logger.warn('Rate limit exceeded, blocking request', {
      sourceIp,
      limit: config.maxRequestsPerMinute,
    });

    throw new SuspiciousActivityBlockedError(
      'Rate limit exceeded. Please slow down your requests.',
      SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED
    );
  }
}

/**
 * Reset all in-memory stores (for testing)
 */
export function resetStores(): void {
  failedLoginAttempts.clear();
  requestCounts.clear();
  sessionIps.clear();
}
