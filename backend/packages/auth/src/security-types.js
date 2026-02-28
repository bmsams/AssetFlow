"use strict";
/**
 * Security Types
 *
 * Defines types for IP allowlisting, suspicious activity detection,
 * and security alerts for the Asset Management System.
 *
 * Implements Requirements 14.9 and 14.10
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuspiciousActivityBlockedError = exports.IpNotAllowedError = exports.ALERT_STATUS = exports.ALERT_SEVERITY = exports.SUSPICIOUS_ACTIVITY_TYPES = void 0;
/**
 * Types of suspicious activities to detect
 * Based on Requirement 14.10
 */
exports.SUSPICIOUS_ACTIVITY_TYPES = {
    /** Multiple failed login attempts */
    FAILED_LOGIN_ATTEMPTS: 'FAILED_LOGIN_ATTEMPTS',
    /** Access from unusual location */
    UNUSUAL_LOCATION: 'UNUSUAL_LOCATION',
    /** Access outside normal hours */
    UNUSUAL_TIME: 'UNUSUAL_TIME',
    /** Rapid successive requests */
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    /** Access to sensitive resources */
    SENSITIVE_RESOURCE_ACCESS: 'SENSITIVE_RESOURCE_ACCESS',
    /** Multiple concurrent sessions */
    CONCURRENT_SESSIONS: 'CONCURRENT_SESSIONS',
    /** IP address change during session */
    IP_CHANGE_DURING_SESSION: 'IP_CHANGE_DURING_SESSION',
    /** Privilege escalation attempt */
    PRIVILEGE_ESCALATION: 'PRIVILEGE_ESCALATION',
    /** Blocked IP access attempt */
    BLOCKED_IP_ACCESS: 'BLOCKED_IP_ACCESS',
};
/**
 * Severity levels for security alerts
 */
exports.ALERT_SEVERITY = {
    /** Low severity - informational */
    LOW: 'LOW',
    /** Medium severity - requires attention */
    MEDIUM: 'MEDIUM',
    /** High severity - immediate action needed */
    HIGH: 'HIGH',
    /** Critical severity - security breach possible */
    CRITICAL: 'CRITICAL',
};
/**
 * Security alert status
 */
exports.ALERT_STATUS = {
    /** Alert is new and unacknowledged */
    NEW: 'NEW',
    /** Alert has been acknowledged */
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    /** Alert is being investigated */
    INVESTIGATING: 'INVESTIGATING',
    /** Alert has been resolved */
    RESOLVED: 'RESOLVED',
    /** Alert was a false positive */
    FALSE_POSITIVE: 'FALSE_POSITIVE',
};
/**
 * Error thrown when IP is not allowed
 */
class IpNotAllowedError extends Error {
    code;
    statusCode;
    sourceIp;
    constructor(message, sourceIp) {
        super(message);
        this.name = 'IpNotAllowedError';
        this.code = 'IP_NOT_ALLOWED';
        this.statusCode = 403;
        this.sourceIp = sourceIp;
    }
}
exports.IpNotAllowedError = IpNotAllowedError;
/**
 * Error thrown when suspicious activity is detected and blocked
 */
class SuspiciousActivityBlockedError extends Error {
    code;
    statusCode;
    activityType;
    constructor(message, activityType) {
        super(message);
        this.name = 'SuspiciousActivityBlockedError';
        this.code = 'SUSPICIOUS_ACTIVITY_BLOCKED';
        this.statusCode = 403;
        this.activityType = activityType;
    }
}
exports.SuspiciousActivityBlockedError = SuspiciousActivityBlockedError;
//# sourceMappingURL=security-types.js.map