/**
 * Discovery Repository Unit Tests
 *
 * Tests for the Discovery Integration Repository data access layer.
 * Requirements:
 * - 7.2: Match discovery records to existing assets by serial_number and mac_address
 */

import {
  normalizeMacAddress,
  normalizeSerialNumber,
} from '../discovery/discovery-repository';

describe('Discovery Repository', () => {
  describe('normalizeMacAddress', () => {
    it('should convert MAC address to uppercase', () => {
      expect(normalizeMacAddress('aa:bb:cc:dd:ee:ff')).toBe('AABBCCDDEEFF');
    });

    it('should remove colon separators', () => {
      expect(normalizeMacAddress('AA:BB:CC:DD:EE:FF')).toBe('AABBCCDDEEFF');
    });

    it('should remove dash separators', () => {
      expect(normalizeMacAddress('AA-BB-CC-DD-EE-FF')).toBe('AABBCCDDEEFF');
    });

    it('should remove dot separators', () => {
      expect(normalizeMacAddress('AABB.CCDD.EEFF')).toBe('AABBCCDDEEFF');
    });

    it('should handle mixed separators', () => {
      expect(normalizeMacAddress('AA:BB-CC.DD:EE-FF')).toBe('AABBCCDDEEFF');
    });

    it('should trim whitespace', () => {
      expect(normalizeMacAddress('  AA:BB:CC:DD:EE:FF  ')).toBe('AABBCCDDEEFF');
    });

    it('should handle already normalized MAC address', () => {
      expect(normalizeMacAddress('AABBCCDDEEFF')).toBe('AABBCCDDEEFF');
    });
  });

  describe('normalizeSerialNumber', () => {
    it('should convert serial number to uppercase', () => {
      expect(normalizeSerialNumber('abc123xyz')).toBe('ABC123XYZ');
    });

    it('should trim whitespace', () => {
      expect(normalizeSerialNumber('  SN123456  ')).toBe('SN123456');
    });

    it('should handle already normalized serial number', () => {
      expect(normalizeSerialNumber('SN123456')).toBe('SN123456');
    });

    it('should preserve special characters', () => {
      expect(normalizeSerialNumber('SN-123_456')).toBe('SN-123_456');
    });
  });
});
