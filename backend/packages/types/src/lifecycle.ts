/**
 * Lifecycle Types
 *
 * Shared type definitions for lifecycle service.
 * Consolidates types from lifecycle-service local definitions.
 */

import type { ISODateString, UUID } from './common';

export type ReceivingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type InspectionResult = 'PASSED' | 'FAILED';
export type InspectionStatus = 'PENDING' | 'PASSED' | 'FAILED';

export interface LifecycleReceivingRecord {
  readonly receivingId: UUID;
  readonly poId: UUID | null;
  readonly poNumber: string | null;
  readonly status: ReceivingStatus;
  readonly receivedBy?: UUID;
  readonly receivedAt?: ISODateString;
  readonly stockroomId?: UUID;
  readonly notes?: string;
  readonly createdAt: ISODateString;
  readonly updatedAt: ISODateString;
}

export interface DeploymentRecord {
  readonly deploymentId: UUID;
  readonly assetId: UUID;
  readonly assignedTo?: UUID;
  readonly location?: string;
  readonly deployedAt: ISODateString;
  readonly deployedBy: UUID;
  readonly notes?: string;
}

export interface RetirementRecord {
  readonly retirementId: UUID;
  readonly assetId: UUID;
  readonly reason: string;
  readonly retiredAt: ISODateString;
  readonly retiredBy: UUID;
  readonly notes?: string;
}

export interface DisposalRecord {
  readonly disposalId: UUID;
  readonly assetId: UUID;
  readonly disposedAt: ISODateString;
  readonly disposedBy: UUID;
  readonly method?: string;
  readonly notes?: string;
}

export interface CatalogItem {
  readonly itemId: UUID;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly price: number;
  readonly availability: string;
}
