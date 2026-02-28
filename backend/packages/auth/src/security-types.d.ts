/**
 * Security Types
 *
 * Defines types for IP allowlisting, suspicious activity detection,
 * and security alerts for the Asset Management System.
 *
 * Implements Requirements 14.9 and 14.10
 */
import type { ISODateString } from '@ams/types';
/**
 * IP allowlist entry for admin access control
 * Based on Requirement 14.9
 */
export interface IpAllowlistEntry {
    /** Unique identifier for the entry */
    readonly id: string;
    /** IP address or CIDR range (e.g., "192.168.1.0/24" or "10.0.0.1") */
    readonly ipAddress: string;
    /** Description of the IP entry (e.g., "Corporate VPN", "Office Network") */
    readonly description: string;
    /** Whether this entry is currently active */
    readonly isActive: boolean;
    /** When the entry was created */
    readonly createdAt: ISODateString;
    /** Who created the entry */
    readonly createdBy: string;
    /** When the entry expires (optional) */
    readonly expiresAt?: ISODateString;
}
/**
 * IP allowlist configuration
 */
export interface IpAllowlistConfig {
    /** Whether IP allowlisting is enabled */
    readonly enabled: boolean;
    /** List of allowed IP addresses/ranges */
    readonly entries: readonly IpAllowlistEntry[];
    /** Whether to allow access when allowlist is empty (default: true for safety) */
    readonly allowWhenEmpty: boolean;
    /** Roles that require IP allowlist validation */
    readonly protectedRoles: readonly string[];
}
/**
 * Result of IP allowlist validation
 */
export interface IpAllowlistResult {
    /** Whether the IP is allowed */
    readonly allowed: boolean;
    /** Reason for the decision */
    readonly reason: string;
    /** Matched allowlist entry (if allowed) */
    readonly matchedEntry?: IpAllowlistEntry;
}
/**
 * Types of suspicious activities to detect
 * Based on Requirement 14.10
 */
export declare const SUSPICIOUS_ACTIVITY_TYPES: {
    /** Multiple failed login attempts */
    readonly FAILED_LOGIN_ATTEMPTS: "FAILED_LOGIN_ATTEMPTS";
    /** Access from unusual location */
    readonly UNUSUAL_LOCATION: "UNUSUAL_LOCATION";
    /** Access outside normal hours */
    readonly UNUSUAL_TIME: "UNUSUAL_TIME";
    /** Rapid successive requests */
    readonly RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED";
    /** Access to sensitive resources */
    readonly SENSITIVE_RESOURCE_ACCESS: "SENSITIVE_RESOURCE_ACCESS";
    /** Multiple concurrent sessions */
    readonly CONCURRENT_SESSIONS: "CONCURRENT_SESSIONS";
    /** IP address change during session */
    readonly IP_CHANGE_DURING_SESSION: "IP_CHANGE_DURING_SESSION";
    /** Privilege escalation attempt */
    readonly PRIVILEGE_ESCALATION: "PRIVILEGE_ESCALATION";
    /** Blocked IP access attempt */
    readonly BLOCKED_IP_ACCESS: "BLOCKED_IP_ACCESS";
};
export type SuspiciousActivityType = (typeof SUSPICIOUS_ACTIVITY_TYPES)[keyof typeof SUSPICIOUS_ACTIVITY_TYPES];
/**
 * Severity levels for security alerts
 */
export declare const ALERT_SEVERITY: {
    /** Low severity - informational */
    readonly LOW: "LOW";
    /** Medium severity - requires attention */
    readonly MEDIUM: "MEDIUM";
    /** High severity - immediate action needed */
    readonly HIGH: "HIGH";
    /** Critical severity - security breach possible */
    readonly CRITICAL: "CRITICAL";
};
export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY];
/**
 * Security alert status
 */
export declare const ALERT_STATUS: {
    /** Alert is new and unacknowledged */
    readonly NEW: "NEW";
    /** Alert has been acknowledged */
    readonly ACKNOWLEDGED: "ACKNOWLEDGED";
    /** Alert is being investigated */
    readonly INVESTIGATING: "INVESTIGATING";
    /** Alert has been resolved */
    readonly RESOLVED: "RESOLVED";
    /** Alert was a false positive */
    readonly FALSE_POSITIVE: "FALSE_POSITIVE";
};
export type AlertStatus = (typeof ALERT_STATUS)[keyof typeof ALERT_STATUS];
/**
 * Suspicious activity record
 */
export interface SuspiciousActivity {
    /** Unique identifier */
    readonly id: string;
    /** Type of suspicious activity */
    readonly activityType: SuspiciousActivityType;
    /** User ID (if known) */
    readonly userId?: string;
    /** User email (if known) */
    readonly userEmail?: string;
    /** Source IP address */
    readonly sourceIp: string;
    /** User agent string */
    readonly userAgent?: string;
    /** Request path */
    readonly requestPath?: string;
    /** HTTP method */
    readonly httpMethod?: string;
    /** When the activity occurred */
    readonly timestamp: ISODateString;
    /** Additional details about the activity */
    readonly details: Record<string, unknown>;
    /** Request ID for correlation */
    readonly requestId?: string;
}
/**
 * Security alert generated from suspicious activity
 */
export interface SecurityAlert {
    /** Unique identifier */
    readonly id: string;
    /** Alert title */
    readonly title: string;
    /** Detailed description */
    readonly description: string;
    /** Alert severity */
    readonly severity: AlertSeverity;
    /** Current status */
    readonly status: AlertStatus;
    /** Type of suspicious activity that triggered the alert */
    readonly activityType: SuspiciousActivityType;
    /** Related suspicious activity IDs */
    readonly relatedActivityIds: readonly string[];
    /** User ID (if known) */
    readonly userId?: string;
    /** User email (if known) */
    readonly userEmail?: string;
    /** Source IP address */
    readonly sourceIp: string;
    /** When the alert was created */
    readonly createdAt: ISODateString;
    /** When the alert was last updated */
    readonly updatedAt: ISODateString;
    /** Who acknowledged the alert */
    readonly acknowledgedBy?: string;
    /** When the alert was acknowledged */
    readonly acknowledgedAt?: ISODateString;
    /** Resolution notes */
    readonly resolutionNotes?: string;
    /** Recommended actions */
    readonly recommendedActions: readonly string[];
}
/**
 * Failed login attempt record for tracking
 */
export interface FailedLoginAttempt {
    /** Source IP address */
    readonly sourceIp: string;
    /** Attempted username/email */
    readonly attemptedIdentity: string;
    /** When the attempt occurred */
    readonly timestamp: ISODateString;
    /** Failure reason */
    readonly reason: string;
    /** User agent string */
    readonly userAgent?: string;
}
/**
 * Configuration for suspicious activity detection
 */
export interface SuspiciousActivityConfig {
    /** Whether detection is enabled */
    readonly enabled: boolean;
    /** Maximum failed login attempts before alert */
    readonly maxFailedLoginAttempts: number;
    /** Time window for failed login attempts (seconds) */
    readonly failedLoginWindowSeconds: number;
    /** Maximum requests per minute before rate limit alert */
    readonly maxRequestsPerMinute: number;
    /** Hours considered "normal" for access (24-hour format) */
    readonly normalAccessHours: {
        readonly start: number;
        readonly end: number;
    };
    /** Whether to detect unusual time access */
    readonly detectUnusualTime: boolean;
    /** Whether to detect IP changes during session */
    readonly detectIpChanges: boolean;
}
/**
 * Security event for logging
 */
export interface SecurityEvent {
    /** Event type */
    readonly eventType: 'IP_BLOCKED' | 'IP_ALLOWED' | 'SUSPICIOUS_ACTIVITY' | 'ALERT_CREATED' | 'ALERT_UPDATED';
    /** Event timestamp */
    readonly timestamp: ISODateString;
    /** Request ID for correlation */
    readonly requestId?: string;
    /** User ID (if known) */
    readonly userId?: string;
    /** Source IP address */
    readonly sourceIp?: string;
    /** Event details */
    readonly details: Record<string, unknown>;
}
/**
 * Error thrown when IP is not allowed
 */
export declare class IpNotAllowedError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly sourceIp: string;
    constructor(message: string, sourceIp: string);
}
/**
 * Error thrown when suspicious activity is detected and blocked
 */
export declare class SuspiciousActivityBlockedError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly activityType: SuspiciousActivityType;
    constructor(message: string, activityType: SuspiciousActivityType);
}
//# sourceMappingURL=security-types.d.ts.map