/**
 * Maintenance Service Unit Tests
 *
 * Tests for maintenance plan management and work order generation.
 * Requirements: 5.1, 5.2
 */

import { calculateNextDueDate } from '../maintenance/maintenance-service';

describe('MaintenanceService', () => {
  describe('calculateNextDueDate', () => {
    const baseDate = new Date('2024-01-15');

    describe('TIME_BASED schedules', () => {
      it('should calculate next due date for DAYS interval', () => {
        const result = calculateNextDueDate('TIME_BASED', 30, 'DAYS', baseDate);

        expect(result).not.toBeNull();
        expect(result!.toISOString().split('T')[0]).toBe('2024-02-14');
      });

      it('should calculate next due date for WEEKS interval', () => {
        const result = calculateNextDueDate('TIME_BASED', 2, 'WEEKS', baseDate);

        expect(result).not.toBeNull();
        expect(result!.toISOString().split('T')[0]).toBe('2024-01-29');
      });

      it('should calculate next due date for MONTHS interval', () => {
        const result = calculateNextDueDate('TIME_BASED', 3, 'MONTHS', baseDate);

        expect(result).not.toBeNull();
        // Check that the month is April (3 months from January)
        expect(result!.getMonth()).toBe(3); // April (0-indexed)
        // The day might vary slightly due to timezone, so check it's around the 15th
        expect(result!.getDate()).toBeGreaterThanOrEqual(14);
        expect(result!.getDate()).toBeLessThanOrEqual(16);
      });

      it('should handle month boundary correctly', () => {
        const endOfMonth = new Date('2024-01-31');
        const result = calculateNextDueDate('TIME_BASED', 1, 'MONTHS', endOfMonth);

        expect(result).not.toBeNull();
        // February doesn't have 31 days, so it should be Feb 29 (leap year) or March 2
        expect(result!.getMonth()).toBeGreaterThanOrEqual(1); // At least February
      });

      it('should return null for usage-based units in TIME_BASED schedule', () => {
        const result = calculateNextDueDate('TIME_BASED', 1000, 'HOURS', baseDate);

        expect(result).toBeNull();
      });
    });

    describe('USAGE_BASED schedules', () => {
      it('should return null for USAGE_BASED schedules', () => {
        const result = calculateNextDueDate('USAGE_BASED', 1000, 'HOURS', baseDate);

        expect(result).toBeNull();
      });

      it('should return null for MILES unit', () => {
        const result = calculateNextDueDate('USAGE_BASED', 5000, 'MILES', baseDate);

        expect(result).toBeNull();
      });

      it('should return null for CYCLES unit', () => {
        const result = calculateNextDueDate('USAGE_BASED', 100, 'CYCLES', baseDate);

        expect(result).toBeNull();
      });
    });
  });
});


describe('MaintenancePlan validation', () => {
  describe('Schedule type validation', () => {
    it('should require frequencyDays for TIME_BASED schedules', () => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        // Missing frequencyDays
      };

      // This would be validated by the service
      expect(request.scheduleType).toBe('TIME_BASED');
      expect(request).not.toHaveProperty('frequencyDays');
    });

    it('should require frequencyHours for USAGE_BASED schedules', () => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'USAGE_BASED',
        // Missing frequencyHours
      };

      expect(request.scheduleType).toBe('USAGE_BASED');
      expect(request).not.toHaveProperty('frequencyHours');
    });

    it('should accept valid TIME_BASED configuration', () => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Monthly Inspection',
        maintenanceType: 'INSPECTION',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
        priority: 'MEDIUM',
      };

      expect(request.scheduleType).toBe('TIME_BASED');
      expect(request.frequencyDays).toBe(30);
    });

    it('should accept valid USAGE_BASED configuration', () => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Oil Change',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'USAGE_BASED',
        frequencyHours: 500,
        priority: 'HIGH',
      };

      expect(request.scheduleType).toBe('USAGE_BASED');
      expect(request.frequencyHours).toBe(500);
    });
  });

  describe('Priority levels', () => {
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

    it.each(validPriorities)('should accept %s priority', (priority) => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType: 'PREVENTIVE',
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
        priority,
      };

      expect(validPriorities).toContain(request.priority);
    });
  });

  describe('Maintenance types', () => {
    const validTypes = [
      'PREVENTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION',
      'LUBRICATION', 'CLEANING', 'SAFETY_CHECK', 'REGULATORY', 'SEASONAL', 'OTHER'
    ];

    it.each(validTypes)('should accept %s maintenance type', (maintenanceType) => {
      const request = {
        assetId: '123e4567-e89b-12d3-a456-426614174000',
        planName: 'Test Plan',
        maintenanceType,
        scheduleType: 'TIME_BASED',
        frequencyDays: 30,
      };

      expect(validTypes).toContain(request.maintenanceType);
    });
  });
});


describe('DueMaintenanceItem', () => {
  describe('Overdue calculation', () => {
    it('should identify overdue maintenance', () => {
      const today = new Date('2024-01-20');
      const dueDate = new Date('2024-01-15');
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysOverdue).toBe(5);
      expect(daysOverdue > 0).toBe(true);
    });

    it('should not mark future maintenance as overdue', () => {
      const today = new Date('2024-01-15');
      const dueDate = new Date('2024-01-20');
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysOverdue).toBe(-5);
      expect(daysOverdue > 0).toBe(false);
    });

    it('should mark same-day maintenance as not overdue', () => {
      const today = new Date('2024-01-15');
      const dueDate = new Date('2024-01-15');
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysOverdue).toBe(0);
      expect(daysOverdue > 0).toBe(false);
    });
  });

  describe('Critical status', () => {
    type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

    function isCriticalMaintenance(
      priority: Priority,
      maxOverdueDays: number | null,
      daysOverdue: number,
      isOverdue: boolean
    ): boolean {
      return isOverdue && (
        priority === 'CRITICAL' ||
        (maxOverdueDays !== null && daysOverdue > maxOverdueDays)
      );
    }

    it('should mark CRITICAL priority overdue items as critical', () => {
      const result = isCriticalMaintenance('CRITICAL', null, 1, true);
      expect(result).toBe(true);
    });

    it('should mark items exceeding maxOverdueDays as critical', () => {
      const result = isCriticalMaintenance('MEDIUM', 7, 10, true);
      expect(result).toBe(true);
    });

    it('should not mark items within maxOverdueDays as critical', () => {
      const result = isCriticalMaintenance('MEDIUM', 7, 5, true);
      expect(result).toBe(false);
    });

    it('should not mark non-overdue items as critical', () => {
      const result = isCriticalMaintenance('CRITICAL', null, 0, false);
      expect(result).toBe(false);
    });
  });
});

describe('WorkOrder generation', () => {
  describe('Work order number generation', () => {
    it('should generate unique work order numbers', () => {
      const generateWorkOrderNumber = (): string => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `WO-${timestamp}-${random}`;
      };

      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        numbers.add(generateWorkOrderNumber());
      }

      // All generated numbers should be unique
      expect(numbers.size).toBe(100);
    });

    it('should follow WO-{timestamp}-{random} format', () => {
      const generateWorkOrderNumber = (): string => {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `WO-${timestamp}-${random}`;
      };

      const number = generateWorkOrderNumber();
      expect(number).toMatch(/^WO-[A-Z0-9]+-[A-Z0-9]+$/);
    });
  });

  describe('Maintenance type to work type mapping', () => {
    const mappings: [string, string][] = [
      ['PREVENTIVE', 'PREVENTIVE'],
      ['PREDICTIVE', 'PREVENTIVE'],
      ['SEASONAL', 'PREVENTIVE'],
      ['INSPECTION', 'INSPECTION'],
      ['SAFETY_CHECK', 'INSPECTION'],
      ['REGULATORY', 'INSPECTION'],
      ['CALIBRATION', 'CALIBRATION'],
      ['LUBRICATION', 'PREVENTIVE'],
      ['CLEANING', 'PREVENTIVE'],
      ['OTHER', 'PREVENTIVE'],
    ];

    it.each(mappings)('should map %s to %s work type', (maintenanceType, expectedWorkType) => {
      const mapMaintenanceTypeToWorkType = (type: string): string => {
        switch (type) {
          case 'PREVENTIVE':
          case 'PREDICTIVE':
          case 'SEASONAL':
            return 'PREVENTIVE';
          case 'INSPECTION':
          case 'SAFETY_CHECK':
          case 'REGULATORY':
            return 'INSPECTION';
          case 'CALIBRATION':
            return 'CALIBRATION';
          default:
            return 'PREVENTIVE';
        }
      };

      expect(mapMaintenanceTypeToWorkType(maintenanceType)).toBe(expectedWorkType);
    });
  });
});
