/**
 * Notification Triggers Module
 *
 * Exports for scheduled notification triggers including contract expiration,
 * loaner overdue, stock level, and compliance alerts.
 *
 * Requirements:
 * - 17.3: Contract expiration notifications at 90, 60, 30 days
 * - 17.4: Loaner overdue escalating reminders
 * - 17.5: Stock level alerts when inventory falls below threshold
 * - 17.6: Compliance alerts for license violations
 */

// Export types
export * from './trigger-types';

// Export service functions
export {
  // Configuration
  initializeTriggerService,
  getServiceConfig,
  // Main processing
  processAllTriggers,
  processContractExpirationTriggers,
  processLoanerOverdueTriggers,
  processStockLevelTriggers,
  processComplianceAlertTriggers,
  // Manual triggers
  triggerContractExpirationCheck,
  triggerLoanerOverdueCheck,
  triggerStockLevelCheck,
  triggerComplianceCheck,
  // Resolution functions
  markLoanerReturned,
  markStockReplenished,
  markComplianceResolved,
  // Helper functions (exported for testing)
  calculateDaysUntilDate,
  isWithinIntervalWindow,
  calculateOverdueInfo,
  determineEscalationLevel,
  determineStockSeverity,
  determineComplianceSeverity,
} from './trigger-service';
