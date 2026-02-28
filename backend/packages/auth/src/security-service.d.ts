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
import type { AuthContext, Role } from './auth-types';
import { DEFAULT_IP_ALLOWLIST_CONFIG, requireIpAllowlist, validateIpAllowlist, createIpAllowlistEntry, getActiveEntries, isValidIpAddress, isValidCidr } from './ip-allowlist-service';
import { DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG, detectSuspiciousActivity, checkFailedLoginThreshold, checkRateLimit, recordFailedLoginAttempt, clearFailedLoginAttempts, clearSessionIp, createSecurityAlert, createSuspiciousActivity, getSeverityForActivityType, getRecommendedActions, resetStores } from './suspicious-activity-service';
import { type IpAllowlistConfig, type IpAllowlistResult, type IpAllowlistEntry, type SuspiciousActivityConfig, type SecurityAlert, type SecurityEvent, type SuspiciousActivity, type SuspiciousActivityType, IpNotAllowedError, SuspiciousActivityBlockedError, SUSPICIOUS_ACTIVITY_TYPES, ALERT_SEVERITY, ALERT_STATUS } from './security-types';
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
export declare const DEFAULT_SECURITY_CONFIG: SecurityConfig;
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
export declare class SecurityService {
    private readonly config;
    private readonly alerts;
    private readonly activities;
    constructor(config?: Partial<SecurityConfig>);
    /**
     * Perform all security checks for a request
     */
    performSecurityChecks(context: AuthContext, options?: {
        requestPath?: string;
        httpMethod?: string;
    }): SecurityCheckResult;
    /**
     * Validate IP against allowlist
     */
    validateIp(sourceIp: string): IpAllowlistResult;
    /**
     * Check if IP is allowed for admin access
     */
    isIpAllowedForAdmin(sourceIp: string, userRoles: readonly Role[]): boolean;
    /**
     * Record a failed login attempt
     */
    recordFailedLogin(sourceIp: string, attemptedIdentity: string, reason: string, userAgent?: string): {
        blocked: boolean;
        activity?: SuspiciousActivity;
        alert?: SecurityAlert;
    };
    /**
     * Clear failed login attempts after successful login
     */
    onSuccessfulLogin(sourceIp: string): void;
    /**
     * Clear session tracking on logout
     */
    onLogout(userId: string): void;
    /**
     * Create an alert for a suspicious activity
     */
    private createAlertForActivity;
    /**
     * Get alert title for activity type
     */
    private getAlertTitle;
    /**
     * Get alert description for activity
     */
    private getAlertDescription;
    /**
     * Get all recorded alerts
     */
    getAlerts(): readonly SecurityAlert[];
    /**
     * Get all recorded suspicious activities
     */
    getActivities(): readonly SuspiciousActivity[];
    /**
     * Get alerts by severity
     */
    getAlertsBySeverity(severity: typeof ALERT_SEVERITY[keyof typeof ALERT_SEVERITY]): SecurityAlert[];
    /**
     * Get alerts by status
     */
    getAlertsByStatus(status: typeof ALERT_STATUS[keyof typeof ALERT_STATUS]): SecurityAlert[];
    /**
     * Get current configuration
     */
    getConfig(): SecurityConfig;
    /**
     * Log a security event
     */
    logSecurityEvent(event: SecurityEvent): void;
    /**
     * Reset all internal state (for testing)
     */
    reset(): void;
}
/**
 * Create a security service instance with configuration
 */
export declare function createSecurityService(config?: Partial<SecurityConfig>): SecurityService;
export { DEFAULT_IP_ALLOWLIST_CONFIG, validateIpAllowlist, requireIpAllowlist, createIpAllowlistEntry, getActiveEntries, isValidIpAddress, isValidCidr, DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG, detectSuspiciousActivity, checkFailedLoginThreshold, checkRateLimit, recordFailedLoginAttempt, clearFailedLoginAttempts, clearSessionIp, createSecurityAlert, createSuspiciousActivity, getSeverityForActivityType, getRecommendedActions, resetStores, type IpAllowlistConfig, type IpAllowlistEntry, type IpAllowlistResult, type SuspiciousActivityConfig, type SuspiciousActivity, type SecurityAlert, type SecurityEvent, type SuspiciousActivityType, IpNotAllowedError, SuspiciousActivityBlockedError, SUSPICIOUS_ACTIVITY_TYPES, ALERT_SEVERITY, ALERT_STATUS, };
//# sourceMappingURL=security-service.d.ts.map