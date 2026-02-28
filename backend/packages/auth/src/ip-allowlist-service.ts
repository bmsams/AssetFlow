/**
 * IP Allowlist Service
 * 
 * Implements IP allowlisting for administrative access control.
 * Based on Requirement 14.9: THE Security_Service SHALL implement IP allowlisting for administrative access
 */

import { createLogger } from '@ams/utils';

import { ROLES, type Role } from './auth-types';
import {
  type IpAllowlistConfig,
  type IpAllowlistEntry,
  type IpAllowlistResult,
  IpNotAllowedError,
} from './security-types';

const logger = createLogger({ service: 'ip-allowlist-service' });

/**
 * Default IP allowlist configuration
 */
export const DEFAULT_IP_ALLOWLIST_CONFIG: IpAllowlistConfig = {
  enabled: false,
  entries: [],
  allowWhenEmpty: true,
  protectedRoles: [ROLES.ADMIN],
};

/**
 * Parse an IP address into its numeric components
 * Supports IPv4 addresses only
 */
export function parseIpAddress(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    octets.push(num);
  }

  return octets;
}

/**
 * Convert IP address to a 32-bit integer for comparison
 */
export function ipToNumber(ip: string): number | null {
  const octets = parseIpAddress(ip);
  if (!octets) {
    return null;
  }

  return (
    (octets[0]! << 24) +
    (octets[1]! << 16) +
    (octets[2]! << 8) +
    octets[3]!
  ) >>> 0; // Convert to unsigned
}

/**
 * Parse a CIDR notation (e.g., "192.168.1.0/24") into IP and prefix length
 */
export function parseCidr(cidr: string): { ip: string; prefixLength: number } | null {
  const parts = cidr.split('/');
  if (parts.length === 1) {
    // Single IP address, treat as /32
    if (parseIpAddress(parts[0]!)) {
      return { ip: parts[0]!, prefixLength: 32 };
    }
    return null;
  }

  if (parts.length !== 2) {
    return null;
  }

  const ip = parts[0]!;
  const prefixLength = parseInt(parts[1]!, 10);

  if (!parseIpAddress(ip)) {
    return null;
  }

  if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > 32) {
    return null;
  }

  return { ip, prefixLength };
}

/**
 * Check if an IP address matches a CIDR range
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  const ipNum = ipToNumber(ip);
  if (ipNum === null) {
    return false;
  }

  const cidrParsed = parseCidr(cidr);
  if (!cidrParsed) {
    return false;
  }

  const cidrIpNum = ipToNumber(cidrParsed.ip);
  if (cidrIpNum === null) {
    return false;
  }

  // Create mask from prefix length
  const mask = cidrParsed.prefixLength === 0 
    ? 0 
    : (~0 << (32 - cidrParsed.prefixLength)) >>> 0;

  return (ipNum & mask) === (cidrIpNum & mask);
}

/**
 * Check if an IP address matches an allowlist entry
 */
export function ipMatchesEntry(ip: string, entry: IpAllowlistEntry): boolean {
  if (!entry.isActive) {
    return false;
  }

  // Check if entry has expired
  if (entry.expiresAt) {
    const expirationDate = new Date(entry.expiresAt);
    if (expirationDate < new Date()) {
      return false;
    }
  }

  return ipMatchesCidr(ip, entry.ipAddress);
}

/**
 * Validate an IP address against the allowlist
 */
export function validateIpAllowlist(
  sourceIp: string,
  config: IpAllowlistConfig
): IpAllowlistResult {
  // If allowlisting is disabled, allow all
  if (!config.enabled) {
    return {
      allowed: true,
      reason: 'IP allowlisting is disabled',
    };
  }

  // If no entries and allowWhenEmpty is true, allow
  if (config.entries.length === 0 && config.allowWhenEmpty) {
    return {
      allowed: true,
      reason: 'Allowlist is empty and allowWhenEmpty is enabled',
    };
  }

  // If no entries and allowWhenEmpty is false, deny
  if (config.entries.length === 0 && !config.allowWhenEmpty) {
    return {
      allowed: false,
      reason: 'Allowlist is empty and no IPs are permitted',
    };
  }

  // Check against each entry
  for (const entry of config.entries) {
    if (ipMatchesEntry(sourceIp, entry)) {
      return {
        allowed: true,
        reason: `IP matches allowlist entry: ${entry.description}`,
        matchedEntry: entry,
      };
    }
  }

  return {
    allowed: false,
    reason: `IP ${sourceIp} is not in the allowlist`,
  };
}

/**
 * Check if a role requires IP allowlist validation
 */
export function roleRequiresIpAllowlist(
  role: Role,
  protectedRoles: readonly string[]
): boolean {
  return protectedRoles.includes(role);
}

/**
 * Check if any of the user's roles require IP allowlist validation
 */
export function userRequiresIpAllowlist(
  userRoles: readonly Role[],
  protectedRoles: readonly string[]
): boolean {
  return userRoles.some(role => roleRequiresIpAllowlist(role, protectedRoles));
}

/**
 * Validate IP allowlist for admin access
 * Throws IpNotAllowedError if IP is not allowed
 */
export function requireIpAllowlist(
  sourceIp: string,
  userRoles: readonly Role[],
  config: IpAllowlistConfig,
  requestId?: string
): void {
  // Check if user's roles require IP validation
  if (!userRequiresIpAllowlist(userRoles, config.protectedRoles)) {
    logger.debug('User roles do not require IP allowlist validation', {
      requestId,
      userRoles,
      protectedRoles: config.protectedRoles,
    });
    return;
  }

  const result = validateIpAllowlist(sourceIp, config);

  if (!result.allowed) {
    logger.warn('IP not allowed for admin access', {
      requestId,
      sourceIp,
      userRoles,
      reason: result.reason,
    });
    throw new IpNotAllowedError(result.reason, sourceIp);
  }

  logger.info('IP allowed for admin access', {
    requestId,
    sourceIp,
    userRoles,
    matchedEntry: result.matchedEntry?.description,
  });
}

/**
 * Create an IP allowlist entry
 */
export function createIpAllowlistEntry(
  ipAddress: string,
  description: string,
  createdBy: string,
  options: {
    id?: string;
    isActive?: boolean;
    expiresAt?: string;
  } = {}
): IpAllowlistEntry {
  // Validate IP/CIDR format
  const parsed = parseCidr(ipAddress);
  if (!parsed) {
    throw new Error(`Invalid IP address or CIDR: ${ipAddress}`);
  }

  return {
    id: options.id ?? crypto.randomUUID(),
    ipAddress,
    description,
    isActive: options.isActive ?? true,
    createdAt: new Date().toISOString(),
    createdBy,
    expiresAt: options.expiresAt,
  };
}

/**
 * Check if an IP address is valid
 */
export function isValidIpAddress(ip: string): boolean {
  return parseIpAddress(ip) !== null;
}

/**
 * Check if a CIDR notation is valid
 */
export function isValidCidr(cidr: string): boolean {
  return parseCidr(cidr) !== null;
}

/**
 * Get active entries from the allowlist
 */
export function getActiveEntries(entries: readonly IpAllowlistEntry[]): IpAllowlistEntry[] {
  const now = new Date();
  return entries.filter(entry => {
    if (!entry.isActive) {
      return false;
    }
    if (entry.expiresAt) {
      return new Date(entry.expiresAt) > now;
    }
    return true;
  });
}
