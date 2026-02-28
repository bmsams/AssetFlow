/**
 * Software Asset types for Software Asset Management (SAM)
 */

import type { BaseEntity, ISODateString, UUID } from './common';

/**
 * License metric types
 */
export type LicenseMetricType =
  | 'PER_USER'
  | 'PER_DEVICE'
  | 'PER_CORE'
  | 'PER_PROCESSOR'
  | 'SUBSCRIPTION'
  | 'SITE'
  | 'ENTERPRISE'
  | 'CONCURRENT';

/**
 * Compliance position
 */
export type CompliancePosition = 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';

/**
 * Reclamation status
 */
export type ReclamationStatus =
  | 'IDENTIFIED'
  | 'PENDING_NOTIFICATION'
  | 'USER_NOTIFIED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DEFERRED';

/**
 * Software product entity
 */
export interface SoftwareProduct extends BaseEntity {
  readonly productId: UUID;
  readonly publisher: string;
  readonly productName: string;
  readonly version?: string;
  readonly edition?: string;
  readonly productCategory?: string;
  readonly isSaas: boolean;
  readonly normalizationKey?: string;
}

/**
 * Software entitlement (license owned)
 */
export interface Entitlement extends BaseEntity {
  readonly entitlementId: UUID;
  readonly softwareProductId: UUID;
  readonly licenseType: string;
  readonly quantityPurchased: number;
  readonly quantityAvailable: number;
  readonly unitCost?: number;

  // Contract linkage
  readonly contractId?: UUID;
  readonly purchaseOrderId?: UUID;
  readonly startDate?: ISODateString;
  readonly endDate?: ISODateString;
  readonly renewalDate?: ISODateString;
  readonly maintenanceIncluded: boolean;

  // License metrics
  readonly metricType: LicenseMetricType;
  readonly metricValue?: number;
}

/**
 * Software installation (discovered/deployed software)
 */
export interface SoftwareInstallation extends BaseEntity {
  readonly installationId: UUID;
  readonly softwareProductId: UUID;
  readonly hardwareAssetId: UUID;
  readonly installedDate?: ISODateString;
  readonly lastUsedDate?: ISODateString;
  readonly usageMinutes30Day: number;

  // Discovery attributes
  readonly discoverySource?: string;
  readonly discoveryDate?: ISODateString;
  readonly installPath?: string;
  readonly versionDetected?: string;
}

/**
 * Reconciliation result
 */
export interface ReconciliationResult {
  readonly resultId: UUID;
  readonly softwareProductId: UUID;
  readonly entitlementsOwned: number;
  readonly installationsFound: number;
  readonly compliancePosition: CompliancePosition;
  readonly overUnderCount: number;
  readonly lastReconciledAt: ISODateString;
}

/**
 * SaaS subscription
 */
export interface SaaSSubscription extends BaseEntity {
  readonly subscriptionId: UUID;
  readonly softwareProductId: UUID;
  readonly vendorPortalId?: string;
  readonly totalLicenses: number;
  readonly assignedLicenses: number;
  readonly monthlyCost?: number;
  readonly renewalDate?: ISODateString;
  readonly lastSyncedAt?: ISODateString;
}

/**
 * Reclamation rule
 */
export interface ReclamationRule {
  readonly ruleId: UUID;
  readonly name: string;
  readonly description?: string;
  readonly inactivityThresholdDays: number;
  readonly softwareProductId?: UUID;
  readonly isActive: boolean;
}

/**
 * Reclamation candidate
 */
export interface ReclamationCandidate {
  readonly candidateId: UUID;
  readonly installationId: UUID;
  readonly daysSinceLastUse: number;
  readonly reclamationRuleId?: UUID;
  readonly status: ReclamationStatus;
  readonly workflowId?: UUID;
  readonly identifiedAt: ISODateString;
}

/**
 * License calculation result from publisher packs
 */
export interface LicenseCalculation {
  readonly productId: UUID;
  readonly publisher: string;
  readonly calculationMethod: string;
  readonly licensesRequired: number;
  readonly licensesOwned: number;
  readonly compliancePosition: CompliancePosition;
  readonly details: Record<string, unknown>;
}

/**
 * Shadow IT alert
 */
export interface ShadowITAlert {
  readonly alertId: UUID;
  readonly applicationName: string;
  readonly applicationUrl?: string;
  readonly userId: UUID;
  readonly detectedAt: ISODateString;
  readonly accessCount: number;
  readonly dataTransferBytes?: number;
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'IGNORED';
}

/**
 * SaaS usage data from vendor portal sync
 */
export interface SaaSUsageData {
  readonly subscriptionId: UUID;
  readonly syncedAt: ISODateString;
  readonly totalLicenses: number;
  readonly assignedLicenses: number;
  readonly activeLicenses: number;
  readonly inactiveLicenses: number;
  readonly userDetails: readonly SaaSUserUsage[];
}

/**
 * Individual SaaS user usage
 */
export interface SaaSUserUsage {
  readonly userId: string;
  readonly email: string;
  readonly lastLoginDate?: ISODateString;
  readonly loginCount30Day: number;
  readonly isActive: boolean;
}
