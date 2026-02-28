/**
 * Normalization Engine Tests
 *
 * Tests for the normalization engine that standardizes manufacturer names,
 * model numbers, and specifications from discovery data.
 *
 * **Validates: Requirements 3.1**
 */

import type { DiscoveryData } from '@ams/types';

import {
  normalizeManufacturer,
  normalizeModel,
  normalizeDiscoveryData,
  batchNormalizeDiscoveryData,
  getKnownManufacturers,
  getKnownModels,
  isKnownManufacturer,
  isKnownModel,
  suggestManufacturers,
} from '../normalization';

describe('Normalization Engine', () => {
  describe('normalizeManufacturer', () => {
    describe('exact matches', () => {
      it('should normalize "Dell" to "DELL"', () => {
        const result = normalizeManufacturer('Dell');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
        expect(result.exactMatch).toBe(true);
        expect(result.matchMethod).toBe('alias');
      });

      it('should normalize "dell inc" to "DELL"', () => {
        const result = normalizeManufacturer('dell inc');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Hewlett-Packard" to "HP"', () => {
        const result = normalizeManufacturer('Hewlett-Packard');
        expect(result.value).toBe('HP');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Hewlett Packard" to "HP"', () => {
        const result = normalizeManufacturer('Hewlett Packard');
        expect(result.value).toBe('HP');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "HP Inc." to "HP"', () => {
        const result = normalizeManufacturer('HP Inc.');
        expect(result.value).toBe('HP');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Hewlett Packard Enterprise" to "HPE"', () => {
        const result = normalizeManufacturer('Hewlett Packard Enterprise');
        expect(result.value).toBe('HPE');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Lenovo Group" to "LENOVO"', () => {
        const result = normalizeManufacturer('Lenovo Group');
        expect(result.value).toBe('LENOVO');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Apple Inc" to "APPLE"', () => {
        const result = normalizeManufacturer('Apple Inc');
        expect(result.value).toBe('APPLE');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "Cisco Systems, Inc." to "CISCO"', () => {
        const result = normalizeManufacturer('Cisco Systems, Inc.');
        expect(result.value).toBe('CISCO');
        expect(result.confidence).toBe(1.0);
      });

      it('should normalize "International Business Machines" to "IBM"', () => {
        const result = normalizeManufacturer('International Business Machines');
        expect(result.value).toBe('IBM');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('case insensitivity', () => {
      it('should handle uppercase input', () => {
        const result = normalizeManufacturer('DELL');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });

      it('should handle lowercase input', () => {
        const result = normalizeManufacturer('dell');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });

      it('should handle mixed case input', () => {
        const result = normalizeManufacturer('DeLL');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('whitespace handling', () => {
      it('should trim leading whitespace', () => {
        const result = normalizeManufacturer('  Dell');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });

      it('should trim trailing whitespace', () => {
        const result = normalizeManufacturer('Dell  ');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });

      it('should trim both leading and trailing whitespace', () => {
        const result = normalizeManufacturer('  Dell  ');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('fuzzy matching', () => {
      it('should fuzzy match "Dellll" to "DELL"', () => {
        const result = normalizeManufacturer('Dellll');
        expect(result.value).toBe('DELL');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.matchMethod).toBe('fuzzy');
      });

      it('should fuzzy match "Hewlet Packard" (typo) to "HP"', () => {
        const result = normalizeManufacturer('Hewlet Packard');
        expect(result.value).toBe('HP');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.matchMethod).toBe('fuzzy');
      });

      it('should fuzzy match "Lennovo" (typo) to "LENOVO"', () => {
        const result = normalizeManufacturer('Lennovo');
        expect(result.value).toBe('LENOVO');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.matchMethod).toBe('fuzzy');
      });
    });

    describe('unknown manufacturers', () => {
      it('should return normalized fallback for unknown manufacturer', () => {
        const result = normalizeManufacturer('Unknown Manufacturer XYZ');
        expect(result.value).toBe('UNKNOWN_MANUFACTURER_XYZ');
        expect(result.confidence).toBeLessThan(0.5);
        expect(result.matchMethod).toBe('none');
      });

      it('should handle empty string', () => {
        const result = normalizeManufacturer('');
        expect(result.value).toBe('UNKNOWN');
        expect(result.confidence).toBe(0);
        expect(result.matchMethod).toBe('none');
      });

      it('should handle null-like input', () => {
        const result = normalizeManufacturer('   ');
        expect(result.value).toBe('UNKNOWN');
        expect(result.confidence).toBe(0);
      });
    });

    describe('display names', () => {
      it('should return correct display name for Dell', () => {
        const result = normalizeManufacturer('Dell');
        expect(result.displayName).toBe('Dell Technologies');
      });

      it('should return correct display name for HP', () => {
        const result = normalizeManufacturer('HP');
        expect(result.displayName).toBe('HP Inc.');
      });

      it('should return correct display name for HPE', () => {
        const result = normalizeManufacturer('HPE');
        expect(result.displayName).toBe('Hewlett Packard Enterprise');
      });
    });
  });

  describe('normalizeModel', () => {
    describe('exact matches', () => {
      it('should normalize "Latitude 5520" for Dell', () => {
        const result = normalizeModel('Latitude 5520', 'DELL');
        expect(result.value).toBe('LATITUDE_5520');
        expect(result.confidence).toBe(1.0);
        expect(result.category).toBe('LAPTOP');
      });

      it('should normalize "EliteBook 840 G8" for HP', () => {
        const result = normalizeModel('EliteBook 840 G8', 'HP');
        expect(result.value).toBe('ELITEBOOK_840_G8');
        expect(result.confidence).toBe(1.0);
        expect(result.category).toBe('LAPTOP');
      });

      it('should normalize "ThinkPad T14 Gen 2" for Lenovo', () => {
        const result = normalizeModel('ThinkPad T14 Gen 2', 'LENOVO');
        expect(result.value).toBe('THINKPAD_T14_GEN2');
        expect(result.confidence).toBe(1.0);
        expect(result.category).toBe('LAPTOP');
      });

      it('should normalize "MacBook Pro 14" for Apple', () => {
        const result = normalizeModel('MacBook Pro 14', 'APPLE');
        expect(result.value).toBe('MACBOOK_PRO_14');
        expect(result.confidence).toBe(1.0);
        expect(result.category).toBe('LAPTOP');
      });

      it('should normalize "PowerEdge R750" for Dell', () => {
        const result = normalizeModel('PowerEdge R750', 'DELL');
        expect(result.value).toBe('POWEREDGE_R750');
        expect(result.confidence).toBe(1.0);
        expect(result.category).toBe('SERVER');
      });
    });

    describe('alias matching', () => {
      it('should match "lat 5520" alias for Dell Latitude', () => {
        const result = normalizeModel('lat 5520', 'DELL');
        expect(result.value).toBe('LATITUDE_5520');
        expect(result.confidence).toBe(1.0);
      });

      it('should match "eb 840 g8" alias for HP EliteBook', () => {
        const result = normalizeModel('eb 840 g8', 'HP');
        expect(result.value).toBe('ELITEBOOK_840_G8');
        expect(result.confidence).toBe(1.0);
      });

      it('should match "mbp 14" alias for MacBook Pro', () => {
        const result = normalizeModel('mbp 14', 'APPLE');
        expect(result.value).toBe('MACBOOK_PRO_14');
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('unknown models', () => {
      it('should return normalized fallback for unknown model', () => {
        const result = normalizeModel('Unknown Model 123', 'DELL');
        expect(result.value).toBe('UNKNOWN_MODEL_123');
        expect(result.confidence).toBeLessThan(0.5);
        expect(result.matchMethod).toBe('none');
      });

      it('should handle empty string', () => {
        const result = normalizeModel('', 'DELL');
        expect(result.value).toBe('UNKNOWN');
        expect(result.confidence).toBe(0);
      });
    });
  });

  describe('normalizeDiscoveryData', () => {
    it('should normalize complete discovery data', () => {
      const discoveryData: DiscoveryData = {
        sourceId: 'sccm-001',
        sourceName: 'SCCM',
        serialNumber: 'ABC123',
        macAddress: '00:11:22:33:44:55',
        hostname: 'laptop-001',
        manufacturer: 'Dell Inc.',
        model: 'Latitude 5520',
        operatingSystem: 'Windows 11 Pro',
        ipAddress: '192.168.1.100',
        lastSeen: '2024-01-15T10:30:00Z',
        rawData: {},
      };

      const result = normalizeDiscoveryData(discoveryData);

      expect(result.manufacturer.value).toBe('DELL');
      expect(result.model.value).toBe('LATITUDE_5520');
      expect(result.normalizedAsset.normalizedManufacturer).toBe('DELL');
      expect(result.normalizedAsset.normalizedModel).toBe('LATITUDE_5520');
      expect(result.normalizedAsset.serialNumber).toBe('ABC123');
      expect(result.normalizedAsset.macAddress).toBe('00:11:22:33:44:55');
      expect(result.normalizedAsset.operatingSystem).toBe('Windows 11 Pro');
      expect(result.overallConfidence).toBe(1.0);
    });

    it('should handle discovery data with missing manufacturer', () => {
      const discoveryData: DiscoveryData = {
        sourceId: 'sccm-002',
        sourceName: 'SCCM',
        serialNumber: 'XYZ789',
        model: 'Unknown Model',
        lastSeen: '2024-01-15T10:30:00Z',
        rawData: {},
      };

      const result = normalizeDiscoveryData(discoveryData);

      expect(result.manufacturer.value).toBe('UNKNOWN');
      expect(result.manufacturer.confidence).toBe(0);
    });

    it('should handle discovery data with typos', () => {
      const discoveryData: DiscoveryData = {
        sourceId: 'jamf-001',
        sourceName: 'Jamf',
        serialNumber: 'MAC123',
        manufacturer: 'Aple', // typo - missing 'p'
        model: 'MacBook Pro 14',
        lastSeen: '2024-01-15T10:30:00Z',
        rawData: {},
      };

      const result = normalizeDiscoveryData(discoveryData);

      expect(result.manufacturer.value).toBe('APPLE');
      expect(result.manufacturer.confidence).toBeGreaterThan(0.7);
      expect(result.model.value).toBe('MACBOOK_PRO_14');
    });
  });

  describe('batchNormalizeDiscoveryData', () => {
    it('should normalize multiple discovery records', () => {
      const records: DiscoveryData[] = [
        {
          sourceId: 'sccm-001',
          sourceName: 'SCCM',
          manufacturer: 'Dell',
          model: 'Latitude 5520',
          lastSeen: '2024-01-15T10:30:00Z',
          rawData: {},
        },
        {
          sourceId: 'sccm-002',
          sourceName: 'SCCM',
          manufacturer: 'HP',
          model: 'EliteBook 840 G8',
          lastSeen: '2024-01-15T10:30:00Z',
          rawData: {},
        },
        {
          sourceId: 'jamf-001',
          sourceName: 'Jamf',
          manufacturer: 'Apple',
          model: 'MacBook Pro 14',
          lastSeen: '2024-01-15T10:30:00Z',
          rawData: {},
        },
      ];

      const results = batchNormalizeDiscoveryData(records);

      expect(results).toHaveLength(3);
      expect(results[0]?.manufacturer.value).toBe('DELL');
      expect(results[1]?.manufacturer.value).toBe('HP');
      expect(results[2]?.manufacturer.value).toBe('APPLE');
    });
  });

  describe('utility functions', () => {
    describe('getKnownManufacturers', () => {
      it('should return list of known manufacturers', () => {
        const manufacturers = getKnownManufacturers();
        expect(manufacturers).toContain('DELL');
        expect(manufacturers).toContain('HP');
        expect(manufacturers).toContain('HPE');
        expect(manufacturers).toContain('LENOVO');
        expect(manufacturers).toContain('APPLE');
        expect(manufacturers).toContain('CISCO');
        expect(manufacturers.length).toBeGreaterThan(10);
      });
    });

    describe('getKnownModels', () => {
      it('should return models for Dell', () => {
        const models = getKnownModels('DELL');
        expect(models).toContain('LATITUDE_5520');
        expect(models).toContain('POWEREDGE_R750');
      });

      it('should return models for HP', () => {
        const models = getKnownModels('HP');
        expect(models).toContain('ELITEBOOK_840_G8');
        expect(models).toContain('PROBOOK_450_G8');
      });

      it('should return empty array for unknown manufacturer', () => {
        const models = getKnownModels('UNKNOWN_MFG');
        expect(models).toHaveLength(0);
      });
    });

    describe('isKnownManufacturer', () => {
      it('should return true for known manufacturers', () => {
        expect(isKnownManufacturer('DELL')).toBe(true);
        expect(isKnownManufacturer('HP')).toBe(true);
        expect(isKnownManufacturer('APPLE')).toBe(true);
      });

      it('should return false for unknown manufacturers', () => {
        expect(isKnownManufacturer('UNKNOWN_MFG')).toBe(false);
        expect(isKnownManufacturer('XYZ_CORP')).toBe(false);
      });
    });

    describe('isKnownModel', () => {
      it('should return true for known models', () => {
        expect(isKnownModel('LATITUDE_5520', 'DELL')).toBe(true);
        expect(isKnownModel('ELITEBOOK_840_G8', 'HP')).toBe(true);
      });

      it('should return false for unknown models', () => {
        expect(isKnownModel('UNKNOWN_MODEL', 'DELL')).toBe(false);
      });

      it('should return false for model with wrong manufacturer', () => {
        expect(isKnownModel('LATITUDE_5520', 'HP')).toBe(false);
      });
    });

    describe('suggestManufacturers', () => {
      it('should suggest Dell for "Del"', () => {
        const suggestions = suggestManufacturers('Del');
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]?.match).toBe('DELL');
      });

      it('should suggest HP for "Hewlett"', () => {
        const suggestions = suggestManufacturers('Hewlett');
        expect(suggestions.length).toBeGreaterThan(0);
        const matches = suggestions.map((s) => s.match);
        expect(matches).toContain('HP');
      });

      it('should return empty array for empty input', () => {
        const suggestions = suggestManufacturers('');
        expect(suggestions).toHaveLength(0);
      });

      it('should limit results to maxSuggestions', () => {
        const suggestions = suggestManufacturers('a', 3);
        expect(suggestions.length).toBeLessThanOrEqual(3);
      });
    });
  });
});
