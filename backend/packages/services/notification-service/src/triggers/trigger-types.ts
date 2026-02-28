/**
 * Notification Trigger Types
 *
 * Type definitions for scheduled notification triggers including contract expiration,
 * loaner overdue, stock level, and compliance alerts.
 *
 * Requirements:
 * - 17.3: WHEN a contract is expiring, THE Notification_Service SHALL send alerts at configured intervals
 * - 17.4: WHEN a loaner asset is overdue, THE Notification_Service SHALL send escalating reminders
 * - 17.5: WHEN stock levels fall below threshold, THE Notification_Service SHALL alert inventory managers
 * - 17.6: WHEN a compliance position changes to under-licensed, THE Notification_Service SHALL alert compliance analysts
 */

import type { ISODateString, UUID } from '@ams/types';

// ============================================================================
// Trigger Types
// ============================================================================

/**
 * Types of notification triggers
 */
export type TriggerType =
  | 'CONTRACT_EXPIRATION'
  | 'LOANER_OVERDUE'
  | 'STOCK_LEVEL'
  | 'COMPLIANCE_ALERT';

/**
 * Trigger status
 */
export type TriggerStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

/**
 * Escalation level for overdue notifications
 */
export type EscalationLevel = 'INITIAL' | 'REMINDER' | 'ESCALATED' | 'CRITICAL';

// ============================================================================
// Contract Expiration Types (Requirement 17.3)
// ============================================================================

/**
 * Contract expiration notification intervals (in days)
 * Requirement 17.3: Send alerts at configured intervals (90, 60, 30 days)
 */
export const CONTRACT_EXPIRATION_INTERVALS = [90, 60, 30] as const;
export type ContractExpirationInterval = typeof CONTRACT_EXPIRATION_INTERVALS[number];

/**
 * Contract information for expiration notifications
 */
export interface ContractInfo {
  readonly contractId: UUID;
  readonly contractNumber: string;
  readonly contractType: string;
  readonly vendorId: UUID;
  readonly vendorName: string;
  readonly expirationDate: ISODateString;
  readonly totalValue?: number;
  readonly description?: string;
  readonly ownerUserId?: UUID;
  readonly ownerEmail?: string;
}

/**
 * Contract expiration trigger configuration
 */
export interface ContractExpirationTrigger {
  readonly triggerId: UUID;
  readonly triggerType: 'CONTRACT_EXPIRATION';
  readonly contract: ContractInfo;
  readonly intervalDays: ContractExpirationInterval;
  readonly notificationsSent: readonly ContractExpirationInterval[];
  readonly status: TriggerStatus;
  readonly lastCheckedAt?: ISODateString;
  readonly nextCheckAt?: ISODateString;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Contract expiration notification payload
 */
export interface ContractExpirationNotification {
  readonly contractId: UUID;
  readonly contractNumber: string;
  readonly contractType: string;
  readonly vendorName: string;
  readonly expirationDate: ISODateString;
  readonly daysUntilExpiration: number;
  readonly intervalDays: ContractExpirationInterval;
  readonly totalValue?: number;
}

// ============================================================================
// Loaner Overdue Types (Requirement 17.4)
// ============================================================================

/**
 * Loaner escalation configuration
 * Requirement 17.4: Send escalating reminders (daily, then hourly)
 */
export interface LoanerEscalationConfig {
  readonly initialReminderAfterHours: number;      // First reminder after X hours overdue
  readonly dailyReminderDays: number;              // Send daily reminders for X days
  readonly hourlyEscalationAfterDays: number;      // Switch to hourly after X days
  readonly managerEscalationAfterDays: number;     // Escalate to manager after X days
  readonly maxReminders: number;                   // Maximum total reminders
}

/**
 * Default loaner escalation configuration
 */
export const DEFAULT_LOANER_ESCALATION: LoanerEscalationConfig = {
  initialReminderAfterHours: 24,
  dailyReminderDays: 3,
  hourlyEscalationAfterDays: 3,
  managerEscalationAfterDays: 5,
  maxReminders: 20,
};

/**
 * Loaner checkout information
 */
export interface LoanerInfo {
  readonly checkoutId: UUID;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetName: string;
  readonly borrowerUserId: UUID;
  readonly borrowerEmail: string;
  readonly borrowerName: string;
  readonly borrowerManagerId?: UUID;
  readonly borrowerManagerEmail?: string;
  readonly checkoutDate: ISODateString;
  readonly dueDate: ISODateString;
  readonly returnDate?: ISODateString;
}

/**
 * Loaner overdue trigger
 */
export interface LoanerOverdueTrigger {
  readonly triggerId: UUID;
  readonly triggerType: 'LOANER_OVERDUE';
  readonly loaner: LoanerInfo;
  readonly escalationLevel: EscalationLevel;
  readonly reminderCount: number;
  readonly lastReminderAt?: ISODateString;
  readonly nextReminderAt?: ISODateString;
  readonly escalationConfig: LoanerEscalationConfig;
  readonly status: TriggerStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Loaner overdue notification payload
 */
export interface LoanerOverdueNotification {
  readonly checkoutId: UUID;
  readonly assetId: UUID;
  readonly assetTag: string;
  readonly assetName: string;
  readonly borrowerName: string;
  readonly dueDate: ISODateString;
  readonly daysOverdue: number;
  readonly hoursOverdue: number;
  readonly escalationLevel: EscalationLevel;
  readonly reminderCount: number;
  readonly isManagerEscalation: boolean;
}

// ============================================================================
// Stock Level Types (Requirement 17.5)
// ============================================================================

/**
 * Stock level alert severity
 */
export type StockAlertSeverity = 'WARNING' | 'CRITICAL' | 'OUT_OF_STOCK';

/**
 * Stock level information
 */
export interface StockLevelInfo {
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly productId: UUID;
  readonly productName: string;
  readonly productSku?: string;
  readonly quantityOnHand: number;
  readonly quantityReserved: number;
  readonly quantityAvailable: number;
  readonly reorderPoint: number;
  readonly reorderQuantity: number;
  readonly inventoryManagerId?: UUID;
  readonly inventoryManagerEmail?: string;
}

/**
 * Stock level trigger
 */
export interface StockLevelTrigger {
  readonly triggerId: UUID;
  readonly triggerType: 'STOCK_LEVEL';
  readonly stockLevel: StockLevelInfo;
  readonly severity: StockAlertSeverity;
  readonly alertsSent: number;
  readonly lastAlertAt?: ISODateString;
  readonly cooldownMinutes: number;
  readonly status: TriggerStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Stock level notification payload
 */
export interface StockLevelNotification {
  readonly stockroomId: UUID;
  readonly stockroomName: string;
  readonly productId: UUID;
  readonly productName: string;
  readonly productSku?: string;
  readonly quantityAvailable: number;
  readonly reorderPoint: number;
  readonly severity: StockAlertSeverity;
  readonly shortfallQuantity: number;
  readonly suggestedReorderQuantity: number;
}

// ============================================================================
// Compliance Alert Types (Requirement 17.6)
// ============================================================================

/**
 * Compliance position status
 */
export type CompliancePosition = 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';

/**
 * Compliance alert severity
 */
export type ComplianceAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * Compliance information
 */
export interface ComplianceInfo {
  readonly productId: UUID;
  readonly productName: string;
  readonly publisher: string;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly lastReconciliationDate: ISODateString;
  readonly complianceAnalystId?: UUID;
  readonly complianceAnalystEmail?: string;
}

/**
 * Compliance alert trigger
 */
export interface ComplianceAlertTrigger {
  readonly triggerId: UUID;
  readonly triggerType: 'COMPLIANCE_ALERT';
  readonly compliance: ComplianceInfo;
  readonly severity: ComplianceAlertSeverity;
  readonly previousPosition?: CompliancePosition;
  readonly alertsSent: number;
  readonly lastAlertAt?: ISODateString;
  readonly status: TriggerStatus;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

/**
 * Compliance notification payload
 */
export interface ComplianceNotification {
  readonly productId: UUID;
  readonly productName: string;
  readonly publisher: string;
  readonly compliancePosition: CompliancePosition;
  readonly previousPosition?: CompliancePosition;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly licenseDelta: number;
  readonly severity: ComplianceAlertSeverity;
  readonly estimatedRisk?: number;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type for all trigger types
 */
export type NotificationTrigger =
  | ContractExpirationTrigger
  | LoanerOverdueTrigger
  | StockLevelTrigger
  | ComplianceAlertTrigger;

/**
 * Union type for all notification payloads
 */
export type TriggerNotificationPayload =
  | ContractExpirationNotification
  | LoanerOverdueNotification
  | StockLevelNotification
  | ComplianceNotification;

// ============================================================================
// Processing Types
// ============================================================================

/**
 * Result of processing a trigger
 */
export interface TriggerProcessingResult {
  readonly triggerId: UUID;
  readonly triggerType: TriggerType;
  readonly processed: boolean;
  readonly notificationSent: boolean;
  readonly notificationId?: UUID;
  readonly error?: string;
  readonly nextCheckAt?: ISODateString;
}

/**
 * Batch processing result
 */
export interface TriggerBatchResult {
  readonly triggerType: TriggerType;
  readonly totalProcessed: number;
  readonly notificationsSent: number;
  readonly errors: number;
  readonly results: readonly TriggerProcessingResult[];
}

/**
 * Trigger check request
 */
export interface TriggerCheckRequest {
  readonly triggerTypes?: readonly TriggerType[];
  readonly limit?: number;
  readonly dryRun?: boolean;
}

/**
 * Trigger check response
 */
export interface TriggerCheckResponse {
  readonly checkedAt: ISODateString;
  readonly results: readonly TriggerBatchResult[];
  readonly totalNotificationsSent: number;
  readonly totalErrors: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Trigger service configuration
 */
export interface TriggerServiceConfig {
  readonly contractExpirationIntervals: readonly ContractExpirationInterval[];
  readonly loanerEscalation: LoanerEscalationConfig;
  readonly stockLevelCooldownMinutes: number;
  readonly complianceAlertCooldownMinutes: number;
  readonly maxTriggersPerBatch: number;
  readonly dryRunMode: boolean;
}

/**
 * Default trigger service configuration
 */
export const DEFAULT_TRIGGER_CONFIG: TriggerServiceConfig = {
  contractExpirationIntervals: [...CONTRACT_EXPIRATION_INTERVALS],
  loanerEscalation: DEFAULT_LOANER_ESCALATION,
  stockLevelCooldownMinutes: 60,
  complianceAlertCooldownMinutes: 240,
  maxTriggersPerBatch: 100,
  dryRunMode: false,
};
