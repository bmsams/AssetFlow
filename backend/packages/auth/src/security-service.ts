/**
 * Security Service
 * 
 * Main service combining IP allowlisting, suspicious activity detection,
 * and security alert generation.
 * 
 * Implements Requirements 14.9 and 14.10:
 * - 14.9: THE Security_Service SHALL implement IP allowlisting for administrative access
 * - 14.10: THE Security_Service SHALL detect and block suspicious activity patterns
 */

import { createLogger } from '@ams/utils';

import type { AuthContext, Role } from './auth-types';
import {
  DEFAULT_IP_ALLOWLIST_CONFIG,
  requireIpAllowlist,
  validateIpAllowlist,
  createIpAllowlistEntry,
  getActiveEntries,
  isValidIpAddress,
  isValidCidr,
} from './ip-allowlist-service';
import {
  DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
  detectSuspiciousActivity,
  checkFailedLoginThreshold,
  checkRateLimit,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  clearSessionIp,
  createSecurityAlert,
  createSuspiciousActivity,
  getSeverityForActivityType,
  getRecommendedActions,
  resetStores,
} from './suspicious-activity-service';
import {
  type IpAllowlistConfig,
  type IpAllowlistResult,
  type IpAllowlistEntry,
  type SuspiciousActivityConfig,
  type SecurityAlert,
  type SecurityEvent,
  type SuspiciousActivity,
  type SuspiciousActivityType,
  IpNotAllowedError,
  SuspiciousActivityBlockedError,
  SUSPICIOUS_ACTIVITY_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS,
} from './security-types';

const logger = createLogger({ service: 'security-service' });

/**
 * Combined security configuration
 */
export interface SecurityConfig {
  /** IP allowlist configuration */
  readonly ipAllowlist: IpAllowlistConfig;
  /** Suspicious activity detection configuration */
  readonly suspiciousActivity: SuspiciousActivityConfig;
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  ipAllowlist: DEFAULT_IP_ALLOWLIST_CONFIG,
  suspiciousActivity: DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
};

/**
 * Security check result
 */
export interface SecurityCheckResult {
  /** Whether the request passed all security checks */
  readonly passed: boolean;
  /** Reason for failure (if any) */
  readonly reason?: string;
  /** IP allowlist validation result */
  readonly ipAllowlistResult?: IpAllowlistResult;
  /** Detected suspicious activities */
  readonly suspiciousActivities: SuspiciousActivity[];
  /** Generated security alerts */
  readonly alerts: SecurityAlert[];
}

/**
 * Security Service class for managing all security controls
 */
export class SecurityService {
  private readonly config: SecurityConfig;
  private readonly alerts: SecurityAlert[] = [];
  private readonly activities: SuspiciousActivity[] = [];

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      ipAllowlist: { ...DEFAULT_IP_ALLOWLIST_CONFIG, ...config.ipAllowlist },
      suspiciousActivity: { ...DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG, ...config.suspiciousActivity },
    };
  }

  /**
   * Perform all security checks for a request
   */
  performSecurityChecks(
    context: AuthContext,
    options: {
      requestPath?: string;
      httpMethod?: string;
    } = {}
  ): SecurityCheckResult {
    const sourceIp = context.sourceIp ?? 'unknown';
    const suspiciousActivities: SuspiciousActivity[] = [];
    const alerts: SecurityAlert[] = [];

    try {
      // Check IP allowlist for admin access
      if (context.isAuthenticated) {
        requireIpAllowlist(
          sourceIp,
          context.user.roles,
          this.config.ipAllowlist,
          context.requestId
        );
      }

      // Check rate limit
      checkRateLimit(sourceIp, this.config.suspiciousActivity);

      // Detect suspicious activity
      const detected = detectSuspiciousActivity(context, this.config.suspiciousActivity, options);
      suspiciousActivities.push(...detected);

      // Create alerts for detected activities
      for (const activity of detected) {
        const alert = this.createAlertForActivity(activity);
        alerts.push(alert);
        this.alerts.push(alert);
      }

      // Store activities
      this.activities.push(...suspiciousActivities);

      return {
        passed: true,
        suspiciousActivities,
        alerts,
      };
    } catch (error) {
      if (error instanceof IpNotAllowedError) {
        // Create activity and alert for blocked IP
        const activity = createSuspiciousActivity(
          SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS,
          sourceIp,
          { reason: error.message },
          {
            userId: context.user.sub,
            userEmail: context.user.email,
            requestId: context.requestId,
          }
        );
        suspiciousActivities.push(activity);
        this.activities.push(activity);

        const alert = this.createAlertForActivity(activity);
        alerts.push(alert);
        this.alerts.push(alert);

        return {
          passed: false,
          reason: error.message,
          suspiciousActivities,
          alerts,
        };
      }

      if (error instanceof SuspiciousActivityBlockedError) {
        return {
          passed: false,
          reason: error.message,
          suspiciousActivities,
          alerts,
        };
      }

      throw error;
    }
  }

  /**
   * Validate IP against allowlist
   */
  validateIp(sourceIp: string): IpAllowlistResult {
    return validateIpAllowlist(sourceIp, this.config.ipAllowlist);
  }

  /**
   * Check if IP is allowed for admin access
   */
  isIpAllowedForAdmin(sourceIp: string, userRoles: readonly Role[]): boolean {
    try {
      requireIpAllowlist(sourceIp, userRoles, this.config.ipAllowlist);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Record a failed login attempt
   */
  recordFailedLogin(
    sourceIp: string,
    attemptedIdentity: string,
    reason: string,
    userAgent?: string
  ): { blocked: boolean; activity?: SuspiciousActivity; alert?: SecurityAlert } {
    recordFailedLoginAttempt(sourceIp, attemptedIdentity, reason, userAgent);

    try {
      checkFailedLoginThreshold(sourceIp, this.config.suspiciousActivity);
      return { blocked: false };
    } catch (error) {
      if (error instanceof SuspiciousActivityBlockedError) {
        const activity = createSuspiciousActivity(
          SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS,
          sourceIp,
          {
            attemptedIdentity,
            reason: error.message,
          },
          { userAgent }
        );
        this.activities.push(activity);

        const alert = this.createAlertForActivity(activity);
        this.alerts.push(alert);

        return { blocked: true, activity, alert };
      }
      throw error;
    }
  }

  /**
   * Clear failed login attempts after successful login
   */
  onSuccessfulLogin(sourceIp: string): void {
    clearFailedLoginAttempts(sourceIp);
    logger.info('Cleared failed login attempts after successful login', { sourceIp });
  }

  /**
   * Clear session tracking on logout
   */
  onLogout(userId: string): void {
    clearSessionIp(userId);
    logger.info('Cleared session IP tracking on logout', { userId });
  }

  /**
   * Create an alert for a suspicious activity
   */
  private createAlertForActivity(activity: SuspiciousActivity): SecurityAlert {
    const title = this.getAlertTitle(activity.activityType);
    const description = this.getAlertDescription(activity);
    return createSecurityAlert(activity, title, description);
  }

  /**
   * Get alert title for activity type
   */
  private getAlertTitle(activityType: SuspiciousActivityType): string {
    switch (activityType) {
      case SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
        return 'Multiple Failed Login Attempts Detected';
      case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_LOCATION:
        return 'Access from Unusual Location';
      case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
        return 'Access Outside Normal Hours';
      case SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
        return 'Rate Limit Exceeded';
      case SUSPICIOUS_ACTIVITY_TYPES.SENSITIVE_RESOURCE_ACCESS:
        return 'Sensitive Resource Access Detected';
      case SUSPICIOUS_ACTIVITY_TYPES.CONCURRENT_SESSIONS:
        return 'Multiple Concurrent Sessions Detected';
      case SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
        return 'IP Address Changed During Session';
      case SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
        return 'Privilege Escalation Attempt Detected';
      case SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
        return 'Access Attempt from Blocked IP';
      default:
        return 'Suspicious Activity Detected';
    }
  }

  /**
   * Get alert description for activity
   */
  private getAlertDescription(activity: SuspiciousActivity): string {
    const userInfo = activity.userEmail
      ? `User: ${activity.userEmail}`
      : activity.userId
        ? `User ID: ${activity.userId}`
        : 'Unknown user';

    switch (activity.activityType) {
      case SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
        return `Multiple failed login attempts detected from IP ${activity.sourceIp}. ${userInfo}. This may indicate a brute force attack.`;
      case SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
        return `Access detected outside normal business hours from IP ${activity.sourceIp}. ${userInfo}. Access time: ${activity.details['accessTime']}.`;
      case SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
        return `Rate limit exceeded from IP ${activity.sourceIp}. ${userInfo}. Request count: ${activity.details['requestCount']}, Limit: ${activity.details['limit']}.`;
      case SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
        return `IP address changed during active session. ${userInfo}. Previous IP: ${activity.details['previousIp']}, Current IP: ${activity.sourceIp}.`;
      case SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
        return `Access attempt from blocked IP ${activity.sourceIp}. ${userInfo}. Reason: ${activity.details['reason']}.`;
      default:
        return `Suspicious activity detected from IP ${activity.sourceIp}. ${userInfo}. Activity type: ${activity.activityType}.`;
    }
  }

  /**
   * Get all recorded alerts
   */
  getAlerts(): readonly SecurityAlert[] {
    return [...this.alerts];
  }

  /**
   * Get all recorded suspicious activities
   */
  getActivities(): readonly SuspiciousActivity[] {
    return [...this.activities];
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: typeof ALERT_SEVERITY[keyof typeof ALERT_SEVERITY]): SecurityAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Get alerts by status
   */
  getAlertsByStatus(status: typeof ALERT_STATUS[keyof typeof ALERT_STATUS]): SecurityAlert[] {
    return this.alerts.filter(alert => alert.status === status);
  }

  /**
   * Get current configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Log a security event
   */
  logSecurityEvent(event: SecurityEvent): void {
    logger.info('Security event', { event });
  }

  /**
   * Reset all internal state (for testing)
   */
  reset(): void {
    this.alerts.length = 0;
    this.activities.length = 0;
    resetStores();
  }
}

/**
 * Create a security service instance with configuration
 */
export function createSecurityService(config: Partial<SecurityConfig> = {}): SecurityService {
  return new SecurityService(config);
}

// Re-export types and utilities
export {
  // IP Allowlist
  DEFAULT_IP_ALLOWLIST_CONFIG,
  validateIpAllowlist,
  requireIpAllowlist,
  createIpAllowlistEntry,
  getActiveEntries,
  isValidIpAddress,
  isValidCidr,
  // Suspicious Activity
  DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
  detectSuspiciousActivity,
  checkFailedLoginThreshold,
  checkRateLimit,
  recordFailedLoginAttempt,
  clearFailedLoginAttempts,
  clearSessionIp,
  createSecurityAlert,
  createSuspiciousActivity,
  getSeverityForActivityType,
  getRecommendedActions,
  resetStores,
  // Types
  type IpAllowlistConfig,
  type IpAllowlistEntry,
  type IpAllowlistResult,
  type SuspiciousActivityConfig,
  type SuspiciousActivity,
  type SecurityAlert,
  type SecurityEvent,
  type SuspiciousActivityType,
  IpNotAllowedError,
  SuspiciousActivityBlockedError,
  SUSPICIOUS_ACTIVITY_TYPES,
  ALERT_SEVERITY,
  ALERT_STATUS,
};
