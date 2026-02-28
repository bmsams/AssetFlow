/**
 * Event types for event-driven architecture
 *
 * This module defines all domain events published by the Asset Management System.
 * Events follow a consistent structure with typed payloads for type safety.
 *
 * Requirements: 9.1, 9.2 - Event-Driven Architecture
 */

import type { Asset, AssetStatus, AssetType } from './asset';
import type { ISODateString, UUID } from './common';
import type { CompliancePosition, ReclamationStatus } from './software-asset';

/**
 * Base event interface - all domain events extend this
 */
export interface BaseEvent {
  readonly eventId: UUID;
  readonly eventType: string;
  readonly timestamp: ISODateString;
  readonly version: string;
  readonly source: string;
  readonly correlationId?: string;
}

/**
 * Event metadata for SNS message attributes
 */
export interface EventMetadata {
  readonly eventType: string;
  readonly source: string;
  readonly eventId: string;
  readonly assetType?: AssetType;
  readonly assetStatus?: AssetStatus;
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

// ============================================================================
// Asset Events
// ============================================================================

export interface AssetCreatedEvent extends BaseEvent {
  readonly eventType: 'ASSET_CREATED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly assetTag: string;
    readonly createdBy: UUID;
    readonly asset: Asset;
  };
}

export interface AssetUpdatedEvent extends BaseEvent {
  readonly eventType: 'ASSET_UPDATED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly updatedBy: UUID;
    readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[];
  };
}

export interface AssetDeletedEvent extends BaseEvent {
  readonly eventType: 'ASSET_DELETED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly assetTag: string;
    readonly deletedBy: UUID;
  };
}

export interface AssetStateChangedEvent extends BaseEvent {
  readonly eventType: 'ASSET_STATE_CHANGED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly previousState: AssetStatus;
    readonly newState: AssetStatus;
    readonly changedBy: UUID;
    readonly reason?: string;
  };
}

export interface AssetAssignedEvent extends BaseEvent {
  readonly eventType: 'ASSET_ASSIGNED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly assignedTo: UUID;
    readonly assignedBy: UUID;
    readonly previousAssignee?: UUID;
  };
}

export interface AssetDeployedEvent extends BaseEvent {
  readonly eventType: 'ASSET_DEPLOYED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly deployedTo: UUID;
    readonly deployedBy: UUID;
    readonly location?: string;
  };
}

export interface AssetRetiredEvent extends BaseEvent {
  readonly eventType: 'ASSET_RETIRED';
  readonly payload: {
    readonly assetId: UUID;
    readonly assetType: AssetType;
    readonly retiredBy: UUID;
    readonly reason: string;
    readonly disposalMethod?: string;
  };
}

export interface AssetReassignedEvent extends BaseEvent {
  readonly eventType: 'ASSET_REASSIGNED';
  readonly payload: { readonly deploymentId: UUID; readonly assetId: UUID; readonly previousUserId?: UUID; readonly newUserId: UUID; readonly reassignedBy: UUID };
}

// ============================================================================
// Software Asset Management (SAM) Events
// ============================================================================

export interface ReconciliationCompletedEvent extends BaseEvent {
  readonly eventType: 'RECONCILIATION_COMPLETED';
  readonly payload: {
    readonly productId: UUID;
    readonly productName: string;
    readonly publisher: string;
    readonly compliancePosition: CompliancePosition;
    readonly entitlementsOwned: number;
    readonly installationsFound: number;
    readonly overUnderCount: number;
  };
}

export interface ReconciliationRunCompletedEvent extends BaseEvent {
  readonly eventType: 'RECONCILIATION_RUN_COMPLETED';
  readonly payload: { readonly runId: UUID; readonly startedAt: ISODateString; readonly completedAt: ISODateString; readonly productsProcessed: number };
}

export interface ReclamationInitiatedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_INITIATED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly softwareProductId: UUID; readonly userId: UUID; readonly daysSinceLastUse: number };
}

export interface ReclamationStatusChangedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_STATUS_CHANGED';
  readonly payload: { readonly candidateId: UUID; readonly previousStatus: ReclamationStatus; readonly newStatus: ReclamationStatus; readonly changedBy: UUID };
}

export interface ReclamationCandidateIdentifiedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_CANDIDATE_IDENTIFIED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly softwareProductId: UUID; readonly userId: UUID; readonly daysSinceLastUse: number };
}

export interface ReclamationIdentificationCompletedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_IDENTIFICATION_COMPLETED';
  readonly payload: { readonly runId: UUID; readonly startedAt: ISODateString; readonly completedAt: ISODateString; readonly candidatesIdentified: number };
}

export interface ReclamationWorkflowInitiatedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_WORKFLOW_INITIATED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly softwareProductId: UUID; readonly userId: UUID };
}

export interface ReclamationUserNotificationEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_USER_NOTIFICATION';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly userId: UUID; readonly productName: string };
}

export interface ReclamationManagerNotificationEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_MANAGER_NOTIFICATION';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly userId: UUID; readonly managerId: UUID; readonly productName: string };
}

export interface ReclamationApprovedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_APPROVED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly approvedBy: UUID };
}

export interface ReclamationRejectedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_REJECTED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly rejectedBy: UUID; readonly reason: string };
}

export interface ReclamationCompletedEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_COMPLETED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly completedBy: UUID };
}

export interface ReclamationCancelledEvent extends BaseEvent {
  readonly eventType: 'RECLAMATION_CANCELLED';
  readonly payload: { readonly candidateId: UUID; readonly installationId: UUID; readonly cancelledBy: UUID; readonly reason: string };
}

export interface ShadowITDetectedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_DETECTED';
  readonly payload: { readonly alertId: UUID; readonly applicationName: string; readonly applicationUrl?: string; readonly userId: UUID; readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; readonly accessCount: number };
}

export interface ShadowITAlertCreatedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_ALERT_CREATED';
  readonly payload: { readonly alertId: UUID; readonly detectionId: UUID; readonly applicationName: string; readonly riskLevel: string };
}

export interface ShadowITAnalysisCompletedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_ANALYSIS_COMPLETED';
  readonly payload: { readonly analysisId: UUID; readonly startedAt: ISODateString; readonly completedAt: ISODateString; readonly detectionsFound: number };
}

export interface ShadowITStatusChangedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_STATUS_CHANGED';
  readonly payload: { readonly detectionId: UUID; readonly applicationName: string; readonly previousStatus: string; readonly newStatus: string; readonly changedBy: UUID };
}

export interface ShadowITAlertAcknowledgedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_ALERT_ACKNOWLEDGED';
  readonly payload: { readonly alertId: UUID; readonly detectionId: UUID; readonly acknowledgedBy: UUID };
}

export interface ShadowITAlertResolvedEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_ALERT_RESOLVED';
  readonly payload: { readonly alertId: UUID; readonly detectionId: UUID; readonly resolvedBy: UUID; readonly resolution: string };
}

export interface ShadowITAlertIgnoredEvent extends BaseEvent {
  readonly eventType: 'SHADOW_IT_ALERT_IGNORED';
  readonly payload: { readonly alertId: UUID; readonly detectionId: UUID; readonly ignoredBy: UUID; readonly reason: string };
}

export interface SaaSSubscriptionCreatedEvent extends BaseEvent {
  readonly eventType: 'SAAS_SUBSCRIPTION_CREATED';
  readonly payload: { readonly subscriptionId: UUID; readonly vendorName: string; readonly productName: string; readonly totalSeats: number };
}

export interface SaaSSubscriptionUpdatedEvent extends BaseEvent {
  readonly eventType: 'SAAS_SUBSCRIPTION_UPDATED';
  readonly payload: { readonly subscriptionId: UUID; readonly updates: readonly string[] };
}

export interface SaaSUsageSyncedEvent extends BaseEvent {
  readonly eventType: 'SAAS_USAGE_SYNCED';
  readonly payload: { readonly syncId: UUID; readonly subscriptionId: UUID; readonly activeUsers: number; readonly totalSeats: number };
}

export interface SaaSOptimizationOpportunitiesFoundEvent extends BaseEvent {
  readonly eventType: 'SAAS_OPTIMIZATION_OPPORTUNITIES_FOUND';
  readonly payload: { readonly subscriptionsWithUnusedSeats: number; readonly totalUnusedSeats: number; readonly totalPotentialSavings: number };
}

export interface SaaSRenewalNotificationCreatedEvent extends BaseEvent {
  readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_CREATED';
  readonly payload: { readonly subscriptionId: UUID; readonly productName: string; readonly renewalDate: ISODateString; readonly daysUntilRenewal: number };
}

export interface SaaSRenewalNotificationSentEvent extends BaseEvent {
  readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_SENT';
  readonly payload: { readonly notificationId: UUID; readonly subscriptionId: UUID; readonly sentTo: UUID };
}

export interface SaaSRenewalNotificationAcknowledgedEvent extends BaseEvent {
  readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_ACKNOWLEDGED';
  readonly payload: { readonly notificationId: UUID; readonly acknowledgedBy: UUID };
}

export interface SaaSSubscriptionDeletedEvent extends BaseEvent {
  readonly eventType: 'SAAS_SUBSCRIPTION_DELETED';
  readonly payload: { readonly subscriptionId: UUID };
}

export interface PublisherCalculationCompletedEvent extends BaseEvent {
  readonly eventType: 'PUBLISHER_CALCULATION_COMPLETED';
  readonly payload: { readonly productId: UUID; readonly publisher: string; readonly calculationType: string; readonly result: unknown };
}

export interface ComplianceReportGeneratedEvent extends BaseEvent {
  readonly eventType: 'COMPLIANCE_REPORT_GENERATED';
  readonly payload: { readonly reportId: UUID; readonly reportType: string; readonly generatedBy: UUID };
}

export interface ComplianceReportExportedEvent extends BaseEvent {
  readonly eventType: 'COMPLIANCE_REPORT_EXPORTED';
  readonly payload: { readonly reportId: UUID; readonly format: string; readonly exportedBy: UUID };
}

// ============================================================================
// Hardware Asset Management (HAM) Events
// ============================================================================

export interface TransferOrderCreatedEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_CREATED';
  readonly payload: { readonly transferId: UUID; readonly fromStockroomId: UUID; readonly toStockroomId: UUID; readonly requestedBy: UUID; readonly assetCount: number };
}

export interface TransferOrderCompletedEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_COMPLETED';
  readonly payload: { readonly transferId: UUID; readonly fromStockroomId: UUID; readonly toStockroomId: UUID; readonly completedBy: UUID; readonly assetCount: number };
}

export interface TransferOrderApprovedEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_APPROVED';
  readonly payload: { readonly transferId: UUID; readonly transferNumber: string; readonly approvedBy: UUID };
}

export interface TransferOrderRejectedEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_REJECTED';
  readonly payload: { readonly transferId: UUID; readonly transferNumber: string; readonly rejectedBy: UUID; readonly reason: string };
}

export interface TransferOrderShippedEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_SHIPPED';
  readonly payload: { readonly transferId: UUID; readonly transferNumber: string; readonly shippedBy: UUID; readonly trackingNumber?: string };
}

export interface TransferOrderCancelledEvent extends BaseEvent {
  readonly eventType: 'TRANSFER_ORDER_CANCELLED';
  readonly payload: { readonly transferId: UUID; readonly transferNumber: string; readonly cancelledBy: UUID; readonly reason: string };
}

export interface StockLevelAlertEvent extends BaseEvent {
  readonly eventType: 'STOCK_LEVEL_ALERT';
  readonly payload: { readonly stockroomId: UUID; readonly stockroomName: string; readonly productId: UUID; readonly productName: string; readonly currentQuantity: number; readonly reorderPoint: number; readonly reorderQuantity: number };
}

export interface InventoryCreatedEvent extends BaseEvent {
  readonly eventType: 'INVENTORY_CREATED';
  readonly payload: { readonly inventoryId: UUID; readonly stockroomId: UUID; readonly productId: UUID; readonly quantity: number };
}

export interface InventoryUpdatedEvent extends BaseEvent {
  readonly eventType: 'INVENTORY_UPDATED';
  readonly payload: { readonly inventoryId: UUID; readonly stockroomId: UUID; readonly productId: UUID; readonly previousQuantity: number; readonly newQuantity: number };
}

export interface InventoryAdjustedEvent extends BaseEvent {
  readonly eventType: 'INVENTORY_ADJUSTED';
  readonly payload: { readonly inventoryId: UUID; readonly stockroomId: UUID; readonly adjustmentType: string; readonly quantity: number; readonly reason: string };
}

export interface InventoryReservedEvent extends BaseEvent {
  readonly eventType: 'INVENTORY_RESERVED';
  readonly payload: { readonly inventoryId: UUID; readonly stockroomId: UUID; readonly quantity: number; readonly reservedFor: UUID };
}

export interface InventoryReservationReleasedEvent extends BaseEvent {
  readonly eventType: 'INVENTORY_RESERVATION_RELEASED';
  readonly payload: { readonly inventoryId: UUID; readonly stockroomId: UUID; readonly quantity: number };
}

export interface ReplenishmentAlertEvent extends BaseEvent {
  readonly eventType: 'REPLENISHMENT_ALERT';
  readonly payload: { readonly alertId: UUID; readonly alertType: string; readonly stockroomId: UUID; readonly productId: UUID; readonly currentQuantity: number; readonly reorderPoint: number };
}

export interface LoanerCheckoutEvent extends BaseEvent {
  readonly eventType: 'LOANER_CHECKOUT';
  readonly payload: { readonly checkoutId: UUID; readonly assetId: UUID; readonly checkedOutTo: UUID; readonly checkedOutBy: UUID; readonly dueDate: ISODateString };
}

export interface LoanerReturnedEvent extends BaseEvent {
  readonly eventType: 'LOANER_RETURNED';
  readonly payload: { readonly checkoutId: UUID; readonly assetId: UUID; readonly returnedBy: UUID; readonly condition: string; readonly wasOverdue: boolean };
}

export interface LoanerOverdueEvent extends BaseEvent {
  readonly eventType: 'LOANER_OVERDUE';
  readonly payload: { readonly checkoutId: UUID; readonly assetId: UUID; readonly checkedOutTo: UUID; readonly dueDate: ISODateString; readonly daysOverdue: number; readonly escalationLevel: number };
}

export interface LoanerCheckedOutEvent extends BaseEvent {
  readonly eventType: 'LOANER_CHECKED_OUT';
  readonly payload: { readonly checkoutId: UUID; readonly checkoutNumber: string; readonly assetId: UUID; readonly checkedOutTo: UUID; readonly checkedOutBy: UUID; readonly dueDate: ISODateString; readonly conditionOut: string };
}

export interface LoanerOverdueNotificationEvent extends BaseEvent {
  readonly eventType: 'LOANER_OVERDUE_NOTIFICATION';
  readonly payload: { readonly checkoutId: UUID; readonly assetId: UUID; readonly checkedOutTo: UUID; readonly dueDate: ISODateString; readonly daysOverdue: number; readonly escalationLevel: number; readonly notificationType: string };
}

export interface LoanerDueDateExtendedEvent extends BaseEvent {
  readonly eventType: 'LOANER_DUE_DATE_EXTENDED';
  readonly payload: { readonly checkoutId: UUID; readonly assetId: UUID; readonly previousDueDate: ISODateString; readonly newDueDate: ISODateString; readonly extendedBy: UUID; readonly reason?: string };
}

export interface AuditCompletedEvent extends BaseEvent {
  readonly eventType: 'AUDIT_COMPLETED';
  readonly payload: { readonly auditId: UUID; readonly stockroomId: UUID; readonly auditorId: UUID; readonly discrepancyCount: number; readonly assetsScanned: number; readonly assetsExpected: number };
}

export interface AuditScanRecordedEvent extends BaseEvent {
  readonly eventType: 'AUDIT_SCAN_RECORDED';
  readonly payload: { readonly auditId: UUID; readonly scanId: UUID; readonly assetId?: UUID; readonly assetTag: string; readonly stockroomId: UUID; readonly scannedBy: UUID; readonly scanResult: 'FOUND' | 'NOT_FOUND' | 'UNEXPECTED' };
}

export interface DisposalCompletedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_COMPLETED';
  readonly payload: { readonly assetId: UUID; readonly assetTag: string; readonly disposalMethod: string; readonly destructionCertificateId?: UUID; readonly completedBy: UUID };
}

export interface DisposalWorkflowInitiatedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_WORKFLOW_INITIATED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly assetId: UUID; readonly assetTag: string; readonly initiatedBy: UUID };
}

export interface DisposalDestructionRecordedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_DESTRUCTION_RECORDED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly certificateId: UUID; readonly method: string };
}

export interface DisposalDataWipeCompletedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_DATA_WIPE_COMPLETED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly wipeMethod: string; readonly completedBy: UUID };
}

export interface DisposalEnvironmentalCheckCompletedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_ENVIRONMENTAL_CHECK_COMPLETED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly checkResult: string; readonly completedBy: UUID };
}

export interface DisposalPickupScheduledEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_PICKUP_SCHEDULED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly pickupDate: ISODateString; readonly vendorId?: UUID };
}

export interface DisposalTaskUpdatedEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_TASK_UPDATED';
  readonly payload: { readonly taskId: UUID; readonly workflowId: UUID; readonly taskType: string; readonly status: string; readonly updatedBy: UUID };
}

export interface DisposalWorkflowCancelledEvent extends BaseEvent {
  readonly eventType: 'DISPOSAL_WORKFLOW_CANCELLED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly cancelledBy: UUID; readonly reason: string };
}

// ============================================================================
// Enterprise Asset Management (EAM) Events
// ============================================================================

export interface WorkOrderCreatedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_CREATED';
  readonly payload: { readonly workOrderId: UUID; readonly assetId: UUID; readonly workType: string; readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; readonly assignedTo?: UUID; readonly scheduledDate?: ISODateString };
}

export interface WorkOrderCompletedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_COMPLETED';
  readonly payload: { readonly workOrderId: UUID; readonly assetId: UUID; readonly completedBy: UUID; readonly completedDate: ISODateString; readonly partsUsed: number; readonly laborHours: number };
}

export interface WorkOrderAssignedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_ASSIGNED';
  readonly payload: { readonly workOrderId: UUID; readonly workOrderNumber: string; readonly assignedTo: UUID; readonly assignedBy: UUID };
}

export interface WorkOrderStatusChangedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_STATUS_CHANGED';
  readonly payload: { readonly workOrderId: UUID; readonly workOrderNumber: string; readonly previousStatus: string; readonly newStatus: string; readonly changedBy: UUID };
}

export interface WorkOrderPartAddedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_PART_ADDED';
  readonly payload: { readonly workOrderId: UUID; readonly partId: UUID; readonly partNumber: string; readonly quantityRequired: number };
}

export interface WorkOrderPartUsedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_PART_USED';
  readonly payload: { readonly workOrderId: UUID; readonly partId: UUID; readonly partNumber: string; readonly quantityUsed: number; readonly totalQuantityUsed: number; readonly totalCost: number | null };
}

export interface WorkOrderPartRemovedEvent extends BaseEvent {
  readonly eventType: 'WORK_ORDER_PART_REMOVED';
  readonly payload: { readonly workOrderId: UUID; readonly partId: UUID };
}

export interface MaintenanceDueEvent extends BaseEvent {
  readonly eventType: 'MAINTENANCE_DUE';
  readonly payload: { readonly maintenancePlanId: UUID; readonly assetId: UUID; readonly maintenanceType: string; readonly dueDate: ISODateString; readonly daysPastDue: number };
}

export interface MaintenancePlanCreatedEvent extends BaseEvent {
  readonly eventType: 'MAINTENANCE_PLAN_CREATED';
  readonly payload: { readonly planId: UUID; readonly assetId: UUID; readonly planType: string; readonly frequency: string };
}

export interface MaintenancePlanUpdatedEvent extends BaseEvent {
  readonly eventType: 'MAINTENANCE_PLAN_UPDATED';
  readonly payload: { readonly planId: UUID; readonly assetId: UUID; readonly updates: readonly string[] };
}

export interface MaintenancePlanDeactivatedEvent extends BaseEvent {
  readonly eventType: 'MAINTENANCE_PLAN_DEACTIVATED';
  readonly payload: { readonly planId: UUID; readonly assetId: UUID; readonly deactivatedBy: UUID };
}

export interface LinearAssetCreatedEvent extends BaseEvent {
  readonly eventType: 'LINEAR_ASSET_CREATED';
  readonly payload: { readonly linearAssetId: UUID; readonly assetId: UUID; readonly totalLength: number; readonly unit: string };
}

export interface LinearAssetUpdatedEvent extends BaseEvent {
  readonly eventType: 'LINEAR_ASSET_UPDATED';
  readonly payload: { readonly linearAssetId: UUID; readonly assetId: UUID; readonly updates: readonly string[] };
}

export interface LinearAssetDeletedEvent extends BaseEvent {
  readonly eventType: 'LINEAR_ASSET_DELETED';
  readonly payload: { readonly linearAssetId: UUID; readonly assetId: UUID; readonly deletedBy: UUID };
}

export interface SegmentCreatedEvent extends BaseEvent {
  readonly eventType: 'SEGMENT_CREATED';
  readonly payload: { readonly segmentId: UUID; readonly linearAssetId: UUID; readonly startPoint: number; readonly endPoint: number };
}

export interface SegmentUpdatedEvent extends BaseEvent {
  readonly eventType: 'SEGMENT_UPDATED';
  readonly payload: { readonly segmentId: UUID; readonly linearAssetId: UUID; readonly updates: readonly string[] };
}

export interface SegmentDeletedEvent extends BaseEvent {
  readonly eventType: 'SEGMENT_DELETED';
  readonly payload: { readonly segmentId: UUID; readonly linearAssetId: UUID; readonly deletedBy: UUID };
}

export interface AssetHierarchyLinkedEvent extends BaseEvent {
  readonly eventType: 'ASSET_HIERARCHY_LINKED';
  readonly payload: { readonly parentAssetId: UUID; readonly childAssetId: UUID; readonly linkedBy: UUID };
}

export interface AssetHierarchyUnlinkedEvent extends BaseEvent {
  readonly eventType: 'ASSET_HIERARCHY_UNLINKED';
  readonly payload: { readonly previousParentId: UUID; readonly childAssetId: UUID; readonly unlinkedBy: UUID };
}

export interface AssetStatusPropagatedEvent extends BaseEvent {
  readonly eventType: 'ASSET_STATUS_PROPAGATED';
  readonly payload: { readonly parentAssetId: UUID; readonly newStatus: AssetStatus; readonly affectedChildren: number };
}

export interface PartsReservedEvent extends BaseEvent {
  readonly eventType: 'PARTS_RESERVED';
  readonly payload: { readonly workOrderId: UUID; readonly reservationId: UUID; readonly parts: readonly { partId: UUID; quantity: number }[] };
}

export interface PartsReplenishmentNeededEvent extends BaseEvent {
  readonly eventType: 'PARTS_REPLENISHMENT_NEEDED';
  readonly payload: { readonly alertCount: number; readonly criticalCount: number; readonly parts: readonly { partId: UUID; partNumber: string; currentQuantity: number }[] };
}

export interface PartsConsumedEvent extends BaseEvent {
  readonly eventType: 'PARTS_CONSUMED';
  readonly payload: { readonly workOrderId: UUID; readonly partsConsumed: readonly { partId: UUID; quantity: number }[] };
}

export interface PartsReservationCancelledEvent extends BaseEvent {
  readonly eventType: 'PARTS_RESERVATION_CANCELLED';
  readonly payload: { readonly workOrderId: UUID; readonly partId: UUID | null; readonly cancelledBy: UUID };
}

export interface PartQuantityAdjustedEvent extends BaseEvent {
  readonly eventType: 'PART_QUANTITY_ADJUSTED';
  readonly payload: { readonly partId: UUID; readonly partNumber: string; readonly previousQuantity: number; readonly newQuantity: number; readonly adjustmentType: string; readonly reason: string };
}

export interface PartBelowReorderPointEvent extends BaseEvent {
  readonly eventType: 'PART_BELOW_REORDER_POINT';
  readonly payload: { readonly partId: UUID; readonly partNumber: string; readonly currentQuantity: number; readonly reorderPoint: number };
}

export interface PartStockReceivedEvent extends BaseEvent {
  readonly eventType: 'PART_STOCK_RECEIVED';
  readonly payload: { readonly partId: UUID; readonly partNumber: string; readonly quantityReceived: number; readonly newTotalQuantity: number };
}

// ============================================================================
// Contract and Procurement Events
// ============================================================================

export interface ContractExpiringEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_EXPIRING';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly contractType: string; readonly vendorId: UUID; readonly vendorName: string; readonly expirationDate: ISODateString; readonly daysUntilExpiration: number; readonly totalValue: number };
}

export interface ContractRenewedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_RENEWED';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly vendorId: UUID; readonly previousEndDate: ISODateString; readonly newEndDate: ISODateString; readonly renewedBy: UUID };
}

export interface ContractCreatedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_CREATED';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly contractType: string; readonly vendorId: UUID; readonly createdBy: UUID };
}

export interface ContractUpdatedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_UPDATED';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly updates: readonly string[]; readonly updatedBy: UUID };
}

export interface ContractAssetLinkedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_ASSET_LINKED';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly assetId: UUID; readonly linkedBy: UUID };
}

export interface ContractAssetUnlinkedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_ASSET_UNLINKED';
  readonly payload: { readonly contractId: UUID; readonly assetId: UUID; readonly unlinkedBy: UUID };
}

export interface ContractEntitlementLinkedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_ENTITLEMENT_LINKED';
  readonly payload: { readonly contractId: UUID; readonly contractNumber: string; readonly entitlementId: UUID; readonly linkedBy: UUID };
}

export interface ContractEntitlementUnlinkedEvent extends BaseEvent {
  readonly eventType: 'CONTRACT_ENTITLEMENT_UNLINKED';
  readonly payload: { readonly contractId: UUID; readonly entitlementId: UUID; readonly unlinkedBy: UUID };
}

export interface PurchaseOrderCreatedEvent extends BaseEvent {
  readonly eventType: 'PURCHASE_ORDER_CREATED';
  readonly payload: { readonly purchaseOrderId: UUID; readonly poNumber: string; readonly vendorId: UUID; readonly requesterId: UUID; readonly totalAmount: number; readonly lineItemCount: number };
}

export interface PurchaseOrderReceivedEvent extends BaseEvent {
  readonly eventType: 'PURCHASE_ORDER_RECEIVED';
  readonly payload: { readonly purchaseOrderId: UUID; readonly poNumber: string; readonly receivedBy: UUID; readonly assetsCreated: number; readonly isFullyReceived: boolean };
}

export interface PurchaseOrderSubmittedEvent extends BaseEvent {
  readonly eventType: 'PURCHASE_ORDER_SUBMITTED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly submittedBy: UUID; readonly vendorId: UUID };
}

export interface PurchaseOrderApprovedEvent extends BaseEvent {
  readonly eventType: 'PURCHASE_ORDER_APPROVED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly approvedBy: UUID };
}

export interface PurchaseOrderRejectedEvent extends BaseEvent {
  readonly eventType: 'PO_REJECTED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly rejectedBy: UUID; readonly rejectionReason: string };
}

export interface PurchaseOrderCancelledEvent extends BaseEvent {
  readonly eventType: 'PO_CANCELLED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly cancelledBy: UUID; readonly cancellationReason: string };
}

export interface PurchaseOrderSentEvent extends BaseEvent {
  readonly eventType: 'PO_SENT';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly sentBy: UUID; readonly sentDate: ISODateString; readonly vendorId: UUID };
}

export interface POLineAddedEvent extends BaseEvent {
  readonly eventType: 'PO_LINE_ADDED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly lineId: UUID; readonly lineNumber: number; readonly productDescription: string; readonly quantity: number; readonly unitPrice: number; readonly addedBy: UUID };
}

export interface POLineRemovedEvent extends BaseEvent {
  readonly eventType: 'PO_LINE_REMOVED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly lineId: UUID; readonly lineNumber: number; readonly removedBy: UUID };
}

export interface POLineUpdatedEvent extends BaseEvent {
  readonly eventType: 'PO_LINE_UPDATED';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly lineId: UUID; readonly lineNumber: number; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface ApprovalReminderSentEvent extends BaseEvent {
  readonly eventType: 'APPROVAL_REMINDER_SENT';
  readonly payload: { readonly poId: UUID; readonly poNumber: string; readonly approverId: UUID; readonly reminderCount: number; readonly daysPending: number };
}

export interface ProcurementProcessedEvent extends BaseEvent {
  readonly eventType: 'PROCUREMENT_PROCESSED';
  readonly payload: { readonly requestId: UUID; readonly fulfilledFromStock: number; readonly purchaseOrdersCreated: number };
}

export interface ReservationReleasedEvent extends BaseEvent {
  readonly eventType: 'RESERVATION_RELEASED';
  readonly payload: { readonly reservationId: UUID; readonly inventoryId: UUID; readonly releasedBy: UUID };
}

export interface ReservationFulfilledEvent extends BaseEvent {
  readonly eventType: 'RESERVATION_FULFILLED';
  readonly payload: { readonly reservationId: UUID; readonly inventoryId: UUID; readonly assetId: UUID };
}

// ============================================================================
// Request and Approval Events
// ============================================================================

export interface RequestSubmittedEvent extends BaseEvent {
  readonly eventType: 'REQUEST_SUBMITTED';
  readonly payload: { readonly requestId: UUID; readonly requesterId: UUID; readonly itemCount: number; readonly totalCost: number; readonly requiresApproval: boolean };
}

export interface RequestApprovedEvent extends BaseEvent {
  readonly eventType: 'REQUEST_APPROVED';
  readonly payload: { readonly requestId: UUID; readonly requesterId: UUID; readonly approvedBy: UUID; readonly approvalLevel: number; readonly isFinalApproval: boolean };
}

export interface RequestRejectedEvent extends BaseEvent {
  readonly eventType: 'REQUEST_REJECTED';
  readonly payload: { readonly requestId: UUID; readonly requesterId: UUID; readonly rejectedBy: UUID; readonly reason: string };
}

export interface RequestFulfilledEvent extends BaseEvent {
  readonly eventType: 'REQUEST_FULFILLED';
  readonly payload: { readonly requestId: UUID; readonly requesterId: UUID; readonly fulfilledBy: UUID; readonly assetsAssigned: readonly UUID[] };
}

export interface RequestCancelledEvent extends BaseEvent {
  readonly eventType: 'REQUEST_CANCELLED';
  readonly payload: { readonly requestId: UUID; readonly requestNumber: string; readonly cancelledBy: UUID; readonly reason: string };
}

export interface ApprovalWorkflowInitiatedEvent extends BaseEvent {
  readonly eventType: 'APPROVAL_WORKFLOW_INITIATED';
  readonly payload: { readonly requestId: UUID; readonly requestNumber: string; readonly workflowId: UUID; readonly requiredApprovals: number };
}

export interface ApprovalRequiredEvent extends BaseEvent {
  readonly eventType: 'APPROVAL_REQUIRED';
  readonly payload: { readonly workflowId: UUID; readonly requestId: UUID; readonly stepNumber: number; readonly approverId: UUID };
}

export interface ApprovalStepCompletedEvent extends BaseEvent {
  readonly eventType: 'APPROVAL_STEP_COMPLETED';
  readonly payload: { readonly workflowId: UUID; readonly requestId: UUID; readonly stepNumber: number; readonly decision: 'APPROVED' | 'REJECTED'; readonly decidedBy: UUID };
}

export interface ApprovalDelegatedEvent extends BaseEvent {
  readonly eventType: 'APPROVAL_DELEGATED';
  readonly payload: { readonly workflowId: UUID; readonly requestId: UUID; readonly fromApproverId: UUID; readonly toApproverId: UUID; readonly reason: string };
}

// ============================================================================
// Lifecycle Events
// ============================================================================

export interface ReceivingStartedEvent extends BaseEvent {
  readonly eventType: 'RECEIVING_STARTED';
  readonly payload: { readonly receivingId: UUID; readonly poId: UUID | null; readonly startedBy: UUID };
}

export interface ReceivingProgressEvent extends BaseEvent {
  readonly eventType: 'RECEIVING_PROGRESS';
  readonly payload: { readonly receivingId: UUID; readonly poId: UUID | null; readonly assetsReceived: number; readonly totalExpected: number };
}

export interface ReceivingCompletedEvent extends BaseEvent {
  readonly eventType: 'RECEIVING_COMPLETED';
  readonly payload: { readonly receivingId: UUID; readonly poId: UUID | null; readonly assetsCreated: number; readonly completedBy: UUID };
}

export interface ReceivingCancelledEvent extends BaseEvent {
  readonly eventType: 'RECEIVING_CANCELLED';
  readonly payload: { readonly receivingId: UUID; readonly poId: UUID | null; readonly cancelledBy: UUID; readonly reason: string };
}

// Inspection Events (Requirement 13: Enhanced Receiving Workflow)
export interface InspectionRequiredEvent extends BaseEvent {
  readonly eventType: 'INSPECTION_REQUIRED';
  readonly payload: { readonly inspectionId: UUID; readonly receivingLineId: UUID; readonly receivingId: UUID; readonly assetId: UUID | null; readonly serialNumber: string | null; readonly markedBy: UUID; readonly markedByName?: string };
}

export interface InspectionPassedEvent extends BaseEvent {
  readonly eventType: 'INSPECTION_PASSED';
  readonly payload: { readonly inspectionId: UUID; readonly receivingLineId: UUID; readonly receivingId: UUID; readonly assetId: UUID | null; readonly serialNumber: string | null; readonly inspectedBy: UUID; readonly inspectedByName?: string };
}

export interface InspectionFailedEvent extends BaseEvent {
  readonly eventType: 'INSPECTION_FAILED';
  readonly payload: { readonly inspectionId: UUID; readonly receivingLineId: UUID; readonly receivingId: UUID; readonly assetId: UUID | null; readonly serialNumber: string | null; readonly inspectedBy: UUID; readonly inspectedByName?: string; readonly failureReason?: string; readonly routedToReturn: boolean };
}

export interface InspectionRoutedToReturnEvent extends BaseEvent {
  readonly eventType: 'INSPECTION_ROUTED_TO_RETURN';
  readonly payload: { readonly inspectionId: UUID; readonly returnOrderId: UUID; readonly routedBy: UUID; readonly assetId: UUID | null; readonly serialNumber: string | null; readonly failureReason: string | null };
}

export interface RetirementWorkflowInitiatedEvent extends BaseEvent {
  readonly eventType: 'RETIREMENT_WORKFLOW_INITIATED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly assetId: UUID; readonly assetTag: string; readonly initiatedBy: UUID };
}

export interface RetirementDataWipeCompletedEvent extends BaseEvent {
  readonly eventType: 'RETIREMENT_DATA_WIPE_COMPLETED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly wipeMethod: string; readonly completedBy: UUID };
}

export interface RetirementTaskUpdatedEvent extends BaseEvent {
  readonly eventType: 'RETIREMENT_TASK_UPDATED';
  readonly payload: { readonly taskId: UUID; readonly workflowId: UUID; readonly taskType: string; readonly status: string; readonly updatedBy: UUID };
}

export interface RetirementWorkflowCancelledEvent extends BaseEvent {
  readonly eventType: 'RETIREMENT_WORKFLOW_CANCELLED';
  readonly payload: { readonly workflowId: UUID; readonly workflowNumber: string; readonly cancelledBy: UUID; readonly reason: string };
}

export interface CMDBRelationshipCreatedEvent extends BaseEvent {
  readonly eventType: 'CMDB_RELATIONSHIP_CREATED';
  readonly payload: { readonly relationshipId: UUID; readonly deploymentId: UUID; readonly sourceAssetId: UUID; readonly targetAssetId: UUID; readonly relationshipType: string };
}

export interface DiscoveryCorrelatedEvent extends BaseEvent {
  readonly eventType: 'DISCOVERY_CORRELATED';
  readonly payload: { readonly correlationId: UUID; readonly assetId: UUID; readonly discoveryRecordId: UUID; readonly matchType: string };
}

export interface DiscoveryAutoCorrelatedEvent extends BaseEvent {
  readonly eventType: 'DISCOVERY_AUTO_CORRELATED';
  readonly payload: { readonly correlationId: UUID; readonly assetId: UUID; readonly discoveryRecordId: UUID; readonly matchField: string; readonly confidence: number };
}

export interface DeploymentCancelledEvent extends BaseEvent {
  readonly eventType: 'DEPLOYMENT_CANCELLED';
  readonly payload: { readonly deploymentId: UUID; readonly assetId: UUID; readonly cancelledBy: UUID; readonly reason: string };
}

// ============================================================================
// Integration Events
// ============================================================================

export interface DiscoveryDataReceivedEvent extends BaseEvent {
  readonly eventType: 'DISCOVERY_DATA_RECEIVED';
  readonly payload: { readonly sourceId: UUID; readonly sourceName: string; readonly sourceType: 'SCCM' | 'JAMF' | 'TANIUM' | 'CUSTOM'; readonly recordCount: number; readonly newAssetsCreated: number; readonly existingAssetsUpdated: number };
}

export interface ASNReceivedEvent extends BaseEvent {
  readonly eventType: 'ASN_RECEIVED';
  readonly payload: { readonly asnId: UUID; readonly vendorId: UUID; readonly vendorName: string; readonly purchaseOrderId?: UUID; readonly expectedDeliveryDate: ISODateString; readonly itemCount: number };
}

export interface IntegrationErrorEvent extends BaseEvent {
  readonly eventType: 'INTEGRATION_ERROR';
  readonly payload: { readonly integrationId: UUID; readonly integrationType: string; readonly errorCode: string; readonly errorMessage: string; readonly retryCount: number; readonly willRetry: boolean };
}

// ============================================================================
// Admin Events (Location, Stockroom, Reference Data)
// ============================================================================

// Building Events
export interface BuildingCreatedEvent extends BaseEvent {
  readonly eventType: 'BUILDING_CREATED';
  readonly payload: { readonly buildingId: UUID; readonly buildingCode: string; readonly name: string; readonly createdBy: UUID };
}

export interface BuildingUpdatedEvent extends BaseEvent {
  readonly eventType: 'BUILDING_UPDATED';
  readonly payload: { readonly buildingId: UUID; readonly buildingCode: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface BuildingDeactivatedEvent extends BaseEvent {
  readonly eventType: 'BUILDING_DEACTIVATED';
  readonly payload: { readonly buildingId: UUID; readonly buildingCode: string; readonly deactivatedBy: UUID };
}

// Floor Events
export interface FloorCreatedEvent extends BaseEvent {
  readonly eventType: 'FLOOR_CREATED';
  readonly payload: { readonly floorId: UUID; readonly buildingId: UUID; readonly floorNumber: number; readonly name: string; readonly createdBy: UUID };
}

export interface FloorUpdatedEvent extends BaseEvent {
  readonly eventType: 'FLOOR_UPDATED';
  readonly payload: { readonly floorId: UUID; readonly buildingId: UUID; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface FloorDeactivatedEvent extends BaseEvent {
  readonly eventType: 'FLOOR_DEACTIVATED';
  readonly payload: { readonly floorId: UUID; readonly buildingId: UUID; readonly deactivatedBy: UUID };
}

// Room Events
export interface RoomCreatedEvent extends BaseEvent {
  readonly eventType: 'ROOM_CREATED';
  readonly payload: { readonly roomId: UUID; readonly floorId: UUID; readonly roomNumber: string; readonly name: string; readonly roomType: string; readonly createdBy: UUID };
}

export interface RoomUpdatedEvent extends BaseEvent {
  readonly eventType: 'ROOM_UPDATED';
  readonly payload: { readonly roomId: UUID; readonly floorId: UUID; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface RoomDeactivatedEvent extends BaseEvent {
  readonly eventType: 'ROOM_DEACTIVATED';
  readonly payload: { readonly roomId: UUID; readonly floorId: UUID; readonly deactivatedBy: UUID };
}

// Rack Events
export interface RackCreatedEvent extends BaseEvent {
  readonly eventType: 'RACK_CREATED';
  readonly payload: { readonly rackId: UUID; readonly roomId: UUID; readonly rackName: string; readonly totalUnits: number; readonly createdBy: UUID };
}

export interface RackUpdatedEvent extends BaseEvent {
  readonly eventType: 'RACK_UPDATED';
  readonly payload: { readonly rackId: UUID; readonly roomId: UUID; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface RackDeactivatedEvent extends BaseEvent {
  readonly eventType: 'RACK_DEACTIVATED';
  readonly payload: { readonly rackId: UUID; readonly roomId: UUID; readonly deactivatedBy: UUID };
}

// Bin Location Events
export interface BinLocationCreatedEvent extends BaseEvent {
  readonly eventType: 'BIN_LOCATION_CREATED';
  readonly payload: { readonly binId: UUID; readonly stockroomId: UUID; readonly binCode: string; readonly createdBy: UUID };
}

export interface BinLocationUpdatedEvent extends BaseEvent {
  readonly eventType: 'BIN_LOCATION_UPDATED';
  readonly payload: { readonly binId: UUID; readonly stockroomId: UUID; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

// Stockroom Events
export interface StockroomCreatedEvent extends BaseEvent {
  readonly eventType: 'STOCKROOM_CREATED';
  readonly payload: { readonly stockroomId: UUID; readonly stockroomCode: string; readonly name: string; readonly stockroomType: string; readonly createdBy: UUID };
}

export interface StockroomUpdatedEvent extends BaseEvent {
  readonly eventType: 'STOCKROOM_UPDATED';
  readonly payload: { readonly stockroomId: UUID; readonly stockroomCode: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface StockroomDeactivatedEvent extends BaseEvent {
  readonly eventType: 'STOCKROOM_DEACTIVATED';
  readonly payload: { readonly stockroomId: UUID; readonly stockroomCode: string; readonly deactivatedBy: UUID };
}

// Department Events
export interface DepartmentCreatedEvent extends BaseEvent {
  readonly eventType: 'DEPARTMENT_CREATED';
  readonly payload: { readonly departmentId: UUID; readonly code: string; readonly name: string; readonly parentDepartmentId: UUID | null; readonly createdBy: UUID };
}

export interface DepartmentUpdatedEvent extends BaseEvent {
  readonly eventType: 'DEPARTMENT_UPDATED';
  readonly payload: { readonly departmentId: UUID; readonly code: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface DepartmentDeactivatedEvent extends BaseEvent {
  readonly eventType: 'DEPARTMENT_DEACTIVATED';
  readonly payload: { readonly departmentId: UUID; readonly code: string; readonly cascadedChildren: number; readonly deactivatedBy: UUID };
}

// Cost Center Events
export interface CostCenterCreatedEvent extends BaseEvent {
  readonly eventType: 'COST_CENTER_CREATED';
  readonly payload: { readonly costCenterId: UUID; readonly code: string; readonly name: string; readonly budgetAmount: number; readonly createdBy: UUID };
}

export interface CostCenterUpdatedEvent extends BaseEvent {
  readonly eventType: 'COST_CENTER_UPDATED';
  readonly payload: { readonly costCenterId: UUID; readonly code: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

// Vendor Events
export interface VendorCreatedEvent extends BaseEvent {
  readonly eventType: 'VENDOR_CREATED';
  readonly payload: { readonly vendorId: UUID; readonly vendorCode: string | null; readonly vendorName: string; readonly createdBy: UUID };
}

export interface VendorUpdatedEvent extends BaseEvent {
  readonly eventType: 'VENDOR_UPDATED';
  readonly payload: { readonly vendorId: UUID; readonly vendorName: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface VendorRatingChangedEvent extends BaseEvent {
  readonly eventType: 'VENDOR_RATING_CHANGED';
  readonly payload: { readonly vendorId: UUID; readonly vendorName: string; readonly previousRating: string | null; readonly newRating: string; readonly changedBy: UUID };
}

export interface VendorDeactivatedEvent extends BaseEvent {
  readonly eventType: 'VENDOR_DEACTIVATED';
  readonly payload: { readonly vendorId: UUID; readonly vendorName: string; readonly deactivatedBy: UUID };
}

// Manufacturer Events
export interface ManufacturerCreatedEvent extends BaseEvent {
  readonly eventType: 'MANUFACTURER_CREATED';
  readonly payload: { readonly manufacturerId: UUID; readonly name: string; readonly createdBy: UUID };
}

export interface ManufacturerUpdatedEvent extends BaseEvent {
  readonly eventType: 'MANUFACTURER_UPDATED';
  readonly payload: { readonly manufacturerId: UUID; readonly name: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

// Model Events
export interface ModelCreatedEvent extends BaseEvent {
  readonly eventType: 'MODEL_CREATED';
  readonly payload: { readonly modelId: UUID; readonly manufacturerId: UUID; readonly modelName: string; readonly createdBy: UUID };
}

export interface ModelUpdatedEvent extends BaseEvent {
  readonly eventType: 'MODEL_UPDATED';
  readonly payload: { readonly modelId: UUID; readonly manufacturerId: UUID; readonly modelName: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: UUID };
}

export interface ModelEndOfLifeEvent extends BaseEvent {
  readonly eventType: 'MODEL_END_OF_LIFE';
  readonly payload: { readonly modelId: UUID; readonly manufacturerId: UUID; readonly modelName: string; readonly previousStatus: string; readonly markedBy: UUID };
}

// User Admin Events
export interface UserUpdatedEvent extends BaseEvent {
  readonly eventType: 'USER_UPDATED';
  readonly payload: { readonly userId: UUID; readonly email: string; readonly changes: readonly { readonly field: string; readonly oldValue: unknown; readonly newValue: unknown }[]; readonly updatedBy: string };
}

export interface UserDeactivatedEvent extends BaseEvent {
  readonly eventType: 'USER_DEACTIVATED';
  readonly payload: { readonly userId: UUID; readonly email: string; readonly deactivatedBy: string };
}

export interface UserReactivatedEvent extends BaseEvent {
  readonly eventType: 'USER_REACTIVATED';
  readonly payload: { readonly userId: UUID; readonly email: string; readonly reactivatedBy: string };
}

export interface UserRoleAssignedEvent extends BaseEvent {
  readonly eventType: 'USER_ROLE_ASSIGNED';
  readonly payload: { readonly userId: UUID; readonly roleId: UUID; readonly roleName: string; readonly assignedBy: string };
}

export interface UserRoleRemovedEvent extends BaseEvent {
  readonly eventType: 'USER_ROLE_REMOVED';
  readonly payload: { readonly userId: UUID; readonly roleId: UUID; readonly roleName: string; readonly removedBy: string };
}

// ============================================================================
// Report Events
// ============================================================================

export interface ReportGeneratedEvent extends BaseEvent {
  readonly eventType: 'REPORT_GENERATED';
  readonly payload: {
    readonly reportId: UUID;
    readonly reportType: string;
    readonly generatedBy: UUID;
    readonly format: 'JSON' | 'CSV' | 'EXCEL' | 'PDF';
  };
}

export interface ReportExportedEvent extends BaseEvent {
  readonly eventType: 'REPORT_EXPORTED';
  readonly payload: {
    readonly reportId: UUID;
    readonly format: 'JSON' | 'CSV' | 'EXCEL' | 'PDF';
    readonly exportedBy: UUID;
    readonly exportUrl: string;
  };
}

// ============================================================================
// Union Types and Helpers
// ============================================================================

/**
 * Union type of all domain events
 */
export type DomainEvent =
  // Asset events
  | AssetCreatedEvent | AssetUpdatedEvent | AssetDeletedEvent | AssetStateChangedEvent
  | AssetAssignedEvent | AssetDeployedEvent | AssetRetiredEvent | AssetReassignedEvent
  // SAM events
  | ReconciliationCompletedEvent | ReconciliationRunCompletedEvent
  | ReclamationInitiatedEvent | ReclamationStatusChangedEvent | ReclamationCandidateIdentifiedEvent
  | ReclamationIdentificationCompletedEvent | ReclamationWorkflowInitiatedEvent
  | ReclamationUserNotificationEvent | ReclamationManagerNotificationEvent
  | ReclamationApprovedEvent | ReclamationRejectedEvent | ReclamationCompletedEvent | ReclamationCancelledEvent
  | ShadowITDetectedEvent | ShadowITAlertCreatedEvent | ShadowITAnalysisCompletedEvent
  | ShadowITStatusChangedEvent | ShadowITAlertAcknowledgedEvent | ShadowITAlertResolvedEvent | ShadowITAlertIgnoredEvent
  | SaaSSubscriptionCreatedEvent | SaaSSubscriptionUpdatedEvent | SaaSUsageSyncedEvent
  | SaaSOptimizationOpportunitiesFoundEvent | SaaSRenewalNotificationCreatedEvent
  | SaaSRenewalNotificationSentEvent | SaaSRenewalNotificationAcknowledgedEvent | SaaSSubscriptionDeletedEvent
  | PublisherCalculationCompletedEvent | ComplianceReportGeneratedEvent | ComplianceReportExportedEvent
  // HAM events
  | TransferOrderCreatedEvent | TransferOrderCompletedEvent | TransferOrderApprovedEvent
  | TransferOrderRejectedEvent | TransferOrderShippedEvent | TransferOrderCancelledEvent
  | StockLevelAlertEvent | InventoryCreatedEvent | InventoryUpdatedEvent | InventoryAdjustedEvent
  | InventoryReservedEvent | InventoryReservationReleasedEvent | ReplenishmentAlertEvent
  | LoanerCheckoutEvent | LoanerReturnedEvent | LoanerOverdueEvent
  | LoanerCheckedOutEvent | LoanerOverdueNotificationEvent | LoanerDueDateExtendedEvent
  | AuditCompletedEvent | AuditScanRecordedEvent | DisposalCompletedEvent
  | DisposalWorkflowInitiatedEvent | DisposalDestructionRecordedEvent | DisposalDataWipeCompletedEvent
  | DisposalEnvironmentalCheckCompletedEvent | DisposalPickupScheduledEvent
  | DisposalTaskUpdatedEvent | DisposalWorkflowCancelledEvent
  // EAM events
  | WorkOrderCreatedEvent | WorkOrderCompletedEvent | WorkOrderAssignedEvent | WorkOrderStatusChangedEvent
  | WorkOrderPartAddedEvent | WorkOrderPartUsedEvent | WorkOrderPartRemovedEvent
  | MaintenanceDueEvent | MaintenancePlanCreatedEvent | MaintenancePlanUpdatedEvent | MaintenancePlanDeactivatedEvent
  | LinearAssetCreatedEvent | LinearAssetUpdatedEvent | LinearAssetDeletedEvent
  | SegmentCreatedEvent | SegmentUpdatedEvent | SegmentDeletedEvent
  | AssetHierarchyLinkedEvent | AssetHierarchyUnlinkedEvent | AssetStatusPropagatedEvent
  | PartsReservedEvent | PartsReplenishmentNeededEvent | PartsConsumedEvent | PartsReservationCancelledEvent
  | PartQuantityAdjustedEvent | PartBelowReorderPointEvent | PartStockReceivedEvent
  // Contract events
  | ContractExpiringEvent | ContractRenewedEvent | ContractCreatedEvent | ContractUpdatedEvent
  | ContractAssetLinkedEvent | ContractAssetUnlinkedEvent
  | ContractEntitlementLinkedEvent | ContractEntitlementUnlinkedEvent
  | PurchaseOrderCreatedEvent | PurchaseOrderReceivedEvent
  | PurchaseOrderSubmittedEvent | PurchaseOrderApprovedEvent
  | PurchaseOrderRejectedEvent | PurchaseOrderCancelledEvent | PurchaseOrderSentEvent
  | POLineAddedEvent | POLineRemovedEvent | POLineUpdatedEvent
  | ApprovalReminderSentEvent
  | ProcurementProcessedEvent | ReservationReleasedEvent | ReservationFulfilledEvent
  // Request events
  | RequestSubmittedEvent | RequestApprovedEvent | RequestRejectedEvent | RequestFulfilledEvent | RequestCancelledEvent
  | ApprovalWorkflowInitiatedEvent | ApprovalRequiredEvent | ApprovalStepCompletedEvent | ApprovalDelegatedEvent
  // Lifecycle events
  | ReceivingStartedEvent | ReceivingProgressEvent | ReceivingCompletedEvent | ReceivingCancelledEvent
  | InspectionRequiredEvent | InspectionPassedEvent | InspectionFailedEvent | InspectionRoutedToReturnEvent
  | RetirementWorkflowInitiatedEvent | RetirementDataWipeCompletedEvent
  | RetirementTaskUpdatedEvent | RetirementWorkflowCancelledEvent
  | CMDBRelationshipCreatedEvent | DiscoveryCorrelatedEvent | DiscoveryAutoCorrelatedEvent | DeploymentCancelledEvent
  // Integration events
  | DiscoveryDataReceivedEvent | ASNReceivedEvent | IntegrationErrorEvent
  // Admin events
  | BuildingCreatedEvent | BuildingUpdatedEvent | BuildingDeactivatedEvent
  | FloorCreatedEvent | FloorUpdatedEvent | FloorDeactivatedEvent
  | RoomCreatedEvent | RoomUpdatedEvent | RoomDeactivatedEvent
  | RackCreatedEvent | RackUpdatedEvent | RackDeactivatedEvent
  | BinLocationCreatedEvent | BinLocationUpdatedEvent
  | StockroomCreatedEvent | StockroomUpdatedEvent | StockroomDeactivatedEvent
  | DepartmentCreatedEvent | DepartmentUpdatedEvent | DepartmentDeactivatedEvent
  | CostCenterCreatedEvent | CostCenterUpdatedEvent
  | VendorCreatedEvent | VendorUpdatedEvent | VendorRatingChangedEvent | VendorDeactivatedEvent
  | ManufacturerCreatedEvent | ManufacturerUpdatedEvent
  | ModelCreatedEvent | ModelUpdatedEvent | ModelEndOfLifeEvent
  // User Admin events
  | UserUpdatedEvent | UserDeactivatedEvent | UserReactivatedEvent
  | UserRoleAssignedEvent | UserRoleRemovedEvent
  // Report events
  | ReportGeneratedEvent | ReportExportedEvent;

/**
 * Event type discriminator - all valid event type strings
 */
export type EventType = DomainEvent['eventType'];

/**
 * All valid event types as an array for validation
 */
export const ALL_EVENT_TYPES: readonly EventType[] = [
  // Asset events
  'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED', 'ASSET_STATE_CHANGED',
  'ASSET_ASSIGNED', 'ASSET_DEPLOYED', 'ASSET_RETIRED', 'ASSET_REASSIGNED',
  // SAM events
  'RECONCILIATION_COMPLETED', 'RECONCILIATION_RUN_COMPLETED',
  'RECLAMATION_INITIATED', 'RECLAMATION_STATUS_CHANGED', 'RECLAMATION_CANDIDATE_IDENTIFIED',
  'RECLAMATION_IDENTIFICATION_COMPLETED', 'RECLAMATION_WORKFLOW_INITIATED',
  'RECLAMATION_USER_NOTIFICATION', 'RECLAMATION_MANAGER_NOTIFICATION',
  'RECLAMATION_APPROVED', 'RECLAMATION_REJECTED', 'RECLAMATION_COMPLETED', 'RECLAMATION_CANCELLED',
  'SHADOW_IT_DETECTED', 'SHADOW_IT_ALERT_CREATED', 'SHADOW_IT_ANALYSIS_COMPLETED',
  'SHADOW_IT_STATUS_CHANGED', 'SHADOW_IT_ALERT_ACKNOWLEDGED', 'SHADOW_IT_ALERT_RESOLVED', 'SHADOW_IT_ALERT_IGNORED',
  'SAAS_SUBSCRIPTION_CREATED', 'SAAS_SUBSCRIPTION_UPDATED', 'SAAS_USAGE_SYNCED',
  'SAAS_OPTIMIZATION_OPPORTUNITIES_FOUND', 'SAAS_RENEWAL_NOTIFICATION_CREATED',
  'SAAS_RENEWAL_NOTIFICATION_SENT', 'SAAS_RENEWAL_NOTIFICATION_ACKNOWLEDGED', 'SAAS_SUBSCRIPTION_DELETED',
  'PUBLISHER_CALCULATION_COMPLETED', 'COMPLIANCE_REPORT_GENERATED', 'COMPLIANCE_REPORT_EXPORTED',
  // HAM events
  'TRANSFER_ORDER_CREATED', 'TRANSFER_ORDER_COMPLETED', 'TRANSFER_ORDER_APPROVED',
  'TRANSFER_ORDER_REJECTED', 'TRANSFER_ORDER_SHIPPED', 'TRANSFER_ORDER_CANCELLED',
  'STOCK_LEVEL_ALERT', 'INVENTORY_CREATED', 'INVENTORY_UPDATED', 'INVENTORY_ADJUSTED',
  'INVENTORY_RESERVED', 'INVENTORY_RESERVATION_RELEASED', 'REPLENISHMENT_ALERT',
  'LOANER_CHECKOUT', 'LOANER_RETURNED', 'LOANER_OVERDUE',
  'LOANER_CHECKED_OUT', 'LOANER_OVERDUE_NOTIFICATION', 'LOANER_DUE_DATE_EXTENDED',
  'AUDIT_COMPLETED', 'AUDIT_SCAN_RECORDED', 'DISPOSAL_COMPLETED',
  'DISPOSAL_WORKFLOW_INITIATED', 'DISPOSAL_DESTRUCTION_RECORDED', 'DISPOSAL_DATA_WIPE_COMPLETED',
  'DISPOSAL_ENVIRONMENTAL_CHECK_COMPLETED', 'DISPOSAL_PICKUP_SCHEDULED',
  'DISPOSAL_TASK_UPDATED', 'DISPOSAL_WORKFLOW_CANCELLED',
  // EAM events
  'WORK_ORDER_CREATED', 'WORK_ORDER_COMPLETED', 'WORK_ORDER_ASSIGNED', 'WORK_ORDER_STATUS_CHANGED',
  'WORK_ORDER_PART_ADDED', 'WORK_ORDER_PART_USED', 'WORK_ORDER_PART_REMOVED',
  'MAINTENANCE_DUE', 'MAINTENANCE_PLAN_CREATED', 'MAINTENANCE_PLAN_UPDATED', 'MAINTENANCE_PLAN_DEACTIVATED',
  'LINEAR_ASSET_CREATED', 'LINEAR_ASSET_UPDATED', 'LINEAR_ASSET_DELETED',
  'SEGMENT_CREATED', 'SEGMENT_UPDATED', 'SEGMENT_DELETED',
  'ASSET_HIERARCHY_LINKED', 'ASSET_HIERARCHY_UNLINKED', 'ASSET_STATUS_PROPAGATED',
  'PARTS_RESERVED', 'PARTS_REPLENISHMENT_NEEDED', 'PARTS_CONSUMED', 'PARTS_RESERVATION_CANCELLED',
  'PART_QUANTITY_ADJUSTED', 'PART_BELOW_REORDER_POINT', 'PART_STOCK_RECEIVED',
  // Contract events
  'CONTRACT_EXPIRING', 'CONTRACT_RENEWED', 'CONTRACT_CREATED', 'CONTRACT_UPDATED',
  'CONTRACT_ASSET_LINKED', 'CONTRACT_ASSET_UNLINKED',
  'CONTRACT_ENTITLEMENT_LINKED', 'CONTRACT_ENTITLEMENT_UNLINKED',
  'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_RECEIVED',
  'PURCHASE_ORDER_SUBMITTED', 'PURCHASE_ORDER_APPROVED',
  'PO_REJECTED', 'PO_CANCELLED', 'PO_SENT',
  'PO_LINE_ADDED', 'PO_LINE_REMOVED', 'PO_LINE_UPDATED',
  'APPROVAL_REMINDER_SENT',
  'PROCUREMENT_PROCESSED', 'RESERVATION_RELEASED', 'RESERVATION_FULFILLED',
  // Request events
  'REQUEST_SUBMITTED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'REQUEST_FULFILLED', 'REQUEST_CANCELLED',
  'APPROVAL_WORKFLOW_INITIATED', 'APPROVAL_REQUIRED', 'APPROVAL_STEP_COMPLETED', 'APPROVAL_DELEGATED',
  // Lifecycle events
  'RECEIVING_STARTED', 'RECEIVING_PROGRESS', 'RECEIVING_COMPLETED', 'RECEIVING_CANCELLED',
  'INSPECTION_REQUIRED', 'INSPECTION_PASSED', 'INSPECTION_FAILED', 'INSPECTION_ROUTED_TO_RETURN',
  'RETIREMENT_WORKFLOW_INITIATED', 'RETIREMENT_DATA_WIPE_COMPLETED',
  'RETIREMENT_TASK_UPDATED', 'RETIREMENT_WORKFLOW_CANCELLED',
  'CMDB_RELATIONSHIP_CREATED', 'DISCOVERY_CORRELATED', 'DISCOVERY_AUTO_CORRELATED', 'DEPLOYMENT_CANCELLED',
  // Integration events
  'DISCOVERY_DATA_RECEIVED', 'ASN_RECEIVED', 'INTEGRATION_ERROR',
  // Admin events
  'BUILDING_CREATED', 'BUILDING_UPDATED', 'BUILDING_DEACTIVATED',
  'FLOOR_CREATED', 'FLOOR_UPDATED', 'FLOOR_DEACTIVATED',
  'ROOM_CREATED', 'ROOM_UPDATED', 'ROOM_DEACTIVATED',
  'RACK_CREATED', 'RACK_UPDATED', 'RACK_DEACTIVATED',
  'BIN_LOCATION_CREATED', 'BIN_LOCATION_UPDATED',
  'STOCKROOM_CREATED', 'STOCKROOM_UPDATED', 'STOCKROOM_DEACTIVATED',
  'DEPARTMENT_CREATED', 'DEPARTMENT_UPDATED', 'DEPARTMENT_DEACTIVATED',
  'COST_CENTER_CREATED', 'COST_CENTER_UPDATED',
  'VENDOR_CREATED', 'VENDOR_UPDATED', 'VENDOR_RATING_CHANGED', 'VENDOR_DEACTIVATED',
  'MANUFACTURER_CREATED', 'MANUFACTURER_UPDATED',
  'MODEL_CREATED', 'MODEL_UPDATED', 'MODEL_END_OF_LIFE',
  // User Admin events
  'USER_UPDATED', 'USER_DEACTIVATED', 'USER_REACTIVATED',
  'USER_ROLE_ASSIGNED', 'USER_ROLE_REMOVED',
  // Report events
  'REPORT_GENERATED', 'REPORT_EXPORTED',
] as const;

/**
 * Event category for grouping and filtering
 */
export type EventCategory = 'ASSET' | 'SAM' | 'HAM' | 'EAM' | 'CONTRACT' | 'PROCUREMENT' | 'REQUEST' | 'LIFECYCLE' | 'INTEGRATION' | 'ADMIN' | 'REPORT';

/**
 * Map event types to their categories
 */
export const EVENT_CATEGORIES: Record<EventType, EventCategory> = {
  // Asset events
  ASSET_CREATED: 'ASSET', ASSET_UPDATED: 'ASSET', ASSET_DELETED: 'ASSET', ASSET_STATE_CHANGED: 'ASSET',
  ASSET_ASSIGNED: 'ASSET', ASSET_DEPLOYED: 'ASSET', ASSET_RETIRED: 'ASSET', ASSET_REASSIGNED: 'ASSET',
  // SAM events
  RECONCILIATION_COMPLETED: 'SAM', RECONCILIATION_RUN_COMPLETED: 'SAM',
  RECLAMATION_INITIATED: 'SAM', RECLAMATION_STATUS_CHANGED: 'SAM', RECLAMATION_CANDIDATE_IDENTIFIED: 'SAM',
  RECLAMATION_IDENTIFICATION_COMPLETED: 'SAM', RECLAMATION_WORKFLOW_INITIATED: 'SAM',
  RECLAMATION_USER_NOTIFICATION: 'SAM', RECLAMATION_MANAGER_NOTIFICATION: 'SAM',
  RECLAMATION_APPROVED: 'SAM', RECLAMATION_REJECTED: 'SAM', RECLAMATION_COMPLETED: 'SAM', RECLAMATION_CANCELLED: 'SAM',
  SHADOW_IT_DETECTED: 'SAM', SHADOW_IT_ALERT_CREATED: 'SAM', SHADOW_IT_ANALYSIS_COMPLETED: 'SAM',
  SHADOW_IT_STATUS_CHANGED: 'SAM', SHADOW_IT_ALERT_ACKNOWLEDGED: 'SAM', SHADOW_IT_ALERT_RESOLVED: 'SAM', SHADOW_IT_ALERT_IGNORED: 'SAM',
  SAAS_SUBSCRIPTION_CREATED: 'SAM', SAAS_SUBSCRIPTION_UPDATED: 'SAM', SAAS_USAGE_SYNCED: 'SAM',
  SAAS_OPTIMIZATION_OPPORTUNITIES_FOUND: 'SAM', SAAS_RENEWAL_NOTIFICATION_CREATED: 'SAM',
  SAAS_RENEWAL_NOTIFICATION_SENT: 'SAM', SAAS_RENEWAL_NOTIFICATION_ACKNOWLEDGED: 'SAM', SAAS_SUBSCRIPTION_DELETED: 'SAM',
  PUBLISHER_CALCULATION_COMPLETED: 'SAM', COMPLIANCE_REPORT_GENERATED: 'SAM', COMPLIANCE_REPORT_EXPORTED: 'SAM',
  // HAM events
  TRANSFER_ORDER_CREATED: 'HAM', TRANSFER_ORDER_COMPLETED: 'HAM', TRANSFER_ORDER_APPROVED: 'HAM',
  TRANSFER_ORDER_REJECTED: 'HAM', TRANSFER_ORDER_SHIPPED: 'HAM', TRANSFER_ORDER_CANCELLED: 'HAM',
  STOCK_LEVEL_ALERT: 'HAM', INVENTORY_CREATED: 'HAM', INVENTORY_UPDATED: 'HAM', INVENTORY_ADJUSTED: 'HAM',
  INVENTORY_RESERVED: 'HAM', INVENTORY_RESERVATION_RELEASED: 'HAM', REPLENISHMENT_ALERT: 'HAM',
  LOANER_CHECKOUT: 'HAM', LOANER_RETURNED: 'HAM', LOANER_OVERDUE: 'HAM',
  LOANER_CHECKED_OUT: 'HAM', LOANER_OVERDUE_NOTIFICATION: 'HAM', LOANER_DUE_DATE_EXTENDED: 'HAM',
  AUDIT_COMPLETED: 'HAM', AUDIT_SCAN_RECORDED: 'HAM', DISPOSAL_COMPLETED: 'HAM',
  DISPOSAL_WORKFLOW_INITIATED: 'HAM', DISPOSAL_DESTRUCTION_RECORDED: 'HAM', DISPOSAL_DATA_WIPE_COMPLETED: 'HAM',
  DISPOSAL_ENVIRONMENTAL_CHECK_COMPLETED: 'HAM', DISPOSAL_PICKUP_SCHEDULED: 'HAM',
  DISPOSAL_TASK_UPDATED: 'HAM', DISPOSAL_WORKFLOW_CANCELLED: 'HAM',
  // EAM events
  WORK_ORDER_CREATED: 'EAM', WORK_ORDER_COMPLETED: 'EAM', WORK_ORDER_ASSIGNED: 'EAM', WORK_ORDER_STATUS_CHANGED: 'EAM',
  WORK_ORDER_PART_ADDED: 'EAM', WORK_ORDER_PART_USED: 'EAM', WORK_ORDER_PART_REMOVED: 'EAM',
  MAINTENANCE_DUE: 'EAM', MAINTENANCE_PLAN_CREATED: 'EAM', MAINTENANCE_PLAN_UPDATED: 'EAM', MAINTENANCE_PLAN_DEACTIVATED: 'EAM',
  LINEAR_ASSET_CREATED: 'EAM', LINEAR_ASSET_UPDATED: 'EAM', LINEAR_ASSET_DELETED: 'EAM',
  SEGMENT_CREATED: 'EAM', SEGMENT_UPDATED: 'EAM', SEGMENT_DELETED: 'EAM',
  ASSET_HIERARCHY_LINKED: 'EAM', ASSET_HIERARCHY_UNLINKED: 'EAM', ASSET_STATUS_PROPAGATED: 'EAM',
  PARTS_RESERVED: 'EAM', PARTS_REPLENISHMENT_NEEDED: 'EAM', PARTS_CONSUMED: 'EAM', PARTS_RESERVATION_CANCELLED: 'EAM',
  PART_QUANTITY_ADJUSTED: 'EAM', PART_BELOW_REORDER_POINT: 'EAM', PART_STOCK_RECEIVED: 'EAM',
  // Contract events
  CONTRACT_EXPIRING: 'CONTRACT', CONTRACT_RENEWED: 'CONTRACT', CONTRACT_CREATED: 'CONTRACT', CONTRACT_UPDATED: 'CONTRACT',
  CONTRACT_ASSET_LINKED: 'CONTRACT', CONTRACT_ASSET_UNLINKED: 'CONTRACT',
  CONTRACT_ENTITLEMENT_LINKED: 'CONTRACT', CONTRACT_ENTITLEMENT_UNLINKED: 'CONTRACT',
  PURCHASE_ORDER_CREATED: 'CONTRACT', PURCHASE_ORDER_RECEIVED: 'CONTRACT',
  PURCHASE_ORDER_SUBMITTED: 'CONTRACT', PURCHASE_ORDER_APPROVED: 'CONTRACT',
  PO_REJECTED: 'PROCUREMENT', PO_CANCELLED: 'PROCUREMENT', PO_SENT: 'PROCUREMENT',
  PO_LINE_ADDED: 'PROCUREMENT', PO_LINE_REMOVED: 'PROCUREMENT', PO_LINE_UPDATED: 'PROCUREMENT',
  APPROVAL_REMINDER_SENT: 'PROCUREMENT',
  PROCUREMENT_PROCESSED: 'CONTRACT', RESERVATION_RELEASED: 'CONTRACT', RESERVATION_FULFILLED: 'CONTRACT',
  // Request events
  REQUEST_SUBMITTED: 'REQUEST', REQUEST_APPROVED: 'REQUEST', REQUEST_REJECTED: 'REQUEST', REQUEST_FULFILLED: 'REQUEST', REQUEST_CANCELLED: 'REQUEST',
  APPROVAL_WORKFLOW_INITIATED: 'REQUEST', APPROVAL_REQUIRED: 'REQUEST', APPROVAL_STEP_COMPLETED: 'REQUEST', APPROVAL_DELEGATED: 'REQUEST',
  // Lifecycle events
  RECEIVING_STARTED: 'LIFECYCLE', RECEIVING_PROGRESS: 'LIFECYCLE', RECEIVING_COMPLETED: 'LIFECYCLE', RECEIVING_CANCELLED: 'LIFECYCLE',
  INSPECTION_REQUIRED: 'LIFECYCLE', INSPECTION_PASSED: 'LIFECYCLE', INSPECTION_FAILED: 'LIFECYCLE', INSPECTION_ROUTED_TO_RETURN: 'LIFECYCLE',
  RETIREMENT_WORKFLOW_INITIATED: 'LIFECYCLE', RETIREMENT_DATA_WIPE_COMPLETED: 'LIFECYCLE',
  RETIREMENT_TASK_UPDATED: 'LIFECYCLE', RETIREMENT_WORKFLOW_CANCELLED: 'LIFECYCLE',
  CMDB_RELATIONSHIP_CREATED: 'LIFECYCLE', DISCOVERY_CORRELATED: 'LIFECYCLE', DISCOVERY_AUTO_CORRELATED: 'LIFECYCLE', DEPLOYMENT_CANCELLED: 'LIFECYCLE',
  // Integration events
  DISCOVERY_DATA_RECEIVED: 'INTEGRATION', ASN_RECEIVED: 'INTEGRATION', INTEGRATION_ERROR: 'INTEGRATION',
  // Admin events
  BUILDING_CREATED: 'ADMIN', BUILDING_UPDATED: 'ADMIN', BUILDING_DEACTIVATED: 'ADMIN',
  FLOOR_CREATED: 'ADMIN', FLOOR_UPDATED: 'ADMIN', FLOOR_DEACTIVATED: 'ADMIN',
  ROOM_CREATED: 'ADMIN', ROOM_UPDATED: 'ADMIN', ROOM_DEACTIVATED: 'ADMIN',
  RACK_CREATED: 'ADMIN', RACK_UPDATED: 'ADMIN', RACK_DEACTIVATED: 'ADMIN',
  BIN_LOCATION_CREATED: 'ADMIN', BIN_LOCATION_UPDATED: 'ADMIN',
  STOCKROOM_CREATED: 'ADMIN', STOCKROOM_UPDATED: 'ADMIN', STOCKROOM_DEACTIVATED: 'ADMIN',
  DEPARTMENT_CREATED: 'ADMIN', DEPARTMENT_UPDATED: 'ADMIN', DEPARTMENT_DEACTIVATED: 'ADMIN',
  COST_CENTER_CREATED: 'ADMIN', COST_CENTER_UPDATED: 'ADMIN',
  VENDOR_CREATED: 'ADMIN', VENDOR_UPDATED: 'ADMIN', VENDOR_RATING_CHANGED: 'ADMIN', VENDOR_DEACTIVATED: 'ADMIN',
  MANUFACTURER_CREATED: 'ADMIN', MANUFACTURER_UPDATED: 'ADMIN',
  MODEL_CREATED: 'ADMIN', MODEL_UPDATED: 'ADMIN', MODEL_END_OF_LIFE: 'ADMIN',
  // User Admin events
  USER_UPDATED: 'ADMIN', USER_DEACTIVATED: 'ADMIN', USER_REACTIVATED: 'ADMIN',
  USER_ROLE_ASSIGNED: 'ADMIN', USER_ROLE_REMOVED: 'ADMIN',
  // Report events
  REPORT_GENERATED: 'REPORT', REPORT_EXPORTED: 'REPORT',
};

/**
 * Get the category for an event type
 */
export function getEventCategory(eventType: EventType): EventCategory {
  return EVENT_CATEGORIES[eventType];
}

/**
 * Check if an event type is valid
 */
export function isValidEventType(eventType: string): eventType is EventType {
  return ALL_EVENT_TYPES.includes(eventType as EventType);
}

/**
 * Create a new event with common fields populated
 */
export function createEvent<T extends DomainEvent>(
  eventType: T['eventType'],
  payload: T['payload'],
  source: string,
  correlationId?: string
): T {
  return {
    eventId: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    version: '1.0',
    source,
    correlationId,
    payload,
  } as T;
}

/**
 * Extract metadata from an event for SNS message attributes
 */
export function extractEventMetadata(event: DomainEvent): EventMetadata {
  const metadata: EventMetadata = {
    eventType: event.eventType,
    source: event.source,
    eventId: event.eventId,
  };

  if ('assetType' in event.payload) {
    return { ...metadata, assetType: event.payload.assetType as AssetType };
  }

  return metadata;
}
