/**
 * IP Allowlist Service
 *
 * Implements IP allowlisting for administrative access control.
 * Based on Requirement 14.9: THE Security_Service SHALL implement IP allowlisting for administrative access
 */
import { type Role } from './auth-types';
import { type IpAllowlistConfig, type IpAllowlistEntry, type IpAllowlistResult } from './security-types';
/**
 * Default IP allowlist configuration
 */
export declare const DEFAULT_IP_ALLOWLIST_CONFIG: IpAllowlistConfig;
/**
 * Parse an IP address into its numeric components
 * Supports IPv4 addresses only
 */
export declare function parseIpAddress(ip: string): number[] | null;
/**
 * Convert IP address to a 32-bit integer for comparison
 */
export declare function ipToNumber(ip: string): number | null;
/**
 * Parse a CIDR notation (e.g., "192.168.1.0/24") into IP and prefix length
 */
export declare function parseCidr(cidr: string): {
    ip: string;
    prefixLength: number;
} | null;
/**
 * Check if an IP address matches a CIDR range
 */
export declare function ipMatchesCidr(ip: string, cidr: string): boolean;
/**
 * Check if an IP address matches an allowlist entry
 */
export declare function ipMatchesEntry(ip: string, entry: IpAllowlistEntry): boolean;
/**
 * Validate an IP address against the allowlist
 */
export declare function validateIpAllowlist(sourceIp: string, config: IpAllowlistConfig): IpAllowlistResult;
/**
 * Check if a role requires IP allowlist validation
 */
export declare function roleRequiresIpAllowlist(role: Role, protectedRoles: readonly string[]): boolean;
/**
 * Check if any of the user's roles require IP allowlist validation
 */
export declare function userRequiresIpAllowlist(userRoles: readonly Role[], protectedRoles: readonly string[]): boolean;
/**
 * Validate IP allowlist for admin access
 * Throws IpNotAllowedError if IP is not allowed
 */
export declare function requireIpAllowlist(sourceIp: string, userRoles: readonly Role[], config: IpAllowlistConfig, requestId?: string): void;
/**
 * Create an IP allowlist entry
 */
export declare function createIpAllowlistEntry(ipAddress: string, description: string, createdBy: string, options?: {
    id?: string;
    isActive?: boolean;
    expiresAt?: string;
}): IpAllowlistEntry;
/**
 * Check if an IP address is valid
 */
export declare function isValidIpAddress(ip: string): boolean;
/**
 * Check if a CIDR notation is valid
 */
export declare function isValidCidr(cidr: string): boolean;
/**
 * Get active entries from the allowlist
 */
export declare function getActiveEntries(entries: readonly IpAllowlistEntry[]): IpAllowlistEntry[];
//# sourceMappingURL=ip-allowlist-service.d.ts.map