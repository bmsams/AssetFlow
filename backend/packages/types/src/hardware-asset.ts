/**
 * Hardware Asset types for Hardware Asset Management (HAM)
 */

import type { Asset } from './asset';
import type { ISODateString, UUID } from './common';

/**
 * Depreciation methods
 */
export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'UNITS_OF_PRODUCTION';

/**
 * Hardware asset entity extending base asset
 */
export interface HardwareAsset extends Asset {
  readonly assetType: 'HARDWARE';
  readonly serialNumber?: string;
  readonly manufacturerId?: UUID;
  readonly modelId?: UUID;
  readonly modelCategory?: string;

  // Location attributes
  readonly stockroomId?: UUID;
  readonly building?: string;
  readonly floor?: string;
  readonly room?: string;
  readonly rack?: string;
  readonly rackUnit?: number;

  // Ownership attributes
  readonly assignedTo?: UUID;
  readonly departmentId?: UUID;
  readonly costCenterId?: UUID;
  readonly managedBy?: UUID;

  // Financial attributes
  readonly purchasePrice?: number;
  readonly residualValue?: number;
  readonly depreciationMethod?: DepreciationMethod;
  readonly depreciationStartDate?: ISODateString;
  readonly usefulLifeMonths?: number;

  // Procurement attributes
  readonly purchaseOrderId?: UUID;
  readonly vendorId?: UUID;
  readonly receivedDate?: ISODateString;
  readonly warrantyExpiration?: ISODateString;

  // Technical attributes
  readonly cpu?: string;
  readonly memoryGb?: number;
  readonly storageGb?: number;
  readonly operatingSystem?: string;
  readonly ipAddress?: string;
  readonly macAddress?: string;
  readonly lastDiscoveredAt?: ISODateString;

  // Lifecycle attributes
  readonly installDate?: ISODateString;
  readonly retirementDate?: ISODateString;
  readonly disposalDate?: ISODateString;
  readonly disposalMethod?: string;
  readonly destructionCertificateId?: UUID;

  // Lease attributes
  readonly leaseContractId?: UUID;
  readonly leaseStartDate?: ISODateString;
  readonly leaseEndDate?: ISODateString;
  readonly monthlyLeaseCost?: number;
}

/**
 * Manufacturer entity for normalization
 */
export interface Manufacturer {
  readonly manufacturerId: UUID;
  readonly name: string;
  readonly normalizedName: string;
  readonly aliases: readonly string[];
}

/**
 * Model entity for normalization
 */
export interface Model {
  readonly modelId: UUID;
  readonly manufacturerId: UUID;
  readonly name: string;
  readonly normalizedName: string;
  readonly category: string;
  readonly aliases: readonly string[];
}

/**
 * Discovery data from external sources
 */
export interface DiscoveryData {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly hostname?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly operatingSystem?: string;
  readonly ipAddress?: string;
  readonly lastSeen: ISODateString;
  readonly rawData: Record<string, unknown>;
}

/**
 * Normalized asset from discovery data
 */
export interface NormalizedAsset {
  readonly serialNumber?: string;
  readonly macAddress?: string;
  readonly manufacturerId?: UUID;
  readonly modelId?: UUID;
  readonly operatingSystem?: string;
  readonly ipAddress?: string;
  readonly normalizedManufacturer: string;
  readonly normalizedModel: string;
}

/**
 * Asset condition for loaner management
 */
export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';

/**
 * Loaner checkout record
 */
export interface LoanerCheckout {
  readonly checkoutId: UUID;
  readonly assetId: UUID;
  readonly checkedOutTo: UUID;
  readonly checkedOutBy?: UUID;
  readonly checkoutDate: ISODateString;
  readonly dueDate: ISODateString;
  readonly returnDate?: ISODateString;
  readonly conditionOut?: AssetCondition;
  readonly conditionIn?: AssetCondition;
  readonly notes?: string;
}

/**
 * Disposal workflow
 */
export interface DisposalWorkflow {
  readonly workflowId: UUID;
  readonly assetId: UUID;
  readonly status: 'INITIATED' | 'DATA_WIPE_PENDING' | 'DATA_WIPE_COMPLETE' | 'PICKUP_SCHEDULED' | 'COMPLETED';
  readonly initiatedBy: UUID;
  readonly initiatedAt: ISODateString;
  readonly dataWipeCompletedAt?: ISODateString;
  readonly pickupScheduledAt?: ISODateString;
  readonly completedAt?: ISODateString;
  readonly destructionCertificateId?: UUID;
}

/**
 * Destruction certificate
 */
export interface DestructionCertificate {
  readonly certificateId: UUID;
  readonly assetId: UUID;
  readonly vendorId: UUID;
  readonly certificateNumber: string;
  readonly destructionDate: ISODateString;
  readonly destructionMethod: string;
  readonly documentUrl?: string;
}
