/**
 * Unit tests for Reconciliation Service
 *
 * Tests the reconciliation engine functionality:
 * - Compliance position calculation (Requirement 4.1)
 * - Compliance status determination (Requirement 4.2)
 */

import {
  calculateCompliancePercentage,
  calculateComplianceStatus,
  calculateOverUnderCount,
} from '../reconciliation/reconciliation-service';

describe('Reconciliation Service', () => {
  describe('calculateComplianceStatus', () => {
    /**
     * Requirement 4.2: Determine compliance status as compliant, over-licensed, or under-licensed
     */
    it('should return COMPLIANT when entitlements equal installations', () => {
      expect(calculateComplianceStatus(10, 10)).toBe('COMPLIANT');
      expect(calculateComplianceStatus(0, 0)).toBe('COMPLIANT');
      expect(calculateComplianceStatus(100, 100)).toBe('COMPLIANT');
    });

    it('should return OVER_LICENSED when entitlements exceed installations', () => {
      expect(calculateComplianceStatus(15, 10)).toBe('OVER_LICENSED');
      expect(calculateComplianceStatus(100, 50)).toBe('OVER_LICENSED');
      expect(calculateComplianceStatus(5, 0)).toBe('OVER_LICENSED');
    });

    it('should return UNDER_LICENSED when installations exceed entitlements', () => {
      expect(calculateComplianceStatus(10, 15)).toBe('UNDER_LICENSED');
      expect(calculateComplianceStatus(50, 100)).toBe('UNDER_LICENSED');
      expect(calculateComplianceStatus(0, 5)).toBe('UNDER_LICENSED');
    });

    it('should handle edge cases correctly', () => {
      // Zero entitlements with zero installations is compliant
      expect(calculateComplianceStatus(0, 0)).toBe('COMPLIANT');

      // Zero entitlements with any installations is under-licensed
      expect(calculateComplianceStatus(0, 1)).toBe('UNDER_LICENSED');

      // Any entitlements with zero installations is over-licensed
      expect(calculateComplianceStatus(1, 0)).toBe('OVER_LICENSED');
    });
  });

  describe('calculateOverUnderCount', () => {
    /**
     * Requirement 4.1: Calculate the difference between entitlements and installations
     */
    it('should return zero when entitlements equal installations', () => {
      expect(calculateOverUnderCount(10, 10)).toBe(0);
      expect(calculateOverUnderCount(0, 0)).toBe(0);
      expect(calculateOverUnderCount(100, 100)).toBe(0);
    });

    it('should return positive value when over-licensed', () => {
      expect(calculateOverUnderCount(15, 10)).toBe(5);
      expect(calculateOverUnderCount(100, 50)).toBe(50);
      expect(calculateOverUnderCount(5, 0)).toBe(5);
    });

    it('should return negative value when under-licensed', () => {
      expect(calculateOverUnderCount(10, 15)).toBe(-5);
      expect(calculateOverUnderCount(50, 100)).toBe(-50);
      expect(calculateOverUnderCount(0, 5)).toBe(-5);
    });
  });

  describe('calculateCompliancePercentage', () => {
    /**
     * Requirement 4.1: Calculate compliance percentage
     */
    it('should return 100% when exactly compliant', () => {
      expect(calculateCompliancePercentage(10, 10)).toBe(100);
      expect(calculateCompliancePercentage(50, 50)).toBe(100);
    });

    it('should return >100% when over-licensed', () => {
      expect(calculateCompliancePercentage(20, 10)).toBe(200);
      expect(calculateCompliancePercentage(15, 10)).toBe(150);
      expect(calculateCompliancePercentage(100, 50)).toBe(200);
    });

    it('should return <100% when under-licensed', () => {
      expect(calculateCompliancePercentage(10, 20)).toBe(50);
      expect(calculateCompliancePercentage(5, 10)).toBe(50);
      expect(calculateCompliancePercentage(25, 100)).toBe(25);
    });

    it('should handle zero installations correctly', () => {
      // With entitlements but no installations, return 100% (fully covered)
      expect(calculateCompliancePercentage(10, 0)).toBe(100);

      // With no entitlements and no installations, return 0%
      expect(calculateCompliancePercentage(0, 0)).toBe(0);
    });

    it('should handle zero entitlements with installations', () => {
      expect(calculateCompliancePercentage(0, 10)).toBe(0);
      expect(calculateCompliancePercentage(0, 100)).toBe(0);
    });

    it('should round to 2 decimal places', () => {
      // 10/3 = 3.333... should round to 333.33%
      expect(calculateCompliancePercentage(10, 3)).toBe(333.33);

      // 1/3 = 0.333... should round to 33.33%
      expect(calculateCompliancePercentage(1, 3)).toBe(33.33);

      // 2/3 = 0.666... should round to 66.67%
      expect(calculateCompliancePercentage(2, 3)).toBe(66.67);
    });
  });

  describe('Compliance calculation consistency', () => {
    /**
     * Verify that all compliance calculations are consistent with each other
     */
    it('should have consistent results across all calculation functions', () => {
      const testCases = [
        { entitlements: 10, installations: 10 },
        { entitlements: 15, installations: 10 },
        { entitlements: 10, installations: 15 },
        { entitlements: 0, installations: 0 },
        { entitlements: 100, installations: 50 },
        { entitlements: 50, installations: 100 },
      ];

      for (const { entitlements, installations } of testCases) {
        const status = calculateComplianceStatus(entitlements, installations);
        const overUnder = calculateOverUnderCount(entitlements, installations);
        const percentage = calculateCompliancePercentage(entitlements, installations);

        // Verify consistency
        if (status === 'COMPLIANT') {
          expect(overUnder).toBe(0);
          if (installations > 0) {
            expect(percentage).toBe(100);
          }
        } else if (status === 'OVER_LICENSED') {
          expect(overUnder).toBeGreaterThan(0);
          if (installations > 0) {
            expect(percentage).toBeGreaterThan(100);
          }
        } else if (status === 'UNDER_LICENSED') {
          expect(overUnder).toBeLessThan(0);
          expect(percentage).toBeLessThan(100);
        }
      }
    });
  });
});
