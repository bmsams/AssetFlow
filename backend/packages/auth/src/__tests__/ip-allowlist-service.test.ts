/**
 * IP Allowlist Service Tests
 * 
 * Tests for IP allowlisting functionality (Requirement 14.9)
 */

import {
  createIpAllowlistEntry,
  DEFAULT_IP_ALLOWLIST_CONFIG,
  getActiveEntries,
  ipMatchesCidr,
  ipMatchesEntry,
  ipToNumber,
  type IpAllowlistConfig,
  type IpAllowlistEntry,
  IpNotAllowedError,
  isValidCidr,
  isValidIpAddress,
  parseCidr,
  parseIpAddress,
  requireIpAllowlist,
  roleRequiresIpAllowlist,
  ROLES,
  userRequiresIpAllowlist,
  validateIpAllowlist,
} from '../index';

describe('parseIpAddress', () => {
  it('should parse valid IPv4 addresses', () => {
    expect(parseIpAddress('192.168.1.1')).toEqual([192, 168, 1, 1]);
    expect(parseIpAddress('10.0.0.1')).toEqual([10, 0, 0, 1]);
    expect(parseIpAddress('0.0.0.0')).toEqual([0, 0, 0, 0]);
    expect(parseIpAddress('255.255.255.255')).toEqual([255, 255, 255, 255]);
  });

  it('should return null for invalid IP addresses', () => {
    expect(parseIpAddress('256.1.1.1')).toBeNull();
    expect(parseIpAddress('192.168.1')).toBeNull();
    expect(parseIpAddress('192.168.1.1.1')).toBeNull();
    expect(parseIpAddress('abc.def.ghi.jkl')).toBeNull();
    expect(parseIpAddress('')).toBeNull();
    expect(parseIpAddress('192.168.-1.1')).toBeNull();
  });
});

describe('ipToNumber', () => {
  it('should convert IP addresses to numbers', () => {
    expect(ipToNumber('0.0.0.0')).toBe(0);
    expect(ipToNumber('0.0.0.1')).toBe(1);
    expect(ipToNumber('0.0.1.0')).toBe(256);
    expect(ipToNumber('192.168.1.1')).toBe(3232235777);
    expect(ipToNumber('255.255.255.255')).toBe(4294967295);
  });

  it('should return null for invalid IP addresses', () => {
    expect(ipToNumber('invalid')).toBeNull();
    expect(ipToNumber('256.0.0.0')).toBeNull();
  });
});

describe('parseCidr', () => {
  it('should parse valid CIDR notation', () => {
    expect(parseCidr('192.168.1.0/24')).toEqual({ ip: '192.168.1.0', prefixLength: 24 });
    expect(parseCidr('10.0.0.0/8')).toEqual({ ip: '10.0.0.0', prefixLength: 8 });
    expect(parseCidr('0.0.0.0/0')).toEqual({ ip: '0.0.0.0', prefixLength: 0 });
    expect(parseCidr('192.168.1.1/32')).toEqual({ ip: '192.168.1.1', prefixLength: 32 });
  });

  it('should treat single IP as /32', () => {
    expect(parseCidr('192.168.1.1')).toEqual({ ip: '192.168.1.1', prefixLength: 32 });
  });

  it('should return null for invalid CIDR', () => {
    expect(parseCidr('192.168.1.0/33')).toBeNull();
    expect(parseCidr('192.168.1.0/-1')).toBeNull();
    expect(parseCidr('invalid/24')).toBeNull();
    expect(parseCidr('192.168.1.0/abc')).toBeNull();
  });
});

describe('ipMatchesCidr', () => {
  it('should match IP within CIDR range', () => {
    expect(ipMatchesCidr('192.168.1.1', '192.168.1.0/24')).toBe(true);
    expect(ipMatchesCidr('192.168.1.255', '192.168.1.0/24')).toBe(true);
    expect(ipMatchesCidr('10.0.0.1', '10.0.0.0/8')).toBe(true);
    expect(ipMatchesCidr('10.255.255.255', '10.0.0.0/8')).toBe(true);
  });

  it('should not match IP outside CIDR range', () => {
    expect(ipMatchesCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);
    expect(ipMatchesCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
  });

  it('should match exact IP with /32', () => {
    expect(ipMatchesCidr('192.168.1.1', '192.168.1.1/32')).toBe(true);
    expect(ipMatchesCidr('192.168.1.1', '192.168.1.1')).toBe(true);
    expect(ipMatchesCidr('192.168.1.2', '192.168.1.1/32')).toBe(false);
  });

  it('should match all IPs with /0', () => {
    expect(ipMatchesCidr('192.168.1.1', '0.0.0.0/0')).toBe(true);
    expect(ipMatchesCidr('10.0.0.1', '0.0.0.0/0')).toBe(true);
  });

  it('should return false for invalid inputs', () => {
    expect(ipMatchesCidr('invalid', '192.168.1.0/24')).toBe(false);
    expect(ipMatchesCidr('192.168.1.1', 'invalid')).toBe(false);
  });
});

describe('isValidIpAddress', () => {
  it('should return true for valid IP addresses', () => {
    expect(isValidIpAddress('192.168.1.1')).toBe(true);
    expect(isValidIpAddress('10.0.0.1')).toBe(true);
    expect(isValidIpAddress('0.0.0.0')).toBe(true);
  });

  it('should return false for invalid IP addresses', () => {
    expect(isValidIpAddress('256.1.1.1')).toBe(false);
    expect(isValidIpAddress('invalid')).toBe(false);
  });
});

describe('isValidCidr', () => {
  it('should return true for valid CIDR', () => {
    expect(isValidCidr('192.168.1.0/24')).toBe(true);
    expect(isValidCidr('10.0.0.0/8')).toBe(true);
    expect(isValidCidr('192.168.1.1')).toBe(true);
  });

  it('should return false for invalid CIDR', () => {
    expect(isValidCidr('192.168.1.0/33')).toBe(false);
    expect(isValidCidr('invalid/24')).toBe(false);
  });
});

describe('ipMatchesEntry', () => {
  const createEntry = (overrides: Partial<IpAllowlistEntry> = {}): IpAllowlistEntry => ({
    id: 'test-id',
    ipAddress: '192.168.1.0/24',
    description: 'Test entry',
    isActive: true,
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
    ...overrides,
  });

  it('should match IP against active entry', () => {
    const entry = createEntry();
    expect(ipMatchesEntry('192.168.1.1', entry)).toBe(true);
    expect(ipMatchesEntry('192.168.2.1', entry)).toBe(false);
  });

  it('should not match against inactive entry', () => {
    const entry = createEntry({ isActive: false });
    expect(ipMatchesEntry('192.168.1.1', entry)).toBe(false);
  });

  it('should not match against expired entry', () => {
    const entry = createEntry({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(ipMatchesEntry('192.168.1.1', entry)).toBe(false);
  });

  it('should match against non-expired entry', () => {
    const entry = createEntry({
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    expect(ipMatchesEntry('192.168.1.1', entry)).toBe(true);
  });
});

describe('validateIpAllowlist', () => {
  const createConfig = (overrides: Partial<IpAllowlistConfig> = {}): IpAllowlistConfig => ({
    enabled: true,
    entries: [
      {
        id: '1',
        ipAddress: '192.168.1.0/24',
        description: 'Office network',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
      {
        id: '2',
        ipAddress: '10.0.0.0/8',
        description: 'VPN',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
    ],
    allowWhenEmpty: true,
    protectedRoles: [ROLES.ADMIN],
    ...overrides,
  });

  it('should allow when allowlisting is disabled', () => {
    const config = createConfig({ enabled: false });
    const result = validateIpAllowlist('1.2.3.4', config);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('IP allowlisting is disabled');
  });

  it('should allow when list is empty and allowWhenEmpty is true', () => {
    const config = createConfig({ entries: [], allowWhenEmpty: true });
    const result = validateIpAllowlist('1.2.3.4', config);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('Allowlist is empty and allowWhenEmpty is enabled');
  });

  it('should deny when list is empty and allowWhenEmpty is false', () => {
    const config = createConfig({ entries: [], allowWhenEmpty: false });
    const result = validateIpAllowlist('1.2.3.4', config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Allowlist is empty and no IPs are permitted');
  });

  it('should allow IP in allowlist', () => {
    const config = createConfig();
    const result = validateIpAllowlist('192.168.1.100', config);
    expect(result.allowed).toBe(true);
    expect(result.matchedEntry?.description).toBe('Office network');
  });

  it('should deny IP not in allowlist', () => {
    const config = createConfig();
    const result = validateIpAllowlist('172.16.0.1', config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not in the allowlist');
  });
});

describe('roleRequiresIpAllowlist', () => {
  it('should return true for protected roles', () => {
    expect(roleRequiresIpAllowlist(ROLES.ADMIN, [ROLES.ADMIN])).toBe(true);
  });

  it('should return false for non-protected roles', () => {
    expect(roleRequiresIpAllowlist(ROLES.VIEWER, [ROLES.ADMIN])).toBe(false);
    expect(roleRequiresIpAllowlist(ROLES.ASSET_MANAGER, [ROLES.ADMIN])).toBe(false);
  });
});

describe('userRequiresIpAllowlist', () => {
  it('should return true if any role requires allowlist', () => {
    expect(userRequiresIpAllowlist([ROLES.ADMIN, ROLES.VIEWER], [ROLES.ADMIN])).toBe(true);
  });

  it('should return false if no roles require allowlist', () => {
    expect(userRequiresIpAllowlist([ROLES.VIEWER, ROLES.ASSET_MANAGER], [ROLES.ADMIN])).toBe(false);
  });
});

describe('requireIpAllowlist', () => {
  const createConfig = (): IpAllowlistConfig => ({
    enabled: true,
    entries: [
      {
        id: '1',
        ipAddress: '192.168.1.0/24',
        description: 'Office',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
    ],
    allowWhenEmpty: false,
    protectedRoles: [ROLES.ADMIN],
  });

  it('should not throw for non-protected roles', () => {
    const config = createConfig();
    expect(() => requireIpAllowlist('1.2.3.4', [ROLES.VIEWER], config)).not.toThrow();
  });

  it('should not throw for allowed IP with protected role', () => {
    const config = createConfig();
    expect(() => requireIpAllowlist('192.168.1.100', [ROLES.ADMIN], config)).not.toThrow();
  });

  it('should throw IpNotAllowedError for blocked IP with protected role', () => {
    const config = createConfig();
    expect(() => requireIpAllowlist('1.2.3.4', [ROLES.ADMIN], config)).toThrow(IpNotAllowedError);
  });
});

describe('createIpAllowlistEntry', () => {
  it('should create a valid entry', () => {
    const entry = createIpAllowlistEntry('192.168.1.0/24', 'Test network', 'admin');
    expect(entry.ipAddress).toBe('192.168.1.0/24');
    expect(entry.description).toBe('Test network');
    expect(entry.createdBy).toBe('admin');
    expect(entry.isActive).toBe(true);
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeDefined();
  });

  it('should accept custom options', () => {
    const entry = createIpAllowlistEntry('10.0.0.1', 'Single IP', 'admin', {
      id: 'custom-id',
      isActive: false,
      expiresAt: '2025-12-31T23:59:59Z',
    });
    expect(entry.id).toBe('custom-id');
    expect(entry.isActive).toBe(false);
    expect(entry.expiresAt).toBe('2025-12-31T23:59:59Z');
  });

  it('should throw for invalid IP/CIDR', () => {
    expect(() => createIpAllowlistEntry('invalid', 'Test', 'admin')).toThrow();
    expect(() => createIpAllowlistEntry('192.168.1.0/33', 'Test', 'admin')).toThrow();
  });
});

describe('getActiveEntries', () => {
  it('should filter out inactive entries', () => {
    const entries: IpAllowlistEntry[] = [
      {
        id: '1',
        ipAddress: '192.168.1.0/24',
        description: 'Active',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
      {
        id: '2',
        ipAddress: '10.0.0.0/8',
        description: 'Inactive',
        isActive: false,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
      },
    ];

    const active = getActiveEntries(entries);
    expect(active).toHaveLength(1);
    expect(active[0]?.description).toBe('Active');
  });

  it('should filter out expired entries', () => {
    const entries: IpAllowlistEntry[] = [
      {
        id: '1',
        ipAddress: '192.168.1.0/24',
        description: 'Not expired',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
      {
        id: '2',
        ipAddress: '10.0.0.0/8',
        description: 'Expired',
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: 'admin',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    ];

    const active = getActiveEntries(entries);
    expect(active).toHaveLength(1);
    expect(active[0]?.description).toBe('Not expired');
  });
});

describe('DEFAULT_IP_ALLOWLIST_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_IP_ALLOWLIST_CONFIG.enabled).toBe(false);
    expect(DEFAULT_IP_ALLOWLIST_CONFIG.entries).toEqual([]);
    expect(DEFAULT_IP_ALLOWLIST_CONFIG.allowWhenEmpty).toBe(true);
    expect(DEFAULT_IP_ALLOWLIST_CONFIG.protectedRoles).toContain(ROLES.ADMIN);
  });
});
