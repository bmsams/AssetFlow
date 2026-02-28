"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALERT_STATUS = exports.ALERT_SEVERITY = exports.SUSPICIOUS_ACTIVITY_TYPES = exports.SuspiciousActivityBlockedError = exports.IpNotAllowedError = exports.resetStores = exports.getRecommendedActions = exports.getSeverityForActivityType = exports.createSuspiciousActivity = exports.createSecurityAlert = exports.clearSessionIp = exports.clearFailedLoginAttempts = exports.recordFailedLoginAttempt = exports.checkRateLimit = exports.checkFailedLoginThreshold = exports.detectSuspiciousActivity = exports.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG = exports.isValidCidr = exports.isValidIpAddress = exports.getActiveEntries = exports.createIpAllowlistEntry = exports.requireIpAllowlist = exports.validateIpAllowlist = exports.DEFAULT_IP_ALLOWLIST_CONFIG = exports.SecurityService = exports.DEFAULT_SECURITY_CONFIG = void 0;
exports.createSecurityService = createSecurityService;
const utils_1 = require("@ams/utils");
const ip_allowlist_service_1 = require("./ip-allowlist-service");
Object.defineProperty(exports, "DEFAULT_IP_ALLOWLIST_CONFIG", { enumerable: true, get: function () { return ip_allowlist_service_1.DEFAULT_IP_ALLOWLIST_CONFIG; } });
Object.defineProperty(exports, "requireIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.requireIpAllowlist; } });
Object.defineProperty(exports, "validateIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.validateIpAllowlist; } });
Object.defineProperty(exports, "createIpAllowlistEntry", { enumerable: true, get: function () { return ip_allowlist_service_1.createIpAllowlistEntry; } });
Object.defineProperty(exports, "getActiveEntries", { enumerable: true, get: function () { return ip_allowlist_service_1.getActiveEntries; } });
Object.defineProperty(exports, "isValidIpAddress", { enumerable: true, get: function () { return ip_allowlist_service_1.isValidIpAddress; } });
Object.defineProperty(exports, "isValidCidr", { enumerable: true, get: function () { return ip_allowlist_service_1.isValidCidr; } });
const suspicious_activity_service_1 = require("./suspicious-activity-service");
Object.defineProperty(exports, "DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG", { enumerable: true, get: function () { return suspicious_activity_service_1.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG; } });
Object.defineProperty(exports, "detectSuspiciousActivity", { enumerable: true, get: function () { return suspicious_activity_service_1.detectSuspiciousActivity; } });
Object.defineProperty(exports, "checkFailedLoginThreshold", { enumerable: true, get: function () { return suspicious_activity_service_1.checkFailedLoginThreshold; } });
Object.defineProperty(exports, "checkRateLimit", { enumerable: true, get: function () { return suspicious_activity_service_1.checkRateLimit; } });
Object.defineProperty(exports, "recordFailedLoginAttempt", { enumerable: true, get: function () { return suspicious_activity_service_1.recordFailedLoginAttempt; } });
Object.defineProperty(exports, "clearFailedLoginAttempts", { enumerable: true, get: function () { return suspicious_activity_service_1.clearFailedLoginAttempts; } });
Object.defineProperty(exports, "clearSessionIp", { enumerable: true, get: function () { return suspicious_activity_service_1.clearSessionIp; } });
Object.defineProperty(exports, "createSecurityAlert", { enumerable: true, get: function () { return suspicious_activity_service_1.createSecurityAlert; } });
Object.defineProperty(exports, "createSuspiciousActivity", { enumerable: true, get: function () { return suspicious_activity_service_1.createSuspiciousActivity; } });
Object.defineProperty(exports, "getSeverityForActivityType", { enumerable: true, get: function () { return suspicious_activity_service_1.getSeverityForActivityType; } });
Object.defineProperty(exports, "getRecommendedActions", { enumerable: true, get: function () { return suspicious_activity_service_1.getRecommendedActions; } });
Object.defineProperty(exports, "resetStores", { enumerable: true, get: function () { return suspicious_activity_service_1.resetStores; } });
const security_types_1 = require("./security-types");
Object.defineProperty(exports, "IpNotAllowedError", { enumerable: true, get: function () { return security_types_1.IpNotAllowedError; } });
Object.defineProperty(exports, "SuspiciousActivityBlockedError", { enumerable: true, get: function () { return security_types_1.SuspiciousActivityBlockedError; } });
Object.defineProperty(exports, "SUSPICIOUS_ACTIVITY_TYPES", { enumerable: true, get: function () { return security_types_1.SUSPICIOUS_ACTIVITY_TYPES; } });
Object.defineProperty(exports, "ALERT_SEVERITY", { enumerable: true, get: function () { return security_types_1.ALERT_SEVERITY; } });
Object.defineProperty(exports, "ALERT_STATUS", { enumerable: true, get: function () { return security_types_1.ALERT_STATUS; } });
const logger = (0, utils_1.createLogger)({ service: 'security-service' });
/**
 * Default security configuration
 */
exports.DEFAULT_SECURITY_CONFIG = {
    ipAllowlist: ip_allowlist_service_1.DEFAULT_IP_ALLOWLIST_CONFIG,
    suspiciousActivity: suspicious_activity_service_1.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG,
};
/**
 * Security Service class for managing all security controls
 */
class SecurityService {
    config;
    alerts = [];
    activities = [];
    constructor(config = {}) {
        this.config = {
            ipAllowlist: { ...ip_allowlist_service_1.DEFAULT_IP_ALLOWLIST_CONFIG, ...config.ipAllowlist },
            suspiciousActivity: { ...suspicious_activity_service_1.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG, ...config.suspiciousActivity },
        };
    }
    /**
     * Perform all security checks for a request
     */
    performSecurityChecks(context, options = {}) {
        const sourceIp = context.sourceIp ?? 'unknown';
        const suspiciousActivities = [];
        const alerts = [];
        try {
            // Check IP allowlist for admin access
            if (context.isAuthenticated) {
                (0, ip_allowlist_service_1.requireIpAllowlist)(sourceIp, context.user.roles, this.config.ipAllowlist, context.requestId);
            }
            // Check rate limit
            (0, suspicious_activity_service_1.checkRateLimit)(sourceIp, this.config.suspiciousActivity);
            // Detect suspicious activity
            const detected = (0, suspicious_activity_service_1.detectSuspiciousActivity)(context, this.config.suspiciousActivity, options);
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
        }
        catch (error) {
            if (error instanceof security_types_1.IpNotAllowedError) {
                // Create activity and alert for blocked IP
                const activity = (0, suspicious_activity_service_1.createSuspiciousActivity)(security_types_1.SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS, sourceIp, { reason: error.message }, {
                    userId: context.user.sub,
                    userEmail: context.user.email,
                    requestId: context.requestId,
                });
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
            if (error instanceof security_types_1.SuspiciousActivityBlockedError) {
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
    validateIp(sourceIp) {
        return (0, ip_allowlist_service_1.validateIpAllowlist)(sourceIp, this.config.ipAllowlist);
    }
    /**
     * Check if IP is allowed for admin access
     */
    isIpAllowedForAdmin(sourceIp, userRoles) {
        try {
            (0, ip_allowlist_service_1.requireIpAllowlist)(sourceIp, userRoles, this.config.ipAllowlist);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Record a failed login attempt
     */
    recordFailedLogin(sourceIp, attemptedIdentity, reason, userAgent) {
        (0, suspicious_activity_service_1.recordFailedLoginAttempt)(sourceIp, attemptedIdentity, reason, userAgent);
        try {
            (0, suspicious_activity_service_1.checkFailedLoginThreshold)(sourceIp, this.config.suspiciousActivity);
            return { blocked: false };
        }
        catch (error) {
            if (error instanceof security_types_1.SuspiciousActivityBlockedError) {
                const activity = (0, suspicious_activity_service_1.createSuspiciousActivity)(security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS, sourceIp, {
                    attemptedIdentity,
                    reason: error.message,
                }, { userAgent });
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
    onSuccessfulLogin(sourceIp) {
        (0, suspicious_activity_service_1.clearFailedLoginAttempts)(sourceIp);
        logger.info('Cleared failed login attempts after successful login', { sourceIp });
    }
    /**
     * Clear session tracking on logout
     */
    onLogout(userId) {
        (0, suspicious_activity_service_1.clearSessionIp)(userId);
        logger.info('Cleared session IP tracking on logout', { userId });
    }
    /**
     * Create an alert for a suspicious activity
     */
    createAlertForActivity(activity) {
        const title = this.getAlertTitle(activity.activityType);
        const description = this.getAlertDescription(activity);
        return (0, suspicious_activity_service_1.createSecurityAlert)(activity, title, description);
    }
    /**
     * Get alert title for activity type
     */
    getAlertTitle(activityType) {
        switch (activityType) {
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
                return 'Multiple Failed Login Attempts Detected';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_LOCATION:
                return 'Access from Unusual Location';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
                return 'Access Outside Normal Hours';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
                return 'Rate Limit Exceeded';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.SENSITIVE_RESOURCE_ACCESS:
                return 'Sensitive Resource Access Detected';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.CONCURRENT_SESSIONS:
                return 'Multiple Concurrent Sessions Detected';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
                return 'IP Address Changed During Session';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
                return 'Privilege Escalation Attempt Detected';
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
                return 'Access Attempt from Blocked IP';
            default:
                return 'Suspicious Activity Detected';
        }
    }
    /**
     * Get alert description for activity
     */
    getAlertDescription(activity) {
        const userInfo = activity.userEmail
            ? `User: ${activity.userEmail}`
            : activity.userId
                ? `User ID: ${activity.userId}`
                : 'Unknown user';
        switch (activity.activityType) {
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
                return `Multiple failed login attempts detected from IP ${activity.sourceIp}. ${userInfo}. This may indicate a brute force attack.`;
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
                return `Access detected outside normal business hours from IP ${activity.sourceIp}. ${userInfo}. Access time: ${activity.details['accessTime']}.`;
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
                return `Rate limit exceeded from IP ${activity.sourceIp}. ${userInfo}. Request count: ${activity.details['requestCount']}, Limit: ${activity.details['limit']}.`;
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
                return `IP address changed during active session. ${userInfo}. Previous IP: ${activity.details['previousIp']}, Current IP: ${activity.sourceIp}.`;
            case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
                return `Access attempt from blocked IP ${activity.sourceIp}. ${userInfo}. Reason: ${activity.details['reason']}.`;
            default:
                return `Suspicious activity detected from IP ${activity.sourceIp}. ${userInfo}. Activity type: ${activity.activityType}.`;
        }
    }
    /**
     * Get all recorded alerts
     */
    getAlerts() {
        return [...this.alerts];
    }
    /**
     * Get all recorded suspicious activities
     */
    getActivities() {
        return [...this.activities];
    }
    /**
     * Get alerts by severity
     */
    getAlertsBySeverity(severity) {
        return this.alerts.filter(alert => alert.severity === severity);
    }
    /**
     * Get alerts by status
     */
    getAlertsByStatus(status) {
        return this.alerts.filter(alert => alert.status === status);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Log a security event
     */
    logSecurityEvent(event) {
        logger.info('Security event', { event });
    }
    /**
     * Reset all internal state (for testing)
     */
    reset() {
        this.alerts.length = 0;
        this.activities.length = 0;
        (0, suspicious_activity_service_1.resetStores)();
    }
}
exports.SecurityService = SecurityService;
/**
 * Create a security service instance with configuration
 */
function createSecurityService(config = {}) {
    return new SecurityService(config);
}
//# sourceMappingURL=security-service.js.map