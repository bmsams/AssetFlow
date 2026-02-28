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
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
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
    readonly payload: {
        readonly deploymentId: UUID;
        readonly assetId: UUID;
        readonly previousUserId?: UUID;
        readonly newUserId: UUID;
        readonly reassignedBy: UUID;
    };
}
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
    readonly payload: {
        readonly runId: UUID;
        readonly startedAt: ISODateString;
        readonly completedAt: ISODateString;
        readonly productsProcessed: number;
    };
}
export interface ReclamationInitiatedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_INITIATED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly softwareProductId: UUID;
        readonly userId: UUID;
        readonly daysSinceLastUse: number;
    };
}
export interface ReclamationStatusChangedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_STATUS_CHANGED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly previousStatus: ReclamationStatus;
        readonly newStatus: ReclamationStatus;
        readonly changedBy: UUID;
    };
}
export interface ReclamationCandidateIdentifiedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_CANDIDATE_IDENTIFIED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly softwareProductId: UUID;
        readonly userId: UUID;
        readonly daysSinceLastUse: number;
    };
}
export interface ReclamationIdentificationCompletedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_IDENTIFICATION_COMPLETED';
    readonly payload: {
        readonly runId: UUID;
        readonly startedAt: ISODateString;
        readonly completedAt: ISODateString;
        readonly candidatesIdentified: number;
    };
}
export interface ReclamationWorkflowInitiatedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_WORKFLOW_INITIATED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly softwareProductId: UUID;
        readonly userId: UUID;
    };
}
export interface ReclamationUserNotificationEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_USER_NOTIFICATION';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly userId: UUID;
        readonly productName: string;
    };
}
export interface ReclamationManagerNotificationEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_MANAGER_NOTIFICATION';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly userId: UUID;
        readonly managerId: UUID;
        readonly productName: string;
    };
}
export interface ReclamationApprovedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_APPROVED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly approvedBy: UUID;
    };
}
export interface ReclamationRejectedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_REJECTED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly rejectedBy: UUID;
        readonly reason: string;
    };
}
export interface ReclamationCompletedEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_COMPLETED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly completedBy: UUID;
    };
}
export interface ReclamationCancelledEvent extends BaseEvent {
    readonly eventType: 'RECLAMATION_CANCELLED';
    readonly payload: {
        readonly candidateId: UUID;
        readonly installationId: UUID;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface ShadowITDetectedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_DETECTED';
    readonly payload: {
        readonly alertId: UUID;
        readonly applicationName: string;
        readonly applicationUrl?: string;
        readonly userId: UUID;
        readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        readonly accessCount: number;
    };
}
export interface ShadowITAlertCreatedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_ALERT_CREATED';
    readonly payload: {
        readonly alertId: UUID;
        readonly detectionId: UUID;
        readonly applicationName: string;
        readonly riskLevel: string;
    };
}
export interface ShadowITAnalysisCompletedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_ANALYSIS_COMPLETED';
    readonly payload: {
        readonly analysisId: UUID;
        readonly startedAt: ISODateString;
        readonly completedAt: ISODateString;
        readonly detectionsFound: number;
    };
}
export interface ShadowITStatusChangedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_STATUS_CHANGED';
    readonly payload: {
        readonly detectionId: UUID;
        readonly applicationName: string;
        readonly previousStatus: string;
        readonly newStatus: string;
        readonly changedBy: UUID;
    };
}
export interface ShadowITAlertAcknowledgedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_ALERT_ACKNOWLEDGED';
    readonly payload: {
        readonly alertId: UUID;
        readonly detectionId: UUID;
        readonly acknowledgedBy: UUID;
    };
}
export interface ShadowITAlertResolvedEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_ALERT_RESOLVED';
    readonly payload: {
        readonly alertId: UUID;
        readonly detectionId: UUID;
        readonly resolvedBy: UUID;
        readonly resolution: string;
    };
}
export interface ShadowITAlertIgnoredEvent extends BaseEvent {
    readonly eventType: 'SHADOW_IT_ALERT_IGNORED';
    readonly payload: {
        readonly alertId: UUID;
        readonly detectionId: UUID;
        readonly ignoredBy: UUID;
        readonly reason: string;
    };
}
export interface SaaSSubscriptionCreatedEvent extends BaseEvent {
    readonly eventType: 'SAAS_SUBSCRIPTION_CREATED';
    readonly payload: {
        readonly subscriptionId: UUID;
        readonly vendorName: string;
        readonly productName: string;
        readonly totalSeats: number;
    };
}
export interface SaaSSubscriptionUpdatedEvent extends BaseEvent {
    readonly eventType: 'SAAS_SUBSCRIPTION_UPDATED';
    readonly payload: {
        readonly subscriptionId: UUID;
        readonly updates: readonly string[];
    };
}
export interface SaaSUsageSyncedEvent extends BaseEvent {
    readonly eventType: 'SAAS_USAGE_SYNCED';
    readonly payload: {
        readonly syncId: UUID;
        readonly subscriptionId: UUID;
        readonly activeUsers: number;
        readonly totalSeats: number;
    };
}
export interface SaaSOptimizationOpportunitiesFoundEvent extends BaseEvent {
    readonly eventType: 'SAAS_OPTIMIZATION_OPPORTUNITIES_FOUND';
    readonly payload: {
        readonly subscriptionsWithUnusedSeats: number;
        readonly totalUnusedSeats: number;
        readonly totalPotentialSavings: number;
    };
}
export interface SaaSRenewalNotificationCreatedEvent extends BaseEvent {
    readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_CREATED';
    readonly payload: {
        readonly subscriptionId: UUID;
        readonly productName: string;
        readonly renewalDate: ISODateString;
        readonly daysUntilRenewal: number;
    };
}
export interface SaaSRenewalNotificationSentEvent extends BaseEvent {
    readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_SENT';
    readonly payload: {
        readonly notificationId: UUID;
        readonly subscriptionId: UUID;
        readonly sentTo: UUID;
    };
}
export interface SaaSRenewalNotificationAcknowledgedEvent extends BaseEvent {
    readonly eventType: 'SAAS_RENEWAL_NOTIFICATION_ACKNOWLEDGED';
    readonly payload: {
        readonly notificationId: UUID;
        readonly acknowledgedBy: UUID;
    };
}
export interface SaaSSubscriptionDeletedEvent extends BaseEvent {
    readonly eventType: 'SAAS_SUBSCRIPTION_DELETED';
    readonly payload: {
        readonly subscriptionId: UUID;
    };
}
export interface PublisherCalculationCompletedEvent extends BaseEvent {
    readonly eventType: 'PUBLISHER_CALCULATION_COMPLETED';
    readonly payload: {
        readonly productId: UUID;
        readonly publisher: string;
        readonly calculationType: string;
        readonly result: unknown;
    };
}
export interface ComplianceReportGeneratedEvent extends BaseEvent {
    readonly eventType: 'COMPLIANCE_REPORT_GENERATED';
    readonly payload: {
        readonly reportId: UUID;
        readonly reportType: string;
        readonly generatedBy: UUID;
    };
}
export interface ComplianceReportExportedEvent extends BaseEvent {
    readonly eventType: 'COMPLIANCE_REPORT_EXPORTED';
    readonly payload: {
        readonly reportId: UUID;
        readonly format: string;
        readonly exportedBy: UUID;
    };
}
export interface TransferOrderCreatedEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_CREATED';
    readonly payload: {
        readonly transferId: UUID;
        readonly fromStockroomId: UUID;
        readonly toStockroomId: UUID;
        readonly requestedBy: UUID;
        readonly assetCount: number;
    };
}
export interface TransferOrderCompletedEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_COMPLETED';
    readonly payload: {
        readonly transferId: UUID;
        readonly fromStockroomId: UUID;
        readonly toStockroomId: UUID;
        readonly completedBy: UUID;
        readonly assetCount: number;
    };
}
export interface TransferOrderApprovedEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_APPROVED';
    readonly payload: {
        readonly transferId: UUID;
        readonly transferNumber: string;
        readonly approvedBy: UUID;
    };
}
export interface TransferOrderRejectedEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_REJECTED';
    readonly payload: {
        readonly transferId: UUID;
        readonly transferNumber: string;
        readonly rejectedBy: UUID;
        readonly reason: string;
    };
}
export interface TransferOrderShippedEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_SHIPPED';
    readonly payload: {
        readonly transferId: UUID;
        readonly transferNumber: string;
        readonly shippedBy: UUID;
        readonly trackingNumber?: string;
    };
}
export interface TransferOrderCancelledEvent extends BaseEvent {
    readonly eventType: 'TRANSFER_ORDER_CANCELLED';
    readonly payload: {
        readonly transferId: UUID;
        readonly transferNumber: string;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface StockLevelAlertEvent extends BaseEvent {
    readonly eventType: 'STOCK_LEVEL_ALERT';
    readonly payload: {
        readonly stockroomId: UUID;
        readonly stockroomName: string;
        readonly productId: UUID;
        readonly productName: string;
        readonly currentQuantity: number;
        readonly reorderPoint: number;
        readonly reorderQuantity: number;
    };
}
export interface InventoryCreatedEvent extends BaseEvent {
    readonly eventType: 'INVENTORY_CREATED';
    readonly payload: {
        readonly inventoryId: UUID;
        readonly stockroomId: UUID;
        readonly productId: UUID;
        readonly quantity: number;
    };
}
export interface InventoryUpdatedEvent extends BaseEvent {
    readonly eventType: 'INVENTORY_UPDATED';
    readonly payload: {
        readonly inventoryId: UUID;
        readonly stockroomId: UUID;
        readonly productId: UUID;
        readonly previousQuantity: number;
        readonly newQuantity: number;
    };
}
export interface InventoryAdjustedEvent extends BaseEvent {
    readonly eventType: 'INVENTORY_ADJUSTED';
    readonly payload: {
        readonly inventoryId: UUID;
        readonly stockroomId: UUID;
        readonly adjustmentType: string;
        readonly quantity: number;
        readonly reason: string;
    };
}
export interface InventoryReservedEvent extends BaseEvent {
    readonly eventType: 'INVENTORY_RESERVED';
    readonly payload: {
        readonly inventoryId: UUID;
        readonly stockroomId: UUID;
        readonly quantity: number;
        readonly reservedFor: UUID;
    };
}
export interface InventoryReservationReleasedEvent extends BaseEvent {
    readonly eventType: 'INVENTORY_RESERVATION_RELEASED';
    readonly payload: {
        readonly inventoryId: UUID;
        readonly stockroomId: UUID;
        readonly quantity: number;
    };
}
export interface ReplenishmentAlertEvent extends BaseEvent {
    readonly eventType: 'REPLENISHMENT_ALERT';
    readonly payload: {
        readonly alertId: UUID;
        readonly alertType: string;
        readonly stockroomId: UUID;
        readonly productId: UUID;
        readonly currentQuantity: number;
        readonly reorderPoint: number;
    };
}
export interface LoanerCheckoutEvent extends BaseEvent {
    readonly eventType: 'LOANER_CHECKOUT';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly assetId: UUID;
        readonly checkedOutTo: UUID;
        readonly checkedOutBy: UUID;
        readonly dueDate: ISODateString;
    };
}
export interface LoanerReturnedEvent extends BaseEvent {
    readonly eventType: 'LOANER_RETURNED';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly assetId: UUID;
        readonly returnedBy: UUID;
        readonly condition: string;
        readonly wasOverdue: boolean;
    };
}
export interface LoanerOverdueEvent extends BaseEvent {
    readonly eventType: 'LOANER_OVERDUE';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly assetId: UUID;
        readonly checkedOutTo: UUID;
        readonly dueDate: ISODateString;
        readonly daysOverdue: number;
        readonly escalationLevel: number;
    };
}
export interface LoanerCheckedOutEvent extends BaseEvent {
    readonly eventType: 'LOANER_CHECKED_OUT';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly checkoutNumber: string;
        readonly assetId: UUID;
        readonly checkedOutTo: UUID;
        readonly checkedOutBy: UUID;
        readonly dueDate: ISODateString;
        readonly conditionOut: string;
    };
}
export interface LoanerOverdueNotificationEvent extends BaseEvent {
    readonly eventType: 'LOANER_OVERDUE_NOTIFICATION';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly assetId: UUID;
        readonly checkedOutTo: UUID;
        readonly dueDate: ISODateString;
        readonly daysOverdue: number;
        readonly escalationLevel: number;
        readonly notificationType: string;
    };
}
export interface LoanerDueDateExtendedEvent extends BaseEvent {
    readonly eventType: 'LOANER_DUE_DATE_EXTENDED';
    readonly payload: {
        readonly checkoutId: UUID;
        readonly assetId: UUID;
        readonly previousDueDate: ISODateString;
        readonly newDueDate: ISODateString;
        readonly extendedBy: UUID;
        readonly reason?: string;
    };
}
export interface AuditCompletedEvent extends BaseEvent {
    readonly eventType: 'AUDIT_COMPLETED';
    readonly payload: {
        readonly auditId: UUID;
        readonly stockroomId: UUID;
        readonly auditorId: UUID;
        readonly discrepancyCount: number;
        readonly assetsScanned: number;
        readonly assetsExpected: number;
    };
}
export interface AuditScanRecordedEvent extends BaseEvent {
    readonly eventType: 'AUDIT_SCAN_RECORDED';
    readonly payload: {
        readonly auditId: UUID;
        readonly scanId: UUID;
        readonly assetId?: UUID;
        readonly assetTag: string;
        readonly stockroomId: UUID;
        readonly scannedBy: UUID;
        readonly scanResult: 'FOUND' | 'NOT_FOUND' | 'UNEXPECTED';
    };
}
export interface DisposalCompletedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_COMPLETED';
    readonly payload: {
        readonly assetId: UUID;
        readonly assetTag: string;
        readonly disposalMethod: string;
        readonly destructionCertificateId?: UUID;
        readonly completedBy: UUID;
    };
}
export interface DisposalWorkflowInitiatedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_WORKFLOW_INITIATED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly assetId: UUID;
        readonly assetTag: string;
        readonly initiatedBy: UUID;
    };
}
export interface DisposalDestructionRecordedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_DESTRUCTION_RECORDED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly certificateId: UUID;
        readonly method: string;
    };
}
export interface DisposalDataWipeCompletedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_DATA_WIPE_COMPLETED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly wipeMethod: string;
        readonly completedBy: UUID;
    };
}
export interface DisposalEnvironmentalCheckCompletedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_ENVIRONMENTAL_CHECK_COMPLETED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly checkResult: string;
        readonly completedBy: UUID;
    };
}
export interface DisposalPickupScheduledEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_PICKUP_SCHEDULED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly pickupDate: ISODateString;
        readonly vendorId?: UUID;
    };
}
export interface DisposalTaskUpdatedEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_TASK_UPDATED';
    readonly payload: {
        readonly taskId: UUID;
        readonly workflowId: UUID;
        readonly taskType: string;
        readonly status: string;
        readonly updatedBy: UUID;
    };
}
export interface DisposalWorkflowCancelledEvent extends BaseEvent {
    readonly eventType: 'DISPOSAL_WORKFLOW_CANCELLED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface WorkOrderCreatedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_CREATED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly assetId: UUID;
        readonly workType: string;
        readonly priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        readonly assignedTo?: UUID;
        readonly scheduledDate?: ISODateString;
    };
}
export interface WorkOrderCompletedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_COMPLETED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly assetId: UUID;
        readonly completedBy: UUID;
        readonly completedDate: ISODateString;
        readonly partsUsed: number;
        readonly laborHours: number;
    };
}
export interface WorkOrderAssignedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_ASSIGNED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly workOrderNumber: string;
        readonly assignedTo: UUID;
        readonly assignedBy: UUID;
    };
}
export interface WorkOrderStatusChangedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_STATUS_CHANGED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly workOrderNumber: string;
        readonly previousStatus: string;
        readonly newStatus: string;
        readonly changedBy: UUID;
    };
}
export interface WorkOrderPartAddedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_PART_ADDED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly partId: UUID;
        readonly partNumber: string;
        readonly quantityRequired: number;
    };
}
export interface WorkOrderPartUsedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_PART_USED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly partId: UUID;
        readonly partNumber: string;
        readonly quantityUsed: number;
        readonly totalQuantityUsed: number;
        readonly totalCost: number | null;
    };
}
export interface WorkOrderPartRemovedEvent extends BaseEvent {
    readonly eventType: 'WORK_ORDER_PART_REMOVED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly partId: UUID;
    };
}
export interface MaintenanceDueEvent extends BaseEvent {
    readonly eventType: 'MAINTENANCE_DUE';
    readonly payload: {
        readonly maintenancePlanId: UUID;
        readonly assetId: UUID;
        readonly maintenanceType: string;
        readonly dueDate: ISODateString;
        readonly daysPastDue: number;
    };
}
export interface MaintenancePlanCreatedEvent extends BaseEvent {
    readonly eventType: 'MAINTENANCE_PLAN_CREATED';
    readonly payload: {
        readonly planId: UUID;
        readonly assetId: UUID;
        readonly planType: string;
        readonly frequency: string;
    };
}
export interface MaintenancePlanUpdatedEvent extends BaseEvent {
    readonly eventType: 'MAINTENANCE_PLAN_UPDATED';
    readonly payload: {
        readonly planId: UUID;
        readonly assetId: UUID;
        readonly updates: readonly string[];
    };
}
export interface MaintenancePlanDeactivatedEvent extends BaseEvent {
    readonly eventType: 'MAINTENANCE_PLAN_DEACTIVATED';
    readonly payload: {
        readonly planId: UUID;
        readonly assetId: UUID;
        readonly deactivatedBy: UUID;
    };
}
export interface LinearAssetCreatedEvent extends BaseEvent {
    readonly eventType: 'LINEAR_ASSET_CREATED';
    readonly payload: {
        readonly linearAssetId: UUID;
        readonly assetId: UUID;
        readonly totalLength: number;
        readonly unit: string;
    };
}
export interface LinearAssetUpdatedEvent extends BaseEvent {
    readonly eventType: 'LINEAR_ASSET_UPDATED';
    readonly payload: {
        readonly linearAssetId: UUID;
        readonly assetId: UUID;
        readonly updates: readonly string[];
    };
}
export interface LinearAssetDeletedEvent extends BaseEvent {
    readonly eventType: 'LINEAR_ASSET_DELETED';
    readonly payload: {
        readonly linearAssetId: UUID;
        readonly assetId: UUID;
        readonly deletedBy: UUID;
    };
}
export interface SegmentCreatedEvent extends BaseEvent {
    readonly eventType: 'SEGMENT_CREATED';
    readonly payload: {
        readonly segmentId: UUID;
        readonly linearAssetId: UUID;
        readonly startPoint: number;
        readonly endPoint: number;
    };
}
export interface SegmentUpdatedEvent extends BaseEvent {
    readonly eventType: 'SEGMENT_UPDATED';
    readonly payload: {
        readonly segmentId: UUID;
        readonly linearAssetId: UUID;
        readonly updates: readonly string[];
    };
}
export interface SegmentDeletedEvent extends BaseEvent {
    readonly eventType: 'SEGMENT_DELETED';
    readonly payload: {
        readonly segmentId: UUID;
        readonly linearAssetId: UUID;
        readonly deletedBy: UUID;
    };
}
export interface AssetHierarchyLinkedEvent extends BaseEvent {
    readonly eventType: 'ASSET_HIERARCHY_LINKED';
    readonly payload: {
        readonly parentAssetId: UUID;
        readonly childAssetId: UUID;
        readonly linkedBy: UUID;
    };
}
export interface AssetHierarchyUnlinkedEvent extends BaseEvent {
    readonly eventType: 'ASSET_HIERARCHY_UNLINKED';
    readonly payload: {
        readonly previousParentId: UUID;
        readonly childAssetId: UUID;
        readonly unlinkedBy: UUID;
    };
}
export interface AssetStatusPropagatedEvent extends BaseEvent {
    readonly eventType: 'ASSET_STATUS_PROPAGATED';
    readonly payload: {
        readonly parentAssetId: UUID;
        readonly newStatus: AssetStatus;
        readonly affectedChildren: number;
    };
}
export interface PartsReservedEvent extends BaseEvent {
    readonly eventType: 'PARTS_RESERVED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly reservationId: UUID;
        readonly parts: readonly {
            partId: UUID;
            quantity: number;
        }[];
    };
}
export interface PartsReplenishmentNeededEvent extends BaseEvent {
    readonly eventType: 'PARTS_REPLENISHMENT_NEEDED';
    readonly payload: {
        readonly alertCount: number;
        readonly criticalCount: number;
        readonly parts: readonly {
            partId: UUID;
            partNumber: string;
            currentQuantity: number;
        }[];
    };
}
export interface PartsConsumedEvent extends BaseEvent {
    readonly eventType: 'PARTS_CONSUMED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly partsConsumed: readonly {
            partId: UUID;
            quantity: number;
        }[];
    };
}
export interface PartsReservationCancelledEvent extends BaseEvent {
    readonly eventType: 'PARTS_RESERVATION_CANCELLED';
    readonly payload: {
        readonly workOrderId: UUID;
        readonly partId: UUID | null;
        readonly cancelledBy: UUID;
    };
}
export interface PartQuantityAdjustedEvent extends BaseEvent {
    readonly eventType: 'PART_QUANTITY_ADJUSTED';
    readonly payload: {
        readonly partId: UUID;
        readonly partNumber: string;
        readonly previousQuantity: number;
        readonly newQuantity: number;
        readonly adjustmentType: string;
        readonly reason: string;
    };
}
export interface PartBelowReorderPointEvent extends BaseEvent {
    readonly eventType: 'PART_BELOW_REORDER_POINT';
    readonly payload: {
        readonly partId: UUID;
        readonly partNumber: string;
        readonly currentQuantity: number;
        readonly reorderPoint: number;
    };
}
export interface PartStockReceivedEvent extends BaseEvent {
    readonly eventType: 'PART_STOCK_RECEIVED';
    readonly payload: {
        readonly partId: UUID;
        readonly partNumber: string;
        readonly quantityReceived: number;
        readonly newTotalQuantity: number;
    };
}
export interface ContractExpiringEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_EXPIRING';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly contractType: string;
        readonly vendorId: UUID;
        readonly vendorName: string;
        readonly expirationDate: ISODateString;
        readonly daysUntilExpiration: number;
        readonly totalValue: number;
    };
}
export interface ContractRenewedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_RENEWED';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly vendorId: UUID;
        readonly previousEndDate: ISODateString;
        readonly newEndDate: ISODateString;
        readonly renewedBy: UUID;
    };
}
export interface ContractCreatedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_CREATED';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly contractType: string;
        readonly vendorId: UUID;
        readonly createdBy: UUID;
    };
}
export interface ContractUpdatedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_UPDATED';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly updates: readonly string[];
        readonly updatedBy: UUID;
    };
}
export interface ContractAssetLinkedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_ASSET_LINKED';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly assetId: UUID;
        readonly linkedBy: UUID;
    };
}
export interface ContractAssetUnlinkedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_ASSET_UNLINKED';
    readonly payload: {
        readonly contractId: UUID;
        readonly assetId: UUID;
        readonly unlinkedBy: UUID;
    };
}
export interface ContractEntitlementLinkedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_ENTITLEMENT_LINKED';
    readonly payload: {
        readonly contractId: UUID;
        readonly contractNumber: string;
        readonly entitlementId: UUID;
        readonly linkedBy: UUID;
    };
}
export interface ContractEntitlementUnlinkedEvent extends BaseEvent {
    readonly eventType: 'CONTRACT_ENTITLEMENT_UNLINKED';
    readonly payload: {
        readonly contractId: UUID;
        readonly entitlementId: UUID;
        readonly unlinkedBy: UUID;
    };
}
export interface PurchaseOrderCreatedEvent extends BaseEvent {
    readonly eventType: 'PURCHASE_ORDER_CREATED';
    readonly payload: {
        readonly purchaseOrderId: UUID;
        readonly poNumber: string;
        readonly vendorId: UUID;
        readonly requesterId: UUID;
        readonly totalAmount: number;
        readonly lineItemCount: number;
    };
}
export interface PurchaseOrderReceivedEvent extends BaseEvent {
    readonly eventType: 'PURCHASE_ORDER_RECEIVED';
    readonly payload: {
        readonly purchaseOrderId: UUID;
        readonly poNumber: string;
        readonly receivedBy: UUID;
        readonly assetsCreated: number;
        readonly isFullyReceived: boolean;
    };
}
export interface PurchaseOrderSubmittedEvent extends BaseEvent {
    readonly eventType: 'PURCHASE_ORDER_SUBMITTED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly submittedBy: UUID;
        readonly vendorId: UUID;
    };
}
export interface PurchaseOrderApprovedEvent extends BaseEvent {
    readonly eventType: 'PURCHASE_ORDER_APPROVED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly approvedBy: UUID;
    };
}
export interface PurchaseOrderRejectedEvent extends BaseEvent {
    readonly eventType: 'PO_REJECTED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly rejectedBy: UUID;
        readonly rejectionReason: string;
    };
}
export interface PurchaseOrderSentEvent extends BaseEvent {
    readonly eventType: 'PO_SENT';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly sentBy: UUID;
        readonly sentDate: ISODateString;
        readonly vendorId: UUID;
    };
}
export interface POLineAddedEvent extends BaseEvent {
    readonly eventType: 'PO_LINE_ADDED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly lineId: UUID;
        readonly lineNumber: number;
        readonly productDescription: string;
        readonly quantity: number;
        readonly unitPrice: number;
        readonly addedBy: UUID;
    };
}
export interface POLineRemovedEvent extends BaseEvent {
    readonly eventType: 'PO_LINE_REMOVED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly lineId: UUID;
        readonly lineNumber: number;
        readonly removedBy: UUID;
    };
}
export interface POLineUpdatedEvent extends BaseEvent {
    readonly eventType: 'PO_LINE_UPDATED';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly lineId: UUID;
        readonly lineNumber: number;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface ApprovalReminderSentEvent extends BaseEvent {
    readonly eventType: 'APPROVAL_REMINDER_SENT';
    readonly payload: {
        readonly poId: UUID;
        readonly poNumber: string;
        readonly approverId: UUID;
        readonly reminderCount: number;
        readonly daysPending: number;
    };
}
export interface ProcurementProcessedEvent extends BaseEvent {
    readonly eventType: 'PROCUREMENT_PROCESSED';
    readonly payload: {
        readonly requestId: UUID;
        readonly fulfilledFromStock: number;
        readonly purchaseOrdersCreated: number;
    };
}
export interface ReservationReleasedEvent extends BaseEvent {
    readonly eventType: 'RESERVATION_RELEASED';
    readonly payload: {
        readonly reservationId: UUID;
        readonly inventoryId: UUID;
        readonly releasedBy: UUID;
    };
}
export interface ReservationFulfilledEvent extends BaseEvent {
    readonly eventType: 'RESERVATION_FULFILLED';
    readonly payload: {
        readonly reservationId: UUID;
        readonly inventoryId: UUID;
        readonly assetId: UUID;
    };
}
export interface RequestSubmittedEvent extends BaseEvent {
    readonly eventType: 'REQUEST_SUBMITTED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requesterId: UUID;
        readonly itemCount: number;
        readonly totalCost: number;
        readonly requiresApproval: boolean;
    };
}
export interface RequestApprovedEvent extends BaseEvent {
    readonly eventType: 'REQUEST_APPROVED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requesterId: UUID;
        readonly approvedBy: UUID;
        readonly approvalLevel: number;
        readonly isFinalApproval: boolean;
    };
}
export interface RequestRejectedEvent extends BaseEvent {
    readonly eventType: 'REQUEST_REJECTED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requesterId: UUID;
        readonly rejectedBy: UUID;
        readonly reason: string;
    };
}
export interface RequestFulfilledEvent extends BaseEvent {
    readonly eventType: 'REQUEST_FULFILLED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requesterId: UUID;
        readonly fulfilledBy: UUID;
        readonly assetsAssigned: readonly UUID[];
    };
}
export interface RequestCancelledEvent extends BaseEvent {
    readonly eventType: 'REQUEST_CANCELLED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requestNumber: string;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface ApprovalWorkflowInitiatedEvent extends BaseEvent {
    readonly eventType: 'APPROVAL_WORKFLOW_INITIATED';
    readonly payload: {
        readonly requestId: UUID;
        readonly requestNumber: string;
        readonly workflowId: UUID;
        readonly requiredApprovals: number;
    };
}
export interface ApprovalRequiredEvent extends BaseEvent {
    readonly eventType: 'APPROVAL_REQUIRED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly requestId: UUID;
        readonly stepNumber: number;
        readonly approverId: UUID;
    };
}
export interface ApprovalStepCompletedEvent extends BaseEvent {
    readonly eventType: 'APPROVAL_STEP_COMPLETED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly requestId: UUID;
        readonly stepNumber: number;
        readonly decision: 'APPROVED' | 'REJECTED';
        readonly decidedBy: UUID;
    };
}
export interface ApprovalDelegatedEvent extends BaseEvent {
    readonly eventType: 'APPROVAL_DELEGATED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly requestId: UUID;
        readonly fromApproverId: UUID;
        readonly toApproverId: UUID;
        readonly reason: string;
    };
}
export interface ReceivingStartedEvent extends BaseEvent {
    readonly eventType: 'RECEIVING_STARTED';
    readonly payload: {
        readonly receivingId: UUID;
        readonly poId: UUID | null;
        readonly startedBy: UUID;
    };
}
export interface ReceivingProgressEvent extends BaseEvent {
    readonly eventType: 'RECEIVING_PROGRESS';
    readonly payload: {
        readonly receivingId: UUID;
        readonly poId: UUID | null;
        readonly assetsReceived: number;
        readonly totalExpected: number;
    };
}
export interface ReceivingCompletedEvent extends BaseEvent {
    readonly eventType: 'RECEIVING_COMPLETED';
    readonly payload: {
        readonly receivingId: UUID;
        readonly poId: UUID | null;
        readonly assetsCreated: number;
        readonly completedBy: UUID;
    };
}
export interface ReceivingCancelledEvent extends BaseEvent {
    readonly eventType: 'RECEIVING_CANCELLED';
    readonly payload: {
        readonly receivingId: UUID;
        readonly poId: UUID | null;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface InspectionRequiredEvent extends BaseEvent {
    readonly eventType: 'INSPECTION_REQUIRED';
    readonly payload: {
        readonly inspectionId: UUID;
        readonly receivingLineId: UUID;
        readonly receivingId: UUID;
        readonly assetId: UUID | null;
        readonly serialNumber: string | null;
        readonly markedBy: UUID;
        readonly markedByName?: string;
    };
}
export interface InspectionPassedEvent extends BaseEvent {
    readonly eventType: 'INSPECTION_PASSED';
    readonly payload: {
        readonly inspectionId: UUID;
        readonly receivingLineId: UUID;
        readonly receivingId: UUID;
        readonly assetId: UUID | null;
        readonly serialNumber: string | null;
        readonly inspectedBy: UUID;
        readonly inspectedByName?: string;
    };
}
export interface InspectionFailedEvent extends BaseEvent {
    readonly eventType: 'INSPECTION_FAILED';
    readonly payload: {
        readonly inspectionId: UUID;
        readonly receivingLineId: UUID;
        readonly receivingId: UUID;
        readonly assetId: UUID | null;
        readonly serialNumber: string | null;
        readonly inspectedBy: UUID;
        readonly inspectedByName?: string;
        readonly failureReason?: string;
        readonly routedToReturn: boolean;
    };
}
export interface InspectionRoutedToReturnEvent extends BaseEvent {
    readonly eventType: 'INSPECTION_ROUTED_TO_RETURN';
    readonly payload: {
        readonly inspectionId: UUID;
        readonly returnOrderId: UUID;
        readonly routedBy: UUID;
        readonly assetId: UUID | null;
        readonly serialNumber: string | null;
        readonly failureReason: string | null;
    };
}
export interface RetirementWorkflowInitiatedEvent extends BaseEvent {
    readonly eventType: 'RETIREMENT_WORKFLOW_INITIATED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly assetId: UUID;
        readonly assetTag: string;
        readonly initiatedBy: UUID;
    };
}
export interface RetirementDataWipeCompletedEvent extends BaseEvent {
    readonly eventType: 'RETIREMENT_DATA_WIPE_COMPLETED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly wipeMethod: string;
        readonly completedBy: UUID;
    };
}
export interface RetirementTaskUpdatedEvent extends BaseEvent {
    readonly eventType: 'RETIREMENT_TASK_UPDATED';
    readonly payload: {
        readonly taskId: UUID;
        readonly workflowId: UUID;
        readonly taskType: string;
        readonly status: string;
        readonly updatedBy: UUID;
    };
}
export interface RetirementWorkflowCancelledEvent extends BaseEvent {
    readonly eventType: 'RETIREMENT_WORKFLOW_CANCELLED';
    readonly payload: {
        readonly workflowId: UUID;
        readonly workflowNumber: string;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface CMDBRelationshipCreatedEvent extends BaseEvent {
    readonly eventType: 'CMDB_RELATIONSHIP_CREATED';
    readonly payload: {
        readonly relationshipId: UUID;
        readonly deploymentId: UUID;
        readonly sourceAssetId: UUID;
        readonly targetAssetId: UUID;
        readonly relationshipType: string;
    };
}
export interface DiscoveryCorrelatedEvent extends BaseEvent {
    readonly eventType: 'DISCOVERY_CORRELATED';
    readonly payload: {
        readonly correlationId: UUID;
        readonly assetId: UUID;
        readonly discoveryRecordId: UUID;
        readonly matchType: string;
    };
}
export interface DiscoveryAutoCorrelatedEvent extends BaseEvent {
    readonly eventType: 'DISCOVERY_AUTO_CORRELATED';
    readonly payload: {
        readonly correlationId: UUID;
        readonly assetId: UUID;
        readonly discoveryRecordId: UUID;
        readonly matchField: string;
        readonly confidence: number;
    };
}
export interface DeploymentCancelledEvent extends BaseEvent {
    readonly eventType: 'DEPLOYMENT_CANCELLED';
    readonly payload: {
        readonly deploymentId: UUID;
        readonly assetId: UUID;
        readonly cancelledBy: UUID;
        readonly reason: string;
    };
}
export interface DiscoveryDataReceivedEvent extends BaseEvent {
    readonly eventType: 'DISCOVERY_DATA_RECEIVED';
    readonly payload: {
        readonly sourceId: UUID;
        readonly sourceName: string;
        readonly sourceType: 'SCCM' | 'JAMF' | 'TANIUM' | 'CUSTOM';
        readonly recordCount: number;
        readonly newAssetsCreated: number;
        readonly existingAssetsUpdated: number;
    };
}
export interface ASNReceivedEvent extends BaseEvent {
    readonly eventType: 'ASN_RECEIVED';
    readonly payload: {
        readonly asnId: UUID;
        readonly vendorId: UUID;
        readonly vendorName: string;
        readonly purchaseOrderId?: UUID;
        readonly expectedDeliveryDate: ISODateString;
        readonly itemCount: number;
    };
}
export interface IntegrationErrorEvent extends BaseEvent {
    readonly eventType: 'INTEGRATION_ERROR';
    readonly payload: {
        readonly integrationId: UUID;
        readonly integrationType: string;
        readonly errorCode: string;
        readonly errorMessage: string;
        readonly retryCount: number;
        readonly willRetry: boolean;
    };
}
export interface BuildingCreatedEvent extends BaseEvent {
    readonly eventType: 'BUILDING_CREATED';
    readonly payload: {
        readonly buildingId: UUID;
        readonly buildingCode: string;
        readonly name: string;
        readonly createdBy: UUID;
    };
}
export interface BuildingUpdatedEvent extends BaseEvent {
    readonly eventType: 'BUILDING_UPDATED';
    readonly payload: {
        readonly buildingId: UUID;
        readonly buildingCode: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface BuildingDeactivatedEvent extends BaseEvent {
    readonly eventType: 'BUILDING_DEACTIVATED';
    readonly payload: {
        readonly buildingId: UUID;
        readonly buildingCode: string;
        readonly deactivatedBy: UUID;
    };
}
export interface FloorCreatedEvent extends BaseEvent {
    readonly eventType: 'FLOOR_CREATED';
    readonly payload: {
        readonly floorId: UUID;
        readonly buildingId: UUID;
        readonly floorNumber: number;
        readonly name: string;
        readonly createdBy: UUID;
    };
}
export interface FloorUpdatedEvent extends BaseEvent {
    readonly eventType: 'FLOOR_UPDATED';
    readonly payload: {
        readonly floorId: UUID;
        readonly buildingId: UUID;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface FloorDeactivatedEvent extends BaseEvent {
    readonly eventType: 'FLOOR_DEACTIVATED';
    readonly payload: {
        readonly floorId: UUID;
        readonly buildingId: UUID;
        readonly deactivatedBy: UUID;
    };
}
export interface RoomCreatedEvent extends BaseEvent {
    readonly eventType: 'ROOM_CREATED';
    readonly payload: {
        readonly roomId: UUID;
        readonly floorId: UUID;
        readonly roomNumber: string;
        readonly name: string;
        readonly roomType: string;
        readonly createdBy: UUID;
    };
}
export interface RoomUpdatedEvent extends BaseEvent {
    readonly eventType: 'ROOM_UPDATED';
    readonly payload: {
        readonly roomId: UUID;
        readonly floorId: UUID;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface RoomDeactivatedEvent extends BaseEvent {
    readonly eventType: 'ROOM_DEACTIVATED';
    readonly payload: {
        readonly roomId: UUID;
        readonly floorId: UUID;
        readonly deactivatedBy: UUID;
    };
}
export interface RackCreatedEvent extends BaseEvent {
    readonly eventType: 'RACK_CREATED';
    readonly payload: {
        readonly rackId: UUID;
        readonly roomId: UUID;
        readonly rackName: string;
        readonly totalUnits: number;
        readonly createdBy: UUID;
    };
}
export interface RackUpdatedEvent extends BaseEvent {
    readonly eventType: 'RACK_UPDATED';
    readonly payload: {
        readonly rackId: UUID;
        readonly roomId: UUID;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface RackDeactivatedEvent extends BaseEvent {
    readonly eventType: 'RACK_DEACTIVATED';
    readonly payload: {
        readonly rackId: UUID;
        readonly roomId: UUID;
        readonly deactivatedBy: UUID;
    };
}
export interface BinLocationCreatedEvent extends BaseEvent {
    readonly eventType: 'BIN_LOCATION_CREATED';
    readonly payload: {
        readonly binId: UUID;
        readonly stockroomId: UUID;
        readonly binCode: string;
        readonly createdBy: UUID;
    };
}
export interface BinLocationUpdatedEvent extends BaseEvent {
    readonly eventType: 'BIN_LOCATION_UPDATED';
    readonly payload: {
        readonly binId: UUID;
        readonly stockroomId: UUID;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface StockroomCreatedEvent extends BaseEvent {
    readonly eventType: 'STOCKROOM_CREATED';
    readonly payload: {
        readonly stockroomId: UUID;
        readonly stockroomCode: string;
        readonly name: string;
        readonly stockroomType: string;
        readonly createdBy: UUID;
    };
}
export interface StockroomUpdatedEvent extends BaseEvent {
    readonly eventType: 'STOCKROOM_UPDATED';
    readonly payload: {
        readonly stockroomId: UUID;
        readonly stockroomCode: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface StockroomDeactivatedEvent extends BaseEvent {
    readonly eventType: 'STOCKROOM_DEACTIVATED';
    readonly payload: {
        readonly stockroomId: UUID;
        readonly stockroomCode: string;
        readonly deactivatedBy: UUID;
    };
}
export interface DepartmentCreatedEvent extends BaseEvent {
    readonly eventType: 'DEPARTMENT_CREATED';
    readonly payload: {
        readonly departmentId: UUID;
        readonly code: string;
        readonly name: string;
        readonly parentDepartmentId: UUID | null;
        readonly createdBy: UUID;
    };
}
export interface DepartmentUpdatedEvent extends BaseEvent {
    readonly eventType: 'DEPARTMENT_UPDATED';
    readonly payload: {
        readonly departmentId: UUID;
        readonly code: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface DepartmentDeactivatedEvent extends BaseEvent {
    readonly eventType: 'DEPARTMENT_DEACTIVATED';
    readonly payload: {
        readonly departmentId: UUID;
        readonly code: string;
        readonly cascadedChildren: number;
        readonly deactivatedBy: UUID;
    };
}
export interface CostCenterCreatedEvent extends BaseEvent {
    readonly eventType: 'COST_CENTER_CREATED';
    readonly payload: {
        readonly costCenterId: UUID;
        readonly code: string;
        readonly name: string;
        readonly budgetAmount: number;
        readonly createdBy: UUID;
    };
}
export interface CostCenterUpdatedEvent extends BaseEvent {
    readonly eventType: 'COST_CENTER_UPDATED';
    readonly payload: {
        readonly costCenterId: UUID;
        readonly code: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface VendorCreatedEvent extends BaseEvent {
    readonly eventType: 'VENDOR_CREATED';
    readonly payload: {
        readonly vendorId: UUID;
        readonly vendorCode: string | null;
        readonly vendorName: string;
        readonly createdBy: UUID;
    };
}
export interface VendorUpdatedEvent extends BaseEvent {
    readonly eventType: 'VENDOR_UPDATED';
    readonly payload: {
        readonly vendorId: UUID;
        readonly vendorName: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface VendorRatingChangedEvent extends BaseEvent {
    readonly eventType: 'VENDOR_RATING_CHANGED';
    readonly payload: {
        readonly vendorId: UUID;
        readonly vendorName: string;
        readonly previousRating: string | null;
        readonly newRating: string;
        readonly changedBy: UUID;
    };
}
export interface VendorDeactivatedEvent extends BaseEvent {
    readonly eventType: 'VENDOR_DEACTIVATED';
    readonly payload: {
        readonly vendorId: UUID;
        readonly vendorName: string;
        readonly deactivatedBy: UUID;
    };
}
export interface ManufacturerCreatedEvent extends BaseEvent {
    readonly eventType: 'MANUFACTURER_CREATED';
    readonly payload: {
        readonly manufacturerId: UUID;
        readonly name: string;
        readonly createdBy: UUID;
    };
}
export interface ManufacturerUpdatedEvent extends BaseEvent {
    readonly eventType: 'MANUFACTURER_UPDATED';
    readonly payload: {
        readonly manufacturerId: UUID;
        readonly name: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface ModelCreatedEvent extends BaseEvent {
    readonly eventType: 'MODEL_CREATED';
    readonly payload: {
        readonly modelId: UUID;
        readonly manufacturerId: UUID;
        readonly modelName: string;
        readonly createdBy: UUID;
    };
}
export interface ModelUpdatedEvent extends BaseEvent {
    readonly eventType: 'MODEL_UPDATED';
    readonly payload: {
        readonly modelId: UUID;
        readonly manufacturerId: UUID;
        readonly modelName: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: UUID;
    };
}
export interface ModelEndOfLifeEvent extends BaseEvent {
    readonly eventType: 'MODEL_END_OF_LIFE';
    readonly payload: {
        readonly modelId: UUID;
        readonly manufacturerId: UUID;
        readonly modelName: string;
        readonly previousStatus: string;
        readonly markedBy: UUID;
    };
}
export interface UserUpdatedEvent extends BaseEvent {
    readonly eventType: 'USER_UPDATED';
    readonly payload: {
        readonly userId: UUID;
        readonly email: string;
        readonly changes: readonly {
            readonly field: string;
            readonly oldValue: unknown;
            readonly newValue: unknown;
        }[];
        readonly updatedBy: string;
    };
}
export interface UserDeactivatedEvent extends BaseEvent {
    readonly eventType: 'USER_DEACTIVATED';
    readonly payload: {
        readonly userId: UUID;
        readonly email: string;
        readonly deactivatedBy: string;
    };
}
export interface UserReactivatedEvent extends BaseEvent {
    readonly eventType: 'USER_REACTIVATED';
    readonly payload: {
        readonly userId: UUID;
        readonly email: string;
        readonly reactivatedBy: string;
    };
}
export interface UserRoleAssignedEvent extends BaseEvent {
    readonly eventType: 'USER_ROLE_ASSIGNED';
    readonly payload: {
        readonly userId: UUID;
        readonly roleId: UUID;
        readonly roleName: string;
        readonly assignedBy: string;
    };
}
export interface UserRoleRemovedEvent extends BaseEvent {
    readonly eventType: 'USER_ROLE_REMOVED';
    readonly payload: {
        readonly userId: UUID;
        readonly roleId: UUID;
        readonly roleName: string;
        readonly removedBy: string;
    };
}
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
/**
 * Union type of all domain events
 */
export type DomainEvent = AssetCreatedEvent | AssetUpdatedEvent | AssetDeletedEvent | AssetStateChangedEvent | AssetAssignedEvent | AssetDeployedEvent | AssetRetiredEvent | AssetReassignedEvent | ReconciliationCompletedEvent | ReconciliationRunCompletedEvent | ReclamationInitiatedEvent | ReclamationStatusChangedEvent | ReclamationCandidateIdentifiedEvent | ReclamationIdentificationCompletedEvent | ReclamationWorkflowInitiatedEvent | ReclamationUserNotificationEvent | ReclamationManagerNotificationEvent | ReclamationApprovedEvent | ReclamationRejectedEvent | ReclamationCompletedEvent | ReclamationCancelledEvent | ShadowITDetectedEvent | ShadowITAlertCreatedEvent | ShadowITAnalysisCompletedEvent | ShadowITStatusChangedEvent | ShadowITAlertAcknowledgedEvent | ShadowITAlertResolvedEvent | ShadowITAlertIgnoredEvent | SaaSSubscriptionCreatedEvent | SaaSSubscriptionUpdatedEvent | SaaSUsageSyncedEvent | SaaSOptimizationOpportunitiesFoundEvent | SaaSRenewalNotificationCreatedEvent | SaaSRenewalNotificationSentEvent | SaaSRenewalNotificationAcknowledgedEvent | SaaSSubscriptionDeletedEvent | PublisherCalculationCompletedEvent | ComplianceReportGeneratedEvent | ComplianceReportExportedEvent | TransferOrderCreatedEvent | TransferOrderCompletedEvent | TransferOrderApprovedEvent | TransferOrderRejectedEvent | TransferOrderShippedEvent | TransferOrderCancelledEvent | StockLevelAlertEvent | InventoryCreatedEvent | InventoryUpdatedEvent | InventoryAdjustedEvent | InventoryReservedEvent | InventoryReservationReleasedEvent | ReplenishmentAlertEvent | LoanerCheckoutEvent | LoanerReturnedEvent | LoanerOverdueEvent | LoanerCheckedOutEvent | LoanerOverdueNotificationEvent | LoanerDueDateExtendedEvent | AuditCompletedEvent | AuditScanRecordedEvent | DisposalCompletedEvent | DisposalWorkflowInitiatedEvent | DisposalDestructionRecordedEvent | DisposalDataWipeCompletedEvent | DisposalEnvironmentalCheckCompletedEvent | DisposalPickupScheduledEvent | DisposalTaskUpdatedEvent | DisposalWorkflowCancelledEvent | WorkOrderCreatedEvent | WorkOrderCompletedEvent | WorkOrderAssignedEvent | WorkOrderStatusChangedEvent | WorkOrderPartAddedEvent | WorkOrderPartUsedEvent | WorkOrderPartRemovedEvent | MaintenanceDueEvent | MaintenancePlanCreatedEvent | MaintenancePlanUpdatedEvent | MaintenancePlanDeactivatedEvent | LinearAssetCreatedEvent | LinearAssetUpdatedEvent | LinearAssetDeletedEvent | SegmentCreatedEvent | SegmentUpdatedEvent | SegmentDeletedEvent | AssetHierarchyLinkedEvent | AssetHierarchyUnlinkedEvent | AssetStatusPropagatedEvent | PartsReservedEvent | PartsReplenishmentNeededEvent | PartsConsumedEvent | PartsReservationCancelledEvent | PartQuantityAdjustedEvent | PartBelowReorderPointEvent | PartStockReceivedEvent | ContractExpiringEvent | ContractRenewedEvent | ContractCreatedEvent | ContractUpdatedEvent | ContractAssetLinkedEvent | ContractAssetUnlinkedEvent | ContractEntitlementLinkedEvent | ContractEntitlementUnlinkedEvent | PurchaseOrderCreatedEvent | PurchaseOrderReceivedEvent | PurchaseOrderSubmittedEvent | PurchaseOrderApprovedEvent | PurchaseOrderRejectedEvent | PurchaseOrderSentEvent | POLineAddedEvent | POLineRemovedEvent | POLineUpdatedEvent | ApprovalReminderSentEvent | ProcurementProcessedEvent | ReservationReleasedEvent | ReservationFulfilledEvent | RequestSubmittedEvent | RequestApprovedEvent | RequestRejectedEvent | RequestFulfilledEvent | RequestCancelledEvent | ApprovalWorkflowInitiatedEvent | ApprovalRequiredEvent | ApprovalStepCompletedEvent | ApprovalDelegatedEvent | ReceivingStartedEvent | ReceivingProgressEvent | ReceivingCompletedEvent | ReceivingCancelledEvent | InspectionRequiredEvent | InspectionPassedEvent | InspectionFailedEvent | InspectionRoutedToReturnEvent | RetirementWorkflowInitiatedEvent | RetirementDataWipeCompletedEvent | RetirementTaskUpdatedEvent | RetirementWorkflowCancelledEvent | CMDBRelationshipCreatedEvent | DiscoveryCorrelatedEvent | DiscoveryAutoCorrelatedEvent | DeploymentCancelledEvent | DiscoveryDataReceivedEvent | ASNReceivedEvent | IntegrationErrorEvent | BuildingCreatedEvent | BuildingUpdatedEvent | BuildingDeactivatedEvent | FloorCreatedEvent | FloorUpdatedEvent | FloorDeactivatedEvent | RoomCreatedEvent | RoomUpdatedEvent | RoomDeactivatedEvent | RackCreatedEvent | RackUpdatedEvent | RackDeactivatedEvent | BinLocationCreatedEvent | BinLocationUpdatedEvent | StockroomCreatedEvent | StockroomUpdatedEvent | StockroomDeactivatedEvent | DepartmentCreatedEvent | DepartmentUpdatedEvent | DepartmentDeactivatedEvent | CostCenterCreatedEvent | CostCenterUpdatedEvent | VendorCreatedEvent | VendorUpdatedEvent | VendorRatingChangedEvent | VendorDeactivatedEvent | ManufacturerCreatedEvent | ManufacturerUpdatedEvent | ModelCreatedEvent | ModelUpdatedEvent | ModelEndOfLifeEvent | UserUpdatedEvent | UserDeactivatedEvent | UserReactivatedEvent | UserRoleAssignedEvent | UserRoleRemovedEvent | ReportGeneratedEvent | ReportExportedEvent;
/**
 * Event type discriminator - all valid event type strings
 */
export type EventType = DomainEvent['eventType'];
/**
 * All valid event types as an array for validation
 */
export declare const ALL_EVENT_TYPES: readonly EventType[];
/**
 * Event category for grouping and filtering
 */
export type EventCategory = 'ASSET' | 'SAM' | 'HAM' | 'EAM' | 'CONTRACT' | 'PROCUREMENT' | 'REQUEST' | 'LIFECYCLE' | 'INTEGRATION' | 'ADMIN' | 'REPORT';
/**
 * Map event types to their categories
 */
export declare const EVENT_CATEGORIES: Record<EventType, EventCategory>;
/**
 * Get the category for an event type
 */
export declare function getEventCategory(eventType: EventType): EventCategory;
/**
 * Check if an event type is valid
 */
export declare function isValidEventType(eventType: string): eventType is EventType;
/**
 * Create a new event with common fields populated
 */
export declare function createEvent<T extends DomainEvent>(eventType: T['eventType'], payload: T['payload'], source: string, correlationId?: string): T;
/**
 * Extract metadata from an event for SNS message attributes
 */
export declare function extractEventMetadata(event: DomainEvent): EventMetadata;
