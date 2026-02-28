"use strict";
/**
 * IP Allowlist Service
 *
 * Implements IP allowlisting for administrative access control.
 * Based on Requirement 14.9: THE Security_Service SHALL implement IP allowlisting for administrative access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_IP_ALLOWLIST_CONFIG = void 0;
exports.parseIpAddress = parseIpAddress;
exports.ipToNumber = ipToNumber;
exports.parseCidr = parseCidr;
exports.ipMatchesCidr = ipMatchesCidr;
exports.ipMatchesEntry = ipMatchesEntry;
exports.validateIpAllowlist = validateIpAllowlist;
exports.roleRequiresIpAllowlist = roleRequiresIpAllowlist;
exports.userRequiresIpAllowlist = userRequiresIpAllowlist;
exports.requireIpAllowlist = requireIpAllowlist;
exports.createIpAllowlistEntry = createIpAllowlistEntry;
exports.isValidIpAddress = isValidIpAddress;
exports.isValidCidr = isValidCidr;
exports.getActiveEntries = getActiveEntries;
const utils_1 = require("@ams/utils");
const auth_types_1 = require("./auth-types");
const security_types_1 = require("./security-types");
const logger = (0, utils_1.createLogger)({ service: 'ip-allowlist-service' });
/**
 * Default IP allowlist configuration
 */
exports.DEFAULT_IP_ALLOWLIST_CONFIG = {
    enabled: false,
    entries: [],
    allowWhenEmpty: true,
    protectedRoles: [auth_types_1.ROLES.ADMIN],
};
/**
 * Parse an IP address into its numeric components
 * Supports IPv4 addresses only
 */
function parseIpAddress(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) {
        return null;
    }
    const octets = [];
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
function ipToNumber(ip) {
    const octets = parseIpAddress(ip);
    if (!octets) {
        return null;
    }
    return ((octets[0] << 24) +
        (octets[1] << 16) +
        (octets[2] << 8) +
        octets[3]) >>> 0; // Convert to unsigned
}
/**
 * Parse a CIDR notation (e.g., "192.168.1.0/24") into IP and prefix length
 */
function parseCidr(cidr) {
    const parts = cidr.split('/');
    if (parts.length === 1) {
        // Single IP address, treat as /32
        if (parseIpAddress(parts[0])) {
            return { ip: parts[0], prefixLength: 32 };
        }
        return null;
    }
    if (parts.length !== 2) {
        return null;
    }
    const ip = parts[0];
    const prefixLength = parseInt(parts[1], 10);
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
function ipMatchesCidr(ip, cidr) {
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
function ipMatchesEntry(ip, entry) {
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
function validateIpAllowlist(sourceIp, config) {
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
function roleRequiresIpAllowlist(role, protectedRoles) {
    return protectedRoles.includes(role);
}
/**
 * Check if any of the user's roles require IP allowlist validation
 */
function userRequiresIpAllowlist(userRoles, protectedRoles) {
    return userRoles.some(role => roleRequiresIpAllowlist(role, protectedRoles));
}
/**
 * Validate IP allowlist for admin access
 * Throws IpNotAllowedError if IP is not allowed
 */
function requireIpAllowlist(sourceIp, userRoles, config, requestId) {
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
        throw new security_types_1.IpNotAllowedError(result.reason, sourceIp);
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
function createIpAllowlistEntry(ipAddress, description, createdBy, options = {}) {
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
function isValidIpAddress(ip) {
    return parseIpAddress(ip) !== null;
}
/**
 * Check if a CIDR notation is valid
 */
function isValidCidr(cidr) {
    return parseCidr(cidr) !== null;
}
/**
 * Get active entries from the allowlist
 */
function getActiveEntries(entries) {
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
//# sourceMappingURL=ip-allowlist-service.js.map