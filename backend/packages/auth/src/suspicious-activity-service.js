"use strict";
/**
 * Suspicious Activity Detection Service
 *
 * Implements detection and blocking of suspicious activity patterns.
 * Based on Requirement 14.10: THE Security_Service SHALL detect and block suspicious activity patterns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG = void 0;
exports.recordFailedLoginAttempt = recordFailedLoginAttempt;
exports.getFailedLoginAttempts = getFailedLoginAttempts;
exports.clearFailedLoginAttempts = clearFailedLoginAttempts;
exports.isFailedLoginThresholdExceeded = isFailedLoginThresholdExceeded;
exports.recordRequest = recordRequest;
exports.isRateLimitExceeded = isRateLimitExceeded;
exports.isUnusualAccessTime = isUnusualAccessTime;
exports.checkIpChangeDuringSession = checkIpChangeDuringSession;
exports.clearSessionIp = clearSessionIp;
exports.createSuspiciousActivity = createSuspiciousActivity;
exports.getSeverityForActivityType = getSeverityForActivityType;
exports.getRecommendedActions = getRecommendedActions;
exports.createSecurityAlert = createSecurityAlert;
exports.detectSuspiciousActivity = detectSuspiciousActivity;
exports.checkFailedLoginThreshold = checkFailedLoginThreshold;
exports.checkRateLimit = checkRateLimit;
exports.resetStores = resetStores;
const utils_1 = require("@ams/utils");
const security_types_1 = require("./security-types");
const logger = (0, utils_1.createLogger)({ service: 'suspicious-activity-service' });
/**
 * Default configuration for suspicious activity detection
 */
exports.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG = {
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
const failedLoginAttempts = new Map();
/**
 * In-memory store for request counts (in production, use Redis)
 * Key: IP address, Value: { count, windowStart }
 */
const requestCounts = new Map();
/**
 * In-memory store for session IPs (in production, use Redis)
 * Key: user ID, Value: last known IP
 */
const sessionIps = new Map();
/**
 * Record a failed login attempt
 */
function recordFailedLoginAttempt(sourceIp, attemptedIdentity, reason, userAgent) {
    const attempt = {
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
function getFailedLoginAttempts(sourceIp, windowSeconds) {
    const attempts = failedLoginAttempts.get(sourceIp) ?? [];
    const cutoff = new Date(Date.now() - windowSeconds * 1000);
    return attempts.filter(attempt => new Date(attempt.timestamp) > cutoff);
}
/**
 * Clear failed login attempts for an IP (e.g., after successful login)
 */
function clearFailedLoginAttempts(sourceIp) {
    failedLoginAttempts.delete(sourceIp);
    logger.debug('Cleared failed login attempts', { sourceIp });
}
/**
 * Check if failed login threshold is exceeded
 */
function isFailedLoginThresholdExceeded(sourceIp, config) {
    const attempts = getFailedLoginAttempts(sourceIp, config.failedLoginWindowSeconds);
    return attempts.length >= config.maxFailedLoginAttempts;
}
/**
 * Record a request for rate limiting
 */
function recordRequest(sourceIp) {
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
function isRateLimitExceeded(sourceIp, maxRequestsPerMinute) {
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
function isUnusualAccessTime(config, timestamp) {
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
function checkIpChangeDuringSession(userId, currentIp, config) {
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
function clearSessionIp(userId) {
    sessionIps.delete(userId);
}
/**
 * Create a suspicious activity record
 */
function createSuspiciousActivity(activityType, sourceIp, details, options = {}) {
    const activity = {
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
function getSeverityForActivityType(activityType) {
    switch (activityType) {
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
            return security_types_1.ALERT_SEVERITY.CRITICAL;
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
            return security_types_1.ALERT_SEVERITY.HIGH;
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.SENSITIVE_RESOURCE_ACCESS:
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.CONCURRENT_SESSIONS:
            return security_types_1.ALERT_SEVERITY.MEDIUM;
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_LOCATION:
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
            return security_types_1.ALERT_SEVERITY.LOW;
        default:
            return security_types_1.ALERT_SEVERITY.MEDIUM;
    }
}
/**
 * Get recommended actions for an activity type
 */
function getRecommendedActions(activityType) {
    switch (activityType) {
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS:
            return [
                'Review failed login attempts for the IP address',
                'Consider temporarily blocking the IP if attacks continue',
                'Verify if the user account exists and is active',
                'Check for credential stuffing patterns',
            ];
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.PRIVILEGE_ESCALATION:
            return [
                'Immediately investigate the user account',
                'Review recent permission changes',
                'Check for unauthorized role assignments',
                'Consider disabling the account pending investigation',
            ];
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION:
            return [
                'Verify if the user is using a VPN or mobile network',
                'Contact the user to confirm the access is legitimate',
                'Review session activity for suspicious actions',
            ];
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED:
            return [
                'Check if the requests are from a legitimate automation',
                'Review the request patterns for potential abuse',
                'Consider implementing stricter rate limits',
            ];
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.BLOCKED_IP_ACCESS:
            return [
                'Verify the IP block is still appropriate',
                'Check if a legitimate user is affected',
                'Review the original reason for blocking',
            ];
        case security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME:
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
function createSecurityAlert(activity, title, description) {
    const severity = getSeverityForActivityType(activity.activityType);
    const recommendedActions = getRecommendedActions(activity.activityType);
    const alert = {
        id: crypto.randomUUID(),
        title,
        description,
        severity,
        status: security_types_1.ALERT_STATUS.NEW,
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
function detectSuspiciousActivity(context, config, options = {}) {
    if (!config.enabled) {
        return [];
    }
    const activities = [];
    const sourceIp = context.sourceIp ?? 'unknown';
    // Check for unusual access time
    if (isUnusualAccessTime(config)) {
        activities.push(createSuspiciousActivity(security_types_1.SUSPICIOUS_ACTIVITY_TYPES.UNUSUAL_TIME, sourceIp, {
            accessTime: new Date().toISOString(),
            normalHours: config.normalAccessHours,
        }, {
            userId: context.user.sub,
            userEmail: context.user.email,
            userAgent: context.userAgent,
            requestPath: options.requestPath,
            httpMethod: options.httpMethod,
            requestId: context.requestId,
        }));
    }
    // Check for IP change during session
    if (context.user.sub && sourceIp !== 'unknown') {
        const ipCheck = checkIpChangeDuringSession(context.user.sub, sourceIp, config);
        if (ipCheck.changed) {
            activities.push(createSuspiciousActivity(security_types_1.SUSPICIOUS_ACTIVITY_TYPES.IP_CHANGE_DURING_SESSION, sourceIp, {
                previousIp: ipCheck.previousIp,
                currentIp: sourceIp,
            }, {
                userId: context.user.sub,
                userEmail: context.user.email,
                userAgent: context.userAgent,
                requestPath: options.requestPath,
                httpMethod: options.httpMethod,
                requestId: context.requestId,
            }));
        }
    }
    // Check rate limit
    if (sourceIp !== 'unknown') {
        const requestCount = recordRequest(sourceIp);
        if (requestCount > config.maxRequestsPerMinute) {
            activities.push(createSuspiciousActivity(security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED, sourceIp, {
                requestCount,
                limit: config.maxRequestsPerMinute,
            }, {
                userId: context.user.sub,
                userEmail: context.user.email,
                userAgent: context.userAgent,
                requestPath: options.requestPath,
                httpMethod: options.httpMethod,
                requestId: context.requestId,
            }));
        }
    }
    return activities;
}
/**
 * Check and block if failed login threshold is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
function checkFailedLoginThreshold(sourceIp, config) {
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
        throw new security_types_1.SuspiciousActivityBlockedError(`Too many failed login attempts from IP ${sourceIp}. Please try again later.`, security_types_1.SUSPICIOUS_ACTIVITY_TYPES.FAILED_LOGIN_ATTEMPTS);
    }
}
/**
 * Check and block if rate limit is exceeded
 * Throws SuspiciousActivityBlockedError if blocked
 */
function checkRateLimit(sourceIp, config) {
    if (!config.enabled) {
        return;
    }
    if (isRateLimitExceeded(sourceIp, config.maxRequestsPerMinute)) {
        logger.warn('Rate limit exceeded, blocking request', {
            sourceIp,
            limit: config.maxRequestsPerMinute,
        });
        throw new security_types_1.SuspiciousActivityBlockedError('Rate limit exceeded. Please slow down your requests.', security_types_1.SUSPICIOUS_ACTIVITY_TYPES.RATE_LIMIT_EXCEEDED);
    }
}
/**
 * Reset all in-memory stores (for testing)
 */
function resetStores() {
    failedLoginAttempts.clear();
    requestCounts.clear();
    sessionIps.clear();
}
//# sourceMappingURL=suspicious-activity-service.js.map