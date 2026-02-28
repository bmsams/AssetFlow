"use strict";
/**
 * @ams/auth - Authentication and Authorization for Asset Management System
 *
 * This package provides:
 * - JWT token validation with AWS Cognito
 * - Role-based access control (RBAC)
 * - Permission-based authorization
 * - Middleware for Lambda handlers
 * - Audit logging for authorization decisions
 * - IP allowlisting for admin access (Requirement 14.9)
 * - Suspicious activity detection (Requirement 14.10)
 * - Security alerts
 *
 * @example
 * ```typescript
 * import { withAuth, createCognitoVerifier, PERMISSIONS, ROLES } from '@ams/auth';
 *
 * // Create verifier
 * const verifier = await createCognitoVerifier({
 *   userPoolId: 'us-east-1_xxxxx',
 *   clientId: 'xxxxx',
 *   region: 'us-east-1',
 * });
 *
 * // Wrap handler with auth middleware
 * const protectedHandler = withAuth(verifier, {
 *   requiredPermissions: [PERMISSIONS.ASSET_READ],
 * })(async (event, authContext) => {
 *   // Handler has access to authenticated user
 *   console.log(authContext.user.email);
 *   return { statusCode: 200, body: 'OK' };
 * });
 * ```
 *
 * @example Security Service
 * ```typescript
 * import { createSecurityService, SUSPICIOUS_ACTIVITY_TYPES } from '@ams/auth';
 *
 * // Create security service
 * const securityService = createSecurityService({
 *   ipAllowlist: {
 *     enabled: true,
 *     entries: [{ id: '1', ipAddress: '10.0.0.0/8', description: 'Corporate', isActive: true, createdAt: '', createdBy: 'admin' }],
 *     allowWhenEmpty: false,
 *     protectedRoles: ['ADMIN'],
 *   },
 *   suspiciousActivity: {
 *     enabled: true,
 *     maxFailedLoginAttempts: 5,
 *     failedLoginWindowSeconds: 300,
 *     maxRequestsPerMinute: 100,
 *     normalAccessHours: { start: 6, end: 22 },
 *     detectUnusualTime: true,
 *     detectIpChanges: true,
 *   },
 * });
 *
 * // Perform security checks
 * const result = securityService.performSecurityChecks(authContext);
 * if (!result.passed) {
 *   console.log('Security check failed:', result.reason);
 * }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipMatchesEntry = exports.ipMatchesCidr = exports.getActiveEntries = exports.DEFAULT_IP_ALLOWLIST_CONFIG = exports.createIpAllowlistEntry = exports.SUSPICIOUS_ACTIVITY_TYPES = exports.SuspiciousActivityBlockedError = exports.IpNotAllowedError = exports.ALERT_STATUS = exports.ALERT_SEVERITY = exports.withAuth = exports.isAuthenticated = exports.getAuthContext = exports.extractBearerToken = exports.createUnauthenticatedContext = exports.createMockVerifier = exports.createCognitoVerifier = exports.createAuthUserFromClaims = exports.createAuthMiddleware = exports.createAuthContext = exports.authenticate = exports.requirePermissions = exports.requireOperation = exports.OPERATION_PERMISSIONS = exports.isValidPermission = exports.hasPermission = exports.hasAnyPermission = exports.hasAllPermissions = exports.getOperationPermissions = exports.getMissingPermissions = exports.createAuthorizationAuditEntry = exports.authorizeOperation = exports.authorize = exports.validateRoles = exports.rolesHavePermission = exports.roleHasPermission = exports.normalizeRoles = exports.isValidRole = exports.isAdminRole = exports.hasAdminRole = exports.getRolePermissions = exports.getPermissionsForRoles = exports.getHighestPrivilegeRole = exports.getAllRoles = exports.getAllPermissions = exports.ROLES = exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.AuthorizationError = exports.AuthenticationError = void 0;
exports.SecurityService = exports.DEFAULT_SECURITY_CONFIG = exports.createSecurityService = exports.resetStores = exports.recordRequest = exports.recordFailedLoginAttempt = exports.isUnusualAccessTime = exports.isRateLimitExceeded = exports.isFailedLoginThresholdExceeded = exports.getSeverityForActivityType = exports.getRecommendedActions = exports.getFailedLoginAttempts = exports.detectSuspiciousActivity = exports.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG = exports.createSuspiciousActivity = exports.createSecurityAlert = exports.clearSessionIp = exports.clearFailedLoginAttempts = exports.checkIpChangeDuringSession = exports.checkRateLimit = exports.checkFailedLoginThreshold = exports.validateIpAllowlist = exports.userRequiresIpAllowlist = exports.roleRequiresIpAllowlist = exports.requireIpAllowlist = exports.parseIpAddress = exports.parseCidr = exports.isValidIpAddress = exports.isValidCidr = exports.ipToNumber = void 0;
// Types
var auth_types_1 = require("./auth-types");
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return auth_types_1.AuthenticationError; } });
Object.defineProperty(exports, "AuthorizationError", { enumerable: true, get: function () { return auth_types_1.AuthorizationError; } });
Object.defineProperty(exports, "PERMISSIONS", { enumerable: true, get: function () { return auth_types_1.PERMISSIONS; } });
Object.defineProperty(exports, "ROLE_PERMISSIONS", { enumerable: true, get: function () { return auth_types_1.ROLE_PERMISSIONS; } });
Object.defineProperty(exports, "ROLES", { enumerable: true, get: function () { return auth_types_1.ROLES; } });
// Role service
var role_service_1 = require("./role-service");
Object.defineProperty(exports, "getAllPermissions", { enumerable: true, get: function () { return role_service_1.getAllPermissions; } });
Object.defineProperty(exports, "getAllRoles", { enumerable: true, get: function () { return role_service_1.getAllRoles; } });
Object.defineProperty(exports, "getHighestPrivilegeRole", { enumerable: true, get: function () { return role_service_1.getHighestPrivilegeRole; } });
Object.defineProperty(exports, "getPermissionsForRoles", { enumerable: true, get: function () { return role_service_1.getPermissionsForRoles; } });
Object.defineProperty(exports, "getRolePermissions", { enumerable: true, get: function () { return role_service_1.getRolePermissions; } });
Object.defineProperty(exports, "hasAdminRole", { enumerable: true, get: function () { return role_service_1.hasAdminRole; } });
Object.defineProperty(exports, "isAdminRole", { enumerable: true, get: function () { return role_service_1.isAdminRole; } });
Object.defineProperty(exports, "isValidRole", { enumerable: true, get: function () { return role_service_1.isValidRole; } });
Object.defineProperty(exports, "normalizeRoles", { enumerable: true, get: function () { return role_service_1.normalizeRoles; } });
Object.defineProperty(exports, "roleHasPermission", { enumerable: true, get: function () { return role_service_1.roleHasPermission; } });
Object.defineProperty(exports, "rolesHavePermission", { enumerable: true, get: function () { return role_service_1.rolesHavePermission; } });
Object.defineProperty(exports, "validateRoles", { enumerable: true, get: function () { return role_service_1.validateRoles; } });
// Permission service
var permission_service_1 = require("./permission-service");
Object.defineProperty(exports, "authorize", { enumerable: true, get: function () { return permission_service_1.authorize; } });
Object.defineProperty(exports, "authorizeOperation", { enumerable: true, get: function () { return permission_service_1.authorizeOperation; } });
Object.defineProperty(exports, "createAuthorizationAuditEntry", { enumerable: true, get: function () { return permission_service_1.createAuthorizationAuditEntry; } });
Object.defineProperty(exports, "getMissingPermissions", { enumerable: true, get: function () { return permission_service_1.getMissingPermissions; } });
Object.defineProperty(exports, "getOperationPermissions", { enumerable: true, get: function () { return permission_service_1.getOperationPermissions; } });
Object.defineProperty(exports, "hasAllPermissions", { enumerable: true, get: function () { return permission_service_1.hasAllPermissions; } });
Object.defineProperty(exports, "hasAnyPermission", { enumerable: true, get: function () { return permission_service_1.hasAnyPermission; } });
Object.defineProperty(exports, "hasPermission", { enumerable: true, get: function () { return permission_service_1.hasPermission; } });
Object.defineProperty(exports, "isValidPermission", { enumerable: true, get: function () { return permission_service_1.isValidPermission; } });
Object.defineProperty(exports, "OPERATION_PERMISSIONS", { enumerable: true, get: function () { return permission_service_1.OPERATION_PERMISSIONS; } });
Object.defineProperty(exports, "requireOperation", { enumerable: true, get: function () { return permission_service_1.requireOperation; } });
Object.defineProperty(exports, "requirePermissions", { enumerable: true, get: function () { return permission_service_1.requirePermissions; } });
// Auth middleware
var auth_middleware_1 = require("./auth-middleware");
Object.defineProperty(exports, "authenticate", { enumerable: true, get: function () { return auth_middleware_1.authenticate; } });
Object.defineProperty(exports, "createAuthContext", { enumerable: true, get: function () { return auth_middleware_1.createAuthContext; } });
Object.defineProperty(exports, "createAuthMiddleware", { enumerable: true, get: function () { return auth_middleware_1.createAuthMiddleware; } });
Object.defineProperty(exports, "createAuthUserFromClaims", { enumerable: true, get: function () { return auth_middleware_1.createAuthUserFromClaims; } });
Object.defineProperty(exports, "createCognitoVerifier", { enumerable: true, get: function () { return auth_middleware_1.createCognitoVerifier; } });
Object.defineProperty(exports, "createMockVerifier", { enumerable: true, get: function () { return auth_middleware_1.createMockVerifier; } });
Object.defineProperty(exports, "createUnauthenticatedContext", { enumerable: true, get: function () { return auth_middleware_1.createUnauthenticatedContext; } });
Object.defineProperty(exports, "extractBearerToken", { enumerable: true, get: function () { return auth_middleware_1.extractBearerToken; } });
Object.defineProperty(exports, "getAuthContext", { enumerable: true, get: function () { return auth_middleware_1.getAuthContext; } });
Object.defineProperty(exports, "isAuthenticated", { enumerable: true, get: function () { return auth_middleware_1.isAuthenticated; } });
Object.defineProperty(exports, "withAuth", { enumerable: true, get: function () { return auth_middleware_1.withAuth; } });
// Security types
var security_types_1 = require("./security-types");
Object.defineProperty(exports, "ALERT_SEVERITY", { enumerable: true, get: function () { return security_types_1.ALERT_SEVERITY; } });
Object.defineProperty(exports, "ALERT_STATUS", { enumerable: true, get: function () { return security_types_1.ALERT_STATUS; } });
Object.defineProperty(exports, "IpNotAllowedError", { enumerable: true, get: function () { return security_types_1.IpNotAllowedError; } });
Object.defineProperty(exports, "SuspiciousActivityBlockedError", { enumerable: true, get: function () { return security_types_1.SuspiciousActivityBlockedError; } });
Object.defineProperty(exports, "SUSPICIOUS_ACTIVITY_TYPES", { enumerable: true, get: function () { return security_types_1.SUSPICIOUS_ACTIVITY_TYPES; } });
// IP Allowlist service
var ip_allowlist_service_1 = require("./ip-allowlist-service");
Object.defineProperty(exports, "createIpAllowlistEntry", { enumerable: true, get: function () { return ip_allowlist_service_1.createIpAllowlistEntry; } });
Object.defineProperty(exports, "DEFAULT_IP_ALLOWLIST_CONFIG", { enumerable: true, get: function () { return ip_allowlist_service_1.DEFAULT_IP_ALLOWLIST_CONFIG; } });
Object.defineProperty(exports, "getActiveEntries", { enumerable: true, get: function () { return ip_allowlist_service_1.getActiveEntries; } });
Object.defineProperty(exports, "ipMatchesCidr", { enumerable: true, get: function () { return ip_allowlist_service_1.ipMatchesCidr; } });
Object.defineProperty(exports, "ipMatchesEntry", { enumerable: true, get: function () { return ip_allowlist_service_1.ipMatchesEntry; } });
Object.defineProperty(exports, "ipToNumber", { enumerable: true, get: function () { return ip_allowlist_service_1.ipToNumber; } });
Object.defineProperty(exports, "isValidCidr", { enumerable: true, get: function () { return ip_allowlist_service_1.isValidCidr; } });
Object.defineProperty(exports, "isValidIpAddress", { enumerable: true, get: function () { return ip_allowlist_service_1.isValidIpAddress; } });
Object.defineProperty(exports, "parseCidr", { enumerable: true, get: function () { return ip_allowlist_service_1.parseCidr; } });
Object.defineProperty(exports, "parseIpAddress", { enumerable: true, get: function () { return ip_allowlist_service_1.parseIpAddress; } });
Object.defineProperty(exports, "requireIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.requireIpAllowlist; } });
Object.defineProperty(exports, "roleRequiresIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.roleRequiresIpAllowlist; } });
Object.defineProperty(exports, "userRequiresIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.userRequiresIpAllowlist; } });
Object.defineProperty(exports, "validateIpAllowlist", { enumerable: true, get: function () { return ip_allowlist_service_1.validateIpAllowlist; } });
// Suspicious activity service
var suspicious_activity_service_1 = require("./suspicious-activity-service");
Object.defineProperty(exports, "checkFailedLoginThreshold", { enumerable: true, get: function () { return suspicious_activity_service_1.checkFailedLoginThreshold; } });
Object.defineProperty(exports, "checkRateLimit", { enumerable: true, get: function () { return suspicious_activity_service_1.checkRateLimit; } });
Object.defineProperty(exports, "checkIpChangeDuringSession", { enumerable: true, get: function () { return suspicious_activity_service_1.checkIpChangeDuringSession; } });
Object.defineProperty(exports, "clearFailedLoginAttempts", { enumerable: true, get: function () { return suspicious_activity_service_1.clearFailedLoginAttempts; } });
Object.defineProperty(exports, "clearSessionIp", { enumerable: true, get: function () { return suspicious_activity_service_1.clearSessionIp; } });
Object.defineProperty(exports, "createSecurityAlert", { enumerable: true, get: function () { return suspicious_activity_service_1.createSecurityAlert; } });
Object.defineProperty(exports, "createSuspiciousActivity", { enumerable: true, get: function () { return suspicious_activity_service_1.createSuspiciousActivity; } });
Object.defineProperty(exports, "DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG", { enumerable: true, get: function () { return suspicious_activity_service_1.DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG; } });
Object.defineProperty(exports, "detectSuspiciousActivity", { enumerable: true, get: function () { return suspicious_activity_service_1.detectSuspiciousActivity; } });
Object.defineProperty(exports, "getFailedLoginAttempts", { enumerable: true, get: function () { return suspicious_activity_service_1.getFailedLoginAttempts; } });
Object.defineProperty(exports, "getRecommendedActions", { enumerable: true, get: function () { return suspicious_activity_service_1.getRecommendedActions; } });
Object.defineProperty(exports, "getSeverityForActivityType", { enumerable: true, get: function () { return suspicious_activity_service_1.getSeverityForActivityType; } });
Object.defineProperty(exports, "isFailedLoginThresholdExceeded", { enumerable: true, get: function () { return suspicious_activity_service_1.isFailedLoginThresholdExceeded; } });
Object.defineProperty(exports, "isRateLimitExceeded", { enumerable: true, get: function () { return suspicious_activity_service_1.isRateLimitExceeded; } });
Object.defineProperty(exports, "isUnusualAccessTime", { enumerable: true, get: function () { return suspicious_activity_service_1.isUnusualAccessTime; } });
Object.defineProperty(exports, "recordFailedLoginAttempt", { enumerable: true, get: function () { return suspicious_activity_service_1.recordFailedLoginAttempt; } });
Object.defineProperty(exports, "recordRequest", { enumerable: true, get: function () { return suspicious_activity_service_1.recordRequest; } });
Object.defineProperty(exports, "resetStores", { enumerable: true, get: function () { return suspicious_activity_service_1.resetStores; } });
// Security service
var security_service_1 = require("./security-service");
Object.defineProperty(exports, "createSecurityService", { enumerable: true, get: function () { return security_service_1.createSecurityService; } });
Object.defineProperty(exports, "DEFAULT_SECURITY_CONFIG", { enumerable: true, get: function () { return security_service_1.DEFAULT_SECURITY_CONFIG; } });
Object.defineProperty(exports, "SecurityService", { enumerable: true, get: function () { return security_service_1.SecurityService; } });
//# sourceMappingURL=index.js.map