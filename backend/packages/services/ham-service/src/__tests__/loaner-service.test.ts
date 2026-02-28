/**
 * Loaner Service Unit Tests
 *
 * Tests for Loaner Service:
 * - Due date tracking and overdue calculation (Requirement 3.8)
 * - Escalation level determination (Requirement 3.9)
 */

import {
  calculateOverdueDays,
  getEscalationLevel,
  shouldSendEscalationNotification,
  ESCALATION_THRESHOLDS,
} from '../loaner/loaner-service';

describe('calculateOverdueDays', () => {
  describe('not overdue scenarios', () => {
    it('should return 0 when due date is today', () => {
      // Use a fixed date - parse as local date
      const today = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const dueDate = '2024-01-15';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(0);
    });

    it('should return 0 when due date is in the future', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-20';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(0);
    });

    it('should return 0 when due date is tomorrow', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-16';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(0);
    });
  });

  describe('overdue scenarios', () => {
    it('should return 1 when due date was yesterday', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-14';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(1);
    });

    it('should return 3 when due date was 3 days ago', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-12';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(3);
    });

    it('should return 7 when due date was 7 days ago', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-08';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(7);
    });

    it('should return 30 when due date was 30 days ago', () => {
      const today = new Date(2024, 0, 31); // Jan 31, 2024
      const dueDate = '2024-01-01';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(30);
    });

    it('should handle month boundaries correctly', () => {
      const today = new Date(2024, 1, 1); // Feb 1, 2024
      const dueDate = '2024-01-30';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(2);
    });

    it('should handle year boundaries correctly', () => {
      const today = new Date(2024, 0, 2); // Jan 2, 2024
      const dueDate = '2023-12-31';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should use current date when no date provided', () => {
      // Use a fixed date 2 days ago to test
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const dueDate = `${twoDaysAgo.getFullYear()}-${String(twoDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(twoDaysAgo.getDate()).padStart(2, '0')}`;
      
      const result = calculateOverdueDays(dueDate);
      
      // Should be 2 days overdue
      expect(result).toBe(2);
    });

    it('should handle ISO date string format', () => {
      const today = new Date(2024, 0, 15); // Jan 15, 2024
      const dueDate = '2024-01-10T00:00:00.000Z';
      
      const result = calculateOverdueDays(dueDate, today);
      
      expect(result).toBe(5);
    });
  });
});

describe('getEscalationLevel', () => {
  describe('level 0 - not overdue or just overdue', () => {
    it('should return 0 when not overdue (0 days)', () => {
      expect(getEscalationLevel(0)).toBe(0);
    });
  });

  describe('level 1 - 1+ days overdue', () => {
    it('should return 1 when exactly 1 day overdue', () => {
      expect(getEscalationLevel(1)).toBe(1);
    });

    it('should return 1 when 2 days overdue', () => {
      expect(getEscalationLevel(2)).toBe(1);
    });
  });

  describe('level 2 - 3+ days overdue', () => {
    it('should return 2 when exactly 3 days overdue', () => {
      expect(getEscalationLevel(3)).toBe(2);
    });

    it('should return 2 when 4 days overdue', () => {
      expect(getEscalationLevel(4)).toBe(2);
    });

    it('should return 2 when 5 days overdue', () => {
      expect(getEscalationLevel(5)).toBe(2);
    });

    it('should return 2 when 6 days overdue', () => {
      expect(getEscalationLevel(6)).toBe(2);
    });
  });

  describe('level 3 - 7+ days overdue', () => {
    it('should return 3 when exactly 7 days overdue', () => {
      expect(getEscalationLevel(7)).toBe(3);
    });

    it('should return 3 when 10 days overdue', () => {
      expect(getEscalationLevel(10)).toBe(3);
    });

    it('should return 3 when 30 days overdue', () => {
      expect(getEscalationLevel(30)).toBe(3);
    });

    it('should return 3 when 100 days overdue', () => {
      expect(getEscalationLevel(100)).toBe(3);
    });
  });

  describe('threshold boundaries', () => {
    it('should match ESCALATION_THRESHOLDS.LEVEL_1', () => {
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_1)).toBe(1);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_1 - 1)).toBe(0);
    });

    it('should match ESCALATION_THRESHOLDS.LEVEL_2', () => {
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_2)).toBe(2);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_2 - 1)).toBe(1);
    });

    it('should match ESCALATION_THRESHOLDS.LEVEL_3', () => {
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_3)).toBe(3);
      expect(getEscalationLevel(ESCALATION_THRESHOLDS.LEVEL_3 - 1)).toBe(2);
    });
  });
});

describe('shouldSendEscalationNotification', () => {
  describe('should send notification', () => {
    it('should return true when escalating from 0 to 1', () => {
      expect(shouldSendEscalationNotification(1, 0)).toBe(true);
    });

    it('should return true when escalating from 1 to 2', () => {
      expect(shouldSendEscalationNotification(3, 1)).toBe(true);
    });

    it('should return true when escalating from 2 to 3', () => {
      expect(shouldSendEscalationNotification(7, 2)).toBe(true);
    });

    it('should return true when escalating from 0 to 2 (skipping level)', () => {
      expect(shouldSendEscalationNotification(3, 0)).toBe(true);
    });

    it('should return true when escalating from 0 to 3 (skipping levels)', () => {
      expect(shouldSendEscalationNotification(7, 0)).toBe(true);
    });

    it('should return true when escalating from 1 to 3 (skipping level)', () => {
      expect(shouldSendEscalationNotification(7, 1)).toBe(true);
    });
  });

  describe('should not send notification', () => {
    it('should return false when not overdue', () => {
      expect(shouldSendEscalationNotification(0, 0)).toBe(false);
    });

    it('should return false when already at level 1', () => {
      expect(shouldSendEscalationNotification(1, 1)).toBe(false);
      expect(shouldSendEscalationNotification(2, 1)).toBe(false);
    });

    it('should return false when already at level 2', () => {
      expect(shouldSendEscalationNotification(3, 2)).toBe(false);
      expect(shouldSendEscalationNotification(4, 2)).toBe(false);
      expect(shouldSendEscalationNotification(5, 2)).toBe(false);
      expect(shouldSendEscalationNotification(6, 2)).toBe(false);
    });

    it('should return false when already at level 3', () => {
      expect(shouldSendEscalationNotification(7, 3)).toBe(false);
      expect(shouldSendEscalationNotification(10, 3)).toBe(false);
      expect(shouldSendEscalationNotification(30, 3)).toBe(false);
    });

    it('should return false when days overdue decreases (extension granted)', () => {
      // If due date was extended, days overdue might decrease
      expect(shouldSendEscalationNotification(0, 1)).toBe(false);
      expect(shouldSendEscalationNotification(0, 2)).toBe(false);
      expect(shouldSendEscalationNotification(0, 3)).toBe(false);
    });
  });
});

describe('ESCALATION_THRESHOLDS', () => {
  it('should have correct threshold values per Requirement 3.9', () => {
    // Requirement 3.9: Send notifications at 1 day, 3 days, and 7 days past due
    expect(ESCALATION_THRESHOLDS.LEVEL_1).toBe(1);
    expect(ESCALATION_THRESHOLDS.LEVEL_2).toBe(3);
    expect(ESCALATION_THRESHOLDS.LEVEL_3).toBe(7);
  });

  it('should have thresholds in ascending order', () => {
    expect(ESCALATION_THRESHOLDS.LEVEL_1).toBeLessThan(ESCALATION_THRESHOLDS.LEVEL_2);
    expect(ESCALATION_THRESHOLDS.LEVEL_2).toBeLessThan(ESCALATION_THRESHOLDS.LEVEL_3);
  });
});

describe('integration scenarios', () => {
  describe('complete overdue lifecycle', () => {
    it('should correctly track escalation through all levels', () => {
      const dueDate = '2024-01-01';
      
      // Day 0 - Due date
      let currentDate = new Date(2024, 0, 1); // Jan 1, 2024
      let daysOverdue = calculateOverdueDays(dueDate, currentDate);
      let level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(0);
      expect(level).toBe(0);
      expect(shouldSendEscalationNotification(daysOverdue, 0)).toBe(false);
      
      // Day 1 - First overdue day (Level 1)
      currentDate = new Date(2024, 0, 2); // Jan 2, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(1);
      expect(level).toBe(1);
      expect(shouldSendEscalationNotification(daysOverdue, 0)).toBe(true);
      
      // Day 2 - Still Level 1
      currentDate = new Date(2024, 0, 3); // Jan 3, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(2);
      expect(level).toBe(1);
      expect(shouldSendEscalationNotification(daysOverdue, 1)).toBe(false);
      
      // Day 3 - Level 2
      currentDate = new Date(2024, 0, 4); // Jan 4, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(3);
      expect(level).toBe(2);
      expect(shouldSendEscalationNotification(daysOverdue, 1)).toBe(true);
      
      // Day 6 - Still Level 2
      currentDate = new Date(2024, 0, 7); // Jan 7, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(6);
      expect(level).toBe(2);
      expect(shouldSendEscalationNotification(daysOverdue, 2)).toBe(false);
      
      // Day 7 - Level 3
      currentDate = new Date(2024, 0, 8); // Jan 8, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(7);
      expect(level).toBe(3);
      expect(shouldSendEscalationNotification(daysOverdue, 2)).toBe(true);
      
      // Day 30 - Still Level 3 (max level)
      currentDate = new Date(2024, 0, 31); // Jan 31, 2024
      daysOverdue = calculateOverdueDays(dueDate, currentDate);
      level = getEscalationLevel(daysOverdue);
      expect(daysOverdue).toBe(30);
      expect(level).toBe(3);
      expect(shouldSendEscalationNotification(daysOverdue, 3)).toBe(false);
    });
  });

  describe('late notification processing', () => {
    it('should handle case where item becomes overdue and is not checked until level 2', () => {
      const dueDate = '2024-01-01';
      const currentDate = new Date(2024, 0, 5); // Jan 5, 2024 - 4 days overdue
      
      const daysOverdue = calculateOverdueDays(dueDate, currentDate);
      const level = getEscalationLevel(daysOverdue);
      
      expect(daysOverdue).toBe(4);
      expect(level).toBe(2);
      // Should send notification since current level (0) < new level (2)
      expect(shouldSendEscalationNotification(daysOverdue, 0)).toBe(true);
    });

    it('should handle case where item becomes overdue and is not checked until level 3', () => {
      const dueDate = '2024-01-01';
      const currentDate = new Date(2024, 0, 15); // Jan 15, 2024 - 14 days overdue
      
      const daysOverdue = calculateOverdueDays(dueDate, currentDate);
      const level = getEscalationLevel(daysOverdue);
      
      expect(daysOverdue).toBe(14);
      expect(level).toBe(3);
      // Should send notification since current level (0) < new level (3)
      expect(shouldSendEscalationNotification(daysOverdue, 0)).toBe(true);
    });
  });
});
