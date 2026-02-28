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
export { type AuthConfig, type AuthContext, type AuthorizationAuditEntry, type AuthorizationResult, type AuthUser, type CognitoTokenClaims, type Permission, type Role, AuthenticationError, AuthorizationError, PERMISSIONS, ROLE_PERMISSIONS, ROLES, } from './auth-types';
export { getAllPermissions, getAllRoles, getHighestPrivilegeRole, getPermissionsForRoles, getRolePermissions, hasAdminRole, isAdminRole, isValidRole, normalizeRoles, roleHasPermission, rolesHavePermission, validateRoles, } from './role-service';
export { authorize, authorizeOperation, createAuthorizationAuditEntry, getMissingPermissions, getOperationPermissions, hasAllPermissions, hasAnyPermission, hasPermission, isValidPermission, OPERATION_PERMISSIONS, type Operation, requireOperation, requirePermissions, } from './permission-service';
export { authenticate, type AuthenticatedHandler, createAuthContext, createAuthMiddleware, createAuthUserFromClaims, createCognitoVerifier, createMockVerifier, createUnauthenticatedContext, extractBearerToken, getAuthContext, isAuthenticated, type JwtVerifier, withAuth, type WithAuthOptions, } from './auth-middleware';
export { type AlertSeverity, type AlertStatus, type FailedLoginAttempt, type IpAllowlistConfig, type IpAllowlistEntry, type IpAllowlistResult, type SecurityAlert, type SecurityEvent, type SuspiciousActivity, type SuspiciousActivityConfig, type SuspiciousActivityType, ALERT_SEVERITY, ALERT_STATUS, IpNotAllowedError, SuspiciousActivityBlockedError, SUSPICIOUS_ACTIVITY_TYPES, } from './security-types';
export { createIpAllowlistEntry, DEFAULT_IP_ALLOWLIST_CONFIG, getActiveEntries, ipMatchesCidr, ipMatchesEntry, ipToNumber, isValidCidr, isValidIpAddress, parseCidr, parseIpAddress, requireIpAllowlist, roleRequiresIpAllowlist, userRequiresIpAllowlist, validateIpAllowlist, } from './ip-allowlist-service';
export { checkFailedLoginThreshold, checkRateLimit, checkIpChangeDuringSession, clearFailedLoginAttempts, clearSessionIp, createSecurityAlert, createSuspiciousActivity, DEFAULT_SUSPICIOUS_ACTIVITY_CONFIG, detectSuspiciousActivity, getFailedLoginAttempts, getRecommendedActions, getSeverityForActivityType, isFailedLoginThresholdExceeded, isRateLimitExceeded, isUnusualAccessTime, recordFailedLoginAttempt, recordRequest, resetStores, } from './suspicious-activity-service';
export { createSecurityService, DEFAULT_SECURITY_CONFIG, SecurityService, type SecurityCheckResult, type SecurityConfig, } from './security-service';
//# sourceMappingURL=index.d.ts.map