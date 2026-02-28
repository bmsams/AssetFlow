/**
 * Enterprise Asset types for Enterprise Asset Management (EAM)
 */

import type { Asset } from './asset';
import type { BaseEntity, ISODateString, UUID } from './common';

/**
 * Asset criticality levels
 */
export type CriticalityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Work order status
 */
export type WorkOrderStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Work order priority
 */
export type WorkOrderPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Maintenance type
 */
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'PREDICTIVE' | 'CONDITION_BASED';

/**
 * Enterprise asset entity
 */
export interface EnterpriseAsset extends Asset {
  readonly assetType: 'ENTERPRISE';
  readonly serialNumber?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly assetClass?: string;
  readonly criticalityLevel?: CriticalityLevel;

  // Location attributes
  readonly facilityId?: UUID;
  readonly building?: string;
  readonly floor?: string;
  readonly zone?: string;
  readonly gpsLatitude?: number;
  readonly gpsLongitude?: number;

  // Operational attributes
  readonly operatingHours: number;
  readonly meterReading?: number;
  readonly lastCalibrationDate?: ISODateString;
  readonly nextCalibrationDue?: ISODateString;
}

/**
 * Linear asset (pipes, cables, tracks)
 */
export interface LinearAsset {
  readonly linearAssetId: UUID;
  readonly assetId: UUID;
  readonly startLocation?: string;
  readonly endLocation?: string;
  readonly totalLength?: number;
  readonly segmentCount: number;
  readonly linearUnit: string;
}

/**
 * Linear asset segment
 */
export interface LinearAssetSegment {
  readonly segmentId: UUID;
  readonly linearAssetId: UUID;
  readonly sequenceNumber: number;
  readonly startMarker?: string;
  readonly endMarker?: string;
  readonly segmentLength?: number;
  readonly conditionRating?: string;
}

/**
 * Maintenance plan
 */
export interface MaintenancePlan extends BaseEntity {
  readonly planId: UUID;
  readonly assetId: UUID;
  readonly planName: string;
  readonly maintenanceType: MaintenanceType;
  readonly frequencyDays?: number;
  readonly frequencyHours?: number;
  readonly lastPerformedDate?: ISODateString;
  readonly nextDueDate?: ISODateString;
  readonly procedureDocumentId?: UUID;
  readonly isActive: boolean;

  // Additional DB columns (V004 migration)
  readonly description?: string;
  readonly estimatedDurationHours?: number;
  readonly estimatedCost?: number;
  readonly scheduleType?: string;
  readonly leadTimeDays?: number;
  readonly allowEarlyExecution?: boolean;
  readonly maxOverdueDays?: number;
  readonly defaultAssignedTo?: UUID;
  readonly requiredSkills?: readonly string[];
  readonly requiredCertifications?: readonly string[];
  readonly priority?: string;
  readonly executionCount?: number;
  readonly lastWorkOrderId?: UUID;
}

/**
 * Work order
 */
export interface WorkOrder extends BaseEntity {
  readonly workOrderId: UUID;
  readonly workOrderNumber: string;
  readonly assetId: UUID;
  readonly maintenancePlanId?: UUID;
  readonly workType: string;
  readonly priority: WorkOrderPriority;
  readonly status: WorkOrderStatus;
  readonly assignedTo?: UUID;
  readonly scheduledDate?: ISODateString;
  readonly completedDate?: ISODateString;
  readonly description?: string;
  readonly completionNotes?: string;

  // Additional DB columns (V004 migration)
  readonly title?: string;
  readonly instructions?: string;
  readonly requestedDate?: ISODateString;
  readonly dueDate?: ISODateString;
  readonly estimatedDurationHours?: number;
  readonly actualDurationHours?: number;
  readonly assignedBy?: UUID;
  readonly assignedDate?: ISODateString;
  readonly startedDate?: ISODateString;
  readonly failureCode?: string;
  readonly rootCause?: string;
  readonly correctiveAction?: string;
  readonly estimatedCost?: number;
  readonly actualLaborCost?: number;
  readonly actualPartsCost?: number;
  readonly actualTotalCost?: number;
  readonly workLocation?: string;
  readonly facilityId?: UUID;
  readonly requiresApproval?: boolean;
  readonly approvedBy?: UUID;
  readonly approvedDate?: ISODateString;
  readonly parentWorkOrderId?: UUID;
}

/**
 * Spare part
 */
export interface SparePart extends BaseEntity {
  readonly partId: UUID;
  readonly partNumber: string;
  readonly description?: string;
  readonly manufacturer?: string;
  readonly quantityOnHand: number;
  readonly reorderPoint: number;
  readonly unitCost?: number;
  readonly storageLocation?: string;
}

/**
 * Work order part requirement
 */
export interface WorkOrderPart {
  readonly id: UUID;
  readonly workOrderId: UUID;
  readonly partId: UUID;
  readonly quantityRequired: number;
  readonly quantityUsed: number;
  readonly reservedDate?: ISODateString;
}

/**
 * Part reservation for work orders
 */
export interface PartReservation {
  readonly reservationId: UUID;
  readonly workOrderId: UUID;
  readonly parts: readonly {
    readonly partId: UUID;
    readonly quantityReserved: number;
  }[];
  readonly reservedAt: ISODateString;
  readonly expiresAt?: ISODateString;
}

/**
 * Part replenishment alert
 */
export interface PartReplenishmentAlert {
  readonly alertId: UUID;
  readonly partId: UUID;
  readonly partNumber: string;
  readonly currentQuantity: number;
  readonly reorderPoint: number;
  readonly suggestedOrderQuantity: number;
  readonly createdAt: ISODateString;
}

/**
 * Facility entity
 */
export interface Facility {
  readonly facilityId: UUID;
  readonly name: string;
  readonly address?: string;
  readonly city?: string;
  readonly state?: string;
  readonly country?: string;
  readonly postalCode?: string;
  readonly gpsLatitude?: number;
  readonly gpsLongitude?: number;
  readonly isActive: boolean;
}

/**
 * Work order completion data
 */
export interface WorkOrderCompletion {
  readonly completedDate: ISODateString;
  readonly completionNotes?: string;
  readonly partsUsed?: readonly {
    readonly partId: UUID;
    readonly quantityUsed: number;
  }[];
  readonly laborHours?: number;
  readonly completedBy: UUID;
}
