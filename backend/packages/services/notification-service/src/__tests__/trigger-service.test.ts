/**
 * Trigger Service Unit Tests
 *
 * Tests for notification triggers including contract expiration,
 * loaner overdue, stock level, and compliance alerts.
 *
 * Requirements:
 * - 17.3: Contract expiration notifications at 90, 60, 30 days
 * - 17.4: Loaner overdue escalating reminders
 * - 17.5: Stock level alerts when inventory falls below threshold
 * - 17.6: Compliance alerts for license violations
 */

import {
  calculateDaysUntilDate,
  isWithinIntervalWindow,
  calculateOverdueInfo,
  determineEscalationLevel,
  determineStockSeverity,
  determineComplianceSeverity,
  initializeTriggerService,
  getServiceConfig,
} from '../triggers/trigger-service';
import {
  DEFAULT_LOANER_ESCALATION,
  DEFAULT_TRIGGER_CONFIG,
} from '../triggers/trigger-types';
import type {
  StockLevelInfo,
  ComplianceInfo,
} from '../triggers/trigger-types';

// ============================================================================
// Test Setup
// ============================================================================

describe('Trigger Service', () => {
  beforeEach(() => {
    // Reset service configuration before each test
    initializeTriggerService(DEFAULT_TRIGGER_CONFIG);
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('Service Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = getServiceConfig();

      expect(config.contractExpirationIntervals).toEqual([90, 60, 30]);
      expect(config.loanerEscalation).toEqual(DEFAULT_LOANER_ESCALATION);
      expect(config.stockLevelCooldownMinutes).toBe(60);
      expect(config.complianceAlertCooldownMinutes).toBe(240);
      expect(config.maxTriggersPerBatch).toBe(100);
      expect(config.dryRunMode).toBe(false);
    });

    it('should allow custom configuration', () => {
      initializeTriggerService({
        dryRunMode: true,
        maxTriggersPerBatch: 50,
        stockLevelCooldownMinutes: 30,
      });

      const config = getServiceConfig();

      expect(config.dryRunMode).toBe(true);
      expect(config.maxTriggersPerBatch).toBe(50);
      expect(config.stockLevelCooldownMinutes).toBe(30);
      // Other values should remain default
      expect(config.contractExpirationIntervals).toEqual([90, 60, 30]);
    });
  });

  // ==========================================================================
  // Contract Expiration Tests (Requirement 17.3)
  // ==========================================================================

  describe('Contract Expiration - calculateDaysUntilDate', () => {
    it('should calculate positive days for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const days = calculateDaysUntilDate(futureDate.toISOString());

      expect(days).toBe(30);
    });

    it('should calculate negative days for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const days = calculateDaysUntilDate(pastDate.toISOString());

      expect(days).toBe(-10);
    });

    it('should return 0 for today', () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Set to noon to avoid edge cases

      const days = calculateDaysUntilDate(today.toISOString());

      expect(days).toBe(0);
    });

    it('should handle 90-day interval correctly', () => {
      const date90Days = new Date();
      date90Days.setDate(date90Days.getDate() + 90);

      const days = calculateDaysUntilDate(date90Days.toISOString());

      expect(days).toBe(90);
    });
  });

  describe('Contract Expiration - isWithinIntervalWindow', () => {
    it('should return true for days within 90-day window (85-90)', () => {
      expect(isWithinIntervalWindow(90, 90)).toBe(true);
      expect(isWithinIntervalWindow(87, 90)).toBe(true);
      expect(isWithinIntervalWindow(85, 90)).toBe(true);
    });

    it('should return false for days outside 90-day window', () => {
      expect(isWithinIntervalWindow(84, 90)).toBe(false);
      expect(isWithinIntervalWindow(91, 90)).toBe(false);
      expect(isWithinIntervalWindow(100, 90)).toBe(false);
    });

    it('should return true for days within 60-day window (55-60)', () => {
      expect(isWithinIntervalWindow(60, 60)).toBe(true);
      expect(isWithinIntervalWindow(57, 60)).toBe(true);
      expect(isWithinIntervalWindow(55, 60)).toBe(true);
    });

    it('should return false for days outside 60-day window', () => {
      expect(isWithinIntervalWindow(54, 60)).toBe(false);
      expect(isWithinIntervalWindow(61, 60)).toBe(false);
    });

    it('should return true for days within 30-day window (25-30)', () => {
      expect(isWithinIntervalWindow(30, 30)).toBe(true);
      expect(isWithinIntervalWindow(27, 30)).toBe(true);
      expect(isWithinIntervalWindow(25, 30)).toBe(true);
    });

    it('should return false for days outside 30-day window', () => {
      expect(isWithinIntervalWindow(24, 30)).toBe(false);
      expect(isWithinIntervalWindow(31, 30)).toBe(false);
    });
  });


  // ==========================================================================
  // Loaner Overdue Tests (Requirement 17.4)
  // ==========================================================================

  describe('Loaner Overdue - calculateOverdueInfo', () => {
    it('should calculate overdue hours and days correctly', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 3); // 3 days ago

      const info = calculateOverdueInfo(dueDate.toISOString());

      expect(info.daysOverdue).toBe(3);
      expect(info.hoursOverdue).toBeGreaterThanOrEqual(72);
    });

    it('should return 0 for non-overdue items', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days in future

      const info = calculateOverdueInfo(futureDate.toISOString());

      expect(info.daysOverdue).toBe(0);
      expect(info.hoursOverdue).toBe(0);
    });

    it('should calculate hours for recently overdue items', () => {
      const dueDate = new Date();
      dueDate.setHours(dueDate.getHours() - 5); // 5 hours ago

      const info = calculateOverdueInfo(dueDate.toISOString());

      expect(info.hoursOverdue).toBeGreaterThanOrEqual(5);
      expect(info.daysOverdue).toBe(0);
    });
  });

  describe('Loaner Overdue - determineEscalationLevel', () => {
    const config = DEFAULT_LOANER_ESCALATION;

    it('should return INITIAL for first reminder', () => {
      const level = determineEscalationLevel(1, 0, config);
      expect(level).toBe('INITIAL');
    });

    it('should return REMINDER for subsequent reminders before escalation', () => {
      const level = determineEscalationLevel(2, 1, config);
      expect(level).toBe('REMINDER');
    });

    it('should return ESCALATED after hourlyEscalationAfterDays', () => {
      const level = determineEscalationLevel(
        config.hourlyEscalationAfterDays,
        2,
        config
      );
      expect(level).toBe('ESCALATED');
    });

    it('should return CRITICAL after managerEscalationAfterDays', () => {
      const level = determineEscalationLevel(
        config.managerEscalationAfterDays,
        5,
        config
      );
      expect(level).toBe('CRITICAL');
    });

    it('should escalate based on days overdue, not reminder count', () => {
      // Even with few reminders, if many days overdue, should escalate
      const level = determineEscalationLevel(
        config.managerEscalationAfterDays + 1,
        1,
        config
      );
      expect(level).toBe('CRITICAL');
    });
  });

  // ==========================================================================
  // Stock Level Tests (Requirement 17.5)
  // ==========================================================================

  describe('Stock Level - determineStockSeverity', () => {
    it('should return OUT_OF_STOCK when quantity is 0', () => {
      const stockLevel: StockLevelInfo = {
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        productId: 'prod-1',
        productName: 'Test Product',
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityAvailable: 0,
        reorderPoint: 10,
        reorderQuantity: 50,
      };

      const severity = determineStockSeverity(stockLevel);
      expect(severity).toBe('OUT_OF_STOCK');
    });

    it('should return CRITICAL when below 25% of reorder point', () => {
      const stockLevel: StockLevelInfo = {
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        productId: 'prod-1',
        productName: 'Test Product',
        quantityOnHand: 2,
        quantityReserved: 0,
        quantityAvailable: 2, // 20% of reorder point (10)
        reorderPoint: 10,
        reorderQuantity: 50,
      };

      const severity = determineStockSeverity(stockLevel);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING when at or above 25% of reorder point', () => {
      const stockLevel: StockLevelInfo = {
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        productId: 'prod-1',
        productName: 'Test Product',
        quantityOnHand: 5,
        quantityReserved: 0,
        quantityAvailable: 5, // 50% of reorder point (10)
        reorderPoint: 10,
        reorderQuantity: 50,
      };

      const severity = determineStockSeverity(stockLevel);
      expect(severity).toBe('WARNING');
    });

    it('should handle edge case at exactly 25%', () => {
      const stockLevel: StockLevelInfo = {
        stockroomId: 'sr-1',
        stockroomName: 'Main Stockroom',
        productId: 'prod-1',
        productName: 'Test Product',
        quantityOnHand: 25,
        quantityReserved: 0,
        quantityAvailable: 25, // Exactly 25% of reorder point (100)
        reorderPoint: 100,
        reorderQuantity: 200,
      };

      const severity = determineStockSeverity(stockLevel);
      expect(severity).toBe('WARNING');
    });
  });

  // ==========================================================================
  // Compliance Alert Tests (Requirement 17.6)
  // ==========================================================================

  describe('Compliance Alert - determineComplianceSeverity', () => {
    it('should return CRITICAL for 50+ under-licensed', () => {
      const compliance: ComplianceInfo = {
        productId: 'prod-1',
        productName: 'Test Software',
        publisher: 'Test Publisher',
        entitlementsOwned: 100,
        installationsFound: 150,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -50,
        lastReconciliationDate: new Date().toISOString(),
      };

      const severity = determineComplianceSeverity(compliance);
      expect(severity).toBe('CRITICAL');
    });

    it('should return WARNING for 10-49 under-licensed', () => {
      const compliance: ComplianceInfo = {
        productId: 'prod-1',
        productName: 'Test Software',
        publisher: 'Test Publisher',
        entitlementsOwned: 100,
        installationsFound: 125,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -25,
        lastReconciliationDate: new Date().toISOString(),
      };

      const severity = determineComplianceSeverity(compliance);
      expect(severity).toBe('WARNING');
    });

    it('should return INFO for less than 10 under-licensed', () => {
      const compliance: ComplianceInfo = {
        productId: 'prod-1',
        productName: 'Test Software',
        publisher: 'Test Publisher',
        entitlementsOwned: 100,
        installationsFound: 105,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -5,
        lastReconciliationDate: new Date().toISOString(),
      };

      const severity = determineComplianceSeverity(compliance);
      expect(severity).toBe('INFO');
    });

    it('should handle exactly 10 under-licensed as WARNING', () => {
      const compliance: ComplianceInfo = {
        productId: 'prod-1',
        productName: 'Test Software',
        publisher: 'Test Publisher',
        entitlementsOwned: 100,
        installationsFound: 110,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -10,
        lastReconciliationDate: new Date().toISOString(),
      };

      const severity = determineComplianceSeverity(compliance);
      expect(severity).toBe('WARNING');
    });

    it('should handle exactly 50 under-licensed as CRITICAL', () => {
      const compliance: ComplianceInfo = {
        productId: 'prod-1',
        productName: 'Test Software',
        publisher: 'Test Publisher',
        entitlementsOwned: 100,
        installationsFound: 150,
        compliancePosition: 'UNDER_LICENSED',
        overUnderCount: -50,
        lastReconciliationDate: new Date().toISOString(),
      };

      const severity = determineComplianceSeverity(compliance);
      expect(severity).toBe('CRITICAL');
    });
  });
});
