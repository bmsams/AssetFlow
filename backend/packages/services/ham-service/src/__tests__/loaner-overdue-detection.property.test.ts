/**
 * Property Test: Loaner Overdue Detection
 * **Validates: Requirements 3.8, 3.9**
 */

import * as fc from 'fast-check';
import {
  calculateOverdueDays,
  getEscalationLevel,
  shouldSendEscalationNotification,
  ESCALATION_THRESHOLDS,
  type EscalationLevel,
} from '../loaner/loaner-service';

const dateStringArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) => year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0'));

const dateArb = fc.record({
  year: fc.integer({ min: 2020, max: 2030 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, month, day }) => {
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
});

const daysOverdueArb = fc.integer({ min: 0, max: 1000 });
const escalationLevelArb: fc.Arbitrary<EscalationLevel> = fc.constantFrom(0, 1, 2, 3);

interface EscalationScenario {
  readonly daysOverdue: number;
  readonly currentEscalationLevel: EscalationLevel;
  readonly expectedNewLevel: EscalationLevel;
  readonly shouldNotify: boolean;
}

const escalationScenarioArb: fc.Arbitrary<EscalationScenario> = fc.record({
  daysOverdue: fc.integer({ min: 0, max: 100 }),
  currentEscalationLevel: escalationLevelArb,
}).map(({ daysOverdue, currentEscalationLevel }) => {
  const expectedNewLevel = getEscalationLevel(daysOverdue);
  const shouldNotify = expectedNewLevel > currentEscalationLevel;
  return { daysOverdue, currentEscalationLevel, expectedNewLevel, shouldNotify };
});

describe('Property 9: Loaner Overdue Detection', () => {
  describe('Days Overdue Calculation', () => {
    it('should never return negative days overdue', () => {
      fc.assert(fc.property(dateStringArb, dateArb, (dueDate, currentDate) => {
        expect(calculateOverdueDays(dueDate, currentDate)).toBeGreaterThanOrEqual(0);
      }), { numRuns: 100 });
    });

    it('should return 0 when current date equals due date', () => {
      fc.assert(fc.property(dateStringArb, (dueDate) => {
        const parts = dueDate.split('-').map(Number);
        const currentDate = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
        currentDate.setHours(0, 0, 0, 0);
        expect(calculateOverdueDays(dueDate, currentDate)).toBe(0);
      }), { numRuns: 100 });
    });

    it('should return 0 when current date is before due date', () => {
      fc.assert(fc.property(dateStringArb, fc.integer({ min: 1, max: 365 }), (dueDate, daysBefore) => {
        const parts = dueDate.split('-').map(Number);
        const dueDateObj = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
        dueDateObj.setHours(0, 0, 0, 0);
        const currentDate = new Date(dueDateObj);
        currentDate.setDate(currentDate.getDate() - daysBefore);
        expect(calculateOverdueDays(dueDate, currentDate)).toBe(0);
      }), { numRuns: 100 });
    });

    it('should return positive value when current date is after due date', () => {
      fc.assert(fc.property(dateStringArb, fc.integer({ min: 1, max: 365 }), (dueDate, daysAfter) => {
        const parts = dueDate.split('-').map(Number);
        const dueDateObj = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
        dueDateObj.setHours(0, 0, 0, 0);
        const currentDate = new Date(dueDateObj);
        currentDate.setDate(currentDate.getDate() + daysAfter);
        expect(calculateOverdueDays(dueDate, currentDate)).toBeGreaterThan(0);
      }), { numRuns: 100 });
    });

    it('should increase monotonically as current date advances', () => {
      fc.assert(fc.property(dateStringArb, fc.integer({ min: 0, max: 100 }), (dueDate, baseOffset) => {
        const parts = dueDate.split('-').map(Number);
        const dueDateObj = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
        dueDateObj.setHours(0, 0, 0, 0);
        const baseDate = new Date(dueDateObj);
        baseDate.setDate(baseDate.getDate() + baseOffset);
        const nextDate = new Date(baseDate);
        nextDate.setDate(nextDate.getDate() + 1);
        expect(calculateOverdueDays(dueDate, nextDate)).toBeGreaterThanOrEqual(calculateOverdueDays(dueDate, baseDate));
      }), { numRuns: 100 });
    });

    it('should produce deterministic results for same inputs', () => {
      fc.assert(fc.property(dateStringArb, dateArb, (dueDate, currentDate) => {
        expect(calculateOverdueDays(dueDate, currentDate)).toBe(calculateOverdueDays(dueDate, currentDate));
      }), { numRuns: 50 });
    });

    it('should handle ISO date format with time component', () => {
      fc.assert(fc.property(dateStringArb, dateArb, (dueDate, currentDate) => {
        const isoDate = dueDate + 'T12:30:45.000Z';
        expect(calculateOverdueDays(isoDate, currentDate)).toBe(calculateOverdueDays(dueDate, currentDate));
      }), { numRuns: 50 });
    });
  });

  describe('Escalation Level Determination', () => {
    it('should return level 0 when not overdue', () => {
      expect(getEscalationLevel(0)).toBe(0);
    });

    it('should return level 1 when 1-2 days overdue', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 2 }), (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBe(1);
      }), { numRuns: 10 });
    });

    it('should return level 2 when 3-6 days overdue', () => {
      fc.assert(fc.property(fc.integer({ min: 3, max: 6 }), (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBe(2);
      }), { numRuns: 10 });
    });

    it('should return level 3 when 7 or more days overdue', () => {
      fc.assert(fc.property(fc.integer({ min: 7, max: 1000 }), (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBe(3);
      }), { numRuns: 100 });
    });

    it('should have monotonically increasing escalation levels', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 500 }), fc.integer({ min: 1, max: 100 }), (baseDays, additionalDays) => {
        expect(getEscalationLevel(baseDays + additionalDays)).toBeGreaterThanOrEqual(getEscalationLevel(baseDays));
      }), { numRuns: 100 });
    });

    it('should always return a valid escalation level (0, 1, 2, or 3)', () => {
      fc.assert(fc.property(daysOverdueArb, (daysOverdue) => {
        expect([0, 1, 2, 3]).toContain(getEscalationLevel(daysOverdue));
      }), { numRuns: 100 });
    });

    it('should produce deterministic escalation levels', () => {
      fc.assert(fc.property(daysOverdueArb, (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBe(getEscalationLevel(daysOverdue));
      }), { numRuns: 50 });
    });
  });

  describe('Escalation Threshold Boundaries', () => {
    it('should have thresholds at 1, 3, and 7 days per Requirement 3.9', () => {
      expect(ESCALATION_THRESHOLDS.LEVEL_1).toBe(1);
      expect(ESCALATION_THRESHOLDS.LEVEL_2).toBe(3);
      expect(ESCALATION_THRESHOLDS.LEVEL_3).toBe(7);
    });

    it('should change level exactly at threshold boundaries', () => {
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_1 - 1)).toBe(0);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_1)).toBe(1);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_2 - 1)).toBe(1);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_2)).toBe(2);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_3 - 1)).toBe(2);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_3)).toBe(3);
    });

    it('should have thresholds in strictly ascending order', () => {
      expect(ESCALATION_THRESHOLDS.LEVEL_1).toBeLessThan(ESCALATION_THRESHOLDS.LEVEL_2);
      expect(ESCALATION_THRESHOLDS.LEVEL_2).toBeLessThan(ESCALATION_THRESHOLDS.LEVEL_3);
    });
  });

  describe('Escalation Notification Logic', () => {
    it('should only send notification when escalation level increases', () => {
      fc.assert(fc.property(escalationScenarioArb, (scenario) => {
        expect(shouldSendEscalationNotification(scenario.daysOverdue, scenario.currentEscalationLevel)).toBe(scenario.shouldNotify);
      }), { numRuns: 100 });
    });

    it('should not send notification when already at or above calculated level', () => {
      fc.assert(fc.property(daysOverdueArb, (daysOverdue) => {
        const calculatedLevel = getEscalationLevel(daysOverdue);
        expect(shouldSendEscalationNotification(daysOverdue, calculatedLevel)).toBe(false);
        if (calculatedLevel < 3) {
          expect(shouldSendEscalationNotification(daysOverdue, (calculatedLevel + 1) as EscalationLevel)).toBe(false);
        }
      }), { numRuns: 100 });
    });

    it('should send notification when escalating from any lower level', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 100 }), (daysOverdue) => {
        const calculatedLevel = getEscalationLevel(daysOverdue);
        for (let level = 0; level < calculatedLevel; level++) {
          expect(shouldSendEscalationNotification(daysOverdue, level as EscalationLevel)).toBe(true);
        }
      }), { numRuns: 100 });
    });

    it('should not send notification when not overdue', () => {
      fc.assert(fc.property(escalationLevelArb, (currentLevel) => {
        expect(shouldSendEscalationNotification(0, currentLevel)).toBe(false);
      }), { numRuns: 10 });
    });

    it('should produce deterministic notification decisions', () => {
      fc.assert(fc.property(escalationScenarioArb, (scenario) => {
        const result1 = shouldSendEscalationNotification(scenario.daysOverdue, scenario.currentEscalationLevel);
        const result2 = shouldSendEscalationNotification(scenario.daysOverdue, scenario.currentEscalationLevel);
        expect(result1).toBe(result2);
      }), { numRuns: 50 });
    });
  });

  describe('End-to-End Overdue Lifecycle', () => {
    it('should follow expected escalation pattern through lifecycle', () => {
      const testCases = [
        { days: 0, expectedLevel: 0 },
        { days: 1, expectedLevel: 1 },
        { days: 2, expectedLevel: 1 },
        { days: 3, expectedLevel: 2 },
        { days: 6, expectedLevel: 2 },
        { days: 7, expectedLevel: 3 },
        { days: 30, expectedLevel: 3 },
      ];
      for (const { days, expectedLevel } of testCases) {
        expect(getEscalationLevel(days)).toBe(expectedLevel);
      }
    });

    it('should send exactly 3 notifications through complete escalation', () => {
      let previousLevel: EscalationLevel = 0;
      let notificationCount = 0;
      for (let daysOverdue = 0; daysOverdue <= 30; daysOverdue++) {
        const currentLevel = getEscalationLevel(daysOverdue);
        if (shouldSendEscalationNotification(daysOverdue, previousLevel)) {
          notificationCount++;
          previousLevel = currentLevel;
        }
      }
      expect(notificationCount).toBe(3);
    });

    it('should handle late processing with correct escalation', () => {
      fc.assert(fc.property(fc.integer({ min: 7, max: 100 }), (daysLate) => {
        expect(getEscalationLevel(daysLate)).toBe(3);
        expect(shouldSendEscalationNotification(daysLate, 0)).toBe(true);
      }), { numRuns: 50 });
    });

    it('should trigger notification when skipping escalation levels', () => {
      expect(shouldSendEscalationNotification(3, 0)).toBe(true);
      expect(shouldSendEscalationNotification(7, 0)).toBe(true);
      expect(shouldSendEscalationNotification(7, 1)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle year boundaries correctly', () => {
      const dueDate = '2023-12-31';
      const currentDate = new Date(2024, 0, 2);
      expect(calculateOverdueDays(dueDate, currentDate)).toBe(2);
    });

    it('should handle month boundaries correctly', () => {
      fc.assert(fc.property(
        fc.record({ year: fc.integer({ min: 2020, max: 2025 }), month: fc.integer({ min: 1, max: 11 }) }),
        ({ year, month }) => {
          const lastDay = new Date(year, month, 0).getDate();
          const dueDate = year + '-' + String(month).padStart(2, '0') + '-' + String(lastDay).padStart(2, '0');
          const currentDate = new Date(year, month, 1);
          currentDate.setHours(0, 0, 0, 0);
          expect(calculateOverdueDays(dueDate, currentDate)).toBe(1);
        }
      ), { numRuns: 50 });
    });

    it('should return level 3 for very large days overdue', () => {
      fc.assert(fc.property(fc.integer({ min: 100, max: 10000 }), (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBe(3);
      }), { numRuns: 50 });
    });

    it('should cap escalation at level 3', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 10000 }), (daysOverdue) => {
        expect(getEscalationLevel(daysOverdue)).toBeLessThanOrEqual(3);
      }), { numRuns: 100 });
    });
  });

  describe('Integration with calculateOverdueDays and getEscalationLevel', () => {
    it('should produce consistent escalation from calculated days', () => {
      fc.assert(fc.property(dateStringArb, dateArb, (dueDate, currentDate) => {
        const daysOverdue = calculateOverdueDays(dueDate, currentDate);
        const level = getEscalationLevel(daysOverdue);
        expect([0, 1, 2, 3]).toContain(level);
        if (daysOverdue === 0) expect(level).toBe(0);
        else if (daysOverdue >= 7) expect(level).toBe(3);
        else if (daysOverdue >= 3) expect(level).toBe(2);
        else if (daysOverdue >= 1) expect(level).toBe(1);
      }), { numRuns: 100 });
    });
  });
});