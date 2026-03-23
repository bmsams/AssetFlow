/**
 * Asset types for the Asset Management System
 */

export type AssetType = 'HARDWARE' | 'SOFTWARE' | 'ENTERPRISE';

export const ASSET_TYPES = ['HARDWARE', 'SOFTWARE', 'ENTERPRISE'] as const;

export type AssetStatus =
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'DEPLOYED'
  | 'IN_MAINTENANCE'
  | 'RETIRED'
  | 'DISPOSED';

export const ASSET_STATUSES = [
  'ORDERED',
  'RECEIVED',
  'IN_STOCK',
  'RESERVED',
  'DEPLOYED',
  'IN_MAINTENANCE',
  'RETIRED',
  'DISPOSED',
] as const;

export interface Asset {
  assetId: string;
  assetTag: string;
  assetType: AssetType;
  displayName: string;
  description?: string;
  status: AssetStatus;
  substatus?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HardwareAsset extends Asset {
  assetType: 'HARDWARE';
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  modelCategory?: string;
  assignedTo?: string;
  departmentId?: string;
  costCenterId?: string;
  purchasePrice?: number;
  warrantyExpiration?: string;
  cpu?: string;
  memoryGb?: number;
  storageGb?: number;
  operatingSystem?: string;
  ipAddress?: string;
  macAddress?: string;
}

export interface SoftwareAsset extends Asset {
  assetType: 'SOFTWARE';
  publisher?: string;
  productName?: string;
  version?: string;
  edition?: string;
  licenseType?: string;
  isSaas?: boolean;
}

export interface EnterpriseAsset extends Asset {
  assetType: 'ENTERPRISE';
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  assetClass?: string;
  criticalityLevel?: string;
  facilityId?: string;
  operatingHours?: number;
  meterReading?: number;
}

export type AnyAsset = HardwareAsset | SoftwareAsset | EnterpriseAsset;

/**
 * Asset relationship types for CMDB
 * Implements Requirement 2.3: Asset relationships (parent-child, dependencies)
 */
export type RelationshipType =
  | 'PARENT_CHILD'
  | 'DEPENDENCY'
  | 'CONNECTED_TO'
  | 'INSTALLED_ON'
  | 'RUNS_ON'
  | 'LOCATION'
  | 'COMPONENT';

export const RELATIONSHIP_TYPES = [
  'PARENT_CHILD',
  'DEPENDENCY',
  'CONNECTED_TO',
  'INSTALLED_ON',
  'RUNS_ON',
  'LOCATION',
  'COMPONENT',
] as const;

export interface AssetRelationship {
  relationshipId: string;
  sourceAssetId: string;
  targetAssetId: string;
  relationType: RelationshipType;
  relationshipType?: RelationshipType;
  description?: string;
  createdAt: string;
  createdBy?: string;
}

export interface RelatedAsset {
  asset: Asset;
  relationship: AssetRelationship;
  direction: 'source' | 'target';
}

/**
 * Audit history entry for asset changes
 * Implements Requirement 2.5: Complete audit trail of all asset changes
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'RELATIONSHIP';

export interface AuditEntry {
  auditId: string;
  assetId: string;
  action: AuditAction;
  timestamp: string;
  userId: string;
  userName: string;
  fieldName?: string;
  previousValue?: string;
  newValue?: string;
  description: string;
}

/**
 * Asset attachment for documents and files
 */
export interface AssetAttachment {
  attachmentId: string;
  assetId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  description?: string;
  url: string;
}

/**
 * Extended asset detail with relationships, history, and attachments
 */
export interface AssetDetail extends Asset {
  relationships: RelatedAsset[];
  auditHistory: AuditEntry[];
  attachments: AssetAttachment[];
}

/**
 * Hardware asset detail with full attributes
 */
export interface HardwareAssetDetail extends HardwareAsset {
  relationships: RelatedAsset[];
  auditHistory: AuditEntry[];
  attachments: AssetAttachment[];
  // Additional hardware-specific details
  stockroomName?: string;
  assignedToName?: string;
  departmentName?: string;
  costCenterName?: string;
  vendorName?: string;
  leaseContractNumber?: string;
}

/**
 * Software asset detail with full attributes
 */
export interface SoftwareAssetDetail extends SoftwareAsset {
  relationships: RelatedAsset[];
  auditHistory: AuditEntry[];
  attachments: AssetAttachment[];
  // Additional software-specific details
  entitlementCount?: number;
  installationCount?: number;
  complianceStatus?: 'COMPLIANT' | 'OVER_LICENSED' | 'UNDER_LICENSED';
}

/**
 * Enterprise asset detail with full attributes
 */
export interface EnterpriseAssetDetail extends EnterpriseAsset {
  relationships: RelatedAsset[];
  auditHistory: AuditEntry[];
  attachments: AssetAttachment[];
  // Additional enterprise-specific details
  facilityName?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  maintenancePlanName?: string;
}

export type AnyAssetDetail = HardwareAssetDetail | SoftwareAssetDetail | EnterpriseAssetDetail;
