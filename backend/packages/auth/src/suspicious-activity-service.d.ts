/**
 * Suspicious Activity Detection Service
 *
 * Implements detection and blocking of suspicious activity patterns.
 * Based on Requirement 14.10: THE Security_Service SHALL detect and block suspicious activity patterns
 */
import type { AuthContext } from './auth-types';
import { type AlertSeverity, type FailedLoginAttempt, type SecurityAlert, type SuspiciousActivity, type SuspiciousActivityConfig, type SuspiciousActivityType } from './security-types';
/**
 * Default configuration for suspicious activity detection
 */
export declare const DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG: SuspiciousActivityConfig;
/**
 * Record a failed login attempt
 */
export declare function recordFailedLoginAttempt(sourceIp: string, attemptedIdentity: string, reason: string, userAgent?: string): FailedLoginAttempt;
/**
 * Get failed login attempts for an IP within the time window
 */
export declare function getFailedLoginAttempts(sourceIp: string, windowSeconds: number): FailedLoginAttempt[];
/**
 * Clear failed login attempts for an IP (e.g., after successful login)
 */
export declare function clearFailedLoginAttempts(sourceIp: string): void;
/**
 * Check if failed login threshold is exceeded
 */
export declare function isFailedLoginThresholdExceeded(sourceIp: string, config: SuspiciousActivityConfig): boolean;
/**
 * Record a request for rate limiting
 */
export declare function recordRequest(sourceIp: string): number;
/**
 * Check if rate limit is exceeded
 */
export declare function isRateLimitExceeded(sourceIp: string, maxRequestsPerMinute: number): boolean;
/**
 * Check if access is during unusual hours
 */
export declare function isUnusualAccessTime(config: SuspiciousActivityConfig, timestamp?: Date): boolean;
/**
 * Check for IP change during session
 */
export declare function checkIpChangeDuringSession(userId: string, currentIp: string, config: SuspiciousActivityConfig): {
    changed: boolean;
    previousIp?: string;
};
/**
 * Clear session IP tracking for a user (e.g., on logout)
 */
export declare function clearSessionIp(userId: string): void;
/**
 * Create a suspicious activity record
 */
export declare function createSuspiciousActivity(activityType: SuspiciousActivityType, sourceIp: string, details: Record<string, unknown>, options?: {
    userId?: string;
    userEmail?: string;
    userAgent?: string;
    requestPath?: string;
    httpMethod?: string;
    requestId?: string;
}): SuspiciousActivity;
/**
 * Get severity for an activity type
 */
export declare function getSeverityForActivityType(activityType: SuspiciousActivityType): AlertSeverity;
/**
 * Get recommended actions for an activity type
 */
export declare function getRecommendedActions(activityType: SuspiciousActivityType): string[];
/**
 * Create a security alert from suspicious activity
 */
export declare function createSecurityAlert(activity: SuspiciousActivity, title: string, description: string): SecurityAlert;
/**
 * Detect suspicious activity from an auth context
 */
export declare function detectSuspiciousActivity(context: AuthContext, config: SuspiciousActivityConfig, options?: {
    requestPath?: string;
    httpMethod?: string;
}): SuspiciousActivity[];
/**
 * Check and block if failed login threshold is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
export declare function checkFailedLoginThreshold(sourceIp: string, config: SuspiciousActivityConfig): void;
/**
 * Check and block if rate limit is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
export declare function checkRateLimit(sourceIp: string, config: SuspiciousActivityConfig): void;
/**
 * Reset all in-memory stores (for testing)
 */
export declare function resetStores(): void;
//# sourceMappingURL=suspicious-activity-service.d.ts.map